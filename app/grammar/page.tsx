"use client";

import { useEffect, useState } from "react";
import topicsData from "@/data/de/grammar-topics.json";
import { normalize } from "@/lib/speech";
import { load, save, recordActivity } from "@/lib/storage";
import { praise, encourage } from "@/components/Opa";
import Say from "@/components/Say";

interface Exercise { q: string; a: string; hint: string; }
interface Topic { id: string; level: string; title: string; explanation: string; exercises: Exercise[]; }

const topics = topicsData as Topic[];
const ICONS: Record<string, string> = {
  "g-articles": "🏷️", "g-verb2": "🔀", "g-akkusativ": "🎯",
  "g-dativ": "🎁", "g-perfekt": "⏪", "g-nebensatz": "🪢",
};

type DoneMap = Record<string, boolean>; // "topicId:i" -> true

function ExerciseBlock({ ex, exId, isDone, onDone }: {
  ex: Exercise; exId: string; isDone: boolean; onDone: (id: string) => void;
}) {
  const [val, setVal] = useState("");
  const [result, setResult] = useState<"" | "correct" | "wrong">("");
  const [line, setLine] = useState<[string, string]>(["", ""]);
  const [showHint, setShowHint] = useState(false);

  function check() {
    const ok = normalize(val) === normalize(ex.a);
    setResult(ok ? "correct" : "wrong");
    setLine(ok ? praise() : encourage());
    if (ok) {
      recordActivity("grammar");
      onDone(exId);
    }
  }

  return (
    <div style={{ margin: "16px 0" }}>
      <p style={{ margin: "4px 0", fontWeight: 600 }}>
        {isDone && <span className="correct">✓ </span>}{ex.q}
      </p>
      <div className="row left">
        <input
          type="text"
          style={{ maxWidth: 300 }}
          value={val}
          placeholder="Your answer…"
          onChange={(e) => { setVal(e.target.value); setResult(""); }}
          onKeyDown={(e) => e.key === "Enter" && check()}
        />
        <button className="blue" onClick={check}>Check</button>
        <button className="ghost" onClick={() => setShowHint(!showHint)}>💡</button>
      </div>
      {showHint && <p className="muted small" style={{ margin: "6px 0" }}>💡 {ex.hint}</p>}
      {result === "correct" && <div className="feedback-banner ok">👴 „{line[0]}“ ✓</div>}
      {result === "wrong" && <div className="feedback-banner no">👴 „{line[0]}“ — answer: <Say text={ex.a}><strong>{ex.a}</strong></Say></div>}
    </div>
  );
}

export default function GrammarPage() {
  const [open, setOpen] = useState<string | null>(null);
  const [doneMap, setDoneMap] = useState<DoneMap>({});

  useEffect(() => { setDoneMap(load<DoneMap>("grammar:done", {})); }, []);

  function markDone(exId: string) {
    setDoneMap((m) => {
      const next = { ...m, [exId]: true };
      save("grammar:done", next);
      return next;
    });
  }

  function topicProgress(t: Topic) {
    const done = t.exercises.filter((_, i) => doneMap[`${t.id}:${i}`]).length;
    return { done, total: t.exercises.length };
  }

  const totalDone = topics.reduce((s, t) => s + topicProgress(t).done, 0);
  const totalEx = topics.reduce((s, t) => s + t.exercises.length, 0);

  return (
    <>
      <h1>Grammar</h1>
      <div className="progressbar gold"><div style={{ width: `${(totalDone / totalEx) * 100}%` }} /></div>
      <p className="muted small">{totalDone}/{totalEx} exercises mastered · one topic per day is plenty</p>

      {topics.map((t, i) => {
        const prog = topicProgress(t);
        const complete = prog.done === prog.total;
        return (
          <div className="card" key={t.id} style={{ animationDelay: `${i * 0.04}s` }}>
            <div className="topic-head" onClick={() => setOpen(open === t.id ? null : t.id)}>
              <span className="t">
                <span style={{ fontSize: 20 }}>{ICONS[t.id] ?? "📘"}</span>
                {t.title}
                {complete && <span className="correct">✓</span>}
              </span>
              <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span className="badge">{t.level}</span>
                <span className="muted small">{prog.done}/{prog.total}</span>
                <span className="muted">{open === t.id ? "▾" : "▸"}</span>
              </span>
            </div>
            {open === t.id && (
              <div className="topic-body">
                <p style={{ marginTop: 0 }}>{t.explanation}</p>
                <hr className="divider" />
                {t.exercises.map((ex, j) => (
                  <ExerciseBlock
                    key={j}
                    ex={ex}
                    exId={`${t.id}:${j}`}
                    isDone={!!doneMap[`${t.id}:${j}`]}
                    onDone={markDone}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
