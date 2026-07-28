// The adaptation rule engine — turns a LearnerModel into concrete, visible
// changes to the plan and to exercise difficulty. Every rule here is plain
// deterministic arithmetic over the model (no randomness in the DECISIONS —
// only distractor/option ORDER is shuffled for display). Every adaptation
// that changes what the learner sees must come with a human-readable note
// so Opa can announce it (see CLAUDE.md: "adaptations must be announced").

import { load, save, dateKey } from "./storage";
import type { Profile, CoreSkillId } from "./profile";
import { SKILL_LABELS } from "./profile";
import type { LearnerModel } from "./model";
import { CORE_SKILLS } from "./model";
import type { VocabItem } from "./srs";

const DAY = 86400000;
const OVERLOAD_WINDOW_DAYS = 7;
const LEVEL_SNOOZE_DAYS = 14;
const STRUGGLE_BOOST = 1.25;
const CRUISE_CUT = 0.75;
const OVERLOAD_CUT = 0.7;
export const MIN_TARGET = 2;

function addDays(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------------------------------------------------------------------
// 1. Adaptive plan — struggling/cruising/overloaded target adjustments
// ---------------------------------------------------------------------

export type SkillReason = "struggling" | "cruising" | "overloaded" | null;

export interface SkillAdaptation {
  targetMultiplier: number;
  reason: SkillReason;
  moveEarlier: boolean;
}

export interface ConfusionDrillPair {
  itemId: string;
  pickedId: string;
  count: number;
}

export interface Adaptation {
  date: string; // the day this snapshot was computed for
  perSkill: Partial<Record<CoreSkillId, SkillAdaptation>>;
  overloaded: boolean;
  overloadedUntil: string; // date key; overloaded relief stays active while today < this
  confusionDrillPairs: ConfusionDrillPair[];
  notes: string[];
  readyForLevelUp: boolean;
  levelDownSuggested: boolean;
}

/**
 * Pure core: given profile + model + "today" + yesterday's stored
 * adaptation (or null), decide today's adaptation. The overloaded relief
 * window is the only thing that needs `previous` — once triggered it holds
 * for a week even if the model stops reporting overloaded=true tomorrow,
 * which is what makes it "stable day-to-day" rather than flapping.
 */
export function computeAdaptation(
  profile: Profile,
  model: LearnerModel,
  today: string,
  previous: Adaptation | null
): Adaptation {
  const overloadedWindowActive = !!previous && previous.overloadedUntil > today;
  const overloaded = overloadedWindowActive || model.overloaded;
  const overloadedUntil = overloadedWindowActive
    ? previous!.overloadedUntil
    : model.overloaded
    ? addDays(today, OVERLOAD_WINDOW_DAYS)
    : today;

  const perSkill: Partial<Record<CoreSkillId, SkillAdaptation>> = {};
  const notes: string[] = [];

  if (overloaded) {
    for (const skill of CORE_SKILLS) {
      perSkill[skill] = { targetMultiplier: OVERLOAD_CUT, reason: "overloaded", moveEarlier: false };
    }
    notes.push(
      "Der Plan war zu voll — ich habe alle Ziele diese Woche um 30% gekürzt. Konstanz schlägt Menge. " +
        "(Your plan looked like too much — I've cut every target 30% for a week. Consistency beats volume.)"
    );
  } else {
    for (const skill of CORE_SKILLS) {
      if (model.struggling.includes(skill)) {
        perSkill[skill] = { targetMultiplier: STRUGGLE_BOOST, reason: "struggling", moveEarlier: true };
        notes.push(
          `${SKILL_LABELS[skill]} lief diese Woche nicht so gut — ich hab's nach vorne geholt und das Ziel um 25% erhöht. ` +
            `(${SKILL_LABELS[skill]} has been tough this week — I moved it earlier and raised the target 25%.)`
        );
      } else if (model.cruising.includes(skill)) {
        perSkill[skill] = { targetMultiplier: CRUISE_CUT, reason: "cruising", moveEarlier: false };
        notes.push(
          `${SKILL_LABELS[skill]} läuft super — ich hab das Ziel um 25% gesenkt, damit Zeit für anderes bleibt. ` +
            `(${SKILL_LABELS[skill]} is going great — I lowered its target 25% to make room for other things.)`
        );
      }
    }
  }

  // Repeat offenders (confused more than once) feed the "Opas Extrarunde"
  // drill — cycle through them to always produce exactly 5 questions.
  const repeatOffenders = model.confusions.filter((c) => c.count >= 2);
  const confusionDrillPairs =
    repeatOffenders.length > 0 ? Array.from({ length: 5 }, (_, i) => repeatOffenders[i % repeatOffenders.length]) : [];

  return {
    date: today,
    perSkill,
    overloaded,
    overloadedUntil,
    confusionDrillPairs,
    notes,
    readyForLevelUp: model.readyForLevelUp,
    levelDownSuggested: model.vocab.againRate7d > 0.5,
  };
}

/** Impure wrapper: recomputes once per calendar day and caches to sl:adapt
 *  so the plan doesn't reshuffle target numbers on every reload. */
export function getAdaptation(profile: Profile, model: LearnerModel): Adaptation {
  const today = dateKey();
  const stored = load<Adaptation | null>("adapt", null);
  if (stored && stored.date === today) return stored;
  const next = computeAdaptation(profile, model, today, stored);
  save("adapt", next);
  return next;
}

// ---------------------------------------------------------------------
// 2. Level-up / level-down suggestions — snoozable, one-tap
// ---------------------------------------------------------------------

export function isLevelUpSnoozed(now = Date.now()): boolean {
  const until = load<string | null>("level:snooze:up", null);
  return !!until && until > dateKey(new Date(now));
}

export function snoozeLevelUp(now = Date.now()): void {
  save("level:snooze:up", addDays(dateKey(new Date(now)), LEVEL_SNOOZE_DAYS));
}

export function isLevelDownSnoozed(now = Date.now()): boolean {
  const until = load<string | null>("level:snooze:down", null);
  return !!until && until > dateKey(new Date(now));
}

export function snoozeLevelDown(now = Date.now()): void {
  save("level:snooze:down", addDays(dateKey(new Date(now)), LEVEL_SNOOZE_DAYS));
}

// ---------------------------------------------------------------------
// 3a. Listening — adaptive distractor difficulty
// ---------------------------------------------------------------------

export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/**
 * Builds the shuffled option list for one listening MC question.
 * - accuracy7d < 0.6  -> 3 total choices (easier)
 * - accuracy7d >= 0.85 -> distractors picked by spelling similarity (harder)
 * - otherwise         -> 4 choices, random distractors (unchanged default)
 * `mustInclude` forces specific distractors in — used for the confusion
 * drill, where we deliberately re-offer the exact word that fooled you.
 */
export function chooseListeningOptions(
  target: VocabItem,
  pool: VocabItem[],
  accuracy7d: number,
  mustInclude: VocabItem[] = []
): VocabItem[] {
  const choiceCount = accuracy7d < 0.6 ? 3 : 4;
  const forced = mustInclude.filter((v) => v.id !== target.id).slice(0, choiceCount - 1);
  const forcedIds = new Set(forced.map((v) => v.id));
  const candidates = pool.filter((v) => v.id !== target.id && !forcedIds.has(v.id));
  const remaining = choiceCount - 1 - forced.length;

  const filler =
    remaining <= 0
      ? []
      : accuracy7d >= 0.85
      ? [...candidates].sort((a, b) => levenshtein(a.de, target.de) - levenshtein(b.de, target.de)).slice(0, remaining)
      : shuffle(candidates).slice(0, remaining);

  return shuffle([target, ...forced, ...filler]);
}

// ---------------------------------------------------------------------
// 3b. Vocab — new-cards-per-session scales with again-rate
// ---------------------------------------------------------------------

export function newCardsPerSession(againRate7d: number): number {
  if (againRate7d > 0.3) return 5;
  if (againRate7d < 0.1) return 15;
  return 10;
}

// ---------------------------------------------------------------------
// 3c. Speaking — offer to skip after repeated fails, requeue tomorrow
// ---------------------------------------------------------------------

export const SPEAKING_SKIP_AFTER_FAILS = 3;

type SnoozeMap = Record<string, string>; // itemId -> dateKey until which it's hidden

export function isItemSnoozed(itemId: string, now = Date.now()): boolean {
  const until = load<SnoozeMap>("speaking:snoozed", {})[itemId];
  return !!until && until > dateKey(new Date(now));
}

/** No penalty — just moves the item out of today's rotation. */
export function snoozeSpeakingItem(itemId: string, now = Date.now()): void {
  const today = dateKey(new Date(now));
  const map = load<SnoozeMap>("speaking:snoozed", {});
  map[itemId] = addDays(today, 1);
  for (const id of Object.keys(map)) if (map[id] <= today) delete map[id]; // opportunistic cleanup
  save("speaking:snoozed", map);
}
