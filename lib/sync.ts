// Progress sync: the whole "sl:*" localStorage state is stored per user as
// one jsonb row (table user_state, see supabase/schema.sql). For a handful
// of users this is simple, robust, and plenty fast.
//
// Strategy: on sign-in, if this device has no profile yet, pull the cloud
// copy; otherwise push. Afterwards every activity schedules a debounced push.
// The API key for the coach (sl:coach:key) never leaves the device.

import { getSupabase } from "./supabase";

const EXCLUDE = new Set(["sl:coach:key", "sl:sync:user"]);

/** Wipe learner progress on this device (keeps device-only secrets). */
export function clearProgress(): void {
  if (typeof window === "undefined") return;
  const doomed: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (key && key.startsWith("sl:") && !EXCLUDE.has(key)) doomed.push(key);
  }
  doomed.forEach((k) => window.localStorage.removeItem(k));
}

export function collectState(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (typeof window === "undefined") return out;
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key || !key.startsWith("sl:") || EXCLUDE.has(key)) continue;
    try {
      out[key] = JSON.parse(window.localStorage.getItem(key) ?? "null");
    } catch {
      // skip unparsable entries
    }
  }
  return out;
}

export function applyState(state: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  for (const [key, value] of Object.entries(state)) {
    if (!key.startsWith("sl:") || EXCLUDE.has(key)) continue;
    window.localStorage.setItem(key, JSON.stringify(value));
  }
  window.dispatchEvent(new CustomEvent("sl:coins"));
}

export async function pushState(): Promise<boolean> {
  try {
    const sb = getSupabase();
    if (!sb) return false;
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return false;
    const { error } = await sb.from("user_state").upsert({
      user_id: user.id,
      state: collectState(),
      updated_at: new Date().toISOString(),
    });
    if (error) console.warn("Sync push failed:", error.message);
    return !error;
  } catch (e) {
    console.warn("Sync push failed:", e);
    return false;
  }
}

export async function pullState(): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return false;
  const { data } = await sb.from("user_state").select("state").eq("user_id", user.id).maybeSingle();
  if (!data?.state) return false;
  applyState(data.state as Record<string, unknown>);
  return true;
}

/** After sign-in: fresh device pulls the cloud copy, established device pushes. */
export async function smartSync(): Promise<void> {
  const sb = getSupabase();
  if (!sb || typeof window === "undefined") return;
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;

  // Different account than last time on this device? Never mix progress:
  // wipe local, load THIS account's cloud copy (or start fresh).
  const lastUser = window.localStorage.getItem("sl:sync:user");
  window.localStorage.setItem("sl:sync:user", user.id);
  if (lastUser && lastUser !== user.id) {
    clearProgress();
    await pullState();
    window.dispatchEvent(new CustomEvent("sl:coins"));
    return;
  }

  const hasLocalProfile = !!window.localStorage.getItem("sl:profile");
  if (!hasLocalProfile) {
    const pulled = await pullState();
    if (pulled) return;
  }
  await pushState();
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;

export function schedulePush(): void {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void pushState().catch(() => {});
  }, 5000);
}
