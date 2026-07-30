// Vocab card extras: the learner's own per-word notes, and the pure
// recall-check used by the optional "what does this mean?" prompt.

import { load, save } from "./storage";
import { normalize } from "./speech";

type TipMap = Record<string, string>;

/** The learner's own note for a card — self-generated mnemonics stick
 *  better than given ones, so this is shown above the built-in tip. */
export function getPersonalTip(itemId: string): string {
  return load<TipMap>("tips", {})[itemId] ?? "";
}

export function setPersonalTip(itemId: string, text: string): void {
  const tips = load<TipMap>("tips", {});
  const trimmed = text.trim();
  if (trimmed) tips[itemId] = trimmed;
  else delete tips[itemId]; // clearing the note removes the entry entirely
  save("tips", tips);
}

/** Whether to ask "what does this word mean?" before revealing a card.
 *  Defaults to on; "Just show me" turns it off and it's remembered. */
export function getRecallPromptEnabled(): boolean {
  return load<boolean>("vocab:recall", true);
}

export function setRecallPromptEnabled(enabled: boolean): void {
  save("vocab:recall", enabled);
}

/** Accept if the guess and the real answer contain/equal each other —
 *  lenient on purpose (this never blocks or auto-grades, just shows ✓/✗). */
export function checkRecall(typed: string, answer: string): boolean {
  const t = normalize(typed);
  const a = normalize(answer);
  if (!t || !a) return false;
  return t === a || a.includes(t) || t.includes(a);
}
