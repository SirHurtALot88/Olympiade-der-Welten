import type { Season, SeasonState } from "@/lib/data/olyDataTypes";
import type { PersistedSeasonDerivationsRecord } from "@/lib/foundation/materialize-season-derivations";
import { getDatabase } from "@/lib/persistence/sqlite";
import { readSeasonDerivationsSidecar } from "@/lib/persistence/season-derivations-sidecar";

export type PersistedSeasonDerivationsProjection = {
  saveId: string;
  seasonId: string;
  contentSignature: string | null;
  persistedSeasonDerivations: PersistedSeasonDerivationsRecord | null;
  signatureMatches: boolean;
};

function parseJsonColumn<T>(value: string): T {
  return JSON.parse(value) as T;
}

function loadSingletonPayload<T>(tableName: string, saveId: string): T | null {
  const database = getDatabase();
  const row = database.prepare(`SELECT payload_json FROM ${tableName} WHERE save_id = ?`).get(saveId) as
    | { payload_json: string }
    | undefined;
  return row ? parseJsonColumn<T>(row.payload_json) : null;
}

/** Read persistedSeasonDerivations from SQLite without materializing full GameState. */
export function readPersistedSeasonDerivationsProjection(
  saveId: string,
  contentSignature?: string | null,
): PersistedSeasonDerivationsProjection | null {
  const database = getDatabase();
  const saveRow = database
    .prepare("SELECT save_id, content_signature FROM saves WHERE save_id = ?")
    .get(saveId) as { save_id: string; content_signature?: string } | undefined;

  if (!saveRow) {
    return null;
  }

  const season = loadSingletonPayload<Season>("seasons", saveId);
  const seasonState = loadSingletonPayload<SeasonState>("season_states", saveId);
  if (!season || !seasonState) {
    return null;
  }

  const embeddedPersisted = seasonState.persistedSeasonDerivations as
    | PersistedSeasonDerivationsRecord
    | null
    | undefined;
  const sidecarPersisted = readSeasonDerivationsSidecar(saveId);
  const rowSignature = saveRow.content_signature ?? null;
  const expectedSignature = contentSignature ?? rowSignature;

  const embeddedForSeason =
    embeddedPersisted && embeddedPersisted.seasonId === season.id ? embeddedPersisted : null;
  const sidecarForSeason =
    sidecarPersisted && sidecarPersisted.seasonId === season.id ? sidecarPersisted : null;

  const normalizedPersisted =
    expectedSignature &&
    sidecarForSeason?.contentSignature === expectedSignature
      ? sidecarForSeason
      : expectedSignature &&
          embeddedForSeason?.contentSignature === expectedSignature
        ? embeddedForSeason
        : sidecarForSeason ?? embeddedForSeason;

  return {
    saveId,
    seasonId: season.id,
    contentSignature: rowSignature,
    persistedSeasonDerivations: normalizedPersisted,
    signatureMatches: Boolean(
      normalizedPersisted &&
        expectedSignature &&
        normalizedPersisted.contentSignature === expectedSignature,
    ),
  };
}

export type SaveSliceHeadProjection = {
  saveId: string;
  season: Season;
  seasonState: SeasonState;
  contentSignature: string | null;
};

/** Minimal season + seasonState read for slice APIs (no players/teams materialize). */
export function readSaveSliceHeadProjection(saveId: string): SaveSliceHeadProjection | null {
  const database = getDatabase();
  const saveRow = database
    .prepare("SELECT save_id, content_signature FROM saves WHERE save_id = ?")
    .get(saveId) as { save_id: string; content_signature?: string } | undefined;

  if (!saveRow) {
    return null;
  }

  const season = loadSingletonPayload<Season>("seasons", saveId);
  const seasonState = loadSingletonPayload<SeasonState>("season_states", saveId);
  if (!season || !seasonState) {
    return null;
  }

  return {
    saveId,
    season,
    seasonState,
    contentSignature: saveRow.content_signature ?? null,
  };
}
