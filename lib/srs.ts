// FSRS scheduling via ts-fsrs + localStorage persistence.
// One FSRS card per vocab item; deck content stays in /data.

import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  type Card,
  type Grade,
} from "ts-fsrs";
import { load, save } from "./storage";

export { Rating };

const f = fsrs(generatorParameters({ enable_fuzz: true }));

export interface VocabItem {
  id: string;
  de: string; // German (with article for nouns, e.g. "die Zeit")
  en: string;
  example?: string;
  exampleEn?: string;
  emoji?: string; // picture hint for concrete words (mostly A1/A2)
  img?: string; // photo path (merged from data/de/images.json manifest)
  tip?: string; // optional memory aid ("Eselsbrücke") — mnemonic/cognate/word-building hint
  level: string; // CEFR
}

type CardStore = Record<string, Card>; // itemId -> FSRS card (serialized dates as strings)

function loadStore(lang: string): CardStore {
  const raw = load<CardStore>(`cards:${lang}`, {});
  // revive dates
  for (const id of Object.keys(raw)) {
    const c = raw[id] as unknown as Record<string, unknown>;
    c.due = new Date(c.due as string);
    if (c.last_review) c.last_review = new Date(c.last_review as string);
  }
  return raw;
}

function saveStore(lang: string, store: CardStore): void {
  save(`cards:${lang}`, store);
}

/** Raw FSRS card store — the learner model reads state/stability off this
 *  to judge which vocab is seen vs. matured. */
export function getCardStore(lang = "de"): CardStore {
  return loadStore(lang);
}

export interface QueueResult<T> {
  due: T[]; // learned cards due for review
  fresh: T[]; // never-seen items
}

/** Generic over any deck of {id}-bearing items — vocab, abc letters, etc. —
 *  as long as they're scheduled under their own `lang` (FSRS store key), so
 *  different decks' due dates never mix. */
export function buildQueue<T extends { id: string }>(
  lang: string,
  deck: T[],
  newPerSession = 10
): QueueResult<T> {
  const store = loadStore(lang);
  const now = new Date();
  const due = deck.filter((it) => store[it.id] && store[it.id].due <= now);
  const fresh = deck.filter((it) => !store[it.id]).slice(0, newPerSession);
  return { due, fresh };
}

export function review(lang: string, itemId: string, grade: Grade): Date {
  const store = loadStore(lang);
  const card = store[itemId] ?? createEmptyCard(new Date());
  const result = f.repeat(card, new Date())[grade];
  store[itemId] = result.card;
  saveStore(lang, store);
  return result.card.due;
}

export function stats<T extends { id: string }>(lang: string, deck: T[]) {
  const store = loadStore(lang);
  const now = new Date();
  const seen = deck.filter((it) => store[it.id]);
  return {
    total: deck.length,
    seen: seen.length,
    dueNow: seen.filter((it) => store[it.id].due <= now).length,
  };
}
