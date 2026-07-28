// The learner model — turns rollups + raw events + the FSRS card store +
// profile into a compact summary that both "Opas Zeugnis" (/coach) and the
// AI coach prompt reason from.
//
// buildLearnerModel() is a pure function: given a fully materialized
// LearnerModelInput snapshot (including an injectable `now`), it always
// returns the same output — no localStorage, no Date.now() side effects.
// getLearnerModel() below is the impure assembler that reads live state.

import { dateKey, load } from "./storage";
import { levelIndex } from "./content";
import { generatePlan, type Profile, type CoreSkillId, type PlanStep } from "./profile";
import { getCardStore } from "./srs";
import { getVocabDeck } from "./content";
import { getRollups, getEvents, type Rollups, type TelemetryEvent } from "./telemetry";
import type { VocabItem } from "./srs";

const DAY = 86400000;
const MATURE_STABILITY_DAYS = 21; // FSRS stability, in days — the usual "mature card" bar

export const CORE_SKILLS: CoreSkillId[] = ["vocab", "grammar", "listening", "speaking", "writing"];

/** The couple of FSRS Card fields the model actually needs. */
export interface CardSnapshot {
  state: number; // ts-fsrs State: 0 New, 1 Learning, 2 Review, 3 Relearning
  stability: number;
}

export interface LearnerModelInput {
  profile: Profile;
  rollups: Rollups;
  events: TelemetryEvent[];
  cardStore: Record<string, CardSnapshot>;
  /** date -> skill -> review count that day (sl:activity:skills). */
  skillCountsByDay: Record<string, Record<string, number>>;
  /** The learner's current plan (generatePlan(profile)) — passed in rather
   *  than recomputed here so this function stays free of the abc:done
   *  localStorage read buried inside generatePlan. */
  plan: PlanStep[];
  /** Vocab deck for the learner's level (getVocabDeck(profile.level)). */
  vocabDeck: VocabItem[];
  /** Injectable clock for deterministic tests; defaults to Date.now(). */
  now?: number;
}

export interface SkillStats {
  accuracy7d: number;
  accuracy30d: number;
  /** accuracy7d - accuracy30d; positive means this week is better than the trailing month. */
  trend: number;
  avgLatencyMs: number;
  /** step_open events in the last 7 days that ended in a skip, over all step_opens. */
  skipRate: number;
}

export interface ConfusionPair {
  itemId: string;
  pickedId: string;
  count: number;
}

export interface LearnerModel {
  perSkill: Record<CoreSkillId, SkillStats>;
  vocab: { seen: number; matured: number; againRate7d: number; newPerDayEffective: number };
  confusions: ConfusionPair[];
  struggling: CoreSkillId[];
  cruising: CoreSkillId[];
  readyForLevelUp: boolean;
  overloaded: boolean;
}

function lastNDateKeys(now: number, n: number): string[] {
  return Array.from({ length: n }, (_, i) => dateKey(new Date(now - i * DAY)));
}

function rollupWindow(rollups: Rollups, skill: string, days: string[]): { n: number; ok: number; msSum: number; msN: number } {
  let n = 0, ok = 0, msSum = 0, msN = 0;
  for (const day of days) {
    const b = rollups[day]?.[skill];
    if (!b) continue;
    n += b.n;
    ok += b.ok;
    if (b.msN > 0) {
      msSum += b.msAvg * b.msN;
      msN += b.msN;
    }
  }
  return { n, ok, msSum, msN };
}

function skillSkipRate(events7d: TelemetryEvent[], skill: string): number {
  const opens = events7d.filter((e) => e.type === "step_open" && e.data.skill === skill).length;
  const skips = events7d.filter((e) => e.type === "skip" && e.data.skill === skill).length;
  return opens > 0 ? skips / opens : 0;
}

function computeConfusions(events: TelemetryEvent[], limit = 5): ConfusionPair[] {
  const counts = new Map<string, ConfusionPair>();
  for (const e of events) {
    if (e.type !== "choice_wrong") continue;
    const itemId = typeof e.data.itemId === "string" ? e.data.itemId : "";
    const pickedId = typeof e.data.pickedId === "string" ? e.data.pickedId : "";
    if (!itemId || !pickedId) continue;
    const key = `${itemId}|${pickedId}`;
    const cur = counts.get(key) ?? { itemId, pickedId, count: 0 };
    cur.count += 1;
    counts.set(key, cur);
  }
  return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}

export function buildLearnerModel(input: LearnerModelInput): LearnerModel {
  const now = input.now ?? Date.now();
  const days7 = lastNDateKeys(now, 7);
  const days30 = lastNDateKeys(now, 30);
  const cutoff7 = now - 7 * DAY;
  const events7 = input.events.filter((e) => e.t >= cutoff7);

  const perSkill = {} as Record<CoreSkillId, SkillStats>;
  const struggling: CoreSkillId[] = [];
  const cruising: CoreSkillId[] = [];

  for (const skill of CORE_SKILLS) {
    const w7 = rollupWindow(input.rollups, skill, days7);
    const w30 = rollupWindow(input.rollups, skill, days30);
    const accuracy7d = w7.n > 0 ? w7.ok / w7.n : 0;
    const accuracy30d = w30.n > 0 ? w30.ok / w30.n : 0;
    const skipRate = skillSkipRate(events7, skill);
    perSkill[skill] = {
      accuracy7d,
      accuracy30d,
      trend: w7.n > 0 && w30.n > 0 ? accuracy7d - accuracy30d : 0,
      avgLatencyMs: w7.msN > 0 ? w7.msSum / w7.msN : 0,
      skipRate,
    };

    if (w7.n < 3) continue; // not enough this-week data to judge
    if (accuracy7d < 0.6 || skipRate > 0.5) struggling.push(skill);
    else if (accuracy7d >= 0.85 && skipRate <= 0.1) cruising.push(skill);
  }

  // ---- vocab specifics ----
  const deckIds = new Set(input.vocabDeck.map((v) => v.id));
  let seen = 0, matured = 0;
  for (const [id, card] of Object.entries(input.cardStore)) {
    if (!deckIds.has(id)) continue;
    seen++;
    if (card.state === 2 && card.stability >= MATURE_STABILITY_DAYS) matured++;
  }
  const reviewCount7d = events7.filter((e) => e.type === "review" && e.data.skill === "vocab").length;
  const againCount7d = events7.filter((e) => e.type === "again").length;
  const daysSinceStart = Math.max(1, Math.ceil((now - new Date(input.profile.createdAt).getTime()) / DAY));

  const vocab = {
    seen,
    matured,
    againRate7d: reviewCount7d > 0 ? againCount7d / reviewCount7d : 0,
    newPerDayEffective: seen / daysSinceStart,
  };

  const confusions = computeConfusions(input.events);

  // ---- ready for level up? ----
  const currentLevelIdx = levelIndex(input.profile.level);
  const currentLevelVocab = input.vocabDeck.filter((v) => levelIndex(v.level) === currentLevelIdx);
  const currentLevelSeen = currentLevelVocab.filter((v) => input.cardStore[v.id]).length;
  const currentLevelSeenRate = currentLevelVocab.length > 0 ? currentLevelSeen / currentLevelVocab.length : 0;

  const readyForLevelUp =
    currentLevelSeenRate >= 0.8 && vocab.againRate7d < 0.25 && perSkill.listening.accuracy7d >= 0.85;

  // ---- overloaded? plan completed on <40% of the days actually active ----
  const activeDays = days7.filter((d) => Object.values(input.skillCountsByDay[d] ?? {}).some((n) => n > 0));
  const completedDays = activeDays.filter((d) => {
    const counts = input.skillCountsByDay[d] ?? {};
    return input.plan.every((step) => (counts[step.skill] ?? 0) >= step.target);
  });
  const overloaded = activeDays.length > 0 && completedDays.length / activeDays.length < 0.4;

  return { perSkill, vocab, confusions, struggling, cruising, readyForLevelUp, overloaded };
}

/** Reads live localStorage + profile and assembles LearnerModelInput. Not
 *  pure — this is the boundary between the app and buildLearnerModel(). */
export function getLearnerModel(profile: Profile): LearnerModel {
  const plan = generatePlan(profile);
  const vocabDeck = getVocabDeck(profile.level);
  return buildLearnerModel({
    profile,
    rollups: getRollups(),
    events: getEvents(),
    cardStore: getCardStore("de"),
    skillCountsByDay: load("activity:skills", {}),
    plan,
    vocabDeck,
  });
}
