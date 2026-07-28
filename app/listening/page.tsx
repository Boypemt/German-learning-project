"use client";

import { useEffect, useRef, useState } from "react";
import { getSentences, getVocabDeck, findVocabById, type Sentence } from "@/lib/content";
import type { VocabItem } from "@/lib/srs";
import { loadProfile } from "@/lib/profile";
import { getLearnerModel } from "@/lib/model";
import { getAdaptation, chooseListeningOptions, type ConfusionDrillPair } from "@/lib/adapt";
import Umlauts from "@/components/Umlauts";
import { speak, normalize, similarity } from "@/lib/speech";
import { recordActivity } from "@/lib/storage";
import { logEvent } from "@/lib/telemetry";
import { praise, encourage } from "@/components/Opa";
import NextStepBanner from "@/components/NextStepBanner";

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

export default function ListeningPage() {
  const [beginner, setBeginner] = useState(false);
  const [order, setOrder] = useState<Sentence[]>([]);
  const [fullDeck, setFullDeck] = useState<VocabItem[]>([]);
  const [wordQueue, setWordQueue] = useState<VocabItem[]>([]);
  const [options, setOptions] = useState<VocabItem[]>([]);
  const [selected, setSelected] = useState<VocabItem | null>(null);
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
  const target = beginner
    ? isDrill
      ? drillTargets[idx]
      : wordQueue.length > 0
      ? wordQueue[(idx - drillTargets.length) % wordQueue.length]
      : null
    : null;

  // Build (and speak) a fresh, stable set of options whenever a new beginner
  // question loads — never regenerated just because `selected` changes.
  useEffect(() => {
    if (!beginner || !target) return;
    const sameLevel = fullDeck.filter((d) => d.level === target.level && d.id !== target.id);
    const pool = sameLevel.length >= 3 ? sameLevel : fullDeck.filter((d) => d.id !== target.id);
    const forced = isDrill ? [findVocabById(drillPairs[idx].pickedId)].filter((v): v is VocabItem => !!v) : [];
    setOptions(chooseListeningOptions(target, pool, accuracy7d, forced));
    setSelected(null);
    speak(target.de);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, beginner, wordQueue, fullDeck, isDrill]);

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

  function selectOption(opt: VocabItem) {
    if (selected || !target) return;
    setSelected(opt);
    const ok = opt.id === target.id;
    setAttempts((a) => a + 1);
    setLine(ok ? praise() : encourage());
    speak(target.de);
    logEvent("review", { skill: "listening", itemId: target.id, ok, ms: Date.now() - shownAtRef.current });
    if (!ok) logEvent("choice_wrong", { itemId: target.id, pickedId: opt.id });
    if (ok) {
      setCorrect((c) => c + 1);
      recordActivity("listening");
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

  if (beginner ? (wordQueue.length === 0 || !target) : order.length === 0) {
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
            <div className="progressbar"><div style={{ width: `${(((idx - drillTargets.length) % wordQueue.length) / wordQueue.length) * 100}%` }} /></div>
          )}
          <p className="muted small">
            {isDrill ? "Opas Extrarunde" : <>Word {((idx - drillTargets.length) % wordQueue.length) + 1}/{wordQueue.length}</>} ·{" "}
            <span className="badge">{target!.level}</span>
            {attempts > 0 && <> · <span className="correct">{correct}</span>/{attempts} correct</>}
          </p>

          <div className="card">
            <div className="row" style={{ marginTop: 0 }}>
              <button className="blue" onClick={() => speak(target!.de, "de-DE", 0.95)}>🔊 Play again</button>
              <button onClick={() => speak(target!.de, "de-DE", 0.65)}>🐢 Slow</button>
            </div>
            <p className="muted small center" style={{ marginTop: 0 }}>Which spelling matches what you heard?</p>
            {!isDrill && accuracy7d < 0.6 && (
              <p className="muted small center">🎯 3 choices today — let's rebuild confidence.</p>
            )}
            {!isDrill && accuracy7d >= 0.85 && (
              <p className="muted small center">🧠 Trickier spellings today — you've earned it.</p>
            )}
            <div className="row" style={{ flexDirection: "column", alignItems: "stretch" }}>
              {options.map((opt) => {
                const isCorrect = opt.id === target!.id;
                const cls = !selected ? "ghost" : isCorrect ? "good" : opt.id === selected.id ? "bad" : "ghost";
                return (
                  <button key={opt.id} className={cls + " big"} disabled={!!selected} onClick={() => selectOption(opt)}>
                    {opt.de}
                  </button>
                );
              })}
            </div>

            {selected && (
              <div className="center">
                <div className={"feedback-banner " + (selected.id === target!.id ? "ok" : "no")}>
                  👴 „{line[0]}“ {selected.id === target!.id ? "✓" : `— richtig: „${target!.de}“`}
                </div>
                <p style={{ margin: "6px 0" }}>
                  {target!.emoji && <span style={{ fontSize: 30, marginRight: 8 }}>{target!.emoji}</span>}
                  <span className="muted">{target!.en}</span>
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
