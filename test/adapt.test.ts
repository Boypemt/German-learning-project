import { describe, it, expect, beforeEach, afterAll } from "vitest";
import {
  computeAdaptation,
  getAdaptation,
  isLevelUpSnoozed,
  snoozeLevelUp,
  isLevelDownSnoozed,
  snoozeLevelDown,
  levenshtein,
  chooseListeningOptions,
  newCardsPerSession,
  isItemSnoozed,
  snoozeSpeakingItem,
  SPEAKING_SKIP_AFTER_FAILS,
  isAbcTurn,
  type Adaptation,
} from "../lib/adapt";
import { CORE_SKILLS, type LearnerModel, type SkillStats } from "../lib/model";
import type { Profile } from "../lib/profile";
import type { VocabItem } from "../lib/srs";

const originalTZ = process.env.TZ;
process.env.TZ = "UTC";
afterAll(() => {
  process.env.TZ = originalTZ;
});

beforeEach(() => {
  localStorage.clear();
});

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    level: "A2",
    goal: "B2",
    goalWhy: "life",
    minutes: 30,
    focus: [],
    createdAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function zeroStats(): SkillStats {
  return { accuracy7d: 0, accuracy30d: 0, trend: 0, avgLatencyMs: 0, skipRate: 0 };
}

function makeModel(overrides: Partial<LearnerModel> = {}): LearnerModel {
  const perSkill = Object.fromEntries(CORE_SKILLS.map((s) => [s, zeroStats()])) as LearnerModel["perSkill"];
  return {
    perSkill,
    vocab: { seen: 0, matured: 0, againRate7d: 0, newPerDayEffective: 0 },
    confusions: [],
    struggling: [],
    cruising: [],
    readyForLevelUp: false,
    overloaded: false,
    ...overrides,
  };
}

describe("computeAdaptation — struggling / cruising", () => {
  it("boosts a struggling skill's target 25%, moves it earlier, and announces why", () => {
    const model = makeModel({ struggling: ["grammar"] });
    const a = computeAdaptation(makeProfile(), model, "2024-06-15", null);
    expect(a.perSkill.grammar).toEqual({ targetMultiplier: 1.25, reason: "struggling", moveEarlier: true });
    expect(a.notes.some((n) => n.includes("Grammar"))).toBe(true);
  });

  it("cuts a cruising skill's target 25% and does not move it earlier", () => {
    const model = makeModel({ cruising: ["speaking"] });
    const a = computeAdaptation(makeProfile(), model, "2024-06-15", null);
    expect(a.perSkill.speaking).toEqual({ targetMultiplier: 0.75, reason: "cruising", moveEarlier: false });
    expect(a.notes.some((n) => n.includes("Speaking"))).toBe(true);
  });

  it("leaves neutral skills with no adaptation entry", () => {
    const model = makeModel({ struggling: ["grammar"], cruising: ["speaking"] });
    const a = computeAdaptation(makeProfile(), model, "2024-06-15", null);
    expect(a.perSkill.vocab).toBeUndefined();
    expect(a.perSkill.listening).toBeUndefined();
    expect(a.perSkill.writing).toBeUndefined();
  });

  it("produces no notes and no per-skill entries when nothing is struggling/cruising", () => {
    const a = computeAdaptation(makeProfile(), makeModel(), "2024-06-15", null);
    expect(a.notes).toEqual([]);
    expect(Object.keys(a.perSkill)).toEqual([]);
  });
});

describe("computeAdaptation — overloaded", () => {
  it("cuts every skill's target 30% and opens a 7-day relief window on first trigger", () => {
    const model = makeModel({ overloaded: true, struggling: ["grammar"], cruising: ["speaking"] });
    const a = computeAdaptation(makeProfile(), model, "2024-06-15", null);
    for (const skill of CORE_SKILLS) {
      expect(a.perSkill[skill]).toEqual({ targetMultiplier: 0.7, reason: "overloaded", moveEarlier: false });
    }
    expect(a.overloaded).toBe(true);
    expect(a.overloadedUntil).toBe("2024-06-22"); // +7 days
    expect(a.notes.some((n) => n.toLowerCase().includes("konstanz") || n.toLowerCase().includes("consistency"))).toBe(true);
  });

  it("overrides struggling/cruising — overload is a global reset, not per-skill", () => {
    const model = makeModel({ overloaded: true, struggling: ["grammar"] });
    const a = computeAdaptation(makeProfile(), model, "2024-06-15", null);
    expect(a.perSkill.grammar?.reason).toBe("overloaded");
    expect(a.notes.some((n) => n.includes("Grammar"))).toBe(false);
  });

  it("stays active for the rest of the week even if the model stops reporting overloaded", () => {
    const previous: Adaptation = {
      date: "2024-06-15",
      perSkill: {},
      overloaded: true,
      overloadedUntil: "2024-06-22",
      confusionDrillPairs: [],
      notes: [],
      readyForLevelUp: false,
      levelDownSuggested: false,
    };
    const model = makeModel({ overloaded: false }); // learner caught up already
    const a = computeAdaptation(makeProfile(), model, "2024-06-18", previous);
    expect(a.overloaded).toBe(true);
    expect(a.overloadedUntil).toBe("2024-06-22"); // unchanged — relief window carried forward
    expect(a.perSkill.vocab?.reason).toBe("overloaded");
  });

  it("relief window ends once today reaches overloadedUntil", () => {
    const previous: Adaptation = {
      date: "2024-06-21",
      perSkill: {},
      overloaded: true,
      overloadedUntil: "2024-06-22",
      confusionDrillPairs: [],
      notes: [],
      readyForLevelUp: false,
      levelDownSuggested: false,
    };
    const model = makeModel({ overloaded: false });
    const a = computeAdaptation(makeProfile(), model, "2024-06-22", previous);
    expect(a.overloaded).toBe(false);
    expect(Object.keys(a.perSkill)).toEqual([]);
  });
});

describe("computeAdaptation — confusion drill pairs", () => {
  it("only includes repeat offenders (count >= 2), cycled to exactly 5", () => {
    const model = makeModel({
      confusions: [
        { itemId: "ei", pickedId: "ie", count: 4 },
        { itemId: "sch", pickedId: "ch", count: 2 },
        { itemId: "x", pickedId: "y", count: 1 }, // not a repeat offender
      ],
    });
    const a = computeAdaptation(makeProfile(), model, "2024-06-15", null);
    expect(a.confusionDrillPairs.length).toBe(5);
    expect(a.confusionDrillPairs.every((p) => p.count >= 2)).toBe(true);
    // cycles: [ei/ie, sch/ch, ei/ie, sch/ch, ei/ie]
    expect(a.confusionDrillPairs.map((p) => p.itemId)).toEqual(["ei", "sch", "ei", "sch", "ei"]);
  });

  it("is empty when there are no repeat offenders", () => {
    const model = makeModel({ confusions: [{ itemId: "x", pickedId: "y", count: 1 }] });
    const a = computeAdaptation(makeProfile(), model, "2024-06-15", null);
    expect(a.confusionDrillPairs).toEqual([]);
  });
});

describe("computeAdaptation — level flags", () => {
  it("passes readyForLevelUp through from the model", () => {
    const a = computeAdaptation(makeProfile(), makeModel({ readyForLevelUp: true }), "2024-06-15", null);
    expect(a.readyForLevelUp).toBe(true);
  });

  it("suggests leveling down when vocab againRate7d exceeds 50%", () => {
    const a = computeAdaptation(makeProfile(), makeModel({ vocab: { seen: 0, matured: 0, againRate7d: 0.51, newPerDayEffective: 0 } }), "2024-06-15", null);
    expect(a.levelDownSuggested).toBe(true);
  });

  it("does not suggest leveling down at or below 50%", () => {
    const a = computeAdaptation(makeProfile(), makeModel({ vocab: { seen: 0, matured: 0, againRate7d: 0.5, newPerDayEffective: 0 } }), "2024-06-15", null);
    expect(a.levelDownSuggested).toBe(false);
  });
});

describe("getAdaptation — daily caching", () => {
  it("computes and stores an adaptation on first call", () => {
    const a = getAdaptation(makeProfile(), makeModel({ struggling: ["vocab"] }));
    expect(a.perSkill.vocab?.reason).toBe("struggling");
    expect(JSON.parse(localStorage.getItem("sl:adapt")!)).toEqual(a);
  });

  it("returns the cached value for a second call the same day, even if the model changed", () => {
    const first = getAdaptation(makeProfile(), makeModel({ struggling: ["vocab"] }));
    const second = getAdaptation(makeProfile(), makeModel({ struggling: ["grammar"] }));
    expect(second).toEqual(first); // still struggling: vocab, not grammar
  });
});

describe("level snooze", () => {
  it("is not snoozed before snoozeLevelUp is called", () => {
    expect(isLevelUpSnoozed()).toBe(false);
    expect(isLevelDownSnoozed()).toBe(false);
  });

  it("snoozeLevelUp hides the suggestion for 14 days", () => {
    const now = new Date("2024-06-15T00:00:00Z").getTime();
    snoozeLevelUp(now);
    expect(isLevelUpSnoozed(now)).toBe(true);
    expect(isLevelUpSnoozed(now + 13 * 86400000)).toBe(true);
    expect(isLevelUpSnoozed(now + 14 * 86400000)).toBe(false);
  });

  it("snoozeLevelDown is independent of snoozeLevelUp", () => {
    const now = Date.now();
    snoozeLevelUp(now);
    expect(isLevelDownSnoozed(now)).toBe(false);
    snoozeLevelDown(now);
    expect(isLevelDownSnoozed(now)).toBe(true);
  });
});

describe("levenshtein", () => {
  it("is 0 for identical strings", () => {
    expect(levenshtein("mein", "mein")).toBe(0);
  });

  it("matches known distances", () => {
    expect(levenshtein("kitten", "sitting")).toBe(3);
    expect(levenshtein("", "abc")).toBe(3);
    expect(levenshtein("ei", "ie")).toBe(2);
  });
});

describe("chooseListeningOptions", () => {
  const target: VocabItem = { id: "t", de: "mein", en: "my", level: "A1" };
  const pool: VocabItem[] = [
    { id: "close1", de: "mien", en: "x1", level: "A1" }, // levenshtein 2 from "mein"
    { id: "close2", de: "meim", en: "x2", level: "A1" }, // levenshtein 1 from "mein"
    { id: "far1", de: "Haus", en: "house", level: "A1" },
    { id: "far2", de: "Buch", en: "book", level: "A1" },
    { id: "far3", de: "Auto", en: "car", level: "A1" },
  ];

  it("drops to 3 total choices when accuracy7d < 0.6", () => {
    const opts = chooseListeningOptions(target, pool, 0.5);
    expect(opts.length).toBe(3);
    expect(opts.some((o) => o.id === target.id)).toBe(true);
  });

  it("uses 4 choices in the default 0.6-0.85 band", () => {
    const opts = chooseListeningOptions(target, pool, 0.7);
    expect(opts.length).toBe(4);
  });

  it("picks the spelling-closest distractors when accuracy7d >= 0.85", () => {
    const opts = chooseListeningOptions(target, pool, 0.9);
    const ids = opts.map((o) => o.id).filter((id) => id !== target.id);
    expect(ids.sort()).toEqual(["close1", "close2", "far1"].sort());
  });

  it("never includes the target twice or omits it", () => {
    for (const acc of [0.3, 0.7, 0.95]) {
      const opts = chooseListeningOptions(target, pool, acc);
      expect(opts.filter((o) => o.id === target.id).length).toBe(1);
    }
  });

  it("forces mustInclude distractors in even under the random/similarity rule", () => {
    const forced = pool.find((v) => v.id === "far2")!;
    const opts = chooseListeningOptions(target, pool, 0.9, [forced]);
    expect(opts.some((o) => o.id === "far2")).toBe(true);
  });
});

describe("newCardsPerSession", () => {
  it("defaults to 10 in the neutral band", () => {
    expect(newCardsPerSession(0.2)).toBe(10);
    expect(newCardsPerSession(0.1)).toBe(10); // boundary — not < 0.1
    expect(newCardsPerSession(0.3)).toBe(10); // boundary — not > 0.3
  });

  it("drops to 5 when again-rate is high", () => {
    expect(newCardsPerSession(0.31)).toBe(5);
    expect(newCardsPerSession(0.9)).toBe(5);
  });

  it("rises to 15 when again-rate is low", () => {
    expect(newCardsPerSession(0.09)).toBe(15);
    expect(newCardsPerSession(0)).toBe(15);
  });
});

describe("speaking skip/snooze", () => {
  it("is not snoozed before being skipped", () => {
    expect(isItemSnoozed("w1")).toBe(false);
  });

  it("snoozes an item until tomorrow, not longer", () => {
    const now = new Date("2024-06-15T12:00:00Z").getTime();
    snoozeSpeakingItem("w1", now);
    expect(isItemSnoozed("w1", now)).toBe(true);
    expect(isItemSnoozed("w1", now + 86400000)).toBe(false); // tomorrow it's back
  });

  it("cleans up expired entries opportunistically", () => {
    localStorage.setItem("sl:speaking:snoozed", JSON.stringify({ old: "2000-01-01" }));
    snoozeSpeakingItem("w2", new Date("2024-06-15T00:00:00Z").getTime());
    const stored = JSON.parse(localStorage.getItem("sl:speaking:snoozed")!);
    expect(stored.old).toBeUndefined();
    expect(stored.w2).toBeDefined();
  });

  it("exposes the fail threshold as a named constant", () => {
    expect(SPEAKING_SKIP_AFTER_FAILS).toBe(3);
  });
});

describe("isAbcTurn — ABC/vocab question mixing ratio", () => {
  it("alternates roughly half the time before abc:done", () => {
    const turns = Array.from({ length: 10 }, (_, i) => isAbcTurn(i, false));
    expect(turns).toEqual([true, false, true, false, true, false, true, false, true, false]);
    expect(turns.filter(Boolean).length).toBe(5); // exactly half of 10
  });

  it("sprinkles 1-in-4 after abc:done", () => {
    const turns = Array.from({ length: 12 }, (_, i) => isAbcTurn(i, true));
    expect(turns).toEqual([
      true, false, false, false,
      true, false, false, false,
      true, false, false, false,
    ]);
    expect(turns.filter(Boolean).length).toBe(3); // 1 in 4 of 12
  });

  it("is false for negative indices (defensive — before the rotation starts)", () => {
    expect(isAbcTurn(-1, false)).toBe(false);
    expect(isAbcTurn(-1, true)).toBe(false);
  });

  it("always starts on an abc turn at index 0, done or not", () => {
    expect(isAbcTurn(0, false)).toBe(true);
    expect(isAbcTurn(0, true)).toBe(true);
  });
});
