"use client";

import { useMemo, useRef, useState } from "react";
import sentencesData from "@/data/de/sentences-a1.json";
import { speak, getRecognition, similarity, type SpeechRecognitionLike } from "@/lib/speech";
import { recordActivity } from "@/lib/storage";

interface Sentence { id: string; de: string; en: string; level: string; }
const sentences = sentencesData as Sentence[];

export default function SpeakingPage() {
  const order = useMemo(() => [...sentences], []);
  const [idx, setIdx] = useState(0);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  const s = order[idx % order.length];
  const sim = heard !== null ? similarity(s.de, heard) : null;

  function record() {
    setError(null);
    setHeard(null);
    const rec = getRecognition("de-DE");
    if (!rec) {
      setError("Speech recognition needs Chrome or Edge. You can still practice by shadowing: play, repeat aloud, compare by ear.");
      return;
    }
    recRef.current = rec;
    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setHeard(transcript);
      if (similarity(s.de, transcript) >= 0.8) recordActivity();
    };
    rec.onerror = (e) => setError(e.error === "not-allowed" ? "Microphone access denied." : `Recognition error: ${e.error}`);
    rec.onend = () => setListening(false);
    setListening(true);
    rec.start();
  }

  function next() {
    setIdx((i) => i + 1);
    setHeard(null);
    setError(null);
  }

  return (
    <>
      <h1>Speaking — shadow &amp; compare</h1>
      <p className="muted small">
        1. Listen. 2. Repeat aloud imitating rhythm and melody (shadowing). 3. Record — the app checks if a native-trained recognizer understood you.
      </p>

      <div className="card" style={{ textAlign: "center" }}>
        <div className="word" style={{ fontSize: 24 }}>{s.de}</div>
        <p className="muted small">{s.en}</p>
        <div className="row">
          <button onClick={() => speak(s.de, "de-DE", 0.95)}>🔊 Listen</button>
          <button onClick={() => speak(s.de, "de-DE", 0.65)}>🐢 Slow</button>
          <button className="primary" onClick={record} disabled={listening}>
            {listening ? "🎙️ Listening…" : "🎙️ Record me"}
          </button>
          <button className="ghost" onClick={next}>Next →</button>
        </div>

        {heard !== null && sim !== null && (
          <div>
            <p className={sim >= 0.8 ? "correct" : "wrong"}>
              {sim >= 0.999 ? "Perfect — understood every word! ✓" : sim >= 0.8 ? "Good — nearly all words recognized" : "Recognizer struggled — try slower, exaggerate the sounds"}
            </p>
            <p className="muted small">Recognized: „{heard}“</p>
          </div>
        )}
        {error && <p className="wrong small">{error}</p>}
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Daily pronunciation focus</h2>
        <p className="small muted">
          Drill these until automatic: <strong>ü</strong> (say &quot;ee&quot; with rounded lips: über, müde) ·{" "}
          <strong>ö</strong> (say &quot;ay&quot; with rounded lips: schön, hören) ·{" "}
          <strong>ch</strong> soft after e/i (ich, nicht) vs. hard after a/o/u (Buch, acht) ·{" "}
          <strong>final devoicing</strong> (Tag→&quot;Tak&quot;, Hund→&quot;Hunt&quot;) ·{" "}
          <strong>z</strong> = &quot;ts&quot; (Zeit, Zug).
        </p>
      </div>
    </>
  );
}
