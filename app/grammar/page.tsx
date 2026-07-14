"use client";

import { useState } from "react";
import topicsData from "@/data/de/grammar-topics.json";
import { normalize } from "@/lib/speech";
import { recordActivity } from "@/lib/storage";

interface Exercise { q: string; a: string; hint: string; }
interface Topic { id: string; level: string; title: string; explanation: string; exercises: Exercise[]; }

const topics = topicsData as Topic[];

function ExerciseBlock({ ex }: { ex: Exercise }) {
  const [val, setVal] = useState("");
  const [result, setResult] = useState<"" | "correct" | "wrong">("");
  const [showHint, setShowHint] = useState(false);

  function check() {
    const ok = normalize(val) === normalize(ex.a);
    setResult(ok ? "correct" : "wrong");
    if (ok) recordActivity();
  }

  return (
    <div style={{ margin: "14px 0" }}>
      <p style={{ margin: "4px 0" }}>{ex.q}</p>
      <div className="row left">
        <input
          type="text"
          style={{ maxWidth: 320 }}
          value={val}
          onChange={(e) => { setVal(e.target.value); setResult(""); }}
          onKeyDown={(e) => e.key === "Enter" && check()}
        />
        <button onClick={check}>Check</button>
        <button className="ghost" onClick={() => setShowHint(true)}>Hint</button>
      </div>
      {showHint && <p className="muted small">💡 {ex.hint}</p>}
      {result === "correct" && <p className="correct">✓ Richtig!</p>}
      {result === "wrong" && <p className="wrong">✗ Answer: {ex.a}</p>}
    </div>
  );
}

export default function GrammarPage() {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <>
      <h1>Grammar</h1>
      <p className="muted small">One topic per day is plenty. Grammar supports input — it doesn&apos;t replace it.</p>
      {topics.map((t) => (
        <div className="card" key={t.id}>
          <div
            style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
            onClick={() => setOpen(open === t.id ? null : t.id)}
          >
            <strong>{t.title}</strong>
            <span className="badge">{t.level}</span>
          </div>
          {open === t.id && (
            <>
              <p>{t.explanation}</p>
              <h2 style={{ marginTop: 12 }}>Exercises</h2>
              {t.exercises.map((ex, i) => <ExerciseBlock ex={ex} key={i} />)}
            </>
          )}
        </div>
      ))}
    </>
  );
}
