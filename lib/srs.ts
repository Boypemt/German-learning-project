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

export interface QueueResult {
  due: VocabItem[]; // learned cards due for review
  fresh: VocabItem[]; // never-seen items
}

export function buildQueue(
  lang: string,
  deck: VocabItem[],
  newPerSession = 10
): QueueResult {
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

export function stats(lang: string, deck: VocabItem[]) {
  const store = loadStore(lang);
  const now = new Date();
  const seen = deck.filter((it) => store[it.id]);
  return {
    total: deck.length,
    seen: seen.length,
    dueNow: seen.filter((it) => store[it.id].due <= now).length,
  };
}
