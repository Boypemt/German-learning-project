"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getVocabDeck } from "@/lib/content";
import { loadProfile } from "@/lib/profile";
import { getLearnerModel } from "@/lib/model";
import { newCardsPerSession } from "@/lib/adapt";
import { buildQueue, review, Rating, type VocabItem } from "@/lib/srs";
import { recordActivity } from "@/lib/storage";
import { speak, getRecognition, normalize } from "@/lib/speech";
import { logEvent } from "@/lib/telemetry";
import {
  getPersonalTip, setPersonalTip, getRecallPromptEnabled, setRecallPromptEnabled, checkRecall,
} from "@/lib/tips";
import { XP_PER_REVIEW } from "@/lib/gamify";
import { COINS_PER_REVIEW } from "@/lib/garden";
import { Opa, praise, encourage } from "@/components/Opa";
import NextStepBanner from "@/components/NextStepBanner";
import type { Grade } from "ts-fsrs";

const CONFETTI = ["🎉", "⭐", "✨", "🎊", "💛"];

// German nouns are stored with their article ("die Zeit") — strip it before
// checking what the learner said, since saying the bare word is fine too.
function stripArticle(de: string): string {
  return de.replace(/^(der|die|das)\s+/i, "");
}

export default function VocabPage() {
  const [queue, setQueue] = useState<VocabItem[]>([]);
  const [sessionSize, setSessionSize] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(0);
  const [again, setAgain] = useState(0);
  const [ready, setReady] = useState(false);
  const [hasRecognition, setHasRecognition] = useState(false);
  const [sayResult, setSayResult] = useState<"idle" | "listening" | "hit" | "miss">("idle");
  const [sayLine, setSayLine] = useState<[string, string]>(["", ""]);
  const [newCardTarget, setNewCardTarget] = useState(10);
  const [recallEnabled, setRecallEnabled] = useState(true);
  const [recallInput, setRecallInput] = useState("");
  const [recallResult, setRecallResult] = useState<"idle" | "correct" | "wrong">("idle");
  const [personalNote, setPersonalNote] = useState("");

  useEffect(() => setRecallEnabled(getRecallPromptEnabled()), []);

  const loadSession = useCallback(() => {
    const profile = loadProfile();
    const deck = getVocabDeck(profile?.level ?? "A0");
    const n = profile ? newCardsPerSession(getLearnerModel(profile).vocab.againRate7d) : 10;
    setNewCardTarget(n);
    const { due, fresh } = buildQueue("de", deck, n);
    const q = [...due, ...fresh];
    setQueue(q);
    setSessionSize(q.length);
    setDone(0);
    setAgain(0);
    setRevealed(false);
    setReady(true);
  }, []);

  useEffect(() => { loadSession(); }, [loadSession]);
  useEffect(() => setHasRecognition(!!getRecognition()), []);

  const item = queue[0];
  const shownAtRef = useRef(Date.now());

  const grade = useCallback((g: Grade) => {
    const it = queue[0];
    if (!it) return;
    review("de", it.id, g);
    recordActivity("vocab");
    const ok = g !== Rating.Again;
    logEvent("review", { skill: "vocab", itemId: it.id, ok, ms: Date.now() - shownAtRef.current });
    if (!ok) logEvent("again", { itemId: it.id });
    setDone((d) => d + 1);
    if (g === Rating.Again) setAgain((a) => a + 1);
    setRevealed(false);
    setQueue((q) => {
      const rest = q.slice(1);
      return g === Rating.Again ? [...rest, it] : rest;
    });
  }, [queue]);

  // keyboard shortcuts: space/enter = flip, 1-4 = grade
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
    setSayResult("idle");
    setRecallInput("");
    setRecallResult("idle");
    setPersonalNote(item ? getPersonalTip(item.id) : "");
    shownAtRef.current = Date.now();
  }, [item]);

  // Optional recall check: shows ✓/✗ and reveals — never auto-grades,
  // the learner still picks Again/Hard/Good/Easy themselves.
  function checkRecallGuess() {
    if (!item) return;
    const ok = checkRecall(recallInput, item.en);
    setRecallResult(ok ? "correct" : "wrong");
    setRevealed(true);
  }

  function skipRecall() {
    setRecallEnabled(false);
    setRecallPromptEnabled(false);
    setRevealed(true);
  }

  function updateNote(text: string) {
    setPersonalNote(text);
    if (item) setPersonalTip(item.id, text);
  }

  // Optional practice: doesn't affect grading or activity counts.
  function sayIt() {
    if (!item) return;
    const rec = getRecognition("de-DE");
    if (!rec) return;
    setSayResult("listening");
    rec.onresult = (e) => {
      const heard = e.results[0][0].transcript;
      const hit = normalize(heard).includes(normalize(stripArticle(item.de)));
      setSayLine(hit ? praise() : encourage());
      setSayResult(hit ? "hit" : "miss");
      logEvent("sayit", { ok: hit });
    };
    rec.onerror = () => setSayResult("idle");
    rec.onend = () => setSayResult((r) => (r === "listening" ? "idle" : r));
    rec.start();
  }

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
        <NextStepBanner skill="vocab" />
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
            <button className="primary" onClick={loadSession}>Learn {newCardTarget} more words</button>
          </div>
        </div>
      </>
    );
  }

  const pct = sessionSize > 0 ? Math.round((done / (done + queue.length)) * 100) : 0;

  return (
    <>
      <h1>Vocab</h1>
      <NextStepBanner skill="vocab" />
      <div className="progressbar"><div style={{ width: `${pct}%` }} /></div>
      <p className="muted small">{queue.length} left · {done} done · say it out loud before flipping</p>
      {newCardTarget !== 10 && (
        <p className="muted small">
          {newCardTarget < 10
            ? `🎯 ${newCardTarget} new words today — steadying the pace after a few too many "Again"s.`
            : `🚀 ${newCardTarget} new words today — you're cruising, so I added more.`}
        </p>
      )}

      <div className="flip-scene">
        <div className={"flip-inner" + (revealed ? " flipped" : "")}>
          <div className="flip-face">
            <span className="badge">{item.level}</span>
            {item.img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.img} alt="" style={{ width: 150, height: 110, objectFit: "cover", borderRadius: 14, border: "2px solid var(--border)" }} />
            ) : (
              item.emoji && <div style={{ fontSize: 54, lineHeight: 1 }}>{item.emoji}</div>
            )}
            <div className="word say" title="🔊 anhören" onClick={() => speak(item.de)}>{item.de}</div>
            <button className="ghost" onClick={() => speak(item.de)}>🔊 Hear it again</button>
            {!revealed && recallEnabled && (
              <div style={{ width: "100%", marginTop: 10 }}>
                <input
                  type="text"
                  placeholder="What does this word mean?"
                  value={recallInput}
                  onChange={(e) => setRecallInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && checkRecallGuess()}
                  style={{ fontSize: 15 }}
                />
                <div className="row" style={{ marginTop: 8 }}>
                  <button className="primary" onClick={checkRecallGuess}>Check & reveal</button>
                  <button className="ghost" onClick={skipRecall}>Just show me</button>
                </div>
              </div>
            )}
          </div>
          <div className="flip-face back" style={{ overflowY: "auto" }}>
            {recallResult !== "idle" && (
              <p className={(recallResult === "correct" ? "correct" : "wrong") + " small"} style={{ marginTop: 0 }}>
                {recallResult === "correct" ? "✓ Your guess was right!" : "✗ Not quite what you guessed."}
              </p>
            )}
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
            {hasRecognition && (
              <>
                <button className="blue" onClick={sayIt} disabled={sayResult === "listening"}>
                  {sayResult === "listening" ? "🎙️ Listening…" : "🎙️ Sag es!"}
                </button>
                {sayResult === "hit" && <p className="correct small">👴 „{sayLine[0]}“ ✓</p>}
                {sayResult === "miss" && <p className="wrong small">👴 „{sayLine[0]}“ — tap 🔊 and try again</p>}
              </>
            )}
            <div style={{ width: "100%", marginTop: 8 }}>
              <label className="muted small" style={{ display: "block", marginBottom: 4 }}>📝 Your note (optional)</label>
              <input
                type="text"
                placeholder="Write your own memory trick…"
                value={personalNote}
                onChange={(e) => updateNote(e.target.value)}
                style={{ fontSize: 14 }}
              />
            </div>
            {item.tip && (
              <p className="muted small" style={{ margin: "8px 0 0" }}>💡 Eselsbrücke: {item.tip}</p>
            )}
          </div>
        </div>
      </div>

      {!revealed ? (
        recallEnabled ? null : (
          <button className="primary big" onClick={() => setRevealed(true)}>
            Show answer
          </button>
        )
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
