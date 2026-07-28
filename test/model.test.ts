import { describe, it, expect, afterAll } from "vitest";
import { buildLearnerModel, type LearnerModelInput } from "../lib/model";
import type { Profile, PlanStep } from "../lib/profile";
import type { Rollups, TelemetryEvent, RollupBucket } from "../lib/telemetry";
import type { VocabItem } from "../lib/srs";

// Fix the timezone so lib/storage's dateKey() (local calendar day) resolves
// identically to the UTC-based day keys this file builds by hand.
const originalTZ = process.env.TZ;
process.env.TZ = "UTC";
afterAll(() => {
  process.env.TZ = originalTZ;
});

const DAY = 86400000;
const NOW = new Date("2024-06-15T12:00:00Z").getTime();

function dayKeyAgo(n: number): string {
  const d = new Date(NOW - n * DAY);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function bucket(n: number, ok: number, msAvg = 0, msN = 0): RollupBucket {
  return { n, ok, msAvg, msN };
}

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    level: "A2",
    goal: "B2",
    goalWhy: "life",
    minutes: 30,
    focus: [],
    createdAt: new Date(NOW - 60 * DAY).toISOString(),
    ...overrides,
  };
}

function ev(type: TelemetryEvent["type"], data: Record<string, unknown>, daysAgo = 0): TelemetryEvent {
  return { t: NOW - daysAgo * DAY, date: dayKeyAgo(daysAgo), type, data };
}

function makePlanStep(skill: PlanStep["skill"], target: number): PlanStep {
  return { skill, href: `/${skill}`, icon: "x", label: skill, sub: "", target };
}

function baseInput(overrides: Partial<LearnerModelInput> = {}): LearnerModelInput {
  return {
    profile: makeProfile(),
    rollups: {},
    events: [],
    cardStore: {},
    skillCountsByDay: {},
    plan: [],
    vocabDeck: [],
    now: NOW,
    ...overrides,
  };
}

describe("buildLearnerModel — perSkill accuracy/trend/latency", () => {
  it("computes 7d vs 30d accuracy and a positive trend when this week beats the trailing month", () => {
    const rollups: Rollups = {};
    // last 7 days: strong (90%), with latency tracked
    for (let i = 0; i < 7; i++) rollups[dayKeyAgo(i)] = { vocab: bucket(10, 9, 1500, 10) };
    // days 7..29 (23 more days): weaker (50%), no latency tracked
    for (let i = 7; i < 30; i++) rollups[dayKeyAgo(i)] = { vocab: bucket(10, 5) };

    const model = buildLearnerModel(baseInput({ rollups }));
    const vocab = model.perSkill.vocab;

    expect(vocab.accuracy7d).toBeCloseTo(63 / 70);
    expect(vocab.accuracy30d).toBeCloseTo((63 + 115) / (70 + 230));
    expect(vocab.trend).toBeGreaterThan(0);
    expect(vocab.avgLatencyMs).toBe(1500);
  });

  it("is all-zero for a skill with no rollup data", () => {
    const model = buildLearnerModel(baseInput());
    expect(model.perSkill.writing).toEqual({ accuracy7d: 0, accuracy30d: 0, trend: 0, avgLatencyMs: 0, skipRate: 0 });
  });

  it("computes skipRate from step_open vs skip events in the last 7 days", () => {
    const events: TelemetryEvent[] = [
      ...Array.from({ length: 10 }, (_, i) => ev("step_open", { skill: "listening" }, i % 7)),
      ...Array.from({ length: 3 }, (_, i) => ev("skip", { skill: "listening", done: 1, target: 5 }, i)),
    ];
    const model = buildLearnerModel(baseInput({ events }));
    expect(model.perSkill.listening.skipRate).toBeCloseTo(0.3);
  });

  it("ignores step_open/skip events older than 7 days", () => {
    const events: TelemetryEvent[] = [
      ev("step_open", { skill: "speaking" }, 20),
      ev("skip", { skill: "speaking", done: 0, target: 3 }, 20),
    ];
    const model = buildLearnerModel(baseInput({ events }));
    expect(model.perSkill.speaking.skipRate).toBe(0);
  });
});

describe("buildLearnerModel — struggling / cruising", () => {
  it("flags a low-accuracy skill as struggling and a high-accuracy one as cruising", () => {
    const rollups: Rollups = {};
    for (let i = 0; i < 3; i++) {
      rollups[dayKeyAgo(i)] = {
        grammar: bucket(2, 0), // 0% accuracy, n=2 each day -> 6 total
        speaking: bucket(2, 2), // 100% accuracy
      };
    }
    const model = buildLearnerModel(baseInput({ rollups }));
    expect(model.struggling).toContain("grammar");
    expect(model.cruising).toContain("speaking");
    expect(model.struggling).not.toContain("speaking");
    expect(model.cruising).not.toContain("grammar");
  });

  it("excludes a skill from both lists when there isn't enough data (n<3)", () => {
    const rollups: Rollups = { [dayKeyAgo(0)]: { writing: bucket(2, 0) } };
    const model = buildLearnerModel(baseInput({ rollups }));
    expect(model.struggling).not.toContain("writing");
    expect(model.cruising).not.toContain("writing");
  });

  it("flags struggling via a high skip rate even with decent accuracy", () => {
    const rollups: Rollups = { [dayKeyAgo(0)]: { grammar: bucket(5, 4) } }; // 80% accuracy
    const events: TelemetryEvent[] = [
      ...Array.from({ length: 4 }, () => ev("step_open", { skill: "grammar" }, 0)),
      ...Array.from({ length: 3 }, () => ev("skip", { skill: "grammar", done: 0, target: 3 }, 0)),
    ];
    const model = buildLearnerModel(baseInput({ rollups, events }));
    expect(model.struggling).toContain("grammar");
  });
});

describe("buildLearnerModel — vocab.seen / matured", () => {
  const deck: VocabItem[] = [
    { id: "v1", de: "eins", en: "one", level: "A2" },
    { id: "v2", de: "zwei", en: "two", level: "A2" },
    { id: "v3", de: "drei", en: "three", level: "A2" },
    { id: "v4", de: "vier", en: "four", level: "B1" },
  ];

  it("counts seen as any deck item with a card, regardless of state", () => {
    const model = buildLearnerModel(baseInput({
      vocabDeck: deck,
      cardStore: {
        v1: { state: 2, stability: 25 },
        v2: { state: 0, stability: 0 },
        v99: { state: 2, stability: 99 }, // not in this deck — must be excluded
      },
    }));
    expect(model.vocab.seen).toBe(2);
  });

  it("counts matured only for Review-state cards with stability >= 21 days", () => {
    const model = buildLearnerModel(baseInput({
      vocabDeck: deck,
      cardStore: {
        v1: { state: 2, stability: 25 }, // matured
        v2: { state: 2, stability: 5 },  // Review but not stable enough
        v3: { state: 1, stability: 40 }, // Learning, not Review — not matured
      },
    }));
    expect(model.vocab.matured).toBe(1);
  });

  it("computes newPerDayEffective as seen / days since profile.createdAt", () => {
    const model = buildLearnerModel(baseInput({
      vocabDeck: deck,
      cardStore: { v1: { state: 2, stability: 25 }, v2: { state: 0, stability: 0 }, v3: { state: 0, stability: 0 } },
      profile: makeProfile({ createdAt: new Date(NOW - 30 * DAY).toISOString() }),
    }));
    expect(model.vocab.newPerDayEffective).toBeCloseTo(3 / 30);
  });
});

describe("buildLearnerModel — vocab.againRate7d", () => {
  it("is again-events / review(vocab)-events within the last 7 days", () => {
    const events: TelemetryEvent[] = [
      ...Array.from({ length: 10 }, (_, i) => ev("review", { skill: "vocab", ok: i >= 3 }, i % 7)),
      ...Array.from({ length: 3 }, (_, i) => ev("again", { itemId: `v${i}` }, i % 7)),
    ];
    const model = buildLearnerModel(baseInput({ events }));
    expect(model.vocab.againRate7d).toBeCloseTo(0.3);
  });

  it("is 0 when there's no vocab review activity", () => {
    const model = buildLearnerModel(baseInput());
    expect(model.vocab.againRate7d).toBe(0);
  });

  it("ignores again-events older than 7 days", () => {
    const events: TelemetryEvent[] = [
      ev("review", { skill: "vocab", ok: true }, 0),
      ev("again", { itemId: "old" }, 10),
    ];
    const model = buildLearnerModel(baseInput({ events }));
    expect(model.vocab.againRate7d).toBe(0);
  });
});

describe("buildLearnerModel — confusions", () => {
  it("ranks repeated wrong-choice pairs by count, most-confused first", () => {
    const events: TelemetryEvent[] = [
      ...Array.from({ length: 3 }, () => ev("choice_wrong", { itemId: "ei", pickedId: "ie" })),
      ...Array.from({ length: 2 }, () => ev("choice_wrong", { itemId: "ei", pickedId: "eu" })),
      ev("choice_wrong", { itemId: "sch", pickedId: "ch" }),
    ];
    const model = buildLearnerModel(baseInput({ events }));
    expect(model.confusions[0]).toEqual({ itemId: "ei", pickedId: "ie", count: 3 });
    expect(model.confusions[1]).toEqual({ itemId: "ei", pickedId: "eu", count: 2 });
    expect(model.confusions[2]).toEqual({ itemId: "sch", pickedId: "ch", count: 1 });
  });

  it("caps the list at the top 5 pairs", () => {
    const events: TelemetryEvent[] = Array.from({ length: 6 }, (_, i) => ev("choice_wrong", { itemId: `a${i}`, pickedId: `b${i}` }));
    const model = buildLearnerModel(baseInput({ events }));
    expect(model.confusions.length).toBe(5);
  });

  it("ignores review/again events — only choice_wrong feeds confusions", () => {
    const events: TelemetryEvent[] = [ev("review", { skill: "listening", itemId: "x", ok: false })];
    const model = buildLearnerModel(baseInput({ events }));
    expect(model.confusions).toEqual([]);
  });
});

describe("buildLearnerModel — readyForLevelUp", () => {
  const deck: VocabItem[] = [
    { id: "a1", de: "a1", en: "a1", level: "A2" },
    { id: "a2", de: "a2", en: "a2", level: "A2" },
    { id: "a3", de: "a3", en: "a3", level: "A2" },
    { id: "b1", de: "b1", en: "b1", level: "B1" },
  ];

  it("is true when current-level vocab is mostly seen, again-rate is low, and listening accuracy is high", () => {
    const rollups: Rollups = { [dayKeyAgo(0)]: { listening: bucket(10, 9) } }; // 90%
    const model = buildLearnerModel(baseInput({
      profile: makeProfile({ level: "A2" }),
      vocabDeck: deck,
      cardStore: { a1: { state: 2, stability: 30 }, a2: { state: 2, stability: 30 }, a3: { state: 2, stability: 30 } },
      rollups,
      events: [
        ev("review", { skill: "vocab", ok: true }, 0),
        ev("review", { skill: "vocab", ok: true }, 0),
      ],
    }));
    expect(model.readyForLevelUp).toBe(true);
  });

  it("is false when current-level vocab coverage is under 80%", () => {
    const rollups: Rollups = { [dayKeyAgo(0)]: { listening: bucket(10, 9) } };
    const model = buildLearnerModel(baseInput({
      profile: makeProfile({ level: "A2" }),
      vocabDeck: deck,
      cardStore: { a1: { state: 2, stability: 30 } }, // only 1/3 current-level items seen
      rollups,
    }));
    expect(model.readyForLevelUp).toBe(false);
  });

  it("is false when listening accuracy is below 85%", () => {
    const rollups: Rollups = { [dayKeyAgo(0)]: { listening: bucket(10, 5) } }; // 50%
    const model = buildLearnerModel(baseInput({
      profile: makeProfile({ level: "A2" }),
      vocabDeck: deck,
      cardStore: { a1: { state: 2, stability: 30 }, a2: { state: 2, stability: 30 }, a3: { state: 2, stability: 30 } },
      rollups,
    }));
    expect(model.readyForLevelUp).toBe(false);
  });

  it("is false when the again-rate is too high", () => {
    const rollups: Rollups = { [dayKeyAgo(0)]: { listening: bucket(10, 9) } };
    const events: TelemetryEvent[] = [
      ev("review", { skill: "vocab", ok: false }, 0),
      ev("review", { skill: "vocab", ok: false }, 0),
      ev("again", { itemId: "a1" }, 0),
      ev("again", { itemId: "a1" }, 0),
    ];
    const model = buildLearnerModel(baseInput({
      profile: makeProfile({ level: "A2" }),
      vocabDeck: deck,
      cardStore: { a1: { state: 2, stability: 30 }, a2: { state: 2, stability: 30 }, a3: { state: 2, stability: 30 } },
      rollups,
      events,
    }));
    expect(model.readyForLevelUp).toBe(false);
  });
});

describe("buildLearnerModel — overloaded", () => {
  const plan: PlanStep[] = [makePlanStep("vocab", 10), makePlanStep("listening", 5)];

  it("is true when the plan was fully completed on fewer than 40% of active days", () => {
    const skillCountsByDay: Record<string, Record<string, number>> = {};
    // 5 active days: only 1 fully meets both targets
    skillCountsByDay[dayKeyAgo(0)] = { vocab: 10, listening: 5 }; // completed
    skillCountsByDay[dayKeyAgo(1)] = { vocab: 4, listening: 2 };  // not completed
    skillCountsByDay[dayKeyAgo(2)] = { vocab: 10, listening: 1 }; // not completed
    skillCountsByDay[dayKeyAgo(3)] = { vocab: 2, listening: 5 };  // not completed
    skillCountsByDay[dayKeyAgo(4)] = { vocab: 1, listening: 0 };  // not completed
    const model = buildLearnerModel(baseInput({ plan, skillCountsByDay }));
    expect(model.overloaded).toBe(true);
  });

  it("is false when completion rate is at or above 40%", () => {
    const skillCountsByDay: Record<string, Record<string, number>> = {};
    skillCountsByDay[dayKeyAgo(0)] = { vocab: 10, listening: 5 }; // completed
    skillCountsByDay[dayKeyAgo(1)] = { vocab: 10, listening: 5 }; // completed
    skillCountsByDay[dayKeyAgo(2)] = { vocab: 1, listening: 0 };  // not completed
    const model = buildLearnerModel(baseInput({ plan, skillCountsByDay }));
    expect(model.overloaded).toBe(false);
  });

  it("is false when there were no active days at all", () => {
    const model = buildLearnerModel(baseInput({ plan, skillCountsByDay: {} }));
    expect(model.overloaded).toBe(false);
  });
});
