import { describe, expect, it } from "vitest";

import type { GameState, Player, RosterEntry, Team, TeamIdentity, TeamSeasonObjectiveRecord } from "@/lib/data/olyDataTypes";
import { buildTeamObjectiveOverview, getTeamObjectiveAiBias } from "@/lib/board/team-season-objectives-service";

function createTeam(partial?: Partial<Team>): Team {
  return {
    teamId: partial?.teamId ?? "M-M",
    shortCode: partial?.shortCode ?? "M-M",
    name: partial?.name ?? "Mayhem Mavericks",
    budget: partial?.budget ?? 120,
    cash: partial?.cash ?? 90,
    identityId: partial?.identityId ?? partial?.teamId ?? "M-M",
    humanControlled: partial?.humanControlled ?? false,
    rosterLimit: partial?.rosterLimit ?? 12,
    rosterMinTarget: partial?.rosterMinTarget,
    rosterOptTarget: partial?.rosterOptTarget,
    logoPath: partial?.logoPath ?? null,
  };
}

function createIdentity(teamId: string, partial?: Partial<TeamIdentity>): TeamIdentity {
  return {
    teamId,
    playerType: null,
    pow: partial?.pow ?? 8,
    spe: partial?.spe ?? 7,
    men: partial?.men ?? 5,
    soc: partial?.soc ?? 3,
    ambition: partial?.ambition ?? 8,
    finances: partial?.finances ?? 5,
    boardConfidence: partial?.boardConfidence ?? 7,
    harmony: partial?.harmony ?? 5,
    manners: partial?.manners ?? 5,
    popularity: partial?.popularity ?? 5,
    cooperation: partial?.cooperation ?? 5,
    playerMin: partial?.playerMin ?? 7,
    playerOpt: partial?.playerOpt ?? 10,
  };
}

function createPlayer(id: string, partial?: Partial<Player>): Player {
  return {
    id,
    name: partial?.name ?? id,
    rating: partial?.rating ?? 60,
    marketValue: partial?.marketValue ?? 20,
    salaryDemand: partial?.salaryDemand ?? 5,
    displayMarketValue: partial?.displayMarketValue ?? partial?.marketValue ?? 20,
    displaySalary: partial?.displaySalary ?? partial?.salaryDemand ?? 5,
    className: partial?.className ?? "Hero",
    race: partial?.race ?? "Human",
    alignment: partial?.alignment ?? "N",
    gender: partial?.gender ?? "f",
    referenceClass: partial?.referenceClass ?? null,
    imageSource: partial?.imageSource ?? null,
    bracketLabel: partial?.bracketLabel ?? null,
    subclasses: partial?.subclasses ?? [],
    traitsPositive: partial?.traitsPositive ?? [],
    traitsNegative: partial?.traitsNegative ?? [],
    coreStats: partial?.coreStats ?? { pow: 40, spe: 40, men: 40, soc: 40 },
    preferredDisciplineIds: partial?.preferredDisciplineIds ?? [],
    disciplineRatings: partial?.disciplineRatings ?? { d1: 50 },
    disciplineTierCounts: partial?.disciplineTierCounts ?? { above20: 1, above40: 1, above60: 0, above80: 0 },
    flavorEn: partial?.flavorEn ?? "",
    flavorDe: partial?.flavorDe ?? "",
    fatigue: partial?.fatigue ?? 0,
    form: partial?.form ?? 0,
    potential: partial?.potential ?? 0,
    portraitPath: partial?.portraitPath ?? null,
    portraitUrl: partial?.portraitUrl ?? null,
  };
}

function createRoster(playerId: string, partial?: Partial<RosterEntry>): RosterEntry {
  return {
    id: partial?.id ?? `roster:${partial?.teamId ?? "M-M"}:${playerId}`,
    teamId: partial?.teamId ?? "M-M",
    playerId,
    contractLength: partial?.contractLength ?? 2,
    salary: partial?.salary ?? 5,
    upkeep: partial?.upkeep ?? partial?.salary ?? 5,
    purchasePrice: partial?.purchasePrice ?? 20,
    currentValue: partial?.currentValue ?? 20,
    roleTag: partial?.roleTag ?? "starter",
    joinedSeasonId: partial?.joinedSeasonId ?? "season-1",
  };
}

function createGameState(input?: {
  teams?: Team[];
  identities?: TeamIdentity[];
  players?: Player[];
  rosters?: RosterEntry[];
  standings?: GameState["seasonState"]["standings"];
  transferHistory?: GameState["transferHistory"];
  teamSeasonObjectives?: TeamSeasonObjectiveRecord[];
  boardConfidence?: GameState["seasonState"]["boardConfidence"];
}): GameState {
  const teams = input?.teams ?? [createTeam()];
  const players = input?.players ?? [createPlayer("p1"), createPlayer("p2")];
  const rosters = input?.rosters ?? players.map((player) => createRoster(player.id));
  return {
    season: {
      id: "season-3",
      name: "Season 3",
      year: 2026,
      currentMatchday: 1,
      matchdayIds: ["md-1"],
    },
    seasonState: {
      seasonId: "season-3",
      schedule: [],
      standings:
        input?.standings ??
        Object.fromEntries(
          teams.map((team, index) => [
            team.teamId,
            {
              points: 120 - index * 10,
              rank: index + 1,
            },
          ]),
        ),
      teamSeasonObjectives: input?.teamSeasonObjectives,
      boardConfidence: input?.boardConfidence,
    },
    matchdayState: {
      matchdayId: "md-1",
      status: "planning",
      pendingTeamIds: [],
      resolvedFixtureIds: [],
    },
    teams,
    teamIdentities: input?.identities ?? teams.map((team) => createIdentity(team.teamId)),
    players,
    disciplines: [],
    rosters,
    contracts: [],
    transferListings: [],
    transferHistory: input?.transferHistory ?? [],
    logs: [],
    mappingReport: {
      mappingSource: "",
      teamSource: "",
      generatedAt: "",
      processedMappingRows: 0,
      importedPlayerCount: players.length,
      matchedRosterCount: rosters.length,
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

describe("team season objectives service", () => {
  it("generates objectives for sport, finance, transfer, roster, facility, and development", () => {
    const overview = buildTeamObjectiveOverview(createGameState());
    const categories = new Set(overview.objectives.map((objective) => objective.category));

    expect(categories.has("sport")).toBe(true);
    expect(categories.has("finance")).toBe(true);
    expect(categories.has("transfer")).toBe(true);
    expect(categories.has("roster")).toBe(true);
    expect(categories.has("facility")).toBe(true);
    expect(categories.has("development")).toBe(true);
    expect(overview.warnings).toContain("sponsor_objective_source_missing");
  });

  it("uses team identity for profile-like goals such as M-M top target and C-C value transfer target", () => {
    const teams = [
      createTeam({ teamId: "M-M", shortCode: "M-M", name: "Mayhem Mavericks" }),
      createTeam({ teamId: "C-C", shortCode: "C-C", name: "Cash Creators" }),
    ];
    const gameState = createGameState({
      teams,
      identities: [createIdentity("M-M", { ambition: 10 }), createIdentity("C-C", { finances: 10, ambition: 5 })],
      players: [createPlayer("m1"), createPlayer("c1")],
      rosters: [createRoster("m1", { teamId: "M-M" }), createRoster("c1", { teamId: "C-C" })],
      standings: { "M-M": { points: 130, rank: 2 }, "C-C": { points: 80, rank: 14 } },
      transferHistory: [
        {
          id: "sell-c1",
          playerId: "x",
          seasonId: "season-3",
          seasonLabel: "Season 3",
          transferType: "sell",
          fromTeamId: "C-C",
          toTeamId: null,
          fee: 14,
          salary: 0,
          marketValue: 10,
          remainingContractLength: 1,
          happenedAt: "2026-06-12T00:00:00.000Z",
        },
      ],
    });

    const overview = buildTeamObjectiveOverview(gameState);
    const mmSport = overview.objectives.find((objective) => objective.teamId === "M-M" && objective.objectiveId === "sport-rank-3");
    const ccTransfer = overview.objectives.find((objective) => objective.teamId === "C-C" && objective.objectiveId === "transfer-profit");

    expect(mmSport?.label).toContain("Top 3");
    expect(mmSport?.status).toBe("completed");
    expect(ccTransfer?.targetValue).toBe(10);
    expect(ccTransfer?.status).toBe("completed");
  });

  it("updates objective status and board pressure when cash is negative", () => {
    const team = createTeam({ cash: -8 });
    const gameState = createGameState({ teams: [team], identities: [createIdentity(team.teamId, { boardConfidence: 4 })] });

    const overview = buildTeamObjectiveOverview(gameState);
    const cashObjective = overview.objectives.find((objective) => objective.objectiveId === "finance-cash-positive");
    const board = overview.boardConfidence[team.teamId];

    expect(cashObjective?.status).toBe("failed");
    expect(board?.pressure).toBeGreaterThanOrEqual(7);
    expect(board?.warnings).toContain("board_objectives_failed");
  });

  it("exposes AI objective bias for market decisions", () => {
    const team = createTeam({ teamId: "A-A", shortCode: "A-A", cash: -4 });
    const gameState = createGameState({
      teams: [team],
      identities: [createIdentity("A-A", { boardConfidence: 3, ambition: 3 })],
      players: [createPlayer("a1")],
      rosters: [createRoster("a1", { teamId: "A-A", salary: 40 })],
    });

    const bias = getTeamObjectiveAiBias(gameState, "A-A");

    expect(bias?.sellAggression).toBeGreaterThan(0.7);
    expect(bias?.budgetConservatism).toBeGreaterThan(0.6);
    expect(bias?.warnings).toContain("objective_bias_finance_caution");
  });

  it("refreshes stored objectives without replacing their label or source", () => {
    const storedObjective: TeamSeasonObjectiveRecord = {
      seasonId: "season-3",
      teamId: "M-M",
      objectiveId: "finance-cash-positive",
      category: "finance",
      label: "Eigener Board-Auftrag: Cash darf nie negativ werden",
      targetValue: "> 0",
      currentValue: 50,
      status: "open",
      rewardCash: 1,
      penaltyCash: 4,
      boardConfidenceDelta: 0,
      source: "saved_board_objective",
    };
    const gameState = createGameState({
      teams: [createTeam({ cash: -12 })],
      teamSeasonObjectives: [storedObjective],
      boardConfidence: {
        "M-M": { teamId: "M-M", value: 4, pressure: 7, warnings: ["saved_pressure"] },
      },
    });

    const overview = buildTeamObjectiveOverview(gameState);
    const refreshed = overview.objectives.find((objective) => objective.objectiveId === "finance-cash-positive");
    const board = overview.boardConfidence["M-M"];

    expect(refreshed?.label).toBe(storedObjective.label);
    expect(refreshed?.status).toBe("failed");
    expect(refreshed?.currentValue).toBe(-12);
    expect(refreshed?.source).toContain("saved_board_objective");
    expect(board?.warnings).toContain("board_confidence_source_saved_state");
  });

  it("adds playable mini objectives for form color coverage and current matchday top 10", () => {
    const gameState = createGameState();
    gameState.seasonState.formCards = [
      { id: "fc-1", saveId: "save-1", seasonId: "season-3", teamId: "M-M", playerId: "p1", playerName: "p1", cardColor: "red", cardValue: 1, createdAt: "2026-06-13T10:00:00.000Z" },
      { id: "fc-2", saveId: "save-1", seasonId: "season-3", teamId: "M-M", playerId: "p2", playerName: "p2", cardColor: "green", cardValue: 1, createdAt: "2026-06-13T10:00:00.000Z" },
      { id: "fc-3", saveId: "save-1", seasonId: "season-3", teamId: "M-M", playerId: "p3", playerName: "p3", cardColor: "blue", cardValue: 1, createdAt: "2026-06-13T10:00:00.000Z" },
    ];
    gameState.seasonState.disciplineSchedule = [
      {
        seasonId: "season-3",
        matchdayId: "md-1",
        matchdayIndex: 1,
        matchdayLabel: "MD 1",
        discipline1: { disciplineId: "d1", displayName: "Climbing", order: 1, playerCount: 6, category: "power" },
        discipline2: { disciplineId: "d2", displayName: "Football", order: 2, playerCount: 4, category: "social" },
        sourceStatus: "season_seed",
        sourceNote: null,
      },
    ];
    gameState.seasonState.matchdayResults = [
      {
        id: "result-1",
        saveId: "save-1",
        seasonId: "season-3",
        matchdayId: "md-1",
        status: "preview_applied",
        sourceVersion: "test",
        teamsTotal: 1,
        teamsReady: 1,
        teamsUnderfilled: 0,
        teamsMissingLineup: 0,
        teamsInvalidLineup: 0,
        teamsMissingScoreCoverage: 0,
        warningsCount: 0,
        createdAt: "2026-06-13T10:00:00.000Z",
        updatedAt: "2026-06-13T10:00:00.000Z",
      },
    ];
    gameState.seasonState.disciplineResults = [
      {
        id: "dr-1",
        matchdayResultId: "result-1",
        teamId: "M-M",
        disciplineId: "d1",
        disciplineSide: "d1",
        rank: 8,
        baseScore: 90,
        totalScore: 96,
        readinessStatus: "ready",
        warnings: [],
        createdAt: "2026-06-13T10:00:00.000Z",
      },
    ];

    const overview = buildTeamObjectiveOverview(gameState);
    const formColor = overview.objectives.find((objective) => objective.objectiveId === "roster-form-color-cover");
    const matchdayTop10 = overview.objectives.find((objective) => objective.objectiveId === "sport-next-matchday-top10");

    expect(formColor?.status).toBe("completed");
    expect(matchdayTop10?.status).toBe("completed");
    expect(matchdayTop10?.label).toContain("Climbing/Football");
  });
});
