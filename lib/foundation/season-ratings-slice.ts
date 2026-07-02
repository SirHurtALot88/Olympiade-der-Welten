import type { GameState } from "@/lib/data/olyDataTypes";
import type { PlayerRatingContractRow } from "@/lib/foundation/player-rating-contract";
import {
  buildGameStateContentSignature,
  getSeasonDerivations,
  pickRatingsForPlayerIds,
} from "@/lib/foundation/get-season-derivations";

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

export function buildSeasonRatingsSlice(input: {
  gameState: GameState;
  saveId: string;
  seasonId?: string;
  contentSignature?: string | null;
  playerIds?: string[];
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

  const ratingsByPlayerId = Object.fromEntries(
    Array.from(ratingsById.entries()).map(([playerId, row]) => [playerId, toSliceRow(row)] as const),
  );

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
