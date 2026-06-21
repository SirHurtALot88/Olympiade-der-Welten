import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GameState, Player, RosterEntry, Team, TeamIdentity } from "@/lib/data/olyDataTypes";

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

function createGameState(): GameState {
  const teams = [
    createTeam({ teamId: "C-C", shortCode: "C-C", name: "Cash Creators", cash: 40, budget: 100 }),
    createTeam({ teamId: "W-W", shortCode: "W-W", name: "Wicked Wizards", cash: 120, budget: 120 }),
    createTeam({ teamId: "D-L", shortCode: "D-L", name: "Dire Legion", cash: 120, budget: 120 }),
    createTeam({ teamId: "M-M", shortCode: "M-M", name: "Manual Movers", cash: 90, budget: 90, humanControlled: true }),
  ];

  const identities = [
    createIdentity({ teamId: "C-C", pow: 40, spe: 45, men: 50, soc: 45, playerMin: 2, playerOpt: 3 }),
    createIdentity({ teamId: "W-W", pow: 35, spe: 40, men: 80, soc: 65, playerMin: 2, playerOpt: 3 }),
    createIdentity({ teamId: "D-L", pow: 70, spe: 45, men: 50, soc: 35, playerMin: 2, playerOpt: 3 }),
    createIdentity({ teamId: "M-M", pow: 50, spe: 50, men: 50, soc: 50, playerMin: 2, playerOpt: 3 }),
  ];

  const players = [
    createPlayer("cs-roster-1", { name: "Ledger", marketValue: 18, salaryDemand: 4, className: "Trader", race: "Human" }),
    createPlayer("ww-roster-1", { name: "Rune Core", marketValue: 30, salaryDemand: 6, className: "Mage", race: "Spirit", subclasses: ["Wizard"], coreStats: { pow: 30, spe: 35, men: 78, soc: 60 }, disciplineRatings: { d_pow: 20, d_spe: 25, d_men: 88, d_soc: 65 } }),
    createPlayer("dl-roster-1", { name: "Legion Seed", marketValue: 28, salaryDemand: 5, className: "Soldier", race: "Human", coreStats: { pow: 72, spe: 35, men: 48, soc: 30 }, disciplineRatings: { d_pow: 82, d_spe: 28, d_men: 45, d_soc: 22 } }),
    createPlayer("mm-roster-1", { name: "Captain Manual", marketValue: 25, salaryDemand: 5, className: "Captain", race: "Human" }),
    createPlayer("fa-value", { name: "Value Hunter", marketValue: 20, salaryDemand: 2, className: "Mercenary", race: "Human", subclasses: ["Mercenary"], traitsPositive: ["Mercenary"], coreStats: { pow: 48, spe: 52, men: 44, soc: 46 }, disciplineRatings: { d_pow: 45, d_spe: 58, d_men: 40, d_soc: 41 } }),
    createPlayer("fa-mage", { name: "Arcane Broker", marketValue: 42, salaryDemand: 5, className: "Mage", race: "Spirit", subclasses: ["Wizard"], coreStats: { pow: 28, spe: 38, men: 84, soc: 62 }, disciplineRatings: { d_pow: 18, d_spe: 22, d_men: 92, d_soc: 68 } }),
    createPlayer("fa-human", { name: "Legionnaire", marketValue: 34, salaryDemand: 5, className: "Soldier", race: "Human", subclasses: ["Guard"], coreStats: { pow: 74, spe: 44, men: 48, soc: 30 }, disciplineRatings: { d_pow: 86, d_spe: 36, d_men: 44, d_soc: 20 } }),
    createPlayer("fa-demon", { name: "Hell Clerk", marketValue: 26, salaryDemand: 4, className: "Warlock", race: "Demon", subclasses: ["Warlock"], coreStats: { pow: 46, spe: 40, men: 66, soc: 32 }, disciplineRatings: { d_pow: 38, d_spe: 42, d_men: 72, d_soc: 26 } }),
  ];

  const rosters = [
    createRosterEntry("r-cs-1", "C-C", "cs-roster-1", { salary: 4, currentValue: 18, purchasePrice: 18 }),
    createRosterEntry("r-ww-1", "W-W", "ww-roster-1", { salary: 6, currentValue: 30, purchasePrice: 30 }),
    createRosterEntry("r-dl-1", "D-L", "dl-roster-1", { salary: 5, currentValue: 28, purchasePrice: 28 }),
    createRosterEntry("r-mm-1", "M-M", "mm-roster-1", { salary: 5, currentValue: 25, purchasePrice: 25 }),
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
      disciplineSchedule: [
        {
          seasonId: "season-1",
          matchdayId: "matchday-1",
          matchdayIndex: 1,
          matchdayLabel: "Spieltag 1",
          discipline1: { disciplineId: "d_pow", displayName: "Power Clash", order: 1, playerCount: 2, category: "power" },
          discipline2: { disciplineId: "d_spe", displayName: "Sprint Arc", order: 2, playerCount: 2, category: "speed" },
          sourceStatus: "test",
          sourceNote: "test schedule",
        },
      ],
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
        "D-L": {
          teamId: "D-L",
          controlMode: "ai",
          aiLineupPreviewEnabled: true,
          aiLineupAutoApplyEnabled: false,
          aiTransferPreviewEnabled: true,
          aiTransferAutoApplyEnabled: false,
          aiSellPreviewEnabled: true,
          aiSellAutoApplyEnabled: false,
        },
        "M-M": {
          teamId: "M-M",
          controlMode: "manual",
          aiLineupPreviewEnabled: false,
          aiLineupAutoApplyEnabled: false,
          aiTransferPreviewEnabled: false,
          aiTransferAutoApplyEnabled: false,
          aiSellPreviewEnabled: false,
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

describe("ai transfermarkt preview service", () => {
  beforeEach(() => {
    persistenceState.save = {
      saveId: "save-ai-market",
      gameState: createGameState(),
    };
  });

  it("stays read-only and only includes ai teams in ai scope", async () => {
    const { buildAiTransfermarktPreview } = await import("@/lib/ai/ai-transfermarkt-preview-service");
    const result = await buildAiTransfermarktPreview({
      source: "sqlite",
      saveId: "save-ai-market",
      teamScope: "ai",
    });

    expect(result.readOnly).toBe(true);
    expect(result.source).toBe("sqlite");
    expect(result.teams.some((team) => team.teamId === "M-M")).toBe(false);
    expect(result.totalTeams).toBe(3);
    expect(result.aiTeams).toBe(3);
    expect(result.skippedManual).toBe(0);
    expect(result.skippedPassive).toBe(0);
    expect(result.skippedDisabled).toBe(0);
    expect(result.teams.every((team) => team.controlMode === "ai")).toBe(true);
    expect(result.teams.every((team) => team.cash != null)).toBe(true);
    expect(result.teams.every((team) => team.rosterSize != null)).toBe(true);
    expect(result.teams.every((team) => team.rosterCount != null)).toBe(true);
    expect(result.teams.every((team) => team.targetRosterMin != null)).toBe(true);
    expect(result.teams.every((team) => team.targetRosterOpt != null)).toBe(true);
    expect(result.teams.every((team) => team.salaryTotal != null)).toBe(true);
    expect(result.teams.every((team) => team.marketValueTotal != null)).toBe(true);
  }, 20000);

  it("prefers value for Cash Creators, mage fits for Wicked Wizards and human fits for Dire Legion", async () => {
    const { buildAiTransfermarktPreview } = await import("@/lib/ai/ai-transfermarkt-preview-service");
    const result = await buildAiTransfermarktPreview({
      source: "sqlite",
      saveId: "save-ai-market",
      teamScope: "all",
    });

    const cashCreators = result.teams.find((team) => team.teamId === "C-C");
    const wickedWizards = result.teams.find((team) => team.teamId === "W-W");
    const direLegion = result.teams.find((team) => team.teamId === "D-L");
    const manualTeam = result.teams.find((team) => team.teamId === "M-M");

    expect(cashCreators?.recommendedBuys[0]?.name).toBe("Value Hunter");
    expect(cashCreators?.explanation).toContain("Top-Pick: Value Hunter");
    expect(cashCreators?.recommendedBuys[0]?.overallRecommendationScore).toBeGreaterThan(0);
    expect(cashCreators?.recommendedBuys[0]?.fitSummary).toContain("Need");
    expect(cashCreators?.recommendedBuys[0]?.sportsSummary).toContain("POW");
    expect(cashCreators?.recommendedBuys[0]?.budgetReason.join(" ")).toContain("Cash");
    expect(wickedWizards?.recommendedBuys[0]?.className).toBe("Mage");
    expect(wickedWizards?.recommendedBuys[0]?.strategyNotes.join(" ")).toContain("Wunsch-Klasse");
    expect(direLegion?.recommendedBuys[0]?.race).toBe("Human");
    expect(direLegion?.recommendedBuys[0]?.name).not.toBe("Hell Clerk");
    expect(manualTeam?.status).toBe("warning");
    expect(manualTeam?.warnings[0]).toContain("manuell gesteuertes Team");
    expect(manualTeam?.recommendedBuys[0]?.warnings).toBeTruthy();
    expect(result.aiTeams).toBe(3);
    expect(result.skippedManual).toBe(1);
    expect(result.skippedPassive).toBe(0);
    expect(result.skippedDisabled).toBe(0);
    expect(cashCreators?.recommendedBuys[0]?.salaryAfter).toBeTypeOf("number");
  }, 20000);

  it("never recommends unaffordable targets as ready buys", async () => {
    const { buildAiTransfermarktPreview } = await import("@/lib/ai/ai-transfermarkt-preview-service");
    const result = await buildAiTransfermarktPreview({
      source: "sqlite",
      saveId: "save-ai-market",
      teamId: "C-C",
      teamScope: "all",
    });

    expect(result.teams[0].recommendedBuys.some((entry) => entry.name === "Arcane Broker")).toBe(false);
    expect(result.teams[0].skippedTargets.some((entry) => entry.reason.includes("insufficient_cash"))).toBe(true);
  }, 20000);

  it("lets value teams use scouted high-potential players as an AI buy signal", async () => {
    persistenceState.save!.gameState.playerPotential = [
      {
        playerId: "fa-value",
        potentialBand: "elite",
        hiddenPotentialScore: 95,
        confidence: 0,
        source: "generated",
      },
      {
        playerId: "fa-human",
        potentialBand: "medium",
        hiddenPotentialScore: 66,
        confidence: 0,
        source: "generated",
      },
    ];
    persistenceState.save!.gameState.seasonState.teamFacilities = {
      "C-C": {
        facilities: {
          scouting_office: {
            level: 3,
            enabled: true,
          },
        },
      },
    };

    const { buildAiTransfermarktPreview } = await import("@/lib/ai/ai-transfermarkt-preview-service");
    const result = await buildAiTransfermarktPreview({
      source: "sqlite",
      saveId: "save-ai-market",
      teamId: "C-C",
      teamScope: "all",
    });

    const cashCreators = result.teams[0];
    const valueHunter = cashCreators?.recommendedBuys.find((entry) => entry.playerId === "fa-value");

    expect(valueHunter?.strategyNotes.join(" ")).toContain("Scouting sieht elite-Potential");
    expect(valueHunter?.overallRecommendationScore).toBeGreaterThan(0);
    expect(cashCreators?.recommendedBuys[0]?.playerId).toBe("fa-value");
  });

  it("marks disabled ai preview teams without executing any buy", async () => {
    persistenceState.save!.gameState.seasonState.teamControlSettings!["D-L"]!.aiTransferPreviewEnabled = false;

    const { buildAiTransfermarktPreview } = await import("@/lib/ai/ai-transfermarkt-preview-service");
    const result = await buildAiTransfermarktPreview({
      source: "sqlite",
      saveId: "save-ai-market",
      teamScope: "ai",
    });

    const disabledTeam = result.teams.find((team) => team.teamId === "D-L");
    expect(disabledTeam?.status).toBe("blocked");
    expect(disabledTeam?.warnings.join(" ")).toContain("deaktiviert");
    expect(result.skippedDisabled).toBe(1);
  });

  it("lifts roster minimum to the active matchday requirement when more total slots are needed", async () => {
    const gameState = createGameState();
    gameState.season.matchdayIds = ["matchday-1", "matchday-2"];
    gameState.seasonState.disciplineSchedule = [
      {
        seasonId: "season-1",
        matchdayId: "matchday-1",
        matchdayIndex: 1,
        matchdayLabel: "Spieltag 1",
        discipline1: { disciplineId: "d_pow", displayName: "Power Clash", order: 1, playerCount: 2, category: "power" },
        discipline2: { disciplineId: "d_spe", displayName: "Sprint Arc", order: 2, playerCount: 6, category: "speed" },
        sourceStatus: "test",
        sourceNote: "matchday requirement test",
      },
      {
        seasonId: "season-1",
        matchdayId: "matchday-2",
        matchdayIndex: 2,
        matchdayLabel: "Spieltag 2",
        discipline1: { disciplineId: "d_men", displayName: "Mind Maze", order: 3, playerCount: 2, category: "mental" },
        discipline2: { disciplineId: "d_soc", displayName: "Social Gala", order: 4, playerCount: 2, category: "social" },
        sourceStatus: "test",
        sourceNote: "matchday requirement test",
      },
    ];
    persistenceState.save = {
      saveId: "save-ai-market",
      gameState,
    };

    const { buildAiTransfermarktPreview } = await import("@/lib/ai/ai-transfermarkt-preview-service");
    const result = await buildAiTransfermarktPreview({
      source: "sqlite",
      saveId: "save-ai-market",
      teamId: "C-C",
      teamScope: "all",
    });

    expect(result.teams).toHaveLength(1);
    expect(result.teams[0]?.targetRosterMin).toBe(8);
    expect(result.teams[0]?.targetRosterOpt).toBe(8);
    expect(result.teams[0]?.warnings.join(" ")).toContain("aktueller Spieltag braucht 8 aktive Slots");
  });
});
