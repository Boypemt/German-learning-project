"use client";

// Das ABC — lesson zero. German is phonetic: learn the letters, the special
// characters, and a handful of spelling->sound rules, and you can read (and
// write) almost any word you'll ever meet.

import { useEffect, useState } from "react";
import alphabetData from "@/data/de/alphabet.json";
import quizData from "@/data/de/abc-quiz.json";
import { buildQuizQuestions, type QuizItem, type QuizQuestion } from "@/lib/abcQuiz";
import { speak, speakSeq } from "@/lib/speech";
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

const entries = alphabetData as AlphabetEntry[];
const quizPool = quizData as QuizItem[];
const alphabetEntries = entries.filter((e) => e.type === "letter" || e.type === "special");
const comboEntries = entries.filter((e) => e.type === "combo");

function AbcCard({ entry }: { entry: AlphabetEntry }) {
  function tap() {
    speakSeq([entry.symbol.length <= 2 ? entry.symbol : entry.name, ...entry.examples.map((ex) => ex.de)]);
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

  // Speak the target word whenever a (new) question becomes the current
  // one — covers both "quiz just started" and "moved to next question" in
  // one place, so neither call site can forget it.
  useEffect(() => {
    if (q) speak(q.correct);
  }, [q]);

  // Auto-play the correct answer once, right alongside the feedback —
  // regardless of whether the learner got it right or wrong.
  useEffect(() => {
    if (selected && q) speak(q.correct);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  function startQuiz() {
    setQuestions(buildQuizQuestions(quizPool));
    setQIdx(0);
    setScore(0);
    setSelected(null);
    setStarted(true);
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
    setQIdx((i) => i + 1);
    setSelected(null);
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
            <button onClick={() => speak(q.correct, "de-DE", 0.65)}>🐢 Langsam</button>
          </div>
          <div className="row" style={{ flexDirection: "column", alignItems: "stretch" }}>
            {q.options.map((opt) => {
              const isCorrect = opt.text === q.correct;
              const cls = !selected ? "ghost" : isCorrect ? "good" : opt.text === selected ? "bad" : "ghost";
              // Before answering: tapping always selects. After answering: only
              // real-word options (the correct one, always; a decoy only if
              // data/de/abc-quiz.json marks it realWord) are tappable-to-hear —
              // speaking a made-up non-word would teach a wrong pronunciation.
              const tappableToHear = !!selected && opt.realWord;
              return (
                <button
                  key={opt.text}
                  className={cls + " big"}
                  disabled={!!selected && !opt.realWord}
                  onClick={() => (selected ? tappableToHear && speak(opt.text) : selectOption(opt.text))}
                  title={tappableToHear ? "🔊 anhören" : undefined}
                >
                  {opt.text}
                </button>
              );
            })}
          </div>
          {selected && (
            <>
              <p className="muted small center" style={{ margin: "6px 0 0" }}>
                Tippe die richtige Antwort an, um sie noch einmal zu hören.
              </p>
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
