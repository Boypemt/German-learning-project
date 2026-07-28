"use client";

// Live plan progress inside every exercise page. When the step's target is
// reached, Opa hands you the next step — no navigating needed.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { loadProfile, generatePlan, type PlanStep, type SkillId } from "@/lib/profile";
import { getTodaySkillCounts } from "@/lib/storage";
import { logEvent } from "@/lib/telemetry";
import { getLearnerModel } from "@/lib/model";

interface BannerState {
  done: boolean;
  count: number;
  target: number;
  next: PlanStep | null;
  inPlan: boolean;
}

export default function NextStepBanner({ skill }: { skill: SkillId }) {
  const [st, setSt] = useState<BannerState | null>(null);
  // Mirrors `st` for the unmount cleanup below — a normal state variable
  // would be stale there, since this effect only re-runs when `skill` changes.
  const latestRef = useRef<BannerState | null>(null);

  useEffect(() => {
    logEvent("step_open", { skill });

    function refresh() {
      const p = loadProfile();
      if (!p) return;
      const plan = generatePlan(p, getLearnerModel(p));
      const counts = getTodaySkillCounts();
      const stepDone = (s: PlanStep) => (counts[s.skill] ?? 0) >= s.target;
      const me = plan.find((s) => s.skill === skill);
      const next = plan.find((s) => !stepDone(s)) ?? null;
      const next_state: BannerState = !me
        ? { done: false, count: 0, target: 0, next, inPlan: false }
        : {
            done: stepDone(me),
            count: Math.min(counts[skill] ?? 0, me.target),
            target: me.target,
            next,
            inPlan: true,
          };
      latestRef.current = next_state;
      setSt(next_state);
    }
    refresh();
    window.addEventListener("sl:coins", refresh);
    return () => {
      window.removeEventListener("sl:coins", refresh);
      const snap = latestRef.current;
      if (snap?.inPlan && !snap.done) {
        logEvent("skip", { skill, done: snap.count, target: snap.target });
      }
    };
  }, [skill]);

  if (!st || !st.inPlan) return null;

  if (!st.done) {
    return (
      <div className="stepbar">
        <span className="muted small">📋 Today&apos;s plan: <strong>{st.count}/{st.target}</strong></span>
        <div className="progressbar" style={{ flex: 1, margin: 0, height: 10 }}>
          <div style={{ width: `${(st.count / st.target) * 100}%` }} />
        </div>
      </div>
    );
  }

  return (
    <div className="stepbar done">
      <span style={{ fontWeight: 700 }}>✅ Geschafft — this step is done!</span>
      {st.next ? (
        <Link href={st.next.href}>
          <button className="good">Weiter: {st.next.icon} {st.next.label} →</button>
        </Link>
      ) : (
        <Link href="/garten">
          <button className="primary">🌻 Alles fertig — ab in den Garten!</button>
        </Link>
      )}
    </div>
  );
}
