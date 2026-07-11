import path from "node:path";

import Database from "better-sqlite3";

import { closeDatabaseForMaintenance } from "@/lib/persistence/sqlite";

export const SAVE_SCOPED_SINGLETON_TABLES = [
  "seasons",
  "season_states",
  "matchday_states",
  "game_metadata",
  "mapping_reports",
] as const;

export const SAVE_SCOPED_COLLECTION_TABLES = [
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

export const ALL_SAVE_SCOPED_TABLES = ["saves", ...SAVE_SCOPED_SINGLETON_TABLES, ...SAVE_SCOPED_COLLECTION_TABLES] as const;

export type SaveDbSnapshot = {
  saveId: string;
  seasonId: string | null;
  gamePhase: string | null;
  rosterCount: number;
  transferHistoryCount: number;
  season10TransferCount: number;
  season11TransferCount: number;
  updatedAt: string | null;
};

function tableColumnSignature(db: Database.Database, table: string) {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string; type: string }>)
    .map((column) => `${column.name}:${column.type}`)
    .join(",");
}

function rowCount(db: Database.Database, table: string, saveId: string) {
  return (db.prepare(`SELECT COUNT(*) AS c FROM ${table} WHERE save_id = ?`).get(saveId) as { c: number }).c;
}

export function readSaveDbSnapshot(db: Database.Database, saveId: string): SaveDbSnapshot | null {
  const saveRow = db.prepare("SELECT updated_at FROM saves WHERE save_id = ?").get(saveId) as { updated_at: string } | undefined;
  if (!saveRow) return null;

  const seasonId =
    (db.prepare("SELECT json_extract(payload_json, '$.id') AS value FROM seasons WHERE save_id = ?").get(saveId) as { value: string | null } | undefined)
      ?.value ?? null;
  const gamePhase =
    (
      db
        .prepare("SELECT json_extract(payload_json, '$.gamePhase') AS value FROM game_metadata WHERE save_id = ?")
        .get(saveId) as { value: string | null } | undefined
    )?.value ?? null;

  return {
    saveId,
    seasonId,
    gamePhase,
    rosterCount: rowCount(db, "rosters", saveId),
    transferHistoryCount: rowCount(db, "transfer_history", saveId),
    season10TransferCount: (
      db
        .prepare(
          "SELECT COUNT(*) AS c FROM transfer_history WHERE save_id = ? AND json_extract(payload_json, '$.seasonId') = 'season-10'",
        )
        .get(saveId) as { c: number }
    ).c,
    season11TransferCount: (
      db
        .prepare(
          "SELECT COUNT(*) AS c FROM transfer_history WHERE save_id = ? AND json_extract(payload_json, '$.seasonId') = 'season-11'",
        )
        .get(saveId) as { c: number }
    ).c,
    updatedAt: saveRow.updated_at ?? null,
  };
}

export type OverwriteSaveFromSourceDbInput = {
  sourceDbPath: string;
  targetDbPath: string;
  saveId: string;
  preserveTargetStatus?: boolean;
};

export type OverwriteSaveFromSourceDbResult = {
  sourceSnapshot: SaveDbSnapshot;
  targetSnapshotBefore: SaveDbSnapshot;
  targetSnapshotAfter: SaveDbSnapshot;
};

export function overwriteSaveFromSourceDb(input: OverwriteSaveFromSourceDbInput): OverwriteSaveFromSourceDbResult {
  const sourceDbPath = path.isAbsolute(input.sourceDbPath) ? input.sourceDbPath : path.join(process.cwd(), input.sourceDbPath);
  const targetDbPath = path.isAbsolute(input.targetDbPath) ? input.targetDbPath : path.join(process.cwd(), input.targetDbPath);
  const { saveId } = input;

  closeDatabaseForMaintenance();

  const source = new Database(sourceDbPath, { readonly: true });
  const target = new Database(targetDbPath);
  target.pragma("busy_timeout = 5000");
  target.pragma("foreign_keys = ON");

  try {
    for (const table of ALL_SAVE_SCOPED_TABLES) {
      const sourceSig = tableColumnSignature(source, table);
      const targetSig = tableColumnSignature(target, table);
      if (sourceSig !== targetSig) {
        throw new Error(`Schema mismatch on table "${table}" — refusing to copy.\n  source: ${sourceSig}\n  target: ${targetSig}`);
      }
    }

    const sourceSaveRow = source.prepare("SELECT * FROM saves WHERE save_id = ?").get(saveId) as Record<string, unknown> | undefined;
    if (!sourceSaveRow) {
      throw new Error(`Source save ${saveId} not found in ${sourceDbPath}.`);
    }
    for (const table of SAVE_SCOPED_SINGLETON_TABLES) {
      if (rowCount(source, table, saveId) === 0) {
        throw new Error(`Source save ${saveId} is missing required singleton row in "${table}".`);
      }
    }

    const targetSnapshotBefore = readSaveDbSnapshot(target, saveId);
    if (!targetSnapshotBefore) {
      throw new Error(`Target save ${saveId} not found in ${targetDbPath}.`);
    }

    const sourceSnapshot = readSaveDbSnapshot(source, saveId);
    if (!sourceSnapshot) {
      throw new Error(`Could not read source snapshot for ${saveId}.`);
    }

    const targetStatusRow = target.prepare("SELECT status FROM saves WHERE save_id = ?").get(saveId) as { status: string } | undefined;

    const copyTransaction = target.transaction(() => {
      for (const table of SAVE_SCOPED_COLLECTION_TABLES) {
        target.prepare(`DELETE FROM ${table} WHERE save_id = ?`).run(saveId);
      }
      for (const table of SAVE_SCOPED_SINGLETON_TABLES) {
        target.prepare(`DELETE FROM ${table} WHERE save_id = ?`).run(saveId);
      }
      target.prepare("DELETE FROM saves WHERE save_id = ?").run(saveId);

      const saveInsertColumns = Object.keys(sourceSaveRow).filter((column) => column !== "save_id");
      target
        .prepare(
          `INSERT INTO saves (save_id, ${saveInsertColumns.join(", ")}) VALUES (@save_id, ${saveInsertColumns.map((column) => `@${column}`).join(", ")})`,
        )
        .run({
          ...sourceSaveRow,
          save_id: saveId,
          status: input.preserveTargetStatus && targetStatusRow ? targetStatusRow.status : sourceSaveRow.status,
          updated_at: new Date().toISOString(),
        });

      for (const table of SAVE_SCOPED_SINGLETON_TABLES) {
        const row = source.prepare(`SELECT * FROM ${table} WHERE save_id = ?`).get(saveId) as Record<string, unknown>;
        const columns = Object.keys(row).filter((column) => column !== "save_id");
        target
          .prepare(`INSERT INTO ${table} (save_id, ${columns.join(", ")}) VALUES (@save_id, ${columns.map((column) => `@${column}`).join(", ")})`)
          .run({ ...row, save_id: saveId });
      }

      for (const table of SAVE_SCOPED_COLLECTION_TABLES) {
        const rows = source.prepare(`SELECT * FROM ${table} WHERE save_id = ?`).all(saveId) as Array<Record<string, unknown>>;
        if (rows.length === 0) continue;
        const columns = Object.keys(rows[0]).filter((column) => column !== "save_id");
        const insert = target.prepare(
          `INSERT INTO ${table} (save_id, ${columns.join(", ")}) VALUES (@save_id, ${columns.map((column) => `@${column}`).join(", ")})`,
        );
        for (const row of rows) {
          insert.run({ ...row, save_id: saveId });
        }
      }
    });
    copyTransaction();

    for (const table of ALL_SAVE_SCOPED_TABLES) {
      const sourceRows = table === "saves" ? 1 : rowCount(source, table, saveId);
      const targetRows = table === "saves" ? 1 : rowCount(target, table, saveId);
      if (sourceRows !== targetRows) {
        throw new Error(`Row-count mismatch after overwrite in "${table}": source=${sourceRows}, target=${targetRows}`);
      }
    }

    const targetSnapshotAfter = readSaveDbSnapshot(target, saveId);
    if (!targetSnapshotAfter) {
      throw new Error(`Target save ${saveId} missing after overwrite.`);
    }

    return { sourceSnapshot, targetSnapshotBefore, targetSnapshotAfter };
  } finally {
    source.close();
    target.close();
  }
}
