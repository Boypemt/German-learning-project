"use client";

import { useEffect, useState } from "react";
import vocabData from "@/data/de/vocab-a1.json";
import { buildQueue, review, Rating, type VocabItem } from "@/lib/srs";
import { recordActivity } from "@/lib/storage";
import { speak } from "@/lib/speech";
import type { Grade } from "ts-fsrs";

const deck = vocabData as VocabItem[];

export default function VocabPage() {
  const [queue, setQueue] = useState<VocabItem[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const { due, fresh } = buildQueue("de", deck, 10);
    setQueue([...due, ...fresh]);
    setReady(true);
  }, []);

  const item = queue[0];

  function grade(g: Grade) {
    if (!item) return;
    review("de", item.id, g);
    recordActivity();
    setDone((d) => d + 1);
    setRevealed(false);
    setQueue((q) => {
      const rest = q.slice(1);
      // "Again" → retry at the end of this session
      return g === Rating.Again ? [...rest, item] : rest;
    });
  }

  if (!ready) return <p className="muted">Loading…</p>;

  if (!item) {
    return (
      <>
        <h1>Vocab</h1>
        <div className="card" style={{ textAlign: "center" }}>
          <p className="correct">Session complete — {done} reviews. 🎉</p>
          <p className="muted">Come back when more cards are due, or reload for more new words.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <h1>Vocab</h1>
      <p className="muted small">{queue.length} in queue · {done} done · Tip: say the word out loud before revealing.</p>
      <div className="card">
        <div className="word">{item.de}</div>
        <div className="row">
          <button className="ghost" onClick={() => speak(item.de)}>🔊 Listen</button>
          {item.example && revealed && (
            <button className="ghost" onClick={() => speak(item.example!)}>🔊 Example</button>
          )}
        </div>

        {!revealed ? (
          <div className="row">
            <button className="primary" onClick={() => setRevealed(true)}>Show answer</button>
          </div>
        ) : (
          <>
            <div style={{ textAlign: "center", fontSize: 20 }}>{item.en}</div>
            {item.example && (
              <p className="example">{item.example}<br /><span className="small">{item.exampleEn}</span></p>
            )}
            <div className="row">
              <button onClick={() => grade(Rating.Again)} style={{ borderColor: "var(--red)" }}>Again</button>
              <button onClick={() => grade(Rating.Hard)}>Hard</button>
              <button onClick={() => grade(Rating.Good)} style={{ borderColor: "var(--green)" }}>Good</button>
              <button onClick={() => grade(Rating.Easy)}>Easy</button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
