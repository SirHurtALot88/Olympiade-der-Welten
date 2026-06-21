import { restoreSaveData } from "@/lib/persistence/save-backup";

async function main() {
  const backupFileOrFolder = process.argv[2];
  if (!backupFileOrFolder) {
    throw new Error("Usage: npm run restore:save -- <backup-file-or-folder>");
  }

  const result = await restoreSaveData({ backupFileOrFolder });
  console.log(`Save restored: ${result.restoredDatabasePath}`);
  console.log(`Safety backup: ${result.safetyBackupDirectory ?? "not needed; no previous database existed"}`);
  console.log(`Active save: ${result.restoredActiveSaveId}`);
  console.log(`Saves: ${result.restoredSaveCount}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

