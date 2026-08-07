import { describe, it, expect } from "vitest";
import { CEFR } from "../lib/content";
import { parseExampleForm, findBoldTarget } from "../lib/exampleForm";

import alphabet from "../data/de/alphabet.json";
import abcQuiz from "../data/de/abc-quiz.json";
import vocabA1 from "../data/de/vocab-a1.json";
import vocabA2 from "../data/de/vocab-a2.json";
import vocabB1 from "../data/de/vocab-b1.json";
import vocabB2 from "../data/de/vocab-b2.json";
import vocabC1 from "../data/de/vocab-c1.json";
import vocabC2 from "../data/de/vocab-c2.json";
import sentA1 from "../data/de/sentences-a1.json";
import sentA2 from "../data/de/sentences-a2.json";
import sentB1 from "../data/de/sentences-b1.json";
import sentB2 from "../data/de/sentences-b2.json";
import sentC1 from "../data/de/sentences-c1.json";
import sentC2 from "../data/de/sentences-c2.json";
import sentImported from "../data/de/sentences-imported.json";
import grammarTopics from "../data/de/grammar-topics.json";
import writingPrompts from "../data/de/writing-prompts.json";
import culture from "../data/de/culture.json";
import images from "../data/de/images.json";

const CEFR_SET = new Set<string>(CEFR);

function expectUniqueIds(items: { id: string }[], label: string) {
  const ids = items.map((i) => i.id);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  expect(dupes, `duplicate ids in ${label}: ${dupes.join(", ")}`).toEqual([]);
}

describe("data/de/alphabet.json", () => {
  const entries = alphabet as Array<{
    id: string; type: string; symbol: string; name: string; sound: string; soundEn: string;
    examples: { de: string; en: string }[];
  }>;

  it("has required fields on every entry", () => {
    for (const e of entries) {
      expect(e.id, "id").toBeTruthy();
      expect(["letter", "special", "combo"]).toContain(e.type);
      expect(e.symbol, `symbol on ${e.id}`).toBeTruthy();
      expect(e.name, `name on ${e.id}`).toBeTruthy();
      expect(e.sound, `sound on ${e.id}`).toBeTruthy();
      expect(e.soundEn, `soundEn on ${e.id}`).toBeTruthy();
    }
  });

  it("has exactly 2 examples per entry, each with de+en", () => {
    for (const e of entries) {
      expect(e.examples.length, `examples on ${e.id}`).toBe(2);
      for (const ex of e.examples) {
        expect(ex.de, `example.de on ${e.id}`).toBeTruthy();
        expect(ex.en, `example.en on ${e.id}`).toBeTruthy();
      }
    }
  });

  it("has unique ids", () => expectUniqueIds(entries, "alphabet.json"));

  it("covers all 26 letters plus ä ö ü ß", () => {
    const letters = entries.filter((e) => e.type === "letter");
    const specials = entries.filter((e) => e.type === "special");
    expect(letters.length).toBe(26);
    expect(specials.map((s) => s.symbol).sort()).toEqual(["ä", "ö", "ß", "ü"].sort());
  });
});

describe("data/de/abc-quiz.json", () => {
  type Decoy = { text: string; realWord?: boolean };
  const items = abcQuiz as Array<{ id: string; correct: string; correctEn: string; decoys: [Decoy, Decoy] }>;

  it("has required fields on every item", () => {
    for (const q of items) {
      expect(q.id, "id").toBeTruthy();
      expect(q.correct, `correct on ${q.id}`).toBeTruthy();
      expect(q.correctEn, `correctEn on ${q.id}`).toBeTruthy();
      expect(q.decoys.length, `decoys on ${q.id}`).toBe(2);
      for (const d of q.decoys) {
        expect(d.text, `decoy text on ${q.id}`).toBeTruthy();
        expect(typeof d.realWord === "boolean" || d.realWord === undefined, `decoy.realWord on ${q.id}`).toBe(true);
      }
    }
  });

  it("has unique ids", () => expectUniqueIds(items, "abc-quiz.json"));

  it("never lists the correct answer as one of its own decoys", () => {
    for (const q of items) {
      const texts = q.decoys.map((d) => d.text);
      expect(texts, `decoys for ${q.id}`).not.toContain(q.correct);
    }
  });

  it("has no duplicate decoys within a question", () => {
    for (const q of items) {
      expect(q.decoys[0].text).not.toBe(q.decoys[1].text);
    }
  });
});

describe("data/de/vocab-*.json", () => {
  const files: Record<string, unknown[]> = {
    "vocab-a1.json": vocabA1,
    "vocab-a2.json": vocabA2,
    "vocab-b1.json": vocabB1,
    "vocab-b2.json": vocabB2,
    "vocab-c1.json": vocabC1,
    "vocab-c2.json": vocabC2,
  };
  type VocabRow = { id: string; de: string; en: string; level: string; example?: string; exampleForm?: string };
  const all = Object.values(files).flat() as VocabRow[];

  it("has required fields and a valid CEFR level on every item", () => {
    for (const [file, items] of Object.entries(files)) {
      for (const v of items as VocabRow[]) {
        expect(v.id, `id in ${file}`).toBeTruthy();
        expect(v.de, `de on ${v.id} in ${file}`).toBeTruthy();
        expect(v.en, `en on ${v.id} in ${file}`).toBeTruthy();
        expect(CEFR_SET.has(v.level), `level "${v.level}" on ${v.id} in ${file}`).toBe(true);
      }
    }
  });

  it("has unique ids across the whole combined deck", () => expectUniqueIds(all, "vocab-*.json combined"));

  it("exampleForm parses and its word occurs in the example", () => {
    for (const [file, items] of Object.entries(files)) {
      for (const v of items as VocabRow[]) {
        if (!v.exampleForm) continue;
        expect(v.example, `example missing on ${v.id} in ${file} but exampleForm is set`).toBeTruthy();
        const parsed = parseExampleForm(v.exampleForm);
        expect(parsed, `exampleForm "${v.exampleForm}" on ${v.id} in ${file} failed to parse`).not.toBeNull();
        const { match } = findBoldTarget(v.example!, v.exampleForm, v.de);
        expect(match, `word "${parsed?.word}" from exampleForm not found in example "${v.example}" on ${v.id} in ${file}`).not.toBeNull();
      }
    }
  });
});

describe("data/de/sentences-*.json", () => {
  const files: Record<string, unknown[]> = {
    "sentences-a1.json": sentA1,
    "sentences-a2.json": sentA2,
    "sentences-b1.json": sentB1,
    "sentences-b2.json": sentB2,
    "sentences-c1.json": sentC1,
    "sentences-c2.json": sentC2,
    "sentences-imported.json": sentImported,
  };
  type SentRow = { id: string; de: string; en: string; level: string };
  const all = Object.values(files).flat() as SentRow[];

  it("has required fields and a valid CEFR level on every item", () => {
    for (const [file, items] of Object.entries(files)) {
      for (const s of items as SentRow[]) {
        expect(s.id, `id in ${file}`).toBeTruthy();
        expect(s.de, `de on ${s.id} in ${file}`).toBeTruthy();
        expect(s.en, `en on ${s.id} in ${file}`).toBeTruthy();
        expect(CEFR_SET.has(s.level), `level "${s.level}" on ${s.id} in ${file}`).toBe(true);
      }
    }
  });

  it("has unique ids across the whole combined set", () => expectUniqueIds(all, "sentences-*.json combined"));
});

describe("data/de/grammar-topics.json", () => {
  type Exercise = { q: string; a: string; hint: string };
  type Topic = { id: string; level: string; title: string; explanation: string; exercises: Exercise[] };
  const topics = grammarTopics as Topic[];

  it("has required fields and a valid CEFR level on every topic", () => {
    for (const t of topics) {
      expect(t.id, "id").toBeTruthy();
      expect(CEFR_SET.has(t.level), `level "${t.level}" on ${t.id}`).toBe(true);
      expect(t.title, `title on ${t.id}`).toBeTruthy();
      expect(t.explanation, `explanation on ${t.id}`).toBeTruthy();
      expect(t.exercises.length, `exercises on ${t.id}`).toBeGreaterThan(0);
    }
  });

  it("has unique topic ids", () => expectUniqueIds(topics, "grammar-topics.json"));

  it("every exercise has a non-empty question and answer", () => {
    for (const t of topics) {
      for (const ex of t.exercises) {
        expect(ex.q.trim().length, `q in ${t.id}`).toBeGreaterThan(0);
        expect(ex.a.trim().length, `a in ${t.id}`).toBeGreaterThan(0);
        expect(ex.hint.trim().length, `hint in ${t.id}`).toBeGreaterThan(0);
      }
    }
  });
});

describe("data/de/writing-prompts.json", () => {
  type Prompt = { id: string; level: string; prompt: string; promptEn: string };
  const prompts = writingPrompts as Prompt[];

  it("has required fields and a valid CEFR level", () => {
    for (const p of prompts) {
      expect(p.id, "id").toBeTruthy();
      expect(CEFR_SET.has(p.level), `level "${p.level}" on ${p.id}`).toBe(true);
      expect(p.prompt, `prompt on ${p.id}`).toBeTruthy();
      expect(p.promptEn, `promptEn on ${p.id}`).toBeTruthy();
    }
  });

  it("has unique ids", () => expectUniqueIds(prompts, "writing-prompts.json"));
});

describe("data/de/culture.json", () => {
  type Note = { id: string; emoji: string; title: string; text: string; phrase: string; phraseEn: string };
  const notes = culture as Note[];

  it("has required fields on every note", () => {
    for (const n of notes) {
      expect(n.id, "id").toBeTruthy();
      expect(n.emoji, `emoji on ${n.id}`).toBeTruthy();
      expect(n.title, `title on ${n.id}`).toBeTruthy();
      expect(n.text, `text on ${n.id}`).toBeTruthy();
      expect(n.phrase, `phrase on ${n.id}`).toBeTruthy();
      expect(n.phraseEn, `phraseEn on ${n.id}`).toBeTruthy();
    }
  });

  it("has unique ids", () => expectUniqueIds(notes, "culture.json"));
});

describe("data/de/images.json", () => {
  it("is a plain object manifest (currently empty — photos reverted to emoji)", () => {
    expect(typeof images).toBe("object");
    expect(Array.isArray(images)).toBe(false);
    expect(Object.keys(images).length).toBe(0);
  });

  it("any future entry would carry a /img/vocab src", () => {
    for (const [id, entry] of Object.entries(images as Record<string, { src: string }>)) {
      expect(entry.src, `src on ${id}`).toMatch(/^\/img\/vocab\//);
    }
  });
});
