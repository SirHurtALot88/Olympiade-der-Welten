import type { GameState, OlySeedData, SaveGameState, ScenarioMeta } from "@/lib/data/olyDataTypes";

export type SaveStatus = "active" | "archived" | "template";

export type SaveSummary = {
  saveId: string;
  name: string;
  status: SaveStatus;
  createdAt: string;
  updatedAt: string;
  scenarioMeta?: ScenarioMeta;
  saveMode?: "solo_1" | "solo_2" | "solo_4" | "online_4v4" | "custom";
};

export type PersistedSaveGame = SaveGameState & {
  name: string;
  status: SaveStatus;
};

export type PersistenceBootstrapResult = {
  save: PersistedSaveGame;
  createdFromSeed: boolean;
};

export type SaveRepository = {
  getActiveSave(): PersistedSaveGame | null;
  getSaveById(saveId: string): PersistedSaveGame | null;
  listSaves(): SaveSummary[];
  setActiveSave(saveId: string): PersistedSaveGame | null;
  createSaveFromSeed(input: {
    saveId: string;
    name: string;
    status: SaveStatus;
    seedData: OlySeedData;
  }): PersistedSaveGame;
  cloneSave(input: {
    sourceSaveId: string;
    saveId: string;
    name: string;
    status: SaveStatus;
  }): PersistedSaveGame;
  createScenarioSnapshot(input: {
    sourceSaveId: string;
    saveId: string;
    name: string;
    status: SaveStatus;
    scenarioMeta: ScenarioMeta;
  }): PersistedSaveGame;
  saveGameState(input: {
    saveId: string;
    name?: string;
    status?: SaveStatus;
    gameState: GameState;
  }): PersistedSaveGame;
};

export type PersistenceService = {
  bootstrapSingleplayerSave(): PersistenceBootstrapResult;
  getActiveSave(): PersistedSaveGame | null;
  getSaveById(saveId: string): PersistedSaveGame | null;
  saveSingleplayerState(saveId: string, gameState: GameState, input?: { status?: SaveStatus }): PersistedSaveGame;
  createSave(name: string): PersistedSaveGame;
  createFreshSeasonOneSave(input?: { saveId?: string; name?: string; status?: SaveStatus; activate?: boolean }): PersistedSaveGame;
  cloneSave(sourceSaveId: string, name: string): PersistedSaveGame;
  createScenarioSnapshot(input: {
    sourceSaveId: string;
    name: string;
    status?: SaveStatus;
    scenarioMeta: ScenarioMeta;
  }): PersistedSaveGame;
  activateSave(saveId: string): PersistedSaveGame | null;
  listSaves(): SaveSummary[];
};
