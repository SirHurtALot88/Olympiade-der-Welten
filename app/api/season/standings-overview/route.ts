import { NextResponse } from "next/server";

import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { buildTeamPrizeSummary } from "@/lib/season/prize-money";
import {
  extractSeasonStandingsDisciplineValues,
  inspectSeasonStandingsSheet,
  mapSeasonStandingsRowsToTeams,
  SEASON_STANDINGS_DISCIPLINE_COLUMNS,
  type SeasonStandingsSheetRow,
} from "@/lib/standings/season-standings-sheet";
import { db } from "@/src/server/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const saveId = searchParams.get("saveId")?.trim() || undefined;
    const seasonId = searchParams.get("seasonId")?.trim() || "season-1";
    const source = searchParams.get("source")?.trim() === "prisma" ? "prisma" : "sqlite";

    const localSave =
      source === "sqlite"
        ? (() => {
            const persistence = createPersistenceService();
            return (
              (saveId ? persistence.getSaveById(saveId) : null) ??
              persistence.getActiveSave() ??
              persistence.bootstrapSingleplayerSave().save
            );
          })()
        : null;

    const teamStates =
      source === "sqlite"
        ? localSave!.gameState.teams.map((team) => ({
            teamId: team.teamId,
            cash: team.cash,
            team: {
              name: team.name,
              shortCode: team.shortCode,
            },
          }))
        : await db.teamSeasonState.findMany({
            where: {
              saveId,
              seasonId,
            },
            select: {
              teamId: true,
              cash: true,
              team: {
                select: {
                  name: true,
                  shortCode: true,
                },
              },
            },
          });

    const sheet = await inspectSeasonStandingsSheet();
    const sheetRows =
      sheet.sourceKind === "season_standings"
        ? (sheet.mappedRows as SeasonStandingsSheetRow[])
        : [];
    const mapping = mapSeasonStandingsRowsToTeams(
      sheetRows,
      teamStates.map((state) => ({
        teamId: state.teamId,
        shortCode: state.team.shortCode,
        teamName: state.team.name,
      })),
    );
    const teamStateById = new Map(teamStates.map((state) => [state.teamId, state] as const));
    const localSheetRowByTeamId =
      source === "sqlite"
        ? new Map(
            mapping.rows
              .filter((row) => row.resolvedTeamId)
              .map((row) => [row.resolvedTeamId as string, row] as const),
          )
        : null;

    const localCashRankByTeamId =
      source === "sqlite"
        ? (() => {
            const sorted = [...localSave!.gameState.teams].sort((left, right) => {
              if (right.cash !== left.cash) {
                return right.cash - left.cash;
              }
              return left.name.localeCompare(right.name, "de");
            });

            const rankByTeamId = new Map<string, number>();
            let previousCash: number | null = null;
            let previousRank = 0;

            sorted.forEach((team, index) => {
              if (previousCash != null && team.cash === previousCash) {
                rankByTeamId.set(team.teamId, previousRank);
                return;
              }

              const nextRank = index + 1;
              previousCash = team.cash;
              previousRank = nextRank;
              rankByTeamId.set(team.teamId, nextRank);
            });

            return rankByTeamId;
          })()
        : null;

    const localPrizeSummaryByTeamId =
      source === "sqlite"
        ? (() => {
            const hasCashPrizeApply = (localSave!.gameState.seasonState.cashPrizeApplyLogs ?? []).some(
              (entry) => entry.seasonId === localSave!.gameState.season.id,
            );
            const playerById = new Map(localSave!.gameState.players.map((player) => [player.id, player] as const));
            const transferSummaryByTeamId = new Map<string, number>();

            for (const entry of localSave!.gameState.transferHistory) {
              const amount = entry.fee ?? 0;
              if (entry.transferType === "buy" && entry.toTeamId) {
                transferSummaryByTeamId.set(entry.toTeamId, (transferSummaryByTeamId.get(entry.toTeamId) ?? 0) - amount);
              }
              if (entry.transferType === "sell" && entry.fromTeamId) {
                transferSummaryByTeamId.set(entry.fromTeamId, (transferSummaryByTeamId.get(entry.fromTeamId) ?? 0) + amount);
              }
            }

            return new Map(
              buildTeamPrizeSummary(
                localSave!.gameState.teams.map((team) => {
                  const roster = localSave!.gameState.rosters.filter((entry) => entry.teamId === team.teamId);
                  const upkeep = roster.reduce((sum, entry) => {
                    const player = playerById.get(entry.playerId);
                    return sum + (resolvePlayerEconomyContract({ player, rosterEntry: entry }).salary ?? 0);
                  }, 0);
                  const standing = localSave!.gameState.seasonState.standings[team.teamId] ?? null;
                  const derivedRank = standing?.rank ?? localCashRankByTeamId?.get(team.teamId) ?? 0;
                  const transfers = transferSummaryByTeamId.get(team.teamId) ?? 0;
                  const displayedCash =
                    !hasCashPrizeApply && team.budget != null
                      ? Number((team.budget + transfers).toFixed(2))
                      : team.cash;

                  return {
                    rank: derivedRank,
                    startPlace: standing?.rank ?? derivedRank,
                    team: {
                      teamId: team.teamId,
                      name: team.name,
                      cash: displayedCash,
                    },
                    upkeep,
                    transfers,
                  };
                }),
              ).map((row) => [row.teamId, row] as const),
            );
          })()
        : null;

    return NextResponse.json({
      items:
        source === "sqlite"
          ? localSave!.gameState.teams.map((team) => {
              const standing = localSave!.gameState.seasonState.standings[team.teamId] ?? null;
              const row = localSheetRowByTeamId?.get(team.teamId) ?? null;
              const derivedCashRank = localCashRankByTeamId?.get(team.teamId) ?? null;
              const prizeSummary = localPrizeSummaryByTeamId?.get(team.teamId) ?? null;
              const hasCashPrizeApply = (localSave!.gameState.seasonState.cashPrizeApplyLogs ?? []).some(
                (entry) => entry.seasonId === localSave!.gameState.season.id,
              );
              const localTransferNet = prizeSummary?.transfers ?? 0;
              const displayedCash =
                !hasCashPrizeApply && team.budget != null
                  ? Number((team.budget + localTransferNet).toFixed(2))
                  : team.cash;

              return {
                teamId: team.teamId,
                teamName: team.name,
                teamCode: team.shortCode,
                rank: standing?.rank ?? derivedCashRank,
                points: standing?.points ?? 0,
                cash: displayedCash,
                cashFc: prizeSummary?.cashForecast ?? null,
                startplatz: standing?.rank ?? derivedCashRank,
                rankDiff: prizeSummary?.rankDiff ?? null,
                sponsorBasis: prizeSummary?.basis ?? null,
                sponsorRank: prizeSummary?.placementBonus ?? null,
                sponsorTotal: prizeSummary?.sponsorTotal ?? null,
                guv: prizeSummary?.profitLoss ?? null,
                cashTotal: prizeSummary?.cashTotal ?? null,
                form: null,
                transfers: prizeSummary?.transfers ?? null,
                disciplineValues: row ? extractSeasonStandingsDisciplineValues(row) : {},
                warnings: row?.warnings ?? [],
              };
            })
          : mapping.rows
              .filter((row) => row.resolvedTeamId)
              .map((row) => ({
                teamId: row.resolvedTeamId,
                teamName: row.resolvedTeamName ?? row.teamName ?? row.rawTeamLabel,
                teamCode: row.teamCode,
                rank: row.rank,
                points: row.points,
                cash: row.resolvedTeamId ? (teamStateById.get(row.resolvedTeamId)?.cash ?? row.cash) : row.cash,
                cashFc: row.cashFc,
                startplatz: row.startplatz,
                rankDiff: row.rankDiff,
                sponsorBasis: row.sponsorBasis,
                sponsorRank: row.sponsorRank,
                sponsorTotal: row.sponsorTotal,
                guv: row.guv,
                cashTotal: row.cashTotal,
                form: row.form,
                transfers: row.transfers,
                disciplineValues: extractSeasonStandingsDisciplineValues(row),
                warnings: row.warnings,
              })),
      missingMappings: mapping.missingInDb,
      mappingWarnings: mapping.mappingWarnings,
      source: {
        kind: "season_standings_sheet",
        access: sheet.access,
        detectedColumns: sheet.detectedColumns,
        disciplineColumns: SEASON_STANDINGS_DISCIPLINE_COLUMNS,
      },
      scope: {
        saveId,
        seasonId,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Season standings overview could not be loaded.";
    return NextResponse.json(
      {
        items: [],
        missingMappings: [],
        mappingWarnings: [],
        source: {
          kind: "season_standings_sheet",
          access: "missing",
          detectedColumns: [],
          disciplineColumns: SEASON_STANDINGS_DISCIPLINE_COLUMNS,
        },
        scope: null,
        error: message,
      },
      { status: 500 },
    );
  }
}
