import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Scans public/team-logos/ for repo-relative team crest images and writes
// the list of basenames to data/generated/team-logo-files.json.
//
// lib/data/mediaAssets.ts reads that JSON file (at import time, no
// filesystem access needed in the browser) to decide whether a static
// /team-logos/<file> URL is available for a given team id.
//
// Run after adding/removing files in public/team-logos/:
//   npm run team-logos:index

const TEAM_LOGOS_DIR = join(process.cwd(), "public/team-logos");
const OUT_FILE = join(process.cwd(), "data/generated/team-logo-files.json");

const SUPPORTED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

mkdirSync(TEAM_LOGOS_DIR, { recursive: true });

const basenames = readdirSync(TEAM_LOGOS_DIR, { withFileTypes: true })
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

console.log(`Indexed ${basenames.length} team logo file(s) from ${TEAM_LOGOS_DIR} -> ${OUT_FILE}`);
