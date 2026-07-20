import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GameState, Player, PlayerDisciplinePerformanceRecord, RosterEntry, Team, TeamIdentity } from "@/lib/data/olyDataTypes";

const persistenceState = {
  save: null as
    | {
        saveId: string;
        gameState: GameState;
      }
    | null,
};

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

vi.mock("@/lib/db/read/foundation-read-repository", () => ({
  loadFoundationSnapshotFromPrisma: vi.fn(),
}));

vi.mock("@/lib/db/read/foundation-read-projection", () => ({
  projectFoundationStateFromPrisma: vi.fn(),
}));

function createTeam(partial: Partial<Team>): Team {
  return {
    teamId: partial.teamId ?? "A-A",
    shortCode: partial.shortCode ?? partial.teamId ?? "A-A",
    name: partial.name ?? "Alpha",
    budget: partial.budget ?? 100,
    cash: partial.cash ?? 100,
    identityId: partial.identityId ?? partial.teamId ?? "A-A",
    humanControlled: partial.humanControlled ?? false,
    rosterLimit: partial.rosterLimit ?? 12,
    logoPath: partial.logoPath ?? null,
  };
}

function createIdentity(partial: Partial<TeamIdentity> & Pick<TeamIdentity, "teamId">): TeamIdentity {
  return {
    teamId: partial.teamId,
    pow: partial.pow ?? 55,
    spe: partial.spe ?? 55,
    men: partial.men ?? 55,
    soc: partial.soc ?? 55,
    ambition: partial.ambition ?? 50,
    finances: partial.finances ?? 50,
    boardConfidence: partial.boardConfidence ?? 50,
    harmony: partial.harmony ?? 50,
    manners: partial.manners ?? 50,
    popularity: partial.popularity ?? 50,
    cooperation: partial.cooperation ?? 50,
    playerMin: partial.playerMin ?? 2,
    playerOpt: partial.playerOpt ?? 3,
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
    marketValue: partial?.marketValue ?? 20,
    salaryDemand: partial?.salaryDemand ?? 4,
    displayMarketValue: partial?.displayMarketValue ?? partial?.marketValue ?? 20,
    displaySalary: partial?.displaySalary ?? partial?.salaryDemand ?? 4,
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
        above60: 0,
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
    contractLength: partial?.contractLength ?? 3,
    salary: partial?.salary ?? 5,
    upkeep: partial?.upkeep ?? partial?.salary ?? 5,
    purchasePrice: partial?.purchasePrice ?? 20,
    currentValue: partial?.currentValue ?? 20,
    roleTag: partial?.roleTag ?? "starter",
    joinedSeasonId: partial?.joinedSeasonId ?? "season-1",
  };
}

function createPerformance(partial: Partial<PlayerDisciplinePerformanceRecord> & Pick<PlayerDisciplinePerformanceRecord, "id" | "teamId" | "playerId" | "disciplineId" | "disciplineSide">): PlayerDisciplinePerformanceRecord {
  return {
    id: partial.id,
    matchdayResultId: partial.matchdayResultId ?? "result-1",
    teamId: partial.teamId,
    playerId: partial.playerId,
    activePlayerId: partial.activePlayerId ?? null,
    disciplineId: partial.disciplineId,
    disciplineSide: partial.disciplineSide,
    slotIndex: partial.slotIndex ?? 0,
    baseValue: partial.baseValue ?? 40,
    finalPlayerScore: partial.finalPlayerScore ?? 45,
    scoreContribution: partial.scoreContribution ?? 25,
    rankInTeam: partial.rankInTeam ?? 1,
    rankInDiscipline: partial.rankInDiscipline ?? 10,
    isTop10: partial.isTop10 ?? false,
    isMvpCandidate: partial.isMvpCandidate ?? false,
    storyWeight: partial.storyWeight ?? null,
    createdAt: partial.createdAt ?? "2026-06-05T10:00:00.000Z",
  };
}

function createGameState(): GameState {
  const teams = [
    createTeam({ teamId: "A-I", shortCode: "A-I", name: "AI Traders", cash: 35, budget: 100 }),
    createTeam({ teamId: "M-N", shortCode: "M-N", name: "Manual Nine", cash: 90, budget: 90, humanControlled: true }),
    createTeam({ teamId: "P-S", shortCode: "P-S", name: "Passive Stones", cash: 80, budget: 100 }),
  ];

  const identities = [
    createIdentity({ teamId: "A-I", playerMin: 2, playerOpt: 3 }),
    createIdentity({ teamId: "M-N", playerMin: 2, playerOpt: 3 }),
    createIdentity({ teamId: "P-S", playerMin: 2, playerOpt: 3 }),
  ];

  const players = [
    createPlayer("ai-core", {
      name: "Profit Runner",
      rating: 62,
      className: "Mercenary",
      race: "Human",
      traitsPositive: ["Mercenary"],
      marketValue: 28,
      displayMarketValue: 28,
      coreStats: { pow: 38, spe: 62, men: 40, soc: 36 },
    }),
    createPlayer("ai-anchor", {
      name: "Anchor Mage",
      rating: 74,
      className: "Mage",
      race: "Spirit",
      marketValue: 24,
      displayMarketValue: 24,
      coreStats: { pow: 26, spe: 32, men: 82, soc: 60 },
    }),
    createPlayer("manual-core", { name: "Manual Hero", rating: 55, className: "Captain", race: "Human", marketValue: 20, displayMarketValue: 20 }),
    createPlayer("passive-core", { name: "Passive Guard", rating: 48, className: "Soldier", race: "Human", marketValue: 18, displayMarketValue: 18 }),
  ];

  const rosters = [
    createRosterEntry("r-ai-core", "A-I", "ai-core", { salary: 9, purchasePrice: 18, currentValue: 28, contractLength: 1, roleTag: "bench" }),
    createRosterEntry("r-ai-anchor", "A-I", "ai-anchor", { salary: 4, purchasePrice: 22, currentValue: 24, contractLength: 3, roleTag: "starter" }),
    createRosterEntry("r-manual", "M-N", "manual-core", { salary: 5, purchasePrice: 20, currentValue: 20 }),
    createRosterEntry("r-passive", "P-S", "passive-core", { salary: 4, purchasePrice: 18, currentValue: 18 }),
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
      standings: Object.fromEntries(teams.map((team) => [team.teamId, { points: 0 }])),
      teamControlSettings: {
        "A-I": {
          teamId: "A-I",
          controlMode: "ai",
          aiLineupPreviewEnabled: true,
          aiLineupAutoApplyEnabled: false,
          aiTransferPreviewEnabled: true,
          aiTransferAutoApplyEnabled: false,
          aiSellPreviewEnabled: true,
          aiSellAutoApplyEnabled: false,
        },
        "M-N": {
          teamId: "M-N",
          controlMode: "manual",
          aiLineupPreviewEnabled: false,
          aiLineupAutoApplyEnabled: false,
          aiTransferPreviewEnabled: false,
          aiTransferAutoApplyEnabled: false,
          aiSellPreviewEnabled: false,
          aiSellAutoApplyEnabled: false,
        },
        "P-S": {
          teamId: "P-S",
          controlMode: "passive",
          aiLineupPreviewEnabled: false,
          aiLineupAutoApplyEnabled: false,
          aiTransferPreviewEnabled: false,
          aiTransferAutoApplyEnabled: false,
          aiSellPreviewEnabled: false,
          aiSellAutoApplyEnabled: false,
        },
      },
      playerDisciplinePerformances: [
        createPerformance({ id: "perf-1", teamId: "A-I", playerId: "ai-core", disciplineId: "d_spe", disciplineSide: "d1", scoreContribution: 12, finalPlayerScore: 30 }),
        createPerformance({ id: "perf-2", teamId: "A-I", playerId: "ai-anchor", disciplineId: "d_men", disciplineSide: "d2", scoreContribution: 48, finalPlayerScore: 70, isTop10: true }),
      ],
      teamStrategyProfiles: {
        "A-I": {
          teamId: "A-I",
          strategySummary: "Profit vor Sentimentalitaet.",
          buyStyle: "Value",
          sellStyle: "Sell quickly when value and salary drift apart.",
          contractStyle: "Kurz",
          rosterStyle: "Schlank",
          preferredArchetypes: ["value hunter"],
          secondaryArchetypes: [],
          avoidedArchetypes: ["luxury bench"],
          preferredRaces: [],
          avoidedRaces: [],
          preferredClasses: ["Trader"],
          avoidedClasses: ["Mage"],
          preferredTraits: ["Mercenary"],
          dislikedTraits: [],
          hardNoGos: [],
          lockedNoGos: [],
          strategyWarnings: [],
          bias: {
            cashPriority: 9,
            valuePriority: 10,
            starPriority: 3,
            riskTolerance: 5,
            wageSensitivity: 9,
            sellForProfitAggression: 10,
            shortContractPreference: 9,
            longContractPreference: 2,
            loyaltyBias: 2,
            harmonyStrictness: 4,
            rosterDepthPreference: 4,
            eliteSmallRosterPreference: 7,
          },
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

describe("ai transfermarkt sell preview", () => {
  beforeEach(() => {
    persistenceState.save = {
      saveId: "save-local",
      gameState: createGameState(),
    };
  });

  it("returns read-only sell suggestions only for AI teams by default", async () => {
    const { buildAiTransfermarktSellPreview } = await import("@/lib/ai/ai-transfermarkt-sell-preview-service");

    const result = await buildAiTransfermarktSellPreview({
      saveId: "save-local",
      seasonId: "season-1",
      source: "sqlite",
    });

    expect(result.readOnly).toBe(true);
    expect(result.source).toBe("sqlite");
    expect(result.totalTeams).toBe(1);
    expect(result.aiTeams).toBe(1);
    expect(result.skippedManual).toBe(0);
    expect(result.skippedPassive).toBe(0);
    expect(result.skippedDisabled).toBe(0);
    expect(result.teams[0]?.teamId).toBe("A-I");
    expect(result.teams[0]?.sellCandidates[0]?.playerName).toBe("Profit Runner");
    expect(result.teams[0]?.sellCandidates[0]?.expectedSellValue).toBeTypeOf("number");
    expect(result.teams[0]?.sellCandidates[0]?.ovr).toBeTypeOf("number");
    expect(result.teams[0]?.sellCandidates[0]?.mvs).toBeTypeOf("number");
    expect(result.teams[0]?.keepCore.length).toBeGreaterThan(0);
  });

  it("falls back to the imported visible market value when roster sell columns are empty", async () => {
    if (!persistenceState.save) {
      throw new Error("missing save");
    }

    persistenceState.save = {
      ...persistenceState.save,
      gameState: {
        ...persistenceState.save.gameState,
        rosters: persistenceState.save.gameState.rosters.map((entry) =>
          entry.id === "r-ai-core"
            ? {
                ...entry,
                currentValue: null,
                purchasePrice: null,
              }
            : entry,
        ),
      },
    };

    const { buildAiTransfermarktSellPreview } = await import("@/lib/ai/ai-transfermarkt-sell-preview-service");
    const result = await buildAiTransfermarktSellPreview({
      saveId: "save-local",
      seasonId: "season-1",
      teamId: "A-I",
      source: "sqlite",
    });

    const candidate = result.teams[0]?.sellCandidates.find((entry) => entry.playerId === "ai-core");
    expect(candidate?.expectedSellValue).toBeTypeOf("number");
    expect(candidate?.warnings).not.toContain("Kein belastbarer Verkaufswert aus der aktuellen Sell-Preview vorhanden.");
  });

  it("surfaces negative cash pressure as an explicit sell reason", async () => {
    if (!persistenceState.save) {
      throw new Error("missing save");
    }

    persistenceState.save = {
      ...persistenceState.save,
      gameState: {
        ...persistenceState.save.gameState,
        teams: persistenceState.save.gameState.teams.map((team) =>
          team.teamId === "A-I" ? { ...team, cash: -6 } : team,
        ),
      },
    };

    const { buildAiTransfermarktSellPreview } = await import("@/lib/ai/ai-transfermarkt-sell-preview-service");
    const result = await buildAiTransfermarktSellPreview({
      saveId: "save-local",
      seasonId: "season-1",
      teamId: "A-I",
      source: "sqlite",
    });

    const candidate = result.teams[0]?.sellCandidates[0];
    expect(candidate?.reasonsToSell).toContain("negatives Teamcash zum Seasonstart");
    expect(candidate?.cashAfter).toBeGreaterThan(0);
    expect(candidate?.sellPriorityScore).toBeGreaterThan(55);
  });

  it("flags underperformance and expiring weak-fit contracts as sell reasons", async () => {
    if (!persistenceState.save) {
      throw new Error("missing save");
    }

    persistenceState.save = {
      ...persistenceState.save,
      gameState: {
        ...persistenceState.save.gameState,
        seasonState: {
          ...persistenceState.save.gameState.seasonState,
          playerDisciplinePerformances: [
            ...persistenceState.save.gameState.seasonState.playerDisciplinePerformances,
            createPerformance({ id: "perf-3", teamId: "A-I", playerId: "ai-core", disciplineId: "d_spe", disciplineSide: "d1", scoreContribution: 14, finalPlayerScore: 28 }),
            createPerformance({ id: "perf-4", teamId: "A-I", playerId: "ai-core", disciplineId: "d_spe", disciplineSide: "d2", scoreContribution: 16, finalPlayerScore: 29 }),
          ],
        },
      },
    };

    const { buildAiTransfermarktSellPreview } = await import("@/lib/ai/ai-transfermarkt-sell-preview-service");
    const result = await buildAiTransfermarktSellPreview({
      saveId: "save-local",
      seasonId: "season-1",
      teamId: "A-I",
      source: "sqlite",
    });

    const candidate = result.teams[0]?.sellCandidates.find((entry) => entry.playerId === "ai-core");
    expect(candidate?.reasonsToSell).toContain("Performance blieb unter Erwartung");
    expect(candidate?.reasonsToSell).toContain("Vertrag laeuft aus und Fit/Leistung rechtfertigt keine automatische Verlaengerung");
  });

  it("adds board trust renewal limits when low board confidence meets missed expectations", async () => {
    if (!persistenceState.save) {
      throw new Error("missing save");
    }

    persistenceState.save = {
      ...persistenceState.save,
      gameState: {
        ...persistenceState.save.gameState,
        teamIdentities: persistenceState.save.gameState.teamIdentities.map((identity) =>
          identity.teamId === "A-I" ? { ...identity, boardConfidence: 24 } : identity,
        ),
        seasonState: {
          ...persistenceState.save.gameState.seasonState,
          playerDisciplinePerformances: [
            createPerformance({ id: "perf-low-1", teamId: "A-I", playerId: "ai-core", disciplineId: "d_spe", disciplineSide: "d1", scoreContribution: 10, finalPlayerScore: 22 }),
            createPerformance({ id: "perf-low-2", teamId: "A-I", playerId: "ai-core", disciplineId: "d_spe", disciplineSide: "d1", scoreContribution: 11, finalPlayerScore: 24 }),
            createPerformance({ id: "perf-low-3", teamId: "A-I", playerId: "ai-core", disciplineId: "d_spe", disciplineSide: "d2", scoreContribution: 9, finalPlayerScore: 20 }),
          ],
        },
      },
    };

    const { buildAiTransfermarktSellPreview } = await import("@/lib/ai/ai-transfermarkt-sell-preview-service");
    const result = await buildAiTransfermarktSellPreview({
      saveId: "save-local",
      seasonId: "season-1",
      teamId: "A-I",
      source: "sqlite",
    });

    const candidate = result.teams[0]?.sellCandidates.find((entry) => entry.playerId === "ai-core");
    expect(candidate?.boardTrustScore).toBeLessThan(40);
    // do_not_renew wurde entfernt: sehr niedriges Vertrauen fällt nun in den weicheren
    // (rein informativen) renewal_warning-Tier und erzwingt keinen Verkauf mehr.
    expect(candidate?.boardTrustPolicy).toBe("renewal_warning");
    expect(candidate?.salaryCapMultiplier).toBe(0.7);
    expect(candidate?.boardTrustReasons).toContain("low_board_confidence");
    expect(candidate?.boardTrustReasons).toContain("performance_below_board_expectation");
    expect(candidate?.reasonsToSell).not.toContain("Vorstand will keine Verlaengerung");
    expect(candidate?.reasonsToSell).not.toContain("Vorstand warnt vor voller Verlaengerung");
  });

  it("includes manual and passive teams only as informative rows in all-scope mode", async () => {
    const { buildAiTransfermarktSellPreview } = await import("@/lib/ai/ai-transfermarkt-sell-preview-service");

    const result = await buildAiTransfermarktSellPreview({
      saveId: "save-local",
      seasonId: "season-1",
      source: "sqlite",
      teamScope: "all",
    });

    expect(result.totalTeams).toBe(3);
    expect(result.aiTeams).toBe(1);
    expect(result.skippedManual).toBe(1);
    expect(result.skippedPassive).toBe(1);
    expect(result.teams.find((entry) => entry.teamId === "M-N")?.status).toBe("warning");
    expect(result.teams.find((entry) => entry.teamId === "P-S")?.status).toBe("warning");
  });

  it("marks hard no-gos as sell reasons without inventing sale values", async () => {
    if (!persistenceState.save) {
      throw new Error("missing save");
    }

    persistenceState.save = {
      ...persistenceState.save,
      gameState: {
        ...persistenceState.save.gameState,
        seasonState: {
          ...persistenceState.save.gameState.seasonState,
          teamStrategyProfiles: {
            ...persistenceState.save.gameState.seasonState.teamStrategyProfiles,
            "A-I": {
              ...persistenceState.save.gameState.seasonState.teamStrategyProfiles?.["A-I"],
              hardNoGos: ["mercenary"],
            },
          },
        },
      },
    };

    const { buildAiTransfermarktSellPreview } = await import("@/lib/ai/ai-transfermarkt-sell-preview-service");
    const result = await buildAiTransfermarktSellPreview({
      saveId: "save-local",
      seasonId: "season-1",
      source: "sqlite",
      teamId: "A-I",
    });

    const candidate = result.teams[0]?.sellCandidates.find((entry) => entry.playerId === "ai-core");
    expect(candidate?.reasonsToSell).toContain("faellt in ein Team-Hard-No-Go");
    expect(candidate?.sellPriorityScore).toBeTypeOf("number");
  });

  it("keeps roster-min advisory warning in default UI preview", async () => {
    const { buildAiTransfermarktSellPreview } = await import("@/lib/ai/ai-transfermarkt-sell-preview-service");
    const result = await buildAiTransfermarktSellPreview({
      saveId: "save-local",
      seasonId: "season-1",
      source: "sqlite",
      teamId: "A-I",
    });

    expect(result.teams[0]?.status).toBe("low_roster_depth");
    const warned = result.teams[0]?.sellCandidates.some((candidate) =>
      candidate.warnings.some((warning) => warning.includes("unter das Team-Minimum")),
    );
    expect(warned).toBe(true);
  });

  it("allows AI sell preview below roster min when explicitly enabled", async () => {
    const { buildAiTransfermarktSellPreview } = await import("@/lib/ai/ai-transfermarkt-sell-preview-service");
    const result = await buildAiTransfermarktSellPreview({
      saveId: "save-local",
      seasonId: "season-1",
      source: "sqlite",
      teamId: "A-I",
      allowSellBelowRosterMin: true,
    });

    expect(result.teams[0]?.status).not.toBe("low_roster_depth");
    const minWarnings = result.teams[0]?.sellCandidates.flatMap((candidate) => candidate.warnings) ?? [];
    expect(minWarnings.some((warning) => warning.includes("unter das Team-Minimum"))).toBe(false);
    expect((result.teams[0]?.sellCandidates.length ?? 0) > 0).toBe(true);
  });
});

describe("proactive strong-offer profit sells for weak teams", () => {
  // Uses the MD10 "frozen valuation" read-path so the sale-factor bracket rank (and therefore the
  // premium over market value) is fully deterministic, instead of depending on a large ranked
  // live player pool. bracket 1 spans factor 0.35..1.5 across a 101-slot pool: rank 27 lands at a
  // ~20.1% premium, rank 40 at a ~5.15% premium (verified with a throwaway script against the real
  // sale-factor formula before writing these numbers down).
  const FROZEN_BASE = {
    frozenOvr: 40,
    frozenOvrRank: 40,
    frozenMvs: 40,
    frozenMvsRank: 40,
    frozenPps: 40,
    frozenPpsRank: 40,
    frozenPpPow: null,
    frozenPpPowRank: null,
    frozenPpSpe: null,
    frozenPpSpeRank: null,
    frozenPpMen: null,
    frozenPpMenRank: null,
    frozenPpSoc: null,
    frozenPpSocRank: null,
    frozenSaleBracket: 1,
    frozenSaleBracketSize: 101,
  } as const;

  function buildThreeTeamWeaknessGameState(input: {
    seasonId: string;
    strongPlayerRankInBracket?: number;
    weakPlayerRankInBracket?: number;
  }): GameState {
    const teams = [
      createTeam({ teamId: "T-STRONG", shortCode: "T-STRONG", name: "Strong FC", cash: 500, budget: 500 }),
      createTeam({ teamId: "T-MID", shortCode: "T-MID", name: "Mid FC", cash: 300, budget: 300 }),
      createTeam({ teamId: "T-WEAK", shortCode: "T-WEAK", name: "Weak FC", cash: 200, budget: 200 }),
    ];
    const identities = teams.map((team) => createIdentity({ teamId: team.teamId, playerMin: 0, playerOpt: 1 }));
    const coreStats = { pow: 40, spe: 40, men: 40, soc: 40 };
    const players = [
      createPlayer("strong-player", { name: "Strong Star", rating: 40, marketValue: 200, displayMarketValue: 200, coreStats }),
      createPlayer("mid-player", { name: "Mid Rock", rating: 40, marketValue: 100, displayMarketValue: 100, coreStats }),
      createPlayer("weak-player", { name: "Weak Hopeful", rating: 40, marketValue: 20, displayMarketValue: 20, coreStats }),
    ];
    const rosters = [
      createRosterEntry("r-strong", "T-STRONG", "strong-player", { salary: 5, purchasePrice: 600, currentValue: 200, contractLength: 0 }),
      createRosterEntry("r-mid", "T-MID", "mid-player", { salary: 5, purchasePrice: 300, currentValue: 100, contractLength: 0 }),
      createRosterEntry("r-weak", "T-WEAK", "weak-player", { salary: 5, purchasePrice: 60, currentValue: 20, contractLength: 0 }),
    ];

    const playersById: Record<string, (typeof FROZEN_BASE) & { playerId: string; frozenMw: number; frozenSaleRankInBracket: number }> = {};
    if (input.strongPlayerRankInBracket != null) {
      playersById["strong-player"] = {
        ...FROZEN_BASE,
        playerId: "strong-player",
        frozenMw: 200,
        frozenSaleRankInBracket: input.strongPlayerRankInBracket,
      };
    }
    if (input.weakPlayerRankInBracket != null) {
      playersById["weak-player"] = {
        ...FROZEN_BASE,
        playerId: "weak-player",
        frozenMw: 20,
        frozenSaleRankInBracket: input.weakPlayerRankInBracket,
      };
    }

    return {
      season: { id: input.seasonId, name: "Weakness Season", year: 2026, currentMatchday: 1, matchdayIds: ["matchday-1"] },
      seasonState: {
        seasonId: input.seasonId,
        schedule: [],
        standings: Object.fromEntries(teams.map((team) => [team.teamId, { points: 0 }])),
        teamControlSettings: Object.fromEntries(
          teams.map((team) => [
            team.teamId,
            {
              teamId: team.teamId,
              controlMode: "ai",
              aiLineupPreviewEnabled: true,
              aiLineupAutoApplyEnabled: false,
              aiTransferPreviewEnabled: true,
              aiTransferAutoApplyEnabled: false,
              aiSellPreviewEnabled: true,
              aiSellAutoApplyEnabled: false,
            },
          ]),
        ),
        playerDisciplinePerformances: [],
        teamStrategyProfiles: {},
        frozenValuationSnapshot: {
          seasonId: input.seasonId,
          frozenAtMatchdayId: "matchday-1",
          createdAt: "2026-06-05T10:00:00.000Z",
          playersById,
        },
      },
      matchdayState: { matchdayId: "matchday-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
      teams,
      teamIdentities: identities,
      players,
      disciplines: [],
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
    } as unknown as GameState;
  }

  it("a weak (bottom-third) team fires profit_window for a clear ~20% premium offer without cash pressure", async () => {
    const seasonId = "season-weak-strong-offer";
    persistenceState.save = {
      saveId: "save-weak-strong-offer",
      gameState: buildThreeTeamWeaknessGameState({ seasonId, weakPlayerRankInBracket: 27 }),
    };

    const { buildAiTransfermarktSellPreview } = await import("@/lib/ai/ai-transfermarkt-sell-preview-service");
    const result = await buildAiTransfermarktSellPreview({
      saveId: "save-weak-strong-offer",
      seasonId,
      teamId: "T-WEAK",
      source: "sqlite",
    });

    // NOTE: a separate, pre-existing, unconditional check elsewhere in this service already pushes
    // the generic "profit_window" code whenever the sell value tops the (here, coincidentally
    // equal) purchase price — so we assert on our NEW proactive-path reason text specifically,
    // which only appears when the weak-team strong-offer bar above actually fires.
    const candidate = result.teams[0]?.sellCandidates.find((entry) => entry.playerId === "weak-player");
    expect(candidate).toBeTruthy();
    expect(candidate?.expectedSellValue ?? 0).toBeGreaterThan((candidate?.marketValue ?? 0) * 1.15);
    expect(candidate?.sellReasonCodes ?? []).toContain("profit_window");
    expect(candidate?.reasonsToSell.some((reason) => reason.includes("unteren Tabellendrittel"))).toBe(true);
  });

  it("the same weak team does NOT surface the proactive strong-offer reason for only a marginal ~5% offer", async () => {
    const seasonId = "season-weak-marginal-offer";
    persistenceState.save = {
      saveId: "save-weak-marginal-offer",
      gameState: buildThreeTeamWeaknessGameState({ seasonId, weakPlayerRankInBracket: 40 }),
    };

    const { buildAiTransfermarktSellPreview } = await import("@/lib/ai/ai-transfermarkt-sell-preview-service");
    const result = await buildAiTransfermarktSellPreview({
      saveId: "save-weak-marginal-offer",
      seasonId,
      teamId: "T-WEAK",
      source: "sqlite",
    });

    const candidate = result.teams[0]?.sellCandidates.find((entry) => entry.playerId === "weak-player");
    expect(candidate).toBeTruthy();
    expect(candidate?.expectedSellValue ?? 0).toBeLessThan((candidate?.marketValue ?? 0) * 1.1);
    expect(candidate?.reasonsToSell.some((reason) => reason.includes("unteren Tabellendrittel"))).toBe(false);
    expect(candidate?.reasonsToSell.some((reason) => reason.includes("lohnt sich auch ohne Cash-Druck"))).toBe(false);
  });

  it("a strong (top-of-league) team needs a bigger premium — the same ~20% offer does NOT trigger the proactive path", async () => {
    const seasonId = "season-strong-needs-more";
    persistenceState.save = {
      saveId: "save-strong-needs-more",
      gameState: buildThreeTeamWeaknessGameState({ seasonId, strongPlayerRankInBracket: 27 }),
    };

    const { buildAiTransfermarktSellPreview } = await import("@/lib/ai/ai-transfermarkt-sell-preview-service");
    const result = await buildAiTransfermarktSellPreview({
      saveId: "save-strong-needs-more",
      seasonId,
      teamId: "T-STRONG",
      source: "sqlite",
    });

    const candidate = result.teams[0]?.sellCandidates.find((entry) => entry.playerId === "strong-player");
    expect(candidate).toBeTruthy();
    expect(candidate?.expectedSellValue ?? 0).toBeGreaterThan((candidate?.marketValue ?? 0) * 1.15);
    expect(candidate?.reasonsToSell.some((reason) => reason.includes("unteren Tabellendrittel"))).toBe(false);
    expect(candidate?.reasonsToSell.some((reason) => reason.includes("lohnt sich auch ohne Cash-Druck"))).toBe(false);
  });
});
