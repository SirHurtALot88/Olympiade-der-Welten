import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";

import teamLogoMap from "../data/generated/team-logo-map.json";

// One-shot importer that bundles the original team-logo image files into the
// repo so they are served statically from /team-logos/<teamId> — no Dropbox
// mount or absolute-path map needed at runtime.
//
// The canonical map (data/generated/team-logo-map.json) already knows, for each
// team id, the ORIGINAL logo filename (the basename of the captured macOS
// path). This script copies each of those originals out of a local source
// folder and renames it to "<teamId>.<ext>" in public/team-logos/, then you run
// `npm run team-logos:index` to regenerate the lookup JSON.
//
// Usage:
//   1. Copy the contents of your Dropbox
//        "Chris/Olympiade der Welten/Logos/Logos/"
//      folder into a local source folder (default: public/team-logos-src/).
//   2. npm run team-logos:import            # optionally pass a source dir:
//      npm run team-logos:import -- /path/to/Logos/Logos
//   3. npm run team-logos:index
//
// Matching is case-insensitive and ignores the file extension, so a source file
// named "Armageddon Aftermath.JPG" still matches the map entry
// ".../Armageddon Aftermath.jpg".

const SUPPORTED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const DEST_DIR = join(process.cwd(), "public/team-logos");
const DEFAULT_SOURCE_DIR = join(process.cwd(), "public/team-logos-src");

const sourceDir = process.argv[2]?.trim() ? process.argv[2].trim() : DEFAULT_SOURCE_DIR;

if (!existsSync(sourceDir)) {
  console.error(`Source folder not found: ${sourceDir}`);
  console.error(
    "Copy the original logo files there first (e.g. the contents of the Dropbox " +
      "'Logos/Logos' folder), or pass the folder as an argument.",
  );
  process.exit(1);
}

// Build a case-insensitive index of the source folder: basename-without-ext -> actual filename.
const sourceByStem = new Map<string, string>();
for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
  if (!entry.isFile()) {
    continue;
  }
  const ext = extname(entry.name).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    continue;
  }
  const stem = entry.name.slice(0, entry.name.length - ext.length).toLowerCase();
  if (!sourceByStem.has(stem)) {
    sourceByStem.set(stem, entry.name);
  }
}

mkdirSync(DEST_DIR, { recursive: true });

const map = teamLogoMap as Record<string, string>;
const imported: string[] = [];
const missing: string[] = [];

for (const [teamId, absolutePath] of Object.entries(map)) {
  const originalName = absolutePath.split("/").pop() ?? "";
  const ext = extname(originalName).toLowerCase() || ".jpg";
  const stem = originalName.slice(0, originalName.length - extname(originalName).length).toLowerCase();

  const sourceName = sourceByStem.get(stem);
  if (!sourceName) {
    missing.push(`${teamId}  (looked for "${originalName}")`);
    continue;
  }

  const destName = `${teamId}${ext}`;
  copyFileSync(join(sourceDir, sourceName), join(DEST_DIR, destName));
  imported.push(`${sourceName} -> ${destName}`);
}

console.log(`Imported ${imported.length}/${Object.keys(map).length} team logo(s) into ${DEST_DIR}`);
for (const line of imported) {
  console.log(`  ✓ ${line}`);
}
if (missing.length > 0) {
  console.log(`\nMissing ${missing.length} source file(s) — no match in ${sourceDir}:`);
  for (const line of missing) {
    console.log(`  ✗ ${line}`);
  }
  console.log("\nAdd the missing originals to the source folder and re-run.");
}
console.log("\nNext: npm run team-logos:index");
