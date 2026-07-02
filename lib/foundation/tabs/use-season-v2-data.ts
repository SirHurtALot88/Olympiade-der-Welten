import { useMemo } from "react";

import type { GameState, Player } from "@/lib/data/olyDataTypes";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import type { SortState } from "@/lib/foundation/tabs/cockpit-types";
import { shouldBuildSeasonTopPlayerRows } from "@/lib/foundation/tabs/season-v2-derivations";
import { sortFoundationTableRows } from "@/lib/foundation/foundation-table-sort";
import { getTransfermarktBracket } from "@/lib/market/transfermarkt-fit";

function roundViewNumber(value: number, digits = 4) {
  return Number(value.toFixed(digits));
}

function resolveSeasonPlayerAxisValue(...candidates: Array<number | null | undefined>) {
  for (const value of candidates) {
    if (value != null && Number.isFinite(value) && value > 0) {
      return roundViewNumber(value, 1);
    }
  }
  for (const value of candidates) {
    if (value != null && Number.isFinite(value)) {
      return roundViewNumber(value, 1);
    }
  }
  return null;
}

function getPlayerDisplayMarketValue(player?: Pick<Player, "id" | "marketValue" | "displayMarketValue"> | null) {
  return resolvePlayerEconomyContract({ playerId: player?.id ?? null, player }).marketValue;
}

export interface UseSeasonV2DataInput {
  activeView: string;
  shouldBuildSeasonV2PlayerRatings: boolean;
  gameState: GameState;
  shouldFetchSeasonRatingsFromApi: boolean;
  seasonRatingsLoading: boolean;
  playerRatingsById: Map<
    string,
    {
      ppsSeason?: number | null;
      ppsSeasonRank?: number | null;
      ovrNormalized?: number | null;
      mvs?: number | null;
      ppPow?: number | null;
      ppSpe?: number | null;
      ppMen?: number | null;
      ppSoc?: number | null;
    }
  >;
  playerSeasonPerformanceMap: Map<
    string,
    {
      totalPoints?: number | null;
      pointsByArea: { pow?: number | null; spe?: number | null; men?: number | null; soc?: number | null };
    }
  >;
  seasonPointsLedger: {
    playerSummariesByPlayerId: Map<
      string,
      {
        totalPoints?: number | null;
        pointsByArea: { power?: number | null; speed?: number | null; mental?: number | null; social?: number | null };
      }
    >;
  } | null;
  selectedSeasonSnapshot: NonNullable<GameState["seasonState"]["seasonSnapshots"]>[number] | null;
  seasonTopPlayersSort: SortState;
}

/**
 * Season top-player derivations (Strangler Phase 4.3). Runs only when
 * `shouldBuildSeasonTopPlayerRows` is true — typically while Season V2 is
 * mounted with full hydration.
 */
export function useSeasonV2Data(input: UseSeasonV2DataInput) {
  const {
    activeView,
    shouldBuildSeasonV2PlayerRatings,
    gameState,
    shouldFetchSeasonRatingsFromApi,
    seasonRatingsLoading,
    playerRatingsById,
    playerSeasonPerformanceMap,
    seasonPointsLedger,
    selectedSeasonSnapshot,
    seasonTopPlayersSort,
  } = input;

  const shouldBuild = shouldBuildSeasonTopPlayerRows({
    shouldBuildSeasonV2PlayerRatings,
    activeView: activeView as Parameters<typeof shouldBuildSeasonTopPlayerRows>[0]["activeView"],
  });

  const seasonTopPlayerRows = useMemo(() => {
    if (!shouldBuild) {
      return [];
    }
    if (
      shouldFetchSeasonRatingsFromApi &&
      seasonRatingsLoading &&
      playerRatingsById.size === 0 &&
      !selectedSeasonSnapshot
    ) {
      return [];
    }
    const teamById = new Map(gameState.teams.map((team) => [team.teamId, team] as const));
    const playerById = new Map(gameState.players.map((player) => [player.id, player] as const));

    if (selectedSeasonSnapshot) {
      return [...(selectedSeasonSnapshot.playerPerformances ?? [])]
        .map((player) => {
          const activePlayer = playerById.get(player.playerId) ?? null;
          const team = player.teamId ? teamById.get(player.teamId) ?? null : null;
          const snapshotClassName = (player as { className?: string | null }).className ?? null;
          const totalPoints = player.pps ?? player.totalPoints ?? player.totalContribution ?? null;
          const breakdownAreaPoints = (player.disciplineBreakdown ?? []).reduce(
            (totals, entry) => {
              const discipline = gameState.disciplines.find((candidate) => candidate.id === entry.disciplineId) ?? null;
              const value = entry.totalContribution ?? 0;
              if (discipline?.category === "power") totals.pow += value;
              if (discipline?.category === "speed") totals.spe += value;
              if (discipline?.category === "mental") totals.men += value;
              if (discipline?.category === "social") totals.soc += value;
              return totals;
            },
            { pow: 0, spe: 0, men: 0, soc: 0 },
          );

          return {
            playerId: player.playerId,
            name: player.playerName,
            teamId: player.teamId ?? null,
            teamCode: player.teamCode ?? team?.shortCode ?? null,
            teamName: player.teamName ?? team?.name ?? "—",
            className: snapshotClassName ?? activePlayer?.className ?? null,
            pps: totalPoints,
            ppsRank: player.ppsRank ?? null,
            ovr: player.ovr ?? null,
            mvs: player.mvs ?? null,
            marketValue: player.marketValue ?? null,
            bracket: getTransfermarktBracket(player.marketValue ?? null),
            ppPow: player.powPoints ?? (breakdownAreaPoints.pow > 0 ? roundViewNumber(breakdownAreaPoints.pow, 1) : null),
            ppSpe: player.spePoints ?? (breakdownAreaPoints.spe > 0 ? roundViewNumber(breakdownAreaPoints.spe, 1) : null),
            ppMen: player.menPoints ?? (breakdownAreaPoints.men > 0 ? roundViewNumber(breakdownAreaPoints.men, 1) : null),
            ppSoc: player.socPoints ?? (breakdownAreaPoints.soc > 0 ? roundViewNumber(breakdownAreaPoints.soc, 1) : null),
          };
        })
        .sort((left, right) => {
          const ppsDelta = (right.pps ?? Number.NEGATIVE_INFINITY) - (left.pps ?? Number.NEGATIVE_INFINITY);
          if (ppsDelta !== 0) {
            return ppsDelta;
          }
          return left.name.localeCompare(right.name, "de");
        })
        .map((row, index) => ({ ...row, rank: index + 1 }));
    }

    const rosterByPlayerId = new Map(gameState.rosters.map((roster) => [roster.playerId, roster] as const));

    return gameState.players
      .map((player) => {
        const roster = rosterByPlayerId.get(player.id) ?? null;
        if (!roster) {
          return null;
        }

        const team = teamById.get(roster.teamId) ?? null;
        const rating = playerRatingsById.get(player.id) ?? null;
        const seasonPerformance = playerSeasonPerformanceMap.get(player.id) ?? null;
        const ledgerPlayer = seasonPointsLedger?.playerSummariesByPlayerId.get(player.id) ?? null;
        const marketValue = getPlayerDisplayMarketValue(player);
        const resolvedPps =
          rating?.ppsSeason ?? seasonPerformance?.totalPoints ?? ledgerPlayer?.totalPoints ?? null;

        return {
          playerId: player.id,
          name: player.name,
          teamId: team?.teamId ?? null,
          teamCode: team?.shortCode ?? null,
          teamName: team?.name ?? "—",
          className: player.className ?? null,
          pps: resolvedPps != null ? roundViewNumber(resolvedPps, 1) : null,
          ppsRank: rating?.ppsSeasonRank ?? null,
          ovr: rating?.ovrNormalized ?? null,
          mvs: rating?.mvs ?? null,
          marketValue,
          bracket: getTransfermarktBracket(marketValue),
          ppPow: resolveSeasonPlayerAxisValue(
            ledgerPlayer?.pointsByArea.power,
            seasonPerformance?.pointsByArea.pow,
            rating?.ppPow,
          ),
          ppSpe: resolveSeasonPlayerAxisValue(
            ledgerPlayer?.pointsByArea.speed,
            seasonPerformance?.pointsByArea.spe,
            rating?.ppSpe,
          ),
          ppMen: resolveSeasonPlayerAxisValue(
            ledgerPlayer?.pointsByArea.mental,
            seasonPerformance?.pointsByArea.men,
            rating?.ppMen,
          ),
          ppSoc: resolveSeasonPlayerAxisValue(
            ledgerPlayer?.pointsByArea.social,
            seasonPerformance?.pointsByArea.soc,
            rating?.ppSoc,
          ),
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .sort((left, right) => {
        const ppsDelta = (right.pps ?? Number.NEGATIVE_INFINITY) - (left.pps ?? Number.NEGATIVE_INFINITY);
        if (ppsDelta !== 0) {
          return ppsDelta;
        }

        const ovrDelta = (right.ovr ?? Number.NEGATIVE_INFINITY) - (left.ovr ?? Number.NEGATIVE_INFINITY);
        if (ovrDelta !== 0) {
          return ovrDelta;
        }

        return left.name.localeCompare(right.name, "de");
      })
      .map((row, index) => ({ ...row, rank: index + 1 }));
  }, [
    gameState.disciplines,
    gameState.players,
    gameState.rosters,
    gameState.teams,
    playerRatingsById,
    playerSeasonPerformanceMap,
    seasonPointsLedger,
    seasonRatingsLoading,
    selectedSeasonSnapshot,
    shouldBuild,
    shouldFetchSeasonRatingsFromApi,
  ]);

  const sortedSeasonTopPlayerRows = useMemo(
    () =>
      sortFoundationTableRows(seasonTopPlayerRows, seasonTopPlayersSort, {
        rank: (row) => row.rank,
        name: (row) => row.name,
        team: (row) => row.teamCode ?? row.teamName ?? "",
        pps: (row) => row.pps ?? Number.NEGATIVE_INFINITY,
        pow: (row) => row.ppPow ?? Number.NEGATIVE_INFINITY,
        spe: (row) => row.ppSpe ?? Number.NEGATIVE_INFINITY,
        men: (row) => row.ppMen ?? Number.NEGATIVE_INFINITY,
        soc: (row) => row.ppSoc ?? Number.NEGATIVE_INFINITY,
        ovr: (row) => row.ovr ?? Number.NEGATIVE_INFINITY,
        mvs: (row) => row.mvs ?? Number.NEGATIVE_INFINITY,
        marketValue: (row) => row.marketValue ?? Number.NEGATIVE_INFINITY,
        bracket: (row) => row.bracket ?? Number.NEGATIVE_INFINITY,
      }),
    [seasonTopPlayerRows, seasonTopPlayersSort],
  );

  return { seasonTopPlayerRows, sortedSeasonTopPlayerRows };
}
