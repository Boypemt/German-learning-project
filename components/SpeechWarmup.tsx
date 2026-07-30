"use client";

// Invisible: nudges the speech engine awake on the first real user
// gesture, so its voice/audio pipeline is already warm by the time the
// first actual utterance plays.

import { useEffect } from "react";
import { warmUpSpeech } from "@/lib/speech";

export default function SpeechWarmup() {
  useEffect(() => {
    window.addEventListener("pointerdown", warmUpSpeech, { once: true });
    window.addEventListener("keydown", warmUpSpeech, { once: true });
    return () => {
      window.removeEventListener("pointerdown", warmUpSpeech);
      window.removeEventListener("keydown", warmUpSpeech);
    };
  }, []);
  return null;
}
