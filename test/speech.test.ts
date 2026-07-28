import { describe, it, expect } from "vitest";
import { normalize, similarity } from "../lib/speech";

describe("normalize", () => {
  it("lowercases", () => {
    expect(normalize("HALLO Welt")).toBe("hallo welt");
  });

  it("maps umlauts to their digraphs", () => {
    expect(normalize("schön")).toBe("schoen");
    expect(normalize("Mädchen")).toBe("maedchen");
    expect(normalize("müde")).toBe("muede");
  });

  it("maps ß to ss", () => {
    expect(normalize("groß")).toBe("gross");
    expect(normalize("Straße")).toBe("strasse");
  });

  it("strips punctuation and German quote marks", () => {
    expect(normalize("Hallo, Welt!")).toBe("hallo welt");
    expect(normalize("„Guten Tag“")).toBe("guten tag");
    expect(normalize("Wie geht's?")).toBe("wie gehts");
    expect(normalize("(Test)")).toBe("test");
  });

  it("collapses whitespace and trims", () => {
    expect(normalize("  viel   Platz  ")).toBe("viel platz");
  });

  it("lets a typed digraph match the umlaut spelling", () => {
    expect(normalize("schoen")).toBe(normalize("schön"));
    expect(normalize("Strasse")).toBe(normalize("Straße"));
  });
});

describe("similarity", () => {
  it("is 1 when every target word is present", () => {
    expect(similarity("Ich habe Zeit", "Ich habe Zeit")).toBe(1);
  });

  it("still matches when extra words are said", () => {
    expect(similarity("Ich habe Zeit", "Ja, ich habe heute Zeit")).toBe(1);
  });

  it("is a fraction when only some words are present", () => {
    // "ich" hits, "habe" and "zeit" miss -> 1/3
    expect(similarity("Ich habe Zeit", "Ich bin da")).toBeCloseTo(1 / 3);
  });

  it("is 0 when nothing matches", () => {
    expect(similarity("Ich habe Zeit", "Komplett anders")).toBe(0);
  });

  it("is case- and umlaut-insensitive", () => {
    expect(similarity("Ich bin müde", "ICH BIN MUEDE")).toBe(1);
  });
});
