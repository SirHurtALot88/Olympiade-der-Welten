import { useMemo } from "react";

import { getPlayerPortraitMediaModel } from "@/lib/data/mediaAssets";
import type { GameState, Player, RosterEntry, TeamSeasonObjectiveRecord } from "@/lib/data/olyDataTypes";
import {
  resolvePlayerDisplayMvs,
  resolvePlayerDisplayPps,
  type PlayerRatingContractRow,
} from "@/lib/foundation/player-rating-contract";
import { buildSeasonPointsLedger, type SeasonPointsLedger } from "@/lib/foundation/season-points-ledger";
import {
  buildMarketRosterPreviousSeasonAxisByPlayerId,
  type MarketRosterPreviousSeasonAxisStats,
} from "@/lib/market/transfermarkt-roster-previous-season-axis";
import { getTransferWindowStatus } from "@/lib/market/transfer-window-policy";
import { getTransfermarktBracket, getTransfermarktBracketRange } from "@/lib/market/transfermarkt-fit";
import { isFoundationTeamManagementLocked } from "@/lib/foundation/foundation-admin-dev-flags";
import { buildPlayerStarScoutingSnapshot } from "@/lib/scouting/player-star-scouting-bridge";
import { buildPlayerDevelopmentInsight } from "@/lib/progression/player-potential-service";
import { computeCurrentAbilityScore } from "@/lib/scouting/current-ability-score";
import { buildScoutPipelineSummary } from "@/lib/scouting/facility-scout-pipeline-service";
import { getActiveScoutingWishlistEntries } from "@/lib/scouting/scouting-wishlist-slots";
import { getScoutingWatchlistForTeam } from "@/lib/scouting/scouting-watchlist-service";

export type TransferMarketV2RosterRow = {
  activePlayerId: string;
  playerId: string;
  teamId: string;
  name: string;
  className: string;
  race: string;
  portraitUrl: string | null;
  marketValue: number | null;
  salary: number | null;
  contractLength: number | null;
  pps: number | null;
  ovr: number | null;
  mvs: number | null;
  valueScore: number | null;
  pow: number | null;
  spe: number | null;
  men: number | null;
  soc: number | null;
  disciplineRatings: Player["disciplineRatings"];
  previousSeasonAxis: MarketRosterPreviousSeasonAxisStats | null;
  /** "Neuer Look" CA/PO-Sterne — fog-korrekt: bekannte (eigene) Teams voll aufgedeckt. */
  known: boolean;
  caStars: number | null;
  poStarRange: { min: number; max: number } | null;
  caScore: number | null;
  poScoreRange: { min: number; max: number } | null;
  /** Marktwert-Bracket (1–9) + zugehörige MW-Spanne (Mio). */
  bracket: number | null;
  bracketRange: { min: number; max: number | null } | null;
};

export function buildMarketV2ClientKey(activeSaveId: string, seasonId: string): string {
  return `market-v2-${activeSaveId}-${seasonId}`;
}

export function buildTransferMarketV2RosterRows(input: {
  gameState: GameState;
  playerRatingsById: Map<string, PlayerRatingContractRow>;
  seasonPointsLedger?: SeasonPointsLedger | null;
  saveId?: string;
  manageableTeamIds?: string[];
  getRosterEntryDisplayMarketValue: (
    entry?: Pick<RosterEntry, "currentValue" | "purchasePrice"> | null,
    player?: Player | null,
  ) => number | null;
  getRosterEntryDisplaySalary: (entry: Pick<RosterEntry, "salary">, player?: Player | null) => number | null;
}): TransferMarketV2RosterRow[] {
  const playersById = new Map(input.gameState.players.map((player) => [player.id, player] as const));
  const seasonPointsLedger =
    input.seasonPointsLedger === undefined ? buildSeasonPointsLedger(input.gameState) : input.seasonPointsLedger;
  const previousSeasonAxisByPlayerId = buildMarketRosterPreviousSeasonAxisByPlayerId(input.gameState);
  const saveId = input.saveId ?? "default";

  return input.gameState.rosters
    .map((entry): TransferMarketV2RosterRow | null => {
      const player = playersById.get(entry.playerId);
      if (!player) {
        return null;
      }
      const playerRating = input.playerRatingsById.get(player.id) ?? null;
      const portrait = getPlayerPortraitMediaModel(player);
      const salary = input.getRosterEntryDisplaySalary(entry, player);
      const pps = resolvePlayerDisplayPps({
        playerRating,
        seasonPointsLedger,
        playerId: player.id,
      });
      const mvs = resolvePlayerDisplayMvs({ playerRating });
      const marketValue = input.getRosterEntryDisplayMarketValue(entry, player);
      const bracket = marketValue == null ? null : getTransfermarktBracket(marketValue);
      const bracketRange = bracket == null ? null : getTransfermarktBracketRange(bracket);
      // CA/PO-Sterne fog-korrekt: nur eigene (steuerbare) Teams voll aufgedeckt
      // (Scouting-Level 5), fremde Teams bleiben ungescoutet (Level 0). Nutzt den
      // gemeinsamen Sterne-Bridge-Snapshot wie Kader/Scouting — keine eigene Fog-Logik.
      const known = !isFoundationTeamManagementLocked(entry.teamId, input.manageableTeamIds);
      const scoutingLevel = known ? 5 : 0;
      const starSnapshot = buildPlayerStarScoutingSnapshot({
        gameState: input.gameState,
        player,
        saveId,
        scoutingLevel,
      });
      const developmentInsight = buildPlayerDevelopmentInsight({
        gameState: input.gameState,
        player,
        currentRating: computeCurrentAbilityScore(player.coreStats),
        scoutingLevel,
      });
      return {
        known,
        caStars: starSnapshot.revealedCurrentStars.overall,
        poStarRange:
          starSnapshot.revealedPotentialStars.overallMin != null &&
          starSnapshot.revealedPotentialStars.overallMax != null
            ? {
                min: starSnapshot.revealedPotentialStars.overallMin,
                max: starSnapshot.revealedPotentialStars.overallMax,
              }
            : null,
        caScore: developmentInsight.currentRating ?? null,
        poScoreRange: developmentInsight.potentialRangeDisplay ?? null,
        bracket,
        bracketRange,
        activePlayerId: entry.id,
        playerId: player.id,
        teamId: entry.teamId,
        name: player.name,
        className: player.className,
        race: player.race,
        portraitUrl: portrait.src ?? null,
        marketValue,
        salary,
        contractLength: entry.contractLength ?? null,
        pps,
        ovr: playerRating?.ovrNormalized ?? player.ovr ?? null,
        mvs,
        valueScore: pps != null && salary != null && salary > 0 ? pps / salary : null,
        pow: player.coreStats.pow ?? null,
        spe: player.coreStats.spe ?? null,
        men: player.coreStats.men ?? null,
        soc: player.coreStats.soc ?? null,
        disciplineRatings: player.disciplineRatings,
        previousSeasonAxis: previousSeasonAxisByPlayerId.get(player.id) ?? null,
      };
    })
    .filter((row): row is TransferMarketV2RosterRow => Boolean(row));
}

export function buildTransferMarketScoutingWatchPlayerIds(
  gameState: GameState,
  activeManagerTeamId: string | null,
): string[] {
  if (!activeManagerTeamId) {
    return [];
  }
  return getScoutingWatchlistForTeam(gameState, activeManagerTeamId).map((entry) => entry.playerId);
}

export function buildTransferMarketScoutingIntelByPlayerId(
  gameState: GameState,
  activeManagerTeamId: string | null,
): Record<string, number> {
  if (!activeManagerTeamId) {
    return {};
  }
  const scoutPipeline = buildScoutPipelineSummary(gameState, activeManagerTeamId);
  return Object.fromEntries(scoutPipeline.records.map((record) => [record.playerId, record.certainty]));
}

export function buildTransferMarketActiveWishlistPlayerIds(
  gameState: GameState,
  activeManagerTeamId: string | null,
): string[] {
  if (!activeManagerTeamId) {
    return [];
  }
  return getActiveScoutingWishlistEntries(gameState, activeManagerTeamId).map((entry) => entry.playerId);
}

export function buildSelectedTransfermarktBoardObjectives(
  selectedTeamObjectives: TeamSeasonObjectiveRecord[],
): TeamSeasonObjectiveRecord[] {
  return selectedTeamObjectives
    .filter((objective) => objective.status === "open" || objective.status === "at_risk" || objective.status === "failed")
    .filter(
      (objective) =>
        objective.category === "transfer" ||
        objective.category === "player" ||
        objective.category === "roster" ||
        objective.objectiveId === "finance-salary-ratio" ||
        objective.objectiveId === "finance-rebuild-cash-buffer",
    )
    .slice(0, 3);
}

export interface UseMarketV2DerivationsInput {
  gameState: GameState;
  activeSaveId: string;
  activeManagerTeamId: string | null;
  manageableTeamIds?: string[];
  playerRatingsById: Map<string, PlayerRatingContractRow>;
  seasonPointsLedger?: SeasonPointsLedger | null;
  selectedTeamObjectives: TeamSeasonObjectiveRecord[];
  getRosterEntryDisplayMarketValue: (
    entry?: Pick<RosterEntry, "currentValue" | "purchasePrice"> | null,
    player?: Player | null,
  ) => number | null;
  getRosterEntryDisplaySalary: (entry: Pick<RosterEntry, "salary">, player?: Player | null) => number | null;
}

/**
 * Market V2 panel derivations (Strangler Phase 5.3). Runs only while
 * `FoundationMarketV2ShellHost` is mounted (`activeView === "marketV2"`).
 */
export function useMarketV2Derivations(input: UseMarketV2DerivationsInput) {
  const transferWindowStatus = useMemo(() => getTransferWindowStatus(input.gameState), [input.gameState]);

  const clientKey = useMemo(
    () => buildMarketV2ClientKey(input.activeSaveId, input.gameState.season.id),
    [input.activeSaveId, input.gameState.season.id],
  );

  const transferMarketV2RosterRows = useMemo(
    () =>
      buildTransferMarketV2RosterRows({
        gameState: input.gameState,
        playerRatingsById: input.playerRatingsById,
        seasonPointsLedger: input.seasonPointsLedger,
        saveId: input.activeSaveId,
        manageableTeamIds: input.manageableTeamIds,
        getRosterEntryDisplayMarketValue: input.getRosterEntryDisplayMarketValue,
        getRosterEntryDisplaySalary: input.getRosterEntryDisplaySalary,
      }),
    [
      input.activeSaveId,
      input.gameState,
      input.getRosterEntryDisplayMarketValue,
      input.getRosterEntryDisplaySalary,
      input.manageableTeamIds,
      input.playerRatingsById,
      input.seasonPointsLedger,
    ],
  );

  const transferMarketScoutingWatchPlayerIds = useMemo(
    () => buildTransferMarketScoutingWatchPlayerIds(input.gameState, input.activeManagerTeamId),
    [input.activeManagerTeamId, input.gameState],
  );

  const transferMarketScoutingIntelByPlayerId = useMemo(
    () => buildTransferMarketScoutingIntelByPlayerId(input.gameState, input.activeManagerTeamId),
    [input.activeManagerTeamId, input.gameState],
  );

  const transferMarketActiveWishlistPlayerIds = useMemo(
    () => buildTransferMarketActiveWishlistPlayerIds(input.gameState, input.activeManagerTeamId),
    [input.activeManagerTeamId, input.gameState],
  );

  const selectedTransfermarktBoardObjectives = useMemo(
    () => buildSelectedTransfermarktBoardObjectives(input.selectedTeamObjectives),
    [input.selectedTeamObjectives],
  );

  return {
    transferWindowStatus,
    clientKey,
    transferMarketV2RosterRows,
    transferMarketScoutingWatchPlayerIds,
    transferMarketScoutingIntelByPlayerId,
    transferMarketActiveWishlistPlayerIds,
    selectedTransfermarktBoardObjectives,
  };
}
