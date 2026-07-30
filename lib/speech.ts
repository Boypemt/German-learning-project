// Web Speech API wrappers (free, in-browser).
// TTS works in all major browsers; SpeechRecognition needs Chrome/Edge.

// Defaults tuned for "Opa": slightly slower and lower-pitched than the
// stock browser voice, so it feels like a patient older speaker.

import { load, save } from "./storage";

// Bumped by every speak()/speakSeq() call. A speakSeq() chain checks this
// before queuing its next utterance, so a later tap (which bumps it again)
// silently kills any still-running chain instead of overlapping it.
let seqToken = 0;

// ---- voice selection & caching ----
// getVoices() is often EMPTY on the very first call (the list loads
// asynchronously), so calling it per-utterance tends to land on the
// browser's default voice — frequently a REMOTE one (Chrome's "Google
// Deutsch" synthesizes on Google's servers) that adds real network
// latency. We cache the chosen voice and only ever recompute it when the
// voice list itself changes, never per utterance.
let cachedVoice: SpeechSynthesisVoice | null = null;
let cachedForLang: string | null = null;

export interface VoiceOption {
  voiceURI: string;
  name: string;
  lang: string;
  localService: boolean;
}

/**
 * Pure selection logic (unit-tested separately from the browser APIs):
 * honour a stored preference first, then prefer an offline (localService)
 * voice — instant, no network round-trip — then just take whatever matches.
 */
export function pickBestVoice<T extends VoiceOption>(
  voices: T[],
  lang: string,
  preferredURI?: string | null
): T | undefined {
  const prefix = lang.slice(0, 2).toLowerCase();
  const matching = voices.filter((v) => v.lang.toLowerCase().startsWith(prefix));
  if (preferredURI) {
    const preferred = matching.find((v) => v.voiceURI === preferredURI);
    if (preferred) return preferred;
  }
  return matching.find((v) => v.localService) ?? matching[0];
}

export function getVoicePreference(): string | null {
  return load<string | null>("voice", null);
}

/** Pass null to clear the preference and go back to automatic selection. */
export function setVoicePreference(voiceURI: string | null): void {
  save("voice", voiceURI);
  cachedVoice = null; // force a re-pick using the new preference
}

/** All installed German voices, for the picker on /konto. */
export function getGermanVoices(): VoiceOption[] {
  if (typeof window === "undefined" || !window.speechSynthesis) return [];
  return window.speechSynthesis
    .getVoices()
    .filter((v) => v.lang.toLowerCase().startsWith("de"))
    .map((v) => ({ voiceURI: v.voiceURI, name: v.name, lang: v.lang, localService: v.localService }));
}

function resolveVoice(lang: string): SpeechSynthesisVoice | undefined {
  if (cachedVoice && cachedForLang === lang) return cachedVoice;
  const chosen = pickBestVoice(window.speechSynthesis.getVoices(), lang, getVoicePreference());
  if (chosen) {
    cachedVoice = chosen;
    cachedForLang = lang;
  }
  return chosen;
}

if (typeof window !== "undefined" && window.speechSynthesis) {
  // Voices load asynchronously — when the list changes (e.g. finally
  // populates), drop the cache so the next speak() re-picks properly
  // instead of being stuck with whatever (possibly nothing) was cached.
  window.speechSynthesis.addEventListener("voiceschanged", () => {
    cachedVoice = null;
  });
}

// ---- engine warm-up ----
let warmed = false;

/**
 * Call once on a real user gesture (tap/click/keydown) to nudge the engine
 * into initializing its voice/audio pipeline before the first real
 * utterance — tied to a genuine interaction so autoplay policies allow it.
 * Silent (volume 0) and a no-op after the first call.
 */
export function warmUpSpeech(): void {
  if (warmed || typeof window === "undefined" || !window.speechSynthesis) return;
  warmed = true;
  const u = new SpeechSynthesisUtterance(" ");
  u.volume = 0;
  window.speechSynthesis.speak(u);
}

export function speak(text: string, lang = "de-DE", rate = 0.92, pitch = 0.85): void {
  seqToken++;
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const synth = window.speechSynthesis;
  // An unconditional cancel() right before speak() is a known source of
  // dropped/delayed utterances in Chrome — only cancel if there's actually
  // something playing or queued.
  if (synth.speaking || synth.pending) synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = rate;
  u.pitch = pitch;
  const voice = resolveVoice(lang);
  if (voice) u.voice = voice;
  synth.speak(u);
}

// Speaks a list of texts back-to-back, each one starting only once the
// previous utterance actually ends — not after a guessed setTimeout delay.
// A new speak()/speakSeq() call always wins over one already in progress.
export function speakSeq(texts: string[], lang = "de-DE", rate = 0.92, pitch = 0.85): void {
  seqToken++;
  const token = seqToken;
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const synth = window.speechSynthesis;
  if (synth.speaking || synth.pending) synth.cancel();
  const voice = resolveVoice(lang);

  function speakAt(i: number) {
    if (token !== seqToken || i >= texts.length) return;
    const u = new SpeechSynthesisUtterance(texts[i]);
    u.lang = lang;
    u.rate = rate;
    u.pitch = pitch;
    if (voice) u.voice = voice;
    u.onend = () => speakAt(i + 1);
    u.onerror = () => speakAt(i + 1);
    synth.speak(u);
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
