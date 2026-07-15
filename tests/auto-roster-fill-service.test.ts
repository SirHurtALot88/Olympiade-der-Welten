import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";

const evaluateAiNeeds = vi.fn();
const listLocalTransfermarktFreeAgents = vi.fn();
const listLocalTransferHistory = vi.fn();
const previewLocalTransfermarktBuy = vi.fn();
const executeLocalTransfermarktBuy = vi.fn();
// The service now buys against a per-team run context and flushes once (batch persist). The mock buy above
// mutates persistenceState.save directly, so the context is a thin wrapper and flush is a no-op here.
const createLocalTransfermarktRunContext = vi.fn(({ save }: { save: unknown }) => ({
  save,
  persistence: persistenceState,
  deferredWrites: 0,
  pendingDerivationPlayerIds: [],
}));
const flushLocalTransfermarktRunContext = vi.fn((context: { save: unknown }) => context.save);

const persistenceState = {
  save: {
    saveId: "save-local",
    name: "Smoke Save",
    status: "active",
    gameState: {} as GameState,
  },
};

vi.mock("@/lib/market/transfermarkt-local-service", () => ({
  listLocalTransfermarktFreeAgents,
  listLocalTransferHistory,
  previewLocalTransfermarktBuy,
  executeLocalTransfermarktBuy,
  createLocalTransfermarktRunContext,
  flushLocalTransfermarktRunContext,
}));

vi.mock("@/lib/ai/aiNeedsEngine", () => ({
  evaluateAiNeeds,
}));

vi.mock("@/lib/persistence/persistence-service", () => ({
  createPersistenceService: () => ({
    getSaveById: (saveId: string) => (saveId === persistenceState.save.saveId ? persistenceState.save : null),
  }),
}));

function buildGameState(): GameState {
  return {
    season: { id: "season-1", name: "Season 1", year: 2026, currentMatchday: 1, matchdayIds: ["matchday-1"] },
    seasonState: {
      seasonId: "season-1",
      schedule: [],
      standings: {},
      teamControlSettings: {
        "M-M": {
          teamId: "M-M",
          controlMode: "manual",
          aiLineupPreviewEnabled: false,
          aiLineupApplyEnabled: false,
          aiLineupAutoApplyEnabled: false,
          aiTransferPreviewEnabled: false,
          aiTransferAutoApplyEnabled: false,
          aiSellPreviewEnabled: false,
          aiSellAutoApplyEnabled: false,
        },
        "A-A": {
          teamId: "A-A",
          controlMode: "ai",
          aiLineupPreviewEnabled: true,
          aiLineupApplyEnabled: true,
          aiLineupAutoApplyEnabled: false,
          aiTransferPreviewEnabled: true,
          aiTransferAutoApplyEnabled: false,
          aiSellPreviewEnabled: true,
          aiSellAutoApplyEnabled: false,
        },
      },
      teamStrategyProfiles: {},
    },
    matchdayState: { matchdayId: "matchday-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [
      { teamId: "M-M", shortCode: "M-M", name: "Mayhem Mavericks", budget: 500, cash: 200, identityId: "M-M", humanControlled: true, rosterLimit: 12 },
      { teamId: "A-A", shortCode: "A-A", name: "Armageddon Aftermath", budget: 500, cash: 180, identityId: "A-A", humanControlled: false, rosterLimit: 12 },
    ],
    teamIdentities: [
      { teamId: "M-M", pow: 50, spe: 50, men: 50, soc: 50, ambition: 50, finances: 50, boardConfidence: 50, harmony: 50, manners: 50, popularity: 50, cooperation: 50, playerMin: 2, playerOpt: 3 },
      { teamId: "A-A", pow: 50, spe: 50, men: 50, soc: 50, ambition: 50, finances: 50, boardConfidence: 50, harmony: 50, manners: 50, popularity: 50, cooperation: 50, playerMin: 2, playerOpt: 3 },
    ],
    players: [
      {
        id: "p-1",
        name: "Manual Core",
        rating: 60,
        marketValue: 25,
        salaryDemand: 5,
        pps: null,
        ovr: null,
        className: "Knight",
        race: "Human",
        alignment: "neutral",
        gender: "n/a",
        subclasses: [],
        traitsPositive: [],
        traitsNegative: [],
        coreStats: { pow: 50, spe: 40, men: 35, soc: 30 },
        attributeSheetRatings: {},
        preferredDisciplineIds: [],
        disciplineRatings: {},
        disciplineTierCounts: { above20: 0, above40: 0, above60: 0, above80: 0 },
        flavorEn: "",
        flavorDe: "",
        fatigue: 0,
        form: 0,
        potential: 0,
      },
      {
        id: "p-2",
        name: "AI Core One",
        rating: 61,
        marketValue: 24,
        salaryDemand: 4,
        pps: null,
        ovr: null,
        className: "Rogue",
        race: "Human",
        alignment: "neutral",
        gender: "n/a",
        subclasses: [],
        traitsPositive: [],
        traitsNegative: [],
        coreStats: { pow: 45, spe: 50, men: 33, soc: 30 },
        attributeSheetRatings: {},
        preferredDisciplineIds: [],
        disciplineRatings: {},
        disciplineTierCounts: { above20: 0, above40: 0, above60: 0, above80: 0 },
        flavorEn: "",
        flavorDe: "",
        fatigue: 0,
        form: 0,
        potential: 0,
      },
      {
        id: "p-3",
        name: "AI Core Two",
        rating: 59,
        marketValue: 20,
        salaryDemand: 4,
        pps: null,
        ovr: null,
        className: "Scout",
        race: "Human",
        alignment: "neutral",
        gender: "n/a",
        subclasses: [],
        traitsPositive: [],
        traitsNegative: [],
        coreStats: { pow: 39, spe: 48, men: 32, soc: 34 },
        attributeSheetRatings: {},
        preferredDisciplineIds: [],
        disciplineRatings: {},
        disciplineTierCounts: { above20: 0, above40: 0, above60: 0, above80: 0 },
        flavorEn: "",
        flavorDe: "",
        fatigue: 0,
        form: 0,
        potential: 0,
      },
      {
        id: "fa-1",
        name: "Free One",
        rating: 58,
        marketValue: 30,
        salaryDemand: 5,
        pps: null,
        ovr: null,
        className: "Hero",
        race: "Human",
        alignment: "neutral",
        gender: "n/a",
        subclasses: [],
        traitsPositive: [],
        traitsNegative: [],
        coreStats: { pow: 48, spe: 42, men: 33, soc: 29 },
        attributeSheetRatings: {},
        preferredDisciplineIds: [],
        disciplineRatings: {},
        disciplineTierCounts: { above20: 0, above40: 0, above60: 0, above80: 0 },
        flavorEn: "",
        flavorDe: "",
        fatigue: 0,
        form: 0,
        potential: 0,
      },
      {
        id: "fa-2",
        name: "Free Two",
        rating: 57,
        marketValue: 25,
        salaryDemand: 4,
        pps: null,
        ovr: null,
        className: "Mage",
        race: "Human",
        alignment: "neutral",
        gender: "n/a",
        subclasses: [],
        traitsPositive: [],
        traitsNegative: [],
        coreStats: { pow: 37, spe: 41, men: 39, soc: 28 },
        attributeSheetRatings: {},
        preferredDisciplineIds: [],
        disciplineRatings: {},
        disciplineTierCounts: { above20: 0, above40: 0, above60: 0, above80: 0 },
        flavorEn: "",
        flavorDe: "",
        fatigue: 0,
        form: 0,
        potential: 0,
      },
      {
        id: "fa-3",
        name: "Free Three",
        rating: 56,
        marketValue: 22,
        salaryDemand: 4,
        pps: null,
        ovr: null,
        className: "Sentinel",
        race: "Human",
        alignment: "neutral",
        gender: "n/a",
        subclasses: [],
        traitsPositive: [],
        traitsNegative: [],
        coreStats: { pow: 44, spe: 36, men: 35, soc: 30 },
        attributeSheetRatings: {},
        preferredDisciplineIds: [],
        disciplineRatings: {},
        disciplineTierCounts: { above20: 0, above40: 0, above60: 0, above80: 0 },
        flavorEn: "",
        flavorDe: "",
        fatigue: 0,
        form: 0,
        potential: 0,
      },
    ],
    disciplines: [],
    rosters: [
      { id: "r-1", teamId: "M-M", playerId: "p-1", contractLength: 2, salary: 5, upkeep: 5, purchasePrice: 25, currentValue: 25, roleTag: "starter", joinedSeasonId: "season-1" },
      { id: "r-2", teamId: "A-A", playerId: "p-2", contractLength: 2, salary: 4, upkeep: 4, purchasePrice: 24, currentValue: 24, roleTag: "starter", joinedSeasonId: "season-1" },
      { id: "r-3", teamId: "A-A", playerId: "p-3", contractLength: 2, salary: 4, upkeep: 4, purchasePrice: 20, currentValue: 20, roleTag: "starter", joinedSeasonId: "season-1" },
    ],
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
      teamCount: 0,
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

describe("auto roster fill service", () => {
  beforeEach(() => {
    persistenceState.save.gameState = buildGameState();
    evaluateAiNeeds.mockReset();
    listLocalTransfermarktFreeAgents.mockReset();
    listLocalTransferHistory.mockReset();
    previewLocalTransfermarktBuy.mockReset();
    executeLocalTransfermarktBuy.mockReset();

    evaluateAiNeeds.mockReturnValue({
      rosterGap: 1,
      topNeedDisciplineIds: ["d1", "d2"],
      uncoveredNeedAxes: ["pow", "spe"],
      overallNeedScore: 72,
    });

    listLocalTransfermarktFreeAgents.mockImplementation(({ teamId, limit }: { teamId: string; limit?: number }) => {
      const activePlayerIds = new Set(persistenceState.save.gameState.rosters.map((entry) => entry.playerId));
      const freeAgents = persistenceState.save.gameState.players
        .filter((player) => !activePlayerIds.has(player.id) && player.id.startsWith("fa-"))
        .map((player) => {
          const price = player.id === "fa-1" ? 30 : player.id === "fa-3" ? 22 : 25;
          const salary = player.id === "fa-1" ? 5 : 4;
          const isManualTeam = teamId === "M-M";
          return {
            playerId: player.id,
            name: player.name,
            className: player.className,
            race: player.race,
            alignment: player.alignment,
            gender: player.gender,
            subclasses: [],
            traitsPositive: [],
            traitsNegative: [],
            preferredDisciplineIds: [],
            subclass1: null,
            subclass2: null,
            subclass3: null,
            traitPos1: null,
            traitPos2: null,
            traitPos3: null,
            traitNeg1: null,
            traitNeg2: null,
            traitNeg3: null,
            marketValue: price,
            ovr: null,
            mvs: null,
            salary,
            marketValueSalaryRatio: player.id === "fa-1" ? 6 : player.id === "fa-3" ? 5.5 : 4.6,
            bracket: null,
            salaryStatus: "known",
            pow: player.coreStats.pow,
            spe: player.coreStats.spe,
            men: player.coreStats.men,
            soc: player.coreStats.soc,
            powTier: "C",
            speTier: "C",
            menTier: "C",
            socTier: "C",
            above20: 4,
            above40: 2,
            above60: 0,
            above80: 0,
            powerRating: null,
            healthRating: null,
            staminaRating: null,
            intelligenceRating: null,
            determinationRating: null,
            awarenessRating: null,
            speedRating: null,
            dexterityRating: null,
            charismaRating: null,
            willRating: null,
            spiritRating: null,
            tormentRating: null,
            topDisciplineScores: player.id === "fa-2"
              ? [{ disciplineId: "d2", disciplineName: "D2", scoreTier: "A", ppsLastSeason: null }]
              : [{ disciplineId: "d1", disciplineName: "D1", scoreTier: player.id === "fa-1" ? "A" : "B", ppsLastSeason: null }],
            portraitPath: null,
            portraitUrl: null,
            imageUrl: null,
            availabilityReason: "free_agent",
            teamContextAvailable: true,
            teamCash: isManualTeam ? 200 : 180,
            teamSalary: isManualTeam ? 5 : 8,
            rosterCount: isManualTeam ? 1 : 2,
            playerMin: 2,
            playerOpt: 3,
            readinessStatus: "ready",
            affordabilityStatus: "can_afford",
            rosterPressureStatus: "needs_players",
            fitRace: 2,
            fitSubclasses: 2,
            fitTraits: 1,
            fitAlignment: 1,
            mercenary: false,
            fit: player.id === "fa-2" ? (isManualTeam ? 1 : 6) : player.id === "fa-1" ? 5 : 3,
            fitDisplay: "fit",
            fitSource: "local_approximation_not_golden_master",
          };
        });

      return {
        total: freeAgents.length,
        items: typeof limit === "number" ? freeAgents.slice(0, limit) : freeAgents,
      };
    });

    listLocalTransferHistory.mockImplementation(({ teamId }: { teamId: string }) => ({
      items: persistenceState.save.gameState.transferHistory.filter(
        (entry) => entry.transferType === "buy" && entry.toTeamId === teamId,
      ).map((entry) => ({
        transferId: entry.id,
      })),
    }));

    previewLocalTransfermarktBuy.mockImplementation(({ teamId, playerId }: { teamId: string; playerId: string }) => ({
      canBuy: true,
      blockingReasons: [],
      warnings: [],
      contractLength: 1,
      purchasePrice: playerId === "fa-1" ? 30 : 25,
      salary: teamId === "M-M" ? 5 : 4,
      player: { id: playerId, name: playerId, className: "Hero", race: "Human" },
      team: { id: teamId, name: teamId, shortCode: teamId },
    }));

    executeLocalTransfermarktBuy.mockImplementation(({ teamId, playerId, transferSource }: { teamId: string; playerId: string; transferSource?: string }) => {
      const price = playerId === "fa-1" ? 30 : playerId === "fa-3" ? 22 : 25;
      const salary = playerId === "fa-1" ? 5 : 4;
      persistenceState.save.gameState = {
        ...persistenceState.save.gameState,
        teams: persistenceState.save.gameState.teams.map((team) =>
          team.teamId === teamId ? { ...team, cash: team.cash - price } : team,
        ),
        rosters: [
          ...persistenceState.save.gameState.rosters,
          {
            id: `roster-${playerId}`,
            teamId,
            playerId,
            contractLength: 1,
            salary,
            upkeep: salary,
            purchasePrice: price,
            currentValue: price,
            roleTag: "prospect",
            joinedSeasonId: "season-1",
          },
        ],
        transferHistory: [
          {
            id: `history-${playerId}`,
            playerId,
            seasonId: "season-1",
            matchdayId: "matchday-1",
            phase: "manual_transfer_window",
            source: transferSource ?? "auto_roster_fill",
            seasonLabel: "Season 1",
            transferType: "buy",
            fromTeamId: null,
            toTeamId: teamId,
            fee: price,
            salary,
            marketValue: price,
            remainingContractLength: 1,
            happenedAt: new Date().toISOString(),
          },
          ...persistenceState.save.gameState.transferHistory,
        ],
      };

      return {
        canBuy: true,
        blockingReasons: [],
        warnings: [],
        player: { id: playerId, name: playerId, className: "Hero", race: "Human" },
        team: { id: teamId, name: teamId, shortCode: teamId },
        contractLength: 1,
        purchasePrice: price,
        salary,
        currentValue: price,
        joinedSeasonId: "season-1",
        cashBefore: null,
        cashAfter: null,
        salaryBefore: null,
        salaryAfter: null,
        marketValueBefore: null,
        marketValueAfter: null,
        rosterBefore: null,
        rosterAfter: null,
        activePlayerCreated: true,
        transferCreated: true,
        teamSeasonStateUpdated: true,
        activePlayerId: `local-roster:${playerId}`,
        transferId: `history-${playerId}`,
      };
    });
  });

  it("plans setup buys for all teams in dry-run without writing", async () => {
    const { runAutoRosterFillForMatchdaySetup } = await import("@/lib/ai/auto-roster-fill-service");

    const result = await runAutoRosterFillForMatchdaySetup({
      source: "sqlite",
      saveId: "save-local",
      seasonId: "season-1",
      dryRun: true,
    });

    expect(result.dryRun).toBe(true);
    expect(result.summary.totalTeams).toBe(2);
    expect(result.summary.teamsNeedingBuys).toBe(2);
    expect(result.summary.plannedBuys).toBe(3);
    expect(result.teams.find((team) => team.teamId === "M-M")?.status).toBe("planned");
    expect(result.teams.find((team) => team.teamId === "M-M")?.controlMode).toBe("manual");
    expect(persistenceState.save.gameState.rosters).toHaveLength(3);
  });

  it("executes real local buys and returns transfer history ids in the same save", async () => {
    const { runAutoRosterFillForMatchdaySetup } = await import("@/lib/ai/auto-roster-fill-service");

    const result = await runAutoRosterFillForMatchdaySetup({
      source: "sqlite",
      saveId: "save-local",
      seasonId: "season-1",
      dryRun: false,
      confirmToken: "FILL_ALL_TEAMS_TO_TARGET",
    });

    expect(result.executed).toBe(true);
    expect(result.summary.appliedBuys).toBe(3);
    expect(result.summary.historyWrites).toBe(3);
    const manualTeam = result.teams.find((team) => team.teamId === "M-M");
    expect(manualTeam?.status).toBe("filled");
    expect(manualTeam?.transferHistoryIds).toEqual(["history-fa-1", "history-fa-3"]);
    expect(persistenceState.save.gameState.transferHistory[0]?.source).toBe("ai_roster_fill");
    expect(persistenceState.save.gameState.teams.find((team) => team.teamId === "M-M")?.cash).toBe(148);
  });
});
