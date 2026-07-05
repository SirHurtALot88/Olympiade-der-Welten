/**
 * Minimal, safe cross-DB single-save importer.
 *
 * Context: balancing/long-run processes run against a fully isolated, private SQLite file
 * (see lib/season/long-run-db-isolation.ts) so they can never touch the user's live save data.
 * This script is the deliberate, explicit, one-off counterpart: it copies exactly ONE save
 * (all its save_id-scoped rows across every relevant table) from a source SQLite file into the
 * live/default SQLite file, as a brand-new row, WITHOUT touching any existing save and WITHOUT
 * changing the active-save pointer.
 *
 * Safety properties:
 * - Read-only on the source DB, opened with `readonly: true`.
 * - Writes to the target DB happen inside a single SQLite transaction (all-or-nothing).
 * - Copies ONLY rows where save_id = --source-save-id, into every save_id-scoped table
 *   (saves, seasons, season_states, matchday_states, game_metadata, mapping_reports, teams,
 *   team_identities, players, player_baselines, disciplines, rosters, contracts,
 *   transfer_listings, transfer_history, game_logs). Never touches the global
 *   player_catalog/player_baseline_catalog reference tables.
 * - Forces the imported save's status to "archived" (never "active") so the user's current
 *   active save pointer is never affected — the user opts in explicitly via the UI's save list.
 * - Aborts before writing anything if the target DB already has a save with the target save_id,
 *   or if the two DBs' schemas for any relevant table disagree (columns), or if the source save
 *   is missing required singleton rows (seasons/season_states/matchday_states/mapping_reports).
 * - Prints a before/after row-count diff for the target DB's `saves` table and every other
 *   affected table, so the caller can verify no pre-existing rows changed and exactly one save's
 *   worth of new rows was added.
 *
 * Usage:
 *   npx tsx scripts/import-balancing-save-into-live-db.ts \
 *     --source-db outputs/s1-s10-validated-run-1/balancing-run.sqlite \
 *     --source-save-id fresh-season-1-1783169019878 \
 *     --target-db data/persistence/oly-app.sqlite \
 *     --target-name "Balancing S1-S10 FINAL (importiert)"
 *
 * --target-db defaults to data/persistence/oly-app.sqlite (the app's default live path) if omitted.
 * --target-save-id defaults to the source save id (kept identical for traceability) if omitted.
 */
import path from "node:path";
import Database from "better-sqlite3";

const PROJECT_ROOT = path.resolve(__dirname, "..");

const SAVE_SCOPED_SINGLETON_TABLES = ["seasons", "season_states", "matchday_states", "game_metadata", "mapping_reports"] as const;
const SAVE_SCOPED_COLLECTION_TABLES = [
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
] as const;
const ALL_SAVE_SCOPED_TABLES = ["saves", ...SAVE_SCOPED_SINGLETON_TABLES, ...SAVE_SCOPED_COLLECTION_TABLES] as const;

function argValue(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function resolvePath(input: string) {
  return path.isAbsolute(input) ? input : path.join(PROJECT_ROOT, input);
}

function tableColumnSignature(db: Database.Database, table: string) {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string; type: string }>)
    .map((column) => `${column.name}:${column.type}`)
    .join(",");
}

function rowCount(db: Database.Database, table: string, whereSaveId?: string) {
  if (whereSaveId) {
    return (db.prepare(`SELECT COUNT(*) AS c FROM ${table} WHERE save_id = ?`).get(whereSaveId) as { c: number }).c;
  }
  return (db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number }).c;
}

async function main() {
  const sourceDbArg = argValue("--source-db");
  const sourceSaveId = argValue("--source-save-id");
  const targetDbArg = argValue("--target-db") ?? "data/persistence/oly-app.sqlite";
  const targetSaveId = argValue("--target-save-id") ?? sourceSaveId;
  const targetName = argValue("--target-name");

  if (!sourceDbArg || !sourceSaveId) {
    throw new Error("Usage: --source-db <path> --source-save-id <id> [--target-db <path>] [--target-save-id <id>] [--target-name <name>]");
  }

  const sourceDbPath = resolvePath(sourceDbArg);
  const targetDbPath = resolvePath(targetDbArg);

  console.log(`[import-save] source DB: ${sourceDbPath}`);
  console.log(`[import-save] target DB: ${targetDbPath}`);
  console.log(`[import-save] source save-id: ${sourceSaveId} -> target save-id: ${targetSaveId}`);

  const source = new Database(sourceDbPath, { readonly: true });
  const target = new Database(targetDbPath);
  target.pragma("busy_timeout = 5000");
  target.pragma("foreign_keys = ON");

  try {
    // 1) Schema-parity guard: refuse to copy if any relevant table's columns disagree.
    for (const table of ALL_SAVE_SCOPED_TABLES) {
      const sourceSig = tableColumnSignature(source, table);
      const targetSig = tableColumnSignature(target, table);
      if (sourceSig !== targetSig) {
        throw new Error(
          `Schema mismatch on table "${table}" — refusing to copy.\n  source: ${sourceSig}\n  target: ${targetSig}`,
        );
      }
    }
    console.log(`[import-save] schema parity OK for all ${ALL_SAVE_SCOPED_TABLES.length} tables.`);

    // 2) Existence guards.
    const sourceSaveRow = source.prepare("SELECT * FROM saves WHERE save_id = ?").get(sourceSaveId) as
      | Record<string, unknown>
      | undefined;
    if (!sourceSaveRow) {
      throw new Error(`Source save ${sourceSaveId} not found in ${sourceDbPath}.`);
    }
    for (const table of SAVE_SCOPED_SINGLETON_TABLES) {
      if (rowCount(source, table, sourceSaveId) === 0) {
        throw new Error(`Source save ${sourceSaveId} is missing required singleton row in "${table}" — refusing to copy incomplete save.`);
      }
    }
    const existingTargetSave = target.prepare("SELECT save_id FROM saves WHERE save_id = ?").get(targetSaveId);
    if (existingTargetSave) {
      throw new Error(`Target DB already has a save with id ${targetSaveId} — refusing to overwrite. Pass --target-save-id to choose a different id.`);
    }

    // 3) Snapshot target row counts BEFORE the write, for every existing save + every table,
    //    so we can prove afterward that nothing pre-existing changed.
    const targetSaveIdsBefore = (target.prepare("SELECT save_id FROM saves").all() as Array<{ save_id: string }>).map(
      (row) => row.save_id,
    );
    const beforeCounts: Record<string, number> = {};
    for (const table of ALL_SAVE_SCOPED_TABLES) {
      beforeCounts[table] = rowCount(target, table);
    }

    // 4) Copy inside a single transaction: saves row first (FK parent), then every dependent table.
    const copyTransaction = target.transaction(() => {
      const now = new Date().toISOString();
      const saveInsertColumns = Object.keys(sourceSaveRow).filter((column) => column !== "save_id");
      const saveInsertSql = `INSERT INTO saves (save_id, ${saveInsertColumns.join(", ")}) VALUES (@save_id, ${saveInsertColumns
        .map((column) => `@${column}`)
        .join(", ")})`;
      target.prepare(saveInsertSql).run({
        ...sourceSaveRow,
        save_id: targetSaveId,
        name: targetName ?? sourceSaveRow.name,
        status: "archived",
        updated_at: now,
      });

      for (const table of SAVE_SCOPED_SINGLETON_TABLES) {
        const row = source.prepare(`SELECT * FROM ${table} WHERE save_id = ?`).get(sourceSaveId) as Record<string, unknown>;
        const columns = Object.keys(row).filter((column) => column !== "save_id");
        target
          .prepare(`INSERT INTO ${table} (save_id, ${columns.join(", ")}) VALUES (@save_id, ${columns.map((c) => `@${c}`).join(", ")})`)
          .run({ ...row, save_id: targetSaveId });
      }

      for (const table of SAVE_SCOPED_COLLECTION_TABLES) {
        const rows = source.prepare(`SELECT * FROM ${table} WHERE save_id = ?`).all(sourceSaveId) as Array<Record<string, unknown>>;
        if (rows.length === 0) continue;
        const columns = Object.keys(rows[0]).filter((column) => column !== "save_id");
        const insert = target.prepare(
          `INSERT INTO ${table} (save_id, ${columns.join(", ")}) VALUES (@save_id, ${columns.map((c) => `@${c}`).join(", ")})`,
        );
        for (const row of rows) {
          insert.run({ ...row, save_id: targetSaveId });
        }
      }
    });
    copyTransaction();

    // 5) Verify: every pre-existing save's row counts are unchanged, and exactly the new save's
    //    rows were added, matching the source counts.
    const targetSaveIdsAfter = (target.prepare("SELECT save_id FROM saves").all() as Array<{ save_id: string }>).map(
      (row) => row.save_id,
    );
    const missingAfter = targetSaveIdsBefore.filter((id) => !targetSaveIdsAfter.includes(id));
    if (missingAfter.length > 0) {
      throw new Error(`INTEGRITY VIOLATION: pre-existing save(s) disappeared after import: ${missingAfter.join(", ")}`);
    }
    console.log(`[import-save] verified: all ${targetSaveIdsBefore.length} pre-existing saves still present.`);

    for (const table of ALL_SAVE_SCOPED_TABLES) {
      const afterTotal = rowCount(target, table);
      const sourceSaveRows = table === "saves" ? 1 : rowCount(source, table, sourceSaveId);
      const expected = beforeCounts[table] + sourceSaveRows;
      const status = afterTotal === expected ? "OK" : "MISMATCH";
      console.log(`[import-save] ${table}: before=${beforeCounts[table]} + imported=${sourceSaveRows} -> after=${afterTotal} [${status}]`);
      if (status === "MISMATCH") {
        throw new Error(`INTEGRITY VIOLATION: unexpected row count in "${table}" after import.`);
      }
    }

    console.log(`[import-save] SUCCESS: save "${targetSaveId}" imported as status=archived, name="${targetName ?? sourceSaveRow.name}".`);
    console.log(`[import-save] Load it from the app's save list UI (it will NOT auto-activate).`);
  } finally {
    source.close();
    target.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
