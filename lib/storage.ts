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

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function recordActivity(count = 1): void {
  const a = load<Activity>("activity", {});
  a[todayKey()] = (a[todayKey()] ?? 0) + count;
  save("activity", a);
}

export function getStreak(): number {
  const a = load<Activity>("activity", {});
  let streak = 0;
  const d = new Date();
  // today counts if active; otherwise start from yesterday
  if (!a[d.toISOString().slice(0, 10)]) d.setDate(d.getDate() - 1);
  while (a[d.toISOString().slice(0, 10)]) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

export function getTodayCount(): number {
  return load<Activity>("activity", {})[todayKey()] ?? 0;
}
