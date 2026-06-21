import { describe, expect, it } from "vitest";

import type { GameState, Player, RosterEntry, Team, TeamIdentity, TeamSeasonObjectiveRecord } from "@/lib/data/olyDataTypes";
import {
  buildTeamObjectiveOverview,
  buildTeamSeasonObjectiveSettlement,
  getTeamObjectiveAiBias,
  refreshTeamObjectiveState,
} from "@/lib/board/team-season-objectives-service";

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

function createMatchdayResult(id: string, matchdayId: string): NonNullable<GameState["seasonState"]["matchdayResults"]>[number] {
  return {
    id,
    saveId: "save-1",
    seasonId: "season-3",
    matchdayId,
    status: "preview_applied",
    sourceVersion: "test",
    teamsTotal: 2,
    teamsReady: 2,
    teamsUnderfilled: 0,
    teamsMissingLineup: 0,
    teamsInvalidLineup: 0,
    teamsMissingScoreCoverage: 0,
    warningsCount: 0,
    createdAt: "2026-06-13T10:00:00.000Z",
    updatedAt: "2026-06-13T10:00:00.000Z",
  };
}

function createDisciplineResult(
  id: string,
  matchdayResultId: string,
  teamId: string,
  totalScore: number,
): NonNullable<GameState["seasonState"]["disciplineResults"]>[number] {
  return {
    id,
    matchdayResultId,
    teamId,
    disciplineId: "d1",
    disciplineSide: "d1",
    rank: 1,
    baseScore: totalScore,
    totalScore,
    readinessStatus: "ready",
    warnings: [],
    createdAt: "2026-06-13T10:00:00.000Z",
  };
}

function createPlayerPerformance(
  id: string,
  input: { matchdayResultId: string; teamId: string; playerId: string; rankInDiscipline: number },
): NonNullable<GameState["seasonState"]["playerDisciplinePerformances"]>[number] {
  return {
    id,
    matchdayResultId: input.matchdayResultId,
    teamId: input.teamId,
    playerId: input.playerId,
    activePlayerId: null,
    disciplineId: "d1",
    disciplineSide: "d1",
    slotIndex: 0,
    baseValue: 50,
    finalPlayerScore: 60,
    scoreContribution: 12,
    rankInTeam: 1,
    rankInDiscipline: input.rankInDiscipline,
    isTop10: input.rankInDiscipline <= 10,
    isMvpCandidate: input.rankInDiscipline <= 5,
    storyWeight: null,
    createdAt: "2026-06-13T10:00:00.000Z",
  };
}

function createGameState(input?: {
  teams?: Team[];
  identities?: TeamIdentity[];
  players?: Player[];
  rosters?: RosterEntry[];
  disciplines?: GameState["disciplines"];
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
    disciplines: input?.disciplines ?? [],
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
  it("generates a compact four-objective board slate per team", () => {
    const overview = buildTeamObjectiveOverview(createGameState());
    const teamObjectives = overview.objectives.filter((objective) => objective.teamId === "M-M");
    const categories = new Set(teamObjectives.map((objective) => objective.category));

    expect(teamObjectives).toHaveLength(4);
    expect(categories.has("sport")).toBe(true);
    expect(categories.has("finance")).toBe(true);
    expect(categories.has("roster")).toBe(true);
    expect(overview.warnings).toContain("sponsor_objective_source_missing");
  });

  it("does not assign transfer-balance objectives during the Season 1 setup churn", () => {
    const players = Array.from({ length: 7 }, (_, index) => createPlayer(`p${index + 1}`));
    const gameState = createGameState({
      players,
      rosters: players.map((player) => createRoster(player.id)),
    });
    gameState.season = { ...gameState.season, id: "season-1", name: "Season 1" };
    gameState.seasonState = { ...gameState.seasonState, seasonId: "season-1" };

    const overview = buildTeamObjectiveOverview(gameState);

    expect(overview.objectives.some((objective) => objective.objectiveId === "transfer-profit")).toBe(false);
    expect(overview.objectives).toHaveLength(4);
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

  it("keeps bottom-table sport objectives realistic even for ambitious teams", () => {
    const teams = [
      createTeam({ teamId: "V-W", shortCode: "V-W", name: "Vigilante Wranglers" }),
      ...Array.from({ length: 31 }, (_, index) => createTeam({
        teamId: `T-${index + 1}`,
        shortCode: `T${index + 1}`,
        name: `Team ${index + 1}`,
      })),
    ];
    const gameState = createGameState({
      teams,
      identities: [
        createIdentity("V-W", { ambition: 9, boardConfidence: 6 }),
        ...teams.slice(1).map((team) => createIdentity(team.teamId, { ambition: 5 })),
      ],
      players: teams.map((team) => createPlayer(`${team.teamId}-p1`)),
      rosters: teams.map((team) => createRoster(`${team.teamId}-p1`, { teamId: team.teamId })),
      standings: Object.fromEntries(
        teams.map((team, index) => [
          team.teamId,
          {
            points: team.teamId === "V-W" ? 30 : 160 - index,
            rank: team.teamId === "V-W" ? 30 : index + 1,
          },
        ]),
      ),
    });

    const overview = buildTeamObjectiveOverview(gameState);
    const sportGoal = overview.objectives.find((objective) => objective.teamId === "V-W" && objective.category === "sport");

    expect(sportGoal?.objectiveId).toBe("sport-rank-27");
    expect(sportGoal?.label).toBe("Survival: nicht Bottom 5");
    expect(sportGoal?.targetValue).toBe(27);
  });

  it("does not fall back to top-10 goals when a weak team has no standing rank yet", () => {
    const team = createTeam({ teamId: "V-W", shortCode: "V-W", name: "Vigilante Wranglers", rosterOptTarget: 12 });
    const players = Array.from({ length: 7 }, (_, index) =>
      createPlayer(`vw-${index + 1}`, {
        rating: 38,
        marketValue: 10,
        displayMarketValue: 10,
        coreStats: { pow: 22, spe: 24, men: 26, soc: 20 },
      }),
    );
    const gameState = createGameState({
      teams: [team],
      identities: [createIdentity("V-W", { ambition: 9, playerMin: 8, playerOpt: 12 })],
      players,
      rosters: players.map((player) => createRoster(player.id, { teamId: "V-W", salary: 2, currentValue: 10 })),
      standings: {},
    });

    const overview = buildTeamObjectiveOverview(gameState);
    const sportGoal = overview.objectives.find((objective) => objective.teamId === "V-W" && objective.category === "sport");

    expect(sportGoal?.objectiveId).toBe("sport-rank-24");
    expect(sportGoal?.label).toBe("Kader stabilisieren");
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

  it("treats empty board rating as neutral five instead of low trust", () => {
    const team = createTeam({ cash: 12 });
    const zeroRating = buildTeamObjectiveOverview(createGameState({ teams: [team], identities: [createIdentity(team.teamId, { boardConfidence: 0 })] }))
      .boardConfidence[team.teamId];
    const neutralRating = buildTeamObjectiveOverview(createGameState({ teams: [team], identities: [createIdentity(team.teamId, { boardConfidence: 5 })] }))
      .boardConfidence[team.teamId];

    expect(zeroRating?.value).toBe(neutralRating?.value);
    expect(zeroRating?.pressure).toBe(neutralRating?.pressure);
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

  it("adds league-rank axis goals for specialist teams and allround goals for broad teams", () => {
    const teams = [
      createTeam({ teamId: "T-G", shortCode: "T-G", name: "The Giants" }),
      createTeam({ teamId: "W-W", shortCode: "W-W", name: "Wicked Wizards" }),
      createTeam({ teamId: "T-T", shortCode: "T-T", name: "Terrible Teachers" }),
      createTeam({ teamId: "A-1", shortCode: "A1", name: "Axis One" }),
      createTeam({ teamId: "A-2", shortCode: "A2", name: "Axis Two" }),
      createTeam({ teamId: "A-3", shortCode: "A3", name: "Axis Three" }),
    ];
    const standings = Object.fromEntries(
      teams.map((team, index) => [
        team.teamId,
        {
          points: 100 - index,
          rank: index + 1,
          disciplineValues:
            team.teamId === "T-G"
              ? { tdm: 5, staffel: 12, schach: 8, showcase: 10 }
              : team.teamId === "W-W"
                ? { tdm: 10, staffel: 10, schach: 34, showcase: 12 }
                : team.teamId === "T-T"
                  ? { tdm: 28, staffel: 28, schach: 28, showcase: 28 }
                  : { tdm: 18 - index, staffel: 17 - index, schach: 16 - index, showcase: 15 - index },
        },
      ]),
    );
    const gameState = createGameState({
      teams,
      identities: [
        createIdentity("T-G", { pow: 10, spe: 3, men: 2, soc: 2, ambition: 7 }),
        createIdentity("W-W", { pow: 2, spe: 3, men: 10, soc: 4, ambition: 7 }),
        createIdentity("T-T", { pow: 6, spe: 6, men: 6, soc: 6, ambition: 6 }),
        ...teams.slice(3).map((team) => createIdentity(team.teamId, { pow: 4, spe: 4, men: 4, soc: 4, ambition: 5 })),
      ],
      players: teams.map((team) => createPlayer(`${team.teamId}-p1`)),
      rosters: teams.map((team) => createRoster(`${team.teamId}-p1`, { teamId: team.teamId })),
      disciplines: [
        { id: "tdm", name: "TDM", category: "power", weight: 1 },
        { id: "staffel", name: "Staffel", category: "speed", weight: 1 },
        { id: "schach", name: "Schach", category: "mental", weight: 1 },
        { id: "showcase", name: "Showcase", category: "social", weight: 1 },
      ],
      standings,
    });

    const overview = buildTeamObjectiveOverview(gameState);
    const giantsGoal = overview.objectives.find((objective) => objective.teamId === "T-G" && objective.objectiveId === "sport-axis-rank-pow-top-5");
    const wizardsGoal = overview.objectives.find((objective) => objective.teamId === "W-W" && objective.objectiveId === "sport-axis-rank-men-top-5");
    const teachersGoal = overview.objectives.find((objective) => objective.teamId === "T-T" && objective.objectiveId === "sport-axis-allround-tophalf");
    const giantsBias = getTeamObjectiveAiBias(gameState, "T-G");
    const teachersBias = getTeamObjectiveAiBias(gameState, "T-T");

    expect(giantsGoal?.label).toBe("Power Top 5");
    expect(wizardsGoal?.label).toBe("Mental Top 5");
    expect(teachersGoal?.targetValue).toContain("4/4 Achsen");
    expect(giantsBias?.axisPriorities.pow).toBeGreaterThan(0);
    expect(teachersBias?.axisPriorities.pow).toBeGreaterThan(0);
    expect(teachersBias?.axisPriorities.soc).toBeGreaterThan(0);
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

  it("keeps playable mini objectives as candidates without expanding the compact board", () => {
    const players = Array.from({ length: 7 }, (_, index) => createPlayer(`p${index + 1}`));
    const gameState = createGameState({
      players,
      rosters: players.map((player) => createRoster(player.id)),
    });
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

    expect(overview.objectives.filter((objective) => objective.teamId === "M-M")).toHaveLength(4);
    expect(formColor?.status).toBe("completed");
    if (matchdayTop10) {
      expect(matchdayTop10.label).toContain("Climbing/Football");
    }
  });

  it("adds top-player and value-transfer goals for teams whose identity asks for them", () => {
    const gameState = createGameState({
      teams: [createTeam({ teamId: "C-C", shortCode: "C-C", budget: 100, cash: 74 })],
      identities: [createIdentity("C-C", { finances: 10, ambition: 4 })],
      players: [createPlayer("c1")],
      rosters: [createRoster("c1", { teamId: "C-C" })],
    });
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
    gameState.seasonState.playerDisciplinePerformances = [
      {
        id: "perf-1",
        matchdayResultId: "result-1",
        teamId: "C-C",
        playerId: "c1",
        activePlayerId: null,
        disciplineId: "d1",
        disciplineSide: "d1",
        slotIndex: 0,
        baseValue: 50,
        finalPlayerScore: 60,
        scoreContribution: 12,
        rankInTeam: 1,
        rankInDiscipline: 4,
        isTop10: true,
        isMvpCandidate: true,
        storyWeight: null,
        createdAt: "2026-06-13T10:00:00.000Z",
      },
    ];

    const overview = buildTeamObjectiveOverview(gameState);
    const categories = new Set(overview.objectives.map((objective) => objective.category));
    const topPlayer = overview.objectives.find((objective) => objective.objectiveId === "player-top20-breakthrough");
    const transferGoal = overview.objectives.find((objective) => objective.objectiveId === "transfer-profit");

    expect(categories.has("player")).toBe(true);
    expect(topPlayer?.status).toBe("completed");
    expect(transferGoal?.targetValue).toBe(10);
  });

  it("counts matchday medals from summed team scores across discipline results", () => {
    const teams = [
      createTeam({ teamId: "Z-H", shortCode: "Z-H", name: "Zero Heroes" }),
      createTeam({ teamId: "G-G", shortCode: "G-G", name: "Giants" }),
      createTeam({ teamId: "A-A", shortCode: "A-A", name: "Agents" }),
    ];
    const gameState = createGameState({
      teams,
      identities: [
        createIdentity("Z-H", { ambition: 10 }),
        createIdentity("G-G", { ambition: 8 }),
        createIdentity("A-A", { ambition: 5 }),
      ],
      players: teams.map((team) => createPlayer(`${team.teamId}-p1`)),
      rosters: teams.map((team) => createRoster(`${team.teamId}-p1`, { teamId: team.teamId })),
    });
    gameState.season.matchdayIds = ["md-1", "md-2", "md-3"];
    gameState.seasonState.matchdayResults = [createMatchdayResult("result-1", "md-1"), createMatchdayResult("result-2", "md-2")];
    gameState.seasonState.disciplineResults = [
      createDisciplineResult("dr-1", "result-1", "Z-H", 200),
      createDisciplineResult("dr-2", "result-1", "G-G", 180),
      createDisciplineResult("dr-3", "result-1", "A-A", 160),
      createDisciplineResult("dr-4", "result-2", "G-G", 220),
      createDisciplineResult("dr-5", "result-2", "Z-H", 210),
      createDisciplineResult("dr-6", "result-2", "A-A", 150),
    ];

    const overview = buildTeamObjectiveOverview(gameState);
    const medalGoal = overview.objectives.find((objective) => objective.teamId === "Z-H" && objective.objectiveId === "sport-matchday-medals");

    expect(medalGoal?.targetValue).toBe(2);
    expect(medalGoal?.status).toBe("completed");
    expect(medalGoal?.currentValue).toContain("2");
  });

  it("creates small-team Top-20 breakthrough goals from player discipline ranks", () => {
    const team = createTeam({ teamId: "R-R", shortCode: "R-R", name: "Riptide Rivers" });
    const gameState = createGameState({
      teams: [team],
      identities: [createIdentity("R-R", { ambition: 3 })],
      players: [createPlayer("r1")],
      rosters: [createRoster("r1", { teamId: "R-R" })],
    });
    gameState.season.matchdayIds = ["md-1", "md-2"];
    gameState.seasonState.matchdayResults = [createMatchdayResult("result-1", "md-1")];
    gameState.seasonState.playerDisciplinePerformances = [
      createPlayerPerformance("perf-1", { matchdayResultId: "result-1", teamId: "R-R", playerId: "r1", rankInDiscipline: 18 }),
    ];

    const overview = buildTeamObjectiveOverview(gameState);
    const top20Goal = overview.objectives.find((objective) => objective.teamId === "R-R" && objective.objectiveId === "player-top20-breakthrough");

    expect(top20Goal?.status).toBe("completed");
    expect(top20Goal?.currentValue).toContain("erfuellt");
  });

  it("pushes AI buying urgency when a repeat Top-20 player goal is still open", () => {
    const team = createTeam({ teamId: "M-M", shortCode: "M-M", name: "Mayhem Mavericks", cash: 100 });
    const gameState = createGameState({
      teams: [team],
      identities: [createIdentity("M-M", { ambition: 9, boardConfidence: 6 })],
      players: [createPlayer("m1")],
      rosters: [createRoster("m1", { teamId: "M-M" })],
    });
    gameState.season.matchdayIds = ["md-1", "md-2", "md-3", "md-4"];
    gameState.seasonState.matchdayResults = [createMatchdayResult("result-1", "md-1")];
    gameState.seasonState.playerDisciplinePerformances = [
      createPlayerPerformance("perf-1", { matchdayResultId: "result-1", teamId: "M-M", playerId: "m1", rankInDiscipline: 18 }),
    ];

    const overview = buildTeamObjectiveOverview(gameState);
    const repeatGoal = overview.objectives.find((objective) => objective.teamId === "M-M" && objective.objectiveId === "player-top20-repeat");
    const bias = getTeamObjectiveAiBias(gameState, "M-M");

    expect(repeatGoal?.status).toBe("open");
    expect(bias?.rosterUrgency).toBeGreaterThanOrEqual(0.8);
    expect(bias?.warnings).toContain("objective_bias_player_peak_needed");
  });

  it("refreshes board confidence into season state without compounding saved confidence", () => {
    const gameState = createGameState({
      teams: [createTeam({ cash: -8 })],
      identities: [createIdentity("M-M", { boardConfidence: 4 })],
      boardConfidence: {
        "M-M": { teamId: "M-M", value: 10, pressure: 1, warnings: ["old_saved_value"] },
      },
    });

    const refreshed = refreshTeamObjectiveState(gameState);
    const refreshedAgain = refreshTeamObjectiveState(refreshed);

    expect(refreshed.seasonState.teamSeasonObjectives?.length).toBeGreaterThan(0);
    expect(refreshed.seasonState.boardConfidence?.["M-M"]?.value).toBe(refreshedAgain.seasonState.boardConfidence?.["M-M"]?.value);
    expect(refreshed.seasonState.boardConfidence?.["M-M"]?.pressure).toBeGreaterThanOrEqual(7);
  });

  it("builds a visible season-end plus/minus settlement for board goals", () => {
    const teams = [
      createTeam({ teamId: "M-M", shortCode: "M-M", cash: 90 }),
      createTeam({ teamId: "A-A", shortCode: "A-A", cash: -8 }),
    ];
    const gameState = createGameState({
      teams,
      identities: teams.map((team) => createIdentity(team.teamId, { ambition: 8, boardConfidence: 6 })),
      players: [createPlayer("m1"), createPlayer("a1")],
      rosters: [createRoster("m1", { teamId: "M-M" }), createRoster("a1", { teamId: "A-A" })],
      standings: {
        "M-M": { points: 140, rank: 1 },
        "A-A": { points: 10, rank: 32 },
      },
    });

    const settlement = buildTeamSeasonObjectiveSettlement(gameState);
    const plusRow = settlement.rows.find((row) => row.teamId === "M-M" && row.visibleResult === "plus");
    const minusRow = settlement.rows.find((row) => row.teamId === "A-A" && row.visibleResult === "minus");

    expect(settlement.seasonId).toBe("season-3");
    expect(settlement.totals.completed).toBeGreaterThan(0);
    expect(settlement.totals.failed).toBeGreaterThan(0);
    expect(Math.abs((plusRow?.cashDelta ?? 0) + (plusRow?.boardConfidenceDelta ?? 0))).toBeGreaterThan(0);
    expect(Math.abs((minusRow?.cashDelta ?? 0) + (minusRow?.boardConfidenceDelta ?? 0))).toBeGreaterThan(0);
    expect(settlement.byTeamId["M-M"]?.completed).toBeGreaterThan(0);
    expect(settlement.byTeamId["A-A"]?.failed).toBeGreaterThan(0);
  });
});
