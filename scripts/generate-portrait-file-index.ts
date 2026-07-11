import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Scans public/portraits/ for repo-relative player portrait images and
// writes the list of basenames to data/generated/portrait-files.json.
//
// lib/data/mediaAssets.ts reads that JSON file (at import time, no
// filesystem access needed in the browser) to decide whether a static
// /portraits/<file> URL is available for a given player id or name slug.
//
// Run after adding/removing files in public/portraits/:
//   npm run portraits:index

const PORTRAITS_DIR = join(process.cwd(), "public/portraits");
const OUT_FILE = join(process.cwd(), "data/generated/portrait-files.json");

const SUPPORTED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

mkdirSync(PORTRAITS_DIR, { recursive: true });

const basenames = readdirSync(PORTRAITS_DIR, { withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => entry.name)
  .filter((name) => {
    const dot = name.lastIndexOf(".");
    if (dot === -1) {
      return false;
    }
    return SUPPORTED_EXTENSIONS.has(name.slice(dot).toLowerCase());
  })
  .sort((a, b) => a.localeCompare(b));

writeFileSync(OUT_FILE, `${JSON.stringify(basenames, null, 2)}\n`, "utf8");

console.log(`Indexed ${basenames.length} portrait file(s) from ${PORTRAITS_DIR} -> ${OUT_FILE}`);
