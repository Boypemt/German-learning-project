import { describe, it, expect, beforeEach } from "vitest";
import { generatePlan, type Profile } from "../lib/profile";

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

beforeEach(() => {
  localStorage.clear();
});

describe("generatePlan — beginner Das ABC step", () => {
  it("prepends the abc step for A0 when not yet done", () => {
    const plan = generatePlan(makeProfile({ level: "A0" }));
    expect(plan[0]).toMatchObject({ skill: "abc", href: "/abc", target: 10 });
  });

  it("prepends the abc step for A1 when not yet done", () => {
    const plan = generatePlan(makeProfile({ level: "A1" }));
    expect(plan[0].skill).toBe("abc");
  });

  it("omits the abc step once abc:done is true", () => {
    localStorage.setItem("sl:abc:done", "true");
    const plan = generatePlan(makeProfile({ level: "A0" }));
    expect(plan.some((s) => s.skill === "abc")).toBe(false);
  });

  it("never adds the abc step for non-beginners, done or not", () => {
    const plan = generatePlan(makeProfile({ level: "A2" }));
    expect(plan.some((s) => s.skill === "abc")).toBe(false);
  });

  it("vocab is still first after the abc step", () => {
    const plan = generatePlan(makeProfile({ level: "A0" }));
    expect(plan[1].skill).toBe("vocab");
  });
});

describe("generatePlan — vocab always first", () => {
  it("vocab leads the plan regardless of focus", () => {
    const plan = generatePlan(makeProfile({ level: "B2", focus: ["writing"] }));
    expect(plan[0].skill).toBe("vocab");
  });
});

describe("generatePlan — focus boosts", () => {
  it("boosts a focused skill's target by ~50% over the baseline", () => {
    const unfocused = generatePlan(makeProfile({ minutes: 30, focus: [] }));
    const focused = generatePlan(makeProfile({ minutes: 30, focus: ["vocab"] }));
    const base = unfocused.find((s) => s.skill === "vocab")!.target;
    const boosted = focused.find((s) => s.skill === "vocab")!.target;
    expect(base).toBe(15);
    expect(boosted).toBe(Math.ceil(15 * 1.5));
  });

  it("does not boost skills that aren't in focus", () => {
    const plan = generatePlan(makeProfile({ minutes: 30, focus: ["vocab"] }));
    const listening = plan.find((s) => s.skill === "listening")!.target;
    expect(listening).toBe(5); // baseline TARGETS.listening[30], unboosted
  });

  it("a zero-baseline focused skill (grammar at 15 min) gets floored then boosted", () => {
    // grammar baseline at 15min is 0 -> the grammar-focus override floors it
    // to 2, then the general 1.5x focus boost still applies on top: ceil(2*1.5)=3.
    const plan = generatePlan(makeProfile({ minutes: 15, focus: ["grammar"] }));
    const grammar = plan.find((s) => s.skill === "grammar")!.target;
    expect(grammar).toBe(3);
  });

  it("an unfocused zero-baseline skill (grammar at 15 min) is excluded entirely", () => {
    const plan = generatePlan(makeProfile({ minutes: 15, focus: [] }));
    expect(plan.some((s) => s.skill === "grammar")).toBe(false);
  });
});

describe("generatePlan — writing gating", () => {
  it("A0 without writing in focus excludes writing, even with time for it", () => {
    const plan30 = generatePlan(makeProfile({ level: "A0", minutes: 30, focus: [] }));
    const plan60 = generatePlan(makeProfile({ level: "A0", minutes: 60, focus: [] }));
    expect(plan30.some((s) => s.skill === "writing")).toBe(false);
    expect(plan60.some((s) => s.skill === "writing")).toBe(false);
  });

  it("A0 WITH writing in focus keeps writing at its baseline target (not boosted)", () => {
    const plan = generatePlan(makeProfile({ level: "A0", minutes: 30, focus: ["writing"] }));
    const writing = plan.find((s) => s.skill === "writing");
    expect(writing?.target).toBe(1); // baseline TARGETS.writing[30], general boost skips writing
  });

  it("A0 with writing in focus at 15 min floors target to 1 (baseline is 0)", () => {
    const plan = generatePlan(makeProfile({ level: "A0", minutes: 15, focus: ["writing"] }));
    const writing = plan.find((s) => s.skill === "writing");
    expect(writing?.target).toBe(1);
  });

  it("A1 (not A0) includes writing by default, unlike A0", () => {
    const plan = generatePlan(makeProfile({ level: "A1", minutes: 30, focus: [] }));
    const writing = plan.find((s) => s.skill === "writing");
    expect(writing?.target).toBe(1);
  });

  it("non-beginner levels are never gated on writing focus", () => {
    const plan = generatePlan(makeProfile({ level: "B1", minutes: 30, focus: [] }));
    const writing = plan.find((s) => s.skill === "writing");
    expect(writing?.target).toBe(1);
  });
});

describe("generatePlan — beginner-aware sub text", () => {
  it("uses word-based copy for listening/speaking when beginner", () => {
    const plan = generatePlan(makeProfile({ level: "A1", minutes: 30 }));
    expect(plan.find((s) => s.skill === "listening")?.sub).toMatch(/word choices correct/);
    expect(plan.find((s) => s.skill === "speaking")?.sub).toMatch(/words understood/);
  });

  it("uses sentence-based copy for listening/speaking for non-beginners", () => {
    const plan = generatePlan(makeProfile({ level: "B1", minutes: 30 }));
    expect(plan.find((s) => s.skill === "listening")?.sub).toMatch(/dictation sentences correct/);
    expect(plan.find((s) => s.skill === "speaking")?.sub).toMatch(/sentences understood/);
  });
});
