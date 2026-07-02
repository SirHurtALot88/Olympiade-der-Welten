import { describe, expect, it } from "vitest";

import type { GameState, Player, RosterEntry, Team } from "@/lib/data/olyDataTypes";
import {
  buildLightweightTeamSeasonStandRows,
  buildTeamSeasonOverviewRows,
} from "@/lib/foundation/team-management-overview";

function createTeam(partial?: Partial<Team>): Team {
  return {
    teamId: partial?.teamId ?? "A-A",
    shortCode: partial?.shortCode ?? "A-A",
    name: partial?.name ?? "Armageddon Aftermath",
    budget: partial?.budget ?? 500000,
    cash: partial?.cash ?? 120000,
    identityId: partial?.identityId ?? "A-A",
    humanControlled: partial?.humanControlled ?? true,
    rosterLimit: partial?.rosterLimit ?? 12,
    logoPath: partial?.logoPath ?? null,
  };
}

function createPlayer(id: string, partial?: Partial<Player>): Player {
  return {
    id,
    name: partial?.name ?? id,
    rating: partial?.rating ?? 50,
    marketValue: partial?.marketValue ?? 1000,
    salaryDemand: partial?.salaryDemand ?? 100,
    displayMarketValue: partial?.displayMarketValue,
    displaySalary: partial?.displaySalary,
    cost: partial?.cost,
    upkeepBase: partial?.upkeepBase,
    className: partial?.className ?? "Berserker",
    race: partial?.race ?? "Human",
    alignment: partial?.alignment ?? "N",
    gender: partial?.gender ?? "f",
    referenceClass: partial?.referenceClass ?? null,
    imageSource: partial?.imageSource ?? null,
    bracketLabel: partial?.bracketLabel ?? null,
    subclasses: partial?.subclasses ?? [],
    traitsPositive: partial?.traitsPositive ?? [],
    traitsNegative: partial?.traitsNegative ?? [],
    coreStats: partial?.coreStats ?? { pow: 10, spe: 10, men: 10, soc: 10 },
    preferredDisciplineIds: partial?.preferredDisciplineIds ?? [],
    disciplineRatings: partial?.disciplineRatings ?? { d1: 10, d2: 10 },
    disciplineTierCounts:
      partial?.disciplineTierCounts ?? {
        above20: 0,
        above40: 0,
        above60: 0,
        above80: 0,
      },
    flavorEn: partial?.flavorEn ?? "",
    flavorDe: partial?.flavorDe ?? "",
    fatigue: partial?.fatigue ?? 0,
    form: partial?.form ?? 0,
    potential: partial?.potential ?? 0,
    portraitPath: partial?.portraitPath ?? null,
    portraitUrl: partial?.portraitUrl ?? null,
    attributeSheetStats: partial?.attributeSheetStats,
    attributeSheetRatings: partial?.attributeSheetRatings,
  };
}

function createRosterEntry(id: string, playerId: string, partial?: Partial<RosterEntry>): RosterEntry {
  return {
    id,
    teamId: partial?.teamId ?? "A-A",
    playerId,
    contractLength: partial?.contractLength ?? 3,
    salary: partial?.salary ?? 1000,
    upkeep: partial?.upkeep ?? partial?.salary ?? 1000,
    purchasePrice: partial?.purchasePrice ?? 5000,
    currentValue: partial?.currentValue ?? 5500,
    roleTag: partial?.roleTag ?? "starter",
    joinedSeasonId: partial?.joinedSeasonId ?? "season-1",
  };
}

function createGameState(input?: {
  teams?: Team[];
  players?: Player[];
  rosters?: RosterEntry[];
  disciplines?: GameState["disciplines"];
}): GameState {
  const teams = input?.teams ?? [createTeam()];
  return {
    season: {
      id: "season-1",
      name: "Season 1",
      year: 2026,
      currentMatchday: 1,
      matchdayIds: ["matchday-1"],
    },
    seasonState: {
      seasonId: "season-1",
      schedule: [],
      standings: Object.fromEntries(teams.map((team) => [team.teamId, { points: 0 }])),
    },
    matchdayState: {
      matchdayId: "matchday-1",
      status: "planning",
      pendingTeamIds: [],
      resolvedFixtureIds: [],
    },
    teams,
    teamIdentities: [],
    players: input?.players ?? [],
    disciplines: input?.disciplines ?? [],
    rosters: input?.rosters ?? [],
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
      teamCount: teams.length,
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

describe("team management overview", () => {
  it("keeps active season rank on start-budget order while no current points exist", () => {
    const team = createTeam({ cash: 222, budget: 100 });
    const gameState = createGameState({ teams: [team] });
    gameState.season = {
      id: "season-3",
      name: "Season 3",
      year: 2026,
      currentMatchday: 1,
      matchdayIds: ["matchday-1"],
    } as GameState["season"];
    gameState.seasonState = {
      ...gameState.seasonState,
      seasonId: "season-3",
      standings: { "A-A": { points: 0, rank: 12 } },
      seasonSnapshots: [
        {
          seasonId: "season-2",
          seasonName: "Season 2",
          status: "completed",
          sourceStatus: "mapped",
          archivedAt: "2026-06-12T10:00:00.000Z",
          finalStandings: [
            {
              teamId: "A-A",
              teamCode: "A-A",
              teamName: "Armageddon Aftermath",
              rank: 4,
              points: 121.5,
              disciplinePoints: 118.4,
              disciplinePointsByArea: { pow: 40.1, spe: 30.2, men: 28.3, soc: 19.8 },
              cashEnd: 999,
              rosterEnd: 10,
              salaryEnd: 77,
              marketValueEnd: 300,
              transferCount: 2,
              transferBuyCount: 1,
              transferSellCount: 1,
              transferNet: 0,
            },
          ],
          playerPerformances: [],
        },
      ],
    };

    const result = buildTeamSeasonOverviewRows({ gameState });

    expect(result[0]?.rank).toBe(1);
    expect(result[0]?.points).toBeNull();
    expect(result[0]?.ppsPow).toBe(0);
    expect(result[0]?.ppsSpe).toBe(0);
    expect(result[0]?.ppsMen).toBe(0);
    expect(result[0]?.ppsSoc).toBe(0);
    expect(result[0]?.cash).toBe(222);
    expect(result[0]?.historicalLastSeasonRank).toBe(4);
    expect(result[0]?.historicalLastSeasonPoints).toBe(118.4);
  });

  it("builds lightweight standings rows without season derivations", () => {
    const gameState = createGameState();
    const lightweight = buildLightweightTeamSeasonStandRows({
      gameState,
      standingsByTeamId: {
        [gameState.teams[0]!.teamId]: {
          rank: 1,
          points: 42,
          cash: gameState.teams[0]!.cash,
        },
      },
    });

    expect(lightweight).toHaveLength(gameState.teams.length);
    expect(lightweight[0]?.rank).toBe(1);
    expect(lightweight[0]?.points).toBe(42);
    expect(lightweight[0]?.ppsTotal).toBe(0);
    expect(lightweight[0]?.disciplineValues.bonuspunkte).toBeNull();
  });

  it("aggregates roster count, visible salary total and average contract length", () => {
    const players = [createPlayer("p1"), createPlayer("p2"), createPlayer("p3")];
    const rosters = [
      createRosterEntry("r1", "p1", { salary: 1000, contractLength: 3 }),
      createRosterEntry("r2", "p2", { salary: 2000, contractLength: 5 }),
      createRosterEntry("r3", "p3", { salary: 3000, contractLength: 4 }),
    ];

    const result = buildTeamSeasonOverviewRows({
      gameState: createGameState({ players, rosters }),
    });

    expect(result[0]?.rosterCount).toBe(3);
    expect(result[0]?.salaryTotal).toBe(6000);
    expect(result[0]?.avgContractLength).toBe(4);
  });

  it("uses active roster salary for visible team salary totals in management views", () => {
    const players = [
      createPlayer("p1", { displaySalary: 10.5, salaryDemand: 10000 }),
      createPlayer("p2", { displaySalary: 5.25, salaryDemand: 5000 }),
    ];
    const rosters = [
      createRosterEntry("r1", "p1", { salary: 10000, contractLength: 3 }),
      createRosterEntry("r2", "p2", { salary: 5000, contractLength: 5 }),
    ];

    const result = buildTeamSeasonOverviewRows({
      gameState: createGameState({ players, rosters }),
    });

    expect(result[0]?.salaryTotal).toBe(15000);
  });

  it("uses current local team cash instead of a stale standings cash projection", () => {
    const players = [createPlayer("p1"), createPlayer("p2")];
    const rosters = [
      createRosterEntry("r1", "p1", { salary: 1000 }),
      createRosterEntry("r2", "p2", { salary: 9000 }),
    ];

    const result = buildTeamSeasonOverviewRows({
      gameState: createGameState({ players, rosters }),
      standingsByTeamId: {
        "A-A": {
          rank: 4,
          points: 11,
          cash: 777777,
          budget: 175,
        },
      },
    });

    expect(result[0]?.cash).toBe(120000);
    expect(result[0]?.budget).toBe(175);
    expect(result[0]?.cash).not.toBe(result[0]?.salaryTotal);
  });

  it("derives visible market value totals from the imported player economy source", () => {
    const players = [
      createPlayer("p1", { rating: 60, disciplineRatings: { pow1: 40, spe1: 20 } }),
      createPlayer("p2", { rating: 70, disciplineRatings: { pow1: 50, spe1: 30 } }),
    ];
    const rosters = [
      createRosterEntry("r1", "p1", { salary: 1000, contractLength: 3, currentValue: 5000 }),
      createRosterEntry("r2", "p2", { salary: 2000, contractLength: 4, currentValue: 7000 }),
    ];
    const disciplines: GameState["disciplines"] = [
      { id: "pow1", name: "Power Test", category: "power", weight: 1 },
      { id: "spe1", name: "Speed Test", category: "speed", weight: 1 },
    ];

    const result = buildTeamSeasonOverviewRows({
      gameState: createGameState({ players, rosters, disciplines }),
    });

    expect(result[0]?.marketValueTotal).toBe(2000);
    expect(result[0]?.avgContractLength).toBe(3.5);
  });

  it("includes real roster targets and transfer summaries when those sources are provided", () => {
    const players = [createPlayer("p1")];
    const rosters = [createRosterEntry("r1", "p1", { salary: 1000 })];

    const result = buildTeamSeasonOverviewRows({
      gameState: createGameState({ teams: [createTeam({ cash: 240 })], players, rosters }),
      standingsByTeamId: {
        "A-A": {
          rank: 2,
          points: 7,
          cash: 240,
          budget: 175,
          playerMin: 7,
          playerOpt: 10,
        },
      },
      transferSummaryByTeamId: {
        "A-A": {
          transferCount: 3,
          transferBuyTotal: 12,
          transferSellTotal: 21,
          transferNet: 9,
        },
      },
    });

    expect(result[0]?.rosterTarget).toBe("7 / 10");
    expect(result[0]?.transferCount).toBe(3);
    expect(result[0]?.transferNet).toBe(9);
    expect(result[0]?.transfersSeasonValue).toBe(9);
    expect(result[0]?.cashDelta).toBe(65);
  });

  it("derives current season PPs from stored discipline results and player performances instead of roster ratings", () => {
    const player = createPlayer("p1", {
      rating: 99,
      disciplineRatings: { pow1: 99, spe1: 98 },
      coreStats: { pow: 99, spe: 98, men: 97, soc: 96 },
    });
    const gameState = createGameState({
      players: [player],
      rosters: [createRosterEntry("r1", "p1", { salary: 1000, contractLength: 3 })],
      disciplines: [
        { id: "pow1", name: "Power Test", category: "power", weight: 1 },
        { id: "spe1", name: "Speed Test", category: "speed", weight: 1 },
      ],
    });

    gameState.seasonState.matchdayResults = [
      {
        id: "result-1",
        saveId: "save-local",
        seasonId: "season-1",
        matchdayId: "matchday-1",
        status: "preview_applied",
        sourceVersion: "test",
        teamsTotal: 1,
        teamsReady: 1,
        teamsUnderfilled: 0,
        teamsMissingLineup: 0,
        teamsInvalidLineup: 0,
        teamsMissingScoreCoverage: 0,
        warningsCount: 0,
        createdAt: "2026-06-06T12:00:00.000Z",
        updatedAt: "2026-06-06T12:00:00.000Z",
      },
    ];
    gameState.seasonState.disciplineResults = [
      {
        id: "discipline-pow",
        matchdayResultId: "result-1",
        teamId: "A-A",
        disciplineId: "pow1",
        disciplineSide: "d1",
        rank: 1,
        baseScore: 40,
        totalScore: 45.5,
        readinessStatus: "ready",
        warnings: [],
        createdAt: "2026-06-06T12:01:00.000Z",
      },
      {
        id: "discipline-spe",
        matchdayResultId: "result-1",
        teamId: "A-A",
        disciplineId: "spe1",
        disciplineSide: "d2",
        rank: 1,
        baseScore: 35,
        totalScore: 36.5,
        readinessStatus: "ready",
        warnings: [],
        createdAt: "2026-06-06T12:02:00.000Z",
      },
    ];
    gameState.seasonState.playerDisciplinePerformances = [
      {
        id: "perf-1",
        matchdayResultId: "result-1",
        teamId: "A-A",
        playerId: "p1",
        activePlayerId: "r1",
        disciplineId: "pow1",
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
        createdAt: "2026-06-06T12:03:00.000Z",
      },
      {
        id: "perf-2",
        matchdayResultId: "result-1",
        teamId: "A-A",
        playerId: "p1",
        activePlayerId: "r1",
        disciplineId: "spe1",
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
        createdAt: "2026-06-06T12:04:00.000Z",
      },
    ];

    const result = buildTeamSeasonOverviewRows({ gameState });

    expect(result[0]?.points).toBe(40);
    expect(result[0]?.ppsPow).toBe(21.5);
    expect(result[0]?.ppsSpe).toBe(18.5);
    expect(result[0]?.ppsMen).toBe(0);
    expect(result[0]?.ppsSoc).toBe(0);
    expect(result[0]?.ppsTotal).toBe(40);
    expect(result[0]?.avgPps).toBe(40);
  });

  it("passes mapped season discipline sheet values through to the shared team row while keeping stored season points primary", () => {
    const players = [createPlayer("p1")];
    const rosters = [createRosterEntry("r1", "p1", { salary: 1000 })];

    const result = buildTeamSeasonOverviewRows({
      gameState: createGameState({ players, rosters }),
      standingsByTeamId: {
        "A-A": {
          rank: 2,
          points: 7,
          cash: 240,
          disciplineValues: {
            schach: 11.5,
            tdm: 8,
            i_spy: 3.2,
          },
        },
      },
    });

    expect(result[0]?.disciplineValues.schach).toBe(11.5);
    expect(result[0]?.disciplineValues.tdm).toBe(8);
    expect(result[0]?.disciplineValues.i_spy).toBe(3.2);
    expect(result[0]?.disciplineValues.showcase ?? null).toBeNull();
    expect(result[0]?.points).toBe(7);
  });

  it("overrides stale standings discipline values with real local season discipline points when matchday results exist", () => {
    const player = createPlayer("p1", {
      disciplineRatings: { "mini-dm": 88, fechten: 75 },
    });
    const gameState = createGameState({
      players: [player],
      rosters: [createRosterEntry("r1", "p1", { salary: 1000, contractLength: 3 })],
      disciplines: [
        { id: "mini-dm", name: "Mini DM", category: "power", weight: 1 },
        { id: "fechten", name: "Fechten", category: "speed", weight: 1 },
      ],
    });

    gameState.seasonState.matchdayResults = [
      {
        id: "matchday-result-1",
        saveId: "save-1",
        seasonId: "season-1",
        matchdayId: "matchday-1",
        status: "preview_applied",
        sourceVersion: "test",
        teamsTotal: 1,
        teamsReady: 1,
        teamsUnderfilled: 0,
        teamsMissingLineup: 0,
        teamsInvalidLineup: 0,
        teamsMissingScoreCoverage: 0,
        warningsCount: 0,
        createdAt: "2026-06-07T10:00:00.000Z",
        updatedAt: "2026-06-07T10:00:00.000Z",
      },
    ];
    gameState.seasonState.disciplineResults = [
      {
        id: "discipline-result-1",
        matchdayResultId: "matchday-result-1",
        teamId: "A-A",
        disciplineId: "mini-dm",
        disciplineSide: "d1",
        rank: 1,
        baseScore: 4.2,
        totalScore: 4.2,
        readinessStatus: "ready",
        warnings: [],
        createdAt: "2026-06-07T10:01:00.000Z",
      },
      {
        id: "discipline-result-2",
        matchdayResultId: "matchday-result-1",
        teamId: "A-A",
        disciplineId: "fechten",
        disciplineSide: "d2",
        rank: 2,
        baseScore: 3.8,
        totalScore: 3.8,
        readinessStatus: "ready",
        warnings: [],
        createdAt: "2026-06-07T10:02:00.000Z",
      },
    ];

    const result = buildTeamSeasonOverviewRows({
      gameState,
      standingsByTeamId: {
        "A-A": {
          rank: 1,
          points: 8,
          cash: 240,
          disciplineValues: {
            mini_dm: 0,
            fechten: 0,
          },
        },
      },
    });

    expect(result[0]?.disciplineValues.mini_dm).toBe(4.2);
    expect(result[0]?.disciplineValues.fechten).toBe(3.8);
    expect(result[0]?.points).toBe(8);
  });

  it("keeps selected snapshot discipline values in sync instead of overlaying live ledger values", () => {
    const player = createPlayer("p1", {
      disciplineRatings: { "mini-dm": 88, fechten: 75 },
    });
    const gameState = createGameState({
      players: [player],
      rosters: [createRosterEntry("r1", "p1", { salary: 1000, contractLength: 3 })],
      disciplines: [
        { id: "mini-dm", name: "Mini DM", category: "power", weight: 1 },
        { id: "fechten", name: "Fechten", category: "speed", weight: 1 },
      ],
    });

    gameState.seasonState.matchdayResults = [
      {
        id: "matchday-result-1",
        saveId: "save-1",
        seasonId: "season-1",
        matchdayId: "matchday-1",
        status: "preview_applied",
        sourceVersion: "test",
        teamsTotal: 1,
        teamsReady: 1,
        teamsUnderfilled: 0,
        teamsMissingLineup: 0,
        teamsInvalidLineup: 0,
        teamsMissingScoreCoverage: 0,
        warningsCount: 0,
        createdAt: "2026-06-07T10:00:00.000Z",
        updatedAt: "2026-06-07T10:00:00.000Z",
      },
    ];
    gameState.seasonState.disciplineResults = [
      {
        id: "discipline-result-1",
        matchdayResultId: "matchday-result-1",
        teamId: "A-A",
        disciplineId: "mini-dm",
        disciplineSide: "d1",
        rank: 1,
        baseScore: 4.2,
        totalScore: 4.2,
        readinessStatus: "ready",
        warnings: [],
        createdAt: "2026-06-07T10:01:00.000Z",
      },
      {
        id: "discipline-result-2",
        matchdayResultId: "matchday-result-1",
        teamId: "A-A",
        disciplineId: "fechten",
        disciplineSide: "d2",
        rank: 2,
        baseScore: 3.8,
        totalScore: 3.8,
        readinessStatus: "ready",
        warnings: [],
        createdAt: "2026-06-07T10:02:00.000Z",
      },
    ];

    const result = buildTeamSeasonOverviewRows({
      gameState,
      preferStandingDisciplineValues: true,
      standingsByTeamId: {
        "A-A": {
          rank: 1,
          points: 23,
          cash: 240,
          disciplineValues: {
            mini_dm: 11,
            fechten: 12,
          },
        },
      },
    });

    expect(result[0]?.disciplineValues.mini_dm).toBe(11);
    expect(result[0]?.disciplineValues.fechten).toBe(12);
    expect(result[0]?.ppsPow).toBe(11);
    expect(result[0]?.ppsSpe).toBe(12);
    expect(result[0]?.points).toBe(23);
  });

  it("falls back to visible discipline totals only when no stored standing points exist", () => {
    const players = [createPlayer("p1")];
    const rosters = [createRosterEntry("r1", "p1", { salary: 1000 })];

    const result = buildTeamSeasonOverviewRows({
      gameState: createGameState({ players, rosters }),
      standingsByTeamId: {
        "A-A": {
          rank: 2,
          points: null,
          cash: 240,
          disciplineValues: {
            schach: 1.2,
            tdm: 3.4,
            showcase: 0,
          },
        },
      },
    });

    expect(result[0]?.points).toBe(4.6);
  });

  it("uses discipline area totals when ledger area points are zero but standings exist", () => {
    const players = [createPlayer("p1")];
    const rosters = [createRosterEntry("r1", "p1", { salary: 1000 })];

    const result = buildTeamSeasonOverviewRows({
      gameState: createGameState({
        players,
        rosters,
        disciplines: [
          { id: "mini-dm", name: "Mini DM", category: "power", weight: 1 },
          { id: "fechten", name: "Fechten", category: "speed", weight: 1 },
          { id: "schach", name: "Schach", category: "mental", weight: 1 },
          { id: "football", name: "Football", category: "social", weight: 1 },
        ],
      }),
      preferStandingDisciplineValues: true,
      standingsByTeamId: {
        "A-A": {
          rank: 1,
          points: 35,
          cash: 240,
          disciplineValues: {
            mini_dm: 11,
            schach: 7,
            fechten: 12,
            football: 5,
          },
        },
      },
    });

    expect(result[0]?.ppsPow).toBe(11);
    expect(result[0]?.ppsSpe).toBe(12);
    expect(result[0]?.ppsMen).toBe(7);
    expect(result[0]?.ppsSoc).toBe(5);
  });

  it("preserves standing discipline values when ledger discipline totals are zero", () => {
    const players = [createPlayer("p1")];
    const rosters = [createRosterEntry("r1", "p1", { salary: 1000 })];

    const result = buildTeamSeasonOverviewRows({
      gameState: createGameState({
        players,
        rosters,
        disciplines: [
          { id: "mini-dm", name: "Mini DM", category: "power", weight: 1 },
          { id: "fechten", name: "Fechten", category: "speed", weight: 1 },
          { id: "schach", name: "Schach", category: "mental", weight: 1 },
          { id: "football", name: "Football", category: "social", weight: 1 },
        ],
      }),
      standingsByTeamId: {
        "A-A": {
          rank: 1,
          points: 35,
          cash: 240,
          disciplineValues: {
            mini_dm: 11,
            schach: 7,
            fechten: 12,
            football: 5,
          },
        },
      },
    });

    expect(result[0]?.disciplineValues.mini_dm).toBe(11);
    expect(result[0]?.ppsPow).toBe(11);
    expect(result[0]?.ppsSpe).toBe(12);
    expect(result[0]?.ppsMen).toBe(7);
    expect(result[0]?.ppsSoc).toBe(5);
  });

  it("keeps stored standing points even when visible discipline values are real zero", () => {
    const players = [createPlayer("p1")];
    const rosters = [createRosterEntry("r1", "p1", { salary: 1000 })];

    const result = buildTeamSeasonOverviewRows({
      gameState: createGameState({ players, rosters }),
      standingsByTeamId: {
        "A-A": {
          rank: 2,
          points: 17,
          cash: 240,
          disciplineValues: {
            schach: 0,
            tdm: 0,
            showcase: 0,
          },
        },
      },
    });

    expect(result[0]?.points).toBe(17);
  });

  it("keeps stored standing points when no visible discipline source exists", () => {
    const players = [createPlayer("p1")];
    const rosters = [createRosterEntry("r1", "p1", { salary: 1000 })];

    const result = buildTeamSeasonOverviewRows({
      gameState: createGameState({ players, rosters }),
      standingsByTeamId: {
        "A-A": {
          rank: 2,
          points: 17,
          cash: 240,
        },
      },
    });

    expect(result[0]?.points).toBe(17);
  });

  it("falls back to start-budget rank and startplatz when no current points exist", () => {
    const teams = [
      createTeam({ teamId: "M-M", shortCode: "M-M", name: "Mayhem Mavericks", cash: 10, budget: 325 }),
      createTeam({ teamId: "R-R", shortCode: "R-R", name: "Riptide Rivers", cash: 170, budget: 170 }),
    ];

    const result = buildTeamSeasonOverviewRows({
      gameState: createGameState({ teams, players: [], rosters: [] }),
      standingsByTeamId: {
        "M-M": { rank: 6, points: 0, cash: 10, budget: 325 },
        "R-R": { rank: 1, points: 0, cash: 170, budget: 170 },
      },
    });

    expect(result[0]?.teamId).toBe("M-M");
    expect(result[0]?.rank).toBe(1);
    expect(result[0]?.startplatz).toBe(1);
    expect(result[1]?.teamId).toBe("R-R");
    expect(result[1]?.rank).toBe(2);
    expect(result[1]?.startplatz).toBe(2);
  });

  it("passes mapped season finance sheet values through to the shared team row", () => {
    const players = [createPlayer("p1")];
    const rosters = [createRosterEntry("r1", "p1", { salary: 1000 })];

    const result = buildTeamSeasonOverviewRows({
      gameState: createGameState({ players, rosters }),
      standingsByTeamId: {
        "A-A": {
          rank: 2,
          points: 7,
          cash: 240,
          cashFc: -12.5,
          startplatz: 5,
          rankDiff: -1,
          sponsorBasis: 22.4,
          sponsorRank: 0,
          sponsorTotal: 34.9,
          guv: -4.2,
          cashTotal: 88.5,
          form: 3,
          transfers: null,
        },
      },
    });

    expect(result[0]?.cashFc).toBe(-12.5);
    expect(result[0]?.startplatz).toBe(5);
    expect(result[0]?.rankDiff).toBe(-1);
    expect(result[0]?.sponsorBasis).toBe(22.4);
    expect(result[0]?.sponsorRank).toBe(0);
    expect(result[0]?.sponsorTotal).toBe(34.9);
    expect(result[0]?.sponsorSeason).toBe(12.5);
    expect(result[0]?.guv).toBe(-4.2);
    expect(result[0]?.cashTotal).toBe(88.5);
    expect(result[0]?.financeForm).toBe(3);
    expect(result[0]?.transfersSeasonValue).toBe(0);
  });

  it("recomputes roster, salary and average contract after buy and sell style roster changes", () => {
    const players = [createPlayer("p1"), createPlayer("p2"), createPlayer("p3"), createPlayer("p4")];
    const baseRosters = [
      createRosterEntry("r1", "p1", { salary: 1000, contractLength: 3 }),
      createRosterEntry("r2", "p2", { salary: 2000, contractLength: 5 }),
      createRosterEntry("r3", "p3", { salary: 3000, contractLength: 4 }),
    ];

    const before = buildTeamSeasonOverviewRows({
      gameState: createGameState({ teams: [createTeam({ cash: 50000 })], players, rosters: baseRosters }),
      standingsByTeamId: { "A-A": { rank: 1, points: 0, cash: 50000 } },
    })[0];

    const afterBuy = buildTeamSeasonOverviewRows({
      gameState: createGameState({
        teams: [createTeam({ cash: 46000 })],
        players,
        rosters: [...baseRosters, createRosterEntry("r4", "p4", { salary: 4000, contractLength: 6 })],
      }),
      standingsByTeamId: { "A-A": { rank: 1, points: 0, cash: 46000 } },
    })[0];

    const afterSell = buildTeamSeasonOverviewRows({
      gameState: createGameState({
        teams: [createTeam({ cash: 53000 })],
        players,
        rosters: baseRosters.slice(1),
      }),
      standingsByTeamId: { "A-A": { rank: 1, points: 0, cash: 53000 } },
    })[0];

    expect(before?.rosterCount).toBe(3);
    expect(afterBuy?.rosterCount).toBe(4);
    expect(afterBuy?.salaryTotal).toBe(10000);
    expect(afterBuy?.avgContractLength).toBe(4.5);
    expect(afterBuy?.cash).toBe(46000);

    expect(afterSell?.rosterCount).toBe(2);
    expect(afterSell?.salaryTotal).toBe(5000);
    expect(afterSell?.avgContractLength).toBe(4.5);
    expect(afterSell?.cash).toBe(53000);
  });

  it("keeps fresh season history fields honest when no discipline history exists", () => {
    const result = buildTeamSeasonOverviewRows({
      gameState: createGameState({
        teams: [createTeam()],
        players: [],
        rosters: [],
        disciplines: [
          { id: "pow1", name: "Power Test", category: "power", weight: 1 },
          { id: "spe1", name: "Speed Test", category: "speed", weight: 1 },
        ],
      }),
    });

    expect(result[0]?.historicalHasData).toBe(false);
    expect(result[0]?.historicalPow).toBeNull();
    expect(result[0]?.historicalSpe).toBeNull();
    expect(result[0]?.historicalMen).toBeNull();
    expect(result[0]?.historicalSoc).toBeNull();
    expect(result[0]?.historicalPointsTotal).toBeNull();
    expect(result[0]?.historicalGoldCount).toBe(0);
    expect(result[0]?.historicalSilverCount).toBe(0);
    expect(result[0]?.historicalBronzeCount).toBe(0);
    expect(result[0]?.historicalTop5Count).toBe(0);
    expect(result[0]?.historicalTop10Count).toBe(0);
    expect(result[0]?.historicalAvgRank).toBeNull();
    expect(result[0]?.historicalSeasonsPlayed).toBe(0);
    expect(result[0]?.historicalBestRank).toBeNull();
    expect(result[0]?.historicalLastSeasonRank).toBeNull();
    expect(result[0]?.historicalLastSeasonPoints).toBeNull();
    expect(result[0]?.avgMarketValue).toBeNull();
    expect(result[0]?.avgContractLength).toBeNull();
    expect(result[0]?.salaryTotal).toBe(0);
    expect(result[0]?.cash).toBe(120000);
  });

  it("aggregates historical area points and podium counts from archived season snapshots", () => {
    const gameState = createGameState({
      teams: [createTeam()],
      players: [],
      rosters: [],
    });

    gameState.seasonState.seasonSnapshots = [
      {
        seasonId: "season-1",
        seasonName: "Season 1",
        archivedAt: "2026-06-05T00:00:00.000Z",
        finalStandings: [
          {
            teamId: "A-A",
            teamCode: "A-A",
            teamName: "Armageddon Aftermath",
            rank: 1,
            points: 120,
            disciplinePoints: 109,
            disciplinePointsByArea: {
              pow: 44.5,
              spe: 31.5,
              men: 22,
              soc: 11,
            },
            cashEnd: 180,
            rosterEnd: 8,
            salaryEnd: 12000,
            marketValueEnd: 85000,
            transferCount: 2,
            transferBuyCount: 1,
            transferSellCount: 1,
            transferNet: 5,
          },
        ],
        playerPerformances: [],
      },
      {
        seasonId: "season-2",
        seasonName: "Season 2",
        archivedAt: "2026-06-06T00:00:00.000Z",
        finalStandings: [
          {
            teamId: "A-A",
            teamCode: "A-A",
            teamName: "Armageddon Aftermath",
            rank: 6,
            points: 88,
            disciplinePoints: 90,
            disciplinePointsByArea: {
              pow: 20,
              spe: 10,
              men: 30,
              soc: 30,
            },
            cashEnd: 160,
            rosterEnd: 7,
            salaryEnd: 11000,
            marketValueEnd: 82000,
            transferCount: 1,
            transferBuyCount: 0,
            transferSellCount: 1,
            transferNet: 12,
          },
        ],
        playerPerformances: [],
      },
    ];

    const result = buildTeamSeasonOverviewRows({ gameState });

    expect(result[0]?.historicalHasData).toBe(true);
    expect(result[0]?.historicalPow).toBe(64.5);
    expect(result[0]?.historicalSpe).toBe(41.5);
    expect(result[0]?.historicalMen).toBe(52);
    expect(result[0]?.historicalSoc).toBe(41);
    expect(result[0]?.historicalPointsTotal).toBe(199);
    expect(result[0]?.historicalGoldCount).toBe(1);
    expect(result[0]?.historicalSilverCount).toBe(0);
    expect(result[0]?.historicalBronzeCount).toBe(0);
    expect(result[0]?.historicalTop5Count).toBe(1);
    expect(result[0]?.historicalTop10Count).toBe(2);
    expect(result[0]?.historicalAvgRank).toBe(3.5);
    expect(result[0]?.historicalAvgPoints).toBe(99.5);
    expect(result[0]?.historicalPointsBySeason).toEqual([
      { seasonId: "season-1", seasonName: "Season 1", points: 109, rank: 1 },
      { seasonId: "season-2", seasonName: "Season 2", points: 90, rank: 6 },
    ]);
    expect(result[0]?.historicalSeasonsPlayed).toBe(2);
    expect(result[0]?.historicalBestRank).toBe(1);
    expect(result[0]?.historicalLastSeasonRank).toBe(6);
    expect(result[0]?.historicalLastSeasonPoints).toBe(90);
  });
});
