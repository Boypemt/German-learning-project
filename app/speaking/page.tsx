"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSentences, getVocabDeck, type Sentence } from "@/lib/content";
import type { VocabItem } from "@/lib/srs";
import { loadProfile } from "@/lib/profile";
import { speak, getRecognition, normalize, similarity } from "@/lib/speech";
import { recordActivity } from "@/lib/storage";
import { logEvent } from "@/lib/telemetry";
import { isItemSnoozed, snoozeSpeakingItem, SPEAKING_SKIP_AFTER_FAILS } from "@/lib/adapt";
import { praise, encourage } from "@/components/Opa";
import NextStepBanner from "@/components/NextStepBanner";

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

// German nouns are stored with their article ("die Zeit") — beginners are
// judged on the word itself, article included or not.
function stripArticle(de: string): string {
  return de.replace(/^(der|die|das)\s+/i, "");
}

function WordMatch({ target, heard }: { target: string; heard: string }) {
  const heardSet = new Set(normalize(heard).split(" "));
  return (
    <p style={{ fontSize: 19, lineHeight: 1.9, margin: "10px 0" }}>
      {target.split(" ").map((w, i) => {
        const hit = heardSet.has(normalize(w));
        return (
          <span key={i} className={"diff-word " + (hit ? "hit" : "miss")} title="🔊 anhören" onClick={() => speak(w)}>
            {w}
          </span>
        );
      })}
    </p>
  );
}

export default function SpeakingPage() {
  const [beginner, setBeginner] = useState(false);
  const [order, setOrder] = useState<Sentence[]>([]);
  const [words, setWords] = useState<VocabItem[]>([]);
  const [idx, setIdx] = useState(0);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState<string | null>(null);
  const [matched, setMatched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [best, setBest] = useState(0); // best similarity this sentence (non-beginner mode)
  const [line, setLine] = useState<[string, string]>(["", ""]);
  const [failCount, setFailCount] = useState(0);

  useEffect(() => {
    const level = loadProfile()?.level ?? "A0";
    const isBeginner = level === "A0" || level === "A1";
    setBeginner(isBeginner);
    if (isBeginner) setWords(shuffle(getVocabDeck(level).filter((v) => !isItemSnoozed(v.id))));
    else setOrder(getSentences(level).filter((sent) => !isItemSnoozed(sent.id)));
  }, []);

  const s = !beginner && order.length > 0 ? order[idx % order.length] : null;
  const w = beginner && words.length > 0 ? words[idx % words.length] : null;
  const sim = heard !== null && s ? similarity(s.de, heard) : null;

  function recordSentence() {
    if (!s) return;
    setError(null);
    setHeard(null);
    const rec = getRecognition("de-DE");
    if (!rec) {
      setError("Speech recognition needs Chrome or Edge. Meanwhile: shadow it — play, repeat aloud, compare by ear.");
      return;
    }
    rec.onresult = (e) => {
      const t = e.results[0][0].transcript;
      setHeard(t);
      const sc = similarity(s.de, t);
      if (sc > best) setBest(sc);
      const ok = sc >= 0.8;
      setLine(ok ? praise() : encourage());
      logEvent("review", { skill: "speaking", itemId: s.id, ok });
      if (ok) recordActivity("speaking");
      else setFailCount((f) => f + 1);
    };
    rec.onerror = (e) => setError(e.error === "not-allowed" ? "Microphone access denied — allow it in the address bar." : `Recognition error: ${e.error}`);
    rec.onend = () => setListening(false);
    setListening(true);
    rec.start();
  }

  function recordWord() {
    if (!w) return;
    setError(null);
    setHeard(null);
    const rec = getRecognition("de-DE");
    if (!rec) {
      setError("Speech recognition needs Chrome or Edge. Meanwhile: shadow it — play, repeat aloud, compare by ear.");
      return;
    }
    rec.onresult = (e) => {
      const t = e.results[0][0].transcript;
      setHeard(t);
      const hit = normalize(t).includes(normalize(stripArticle(w.de)));
      setMatched(hit);
      setLine(hit ? praise() : encourage());
      logEvent("review", { skill: "speaking", itemId: w.id, ok: hit });
      if (hit) recordActivity("speaking");
      else setFailCount((f) => f + 1);
    };
    rec.onerror = (e) => setError(e.error === "not-allowed" ? "Microphone access denied — allow it in the address bar." : `Recognition error: ${e.error}`);
    rec.onend = () => setListening(false);
    setListening(true);
    rec.start();
  }

  function next() {
    setIdx((i) => i + 1);
    setHeard(null);
    setError(null);
    setBest(0);
    setMatched(false);
    setFailCount(0);
  }

  function replay(word: string, slow: boolean) {
    logEvent("replay", { skill: "speaking", slow });
    speak(word, "de-DE", slow ? 0.65 : 0.95);
  }

  function skipItem() {
    const id = w?.id ?? s?.id;
    if (id) snoozeSpeakingItem(id);
    next();
  }

  if (!s && !w) return <p className="muted">Loading…</p>;

  const total = beginner ? words.length : order.length;

  return (
    <>
      <h1>Speaking</h1>
      <NextStepBanner skill="speaking" />
      <div className="progressbar"><div style={{ width: `${((idx % total) / total) * 100}%` }} /></div>
      <p className="muted small">
        {beginner
          ? "Listen 2–3 times, repeat aloud, then record. Perfect grammar isn't the goal yet — just the sounds."
          : "Listen → repeat aloud (copy the rhythm) → record. A recognizer trained on native speech checks if it understood you."}
      </p>

      {w && (
        <div className="card center">
          <span className="badge">{w.level}</span>
          {w.emoji && <div style={{ fontSize: 44, margin: "6px 0 0" }}>{w.emoji}</div>}
          <div className="word say" style={{ fontSize: 26, margin: "10px 0 2px" }} title="🔊 anhören" onClick={() => speak(w.de)}>{w.de}</div>
          <p className="muted small" style={{ marginTop: 0 }}>{w.en}</p>
          <div className="row">
            <button className="blue" onClick={() => replay(w.de, false)}>🔊 Listen</button>
            <button onClick={() => replay(w.de, true)}>🐢 Slow</button>
          </div>
          <div className="row">
            <button className={"bad big" + (listening ? " pulse" : "")} onClick={recordWord} disabled={listening} style={{ maxWidth: 320 }}>
              {listening ? "🎙️ Listening… speak now" : "🎙️ Record me"}
            </button>
          </div>

          {heard !== null && (
            <div>
              <div className={"feedback-banner " + (matched ? "ok" : "no")}>
                👴 „{line[0]}“ {matched ? "— verstanden! 🌟" : "— tap 🔊 and try again."}
              </div>
              <p className="muted small">Recognized: „{heard}“</p>
            </div>
          )}
          {error && <p className="wrong small">{error}</p>}

          {failCount >= SPEAKING_SKIP_AFTER_FAILS && (
            <div className="feedback-banner no">
              👴 „Schwer, was? Lass uns das morgen nochmal versuchen.“ — this one&apos;s tough. Skip it for now?
              <div className="row">
                <button className="ghost" onClick={skipItem}>Skip this word — we&apos;ll try it again tomorrow</button>
              </div>
            </div>
          )}

          <div className="row">
            <button className="ghost" onClick={next}>Next word →</button>
          </div>
        </div>
      )}

      {s && (
        <div className="card center">
          <span className="badge">{s.level}</span>
          <div className="word say" style={{ fontSize: 26, margin: "10px 0 2px" }} title="🔊 anhören" onClick={() => speak(s.de)}>{s.de}</div>
          <p className="muted small" style={{ marginTop: 0 }}>{s.en}</p>
          <div className="row">
            <button className="blue" onClick={() => replay(s.de, false)}>🔊 Listen</button>
            <button onClick={() => replay(s.de, true)}>🐢 Slow</button>
          </div>
          <div className="row">
            <button className={"bad big" + (listening ? " pulse" : "")} onClick={recordSentence} disabled={listening} style={{ maxWidth: 320 }}>
              {listening ? "🎙️ Listening… speak now" : "🎙️ Record me"}
            </button>
          </div>

          {heard !== null && sim !== null && (
            <div>
              <div className={"feedback-banner " + (sim >= 0.8 ? "ok" : "no")}>
                👴 „{line[0]}“ {sim >= 0.999 ? "— every word understood! 🌟" : sim >= 0.8 ? "— polish the red words." : "— slow down, exaggerate the sounds, try again."}
              </div>
              <WordMatch target={s.de} heard={heard} />
              <p className="muted small">Recognized: „{heard}“</p>
            </div>
          )}
          {error && <p className="wrong small">{error}</p>}

          {failCount >= SPEAKING_SKIP_AFTER_FAILS && (
            <div className="feedback-banner no">
              👴 „Schwer, was? Lass uns das morgen nochmal versuchen.“ — this one&apos;s tough. Skip it for now?
              <div className="row">
                <button className="ghost" onClick={skipItem}>Skip this sentence — we&apos;ll try it again tomorrow</button>
              </div>
            </div>
          )}

          <div className="row">
            <button className="ghost" onClick={next}>Next sentence →</button>
          </div>
        </div>
      )}

      <div className="card">
        <h2 style={{ marginTop: 0 }}>🎯 Sounds that mark you as fluent</h2>
        <p className="small muted" style={{ marginBottom: 0 }}>
          <strong>ü</strong> — say &quot;ee&quot;, round your lips (über, müde) · {" "}
          <strong>ö</strong> — say &quot;ay&quot;, round your lips (schön) · {" "}
          <strong>ch</strong> — soft after e/i (ich), hard after a/o/u (Buch) · {" "}
          <strong>endings devoice</strong> — Tag→&quot;Tak&quot;, Hund→&quot;Hunt&quot; · {" "}
          <strong>z</strong> = &quot;ts&quot; (Zeit).
        </p>
        <p className="muted small" style={{ marginBottom: 0 }}>
          New to German sounds? <Link href="/abc" style={{ textDecoration: "underline" }}>Full guide → /abc</Link>
        </p>
      </div>
    </>
  );
}
