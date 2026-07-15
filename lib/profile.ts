// Learner profile + Opa's rule-based daily plan generator.
// The profile comes from the onboarding interview (/start) and can be
// refined any time. The AI coach (/coach) uses it too.

import { load, save } from "./storage";

export type Level = "A0" | "A1" | "A2" | "B1" | "B2" | "C1";
export type Goal = "B1" | "B2" | "C1" | "C2";
export type SkillId = "vocab" | "grammar" | "listening" | "speaking" | "writing";

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

const META: Record<SkillId, { href: string; icon: string; label: string }> = {
  vocab: { href: "/vocab", icon: "🃏", label: "Vocab" },
  grammar: { href: "/grammar", icon: "🧩", label: "Grammar" },
  listening: { href: "/listening", icon: "🎧", label: "Listening" },
  speaking: { href: "/speaking", icon: "🎙️", label: "Speaking" },
  writing: { href: "/writing", icon: "✍️", label: "Writing" },
};

const TARGETS: Record<SkillId, Record<15 | 30 | 60, number>> = {
  vocab: { 15: 10, 30: 15, 60: 25 },
  grammar: { 15: 0, 30: 3, 60: 5 },
  listening: { 15: 3, 30: 5, 60: 8 },
  speaking: { 15: 3, 30: 5, 60: 8 },
  writing: { 15: 0, 30: 1, 60: 1 },
};

const SUBS: Record<SkillId, (n: number) => string> = {
  vocab: (n) => `${n} flashcard reviews — clear due cards first`,
  grammar: (n) => `${n} exercises in one topic`,
  listening: (n) => `${n} dictation sentences correct`,
  speaking: (n) => `${n} sentences understood by the recognizer`,
  writing: () => `one draft (20+ words) — use the umlaut keys`,
};

export function generatePlan(p: Profile): PlanStep[] {
  // Vocab always first (spaced repetition waits for no one),
  // then the learner's focus skills, then the rest.
  const order: SkillId[] = ["vocab", "speaking", "listening", "grammar", "writing"];
  const sorted = [
    "vocab" as SkillId,
    ...order.filter((s) => s !== "vocab" && p.focus.includes(s)),
    ...order.filter((s) => s !== "vocab" && !p.focus.includes(s)),
  ];

  return sorted
    .map((skill) => {
      let target = TARGETS[skill][p.minutes];
      // absolute beginners: pronunciation before writing
      if (skill === "writing" && p.level === "A0" && !p.focus.includes("writing")) target = 0;
      if (skill === "grammar" && target === 0 && p.focus.includes("grammar")) target = 2;
      if (skill === "writing" && target === 0 && p.focus.includes("writing")) target = 1;
      // focused skills get ~50% more
      if (p.focus.includes(skill) && skill !== "writing") target = Math.ceil(target * 1.5);
      return { skill, target, ...META[skill], sub: SUBS[skill](target) };
    })
    .filter((s) => s.target > 0);
}

export const LEVEL_LABELS: Record<Level, string> = {
  A0: "Complete beginner",
  A1: "A1 — first words",
  A2: "A2 — simple conversations",
  B1: "B1 — independent",
  B2: "B2 — confident",
  C1: "C1 — advanced",
};
