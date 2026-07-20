import type { GameState } from "@/lib/data/olyDataTypes";
import type { PlayerRatingContractRow } from "@/lib/foundation/player-rating-contract";
import {
  buildGameStateContentSignature,
  getSeasonDerivations,
  pickRatingsForPlayerIds,
} from "@/lib/foundation/get-season-derivations";
import {
  buildPlayerAttributeVisibilityResolver,
  type AttributeVisibility,
} from "@/lib/foundation/server-player-visibility";

export type SeasonRatingsSlicePlayerRow = Pick<
  PlayerRatingContractRow,
  | "playerId"
  | "rawOvrScore"
  | "ovrNormalized"
  | "ovrRank"
  | "ppsSeason"
  | "ppsSeasonRank"
  | "ppPow"
  | "ppPowRank"
  | "ppSpe"
  | "ppSpeRank"
  | "ppMen"
  | "ppMenRank"
  | "ppSoc"
  | "ppSocRank"
  | "ratingPps"
  | "mvs"
  | "mvsRank"
  | "marketValue"
  | "sourceStatus"
  | "warnings"
>;

export type SeasonRatingsSliceResponse = {
  scope: {
    saveId: string;
    seasonId: string;
    contentSignature: string;
  };
  ratingsByPlayerId: Record<string, SeasonRatingsSlicePlayerRow>;
  count: number;
  warnings: string[];
};

function toSliceRow(row: PlayerRatingContractRow): SeasonRatingsSlicePlayerRow {
  return {
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

/**
 * Fog-of-War-Maskierung für eine einzelne Ratings-Zeile (T-021). Bei
 * Sichtbarkeit `"scouted"` werden alle exakten Achsenwerte/Ränge/Marktwerte
 * genullt — analog zu `maskForeignAttributeStats` im Player-Detail-Drawer.
 * `sourceStatus`/`warnings` sind Datenqualitäts-Flags, keine Spoiler, und
 * bleiben erhalten.
 */
export function maskRatingsRowForVisibility(
  row: SeasonRatingsSlicePlayerRow,
  visibility: AttributeVisibility,
): SeasonRatingsSlicePlayerRow {
  if (visibility === "exact") {
    return row;
  }
  return {
    playerId: row.playerId,
    rawOvrScore: null,
    ovrNormalized: null,
    ovrRank: null,
    ppsSeason: null,
    ppsSeasonRank: null,
    ppPow: null,
    ppPowRank: null,
    ppSpe: null,
    ppSpeRank: null,
    ppMen: null,
    ppMenRank: null,
    ppSoc: null,
    ppSocRank: null,
    ratingPps: null,
    mvs: null,
    mvsRank: null,
    marketValue: null,
    sourceStatus: row.sourceStatus,
    warnings: row.warnings,
  };
}

/**
 * Maskiert eine komplette `ratingsByPlayerId`-Map anhand des anfragenden
 * Teams. Wird sowohl von `buildSeasonRatingsSlice` (Live-GameState-Pfad) als
 * auch von der `player-directory-slice`-Route (die dieselbe Zeilenform
 * wiederverwendet) genutzt.
 */
export function maskRatingsByPlayerIdForRequestingTeam(input: {
  ratingsByPlayerId: Record<string, SeasonRatingsSlicePlayerRow>;
  gameState: GameState;
  requestingTeamId?: string | null;
}): Record<string, SeasonRatingsSlicePlayerRow> {
  const resolveVisibility = buildPlayerAttributeVisibilityResolver({
    gameState: input.gameState,
    requestingTeamId: input.requestingTeamId,
  });
  return Object.fromEntries(
    Object.entries(input.ratingsByPlayerId).map(([playerId, row]) => [
      playerId,
      maskRatingsRowForVisibility(row, resolveVisibility(playerId)),
    ]),
  );
}

export function buildSeasonRatingsSlice(input: {
  gameState: GameState;
  saveId: string;
  seasonId?: string;
  contentSignature?: string | null;
  playerIds?: string[];
  /**
   * Anfragendes Team für die Fog-of-War-Maskierung (T-021). Ohne diesen
   * Wert (oder solange `DEBUG_FORCE_PLAYER_VISIBILITY` aktiv ist, aktuell
   * Default) bleibt das Verhalten unverändert — siehe
   * `resolvePlayerAttributeVisibility`.
   */
  requestingTeamId?: string | null;
}): SeasonRatingsSliceResponse {
  const seasonId = input.seasonId ?? input.gameState.season.id;
  const contentSignature = input.contentSignature ?? buildGameStateContentSignature(input.gameState);
  const derivations = getSeasonDerivations({
    gameState: input.gameState,
    saveId: input.saveId,
    seasonId,
    contentSignature,
  });

  const ratingsById =
    input.playerIds && input.playerIds.length > 0
      ? pickRatingsForPlayerIds(derivations.ratingsById, input.playerIds)
      : derivations.ratingsById;

  const rawRatingsByPlayerId = Object.fromEntries(
    Array.from(ratingsById.entries()).map(([playerId, row]) => [playerId, toSliceRow(row)] as const),
  );
  const ratingsByPlayerId = maskRatingsByPlayerIdForRequestingTeam({
    ratingsByPlayerId: rawRatingsByPlayerId,
    gameState: input.gameState,
    requestingTeamId: input.requestingTeamId,
  });

  return {
    scope: {
      saveId: input.saveId,
      seasonId,
      contentSignature,
    },
    ratingsByPlayerId,
    count: ratingsById.size,
    warnings: derivations.ledger.warnings,
  };
}

export function hydrateSeasonRatingsSliceMap(
  ratingsByPlayerId: Record<string, SeasonRatingsSlicePlayerRow>,
): Map<string, PlayerRatingContractRow> {
  return new Map(Object.entries(ratingsByPlayerId) as Array<[string, PlayerRatingContractRow]>);
}
