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

export type SaveVersionMetadata = {
  saveId: string;
  updatedAt: string;
  seasonId: string;
  matchdayId: string;
  contentSignature?: string;
  matchdayResults: unknown[];
  standingsApplyLogs: unknown[];
  seasonSnapshots: unknown[];
  disciplineResults: unknown[];
  saveVersion?: number;
  lineupDraftCount: number;
  transferHistoryCount: number;
};

export type PersistenceBootstrapResult = {
  save: PersistedSaveGame;
  createdFromSeed: boolean;
};

export type SaveRepository = {
  getActiveSave(): PersistedSaveGame | null;
  getSaveById(saveId: string): PersistedSaveGame | null;
  getSaveVersionMetadata(saveId: string): SaveVersionMetadata | null;
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
  /** Deletes a single save (and all child rows). Returns false if the save is the active save or doesn't exist. */
  deleteSave(saveId: string): boolean;
  /**
   * Deletes multiple saves in one transaction. The active save is always skipped (never
   * deleted). Returns the saveIds that were actually deleted (a subset of the input).
   */
  deleteSaves(saveIds: string[]): string[];
};

export type PersistenceService = {
  bootstrapSingleplayerSave(): PersistenceBootstrapResult;
  getActiveSave(): PersistedSaveGame | null;
  getSaveById(saveId: string): PersistedSaveGame | null;
  getSaveVersionMetadata(saveId: string): SaveVersionMetadata | null;
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
  /** Deletes a single save (and all child rows). Returns false if the save is the active save or doesn't exist. */
  deleteSave(saveId: string): boolean;
  /**
   * Deletes multiple saves in one transaction. The active save is always skipped (never
   * deleted). Returns the saveIds that were actually deleted (a subset of the input).
   */
  deleteSaves(saveIds: string[]): string[];
};
