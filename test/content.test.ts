import { describe, it, expect } from "vitest";
import { CEFR, levelIndex, getVocabDeck, getSentences, sortByLevel } from "../lib/content";

describe("levelIndex", () => {
  it("indexes the six CEFR levels in order", () => {
    CEFR.forEach((lvl, i) => expect(levelIndex(lvl)).toBe(i));
  });

  it("treats A0 (and any unknown level) as A1's index 0", () => {
    expect(levelIndex("A0")).toBe(0);
    expect(levelIndex("nonsense")).toBe(0);
  });
});

describe("getVocabDeck — level filtering", () => {
  it("includes only items at or above the requested level", () => {
    const deck = getVocabDeck("B1");
    const from = levelIndex("B1");
    expect(deck.length).toBeGreaterThan(0);
    for (const item of deck) expect(levelIndex(item.level)).toBeGreaterThanOrEqual(from);
  });

  it("excludes lower levels entirely", () => {
    const deck = getVocabDeck("B1");
    expect(deck.some((v) => v.level === "A1" || v.level === "A2")).toBe(false);
  });

  it("returns items sorted in ascending level order", () => {
    const deck = getVocabDeck("A1");
    const indices = deck.map((v) => levelIndex(v.level));
    for (let i = 1; i < indices.length; i++) expect(indices[i]).toBeGreaterThanOrEqual(indices[i - 1]);
  });

  it("A0 behaves like A1 — the full deck", () => {
    expect(getVocabDeck("A0").length).toBe(getVocabDeck("A1").length);
  });
});

describe("getSentences — comprehensible input (i+1)", () => {
  it("only returns sentences at the learner's level or one above", () => {
    const i = levelIndex("A1");
    const sentences = getSentences("A1");
    expect(sentences.length).toBeGreaterThan(0);
    for (const s of sentences) {
      const si = levelIndex(s.level);
      expect(si === i || si === i + 1).toBe(true);
    }
  });

  it("shifts the window up for a higher level", () => {
    const i = levelIndex("B1");
    const sentences = getSentences("B1");
    expect(sentences.length).toBeGreaterThan(0);
    for (const s of sentences) {
      const si = levelIndex(s.level);
      expect(si === i || si === i + 1).toBe(true);
    }
  });
});

describe("sortByLevel", () => {
  it("orders same-level first, then above ascending, then below last", () => {
    const items = [{ level: "C1" }, { level: "A1" }, { level: "B1" }, { level: "A2" }];
    const sorted = sortByLevel(items, "A2");
    expect(sorted.map((i) => i.level)).toEqual(["A2", "B1", "C1", "A1"]);
  });

  it("is a no-op ordering when already sorted for the given level", () => {
    const items = [{ level: "A1" }, { level: "A2" }, { level: "B1" }];
    const sorted = sortByLevel(items, "A1");
    expect(sorted.map((i) => i.level)).toEqual(["A1", "A2", "B1"]);
  });
});
