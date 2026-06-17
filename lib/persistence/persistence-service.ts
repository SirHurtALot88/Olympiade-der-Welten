import { createSaveGameState, loadFreshSeasonOneSeedData, loadSeedData } from "@/lib/data/dataAdapter";
import { createSaveRepository } from "@/lib/persistence/save-repository";
import { withScenarioMeta } from "@/lib/persistence/scenario-meta";
import type { PersistenceService } from "@/lib/persistence/types";

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
    saveSingleplayerState(saveId, gameState) {
      return saveRepository.saveGameState({
        saveId,
        gameState,
      });
    },
    createSave(name) {
      const save = saveRepository.createSaveFromSeed({
        saveId: createSaveId(),
        name,
        status: "active",
        seedData: loadSeedData(),
      });

      return saveRepository.setActiveSave(save.saveId) ?? save;
    },
    createFreshSeasonOneSave(input) {
      const save = saveRepository.createSaveFromSeed({
        saveId: input?.saveId ?? createFreshSeasonOneSaveId(),
        name: input?.name ?? `Season 1 Teststart ${new Date().toLocaleString("de-DE")}`,
        status: "active",
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
          isStableTestPoint: true,
        }),
      });

      return saveRepository.setActiveSave(taggedSave.saveId) ?? taggedSave;
    },
    cloneSave(sourceSaveId, name) {
      return saveRepository.cloneSave({
        sourceSaveId,
        saveId: createSaveId(),
        name,
        status: "active",
      });
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
