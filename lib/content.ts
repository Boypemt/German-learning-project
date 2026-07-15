// Level-aware content loading. All decks combined here; pages ask for
// content relative to the learner's profile level.

import type { VocabItem } from "./srs";
import type { Level } from "./profile";
import vocabA1 from "@/data/de/vocab-a1.json";
import vocabA2 from "@/data/de/vocab-a2.json";
import vocabB1 from "@/data/de/vocab-b1.json";
import vocabB2 from "@/data/de/vocab-b2.json";
import vocabC1 from "@/data/de/vocab-c1.json";
import vocabC2 from "@/data/de/vocab-c2.json";
import sentA1 from "@/data/de/sentences-a1.json";
import sentA2 from "@/data/de/sentences-a2.json";
import sentB1 from "@/data/de/sentences-b1.json";
import sentB2 from "@/data/de/sentences-b2.json";
import sentC1 from "@/data/de/sentences-c1.json";
import sentC2 from "@/data/de/sentences-c2.json";
import sentImported from "@/data/de/sentences-imported.json";

export interface Sentence {
  id: string;
  de: string;
  en: string;
  level: string;
}

export const CEFR = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

/** A0 counts as A1 (index 0). */
export function levelIndex(level: Level | string): number {
  const i = CEFR.indexOf(level as (typeof CEFR)[number]);
  return i === -1 ? 0 : i;
}

const ALL_VOCAB: VocabItem[] = [
  ...(vocabA1 as VocabItem[]),
  ...(vocabA2 as VocabItem[]),
  ...(vocabB1 as VocabItem[]),
  ...(vocabB2 as VocabItem[]),
  ...(vocabC1 as VocabItem[]),
  ...(vocabC2 as VocabItem[]),
];

const ALL_SENTENCES: Sentence[] = [
  ...(sentA1 as Sentence[]),
  ...(sentA2 as Sentence[]),
  ...(sentB1 as Sentence[]),
  ...(sentB2 as Sentence[]),
  ...(sentC1 as Sentence[]),
  ...(sentC2 as Sentence[]),
  ...(sentImported as Sentence[]),
];

/**
 * Vocab deck: starts at the learner's level and includes everything above,
 * in level order. (Lower levels are assumed known; FSRS keeps what you
 * actually review.)
 */
export function getVocabDeck(level: Level = "A0" as Level): VocabItem[] {
  const from = levelIndex(level);
  return ALL_VOCAB.filter((v) => levelIndex(v.level) >= from).sort(
    (a, b) => levelIndex(a.level) - levelIndex(b.level)
  );
}

/**
 * Sentences for listening/speaking: your level + one above —
 * comprehensible input (i+1).
 */
export function getSentences(level: Level = "A0" as Level): Sentence[] {
  const i = levelIndex(level);
  const picked = ALL_SENTENCES.filter((s) => {
    const si = levelIndex(s.level);
    return si === i || si === i + 1;
  });
  return picked.length > 0 ? picked : ALL_SENTENCES;
}

/** Grammar topics sorted: your level first, then above, then below. */
export function sortByLevel<T extends { level: string }>(items: T[], level: Level = "A0" as Level): T[] {
  const i = levelIndex(level);
  return [...items].sort((a, b) => {
    const da = levelIndex(a.level) - i;
    const db = levelIndex(b.level) - i;
    const ra = da < 0 ? 1000 - da : da; // below your level goes last
    const rb = db < 0 ? 1000 - db : db;
    return ra - rb;
  });
}
