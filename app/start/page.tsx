"use client";

// Onboarding: Opa interviews the learner, builds their profile,
// and generates a personal daily plan. Re-run any time from /coach.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { OpaSays } from "@/components/Opa";
import { saveProfile, generatePlan, type Level, type Goal, type SkillId, type Profile } from "@/lib/profile";

const LEVELS: { v: Level; label: string; sub: string }[] = [
  { v: "A0", label: "Ganz neu 🌱", sub: "Complete beginner — first contact with German" },
  { v: "A1", label: "Ein bisschen", sub: "I know some words and phrases (A1)" },
  { v: "A2", label: "Grundlagen", sub: "Simple sentences and everyday topics (A2)" },
  { v: "B1", label: "Unterhaltung", sub: "I can hold basic conversations (B1)" },
  { v: "B2", label: "Sicher", sub: "Comfortable in most situations (B2)" },
  { v: "C1", label: "Fortgeschritten", sub: "Advanced — aiming for mastery (C1)" },
];

const GOALS: { v: Goal; why: string; label: string; sub: string }[] = [
  { v: "B2", why: "life", label: "Alltag & Reisen (B2)", sub: "Everyday life, travel, friends" },
  { v: "C1", why: "work", label: "Arbeiten in Deutschland (C1)", sub: "Professional working proficiency" },
  { v: "C1", why: "study", label: "Studium (C1)", sub: "University — TestDaF / DSH" },
  { v: "C2", why: "mastery", label: "Meisterschaft (C2)", sub: "Near-native mastery — the whole mountain" },
];

const TIMES: { v: 15 | 30 | 60; label: string; sub: string }[] = [
  { v: 15, label: "15 min", sub: "Short but every day" },
  { v: 30, label: "30 min", sub: "The sweet spot" },
  { v: 60, label: "60+ min", sub: "Serious progress" },
];

const FOCUS: { v: SkillId; label: string }[] = [
  { v: "speaking", label: "🎙️ Speaking & pronunciation" },
  { v: "listening", label: "🎧 Understanding people" },
  { v: "writing", label: "✍️ Writing" },
  { v: "grammar", label: "🧩 Grammar" },
  { v: "vocab", label: "🃏 Vocabulary" },
];

export default function StartPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [level, setLevel] = useState<Level | null>(null);
  const [goal, setGoal] = useState<{ v: Goal; why: string } | null>(null);
  const [minutes, setMinutes] = useState<15 | 30 | 60 | null>(null);
  const [focus, setFocus] = useState<SkillId[]>([]);

  function toggleFocus(s: SkillId) {
    setFocus((f) => (f.includes(s) ? f.filter((x) => x !== s) : f.length < 3 ? [...f, s] : f));
  }

  function finish() {
    const profile: Profile = {
      level: level!,
      goal: goal!.v,
      goalWhy: goal!.why,
      minutes: minutes!,
      focus,
      createdAt: new Date().toISOString(),
    };
    saveProfile(profile);
    router.push("/");
  }

  const OPA: [string, string][] = [
    ["Willkommen! Erzähl mal — wie viel Deutsch kannst du schon?", "Welcome! Tell me — how much German do you already know?"],
    ["Und wohin soll die Reise gehen?", "And where should the journey take you?"],
    ["Wie viel Zeit hast du am Tag für mich?", "How much time do you have for me each day?"],
    ["Was ist dir am wichtigsten? (Wähl bis zu drei)", "What matters most to you? (Pick up to three)"],
    ["Gut. Dann machen wir das so:", "Good. Then here's how we'll do it:"],
  ];

  const preview = step === 4 && level && goal && minutes
    ? generatePlan({ level, goal: goal.v, goalWhy: goal.why, minutes, focus, createdAt: "" })
    : [];

  return (
    <>
      <h1>Dein Plan mit Opa</h1>
      <div className="progressbar gold"><div style={{ width: `${(step / 4) * 100}%` }} /></div>

      <OpaSays de={OPA[step][0]} en={OPA[step][1]} mood={step === 4 ? "cheer" : "happy"} size={84} />

      {step === 0 && (
        <div className="card">
          {LEVELS.map((l) => (
            <button
              key={l.v}
              className={level === l.v ? "primary big" : "ghost big"}
              style={{ marginBottom: 8, textAlign: "left" }}
              onClick={() => { setLevel(l.v); setStep(1); }}
            >
              {l.label} <span className="small" style={{ fontWeight: 400, opacity: 0.75 }}> — {l.sub}</span>
            </button>
          ))}
        </div>
      )}

      {step === 1 && (
        <div className="card">
          {GOALS.map((g) => (
            <button
              key={g.why}
              className="ghost big"
              style={{ marginBottom: 8, textAlign: "left" }}
              onClick={() => { setGoal({ v: g.v, why: g.why }); setStep(2); }}
            >
              {g.label} <span className="small" style={{ fontWeight: 400, opacity: 0.75 }}> — {g.sub}</span>
            </button>
          ))}
        </div>
      )}

      {step === 2 && (
        <div className="card">
          {TIMES.map((t) => (
            <button
              key={t.v}
              className="ghost big"
              style={{ marginBottom: 8, textAlign: "left" }}
              onClick={() => { setMinutes(t.v); setStep(3); }}
            >
              ⏱️ {t.label} <span className="small" style={{ fontWeight: 400, opacity: 0.75 }}> — {t.sub}</span>
            </button>
          ))}
        </div>
      )}

      {step === 3 && (
        <div className="card">
          {FOCUS.map((f) => (
            <button
              key={f.v}
              className={focus.includes(f.v) ? "primary big" : "ghost big"}
              style={{ marginBottom: 8, textAlign: "left" }}
              onClick={() => toggleFocus(f.v)}
            >
              {f.label} {focus.includes(f.v) && "✓"}
            </button>
          ))}
          <div className="row">
            <button className="good big" onClick={() => setStep(4)}>
              {focus.length === 0 ? "Opa entscheidet (skip)" : "Weiter →"}
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="card">
          <p style={{ marginTop: 0 }}>
            <strong>Your daily plan</strong> — about {minutes} minutes, adjusted to your focus.
            Do it in order; the dashboard will always show what&apos;s next.
          </p>
          {preview.map((s, i) => (
            <p key={s.skill} style={{ margin: "6px 0" }}>
              <strong>{i + 1}. {s.icon} {s.label}</strong> <span className="muted small">— {s.sub}</span>
            </p>
          ))}
          <p className="muted small">
            Goal: <strong>{goal?.v}</strong>. Opa&apos;s promise: the plan adapts as you go — and you can
            re-do this interview or ask the AI coach to adjust it any time.
          </p>
          <div className="row">
            <button className="ghost" onClick={() => setStep(0)}>↺ Start over</button>
            <button className="good big" style={{ maxWidth: 300 }} onClick={finish}>Los geht&apos;s! 🚀</button>
          </div>
        </div>
      )}
    </>
  );
}
