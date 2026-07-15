"use client";

// Opa — the app's mascot. A warm German grandpa who teaches you his language
// and his culture. Pure inline SVG, no assets needed.

import { speak } from "@/lib/speech";

export type OpaMood = "happy" | "cheer" | "think" | "sleep";

export function Opa({ size = 84, mood = "happy" }: { size?: number; mood?: OpaMood }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-label="Opa" style={{ flexShrink: 0 }}>
      {/* face */}
      <ellipse cx="60" cy="70" rx="35" ry="33" fill="#f2c9a0" />
      {/* ears */}
      <ellipse cx="25" cy="72" rx="6" ry="9" fill="#eebd90" />
      <ellipse cx="95" cy="72" rx="6" ry="9" fill="#eebd90" />
      {/* flat cap (Schiebermütze) */}
      <path d="M22 52 Q26 26 60 25 Q94 26 98 52 Q80 44 60 44 Q40 44 22 52 Z" fill="#7a5a3a" />
      <path d="M20 52 Q60 40 100 52 L102 58 Q60 48 18 58 Z" fill="#8b6a47" />
      {/* cheeks */}
      <ellipse cx="38" cy="82" rx="7" ry="4.5" fill="#e89b7a" opacity="0.45" />
      <ellipse cx="82" cy="82" rx="7" ry="4.5" fill="#e89b7a" opacity="0.45" />
      {/* glasses */}
      <circle cx="44" cy="70" r="11" fill="rgba(255,255,255,0.35)" stroke="#5b4636" strokeWidth="2.5" />
      <circle cx="76" cy="70" r="11" fill="rgba(255,255,255,0.35)" stroke="#5b4636" strokeWidth="2.5" />
      <line x1="55" y1="70" x2="65" y2="70" stroke="#5b4636" strokeWidth="2.5" />
      {/* eyes */}
      {mood === "sleep" ? (
        <>
          <path d="M39 71 Q44 74 49 71" stroke="#4a3a2c" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M71 71 Q76 74 81 71" stroke="#4a3a2c" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </>
      ) : mood === "cheer" ? (
        <>
          <path d="M40 71 Q44 66 48 71" stroke="#4a3a2c" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M72 71 Q76 66 80 71" stroke="#4a3a2c" strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="44" cy="70" r="3" fill="#4a3a2c" />
          <circle cx="76" cy="70" r="3" fill="#4a3a2c" />
        </>
      )}
      {/* white eyebrows */}
      <path d="M35 58 Q44 54 51 58" stroke="#f5f0e6" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path
        d={mood === "think" ? "M69 55 Q76 51 85 56" : "M69 58 Q76 54 85 58"}
        stroke="#f5f0e6" strokeWidth="4" fill="none" strokeLinecap="round"
      />
      {/* nose */}
      <ellipse cx="60" cy="79" rx="5.5" ry="4.5" fill="#e8ab7e" />
      {/* mustache */}
      <path d="M60 86 Q48 82 42 88 Q46 95 60 91 Q74 95 78 88 Q72 82 60 86 Z" fill="#f5f0e6" />
      {/* mouth */}
      {mood === "cheer" ? (
        <path d="M50 94 Q60 103 70 94 Z" fill="#8c4f3f" />
      ) : mood === "think" ? (
        <line x1="54" y1="96" x2="66" y2="96" stroke="#8c4f3f" strokeWidth="2.5" strokeLinecap="round" />
      ) : (
        <path d="M52 94 Q60 100 68 94" stroke="#8c4f3f" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      )}
      {/* chin beard hint */}
      <path d="M46 100 Q60 108 74 100" stroke="#f5f0e6" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.8" />
    </svg>
  );
}

export function OpaSays({ de, en, mood = "happy", size = 84 }: { de: string; en?: string; mood?: OpaMood; size?: number }) {
  return (
    <div className="opa-row">
      <Opa size={size} mood={mood} />
      <div className="bubble">
        <div className="de" title="🔊 anhören" onClick={() => speak(de)}>{de}</div>
        {en && <div className="en">{en}</div>}
      </div>
    </div>
  );
}

// Opa's praise & encouragement — used across exercises.
const PRAISE: [string, string][] = [
  ["Sehr gut, mein Kind!", "Very good, my child!"],
  ["Prima! Genau richtig.", "Great! Exactly right."],
  ["Klasse gemacht!", "Well done!"],
  ["Wunderbar!", "Wonderful!"],
  ["Na also, das sitzt doch!", "See, you've got it down!"],
  ["Ausgezeichnet!", "Excellent!"],
];

const ENCOURAGE: [string, string][] = [
  ["Macht nichts — nochmal!", "No matter — again!"],
  ["Fast! Das kriegen wir hin.", "Almost! We'll get there."],
  ["Nur Übung macht den Meister.", "Practice makes the master."],
  ["Kopf hoch, weiter geht's!", "Chin up, onwards!"],
];

export function praise(): [string, string] {
  return PRAISE[Math.floor(Math.random() * PRAISE.length)];
}

export function encourage(): [string, string] {
  return ENCOURAGE[Math.floor(Math.random() * ENCOURAGE.length)];
}
