# CLAUDE.md — project context

Personal German-learning platform (goal: C1, for working in Germany). Free/open-source everything, deploys on Vercel, single user for now, multi-language-ready. Owner continues development with Claude Code.

## Read first

- `docs/architecture.md` — stack, folder layout, data model
- `docs/roadmap.md` — what to build next (Phase 2: content import scripts)
- `docs/resources.md` — approved data sources and their licenses

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
