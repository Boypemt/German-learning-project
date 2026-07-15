"use client";

import { useEffect, useRef, useState } from "react";
import promptsData from "@/data/de/writing-prompts.json";
import { load, save, recordActivity } from "@/lib/storage";
import { OpaSays } from "@/components/Opa";
import Say from "@/components/Say";
import Umlauts from "@/components/Umlauts";

interface Prompt { id: string; level: string; prompt: string; promptEn: string; }
const prompts = promptsData as Prompt[];

type Drafts = Record<string, string>;

const TARGETS: Record<string, number> = { A1: 40, A2: 60, B1: 120, B2: 180 };

export default function WritingPage() {
  const [idx, setIdx] = useState(0);
  const [drafts, setDrafts] = useState<Drafts>({});
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setDrafts(load<Drafts>("writing:drafts", {}));
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    setIdx(dayOfYear % prompts.length);
  }, []);

  const p = prompts[idx];
  const text = drafts[p.id] ?? "";
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const target = TARGETS[p.level] ?? 60;
  const pct = Math.min(100, Math.round((words / target) * 100));

  function update(v: string) {
    setDrafts((d) => ({ ...d, [p.id]: v }));
    setSaved(false);
    setCopied(false);
  }

  function saveDraft() {
    save("writing:drafts", drafts);
    if (words >= 20) recordActivity("writing");
    setSaved(true);
  }

  function copyForReview() {
    const msg = `Please correct my German text (level ${p.level}). For each mistake: quote it, give the correction, and explain the rule in one short line. Then rate the text A1–C1.\n\nPrompt: ${p.prompt}\n\nMy text:\n${text}`;
    navigator.clipboard?.writeText(msg);
    setCopied(true);
  }

  return (
    <>
      <h1>Writing</h1>
      <OpaSays
        de="Schreib mir ein paar Zeilen — Fehler sind erlaubt, Schweigen nicht!"
        en="Write me a few lines — mistakes are allowed, silence isn't!"
        size={72}
      />


      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
          <div>
            <Say text={p.prompt}><strong style={{ fontSize: 16 }}>{p.prompt}</strong></Say>
            <p className="muted small" style={{ margin: "4px 0 0" }}>{p.promptEn}</p>
          </div>
          <span className="badge gold">{p.level}</span>
        </div>

        <textarea
          ref={taRef}
          value={text}
          onChange={(e) => update(e.target.value)}
          placeholder="Schreib hier… (der Mut zählt, nicht die Perfektion)"
          style={{ marginTop: 14 }}
        />
        <Umlauts targetRef={taRef} value={text} onChange={update} />

        <div className="progressbar" style={{ marginTop: 12 }}>
          <div style={{ width: `${pct}%` }} />
        </div>
        <p className="muted small" style={{ margin: "2px 0 10px" }}>
          {words}/{target} words {pct >= 100 && <span className="correct">— target hit! ✓</span>}
        </p>

        <div className="row left">
          <button className="primary" onClick={saveDraft}>{saved ? "Saved ✓" : "Save draft"}</button>
          <button className="blue" onClick={copyForReview} disabled={!text}>
            {copied ? "Copied ✓ — paste to Claude" : "🤖 Copy for AI review"}
          </button>
          <button className="ghost" onClick={() => setIdx((idx + 1) % prompts.length)}>Next prompt →</button>
        </div>
        <p className="muted small" style={{ marginBottom: 0 }}>
          &quot;Copy for AI review&quot; puts your text + correction instructions on the clipboard — paste into any Claude chat for free feedback.
        </p>
      </div>
    </>
  );
}
