"use client";

// The AI coach: Opa + Claude look at your profile and progress together.
// Free path: copy the coaching prompt into any Claude chat.
// Optional: save your own Anthropic API key for in-app answers.

import { useEffect, useState } from "react";
import Link from "next/link";
import vocab from "@/data/de/vocab-a1.json";
import { loadProfile, LEVEL_LABELS, type Profile } from "@/lib/profile";
import { load, save, getStreak, getWeekSkillCounts } from "@/lib/storage";
import { getTotalReviews } from "@/lib/gamify";
import { stats, type VocabItem } from "@/lib/srs";
import { buildCoachPrompt, askClaude, type CoachData } from "@/lib/ai";
import { OpaSays } from "@/components/Opa";

const deck = vocab as VocabItem[];

export default function CoachPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [data, setData] = useState<CoachData | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [advice, setAdvice] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const p = loadProfile();
    setProfile(p);
    setApiKey(load<string>("coach:key", ""));
    setAdvice(load<string>("coach:advice", ""));
    if (p) {
      const st = stats("de", deck);
      setData({
        profile: p,
        streak: getStreak(),
        totalReviews: getTotalReviews(),
        weekBySkill: getWeekSkillCounts(),
        wordsSeen: st.seen,
        wordsTotal: st.total,
      });
    }
  }, []);

  if (!profile || !data) {
    return (
      <>
        <h1>Coach</h1>
        <div className="card center">
          <p>First tell Opa about yourself.</p>
          <Link href="/start"><button className="primary">Start the interview</button></Link>
        </div>
      </>
    );
  }

  const prompt = buildCoachPrompt(data);

  function copyPrompt() {
    navigator.clipboard?.writeText(prompt);
    setCopied(true);
  }

  async function askInApp() {
    setBusy(true);
    setError("");
    try {
      const text = await askClaude(apiKey, prompt);
      setAdvice(text);
      save("coach:advice", text);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1>Dein Coach</h1>
      <OpaSays
        de="Zeig mal her… Ich schaue mir deinen Fortschritt an, und mein kluger Freund Claude hilft mir."
        en="Let me see… I'll look at your progress, and my clever friend Claude helps me."
        size={80}
      />

      <div className="card">
        <h2 style={{ marginTop: 0 }}>📇 Your profile</h2>
        <p style={{ margin: "6px 0" }}>
          <span className="badge">{LEVEL_LABELS[profile.level]}</span>{" "}
          <span className="badge gold">goal {profile.goal}</span>{" "}
          <span className="badge">{profile.minutes} min/day</span>{" "}
          {profile.focus.map((f) => <span className="badge green" key={f}>{f}</span>)}
        </p>
        <p className="muted small">
          🔥 {data.streak}-day streak · {data.totalReviews} total reviews · {data.wordsSeen}/{data.wordsTotal} words started
        </p>
        <Link href="/start"><button className="ghost">↺ Redo the interview (new plan)</button></Link>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>🤖 Weekly AI check-in</h2>
        <p className="muted small" style={{ marginTop: 0 }}>
          Opa prepares a report about you. Claude reads it and answers as your coach:
          honest assessment, this week&apos;s focus, three adjustments, and a sentence to learn.
        </p>

        <div className="row left">
          <button className="primary" onClick={copyPrompt}>
            {copied ? "Copied ✓ — paste into Claude" : "📋 Copy coach prompt (free)"}
          </button>
        </div>
        <p className="muted small">
          Paste it into the Claude app or claude.ai — works with any free account.
        </p>

        <hr className="divider" />

        <p className="small" style={{ fontWeight: 700, margin: "0 0 6px" }}>Or ask right here (optional)</p>
        <p className="muted small" style={{ marginTop: 0 }}>
          Needs your own Anthropic API key (console.anthropic.com — pay-per-use, a check-in costs well under 1 cent).
          The key is stored only in this browser.
        </p>
        <div className="row left">
          <input
            type="text"
            placeholder="sk-ant-…"
            value={apiKey}
            onChange={(e) => { setApiKey(e.target.value); save("coach:key", e.target.value); }}
            style={{ maxWidth: 320, fontSize: 13, padding: 10 }}
          />
          <button className="blue" onClick={askInApp} disabled={!apiKey || busy}>
            {busy ? "Opa denkt nach…" : "🧓 Ask Opa"}
          </button>
        </div>
        {error && <p className="wrong small">{error}</p>}
      </div>

      {advice && (
        <div className="card culture">
          <h2 style={{ marginTop: 0 }}>🧓 Opas Rat</h2>
          <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.65 }}>{advice}</div>
        </div>
      )}
    </>
  );
}
