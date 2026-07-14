"use client";

import { useMemo, useState } from "react";
import sentencesData from "@/data/de/sentences-a1.json";
import { speak, normalize, similarity } from "@/lib/speech";
import { recordActivity } from "@/lib/storage";

interface Sentence { id: string; de: string; en: string; level: string; }
const sentences = sentencesData as Sentence[];

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

export default function ListeningPage() {
  const order = useMemo(() => shuffle(sentences), []);
  const [idx, setIdx] = useState(0);
  const [val, setVal] = useState("");
  const [checked, setChecked] = useState(false);
  const [score, setScore] = useState(0);

  const s = order[idx % order.length];
  const sim = checked ? similarity(s.de, val) : 0;

  function check() {
    setChecked(true);
    if (similarity(s.de, val) >= 0.8) recordActivity();
  }

  function next() {
    setIdx((i) => i + 1);
    setVal("");
    setChecked(false);
  }

  return (
    <>
      <h1>Listening — dictation</h1>
      <p className="muted small">
        Play the sentence (slow if needed), type what you hear, then check.
        Sentence {(idx % order.length) + 1}/{order.length} · <span className="badge">{s.level}</span>
      </p>

      <div className="card">
        <div className="row">
          <button className="primary" onClick={() => speak(s.de, "de-DE", 0.95)}>🔊 Play</button>
          <button onClick={() => speak(s.de, "de-DE", 0.65)}>🐢 Slow</button>
        </div>
        <input
          type="text"
          placeholder="Type the German sentence you hear…"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (checked ? next() : check())}
        />
        <div className="row">
          {!checked
            ? <button className="primary" onClick={check}>Check</button>
            : <button className="primary" onClick={next}>Next →</button>}
        </div>

        {checked && (
          <div style={{ textAlign: "center" }}>
            <p className={sim >= 0.8 ? "correct" : "wrong"}>
              {sim >= 0.999 ? "Perfect! ✓" : sim >= 0.8 ? "Almost — compare below" : "Keep practicing — compare below"}
            </p>
            <p><strong>{s.de}</strong></p>
            <p className="muted small">{s.en}</p>
            {normalize(val) !== normalize(s.de) && val && (
              <p className="muted small">You wrote: {val}</p>
            )}
          </div>
        )}
      </div>

      <p className="muted small">
        After drills, get real input: {" "}
        <a href="https://learngerman.dw.com/en/nicos-weg/c-36519789" target="_blank" style={{ textDecoration: "underline" }}>Nicos Weg (DW, free)</a>{" · "}
        <a href="https://www.youtube.com/@EasyGerman" target="_blank" style={{ textDecoration: "underline" }}>Easy German</a>
      </p>
    </>
  );
}
