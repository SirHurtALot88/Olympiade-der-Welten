import { backupSaveData } from "@/lib/persistence/save-backup";

async function main() {
  const result = await backupSaveData({ reason: process.env.OLY_SAVE_BACKUP_REASON ?? "manual-cli" });
  console.log(`Save backup written: ${result.backupDirectory}`);
  console.log(`Active save: ${result.manifest.activeSaveId ?? "none"}`);
  console.log(`Saves: ${result.manifest.saves.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

