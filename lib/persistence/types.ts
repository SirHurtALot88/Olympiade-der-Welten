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
  /**
   * Resolves the active save. When `ownerId` is supplied and that owner has a per-owner
   * `active_saves` pointer to a still-existing save, that save is returned; otherwise it falls
   * back to the global (status='active', most recent) behavior. Omitting `ownerId` (auth off /
   * solo) is byte-for-byte the original single-global-active-save behavior.
   */
  getActiveSave(ownerId?: string | null): PersistedSaveGame | null;
  getSaveById(saveId: string): PersistedSaveGame | null;
  getSaveVersionMetadata(saveId: string): SaveVersionMetadata | null;
  listSaves(): SaveSummary[];
  /**
   * Activates a save. With `ownerId` it upserts ONLY that owner's `active_saves` pointer (and
   * marks the save active for compatibility) without archiving any other owner's active save.
   * Without `ownerId` it keeps the global behavior: blanket-archive every other active save,
   * then mark this one active.
   */
  setActiveSave(saveId: string, ownerId?: string | null): PersistedSaveGame | null;
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
  /** See SaveRepository.getActiveSave — resolves the per-owner active save (or global fallback). */
  getActiveSave(ownerId?: string | null): PersistedSaveGame | null;
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
  /** See SaveRepository.setActiveSave — activates per-owner (no blanket archive) or globally. */
  activateSave(saveId: string, ownerId?: string | null): PersistedSaveGame | null;
  listSaves(): SaveSummary[];
  /** Deletes a single save (and all child rows). Returns false if the save is the active save or doesn't exist. */
  deleteSave(saveId: string): boolean;
  /**
   * Deletes multiple saves in one transaction. The active save is always skipped (never
   * deleted). Returns the saveIds that were actually deleted (a subset of the input).
   */
  deleteSaves(saveIds: string[]): string[];
};
