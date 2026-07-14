# Architecture

## Stack

- **Next.js 14 (App Router) + TypeScript** — deploys to Vercel free tier with zero config.
- **ts-fsrs** — spaced repetition scheduling (same algorithm family as modern Anki).
- **localStorage** — all user progress. No database, no auth, no cost. One user per browser.
- **Web Speech API** — `speechSynthesis` for German TTS, `SpeechRecognition` for pronunciation checking. Both free, built into Chrome/Edge (recognition needs Chrome/Edge; Firefox lacks it).
- **Static JSON decks** in `data/de/` — content ships with the app.

## Folder layout

```
app/                  # Next.js App Router pages
  page.tsx            # Dashboard: due counts, streak
  vocab/page.tsx      # FSRS flashcards
  grammar/page.tsx    # Topics + fill-in exercises
  listening/page.tsx  # TTS dictation drills
  speaking/page.tsx   # Speak-and-compare pronunciation
  writing/page.tsx    # Prompts + local draft saving
lib/
  srs.ts              # FSRS wrapper + card persistence
  storage.ts          # localStorage helpers, streak tracking
  speech.ts           # TTS / speech recognition helpers
data/de/
  vocab-a1.json       # Seed vocab deck (frequency-ordered)
  sentences-a1.json   # Seed sentences for listening/speaking
  grammar-topics.json # Grammar explanations + exercises
docs/                 # Method, resources, roadmap
scripts/              # (planned) importers: Tatoeba, kaikki, frequency lists
```

## Data model (localStorage keys)

- `sl:cards:de` — `Record<cardId, { fsrs: Card, itemId: string }>` FSRS state per vocab item.
- `sl:activity` — `Record<yyyy-mm-dd, number>` reviews per day → streak.
- `sl:writing:drafts` — saved writing exercises.
- `sl:settings` — TTS voice choice, new-cards-per-day, etc.

Deck content is static and versioned in git; only *progress* lives in localStorage. This split makes the later move to a DB (per-user progress table) mechanical.

## Multi-language readiness

Everything content-related lives under `data/<lang>/` and pages take the language from a single constant (`lib/config.ts` later). Adding Spanish = adding `data/es/` + registering it. No German is hard-coded in logic.

## Known limits / upgrade paths

| Limit | Upgrade |
|---|---|
| localStorage is per-browser, can be cleared | Supabase free tier (auth + Postgres) in Phase 3 |
| Browser TTS quality varies | Pre-generate audio with Piper (Thorsten voice) at build time |
| SpeechRecognition gives text, not phoneme scores | Whisper (server or WASM) + alignment for real pronunciation scoring |
| Seed decks are small | `scripts/` importers for Tatoeba + kaikki + frequency lists |
