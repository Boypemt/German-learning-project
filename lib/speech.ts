// Web Speech API wrappers (free, in-browser).
// TTS works in all major browsers; SpeechRecognition needs Chrome/Edge.

// Defaults tuned for "Opa": slightly slower and lower-pitched than the
// stock browser voice, so it feels like a patient older speaker.

// Bumped by every speak()/speakSeq() call. A speakSeq() chain checks this
// before queuing its next utterance, so a later tap (which bumps it again)
// silently kills any still-running chain instead of overlapping it.
let seqToken = 0;

function pickVoice(lang: string): SpeechSynthesisVoice | undefined {
  return window.speechSynthesis.getVoices().find((v) => v.lang.startsWith(lang.slice(0, 2)));
}

export function speak(text: string, lang = "de-DE", rate = 0.92, pitch = 0.85): void {
  seqToken++;
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = rate;
  u.pitch = pitch;
  const voice = pickVoice(lang);
  if (voice) u.voice = voice;
  window.speechSynthesis.speak(u);
}

// Speaks a list of texts back-to-back, each one starting only once the
// previous utterance actually ends — not after a guessed setTimeout delay.
// A new speak()/speakSeq() call always wins over one already in progress.
export function speakSeq(texts: string[], lang = "de-DE", rate = 0.92, pitch = 0.85): void {
  seqToken++;
  const token = seqToken;
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const voice = pickVoice(lang);

  function speakAt(i: number) {
    if (token !== seqToken || i >= texts.length) return;
    const u = new SpeechSynthesisUtterance(texts[i]);
    u.lang = lang;
    u.rate = rate;
    u.pitch = pitch;
    if (voice) u.voice = voice;
    u.onend = () => speakAt(i + 1);
    u.onerror = () => speakAt(i + 1);
    window.speechSynthesis.speak(u);
  }

  speakAt(0);
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
// Umlauts map to their digraphs so "schoen" counts as "schön" —
// handy when typing on a keyboard without German characters.
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
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
