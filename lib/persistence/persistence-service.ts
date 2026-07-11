import type { GameState } from "@/lib/data/olyDataTypes";
import { createSaveGameState, loadFreshSeasonOneSeedData, loadSeedData } from "@/lib/data/dataAdapter";
import { createSaveRepository } from "@/lib/persistence/save-repository";
import { withScenarioMeta } from "@/lib/persistence/scenario-meta";
import type { PersistenceService } from "@/lib/persistence/types";

/** Every persisted write bumps from the stored version so optimistic locking stays consistent. */
export function withNextSaveVersion(gameState: GameState, storedSaveVersion: number | null | undefined): GameState {
  return {
    ...gameState,
    saveVersion: (storedSaveVersion ?? 0) + 1,
  };
}

const SINGLEPLAYER_SAVE_ID = "save-singleplayer-dev";
const SINGLEPLAYER_SAVE_NAME = "Singleplayer Foundation";

function createSaveId() {
  return `save-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createFreshSeasonOneSaveId() {
  return `fresh-season-1-${Date.now()}`;
}

export function createPersistenceService(): PersistenceService {
  const saveRepository = createSaveRepository();

  return {
    bootstrapSingleplayerSave() {
      const active = saveRepository.getActiveSave();
      if (active) {
        return {
          save: active,
          createdFromSeed: false,
        };
      }

      const seedData = loadSeedData();
      const saveSeed = createSaveGameState(SINGLEPLAYER_SAVE_ID, seedData);
      const save = saveRepository.createSaveFromSeed({
        saveId: saveSeed.saveId,
        name: SINGLEPLAYER_SAVE_NAME,
        status: "active",
        seedData,
      });

      return {
        save,
        createdFromSeed: true,
      };
    },
    getActiveSave() {
      return saveRepository.getActiveSave();
    },
    getSaveById(saveId) {
      if (saveId === "active" || saveId === "current") {
        return saveRepository.getActiveSave();
      }
      return saveRepository.getSaveById(saveId);
    },
    getSaveVersionMetadata(saveId) {
      return saveRepository.getSaveVersionMetadata(saveId);
    },
    saveSingleplayerState(saveId, gameState, input) {
      const existing = saveRepository.getSaveById(saveId);
      const nextGameState = withNextSaveVersion(gameState, existing?.gameState.saveVersion);
      return saveRepository.saveGameState({
        saveId,
        status: input?.status ?? existing?.status,
        gameState: nextGameState,
      });
    },
    createSave(name) {
      const save = saveRepository.createSaveFromSeed({
        saveId: createSaveId(),
        name,
        status: "active",
        seedData: loadSeedData(),
      });
      const manualSave = saveRepository.saveGameState({
        saveId: save.saveId,
        name: save.name,
        status: save.status,
        gameState: withScenarioMeta(save.gameState, {
          saveCategory: "manual",
        }),
      });

      return saveRepository.setActiveSave(manualSave.saveId) ?? manualSave;
    },
    createFreshSeasonOneSave(input) {
      const status = input?.status ?? "active";
      const save = saveRepository.createSaveFromSeed({
        saveId: input?.saveId ?? createFreshSeasonOneSaveId(),
        name: input?.name ?? `Season 1 Teststart ${new Date().toLocaleString("de-DE")}`,
        status,
        seedData: loadFreshSeasonOneSeedData(),
      });
      const taggedSave = saveRepository.saveGameState({
        saveId: save.saveId,
        name: save.name,
        status: save.status,
        gameState: withScenarioMeta(save.gameState, {
          scenarioType: "fresh_start",
          label: save.name,
          description: "Fresh Season-1 Startsave aus lokalem Seed.",
          saveCategory: "pre-season",
          isStableTestPoint: true,
        }),
      });

      if (status === "active" && input?.activate !== false) {
        return saveRepository.setActiveSave(taggedSave.saveId) ?? taggedSave;
      }

      return taggedSave;
    },
    cloneSave(sourceSaveId, name) {
      const clone = saveRepository.cloneSave({
        sourceSaveId,
        saveId: createSaveId(),
        name,
        status: "active",
      });
      const manualClone = saveRepository.saveGameState({
        saveId: clone.saveId,
        name: clone.name,
        status: clone.status,
        gameState: withScenarioMeta(clone.gameState, {
          saveCategory: "manual",
        }),
      });
      return saveRepository.setActiveSave(manualClone.saveId) ?? manualClone;
    },
    createScenarioSnapshot(input) {
      const source = saveRepository.getSaveById(input.sourceSaveId);
      if (!source) {
        throw new Error(`Source save ${input.sourceSaveId} could not be found.`);
      }
      return saveRepository.createScenarioSnapshot({
        sourceSaveId: input.sourceSaveId,
        saveId: createSaveId(),
        name: input.name,
        status: input.status ?? "active",
        scenarioMeta: {
          ...input.scenarioMeta,
          sourceSaveId: input.scenarioMeta.sourceSaveId ?? input.sourceSaveId,
          saveCategory: input.scenarioMeta.saveCategory ?? "manual",
        },
      });
    },
    activateSave(saveId) {
      return saveRepository.setActiveSave(saveId);
    },
    listSaves() {
      return saveRepository.listSaves();
    },
  };
}
