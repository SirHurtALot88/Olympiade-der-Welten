import { describe, expect, it, vi } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import type { PersistedSaveGame } from "@/lib/persistence/types";
import {
  buildAllTimeTableFromSnapshots,
  buildSeasonSnapshot,
  buildSeasonSnapshotDryRun,
  createSeasonSnapshot,
  patchCompletedSeasonSnapshotAfterPreseasonBuy,
  resolveSeasonSnapshotTeamRecords,
  SEASON_SNAPSHOT_CONFIRM_TOKEN,
  upsertSeasonSnapshotRecord,
} from "@/lib/season/season-snapshot-service";

function createGameState(): GameState {
  return {
    season: {
      id: "season-1",
      name: "Season 1",
      year: 2026,
      currentMatchday: 2,
      matchdayIds: ["matchday-1", "matchday-2"],
    },
    seasonState: {
      seasonId: "season-1",
      schedule: [],
      standings: {
        "A-A": { points: 101, rank: 1 },
        "B-B": { points: 77, rank: 2 },
      },
      standingsApplyLogs: [
        {
          id: "standings-1",
          saveId: "save-local",
          seasonId: "season-1",
          matchdayId: "matchday-1",
          action: "apply",
          payload: {
            idempotencyKey: "s1",
            totalTeams: 2,
            appliedTeams: 2,
            tieGroupsCount: 0,
            previewWarningsCount: 0,
          },
          createdAt: "2026-06-05T00:00:00.000Z",
        },
        {
          id: "standings-2",
          saveId: "save-local",
          seasonId: "season-1",
          matchdayId: "matchday-2",
          action: "apply",
          payload: {
            idempotencyKey: "s2",
            totalTeams: 2,
            appliedTeams: 2,
            tieGroupsCount: 0,
            previewWarningsCount: 0,
          },
          createdAt: "2026-06-06T00:00:00.000Z",
        },
      ],
      cashPrizeApplyLogs: [
        {
          id: "cash-1",
          saveId: "save-local",
          seasonId: "season-1",
          matchdayId: "matchday-1",
          action: "apply",
          payload: {
            idempotencyKey: "c1",
            totalTeams: 2,
            appliedTeams: 2,
            totalPrizeMoney: 10,
          },
          createdAt: "2026-06-05T00:00:00.000Z",
        },
        {
          id: "cash-2",
          saveId: "save-local",
          seasonId: "season-1",
          matchdayId: "matchday-2",
          action: "apply",
          payload: {
            idempotencyKey: "c2",
            totalTeams: 2,
            appliedTeams: 2,
            totalPrizeMoney: 10,
          },
          createdAt: "2026-06-06T00:00:00.000Z",
        },
      ],
      matchdayResults: [
        {
          id: "result-1",
          saveId: "save-local",
          seasonId: "season-1",
          matchdayId: "matchday-1",
          status: "preview_applied",
          sourceVersion: "test",
          teamsTotal: 2,
          teamsReady: 2,
          teamsUnderfilled: 0,
          teamsMissingLineup: 0,
          teamsInvalidLineup: 0,
          teamsMissingScoreCoverage: 0,
          warningsCount: 0,
          createdAt: "2026-06-05T00:00:00.000Z",
          updatedAt: "2026-06-05T00:00:00.000Z",
        },
        {
          id: "result-2",
          saveId: "save-local",
          seasonId: "season-1",
          matchdayId: "matchday-2",
          status: "preview_applied",
          sourceVersion: "test",
          teamsTotal: 2,
          teamsReady: 2,
          teamsUnderfilled: 0,
          teamsMissingLineup: 0,
          teamsInvalidLineup: 0,
          teamsMissingScoreCoverage: 0,
          warningsCount: 0,
          createdAt: "2026-06-06T00:00:00.000Z",
          updatedAt: "2026-06-06T00:00:00.000Z",
        },
      ],
      disciplineResults: [
        {
          id: "discipline-1",
          matchdayResultId: "result-1",
          teamId: "A-A",
          disciplineId: "pow-1",
          disciplineSide: "d1",
          rank: 1,
          baseScore: 40,
          totalScore: 45.5,
          readinessStatus: "ready",
          warnings: [],
          createdAt: "2026-06-05T00:00:00.000Z",
        },
        {
          id: "discipline-2",
          matchdayResultId: "result-1",
          teamId: "A-A",
          disciplineId: "spe-1",
          disciplineSide: "d2",
          rank: 2,
          baseScore: 35,
          totalScore: 36.5,
          readinessStatus: "ready",
          warnings: [],
          createdAt: "2026-06-05T00:00:00.000Z",
        },
      ],
      playerDisciplinePerformances: [
        {
          id: "perf-1",
          matchdayResultId: "result-1",
          teamId: "A-A",
          playerId: "p1",
          activePlayerId: "r1",
          disciplineId: "pow-1",
          disciplineSide: "d1",
          slotIndex: 0,
          baseValue: 40,
          finalPlayerScore: 50,
          scoreContribution: 21.5,
          rankInTeam: 1,
          rankInDiscipline: 2,
          isTop10: true,
          isMvpCandidate: false,
          storyWeight: null,
          createdAt: "2026-06-05T00:00:00.000Z",
        },
        {
          id: "perf-2",
          matchdayResultId: "result-1",
          teamId: "A-A",
          playerId: "p1",
          activePlayerId: "r1",
          disciplineId: "spe-1",
          disciplineSide: "d2",
          slotIndex: 0,
          baseValue: 35,
          finalPlayerScore: 42,
          scoreContribution: 18.5,
          rankInTeam: 1,
          rankInDiscipline: 4,
          isTop10: true,
          isMvpCandidate: true,
          storyWeight: null,
          createdAt: "2026-06-05T00:00:00.000Z",
        },
      ],
      disciplineHighlights: [],
      resultAuditLogs: [],
      seasonSnapshots: [],
    },
    matchdayState: {
      matchdayId: "matchday-2",
      status: "planning",
      pendingTeamIds: [],
      resolvedFixtureIds: [],
    },
    teams: [
      {
        teamId: "A-A",
        shortCode: "A-A",
        name: "Armageddon Aftermath",
        budget: 175,
        cash: 244.5,
        identityId: "A-A",
        humanControlled: true,
        rosterLimit: 12,
      },
      {
        teamId: "B-B",
        shortCode: "B-B",
        name: "Blazing Beasts",
        budget: 160,
        cash: 144.5,
        identityId: "B-B",
        humanControlled: false,
        rosterLimit: 12,
      },
    ],
    teamIdentities: [],
    players: [
      {
        id: "p1",
        name: "Alpha",
        rating: 50,
        marketValue: 100,
        salaryDemand: 10,
        className: "Mage",
        race: "Human",
        alignment: "N",
        gender: "f",
        subclasses: [],
        traitsPositive: [],
        traitsNegative: [],
        coreStats: { pow: 10, spe: 12, men: 18, soc: 8 },
        preferredDisciplineIds: [],
        disciplineRatings: { "pow-1": 50, "spe-1": 42 },
        disciplineTierCounts: { above20: 2, above40: 2, above60: 0, above80: 0 },
        flavorEn: "",
        flavorDe: "",
        fatigue: 0,
        form: 0,
        potential: 0,
      },
    ],
    disciplines: [
      { id: "pow-1", name: "Power Test", category: "power", weight: 1, playerCount: 6 },
      { id: "spe-1", name: "Speed Test", category: "speed", weight: 1, playerCount: 6 },
    ],
    rosters: [
      {
        id: "r1",
        teamId: "A-A",
        playerId: "p1",
        contractLength: 3,
        salary: 10,
        upkeep: 10,
        purchasePrice: 95,
        currentValue: 110,
        roleTag: "starter",
        promisedRole: "starter",
        joinedSeasonId: "season-1",
      },
    ],
    contracts: [],
    transferListings: [],
    transferHistory: [
      {
        id: "history-1",
        playerId: "p1",
        seasonId: "season-1",
        matchdayId: "matchday-1",
        phase: "transfermarkt",
        seasonLabel: "Season 1",
        transferType: "buy",
        fromTeamId: null,
        toTeamId: "A-A",
        fee: 95,
        salary: 10,
        marketValue: 95,
        remainingContractLength: 3,
        happenedAt: "2026-06-05T00:00:00.000Z",
      },
    ],
    logs: [],
    mappingReport: {
      mappingSource: "",
      teamSource: "",
      generatedAt: "",
      processedMappingRows: 0,
      importedPlayerCount: 0,
      matchedRosterCount: 0,
      teamCount: 2,
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

function createPersistenceMock(gameState: GameState = createGameState()) {
  const save: PersistedSaveGame = {
    saveId: "save-local",
    name: "Local Save",
    status: "active",
    createdAt: "2026-06-06T00:00:00.000Z",
    updatedAt: "2026-06-06T00:00:00.000Z",
    gameState,
  };

  const persistence = {
    bootstrapSingleplayerSave: vi.fn(() => ({ save, createdFromSeed: false })),
    getActiveSave: vi.fn(() => save),
    getSaveById: vi.fn((saveId: string) => (saveId === save.saveId ? save : null)),
    saveSingleplayerState: vi.fn((saveId: string, nextGameState: GameState) => {
      save.gameState = nextGameState;
      return save;
    }),
    createSave: vi.fn(),
    createFreshSeasonOneSave: vi.fn(),
    cloneSave: vi.fn(),
    activateSave: vi.fn(),
    listSaves: vi.fn(() => [save]),
  };

  return { save, persistence };
}

describe("season snapshot service", () => {
  it("archives final standings, player performances and transfer snapshots from real local data", () => {
    const snapshot = buildSeasonSnapshot(createGameState());

    expect(snapshot.snapshotId).toBe("season-snapshot__season-1");
    expect(snapshot.status).toBe("completed");
    expect(snapshot.sourceStatus).toBe("mapped");
    expect(snapshot.finalStandings).toHaveLength(2);
    expect(snapshot.finalStandings[0]?.teamId).toBe("A-A");
    expect(snapshot.finalStandings[0]?.disciplinePoints).toBe(38.5);
    expect(snapshot.finalStandings[0]?.disciplinePointsByArea.pow).toBe(19.9);
    expect(snapshot.finalStandings[0]?.disciplinePointsByArea.spe).toBe(18.6);
    expect(snapshot.finalStandings[0]?.cashEnd).toBe(244.5);
    expect(snapshot.finalStandings[0]?.salaryTotalEnd).toBe(10);
    expect(snapshot.finalStandings[0]?.marketValueTotalEnd).toBe(100);
    expect(snapshot.finalStandings[0]?.transferBuyCount).toBe(1);
    expect(snapshot.playerPerformances).toHaveLength(1);
    expect(snapshot.playerPerformances[0]?.playerId).toBe("p1");
    expect(snapshot.playerPerformances[0]?.appearances).toBe(2);
    expect(snapshot.playerPerformances[0]?.averageContribution).toBe(19.3);
    expect(snapshot.playerPerformances[0]?.pps).toBe(38.5);
    expect(snapshot.playerPerformances[0]).toHaveProperty("mvs");
    expect(snapshot.playerPerformances[0]?.ovr).not.toBeNull();
    expect(snapshot.playerPerformances[0]?.marketValue).not.toBeNull();
    expect(snapshot.playerPerformances[0]?.salary).not.toBeNull();
    expect(snapshot.playerPerformances[0]?.contractLength).toBe(3);
    expect(snapshot.playerPerformances[0]?.promisedRole).toBe("starter");
    expect(snapshot.playerPerformances[0]?.top10Count).toBe(2);
    expect(snapshot.playerPerformances[0]?.mvpCount).toBe(1);
    expect(snapshot.transferSnapshots).toHaveLength(1);
    expect(snapshot.transferSnapshots?.[0]?.playerName).toBe("Alpha");
    expect(snapshot.transferSnapshots?.[0]?.source).toBe("local_transfer_history");
  });

  it("keeps dry run read-only and reports snapshot coverage", () => {
    const gameState = createGameState();
    gameState.seasonState.cashPrizeApplyLogs = [];

    const result = buildSeasonSnapshotDryRun(gameState, { saveId: "save-local" });

    expect(result.ok).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(result.canCreate).toBe(true);
    expect(result.seasonCompleted).toBe(true);
    expect(result.blockingReasons).not.toContain("season_not_completed_for_snapshot");
    expect(result.coverage.cashAppliedMatchdays).toBe(0);
    expect(result.warnings.some((warning) => warning.includes("Missing cash apply logs"))).toBe(true);
    expect(result.snapshot.status).toBe("completed");
  });

  it("treats one season-end cash apply log as full season cash coverage", () => {
    const gameState = createGameState();
    gameState.seasonState.cashPrizeApplyLogs = [
      {
        id: "cash-season-end",
        saveId: "save-local",
        seasonId: "season-1",
        matchdayId: "matchday-2",
        action: "apply",
        payload: {
          idempotencyKey: "cash-season-end",
          totalTeams: 2,
          appliedTeams: 2,
          totalPrizeMoney: 10,
        },
        createdAt: "2026-06-06T00:00:00.000Z",
      },
    ];

    const result = buildSeasonSnapshotDryRun(gameState, { saveId: "save-local" });

    expect(result.coverage.cashAppliedMatchdays).toBe(result.coverage.totalMatchdays);
    expect(result.coverage.missingCashMatchdayIds).toEqual([]);
    expect(result.warnings.some((warning) => warning.includes("Missing cash apply logs"))).toBe(false);
  });

  it("creates a local snapshot only after explicit confirm", () => {
    const { save, persistence } = createPersistenceMock();

    const result = createSeasonSnapshot(
      {
        saveId: save.saveId,
        seasonId: "season-1",
        execute: true,
        dryRun: false,
        confirm: SEASON_SNAPSHOT_CONFIRM_TOKEN,
      },
      persistence as never,
    );

    expect(result.ok).toBe(true);
    expect(result.applied).toBe(true);
    expect(persistence.saveSingleplayerState).toHaveBeenCalledTimes(1);
    expect(save.gameState.seasonState.seasonSnapshots).toHaveLength(1);
    expect(save.gameState.seasonState.seasonSnapshots?.[0]?.seasonId).toBe("season-1");
  });

  it("blocks duplicate snapshots for the same season unless replacement is explicitly allowed", () => {
    const gameState = createGameState();
    gameState.seasonState.seasonSnapshots = [buildSeasonSnapshot(gameState)];
    const { save, persistence } = createPersistenceMock(gameState);

    const result = createSeasonSnapshot(
      {
        saveId: save.saveId,
        seasonId: "season-1",
        dryRun: true,
      },
      persistence as never,
    );

    expect(result.ok).toBe(false);
    expect(result.duplicateDetected).toBe(true);
    expect(result.blockingReasons).toContain("duplicate_season_snapshot");
    expect(persistence.saveSingleplayerState).not.toHaveBeenCalled();
  });

  it("blocks prisma mode as read-only", () => {
    const { save, persistence } = createPersistenceMock();

    const result = createSeasonSnapshot(
      {
        saveId: save.saveId,
        seasonId: "season-1",
        source: "prisma",
        dryRun: true,
      },
      persistence as never,
    );

    expect(result.ok).toBe(false);
    expect(result.blockingReasons[0]).toContain("read-only");
    expect(persistence.saveSingleplayerState).not.toHaveBeenCalled();
  });

  it("builds the all-time table only from stored snapshots", () => {
    const first = buildSeasonSnapshot(createGameState());
    const second = {
      ...first,
      snapshotId: "season-snapshot__season-2",
      seasonId: "season-2",
      seasonName: "Season 2",
      finalStandings: [
        {
          ...first.finalStandings[0]!,
          rank: 2,
          points: 77,
          isGold: false,
          isSilver: true,
          isBronze: false,
          isTop5: true,
          isTop10: true,
        },
        {
          ...first.finalStandings[1]!,
          rank: 1,
          points: 101,
          isGold: true,
          isSilver: false,
          isBronze: false,
          isTop5: true,
          isTop10: true,
        },
      ],
    };

    const allTime = buildAllTimeTableFromSnapshots([first, second], createGameState().teams);
    const teamA = allTime.find((entry) => entry.teamId === "A-A");

    expect(teamA?.seasonsPlayed).toBe(2);
    expect(teamA?.gold).toBe(1);
    expect(teamA?.silver).toBe(1);
    expect(teamA?.avgRank).toBe(1.5);
    expect(teamA?.historicalPow).toBe(39.8);
  });

  it("upserts a season snapshot per season id instead of duplicating history rows", () => {
    const snapshot = buildSeasonSnapshot(createGameState());
    const replaced = {
      ...snapshot,
      archivedAt: "2026-06-06T00:00:00.000Z",
    };

    const result = upsertSeasonSnapshotRecord([snapshot], replaced);

    expect(result).toHaveLength(1);
    expect(result[0]?.archivedAt).toBe("2026-06-06T00:00:00.000Z");
  });

  it("falls back to finalStandings when teamSnapshots is empty", () => {
    const snapshot = buildSeasonSnapshot(createGameState());
    const withEmptyTeamSnapshots = {
      ...snapshot,
      teamSnapshots: [],
    };

    expect(resolveSeasonSnapshotTeamRecords(withEmptyTeamSnapshots)).toEqual(snapshot.finalStandings);
  });

  it("patches completed season snapshot roster after next preseason buys", () => {
    const seasonOneSnapshot = buildSeasonSnapshot(createGameState());
    const patchedTeams = seasonOneSnapshot.finalStandings.map((team) => ({
      ...team,
      rosterEndPostSell: 7,
      rosterEnd: 7,
      rosterCountEnd: 7,
    }));
    const gameState: GameState = {
      ...createGameState(),
      season: {
        ...createGameState().season,
        id: "season-2",
        name: "Season 2",
      },
      seasonState: {
        ...createGameState().seasonState,
        seasonId: "season-2",
        seasonSnapshots: [
          {
            ...seasonOneSnapshot,
            finalStandings: patchedTeams,
            teamSnapshots: patchedTeams,
          },
        ],
      },
      rosters: [
        { teamId: "A-A", playerId: "p1", salary: 10, contractLength: 2 },
        { teamId: "A-A", playerId: "p2", salary: 10, contractLength: 2 },
        { teamId: "A-A", playerId: "p3", salary: 10, contractLength: 2 },
        { teamId: "B-B", playerId: "p4", salary: 10, contractLength: 2 },
      ],
      players: [
        { id: "p1", name: "P1", gender: "male", race: "human", rating: 50, potential: 60 },
        { id: "p2", name: "P2", gender: "male", race: "human", rating: 50, potential: 60 },
        { id: "p3", name: "P3", gender: "male", race: "human", rating: 50, potential: 60 },
        { id: "p4", name: "P4", gender: "male", race: "human", rating: 50, potential: 60 },
      ],
    };

    const result = patchCompletedSeasonSnapshotAfterPreseasonBuy(gameState, "season-2");
    expect(result.patched).toBe(true);
    const seasonOne = result.gameState.seasonState.seasonSnapshots?.find((entry) => entry.seasonId === "season-1");
    const teamA = seasonOne?.finalStandings.find((team) => team.teamId === "A-A");
    const teamB = seasonOne?.finalStandings.find((team) => team.teamId === "B-B");
    expect(teamA?.rosterEndPostSell).toBe(7);
    expect(teamA?.rosterEnd).toBe(3);
    expect(teamB?.rosterEnd).toBe(1);
    expect(seasonOne?.entryRosterPatchedFromSeasonId).toBe("season-2");
  });
});
