// Web Speech API wrappers (free, in-browser).
// TTS works in all major browsers; SpeechRecognition needs Chrome/Edge.

export function speak(text: string, lang = "de-DE", rate = 0.95): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = rate;
  const voice = window.speechSynthesis
    .getVoices()
    .find((v) => v.lang.startsWith(lang.slice(0, 2)));
  if (voice) u.voice = voice;
  window.speechSynthesis.speak(u);
}

type RecognitionCtor = new () => SpeechRecognitionLike;

export interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: { 0: { 0: { transcript: string } } } }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

export function getRecognition(lang = "de-DE"): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = lang;
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  return rec;
}

// Normalize for comparing what the user said/typed vs. the target.
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/[.,!?;:'"„“()\-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Word-level diff score: fraction of target words present in attempt (0..1).
export function similarity(target: string, attempt: string): number {
  const t = normalize(target).split(" ");
  const a = new Set(normalize(attempt).split(" "));
  if (t.length === 0) return 0;
  const hit = t.filter((w) => a.has(w)).length;
  return hit / t.length;
}
