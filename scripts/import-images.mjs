// Fetch free (CC0/public domain) photos for concrete vocab nouns.
// Run locally:  npm run import:images
//
// Source: Openverse (openverse.org) — searches CC0 + public-domain images
// only, so no attribution is legally required (we still record the source).
// Photos land in public/img/vocab/<id>.jpg; the manifest data/de/images.json
// maps vocab ids to images. The app shows a photo when one exists, else the
// emoji. To reject a bad photo: delete the jpg AND its manifest entry, rerun.
//
// Anonymous Openverse API is rate-limited — the script waits between calls
// and saves progress, so you can simply rerun it to continue.

import { createWriteStream, existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { pipeline } from "node:stream/promises";

const DECKS = ["vocab-a1.json", "vocab-a2.json", "vocab-b1.json"];
const OUT_DIR = new URL("../public/img/vocab/", import.meta.url);
const MANIFEST = new URL("../data/de/images.json", import.meta.url);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function searchTerm(item) {
  // use the English gloss, first sense only, cleaned
  return item.en.split(",")[0].replace(/\(.*?\)/g, "").trim();
}

function isNoun(item) {
  return /^(der|die|das) /.test(item.de);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  let manifest = {};
  try { manifest = JSON.parse(await readFile(MANIFEST, "utf8")); } catch {}

  const items = [];
  for (const deck of DECKS) {
    const data = JSON.parse(await readFile(new URL(`../data/de/${deck}`, import.meta.url), "utf8"));
    items.push(...data.filter((i) => isNoun(i) && !manifest[i.id]));
  }
  console.log(`${items.length} nouns still need a photo.`);

  let ok = 0, miss = 0;
  for (const item of items) {
    const q = encodeURIComponent(searchTerm(item));
    const url = `https://api.openverse.org/v1/images/?q=${q}&license=cc0,pdm&page_size=3&mature=false&aspect_ratio=wide,square`;
    let res;
    try {
      res = await fetch(url, { headers: { "user-agent": "bei-opa-learning-app" } });
    } catch (e) {
      console.error("Network error, stopping. Rerun later.", e.message);
      break;
    }
    if (res.status === 429) {
      console.log("Rate limit reached — progress saved. Rerun the script later to continue.");
      break;
    }
    if (!res.ok) { console.log(`  ${item.de}: API ${res.status}, skipping`); miss++; await sleep(2000); continue; }

    const data = await res.json();
    const candidates = (data.results ?? []).filter((r) => r.thumbnail);
    if (candidates.length === 0) { console.log(`  ${item.de} (“${searchTerm(item)}”): no CC0 photo found`); miss++; await sleep(2000); continue; }

    let saved = false;
    for (const hit of candidates) {
      try {
        const imgRes = await fetch(hit.thumbnail, { headers: { "user-agent": "bei-opa-learning-app" } });
        if (!imgRes.ok) throw new Error(`img ${imgRes.status}`);
        const file = new URL(`${item.id}.jpg`, OUT_DIR);
        await pipeline(imgRes.body, createWriteStream(file));
        manifest[item.id] = {
          src: `/img/vocab/${item.id}.jpg`,
          source: hit.foreign_landing_url,
          license: hit.license,
        };
        await writeFile(MANIFEST, JSON.stringify(manifest, null, 1), "utf8"); // save progress each time
        ok++;
        saved = true;
        console.log(`  ✓ ${item.de} → ${item.id}.jpg`);
        break;
      } catch {
        // broken thumbnail — try the next candidate
      }
    }
    if (!saved) { console.log(`  ${item.de}: all candidates failed to download`); miss++; }
    await sleep(2000); // be polite to the free API
  }

  console.log(`\nDone: ${ok} photos added, ${miss} without a match.`);
  console.log("Review public/img/vocab/ — delete any bad photo + its images.json entry, then rerun.");
}

main().catch((e) => { console.error(e); process.exit(1); });
