import type { GameState } from "@/lib/data/olyDataTypes";
import type { SeasonRatingsSlicePlayerRow } from "@/lib/foundation/season-ratings-slice";
import type { PersistedSeasonDerivationsRecord } from "@/lib/foundation/materialize-season-derivations";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { readPersistedSeasonDerivationsProjection } from "@/lib/persistence/save-projection-read";
import { readSliceGameStateForSave } from "@/lib/persistence/save-repository";

export type ResolvedSliceSave = {
  saveId: string;
  gameState: GameState | null;
  projectionOnly: boolean;
  persistedRecord: PersistedSeasonDerivationsRecord | null;
  contentSignature: string | null;
  seasonId: string | null;
};

export function tryResolvePersistedRatingsSlice(input: {
  saveId?: string;
  seasonId?: string;
  contentSignature?: string | null;
  playerIds?: string[];
}): {
  saveId: string;
  seasonId: string;
  contentSignature: string;
  ratingsByPlayerId: Record<string, SeasonRatingsSlicePlayerRow>;
} | null {
  const persistence = createPersistenceService();
  const resolvedSaveId =
    input.saveId?.trim() ||
    persistence.getActiveSave()?.saveId ||
    persistence.bootstrapSingleplayerSave().save?.saveId ||
    null;

  if (!resolvedSaveId) {
    return null;
  }

  const projection = readPersistedSeasonDerivationsProjection(
    resolvedSaveId,
    input.contentSignature ?? null,
  );
  if (!projection?.signatureMatches || !projection.persistedSeasonDerivations) {
    return null;
  }

  const record = projection.persistedSeasonDerivations;
  const seasonId = input.seasonId ?? projection.seasonId ?? record.seasonId;
  const contentSignature =
    input.contentSignature?.trim() ||
    record.contentSignature ||
    projection.contentSignature ||
    null;

  if (!contentSignature) {
    return null;
  }

  return {
    saveId: resolvedSaveId,
    seasonId,
    contentSignature,
    ratingsByPlayerId: ratingsSliceRowsFromPersisted(record, input.playerIds),
  };
}

export function resolveSliceSave(input: {
  saveId?: string;
  contentSignature?: string | null;
  allowProjectionOnly?: boolean;
}): ResolvedSliceSave | null {
  const persistence = createPersistenceService();
  const resolvedSaveId =
    input.saveId?.trim() ||
    persistence.getActiveSave()?.saveId ||
    persistence.bootstrapSingleplayerSave().save?.saveId ||
    null;

  if (!resolvedSaveId) {
    return null;
  }

  const projection = readPersistedSeasonDerivationsProjection(resolvedSaveId, input.contentSignature ?? null);

  if (input.allowProjectionOnly && projection?.signatureMatches && projection.persistedSeasonDerivations) {
    const sliceGameState = readSliceGameStateForSave(resolvedSaveId);
    if (sliceGameState) {
      return {
        saveId: resolvedSaveId,
        gameState: {
          ...sliceGameState,
          seasonState: {
            ...sliceGameState.seasonState,
            persistedSeasonDerivations: projection.persistedSeasonDerivations,
          },
        },
        projectionOnly: true,
        persistedRecord: projection.persistedSeasonDerivations,
        contentSignature: projection.persistedSeasonDerivations.contentSignature,
        seasonId: projection.seasonId,
      };
    }
  }

  const save = persistence.getSaveById(resolvedSaveId);
  if (!save) {
    return null;
  }

  return {
    saveId: save.saveId,
    gameState: save.gameState,
    projectionOnly: false,
    persistedRecord: projection?.persistedSeasonDerivations ?? null,
    contentSignature: input.contentSignature ?? projection?.contentSignature ?? null,
    seasonId: save.gameState.season.id,
  };
}

export function ratingsSliceRowsFromPersisted(
  record: PersistedSeasonDerivationsRecord,
  playerIds?: string[],
): Record<string, SeasonRatingsSlicePlayerRow> {
  const allRows = record.ratingsByPlayerId;
  if (!playerIds || playerIds.length === 0) {
    return Object.fromEntries(
      Object.entries(allRows).map(([playerId, row]) => [
        playerId,
        {
          playerId: row.playerId,
          rawOvrScore: row.rawOvrScore,
          ovrNormalized: row.ovrNormalized,
          ovrRank: row.ovrRank,
          ppsSeason: row.ppsSeason,
          ppsSeasonRank: row.ppsSeasonRank,
          ppPow: row.ppPow,
          ppPowRank: row.ppPowRank,
          ppSpe: row.ppSpe,
          ppSpeRank: row.ppSpeRank,
          ppMen: row.ppMen,
          ppMenRank: row.ppMenRank,
          ppSoc: row.ppSoc,
          ppSocRank: row.ppSocRank,
          ratingPps: row.ratingPps,
          mvs: row.mvs,
          mvsRank: row.mvsRank,
          marketValue: row.marketValue,
          sourceStatus: row.sourceStatus,
          warnings: row.warnings,
        } satisfies SeasonRatingsSlicePlayerRow,
      ]),
    );
  }

  const filtered: Record<string, SeasonRatingsSlicePlayerRow> = {};
  for (const playerId of playerIds) {
    const row = allRows[playerId];
    if (!row) continue;
    filtered[playerId] = {
      playerId: row.playerId,
      rawOvrScore: row.rawOvrScore,
      ovrNormalized: row.ovrNormalized,
      ovrRank: row.ovrRank,
      ppsSeason: row.ppsSeason,
      ppsSeasonRank: row.ppsSeasonRank,
      ppPow: row.ppPow,
      ppPowRank: row.ppPowRank,
      ppSpe: row.ppSpe,
      ppSpeRank: row.ppSpeRank,
      ppMen: row.ppMen,
      ppMenRank: row.ppMenRank,
      ppSoc: row.ppSoc,
      ppSocRank: row.ppSocRank,
      ratingPps: row.ratingPps,
      mvs: row.mvs,
      mvsRank: row.mvsRank,
      marketValue: row.marketValue,
      sourceStatus: row.sourceStatus,
      warnings: row.warnings,
    };
  }
  return filtered;
}
