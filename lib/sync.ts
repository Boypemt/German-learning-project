// Progress sync: the whole "sl:*" localStorage state is stored per user as
// one jsonb row (table user_state, see supabase/schema.sql). For a handful
// of users this is simple, robust, and plenty fast.
//
// Strategy: on sign-in, if this device has no profile yet, pull the cloud
// copy; otherwise push. Afterwards every activity schedules a debounced push.
// The API key for the coach (sl:coach:key) never leaves the device.

import { getSupabase } from "./supabase";

const EXCLUDE = new Set(["sl:coach:key"]);

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

export async function pushState(): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;
  await sb.from("user_state").upsert({
    user_id: user.id,
    state: collectState(),
    updated_at: new Date().toISOString(),
  });
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
    void pushState();
  }, 5000);
}
