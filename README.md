# Sprachheld — Personal German Learning Platform

A free, self-hosted language learning platform. First target: **German A0 → C1** for working in Germany. Built to deploy on Vercel, designed so more languages can be added later.

## Why this exists

Paid platforms (Duolingo, Babbel, Lingoda) gate the useful features. Everything needed to reach C1 exists as open data and open source — this project wires it together into one focused app.

## Features (current + planned)

- **Vocab** — flashcards scheduled by FSRS (the modern spaced-repetition algorithm used by Anki), seeded with frequency-ordered German vocab. Audio via browser TTS.
- **Grammar** — CEFR-ordered topic explanations with fill-in exercises (cases, verb position, adjective endings…).
- **Listening** — dictation drills: hear a German sentence, type what you hear.
- **Speaking** — pronunciation practice using the browser's speech recognition: say the sentence, get compared against the target.
- **Writing** — daily prompts by level; export your text to check with Claude/DeepL Write.
- **Dashboard** — due cards, streak, level progress.

Progress is stored in **browser localStorage** (no account, no server DB). Multi-user support with a real database is a later phase — see `docs/roadmap.md`.

## Quick start

```bash
npm install
npm run dev        # http://localhost:3000
```

Deploy: push to GitHub → import repo on vercel.com → done (no env vars needed).

## Project docs

| File | What it covers |
|---|---|
| `docs/learning-method.md` | Evidence-based method + realistic A0→C1 plan |
| `docs/resources.md` | Every free/open dataset & tool used, with licenses |
| `docs/architecture.md` | Tech decisions, data model, folder layout |
| `docs/roadmap.md` | Phased build plan (solo use → multi-language, multi-user) |
| `CLAUDE.md` | Context file for continuing work with Claude Code |

## License

Code: MIT. Bundled learning data files note their source and license in `docs/resources.md`.
