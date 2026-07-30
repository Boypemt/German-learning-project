import { describe, it, expect } from "vitest";
import { buildTileOptions } from "../lib/grammarTiles";

describe("buildTileOptions", () => {
  it("always includes the correct answer", () => {
    const tiles = buildTileOptions("den", ["den", "die", "das", "dem"]);
    expect(tiles).toContain("den");
  });

  it("caps tiles at 4 by default (correct + up to 3 distractors)", () => {
    const tiles = buildTileOptions("den", ["den", "die", "das", "dem", "des", "der"]);
    expect(tiles.length).toBe(4);
  });

  it("uses fewer tiles when the topic doesn't have enough other answers", () => {
    const tiles = buildTileOptions("den", ["den", "die"]);
    // only one OTHER answer ("die") is available as a distractor
    expect(tiles.length).toBe(2);
    expect(tiles.sort()).toEqual(["den", "die"].sort());
  });

  it("is just the correct answer alone when there are no other exercises", () => {
    const tiles = buildTileOptions("den", ["den"]);
    expect(tiles).toEqual(["den"]);
  });

  it("never includes a distractor equal to the correct answer, case-insensitively", () => {
    const tiles = buildTileOptions("Der", ["der", "DER", "die", "das"]);
    const distractors = tiles.filter((t) => t.toLowerCase() !== "der");
    expect(distractors.sort()).toEqual(["das", "die"].sort());
  });

  it("de-duplicates repeated distractor answers", () => {
    const tiles = buildTileOptions("den", ["die", "die", "die", "das"]);
    expect(tiles.length).toBe(3); // den + die + das, "die" only once
    expect(new Set(tiles).size).toBe(tiles.length);
  });

  it("respects a custom maxTiles", () => {
    const tiles = buildTileOptions("den", ["die", "das", "dem", "des"], 3);
    expect(tiles.length).toBe(3);
  });
});
