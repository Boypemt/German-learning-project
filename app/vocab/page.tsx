"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getVocabDeck } from "@/lib/content";
import { loadProfile } from "@/lib/profile";
import { buildQueue, review, Rating, type VocabItem } from "@/lib/srs";
import { recordActivity } from "@/lib/storage";
import { speak } from "@/lib/speech";
import { XP_PER_REVIEW } from "@/lib/gamify";
import { COINS_PER_REVIEW } from "@/lib/garden";
import { Opa, praise } from "@/components/Opa";
import type { Grade } from "ts-fsrs";

const CONFETTI = ["🎉", "⭐", "✨", "🎊", "💛"];

export default function VocabPage() {
  const [queue, setQueue] = useState<VocabItem[]>([]);
  const [sessionSize, setSessionSize] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(0);
  const [again, setAgain] = useState(0);
  const [ready, setReady] = useState(false);

  const loadSession = useCallback(() => {
    const deck = getVocabDeck(loadProfile()?.level ?? "A0");
    const { due, fresh } = buildQueue("de", deck, 10);
    const q = [...due, ...fresh];
    setQueue(q);
    setSessionSize(q.length);
    setDone(0);
    setAgain(0);
    setRevealed(false);
    setReady(true);
  }, []);

  useEffect(() => { loadSession(); }, [loadSession]);

  const item = queue[0];

  const grade = useCallback((g: Grade) => {
    const it = queue[0];
    if (!it) return;
    review("de", it.id, g);
    recordActivity("vocab");
    setDone((d) => d + 1);
    if (g === Rating.Again) setAgain((a) => a + 1);
    setRevealed(false);
    setQueue((q) => {
      const rest = q.slice(1);
      return g === Rating.Again ? [...rest, it] : rest;
    });
  }, [queue]);

  // keyboard shortcuts: space = reveal/listen, 1-4 = grade
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!item) return;
      if (e.code === "Space" || e.key === "Enter") {
        e.preventDefault();
        if (!revealed) setRevealed(true);
        return;
      }
      if (revealed) {
        if (e.key === "1") grade(Rating.Again);
        if (e.key === "2") grade(Rating.Hard);
        if (e.key === "3") grade(Rating.Good);
        if (e.key === "4") grade(Rating.Easy);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item, revealed, grade]);

  // auto-pronounce each new word
  useEffect(() => {
    if (item) speak(item.de);
  }, [item]);

  const confetti = useMemo(
    () => Array.from({ length: 14 }, (_, i) => ({
      left: `${(i * 7 + 3) % 100}%`,
      delay: `${(i % 5) * 0.12}s`,
      char: CONFETTI[i % CONFETTI.length],
    })),
    []
  );

  if (!ready) return <p className="muted">Loading…</p>;

  if (!item) {
    const [pDe, pEn] = praise();
    return (
      <>
        <h1>Vocab</h1>
        <div className="card center confetti-box">
          {done > 0 && confetti.map((c, i) => (
            <span key={i} className="confetti" style={{ left: c.left, animationDelay: c.delay }}>{c.char}</span>
          ))}
          <div style={{ display: "flex", justifyContent: "center", margin: "6px 0" }}>
            <Opa size={110} mood={done > 0 ? "cheer" : "sleep"} />
          </div>
          {done > 0 ? (
            <>
              <h2 style={{ margin: "0 0 4px" }}>{pDe}</h2>
              <p className="muted small" style={{ marginTop: 0 }}>{pEn}</p>
              <p style={{ fontSize: 18, margin: "0 0 2px" }}>
                <span className="correct">+{done * XP_PER_REVIEW} XP</span> · <span style={{ color: "#9c6f00", fontWeight: 700 }}>+{done * COINS_PER_REVIEW} 🪙</span> · {done} reviews
              </p>
              <p className="muted small">
                {again === 0 ? "Flawless — every card graded first try." : `${again} card${again > 1 ? "s" : ""} needed a retry — they'll come back sooner.`}
              </p>
            </>
          ) : (
            <p className="muted">„Nichts fällig, mein Kind. Geh an die frische Luft!“ <span className="small">(Nothing due — get some fresh air!)</span></p>
          )}
          <div className="row">
            <button className="primary" onClick={loadSession}>Learn 10 more words</button>
          </div>
        </div>
      </>
    );
  }

  const pct = sessionSize > 0 ? Math.round((done / (done + queue.length)) * 100) : 0;

  return (
    <>
      <h1>Vocab</h1>
      <div className="progressbar"><div style={{ width: `${pct}%` }} /></div>
      <p className="muted small">{queue.length} left · {done} done · say it out loud before flipping</p>

      <div className="flip-scene">
        <div className={"flip-inner" + (revealed ? " flipped" : "")}>
          <div className="flip-face">
            <span className="badge">{item.level}</span>
            <div className="word say" title="🔊 anhören" onClick={() => speak(item.de)}>{item.de}</div>
            <button className="ghost" onClick={() => speak(item.de)}>🔊 Hear it again</button>
          </div>
          <div className="flip-face back">
            <div className="word-sub">{item.en}</div>
            {item.example && (
              <p className="example">
                <span className="say" title="🔊 anhören" onClick={() => speak(item.example!)}>„{item.example}“</span><br />
                <span className="small">{item.exampleEn}</span>
              </p>
            )}
            {item.example && (
              <button className="ghost" onClick={() => speak(item.example!)}>🔊 Example</button>
            )}
          </div>
        </div>
      </div>

      {!revealed ? (
        <button className="primary big" onClick={() => setRevealed(true)}>
          Show answer
        </button>
      ) : (
        <div className="row">
          <button className="bad" onClick={() => grade(Rating.Again)}>Again</button>
          <button onClick={() => grade(Rating.Hard)}>Hard</button>
          <button className="good" onClick={() => grade(Rating.Good)}>Good</button>
          <button className="blue" onClick={() => grade(Rating.Easy)}>Easy</button>
        </div>
      )}

      <p className="muted small center" style={{ marginTop: 14 }}>
        <kbd>Space</kbd> flip · <kbd>1</kbd>–<kbd>4</kbd> grade
      </p>
    </>
  );
}
