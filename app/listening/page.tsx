"use client";

import { useEffect, useRef, useState } from "react";
import { getSentences, getVocabDeck, findVocabById, type Sentence } from "@/lib/content";
import type { VocabItem } from "@/lib/srs";
import { loadProfile } from "@/lib/profile";
import { getLearnerModel } from "@/lib/model";
import { getAdaptation, chooseListeningOptions, isAbcTurn, type ConfusionDrillPair } from "@/lib/adapt";
import { buildQuizQuestions, type QuizItem, type QuizQuestion } from "@/lib/abcQuiz";
import abcQuizData from "@/data/de/abc-quiz.json";
import Umlauts from "@/components/Umlauts";
import { speak, normalize, similarity } from "@/lib/speech";
import { load, recordActivity } from "@/lib/storage";
import { logEvent } from "@/lib/telemetry";
import { praise, encourage } from "@/components/Opa";
import NextStepBanner from "@/components/NextStepBanner";

const abcQuizPool = abcQuizData as QuizItem[];

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

function WordDiff({ target, attempt }: { target: string; attempt: string }) {
  const attemptSet = new Set(normalize(attempt).split(" "));
  return (
    <p style={{ fontSize: 19, lineHeight: 1.9, margin: "10px 0" }}>
      {target.split(" ").map((w, i) => {
        const hit = attemptSet.has(normalize(w));
        return (
          <span key={i} className={"diff-word " + (hit ? "hit" : "miss")} title="🔊 anhören" onClick={() => speak(w)}>
            {w}
          </span>
        );
      })}
    </p>
  );
}

/** The current beginner-mode question, normalized across its three
 *  possible sources (confusion drill, mixed-in ABC question, plain vocab
 *  word) so the rest of the render logic doesn't need to branch on source. */
interface CurrentQuestion {
  itemId: string;
  spoken: string;
  correct: string;
  en: string;
  emoji?: string;
  level?: string;
}

export default function ListeningPage() {
  const [beginner, setBeginner] = useState(false);
  const [order, setOrder] = useState<Sentence[]>([]);
  const [fullDeck, setFullDeck] = useState<VocabItem[]>([]);
  const [wordQueue, setWordQueue] = useState<VocabItem[]>([]);
  const [abcQueue, setAbcQueue] = useState<QuizQuestion[]>([]);
  const [abcDoneFlag, setAbcDoneFlag] = useState(false);
  const [options, setOptions] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [val, setVal] = useState("");
  const [checked, setChecked] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [line, setLine] = useState<[string, string]>(["", ""]);
  const [accuracy7d, setAccuracy7d] = useState(0.7); // neutral default until the model loads
  const [drillPairs, setDrillPairs] = useState<ConfusionDrillPair[]>([]);
  const inRef = useRef<HTMLInputElement>(null);
  const shownAtRef = useRef(Date.now());

  useEffect(() => {
    shownAtRef.current = Date.now();
  }, [idx]);

  useEffect(() => {
    const profile = loadProfile();
    const level = profile?.level ?? "A0";
    const isBeginner = level === "A0" || level === "A1";
    setBeginner(isBeginner);
    if (isBeginner) {
      const deck = getVocabDeck(level);
      const withEmoji = deck.filter((d) => d.emoji);
      setFullDeck(deck);
      setWordQueue(shuffle(withEmoji.length >= 8 ? withEmoji : deck));
      setAbcQueue(buildQuizQuestions(abcQuizPool));
      setAbcDoneFlag(load("abc:done", false));
      if (profile) {
        const model = getLearnerModel(profile);
        setAccuracy7d(model.perSkill.listening.accuracy7d);
        setDrillPairs(getAdaptation(profile, model).confusionDrillPairs);
      }
    } else {
      setOrder(shuffle(getSentences(level)));
    }
  }, []);

  // Repeat-offender confusions ("Opas Extrarunde") come first, then the
  // regular rotation — resolved lazily since drillPairs only ever changes once.
  const drillTargets = drillPairs
    .map((p) => findVocabById(p.itemId))
    .filter((v): v is VocabItem => !!v);
  const isDrill = beginner && idx < drillTargets.length;
  const postDrillIdx = idx - drillTargets.length;
  const isAbcQuestion = beginner && !isDrill && abcQueue.length > 0 && isAbcTurn(postDrillIdx, abcDoneFlag);

  // Build (and speak) a fresh, stable set of options whenever a new beginner
  // question loads — never regenerated just because `selected` changes.
  useEffect(() => {
    if (!beginner) return;
    if (isDrill) {
      const t = drillTargets[idx];
      if (!t) return;
      const sameLevel = fullDeck.filter((d) => d.level === t.level && d.id !== t.id);
      const pool = sameLevel.length >= 3 ? sameLevel : fullDeck.filter((d) => d.id !== t.id);
      const forced = [findVocabById(drillPairs[idx].pickedId)].filter((v): v is VocabItem => !!v);
      setOptions(chooseListeningOptions(t, pool, accuracy7d, forced).map((v) => v.de));
      setSelected(null);
      speak(t.de);
      return;
    }
    if (isAbcQuestion) {
      const q = abcQueue[postDrillIdx % abcQueue.length];
      if (!q) return;
      setOptions(q.options.map((o) => o.text));
      setSelected(null);
      speak(q.correct);
      return;
    }
    if (wordQueue.length === 0) return;
    const t = wordQueue[postDrillIdx % wordQueue.length];
    const sameLevel = fullDeck.filter((d) => d.level === t.level && d.id !== t.id);
    const pool = sameLevel.length >= 3 ? sameLevel : fullDeck.filter((d) => d.id !== t.id);
    setOptions(chooseListeningOptions(t, pool, accuracy7d, []).map((v) => v.de));
    setSelected(null);
    speak(t.de);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, beginner, wordQueue, fullDeck, isDrill, isAbcQuestion, abcQueue]);

  // Normalizes whichever source is active into one shape the render below
  // (and selectOption) can consume without caring where the question came from.
  let current: CurrentQuestion | null = null;
  if (beginner) {
    if (isDrill && drillTargets[idx]) {
      const t = drillTargets[idx];
      current = { itemId: t.id, spoken: t.de, correct: t.de, en: t.en, emoji: t.emoji, level: t.level };
    } else if (isAbcQuestion && abcQueue[postDrillIdx % abcQueue.length]) {
      const q = abcQueue[postDrillIdx % abcQueue.length];
      current = { itemId: q.id, spoken: q.correct, correct: q.correct, en: q.correctEn };
    } else if (wordQueue.length > 0) {
      const t = wordQueue[postDrillIdx % wordQueue.length];
      current = { itemId: t.id, spoken: t.de, correct: t.de, en: t.en, emoji: t.emoji, level: t.level };
    }
  }

  const s = !beginner && order.length > 0 ? order[idx % order.length] : null;
  const sim = checked && s ? similarity(s.de, val) : 0;

  function check() {
    if (!s || !val.trim()) return;
    const ok = similarity(s.de, val) >= 0.8;
    setChecked(true);
    setAttempts((a) => a + 1);
    setLine(ok ? praise() : encourage());
    logEvent("review", { skill: "listening", itemId: s.id, ok, ms: Date.now() - shownAtRef.current });
    if (ok) {
      setCorrect((c) => c + 1);
      recordActivity("listening");
    }
  }

  function selectOption(label: string) {
    if (selected || !current) return;
    setSelected(label);
    const ok = label === current.correct;
    setAttempts((a) => a + 1);
    setLine(ok ? praise() : encourage());
    speak(current.spoken);
    logEvent("review", { skill: "listening", itemId: current.itemId, ok, ms: Date.now() - shownAtRef.current });
    if (!ok) logEvent("choice_wrong", { itemId: current.itemId, pickedId: label });
    if (ok) {
      setCorrect((c) => c + 1);
      recordActivity("listening"); // ABC-sourced questions count as listening activity too
    }
  }

  function next() {
    const nextIdx = idx + 1;
    setIdx(nextIdx);
    if (!beginner) {
      setVal("");
      setChecked(false);
      speak(order[nextIdx % order.length].de);
    }
  }

  if (beginner ? (wordQueue.length === 0 || !current) : order.length === 0) {
    return <p className="muted">Loading…</p>;
  }

  return (
    <>
      <h1>Listening</h1>
      <NextStepBanner skill="listening" />
      {beginner ? (
        <>
          {isDrill ? (
            <div className="feedback-banner ok">
              🔁 Opas Extrarunde — Frage {idx + 1}/{drillTargets.length}: Wörter, die du oft verwechselst.
              <span className="muted small"> (an extra round on words you often mix up)</span>
            </div>
          ) : (
            <div className="progressbar"><div style={{ width: `${((postDrillIdx % wordQueue.length) / wordQueue.length) * 100}%` }} /></div>
          )}
          <p className="muted small">
            {isDrill ? "Opas Extrarunde" : isAbcQuestion ? "🔤 ABC" : <>Word {(postDrillIdx % wordQueue.length) + 1}/{wordQueue.length}</>}
            {current!.level && <> · <span className="badge">{current!.level}</span></>}
            {attempts > 0 && <> · <span className="correct">{correct}</span>/{attempts} correct</>}
          </p>

          <div className="card">
            <div className="row" style={{ marginTop: 0 }}>
              <button className="blue" onClick={() => speak(current!.spoken, "de-DE", 0.95)}>🔊 Play again</button>
              <button onClick={() => speak(current!.spoken, "de-DE", 0.65)}>🐢 Slow</button>
            </div>
            <p className="muted small center" style={{ marginTop: 0 }}>Which spelling matches what you heard?</p>
            {!isDrill && !isAbcQuestion && accuracy7d < 0.6 && (
              <p className="muted small center">🎯 3 choices today — let's rebuild confidence.</p>
            )}
            {!isDrill && !isAbcQuestion && accuracy7d >= 0.85 && (
              <p className="muted small center">🧠 Trickier spellings today — you've earned it.</p>
            )}
            <div className="row" style={{ flexDirection: "column", alignItems: "stretch" }}>
              {options.map((label) => {
                const isCorrect = label === current!.correct;
                const cls = !selected ? "ghost" : isCorrect ? "good" : label === selected ? "bad" : "ghost";
                return (
                  <button key={label} className={cls + " big"} disabled={!!selected} onClick={() => selectOption(label)}>
                    {label}
                  </button>
                );
              })}
            </div>

            {selected && (
              <div className="center">
                <div className={"feedback-banner " + (selected === current!.correct ? "ok" : "no")}>
                  👴 „{line[0]}“ {selected === current!.correct ? "✓" : `— richtig: „${current!.correct}“`}
                </div>
                <p style={{ margin: "6px 0" }}>
                  {current!.emoji && <span style={{ fontSize: 30, marginRight: 8 }}>{current!.emoji}</span>}
                  <span className="muted">{current!.en}</span>
                </p>
                <div className="row">
                  <button className="primary" onClick={next}>Weiter →</button>
                </div>
              </div>
            )}
          </div>

          <p className="muted small center">Train your ear for spelling before you type it.</p>
        </>
      ) : (
        <>
          <div className="progressbar"><div style={{ width: `${((idx % order.length) / order.length) * 100}%` }} /></div>
          <p className="muted small">
            Sentence {(idx % order.length) + 1}/{order.length} · <span className="badge">{s!.level}</span>
            {attempts > 0 && <> · <span className="correct">{correct}</span>/{attempts} correct</>}
          </p>

          <div className="card">
            <div className="row" style={{ marginTop: 0 }}>
              <button className="blue" onClick={() => speak(s!.de, "de-DE", 0.95)}>🔊 Play</button>
              <button onClick={() => speak(s!.de, "de-DE", 0.65)}>🐢 Slow</button>
            </div>
            <input
              ref={inRef}
              type="text"
              placeholder="Type the German you hear… (ae/oe/ue/ss also count)"
              value={val}
              autoFocus
              onChange={(e) => setVal(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (checked ? next() : check())}
            />
            <Umlauts targetRef={inRef} value={val} onChange={setVal} />
            <div className="row">
              {!checked
                ? <button className="primary big" onClick={check}>Check</button>
                : <button className="good big" onClick={next}>Next →</button>}
            </div>

            {checked && (
              <div className="center">
                <div className={"feedback-banner " + (sim >= 0.8 ? "ok" : "no")}>
                  👴 „{line[0]}“ {sim >= 0.999 ? "🎯" : sim >= 0.8 ? "— check the red words" : "— compare below, then replay it"}
                </div>
                <WordDiff target={s!.de} attempt={val} />
                <p className="muted small">{s!.en}</p>
              </div>
            )}
          </div>

          <p className="muted small center">
            <kbd>Enter</kbd> check / next · After drills, get real input:{" "}
            <a href="https://learngerman.dw.com/en/nicos-weg/c-36519789" target="_blank" style={{ textDecoration: "underline" }}>Nicos Weg</a> ·{" "}
            <a href="https://www.youtube.com/@EasyGerman" target="_blank" style={{ textDecoration: "underline" }}>Easy German</a>
          </p>
        </>
      )}
    </>
  );
}
