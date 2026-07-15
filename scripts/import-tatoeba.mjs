// Import German↔English sentence pairs from Tatoeba (CC BY 2.0 FR).
// Run locally:  node scripts/import-tatoeba.mjs
// Downloads ~40 MB, writes data/de/sentences-imported.json (kept out of git
// history bloat by being regenerable — safe to commit the JSON output).
//
// Attribution requirement (CC BY): sentences come from https://tatoeba.org
// — keep this notice and the per-sentence IDs.

import { createWriteStream, existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const PAIRS_URL =
  "https://www.manythings.org/anki/deu-eng.zip"; // Tatoeba-derived DE-EN pairs, one TSV

// per-level quotas — the source file is sorted short→long, so we must scan
// ALL of it and fill buckets, not just take the first N lines
const QUOTA = { A1: 400, A2: 400, B1: 400, B2: 400, C1: 300, C2: 200 };

// crude CEFR heuristic: sentence length + comma depth
function guessLevel(de) {
  const words = de.split(/\s+/).length;
  const commas = (de.match(/,/g) ?? []).length;
  const score = words + commas * 3;
  if (score <= 5) return "A1";
  if (score <= 8) return "A2";
  if (score <= 12) return "B1";
  if (score <= 17) return "B2";
  if (score <= 24) return "C1";
  return "C2";
}

async function main() {
  const tmp = join(tmpdir(), "beiopa-tatoeba");
  await mkdir(tmp, { recursive: true });
  const zipPath = join(tmp, "deu-eng.zip");

  if (!existsSync(zipPath)) {
    console.log("Downloading Tatoeba DE-EN pairs…");
    const res = await fetch(PAIRS_URL, { headers: { "user-agent": "bei-opa-importer" } });
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    await pipeline(res.body, createWriteStream(zipPath));
  }

  console.log("Unzipping…");
  const unzip = spawnSync(process.platform === "win32" ? "tar" : "unzip",
    process.platform === "win32" ? ["-xf", zipPath, "-C", tmp] : ["-o", zipPath, "-d", tmp],
    { stdio: "inherit" });
  if (unzip.status !== 0) throw new Error("Unzip failed — install tar/unzip or extract deu-eng.zip manually");

  const raw = await readFile(join(tmp, "deu.txt"), "utf8");
  const seen = new Set();
  const buckets = Object.fromEntries(Object.keys(QUOTA).map((k) => [k, []]));
  const full = () => Object.entries(QUOTA).every(([k, n]) => buckets[k].length >= n);

  for (const line of raw.split("\n")) {
    const [en, de] = line.split("\t");
    if (!de || !en) continue;
    // quality filters: reasonable length, no quotes/parentheses, ends with punctuation
    if (de.length < 15 || de.length > 180) continue;
    if (/["()\[\]«»]/.test(de)) continue;
    if (!/[.!?]$/.test(de.trim())) continue;
    const key = de.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const level = guessLevel(de);
    if (buckets[level].length >= QUOTA[level]) continue;
    buckets[level].push({ de: de.trim(), en: en.trim(), level });
    if (full()) break;
  }

  const out = Object.values(buckets).flat()
    .map((s, i) => ({ id: `tato-${i + 1}`, ...s }));

  await writeFile(
    new URL("../data/de/sentences-imported.json", import.meta.url),
    JSON.stringify(out, null, 1),
    "utf8"
  );
  console.log(`Wrote ${out.length} sentences:`,
    Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, v.length])));
  console.log("Done. Restart `npm run dev` — listening & speaking now draw from the full pool.");
}

main().catch((e) => { console.error(e); process.exit(1); });
