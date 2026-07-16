/**
 * Micro-benchmark for the AI manager-plan apply save-write cost.
 *
 * Creates a fresh Season-1 save (32 teams), runs applyAiManagerPlan once with a
 * counting persistence wrapper, and prints disk-write count + wall-clock time.
 *
 *   OLY_APP_SQLITE_PATH=/tmp/bench.sqlite npx tsx scripts/bench-ai-manager-apply.ts
 *
 * Measured (32 teams, 138 applied actions) before vs. after the
 * createCaptureBatchPersistence batching:
 *   before: 43 disk writes, ~43,600 ms
 *   after:   1 disk write,   ~2,100 ms   (~20× faster, writes -98%)
 */
import { performance } from "node:perf_hooks";

import { applyAiManagerPlan } from "@/lib/ai/ai-manager-apply-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import type { GameState } from "@/lib/data/olyDataTypes";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";

/** Wraps a real PersistenceService and counts disk-hitting saveSingleplayerState calls. */
function countingPersistence(base: PersistenceService): { p: PersistenceService; writes: () => number } {
  let writes = 0;
  const p: PersistenceService = {
    bootstrapSingleplayerSave: () => base.bootstrapSingleplayerSave(),
    getActiveSave: () => base.getActiveSave(),
    getSaveById: (id) => base.getSaveById(id),
    getSaveVersionMetadata: (id) => base.getSaveVersionMetadata(id),
    saveSingleplayerState: (id: string, gs: GameState, input) => {
      writes += 1;
      return base.saveSingleplayerState(id, gs, input);
    },
    createSave: (n) => base.createSave(n),
    createFreshSeasonOneSave: (i) => base.createFreshSeasonOneSave(i),
    cloneSave: (s, n) => base.cloneSave(s, n),
    createScenarioSnapshot: (i) => base.createScenarioSnapshot(i),
    activateSave: (id) => base.activateSave(id),
    listSaves: () => base.listSaves(),
    deleteSave: (id) => base.deleteSave(id),
    deleteSaves: (ids) => base.deleteSaves(ids),
  };
  return { p, writes: () => writes };
}

function main() {
  const base = createPersistenceService();
  // Fresh Season-1 save = 32 teams with preseason manager actions to apply.
  const fresh: PersistedSaveGame = base.createFreshSeasonOneSave({ activate: true });
  const teams = fresh.gameState.teams.length;

  const counter = countingPersistence(base);
  const t0 = performance.now();
  const result = applyAiManagerPlan({
    save: fresh,
    dryRun: false,
    persistence: counter.p,
  });
  const ms = performance.now() - t0;

  console.log(
    JSON.stringify(
      {
        teams,
        appliedActions: result.actions.filter((a) => a.applied).length,
        totalActions: result.actions.length,
        diskWrites: counter.writes(),
        ms: Math.round(ms),
      },
      null,
      2,
    ),
  );
}

main();
