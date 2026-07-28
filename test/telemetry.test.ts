import { describe, it, expect, beforeEach } from "vitest";
import { logEvent, getEvents, getRollups, trimEvents, type TelemetryEvent } from "../lib/telemetry";
import { todayKey } from "../lib/storage";

beforeEach(() => {
  localStorage.clear();
});

describe("logEvent — ring buffer (sl:events)", () => {
  it("appends events in order", () => {
    logEvent("step_open", { skill: "vocab" });
    logEvent("review", { skill: "vocab", ok: true });
    const events = getEvents();
    expect(events.map((e) => e.type)).toEqual(["step_open", "review"]);
  });

  it("stamps each event with a timestamp and the local date key", () => {
    logEvent("session", { minutes: 10 });
    const [e] = getEvents();
    expect(typeof e.t).toBe("number");
    expect(e.date).toBe(todayKey());
  });

  it("caps the buffer at 800, dropping the oldest first", () => {
    for (let i = 0; i < 850; i++) logEvent("again", { itemId: `item-${i}` });
    const events = getEvents();
    expect(events.length).toBe(800);
    expect(events[0].data.itemId).toBe("item-50"); // oldest 50 dropped
    expect(events[events.length - 1].data.itemId).toBe("item-849");
  });
});

describe("trimEvents", () => {
  it("is a no-op at or under the cap", () => {
    const events = Array.from({ length: 800 }, (_, i) => ({ t: i, date: "2024-01-01", type: "session", data: {} })) as TelemetryEvent[];
    expect(trimEvents(events)).toEqual(events);
  });

  it("keeps only the newest 800 over the cap", () => {
    const events = Array.from({ length: 810 }, (_, i) => ({ t: i, date: "2024-01-01", type: "session", data: { i } })) as TelemetryEvent[];
    const trimmed = trimEvents(events);
    expect(trimmed.length).toBe(800);
    expect(trimmed[0].data.i).toBe(10);
    expect(trimmed[trimmed.length - 1].data.i).toBe(809);
  });
});

describe("logEvent — rollups (sl:rollups)", () => {
  it("creates a per-day/per-skill bucket on the first review", () => {
    logEvent("review", { skill: "vocab", ok: true, ms: 2000 });
    expect(getRollups()[todayKey()].vocab).toEqual({ n: 1, ok: 1, msAvg: 2000, msN: 1 });
  });

  it("accumulates n/ok and averages latency across multiple reviews", () => {
    logEvent("review", { skill: "vocab", ok: true, ms: 1000 });
    logEvent("review", { skill: "vocab", ok: false, ms: 3000 });
    const bucket = getRollups()[todayKey()].vocab;
    expect(bucket.n).toBe(2);
    expect(bucket.ok).toBe(1);
    expect(bucket.msAvg).toBe(2000); // (1000+3000)/2
    expect(bucket.msN).toBe(2);
  });

  it("does not let untimed reviews drag msAvg toward 0", () => {
    logEvent("review", { skill: "grammar", ok: true, ms: 4000 });
    logEvent("review", { skill: "grammar", ok: true }); // no ms supplied
    const bucket = getRollups()[todayKey()].grammar;
    expect(bucket.n).toBe(2);
    expect(bucket.msAvg).toBe(4000); // unaffected by the untimed sample
    expect(bucket.msN).toBe(1);
  });

  it("keeps separate buckets per skill", () => {
    logEvent("review", { skill: "vocab", ok: true });
    logEvent("review", { skill: "listening", ok: false });
    const day = getRollups()[todayKey()];
    expect(day.vocab).toMatchObject({ n: 1, ok: 1 });
    expect(day.listening).toMatchObject({ n: 1, ok: 0 });
  });

  it("only 'review' events roll up — other types are supplementary raw signals only", () => {
    logEvent("step_open", { skill: "vocab" });
    logEvent("again", { itemId: "x" });
    logEvent("choice_wrong", { itemId: "x", pickedId: "y" });
    logEvent("sayit", { ok: true });
    logEvent("replay", { skill: "speaking", slow: true });
    logEvent("skip", { skill: "writing", done: 0, target: 1 });
    logEvent("session", { minutes: 5 });
    expect(getRollups()).toEqual({});
    expect(getEvents().length).toBe(7); // still recorded raw, just not rolled up
  });
});

describe("logEvent — rollup day retention cap", () => {
  it("prunes the oldest days once more than ~13 months accumulate", () => {
    const rollups: Record<string, unknown> = {};
    for (let i = 0; i < 410; i++) {
      const d = new Date(2020, 0, 1 + i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      rollups[key] = { vocab: { n: 1, ok: 1, msAvg: 0, msN: 0 } };
    }
    localStorage.setItem("sl:rollups", JSON.stringify(rollups));
    logEvent("review", { skill: "vocab", ok: true });
    expect(Object.keys(getRollups()).length).toBeLessThanOrEqual(400);
  });
});
