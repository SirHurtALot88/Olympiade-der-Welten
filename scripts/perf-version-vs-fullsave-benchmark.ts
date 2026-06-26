import { createPersistenceService } from "@/lib/persistence/persistence-service";

const ITERATIONS = 10;

function percentile(sorted: number[], p: number) {
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)] ?? 0;
}

function stats(samplesMs: number[]) {
  const sorted = [...samplesMs].sort((left, right) => left - right);
  return {
    samplesMs: sorted.map((value) => Math.round(value)),
    medianMs: Math.round(percentile(sorted, 50)),
    p95Ms: Math.round(percentile(sorted, 95)),
  };
}

async function main() {
  const persistence = createPersistenceService();
  const active = persistence.getActiveSave() ?? persistence.bootstrapSingleplayerSave().save;
  const saveId = active.saveId;

  const versionSamples: number[] = [];
  const fullSaveSamples: number[] = [];

  for (let index = 0; index < ITERATIONS; index += 1) {
    let startedAt = performance.now();
    const versionMeta = persistence.getSaveVersionMetadata(saveId);
    versionSamples.push(performance.now() - startedAt);
    if (!versionMeta) {
      throw new Error("getSaveVersionMetadata returned null");
    }

    startedAt = performance.now();
    const fullSave = persistence.getSaveById(saveId);
    fullSaveSamples.push(performance.now() - startedAt);
    if (!fullSave) {
      throw new Error("getSaveById returned null");
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        saveId,
        iterations: ITERATIONS,
        versionMetadata: stats(versionSamples),
        fullSaveLoad: stats(fullSaveSamples),
        speedupFactor:
          stats(fullSaveSamples).medianMs > 0
            ? Number((stats(fullSaveSamples).medianMs / Math.max(stats(versionSamples).medianMs, 1)).toFixed(1))
            : null,
        contentSignature: persistence.getSaveVersionMetadata(saveId)?.contentSignature?.slice(0, 80) ?? null,
      },
      null,
      2,
    ),
  );
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
