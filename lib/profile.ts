// Learner profile + Opa's rule-based daily plan generator.
// The profile comes from the onboarding interview (/start) and can be
// refined any time. The AI coach (/coach) uses it too.

import { load, save } from "./storage";

export type Level = "A0" | "A1" | "A2" | "B1" | "B2" | "C1";
export type Goal = "B1" | "B2" | "C1" | "C2";
export type SkillId = "abc" | "vocab" | "grammar" | "listening" | "speaking" | "writing";
// abc is a one-off lesson-zero step, prepended by generatePlan — it isn't
// part of the scaling target system below, so it's excluded from that map.
type CoreSkillId = Exclude<SkillId, "abc">;

export interface Profile {
  level: Level;
  goal: Goal;
  goalWhy: string;
  minutes: 15 | 30 | 60;
  focus: SkillId[];
  createdAt: string;
}

export function loadProfile(): Profile | null {
  return load<Profile | null>("profile", null);
}

export function saveProfile(p: Profile): void {
  save("profile", p);
}

export interface PlanStep {
  skill: SkillId;
  href: string;
  icon: string;
  label: string;
  sub: string;
  target: number;
}

const META: Record<CoreSkillId, { href: string; icon: string; label: string }> = {
  vocab: { href: "/vocab", icon: "🃏", label: "Vocab" },
  grammar: { href: "/grammar", icon: "🧩", label: "Grammar" },
  listening: { href: "/listening", icon: "🎧", label: "Listening" },
  speaking: { href: "/speaking", icon: "🎙️", label: "Speaking" },
  writing: { href: "/writing", icon: "✍️", label: "Writing" },
};

const TARGETS: Record<CoreSkillId, Record<15 | 30 | 60, number>> = {
  vocab: { 15: 10, 30: 15, 60: 25 },
  grammar: { 15: 0, 30: 3, 60: 5 },
  listening: { 15: 3, 30: 5, 60: 8 },
  speaking: { 15: 3, 30: 5, 60: 8 },
  writing: { 15: 0, 30: 1, 60: 1 },
};

const SUBS: Record<CoreSkillId, (n: number, p: Profile) => string> = {
  vocab: (n) => `${n} flashcard reviews — clear due cards first`,
  grammar: (n) => `${n} exercises in one topic`,
  listening: (n, p) => isBeginner(p) ? `${n} word choices correct` : `${n} dictation sentences correct`,
  speaking: (n, p) => isBeginner(p) ? `${n} words understood by the recognizer` : `${n} sentences understood by the recognizer`,
  writing: () => `one draft (20+ words) — use the umlaut keys`,
};

function isBeginner(p: Profile): boolean {
  return p.level === "A0" || p.level === "A1";
}

export function generatePlan(p: Profile): PlanStep[] {
  // Vocab always first (spaced repetition waits for no one),
  // then the learner's focus skills, then the rest.
  const order: CoreSkillId[] = ["vocab", "speaking", "listening", "grammar", "writing"];
  const sorted: CoreSkillId[] = [
    "vocab" as CoreSkillId,
    ...order.filter((s) => s !== "vocab" && p.focus.includes(s)),
    ...order.filter((s) => s !== "vocab" && !p.focus.includes(s)),
  ];

  const steps: PlanStep[] = sorted
    .map((skill) => {
      let target = TARGETS[skill][p.minutes];
      // absolute beginners: pronunciation before writing
      if (skill === "writing" && p.level === "A0" && !p.focus.includes("writing")) target = 0;
      if (skill === "grammar" && target === 0 && p.focus.includes("grammar")) target = 2;
      if (skill === "writing" && target === 0 && p.focus.includes("writing")) target = 1;
      // focused skills get ~50% more
      if (p.focus.includes(skill) && skill !== "writing") target = Math.ceil(target * 1.5);
      return { skill, target, ...META[skill], sub: SUBS[skill](target, p) };
    })
    .filter((s) => s.target > 0);

  // Lesson zero: absolute beginners learn the letter sounds before anything else.
  if (isBeginner(p) && !load("abc:done", false)) {
    steps.unshift({
      skill: "abc",
      href: "/abc",
      icon: "🔤",
      label: "Das ABC",
      sub: "learn the letter sounds first",
      target: 10,
    });
  }

  return steps;
}

export const LEVEL_LABELS: Record<Level, string> = {
  A0: "Complete beginner",
  A1: "A1 — first words",
  A2: "A2 — simple conversations",
  B1: "B1 — independent",
  B2: "B2 — confident",
  C1: "C1 — advanced",
};
