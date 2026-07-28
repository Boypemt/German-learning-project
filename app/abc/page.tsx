"use client";

// Das ABC — lesson zero. German is phonetic: learn the letters, the special
// characters, and a handful of spelling->sound rules, and you can read (and
// write) almost any word you'll ever meet.

import { useEffect, useState } from "react";
import alphabetData from "@/data/de/alphabet.json";
import quizData from "@/data/de/abc-quiz.json";
import { speak } from "@/lib/speech";
import { load, save, recordActivity } from "@/lib/storage";
import { OpaSays, praise, encourage } from "@/components/Opa";
import NextStepBanner from "@/components/NextStepBanner";

interface AlphabetEntry {
  id: string;
  type: "letter" | "special" | "combo";
  symbol: string;
  name: string;
  sound: string;
  soundEn: string;
  examples: { de: string; en: string }[];
}
interface QuizItem { id: string; correct: string; correctEn: string; decoys: [string, string]; }
interface QuizQuestion { correct: string; correctEn: string; options: string[]; }

const entries = alphabetData as AlphabetEntry[];
const quizPool = quizData as QuizItem[];
const alphabetEntries = entries.filter((e) => e.type === "letter" || e.type === "special");
const comboEntries = entries.filter((e) => e.type === "combo");

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildQuestions(): QuizQuestion[] {
  return shuffle(quizPool).map((item) => ({
    correct: item.correct,
    correctEn: item.correctEn,
    options: shuffle([item.correct, ...item.decoys]),
  }));
}

function AbcCard({ entry }: { entry: AlphabetEntry }) {
  function tap() {
    speak(entry.symbol.length <= 2 ? entry.symbol : entry.name);
    entry.examples.forEach((ex, i) => {
      setTimeout(() => speak(ex.de), 900 * (i + 1));
    });
  }

  return (
    <div className="shop-item tap" onClick={tap} title="🔊 anhören">
      <div className="s-emoji" style={{ fontSize: 24, fontWeight: 800 }}>{entry.symbol}</div>
      <div className="s-name">{entry.name}</div>
      <div className="s-en muted small">{entry.soundEn}</div>
    </div>
  );
}

export default function AbcPage() {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [started, setStarted] = useState(false);
  const [qIdx, setQIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [line, setLine] = useState<[string, string]>(["", ""]);

  useEffect(() => setDone(load("abc:done", false)), []);

  const q = started ? questions[qIdx] : null;

  function startQuiz() {
    const qs = buildQuestions();
    setQuestions(qs);
    setQIdx(0);
    setScore(0);
    setSelected(null);
    setStarted(true);
    setTimeout(() => speak(qs[0].correct), 300);
  }

  function selectOption(opt: string) {
    if (selected || !q) return;
    setSelected(opt);
    const correct = opt === q.correct;
    setLine(correct ? praise() : encourage());
    if (correct) {
      setScore((s) => s + 1);
      recordActivity("abc");
    }
  }

  function nextQuestion() {
    if (!q) return;
    if (qIdx + 1 >= questions.length) {
      setStarted(false);
      setDone(true);
      save("abc:done", true);
      if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("sl:coins"));
      return;
    }
    const next = qIdx + 1;
    setQIdx(next);
    setSelected(null);
    setTimeout(() => speak(questions[next].correct), 300);
  }

  return (
    <>
      <h1>Das ABC</h1>
      <NextStepBanner skill="abc" />
      <OpaSays
        de="Deutsch ist eine phonetische Sprache — lern diese Regeln einmal, und du kannst jedes Wort lesen und schreiben."
        en="German is phonetic — learn these rules once and you can read and write any word."
        size={84}
      />

      <h2>Das Alphabet</h2>
      <p className="muted small">Tipp auf einen Buchstaben: Opa spricht ihn und zwei Beispielwörter.</p>
      <div className="shop-grid">
        {alphabetEntries.map((e) => <AbcCard key={e.id} entry={e} />)}
      </div>

      <h2>Lesenregeln</h2>
      <p className="muted small">Buchstabenkombinationen mit festen Ausspracheregeln.</p>
      <div className="shop-grid">
        {comboEntries.map((e) => <AbcCard key={e.id} entry={e} />)}
      </div>

      <h2>🔤 Mini-Quiz</h2>
      {!started && !q && (
        <div className="card center">
          {questions.length > 0 && (
            <p className="correct" style={{ marginTop: 0 }}>Letztes Ergebnis: {score}/{questions.length} richtig! ✓</p>
          )}
          {done && questions.length === 0 && (
            <p className="correct" style={{ marginTop: 0 }}>✓ Schon einmal geschafft — spiel gern nochmal!</p>
          )}
          <p className="muted small">Opa liest ein Wort vor — wähl die richtige Schreibweise. 10 Fragen.</p>
          <button className="good big" style={{ maxWidth: 320 }} onClick={startQuiz}>
            🎧 Quiz starten
          </button>
        </div>
      )}

      {started && q && (
        <div className="card">
          <div className="progressbar"><div style={{ width: `${(qIdx / questions.length) * 100}%` }} /></div>
          <p className="muted small">Frage {qIdx + 1}/{questions.length}</p>
          <div className="row">
            <button className="blue" onClick={() => speak(q.correct)}>🔊 Nochmal hören</button>
          </div>
          <div className="row" style={{ flexDirection: "column", alignItems: "stretch" }}>
            {q.options.map((opt) => {
              const isCorrect = opt === q.correct;
              const cls = !selected ? "ghost" : isCorrect ? "good" : opt === selected ? "bad" : "ghost";
              return (
                <button key={opt} className={cls + " big"} disabled={!!selected} onClick={() => selectOption(opt)}>
                  {opt}
                </button>
              );
            })}
          </div>
          {selected && (
            <>
              <div className={"feedback-banner " + (selected === q.correct ? "ok" : "no")}>
                👴 „{line[0]}“ {selected === q.correct ? "✓" : `— richtig: „${q.correct}“ (${q.correctEn})`}
              </div>
              <div className="row">
                <button className="primary" onClick={nextQuestion}>
                  {qIdx + 1 < questions.length ? "Weiter →" : "Fertig"}
                </button>
              </div>
            </>
          )}
        </div>
      )}

    </>
  );
}
