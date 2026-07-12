import type { GameState } from "@/lib/data/olyDataTypes";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";

export type DeferredPersistence = {
  /**
   * A PersistenceService drop-in that batches writes for ONE save id in memory
   * instead of hitting disk. Pass it to services that persist in a loop.
   */
  persistence: PersistenceService;
  /** Flush the accumulated in-memory state to the real store — call once at the end. */
  flush: () => PersistedSaveGame | null;
  /** How many deferred (in-memory) writes were captured — for logging/metrics. */
  writeCount: () => number;
  /** Whether there is unflushed state. */
  isDirty: () => boolean;
};

/**
 * Deferred-write persistence wrapper.
 *
 * Every save in this game is a full re-serialization of the whole (growing)
 * game state, so flows that persist once-per-entity in a loop (AI preseason
 * apply, season-end pipeline) pay that cost dozens of times per rollover.
 *
 * This wraps the real `PersistenceService`: `saveSingleplayerState` for the
 * target `saveId` only updates an in-memory snapshot (and returns a save-shaped
 * object so callers keep working), and `getSaveById`/`getActiveSave` read that
 * snapshot back — so a loop of preview→apply→re-read runs entirely in memory.
 * Call `flush()` once at the end to write the final state a single time.
 *
 * Writes to *other* save ids (unexpected during a batch) pass straight through
 * to the real store, so nothing is silently dropped.
 */
export function createDeferredPersistence(
  base: PersistenceService,
  seed: PersistedSaveGame,
): DeferredPersistence {
  let latest: PersistedSaveGame = seed;
  let dirty = false;
  let deferredWrites = 0;

  const persistence: PersistenceService = {
    bootstrapSingleplayerSave: () => base.bootstrapSingleplayerSave(),
    getActiveSave: () => {
      const active = base.getActiveSave();
      return active && active.saveId === latest.saveId ? latest : active;
    },
    getSaveById: (saveId) => (saveId === latest.saveId ? latest : base.getSaveById(saveId)),
    getSaveVersionMetadata: (saveId) => base.getSaveVersionMetadata(saveId),
    saveSingleplayerState: (saveId: string, gameState: GameState, input) => {
      if (saveId !== latest.saveId) {
        // Unexpected different save — do not defer, write it for real.
        return base.saveSingleplayerState(saveId, gameState, input);
      }
      latest = {
        ...latest,
        gameState,
        status: input?.status ?? latest.status,
      };
      dirty = true;
      deferredWrites += 1;
      return latest;
    },
    createSave: (name) => base.createSave(name),
    createFreshSeasonOneSave: (createInput) => base.createFreshSeasonOneSave(createInput),
    cloneSave: (sourceSaveId, name) => base.cloneSave(sourceSaveId, name),
    createScenarioSnapshot: (snapshotInput) => base.createScenarioSnapshot(snapshotInput),
    activateSave: (saveId) => base.activateSave(saveId),
    listSaves: () => base.listSaves(),
  };

  return {
    persistence,
    flush: () => {
      if (!dirty) {
        return latest;
      }
      const saved = base.saveSingleplayerState(latest.saveId, latest.gameState, { status: latest.status });
      latest = saved;
      dirty = false;
      return saved;
    },
    writeCount: () => deferredWrites,
    isDirty: () => dirty,
  };
}
