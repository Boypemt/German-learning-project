# Roadmap

## Phase 1 — Usable daily driver (this scaffold + first weeks)

- [x] Next.js scaffold, deploys to Vercel
- [x] FSRS vocab flashcards with browser TTS + typing recall
- [x] Grammar topics with fill-in exercises
- [x] Listening dictation drills
- [x] Speaking practice (speech recognition compare)
- [x] Writing prompts with local drafts
- [x] Dashboard with due counts + streak
- [ ] Settings page (voice picker, new cards/day, daily goal)
- [ ] Deploy to Vercel and use daily

## Phase 2 — Real content at scale

- [ ] `scripts/import-frequency.ts` — build 5,000-word deck from OpenSubtitles/Leipzig frequency lists, enriched with gender/plural/IPA from kaikki.org Wiktionary data
- [ ] `scripts/import-tatoeba.ts` — pull German↔English sentence pairs (with audio links) into listening decks by level
- [ ] Cloze cards: learn vocab inside Tatoeba sentences instead of isolated words
- [ ] Grammar: full A1→C1 topic tree (adapt from Grimm Grammar / Wikibooks, CC licenses)
- [ ] Native audio: use Wiktionary/Lingua Libre recordings where available, Piper TTS (Thorsten voice) pre-generated mp3s otherwise
- [ ] Import/export progress as JSON (backup before localStorage is trusted)

## Phase 3 — Better feedback

- [ ] Writing correction via Claude API (bring-your-own-key field, so the app stays free)
- [ ] Pronunciation scoring with Whisper (WASM in-browser, or tiny API route)
- [ ] Level self-assessment tests per CEFR level
- [ ] C1 exam-format practice module (Goethe/telc/TestDaF reading & listening formats)

## Phase 4 — Other people, other languages

- [ ] Supabase auth + Postgres for cross-device sync (progress schema already isolated)
- [ ] `data/<lang>/` for a second language to prove the multi-language design
- [ ] Deck sharing / community decks
- [ ] PWA (offline use on phone)

## Non-goals (for now)

Gamification beyond streaks, social features, mobile-native apps, paid anything.
