"use client";

import { useMemo, useRef, useState } from "react";
import sentencesData from "@/data/de/sentences-a1.json";
import Umlauts from "@/components/Umlauts";
import { speak, normalize, similarity } from "@/lib/speech";
import { recordActivity } from "@/lib/storage";
import { praise, encourage } from "@/components/Opa";

interface Sentence { id: string; de: string; en: string; level: string; }
const sentences = sentencesData as Sentence[];

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

function WordDiff({ target, attempt }: { target: string; attempt: string }) {
  const attemptSet = new Set(normalize(attempt).split(" "));
  return (
    <p style={{ fontSize: 19, lineHeight: 1.9, margin: "10px 0" }}>
      {target.split(" ").map((w, i) => {
        const hit = attemptSet.has(normalize(w));
        return (
          <span key={i} className={"diff-word " + (hit ? "hit" : "miss")} title="🔊 anhören" onClick={() => speak(w)}>
            {w}
          </span>
        );
      })}
    </p>
  );
}

export default function ListeningPage() {
  const order = useMemo(() => shuffle(sentences), []);
  const [idx, setIdx] = useState(0);
  const [val, setVal] = useState("");
  const [checked, setChecked] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [line, setLine] = useState<[string, string]>(["", ""]);
  const inRef = useRef<HTMLInputElement>(null);

  const s = order[idx % order.length];
  const sim = checked ? similarity(s.de, val) : 0;

  function check() {
    if (!val.trim()) return;
    const ok = similarity(s.de, val) >= 0.8;
    setChecked(true);
    setAttempts((a) => a + 1);
    setLine(ok ? praise() : encourage());
    if (ok) {
      setCorrect((c) => c + 1);
      recordActivity("listening");
    }
  }

  function next() {
    setIdx((i) => i + 1);
    setVal("");
    setChecked(false);
    setTimeout(() => speak(order[(idx + 1) % order.length].de), 250);
  }

  return (
    <>
      <h1>Listening</h1>
      <div className="progressbar"><div style={{ width: `${((idx % order.length) / order.length) * 100}%` }} /></div>
      <p className="muted small">
        Sentence {(idx % order.length) + 1}/{order.length} · <span className="badge">{s.level}</span>
        {attempts > 0 && <> · <span className="correct">{correct}</span>/{attempts} correct</>}
      </p>

      <div className="card">
        <div className="row" style={{ marginTop: 0 }}>
          <button className="blue" onClick={() => speak(s.de, "de-DE", 0.95)}>🔊 Play</button>
          <button onClick={() => speak(s.de, "de-DE", 0.65)}>🐢 Slow</button>
        </div>
        <input
          ref={inRef}
          type="text"
          placeholder="Type the German you hear… (ae/oe/ue/ss also count)"
          value={val}
          autoFocus
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (checked ? next() : check())}
        />
        <Umlauts targetRef={inRef} value={val} onChange={setVal} />
        <div className="row">
          {!checked
            ? <button className="primary big" onClick={check}>Check</button>
            : <button className="good big" onClick={next}>Next →</button>}
        </div>

        {checked && (
          <div className="center">
            <div className={"feedback-banner " + (sim >= 0.8 ? "ok" : "no")}>
              👴 „{line[0]}“ {sim >= 0.999 ? "🎯" : sim >= 0.8 ? "— check the red words" : "— compare below, then replay it"}
            </div>
            <WordDiff target={s.de} attempt={val} />
            <p className="muted small">{s.en}</p>
          </div>
        )}
      </div>

      <p className="muted small center">
        <kbd>Enter</kbd> check / next · After drills, get real input:{" "}
        <a href="https://learngerman.dw.com/en/nicos-weg/c-36519789" target="_blank" style={{ textDecoration: "underline" }}>Nicos Weg</a> ·{" "}
        <a href="https://www.youtube.com/@EasyGerman" target="_blank" style={{ textDecoration: "underline" }}>Easy German</a>
      </p>
    </>
  );
}
