import { loadEnvConfig } from "@next/env";
import path from "node:path";

import { getDatabase } from "@/lib/persistence/sqlite";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

const PROJECT_ROOT = path.resolve(__dirname, "..");

type SaveRowLite = {
  save_id: string;
  name: string;
  status: string;
  created_at: string;
  updated_at: string;
};

/**
 * Heuristics that identify a save as a disposable dev/audit/test artifact.
 * Real singleplayer/manual saves must NOT match any of these.
 */
function classifyTestSave(row: SaveRowLite): { isTest: boolean; reason: string } {
  const id = row.save_id;
  const name = row.name ?? "";
  const lowerName = name.toLowerCase();

  const idPatterns: Array<[RegExp, string]> = [
    [/^fresh-season-1-/, "fresh-season-1 save id"],
    [/^fresh-pick-audit-/, "fresh-pick-audit save id"],
    [/^pick-audit/, "pick-audit save id"],
    [/^save-\d+-[a-z0-9]{6}$/, null as unknown as string], // ambiguous, handled by name below
  ];
  for (const [pattern, reason] of idPatterns) {
    if (reason && pattern.test(id)) {
      return { isTest: true, reason };
    }
  }

  // Deliberate user backups (e.g. "... Backup vor ...") must be preserved.
  if (/backup vor/i.test(lowerName)) {
    return { isTest: false, reason: "deliberate backup (protected)" };
  }

  const namePatterns: Array<[RegExp, string]> = [
    [/fresh s1-s2 audit/i, "name: Fresh S1-S2 Audit"],
    [/fresh-pick-audit/i, "name: fresh-pick-audit"],
    [/pick-audit/i, "name: pick-audit"],
    [/pick audit/i, "name: pick audit"],
    [/s1 draft audit/i, "name: S1 draft audit"],
    [/s1-engine-smoke/i, "name: s1-engine-smoke"],
    [/redraft/i, "name: redraft test"],
    [/teststart/i, "name: Teststart"],
    [/season 1 teststart/i, "name: Season 1 Teststart"],
    [/profile transfer window/i, "name: Profile Transfer Window (dev script)"],
    [/debug planner convergence/i, "name: Debug Planner Convergence (dev script)"],
    [/long run sandbox/i, "name: Long Run Sandbox (dev script)"],
    [/multiseason .* resume/i, "name: Multiseason resume (dev script)"],
    [/gm-override-test/i, "name: gm-override-test (dev script)"],
    [/^gm check/i, "name: GM check (dev script)"],
    [/audit/i, "name: audit"],
  ];
  for (const [pattern, reason] of namePatterns) {
    if (pattern.test(lowerName)) {
      return { isTest: true, reason };
    }
  }

  return { isTest: false, reason: "" };
}

function main() {
  loadEnvConfig(PROJECT_ROOT);
  const apply = process.argv.includes("--apply");
  const keepSaveIds = new Set(
    process.argv
      .filter((entry, index, array) => array[index - 1] === "--keep-save-id")
      .concat(["save-singleplayer-dev", "fresh-season-1-1783539770321"]),
  );
  const persistence = createPersistenceService();
  const database = getDatabase();

  const activeSave = persistence.getActiveSave();
  const activeId = activeSave?.saveId ?? null;

  const rows = database
    .prepare(
      "SELECT save_id, name, status, created_at, updated_at FROM saves ORDER BY updated_at DESC",
    )
    .all() as SaveRowLite[];

  console.log(`[cleanup] Total saves in DB: ${rows.length}`);
  console.log(`[cleanup] Active save: ${activeId ?? "(none)"}`);
  console.log("");

  const toDelete: Array<SaveRowLite & { reason: string }> = [];
  const toKeep: Array<SaveRowLite & { reason: string }> = [];

  for (const row of rows) {
    const { isTest, reason } = classifyTestSave(row);
    const isSingleplayerDev = row.save_id === "save-singleplayer-dev";
    const isExplicitKeep = keepSaveIds.has(row.save_id);
    if (isExplicitKeep) {
      toKeep.push({ ...row, reason: isSingleplayerDev ? "singleplayer-dev (protected)" : "explicit keep" });
    } else if (isTest && !isSingleplayerDev) {
      toDelete.push({ ...row, reason });
    } else {
      toKeep.push({ ...row, reason: "not-a-test-save" });
    }
  }

  console.log(`[cleanup] KEEP (${toKeep.length}):`);
  for (const row of toKeep) {
    console.log(`  - ${row.save_id} | ${row.status} | "${row.name}" | ${row.reason}`);
  }
  console.log("");
  console.log(`[cleanup] DELETE candidates (${toDelete.length}):`);
  for (const row of toDelete) {
    const activeFlag = row.save_id === activeId ? " [WAS ACTIVE]" : "";
    console.log(`  - ${row.save_id} | ${row.status} | "${row.name}" | ${row.reason}${activeFlag}`);
  }
  console.log("");

  if (!apply) {
    console.log("[cleanup] DRY RUN — pass --apply to delete the candidates above.");
    return;
  }

  const deleteStatement = database.prepare("DELETE FROM saves WHERE save_id = ?");
  const deleteChildFallback = (table: string) =>
    database.prepare(`DELETE FROM ${table} WHERE save_id = ?`);
  const childTables = [
    "seasons",
    "season_states",
    "matchday_states",
    "game_metadata",
    "teams",
    "team_identities",
    "players",
    "player_baselines",
    "disciplines",
    "rosters",
    "contracts",
    "transfer_listings",
    "transfer_history",
    "game_logs",
    "mapping_reports",
  ];
  const childStatements = childTables.map((table) => deleteChildFallback(table));

  const transaction = database.transaction(() => {
    for (const row of toDelete) {
      // Cascade should handle children, but delete explicitly to be safe in
      // case foreign_keys pragma is off for any reason.
      for (const statement of childStatements) {
        statement.run(row.save_id);
      }
      deleteStatement.run(row.save_id);
    }
  });
  transaction();

  console.log(`[cleanup] Deleted ${toDelete.length} test/audit saves.`);
  const remaining = (database.prepare("SELECT COUNT(*) AS count FROM saves").get() as { count: number }).count;
  console.log(`[cleanup] Remaining saves: ${remaining}`);
}

main();
