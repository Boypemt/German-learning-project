import { describe, it, expect } from "vitest";
import { buildQuizQuestion, buildQuizQuestions, type QuizItem } from "../lib/abcQuiz";
import quizData from "../data/de/abc-quiz.json";

const pool = quizData as QuizItem[];

describe("buildQuizQuestion", () => {
  it("produces exactly one option matching the correct answer", () => {
    for (const item of pool) {
      const q = buildQuizQuestion(item);
      const matches = q.options.filter((o) => o.text === item.correct);
      expect(matches.length, `exactly one correct option for ${item.id}`).toBe(1);
    }
  });

  it("always includes the correct answer among the options", () => {
    for (const item of pool) {
      const q = buildQuizQuestion(item);
      expect(q.options.some((o) => o.text === item.correct), `${item.id} missing its own answer`).toBe(true);
    }
  });

  it("has exactly 3 options (correct + 2 decoys) per question", () => {
    for (const item of pool) {
      expect(buildQuizQuestion(item).options.length).toBe(3);
    }
  });

  it("has no duplicate option texts", () => {
    for (const item of pool) {
      const texts = buildQuizQuestion(item).options.map((o) => o.text);
      expect(new Set(texts).size, `duplicate option in ${item.id}`).toBe(texts.length);
    }
  });

  it("marks the correct option as a real word — always safe to speak", () => {
    for (const item of pool) {
      const q = buildQuizQuestion(item);
      const correctOpt = q.options.find((o) => o.text === item.correct)!;
      expect(correctOpt.realWord).toBe(true);
    }
  });

  it("carries each decoy's realWord flag through unchanged", () => {
    for (const item of pool) {
      const q = buildQuizQuestion(item);
      for (const decoy of item.decoys) {
        const opt = q.options.find((o) => o.text === decoy.text)!;
        expect(opt.realWord).toBe(!!decoy.realWord);
      }
    }
  });
});

describe("buildQuizQuestions", () => {
  it("builds exactly one question per pool item", () => {
    expect(buildQuizQuestions(pool).length).toBe(pool.length);
  });

  it("every built question is still well-formed", () => {
    for (const q of buildQuizQuestions(pool)) {
      expect(q.options.filter((o) => o.text === q.correct).length).toBe(1);
      expect(q.options.length).toBe(3);
    }
  });
});
