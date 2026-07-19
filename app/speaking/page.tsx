"use client";

import { useEffect, useState } from "react";
import { getSentences, type Sentence } from "@/lib/content";
import { loadProfile } from "@/lib/profile";
import { speak, getRecognition, normalize, similarity } from "@/lib/speech";
import { recordActivity } from "@/lib/storage";
import { praise, encourage } from "@/components/Opa";
import NextStepBanner from "@/components/NextStepBanner";

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
  const [order, setOrder] = useState<Sentence[]>([]);
  const [idx, setIdx] = useState(0);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [best, setBest] = useState(0); // best similarity this sentence
  const [line, setLine] = useState<[string, string]>(["", ""]);

  useEffect(() => {
    setOrder(getSentences(loadProfile()?.level ?? "A0"));
  }, []);

  const s = order.length > 0 ? order[idx % order.length] : null;
  const sim = heard !== null && s ? similarity(s.de, heard) : null;

  function record() {
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
      const sc = similarity(s!.de, t);
      if (sc > best) setBest(sc);
      setLine(sc >= 0.8 ? praise() : encourage());
      if (sc >= 0.8) recordActivity("speaking");
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
  }

  if (!s) return <p className="muted">Loading…</p>;

  return (
    <>
      <h1>Speaking</h1>
      <NextStepBanner skill="speaking" />
      <div className="progressbar"><div style={{ width: `${((idx % order.length) / order.length) * 100}%` }} /></div>
      <p className="muted small">
        Listen → repeat aloud (copy the rhythm) → record. A recognizer trained on native speech checks if it understood you.
      </p>

      <div className="card center">
        <span className="badge">{s.level}</span>
        <div className="word say" style={{ fontSize: 26, margin: "10px 0 2px" }} title="🔊 anhören" onClick={() => speak(s.de)}>{s.de}</div>
        <p className="muted small" style={{ marginTop: 0 }}>{s.en}</p>
        <div className="row">
          <button className="blue" onClick={() => speak(s.de, "de-DE", 0.95)}>🔊 Listen</button>
          <button onClick={() => speak(s.de, "de-DE", 0.65)}>🐢 Slow</button>
        </div>
        <div className="row">
          <button className={"bad big" + (listening ? " pulse" : "")} onClick={record} disabled={listening} style={{ maxWidth: 320 }}>
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

        <div className="row">
          <button className="ghost" onClick={next}>Next sentence →</button>
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>🎯 Sounds that mark you as fluent</h2>
        <p className="small muted" style={{ marginBottom: 0 }}>
          <strong>ü</strong> — say &quot;ee&quot;, round your lips (über, müde) · {" "}
          <strong>ö</strong> — say &quot;ay&quot;, round your lips (schön) · {" "}
          <strong>ch</strong> — soft after e/i (ich), hard after a/o/u (Buch) · {" "}
          <strong>endings devoice</strong> — Tag→&quot;Tak&quot;, Hund→&quot;Hunt&quot; · {" "}
          <strong>z</strong> = &quot;ts&quot; (Zeit).
        </p>
      </div>
    </>
  );
}
