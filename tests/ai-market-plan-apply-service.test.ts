import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { makeRosterEntry, makeTeam, makeTeamIdentity } from "./_fixtures/game-entity-fixtures";

const buildAiMarketPlanPreview = vi.fn();
const previewLocalTransfermarktSell = vi.fn();
const executeLocalTransfermarktSell = vi.fn();
const previewLocalTransfermarktBuy = vi.fn();
const executeLocalTransfermarktBuy = vi.fn();
const createLocalTransfermarktRunContext = vi.fn(() => ({
  get save() {
    return persistenceState.save;
  },
  set save(nextSave: typeof persistenceState.save) {
    persistenceState.save = nextSave;
  },
}));
const flushLocalTransfermarktRunContext = vi.fn();

// NB: this is annotated `: GameState` (not `satisfies GameState`) on purpose. `satisfies` checks
// compatibility but keeps the narrow *inferred* literal type — every empty array literal below
// (`teams: []`, `rosters: []`, ...) would then be typed `never[]`, and every test case below that
// later assigns a properly-typed array (e.g. `persistenceState.save.gameState.teams = [...]`)
// would fail to typecheck against that frozen `never[]`. The explicit annotation widens each field
// to its real GameState member type up front.
const baseGameState: GameState = {
  season: { id: "season-1", name: "Season 1", year: 2026, currentMatchday: 1, matchdayIds: ["matchday-1"] },
      seasonState: { seasonId: "season-1", schedule: [], standings: {}, teamControlSettings: {}, teamStrategyProfiles: {} },
      matchdayState: { matchdayId: "matchday-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
      teams: [],
      teamIdentities: [],
      players: [
        {
          id: "fa-1",
          name: "Free One",
          rating: 75,
          marketValue: 30,
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
          coreStats: { pow: 55, spe: 45, men: 38, soc: 40 },
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
          id: "p-1",
          name: "Old Guard",
          rating: 71,
          marketValue: 18,
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
          coreStats: { pow: 32, spe: 35, men: 60, soc: 41 },
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

const persistenceState = {
  save: {
    saveId: "save-local",
    gameState: baseGameState,
  },
  saveCalls: [] as Array<{ saveId: string; gameState: GameState }>,
};

vi.mock("@/lib/ai/ai-market-plan-preview-service", () => ({
  buildAiMarketPlanPreview,
}));

// Only the six functions below are meant to be test doubles (they perform local-save I/O the test
// wants to observe/control). Every other export of this module (e.g. pure cash/affordability
// helpers like resolveTransferBuyAffordabilityCash) is passed through via importOriginal so newly
// added exports don't crash this suite with "no export defined on the mock".
vi.mock("@/lib/market/transfermarkt-local-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/market/transfermarkt-local-service")>();
  return {
    ...actual,
    createLocalTransfermarktRunContext,
    previewLocalTransfermarktSell,
    executeLocalTransfermarktSell,
    previewLocalTransfermarktBuy,
    executeLocalTransfermarktBuy,
    flushLocalTransfermarktRunContext,
  };
});

vi.mock("@/lib/persistence/persistence-service", () => ({
  createPersistenceService: () => ({
    bootstrapSingleplayerSave: () => ({
      save: persistenceState.save,
      createdFromSeed: false,
    }),
    getActiveSave: () => persistenceState.save,
    getSaveById: (saveId: string) => (persistenceState.save.saveId === saveId ? persistenceState.save : null),
    saveSingleplayerState: (saveId: string, gameState: GameState) => {
      persistenceState.saveCalls.push({ saveId, gameState });
      persistenceState.save = {
        ...persistenceState.save,
        gameState,
      };
      return persistenceState.save;
    },
  }),
}));

describe("ai market plan apply service", () => {
  beforeEach(() => {
    buildAiMarketPlanPreview.mockReset();
    previewLocalTransfermarktSell.mockReset();
    executeLocalTransfermarktSell.mockReset();
    previewLocalTransfermarktBuy.mockReset();
    executeLocalTransfermarktBuy.mockReset();
    persistenceState.saveCalls = [];
    persistenceState.save = {
      ...persistenceState.save,
      gameState: {
        ...persistenceState.save.gameState,
        logs: [],
      },
    };
  });

  it("keeps dry-run write-free and skips manual/passive/disabled teams", async () => {
    persistenceState.save.gameState.teams = [
      makeTeam({ teamId: "A-I", name: "AI Team", shortCode: "A-I", cash: 120, rosterLimit: 4 }),
      makeTeam({ teamId: "M-A", name: "Manual Team", shortCode: "M-A", cash: 100, rosterLimit: 4 }),
      makeTeam({ teamId: "P-A", name: "Passive Team", shortCode: "P-A", cash: 80, rosterLimit: 4 }),
      makeTeam({ teamId: "D-I", name: "Disabled AI", shortCode: "D-I", cash: 70, rosterLimit: 4 }),
    ] as GameState["teams"];
    persistenceState.save.gameState.teamIdentities = [
      makeTeamIdentity({ teamId: "A-I", playerMin: 3, playerOpt: 4 }),
      makeTeamIdentity({ teamId: "D-I", playerMin: 3, playerOpt: 4 }),
    ] as GameState["teamIdentities"];
    persistenceState.save.gameState.rosters = [
      makeRosterEntry({ id: "r-A-I-p-1", teamId: "A-I", playerId: "p-1", salary: 4, currentValue: 18 }),
      makeRosterEntry({ id: "r-A-I-p-2", teamId: "A-I", playerId: "p-2", salary: 4, currentValue: 18 }),
    ] as GameState["rosters"];

    buildAiMarketPlanPreview.mockResolvedValue({
      readOnly: true,
      source: "sqlite",
      scope: { saveId: "save-local", seasonId: "season-1", teamId: null, teamScope: "all" },
      totalTeams: 4,
      aiTeams: 2,
      skippedManual: 1,
      skippedPassive: 1,
      skippedDisabled: 1,
      holdTeams: 0,
      buyOnlyTeams: 1,
      sellOnlyTeams: 0,
      sellThenBuyTeams: 0,
      warningTeams: 0,
      blockedTeams: 0,
      summary: {
        aiTeams: 2,
        ready: 1,
        hold: 0,
        buyOnly: 1,
        sellOnly: 0,
        sellThenBuy: 0,
        warning: 0,
        blocked: 0,
      },
      teams: [
        {
          teamId: "A-I",
          teamCode: "A-I",
          teamName: "AI Team",
          controlMode: "ai",
          aiTransferPreviewEnabled: true,
          aiSellPreviewEnabled: true,
          status: "buy_only",
          strategySummary: "AI team",
          currentState: { cash: 120, rosterCount: 2, playerMin: 3, playerOpt: 4, salaryTotal: 20, marketValueTotal: 60 },
          sellPlan: { candidates: [], totalExpectedSellValue: 0, salaryFreed: 0, expectedSellValue: 0, rosterAfterSell: 2, warnings: [] },
          buyPlan: {
            candidates: [{ playerId: "fa-1", playerName: "Free One", name: "Free One", className: "Mage", race: "Human", price: 30, marketValue: 30, salary: 5, contractLength: 1, cashAfter: 90, rosterAfter: 3, salaryAfter: 25, fitSummary: "", sportsSummary: "", budgetReason: [], warnings: [], overallRecommendationScore: 70, score: 70, reason: "fit", fitNotes: [], riskNotes: [], strategyNotes: [] }],
            plannedSpend: 30,
            plannedSalaryAdded: 5,
            rosterAfterBuy: 3,
            warnings: [],
          },
          projectedState: { cashAfterPlan: 90, rosterAfterPlan: 3, salaryAfterPlan: 25, marketValueAfterPlan: 90 },
          planSteps: [],
          reasons: [],
          warnings: [],
          blockingReasons: [],
        },
        {
          teamId: "M-A",
          teamCode: "M-A",
          teamName: "Manual Team",
          controlMode: "manual",
          aiTransferPreviewEnabled: true,
          aiSellPreviewEnabled: true,
          status: "warning",
          strategySummary: "",
          currentState: { cash: 100, rosterCount: 3, playerMin: 3, playerOpt: 4, salaryTotal: 10, marketValueTotal: 40 },
          sellPlan: { candidates: [], totalExpectedSellValue: 0, salaryFreed: 0, expectedSellValue: 0, rosterAfterSell: 3, warnings: [] },
          buyPlan: { candidates: [], plannedSpend: 0, plannedSalaryAdded: 0, rosterAfterBuy: 3, warnings: [] },
          projectedState: { cashAfterPlan: 100, rosterAfterPlan: 3, salaryAfterPlan: 10, marketValueAfterPlan: 40 },
          planSteps: [],
          reasons: [],
          warnings: [],
          blockingReasons: [],
        },
        {
          teamId: "P-A",
          teamCode: "P-A",
          teamName: "Passive Team",
          controlMode: "passive",
          aiTransferPreviewEnabled: true,
          aiSellPreviewEnabled: true,
          status: "warning",
          strategySummary: "",
          currentState: { cash: 80, rosterCount: 3, playerMin: 3, playerOpt: 4, salaryTotal: 8, marketValueTotal: 30 },
          sellPlan: { candidates: [], totalExpectedSellValue: 0, salaryFreed: 0, expectedSellValue: 0, rosterAfterSell: 3, warnings: [] },
          buyPlan: { candidates: [], plannedSpend: 0, plannedSalaryAdded: 0, rosterAfterBuy: 3, warnings: [] },
          projectedState: { cashAfterPlan: 80, rosterAfterPlan: 3, salaryAfterPlan: 8, marketValueAfterPlan: 30 },
          planSteps: [],
          reasons: [],
          warnings: [],
          blockingReasons: [],
        },
        {
          teamId: "D-I",
          teamCode: "D-I",
          teamName: "Disabled AI",
          controlMode: "ai",
          aiTransferPreviewEnabled: false,
          aiSellPreviewEnabled: true,
          status: "blocked",
          strategySummary: "",
          currentState: { cash: 70, rosterCount: 3, playerMin: 3, playerOpt: 4, salaryTotal: 9, marketValueTotal: 35 },
          sellPlan: { candidates: [], totalExpectedSellValue: 0, salaryFreed: 0, expectedSellValue: 0, rosterAfterSell: 3, warnings: [] },
          buyPlan: { candidates: [], plannedSpend: 0, plannedSalaryAdded: 0, rosterAfterBuy: 3, warnings: [] },
          projectedState: { cashAfterPlan: 70, rosterAfterPlan: 3, salaryAfterPlan: 9, marketValueAfterPlan: 35 },
          planSteps: [],
          reasons: [],
          warnings: [],
          blockingReasons: ["ai_transfer_preview_disabled"],
        },
      ],
    });

    const { applyAiMarketPlanLocally } = await import("@/lib/ai/ai-market-plan-apply-service");
    const result = await applyAiMarketPlanLocally({
      source: "sqlite",
      saveId: "save-local",
      seasonId: "season-1",
      dryRun: true,
    });

    expect(result.dryRun).toBe(true);
    expect(result.summary.eligibleAiTeams).toBe(1);
    expect(result.summary.skippedManual).toBe(1);
    expect(result.summary.skippedPassive).toBe(1);
    expect(result.summary.skippedDisabled).toBe(1);
    expect(result.summary.plannedBuys).toBe(1);
    expect(result.summary.plannedSells).toBe(0);
    expect(result.summary.projectedCash["A-I"]).toBe(90);
    expect(result.summary.projectedRoster["A-I"]).toBe(3);
    expect(result.results.find((entry) => entry.teamId === "A-I")?.result).toBe("planned");
    expect(buildAiMarketPlanPreview).toHaveBeenCalledWith(
      expect.objectContaining({
        buyLimit: 120,
        sellLimit: 6,
        buyNeedOnly: true,
        teamId: null,
      }),
    );
    expect(result.phaseAudit.map((entry) => entry.phaseId)).toEqual([
      "ai_market_preflight",
      "ai_sell_scan",
      "ai_renewal_scan",
      "ai_buy_need_scan",
      "ai_buy_candidate_scan",
      "ai_sell_apply",
      "ai_renewal_apply",
      "ai_buy_apply",
      "ai_market_summary",
    ]);
    expect(result.phaseAudit.find((entry) => entry.phaseId === "ai_buy_candidate_scan")?.scanLimit).toBe(120);
    expect(executeLocalTransfermarktSell).not.toHaveBeenCalled();
    expect(executeLocalTransfermarktBuy).not.toHaveBeenCalled();
    expect(persistenceState.saveCalls).toHaveLength(0);
  }, 15_000);

  it("fills AI buy plans up to playerOpt without overbuying the candidate window", async () => {
    persistenceState.save.gameState.teams = [
      makeTeam({ teamId: "C-C", name: "Cash Creators", shortCode: "C-C", cash: 160, rosterLimit: 12 }),
    ] as GameState["teams"];
    persistenceState.save.gameState.teamIdentities = [
      makeTeamIdentity({ teamId: "C-C", playerMin: 7, playerOpt: 12 }),
    ] as GameState["teamIdentities"];
    persistenceState.save.gameState.rosters = Array.from({ length: 10 }, (_, index) =>
      makeRosterEntry({
        id: `r-C-C-${index + 1}`,
        teamId: "C-C",
        playerId: `p-${index + 1}`,
        salary: 2,
        currentValue: 6,
      }),
    );

    const buildCandidate = (index: number) => ({
      playerId: `fa-${index}`,
      playerName: `Free ${index}`,
      name: `Free ${index}`,
      className: "Tactician",
      race: "Human",
      price: 10,
      marketValue: 10,
      salary: 2,
      contractLength: 1,
      cashAfter: 160 - index * 10,
      rosterAfter: 10 + index,
      salaryAfter: 20 + index * 2,
      fitSummary: "",
      sportsSummary: "",
      budgetReason: [],
      warnings: [],
      overallRecommendationScore: 70 - index,
      score: 70 - index,
      reason: "target gap",
      fitNotes: [],
      riskNotes: [],
      strategyNotes: [],
    });

    buildAiMarketPlanPreview.mockResolvedValue({
      readOnly: true,
      source: "sqlite",
      scope: { saveId: "save-local", seasonId: "season-2", teamId: null, teamScope: "all" },
      totalTeams: 1,
      aiTeams: 1,
      skippedManual: 0,
      skippedPassive: 0,
      skippedDisabled: 0,
      holdTeams: 0,
      buyOnlyTeams: 1,
      sellOnlyTeams: 0,
      sellThenBuyTeams: 0,
      warningTeams: 0,
      blockedTeams: 0,
      summary: { aiTeams: 1, ready: 1, hold: 0, buyOnly: 1, sellOnly: 0, sellThenBuy: 0, warning: 0, blocked: 0 },
      teams: [
        {
          teamId: "C-C",
          teamCode: "C-C",
          teamName: "Cash Creators",
          controlMode: "ai",
          aiTransferPreviewEnabled: true,
          aiSellPreviewEnabled: true,
          status: "buy_only",
          strategySummary: "Value width",
          currentState: { cash: 160, rosterCount: 10, playerMin: 7, playerOpt: 12, salaryTotal: 20, marketValueTotal: 60 },
          sellPlan: { candidates: [], totalExpectedSellValue: 0, salaryFreed: 0, expectedSellValue: 0, rosterAfterSell: 10, warnings: [] },
          buyPlan: {
            candidates: [buildCandidate(1), buildCandidate(2), buildCandidate(3)],
            plannedSpend: 30,
            plannedSalaryAdded: 6,
            rosterAfterBuy: 13,
            warnings: [],
          },
          projectedState: { cashAfterPlan: 130, rosterAfterPlan: 13, salaryAfterPlan: 26, marketValueAfterPlan: 90 },
          planSteps: [],
          reasons: [],
          warnings: [],
          blockingReasons: [],
        },
      ],
    });

    const { applyAiMarketPlanLocally } = await import("@/lib/ai/ai-market-plan-apply-service");
    const result = await applyAiMarketPlanLocally({
      source: "sqlite",
      saveId: "save-local",
      seasonId: "season-2",
      dryRun: true,
      options: {
        maxBuysPerTeam: null,
      },
    });

    expect(result.summary.plannedBuys).toBe(2);
    expect(result.summary.projectedRoster["C-C"]).toBe(12);
    expect(result.results[0]?.plannedBuyDetails.map((entry) => entry.playerId)).toEqual(["fa-1", "fa-2"]);
    expect(result.results[0]?.plannedBuyDetails.map((entry) => entry.playerId)).not.toContain("fa-3");
  });

  it("honors explicit Season 2+ candidate scan budgets", async () => {
    persistenceState.save.gameState.teams = [
      makeTeam({ teamId: "A-I", name: "AI Team", shortCode: "A-I", cash: 120, rosterLimit: 10 }),
    ] as GameState["teams"];
    persistenceState.save.gameState.teamIdentities = [
      makeTeamIdentity({ teamId: "A-I", playerMin: 7, playerOpt: 10 }),
    ] as GameState["teamIdentities"];
    persistenceState.save.gameState.rosters = Array.from({ length: 9 }, (_, index) =>
      makeRosterEntry({
        id: `r-A-I-${index + 1}`,
        teamId: "A-I",
        playerId: `p-${index + 1}`,
        salary: 2,
        currentValue: 6,
      }),
    );

    buildAiMarketPlanPreview.mockResolvedValue({
      readOnly: true,
      source: "sqlite",
      scope: { saveId: "save-local", seasonId: "season-2", teamId: null, teamScope: "all" },
      totalTeams: 1,
      aiTeams: 1,
      skippedManual: 0,
      skippedPassive: 0,
      skippedDisabled: 0,
      holdTeams: 1,
      buyOnlyTeams: 0,
      sellOnlyTeams: 0,
      sellThenBuyTeams: 0,
      warningTeams: 0,
      blockedTeams: 0,
      summary: {
        aiTeams: 1,
        ready: 0,
        hold: 1,
        buyOnly: 0,
        sellOnly: 0,
        sellThenBuy: 0,
        warning: 0,
        blocked: 0,
      },
      teams: [
        {
          teamId: "A-I",
          teamCode: "A-I",
          teamName: "AI Team",
          controlMode: "ai",
          aiTransferPreviewEnabled: true,
          aiSellPreviewEnabled: true,
          status: "hold",
          strategySummary: "AI team",
          currentState: { cash: 120, rosterCount: 10, playerMin: 7, playerOpt: 10, salaryTotal: 20, marketValueTotal: 60 },
          sellPlan: { candidates: [], totalExpectedSellValue: 0, salaryFreed: 0, expectedSellValue: 0, rosterAfterSell: 10, warnings: [] },
          buyPlan: { candidates: [], plannedSpend: 0, plannedSalaryAdded: 0, rosterAfterBuy: 10, warnings: [] },
          projectedState: { cashAfterPlan: 120, rosterAfterPlan: 10, salaryAfterPlan: 20, marketValueAfterPlan: 60 },
          planSteps: [],
          reasons: [],
          warnings: [],
          blockingReasons: [],
        },
      ],
    });

    const { applyAiMarketPlanLocally } = await import("@/lib/ai/ai-market-plan-apply-service");
    const result = await applyAiMarketPlanLocally({
      source: "sqlite",
      saveId: "save-local",
      seasonId: "season-2",
      dryRun: true,
      options: {
        previewBuyLimit: 48,
        previewSellLimit: 3,
        performanceBudgetMs: 5_000,
      },
    });

    expect(buildAiMarketPlanPreview).toHaveBeenCalledWith(
      expect.objectContaining({
        buyLimit: 48,
        sellLimit: 3,
        buyNeedOnly: true,
        teamId: "A-I",
      }),
    );
    expect(result.phaseAudit.find((entry) => entry.phaseId === "ai_buy_candidate_scan")?.scanLimit).toBe(48);
    expect(result.phaseAudit.find((entry) => entry.phaseId === "ai_sell_scan")?.scanLimit).toBe(3);
  });

  it("skips expensive market previews when no Season 2+ team has buy or sell need", async () => {
    persistenceState.save.gameState.season = { id: "season-2", name: "Season 2", year: 2027, currentMatchday: 1, matchdayIds: ["matchday-1"] };
    persistenceState.save.gameState.seasonState.seasonId = "season-2";
    persistenceState.save.gameState.teams = [
      makeTeam({ teamId: "A-I", name: "AI Team", shortCode: "A-I", cash: 40, rosterLimit: 10 }),
    ] as GameState["teams"];
    persistenceState.save.gameState.teamIdentities = [
      makeTeamIdentity({ teamId: "A-I", playerMin: 7, playerOpt: 10 }),
    ] as GameState["teamIdentities"];
    persistenceState.save.gameState.rosters = Array.from({ length: 10 }, (_, index) =>
      makeRosterEntry({
        id: `r-A-I-${index + 1}`,
        teamId: "A-I",
        playerId: `p-${index + 1}`,
        salary: 0.1,
        currentValue: 6,
        contractLength: 2,
      }),
    );
    // Unter der S2+-Single-Cash-Policy ist ein at-Opt-Team mit positivem Cash NICHT "nichts zu tun":
    // das Post-Opt-Upgrade-Mandat will den Überschuss legitim in Upgrades stecken (→ Buy-Need, erzwingt
    // den Preview-Scan). Der einzige wirklich idle Zustand, den die Engine kennt, ist ein Strategic-Hoard-
    // Team — seine Transfer-/Building-Budgets sind auf 0 reserviert, sodass isStrategicHoardTeam() das
    // Upgrade-Mandat unterdrückt. Genau dieser Fall soll den teuren Preview überspringen.
    (persistenceState.save.gameState.seasonState as GameState["seasonState"]).aiManagerBudgetReservations = {
      "A-I": {
        teamId: "A-I",
        seasonId: "season-2",
        sourcePlanId: "test-plan",
        cashReserve: 40,
        salaryReserve: 0,
        transferBudget: 0,
        buildingBudget: 0,
        maintenanceBudget: 0,
        emergencyBudget: 0,
        updatedAt: "2027-01-01T00:00:00.000Z",
      },
    };

    const { applyAiMarketPlanLocally } = await import("@/lib/ai/ai-market-plan-apply-service");
    const result = await applyAiMarketPlanLocally({
      source: "sqlite",
      saveId: "save-local",
      seasonId: "season-2",
      dryRun: true,
      options: {
        applySellSteps: false,
      },
    });

    expect(buildAiMarketPlanPreview).not.toHaveBeenCalled();
    expect(result.summary.totalTeams).toBe(1);
    expect(result.summary.holdTeams).toBe(1);
    expect(result.summary.plannedBuys).toBe(0);
    expect(result.summary.plannedSells).toBe(0);
    expect(result.phaseAudit.find((entry) => entry.phaseId === "ai_sell_scan")?.status).toBe("skipped");
    expect(result.phaseAudit.find((entry) => entry.phaseId === "ai_buy_candidate_scan")?.status).toBe("skipped");
  });

  it("resolves duplicate AI buy targets into unique local plans instead of blocking every team", async () => {
    buildAiMarketPlanPreview.mockResolvedValue({
      readOnly: true,
      source: "sqlite",
      scope: { saveId: "save-local", seasonId: "season-1", teamId: null, teamScope: "all" },
      totalTeams: 2,
      aiTeams: 2,
      skippedManual: 0,
      skippedPassive: 0,
      skippedDisabled: 0,
      holdTeams: 0,
      buyOnlyTeams: 2,
      sellOnlyTeams: 0,
      sellThenBuyTeams: 0,
      warningTeams: 0,
      blockedTeams: 0,
      summary: {
        aiTeams: 2,
        ready: 2,
        hold: 0,
        buyOnly: 2,
        sellOnly: 0,
        sellThenBuy: 0,
        warning: 0,
        blocked: 0,
      },
      teams: [
        {
          teamId: "A-I",
          teamCode: "A-I",
          teamName: "Alpha AI",
          controlMode: "ai",
          aiTransferPreviewEnabled: true,
          aiSellPreviewEnabled: true,
          status: "buy_only",
          strategySummary: "Alpha",
          currentState: { cash: 120, rosterCount: 2, playerMin: 4, playerOpt: 4, salaryTotal: 10, marketValueTotal: 40 },
          sellPlan: { candidates: [], totalExpectedSellValue: 0, salaryFreed: 0, expectedSellValue: 0, rosterAfterSell: 2, warnings: [] },
          buyPlan: {
            candidates: [
              { playerId: "fa-1", playerName: "Free One", name: "Free One", className: "Mage", race: "Human", price: 30, marketValue: 30, salary: 5, contractLength: 1, cashAfter: 90, rosterAfter: 3, salaryAfter: 15, fitSummary: "", sportsSummary: "", budgetReason: [], warnings: [], overallRecommendationScore: 91, score: 91, reason: "primary fit", fitNotes: [], riskNotes: [], strategyNotes: [] },
              { playerId: "fa-2", playerName: "Free Two", name: "Free Two", className: "Tank", race: "Human", price: 28, marketValue: 28, salary: 4, contractLength: 1, cashAfter: 92, rosterAfter: 3, salaryAfter: 14, fitSummary: "", sportsSummary: "", budgetReason: [], warnings: [], overallRecommendationScore: 84, score: 84, reason: "fallback fit", fitNotes: [], riskNotes: [], strategyNotes: [] },
            ],
            plannedSpend: 58,
            plannedSalaryAdded: 9,
            rosterAfterBuy: 4,
            warnings: [],
          },
          projectedState: { cashAfterPlan: 62, rosterAfterPlan: 4, salaryAfterPlan: 19, marketValueAfterPlan: 98 },
          planSteps: [],
          reasons: [],
          warnings: [],
          blockingReasons: [],
        },
        {
          teamId: "B-I",
          teamCode: "B-I",
          teamName: "Beta AI",
          controlMode: "ai",
          aiTransferPreviewEnabled: true,
          aiSellPreviewEnabled: true,
          status: "buy_only",
          strategySummary: "Beta",
          currentState: { cash: 110, rosterCount: 3, playerMin: 4, playerOpt: 4, salaryTotal: 11, marketValueTotal: 42 },
          sellPlan: { candidates: [], totalExpectedSellValue: 0, salaryFreed: 0, expectedSellValue: 0, rosterAfterSell: 3, warnings: [] },
          buyPlan: {
            candidates: [
              { playerId: "fa-1", playerName: "Free One", name: "Free One", className: "Mage", race: "Human", price: 30, marketValue: 30, salary: 5, contractLength: 1, cashAfter: 80, rosterAfter: 4, salaryAfter: 16, fitSummary: "", sportsSummary: "", budgetReason: [], warnings: [], overallRecommendationScore: 88, score: 88, reason: "shared target", fitNotes: [], riskNotes: [], strategyNotes: [] },
              { playerId: "fa-3", playerName: "Free Three", name: "Free Three", className: "Scout", race: "Human", price: 24, marketValue: 24, salary: 3, contractLength: 1, cashAfter: 86, rosterAfter: 4, salaryAfter: 14, fitSummary: "", sportsSummary: "", budgetReason: [], warnings: [], overallRecommendationScore: 80, score: 80, reason: "alternate target", fitNotes: [], riskNotes: [], strategyNotes: [] },
            ],
            plannedSpend: 54,
            plannedSalaryAdded: 8,
            rosterAfterBuy: 5,
            warnings: [],
          },
          projectedState: { cashAfterPlan: 56, rosterAfterPlan: 5, salaryAfterPlan: 19, marketValueAfterPlan: 96 },
          planSteps: [],
          reasons: [],
          warnings: [],
          blockingReasons: [],
        },
      ],
    });

    const { applyAiMarketPlanLocally } = await import("@/lib/ai/ai-market-plan-apply-service");
    const result = await applyAiMarketPlanLocally({
      source: "sqlite",
      saveId: "save-local",
      seasonId: "season-1",
      dryRun: true,
    });

    const alpha = result.results.find((entry) => entry.teamId === "A-I");
    const beta = result.results.find((entry) => entry.teamId === "B-I");

    expect(result.status).toBe("warning");
    expect(result.summary.plannedWrites).toBe(3);
    expect(result.summary.blockedTeams).toBe(0);
    expect(alpha?.result).toBe("planned");
    expect(beta?.result).toBe("planned");
    expect(alpha?.plannedBuyDetails.map((step) => step.playerId)).toEqual(["fa-1", "fa-2"]);
    expect(beta?.plannedBuyDetails.map((step) => step.playerId)).toEqual(["fa-3"]);
    expect(beta?.warnings.some((warning) => warning.includes("kollidierende AI-Kaufziele"))).toBe(true);
  });

  it("executes local sells before buys and writes a local audit log", async () => {
    persistenceState.save.gameState.season = { id: "season-2", name: "Season 2", year: 2027, currentMatchday: 1, matchdayIds: ["matchday-1"] };
    persistenceState.save.gameState.seasonState.seasonId = "season-2";
    persistenceState.save.gameState.teams = [
      makeTeam({ teamId: "A-I", name: "AI Team", shortCode: "A-I", cash: 90, rosterLimit: 6 }),
    ] as GameState["teams"];
    persistenceState.save.gameState.teamIdentities = [
      makeTeamIdentity({ teamId: "A-I", playerMin: 3, playerOpt: 4 }),
    ] as GameState["teamIdentities"];
    persistenceState.save.gameState.rosters = [
      makeRosterEntry({ id: "r-A-I-p-1", teamId: "A-I", playerId: "p-1", salary: 4, currentValue: 18, contractLength: 1 }),
      makeRosterEntry({ id: "r-A-I-p-2", teamId: "A-I", playerId: "p-2", salary: 4, currentValue: 18, contractLength: 1 }),
      makeRosterEntry({ id: "r-A-I-p-3", teamId: "A-I", playerId: "p-3", salary: 4, currentValue: 18, contractLength: 1 }),
      makeRosterEntry({ id: "r-A-I-p-4", teamId: "A-I", playerId: "p-4", salary: 4, currentValue: 18, contractLength: 1 }),
      makeRosterEntry({ id: "r-A-I-p-5", teamId: "A-I", playerId: "p-5", salary: 4, currentValue: 18, contractLength: 1 }),
    ] as GameState["rosters"];
    persistenceState.save.gameState.seasonState.teamControlSettings = {
      "A-I": {
        teamId: "A-I",
        controlMode: "ai",
        ownerId: "ai",
        ownerSlot: "ai",
        displayLabel: "AI Team",
        aiLineupPreviewEnabled: true,
        aiLineupApplyEnabled: true,
        aiLineupAutoApplyEnabled: false,
        aiTransferPreviewEnabled: true,
        aiTransferAutoApplyEnabled: true,
        aiSellPreviewEnabled: true,
        aiSellAutoApplyEnabled: true,
      },
    };

    buildAiMarketPlanPreview.mockResolvedValue({
      readOnly: true,
      source: "sqlite",
      scope: { saveId: "save-local", seasonId: "season-2", teamId: null, teamScope: "all" },
      totalTeams: 1,
      aiTeams: 1,
      skippedManual: 0,
      skippedPassive: 0,
      skippedDisabled: 0,
      holdTeams: 0,
      buyOnlyTeams: 0,
      sellOnlyTeams: 0,
      sellThenBuyTeams: 1,
      warningTeams: 0,
      blockedTeams: 0,
      summary: {
        aiTeams: 1,
        ready: 1,
        hold: 0,
        buyOnly: 0,
        sellOnly: 0,
        sellThenBuy: 1,
        warning: 0,
        blocked: 0,
      },
      teams: [
        {
          teamId: "A-I",
          teamCode: "A-I",
          teamName: "AI Team",
          controlMode: "ai",
          aiTransferPreviewEnabled: true,
          aiSellPreviewEnabled: true,
          status: "sell_then_buy",
          strategySummary: "AI team",
          currentState: { cash: 90, rosterCount: 4, playerMin: 3, playerOpt: 4, salaryTotal: 20, marketValueTotal: 60 },
          sellPlan: {
            candidates: [{ activePlayerId: "ap-1", playerId: "p-1", playerName: "Old Guard", className: "Mage", race: "Human", raceName: "Human", salary: 4, marketValue: 18, expectedSellValue: 18, contractLength: 1, rosterAfter: 3, salaryAfter: 16, cashAfter: 108, sportValueSummary: "", performanceSummary: "", strategyFitSummary: "", reasonToSell: [], reasonToKeep: [], reasonsToSell: ["sell"], reasonsToKeep: [], warnings: [], sellPriority: 80, sellPriorityScore: 80 }],
            totalExpectedSellValue: 18,
            salaryFreed: 4,
            expectedSellValue: 18,
            rosterAfterSell: 3,
            warnings: [],
          },
          buyPlan: {
            candidates: [{ playerId: "fa-1", playerName: "Free One", name: "Free One", className: "Knight", race: "Human", price: 20, marketValue: 20, salary: 5, contractLength: 1, cashAfter: 88, rosterAfter: 4, salaryAfter: 21, fitSummary: "", sportsSummary: "", budgetReason: [], warnings: [], overallRecommendationScore: 72, score: 72, reason: "buy", fitNotes: [], riskNotes: [], strategyNotes: [] }],
            plannedSpend: 20,
            plannedSalaryAdded: 5,
            rosterAfterBuy: 4,
            warnings: [],
          },
          projectedState: { cashAfterPlan: 88, rosterAfterPlan: 4, salaryAfterPlan: 21, marketValueAfterPlan: 62 },
          planSteps: [],
          reasons: [],
          warnings: [],
          blockingReasons: [],
        },
      ],
    });
    previewLocalTransfermarktSell.mockReturnValue({
      canSell: true,
      blockingReasons: [],
      salePrice: 18,
      player: { id: "p-1", name: "Old Guard", className: "Mage", race: "Human" },
      team: { id: "A-I", name: "AI Team", shortCode: "A-I" },
      activePlayer: { id: "ap-1", playerId: "p-1", status: "active", roleTag: "bench", contractLength: 1, salary: 4, purchasePrice: 15, currentValue: 18, joinedSeasonId: "season-1" },
      warnings: [],
      cashBefore: 90,
      cashAfter: 108,
      rosterBefore: 4,
      rosterAfter: 3,
      teamSalaryBefore: 20,
      teamSalaryAfter: 16,
      salaryReduction: 4,
      projectedReadinessAfterSell: "unknown",
    });
    executeLocalTransfermarktSell.mockReturnValue({
      canSell: true,
      blockingReasons: [],
      warnings: [],
      salePrice: 18,
      player: { id: "p-1", name: "Old Guard", className: "Mage", race: "Human" },
      team: { id: "A-I", name: "AI Team", shortCode: "A-I" },
      activePlayer: { id: "ap-1", playerId: "p-1", status: "active", roleTag: "bench", contractLength: 1, salary: 4, purchasePrice: 15, currentValue: 18, joinedSeasonId: "season-1" },
      cashBefore: 90,
      cashAfter: 108,
      rosterBefore: 4,
      rosterAfter: 3,
      teamSalaryBefore: 20,
      teamSalaryAfter: 16,
      salaryReduction: 4,
      projectedReadinessAfterSell: "unknown",
      activePlayerRemoved: true,
      transferCreated: true,
      teamSeasonStateUpdated: true,
      transferId: "sell-1",
    });
    previewLocalTransfermarktBuy.mockReturnValue({
      canBuy: true,
      blockingReasons: [],
      warnings: [],
      player: { id: "fa-1", name: "Free One", className: "Knight", race: "Human" },
      team: { id: "A-I", name: "AI Team", shortCode: "A-I" },
      cashBefore: 108,
      cashAfter: 88,
      salaryBefore: 16,
      salaryAfter: 21,
      marketValueBefore: 40,
      marketValueAfter: 60,
      rosterBefore: 3,
      rosterAfter: 4,
      purchasePrice: 20,
      salary: 5,
      contractLength: 1,
      currentValue: 20,
      joinedSeasonId: "season-1",
    });
    executeLocalTransfermarktBuy.mockReturnValue({
      canBuy: true,
      blockingReasons: [],
      warnings: [],
      player: { id: "fa-1", name: "Free One", className: "Knight", race: "Human" },
      team: { id: "A-I", name: "AI Team", shortCode: "A-I" },
      cashBefore: 108,
      cashAfter: 88,
      salaryBefore: 16,
      salaryAfter: 21,
      marketValueBefore: 40,
      marketValueAfter: 60,
      rosterBefore: 3,
      rosterAfter: 4,
      purchasePrice: 20,
      salary: 5,
      contractLength: 1,
      currentValue: 20,
      joinedSeasonId: "season-1",
      activePlayerCreated: true,
      transferCreated: true,
      teamSeasonStateUpdated: true,
      activePlayerId: "roster-1",
      transferId: "buy-1",
    });

    const { applyAiMarketPlanLocally } = await import("@/lib/ai/ai-market-plan-apply-service");
    const result = await applyAiMarketPlanLocally({
      source: "sqlite",
      saveId: "save-local",
      seasonId: "season-2",
      dryRun: false,
      transferPhase: "manual_transfer_window",
    });

    expect(result.executed).toBe(true);
    expect(result.summary.appliedSells).toBe(1);
    expect(result.summary.appliedBuys).toBe(1);
    expect(result.results[0]?.result).toBe("applied");
    expect(executeLocalTransfermarktSell).toHaveBeenCalledTimes(1);
    expect(executeLocalTransfermarktBuy).toHaveBeenCalledTimes(1);
    expect(persistenceState.saveCalls.length).toBeGreaterThan(0);
    expect(result.auditLogId).toContain("ai-market-apply__save-local__season-2__");
  });

  it("blocks dry-run plans whose final cash would not stay positive", async () => {
    persistenceState.save.gameState.season = { id: "season-2", name: "Season 2", year: 2027, currentMatchday: 1, matchdayIds: ["matchday-1"] };
    persistenceState.save.gameState.seasonState.seasonId = "season-2";
    persistenceState.save.gameState.teams = [
      makeTeam({ teamId: "D-E", name: "Debt Engines", shortCode: "D-E", cash: 10, rosterLimit: 4 }),
    ] as GameState["teams"];
    persistenceState.save.gameState.teamIdentities = [
      makeTeamIdentity({ teamId: "D-E", playerMin: 3, playerOpt: 3 }),
    ] as GameState["teamIdentities"];
    persistenceState.save.gameState.rosters = [
      makeRosterEntry({ id: "r-D-E-p-1", teamId: "D-E", playerId: "p-1", salary: 4, currentValue: 18 }),
      makeRosterEntry({ id: "r-D-E-p-2", teamId: "D-E", playerId: "p-2", salary: 4, currentValue: 18 }),
    ] as GameState["rosters"];
    persistenceState.save.gameState.seasonState.teamControlSettings = {
      "D-E": {
        teamId: "D-E",
        controlMode: "ai",
        ownerId: "ai",
        ownerSlot: "ai",
        displayLabel: "Debt Engines",
        aiLineupPreviewEnabled: true,
        aiLineupApplyEnabled: true,
        aiLineupAutoApplyEnabled: false,
        aiTransferPreviewEnabled: true,
        aiTransferAutoApplyEnabled: true,
        aiSellPreviewEnabled: true,
        aiSellAutoApplyEnabled: true,
      },
    };

    buildAiMarketPlanPreview.mockResolvedValue({
      readOnly: true,
      source: "sqlite",
      scope: { saveId: "save-local", seasonId: "season-2", teamId: null, teamScope: "all" },
      totalTeams: 1,
      aiTeams: 1,
      skippedManual: 0,
      skippedPassive: 0,
      skippedDisabled: 0,
      holdTeams: 0,
      buyOnlyTeams: 1,
      sellOnlyTeams: 0,
      sellThenBuyTeams: 0,
      warningTeams: 0,
      blockedTeams: 0,
      summary: { aiTeams: 1, ready: 1, hold: 0, buyOnly: 1, sellOnly: 0, sellThenBuy: 0, warning: 0, blocked: 0 },
      teams: [
        {
          teamId: "D-E",
          teamCode: "D-E",
          teamName: "Debt Engines",
          controlMode: "ai",
          aiTransferPreviewEnabled: true,
          aiSellPreviewEnabled: true,
          status: "buy_only",
          strategySummary: "Needs one body, but cannot afford this target.",
          currentState: { cash: 10, rosterCount: 2, playerMin: 3, playerOpt: 3, salaryTotal: 8, marketValueTotal: 36 },
          sellPlan: { candidates: [], totalExpectedSellValue: 0, salaryFreed: 0, expectedSellValue: 0, rosterAfterSell: 2, warnings: [] },
          buyPlan: {
            candidates: [{ playerId: "fa-1", playerName: "Free One", name: "Free One", className: "Knight", race: "Human", price: 15, marketValue: 15, salary: 3, contractLength: 1, cashAfter: -5, rosterAfter: 3, salaryAfter: 11, fitSummary: "", sportsSummary: "", budgetReason: [], warnings: [], overallRecommendationScore: 70, score: 70, reason: "need", fitNotes: [], riskNotes: [], strategyNotes: [] }],
            plannedSpend: 15,
            plannedSalaryAdded: 3,
            rosterAfterBuy: 3,
            warnings: [],
          },
          projectedState: { cashAfterPlan: -5, rosterAfterPlan: 3, salaryAfterPlan: 11, marketValueAfterPlan: 51 },
          planSteps: [],
          reasons: [],
          warnings: [],
          blockingReasons: [],
        },
      ],
    });

    const { applyAiMarketPlanLocally } = await import("@/lib/ai/ai-market-plan-apply-service");
    const result = await applyAiMarketPlanLocally({
      source: "sqlite",
      saveId: "save-local",
      seasonId: "season-2",
      dryRun: true,
    });

    expect(result.summary.plannedWrites).toBe(0);
    expect(result.results[0]?.result).toBe("hold");
    expect(result.results[0]?.plannedBuys).toBe(0);
    expect(executeLocalTransfermarktBuy).not.toHaveBeenCalled();
  });

  it("rolls back an executed team plan when the saved cash ends negative", async () => {
    persistenceState.save.gameState.teams = [
      makeTeam({ teamId: "A-I", name: "AI Team", shortCode: "A-I", cash: 20, rosterLimit: 4 }),
    ] as GameState["teams"];
    persistenceState.save.gameState.teamIdentities = [
      makeTeamIdentity({ teamId: "A-I", playerMin: 2, playerOpt: 3 }),
    ] as GameState["teamIdentities"];
    persistenceState.save.gameState.rosters = [
      makeRosterEntry({ id: "r-A-I-p-1", teamId: "A-I", playerId: "p-1", salary: 4, currentValue: 18 }),
      makeRosterEntry({ id: "r-A-I-p-2", teamId: "A-I", playerId: "p-2", salary: 4, currentValue: 18 }),
    ] as GameState["rosters"];

    buildAiMarketPlanPreview.mockResolvedValue({
      readOnly: true,
      source: "sqlite",
      scope: { saveId: "save-local", seasonId: "season-2", teamId: null, teamScope: "all" },
      totalTeams: 1,
      aiTeams: 1,
      skippedManual: 0,
      skippedPassive: 0,
      skippedDisabled: 0,
      holdTeams: 0,
      buyOnlyTeams: 1,
      sellOnlyTeams: 0,
      sellThenBuyTeams: 0,
      warningTeams: 0,
      blockedTeams: 0,
      summary: { aiTeams: 1, ready: 1, hold: 0, buyOnly: 1, sellOnly: 0, sellThenBuy: 0, warning: 0, blocked: 0 },
      teams: [
        {
          teamId: "A-I",
          teamCode: "A-I",
          teamName: "AI Team",
          controlMode: "ai",
          aiTransferPreviewEnabled: true,
          aiSellPreviewEnabled: true,
          status: "buy_only",
          strategySummary: "Need one target.",
          currentState: { cash: 20, rosterCount: 2, playerMin: 2, playerOpt: 3, salaryTotal: 8, marketValueTotal: 36 },
          sellPlan: { candidates: [], totalExpectedSellValue: 0, salaryFreed: 0, expectedSellValue: 0, rosterAfterSell: 2, warnings: [] },
          buyPlan: {
            candidates: [{ playerId: "fa-1", playerName: "Free One", name: "Free One", className: "Knight", race: "Human", price: 8, marketValue: 8, salary: 3, contractLength: 1, cashAfter: 12, rosterAfter: 3, salaryAfter: 11, fitSummary: "", sportsSummary: "", budgetReason: [], warnings: [], overallRecommendationScore: 70, score: 70, reason: "need", fitNotes: [], riskNotes: [], strategyNotes: [] }],
            plannedSpend: 8,
            plannedSalaryAdded: 3,
            rosterAfterBuy: 3,
            warnings: [],
          },
          projectedState: { cashAfterPlan: 12, rosterAfterPlan: 3, salaryAfterPlan: 11, marketValueAfterPlan: 44 },
          planSteps: [],
          reasons: [],
          warnings: [],
          blockingReasons: [],
        },
      ],
    });
    previewLocalTransfermarktBuy.mockReturnValue({
      canBuy: true,
      blockingReasons: [],
      warnings: [],
      cashBefore: 20,
      cashAfter: 12,
      salaryBefore: 8,
      salaryAfter: 11,
      rosterBefore: 2,
      rosterAfter: 3,
      purchasePrice: 8,
      salary: 3,
    });
    executeLocalTransfermarktBuy.mockImplementation(() => {
      persistenceState.save = {
        ...persistenceState.save,
        gameState: {
          ...persistenceState.save.gameState,
          teams: persistenceState.save.gameState.teams.map((team) =>
            team.teamId === "A-I" ? { ...team, cash: -2 } : team,
          ),
        },
      };
      return {
        canBuy: true,
        blockingReasons: [],
        warnings: [],
        purchasePrice: 8,
        transferCreated: true,
        activePlayerCreated: true,
        teamSeasonStateUpdated: true,
      };
    });

    const { applyAiMarketPlanLocally } = await import("@/lib/ai/ai-market-plan-apply-service");
    const result = await applyAiMarketPlanLocally({
      source: "sqlite",
      saveId: "save-local",
      seasonId: "season-2",
      dryRun: false,
      transferPhase: "manual_transfer_window",
    });

    expect(result.status).toBe("blocked");
    expect(result.results[0]?.result).toBe("blocked");
    expect(result.results[0]?.blockingReasons).toContain("post_market_cash_not_positive");
    expect(result.summary.appliedBuys).toBe(0);
    expect(result.auditLogId).toBeNull();
    expect(persistenceState.save.gameState.teams.find((team) => team.teamId === "A-I")?.cash).toBe(20);
  });

  it("blocks sell plans without a real expected sell value", async () => {
    buildAiMarketPlanPreview.mockResolvedValue({
      readOnly: true,
      source: "sqlite",
      scope: { saveId: "save-local", seasonId: "season-1", teamId: null, teamScope: "all" },
      totalTeams: 1,
      aiTeams: 1,
      skippedManual: 0,
      skippedPassive: 0,
      skippedDisabled: 0,
      holdTeams: 0,
      buyOnlyTeams: 0,
      sellOnlyTeams: 1,
      sellThenBuyTeams: 0,
      warningTeams: 1,
      blockedTeams: 0,
      summary: {
        aiTeams: 1,
        ready: 0,
        hold: 0,
        buyOnly: 0,
        sellOnly: 1,
        sellThenBuy: 0,
        warning: 1,
        blocked: 0,
      },
      teams: [
        {
          teamId: "A-I",
          teamCode: "A-I",
          teamName: "AI Team",
          controlMode: "ai",
          aiTransferPreviewEnabled: true,
          aiSellPreviewEnabled: true,
          status: "warning",
          strategySummary: "AI team",
          currentState: { cash: 90, rosterCount: 4, playerMin: 3, playerOpt: 4, salaryTotal: 20, marketValueTotal: 60 },
          sellPlan: {
            candidates: [{ activePlayerId: "ap-1", playerId: "p-1", playerName: "Old Guard", className: "Mage", race: "Human", raceName: "Human", salary: 4, marketValue: 18, expectedSellValue: null, contractLength: 1, rosterAfter: 3, salaryAfter: 16, cashAfter: null, sportValueSummary: "", performanceSummary: "", strategyFitSummary: "", reasonToSell: [], reasonToKeep: [], reasonsToSell: ["sell"], reasonsToKeep: [], warnings: ["missing"], sellPriority: 80, sellPriorityScore: 80 }],
            totalExpectedSellValue: null,
            salaryFreed: 4,
            expectedSellValue: null,
            rosterAfterSell: 3,
            warnings: ["missing"],
          },
          buyPlan: { candidates: [], plannedSpend: 0, plannedSalaryAdded: 0, rosterAfterBuy: 4, warnings: [] },
          projectedState: { cashAfterPlan: null, rosterAfterPlan: 3, salaryAfterPlan: 16, marketValueAfterPlan: null },
          planSteps: [],
          reasons: [],
          warnings: ["missing"],
          blockingReasons: [],
        },
      ],
    });

    const { applyAiMarketPlanLocally } = await import("@/lib/ai/ai-market-plan-apply-service");
    const result = await applyAiMarketPlanLocally({
      source: "sqlite",
      saveId: "save-local",
      seasonId: "season-1",
      dryRun: false,
      includeWarningTeams: true,
      transferPhase: "manual_transfer_window",
    });

    expect(result.results[0]?.result).toBe("blocked");
    expect(result.results[0]?.blockingReasons).toContain("sell_plan_missing_expected_value");
    expect(executeLocalTransfermarktSell).not.toHaveBeenCalled();
    expect(executeLocalTransfermarktBuy).not.toHaveBeenCalled();
  });

  it("allows aggressive sell-only plans below playerMin when buys are deferred", async () => {
    const sellCandidate = {
      activePlayerId: "ap-1",
      playerId: "p-1",
      playerName: "Old Guard",
      className: "Mage",
      race: "Human",
      raceName: "Human",
      salary: 4,
      marketValue: 18,
      expectedSellValue: 18,
      contractLength: 1,
      rosterAfter: 9,
      salaryAfter: 16,
      cashAfter: 108,
      sportValueSummary: "",
      performanceSummary: "",
      strategyFitSummary: "",
      reasonToSell: ["profit window"],
      reasonToKeep: [],
      reasonsToSell: ["profit window"],
      reasonsToKeep: [],
      warnings: [],
      sellPriority: 80,
      sellPriorityScore: 80,
    };

    buildAiMarketPlanPreview.mockResolvedValue({
      readOnly: true,
      source: "sqlite",
      scope: { saveId: "save-local", seasonId: "season-1", teamId: null, teamScope: "all" },
      totalTeams: 1,
      aiTeams: 1,
      skippedManual: 0,
      skippedPassive: 0,
      skippedDisabled: 0,
      holdTeams: 0,
      buyOnlyTeams: 0,
      sellOnlyTeams: 1,
      sellThenBuyTeams: 0,
      warningTeams: 0,
      blockedTeams: 0,
      summary: {
        aiTeams: 1,
        ready: 1,
        hold: 0,
        buyOnly: 0,
        sellOnly: 1,
        sellThenBuy: 0,
        warning: 0,
        blocked: 0,
      },
      teams: [
        {
          teamId: "A-I",
          teamCode: "A-I",
          teamName: "AI Team",
          controlMode: "ai",
          aiTransferPreviewEnabled: true,
          aiSellPreviewEnabled: true,
          status: "ready",
          strategySummary: "AI team",
          currentState: { cash: 90, rosterCount: 10, playerMin: 10, playerOpt: 12, salaryTotal: 20, marketValueTotal: 60 },
          sellPlan: {
            candidates: [sellCandidate, { ...sellCandidate, activePlayerId: "ap-2", playerId: "p-2", playerName: "Second" }],
            totalExpectedSellValue: 36,
            salaryFreed: 8,
            expectedSellValue: 36,
            rosterAfterSell: 8,
            warnings: [],
          },
          buyPlan: { candidates: [], plannedSpend: 0, plannedSalaryAdded: 0, rosterAfterBuy: 8, warnings: [] },
          projectedState: { cashAfterPlan: 126, rosterAfterPlan: 8, salaryAfterPlan: 12, marketValueAfterPlan: 42 },
          planSteps: [],
          reasons: [],
          warnings: [],
          blockingReasons: [],
        },
      ],
    });

    const { applyAiMarketPlanLocally } = await import("@/lib/ai/ai-market-plan-apply-service");
    const result = await applyAiMarketPlanLocally({
      source: "sqlite",
      saveId: "save-local",
      seasonId: "season-1",
      dryRun: true,
      includeWarningTeams: true,
      transferPhase: "manual_transfer_window",
      options: {
        applySellSteps: true,
        applyBuySteps: false,
      },
    });

    const teamResult = result.results.find((entry) => entry.teamId === "A-I");
    expect(teamResult?.plannedSells).toBe(2);
    expect(teamResult?.projectedRoster).toBe(8);
    expect(teamResult?.blockingReasons).not.toContain("roster_after_market_plan_below_player_min");
  });

  it("blocks buy plans that would finish below playerMin", async () => {
    buildAiMarketPlanPreview.mockResolvedValue({
      readOnly: true,
      source: "sqlite",
      scope: { saveId: "save-local", seasonId: "season-2", teamId: null, teamScope: "all" },
      totalTeams: 1,
      aiTeams: 1,
      skippedManual: 0,
      skippedPassive: 0,
      skippedDisabled: 0,
      holdTeams: 0,
      buyOnlyTeams: 1,
      sellOnlyTeams: 0,
      sellThenBuyTeams: 0,
      warningTeams: 0,
      blockedTeams: 1,
      summary: {
        aiTeams: 1,
        ready: 0,
        hold: 0,
        buyOnly: 1,
        sellOnly: 0,
        sellThenBuy: 0,
        warning: 0,
        blocked: 1,
      },
      teams: [
        {
          teamId: "A-I",
          teamCode: "A-I",
          teamName: "AI Team",
          controlMode: "ai",
          aiTransferPreviewEnabled: true,
          aiSellPreviewEnabled: true,
          status: "blocked",
          strategySummary: "AI team",
          currentState: { cash: 90, rosterCount: 8, playerMin: 10, playerOpt: 12, salaryTotal: 20, marketValueTotal: 60 },
          sellPlan: { candidates: [], totalExpectedSellValue: 0, salaryFreed: 0, expectedSellValue: 0, rosterAfterSell: 8, warnings: [] },
          buyPlan: {
            candidates: [{ playerId: "fa-1", playerName: "Free One", name: "Free One", className: "Knight", race: "Human", price: 20, marketValue: 20, salary: 5, contractLength: 1, cashAfter: 70, rosterAfter: 9, salaryAfter: 25, fitSummary: "", sportsSummary: "", budgetReason: [], warnings: [], overallRecommendationScore: 72, score: 72, reason: "buy", fitNotes: [], riskNotes: [], strategyNotes: [] }],
            plannedSpend: 20,
            plannedSalaryAdded: 5,
            rosterAfterBuy: 9,
            warnings: [],
          },
          projectedState: { cashAfterPlan: 70, rosterAfterPlan: 9, salaryAfterPlan: 25, marketValueAfterPlan: 80 },
          planSteps: [],
          reasons: [],
          warnings: [],
          blockingReasons: ["roster_after_market_plan_below_player_min"],
        },
      ],
    });

    const { applyAiMarketPlanLocally } = await import("@/lib/ai/ai-market-plan-apply-service");
    const result = await applyAiMarketPlanLocally({
      source: "sqlite",
      saveId: "save-local",
      seasonId: "season-2",
      dryRun: true,
      includeWarningTeams: true,
      transferPhase: "manual_transfer_window",
      options: { applySellSteps: true, applyBuySteps: true },
    });

    const teamResult = result.results.find((entry) => entry.teamId === "A-I");
    expect(teamResult?.blockingReasons).toContain("roster_after_market_plan_below_player_min");
  });

  it("holds planned buys that hit a hard no-go without blocking the whole market step", async () => {
    persistenceState.save = {
      ...persistenceState.save,
      gameState: {
        ...persistenceState.save.gameState,
        seasonState: {
          ...persistenceState.save.gameState.seasonState,
          teamStrategyProfiles: {
            "A-I": {
              teamId: "A-I",
              teamCode: "A-I",
              teamName: "AI Team",
              strategySummary: "Humans only.",
              buyStyle: "",
              sellStyle: "",
              contractStyle: "",
              rosterStyle: "",
              preferredArchetypes: [],
              avoidedArchetypes: [],
              preferredRaces: [],
              avoidedRaces: [],
              preferredClasses: [],
              avoidedClasses: [],
              hardNoGos: ["non-human core signing"],
              lockedNoGos: ["non-human core signing"],
              preferredTraits: [],
              dislikedTraits: [],
              bias: {
                cashPriority: 5,
                valuePriority: 5,
                starPriority: 5,
                riskTolerance: 5,
                wageSensitivity: 5,
                sellForProfitAggression: 5,
                shortContractPreference: 5,
                longContractPreference: 5,
                loyaltyBias: 5,
                harmonyStrictness: 5,
                rosterDepthPreference: 5,
                eliteSmallRosterPreference: 5,
              },
            },
          },
        },
        players: [
          ...persistenceState.save.gameState.players.filter((player) => player.id !== "fa-2"),
          {
            id: "fa-2",
            name: "Goblin Runner",
            rating: 66,
            marketValue: 22,
            salaryDemand: 4,
            pps: null,
            ovr: null,
            className: "Scout",
            race: "Goblin",
            alignment: "chaotic",
            gender: "n/a",
            subclasses: [],
            traitsPositive: [],
            traitsNegative: [],
            coreStats: { pow: 28, spe: 74, men: 39, soc: 30 },
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
      },
    };

    buildAiMarketPlanPreview.mockResolvedValue({
      readOnly: true,
      source: "sqlite",
      scope: { saveId: "save-local", seasonId: "season-1", teamId: null, teamScope: "all" },
      totalTeams: 1,
      aiTeams: 1,
      skippedManual: 0,
      skippedPassive: 0,
      skippedDisabled: 0,
      holdTeams: 0,
      buyOnlyTeams: 1,
      sellOnlyTeams: 0,
      sellThenBuyTeams: 0,
      warningTeams: 0,
      blockedTeams: 0,
      summary: {
        aiTeams: 1,
        ready: 1,
        hold: 0,
        buyOnly: 1,
        sellOnly: 0,
        sellThenBuy: 0,
        warning: 0,
        blocked: 0,
      },
      teams: [
        {
          teamId: "A-I",
          teamCode: "A-I",
          teamName: "AI Team",
          controlMode: "ai",
          aiTransferPreviewEnabled: true,
          aiSellPreviewEnabled: true,
          status: "buy_only",
          strategySummary: "AI team",
          currentState: { cash: 120, rosterCount: 2, playerMin: 3, playerOpt: 4, salaryTotal: 20, marketValueTotal: 60 },
          sellPlan: { candidates: [], totalExpectedSellValue: 0, salaryFreed: 0, expectedSellValue: 0, rosterAfterSell: 2, warnings: [] },
          buyPlan: {
            candidates: [{ playerId: "fa-2", playerName: "Goblin Runner", name: "Goblin Runner", className: "Scout", race: "Goblin", price: 22, marketValue: 22, salary: 4, contractLength: 1, cashAfter: 98, rosterAfter: 3, salaryAfter: 24, fitSummary: "", sportsSummary: "", budgetReason: [], warnings: [], overallRecommendationScore: 67, score: 67, reason: "fit", fitNotes: [], riskNotes: [], strategyNotes: [] }],
            plannedSpend: 22,
            plannedSalaryAdded: 4,
            rosterAfterBuy: 3,
            warnings: [],
          },
          projectedState: { cashAfterPlan: 98, rosterAfterPlan: 3, salaryAfterPlan: 24, marketValueAfterPlan: 82 },
          planSteps: [],
          reasons: [],
          warnings: [],
          blockingReasons: [],
        },
      ],
    });

    const { applyAiMarketPlanLocally } = await import("@/lib/ai/ai-market-plan-apply-service");
    const result = await applyAiMarketPlanLocally({
      source: "sqlite",
      saveId: "save-local",
      seasonId: "season-1",
      dryRun: false,
      transferPhase: "manual_transfer_window",
    });

    expect(result.status).toBe("warning");
    expect(result.results[0]?.result).toBe("hold");
    expect(result.results[0]?.warnings).toContain("buy_candidate_hard_no_go:fa-2");
    expect(result.results[0]?.blockingReasons).not.toContain("buy_candidate_hard_no_go:fa-2");
    expect(executeLocalTransfermarktSell).not.toHaveBeenCalled();
    expect(executeLocalTransfermarktBuy).not.toHaveBeenCalled();
  });

  it("skips hard no-go candidates and keeps the next legal buy target in the local plan", async () => {
    persistenceState.save = {
      ...persistenceState.save,
      gameState: {
        ...persistenceState.save.gameState,
        seasonState: {
          ...persistenceState.save.gameState.seasonState,
          teamStrategyProfiles: {
            "A-I": {
              teamId: "A-I",
              teamCode: "A-I",
              teamName: "AI Team",
              strategySummary: "Humans only.",
              buyStyle: "",
              sellStyle: "",
              contractStyle: "",
              rosterStyle: "",
              preferredArchetypes: [],
              avoidedArchetypes: [],
              preferredRaces: [],
              avoidedRaces: [],
              preferredClasses: [],
              avoidedClasses: [],
              hardNoGos: ["non-human core signing"],
              lockedNoGos: ["non-human core signing"],
              preferredTraits: [],
              dislikedTraits: [],
              bias: {
                cashPriority: 5,
                valuePriority: 5,
                starPriority: 5,
                riskTolerance: 5,
                wageSensitivity: 5,
                sellForProfitAggression: 5,
                shortContractPreference: 5,
                longContractPreference: 5,
                loyaltyBias: 5,
                harmonyStrictness: 5,
                rosterDepthPreference: 5,
                eliteSmallRosterPreference: 5,
              },
            },
          },
        },
        players: [
          ...persistenceState.save.gameState.players.filter((player) => !["fa-2", "fa-3"].includes(player.id)),
          {
            id: "fa-2",
            name: "Goblin Runner",
            rating: 66,
            marketValue: 22,
            salaryDemand: 4,
            pps: null,
            ovr: null,
            className: "Scout",
            race: "Goblin",
            alignment: "chaotic",
            gender: "n/a",
            subclasses: [],
            traitsPositive: [],
            traitsNegative: [],
            coreStats: { pow: 28, spe: 74, men: 39, soc: 30 },
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
            name: "Human Guard",
            rating: 68,
            marketValue: 21,
            salaryDemand: 4,
            pps: null,
            ovr: null,
            className: "Guard",
            race: "Human",
            alignment: "lawful",
            gender: "n/a",
            subclasses: [],
            traitsPositive: [],
            traitsNegative: [],
            coreStats: { pow: 52, spe: 49, men: 41, soc: 35 },
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
      },
    };

    buildAiMarketPlanPreview.mockResolvedValue({
      readOnly: true,
      source: "sqlite",
      scope: { saveId: "save-local", seasonId: "season-1", teamId: null, teamScope: "all" },
      totalTeams: 1,
      aiTeams: 1,
      skippedManual: 0,
      skippedPassive: 0,
      skippedDisabled: 0,
      holdTeams: 0,
      buyOnlyTeams: 1,
      sellOnlyTeams: 0,
      sellThenBuyTeams: 0,
      warningTeams: 0,
      blockedTeams: 0,
      summary: {
        aiTeams: 1,
        ready: 1,
        hold: 0,
        buyOnly: 1,
        sellOnly: 0,
        sellThenBuy: 0,
        warning: 0,
        blocked: 0,
      },
      teams: [
        {
          teamId: "A-I",
          teamCode: "A-I",
          teamName: "AI Team",
          controlMode: "ai",
          aiTransferPreviewEnabled: true,
          aiSellPreviewEnabled: true,
          status: "buy_only",
          strategySummary: "AI team",
          currentState: { cash: 120, rosterCount: 2, playerMin: 3, playerOpt: 4, salaryTotal: 20, marketValueTotal: 60 },
          sellPlan: { candidates: [], totalExpectedSellValue: 0, salaryFreed: 0, expectedSellValue: 0, rosterAfterSell: 2, warnings: [] },
          buyPlan: {
            candidates: [
              { playerId: "fa-2", playerName: "Goblin Runner", name: "Goblin Runner", className: "Scout", race: "Goblin", price: 22, marketValue: 22, salary: 4, contractLength: 1, cashAfter: 98, rosterAfter: 3, salaryAfter: 24, fitSummary: "", sportsSummary: "", budgetReason: [], warnings: [], overallRecommendationScore: 67, score: 67, reason: "fit", fitNotes: [], riskNotes: [], strategyNotes: [] },
              { playerId: "fa-3", playerName: "Human Guard", name: "Human Guard", className: "Guard", race: "Human", price: 21, marketValue: 21, salary: 4, contractLength: 1, cashAfter: 99, rosterAfter: 3, salaryAfter: 24, fitSummary: "", sportsSummary: "", budgetReason: [], warnings: [], overallRecommendationScore: 63, score: 63, reason: "fit", fitNotes: [], riskNotes: [], strategyNotes: [] },
            ],
            plannedSpend: 43,
            plannedSalaryAdded: 8,
            rosterAfterBuy: 4,
            warnings: [],
          },
          projectedState: { cashAfterPlan: 77, rosterAfterPlan: 4, salaryAfterPlan: 28, marketValueAfterPlan: 103 },
          planSteps: [],
          reasons: [],
          warnings: [],
          blockingReasons: [],
        },
      ],
    });

    previewLocalTransfermarktBuy.mockReturnValue({
      canBuy: true,
      blockingReasons: [],
      warnings: [],
      cashBefore: 120,
      cashAfter: 99,
      salaryBefore: 20,
      salaryAfter: 24,
      rosterBefore: 2,
      rosterAfter: 3,
      purchasePrice: 21,
      salary: 4,
    });
    executeLocalTransfermarktBuy.mockReturnValue({
      canBuy: true,
      blockingReasons: [],
      warnings: [],
      purchasePrice: 21,
      transferCreated: true,
      activePlayerCreated: true,
      teamSeasonStateUpdated: true,
    });

    const { applyAiMarketPlanLocally } = await import("@/lib/ai/ai-market-plan-apply-service");
    const result = await applyAiMarketPlanLocally({
      source: "sqlite",
      saveId: "save-local",
      seasonId: "season-1",
      dryRun: true,
    });

    expect(result.results[0]?.result).toBe("planned");
    expect(result.results[0]?.plannedBuyDetails.map((step) => step.playerId)).toEqual(["fa-3"]);
    expect(result.results[0]?.blockingReasons).not.toContain("buy_candidate_hard_no_go:fa-2");
  });

  it("rejects execute runs without an explicit transfer window phase", async () => {
    buildAiMarketPlanPreview.mockResolvedValue({
      readOnly: true,
      source: "sqlite",
      scope: { saveId: "save-local", seasonId: "season-1", teamId: null, teamScope: "all" },
      totalTeams: 0,
      aiTeams: 0,
      skippedManual: 0,
      skippedPassive: 0,
      skippedDisabled: 0,
      holdTeams: 0,
      buyOnlyTeams: 0,
      sellOnlyTeams: 0,
      sellThenBuyTeams: 0,
      warningTeams: 0,
      blockedTeams: 0,
      summary: {
        aiTeams: 0,
        ready: 0,
        hold: 0,
        buyOnly: 0,
        sellOnly: 0,
        sellThenBuy: 0,
        warning: 0,
        blocked: 0,
      },
      teams: [],
    });

    const { applyAiMarketPlanLocally } = await import("@/lib/ai/ai-market-plan-apply-service");

    await expect(
      applyAiMarketPlanLocally({
        source: "sqlite",
        saveId: "save-local",
        seasonId: "season-1",
        dryRun: false,
      }),
    ).rejects.toThrow("explicit local transfer window phase");

    expect(executeLocalTransfermarktSell).not.toHaveBeenCalled();
    expect(executeLocalTransfermarktBuy).not.toHaveBeenCalled();
  });

  it("rolls back the full run on team failure when stopOnTeamFailure stays enabled", async () => {
    persistenceState.save = {
      ...persistenceState.save,
      gameState: {
        ...persistenceState.save.gameState,
        teams: [
          makeTeam({ teamId: "A-I", name: "Alpha AI", shortCode: "A-I", cash: 90, rosterLimit: 4 }),
          makeTeam({ teamId: "B-I", name: "Beta AI", shortCode: "B-I", cash: 95, rosterLimit: 4 }),
        ] as GameState["teams"],
        teamIdentities: [
          makeTeamIdentity({ teamId: "A-I", playerMin: 3, playerOpt: 4 }),
          makeTeamIdentity({ teamId: "B-I", playerMin: 3, playerOpt: 4 }),
        ] as GameState["teamIdentities"],
        rosters: [
          makeRosterEntry({ id: "r-A-I-p-1", teamId: "A-I", playerId: "p-1", salary: 4, currentValue: 18 }),
          makeRosterEntry({ id: "r-A-I-p-a2", teamId: "A-I", playerId: "p-a2", salary: 4, currentValue: 18 }),
          makeRosterEntry({ id: "r-A-I-p-a3", teamId: "A-I", playerId: "p-a3", salary: 4, currentValue: 18 }),
          makeRosterEntry({ id: "r-A-I-p-a4", teamId: "A-I", playerId: "p-a4", salary: 4, currentValue: 18 }),
          makeRosterEntry({ id: "r-B-I-p-2", teamId: "B-I", playerId: "p-2", salary: 5, currentValue: 16 }),
          makeRosterEntry({ id: "r-B-I-p-b2", teamId: "B-I", playerId: "p-b2", salary: 5, currentValue: 16 }),
          makeRosterEntry({ id: "r-B-I-p-b3", teamId: "B-I", playerId: "p-b3", salary: 5, currentValue: 16 }),
          makeRosterEntry({ id: "r-B-I-p-b4", teamId: "B-I", playerId: "p-b4", salary: 5, currentValue: 16 }),
        ] as GameState["rosters"],
        seasonState: {
          ...persistenceState.save.gameState.seasonState,
          teamStrategyProfiles: {},
        },
        players: [
          ...persistenceState.save.gameState.players.filter((player) => player.id !== "fa-2"),
          {
            id: "fa-2",
            name: "Second Free",
            rating: 69,
            marketValue: 21,
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
            coreStats: { pow: 40, spe: 62, men: 42, soc: 33 },
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
      },
    };

    buildAiMarketPlanPreview.mockResolvedValue({
      readOnly: true,
      source: "sqlite",
      scope: { saveId: "save-local", seasonId: "season-1", teamId: null, teamScope: "all" },
      totalTeams: 2,
      aiTeams: 2,
      skippedManual: 0,
      skippedPassive: 0,
      skippedDisabled: 0,
      holdTeams: 0,
      buyOnlyTeams: 0,
      sellOnlyTeams: 0,
      sellThenBuyTeams: 2,
      warningTeams: 0,
      blockedTeams: 0,
      summary: {
        aiTeams: 2,
        ready: 2,
        hold: 0,
        buyOnly: 0,
        sellOnly: 0,
        sellThenBuy: 2,
        warning: 0,
        blocked: 0,
      },
      teams: [
        {
          teamId: "A-I",
          teamCode: "A-I",
          teamName: "Alpha AI",
          controlMode: "ai",
          aiTransferPreviewEnabled: true,
          aiSellPreviewEnabled: true,
          status: "sell_then_buy",
          strategySummary: "Alpha",
          currentState: { cash: 90, rosterCount: 4, playerMin: 3, playerOpt: 4, salaryTotal: 20, marketValueTotal: 60 },
          sellPlan: {
            candidates: [{ activePlayerId: "ap-1", playerId: "p-1", playerName: "Old Guard", className: "Mage", race: "Human", raceName: "Human", salary: 4, marketValue: 18, expectedSellValue: 18, contractLength: 1, rosterAfter: 3, salaryAfter: 16, cashAfter: 108, sportValueSummary: "", performanceSummary: "", strategyFitSummary: "", reasonToSell: ["sell"], reasonToKeep: [], reasonsToSell: ["sell"], reasonsToKeep: [], warnings: [], sellPriority: 80, sellPriorityScore: 80 }],
            totalExpectedSellValue: 18,
            salaryFreed: 4,
            expectedSellValue: 18,
            rosterAfterSell: 3,
            warnings: [],
          },
          buyPlan: {
            candidates: [{ playerId: "fa-1", playerName: "Free One", name: "Free One", className: "Knight", race: "Human", price: 20, marketValue: 20, salary: 5, contractLength: 1, cashAfter: 88, rosterAfter: 4, salaryAfter: 21, fitSummary: "", sportsSummary: "", budgetReason: [], warnings: [], overallRecommendationScore: 72, score: 72, reason: "buy", fitNotes: [], riskNotes: [], strategyNotes: [] }],
            plannedSpend: 20,
            plannedSalaryAdded: 5,
            rosterAfterBuy: 4,
            warnings: [],
          },
          projectedState: { cashAfterPlan: 88, rosterAfterPlan: 4, salaryAfterPlan: 21, marketValueAfterPlan: 62 },
          planSteps: [],
          reasons: [],
          warnings: [],
          blockingReasons: [],
        },
        {
          teamId: "B-I",
          teamCode: "B-I",
          teamName: "Beta AI",
          controlMode: "ai",
          aiTransferPreviewEnabled: true,
          aiSellPreviewEnabled: true,
          status: "sell_then_buy",
          strategySummary: "Beta",
          currentState: { cash: 95, rosterCount: 4, playerMin: 3, playerOpt: 4, salaryTotal: 22, marketValueTotal: 64 },
          sellPlan: {
            candidates: [{ activePlayerId: "ap-2", playerId: "p-2", playerName: "Bad Exit", className: "Scout", race: "Human", raceName: "Human", salary: 5, marketValue: 16, expectedSellValue: 16, contractLength: 1, rosterAfter: 3, salaryAfter: 17, cashAfter: 111, sportValueSummary: "", performanceSummary: "", strategyFitSummary: "", reasonToSell: ["sell"], reasonToKeep: [], reasonsToSell: ["sell"], reasonsToKeep: [], warnings: [], sellPriority: 75, sellPriorityScore: 75 }],
            totalExpectedSellValue: 16,
            salaryFreed: 5,
            expectedSellValue: 16,
            rosterAfterSell: 3,
            warnings: [],
          },
          buyPlan: {
            candidates: [{ playerId: "fa-2", playerName: "Second Free", name: "Second Free", className: "Scout", race: "Human", price: 21, marketValue: 21, salary: 4, contractLength: 1, cashAfter: 90, rosterAfter: 4, salaryAfter: 21, fitSummary: "", sportsSummary: "", budgetReason: [], warnings: [], overallRecommendationScore: 70, score: 70, reason: "buy", fitNotes: [], riskNotes: [], strategyNotes: [] }],
            plannedSpend: 21,
            plannedSalaryAdded: 4,
            rosterAfterBuy: 4,
            warnings: [],
          },
          projectedState: { cashAfterPlan: 90, rosterAfterPlan: 4, salaryAfterPlan: 21, marketValueAfterPlan: 69 },
          planSteps: [],
          reasons: [],
          warnings: [],
          blockingReasons: [],
        },
      ],
    });

    previewLocalTransfermarktSell
      .mockReturnValueOnce({
        canSell: true,
        blockingReasons: [],
        salePrice: 18,
        player: { id: "p-1", name: "Old Guard", className: "Mage", race: "Human" },
        team: { id: "A-I", name: "Alpha AI", shortCode: "A-I" },
        activePlayer: { id: "ap-1", playerId: "p-1", status: "active", roleTag: "bench", contractLength: 1, salary: 4, purchasePrice: 15, currentValue: 18, joinedSeasonId: "season-1" },
        warnings: [],
        cashBefore: 90,
        cashAfter: 108,
        rosterBefore: 4,
        rosterAfter: 3,
        teamSalaryBefore: 20,
        teamSalaryAfter: 16,
        salaryReduction: 4,
        projectedReadinessAfterSell: "unknown",
      })
      .mockReturnValueOnce({
        canSell: false,
        blockingReasons: ["sell_preview_blocked"],
        salePrice: null,
        player: { id: "p-2", name: "Bad Exit", className: "Scout", race: "Human" },
        team: { id: "B-I", name: "Beta AI", shortCode: "B-I" },
        activePlayer: { id: "ap-2", playerId: "p-2", status: "active", roleTag: "bench", contractLength: 1, salary: 5, purchasePrice: 14, currentValue: 16, joinedSeasonId: "season-1" },
        warnings: [],
        cashBefore: 95,
        cashAfter: 95,
        rosterBefore: 4,
        rosterAfter: 4,
        teamSalaryBefore: 22,
        teamSalaryAfter: 22,
        salaryReduction: 5,
        projectedReadinessAfterSell: "unknown",
      });

    executeLocalTransfermarktSell.mockReturnValue({
      canSell: true,
      blockingReasons: [],
      warnings: [],
      salePrice: 18,
      player: { id: "p-1", name: "Old Guard", className: "Mage", race: "Human" },
      team: { id: "A-I", name: "Alpha AI", shortCode: "A-I" },
      activePlayer: { id: "ap-1", playerId: "p-1", status: "active", roleTag: "bench", contractLength: 1, salary: 4, purchasePrice: 15, currentValue: 18, joinedSeasonId: "season-1" },
      cashBefore: 90,
      cashAfter: 108,
      rosterBefore: 4,
      rosterAfter: 3,
      teamSalaryBefore: 20,
      teamSalaryAfter: 16,
      salaryReduction: 4,
      projectedReadinessAfterSell: "unknown",
      activePlayerRemoved: true,
      transferCreated: true,
      teamSeasonStateUpdated: true,
      transferId: "sell-1",
    });

    previewLocalTransfermarktBuy.mockReturnValue({
      canBuy: true,
      blockingReasons: [],
      warnings: [],
      player: { id: "fa-1", name: "Free One", className: "Knight", race: "Human" },
      team: { id: "A-I", name: "Alpha AI", shortCode: "A-I" },
      cashBefore: 108,
      cashAfter: 88,
      salaryBefore: 16,
      salaryAfter: 21,
      marketValueBefore: 40,
      marketValueAfter: 60,
      rosterBefore: 3,
      rosterAfter: 4,
      purchasePrice: 20,
      salary: 5,
      contractLength: 1,
      currentValue: 20,
      joinedSeasonId: "season-1",
    });

    executeLocalTransfermarktBuy.mockReturnValue({
      canBuy: true,
      blockingReasons: [],
      warnings: [],
      player: { id: "fa-1", name: "Free One", className: "Knight", race: "Human" },
      team: { id: "A-I", name: "Alpha AI", shortCode: "A-I" },
      cashBefore: 108,
      cashAfter: 88,
      salaryBefore: 16,
      salaryAfter: 21,
      marketValueBefore: 40,
      marketValueAfter: 60,
      rosterBefore: 3,
      rosterAfter: 4,
      purchasePrice: 20,
      salary: 5,
      contractLength: 1,
      currentValue: 20,
      joinedSeasonId: "season-1",
      activePlayerCreated: true,
      transferCreated: true,
      teamSeasonStateUpdated: true,
      activePlayerId: "roster-1",
      transferId: "buy-1",
    });

    const { applyAiMarketPlanLocally } = await import("@/lib/ai/ai-market-plan-apply-service");
    const result = await applyAiMarketPlanLocally({
      source: "sqlite",
      saveId: "save-local",
      seasonId: "season-1",
      dryRun: false,
      transferPhase: "manual_transfer_window",
    });

    expect(result.status).toBe("blocked");
    expect(result.summary.appliedSells).toBe(0);
    expect(result.summary.appliedBuys).toBe(0);
    expect(result.auditLogId).toBeNull();
    expect(result.appliedAudits).toHaveLength(0);
    expect(result.results.find((entry) => entry.teamId === "A-I")?.blockingReasons).toContain("execution_rolled_back_after_team_failure");
    expect(result.results.find((entry) => entry.teamId === "B-I")?.result).toBe("failed_sell");
  });
});
