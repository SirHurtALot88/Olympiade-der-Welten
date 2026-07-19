import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import Database from "better-sqlite3";
import { assertOlyProjectRoot } from "@/lib/persistence/project-root-guard";
import { DEFAULT_ACTIVE_OWNER_ID } from "@/lib/foundation/team-control-settings";

let databaseInstance: Database.Database | null = null;

function resolveDatabasePath() {
  assertOlyProjectRoot();

  const explicitPath = process.env.OLY_APP_SQLITE_PATH;
  if (explicitPath) {
    return explicitPath;
  }

  if (process.env.NODE_ENV === "test" || process.env.VITEST === "true") {
    const workerId = process.env.VITEST_POOL_ID ?? process.env.VITEST_WORKER_ID ?? "0";
    return path.join(os.tmpdir(), `oly-app.test-${workerId}.sqlite`);
  }

  const dataDirectory = path.join(/*turbopackIgnore: true*/ process.cwd(), "data", "persistence");
  return path.join(dataDirectory, "oly-app.sqlite");
}

function ensureDataDirectory() {
  const dataDirectory = path.dirname(resolveDatabasePath());
  fs.mkdirSync(dataDirectory, { recursive: true });
}

function runMigrations(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS saves (
      save_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS seasons (
      save_id TEXT PRIMARY KEY,
      payload_json TEXT NOT NULL,
      FOREIGN KEY (save_id) REFERENCES saves(save_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS season_states (
      save_id TEXT PRIMARY KEY,
      payload_json TEXT NOT NULL,
      FOREIGN KEY (save_id) REFERENCES saves(save_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS matchday_states (
      save_id TEXT PRIMARY KEY,
      payload_json TEXT NOT NULL,
      FOREIGN KEY (save_id) REFERENCES saves(save_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS game_metadata (
      save_id TEXT PRIMARY KEY,
      payload_json TEXT NOT NULL,
      FOREIGN KEY (save_id) REFERENCES saves(save_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS teams (
      save_id TEXT NOT NULL,
      team_id TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      PRIMARY KEY (save_id, team_id),
      FOREIGN KEY (save_id) REFERENCES saves(save_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS team_identities (
      save_id TEXT NOT NULL,
      team_id TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      PRIMARY KEY (save_id, team_id),
      FOREIGN KEY (save_id) REFERENCES saves(save_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS players (
      save_id TEXT NOT NULL,
      player_id TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      PRIMARY KEY (save_id, player_id),
      FOREIGN KEY (save_id) REFERENCES saves(save_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS player_catalog (
      player_id TEXT PRIMARY KEY,
      payload_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS player_baselines (
      save_id TEXT NOT NULL,
      player_id TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      PRIMARY KEY (save_id, player_id),
      FOREIGN KEY (save_id) REFERENCES saves(save_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS player_baseline_catalog (
      player_id TEXT PRIMARY KEY,
      payload_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS disciplines (
      save_id TEXT NOT NULL,
      discipline_id TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      PRIMARY KEY (save_id, discipline_id),
      FOREIGN KEY (save_id) REFERENCES saves(save_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS rosters (
      save_id TEXT NOT NULL,
      roster_id TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      PRIMARY KEY (save_id, roster_id),
      FOREIGN KEY (save_id) REFERENCES saves(save_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS contracts (
      save_id TEXT NOT NULL,
      contract_id TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      PRIMARY KEY (save_id, contract_id),
      FOREIGN KEY (save_id) REFERENCES saves(save_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS transfer_listings (
      save_id TEXT NOT NULL,
      listing_id TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      PRIMARY KEY (save_id, listing_id),
      FOREIGN KEY (save_id) REFERENCES saves(save_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS transfer_history (
      save_id TEXT NOT NULL,
      history_id TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      PRIMARY KEY (save_id, history_id),
      FOREIGN KEY (save_id) REFERENCES saves(save_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS game_logs (
      save_id TEXT NOT NULL,
      log_id TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      PRIMARY KEY (save_id, log_id),
      FOREIGN KEY (save_id) REFERENCES saves(save_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS mapping_reports (
      save_id TEXT PRIMARY KEY,
      payload_json TEXT NOT NULL,
      FOREIGN KEY (save_id) REFERENCES saves(save_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS active_saves (
      owner_id TEXT PRIMARY KEY,
      save_id TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  ensureSaveVersionColumns(database);
  backfillDefaultActiveSavePointer(database);
}

/**
 * One-time, idempotent backfill: when the per-owner `active_saves` pointer table is first created
 * on an existing DB that already has a global status='active' save, seed the DEFAULT_ACTIVE_OWNER_ID
 * (Chris / "user_local") pointer to that save so Chris keeps his current game after the migration.
 * Only runs when Chris has no pointer yet — never overwrites an existing pointer, so it is safe to
 * run on every boot.
 */
function backfillDefaultActiveSavePointer(database: Database.Database) {
  const existingPointer = database
    .prepare("SELECT save_id FROM active_saves WHERE owner_id = ?")
    .get(DEFAULT_ACTIVE_OWNER_ID) as { save_id: string } | undefined;
  if (existingPointer) {
    return;
  }

  const activeRow = database
    .prepare("SELECT save_id FROM saves WHERE status = 'active' ORDER BY updated_at DESC LIMIT 1")
    .get() as { save_id: string } | undefined;
  if (!activeRow) {
    return;
  }

  database
    .prepare("INSERT INTO active_saves (owner_id, save_id, updated_at) VALUES (?, ?, ?)")
    .run(DEFAULT_ACTIVE_OWNER_ID, activeRow.save_id, new Date().toISOString());
}

function ensureSaveVersionColumns(database: Database.Database) {
  const columns = database.prepare("PRAGMA table_info(saves)").all() as Array<{ name: string }>;
  const names = new Set(columns.map((column) => column.name));
  const additions = [
    ["content_signature", "TEXT NOT NULL DEFAULT ''"],
    ["save_version", "INTEGER NOT NULL DEFAULT 0"],
    ["season_id", "TEXT NOT NULL DEFAULT ''"],
    ["matchday_id", "TEXT NOT NULL DEFAULT ''"],
    ["lineup_draft_count", "INTEGER NOT NULL DEFAULT 0"],
    ["transfer_history_count", "INTEGER NOT NULL DEFAULT 0"],
  ] as const;

  for (const [name, definition] of additions) {
    if (!names.has(name)) {
      database.exec(`ALTER TABLE saves ADD COLUMN ${name} ${definition}`);
    }
  }
}

export function getDatabase() {
  if (databaseInstance) {
    return databaseInstance;
  }

  ensureDataDirectory();
  databaseInstance = new Database(resolveDatabasePath());
  databaseInstance.pragma("journal_mode = WAL");
  databaseInstance.pragma("busy_timeout = 5000");
  databaseInstance.pragma("foreign_keys = ON");
  runMigrations(databaseInstance);
  return databaseInstance;
}

export function getDatabasePath() {
  return resolveDatabasePath();
}

export function closeDatabaseForMaintenance() {
  if (databaseInstance) {
    databaseInstance.close();
    databaseInstance = null;
  }
}

export function resetDatabaseForTests() {
  if (process.env.NODE_ENV !== "test" && process.env.VITEST !== "true") {
    throw new Error("resetDatabaseForTests may only run in the test environment.");
  }

  const databasePath = resolveDatabasePath();
  closeDatabaseForMaintenance();

  for (const filePath of [databasePath, `${databasePath}-wal`, `${databasePath}-shm`]) {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}
