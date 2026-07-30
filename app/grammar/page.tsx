"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import topicsData from "@/data/de/grammar-topics.json";
import { normalize } from "@/lib/speech";
import { load, save, recordActivity } from "@/lib/storage";
import { logEvent } from "@/lib/telemetry";
import { sortByLevel } from "@/lib/content";
import { loadProfile } from "@/lib/profile";
import type { Level } from "@/lib/profile";
import { buildTileOptions } from "@/lib/grammarTiles";
import { praise, encourage } from "@/components/Opa";
import Say from "@/components/Say";
import NextStepBanner from "@/components/NextStepBanner";

interface Exercise { q: string; a: string; hint: string; }
interface Topic { id: string; level: string; title: string; explanation: string; exercises: Exercise[]; }

const topics = topicsData as Topic[];
const ICONS: Record<string, string> = {
  "g-articles": "🏷️", "g-verb2": "🔀", "g-akkusativ": "🎯",
  "g-dativ": "🎁", "g-perfekt": "⏪", "g-nebensatz": "🪢",
};

type DoneMap = Record<string, boolean>; // "topicId:i" -> true

/** Input scaffolding scales with the LEARNER's own level (not the topic's):
 *  beginners tap tiles, intermediates get a hint button, advanced learners
 *  free-type with the hint only offered after a miss. */
type InputMode = "tiles" | "text-hint" | "text-nohint";

function inputModeFor(level: Level): InputMode {
  if (level === "A0" || level === "A1" || level === "A2") return "tiles";
  if (level === "B1" || level === "B2") return "text-hint";
  return "text-nohint"; // C1
}

function ExerciseBlock({ ex, exId, isDone, onDone, mode, allAnswers }: {
  ex: Exercise; exId: string; isDone: boolean; onDone: (id: string) => void;
  mode: InputMode; allAnswers: string[];
}) {
  const [val, setVal] = useState("");
  const [result, setResult] = useState<"" | "correct" | "wrong">("");
  const [line, setLine] = useState<[string, string]>(["", ""]);
  const [showHint, setShowHint] = useState(false);
  const shownAtRef = useRef(Date.now());
  const tiles = useMemo(
    () => (mode === "tiles" ? buildTileOptions(ex.a, allAnswers) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ex.a]
  );

  function check(answer: string) {
    const ok = normalize(answer) === normalize(ex.a);
    setResult(ok ? "correct" : "wrong");
    setLine(ok ? praise() : encourage());
    logEvent("review", { skill: "grammar", itemId: exId, ok, ms: Date.now() - shownAtRef.current });
    if (!ok && mode === "text-nohint") setShowHint(true); // C1/C2: hint only after a miss
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

      {mode === "tiles" ? (
        <div className="row left">
          {tiles.map((t) => (
            <button key={t} className="ghost" disabled={result === "correct"} onClick={() => check(t)}>
              {t}
            </button>
          ))}
        </div>
      ) : (
        <div className="row left">
          <input
            type="text"
            style={{ maxWidth: 300 }}
            value={val}
            placeholder="Your answer…"
            onChange={(e) => { setVal(e.target.value); setResult(""); }}
            onKeyDown={(e) => e.key === "Enter" && check(val)}
          />
          <button className="blue" onClick={() => check(val)}>Check</button>
          {mode === "text-hint" && (
            <button className="ghost" onClick={() => setShowHint(!showHint)}>💡 Hinweis</button>
          )}
        </div>
      )}
      {showHint && <p className="muted small" style={{ margin: "6px 0" }}>💡 {ex.hint}</p>}
      {result === "correct" && <div className="feedback-banner ok">👴 „{line[0]}“ ✓</div>}
      {result === "wrong" && <div className="feedback-banner no">👴 „{line[0]}“ — answer: <Say text={ex.a}><strong>{ex.a}</strong></Say></div>}
    </div>
  );
}

export default function GrammarPage() {
  const [open, setOpen] = useState<string | null>(null);
  const [doneMap, setDoneMap] = useState<DoneMap>({});
  const [topicList, setTopicList] = useState<Topic[]>(topics);
  const [mode, setMode] = useState<InputMode>("text-hint");

  useEffect(() => {
    setDoneMap(load<DoneMap>("grammar:done", {}));
    const level = loadProfile()?.level ?? "A0";
    setTopicList(sortByLevel(topics, level));
    setMode(inputModeFor(level));
  }, []);

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
      <NextStepBanner skill="grammar" />
      <div className="progressbar gold"><div style={{ width: `${(totalDone / totalEx) * 100}%` }} /></div>
      <p className="muted small">{totalDone}/{totalEx} exercises mastered · one topic per day is plenty</p>

      {topicList.map((t, i) => {
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
                    mode={mode}
                    allAnswers={t.exercises.map((e) => e.a)}
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
