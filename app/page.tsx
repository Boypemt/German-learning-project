"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import vocab from "@/data/de/vocab-a1.json";
import { stats, type VocabItem } from "@/lib/srs";
import { getStreak, getTodayCount } from "@/lib/storage";

const deck = vocab as VocabItem[];

export default function Dashboard() {
  const [s, setS] = useState({ total: deck.length, seen: 0, dueNow: 0 });
  const [streak, setStreak] = useState(0);
  const [today, setToday] = useState(0);

  useEffect(() => {
    setS(stats("de", deck));
    setStreak(getStreak());
    setToday(getTodayCount());
  }, []);

  return (
    <>
      <h1>Guten Tag! 🇩🇪</h1>
      <p className="muted">Goal: C1 German. Consistency beats intensity — clear your due cards, then do one block of each skill.</p>

      <div className="grid">
        <div className="card stat"><div className="num">{s.dueNow}</div>cards due</div>
        <div className="card stat"><div className="num">{streak}</div>day streak</div>
        <div className="card stat"><div className="num">{today}</div>reviews today</div>
        <div className="card stat"><div className="num">{s.seen}/{s.total}</div>words started</div>
      </div>

      <h2>Today&apos;s routine (~60 min)</h2>
      <div className="card">
        <p><Link href="/vocab"><strong>1. Vocab (15–20 min)</strong></Link> — clear due cards, learn new words</p>
        <p><Link href="/listening"><strong>2. Listening (15 min)</strong></Link> — dictation drills</p>
        <p><Link href="/grammar"><strong>3. Grammar (10 min)</strong></Link> — one topic + exercises</p>
        <p><Link href="/speaking"><strong>4. Speaking (10 min)</strong></Link> — pronunciation practice</p>
        <p><Link href="/writing"><strong>5. Writing (10 min)</strong></Link> — one prompt</p>
      </div>

      <p className="muted small">
        Then free immersion: Nicos Weg, Easy German, podcasts, Netflix auf Deutsch.
        See <code>docs/learning-method.md</code> for the full plan to C1.
      </p>
    </>
  );
}
