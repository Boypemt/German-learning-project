"use client";

// Word-level diff between a target phrase and what the speech recognizer
// heard — green for recognized words, red for missed ones. Used by both
// /speaking and /vocab's "Sag es!" checks so the feedback looks identical
// everywhere the app compares recognized speech to a target.

import { speak, normalize } from "@/lib/speech";

export default function WordMatch({ target, heard }: { target: string; heard: string }) {
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
