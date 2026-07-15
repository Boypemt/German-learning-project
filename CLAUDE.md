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
- Speech: `lib/speech.ts` wraps Web Speech API. Recognition requires Chrome/Edge; always feature-detect.
- Content: static JSON under `data/de/`. Progress: localStorage only (keys prefixed `sl:`, see `lib/storage.ts`).
- Keep German content out of logic — everything language-specific belongs in `data/<lang>/`.

## Commands

```bash
npm run dev      # local dev
npm run build    # must pass before pushing (Vercel runs this)
npm run lint
```

## License rules (important)

Code here is MIT. When importing external data: Tatoeba (CC BY — keep attribution), kaikki/Wiktionary (CC BY-SA — derived decks must stay share-alike), Leipzig lists (CC BY). **Never copy code from LibreLingo or Anki (AGPL).** Don't commit large datasets; importers download them.
