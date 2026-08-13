import path from "node:path";

import { describe, expect, it } from "vitest";

import type { GameState, Player, RosterEntry, Team, TeamIdentity, TeamSeasonObjectiveRecord } from "@/lib/data/olyDataTypes";
import { buildTeamSeasonOverviewRows, type TeamManagementSnapshotRow } from "@/lib/foundation/team-management-overview";
import {
  buildTeamObjectiveOverview,
  buildTeamSeasonObjectiveSettlement,
  computeTeamExpectation,
  getAxisRankObjective,
  getExpectationRankObjective,
  getMatchdayMedalObjective,
  getSignatureAxisWinObjective,
  getSportTarget,
  getSportTargetV2,
  getTeamObjectiveAiBias,
  getTransferSpendCeilingObjective,
  getUpsetAvoidanceObjective,
  refreshTeamObjectiveState,
  resolveBoardDisposition,
} from "@/lib/board/team-season-objectives-service";
import { compactFoundationInitialGameState } from "@/lib/persistence/foundation-initial-compact-state";

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

function createRow(teamId: string, partial?: Partial<TeamManagementSnapshotRow>): TeamManagementSnapshotRow {
  return {
    team: createTeam({ teamId, shortCode: teamId, identityId: teamId }),
    teamId,
    teamCode: teamId,
    teamName: teamId,
    generalManagerName: null,
    generalManagerTitle: null,
    generalManagerInfluencePct: null,
    rank: partial?.rank ?? null,
    points: partial?.points ?? null,
    rosterCount: partial?.rosterCount ?? 10,
    salaryTotal: partial?.salaryTotal ?? 40,
    avgContractLength: null,
    marketValueTotal: partial?.marketValueTotal ?? 100,
    cash: partial?.cash ?? 50,
    cashFc: null,
    budget: null,
    formAvg: null,
    financeForm: null,
    needScore: null,
    avgMarketValue: null,
    avgPps: null,
    avgOvr: null,
    ppsTotal: partial?.ppsTotal ?? 60,
    ppsPow: partial?.ppsPow ?? 15,
    ppsSpe: partial?.ppsSpe ?? 15,
    ppsMen: partial?.ppsMen ?? 15,
    ppsSoc: partial?.ppsSoc ?? 15,
    playerMin: null,
    playerOpt: null,
    rosterTarget: null,
    transferCount: 0,
    transferBuyTotal: 0,
    transferSellTotal: 0,
    transferNet: partial?.transferNet ?? 0,
    transfersSeasonValue: null,
    cashDelta: null,
    startplatz: null,
    rankDiff: null,
    sponsorBasis: null,
    sponsorRank: null,
    sponsorTotal: null,
    sponsorSeason: null,
    guv: null,
    cashTotal: null,
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
    ...partial,
  } as TeamManagementSnapshotRow;
}

// Direct getSportTarget coverage helper: builds realistic snapshot rows from a full gameState
// (exactly what selection used to feed getSportTarget) and calls getSportTarget for one team.
function sportTargetForTeam(gameState: GameState, teamId: string) {
  const rows = buildTeamSeasonOverviewRows({ gameState });
  const rowsByTeamId = new Map(rows.map((row) => [row.teamId, row] as const));
  const row = rowsByTeamId.get(teamId)!;
  const team = gameState.teams.find((entry) => entry.teamId === teamId)!;
  const identity = gameState.teamIdentities.find((entry) => entry.teamId === teamId) ?? null;
  return getSportTarget({ team, identity, profile: null, row, rowsByTeamId });
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
    const coreObjectives = teamObjectives.filter((objective) => objective.category !== "sponsor");
    const categories = new Set(coreObjectives.map((objective) => objective.category));

    expect(coreObjectives).toHaveLength(4);
    expect(categories.has("sport")).toBe(true);
    expect(categories.has("finance")).toBe(true);
    expect(categories.has("roster")).toBe(true);
    expect(overview.warnings).not.toContain("sponsor_objective_source_missing");
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
    expect(overview.objectives.filter((objective) => objective.category !== "sponsor")).toHaveLength(4);
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
          // DER VERKAUF GEHOERT IN DIE SAISON, UM DIE ES GEHT.
          //
          // Hier stand `season-2`, waehrend der Spielstand in `season-3` steht (siehe
          // `createGameState`). Der Test war trotzdem gruen, weil der Transfersaldo damals ueber
          // ALLE Saisons summierte — ein Verkauf aus der Vorsaison erfuellte also das Saisonziel
          // der laufenden. Das ist kein Randfall, sondern hat das Ziel unbrauchbar gemacht:
          // `teamSeasonObjectives` werden je Saison gestellt und je Saison mit rewardCash/
          // penaltyCash abgerechnet (`objective.seasonId === gameState.season.id`), und der
          // Alle-Zeiten-Saldo traegt den Liga-Draft mit, der jeden Grundstock-Spieler als Kauf
          // schreibt. Am Abnahme-Spielstand gemessen: Alle-Zeiten-Saldo −251 bis −341 je Team,
          // Saisonsaldo −43 bis −109. Ein Ziel „Transfergewinn von 15M erzielen" waere gegen den
          // Alle-Zeiten-Saldo fuer JEDES Team dauerhaft unerreichbar gewesen.
          id: "sell-c1",
          playerId: "x",
          seasonId: "season-3",
          seasonLabel: "Season 3",
          transferType: "sell",
          fromTeamId: "C-C",
          toTeamId: null,
          fee: 16,
          salary: 0,
          marketValue: 10,
          remainingContractLength: 1,
          happenedAt: "2026-06-12T00:00:00.000Z",
          source: "ai_preseason_market_sell",
        },
      ],
    });

    const overview = buildTeamObjectiveOverview(gameState);
    // Slot-1 sport goal is now expectation-rank for every team; the fixed sport-rank-X target is
    // no longer selected (it lives on only as an internal fallback + direct unit coverage below).
    const mmSport = overview.objectives.find((objective) => objective.teamId === "M-M" && objective.category === "sport");
    const mmFixedRank = overview.objectives.find((objective) => objective.teamId === "M-M" && objective.objectiveId.startsWith("sport-rank-"));
    const ccTransfer = overview.objectives.find((objective) => objective.teamId === "C-C" && objective.objectiveId === "transfer-profit");

    expect(mmSport?.objectiveId).toBe("expectation-rank");
    expect(mmFixedRank).toBeUndefined();
    // getSportTarget's M-M "Top 3" identity logic (still used as fallback) stays covered directly:
    const mmTarget = sportTargetForTeam(gameState, "M-M");
    expect(mmTarget.label).toContain("Top 3");
    expect(mmTarget.rank).toBe(3);
    // Season 3 → C-C transfer target is 15 (seasonal scaling)
    expect(ccTransfer?.targetValue).toBe(15);
    expect(ccTransfer?.status).toBe("completed");
    // Und die Zahl selbst ist die der Saison, nicht die Historie.
    expect(ccTransfer?.currentValue).toBe(16);
  });

  /**
   * DIE GEGENPROBE ZUR SAISONBINDUNG: derselbe Verkauf, nur in der VORSAISON gebucht.
   *
   * Er darf das Ziel der laufenden Saison nicht erfuellen — sonst startet ein Team, das einmal gut
   * verkauft hat, jede weitere Saison mit einem bereits erledigten Transferziel.
   */
  it("laesst einen Verkauf aus der Vorsaison das Transferziel der laufenden Saison NICHT erfuellen", () => {
    const teams = [createTeam({ teamId: "C-C", shortCode: "C-C", name: "Cash Creators" })];
    const gameState = createGameState({
      teams,
      identities: [createIdentity("C-C", { finances: 10, ambition: 5 })],
      players: [createPlayer("c1")],
      rosters: [createRoster("c1", { teamId: "C-C" })],
      standings: { "C-C": { points: 80, rank: 14 } },
      transferHistory: [
        {
          id: "sell-c1-vorsaison",
          playerId: "x",
          seasonId: "season-2",
          seasonLabel: "Season 2",
          transferType: "sell",
          fromTeamId: "C-C",
          toTeamId: null,
          fee: 16,
          salary: 0,
          marketValue: 10,
          remainingContractLength: 1,
          happenedAt: "2026-06-12T00:00:00.000Z",
          source: "ai_preseason_market_sell",
        },
      ],
    });

    const ccTransfer = buildTeamObjectiveOverview(gameState).objectives.find(
      (objective) => objective.teamId === "C-C" && objective.objectiveId === "transfer-profit",
    );
    expect(ccTransfer?.targetValue).toBe(15);
    expect(ccTransfer?.currentValue).toBe(0);
    expect(ccTransfer?.status).toBe("failed");
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
    // Slot-1 sport goal is now expectation-rank; the fixed sport-rank-X target is no longer selected.
    const sportGoal = overview.objectives.find((objective) => objective.teamId === "V-W" && objective.category === "sport");
    expect(sportGoal?.objectiveId).toBe("expectation-rank");
    expect(overview.objectives.some((objective) => objective.teamId === "V-W" && objective.objectiveId.startsWith("sport-rank-"))).toBe(false);

    // getSportTarget's fixed-target logic (still used as fallback) stays covered directly:
    const target = sportTargetForTeam(gameState, "V-W");
    expect(target.rank).toBe(27);
    expect(target.label).toBe("Survival: nicht Bottom 5");
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
    expect(sportGoal?.objectiveId).toBe("expectation-rank");

    // getSportTarget's fallback logic still avoids fantasy top-10 jumps for a weak, unranked team:
    const target = sportTargetForTeam(gameState, "V-W");
    expect(target.rank).toBe(24);
    expect(target.label).toBe("Kader stabilisieren");
  });

  it("keeps weak lower-mid teams on rebuild style sport goals instead of fantasy jumps", () => {
    const focusTeam = createTeam({ teamId: "V-W", shortCode: "V-W", name: "Vigilante Wranglers", rosterOptTarget: 12 });
    const supportTeams = Array.from({ length: 31 }, (_, index) =>
      createTeam({
        teamId: `S-${index + 1}`,
        shortCode: `S${index + 1}`,
        name: `Support ${index + 1}`,
        rosterOptTarget: 12,
      }),
    );
    const allTeams = [focusTeam, ...supportTeams];
    const players = Array.from({ length: 10 }, (_, index) =>
      createPlayer(`vw-mid-${index + 1}`, {
        rating: 42,
        marketValue: 11,
        displayMarketValue: 11,
        coreStats: { pow: 23, spe: 24, men: 26, soc: 21 },
      }),
    );
    const supportPlayers = supportTeams.flatMap((team, teamIndex) =>
      Array.from({ length: 10 }, (_, index) =>
        createPlayer(`${team.teamId}-${index + 1}`, {
          rating: 62 - (teamIndex % 6),
          marketValue: 22 - (teamIndex % 5),
          displayMarketValue: 22 - (teamIndex % 5),
          coreStats: { pow: 40, spe: 41, men: 42, soc: 39 },
        }),
      ),
    );
    const gameState = createGameState({
      teams: allTeams,
      identities: [
        createIdentity("V-W", { ambition: 7, playerMin: 8, playerOpt: 12 }),
        ...supportTeams.map((team, index) => createIdentity(team.teamId, { ambition: index < 12 ? 7 : 5, playerMin: 8, playerOpt: 12 })),
      ],
      players: [...players, ...supportPlayers],
      rosters: [
        ...players.map((player) => createRoster(player.id, { teamId: "V-W", salary: 2.5, currentValue: 11 })),
        ...supportTeams.flatMap((team, teamIndex) =>
          Array.from({ length: 10 }, (_, index) =>
            createRoster(`${team.teamId}-${index + 1}`, {
              teamId: team.teamId,
              salary: 4.5 + (teamIndex % 3),
              currentValue: 19 + (teamIndex % 4),
            }),
          ),
        ),
      ],
      standings: Object.fromEntries(
        allTeams.map((team, index) => [
          team.teamId,
          {
            points:
              team.teamId === "V-W"
                ? 80
                : index <= 20
                  ? 140 - index
                  : 78 - (index - 21),
            rank: team.teamId === "V-W" ? 21 : index < 20 ? index + 1 : index + 2,
          },
        ]),
      ),
    });

    const overview = buildTeamObjectiveOverview(gameState);
    const sportGoal = overview.objectives.find((objective) => objective.teamId === "V-W" && objective.category === "sport");
    expect(sportGoal?.objectiveId).toBe("expectation-rank");

    // getSportTarget's fallback logic still keeps weak lower-mid teams on rebuild-style goals:
    const target = sportTargetForTeam(gameState, "V-W");
    expect(target.rank).toBeGreaterThanOrEqual(24);
    expect(["Rebuild ohne Absturz", "Survival: nicht Bottom 5", "Bottom 8 vermeiden"]).toContain(target.label);
  });

  it("V2: the scored sport goal carries the strength-calibrated V2 target (disposition ambition reaches it)", () => {
    const prevFlag = process.env.OLY_BOARD_OBJECTIVES_V2;
    process.env.OLY_BOARD_OBJECTIVES_V2 = "1";
    try {
      const TEAM_COUNT = 13;
      const focusId = "F-6"; // mittelstarkes Team -> Erwartungsrang in der Tabellenmitte

      const buildScenario = (previousBoardValue: number): GameState => {
        const teams = Array.from({ length: TEAM_COUNT }, (_, i) =>
          createTeam({ teamId: `F-${i}`, shortCode: `F${i}`, name: `Focus ${i}` }),
        );
        // Streng monoton fallende Stärke: Marktwert UND coreStats sinken mit dem Index, damit
        // ppsTotal- und Marktwert-Rang dieselbe Reihenfolge ergeben (Composite-Erwartung ~ Index+1).
        const players = teams.map((team, i) =>
          createPlayer(`${team.teamId}-p`, {
            rating: 90 - i * 4,
            marketValue: 300 - i * 18,
            displayMarketValue: 300 - i * 18,
            coreStats: { pow: 70 - i * 4, spe: 70 - i * 4, men: 70 - i * 4, soc: 70 - i * 4 },
          }),
        );
        const rosters = teams.map((team) => createRoster(`${team.teamId}-p`, { teamId: team.teamId, currentValue: 0 }));
        const gameState = createGameState({
          teams,
          // Gleiche Identity-Ambition für alle -> der Unterschied kommt allein aus der Disposition (F1).
          identities: teams.map((team) => createIdentity(team.teamId, { ambition: 5 })),
          players,
          rosters,
          standings: Object.fromEntries(teams.map((team, i) => [team.teamId, { points: 100 - i, rank: i + 1 }])),
        });
        // Nur die Vorsaison-Board-Bewertung des Fokus-Teams unterscheidet die beiden Szenarien.
        gameState.seasonState.previousSeasonBoardConfidence = {
          [focusId]: { teamId: focusId, value: previousBoardValue, pressure: 11 - previousBoardValue, warnings: [] },
        };
        return gameState;
      };

      // Zwei identisch starke Ligen; nur die Disposition-Ambition des Fokus-Teams unterscheidet sich:
      // überperformt (value 9 -> hohe Ambition) vs. enttäuscht (value 2 -> niedrige Ambition).
      const overState = buildScenario(9);
      const underState = buildScenario(2);

      const overSport = buildTeamObjectiveOverview(overState).objectives.find(
        (objective) => objective.teamId === focusId && objective.category === "sport",
      );
      const underSport = buildTeamObjectiveOverview(underState).objectives.find(
        (objective) => objective.teamId === focusId && objective.category === "sport",
      );

      // Das Slot-1-Sportziel bleibt expectation-rank — nur sein Zielwert wird V2-kalibriert.
      expect(overSport?.objectiveId).toBe("expectation-rank");
      expect(underSport?.objectiveId).toBe("expectation-rank");

      // Beweis 1: gleiche Kaderstärke/Erwartung, aber unterschiedliche Disposition-Ambition ->
      // UNTERSCHIEDLICHE gewertete Sportziele. Vor dem Fix identisch (nur statische identity.ambition zählte).
      expect(overSport?.targetValue).not.toBe(underSport?.targetValue);

      // Beweis 2: das gewertete Ziel entspricht exakt getSportTargetV2 (BOARD_V2_CALIBRATION +
      // Disposition-Ambition), nicht dem statischen expectation-rank-Ziel.
      const rowsFor = (state: GameState) =>
        new Map(buildTeamSeasonOverviewRows({ gameState: state }).map((row) => [row.teamId, row] as const));
      const dispFor = (state: GameState) =>
        resolveBoardDisposition({
          identity: state.teamIdentities.find((identity) => identity.teamId === focusId) ?? null,
          previousSeasonBoard: state.seasonState.previousSeasonBoardConfidence?.[focusId] ?? null,
        });

      const overRows = rowsFor(overState);
      const underRows = rowsFor(underState);
      const v2Over = getSportTargetV2({ identity: null, teamId: focusId, rowsByTeamId: overRows, ambition01: dispFor(overState).ambition });
      const v2Under = getSportTargetV2({ identity: null, teamId: focusId, rowsByTeamId: underRows, ambition01: dispFor(underState).ambition });

      expect(overSport?.targetValue).toBe(`Top ${v2Over.rank}`);
      expect(underSport?.targetValue).toBe(`Top ${v2Under.rank}`);
      // Höhere Disposition-Ambition -> härteres (niedrigeres) Ziel.
      expect(v2Over.rank).toBeLessThan(v2Under.rank);

      // Beweis 3: das gewertete V2-Ziel weicht vom statischen expectation-rank-Ziel ab (dem alten,
      // fälschlich weiter genutzten Wert, der auf identity.ambition statt der Kalibrierung basierte).
      const staticSport = getExpectationRankObjective({
        team: overState.teams.find((team) => team.teamId === focusId)!,
        identity: overState.teamIdentities.find((identity) => identity.teamId === focusId) ?? null,
        profile: null,
        row: overRows.get(focusId)!,
        rowsByTeamId: overRows,
      });
      expect(overSport?.targetValue).not.toBe(staticSport.targetValue);
    } finally {
      if (prevFlag == null) delete process.env.OLY_BOARD_OBJECTIVES_V2;
      else process.env.OLY_BOARD_OBJECTIVES_V2 = prevFlag;
    }
  });

  it("updates objective status and board pressure when cash is negative", () => {
    const team = createTeam({ cash: -8 });
    const gameState = createGameState({ teams: [team], identities: [createIdentity(team.teamId, { boardConfidence: 4 })] });

    const overview = buildTeamObjectiveOverview(gameState);
    // V2 migration: the tautological "finance-cash-positive" goal is replaced. Negative cash now
    // surfaces as a failed "finance-salary-ratio" objective (salary/(cash+salary) blows past target),
    // which is the finance-distress goal actually selected into the compact V2 slate.
    const cashObjective = overview.objectives.find((objective) => objective.objectiveId === "finance-salary-ratio");
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

  it("keeps season 1 preseason board neutral regardless of identity and failed objectives", () => {
    const team = createTeam({ teamId: "A-A", shortCode: "A-A", cash: -8 });
    const gameState = createGameState({
      teams: [team],
      identities: [createIdentity(team.teamId, { boardConfidence: 1 })],
    });
    gameState.season = { ...gameState.season, id: "season-1", name: "Season 1" };
    gameState.seasonState.seasonId = "season-1";
    gameState.gamePhase = "season_end_management";

    const overview = buildTeamObjectiveOverview(gameState);
    const board = overview.boardConfidence[team.teamId];

    expect(board?.value).toBe(5);
    expect(board?.pressure).toBe(5);
    expect(board?.warnings).toEqual([]);
  });

  it("applies board objective pressure after season 1 leaves preseason", () => {
    const team = createTeam({ teamId: "A-A", shortCode: "A-A", cash: -8 });
    const gameState = createGameState({
      teams: [team],
      identities: [createIdentity(team.teamId, { boardConfidence: 1 })],
    });
    gameState.season = { ...gameState.season, id: "season-1", name: "Season 1" };
    gameState.seasonState.seasonId = "season-1";
    gameState.gamePhase = "season_active";

    const overview = buildTeamObjectiveOverview(gameState);
    const board = overview.boardConfidence[team.teamId];

    expect(board?.value).toBeLessThan(5);
    expect(board?.pressure).toBeGreaterThan(5);
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

    // Ein Achsen-Rangziel ist im Slate immer das ZWEITE Rang-Ziel (Slot 1 hält die Rang-Erwartung),
    // wird also als optionales Zusatzziel vergeben — daran hängt der Labelzusatz.
    expect(giantsGoal?.label).toBe("Power Top 5 (optional)");
    expect(giantsGoal?.optional).toBe(true);
    expect(wizardsGoal?.label).toBe("Mental Top 5 (optional)");
    expect(teachersGoal?.targetValue).toContain("4/4 Achsen");
    expect(giantsBias?.axisPriorities.pow).toBeGreaterThan(0);
    expect(teachersBias?.axisPriorities.pow).toBeGreaterThan(0);
    expect(teachersBias?.axisPriorities.soc).toBeGreaterThan(0);
  });

  it("refreshes stored objectives without replacing their label or source", () => {
    // V2 migration: "finance-cash-positive" is no longer generated, so a stored objective keyed to it
    // would be dropped by the merge (no matching generated goal). Key the saved board-authored objective
    // onto the V2 finance-distress goal that IS selected on negative cash — "finance-salary-ratio" — to
    // exercise the same merge path (custom label + source preserved, value/status refreshed from generated).
    const storedObjective: TeamSeasonObjectiveRecord = {
      seasonId: "season-3",
      teamId: "M-M",
      objectiveId: "finance-salary-ratio",
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
    const refreshed = overview.objectives.find((objective) => objective.objectiveId === "finance-salary-ratio");
    const board = overview.boardConfidence["M-M"];

    expect(refreshed?.label).toBe(storedObjective.label);
    expect(refreshed?.status).toBe("failed");
    // Aus dem Generator nachgezogen: das Gehaltsziel traegt seit der Liga-Kalibrierung den LIGARANG
    // als Zahl. Der gespeicherte Platzhalter (50) ist damit ersetzt — in einer Ein-Team-Liga ist das
    // Rang 1, und das Ziel steht trotzdem auf „verfehlt", weil das Konto im Minus ist.
    expect(refreshed?.currentValue).toBe(1);
    expect(String(refreshed?.detail)).toContain("im Minus");
    expect(refreshed?.source).toContain("saved_board_objective");
    expect(board?.warnings).toContain("board_confidence_source_saved_state");
  });

  it("keeps playable mini objectives as candidates without expanding the compact board", () => {
    const players = Array.from({ length: 9 }, (_, index) => createPlayer(`p${index + 1}`));
    const gameState = createGameState({
      players,
      rosters: players.map((player) => createRoster(player.id)),
    });
    gameState.seasonState.formCards = [
      { id: "fc-1", saveId: "save-1", seasonId: "season-3", teamId: "M-M", playerId: "p1", playerName: "p1", cardColor: "red", cardValue: 1, createdAt: "2026-06-13T10:00:00.000Z" },
      { id: "fc-2", saveId: "save-1", seasonId: "season-3", teamId: "M-M", playerId: "p2", playerName: "p2", cardColor: "green", cardValue: 1, createdAt: "2026-06-13T10:00:00.000Z" },
      { id: "fc-3", saveId: "save-1", seasonId: "season-3", teamId: "M-M", playerId: "p3", playerName: "p3", cardColor: "blue", cardValue: 1, createdAt: "2026-06-13T10:00:00.000Z" },
    ];
    // Das Kaderziel zaehlt seit der Liga-Kalibrierung den Nennwert der AUSGESPIELTEN Karten, nicht
    // die blosse Anzahl abgedeckter Farben (die hatten am Live-Save 32 von 32 Teams erfuellt).
    // „Ausgespielt" heisst: in einem Modifier-Slot der Aufstellung — dieselbe Zuordnung, aus der die
    // Spalte „Formkarten" im Saisonstand kommt. Ohne diese Entwuerfe laegen die Karten nur auf der
    // Hand, und das Ziel stuende zu Recht auf „offen".
    gameState.seasonState.lineupDrafts = [
      {
        lineupId: "lineup-1",
        saveId: "save-1",
        seasonId: "season-3",
        matchdayId: "md-1",
        teamId: "M-M",
        status: "resolved",
        entries: [],
        modifiers: {
          d1: { primaryFormCardId: "fc-1", secondaryFormCardId: "fc-2" },
          d2: { primaryFormCardId: "fc-3", secondaryFormCardId: null },
        },
        createdAt: "2026-06-13T10:00:00.000Z",
        updatedAt: "2026-06-13T10:00:00.000Z",
      },
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

    expect(overview.objectives.filter((objective) => objective.teamId === "M-M" && objective.category !== "sponsor")).toHaveLength(4);
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
    // Season 3 → C-C transfer target is 15 (seasonal scaling)
    expect(transferGoal?.targetValue).toBe(15);
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

  it("counts every played matchday for the 3x-Top-20 goal, also on the compact browser payload", () => {
    // Der Browser bekommt nicht den vollen Spielstand, sondern die Kurzfassung aus
    // `compactFoundationInitialGameState`. Solange die dort `matchdayResults` auf den
    // aktiven Spieltag beschnitt, kannte `getCurrentSeasonMatchdayResultIds` im Browser
    // nur noch ein einziges Ergebnis — und `getPlayerPeakSummary` warf jede Leistung der
    // uebrigen Spieltage weg. Am Live-Save gemessen: Server „4/3, bestes Rank #3"
    // (erfuellt), Browser „0/3, bestes Rank #33". Die Karte log den Spieler um sein
    // erreichtes Ziel. Der Test haelt beide Seiten aneinander, nicht nur eine Zahl.
    const team = createTeam({ teamId: "M-M", shortCode: "M-M", name: "Mayhem Mavericks", cash: 100 });
    const gameState = createGameState({
      teams: [team],
      identities: [createIdentity("M-M", { ambition: 9, boardConfidence: 6 })],
      players: [createPlayer("m1")],
      rosters: [createRoster("m1", { teamId: "M-M" })],
    });
    gameState.season.matchdayIds = ["md-1", "md-2", "md-3", "md-4", "md-5", "md-6", "md-7", "md-8"];
    // Aktiv ist md-1 (siehe `matchdayState`) — md-2 und md-3 sind genau die Spieltage,
    // die die Kurzfassung frueher wegschnitt. Am aktiven Spieltag steht bewusst ein
    // Rang ausserhalb der Top 20, damit der Beschnitt sichtbar bei 0 landet.
    gameState.seasonState.matchdayResults = [
      createMatchdayResult("result-1", "md-1"),
      createMatchdayResult("result-2", "md-2"),
      createMatchdayResult("result-3", "md-3"),
    ];
    gameState.seasonState.playerDisciplinePerformances = [
      createPlayerPerformance("perf-1", { matchdayResultId: "result-1", teamId: "M-M", playerId: "m1", rankInDiscipline: 25 }),
      createPlayerPerformance("perf-2", { matchdayResultId: "result-2", teamId: "M-M", playerId: "m1", rankInDiscipline: 5 }),
      createPlayerPerformance("perf-3", { matchdayResultId: "result-3", teamId: "M-M", playerId: "m1", rankInDiscipline: 7 }),
    ];

    const findeZiel = (state: GameState) =>
      buildTeamObjectiveOverview(state).objectives.find(
        (objective) => objective.teamId === "M-M" && objective.objectiveId === "player-top20-repeat",
      );

    const vollesZiel = findeZiel(gameState);
    const kompaktesZiel = findeZiel(compactFoundationInitialGameState(gameState));

    expect(vollesZiel?.currentValue).toBe("2/3, bestes Rank #5");
    expect(kompaktesZiel?.currentValue).toBe(vollesZiel?.currentValue);
    expect(kompaktesZiel?.status).toBe(vollesZiel?.status);
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

  it("keeps sponsor offer hydration out of client-safe objective refresh", () => {
    const gameState = createGameState();
    expect(gameState.seasonState.sponsorOffersByTeamId).toBeUndefined();

    const refreshed = refreshTeamObjectiveState(gameState);

    expect(refreshed.seasonState.sponsorOffersByTeamId).toBeUndefined();
    expect(refreshed.seasonState.teamSeasonObjectives?.length ?? 0).toBeGreaterThan(0);
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
    const refreshedThird = refreshTeamObjectiveState(refreshedAgain);

    const v1 = refreshed.seasonState.boardConfidence?.["M-M"]?.value ?? 0;
    const v2 = refreshedAgain.seasonState.boardConfidence?.["M-M"]?.value;
    const v3 = refreshedThird.seasonState.boardConfidence?.["M-M"]?.value;

    expect(refreshed.seasonState.teamSeasonObjectives?.length).toBeGreaterThan(0);
    // Anti-compounding guard: the saved value (10) must NOT carry — it recomputes far below it.
    expect(v1).toBeLessThan(5);
    // V2: the F4 dynamic slate size reads the stored perceivedPressure, which is only populated
    // *after* the first refresh. So the board value settles one extra step (3.0 -> 2.8 as the slate
    // grows by one goal) and is then idempotent — assert the converged, non-compounding value.
    expect(v2).toBe(v3);
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

describe("team season objectives build stability", () => {
  it("uses resolveSeasonNumberFromState without duplicate getSeasonNumber exports", async () => {
    const fs = await import("node:fs/promises");
    const servicePath = path.join(process.cwd(), "lib/board/team-season-objectives-service.ts");
    const serviceText = await fs.readFile(servicePath, "utf8");

    expect(serviceText).toContain("function resolveSeasonNumberFromState(gameState: GameState)");
    expect(serviceText).toContain("resolveSeasonNumberFromState(gameState)");
    // Der Sinn dieser Zeile ist „es gibt keine ZWEITE Saisonnummer-Herleitung neben
    // `resolveSeasonNumberFromState`". Mit der Liga-Kalibrierung der Finanzziele sind die letzten
    // Aufrufer von `getSeasonNumber` verschwunden (die Ziele fragen nicht mehr „welche Saison ist
    // das", sondern „wo steht das Team im Feld"), also ist der Helfer ganz weg — die stärkste Form
    // derselben Zusage. Erlaubt bleibt genau eine Definition, falls er je zurückkommt.
    expect(serviceText.match(/function getSeasonNumber\(/g)?.length ?? 0).toBeLessThanOrEqual(1);
  });
});

describe("human board pressure + C-C eco rules", () => {
  /**
   * GEMELDET VON CHRIS, am Live-Save nachgemessen (Saison 2, Spieltag 4): das Finanzziel stand bei
   * 21 Teams auf „verfehlt", bei 9 auf „gefährdet" und bei KEINEM auf „erfüllt". Die Ist-Werte
   * reichten von 78,7% bis 99,9% gegen eine feste Marke von 78% — eine Vorgabe, die kein Team der
   * Liga erreichen konnte.
   *
   * Der Grund war der Messzeitpunkt: die Quote ist `Gehalt / (Cash + Gehalt)`, und Cash fällt
   * während der ganzen Saison, weil Sponsor, Apron und Gebäude erst am Saisonende gebucht werden.
   *
   * Dieser Test baut genau diese Lage nach — eine Liga, in der ALLE Teams hohe Gehaltsquoten haben —
   * und hält fest, was seither gilt: gewertet wird gegen die Liga, also gibt es Gewinner UND
   * Verlierer statt nur Verlierer.
   */
  it("wertet die Gehaltsquote gegen die Liga, damit eine teure Liga nicht geschlossen scheitert", () => {
    const teamIds = ["T-A", "T-B", "T-C", "T-D", "T-E", "T-F", "T-G", "T-H"];
    // Alle acht Teams stehen bei ~87% bis ~99% Gehaltsquote — unter der alten festen Marke von 78%
    // wäre jedes einzelne davon „verfehlt".
    const teams = teamIds.map((teamId, index) => createTeam({ teamId, shortCode: teamId, cash: 30 - index * 3 }));
    const gameState = createGameState({
      teams,
      identities: teamIds.map((teamId) => createIdentity(teamId)),
      players: teamIds.map((teamId) => createPlayer(`p-${teamId}`)),
      rosters: teamIds.map((teamId) => createRoster(`p-${teamId}`, { teamId, salary: 200 })),
    });

    const salaryObjectives = buildTeamObjectiveOverview(gameState).objectives.filter(
      (entry) => entry.objectiveId === "finance-salary-ratio",
    );

    // Nicht jedes Team bekommt jedes Ziel — der Vorstand stellt je nach Anspruch 3 bis 5 Vorgaben
    // und zeigt je Kategorie die druckvollste. Geprüft wird deshalb das Feld derer, die das
    // Gehaltsziel tatsächlich tragen.
    expect(salaryObjectives.length).toBeGreaterThan(1);

    // 1) Die Marke ist ein LIGARANG, keine erfundene Prozentzahl — und ihr Nenner ist die ganze
    //    Liga (8 Teams), nicht das kleinere Feld der Zielträger.
    for (const ziel of salaryObjectives) {
      // Rang als ZAHL — der Analytics-Raum bildet daraus den Abstand zur Marke.
      expect(typeof ziel.targetValue).toBe("number");
      expect(typeof ziel.currentValue).toBe("number");
      expect(String(ziel.label)).toContain("Ligarang");
      // Die Ligagroesse steht im Klartext, nicht im Zahlenfeld.
      expect(String(ziel.detail)).toContain("von 8");
    }

    // 2) Die Rangfolge stimmt mit der Liquidität überein: mehr Cash bei gleichem Gehalt heisst
    //    niedrigere Quote heisst besserer Rang. Genau das trug die alte feste Marke nicht.
    const rangVon = (teamId: string) => {
      const wert = salaryObjectives.find((entry) => entry.teamId === teamId)?.currentValue;
      return typeof wert === "number" ? wert : null;
    };
    const raenge = teamIds.map(rangVon).filter((rang): rang is number => rang != null);
    expect(raenge.length).toBeGreaterThan(1);
    expect([...raenge]).toEqual([...raenge].sort((links, rechts) => links - rechts));

    // 3) Der Kern der Meldung: es kann NICHT die ganze Liga scheitern. Der Zielrang deckt einen
    //    echten Teil des Feldes ab, also gibt es Plätze, die ihn erfüllen.
    const zielRang = Number(salaryObjectives[0]?.targetValue);
    expect(zielRang).toBeGreaterThanOrEqual(2);
    expect(zielRang).toBeLessThan(8);
  });

  /**
   * Die Gegenprobe zur Liga-Wertung: solange die Einnahmen der Saison nicht gebucht sind, ist der
   * Cash-Stand eine Hochrechnung — und eine Hochrechnung kann nicht „verfehlt" sein. Der Malus
   * fliesst ohnehin erst am Saisonende, aber Board-Vertrauen und KI-Neigung lesen den Status live.
   */
  it("meldet cash-abhaengige Finanzziele als Hochrechnung, solange die Saison nicht abgerechnet ist", () => {
    const teamIds = ["H-A", "H-B", "H-C", "H-D", "H-E", "H-F", "H-G", "H-H"];
    // H-A steht mit Abstand am schlechtesten da (wenigstes Cash bei gleichem Gehalt) und wäre nach
    // der Abrechnung klar „verfehlt" — vorher darf es das nicht sein.
    const gameState = createGameState({
      teams: teamIds.map((teamId, index) => createTeam({ teamId, shortCode: teamId, cash: 2 + index * 60 })),
      identities: teamIds.map((teamId) => createIdentity(teamId)),
      players: teamIds.map((teamId) => createPlayer(`p-${teamId}`)),
      rosters: teamIds.map((teamId) => createRoster(`p-${teamId}`, { teamId, salary: 200 })),
    });

    const offeneZiele = buildTeamObjectiveOverview(gameState).objectives.filter(
      (entry) => entry.objectiveId === "finance-salary-ratio",
    );
    expect(offeneZiele.length).toBeGreaterThan(0);
    // KEIN Team kann vor der Abrechnung an dieser Größe scheitern.
    expect(offeneZiele.filter((entry) => entry.status === "failed")).toHaveLength(0);
    for (const ziel of offeneZiele) {
      expect(ziel.provisional).toBe(true);
      expect(ziel.penaltyCash).toBeUndefined();
      expect(String(ziel.detail)).toContain("Hochrechnung");
    }
    const schlechtestes = offeneZiele.find((entry) => entry.teamId === "H-A");

    // Nach der Einnahmenbuchung faellt der Vorbehalt weg und das Ziel wird verbindlich gewertet.
    const abgerechnet = {
      ...gameState,
      seasonState: {
        ...gameState.seasonState,
        cashPrizeApplyLogs: [
          {
            id: "cpa-1",
            saveId: "save-1",
            seasonId: gameState.season.id,
            matchdayId: "md-1",
            action: "apply" as const,
            payload: { idempotencyKey: "k", totalTeams: 8, appliedTeams: 8, totalPrizeMoney: 0 },
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      },
    };
    const gebuchteZiele = buildTeamObjectiveOverview(abgerechnet).objectives.filter(
      (entry) => entry.objectiveId === "finance-salary-ratio",
    );
    for (const ziel of gebuchteZiele) {
      expect(ziel.provisional).toBeFalsy();
      expect(String(ziel.detail)).not.toContain("Hochrechnung");
    }
    // Nach der Buchung wird verbindlich gewertet — das Schlusslicht faellt jetzt wirklich durch.
    if (schlechtestes) {
      const gebucht = gebuchteZiele.find((entry) => entry.teamId === "H-A");
      expect(gebucht?.status).toBe("failed");
      expect(gebucht?.penaltyCash ?? 0).toBeGreaterThan(0);
    }
  });

  /**
   * Ein Konto im Minus ist keine Hochrechnung, sondern ein Befund — es sticht den Ligavergleich
   * auch dann, wenn das Team im Feld noch gut dasteht.
   */
  it("wertet ein Konto im Minus sofort als verfehlt, unabhaengig vom Ligarang", () => {
    const gameState = createGameState({
      teams: [
        createTeam({ teamId: "M-A", shortCode: "M-A", cash: -8 }),
        createTeam({ teamId: "M-B", shortCode: "M-B", cash: -400 }),
        createTeam({ teamId: "M-C", shortCode: "M-C", cash: -500 }),
      ],
      identities: ["M-A", "M-B", "M-C"].map((teamId) => createIdentity(teamId)),
      players: ["M-A", "M-B", "M-C"].map((teamId) => createPlayer(`p-${teamId}`)),
      rosters: ["M-A", "M-B", "M-C"].map((teamId) => createRoster(`p-${teamId}`, { teamId, salary: 100 })),
    });

    const objective = buildTeamObjectiveOverview(gameState).objectives.find(
      (entry) => entry.teamId === "M-A" && entry.objectiveId === "finance-salary-ratio",
    );

    // M-A ist das BESTE der drei Teams — und trotzdem verfehlt, weil das Konto im Minus steht.
    expect(objective?.currentValue).toBe(1);
    expect(objective?.status).toBe("failed");
    expect(objective?.provisional).toBeFalsy();
  });

  it("adds board-confidence-budget-cut objective for human team with low confidence", () => {
    const team = createTeam({ teamId: "H-T", shortCode: "H-T", humanControlled: true });
    const gameState = createGameState({
      teams: [team],
      identities: [createIdentity("H-T", { boardConfidence: 5 })],
      players: [createPlayer("h1")],
      rosters: [createRoster("h1", { teamId: "H-T" })],
      boardConfidence: {
        "H-T": { teamId: "H-T", value: 3.5, pressure: 7.5, warnings: [] },
      },
    });

    const overview = buildTeamObjectiveOverview(gameState);
    const penalty = overview.objectives.find((o) => o.teamId === "H-T" && o.objectiveId === "board-confidence-budget-cut");

    expect(penalty).toBeDefined();
    expect(penalty?.status).toBe("failed");
    // confidence=3.5 → (5.0 - 3.5) * 3.3 = 4.95 → rounds to 5
    expect(penalty?.penaltyCash).toBe(5);
    expect(penalty?.category).toBe("finance");
  });

  it("does NOT add board-confidence-budget-cut for non-human team", () => {
    const team = createTeam({ teamId: "A-I", shortCode: "A-I", humanControlled: false });
    const gameState = createGameState({
      teams: [team],
      identities: [createIdentity("A-I", { boardConfidence: 5 })],
      players: [createPlayer("a1")],
      rosters: [createRoster("a1", { teamId: "A-I" })],
      boardConfidence: {
        "A-I": { teamId: "A-I", value: 2.5, pressure: 9.0, warnings: [] },
      },
    });

    const overview = buildTeamObjectiveOverview(gameState);
    const penalty = overview.objectives.find((o) => o.teamId === "A-I" && o.objectiveId === "board-confidence-budget-cut");

    expect(penalty).toBeUndefined();
  });

  it("does NOT add board-confidence-budget-cut when confidence is >= 5.0", () => {
    const team = createTeam({ teamId: "H-T", shortCode: "H-T", humanControlled: true });
    const gameState = createGameState({
      teams: [team],
      identities: [createIdentity("H-T", { boardConfidence: 7 })],
      players: [createPlayer("h1")],
      rosters: [createRoster("h1", { teamId: "H-T" })],
      boardConfidence: {
        "H-T": { teamId: "H-T", value: 5.5, pressure: 4.5, warnings: [] },
      },
    });

    const overview = buildTeamObjectiveOverview(gameState);
    const penalty = overview.objectives.find((o) => o.teamId === "H-T" && o.objectiveId === "board-confidence-budget-cut");

    expect(penalty).toBeUndefined();
  });

  it("caps board-confidence-budget-cut penaltyCash at 10 (confidence=2.0)", () => {
    const team = createTeam({ teamId: "H-T", shortCode: "H-T", humanControlled: true });
    const gameState = createGameState({
      teams: [team],
      identities: [createIdentity("H-T", { boardConfidence: 5 })],
      players: [createPlayer("h1")],
      rosters: [createRoster("h1", { teamId: "H-T" })],
      boardConfidence: {
        "H-T": { teamId: "H-T", value: 2.0, pressure: 9.0, warnings: [] },
      },
    });

    const overview = buildTeamObjectiveOverview(gameState);
    const penalty = overview.objectives.find((o) => o.teamId === "H-T" && o.objectiveId === "board-confidence-budget-cut");

    expect(penalty?.penaltyCash).toBe(10);
  });

  it("C-C gets transfer target 15 in season 3", () => {
    const team = createTeam({ teamId: "C-C", shortCode: "C-C", name: "Cash Creators" });
    const gameState = createGameState({
      teams: [team],
      identities: [createIdentity("C-C", { finances: 10, ambition: 2 })],
      players: [createPlayer("c1")],
      rosters: [createRoster("c1", { teamId: "C-C" })],
    });
    // default gameState uses season-3
    const objective = buildTeamObjectiveOverview(gameState).objectives.find(
      (o) => o.teamId === "C-C" && o.objectiveId === "transfer-profit",
    );

    expect(objective?.targetValue).toBe(15);
    expect(objective?.penaltyCash).toBe(3);
  });

  it("C-C gets transfer target 20 in season 4+", () => {
    const team = createTeam({ teamId: "C-C", shortCode: "C-C", name: "Cash Creators" });
    const gameState = createGameState({
      teams: [team],
      identities: [createIdentity("C-C", { finances: 10, ambition: 2 })],
      players: [createPlayer("c1")],
      rosters: [createRoster("c1", { teamId: "C-C" })],
    });
    gameState.season = { ...gameState.season, id: "season-5", name: "Season 5" };
    gameState.seasonState = { ...gameState.seasonState, seasonId: "season-5" };

    const objective = buildTeamObjectiveOverview(gameState).objectives.find(
      (o) => o.teamId === "C-C" && o.objectiveId === "transfer-profit",
    );

    expect(objective?.targetValue).toBe(20);
    expect(objective?.penaltyCash).toBe(3);
  });
});

describe("board goal targets: expectation, upset-avoidance, transfer ceiling, signature axis wins", () => {
  it("computeTeamExpectation ranks a team by ppsTotal (tiebreak marketValueTotal) among all rows", () => {
    const rowsByTeamId = new Map([
      ["strong", createRow("strong", { ppsTotal: 90, marketValueTotal: 200 })],
      ["mid", createRow("mid", { ppsTotal: 60, marketValueTotal: 100 })],
      ["weak", createRow("weak", { ppsTotal: 30, marketValueTotal: 50 })],
    ]);

    const strong = computeTeamExpectation({ row: rowsByTeamId.get("strong")!, rowsByTeamId, identity: null });
    const mid = computeTeamExpectation({ row: rowsByTeamId.get("mid")!, rowsByTeamId, identity: null });
    const weak = computeTeamExpectation({ row: rowsByTeamId.get("weak")!, rowsByTeamId, identity: null });

    expect(strong.expectedRank).toBe(1);
    expect(mid.expectedRank).toBe(2);
    expect(weak.expectedRank).toBe(3);
    expect(strong.strengthPct).toBe(1);
    expect(weak.strengthPct).toBe(0);
    expect(strong.teamCount).toBe(3);
  });

  it("computeTeamExpectation breaks ppsTotal ties using marketValueTotal", () => {
    const rowsByTeamId = new Map([
      ["a", createRow("a", { ppsTotal: 50, marketValueTotal: 120 })],
      ["b", createRow("b", { ppsTotal: 50, marketValueTotal: 90 })],
    ]);

    const a = computeTeamExpectation({ row: rowsByTeamId.get("a")!, rowsByTeamId, identity: null });
    const b = computeTeamExpectation({ row: rowsByTeamId.get("b")!, rowsByTeamId, identity: null });

    expect(a.expectedRank).toBe(1);
    expect(b.expectedRank).toBe(2);
  });

  it("computeTeamExpectation normalizes ambition into ambitionMod within -1..1", () => {
    const rowsByTeamId = new Map([["only", createRow("only")]]);
    const row = rowsByTeamId.get("only")!;

    const highAmbition = computeTeamExpectation({ row, rowsByTeamId, identity: createIdentity("only", { ambition: 10 }) });
    const lowAmbition = computeTeamExpectation({ row, rowsByTeamId, identity: createIdentity("only", { ambition: 1 }) });
    const neutral = computeTeamExpectation({ row, rowsByTeamId, identity: null });

    expect(highAmbition.ambitionMod).toBeCloseTo(1, 5);
    expect(lowAmbition.ambitionMod).toBeCloseTo(-0.8, 5);
    expect(neutral.ambitionMod).toBe(0);
  });

  it("getExpectationRankObjective sets a tighter target and bigger reward for ambitious teams beating expectation", () => {
    const rowsByTeamId = new Map([
      ["hero", createRow("hero", { ppsTotal: 40, marketValueTotal: 60, rank: 3 })],
      ["r2", createRow("r2", { ppsTotal: 70, marketValueTotal: 140 })],
      ["r3", createRow("r3", { ppsTotal: 65, marketValueTotal: 130 })],
      ["r4", createRow("r4", { ppsTotal: 55, marketValueTotal: 110 })],
      ["r5", createRow("r5", { ppsTotal: 50, marketValueTotal: 100 })],
    ]);
    const heroRow = rowsByTeamId.get("hero")!;
    const heroTeam = createTeam({ teamId: "hero", shortCode: "hero" });

    // Expectation model: hero has the weakest squad (ppsTotal 40) so expectedRank = 5 (last).
    // Actual current rank is 3, well ahead of expectation.
    const ambitious = getExpectationRankObjective({
      team: heroTeam,
      identity: createIdentity("hero", { ambition: 10 }),
      profile: null,
      row: heroRow,
      rowsByTeamId,
    });
    const modest = getExpectationRankObjective({
      team: heroTeam,
      identity: createIdentity("hero", { ambition: 1 }),
      profile: null,
      row: heroRow,
      rowsByTeamId,
    });

    // Higher ambition -> larger overachieveGap -> tighter (smaller) target rank number.
    expect(Number(ambitious.targetValue?.toString().replace("Top ", ""))).toBeLessThanOrEqual(
      Number(modest.targetValue?.toString().replace("Top ", "")),
    );
    // Beating expectation (rank 3 vs expected 5) should be a positive, graduated confidence swing,
    // even though the tighter ambitious target (Top 1) isn't fully met yet (at_risk, not failed).
    expect(ambitious.boardConfidenceDelta ?? 0).toBeGreaterThan(0);
    expect(ambitious.rewardCash ?? 0).toBeGreaterThan(0);
    expect(ambitious.status).toBe("at_risk");
    // The modest team's looser target (Top 4) is already met by the same actual rank.
    expect(modest.status).toBe("completed");
  });

  it("getExpectationRankObjective applies a negative confidence swing when missing expectation badly", () => {
    const rowsByTeamId = new Map([
      ["hero", createRow("hero", { ppsTotal: 90, marketValueTotal: 200, rank: 20 })],
      ["r2", createRow("r2", { ppsTotal: 40, marketValueTotal: 80 })],
      ["r3", createRow("r3", { ppsTotal: 35, marketValueTotal: 70 })],
    ]);
    const heroRow = rowsByTeamId.get("hero")!;
    const objective = getExpectationRankObjective({
      team: createTeam({ teamId: "hero", shortCode: "hero" }),
      identity: createIdentity("hero", { ambition: 5 }),
      profile: null,
      row: heroRow,
      rowsByTeamId,
    });

    // Strongest squad (expectedRank 1) but actual rank 20 -> big negative rankDelta.
    expect(objective.boardConfidenceDelta ?? 0).toBeLessThan(0);
    expect(objective.penaltyCash ?? 0).toBeGreaterThan(0);
    expect(objective.status).toBe("failed");
  });

  it("getUpsetAvoidanceObjective returns null for weak, low-ambition teams", () => {
    const rowsByTeamId = new Map([
      ["weak", createRow("weak", { ppsTotal: 20, marketValueTotal: 40 })],
      ["strong", createRow("strong", { ppsTotal: 90, marketValueTotal: 200 })],
    ]);
    const gameState = createGameState({
      teams: [createTeam({ teamId: "weak", shortCode: "weak" })],
      identities: [createIdentity("weak", { ambition: 3 })],
    });

    const objective = getUpsetAvoidanceObjective({
      team: createTeam({ teamId: "weak", shortCode: "weak" }),
      identity: createIdentity("weak", { ambition: 3 }),
      profile: null,
      row: rowsByTeamId.get("weak")!,
      rowsByTeamId,
      gameState,
    });

    expect(objective).toBeNull();
  });

  it("getUpsetAvoidanceObjective counts matchdays where a weaker-expectation team outranked us", () => {
    const teams = [
      createTeam({ teamId: "top", shortCode: "top" }),
      createTeam({ teamId: "under", shortCode: "under" }),
      createTeam({ teamId: "filler", shortCode: "filler" }),
    ];
    const rowsByTeamId = new Map([
      ["top", createRow("top", { ppsTotal: 90, marketValueTotal: 200 })],
      ["under", createRow("under", { ppsTotal: 20, marketValueTotal: 40 })],
      ["filler", createRow("filler", { ppsTotal: 55, marketValueTotal: 100 })],
    ]);
    const gameState = createGameState({ teams });
    gameState.season.matchdayIds = ["md-1", "md-2", "md-3", "md-4"];
    gameState.seasonState.matchdayResults = [
      createMatchdayResult("result-1", "md-1"),
      createMatchdayResult("result-2", "md-2"),
    ];
    // Matchday 1: "under" (weaker expectation) outscores "top" -> an upset.
    // Matchday 2: "top" outscores everyone -> no upset.
    gameState.seasonState.disciplineResults = [
      createDisciplineResult("dr-1", "result-1", "under", 300),
      createDisciplineResult("dr-2", "result-1", "top", 200),
      createDisciplineResult("dr-3", "result-1", "filler", 150),
      createDisciplineResult("dr-4", "result-2", "top", 300),
      createDisciplineResult("dr-5", "result-2", "under", 100),
      createDisciplineResult("dr-6", "result-2", "filler", 90),
    ];

    const objective = getUpsetAvoidanceObjective({
      team: teams[0],
      identity: createIdentity("top", { ambition: 8 }),
      profile: null,
      row: rowsByTeamId.get("top")!,
      rowsByTeamId,
      gameState,
    });

    expect(objective).not.toBeNull();
    expect(objective?.currentValue).toBe(1);
    expect(objective?.objectiveId).toBe("sport-upset-avoidance");
  });

  it("getUpsetAvoidanceObjective fails when upsets exceed the cap", () => {
    const teams = [createTeam({ teamId: "top", shortCode: "top" }), createTeam({ teamId: "under", shortCode: "under" })];
    const rowsByTeamId = new Map([
      ["top", createRow("top", { ppsTotal: 95, marketValueTotal: 220 })],
      ["under", createRow("under", { ppsTotal: 15, marketValueTotal: 30 })],
    ]);
    const gameState = createGameState({ teams });
    gameState.season.matchdayIds = ["md-1", "md-2", "md-3", "md-4", "md-5"];
    gameState.seasonState.matchdayResults = [
      createMatchdayResult("result-1", "md-1"),
      createMatchdayResult("result-2", "md-2"),
      createMatchdayResult("result-3", "md-3"),
      createMatchdayResult("result-4", "md-4"),
    ];
    // "under" outscores "top" on every matchday -> 4 upsets, well above any cap.
    gameState.seasonState.disciplineResults = [
      createDisciplineResult("dr-1", "result-1", "under", 300),
      createDisciplineResult("dr-2", "result-1", "top", 100),
      createDisciplineResult("dr-3", "result-2", "under", 300),
      createDisciplineResult("dr-4", "result-2", "top", 100),
      createDisciplineResult("dr-5", "result-3", "under", 300),
      createDisciplineResult("dr-6", "result-3", "top", 100),
      createDisciplineResult("dr-7", "result-4", "under", 300),
      createDisciplineResult("dr-8", "result-4", "top", 100),
    ];

    const objective = getUpsetAvoidanceObjective({
      team: teams[0],
      identity: createIdentity("top", { ambition: 9 }),
      profile: null,
      row: rowsByTeamId.get("top")!,
      rowsByTeamId,
      gameState,
    });

    expect(objective?.status).toBe("failed");
    expect(objective?.currentValue).toBe(4);
    expect(objective?.penaltyCash ?? 0).toBeGreaterThan(0);
  });

  it("getTransferSpendCeilingObjective is null for teams without a cash-conscious board", () => {
    const objective = getTransferSpendCeilingObjective({
      team: createTeam({ teamId: "spender", shortCode: "spender", budget: 100 }),
      identity: createIdentity("spender", { finances: 3 }),
      profile: null,
      row: createRow("spender", { transferNet: -50 }),
      rowsByTeamId: new Map([["spender", createRow("spender", { transferNet: -50 })]]),
    });

    expect(objective).toBeNull();
  });

  /**
   * VORHER stand hier ein fester Deckel (`max(4, Budget * 20%)`). Am Live-Save gemessen traf der in
   * Saison 2 fünf Teams mit Netto-Ausgaben von 218 bis 281 Mio — alle fünf „verfehlt". Der Grund:
   * JEDER Saisonwechsel ist eine Kaufsaison, die Liga verkauft und kauft geschlossen neu. Ein
   * Deckel, der einen ligaweiten Umbau bestraft, misst den Umbau und nicht die Ausgabendisziplin.
   *
   * Seither entscheidet der Ligavergleich: sparsam heisst sparsam IM FELD.
   */
  it("getTransferSpendCeilingObjective wertet die Netto-Ausgaben gegen die Liga statt gegen einen festen Deckel", () => {
    const team = createTeam({ teamId: "disciplined", shortCode: "disciplined", budget: 100 });
    const identity = createIdentity("disciplined", { finances: 8 });
    // Eine Liga im Umbau: alle geben dreistellig aus, „disciplined" mal als sparsamstes, mal als
    // teuerstes Team desselben Feldes.
    const sparsamesFeld = new Map([
      ["disciplined", createRow("disciplined", { transferNet: -120 })],
      ["a", createRow("a", { transferNet: -200 })],
      ["b", createRow("b", { transferNet: -240 })],
      ["c", createRow("c", { transferNet: -280 })],
    ]);
    const teuresFeld = new Map([
      ["disciplined", createRow("disciplined", { transferNet: -280 })],
      ["a", createRow("a", { transferNet: -120 })],
      ["b", createRow("b", { transferNet: -130 })],
      ["c", createRow("c", { transferNet: -140 })],
    ]);

    const sparsam = getTransferSpendCeilingObjective({
      team,
      identity,
      profile: null,
      row: sparsamesFeld.get("disciplined")!,
      rowsByTeamId: sparsamesFeld,
    });
    const verschwenderisch = getTransferSpendCeilingObjective({
      team,
      identity,
      profile: null,
      row: teuresFeld.get("disciplined")!,
      rowsByTeamId: teuresFeld,
    });

    // 120 Mio Netto-Ausgaben wären unter dem alten Deckel von 20 hoffnungslos verfehlt gewesen —
    // im Feld ist es der sparsamste Wert und damit erfüllt.
    expect(sparsam?.status).toBe("completed");
    expect(sparsam?.currentValue).toBe(1);
    expect(verschwenderisch?.status).toBe("failed");
    expect(verschwenderisch?.penaltyCash ?? 0).toBeGreaterThan(0);
  });

  it("getSignatureAxisWinObjective counts matchdays where the team ranked #1 in its signature axis", () => {
    const team = createTeam({ teamId: "P-P", shortCode: "P-P", name: "Power Pushers" });
    const gameState = createGameState({
      teams: [team],
      identities: [createIdentity("P-P", { pow: 10, spe: 2, men: 2, soc: 2, ambition: 8 })],
      disciplines: [
        { id: "d-pow", name: "Power Disc", category: "power", weight: 1 },
        { id: "d-soc", name: "Social Disc", category: "social", weight: 1 },
      ],
    });
    gameState.season.matchdayIds = ["md-1", "md-2"];
    gameState.seasonState.matchdayResults = [createMatchdayResult("result-1", "md-1"), createMatchdayResult("result-2", "md-2")];
    gameState.seasonState.disciplineResults = [
      // Matchday 1: P-P wins the power (signature) axis.
      { id: "dr-1", matchdayResultId: "result-1", teamId: "P-P", disciplineId: "d-pow", disciplineSide: "d1", rank: 1, baseScore: 100, totalScore: 100, readinessStatus: "ready", warnings: [], createdAt: "2026-06-13T10:00:00.000Z" },
      { id: "dr-2", matchdayResultId: "result-1", teamId: "OTHER", disciplineId: "d-pow", disciplineSide: "d1", rank: 2, baseScore: 50, totalScore: 50, readinessStatus: "ready", warnings: [], createdAt: "2026-06-13T10:00:00.000Z" },
      // Matchday 1: social discipline should NOT count toward the power signature axis.
      { id: "dr-3", matchdayResultId: "result-1", teamId: "OTHER", disciplineId: "d-soc", disciplineSide: "d1", rank: 1, baseScore: 500, totalScore: 500, readinessStatus: "ready", warnings: [], createdAt: "2026-06-13T10:00:00.000Z" },
      // Matchday 2: P-P loses the power axis.
      { id: "dr-4", matchdayResultId: "result-2", teamId: "P-P", disciplineId: "d-pow", disciplineSide: "d1", rank: 2, baseScore: 40, totalScore: 40, readinessStatus: "ready", warnings: [], createdAt: "2026-06-13T10:00:00.000Z" },
      { id: "dr-5", matchdayResultId: "result-2", teamId: "OTHER", disciplineId: "d-pow", disciplineSide: "d1", rank: 1, baseScore: 90, totalScore: 90, readinessStatus: "ready", warnings: [], createdAt: "2026-06-13T10:00:00.000Z" },
    ];

    const objective = getSignatureAxisWinObjective({ team, identity: gameState.teamIdentities[0], profile: null, gameState });

    expect(objective).not.toBeNull();
    expect(objective?.currentValue).toBe(1);
    expect(objective?.objectiveId).toBe("sport-signature-wins");
    expect(objective?.label).toContain("POW-Achse");
  });

  it("getSignatureAxisWinObjective returns null for teams without a clear axis bias or ambition", () => {
    const team = createTeam({ teamId: "flat", shortCode: "flat" });
    const gameState = createGameState({
      teams: [team],
      identities: [createIdentity("flat", { pow: 5, spe: 5, men: 5, soc: 5, ambition: 4 })],
    });

    const objective = getSignatureAxisWinObjective({
      team,
      identity: createIdentity("flat", { pow: 5, spe: 5, men: 5, soc: 5, ambition: 4 }),
      profile: null,
      gameState,
    });

    expect(objective).toBeNull();
  });

  it("wires the new objectives into buildTeamObjectiveOverview as selectable candidates without breaking the 4-slot cap", () => {
    const team = createTeam({ teamId: "M-M" });
    const gameState = createGameState({ teams: [team], identities: [createIdentity("M-M")] });

    const overview = buildTeamObjectiveOverview(gameState);
    const coreObjectives = overview.objectives.filter((objective) => objective.teamId === "M-M" && objective.category !== "sponsor");

    expect(coreObjectives).toHaveLength(4);
  });
});

describe("Rang-Erwartungen: angezeigte Zielmarke und Auswertung dürfen nicht auseinanderfallen", () => {
  // Chris' Fall aus dem Live-Save (C-C, Endrang 21): Die Erwartung stand mit dem Label
  // "Übertreffe die Erwartung (Top 25)" in der Liste, gewertet wurde sie aber gegen "Top 10" —
  // das Label war aus der Vergabe eingefroren, die Zielmarke wurde bei jedem Refresh neu gerechnet.
  // Ergebnis: Rang 21 unter der Marke "Top 25" und trotzdem "verfehlt". Zwei Erwartungen desselben
  // Endrangs konnten so denselben Stand zeigen, obwohl ihre Marken auseinanderliegen.
  const LEAGUE_SIZE = 32;
  /** Marke aus dem Label ziehen ("Übertreffe die Erwartung (Top 25)" -> 25). */
  const markInLabel = (label: string) => {
    const match = label.match(/Top\s+(\d+)/i);
    return match ? Number(match[1]) : null;
  };
  /** Marke aus dem gewerteten Zielwert ziehen ("Top 25" -> 25). */
  const markInTarget = (targetValue: number | string | boolean | null) => {
    const match = String(targetValue ?? "").match(/Top\s+(\d+)/i);
    return match ? Number(match[1]) : null;
  };

  /**
   * Liga mit streng monoton fallender Stärke: Marktwert UND coreStats sinken mit dem Index, damit
   * PPs- und Marktwert-Rang dieselbe Reihenfolge ergeben. Der Stärke-Erwartungsrang eines Teams ist
   * damit index+1, und mit Ambition 0 (Stretch 0) ist die Zielmarke exakt dieser Erwartungsrang.
   */
  const buildLeague = (input: {
    focus: { teamId: string; strengthIndex: number; finalRank: number; storedLabel: string; storedTarget: string }[];
  }) => {
    const teams = Array.from({ length: LEAGUE_SIZE }, (_, index) => {
      const focus = input.focus.find((entry) => entry.strengthIndex === index);
      const teamId = focus?.teamId ?? `L-${index}`;
      return createTeam({ teamId, shortCode: teamId, name: teamId, identityId: teamId });
    });
    const players = teams.map((team, index) =>
      createPlayer(`${team.teamId}-p`, {
        rating: 95 - index * 2,
        marketValue: 400 - index * 10,
        displayMarketValue: 400 - index * 10,
        coreStats: { pow: 80 - index * 2, spe: 80 - index * 2, men: 80 - index * 2, soc: 80 - index * 2 },
      }),
    );
    const rosters = teams.map((team) => createRoster(`${team.teamId}-p`, { teamId: team.teamId, currentValue: 0 }));
    const finalRankByTeamId = new Map(input.focus.map((entry) => [entry.teamId, entry.finalRank] as const));

    return createGameState({
      teams,
      // Ambition 0 -> Dispositions-Ambition am Minimum -> Stretch 0 -> Zielmarke == Erwartungsrang.
      identities: teams.map((team) => createIdentity(team.teamId, { ambition: 0 })),
      players,
      rosters,
      // Saisonpunkte je Team (Disziplinwert) fallen mit dem Index — damit ergeben PPs-Rang und
      // Marktwert-Rang dieselbe Reihenfolge und der Stärke-Erwartungsrang ist exakt index+1.
      standings: Object.fromEntries(
        teams.map((team, index) => [
          team.teamId,
          {
            points: 200 - index,
            rank: finalRankByTeamId.get(team.teamId) ?? index + 1,
            disciplineValues: { tdm: 200 - index },
          },
        ]),
      ) as GameState["seasonState"]["standings"],
      // Gespeicherte Erwartungen aus der Vergabe — mit der Marke, die damals galt.
      teamSeasonObjectives: input.focus.map((entry) => ({
        seasonId: "season-3",
        teamId: entry.teamId,
        objectiveId: "expectation-rank",
        category: "sport" as const,
        label: entry.storedLabel,
        targetValue: entry.storedTarget,
        currentValue: entry.finalRank,
        status: "open" as const,
        boardConfidenceDelta: 0,
        source: "team_expectation_rank_model",
      })),
    });
  };

  it("wertet zwei Erwartungen mit Endrang 21 gegen ihre eigene Marke — Top 25 erfüllt, Top 10 verfehlt", () => {
    // Beide Teams beenden die Saison auf Rang 21. Ihre gespeicherten Labels nennen jeweils die
    // Marke des ANDEREN Ziels — genau der eingefrorene Stand, den Chris gesehen hat.
    const gameState = buildLeague({
      focus: [
        {
          teamId: "C-C",
          strengthIndex: 9, // Stärke-Erwartungsrang 10 -> neu kalibrierte Marke "Top 10"
          finalRank: 21,
          storedLabel: "Übertreffe die Erwartung (Top 25)",
          storedTarget: "Top 25",
        },
        {
          teamId: "K-K",
          strengthIndex: 24, // Stärke-Erwartungsrang 25 -> neu kalibrierte Marke "Top 25"
          finalRank: 21,
          storedLabel: "Übertreffe die Erwartung (Top 20)",
          storedTarget: "Top 20",
        },
      ],
    });

    // EINE Auswertung für beide Ziele.
    const objectives = buildTeamObjectiveOverview(gameState).objectives;
    const ccGoal = objectives.find((objective) => objective.teamId === "C-C" && objective.objectiveId === "expectation-rank");
    const kkGoal = objectives.find((objective) => objective.teamId === "K-K" && objective.objectiveId === "expectation-rank");

    expect(ccGoal).toBeDefined();
    expect(kkGoal).toBeDefined();

    // Die Marken laufen auseinander — und die Anzeige nennt dieselbe Marke, gegen die gewertet wird.
    expect(markInTarget(ccGoal?.targetValue ?? null)).toBe(10);
    expect(markInLabel(ccGoal?.label ?? "")).toBe(10);
    expect(markInTarget(kkGoal?.targetValue ?? null)).toBe(25);
    expect(markInLabel(kkGoal?.label ?? "")).toBe(25);

    // Endrang 21: gegen Top 25 erfüllt, gegen Top 10 verfehlt — nicht derselbe Stand.
    expect(ccGoal?.currentValue).toBe(21);
    expect(kkGoal?.currentValue).toBe(21);
    expect(kkGoal?.status).toBe("completed");
    expect(ccGoal?.status).toBe("failed");
    expect(ccGoal?.status).not.toBe(kkGoal?.status);
  });

  it("hält bei jeder Rang-Erwartung Label-Marke und gewertete Marke deckungsgleich", () => {
    const gameState = buildLeague({
      focus: [
        {
          teamId: "C-C",
          strengthIndex: 19, // Marke "Top 20"
          finalRank: 21,
          storedLabel: "Übertreffe die Erwartung (Top 25)",
          storedTarget: "Top 25",
        },
      ],
    });

    const goal = buildTeamObjectiveOverview(gameState).objectives.find(
      (objective) => objective.teamId === "C-C" && objective.objectiveId === "expectation-rank",
    );

    // Rang 21 gegen Marke Top 20: nicht erfüllt — und das Label darf nicht länger "Top 25" behaupten.
    expect(markInTarget(goal?.targetValue ?? null)).toBe(20);
    expect(markInLabel(goal?.label ?? "")).toBe(20);
    expect(goal?.status).not.toBe("completed");
  });
});

describe("Vergabe: höchstens ein verbindliches Rang-Ziel je Saison", () => {
  // Chris' Regel: "man kann ja nicht 2 Rank Targets haben". Der Slot-1-Sportauftrag (die
  // Rang-Erwartung) bleibt verbindlich; jedes weitere Rang-Ziel im Slate wird zum optionalen
  // Zusatzziel — es kann Bonus bringen, kostet aber nichts, wenn es verfehlt wird.
  const buildTeamWithSecondRankGoal = () => {
    // Klares Achsenprofil (kein Allrounder), aber Bias/Ambition unter der Schwelle für ein eigenes
    // Achsen-Rangziel — damit rutscht der Spieler-Durchbruch ("Top-20-Durchbruch schaffen") in den
    // Slate und ist dort das zweite Rang-Ziel.
    const team = createTeam({ teamId: "C-C", shortCode: "C-C", identityId: "C-C" });
    const gameState = createGameState({
      teams: [team],
      identities: [createIdentity("C-C", { pow: 7, spe: 2, men: 2, soc: 2, ambition: 6 })],
    });
    // Saison durchgespielt, ohne dass ein Spieler je Top 20 war -> der Durchbruch ist verfehlt.
    gameState.seasonState.matchdayResults = [createMatchdayResult("md-result-1", "md-1")];
    return gameState;
  };

  it("stuft das zweite Rang-Ziel zum optionalen Zusatzziel herab", () => {
    const objectives = buildTeamObjectiveOverview(buildTeamWithSecondRankGoal()).objectives.filter(
      (objective) => objective.teamId === "C-C",
    );

    const expectationGoal = objectives.find((objective) => objective.objectiveId === "expectation-rank");
    const breakthroughGoal = objectives.find((objective) => objective.objectiveId === "player-top20-breakthrough");

    // Das Rang-Ziel des Vorstands bleibt verbindlich.
    expect(expectationGoal).toBeDefined();
    expect(expectationGoal?.optional).toBeFalsy();

    // Das zweite Rang-Ziel wird als Zusatzziel vergeben: erkennbar im Label, ohne Strafe.
    expect(breakthroughGoal).toBeDefined();
    expect(breakthroughGoal?.optional).toBe(true);
    expect(breakthroughGoal?.label).toContain("(optional)");
    expect(breakthroughGoal?.status).toBe("failed");
    expect(breakthroughGoal?.penaltyCash).toBeUndefined();
    expect(breakthroughGoal?.boardConfidenceDelta ?? 0).toBeGreaterThanOrEqual(0);
  });

  it("führt genau ein verbindliches Rang-Ziel im Board-Slate", () => {
    const objectives = buildTeamObjectiveOverview(buildTeamWithSecondRankGoal()).objectives.filter(
      (objective) => objective.teamId === "C-C" && objective.category !== "sponsor",
    );
    // Ziele, deren Marke eine PLATZIERUNG ist (Liga-, Achsen- oder Disziplin-Rang) — also die,
    // die um den einen verbindlichen Sportauftrag konkurrieren. Die Kategorien sind nicht
    // dekorativ: alle Entwürfe mit `rankTarget` liegen in `sport` oder `player`.
    //
    // Bewusst NICHT „alles, wo ‚Rang' im Zielwert steht": seit die Finanz- und Kaderziele gegen die
    // LIGA kalibriert werden (Gehaltsquote, Cashpuffer, Transferausgaben, Formkarten), tragen auch
    // sie einen Rang als Marke. Der Rang ist dort aber eine Messlatte für eine Finanzgröße und kein
    // Anspruch auf einen Tabellenplatz — die Ein-Rang-Ziel-Regel meint sie nie.
    const rankGoals = objectives.filter(
      (objective) =>
        (objective.category === "sport" || objective.category === "player") &&
        /Top\s+\d+|Rang/i.test(String(objective.targetValue ?? "")),
    );

    expect(rankGoals.length).toBeGreaterThan(1);
    expect(rankGoals.filter((objective) => !objective.optional)).toHaveLength(1);
  });

  it("ein verfehltes Zusatzziel kostet weder Cash noch Vorstandsvertrauen", () => {
    const gameState = buildTeamWithSecondRankGoal();
    const overview = buildTeamObjectiveOverview(gameState);
    const settlement = buildTeamSeasonObjectiveSettlement(gameState);
    const breakthroughRow = settlement.rows.find(
      (row) => row.teamId === "C-C" && row.objectiveId === "player-top20-breakthrough",
    );

    expect(breakthroughRow?.status).toBe("failed");
    expect(breakthroughRow?.cashDelta).toBe(0);
    expect(breakthroughRow?.boardConfidenceDelta).toBeGreaterThanOrEqual(0);
    // Und es taucht nicht als Vorstands-Warnung auf, solange die verbindlichen Ziele stehen.
    expect(overview.boardConfidence["C-C"]).toBeDefined();
  });
});

// FAIRNESS DER BOARD-ZIELE: zwei Vorgaben, die ein Team gar nicht erreichen KONNTE, wurden trotzdem
// gestellt und am Saisonende als "verfehlt" gemeldet — inklusive Vertrauensabzug. Beide Fälle stammen
// aus einem echten Spielstand (Team auf Liga-Rang 19).
describe("Board-Ziele bleiben erreichbar", () => {
  /** Liga mit streng monoton fallender Stärke: Index 0 = stärkstes Team, Index n-1 = schwächstes. */
  function buildStrengthLadderLeague(teamCount: number, identityPartial?: Partial<TeamIdentity>) {
    const teams = Array.from({ length: teamCount }, (_, i) =>
      createTeam({ teamId: `L-${i}`, shortCode: `L${i}`, name: `Ladder ${i}` }),
    );
    const players = teams.map((team, i) =>
      createPlayer(`${team.teamId}-p`, {
        rating: 95 - i * 2,
        marketValue: 400 - i * 10,
        displayMarketValue: 400 - i * 10,
        coreStats: { pow: 80 - i * 2, spe: 80 - i * 2, men: 80 - i * 2, soc: 80 - i * 2 },
      }),
    );
    const rosters = teams.map((team) => createRoster(`${team.teamId}-p`, { teamId: team.teamId, currentValue: 0 }));
    const gameState = createGameState({
      teams,
      // Ambition 8 für ALLE: das Medaillenziel hing bisher allein daran, also ist der Identity-Gate offen.
      identities: teams.map((team) => createIdentity(team.teamId, { ambition: 8, ...identityPartial })),
      players,
      rosters,
      standings: Object.fromEntries(teams.map((team, i) => [team.teamId, { points: 100 - i, rank: i + 1 }])),
    });
    const rowsByTeamId = new Map(buildTeamSeasonOverviewRows({ gameState }).map((row) => [row.teamId, row] as const));
    return { gameState, teams, rowsByTeamId };
  }

  function medalObjectiveFor(teamIndex: number) {
    const { gameState, teams, rowsByTeamId } = buildStrengthLadderLeague(32);
    const team = teams[teamIndex]!;
    return getMatchdayMedalObjective({
      gameState,
      team,
      identity: gameState.teamIdentities.find((entry) => entry.teamId === team.teamId) ?? null,
      profile: null,
      rowsByTeamId,
    });
  }

  it("stellt einem Team ausserhalb der Medaillenreichweite kein Spieltagsmedaillen-Ziel", () => {
    // Der Spielstand-Fall: ehrgeiziges Team, sportlich aber Rang 19 von 32 — bestes Team-Rank #5, also
    // nie eine Medaille (Top 3 an einem Spieltag). Vorher wurde das Ziel trotzdem gestellt und verfehlt.
    expect(medalObjectiveFor(18)).toBeNull();
  });

  it("stellt es dem Spitzenteam derselben Liga weiterhin", () => {
    const objective = medalObjectiveFor(0);
    expect(objective).not.toBeNull();
    expect(objective?.objectiveId).toBe("sport-matchday-medals");
  });

  it("fordert zwei Medaillen nur von der Ligaspitze, nicht mehr per Team-Kürzel", () => {
    // Vorher hing das 2er-Ziel u. a. an shortCode M-M/Z-H — unabhängig davon, wie stark das Team war.
    expect(medalObjectiveFor(0)?.targetValue).toBe(2);
    // Rang ~6: noch medaillenfähig (Ein-Medaillen-Ziel), aber keine Doppelvorgabe.
    expect(medalObjectiveFor(5)?.targetValue).toBe(1);
  });

  it("spiegelt die V3-Gewinnstufenleiter nicht als Pass-/Fail-Ziel 'Top 1'", () => {
    // Die Rang-Komponente eines V3-Vertrags ist die gestaffelte Auszahlungsleiter; ihr targetValue steht
    // auf 1, weil Rang 1 die oberste Sprosse ist. Als Board-Ziel gespiegelt wurde daraus "Ziel Top 1",
    // das 31 von 32 Teams jede Saison verfehlen — mitsamt Vertrauensabzug und Inbox-Meldung.
    const { gameState, teams } = buildStrengthLadderLeague(32);
    const team = teams[18]!;
    gameState.seasonState.sponsorContractsByTeamId = {
      [team.teamId]: {
        seasonId: gameState.season.id,
        teamId: team.teamId,
        offerId: "offer-1",
        archetype: "balanced",
        name: "Testsponsor",
        chosenAt: "2026-06-13T10:00:00.000Z",
        startRank: 19,
        components: [
          { componentId: "rank-target", kind: "rank", label: "Gewinnstufen nach Endrang · Basis", targetValue: 1, rewardCash: 30 },
        ],
        payouts: {},
        sponsorV3: { cardKey: "test", cardName: "Basis" },
      },
    } as unknown as NonNullable<GameState["seasonState"]["sponsorContractsByTeamId"]>;

    const ladder = buildTeamObjectiveOverview(gameState).objectives.find(
      (objective) => objective.teamId === team.teamId && objective.objectiveId === "sponsor-rank-target",
    );

    expect(ladder).toBeDefined();
    expect(ladder?.targetValue).not.toBe("Top 1");
    expect(ladder?.status).not.toBe("failed");
    expect(ladder?.optional).toBe(true);
    expect(ladder?.boardConfidenceDelta ?? 0).toBe(0);

    // Und es schlägt nicht mehr auf das Vorstandsvertrauen durch: keine failed-Warnung aus der Leiter.
    const settlementRow = buildTeamSeasonObjectiveSettlement(gameState).rows.find(
      (row) => row.teamId === team.teamId && row.objectiveId === "sponsor-rank-target",
    );
    expect(settlementRow?.cashDelta).toBe(0);
    expect(settlementRow?.boardConfidenceDelta).toBe(0);
  });
});

describe("Achsen-Rangziel bleibt in Reichweite", () => {
  /** Liga, in der Team `L-i` auf der POW-Achse exakt Rang i+1 belegt. */
  function axisLeague(teamCount: number) {
    const teams = Array.from({ length: teamCount }, (_, i) =>
      createTeam({ teamId: `L-${i}`, shortCode: `L${i}`, name: `Ladder ${i}` }),
    );
    const rowsByTeamId = new Map(
      teams.map((team, i) => [team.teamId, createRow(team.teamId, { ppsPow: 100 - i, ppsTotal: 100 - i })] as const),
    );
    return { teams, rowsByTeamId };
  }

  function axisTargetFor(teamIndex: number) {
    const { teams, rowsByTeamId } = axisLeague(32);
    const team = teams[teamIndex]!;
    return getAxisRankObjective({
      team,
      // Ambition 9 + POW-Bias 9: der Identity-Gate ist offen, die alte Marke wäre fest "Top 5".
      identity: createIdentity(team.teamId, { ambition: 9, pow: 9, spe: 1, men: 1, soc: 1 }),
      profile: null,
      rowsByTeamId,
    });
  }

  it("verlangt von einem Team weit hinten keinen Sprung auf Top 5", () => {
    // POW-Rang 28: "Power Top 5" holt kein Kader in einer Saison auf. Höchstens der gleiche Sprung,
    // den der Vorstand auch beim Ligarang fordert (6 Plätze) -> Top 22.
    const objective = axisTargetFor(27);
    expect(objective?.targetValue).toBe("Top 22");
    expect(objective?.label).toBe("Power Top 22");
  });

  it("lässt die Ambitionsmarke stehen, wo sie ohnehin in Reichweite ist", () => {
    // POW-Rang 6 -> 6 - 6 = 0, geklemmt auf die Ambitionsmarke 5. Verhalten unverändert.
    expect(axisTargetFor(5)?.targetValue).toBe("Top 5");
    // Und ein Spitzenteam bekommt kein leichteres Ziel als vorher.
    expect(axisTargetFor(0)?.targetValue).toBe("Top 5");
  });
});
