import { useCallback, useMemo } from "react";

import type { TeamDetailDrawerData, TeamDetailDrawerHistoryRow } from "@/app/foundation/TeamDetailDrawer";
import type { TeamObjectiveOverview } from "@/lib/board/team-season-objectives-service";
import type { GameState, Player, RosterEntry } from "@/lib/data/olyDataTypes";
import { getTeamLogoModel } from "@/lib/data/mediaAssets";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { getTeamControlSettings } from "@/lib/foundation/team-control-settings";
import { getTeamGeneralManager } from "@/lib/foundation/team-general-managers";
import { buildTeamContractSeasonTable } from "@/lib/market/contract-negotiation-preview";
import type { TeamManagementSnapshotRow } from "@/lib/foundation/team-management-overview";
import { compareTeamRosterPlayersByOvrOrMarketValue } from "@/lib/foundation/team-roster-player-sort";
import { getPlayerPortraitModel } from "@/lib/foundation/tabs/foundation-page-module-helpers";
import {
  buildSharedRankMap,
  getPlayerDisplayMarketValueDelta,
  getRosterEntryDisplayMarketValue,
  getRosterEntryDisplaySalary,
  getRosterEntrySalaryDelta,
  roundViewNumber,
} from "@/lib/foundation/tabs/season-stand-render-helpers";
import type { TeamsAreaRank } from "@/lib/foundation/tabs/teams-view-derivations";
import { buildTransfermarktSaleFactorBreakdown } from "@/lib/market/transfermarkt-sale-factor";
import { buildTeamPlayerDemandMap, selectTeamCaptain } from "@/lib/morale/player-demands-service";
import { getPotentialBand } from "@/lib/progression/player-potential-service";
import { buildTeamRelationshipCards } from "@/lib/rivalries/team-relationship-dynamics";
import {
  buildTeamHistoryDisciplineValuesFromRecord,
  buildTeamHistoryDisciplineValuesFromSnapshot,
  resolveSeasonDisciplineAreaTotal,
} from "@/lib/season/season-discipline-area-groups";
import { resolveSeasonSnapshotTeamRecords } from "@/lib/season/season-snapshot-helpers";

export type FoundationRosterTableRow = {
  entry: RosterEntry;
  player: Player;
  playerOvr: number | null;
  playerMvs: number | null;
  playerPps: number | null;
  ppPow: number | null;
  ppSpe: number | null;
  ppMen: number | null;
  ppSoc: number | null;
  saleBreakdown: ReturnType<typeof buildTransfermarktSaleFactorBreakdown>;
};

type FoundationPlayerRatingSnapshot = {
  ovrNormalized?: number | null;
  mvs?: number | null;
  ppsSeason?: number | null;
  ppPow?: number | null;
  ppSpe?: number | null;
  ppMen?: number | null;
  ppSoc?: number | null;
  ovrRank?: number | null;
  mvsRank?: number | null;
  ppsSeasonRank?: number | null;
};

type CurrentMatchdayDisciplineSchedule = {
  discipline1?: { disciplineId?: string | null; displayName?: string | null; playerCount?: number | null } | null;
  discipline2?: { disciplineId?: string | null; displayName?: string | null; playerCount?: number | null } | null;
} | null;

type SeasonPointsLedger = {
  teamSummariesByTeamId: Map<
    string,
    {
      totalPoints?: number | null;
      pointsByArea: {
        power?: number | null;
        speed?: number | null;
        mental?: number | null;
        social?: number | null;
      };
    }
  >;
} | null;

const EMPTY_SELECTED_ROSTER_TABLE_ROWS: FoundationRosterTableRow[] = [];

export function shouldBuildFoundationSelectedRosterTableRows(input: {
  shouldBuildTeamsView: boolean;
  shouldBuildHomeV2Overview: boolean;
  shouldBuildMarketView: boolean;
}): boolean {
  return input.shouldBuildTeamsView || input.shouldBuildHomeV2Overview || input.shouldBuildMarketView;
}

export function shouldBuildFoundationTeamProfileData(teamProfileTeamId: string | null): boolean {
  return Boolean(teamProfileTeamId);
}

export function useFoundationCrossTabTeamsRoster(input: {
  shouldBuildTeamsView: boolean;
  shouldBuildHomeV2Overview: boolean;
  shouldBuildMarketView: boolean;
  teamProfileTeamId: string | null;
  canonicalSeasonLabel: string;
  gameState: GameState;
  rosterPlayers: Array<{ entry: RosterEntry; player: Player }>;
  playerRatingsById: Map<string, FoundationPlayerRatingSnapshot>;
  seasonStandRows: TeamManagementSnapshotRow[];
  currentAreaRanksByTeamId: Map<string, TeamsAreaRank>;
  seasonPointsLedger: SeasonPointsLedger;
  teamObjectiveOverview: TeamObjectiveOverview;
  currentMatchdayDisciplineSchedule: CurrentMatchdayDisciplineSchedule;
}) {
  const shouldBuildSelectedRosterTableRows = shouldBuildFoundationSelectedRosterTableRows({
    shouldBuildTeamsView: input.shouldBuildTeamsView,
    shouldBuildHomeV2Overview: input.shouldBuildHomeV2Overview,
    shouldBuildMarketView: input.shouldBuildMarketView,
  });

  const selectedRosterTableRows = useMemo(() => {
    if (!shouldBuildSelectedRosterTableRows) {
      return EMPTY_SELECTED_ROSTER_TABLE_ROWS;
    }

    return [...input.rosterPlayers]
      .map(({ entry, player }) => {
        const playerRating = input.playerRatingsById.get(player.id) ?? null;
        return {
          entry,
          player,
          playerOvr: playerRating?.ovrNormalized ?? null,
          playerMvs: playerRating?.mvs ?? null,
          playerPps: playerRating?.ppsSeason ?? null,
          ppPow: playerRating?.ppPow ?? null,
          ppSpe: playerRating?.ppSpe ?? null,
          ppMen: playerRating?.ppMen ?? null,
          ppSoc: playerRating?.ppSoc ?? null,
          saleBreakdown: buildTransfermarktSaleFactorBreakdown(input.gameState, player, entry),
        };
      })
      .sort((left, right) =>
        compareTeamRosterPlayersByOvrOrMarketValue({
          left: {
            ovr: left.playerOvr,
            marketValue: getRosterEntryDisplayMarketValue(left.entry, left.player),
            mvs: left.playerMvs,
            name: left.player.name,
          },
          right: {
            ovr: right.playerOvr,
            marketValue: getRosterEntryDisplayMarketValue(right.entry, right.player),
            mvs: right.playerMvs,
            name: right.player.name,
          },
        }),
      );
  }, [
    input.gameState,
    input.playerRatingsById,
    input.rosterPlayers,
    shouldBuildSelectedRosterTableRows,
  ]);

  const buildTeamDetailDrawerData = useCallback(
    (
      resolvedTeamId: string | null,
      scope: "full" | "history-summary" = "full",
      areaRanksByTeamId: Map<string, TeamsAreaRank> = input.currentAreaRanksByTeamId,
    ): TeamDetailDrawerData | null => {
      if (!resolvedTeamId) {
        return null;
      }

      const team = input.gameState.teams.find((entry) => entry.teamId === resolvedTeamId) ?? null;
      if (!team) {
        return null;
      }

      const teamControl = getTeamControlSettings(input.gameState, team.teamId);
      const logo = getTeamLogoModel(team, { variant: "preview" });
      const liveSeasonOverviewRow =
        input.seasonStandRows.find((entry) => entry.teamId === team.teamId) ?? null;
      const currentAreaRanks = areaRanksByTeamId.get(team.teamId) ?? null;
      const currentTeamPointsSummary = input.seasonPointsLedger?.teamSummariesByTeamId.get(team.teamId) ?? null;
      const currentSeasonTransfers = input.gameState.transferHistory.filter(
        (entry) => entry.seasonId === input.gameState.season.id,
      );
      const currentTopBuy =
        [...currentSeasonTransfers]
          .filter((entry) => entry.transferType === "buy" && entry.toTeamId === team.teamId)
          .sort((left, right) => (right.fee ?? 0) - (left.fee ?? 0))[0] ?? null;
      const currentTopSell =
        [...currentSeasonTransfers]
          .filter((entry) => entry.transferType === "sell" && entry.fromTeamId === team.teamId)
          .sort((left, right) => (right.fee ?? 0) - (left.fee ?? 0))[0] ?? null;
      const archivedHistoryRows = [...(input.gameState.seasonState.seasonSnapshots ?? [])]
        .sort((left, right) => right.seasonId.localeCompare(left.seasonId, "de", { numeric: true }))
        .map((snapshot) => {
          const teamSnapshot =
            resolveSeasonSnapshotTeamRecords(snapshot).find((entry) => entry.teamId === team.teamId) ?? null;
          if (!teamSnapshot) {
            return null;
          }

          const topBuy =
            [...(snapshot.transferSnapshots ?? [])]
              .filter((entry) => entry.type === "buy" && entry.toTeamId === team.teamId)
              .sort((left, right) => (right.amount ?? 0) - (left.amount ?? 0))[0] ?? null;
          const topSell =
            [...(snapshot.transferSnapshots ?? [])]
              .filter((entry) => entry.type === "sell" && entry.fromTeamId === team.teamId)
              .sort((left, right) => (right.amount ?? 0) - (left.amount ?? 0))[0] ?? null;
          const areaPoints = teamSnapshot.disciplinePointsByArea ?? {
            pow: null,
            spe: null,
            men: null,
            soc: null,
          };
          const disciplineValues = buildTeamHistoryDisciplineValuesFromSnapshot(snapshot, team.teamId);

          return {
            seasonId: snapshot.seasonId,
            seasonName: snapshot.seasonName,
            isLive: false,
            rank: teamSnapshot.rank ?? null,
            points: teamSnapshot.points ?? null,
            pps: teamSnapshot.disciplinePoints ?? null,
            ppPow: resolveSeasonDisciplineAreaTotal(disciplineValues, "pow", areaPoints.pow),
            ppSpe: resolveSeasonDisciplineAreaTotal(disciplineValues, "spe", areaPoints.spe),
            ppMen: resolveSeasonDisciplineAreaTotal(disciplineValues, "men", areaPoints.men),
            ppSoc: resolveSeasonDisciplineAreaTotal(disciplineValues, "soc", areaPoints.soc),
            cash: teamSnapshot.cashTotal ?? teamSnapshot.cashEnd ?? null,
            salaryTotal: teamSnapshot.salaryTotalEnd ?? teamSnapshot.salaryEnd ?? null,
            marketValue: teamSnapshot.marketValueTotalEnd ?? teamSnapshot.marketValueEnd ?? null,
            guv: teamSnapshot.guv ?? null,
            topBuyPlayer: topBuy?.playerName ?? null,
            topBuyAmount: topBuy?.amount ?? null,
            topSellPlayer: topSell?.playerName ?? null,
            topSellAmount: topSell?.amount ?? null,
            disciplineValues,
          } satisfies TeamDetailDrawerHistoryRow;
        })
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
      const liveDisciplineValues = buildTeamHistoryDisciplineValuesFromRecord(liveSeasonOverviewRow?.disciplineValues);
      const currentHistoryRow: TeamDetailDrawerHistoryRow = {
        seasonId: input.gameState.season.id,
        seasonName: input.gameState.season.name,
        isLive: true,
        rank: liveSeasonOverviewRow?.rank ?? null,
        points: liveSeasonOverviewRow?.points ?? null,
        pps:
          liveSeasonOverviewRow?.ppsTotal ??
          (currentTeamPointsSummary?.totalPoints != null
            ? roundViewNumber(currentTeamPointsSummary.totalPoints, 1)
            : null),
        ppPow: resolveSeasonDisciplineAreaTotal(
          liveSeasonOverviewRow?.disciplineValues,
          "pow",
          liveSeasonOverviewRow?.ppsPow ?? currentTeamPointsSummary?.pointsByArea.power ?? null,
        ),
        ppSpe: resolveSeasonDisciplineAreaTotal(
          liveSeasonOverviewRow?.disciplineValues,
          "spe",
          liveSeasonOverviewRow?.ppsSpe ?? currentTeamPointsSummary?.pointsByArea.speed ?? null,
        ),
        ppMen: resolveSeasonDisciplineAreaTotal(
          liveSeasonOverviewRow?.disciplineValues,
          "men",
          liveSeasonOverviewRow?.ppsMen ?? currentTeamPointsSummary?.pointsByArea.mental ?? null,
        ),
        ppSoc: resolveSeasonDisciplineAreaTotal(
          liveSeasonOverviewRow?.disciplineValues,
          "soc",
          liveSeasonOverviewRow?.ppsSoc ?? currentTeamPointsSummary?.pointsByArea.social ?? null,
        ),
        cash: liveSeasonOverviewRow?.cash ?? null,
        salaryTotal: liveSeasonOverviewRow?.salaryTotal ?? null,
        marketValue: liveSeasonOverviewRow?.marketValueTotal ?? null,
        guv: liveSeasonOverviewRow?.guv ?? null,
        topBuyPlayer: currentTopBuy?.playerName ?? null,
        topBuyAmount: currentTopBuy?.fee ?? null,
        topSellPlayer: currentTopSell?.playerName ?? null,
        topSellAmount: currentTopSell?.fee ?? null,
        disciplineValues: liveDisciplineValues,
      };
      const history = [
        currentHistoryRow,
        ...archivedHistoryRows.filter((row) => row.seasonId !== input.gameState.season.id),
      ];

      if (scope === "history-summary") {
        return {
          teamId: team.teamId,
          teamName: team.name,
          shortCode: team.shortCode,
          logoUrl: logo.src,
          logoInitials: logo.initials,
          controlMode: teamControl?.controlMode ?? "manual",
          generalManager: null,
          rosterSize: input.gameState.rosters.filter((entry) => entry.teamId === team.teamId).length,
          cash: liveSeasonOverviewRow?.cash ?? team.cash ?? null,
          salaryTotal: liveSeasonOverviewRow?.salaryTotal ?? null,
          marketValueTotal: liveSeasonOverviewRow?.marketValueTotal ?? null,
          powRank: currentAreaRanks?.pow ?? null,
          speRank: currentAreaRanks?.spe ?? null,
          menRank: currentAreaRanks?.men ?? null,
          socRank: currentAreaRanks?.soc ?? null,
          contractSummaries: [],
          boardConfidence: null,
          relationships: { allies: [], rivals: [] },
          objectives: [],
          teamCaptain: null,
          history,
          players: [],
        };
      }

      const generalManager = getTeamGeneralManager(input.gameState, team.teamId);
      const demandMap = buildTeamPlayerDemandMap(input.gameState, team.teamId);
      const teamCaptain = selectTeamCaptain(input.gameState, team.teamId);
      const drawerObjectives = input.teamObjectiveOverview.objectives.filter(
        (objective) => objective.teamId === team.teamId,
      );
      const drawerBoardConfidence = input.teamObjectiveOverview.boardConfidence[team.teamId] ?? null;
      const drawerRelationships = buildTeamRelationshipCards(input.gameState, team.teamId);
      const contractTable = buildTeamContractSeasonTable({
        gameState: input.gameState,
        teamId: team.teamId,
        seasonLabelBase: input.canonicalSeasonLabel,
      });
      const liveAverageSalary =
        liveSeasonOverviewRow?.rosterCount != null &&
        liveSeasonOverviewRow.rosterCount > 0 &&
        liveSeasonOverviewRow.salaryTotal != null
          ? roundViewNumber(liveSeasonOverviewRow.salaryTotal / liveSeasonOverviewRow.rosterCount, 2)
          : null;
      const rosterEntries = input.gameState.rosters.filter((entry) => entry.teamId === team.teamId);
      const activePlayerIdSet = new Set(input.gameState.rosters.map((entry) => entry.playerId).filter(Boolean));
      const activePlayers = input.gameState.players.filter((player) => activePlayerIdSet.has(player.id));
      const playerCoreRankMaps = {
        pow: buildSharedRankMap(
          activePlayers.map((player) => ({ teamId: player.id, value: player.coreStats.pow ?? 0 })),
        ),
        spe: buildSharedRankMap(
          activePlayers.map((player) => ({ teamId: player.id, value: player.coreStats.spe ?? 0 })),
        ),
        men: buildSharedRankMap(
          activePlayers.map((player) => ({ teamId: player.id, value: player.coreStats.men ?? 0 })),
        ),
        soc: buildSharedRankMap(
          activePlayers.map((player) => ({ teamId: player.id, value: player.coreStats.soc ?? 0 })),
        ),
      };
      const rosterCards = rosterEntries
        .map((entry) => {
          const player = input.gameState.players.find((candidate) => candidate.id === entry.playerId) ?? null;
          if (!player) {
            return null;
          }
          const portrait = getPlayerPortraitModel(player);
          const rating = input.playerRatingsById.get(player.id) ?? null;
          const topDisciplines = Object.entries(player.disciplineRatings)
            .sort((left, right) => right[1] - left[1])
            .slice(0, 2)
            .map(([disciplineId, value]) => ({
              label:
                input.gameState.disciplines.find((discipline) => discipline.id === disciplineId)?.name ??
                disciplineId,
              value,
            }));
          const d1DisciplineId = input.currentMatchdayDisciplineSchedule?.discipline1?.disciplineId ?? null;
          const d2DisciplineId = input.currentMatchdayDisciplineSchedule?.discipline2?.disciplineId ?? null;
          const d1Score = d1DisciplineId ? player.disciplineRatings[d1DisciplineId] ?? null : null;
          const d2Score = d2DisciplineId ? player.disciplineRatings[d2DisciplineId] ?? null : null;
          const issueTags: string[] = [];
          if ((entry.contractLength ?? 0) <= 1) {
            issueTags.push("läuft aus");
          }
          const economy = resolvePlayerEconomyContract({ playerId: player.id, player, rosterEntry: entry });
          const marketValue = economy.marketValue;
          const marketValueDelta = getPlayerDisplayMarketValueDelta(player, entry, input.gameState);
          const salary = getRosterEntryDisplaySalary(entry, player);
          const salaryDelta = getRosterEntrySalaryDelta(entry, player, input.gameState);
          if (liveAverageSalary != null && salary > liveAverageSalary * 1.35) {
            issueTags.push("teuer");
          }
          if ((player.fatigue ?? 0) > 0) {
            issueTags.push("beansprucht");
          }

          return {
            playerId: player.id,
            activePlayerId: entry.id,
            name: player.name,
            portraitUrl: portrait.src,
            portraitInitials: portrait.initials,
            roleTag: entry.roleTag ?? null,
            promisedRole: entry.promisedRole ?? null,
            className: player.className ?? null,
            race: player.race ?? null,
            ovr: rating?.ovrNormalized ?? null,
            ovrRank: rating?.ovrRank ?? null,
            mvs: rating?.mvs ?? null,
            mvsRank: rating?.mvsRank ?? null,
            pps: rating?.ppsSeason ?? null,
            ppsRank: rating?.ppsSeasonRank ?? null,
            marketValue,
            marketValueDelta,
            salary,
            salaryDelta,
            contractLength: entry.contractLength ?? null,
            d1Label: input.currentMatchdayDisciplineSchedule?.discipline1?.displayName ?? "D1",
            d1Score,
            d2Label: input.currentMatchdayDisciplineSchedule?.discipline2?.displayName ?? "D2",
            d2Score,
            coreStats: {
              pow: player.coreStats.pow ?? null,
              powRank: playerCoreRankMaps.pow.get(player.id) ?? null,
              spe: player.coreStats.spe ?? null,
              speRank: playerCoreRankMaps.spe.get(player.id) ?? null,
              men: player.coreStats.men ?? null,
              menRank: playerCoreRankMaps.men.get(player.id) ?? null,
              soc: player.coreStats.soc ?? null,
              socRank: playerCoreRankMaps.soc.get(player.id) ?? null,
            },
            issueTags,
            demands: (demandMap.get(player.id) ?? []).map((demand) => ({
              demandId: demand.demandId,
              label: demand.label,
              detail: demand.detail,
              status: demand.status,
              priority: demand.priority,
              targetDisciplineId: demand.targetDisciplineId ?? null,
              moraleReward: demand.moraleReward,
              moralePenalty: demand.moralePenalty,
            })),
            topDisciplines,
            potential: player.potential ?? null,
            potentialBand: player.potential != null ? getPotentialBand(player.potential) : null,
          };
        })
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
        .sort((left, right) => {
          const ovrDelta = (right.ovr ?? Number.NEGATIVE_INFINITY) - (left.ovr ?? Number.NEGATIVE_INFINITY);
          if (ovrDelta !== 0) {
            return ovrDelta;
          }

          const mvsDelta = (right.mvs ?? Number.NEGATIVE_INFINITY) - (left.mvs ?? Number.NEGATIVE_INFINITY);
          if (mvsDelta !== 0) {
            return mvsDelta;
          }

          return left.name.localeCompare(right.name, "de");
        });

      return {
        teamId: team.teamId,
        teamName: team.name,
        shortCode: team.shortCode,
        logoUrl: logo.src,
        logoInitials: logo.initials,
        controlMode: teamControl?.controlMode ?? "manual",
        generalManager: generalManager
          ? {
              name: generalManager.profile.name,
              title: generalManager.profile.title,
              description: generalManager.profile.description,
              pow: generalManager.profile.pow,
              spe: generalManager.profile.spe,
              men: generalManager.profile.men,
              soc: generalManager.profile.soc,
              influencePct: generalManager.assignment.influencePct,
              playerOptDelta: generalManager.profile.playerOptDelta,
              marketDoctrine: generalManager.profile.marketDoctrine,
              lineupDoctrine: generalManager.profile.lineupDoctrine,
              facilityPriorities: generalManager.profile.facilityPriorities,
              bias: generalManager.profile.bias,
            }
          : null,
        rosterSize: rosterCards.length,
        cash: liveSeasonOverviewRow?.cash ?? team.cash ?? null,
        salaryTotal: liveSeasonOverviewRow?.salaryTotal ?? null,
        marketValueTotal: liveSeasonOverviewRow?.marketValueTotal ?? null,
        powRank: currentAreaRanks?.pow ?? null,
        speRank: currentAreaRanks?.spe ?? null,
        menRank: currentAreaRanks?.men ?? null,
        socRank: currentAreaRanks?.soc ?? null,
        contractSummaries: contractTable.totalsCommitted,
        boardConfidence: drawerBoardConfidence
          ? {
              value: drawerBoardConfidence.value,
              pressure: drawerBoardConfidence.pressure,
              warnings: drawerBoardConfidence.warnings,
            }
          : null,
        relationships: drawerRelationships,
        objectives: drawerObjectives.map((objective) => ({
          objectiveId: objective.objectiveId,
          label: objective.label,
          detail: objective.detail ?? null,
          actionHint: objective.actionHint ?? null,
          category: objective.category,
          targetValue: objective.targetValue,
          currentValue: objective.currentValue,
          status: objective.status,
        })),
        teamCaptain: teamCaptain
          ? {
              playerId: teamCaptain.playerId,
              playerName: teamCaptain.playerName,
              leadershipScore: teamCaptain.leadershipScore,
              style: teamCaptain.style,
              effects: teamCaptain.effects,
              traitSignals: teamCaptain.traitSignals,
            }
          : null,
        history,
        players: rosterCards,
      };
    },
    [
      input.canonicalSeasonLabel,
      input.currentAreaRanksByTeamId,
      input.currentMatchdayDisciplineSchedule,
      input.gameState,
      input.playerRatingsById,
      input.seasonPointsLedger,
      input.seasonStandRows,
      input.teamObjectiveOverview.boardConfidence,
      input.teamObjectiveOverview.objectives,
    ],
  );

  const teamProfileData = useMemo<TeamDetailDrawerData | null>(() => {
    if (!shouldBuildFoundationTeamProfileData(input.teamProfileTeamId)) {
      return null;
    }
    return buildTeamDetailDrawerData(input.teamProfileTeamId, "full");
  }, [
    buildTeamDetailDrawerData,
    input.teamProfileTeamId,
  ]);

  return {
    selectedRosterTableRows,
    buildTeamDetailDrawerData,
    teamProfileData,
  };
}
