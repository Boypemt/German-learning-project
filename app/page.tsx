"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import culture from "@/data/de/culture.json";
import { getVocabDeck } from "@/lib/content";
import { stats } from "@/lib/srs";
import { getStreak, getTodayCount, getTodaySkillCounts } from "@/lib/storage";
import { getXp, getLevel } from "@/lib/gamify";
import { getBalance, getOwned, ITEMS } from "@/lib/garden";
import { loadProfile, generatePlan, type Profile, type PlanStep } from "@/lib/profile";
import { OpaSays } from "@/components/Opa";
import Say from "@/components/Say";
import { speak } from "@/lib/speech";

interface CultureNote { id: string; emoji: string; title: string; text: string; phrase: string; phraseEn: string; }
const notes = culture as CultureNote[];

const GREETINGS: [string, string][] = [
  ["Na, mein Kind! Bereit für ein bisschen Deutsch?", "Well, my child! Ready for a bit of German?"],
  ["Schön, dass du da bist! Setz dich, wir üben.", "Lovely that you're here! Sit down, let's practice."],
  ["Jeden Tag ein bisschen — so habe ich es auch gelernt.", "A little every day — that's how I learned too."],
  ["Erst die Arbeit, dann der Kuchen!", "First the work, then the cake!"],
  ["Komm rein, der Kaffee ist fertig!", "Come in, the coffee is ready!"],
];

function dayIndex(): number {
  return Math.floor(Date.now() / 86400000);
}

export default function Dashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [plan, setPlan] = useState<PlanStep[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [s, setS] = useState({ total: 0, seen: 0, dueNow: 0 });
  const [streak, setStreak] = useState(0);
  const [today, setToday] = useState(0);
  const [xp, setXp] = useState(0);
  const [lvl, setLvl] = useState({ level: 1, intoLevel: 0, pct: 0 });
  const [coins, setCoins] = useState(0);
  const [gardenCount, setGardenCount] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const p = loadProfile();
    if (!p) {
      router.replace("/start");
      return;
    }
    setProfile(p);
    setPlan(generatePlan(p));
    setCounts(getTodaySkillCounts());
    setS(stats("de", getVocabDeck(p.level)));
    setStreak(getStreak());
    setToday(getTodayCount());
    setXp(getXp());
    setLvl(getLevel());
    setCoins(getBalance());
    setGardenCount(getOwned().length);
    setReady(true);
  }, [router]);

  if (!ready || !profile) return <p className="muted">Loading…</p>;

  const stepDone = (st: PlanStep) => (counts[st.skill] ?? 0) >= st.target;
  const nextStep = plan.find((st) => !stepDone(st));
  const doneCount = plan.filter(stepDone).length;
  const allDone = !nextStep;
  const greeting = GREETINGS[dayIndex() % GREETINGS.length];
  const note = notes[dayIndex() % notes.length];

  return (
    <>
      <OpaSays
        de={allDone ? "Alles geschafft! Ich bin stolz auf dich. 👏" : greeting[0]}
        en={allDone ? "All done! I'm proud of you." : greeting[1]}
        mood={allDone ? "cheer" : "happy"}
        size={92}
      />

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <strong style={{ fontSize: 16 }}>📋 Dein Plan heute ({profile.minutes} min · goal {profile.goal})</strong>
          <span className="muted small">{doneCount}/{plan.length} done</span>
        </div>
        <div className="progressbar"><div style={{ width: `${(doneCount / plan.length) * 100}%` }} /></div>

        {plan.map((st, i) => {
          const done = stepDone(st);
          const isNext = nextStep?.skill === st.skill;
          return (
            <Link href={st.href} key={st.skill}>
              <div
                className="plan-step"
                style={{
                  opacity: done ? 0.55 : 1,
                  borderColor: isNext ? "var(--gold)" : undefined,
                  background: isNext ? "#fdf6e0" : undefined,
                }}
              >
                <span className="p-check">{done ? "✅" : isNext ? "👉" : "⬜"}</span>
                <span className="p-body">
                  <strong>{i + 1}. {st.icon} {st.label}</strong>
                  <span className="muted small"> — {st.sub}</span>
                </span>
                <span className="muted small">{Math.min(counts[st.skill] ?? 0, st.target)}/{st.target}</span>
              </div>
            </Link>
          );
        })}

        {nextStep ? (
          <Link href={nextStep.href}>
            <button className="good big" style={{ marginTop: 10 }}>
              ▶ Jetzt: {nextStep.icon} {nextStep.label}
            </button>
          </Link>
        ) : (
          <Link href="/garten">
            <button className="primary big" style={{ marginTop: 10 }}>
              🌻 Fertig für heute — ab in den Garten!
            </button>
          </Link>
        )}
        <p className="muted small center" style={{ margin: "8px 0 0" }}>
          Plan doesn&apos;t fit? <Link href="/coach" style={{ textDecoration: "underline" }}>Ask the coach</Link> or{" "}
          <Link href="/start" style={{ textDecoration: "underline" }}>redo the interview</Link>.
        </p>
      </div>

      <div className="grid">
        <div className="card stat">
          <span className="flame" style={{ fontSize: 26 }}>🔥</span>
          <div className="num">{streak}</div>
          <div className="lbl">day streak</div>
        </div>
        <div className="card stat">
          <div className="num" style={{ color: "var(--blue-dark)" }}>{today}</div>
          <div className="lbl">reviews today</div>
        </div>
        <div className="card stat">
          <div className="num" style={{ color: "var(--purple)" }}>Lv {lvl.level}</div>
          <div className="lbl">{xp} XP</div>
        </div>
        <Link href="/garten">
          <div className="card stat" style={{ cursor: "pointer" }}>
            <div className="num" style={{ color: "#9c6f00" }}>🪙{coins}</div>
            <div className="lbl">Taler · garden {gardenCount}/{ITEMS.length}</div>
          </div>
        </Link>
      </div>

      <h2>🧓 Opas Kulturecke — today&apos;s Germany</h2>
      <div className="card culture">
        <div className="k-title">{note.emoji} {note.title}</div>
        <p style={{ margin: "8px 0" }}>{note.text}</p>
        <div className="row left" style={{ alignItems: "center", margin: "8px 0 0" }}>
          <button className="ghost" onClick={() => speak(note.phrase)}>🔊</button>
          <span>
            <Say text={note.phrase}><strong>„{note.phrase}“</strong></Say>
            <span className="muted small"> — {note.phraseEn}</span>
          </span>
        </div>
      </div>

      <p className="muted small center" style={{ marginTop: 22 }}>
        {s.dueNow > 0 && <>🃏 {s.dueNow} cards waiting · </>}
        Extra immersion: <a href="https://learngerman.dw.com/en/nicos-weg/c-36519789" target="_blank" style={{ textDecoration: "underline" }}>Nicos Weg</a> ·{" "}
        <a href="https://www.youtube.com/@EasyGerman" target="_blank" style={{ textDecoration: "underline" }}>Easy German</a>
      </p>
    </>
  );
}
