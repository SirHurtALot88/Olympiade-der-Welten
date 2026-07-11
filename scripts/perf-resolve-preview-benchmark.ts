import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { loadSqliteLegacyMatchdayResolvePreview } from "@/lib/foundation/legacy-matchday-resolve-preview-service";

const RESOLVE_BUDGET_MS = 5000;
const ITERATIONS = 3;

function percentile(sorted: number[], p: number) {
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)] ?? 0;
}

async function main() {
  const persistence = createPersistenceService();
  const active = persistence.getActiveSave() ?? persistence.bootstrapSingleplayerSave().save;
  const saveId = active.saveId;
  const seasonId = active.gameState.season.id;
  const matchdayId = active.gameState.matchdayState.matchdayId;

  const samplesMs: number[] = [];
  let lastPayload = null;

  for (let index = 0; index < ITERATIONS; index += 1) {
    const startedAt = performance.now();
    lastPayload = loadSqliteLegacyMatchdayResolvePreview({
      saveId,
      seasonId,
      matchdayId,
    });
    samplesMs.push(performance.now() - startedAt);
  }

  const sorted = [...samplesMs].sort((left, right) => left - right);
  const medianMs = Math.round(percentile(sorted, 50));
  const p95Ms = Math.round(percentile(sorted, 95));

  if (!lastPayload) {
    throw new Error("Resolve preview payload could not be built.");
  }

  if (medianMs > RESOLVE_BUDGET_MS) {
    throw new Error(`Resolve preview exceeded budget: ${medianMs}ms > ${RESOLVE_BUDGET_MS}ms`);
  }

  console.log(
    JSON.stringify({
      ok: true,
      saveId,
      seasonId,
      matchdayId,
      iterations: ITERATIONS,
      medianMs,
      p95Ms,
      samplesMs: sorted.map((value) => Math.round(value)),
      teamCount: lastPayload.teamRows.length,
      budgetMs: RESOLVE_BUDGET_MS,
    }),
  );
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
