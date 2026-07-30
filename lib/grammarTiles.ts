// Tap-to-fill tile building for beginner (A0-A2) grammar exercises — pure
// so the distractor selection can be unit-tested without rendering.

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Builds a shuffled tile set (the correct answer + up to 3 distractors)
 * from the other exercises' answers in the same topic. Case-insensitive
 * de-duped against the correct answer so a coincidental repeat (e.g. two
 * "der" answers in one topic) never produces an ambiguous duplicate tile.
 */
export function buildTileOptions(correct: string, allAnswersInTopic: string[], maxTiles = 4): string[] {
  const seen = new Set<string>();
  const distractorPool: string[] = [];
  for (const a of allAnswersInTopic) {
    const key = a.toLowerCase();
    if (key === correct.toLowerCase() || seen.has(key)) continue;
    seen.add(key);
    distractorPool.push(a);
  }
  const distractors = shuffle(distractorPool).slice(0, Math.max(0, maxTiles - 1));
  return shuffle([correct, ...distractors]);
}
