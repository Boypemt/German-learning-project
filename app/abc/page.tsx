"use client";

// Das ABC — lesson zero, now spaced-repetition card practice (like /vocab):
// front = letter/combo symbol, back = its sound explanation + 2 example
// words, with a "Sag es!" recognition check. Below the practice loop, a
// tap-to-hear reference grid stays for quick lookup (e.g. from the
// Speaking page's "Full guide → /abc" link).

import { useCallback, useEffect, useRef, useState } from "react";
import alphabetData from "@/data/de/alphabet.json";
import { getAbcDeck, frontSpeech, type AbcCardItem } from "@/lib/abcDeck";
import { buildQueue, review, Rating } from "@/lib/srs";
import { speak, speakSeq, getRecognition, normalize } from "@/lib/speech";
import { load, save, recordActivity } from "@/lib/storage";
import { logEvent } from "@/lib/telemetry";
import { Opa, OpaSays, praise, encourage } from "@/components/Opa";
import NextStepBanner from "@/components/NextStepBanner";
import { useFlipHeight } from "@/lib/useFlipHeight";
import type { Grade } from "ts-fsrs";

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
const alphabetEntries = entries.filter((e) => e.type === "letter" || e.type === "special");
const comboEntries = entries.filter((e) => e.type === "combo");

function ReferenceCard({ entry }: { entry: AlphabetEntry }) {
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
  const [queue, setQueue] = useState<AbcCardItem[]>([]);
  const [sessionSize, setSessionSize] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(0);
  const [again, setAgain] = useState(0);
  const [ready, setReady] = useState(false);
  const [hasRecognition, setHasRecognition] = useState(false);
  const [sayResult, setSayResult] = useState<"idle" | "listening" | "hit" | "miss">("idle");
  const [sayLine, setSayLine] = useState<[string, string]>(["", ""]);

  const loadSession = useCallback(() => {
    const deck = getAbcDeck();
    const { due, fresh } = buildQueue("de-abc", deck, 10);
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
  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const flipHeight = useFlipHeight(frontRef, backRef, [item?.id]);

  const grade = useCallback((g: Grade) => {
    const it = queue[0];
    if (!it) return;
    review("de-abc", it.id, g);
    recordActivity("abc");
    const ok = g !== Rating.Again;
    logEvent("review", { skill: "abc", itemId: it.id, ok });
    if (!ok) logEvent("again", { itemId: it.id });
    setDone((d) => d + 1);
    if (g === Rating.Again) setAgain((a) => a + 1);
    setRevealed(false);
    setQueue((q) => {
      const rest = q.slice(1);
      return g === Rating.Again ? [...rest, it] : rest;
    });
  }, [queue]);

  // keyboard shortcuts: space/enter = flip, 1-4 = grade (matches /vocab)
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

  // auto-pronounce each new card
  useEffect(() => {
    if (item) speak(frontSpeech(item));
    setSayResult("idle");
  }, [item]);

  // Mark "Das ABC" as finished the first time a full session is cleared,
  // so generatePlan() stops prepending the lesson-zero step forever.
  useEffect(() => {
    if (ready && !item && done > 0) save("abc:done", true);
  }, [ready, item, done]);

  // Optional practice: doesn't affect grading or activity counts.
  function sayIt() {
    if (!item) return;
    const target = item.examples[0]?.de ?? item.symbol;
    const rec = getRecognition("de-DE");
    if (!rec) return;
    setSayResult("listening");
    rec.onresult = (e) => {
      const heard = e.results[0][0].transcript;
      const hit = normalize(heard).includes(normalize(target.replace(/^(der|die|das)\s+/i, "")));
      setSayLine(hit ? praise() : encourage());
      setSayResult(hit ? "hit" : "miss");
      logEvent("sayit", { ok: hit });
    };
    rec.onerror = () => setSayResult("idle");
    rec.onend = () => setSayResult((r) => (r === "listening" ? "idle" : r));
    rec.start();
  }

  if (!ready) return <p className="muted">Loading…</p>;

  if (!item) {
    const [pDe, pEn] = praise();
    return (
      <>
        <h1>Das ABC</h1>
        <NextStepBanner skill="abc" />
        <div className="card center">
          <div style={{ display: "flex", justifyContent: "center", margin: "6px 0" }}>
            <Opa size={100} mood={done > 0 ? "cheer" : "sleep"} />
          </div>
          {done > 0 ? (
            <>
              <h2 style={{ margin: "0 0 4px" }}>{pDe}</h2>
              <p className="muted small" style={{ marginTop: 0 }}>{pEn}</p>
              <p className="muted small">
                {again === 0 ? "Flawless — every card graded first try." : `${again} card${again > 1 ? "s" : ""} needed a retry — they'll come back sooner.`}
              </p>
            </>
          ) : (
            <p className="muted">„Nichts fällig, mein Kind!“ <span className="small">(Nothing due right now.)</span></p>
          )}
          <div className="row">
            <button className="primary" onClick={loadSession}>Practice again</button>
          </div>
        </div>

        <h2>Das Alphabet</h2>
        <p className="muted small">Tipp auf einen Buchstaben: Opa spricht ihn und zwei Beispielwörter.</p>
        <div className="shop-grid">
          {alphabetEntries.map((e) => <ReferenceCard key={e.id} entry={e} />)}
        </div>
        <h2>Lesenregeln</h2>
        <p className="muted small">Buchstabenkombinationen mit festen Ausspracheregeln.</p>
        <div className="shop-grid">
          {comboEntries.map((e) => <ReferenceCard key={e.id} entry={e} />)}
        </div>
      </>
    );
  }

  const pct = sessionSize > 0 ? Math.round((done / (done + queue.length)) * 100) : 0;

  return (
    <>
      <h1>Das ABC</h1>
      <NextStepBanner skill="abc" />
      <OpaSays
        de="Deutsch ist eine phonetische Sprache — lern diese Regeln einmal, und du kannst jedes Wort lesen und schreiben."
        en="German is phonetic — learn these rules once and you can read and write any word."
        size={72}
      />
      <div className="progressbar"><div style={{ width: `${pct}%` }} /></div>
      <p className="muted small">{queue.length} left · {done} done</p>

      <div className="flip-scene">
        <div className={"flip-inner" + (revealed ? " flipped" : "")} style={flipHeight ? { height: flipHeight } : undefined}>
          <div className="flip-face" ref={frontRef}>
            <span className="badge">{item.type}</span>
            <div className="word say" title="🔊 anhören" onClick={() => speak(frontSpeech(item))}>{item.symbol}</div>
            <button className="ghost" onClick={() => speak(frontSpeech(item))}>🔊 Hear it again</button>
          </div>
          <div className="flip-face back" ref={backRef}>
            <div className="word-sub">{item.soundEn}</div>
            <p className="muted small" style={{ margin: "2px 0 8px", textAlign: "center" }}>{item.sound}</p>
            {item.examples.map((ex, i) => (
              <p className="example" key={i} style={{ margin: "2px 0" }}>
                <span className="say" title="🔊 anhören" onClick={() => speak(ex.de)}>„{ex.de}“</span>
                <span className="small"> — {ex.en}</span>
              </p>
            ))}
            {hasRecognition && (
              <>
                <button className="blue" onClick={sayIt} disabled={sayResult === "listening"}>
                  {sayResult === "listening" ? "🎙️ Listening…" : "🎙️ Sag es!"}
                </button>
                {sayResult === "hit" && <p className="correct small">👴 „{sayLine[0]}“ ✓</p>}
                {sayResult === "miss" && <p className="wrong small">👴 „{sayLine[0]}“ — tap 🔊 and try again</p>}
              </>
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
