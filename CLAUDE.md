# CLAUDE.md — project context

Personal German-learning platform (learner picks a target level, up to C2). Free/open-source everything, deploys on Vercel, single user for now, multi-language-ready. Owner continues development with Claude Code.

**Personalization:** onboarding interview at `/start` builds a learner profile (`lib/profile.ts`, key `sl:profile`) — level, goal (B1–C2), minutes/day, focus skills. `generatePlan()` produces the ordered daily checklist shown on the dashboard; per-skill progress comes from `recordActivity(skill)` (`sl:activity:skills`). `/coach` builds an AI coaching prompt from profile+stats (`lib/ai.ts`) — free copy-paste to Claude, or in-app via user's own API key (`sl:coach:key`, browser-only). Don't hardcode any target level in UI copy; read it from the profile.

## Read first

- `docs/architecture.md` — stack, folder layout, data model
- `docs/roadmap.md` — what to build next (Phase 2: content import scripts)
- `docs/resources.md` — approved data sources and their licenses

## Brand & theme

App is called **"Bei Opa"** — mascot is Opa, a warm German grandfather (SVG in `components/Opa.tsx`, with `OpaSays` speech bubble + `praise()`/`encourage()` German lines). Light warm "cream paper" palette in `app/globals.css` — keep it light and readable, no dark theme. Culture notes live in `data/de/culture.json` (Opas Kulturecke on the dashboard). New features should keep this voice: warm, German-first with English subtitles, culture woven in.

**Game layer:** reviews earn Taler (3/review, derived from the activity log — never stored separately). `lib/garden.ts` defines shop items for Opas Schrebergarten (`app/garten/page.tsx`); owned items live in `sl:garden:owned`. The `sl:coins` window event refreshes the nav coin chip. New game features should extend the garden (more items, seasons, garden levels), not add a parallel currency.

## Stack & conventions

- Next.js 14 App Router, TypeScript, plain CSS in `app/globals.css` (no Tailwind).
- All pages are client components (`"use client"`) — progress lives in localStorage, no server state.
- SRS: `ts-fsrs` package, wrapped in `lib/srs.ts`. Never implement scheduling by hand.
- Speech: `lib/speech.ts` wraps Web Speech API. Recognition requires Chrome/Edge; always feature-detect. Never chain speech with `setTimeout` — use `speak()`/`speakSeq()` from `lib/speech.ts` (`speakSeq` for multi-part audio); both cancel/token-guard properly so a new tap can't overlap a pending one.
- Content: static JSON under `data/de/`. Progress: localStorage first (keys prefixed `sl:`, see `lib/storage.ts`).
- Cloud (optional): Supabase auth (magic link) + whole-state jsonb sync in `lib/sync.ts`/`lib/supabase.ts`; table `user_state` with RLS (`supabase/schema.sql`); account UI at `/konto`. App must always keep working without env vars (local-only mode). Never sync `sl:coach:key`.
- Keep German content out of logic — everything language-specific belongs in `data/<lang>/`.
- **Telemetry:** always log behavioral events via `logEvent()` in `lib/telemetry.ts` — never write ad-hoc analytics elsewhere. Events ring-buffer into `sl:events` (capped at ~800); every write also updates the per-day/per-skill `sl:rollups` aggregate, so accuracy history survives ring-buffer trimming. `lib/model.ts`'s `buildLearnerModel()` is the pure consumer of rollups+events+FSRS+profile (`getLearnerModel()` is the impure assembler) — it feeds both "Opas Zeugnis" on `/coach` and the AI coach prompt. Adding a new signal means: add the event type + payload to `lib/telemetry.ts`, log it at the point of interaction, then read it in `lib/model.ts` — don't invent a second event log.
- **Adaptation:** all rule-based adaptation (plan target adjustments, level-up/down suggestions, adaptive listening/vocab/speaking difficulty, the confusion drill) lives in `lib/adapt.ts` — `computeAdaptation()` is the pure core (unit-test every rule with a synthetic `LearnerModel`), `getAdaptation()` is the impure day-cached wrapper (`sl:adapt`, recomputed once per calendar day so targets don't reshuffle on every reload). `generatePlan(profile, model?)` in `lib/profile.ts` applies it when a model is passed; omit `model` for the plain unadapted plan (that's what `lib/model.ts` itself uses internally, to avoid a plan-needs-model-needs-plan cycle). Every rule must stay deterministic (no randomness in the *decision*, only in shuffled display order) and every adaptation that changes what the learner sees must come with a human-readable note or banner — Opa announces what changed and why, never a silent adjustment.

## Commands

```bash
npm run dev      # local dev
npm run build    # must pass before pushing (Vercel runs this)
npm run lint
npm test         # vitest — pure logic + data/de/*.json validation
npm run test:e2e # playwright (chromium) smoke suite against the dev server
```

`npm test && npm run test:e2e` must pass before pushing.

## License rules (important)

Code here is MIT. When importing external data: Tatoeba (CC BY — keep attribution), kaikki/Wiktionary (CC BY-SA — derived decks must stay share-alike), Leipzig lists (CC BY). **Never copy code from LibreLingo or Anki (AGPL).** Don't commit large datasets; importers download them.
