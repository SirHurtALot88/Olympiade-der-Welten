import { createPersistenceService } from "@/lib/persistence/persistence-service";

const VERSION_BUDGET_MS = 250;

async function main() {
  const persistence = createPersistenceService();
  const active = persistence.getActiveSave() ?? persistence.bootstrapSingleplayerSave().save;
  const startedAt = performance.now();
  const versionMeta = persistence.getSaveVersionMetadata(active.saveId);
  const elapsedMs = performance.now() - startedAt;

  if (!versionMeta) {
    throw new Error("Version metadata could not be loaded.");
  }

  if (elapsedMs > VERSION_BUDGET_MS) {
    throw new Error(`Version metadata load exceeded budget: ${Math.round(elapsedMs)}ms > ${VERSION_BUDGET_MS}ms`);
  }

  console.log(
    JSON.stringify({
      ok: true,
      saveId: versionMeta.saveId,
      elapsedMs: Math.round(elapsedMs),
      saveVersion: versionMeta.saveVersion,
      lineupDraftCount: versionMeta.lineupDraftCount,
    }),
  );
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
