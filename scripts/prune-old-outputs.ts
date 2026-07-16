/**
 * Prune old output run directories to free disk space.
 *
 * Usage:
 *   npx tsx scripts/prune-old-outputs.ts              # dry run
 *   npx tsx scripts/prune-old-outputs.ts --apply        # delete
 *   npx tsx scripts/prune-old-outputs.ts --apply --keep-resilient-run outputs/resilient-s1s5-...
 */

import fs from "node:fs";
import path from "node:path";

const PROJECT_ROOT = path.resolve(__dirname, "..");
const OUTPUTS_DIR = path.join(PROJECT_ROOT, "outputs");

const DEFAULT_KEEP_DIRS = new Set([
  "s1-s2-transfer-smoke-2026-07-08T19-42-49",
  "next-season-2026-07-08T21-20-05",
]);

const DEFAULT_KEEP_FILES = new Set([
  "multiseason-final-audit-fresh-season-1-1783539770321.json",
  "s1-draft-baseline.sqlite",
]);

function argValue(name: string) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function formatBytes(bytes: number) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

function dirSize(dirPath: string): number {
  let total = 0;
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) total += dirSize(full);
    else total += fs.statSync(full).size;
  }
  return total;
}

function main() {
  const apply = process.argv.includes("--apply");
  const keepDirs = new Set(DEFAULT_KEEP_DIRS);
  const keepFiles = new Set(DEFAULT_KEEP_FILES);
  const extraKeepDir = argValue("--keep-resilient-run");
  if (extraKeepDir) {
    keepDirs.add(path.basename(extraKeepDir.replace(/\/$/, "")));
  }

  if (!fs.existsSync(OUTPUTS_DIR)) {
    console.log("[prune-outputs] outputs/ missing — nothing to do.");
    return;
  }

  const entries = fs.readdirSync(OUTPUTS_DIR, { withFileTypes: true });
  const toDelete: Array<{ name: string; kind: "dir" | "file"; bytes: number }> = [];
  const toKeep: Array<{ name: string; kind: "dir" | "file"; bytes: number; reason: string }> = [];

  for (const entry of entries) {
    const full = path.join(OUTPUTS_DIR, entry.name);
    if (entry.isDirectory()) {
      if (keepDirs.has(entry.name)) {
        toKeep.push({ name: entry.name, kind: "dir", bytes: dirSize(full), reason: "allowlist" });
      } else {
        toDelete.push({ name: entry.name, kind: "dir", bytes: dirSize(full) });
      }
      continue;
    }
    if (keepFiles.has(entry.name)) {
      toKeep.push({ name: entry.name, kind: "file", bytes: fs.statSync(full).size, reason: "allowlist" });
    } else if (entry.name.endsWith(".json") || entry.name.endsWith(".sqlite") || entry.name.endsWith(".md")) {
      toDelete.push({ name: entry.name, kind: "file", bytes: fs.statSync(full).size });
    } else {
      toKeep.push({ name: entry.name, kind: "file", bytes: fs.statSync(full).size, reason: "unknown-type-skipped" });
    }
  }

  const deleteBytes = toDelete.reduce((sum, row) => sum + row.bytes, 0);
  console.log(`[prune-outputs] KEEP (${toKeep.length}):`);
  for (const row of toKeep.sort((a, b) => b.bytes - a.bytes)) {
    console.log(`  + ${row.name} (${formatBytes(row.bytes)}) — ${row.reason}`);
  }
  console.log("");
  console.log(`[prune-outputs] DELETE (${toDelete.length}, ${formatBytes(deleteBytes)}):`);
  for (const row of toDelete.sort((a, b) => b.bytes - a.bytes).slice(0, 40)) {
    console.log(`  - ${row.name} (${formatBytes(row.bytes)})`);
  }
  if (toDelete.length > 40) console.log(`  ... and ${toDelete.length - 40} more`);
  console.log("");

  if (!apply) {
    console.log("[prune-outputs] DRY RUN — pass --apply to delete.");
    return;
  }

  for (const row of toDelete) {
    const full = path.join(OUTPUTS_DIR, row.name);
    if (row.kind === "dir") fs.rmSync(full, { recursive: true, force: true });
    else fs.unlinkSync(full);
  }
  console.log(`[prune-outputs] Deleted ${toDelete.length} entries (${formatBytes(deleteBytes)} freed).`);
}

main();
