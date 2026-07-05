import { describe, expect, it } from "vitest";

import type { GameState, Team } from "@/lib/data/olyDataTypes";
import type { TeamManagementSnapshotRow } from "@/lib/foundation/team-management-overview";
import { resolveLiveSeasonStandRowsForTeamHistory } from "@/lib/foundation/team-detail-history-rows";

function createTeam(partial?: Partial<Team>): Team {
  return {
    teamId: partial?.teamId ?? "T-T",
    shortCode: partial?.shortCode ?? "T-T",
    name: partial?.name ?? "Test Team",
    budget: partial?.budget ?? 500000,
    cash: partial?.cash ?? 120000,
    identityId: partial?.identityId ?? "T-T",
    humanControlled: partial?.humanControlled ?? true,
    rosterLimit: partial?.rosterLimit ?? 12,
    logoPath: partial?.logoPath ?? null,
  };
}

function createArchivedSeasonOneSnapshot() {
  return {
    seasonId: "season-1",
    seasonName: "Season 1",
    archivedAt: "2026-06-05T00:00:00.000Z",
    status: "completed" as const,
    sourceStatus: "mapped" as const,
    finalStandings: [
      {
        teamId: "T-T",
        teamCode: "T-T",
        teamName: "Test Team",
        rank: 12,
        points: 102.2,
        disciplinePoints: 104.9,
        disciplinePointsByArea: {
          pow: 47,
          spe: 35.2,
          men: 10.4,
          soc: 12.2,
        },
        cashEnd: 39.4,
        cashTotal: 39.4,
        rosterEnd: 3,
        rosterCountEnd: 3,
        salaryEnd: 77.64,
        salaryTotalEnd: 77.64,
        marketValueEnd: 269.82,
        marketValueTotalEnd: 269.82,
        transferCount: 1,
        transferBuyCount: 1,
        transferSellCount: 0,
        transferNet: 0,
      },
    ],
    playerPerformances: [],
  };
}

function createSeasonTwoGameState(): GameState {
  const team = createTeam();
  return {
    season: {
      id: "season-2",
      name: "Season 2",
      year: 2026,
      currentMatchday: 1,
      matchdayIds: ["matchday-1"],
    },
    seasonState: {
      seasonId: "season-2",
      schedule: [],
      standings: { "T-T": { points: 0, rank: null } },
      seasonSnapshots: [createArchivedSeasonOneSnapshot()],
    },
    matchdayState: {
      matchdayId: "matchday-1",
      status: "planning",
      pendingTeamIds: [],
      resolvedFixtureIds: [],
    },
    teams: [team],
    teamIdentities: [],
    players: [],
    disciplines: [],
    rosters: [],
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
    mappingReport: {
      mappingSource: "",
      teamSource: "",
      generatedAt: "",
      processedMappingRows: 0,
      importedPlayerCount: 0,
      matchedRosterCount: 0,
      teamCount: 1,
      unmappedPlayers: [],
      teamsWithoutPlayers: [],
      mappingRowsWithoutPlayerMatch: [],
      duplicateMappedPlayers: [],
      unknownTeamCodes: [],
      duplicateTeamCodes: [],
      warnings: [],
    },
  };
}

function createArchivedSeasonStandRow(): TeamManagementSnapshotRow {
  return {
    teamId: "T-T",
    teamCode: "T-T",
    teamName: "Test Team",
    team: createTeam(),
    generalManagerName: null,
    generalManagerTitle: null,
    generalManagerInfluencePct: null,
    rank: 12,
    points: 102.2,
    rosterCount: 3,
    salaryTotal: 77.64,
    avgContractLength: null,
    marketValueTotal: 269.82,
    cash: 39.4,
    cashFc: null,
    budget: 500000,
    formAvg: null,
    financeForm: null,
    needScore: null,
    avgMarketValue: null,
    avgPps: null,
    avgOvr: null,
    ppsTotal: 104.9,
    ppsPow: 47,
    ppsSpe: 35.2,
    ppsMen: 10.4,
    ppsSoc: 12.2,
    playerMin: null,
    playerOpt: null,
    rosterTarget: null,
    transferCount: 0,
    transferBuyTotal: 0,
    transferSellTotal: 0,
    transferNet: 0,
    transfersSeasonValue: 0,
    cashDelta: null,
    startplatz: 12,
    rankDiff: null,
    sponsorBasis: null,
    sponsorRank: null,
    sponsorTotal: null,
    sponsorSeason: null,
    guv: null,
    cashTotal: 39.4,
    historicalPow: null,
    historicalSpe: null,
    historicalMen: null,
    historicalSoc: null,
    historicalGoldCount: 0,
    historicalSilverCount: 0,
    historicalBronzeCount: 0,
    historicalTop5Count: 0,
    historicalTop10Count: 0,
    historicalAvgRank: null,
    historicalAvgPoints: null,
    historicalPointsTotal: null,
    historicalPointsBySeason: [],
    historicalSeasonsPlayed: 0,
    historicalBestRank: null,
    historicalLastSeasonRank: null,
    historicalLastSeasonPoints: null,
    historicalHasData: false,
    disciplineValues: {
      tdm: 47,
    },
    roster: [],
    rosterPlayers: [],
  };
}

describe("team detail history rows", () => {
  it("rebuilds live season stand rows when saisonstand is viewing an archived season", () => {
    const gameState = createSeasonTwoGameState();
    const archivedSeasonStandRows = [createArchivedSeasonStandRow()];

    const liveRows = resolveLiveSeasonStandRowsForTeamHistory({
      gameState,
      seasonStandRows: archivedSeasonStandRows,
      seasonStandRowsSeasonId: "season-1",
    });

    const liveRow = liveRows.find((row) => row.teamId === "T-T");
    expect(liveRow).toBeDefined();
    expect(liveRow?.points).not.toBe(102.2);
    expect(liveRow?.ppsTotal).toBe(0);
    expect(liveRow?.ppsPow).toBe(0);
    expect(liveRow?.ppsSpe).toBe(0);
    expect(liveRow?.ppsMen).toBe(0);
    expect(liveRow?.ppsSoc).toBe(0);
  });

  it("reuses saisonstand rows when the selected season is the active season", () => {
    const gameState = createSeasonTwoGameState();
    const currentSeasonStandRows = [createArchivedSeasonStandRow()];

    const liveRows = resolveLiveSeasonStandRowsForTeamHistory({
      gameState,
      seasonStandRows: currentSeasonStandRows,
      seasonStandRowsSeasonId: "season-2",
    });

    expect(liveRows).toBe(currentSeasonStandRows);
  });
});
