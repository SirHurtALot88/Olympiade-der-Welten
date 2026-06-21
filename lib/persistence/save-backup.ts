import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

import Database from "better-sqlite3";

import { closeDatabaseForMaintenance, getDatabasePath } from "@/lib/persistence/sqlite";

type SaveBackupManifestSave = {
  saveId: string;
  name: string;
  status: string;
  updatedAt: string;
  saveCategory: string | null;
};

export type SaveBackupManifest = {
  schemaVersion: "oly-save-backup-v1";
  createdAt: string;
  reason: string;
  appVersion: string | null;
  gitCommit: string | null;
  database: {
    sourcePath: string;
    backupFile: string;
    sizeBytes: number;
  };
  activeSaveId: string | null;
  saves: SaveBackupManifestSave[];
};

export type SaveBackupResult = {
  backupDirectory: string;
  databaseBackupPath: string;
  manifestPath: string;
  manifest: SaveBackupManifest;
};

export type RestoreSaveBackupResult = {
  restoredDatabasePath: string;
  safetyBackupDirectory: string | null;
  restoredActiveSaveId: string;
  restoredSaveCount: number;
};

function timestampForPath(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

function projectRoot() {
  return process.cwd();
}

function defaultBackupRoot() {
  return path.join(projectRoot(), "backups", "saves");
}

function defaultRestoreSafetyRoot() {
  return path.join(projectRoot(), "backups", "restore-safety");
}

function readPackageVersion() {
  try {
    const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot(), "package.json"), "utf8")) as {
      version?: unknown;
    };
    return typeof packageJson.version === "string" ? packageJson.version : null;
  } catch {
    return null;
  }
}

function readGitCommit() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: projectRoot(),
      encoding: "utf8",
      timeout: 1000,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function readSaveManifestRows(databasePath: string) {
  const database = new Database(databasePath, { readonly: true, fileMustExist: true });
  try {
    const rows = database
      .prepare(
        `SELECT saves.save_id, saves.name, saves.status, saves.updated_at, game_metadata.payload_json AS metadata_json
         FROM saves
         LEFT JOIN game_metadata ON game_metadata.save_id = saves.save_id
         ORDER BY saves.updated_at DESC, saves.created_at DESC, saves.save_id DESC`,
      )
      .all() as Array<{
      save_id: string;
      name: string;
      status: string;
      updated_at: string;
      metadata_json: string | null;
    }>;

    return rows.map<SaveBackupManifestSave>((row) => {
      let saveCategory: string | null = null;
      if (row.metadata_json) {
        try {
          const metadata = JSON.parse(row.metadata_json) as {
            saveCategory?: unknown;
            scenarioMeta?: { saveCategory?: unknown } | null;
          };
          const category = metadata.scenarioMeta?.saveCategory ?? metadata.saveCategory;
          saveCategory = typeof category === "string" ? category : null;
        } catch {
          saveCategory = null;
        }
      }

      return {
        saveId: row.save_id,
        name: row.name,
        status: row.status,
        updatedAt: row.updated_at,
        saveCategory,
      };
    });
  } finally {
    database.close();
  }
}

async function createConsistentSqliteCopy(sourcePath: string, destinationPath: string) {
  const database = new Database(sourcePath, { readonly: true, fileMustExist: true });
  try {
    await database.backup(destinationPath);
  } finally {
    database.close();
  }
}

export async function backupSaveData(input: {
  databasePath?: string;
  backupRoot?: string;
  reason?: string;
  createdAt?: Date;
} = {}): Promise<SaveBackupResult> {
  const databasePath = input.databasePath ?? getDatabasePath();
  if (!fs.existsSync(databasePath)) {
    throw new Error(`SQLite database not found at ${databasePath}`);
  }

  const createdAt = input.createdAt ?? new Date();
  const backupDirectory = path.join(input.backupRoot ?? defaultBackupRoot(), timestampForPath(createdAt));
  fs.mkdirSync(backupDirectory, { recursive: true });

  const databaseBackupPath = path.join(backupDirectory, "oly-app.sqlite");
  await createConsistentSqliteCopy(databasePath, databaseBackupPath);

  const saves = readSaveManifestRows(databaseBackupPath);
  const activeSave = saves.find((save) => save.status === "active") ?? null;
  const manifest: SaveBackupManifest = {
    schemaVersion: "oly-save-backup-v1",
    createdAt: createdAt.toISOString(),
    reason: input.reason ?? "manual",
    appVersion: readPackageVersion(),
    gitCommit: readGitCommit(),
    database: {
      sourcePath: databasePath,
      backupFile: path.basename(databaseBackupPath),
      sizeBytes: fs.statSync(databaseBackupPath).size,
    },
    activeSaveId: activeSave?.saveId ?? null,
    saves,
  };

  const manifestPath = path.join(backupDirectory, "manifest.json");
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  return {
    backupDirectory,
    databaseBackupPath,
    manifestPath,
    manifest,
  };
}

function resolveBackupDatabasePath(backupFileOrFolder: string) {
  const resolved = path.resolve(backupFileOrFolder);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Backup path does not exist: ${resolved}`);
  }

  const stats = fs.statSync(resolved);
  if (stats.isDirectory()) {
    const databasePath = path.join(resolved, "oly-app.sqlite");
    if (!fs.existsSync(databasePath)) {
      throw new Error(`Backup folder does not contain oly-app.sqlite: ${resolved}`);
    }
    return databasePath;
  }

  if (!stats.isFile()) {
    throw new Error(`Backup path is neither a folder nor a file: ${resolved}`);
  }

  return resolved;
}

function removeSqliteSidecarFiles(databasePath: string) {
  for (const sidecarPath of [`${databasePath}-wal`, `${databasePath}-shm`]) {
    if (fs.existsSync(sidecarPath)) {
      fs.unlinkSync(sidecarPath);
    }
  }
}

function verifyRestoredDatabase(databasePath: string) {
  const database = new Database(databasePath, { readonly: true, fileMustExist: true });
  try {
    const saveCount = (database.prepare("SELECT COUNT(*) AS count FROM saves").get() as { count: number }).count;
    const activeSave = database
      .prepare("SELECT save_id FROM saves WHERE status = 'active' ORDER BY updated_at DESC LIMIT 1")
      .get() as { save_id: string } | undefined;
    if (!saveCount || !activeSave?.save_id) {
      throw new Error("Restored database has no readable active save.");
    }
    return {
      saveCount,
      activeSaveId: activeSave.save_id,
    };
  } finally {
    database.close();
  }
}

export async function restoreSaveData(input: {
  backupFileOrFolder: string;
  databasePath?: string;
  safetyBackupRoot?: string;
}): Promise<RestoreSaveBackupResult> {
  const databasePath = input.databasePath ?? getDatabasePath();
  const backupDatabasePath = resolveBackupDatabasePath(input.backupFileOrFolder);
  verifyRestoredDatabase(backupDatabasePath);

  let safetyBackupDirectory: string | null = null;
  if (fs.existsSync(databasePath)) {
    const safety = await backupSaveData({
      databasePath,
      backupRoot: input.safetyBackupRoot ?? defaultRestoreSafetyRoot(),
      reason: "pre-restore-safety",
    });
    safetyBackupDirectory = safety.backupDirectory;
  } else {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  }

  closeDatabaseForMaintenance();
  fs.copyFileSync(backupDatabasePath, databasePath);
  removeSqliteSidecarFiles(databasePath);

  const verified = verifyRestoredDatabase(databasePath);
  return {
    restoredDatabasePath: databasePath,
    safetyBackupDirectory,
    restoredActiveSaveId: verified.activeSaveId,
    restoredSaveCount: verified.saveCount,
  };
}
