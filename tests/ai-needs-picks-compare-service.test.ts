import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GameState, Player, RosterEntry, Team, TeamIdentity } from "@/lib/data/olyDataTypes";

const buildAiTransfermarktPreview = vi.fn();
const buildPrizeMoneyPreview = vi.fn();

const persistenceState = {
  save: null as
    | {
        saveId: string;
        gameState: GameState;
      }
    | null,
};

vi.mock("@/lib/ai/ai-transfermarkt-preview-service", () => ({
  buildAiTransfermarktPreview,
}));

vi.mock("@/lib/persistence/persistence-service", () => ({
  createPersistenceService: () => ({
    bootstrapSingleplayerSave: () => ({
      save: persistenceState.save,
      createdFromSeed: false,
    }),
    getActiveSave: () => persistenceState.save,
    getSaveById: (saveId: string) => (persistenceState.save?.saveId === saveId ? persistenceState.save : null),
  }),
}));

vi.mock("@/lib/season/prize-money-preview", () => ({
  buildPrizeMoneyPreview,
}));

vi.mock("@/lib/db/read/foundation-read-repository", () => ({
  loadFoundationSnapshotFromPrisma: vi.fn(),
}));

vi.mock("@/lib/db/read/foundation-read-projection", () => ({
  projectFoundationStateFromPrisma: vi.fn(),
}));

function createTeam(partial: Partial<Team>): Team {
  return {
    teamId: partial.teamId ?? "C-C",
    shortCode: partial.shortCode ?? partial.teamId ?? "C-C",
    name: partial.name ?? "Cash Creators",
    budget: partial.budget ?? 100,
    cash: partial.cash ?? 100,
    identityId: partial.identityId ?? partial.teamId ?? "C-C",
    humanControlled: partial.humanControlled ?? false,
    rosterLimit: partial.rosterLimit ?? 12,
    logoPath: partial.logoPath ?? null,
  };
}

function createIdentity(partial: Partial<TeamIdentity> & Pick<TeamIdentity, "teamId">): TeamIdentity {
  return {
    teamId: partial.teamId,
    pow: partial.pow ?? 50,
    spe: partial.spe ?? 50,
    men: partial.men ?? 50,
    soc: partial.soc ?? 50,
    ambition: partial.ambition ?? 50,
    finances: partial.finances ?? 50,
    boardConfidence: partial.boardConfidence ?? 50,
    harmony: partial.harmony ?? 50,
    manners: partial.manners ?? 50,
    popularity: partial.popularity ?? 50,
    cooperation: partial.cooperation ?? 50,
    playerMin: partial.playerMin ?? 8,
    playerOpt: partial.playerOpt ?? 10,
    sourceNote: partial.sourceNote,
  };
}

function createPlayer(id: string, partial?: Partial<Player>): Player {
  return {
    id,
    name: partial?.name ?? id,
    portraitPath: partial?.portraitPath ?? null,
    portraitUrl: partial?.portraitUrl ?? null,
    rating: partial?.rating ?? 50,
    marketValue: partial?.marketValue ?? 25,
    salaryDemand: partial?.salaryDemand ?? 5,
    displayMarketValue: partial?.displayMarketValue ?? partial?.marketValue ?? 25,
    displaySalary: partial?.displaySalary ?? partial?.salaryDemand ?? 5,
    pps: partial?.pps ?? null,
    ovr: partial?.ovr ?? null,
    cost: partial?.cost,
    upkeepBase: partial?.upkeepBase,
    className: partial?.className ?? "Warrior",
    race: partial?.race ?? "Human",
    alignment: partial?.alignment ?? "N",
    gender: partial?.gender ?? "m",
    referenceClass: partial?.referenceClass ?? null,
    imageSource: partial?.imageSource ?? null,
    bracketLabel: partial?.bracketLabel ?? null,
    subclasses: partial?.subclasses ?? [],
    traitsPositive: partial?.traitsPositive ?? [],
    traitsNegative: partial?.traitsNegative ?? [],
    coreStats: partial?.coreStats ?? { pow: 50, spe: 50, men: 50, soc: 50 },
    preferredDisciplineIds: partial?.preferredDisciplineIds ?? [],
    disciplineRatings:
      partial?.disciplineRatings ??
      {
        d_pow: 50,
        d_spe: 50,
        d_men: 50,
        d_soc: 50,
      },
    disciplineTierCounts:
      partial?.disciplineTierCounts ?? {
        above20: 4,
        above40: 4,
        above60: 1,
        above80: 0,
      },
    flavorEn: partial?.flavorEn ?? "",
    flavorDe: partial?.flavorDe ?? "",
    fatigue: partial?.fatigue ?? 0,
    form: partial?.form ?? 0,
    potential: partial?.potential ?? 0,
    attributeSheetStats: partial?.attributeSheetStats,
    attributeSheetRatings: partial?.attributeSheetRatings,
  };
}

function createRosterEntry(id: string, teamId: string, playerId: string, partial?: Partial<RosterEntry>): RosterEntry {
  return {
    id,
    teamId,
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

function createGameState(): GameState {
  const teams = [
    createTeam({ teamId: "C-C", shortCode: "C-C", name: "Cash Creators", cash: 70, budget: 140 }),
    createTeam({ teamId: "W-W", shortCode: "W-W", name: "Wicked Wizards", cash: 120, budget: 140 }),
    createTeam({ teamId: "T-T", shortCode: "T-T", name: "Terrible Teachers", cash: 95, budget: 120 }),
    createTeam({ teamId: "A-A", shortCode: "A-A", name: "Armageddon Aftermath", cash: 110, budget: 135 }),
  ];

  const identities = [
    createIdentity({ teamId: "C-C", pow: 42, spe: 46, men: 50, soc: 44 }),
    createIdentity({ teamId: "W-W", pow: 35, spe: 38, men: 82, soc: 60 }),
    createIdentity({ teamId: "T-T", pow: 48, spe: 45, men: 72, soc: 58 }),
    createIdentity({ teamId: "A-A", pow: 72, spe: 58, men: 42, soc: 38 }),
  ];

  const players = [
    createPlayer("c1", { name: "Ledger", className: "Trader", race: "Human", coreStats: { pow: 44, spe: 52, men: 40, soc: 48 }, disciplineRatings: { d_pow: 40, d_spe: 59, d_men: 38, d_soc: 46 } }),
    createPlayer("w1", { name: "Rune Core", className: "Mage", race: "Spirit", coreStats: { pow: 25, spe: 38, men: 84, soc: 62 }, disciplineRatings: { d_pow: 18, d_spe: 30, d_men: 92, d_soc: 66 }, subclasses: ["Wizard"] }),
    createPlayer("t1", { name: "Mentor One", className: "Teacher", race: "Human", coreStats: { pow: 42, spe: 41, men: 76, soc: 64 }, disciplineRatings: { d_pow: 35, d_spe: 31, d_men: 82, d_soc: 70 } }),
    createPlayer("a1", { name: "Ash Guard", className: "Berserker", race: "Human", coreStats: { pow: 76, spe: 59, men: 36, soc: 31 }, disciplineRatings: { d_pow: 88, d_spe: 58, d_men: 28, d_soc: 22 } }),
    createPlayer("fa-value", { name: "Value Hunter", className: "Mercenary", race: "Human", marketValue: 18, salaryDemand: 3, coreStats: { pow: 48, spe: 56, men: 42, soc: 44 }, disciplineRatings: { d_pow: 45, d_spe: 62, d_men: 39, d_soc: 40 }, traitsPositive: ["Mercenary"] }),
    createPlayer("fa-mage", { name: "Arcane Broker", className: "Mage", race: "Spirit", marketValue: 35, salaryDemand: 5, coreStats: { pow: 28, spe: 40, men: 88, soc: 68 }, disciplineRatings: { d_pow: 22, d_spe: 33, d_men: 94, d_soc: 72 }, subclasses: ["Wizard"] }),
    createPlayer("fa-teacher", { name: "Lecture Queen", className: "Teacher", race: "Human", marketValue: 27, salaryDemand: 4, coreStats: { pow: 39, spe: 44, men: 78, soc: 72 }, disciplineRatings: { d_pow: 31, d_spe: 36, d_men: 80, d_soc: 79 } }),
    createPlayer("fa-bruiser", { name: "Ash Giant", className: "Berserker", race: "Human", marketValue: 31, salaryDemand: 5, coreStats: { pow: 82, spe: 54, men: 34, soc: 28 }, disciplineRatings: { d_pow: 90, d_spe: 51, d_men: 24, d_soc: 20 } }),
  ];

  const rosters = [
    createRosterEntry("r-c1", "C-C", "c1"),
    createRosterEntry("r-w1", "W-W", "w1"),
    createRosterEntry("r-t1", "T-T", "t1"),
    createRosterEntry("r-a1", "A-A", "a1"),
  ];

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
      disciplineSchedule: [],
      standings: Object.fromEntries(teams.map((team) => [team.teamId, { points: 0 }])),
      teamControlSettings: {
        "C-C": {
          teamId: "C-C",
          controlMode: "ai",
          aiLineupPreviewEnabled: true,
          aiLineupAutoApplyEnabled: false,
          aiTransferPreviewEnabled: true,
          aiTransferAutoApplyEnabled: false,
          aiSellPreviewEnabled: true,
          aiSellAutoApplyEnabled: false,
        },
        "W-W": {
          teamId: "W-W",
          controlMode: "ai",
          aiLineupPreviewEnabled: true,
          aiLineupAutoApplyEnabled: false,
          aiTransferPreviewEnabled: true,
          aiTransferAutoApplyEnabled: false,
          aiSellPreviewEnabled: true,
          aiSellAutoApplyEnabled: false,
        },
        "T-T": {
          teamId: "T-T",
          controlMode: "ai",
          aiLineupPreviewEnabled: true,
          aiLineupAutoApplyEnabled: false,
          aiTransferPreviewEnabled: true,
          aiTransferAutoApplyEnabled: false,
          aiSellPreviewEnabled: true,
          aiSellAutoApplyEnabled: false,
        },
        "A-A": {
          teamId: "A-A",
          controlMode: "ai",
          aiLineupPreviewEnabled: true,
          aiLineupAutoApplyEnabled: false,
          aiTransferPreviewEnabled: true,
          aiTransferAutoApplyEnabled: false,
          aiSellPreviewEnabled: true,
          aiSellAutoApplyEnabled: false,
        },
      },
    },
    matchdayState: {
      matchdayId: "matchday-1",
      status: "planning",
      pendingTeamIds: [],
      resolvedFixtureIds: [],
    },
    teams,
    teamIdentities: identities,
    players,
    disciplines: [
      { id: "d_pow", name: "Power Clash", category: "power", weight: 1, playerCount: 2 },
      { id: "d_spe", name: "Sprint Arc", category: "speed", weight: 1, playerCount: 2 },
      { id: "d_men", name: "Mind Maze", category: "mental", weight: 1, playerCount: 2 },
      { id: "d_soc", name: "Social Gala", category: "social", weight: 1, playerCount: 2 },
    ],
    rosters,
    contracts: [],
    transferListings: [],
    transferHistory: [],
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

describe("ai needs picks compare service", () => {
  beforeEach(() => {
    persistenceState.save = {
      saveId: "save-compare",
      gameState: createGameState(),
    };
    buildAiTransfermarktPreview.mockReset();
    buildPrizeMoneyPreview.mockReset();
    buildPrizeMoneyPreview.mockResolvedValue({
      flowPolicy: "season_end_only",
      items: [
        { teamId: "C-C", prizeMoney: 24, futureSeasons: [{ seasonLabel: "Season 2", factor: 1, prizeMoney: 26, projectedCash: 96 }, { seasonLabel: "Season 3", factor: 1.05, prizeMoney: 27, projectedCash: 97 }, { seasonLabel: "Season 4", factor: 1.1, prizeMoney: 28, projectedCash: 98 }, { seasonLabel: "Season 5", factor: 1.15, prizeMoney: 29, projectedCash: 99 }], warnings: [] },
        { teamId: "W-W", prizeMoney: 30, futureSeasons: [{ seasonLabel: "Season 2", factor: 1, prizeMoney: 31, projectedCash: 151 }, { seasonLabel: "Season 3", factor: 1.05, prizeMoney: 31, projectedCash: 151 }, { seasonLabel: "Season 4", factor: 1.1, prizeMoney: 32, projectedCash: 152 }, { seasonLabel: "Season 5", factor: 1.15, prizeMoney: 32, projectedCash: 152 }], warnings: [] },
        { teamId: "T-T", prizeMoney: 18, futureSeasons: [{ seasonLabel: "Season 2", factor: 1, prizeMoney: 18, projectedCash: 113 }, { seasonLabel: "Season 3", factor: 1.05, prizeMoney: 17, projectedCash: 112 }, { seasonLabel: "Season 4", factor: 1.1, prizeMoney: 17, projectedCash: 112 }, { seasonLabel: "Season 5", factor: 1.15, prizeMoney: 16, projectedCash: 111 }], warnings: [] },
        { teamId: "A-A", prizeMoney: 21, futureSeasons: [{ seasonLabel: "Season 2", factor: 1, prizeMoney: 22, projectedCash: 132 }, { seasonLabel: "Season 3", factor: 1.05, prizeMoney: 23, projectedCash: 133 }, { seasonLabel: "Season 4", factor: 1.1, prizeMoney: 24, projectedCash: 134 }, { seasonLabel: "Season 5", factor: 1.15, prizeMoney: 24, projectedCash: 134 }], warnings: [] },
      ],
    });
    const previewTeams = [
      {
        teamId: "C-C",
        teamCode: "C-C",
        teamName: "Cash Creators",
        controlMode: "ai",
        aiTransferPreviewEnabled: true,
        status: "ready",
        cash: 70,
        salary: 5,
        salaryTotal: 5,
        rosterSize: 1,
        rosterCount: 1,
        targetRosterMin: 8,
        targetRosterOpt: 10,
        marketValueTotal: 24,
        needSummary: "Value and depth",
        budgetStatus: "healthy",
        rosterStatus: "under_min",
        topTargets: [],
        recommendedBuys: [
          {
            playerId: "fa-value",
            playerName: "Value Hunter",
            name: "Value Hunter",
            className: "Mercenary",
            race: "Human",
            ovr: 64,
            mvs: null,
            price: 18,
            marketValue: 18,
            salary: 3,
            contractLength: 2,
            cashAfter: 52,
            rosterAfter: 2,
            salaryAfter: 8,
            fitSummary: "Value fit",
            sportsSummary: "SPE support",
            budgetReason: ["Cash ok"],
            warnings: [],
            overallRecommendationScore: 78,
            score: 78,
            reason: "value lane",
            fitNotes: [],
            riskNotes: [],
            strategyNotes: ["Mercenary value fit"],
          },
          {
            playerId: "fa-bruiser",
            playerName: "Ash Giant",
            name: "Ash Giant",
            className: "Berserker",
            race: "Human",
            ovr: 69,
            mvs: null,
            price: 31,
            marketValue: 31,
            salary: 5,
            contractLength: 2,
            cashAfter: 39,
            rosterAfter: 2,
            salaryAfter: 10,
            fitSummary: "Power patch",
            sportsSummary: "POW spike",
            budgetReason: ["Teurer"],
            warnings: [],
            overallRecommendationScore: 61,
            score: 61,
            reason: "power lane",
            fitNotes: [],
            riskNotes: [],
            strategyNotes: ["Power only"],
          },
        ],
        skippedTargets: [],
        warnings: [],
        explanation: "Bank der Olympiade",
      },
      {
        teamId: "W-W",
        teamCode: "W-W",
        teamName: "Wicked Wizards",
        controlMode: "ai",
        aiTransferPreviewEnabled: true,
        status: "ready",
        cash: 120,
        salary: 6,
        salaryTotal: 6,
        rosterSize: 1,
        rosterCount: 1,
        targetRosterMin: 8,
        targetRosterOpt: 10,
        marketValueTotal: 30,
        needSummary: "Mental core",
        budgetStatus: "healthy",
        rosterStatus: "under_min",
        topTargets: [],
        recommendedBuys: [
          {
            playerId: "fa-mage",
            playerName: "Arcane Broker",
            name: "Arcane Broker",
            className: "Mage",
            race: "Spirit",
            ovr: 81,
            mvs: null,
            price: 35,
            marketValue: 35,
            salary: 5,
            contractLength: 3,
            cashAfter: 85,
            rosterAfter: 2,
            salaryAfter: 11,
            fitSummary: "Mental fit",
            sportsSummary: "MEN spike",
            budgetReason: ["Cash ok"],
            warnings: [],
            overallRecommendationScore: 86,
            score: 86,
            reason: "wizard lane",
            fitNotes: [],
            riskNotes: [],
            strategyNotes: ["Wunsch-Klasse"],
          },
          {
            playerId: "fa-bruiser",
            playerName: "Ash Giant",
            name: "Ash Giant",
            className: "Berserker",
            race: "Human",
            ovr: 84,
            mvs: null,
            price: 31,
            marketValue: 31,
            salary: 5,
            contractLength: 2,
            cashAfter: 89,
            rosterAfter: 2,
            salaryAfter: 11,
            fitSummary: "Roher Power-Peak",
            sportsSummary: "POW spike",
            budgetReason: ["Cash ok"],
            warnings: [],
            overallRecommendationScore: 91,
            score: 91,
            reason: "global power peak",
            fitNotes: [],
            riskNotes: ["off theme"],
            strategyNotes: ["kaum Magie-Fit"],
          },
        ],
        skippedTargets: [],
        warnings: [],
        explanation: "Magier und Mental-Stars",
      },
      {
        teamId: "T-T",
        teamCode: "T-T",
        teamName: "Terrible Teachers",
        controlMode: "ai",
        aiTransferPreviewEnabled: true,
        status: "ready",
        cash: 95,
        salary: 4,
        salaryTotal: 4,
        rosterSize: 1,
        rosterCount: 1,
        targetRosterMin: 8,
        targetRosterOpt: 10,
        marketValueTotal: 22,
        needSummary: "Leadership",
        budgetStatus: "tight",
        rosterStatus: "under_min",
        topTargets: [],
        recommendedBuys: [
          {
            playerId: "fa-teacher",
            playerName: "Lecture Queen",
            name: "Lecture Queen",
            className: "Teacher",
            race: "Human",
            ovr: 72,
            mvs: null,
            price: 27,
            marketValue: 27,
            salary: 4,
            contractLength: 2,
            cashAfter: 68,
            rosterAfter: 2,
            salaryAfter: 8,
            fitSummary: "Leader fit",
            sportsSummary: "MEN/SOC support",
            budgetReason: ["Careful buy"],
            warnings: [],
            overallRecommendationScore: 74,
            score: 74,
            reason: "mentor lane",
            fitNotes: [],
            riskNotes: [],
            strategyNotes: ["Leader fit"],
          },
          {
            playerId: "fa-bruiser",
            playerName: "Ash Giant",
            name: "Ash Giant",
            className: "Berserker",
            race: "Human",
            ovr: 83,
            mvs: null,
            price: 31,
            marketValue: 31,
            salary: 5,
            contractLength: 2,
            cashAfter: 64,
            rosterAfter: 2,
            salaryAfter: 9,
            fitSummary: "Power only",
            sportsSummary: "POW spike",
            budgetReason: ["Machbar"],
            warnings: [],
            overallRecommendationScore: 88,
            score: 88,
            reason: "raw combat value",
            fitNotes: [],
            riskNotes: ["leader mismatch"],
            strategyNotes: ["kein Mentor-Profil"],
          },
        ],
        skippedTargets: [],
        warnings: [],
        explanation: "Mentor-Kern",
      },
      {
        teamId: "A-A",
        teamCode: "A-A",
        teamName: "Armageddon Aftermath",
        controlMode: "ai",
        aiTransferPreviewEnabled: true,
        status: "ready",
        cash: 110,
        salary: 5,
        salaryTotal: 5,
        rosterSize: 1,
        rosterCount: 1,
        targetRosterMin: 8,
        targetRosterOpt: 10,
        marketValueTotal: 28,
        needSummary: "Power core",
        budgetStatus: "healthy",
        rosterStatus: "under_min",
        topTargets: [],
        recommendedBuys: [
          {
            playerId: "fa-bruiser",
            playerName: "Ash Giant",
            name: "Ash Giant",
            className: "Berserker",
            race: "Human",
            ovr: 69,
            mvs: null,
            price: 31,
            marketValue: 31,
            salary: 5,
            contractLength: 2,
            cashAfter: 79,
            rosterAfter: 2,
            salaryAfter: 10,
            fitSummary: "Power fit",
            sportsSummary: "POW spike",
            budgetReason: ["Core buy"],
            warnings: [],
            overallRecommendationScore: 79,
            score: 79,
            reason: "power core",
            fitNotes: [],
            riskNotes: [],
            strategyNotes: ["Power identity"],
          },
        ],
        skippedTargets: [],
        warnings: [],
        explanation: "Power team",
      },
    ];

    buildAiTransfermarktPreview.mockImplementation(async (params?: { teamId?: string | null }) => {
      const teamId = params?.teamId ?? null;
      const selectedTeams = teamId
        ? previewTeams.filter((entry) => entry.teamId === teamId)
        : previewTeams;

      return {
        readOnly: true,
        source: "sqlite",
        scope: {
          saveId: "save-compare",
          seasonId: "season-1",
          teamId,
          teamScope: "ai",
        },
        totalTeams: selectedTeams.length,
        aiTeams: selectedTeams.length,
        skippedManual: 0,
        skippedPassive: 0,
        skippedDisabled: 0,
        readyTeams: selectedTeams.length,
        warningTeams: 0,
        blockedTeams: 0,
        teams: selectedTeams,
      };
    });
  });

  it("stays read-only and builds the default compare set sequentially", async () => {
    const { buildAiNeedsPicksCompare } = await import("@/lib/ai/ai-needs-picks-compare-service");
    const result = await buildAiNeedsPicksCompare({
      source: "sqlite",
      saveId: "save-compare",
      teamScope: "ai",
    });

    expect(result.readOnly).toBe(true);
    expect(result.scope.compareSet).toEqual(["C-C", "W-W", "T-T", "A-A"]);
    expect(result.comparedTeams).toBe(4);
    expect(result.missingRetoolTeams).toBe(0);
    expect(result.teams[0]?.plannedPicks.length).toBeGreaterThan(0);
    expect(result.teams[0]?.sequentialStateSnapshots[0]?.cashAfter).toBeLessThan(
      result.teams[0]?.sequentialStateSnapshots[0]?.cashBefore ?? 999,
    );
    expect(result.teams[0]?.candidatePoolTop[0]?.finalScore).not.toBeNull();
    expect(Number.isFinite(result.teams[0]?.candidatePoolTop[0]?.finalScore)).toBe(true);
    expect(result.teams.find((entry) => entry.teamId === "C-C")?.plannedPicks[0]?.playerName).toBe("Value Hunter");
    expect(result.teams.find((entry) => entry.teamId === "W-W")?.plannedPicks[0]?.playerName).toBe("Arcane Broker");
    expect(result.teams.find((entry) => entry.teamId === "T-T")?.plannedPicks[0]?.playerName).toBe("Lecture Queen");
    expect(result.teams.find((entry) => entry.teamId === "A-A")?.plannedPicks[0]?.playerName).toBe("Ash Giant");
    expect(result.teams.find((entry) => entry.teamId === "C-C")?.focusTeamDiagnostics?.cCFirstSeven?.[0]).toMatchObject({
      playerName: "Value Hunter",
      lane: expect.any(String),
      valueScore: expect.any(Number),
    });
    expect(result.teams.find((entry) => entry.teamId === "C-C")?.currentRosterState.targetRosterMin).toBe(7);
    expect(
      result.teams.find((entry) => entry.teamId === "C-C")?.warnings.some((entry) => entry.includes("harte Gameplay-Minimum bleibt 7")),
    ).toBe(true);
    expect(result.teams.find((entry) => entry.teamId === "C-C")?.cashStrategy).toMatchObject({
      strategySource: "retool_reference",
      sourceStatus: "ready",
      currentCash: 70,
      targetRoster: 10,
      minimumRoster: 7,
      currentRoster: 1,
      financePosture: expect.any(String),
      spendFactor: expect.any(Number),
      allowedBudgetForSearch: expect.any(Number),
      shouldSaveCash: expect.any(Boolean),
      maxSpendPerPick: expect.any(Number),
    });
    expect(result.teams.find((entry) => entry.teamId === "C-C")?.cashStrategy.spendArchitecture).toMatchObject({
      allowed_budget_for_search: expect.any(Number),
      financePosture: expect.any(String),
      spendFactor: expect.any(Number),
      reason: expect.any(String),
    });
    expect(result.teams.find((entry) => entry.teamId === "C-C")?.cashStrategy.expectedPrizeSignal).toMatchObject({
      expectedPrizeCurrentSeason: 24,
      expectedPrizeFiveSeasonSum: expect.any(Number),
      prizeSourceStatus: "ready",
      flowPolicy: "season_end_only",
    });
    expect(result.teams.find((entry) => entry.teamId === "C-C")?.cashStrategy.maxSpendByLane.core).not.toBeNull();
    expect(result.teams.find((entry) => entry.teamId === "C-C")?.cashStrategy.maxSpendByLane.cheap_fill).not.toBeNull();
    expect(result.teams.find((entry) => entry.teamId === "C-C")?.seasonStrategy).toMatchObject({
      rosterTarget: 10,
      minimumRoster: 7,
      financePosture: expect.any(String),
      formCardColorPlan: {
        primaryFormColors: expect.any(Array),
        secondaryFormColors: expect.any(Array),
        existingFormColors: expect.any(Array),
        missingFormColors: expect.any(Array),
      },
    });
    expect(result.teams.find((entry) => entry.teamId === "C-C")?.coverage).toMatchObject({
      coreThemeCoverage: expect.any(Number),
      primaryAxisCoverage: expect.any(Number),
      formColorCoverage: expect.any(Number),
    });
    expect(result.teams[0]?.planner.slotPlan.length).toBeGreaterThan(0);
    expect(result.teams[0]?.plannedPicks[0]).toMatchObject({
      pickLane: expect.any(String),
      laneReason: expect.any(String),
      laneBudgetLimit: expect.anything(),
      laneBudgetUsed: expect.anything(),
      isStar: expect.any(Boolean),
      isSuperstar: expect.any(Boolean),
      pickedForFormColor: expect.any(Boolean),
      strategicException: expect.any(Boolean),
      mustFeelRightStatus: expect.any(String),
      cheaperAlternativeAvailable: expect.any(Boolean),
      specialistNeedFilled: expect.any(Boolean),
      coreNeedFilled: expect.any(Boolean),
      depthNeedFilled: expect.any(Boolean),
    });
    expect([null, "red", "green", "blue", "yellow"]).toContain(result.teams[0]?.plannedPicks[0]?.formColor ?? null);
    expect(result.teams.find((entry) => entry.teamId === "W-W")?.plannedPicks[0]?.scoreBreakdown).toMatchObject({
      playerQualityScore: expect.any(Number),
      needMatchScore: expect.any(Number),
      disciplineCoverageScore: expect.any(Number),
      teamIdentityScore: expect.any(Number),
      classDisciplineFitScore: expect.any(Number),
      rosterBalanceScore: expect.any(Number),
      budgetFitScore: expect.any(Number),
      laneFitScore: expect.any(Number),
      valueScore: expect.any(Number),
      formColorCoverageScore: expect.any(Number),
      formColorFlexScore: expect.any(Number),
      harmonyFitScore: expect.any(Number),
      riskPenalty: expect.any(Number),
      duplicateProfilePenalty: expect.any(Number),
      offThemePenalty: expect.any(Number),
      classSpamPenalty: expect.any(Number),
      mercenaryNegativeFitPenalty: expect.any(Number),
    });
  });

  it("accepts an explicit single team scope", async () => {
    const { buildAiNeedsPicksCompare } = await import("@/lib/ai/ai-needs-picks-compare-service");
    const result = await buildAiNeedsPicksCompare({
      source: "sqlite",
      saveId: "save-compare",
      teamId: "W-W",
      teamScope: "all",
      steps: 2,
    });

    expect(result.scope.teamId).toBe("W-W");
    expect(result.scope.compareSet).toEqual(["W-W"]);
    expect(result.teams).toHaveLength(1);
    expect(result.teams[0]?.teamId).toBe("W-W");
    expect(result.teams[0]?.plannedPicks[0]?.playerName).toBe("Arcane Broker");
    const pool = result.teams[0]?.candidatePoolTop ?? [];
    const wizardPick = pool.find((entry) => entry.playerName === "Arcane Broker");
    const bruiserPick = pool.find((entry) => entry.playerName === "Ash Giant");
    expect(bruiserPick).toBeTruthy();
    expect(wizardPick?.scoreBreakdown.teamIdentityScore ?? 0).toBeGreaterThan(
      bruiserPick?.scoreBreakdown.teamIdentityScore ?? 0,
    );
    expect(wizardPick?.scoreBreakdown.offThemePenalty ?? 0).toBeGreaterThanOrEqual(
      bruiserPick?.scoreBreakdown.offThemePenalty ?? 0,
    );
  });

  it("keeps strict identity teams on-theme before off-theme bruiser fallbacks", async () => {
    const { buildAiNeedsPicksCompare } = await import("@/lib/ai/ai-needs-picks-compare-service");
    const result = await buildAiNeedsPicksCompare({
      source: "sqlite",
      saveId: "save-compare",
      teamId: "T-T",
      teamScope: "all",
      steps: 2,
    });

    const pool = result.teams[0]?.candidatePoolTop ?? [];
    expect(pool[0]?.playerName).toBe("Lecture Queen");
    const offThemeBruiser = pool.find((entry) => entry.playerName === "Ash Giant");
    if (offThemeBruiser) {
      expect(offThemeBruiser.scoreBreakdown.offThemePenalty).toBeLessThanOrEqual(-4);
      expect(["warning", "risky_but_allowed", "on_plan", "strong_fit"]).toContain(offThemeBruiser.mustFeelRightStatus);
      expect(["warning", "blocked", "ok", undefined]).toContain(offThemeBruiser.focusTeamStatus);
    }
  });

  it("allows a slight lane-budget stretch for aggressive high-fit teams while cash stays positive", async () => {
    buildAiTransfermarktPreview.mockResolvedValueOnce({
      readOnly: true,
      source: "sqlite",
      scope: {
        saveId: "save-compare",
        seasonId: "season-1",
        teamId: "W-W",
        teamScope: "all",
      },
      totalTeams: 1,
      aiTeams: 1,
      skippedManual: 0,
      skippedPassive: 0,
      skippedDisabled: 0,
      readyTeams: 1,
      warningTeams: 0,
      blockedTeams: 0,
      teams: [
        {
          teamId: "W-W",
          teamCode: "W-W",
          teamName: "Wicked Wizards",
          controlMode: "ai",
          aiTransferPreviewEnabled: true,
          status: "ready",
          cash: 120,
          salary: 6,
          salaryTotal: 6,
          rosterSize: 1,
          rosterCount: 1,
          targetRosterMin: 8,
          targetRosterOpt: 10,
          marketValueTotal: 30,
          needSummary: "Mental core",
          budgetStatus: "healthy",
          rosterStatus: "under_min",
          topTargets: [],
          recommendedBuys: [
            {
              playerId: "fa-mage",
              playerName: "Arcane Broker",
              name: "Arcane Broker",
              className: "Mage",
              race: "Spirit",
              ovr: 81,
              mvs: null,
              price: 52,
              marketValue: 52,
              salary: 5,
              contractLength: 3,
              cashAfter: 68,
              rosterAfter: 2,
              salaryAfter: 11,
              fitSummary: "Mental fit",
              sportsSummary: "MEN spike",
              budgetReason: ["Leicht ueber Lane, aber noch gesund"],
              warnings: [],
              overallRecommendationScore: 89,
              score: 89,
              reason: "wizard lane",
              fitNotes: [],
              riskNotes: [],
              strategyNotes: ["Wunsch-Klasse"],
            },
          ],
          skippedTargets: [],
          warnings: [],
          explanation: "Mentales Kernziel",
        },
      ],
    });

    const { buildAiNeedsPicksCompare } = await import("@/lib/ai/ai-needs-picks-compare-service");
    const result = await buildAiNeedsPicksCompare({
      source: "sqlite",
      saveId: "save-compare",
      teamId: "W-W",
      teamScope: "all",
      steps: 1,
    });

    const team = result.teams[0]!;
    const pick = team.plannedPicks[0]!;
    const plannedLane = team.budgetLanes.find((entry) => entry.lane === pick.lane);
    expect(pick.playerName).toBe("Arcane Broker");
    if ((pick.price ?? 0) > (plannedLane?.priceCap ?? 0)) {
      expect(pick.budgetStretchApplied).toBe(true);
      expect(pick.reasons.some((entry) => entry.includes("Budget-Stretch"))).toBe(true);
    } else {
      expect(pick.budgetStretchApplied).toBe(false);
      expect(pick.price ?? 0).toBeLessThanOrEqual(plannedLane?.priceCap ?? 0);
    }
    expect(team.sequentialStateSnapshots[0]?.cashAfter ?? -1).toBeGreaterThanOrEqual(0);
  });

  it("uses the full legal candidate pool for minimum reserve instead of a tiny top-target shortlist", async () => {
    buildAiTransfermarktPreview.mockResolvedValueOnce({
      readOnly: true,
      source: "sqlite",
      scope: {
        saveId: "save-compare",
        seasonId: "season-1",
        teamId: "M-M",
        teamScope: "all",
      },
      totalTeams: 1,
      aiTeams: 1,
      skippedManual: 0,
      skippedPassive: 0,
      skippedDisabled: 0,
      readyTeams: 1,
      warningTeams: 0,
      blockedTeams: 0,
      teams: [
        {
        teamId: "A-A",
        teamCode: "A-A",
        teamName: "Armageddon Aftermath",
          controlMode: "ai",
          aiTransferPreviewEnabled: true,
          status: "ready",
          cash: 325,
          salary: 0,
          salaryTotal: 0,
          rosterSize: 0,
          rosterCount: 0,
          targetRosterMin: 7,
          targetRosterOpt: 11,
          marketValueTotal: 0,
          needSummary: "Kader leer",
          budgetStatus: "healthy",
          rosterStatus: "under_min",
          legalCandidatePool: Array.from({ length: 8 }, (_, index) => ({
            playerId: `legal-${index + 1}`,
            playerName: `Legal ${index + 1}`,
            name: `Legal ${index + 1}`,
            className: index === 0 ? "Badass" : "Rogue",
            race: "Human",
            ovr: 60 + index,
            mvs: null,
            price: 20 + index,
            marketValue: 20 + index,
            salary: 4 + index * 0.1,
            contractLength: 2,
            cashAfter: 300 - index,
            rosterAfter: 1,
            salaryAfter: 4 + index * 0.1,
            fitSummary: "legal pool",
            sportsSummary: "pool",
            budgetReason: ["legal"],
            warnings: [],
            overallRecommendationScore: 70 - index,
            score: 70 - index,
            reason: "legal reserve pool",
            fitNotes: [],
            riskNotes: [],
            strategyNotes: ["Pool"],
          })),
          topTargets: [
            {
              playerId: "top-only",
              playerName: "Top Only",
              name: "Top Only",
              className: "Badass",
              race: "Human",
              ovr: 77,
              mvs: null,
              price: 21,
              marketValue: 21,
              salary: 4.5,
              contractLength: 2,
              cashAfter: 304,
              rosterAfter: 1,
              salaryAfter: 4.5,
              fitSummary: "shortlist",
              sportsSummary: "shortlist",
              budgetReason: ["shortlist"],
              warnings: [],
              overallRecommendationScore: 88,
              score: 88,
              reason: "top shortlist candidate",
              fitNotes: [],
              riskNotes: [],
              strategyNotes: ["Shortlist"],
            },
          ],
          recommendedBuys: [],
          skippedTargets: [],
          warnings: [],
          explanation: "Minimum reserve regression case",
        },
      ],
    });

    const { buildAiNeedsPicksCompare } = await import("@/lib/ai/ai-needs-picks-compare-service");
    const result = await buildAiNeedsPicksCompare({
      source: "sqlite",
      saveId: "save-compare",
      teamId: "A-A",
      teamScope: "all",
      steps: 1,
    });

    const team = result.teams[0]!;
    expect(team.minimumFeasibility.candidatePoolSource).toBe("legal_candidate_pool");
    expect(team.minimumFeasibility.candidatePoolSize).toBe(8);
    expect(team.minimumFeasibility.reserveForMinimum).not.toBeNull();
    expect(team.planner.blockingReasons).not.toContain("minimum_unreachable_no_legal_candidates");
    expect(team.minimumFeasibility.blockerReason).not.toBe("minimum_unreachable_no_legal_candidates");
    expect(team.plannedPicks[0]?.playerName).toBeTruthy();
  });
});
