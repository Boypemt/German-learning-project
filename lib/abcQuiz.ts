// Pure quiz-question building for /abc's mini-quiz — split out of the page
// component so its correctness (exactly one right answer per question,
// decoys distinct from it) can be unit-tested without rendering anything.

export interface QuizDecoy {
  text: string;
  /** True if this decoy happens to be a real German word — only then is it
   *  safe to let the learner tap it after answering (see app/abc/page.tsx):
   *  speaking a made-up non-word would teach a wrong pronunciation. */
  realWord?: boolean;
}

export interface QuizItem {
  id: string;
  correct: string;
  correctEn: string;
  decoys: [QuizDecoy, QuizDecoy];
}

export interface QuizOption {
  text: string;
  realWord: boolean;
}

export interface QuizQuestion {
  /** The source QuizItem's id — used as the telemetry itemId when this
   *  question is mixed into /listening (see lib/adapt.ts's isAbcTurn). */
  id: string;
  correct: string;
  correctEn: string;
  options: QuizOption[];
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function buildQuizQuestion(item: QuizItem): QuizQuestion {
  const options: QuizOption[] = shuffle([
    { text: item.correct, realWord: true },
    ...item.decoys.map((d) => ({ text: d.text, realWord: !!d.realWord })),
  ]);
  return { id: item.id, correct: item.correct, correctEn: item.correctEn, options };
}

export function buildQuizQuestions(pool: QuizItem[]): QuizQuestion[] {
  return shuffle(pool).map(buildQuizQuestion);
}
