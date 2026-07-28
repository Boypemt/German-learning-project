// Supabase client — created lazily from env vars.
// If the env vars are missing (local dev without cloud), the app runs in
// local-only mode: everything works, nothing syncs.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null | undefined;

export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  client = url && key ? createClient(url, key) : null;
  return client;
}

export function isCloudConfigured(): boolean {
  return getSupabase() !== null;
}
