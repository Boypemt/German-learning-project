// Turns data/de/alphabet.json into an FSRS-schedulable deck for /abc's card
// practice (lib/srs.ts, deck id "de-abc" — kept separate from vocab's "de"
// store so the two never mix due dates).

import alphabetData from "@/data/de/alphabet.json";

export interface AbcCardItem {
  id: string;
  type: "letter" | "special" | "combo";
  symbol: string;
  name: string;
  sound: string;
  soundEn: string;
  examples: { de: string; en: string }[];
  level: string; // nominal — for badge parity with vocab cards, not level-filtered
}

const RAW = alphabetData as Omit<AbcCardItem, "level">[];

export function getAbcDeck(): AbcCardItem[] {
  return RAW.map((e) => ({ ...e, level: "A1" }));
}

/** What to speak() for this entry's front — single letters/short combos
 *  read fine as themselves; longer descriptive names (e.g. "sp- am
 *  Wortanfang") need the name spoken instead of the raw symbol. */
export function frontSpeech(entry: AbcCardItem): string {
  return entry.symbol.length <= 2 ? entry.symbol : entry.name;
}
