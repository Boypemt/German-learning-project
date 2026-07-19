# Free & open resources used (or planned)

Everything here is free, and licenses are noted so the project stays legal if it ever goes public. Rule of thumb: **CC0/public domain** = use freely; **CC BY** = credit the source; **CC BY-SA** = credit + share derived data under the same license; **AGPL code** = if you copy their code, your app's code must be open-sourced too (using their *data or ideas* is fine).

## Algorithms & libraries (code)

| Resource | What | License |
|---|---|---|
| [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) | FSRS spaced-repetition scheduler in TypeScript — already a dependency of this app | MIT |
| [Open Spaced Repetition](https://github.com/open-spaced-repetition) | FSRS research, optimizer, ports in many languages | MIT |
| Web Speech API | Browser-built-in TTS (`speechSynthesis`) and speech recognition (`SpeechRecognition`) — free, no server needed; used for pronunciation | Built into Chrome/Edge |
| [Piper TTS](https://github.com/rhasspy/piper) | Offline neural TTS, has excellent German "Thorsten" voice. Upgrade path when browser TTS isn't good enough (pre-generate mp3s for decks) | MIT (voices vary, mostly free) |
| [Whisper](https://github.com/openai/whisper) | Speech-to-text, strong German support. Upgrade path for better pronunciation scoring (needs a server or WASM) | MIT |

## Vocabulary & dictionary data

| Resource | What | License |
|---|---|---|
| [Wiktionary via kaikki.org](https://kaikki.org/dictionary/German/index.html) | Full machine-readable German dictionary (JSONL): definitions, gender, plurals, IPA, conjugations, audio links | CC BY-SA / GFDL |
| [Leipzig Corpora / Wortschatz](https://wortschatz.uni-leipzig.de/en/download/German) | German frequency lists (10K–1M words) | CC BY 4.0 |
| [OpenSubtitles frequency lists](https://github.com/hermitdave/FrequencyWords) | 50K German words by spoken-language frequency — best order for learning | CC BY-SA 4.0 |
| Goethe-Institut A1/A2/B1 Wortlisten | Official CEFR vocab lists (PDFs, free to download for personal study; check terms before redistributing) | Free for personal use |
| [FreeDict deu-eng](https://freedict.org/) | German–English dictionary files | GPL/free |

## Images

| Resource | What | License |
|---|---|---|
| [Openverse](https://openverse.org/) | Photo search across CC-licensed collections; our importer (`npm run import:images`) fetches **CC0/public-domain only** for vocab flashcards | CC0 / PDM (no attribution required; source recorded in `data/de/images.json`) |

## Sentences & audio

| Resource | What | License |
|---|---|---|
| [Tatoeba](https://tatoeba.org/en/downloads) | ~600K+ German example sentences with English translations, many with native audio. Main source for listening/dictation decks | CC BY 2.0 (some CC0) |
| [Lingua Libre](https://lingualibre.org/) | Native-speaker word pronunciation recordings | CC BY-SA 4.0 |
| [Mozilla Common Voice](https://commonvoice.mozilla.org/en/datasets) | Huge German speech dataset (for training/scoring, not lessons) | CC0 |

## Grammar & courses (content to learn from / adapt)

| Resource | What | License |
|---|---|---|
| [Deutsch im Blick + Grimm Grammar](https://coerll.utexas.edu/dib/) | Full first-year German course + grammar reference (UT Austin) | CC BY (open courseware) |
| [A Foundation Course in Reading German](https://courses.dcs.wisc.edu/wp/readinggerman/) | Complete German grammar textbook (UW-Madison) | CC BY-NC |
| [Wikibooks German](https://en.wikibooks.org/wiki/German) | Community German textbook | CC BY-SA |
| [DW Nicos Weg](https://learngerman.dw.com/en/nicos-weg/c-36519789) | Free video course A1→B1 from Deutsche Welle — link to it, don't copy it | Free to use, © DW |
| [German with Laura / your own summaries] | Grammar topics in `data/de/grammar-topics.json` are written from scratch for this project | MIT (ours) |

## Existing open-source apps worth studying

| Project | Takeaway |
|---|---|
| [LibreLingo](https://github.com/LibreLingoCommunity/LibreLingo) | Community Duolingo clone (AGPL) — good course-data format ideas; don't copy code unless you accept AGPL |
| [Anki](https://github.com/ankitects/anki) | Gold standard SRS (AGPL) — study its FSRS integration & deck format |
| [awesome-language-learning](https://github.com/Vuizur/awesome-language-learning) | Curated list of open language-learning tools & data |
| [kaikki-to-yomitan](https://github.com/themoeway/kaikki-to-yomitan) | Example of converting kaikki dictionary data — useful pattern for our import scripts |

## What's bundled vs. linked

- `data/de/*.json` — small seed decks written for this project (MIT).
- Large datasets (Tatoeba, kaikki, frequency lists) are **downloaded by import scripts** (planned, `scripts/`) rather than committed to git. Keep their attribution when generating decks from them.
