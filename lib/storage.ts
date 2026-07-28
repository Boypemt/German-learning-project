// localStorage helpers. All keys prefixed "sl:" (SprachLern).
// Progress only — deck content is static JSON in /data.

export function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem("sl:" + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function save<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem("sl:" + key, JSON.stringify(value));
  } catch {
    // storage full or blocked — ignore
  }
}

// ---- daily activity / streak ----

export type Activity = Record<string, number>; // "2026-07-14" -> review count

/** Local-timezone date key (YYYY-MM-DD) — the learner's day, not UTC's. */
export function dateKey(d: Date = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function todayKey(): string {
  return dateKey();
}

export function recordActivity(skill = "other", count = 1): void {
  const a = load<Activity>("activity", {});
  a[todayKey()] = (a[todayKey()] ?? 0) + count;
  save("activity", a);
  // per-skill counts — used by the daily plan checklist
  const sk = load<Record<string, Record<string, number>>>("activity:skills", {});
  const day = (sk[todayKey()] = sk[todayKey()] ?? {});
  day[skill] = (day[skill] ?? 0) + count;
  save("activity:skills", sk);
  // notify listeners (e.g. the coin counter in the nav)
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("sl:coins"));
}

export function getTodaySkillCounts(): Record<string, number> {
  return load<Record<string, Record<string, number>>>("activity:skills", {})[todayKey()] ?? {};
}

export function getWeekSkillCounts(): Record<string, number> {
  const sk = load<Record<string, Record<string, number>>>("activity:skills", {});
  const out: Record<string, number> = {};
  const d = new Date();
  for (let i = 0; i < 7; i++) {
    for (const [skill, n] of Object.entries(sk[dateKey(d)] ?? {})) out[skill] = (out[skill] ?? 0) + n;
    d.setDate(d.getDate() - 1);
  }
  return out;
}

export function getStreak(): number {
  const a = load<Activity>("activity", {});
  let streak = 0;
  const d = new Date();
  // today counts if active; otherwise start from yesterday
  if (!a[dateKey(d)]) d.setDate(d.getDate() - 1);
  while (a[dateKey(d)]) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

export function getTodayCount(): number {
  return load<Activity>("activity", {})[todayKey()] ?? 0;
}
