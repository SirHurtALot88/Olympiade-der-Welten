import { beforeEach, describe, expect, it, vi , afterEach} from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";

const buildAiNeedsPicksCompare = vi.fn();
const previewLocalTransfermarktBuy = vi.fn();
const executeLocalTransfermarktBuy = vi.fn();
const listLocalTransferHistory = vi.fn();
const listLocalTransfermarktFreeAgents = vi.fn();

const persistenceState = {
  save: {
    saveId: "save-ai-run",
    name: "AI Run Test Save",
    status: "active",
    gameState: {} as GameState,
  },
};

vi.mock("@/lib/ai/ai-needs-picks-compare-service", () => ({
  buildAiNeedsPicksCompare,
  // Mirror real module exports the service imports (mock drift caused "No <name> export" errors).
  DRAFT_MAX_STEPS_CAP: 20,
  isSeason1SpendDownRequired: () => false,
  resolveExpectedAiPickCostBandFromLane: (lane: string | null | undefined) => {
    const normalized = String(lane ?? "").trim().toLowerCase();
    if (["cheap_fill", "expensive_minimum_fill", "budget_risk_pick"].includes(normalized)) return "cheap_fill";
    if (["backup", "reserve"].includes(normalized)) return "backup";
    if (["depth", "depth_value"].includes(normalized)) return "depth";
    if (["core", "core_investment", "specialist", "specialist_investment"].includes(normalized)) return "core";
    if (["star", "star_pick"].includes(normalized)) return "star";
    if (["superstar", "superstar_pick"].includes(normalized)) return "superstar";
    return null;
  },
  normalizeAiNeedsPickLaneFamily: (lane: string | null | undefined) => {
    const normalized = String(lane ?? "").trim().toLowerCase();
    if (["cheap_fill", "expensive_minimum_fill", "budget_risk_pick"].includes(normalized)) return "cheap_fill";
    if (["backup", "reserve"].includes(normalized)) return "backup";
    if (["depth", "depth_value"].includes(normalized)) return "depth";
    if (["core", "core_investment", "specialist", "specialist_investment"].includes(normalized)) return "core";
    if (["star", "star_pick"].includes(normalized)) return "star";
    if (["superstar", "superstar_pick"].includes(normalized)) return "superstar";
    return null;
  },
}));

vi.mock("@/lib/market/transfermarkt-local-service", () => ({
  resolveTransferBuyAffordabilityCash: (input: { teamCash: number }) => input.teamCash,
  previewLocalTransfermarktBuy,
  executeLocalTransfermarktBuy,
  listLocalTransferHistory,
  listLocalTransfermarktFreeAgents,
  warmLocalTransfermarktFreeAgentBrowseIndex: vi.fn(),
  createLocalTransfermarktRunContext: ({ save }: { save: typeof persistenceState.save }) => ({
    save,
    persistence: {
      saveSingleplayerState: (_saveId: string, gameState: GameState) => {
        persistenceState.save = { ...persistenceState.save, gameState };
        return persistenceState.save;
      },
    },
    deferredWrites: 0,
  }),
  flushLocalTransfermarktRunContext: (context: { save: typeof persistenceState.save; deferredWrites: number }) => {
    persistenceState.save = context.save;
    context.deferredWrites = 0;
    return persistenceState.save;
  },
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
        "C-C": {
          teamId: "C-C",
          controlMode: "ai",
          aiLineupPreviewEnabled: true,
          aiLineupApplyEnabled: false,
          aiLineupAutoApplyEnabled: false,
          aiTransferPreviewEnabled: true,
          aiTransferAutoApplyEnabled: false,
          aiSellPreviewEnabled: true,
          aiSellAutoApplyEnabled: false,
        },
        "W-W": {
          teamId: "W-W",
          controlMode: "manual",
          aiLineupPreviewEnabled: false,
          aiLineupApplyEnabled: false,
          aiLineupAutoApplyEnabled: false,
          aiTransferPreviewEnabled: false,
          aiTransferAutoApplyEnabled: false,
          aiSellPreviewEnabled: false,
          aiSellAutoApplyEnabled: false,
        },
      },
      teamStrategyProfiles: {},
    },
    matchdayState: { matchdayId: "matchday-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [
      { teamId: "C-C", shortCode: "C-C", name: "Cash Creators", budget: 200, cash: 100, identityId: "C-C", humanControlled: false, rosterLimit: 12 },
      { teamId: "W-W", shortCode: "W-W", name: "Wicked Wizards", budget: 200, cash: 100, identityId: "W-W", humanControlled: true, rosterLimit: 12 },
    ],
    teamIdentities: [
      { teamId: "C-C", pow: 50, spe: 50, men: 50, soc: 50, ambition: 50, finances: 50, boardConfidence: 50, harmony: 50, manners: 50, popularity: 50, cooperation: 50, playerMin: 7, playerOpt: 9 },
      { teamId: "W-W", pow: 50, spe: 50, men: 70, soc: 50, ambition: 50, finances: 50, boardConfidence: 50, harmony: 50, manners: 50, popularity: 50, cooperation: 50, playerMin: 7, playerOpt: 9 },
    ],
    players: [
      {
        id: "p-cc-1",
        name: "Ledger Core",
        rating: 60,
        marketValue: 20,
        salaryDemand: 4,
        displayMarketValue: 20,
        displaySalary: 4,
        pps: null,
        ovr: 60,
        className: "Trader",
        race: "Human",
        alignment: "neutral",
        gender: "n/a",
        subclasses: [],
        traitsPositive: [],
        traitsNegative: [],
        coreStats: { pow: 44, spe: 51, men: 42, soc: 47 },
        preferredDisciplineIds: [],
        disciplineRatings: { d_pow: 42, d_spe: 58, d_men: 39, d_soc: 45 },
        disciplineTierCounts: { above20: 4, above40: 4, above60: 0, above80: 0 },
        flavorEn: "",
        flavorDe: "",
        fatigue: 0,
        form: 0,
        potential: 0,
      },
      {
        id: "p-ww-1",
        name: "Rune Mentor",
        rating: 61,
        marketValue: 21,
        salaryDemand: 4,
        displayMarketValue: 21,
        displaySalary: 4,
        pps: null,
        ovr: 61,
        className: "Mage",
        race: "Spirit",
        alignment: "neutral",
        gender: "n/a",
        subclasses: [],
        traitsPositive: [],
        traitsNegative: [],
        coreStats: { pow: 29, spe: 38, men: 84, soc: 61 },
        preferredDisciplineIds: [],
        disciplineRatings: { d_pow: 22, d_spe: 32, d_men: 90, d_soc: 66 },
        disciplineTierCounts: { above20: 4, above40: 2, above60: 2, above80: 1 },
        flavorEn: "",
        flavorDe: "",
        fatigue: 0,
        form: 0,
        potential: 0,
      },
      {
        id: "fa-value",
        name: "Value Hunter",
        rating: 64,
        marketValue: 18,
        salaryDemand: 3,
        displayMarketValue: 18,
        displaySalary: 3,
        pps: null,
        ovr: 64,
        className: "Mercenary",
        race: "Human",
        alignment: "neutral",
        gender: "n/a",
        subclasses: [],
        traitsPositive: [],
        traitsNegative: [],
        coreStats: { pow: 48, spe: 57, men: 40, soc: 44 },
        preferredDisciplineIds: [],
        disciplineRatings: { d_pow: 45, d_spe: 61, d_men: 38, d_soc: 40 },
        disciplineTierCounts: { above20: 4, above40: 3, above60: 1, above80: 0 },
        flavorEn: "",
        flavorDe: "",
        fatigue: 0,
        form: 0,
        potential: 0,
      },
      {
        id: "fa-mage",
        name: "Arcane Broker",
        rating: 80,
        marketValue: 30,
        salaryDemand: 5,
        displayMarketValue: 30,
        displaySalary: 5,
        pps: null,
        ovr: 80,
        className: "Mage",
        race: "Spirit",
        alignment: "neutral",
        gender: "n/a",
        subclasses: [],
        traitsPositive: [],
        traitsNegative: [],
        coreStats: { pow: 25, spe: 39, men: 88, soc: 66 },
        preferredDisciplineIds: [],
        disciplineRatings: { d_pow: 20, d_spe: 34, d_men: 94, d_soc: 72 },
        disciplineTierCounts: { above20: 4, above40: 2, above60: 2, above80: 1 },
        flavorEn: "",
        flavorDe: "",
        fatigue: 0,
        form: 0,
        potential: 0,
      },
    ],
    disciplines: [],
    rosters: [
      { id: "r-cc-1", teamId: "C-C", playerId: "p-cc-1", contractLength: 2, salary: 4, upkeep: 4, purchasePrice: 20, currentValue: 20, roleTag: "starter", joinedSeasonId: "season-1" },
      { id: "r-ww-1", teamId: "W-W", playerId: "p-ww-1", contractLength: 2, salary: 4, upkeep: 4, purchasePrice: 21, currentValue: 21, roleTag: "starter", joinedSeasonId: "season-1" },
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

function buildCompareEntry(teamId: "C-C" | "W-W", pickClassName: string, playerId: string, playerName: string) {
  const teamName = teamId === "C-C" ? "Cash Creators" : "Wicked Wizards";
  const controlMode = teamId === "C-C" ? "ai" : "manual";
  return {
    teamId,
    teamCode: teamId,
    teamName,
    controlMode,
    currentRosterState: {
      cash: 100,
      salaryTotal: 4,
      rosterCount: 1,
      targetRosterMin: 2,
      targetRosterOpt: 9,
      targetRosterSize: 9,
      targetRosterGap: 8,
      budgetStatus: "healthy",
    },
    planner: {
      plannerSource: "retool_reference",
      slotPlan: ["core"],
      superstarAllowed: 0,
      starAllowed: pickClassName === "Mage" ? 1 : 0,
      minimumSlotsMissing: 1,
      optimumSlotsMissing: 8,
      coreNeeded: 1,
      specialistNeeded: 0,
      depthNeeded: 0,
      cheapFillNeeded: 0,
      backupNeeded: 0,
      reservedCashForMinimum: 0,
      minimumCandidateFloorPrice: 18,
      minimumReachable: true,
      laneGatePassed: true,
      blockingReasons: [],
      warnings: [],
    },
    cashStrategy: {
      strategySource: "retool_reference",
      sourceStatus: "partial",
      startingCash: 200,
      currentCash: 100,
      targetRoster: 9,
      minimumRoster: 7,
      currentRoster: 1,
      missingMinimumSlots: 6,
      missingTargetSlots: 8,
      expectedMinimumSlotCost: 18,
      reservedCashForMinimum: 0,
      reservedCashForDepth: 10,
      availableCashForCurrentPick: 90,
      maxSpendPerPick: 30,
      maxSpendByLane: {
        cheap_fill: 18,
        backup: 20,
        depth: 24,
        specialist: 28,
        core: 35,
        star: 40,
        superstar: 55,
      },
      cashAggression: 0.48,
      cashDiscipline: 0.52,
      overspendTolerance: 0.08,
      shouldSaveCash: false,
      canBuyStar: pickClassName === "Mage",
      canBuySuperstar: false,
      financePosture: pickClassName === "Mage" ? "aggressive" : "value_hunter",
      spendFactor: pickClassName === "Mage" ? 1.14 : 0.96,
      allowedBudgetForSearch: pickClassName === "Mage" ? 62 : 41,
      attackPressure: pickClassName === "Mage" ? 0.71 : 0.44,
      savingsBias: pickClassName === "Mage" ? 0.38 : 0.57,
      minCashBuffer: pickClassName === "Mage" ? 28 : 36,
      rosterPressure: 0.83,
      needPressure: 0.74,
      spendArchitecture: {
        allowed_budget_for_search: pickClassName === "Mage" ? 62 : 41,
        maxSpendTotalThisWindow: pickClassName === "Mage" ? 62 : 41,
        maxSpendPerPick: 30,
        maxSpendByLane: {
          cheap_fill: 18,
          backup: 20,
          depth: 24,
          specialist: 28,
          core: 35,
          star: 40,
          superstar: 55,
        },
        premiumSlotCount: pickClassName === "Mage" ? 1 : 0,
        starSlotCount: pickClassName === "Mage" ? 1 : 0,
        coreSlotCount: 1,
        specialistSlotCount: 0,
        depthSlotCount: 0,
        fillSlotCount: 0,
        reserveSlotCount: 0,
        minCashBuffer: pickClassName === "Mage" ? 28 : 36,
        reservedCashForMinimum: 0,
        reservedCashForDepth: 10,
        attackPressure: pickClassName === "Mage" ? 0.71 : 0.44,
        savingsBias: pickClassName === "Mage" ? 0.38 : 0.57,
        rosterPressure: 0.83,
        needPressure: 0.74,
        financePosture: pickClassName === "Mage" ? "aggressive" : "value_hunter",
        spendFactor: pickClassName === "Mage" ? 1.14 : 0.96,
        reason: pickClassName === "Mage" ? "Aggressiver Need-Fit." : "Value-Fit mit Reserve.",
      },
      expectedPrizeSignal: {
        expectedPrizeCurrentSeason: 22,
        expectedPrizeNextSeason1: 24,
        expectedPrizeNextSeason2: 25,
        expectedPrizeNextSeason3: 26,
        expectedPrizeNextSeason4: 27,
        expectedPrizeFiveSeasonSum: 124,
        expectedPrizeTrend: "up",
        prizeConfidence: "ready",
        prizeSourceStatus: "ready",
        flowPolicy: "season_end_only",
        warnings: [],
      },
      financesValue: 50,
      ambitionValue: 50,
      boardPressureValue: 50,
      harmonyValue: 50,
      warnings: [],
    },
    openNeeds: [{ axis: "core", label: "Core-Bedarf", importance: 0.8, reason: "Core fehlt.", sourceStatus: "mapped" }],
    budgetLanes: [
      {
        lane: "core",
        spendCap: 35,
        priceCap: 35,
        salaryCap: 5,
        maxCashShare: 0.3,
        minNeedScore: 2,
        minTeamFitScore: 1,
        allowedWhenUnderMinimum: true,
        cheaperAlternativeCheck: true,
        reason: "Core buy",
        plannedSlots: 1,
        remainingSlots: 0,
        spendUsed: pickClassName === "Mage" ? 30 : 18,
        active: true,
      },
    ],
    candidatePoolTop: [
      {
        candidateId: playerId,
        playerId,
        playerName,
        className: pickClassName,
        race: pickClassName === "Mage" ? "Spirit" : "Human",
        price: pickClassName === "Mage" ? 30 : 18,
        salary: pickClassName === "Mage" ? 5 : 3,
        ovr: pickClassName === "Mage" ? 80 : 64,
        mvs: null,
        candidateAxis: pickClassName === "Mage" ? "men" : "spe",
        bestNeedDisciplineId: pickClassName === "Mage" ? "d_men" : "d_spe",
        finalScore: pickClassName === "Mage" ? 91 : 84,
        scoreBreakdown: {
          playerQualityScore: 20,
          needMatchScore: 12,
          disciplineCoverageScore: 11,
          teamIdentityScore: pickClassName === "Mage" ? 12 : 4,
          classDisciplineFitScore: 5,
          rosterBalanceScore: 6,
          budgetFitScore: 6,
          laneFitScore: 4,
          valueScore: 7,
          harmonyFitScore: 2,
          riskPenalty: 0,
          duplicateProfilePenalty: 0,
          offThemePenalty: pickClassName === "Mage" ? 0 : -1,
          classSpamPenalty: 0,
        },
        reasons: ["Need fuellen", "Profil passt"],
      },
    ],
    plannedPicks: [
      {
        step: 1,
        lane: "core",
        plannedLane: "core",
        pickLane: "core",
        pickPhase: "minimum_skeleton",
        teamCashTier: pickClassName === "Mage" ? "stable" : "tight",
        minimumSecured: false,
        reserveSecured: true,
        effectiveLaneCap: 35,
        phaseCap: pickClassName === "Mage" ? 32 : 24,
        capExceeded: false,
        capOverrideReason: null,
        laneReason: "Core buy",
        laneBudgetLimit: 35,
        laneBudgetUsed: pickClassName === "Mage" ? 30 : 18,
        budgetStretchApplied: false,
        budgetStretchReason: null,
        budgetStretchPhaseAllowed: false,
        budgetStretchBlockedReason: "phase_blocks_stretch",
        playerId,
        playerName,
        className: pickClassName,
        race: pickClassName === "Mage" ? "Spirit" : "Human",
        price: pickClassName === "Mage" ? 30 : 18,
        salary: pickClassName === "Mage" ? 5 : 3,
        ovr: pickClassName === "Mage" ? 80 : 64,
        mvs: null,
        candidateAxis: pickClassName === "Mage" ? "men" : "spe",
        bestNeedDisciplineId: pickClassName === "Mage" ? "d_men" : "d_spe",
        isSuperstar: false,
        isStar: pickClassName === "Mage",
        starPressureWarning: null,
        cheaperAlternativeAvailable: false,
        cheaperMinimumSafeAlternativeAvailable: false,
        specialistNeedFilled: false,
        coreNeedFilled: true,
        depthNeedFilled: false,
        minimumReachableAfterPick: true,
        remainingMinimumReserve: pickClassName === "Mage" ? 40 : 52,
        finalScore: pickClassName === "Mage" ? 91 : 84,
        scoreBreakdown: {
          playerQualityScore: 20,
          needMatchScore: 12,
          disciplineCoverageScore: 11,
          teamIdentityScore: pickClassName === "Mage" ? 12 : 4,
          classDisciplineFitScore: 5,
          rosterBalanceScore: 6,
          budgetFitScore: 6,
          laneFitScore: 4,
          valueScore: 7,
          harmonyFitScore: 2,
          riskPenalty: 0,
          duplicateProfilePenalty: 0,
          offThemePenalty: pickClassName === "Mage" ? 0 : -1,
          classSpamPenalty: 0,
        },
        reasons: ["Need fuellen", "Profil passt"],
      },
    ],
    sequentialStateSnapshots: [
      {
        step: 1,
        lane: "core",
        pickPhase: "minimum_skeleton",
        teamCashTier: pickClassName === "Mage" ? "stable" : "tight",
        minimumSecured: false,
        reserveSecured: true,
        phaseCap: pickClassName === "Mage" ? 32 : 24,
        minimumSlotsBefore: 6,
        minimumSlotsAfter: 5,
        minimumReserveBefore: 18,
        minimumReserveAfter: pickClassName === "Mage" ? 40 : 52,
        minimumReachableAfterStep: true,
        rosterCountBefore: 1,
        rosterCountAfter: 2,
        cashBefore: 100,
        cashAfter: pickClassName === "Mage" ? 70 : 82,
        salaryBefore: 4,
        salaryAfter: pickClassName === "Mage" ? 9 : 7,
        laneBudgetUsed: pickClassName === "Mage" ? 30 : 18,
        laneBudgetRemaining: pickClassName === "Mage" ? 5 : 17,
        laneSlotsRemaining: 0,
        remainingOpenNeedAxes: ["DEPTH"],
        pickedPlayerIds: [playerId],
      },
    ],
    compareStatus: "retool_pick_source_missing",
    retoolTopPicksStatus: "retool_pick_source_missing",
    retoolTopPicks: [],
    retoolReferenceFiles: [],
    matches: [],
    deviations: [],
    deviationReasons: [],
    warnings: [],
  };
}

describe("ai picks run service", () => {
  // Organic Squad Builder ist jetzt DEFAULT-ON (Cutover); diese Mock-basierte Suite prüft den Legacy-Pfad
  // und schaltet organic daher explizit per Opt-out (=0) ab. Organic ist über organic-* + Long-Run gedeckt.
  afterEach(() => {
    delete process.env.OLY_ORGANIC_SQUAD_BUILDER;
  });
  beforeEach(() => {
    process.env.OLY_ORGANIC_SQUAD_BUILDER = "0";
    persistenceState.save.gameState = buildGameState();
    buildAiNeedsPicksCompare.mockReset();
    previewLocalTransfermarktBuy.mockReset();
    executeLocalTransfermarktBuy.mockReset();
    listLocalTransferHistory.mockReset();
    listLocalTransfermarktFreeAgents.mockReset();

    buildAiNeedsPicksCompare.mockImplementation(async ({ teamId }: { teamId: string }) => ({
      readOnly: true,
      source: "sqlite",
      scope: {
        saveId: "save-ai-run",
        seasonId: "season-1",
        teamId,
        teamScope: "all",
        compareSet: [teamId],
      },
      totalTeams: 1,
      aiTeams: 1,
      skippedManual: 0,
      skippedPassive: 0,
      skippedDisabled: 0,
      comparedTeams: 1,
      matchedTeams: 0,
      partialTeams: 0,
      deviatedTeams: 0,
      missingRetoolTeams: 1,
      blockedTeams: 0,
      teams: [teamId === "W-W" ? buildCompareEntry("W-W", "Mage", "fa-mage", "Arcane Broker") : buildCompareEntry("C-C", "Mercenary", "fa-value", "Value Hunter")],
    }));

    previewLocalTransfermarktBuy.mockImplementation(({ playerId }: { playerId: string }) => ({
      canBuy: true,
      blockingReasons: [],
      warnings: [],
      contractLength: 1,
      purchasePrice: playerId === "fa-mage" ? 30 : 18,
      salary: playerId === "fa-mage" ? 5 : 3,
      player: { id: playerId, name: playerId, className: playerId === "fa-mage" ? "Mage" : "Mercenary", race: playerId === "fa-mage" ? "Spirit" : "Human" },
      team: { id: "team", name: "Team", shortCode: "TEAM" },
    }));

    executeLocalTransfermarktBuy.mockImplementation(({ teamId, playerId, localRunContext }: { teamId: string; playerId: string; localRunContext?: { save: typeof persistenceState.save; deferredWrites: number } }) => {
      const purchasePrice = playerId === "fa-mage" ? 30 : 18;
      const salary = playerId === "fa-mage" ? 5 : 3;
      const sourceSave = localRunContext?.save ?? persistenceState.save;
      const team = sourceSave.gameState.teams.find((entry) => entry.teamId === teamId)!;
      const nextGameState = {
        ...sourceSave.gameState,
        teams: sourceSave.gameState.teams.map((entry) =>
          entry.teamId === teamId ? { ...entry, cash: entry.cash - purchasePrice } : entry,
        ),
        rosters: [
          ...sourceSave.gameState.rosters,
          {
            id: `roster-${playerId}`,
            teamId,
            playerId,
            contractLength: 1,
            salary,
            upkeep: salary,
            purchasePrice,
            currentValue: purchasePrice,
            roleTag: "prospect" as const,
            joinedSeasonId: "season-1",
          },
        ],
        transferHistory: [
          {
            id: `history-${playerId}`,
            playerId,
            seasonId: "season-1",
            matchdayId: "matchday-1",
            phase: "season_setup",
            source: "ai_roster_fill",
            seasonLabel: "Season 1",
            transferType: "buy" as const,
            fromTeamId: null,
            toTeamId: teamId,
            fee: purchasePrice,
            salary,
            marketValue: purchasePrice,
            remainingContractLength: 1,
            happenedAt: new Date().toISOString(),
          },
          ...sourceSave.gameState.transferHistory,
        ],
      };
      if (localRunContext) {
        localRunContext.save = { ...localRunContext.save, gameState: nextGameState };
        localRunContext.deferredWrites += 1;
      } else {
        persistenceState.save.gameState = nextGameState;
      }

      return {
        canBuy: true,
        blockingReasons: [],
        warnings: [],
        player: { id: playerId, name: playerId, className: playerId === "fa-mage" ? "Mage" : "Mercenary", race: playerId === "fa-mage" ? "Spirit" : "Human" },
        team: { id: teamId, name: team.name, shortCode: team.shortCode },
        contractLength: 1,
        purchasePrice,
        salary,
        currentValue: purchasePrice,
        joinedSeasonId: "season-1",
        cashBefore: team.cash,
        cashAfter: team.cash - purchasePrice,
        salaryBefore: 4,
        salaryAfter: 4 + salary,
        marketValueBefore: 20,
        marketValueAfter: 20 + purchasePrice,
        rosterBefore: 1,
        rosterAfter: 2,
        activePlayerCreated: true,
        transferCreated: true,
        teamSeasonStateUpdated: true,
        activePlayerId: `local-roster:${playerId}`,
        transferId: `history-${playerId}`,
      };
    });

    listLocalTransferHistory.mockImplementation(({ teamId }: { teamId?: string }) => ({
      items: persistenceState.save.gameState.transferHistory
        .filter((entry) => (teamId ? entry.toTeamId === teamId : true))
        .map((entry) => ({ transferId: entry.id })),
      total: persistenceState.save.gameState.transferHistory.length,
      scope: { saveId: "save-ai-run", seasonId: "season-1", teamId: teamId ?? null, type: "buy" },
      saveContext: {
        source: "sqlite",
        requestedSaveId: "save-ai-run",
        resolvedSaveId: "save-ai-run",
        requestedSeasonId: "season-1",
        resolvedSeasonId: "season-1",
        saveName: "AI Run Test Save",
        saveStatus: "active",
        scopeWarning: null,
      },
    }));

    listLocalTransfermarktFreeAgents.mockImplementation(({ teamId }: { teamId?: string }) => {
      const team = teamId
        ? persistenceState.save.gameState.teams.find((entry) => entry.teamId === teamId) ?? null
        : null;
      const rosteredIds = new Set(persistenceState.save.gameState.rosters.map((entry) => entry.playerId));
      const pool = persistenceState.save.gameState.players
        .filter((player) => !rosteredIds.has(player.id))
        .map((player) => ({
          playerId: player.id,
          marketValue: player.displayMarketValue ?? player.marketValue ?? null,
        }));
      const sortedPool = [...pool].sort((left, right) => (left.marketValue ?? Number.POSITIVE_INFINITY) - (right.marketValue ?? Number.POSITIVE_INFINITY));
      return {
        items: [],
        total: sortedPool.length,
        scope: { saveId: "save-ai-run", seasonId: "season-1", teamId: teamId ?? null },
        saveContext: {
          source: "sqlite",
          requestedSaveId: "save-ai-run",
          resolvedSaveId: "save-ai-run",
          requestedSeasonId: "season-1",
          resolvedSeasonId: "season-1",
          saveName: "AI Run Test Save",
          saveStatus: "active",
          scopeWarning: null,
        },
        teamContext: team
          ? {
              teamId: team.teamId,
              teamCode: team.shortCode,
              teamName: team.name,
              teamCash: team.cash,
            }
          : null,
        poolAudit: {
          visiblePlayers: sortedPool.length,
          cheapestVisiblePlayer: sortedPool[0] ?? null,
        },
      };
    });
  });

  it("builds a read-only preview with global pick summaries", async () => {
    const { runAiPicksExecutePreview } = await import("@/lib/ai/ai-picks-run-service");

    const result = await runAiPicksExecutePreview({
      source: "sqlite",
      saveId: "save-ai-run",
      seasonId: "season-1",
      dryRun: true,
      teamScope: "all",
      allowSetupAllTeams: true,
    });

    expect(result.readOnly).toBe(true);
    expect(result.globalPreview.plannedPickCount).toBe(2);
    expect(result.qualityGate.passed).toBe(true);
    expect(result.globalPreview.laneDistribution).toEqual([{ label: "core", count: 2 }]);
    expect(result.preflight.checks.find((entry) => entry.key === "cash_consistent")?.status).toBe("ok");
    expect(result.preflight.checks.find((entry) => entry.key === "free_agents_affordable")?.status).toBe("ok");
    expect(result.teams.find((entry) => entry.teamId === "C-C")?.plannedPicks[0]?.playerName).toBe("Value Hunter");
    expect(result.teams.find((entry) => entry.teamId === "W-W")?.plannedPicks[0]?.playerName).toBe("Arcane Broker");
    expect(result.teams.find((entry) => entry.teamId === "C-C")?.planner?.reservedCashForMinimum).toBe(0);
    expect(result.teams.find((entry) => entry.teamId === "C-C")?.cashStrategy?.maxSpendByLane.core).toBe(35);
    expect(result.teams.find((entry) => entry.teamId === "C-C")?.previewSummary).toMatchObject({
      startingCash: 200,
      plannedSpendTotal: 18,
      cashAfterPlannedBuys: 82,
      plannedRosterCount: 2,
      expectedMinimumReached: true,
      cheapestCandidateSeen: 18,
      cheapestBoughtPlayer: 18,
      mostExpensiveBoughtPlayer: 18,
    });
    expect(result.teams.find((entry) => entry.teamId === "C-C")?.plannedPicks[0]).toMatchObject({
      pickLane: "core",
      rosterRole: "Core",
      pickPhase: "minimum_skeleton",
      pickScore: 84,
      primaryReason: "Need fuellen",
      secondaryReason: "Profil passt",
      teamFit: 4,
      budgetFit: 6,
      mustFeelRightScore: 3,
      minimumReachableAfterPick: true,
      remainingMinimumReserve: 52,
    });
    expect(result.traceParity.dryRunExecuteTraceMatch).toBe(true);
    expect(result.traceParity.dryRunPickCount).toBe(2);
    expect(result.traceParity.executePickCount).toBe(0);
  });

  it("keeps the compare service planned order even when the candidate pool leaderboard differs", async () => {
    buildAiNeedsPicksCompare.mockImplementation(async ({ teamId }: { teamId: string }) => {
      const entry = buildCompareEntry(teamId as "C-C" | "W-W", "Mercenary", "fa-value", "Value Hunter");
      return {
        readOnly: true,
        source: "sqlite",
        scope: { saveId: "save-ai-run", seasonId: "season-1", teamId, teamScope: "all", compareSet: [teamId] },
        totalTeams: 1,
        aiTeams: 1,
        skippedManual: 0,
        skippedPassive: 0,
        skippedDisabled: 0,
        comparedTeams: 1,
        matchedTeams: 0,
        partialTeams: 0,
        deviatedTeams: 0,
        missingRetoolTeams: 1,
        blockedTeams: 0,
        teams: [
          {
            ...entry,
            candidatePoolTop: [
              {
                ...entry.candidatePoolTop[0],
                playerId: "fa-mage",
                playerName: "Arcane Broker",
                className: "Mage",
                race: "Spirit",
                price: 30,
                salary: 5,
                ovr: 80,
                finalScore: 96,
              },
              ...entry.candidatePoolTop,
            ],
            plannedPicks: [
              entry.plannedPicks[0],
              {
                ...entry.plannedPicks[0],
                step: 2,
                playerId: "fa-mage",
                playerName: "Arcane Broker",
                className: "Mage",
                race: "Spirit",
                price: 30,
                salary: 5,
                ovr: 80,
                finalScore: 79,
              },
            ],
          },
        ],
      };
    });

    const { runAiPicksExecutePreview } = await import("@/lib/ai/ai-picks-run-service");
    const result = await runAiPicksExecutePreview({
      source: "sqlite",
      saveId: "save-ai-run",
      seasonId: "season-1",
      dryRun: true,
      teamScope: "ai",
      stepsPerTeam: 2,
    });

    expect(result.teams[0]?.plannedPicks.map((entry) => entry.playerName)).toEqual(["Value Hunter", "Arcane Broker"]);
  });

  it("keeps multiple isolated superstar picks as a warning instead of a hard block", async () => {
    buildAiNeedsPicksCompare.mockImplementation(async ({ teamId }: { teamId: string }) => {
      const baseEntry =
        teamId === "W-W" ? buildCompareEntry("W-W", "Mage", "fa-mage", "Arcane Broker") : buildCompareEntry("C-C", "Mage", "fa-mage", "Arcane Broker");
      const fillerPicks = Array.from({ length: 5 }, (_, index) => ({
        ...baseEntry.plannedPicks[0],
        step: index + 2,
        playerId: `${teamId}-depth-${index + 1}`,
        playerName: `Depth ${index + 1}`,
        className: "Mercenary",
        race: "Human",
        price: 12,
        salary: 2,
        ovr: 58,
        isSuperstar: false,
        isStar: false,
        finalScore: 68 - index,
        scoreBreakdown: {
          ...baseEntry.plannedPicks[0].scoreBreakdown,
          teamIdentityScore: 3,
          valueScore: 6,
        },
      }));
      return {
        readOnly: true,
        source: "sqlite",
        scope: { saveId: "save-ai-run", seasonId: "season-1", teamId, teamScope: "all", compareSet: [teamId] },
        totalTeams: 1,
        aiTeams: 1,
        skippedManual: 0,
        skippedPassive: 0,
        skippedDisabled: 0,
        comparedTeams: 1,
        matchedTeams: 0,
        partialTeams: 0,
        deviatedTeams: 0,
        missingRetoolTeams: 1,
        blockedTeams: 0,
        teams: [
          {
            ...baseEntry,
            planner: {
              ...baseEntry.planner,
              superstarAllowed: 1,
            },
            plannedPicks: [
              ...baseEntry.plannedPicks.map((pick) => ({
                ...pick,
                isSuperstar: true,
                isStar: false,
              })),
              ...fillerPicks,
            ],
          },
        ],
      };
    });

    const { runAiPicksExecutePreview } = await import("@/lib/ai/ai-picks-run-service");
    const result = await runAiPicksExecutePreview({
      source: "sqlite",
      saveId: "save-ai-run",
      seasonId: "season-1",
      dryRun: true,
      teamScope: "all",
      allowSetupAllTeams: true,
    });

    expect(result.qualityGate.passed).toBe(true);
    expect(result.qualityGate.blockingReasons).not.toContain("ai_pick_quality_gate_failed:superstar_share_too_high");
  });

  it("blocks execute when the quality gate fails on berserker spam", async () => {
    buildAiNeedsPicksCompare.mockImplementation(async ({ teamId }: { teamId: string }) => ({
      readOnly: true,
      source: "sqlite",
      scope: { saveId: "save-ai-run", seasonId: "season-1", teamId, teamScope: "all", compareSet: [teamId] },
      totalTeams: 1,
      aiTeams: 1,
      skippedManual: 0,
      skippedPassive: 0,
      skippedDisabled: 0,
      comparedTeams: 1,
      matchedTeams: 0,
      partialTeams: 0,
      deviatedTeams: 0,
      missingRetoolTeams: 1,
      blockedTeams: 0,
      teams: [buildCompareEntry(teamId as "C-C" | "W-W", "Berserker", teamId === "W-W" ? "fa-mage" : "fa-value", teamId === "W-W" ? "Ash Giant II" : "Ash Giant")],
    }));

    const { runAiPicksExecutePreview } = await import("@/lib/ai/ai-picks-run-service");
    const result = await runAiPicksExecutePreview({
      source: "sqlite",
      saveId: "save-ai-run",
      seasonId: "season-1",
      dryRun: false,
      confirmToken: "EXECUTE_AI_PICK_RUN",
      teamScope: "all",
      allowSetupAllTeams: true,
    });

    expect(result.executed).toBe(false);
    expect(result.status).toBe("blocked");
    expect(result.blockingReasons).toContain("ai_pick_quality_gate_failed:berserker_warlord_share_too_high");
  });

  it("blocks focus-team previews when identity is clearly too low", async () => {
    buildAiNeedsPicksCompare.mockImplementation(async ({ teamId }: { teamId: string }) => {
      const entry = buildCompareEntry(teamId as "C-C" | "W-W", "Mercenary", teamId === "W-W" ? "fa-mage" : "fa-value", teamId === "W-W" ? "Arcane Broker" : "Value Hunter");
      return {
        readOnly: true,
        source: "sqlite",
        scope: { saveId: "save-ai-run", seasonId: "season-1", teamId, teamScope: "all", compareSet: [teamId] },
        totalTeams: 1,
        aiTeams: 1,
        skippedManual: 0,
        skippedPassive: 0,
        skippedDisabled: 0,
        comparedTeams: 1,
        matchedTeams: 0,
        partialTeams: 0,
        deviatedTeams: 0,
        missingRetoolTeams: 1,
        blockedTeams: 0,
        teams: [
          {
            ...entry,
            plannedPicks: entry.plannedPicks.map((pick) => ({
              ...pick,
              scoreBreakdown: {
                ...pick.scoreBreakdown,
                teamIdentityScore: 1,
                offThemePenalty: -5,
              },
            })),
          },
        ],
      };
    });

    const { runAiPicksExecutePreview } = await import("@/lib/ai/ai-picks-run-service");
    const result = await runAiPicksExecutePreview({
      source: "sqlite",
      saveId: "save-ai-run",
      seasonId: "season-1",
      dryRun: true,
      teamScope: "ai",
    });

    expect(result.status).toBe("blocked");
    expect(result.warnings).toContain("ai_preview_blocked");
    expect(result.blockingReasons).toContain("focus_team_identity_too_low:C-C");
    expect(result.qualityGate.warnings).toContain("focus_team_off_theme_warning:C-C");
  });

  it("blocks execute when the planner lane gate reports a star/core mismatch", async () => {
    buildAiNeedsPicksCompare.mockImplementation(async ({ teamId }: { teamId: string }) => {
      const entry = buildCompareEntry(teamId as "C-C" | "W-W", "Mage", teamId === "W-W" ? "fa-mage" : "fa-value", teamId === "W-W" ? "Arcane Broker" : "Value Hunter");
      return {
        readOnly: true,
        source: "sqlite",
        scope: { saveId: "save-ai-run", seasonId: "season-1", teamId, teamScope: "all", compareSet: [teamId] },
        totalTeams: 1,
        aiTeams: 1,
        skippedManual: 0,
        skippedPassive: 0,
        skippedDisabled: 0,
        comparedTeams: 1,
        matchedTeams: 0,
        partialTeams: 0,
        deviatedTeams: 0,
        missingRetoolTeams: 1,
        blockedTeams: 1,
        teams: [
          {
            ...entry,
            planner: {
              ...entry.planner,
              laneGatePassed: false,
              blockingReasons: ["lane_plan_star_before_core"],
            },
          },
        ],
      };
    });

    const { runAiPicksExecutePreview } = await import("@/lib/ai/ai-picks-run-service");
    const result = await runAiPicksExecutePreview({
      source: "sqlite",
      saveId: "save-ai-run",
      seasonId: "season-1",
      dryRun: false,
      confirmToken: "EXECUTE_AI_PICK_RUN",
      teamScope: "all",
      allowSetupAllTeams: true,
    });

    expect(result.executed).toBe(false);
    expect(result.blockingReasons).toContain("ai_pick_lane_gate_failed:lane_plan_star_before_core");
  });

  it("blocks execute when the plan still leaves a team below minimum roster", async () => {
    buildAiNeedsPicksCompare.mockImplementation(async ({ teamId }: { teamId: string }) => {
      const entry = buildCompareEntry(teamId as "C-C" | "W-W", "Mercenary", teamId === "W-W" ? "fa-mage" : "fa-value", teamId === "W-W" ? "Arcane Broker" : "Value Hunter");
      return {
        readOnly: true,
        source: "sqlite",
        scope: { saveId: "save-ai-run", seasonId: "season-1", teamId, teamScope: "all", compareSet: [teamId] },
        totalTeams: 1,
        aiTeams: 1,
        skippedManual: 0,
        skippedPassive: 0,
        skippedDisabled: 0,
        comparedTeams: 1,
        matchedTeams: 0,
        partialTeams: 0,
        deviatedTeams: 0,
        missingRetoolTeams: 1,
        blockedTeams: 0,
        teams: [
          {
            ...entry,
            currentRosterState: {
              ...entry.currentRosterState,
              rosterCount: 1,
              targetRosterMin: 7,
            },
            plannedPicks: entry.plannedPicks.slice(0, 1),
          },
        ],
      };
    });

    const { runAiPicksExecutePreview } = await import("@/lib/ai/ai-picks-run-service");
    const result = await runAiPicksExecutePreview({
      source: "sqlite",
      saveId: "save-ai-run",
      seasonId: "season-1",
      dryRun: false,
      confirmToken: "EXECUTE_AI_PICK_RUN",
      teamScope: "all",
      allowSetupAllTeams: true,
    });

    expect(result.executed).toBe(false);
    expect(result.blockingReasons.some((entry) => entry.startsWith("minimum_roster_gate_failed:"))).toBe(true);
  });

  it("blocks execute when a cheap_fill pick is actually a star-tier expensive buy", async () => {
    buildAiNeedsPicksCompare.mockImplementation(async ({ teamId }: { teamId: string }) => {
      const entry = buildCompareEntry(teamId as "C-C" | "W-W", "Mage", teamId === "W-W" ? "fa-mage" : "fa-value", teamId === "W-W" ? "Arcane Broker" : "Value Hunter");
      return {
        readOnly: true,
        source: "sqlite",
        scope: { saveId: "save-ai-run", seasonId: "season-1", teamId, teamScope: "all", compareSet: [teamId] },
        totalTeams: 1,
        aiTeams: 1,
        skippedManual: 0,
        skippedPassive: 0,
        skippedDisabled: 0,
        comparedTeams: 1,
        matchedTeams: 0,
        partialTeams: 0,
        deviatedTeams: 0,
        missingRetoolTeams: 1,
        blockedTeams: 0,
        teams: [
          {
            ...entry,
            plannedPicks: entry.plannedPicks.map((pick) => ({
              ...pick,
              lane: "cheap_fill",
              pickLane: "cheap_fill",
              isStar: true,
              laneBudgetLimit: 12,
              laneBudgetUsed: 30,
              cheaperMinimumSafeAlternativeAvailable: true,
            })),
          },
        ],
      };
    });

    const { runAiPicksExecutePreview } = await import("@/lib/ai/ai-picks-run-service");
    const result = await runAiPicksExecutePreview({
      source: "sqlite",
      saveId: "save-ai-run",
      seasonId: "season-1",
      dryRun: false,
      confirmToken: "EXECUTE_AI_PICK_RUN",
      teamScope: "all",
      allowSetupAllTeams: true,
    });

    expect(result.executed).toBe(false);
    expect(result.blockingReasons.some((entry) => entry.startsWith("cheap_fill_classification_failed:"))).toBe(true);
  });

  it("blocks execute when a pick breaks the reserved minimum budget", async () => {
    buildAiNeedsPicksCompare.mockImplementation(async ({ teamId }: { teamId: string }) => {
      const entry = buildCompareEntry(teamId as "C-C" | "W-W", "Mage", teamId === "W-W" ? "fa-mage" : "fa-value", teamId === "W-W" ? "Arcane Broker" : "Value Hunter");
      return {
        readOnly: true,
        source: "sqlite",
        scope: { saveId: "save-ai-run", seasonId: "season-1", teamId, teamScope: "all", compareSet: [teamId] },
        totalTeams: 1,
        aiTeams: 1,
        skippedManual: 0,
        skippedPassive: 0,
        skippedDisabled: 0,
        comparedTeams: 1,
        matchedTeams: 0,
        partialTeams: 0,
        deviatedTeams: 0,
        missingRetoolTeams: 1,
        blockedTeams: 0,
        teams: [
          {
            ...entry,
            plannedPicks: entry.plannedPicks.map((pick) => ({
              ...pick,
              minimumReachableAfterPick: false,
              remainingMinimumReserve: -6,
            })),
          },
        ],
      };
    });

    const { runAiPicksExecutePreview } = await import("@/lib/ai/ai-picks-run-service");
    const result = await runAiPicksExecutePreview({
      source: "sqlite",
      saveId: "save-ai-run",
      seasonId: "season-1",
      dryRun: false,
      confirmToken: "EXECUTE_AI_PICK_RUN",
      teamScope: "all",
      allowSetupAllTeams: true,
    });

    expect(result.executed).toBe(false);
    expect(result.blockingReasons.some((entry) => entry.startsWith("cash_reserve_gate_failed:"))).toBe(true);
  });

  it("blocks execute when a conservative team should save cash instead of forcing a weak expensive pick", async () => {
    buildAiNeedsPicksCompare.mockImplementation(async ({ teamId }: { teamId: string }) => {
      const entry = buildCompareEntry(teamId as "C-C" | "W-W", "Mage", teamId === "W-W" ? "fa-mage" : "fa-value", teamId === "W-W" ? "Arcane Broker" : "Value Hunter");
      return {
        readOnly: true,
        source: "sqlite",
        scope: { saveId: "save-ai-run", seasonId: "season-1", teamId, teamScope: "all", compareSet: [teamId] },
        totalTeams: 1,
        aiTeams: 1,
        skippedManual: 0,
        skippedPassive: 0,
        skippedDisabled: 0,
        comparedTeams: 1,
        matchedTeams: 0,
        partialTeams: 0,
        deviatedTeams: 0,
        missingRetoolTeams: 1,
        blockedTeams: 0,
        teams: [
          {
            ...entry,
            cashStrategy: {
              ...entry.cashStrategy,
              shouldSaveCash: true,
            },
            plannedPicks: entry.plannedPicks.map((pick) => ({
              ...pick,
              isStar: true,
              marketValue: 39,
              laneBudgetLimit: 30,
              scoreBreakdown: {
                ...pick.scoreBreakdown,
                needMatchScore: 2,
                teamIdentityScore: 2,
              },
            })),
          },
        ],
      };
    });

    const { runAiPicksExecutePreview } = await import("@/lib/ai/ai-picks-run-service");
    const result = await runAiPicksExecutePreview({
      source: "sqlite",
      saveId: "save-ai-run",
      seasonId: "season-1",
      dryRun: false,
      confirmToken: "EXECUTE_AI_PICK_RUN",
      teamScope: "all",
      allowSetupAllTeams: true,
    });

    expect(result.executed).toBe(false);
    expect(result.blockingReasons.some((entry) => entry.startsWith("should_save_cash_instead:"))).toBe(true);
  });

  it("blocks execute when spend architecture fields are missing", async () => {
    buildAiNeedsPicksCompare.mockImplementation(async ({ teamId }: { teamId: string }) => {
      const entry = buildCompareEntry(teamId as "C-C" | "W-W", "Mage", teamId === "W-W" ? "fa-mage" : "fa-value", teamId === "W-W" ? "Arcane Broker" : "Value Hunter");
      return {
        readOnly: true,
        source: "sqlite",
        scope: { saveId: "save-ai-run", seasonId: "season-1", teamId, teamScope: "all", compareSet: [teamId] },
        totalTeams: 1,
        aiTeams: 1,
        skippedManual: 0,
        skippedPassive: 0,
        skippedDisabled: 0,
        comparedTeams: 1,
        matchedTeams: 0,
        partialTeams: 0,
        deviatedTeams: 0,
        missingRetoolTeams: 1,
        blockedTeams: 0,
        teams: [
          {
            ...entry,
            cashStrategy: {
              ...entry.cashStrategy,
              spendFactor: null,
              allowedBudgetForSearch: null,
              spendArchitecture: {
                ...entry.cashStrategy.spendArchitecture,
                allowed_budget_for_search: null,
              },
            },
          },
        ],
      };
    });

    const { runAiPicksExecutePreview } = await import("@/lib/ai/ai-picks-run-service");
    const result = await runAiPicksExecutePreview({
      source: "sqlite",
      saveId: "save-ai-run",
      seasonId: "season-1",
      dryRun: false,
      confirmToken: "EXECUTE_AI_PICK_RUN",
      teamScope: "all",
      allowSetupAllTeams: true,
    });

    expect(result.executed).toBe(false);
    expect(result.blockingReasons.some((entry) => entry.startsWith("spend_architecture_missing:"))).toBe(true);
    expect(result.blockingReasons.some((entry) => entry.startsWith("spend_factor_missing:"))).toBe(true);
    expect(result.blockingReasons.some((entry) => entry.startsWith("allowed_budget_for_search_missing:"))).toBe(true);
  });

  it("warns when the visible market slice and AI full-pool candidate differ", async () => {
    listLocalTransfermarktFreeAgents.mockImplementation(({ teamId }: { teamId?: string }) => {
      const team = teamId
        ? persistenceState.save.gameState.teams.find((entry) => entry.teamId === teamId) ?? null
        : null;
      return {
        items: [],
        total: 1,
        scope: { saveId: "save-ai-run", seasonId: "season-1", teamId: teamId ?? null },
        saveContext: {
          source: "sqlite",
          requestedSaveId: "save-ai-run",
          resolvedSaveId: "save-ai-run",
          requestedSeasonId: "season-1",
          resolvedSeasonId: "season-1",
          saveName: "AI Run Test Save",
          saveStatus: "active",
          scopeWarning: null,
        },
        teamContext: team
          ? {
              teamId: team.teamId,
              teamCode: team.shortCode,
              teamName: team.name,
              teamCash: team.cash,
            }
          : null,
        poolAudit: {
          visiblePlayers: 1,
          cheapestVisiblePlayer: { playerId: "cheap-real", marketValue: 9 },
        },
      };
    });

    const { runAiPicksExecutePreview } = await import("@/lib/ai/ai-picks-run-service");
    const result = await runAiPicksExecutePreview({
      source: "sqlite",
      saveId: "save-ai-run",
      seasonId: "season-1",
      dryRun: true,
      confirmToken: "EXECUTE_AI_PICK_RUN",
      teamScope: "all",
      allowSetupAllTeams: true,
    });

    expect(result.executed).toBe(false);
    expect(result.preflight.checks.find((entry) => entry.key === "candidate_pool_matches_market")?.status).toBe("warning");
    expect(result.blockingReasons).not.toContain("preflight_blocked:candidate_pool_matches_market");
    expect(result.warnings).toContain("preflight_warning:candidate_pool_matches_market");
  });

  it("executes buys through the local path and verifies transfer history", async () => {
    const { runAiPicksExecutePreview } = await import("@/lib/ai/ai-picks-run-service");
    buildAiNeedsPicksCompare.mockClear();
    const result = await runAiPicksExecutePreview({
      source: "sqlite",
      saveId: "save-ai-run",
      seasonId: "season-1",
      dryRun: false,
      confirmToken: "EXECUTE_AI_PICK_RUN",
      teamScope: "all",
      allowSetupAllTeams: true,
      stepsPerTeam: 1,
    });

    expect(result.executed).toBe(true);
    expect(result.status).toBe("applied");
    expect(result.globalExecution.appliedPickCount).toBe(2);
    expect(result.historyCheck.allAppliedBuysVisible).toBe(true);
    expect(result.teams.find((entry) => entry.teamId === "C-C")?.transferHistoryIds).toEqual(["history-fa-value"]);
    expect(result.teams.find((entry) => entry.teamId === "W-W")?.transferHistoryIds).toEqual(["history-fa-mage"]);
    expect(persistenceState.save.gameState.transferHistory[0]?.source).toBe("ai_roster_fill");
    expect(result.traceParity).toMatchObject({
      dryRunExecuteTraceMatch: true,
      dryRunPickCount: 2,
      executePickCount: 2,
      sameTeams: true,
      samePlayers: true,
      sameOrder: true,
      sameLanes: true,
      sameCosts: true,
    });
    expect(result.traceParity.traceDifferences).toEqual([]);
    expect(buildAiNeedsPicksCompare).toHaveBeenCalledTimes(2);
    expect(result.teams.find((entry) => entry.teamId === "C-C")?.plannedPicks[0]).toMatchObject({
      primaryReason: "Need fuellen",
      secondaryReason: "Profil passt",
      pickLane: "core",
      rosterRole: "Core",
      pickPhase: "minimum_skeleton",
      pickScore: 84,
      teamFit: 4,
      budgetFit: 6,
      mustFeelRightScore: 3,
      pickedForFormColor: false,
    });
  });

  it("blocks execute drift instead of silently replanning when a frozen preview pick becomes invalid", async () => {
    previewLocalTransfermarktBuy.mockImplementationOnce(({ playerId }: { playerId: string }) => ({
      canBuy: false,
      blockingReasons: playerId === "fa-value" ? ["player_not_available_anymore"] : [],
      warnings: ["preview_pick_invalidated"],
      contractLength: 1,
      purchasePrice: 18,
      salary: 3,
      player: { id: playerId, name: playerId, className: "Mercenary", race: "Human" },
      team: { id: "team", name: "Team", shortCode: "TEAM" },
    }));

    const { runAiPicksExecutePreview } = await import("@/lib/ai/ai-picks-run-service");
    const result = await runAiPicksExecutePreview({
      source: "sqlite",
      saveId: "save-ai-run",
      seasonId: "season-1",
      dryRun: false,
      confirmToken: "EXECUTE_AI_PICK_RUN",
      teamScope: "all",
      allowSetupAllTeams: true,
      stepsPerTeam: 1,
    });

    expect(result.executed).toBe(true);
    expect(result.status).toBe("partial_applied");
    expect(result.teams.find((entry) => entry.teamId === "C-C")?.blockingReasons).toContain("preview_execute_drift_blocked");
    expect(result.teams.find((entry) => entry.teamId === "C-C")?.plannedPicks[0]?.status).toBe("blocked");
    expect(result.teams.find((entry) => entry.teamId === "C-C")?.plannedPicks[0]?.warnings).toContain("preview_pick_invalidated");
  });

});
