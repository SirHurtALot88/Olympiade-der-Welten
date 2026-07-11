import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { overwriteSaveFromSourceDb, readSaveDbSnapshot } from "@/lib/persistence/overwrite-save-from-source-db";
import { getDatabase, resetDatabaseForTests } from "@/lib/persistence/sqlite";

const previousSqlitePath = process.env.OLY_APP_SQLITE_PATH;
let tempDirectory = "";

function setTestDatabasePath(name: string) {
  tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), name));
  const databasePath = path.join(tempDirectory, `${name}.sqlite`);
  process.env.OLY_APP_SQLITE_PATH = databasePath;
  resetDatabaseForTests();
  return databasePath;
}

function seedMinimalSave(saveId: string, seasonId: string, gamePhase: string, rosterCount: number) {
  const database = getDatabase();
  const timestamp = new Date(Date.UTC(2026, 0, 1, 0, 0)).toISOString();
  database
    .prepare("INSERT INTO saves (save_id, name, status, created_at, updated_at) VALUES (?, ?, 'active', ?, ?)")
    .run(saveId, saveId, timestamp, timestamp);
  database.prepare("INSERT INTO seasons (save_id, payload_json) VALUES (?, ?)").run(saveId, JSON.stringify({ id: seasonId }));
  database.prepare("INSERT INTO season_states (save_id, payload_json) VALUES (?, ?)").run(saveId, JSON.stringify({}));
  database.prepare("INSERT INTO matchday_states (save_id, payload_json) VALUES (?, ?)").run(saveId, JSON.stringify({ seasonId }));
  database.prepare("INSERT INTO game_metadata (save_id, payload_json) VALUES (?, ?)").run(saveId, JSON.stringify({ gamePhase }));
  database.prepare("INSERT INTO mapping_reports (save_id, payload_json) VALUES (?, ?)").run(saveId, JSON.stringify({}));
  for (let index = 0; index < rosterCount; index += 1) {
    database
      .prepare("INSERT INTO rosters (save_id, roster_id, payload_json) VALUES (?, ?, ?)")
      .run(saveId, `${saveId}-roster-${index}`, JSON.stringify({ teamId: "team-a", playerId: `player-${index}` }));
  }
}

beforeEach(() => {
  tempDirectory = "";
});

afterEach(() => {
  resetDatabaseForTests();
  process.env.OLY_APP_SQLITE_PATH = previousSqlitePath;
  if (tempDirectory && fs.existsSync(tempDirectory)) {
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
});

describe("overwriteSaveFromSourceDb", () => {
  it("replaces one save snapshot while preserving other saves", () => {
    const sourcePath = setTestDatabasePath("oly-overwrite-source");
    seedMinimalSave("save-a", "season-10", "season_completed", 3);
    getDatabase().close();

    const targetPath = setTestDatabasePath("oly-overwrite-target");
    seedMinimalSave("save-a", "season-11", "season_active", 9);
    seedMinimalSave("save-b", "season-5", "season_active", 2);
    getDatabase().close();

    const result = overwriteSaveFromSourceDb({
      sourceDbPath: sourcePath,
      targetDbPath: targetPath,
      saveId: "save-a",
      preserveTargetStatus: true,
    });

    expect(result.targetSnapshotAfter.seasonId).toBe("season-10");
    expect(result.targetSnapshotAfter.gamePhase).toBe("season_completed");
    expect(result.targetSnapshotAfter.rosterCount).toBe(3);

    const verify = new Database(targetPath, { readonly: true });
    expect(readSaveDbSnapshot(verify, "save-b")?.rosterCount).toBe(2);
    verify.close();
  });
});
