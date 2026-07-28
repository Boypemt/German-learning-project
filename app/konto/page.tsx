"use client";

// Account: magic-link sign-in, sync status, manual sync controls.

import { useEffect, useState } from "react";
import { getSupabase, isCloudConfigured } from "@/lib/supabase";
import { pushState, pullState } from "@/lib/sync";
import { OpaSays } from "@/components/Opa";

export default function KontoPage() {
  const [email, setEmail] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    sb.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null));
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      setUserEmail(session?.user?.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!isCloudConfigured()) {
    return (
      <>
        <h1>Konto</h1>
        <OpaSays
          de="Die Cloud ist noch nicht angeschlossen, mein Kind."
          en="The cloud isn't connected yet."
          mood="think"
        />
        <div className="card">
          <p style={{ marginTop: 0 }}>
            This build runs in <strong>local-only mode</strong> — progress stays in this browser.
            To enable accounts and cross-device sync, set{" "}
            <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>{" "}
            (see <code>docs/deploy.md</code>).
          </p>
        </div>
      </>
    );
  }

  async function sendLink() {
    const sb = getSupabase()!;
    setBusy(true);
    setMsg("");
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    setMsg(error ? `Error: ${error.message}` : "✉️ Check your inbox — the sign-in link is on its way!");
  }

  async function doPush() {
    setBusy(true);
    await pushState();
    setBusy(false);
    setMsg("☁️ Progress saved to the cloud.");
  }

  async function doPull() {
    if (!confirm("Replace the progress on THIS device with your cloud copy?")) return;
    setBusy(true);
    const ok = await pullState();
    setBusy(false);
    setMsg(ok ? "⬇️ Cloud progress loaded — reloading…" : "No cloud copy found yet.");
    if (ok) setTimeout(() => window.location.reload(), 800);
  }

  async function signOut() {
    await getSupabase()!.auth.signOut();
    setMsg("Signed out. Your progress stays on this device.");
  }

  return (
    <>
      <h1>Konto</h1>

      {!userEmail ? (
        <>
          <OpaSays
            de="Sag mir deine E-Mail, dann merke ich mir deinen Fortschritt — auf jedem Gerät."
            en="Give me your email and I'll remember your progress — on every device."
          />
          <div className="card">
            <div className="row left">
              <input
                type="text"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendLink()}
                style={{ maxWidth: 320 }}
              />
              <button className="primary" onClick={sendLink} disabled={busy || !email.includes("@")}>
                {busy ? "Sending…" : "✉️ Send magic link"}
              </button>
            </div>
            <p className="muted small" style={{ marginBottom: 0 }}>
              No password — you get an email with a sign-in link. First sign-in creates your account.
            </p>
          </div>
        </>
      ) : (
        <>
          <OpaSays
            de={`Schön, dass du da bist! Dein Fortschritt wird automatisch gesichert.`}
            en="Your progress is backed up automatically after every session."
            mood="happy"
          />
          <div className="card">
            <p style={{ marginTop: 0 }}>
              Signed in as <strong>{userEmail}</strong> · syncs automatically a few seconds after each activity.
            </p>
            <div className="row left">
              <button className="good" onClick={doPush} disabled={busy}>☁️ Sync now</button>
              <button className="ghost" onClick={doPull} disabled={busy}>⬇️ Load cloud copy</button>
              <button className="ghost" onClick={signOut}>Sign out</button>
            </div>
            <p className="muted small" style={{ marginBottom: 0 }}>
              &quot;Load cloud copy&quot; is for a new device: it replaces this browser&apos;s progress with your cloud save.
              Your coach API key never leaves this device.
            </p>
          </div>
        </>
      )}

      {msg && <div className="card"><p style={{ margin: 0 }}>{msg}</p></div>}
    </>
  );
}
