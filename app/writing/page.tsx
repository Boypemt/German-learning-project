"use client";

import { useEffect, useState } from "react";
import promptsData from "@/data/de/writing-prompts.json";
import { load, save, recordActivity } from "@/lib/storage";

interface Prompt { id: string; level: string; prompt: string; promptEn: string; }
const prompts = promptsData as Prompt[];

type Drafts = Record<string, string>;

export default function WritingPage() {
  const [idx, setIdx] = useState(0);
  const [drafts, setDrafts] = useState<Drafts>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDrafts(load<Drafts>("writing:drafts", {}));
    // start at the day-of-year prompt so it rotates daily
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    setIdx(dayOfYear % prompts.length);
  }, []);

  const p = prompts[idx];
  const text = drafts[p.id] ?? "";
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  function update(v: string) {
    setDrafts((d) => ({ ...d, [p.id]: v }));
    setSaved(false);
  }

  function saveDraft() {
    save("writing:drafts", drafts);
    if (words >= 20) recordActivity();
    setSaved(true);
  }

  function copyForReview() {
    const msg = `Please correct my German text (level ${p.level}). Explain each mistake briefly.\n\nPrompt: ${p.prompt}\n\nMy text:\n${text}`;
    navigator.clipboard?.writeText(msg);
  }

  return (
    <>
      <h1>Writing</h1>
      <p className="muted small">Write daily, even a few sentences. Aim: A-levels 30–60 words, B-levels 100–200.</p>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <strong>{p.prompt}</strong>
          <span className="badge">{p.level}</span>
        </div>
        <p className="muted small">{p.promptEn}</p>
        <textarea
          value={text}
          onChange={(e) => update(e.target.value)}
          placeholder="Schreib hier…"
        />
        <div className="row left" style={{ alignItems: "center" }}>
          <button className="primary" onClick={saveDraft}>Save draft</button>
          <button onClick={copyForReview} disabled={!text}>Copy for AI review</button>
          <button className="ghost" onClick={() => setIdx((idx + 1) % prompts.length)}>Next prompt →</button>
          <span className="muted small">{words} words {saved && "· saved ✓"}</span>
        </div>
        <p className="muted small">
          &quot;Copy for AI review&quot; puts your text + correction instructions on the clipboard — paste it to Claude for feedback.
        </p>
      </div>
    </>
  );
}
