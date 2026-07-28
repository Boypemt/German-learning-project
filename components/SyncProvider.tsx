"use client";

// Invisible: wires auth events + activity events to the sync engine.

import { useEffect } from "react";
import { getSupabase } from "@/lib/supabase";
import { smartSync, schedulePush } from "@/lib/sync";

export default function SyncProvider() {
  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    void smartSync(); // covers "already signed in" on page load
    const { data: sub } = sb.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") void smartSync();
    });
    const onActivity = () => schedulePush();
    window.addEventListener("sl:coins", onActivity);
    return () => {
      sub.subscription.unsubscribe();
      window.removeEventListener("sl:coins", onActivity);
    };
  }, []);
  return null;
}
