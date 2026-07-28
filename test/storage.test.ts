import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  dateKey,
  recordActivity,
  getTodayCount,
  getTodaySkillCounts,
  getWeekSkillCounts,
  getStreak,
} from "../lib/storage";

const DAY = 86400000;

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * DAY);
}

beforeEach(() => {
  localStorage.clear();
});

describe("dateKey", () => {
  const originalTZ = process.env.TZ;
  afterEach(() => {
    process.env.TZ = originalTZ;
  });

  it("uses the local calendar day, not the UTC day", () => {
    // UTC+14 — always ahead of UTC, so a late-UTC moment falls on the next local day.
    process.env.TZ = "Pacific/Kiritimati";
    const d = new Date("2024-01-01T23:00:00Z");
    expect(dateKey(d)).toBe("2024-01-02");
  });

  it("uses the local calendar day in a far-behind timezone too", () => {
    // UTC-11 — an early-UTC moment is still the previous local day.
    process.env.TZ = "Pacific/Midway";
    const d = new Date("2024-01-02T05:00:00Z");
    expect(dateKey(d)).toBe("2024-01-01");
  });

  it("zero-pads month and day", () => {
    process.env.TZ = "UTC";
    expect(dateKey(new Date("2024-03-05T12:00:00Z"))).toBe("2024-03-05");
  });
});

describe("recordActivity / counts", () => {
  it("accumulates today's total and per-skill counts", () => {
    recordActivity("vocab", 3);
    recordActivity("vocab", 2);
    recordActivity("grammar", 1);
    expect(getTodayCount()).toBe(6);
    expect(getTodaySkillCounts()).toEqual({ vocab: 5, grammar: 1 });
  });

  it("defaults to skill 'other' and count 1", () => {
    recordActivity();
    expect(getTodaySkillCounts()).toEqual({ other: 1 });
  });

  it("rolls up the last 7 days of per-skill counts", () => {
    recordActivity("vocab", 2);
    // seed a day within the 7-day window directly
    const key = dateKey(daysAgo(3));
    localStorage.setItem(
      "sl:activity:skills",
      JSON.stringify({ ...JSON.parse(localStorage.getItem("sl:activity:skills")!), [key]: { vocab: 4, speaking: 1 } })
    );
    const week = getWeekSkillCounts();
    expect(week.vocab).toBe(6);
    expect(week.speaking).toBe(1);
  });
});

describe("getStreak", () => {
  function seedActivity(counts: Record<string, number>) {
    localStorage.setItem("sl:activity", JSON.stringify(counts));
  }

  it("is 0 with no activity at all", () => {
    expect(getStreak()).toBe(0);
  });

  it("is 1 with only today active", () => {
    seedActivity({ [dateKey()]: 1 });
    expect(getStreak()).toBe(1);
  });

  it("counts consecutive days including today", () => {
    seedActivity({
      [dateKey(daysAgo(0))]: 1,
      [dateKey(daysAgo(1))]: 1,
      [dateKey(daysAgo(2))]: 1,
    });
    expect(getStreak()).toBe(3);
  });

  it("still counts from yesterday if today has no activity yet", () => {
    seedActivity({
      [dateKey(daysAgo(1))]: 1,
      [dateKey(daysAgo(2))]: 1,
    });
    expect(getStreak()).toBe(2);
  });

  it("stops at a gap day, even if today is active", () => {
    seedActivity({
      [dateKey(daysAgo(0))]: 1,
      // gap at daysAgo(1)
      [dateKey(daysAgo(2))]: 1,
    });
    expect(getStreak()).toBe(1);
  });

  it("stops at a gap day when starting from yesterday", () => {
    seedActivity({
      [dateKey(daysAgo(1))]: 1,
      // gap at daysAgo(2)
      [dateKey(daysAgo(3))]: 1,
    });
    expect(getStreak()).toBe(1);
  });
});
