// Vocab example sentences usually show the word inflected (sein -> "Ich BIN
// müde"), which reads as unrelated to the headword for a beginner. The
// optional `exampleForm` field on VocabItem ("bin (ich-form of sein)")
// names the inflected token plus a gloss; this module parses that field
// and finds/bolds the matching token inside the example sentence.

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface ParsedExampleForm {
  word: string;
  gloss: string;
}

/** "bin (ich-form of sein)" -> { word: "bin", gloss: "ich-form of sein" }.
 *  The word must be a single token (no spaces) — separable-verb glosses
 *  describe the split in the gloss text instead, e.g.
 *  "rufe (ich-form of anrufen — 'an' moves to the end)". */
export function parseExampleForm(exampleForm: string): ParsedExampleForm | null {
  const m = exampleForm.trim().match(/^(\S+)\s*\((.+)\)\s*$/);
  if (!m) return null;
  return { word: m[1], gloss: m[2] };
}

export interface BoldSplit {
  before: string;
  match: string | null;
  after: string;
}

/**
 * Splits `example` around the word to bold: exampleForm's word when given,
 * otherwise the headword with its article stripped. Case-insensitive,
 * whole-word match (Unicode-aware, so ä/ö/ü/ß work correctly — plain \b
 * treats them as non-word characters and silently fails to match).
 */
export function findBoldTarget(example: string, exampleForm: string | undefined, headword: string): BoldSplit {
  const parsed = exampleForm ? parseExampleForm(exampleForm) : null;
  const word = (parsed?.word ?? headword.replace(/^(der|die|das)\s+/i, "")).trim();
  if (!word) return { before: example, match: null, after: "" };

  const re = new RegExp(`(?<![\\p{L}])(${escapeRegExp(word)})(?![\\p{L}])`, "iu");
  const m = example.match(re);
  if (!m || m.index === undefined) return { before: example, match: null, after: "" };

  return {
    before: example.slice(0, m.index),
    match: example.slice(m.index, m.index + m[0].length),
    after: example.slice(m.index + m[0].length),
  };
}
