import { describe, it, expect } from "vitest";
import { parseExampleForm, findBoldTarget } from "../lib/exampleForm";

describe("parseExampleForm", () => {
  it("splits word and gloss", () => {
    expect(parseExampleForm("bin (ich-form of sein)")).toEqual({ word: "bin", gloss: "ich-form of sein" });
  });

  it("keeps an em dash inside the gloss", () => {
    expect(parseExampleForm("rufe (ich-form of anrufen — 'an' moves to the end)")).toEqual({
      word: "rufe",
      gloss: "ich-form of anrufen — 'an' moves to the end",
    });
  });

  it("returns null for malformed input (no parentheses)", () => {
    expect(parseExampleForm("bin ich-form of sein")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(parseExampleForm("")).toBeNull();
  });
});

describe("findBoldTarget", () => {
  it("bolds the exampleForm word when present", () => {
    const r = findBoldTarget("Ich bin müde.", "bin (ich-form of sein)", "sein");
    expect(r).toEqual({ before: "Ich ", match: "bin", after: " müde." });
  });

  it("falls back to the headword (article stripped) when exampleForm is absent", () => {
    const r = findBoldTarget("Die Zeit vergeht schnell.", undefined, "die Zeit");
    expect(r).toEqual({ before: "Die ", match: "Zeit", after: " vergeht schnell." });
  });

  it("matches case-insensitively", () => {
    const r = findBoldTarget("Kannst du mir helfen?", "Kannst (du-form of können)", "können");
    expect(r).toEqual({ before: "", match: "Kannst", after: " du mir helfen?" });
  });

  it("matches words containing umlauts and ß correctly (Unicode word boundary)", () => {
    const r = findBoldTarget("Das Auto ist groß.", "groß (no change)", "groß");
    expect(r).toEqual({ before: "Das Auto ist ", match: "groß", after: "." });
  });

  it("does not match a substring inside a longer word", () => {
    // "an" should not match inside "Banane" — Unicode-aware boundaries required.
    const r = findBoldTarget("Ich esse eine Banane.", "an (no change)", "an");
    expect(r.match).toBeNull();
  });

  it("returns match: null when the word cannot be found in the example", () => {
    const r = findBoldTarget("Das Wetter ist schön.", "gibt (es-form of geben)", "geben");
    expect(r).toEqual({ before: "Das Wetter ist schön.", match: null, after: "" });
  });

  it("handles trailing punctuation directly after the match", () => {
    const r = findBoldTarget("Wir kaufen Brot, Milch und Käse.", "kaufen (wir-form of kaufen — no change)", "kaufen");
    expect(r).toEqual({ before: "Wir ", match: "kaufen", after: " Brot, Milch und Käse." });
  });
});
