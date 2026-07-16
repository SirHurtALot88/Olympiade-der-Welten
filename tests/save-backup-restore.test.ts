import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { backupSaveData, restoreSaveData } from "@/lib/persistence/save-backup";
import { closeDatabaseForMaintenance, getDatabase, resetDatabaseForTests } from "@/lib/persistence/sqlite";

const previousSqlitePath = process.env.OLY_APP_SQLITE_PATH;
let tempDirectory = "";
let databasePath = "";

function setTestDatabasePath() {
  tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "oly-save-backup-test-"));
  databasePath = path.join(tempDirectory, "data", "oly-app.sqlite");
  process.env.OLY_APP_SQLITE_PATH = databasePath;
}

function insertReadableSave(input: { saveId: string; status?: "active" | "archived"; name?: string }) {
  const database = getDatabase();
  const timestamp = new Date(Date.UTC(2026, 0, 1, 0, 0)).toISOString();
  database
    .prepare(
      `INSERT INTO saves (save_id, name, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(input.saveId, input.name ?? input.saveId, input.status ?? "active", timestamp, timestamp);
  database
    .prepare("INSERT INTO game_metadata (save_id, payload_json) VALUES (?, ?)")
    .run(
      input.saveId,
      JSON.stringify({
        scenarioMeta: {
          scenarioType: "new_game",
          label: input.name ?? input.saveId,
          saveCategory: "manual",
          createdAt: timestamp,
        },
      }),
    );
}

function activeSaveId() {
  return (
    getDatabase()
      .prepare("SELECT save_id FROM saves WHERE status = 'active' ORDER BY updated_at DESC LIMIT 1")
      .get() as { save_id: string } | undefined
  )?.save_id;
}

beforeEach(() => {
  setTestDatabasePath();
  resetDatabaseForTests();
});

afterEach(() => {
  resetDatabaseForTests();
  process.env.OLY_APP_SQLITE_PATH = previousSqlitePath;
  if (tempDirectory && fs.existsSync(tempDirectory)) {
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
});

describe("save backup and restore", () => {
  it("writes a timestamped backup manifest with active save metadata", async () => {
    insertReadableSave({ saveId: "save-active", name: "Active Manual Save" });

    const result = await backupSaveData({
      databasePath,
      backupRoot: path.join(tempDirectory, "backups"),
      createdAt: new Date(Date.UTC(2026, 5, 19, 12, 0, 0)),
      reason: "pre-deploy",
    });

    expect(fs.existsSync(result.databaseBackupPath)).toBe(true);
    expect(fs.existsSync(result.manifestPath)).toBe(true);
    expect(result.manifest.reason).toBe("pre-deploy");
    expect(result.manifest.activeSaveId).toBe("save-active");
    expect(result.manifest.database.sizeBytes).toBeGreaterThan(0);
    expect(result.manifest.saves[0]).toMatchObject({
      saveId: "save-active",
      name: "Active Manual Save",
      status: "active",
      saveCategory: "manual",
    });
  });

  it("restores a backup and creates a safety backup first", async () => {
    insertReadableSave({ saveId: "save-before" });
    const backup = await backupSaveData({
      databasePath,
      backupRoot: path.join(tempDirectory, "backups"),
      reason: "test-backup",
    });

    resetDatabaseForTests();
    insertReadableSave({ saveId: "save-after" });
    expect(activeSaveId()).toBe("save-after");
    closeDatabaseForMaintenance();

    const result = await restoreSaveData({
      backupFileOrFolder: backup.backupDirectory,
      databasePath,
      safetyBackupRoot: path.join(tempDirectory, "restore-safety"),
    });

    expect(result.safetyBackupDirectory).not.toBeNull();
    expect(result.restoredActiveSaveId).toBe("save-before");
    expect(activeSaveId()).toBe("save-before");
    expect(fs.existsSync(path.join(result.safetyBackupDirectory!, "oly-app.sqlite"))).toBe(true);
  });

  it("fails invalid restore paths safely without replacing the current save", async () => {
    insertReadableSave({ saveId: "save-current" });
    closeDatabaseForMaintenance();

    await expect(
      restoreSaveData({
        backupFileOrFolder: path.join(tempDirectory, "missing-backup"),
        databasePath,
        safetyBackupRoot: path.join(tempDirectory, "restore-safety"),
      }),
    ).rejects.toThrow(/does not exist/);

    expect(activeSaveId()).toBe("save-current");
  });
});
