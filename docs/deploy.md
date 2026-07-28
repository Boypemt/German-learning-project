# Deploy: Vercel + Supabase (free tier, ~10 users)

Total cost: €0. Time: ~20 minutes.

## 1. Supabase (accounts + progress sync)

1. Create a project at [supabase.com](https://supabase.com) (free tier — fine for 10 users; note: free projects pause after 7 days without traffic, they resume automatically on next visit).
2. **SQL Editor** → paste the contents of `supabase/schema.sql` → Run. This creates the `user_state` table with row-level security (each user can only touch their own row).
3. **Authentication → Sign In / Up**: make sure **Email** is enabled (magic link works out of the box).
4. **Project Settings → API**: copy the **Project URL** and the **anon public** key.

## 2. GitHub

```bash
git init                        # if not done yet
git add .
git commit -m "Bei Opa: ready for deploy"
# create an empty repo on github.com, then:
git remote add origin https://github.com/<you>/bei-opa.git
git push -u origin main
```

`.env.local` is gitignored — never commit keys (the anon key is public by design, but keep the habit).

## 3. Vercel

1. [vercel.com](https://vercel.com) → **Add New → Project** → import the GitHub repo. Framework is auto-detected (Next.js), no build settings needed.
2. Before deploying, add **Environment Variables**:
   - `NEXT_PUBLIC_SUPABASE_URL` = your project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your anon key
3. Deploy. You get `https://<project>.vercel.app`.

## 4. Connect the two

Back in Supabase: **Authentication → URL Configuration**:
- **Site URL**: `https://<project>.vercel.app`
- **Redirect URLs**: add `https://<project>.vercel.app` (and `http://localhost:3000` for local dev).

Without this, magic-link emails redirect to the wrong place.

## 5. Invite your ~10 users

Just send them the URL. They open **Konto** → enter email → click the link in their inbox → done. Their progress syncs automatically after every activity; on a new device, **Konto → Load cloud copy** restores it.

Free-tier email limits: Supabase's built-in mailer allows only a few auth emails per hour — fine for 10 users trickling in, but tell people the link can take a minute. (If it ever matters, plug in a free Resend/Brevo SMTP in Supabase → Auth → SMTP.)

## How sync works (for future development)

- All progress lives in `localStorage` (`sl:*` keys) — the app is fully usable logged out or offline.
- `lib/sync.ts` pushes the whole state as one `jsonb` row a few seconds after each activity (`sl:coins` event), and pulls on first sign-in on a fresh device. Last write wins — fine for a single learner on 1–2 devices.
- The coach API key (`sl:coach:key`) is deliberately never synced.
- Scaling beyond ~100 users or real-time multi-device: split `user_state` into proper tables (cards, activity) — see `docs/roadmap.md` Phase 4.

## Checklist before going live

- [ ] `npm run build` green locally
- [ ] Photos reviewed (`public/img/vocab/`)
- [ ] `supabase/schema.sql` executed
- [ ] Env vars set on Vercel
- [ ] Site URL + redirect URLs configured in Supabase
- [ ] Magic link tested with your own email
- [ ] Second device test: sign in → Load cloud copy → streak intact
