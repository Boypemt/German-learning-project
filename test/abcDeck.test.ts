import { describe, it, expect } from "vitest";
import { getAbcDeck, frontSpeech } from "../lib/abcDeck";
import alphabetData from "../data/de/alphabet.json";

describe("getAbcDeck", () => {
  it("returns one card per alphabet.json entry", () => {
    expect(getAbcDeck().length).toBe(alphabetData.length);
  });

  it("gives every card an id and a nominal level (for badge parity with vocab)", () => {
    for (const card of getAbcDeck()) {
      expect(card.id, "id").toBeTruthy();
      expect(card.level).toBe("A1");
    }
  });

  it("has unique ids (FSRS schedules cards by id)", () => {
    const ids = getAbcDeck().map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("preserves the source symbol/name/sound/examples unchanged", () => {
    const deck = getAbcDeck();
    const first = deck[0];
    const source = alphabetData[0] as { symbol: string; name: string };
    expect(first.symbol).toBe(source.symbol);
    expect(first.name).toBe(source.name);
    expect(first.examples.length).toBe(2);
  });
});

describe("frontSpeech", () => {
  it("speaks the symbol itself for short (<=2 char) symbols", () => {
    expect(frontSpeech({ symbol: "A", name: "ah" } as never)).toBe("A");
    expect(frontSpeech({ symbol: "ei", name: "ei" } as never)).toBe("ei");
  });

  it("speaks the descriptive name for longer symbols", () => {
    expect(frontSpeech({ symbol: "sp- am Wortanfang", name: "sp- am Wortanfang" } as never)).toBe("sp- am Wortanfang");
    expect(frontSpeech({ symbol: "eu / äu", name: "eu / äu" } as never)).toBe("eu / äu");
  });
});
