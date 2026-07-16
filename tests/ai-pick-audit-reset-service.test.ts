import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";

const persistenceState = {
  save: {
    saveId: "save-local",
    name: "AI Pick Smoke Save",
    status: "active",
    gameState: {} as GameState,
  },
  savedSnapshots: [] as GameState[],
};

vi.mock("@/lib/persistence/persistence-service", () => ({
  createPersistenceService: () => ({
    getSaveById: (saveId: string) => (saveId === persistenceState.save.saveId ? persistenceState.save : null),
    saveSingleplayerState: (saveId: string, gameState: GameState) => {
      if (saveId === persistenceState.save.saveId) {
        persistenceState.save = {
          ...persistenceState.save,
          gameState,
        };
        persistenceState.savedSnapshots.push(gameState);
      }
      return persistenceState.save;
    },
  }),
}));

function buildGameState(): GameState {
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
      standings: {},
      teamControlSettings: {
        "C-C": {
          teamId: "C-C",
          controlMode: "ai",
          aiLineupPreviewEnabled: true,
          aiLineupApplyEnabled: true,
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
          aiLineupApplyEnabled: true,
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
          aiLineupApplyEnabled: false,
          aiLineupAutoApplyEnabled: false,
          aiTransferPreviewEnabled: false,
          aiTransferAutoApplyEnabled: false,
          aiSellPreviewEnabled: false,
          aiSellAutoApplyEnabled: false,
        },
      },
      teamStrategyProfiles: {
        "W-W": {
          teamId: "W-W",
          teamCode: "W-W",
          teamName: "Wicked Wizards",
          strategyVersion: "test",
          strategySummary: "Mental/magic roster.",
          buyStyle: "Magic only",
          sellStyle: "Mismatch out",
          contractStyle: "Balanced",
          rosterStyle: "Tight roster",
          preferredArchetypes: [],
          avoidedArchetypes: [],
          preferredRaces: [],
          avoidedRaces: [],
          preferredClasses: ["Mage", "Wizard"],
          avoidedClasses: ["Warlord"],
          hardNoGos: [],
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
    matchdayState: {
      matchdayId: "matchday-1",
      status: "planning",
      pendingTeamIds: [],
      resolvedFixtureIds: [],
    },
    teams: [
      { teamId: "C-C", shortCode: "C-C", name: "Cash Creators", budget: 500, cash: 70, identityId: "C-C", humanControlled: false, rosterLimit: 12 },
      { teamId: "W-W", shortCode: "W-W", name: "Wicked Wizards", budget: 500, cash: 55, identityId: "W-W", humanControlled: false, rosterLimit: 12 },
      { teamId: "M-M", shortCode: "M-M", name: "Mayhem Mavericks", budget: 500, cash: 90, identityId: "M-M", humanControlled: true, rosterLimit: 12 },
    ],
    teamIdentities: [
      { teamId: "C-C", pow: 40, spe: 35, men: 15, soc: 10, ambition: 50, finances: 50, boardConfidence: 50, harmony: 50, manners: 50, popularity: 50, cooperation: 50, playerMin: 2, playerOpt: 4 },
      { teamId: "W-W", pow: 10, spe: 20, men: 50, soc: 20, ambition: 50, finances: 50, boardConfidence: 50, harmony: 50, manners: 50, popularity: 50, cooperation: 50, playerMin: 2, playerOpt: 4 },
      { teamId: "M-M", pow: 40, spe: 25, men: 20, soc: 15, ambition: 50, finances: 50, boardConfidence: 50, harmony: 50, manners: 50, popularity: 50, cooperation: 50, playerMin: 2, playerOpt: 4 },
    ],
    players: [
      {
        id: "core-cc",
        name: "Value Core",
        rating: 55,
        marketValue: 22,
        salaryDemand: 4,
        displayMarketValue: 22,
        displaySalary: 4,
        className: "Scout",
        race: "Human",
        alignment: "neutral",
        gender: "n/a",
        subclasses: [],
        traitsPositive: [],
        traitsNegative: [],
        coreStats: { pow: 52, spe: 44, men: 28, soc: 22 },
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
        id: "core-ww",
        name: "Arcane Core",
        rating: 56,
        marketValue: 23,
        salaryDemand: 4,
        displayMarketValue: 23,
        displaySalary: 4,
        className: "Mage",
        race: "Human",
        alignment: "neutral",
        gender: "n/a",
        subclasses: [],
        traitsPositive: [],
        traitsNegative: [],
        coreStats: { pow: 18, spe: 24, men: 61, soc: 36 },
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
        id: "core-mm",
        name: "Manual Core",
        rating: 57,
        marketValue: 24,
        salaryDemand: 5,
        displayMarketValue: 24,
        displaySalary: 5,
        className: "Hero",
        race: "Human",
        alignment: "neutral",
        gender: "n/a",
        subclasses: [],
        traitsPositive: [],
        traitsNegative: [],
        coreStats: { pow: 50, spe: 42, men: 34, soc: 28 },
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
        id: "pick-berserker",
        name: "Bloodlash",
        rating: 62,
        marketValue: 31,
        salaryDemand: 6,
        displayMarketValue: 31,
        displaySalary: 6,
        className: "Berserker",
        race: "Demon",
        alignment: "chaotic",
        gender: "n/a",
        subclasses: [],
        traitsPositive: [],
        traitsNegative: [],
        coreStats: { pow: 68, spe: 33, men: 19, soc: 12 },
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
        id: "pick-warlord",
        name: "War Tyrant",
        rating: 61,
        marketValue: 34,
        salaryDemand: 7,
        displayMarketValue: 34,
        displaySalary: 7,
        className: "Warlord",
        race: "Orc",
        alignment: "chaotic",
        gender: "n/a",
        subclasses: [],
        traitsPositive: [],
        traitsNegative: [],
        coreStats: { pow: 64, spe: 25, men: 23, soc: 18 },
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
        id: "manual-buy",
        name: "Manual Star",
        rating: 63,
        marketValue: 28,
        salaryDemand: 6,
        displayMarketValue: 28,
        displaySalary: 6,
        className: "Rogue",
        race: "Human",
        alignment: "neutral",
        gender: "n/a",
        subclasses: [],
        traitsPositive: [],
        traitsNegative: [],
        coreStats: { pow: 42, spe: 58, men: 34, soc: 29 },
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
      { id: "roster-core-cc", teamId: "C-C", playerId: "core-cc", contractLength: 2, salary: 4, upkeep: 4, purchasePrice: 22, currentValue: 22, roleTag: "starter", joinedSeasonId: "season-1" },
      { id: "roster-core-ww", teamId: "W-W", playerId: "core-ww", contractLength: 2, salary: 4, upkeep: 4, purchasePrice: 23, currentValue: 23, roleTag: "starter", joinedSeasonId: "season-1" },
      { id: "roster-core-mm", teamId: "M-M", playerId: "core-mm", contractLength: 2, salary: 5, upkeep: 5, purchasePrice: 24, currentValue: 24, roleTag: "starter", joinedSeasonId: "season-1" },
      { id: "roster-pick-berserker", teamId: "C-C", playerId: "pick-berserker", contractLength: 1, salary: 6, upkeep: 6, purchasePrice: 31, currentValue: 31, roleTag: "prospect", joinedSeasonId: "season-1" },
      { id: "roster-pick-warlord", teamId: "W-W", playerId: "pick-warlord", contractLength: 1, salary: 7, upkeep: 7, purchasePrice: 34, currentValue: 34, roleTag: "prospect", joinedSeasonId: "season-1" },
      { id: "roster-manual-buy", teamId: "M-M", playerId: "manual-buy", contractLength: 1, salary: 6, upkeep: 6, purchasePrice: 28, currentValue: 28, roleTag: "prospect", joinedSeasonId: "season-1" },
    ],
    contracts: [],
    transferListings: [],
    transferHistory: [
      {
        id: "history-auto-cc",
        playerId: "pick-berserker",
        seasonId: "season-1",
        matchdayId: "matchday-1",
        phase: "manual_transfer_window",
        source: "auto_roster_fill",
        seasonLabel: "Season 1",
        transferType: "buy",
        fromTeamId: null,
        toTeamId: "C-C",
        fee: 31,
        salary: 6,
        marketValue: 31,
        remainingContractLength: 1,
        happenedAt: "2026-06-07T08:00:00.000Z",
      },
      {
        id: "history-ai-ww",
        playerId: "pick-warlord",
        seasonId: "season-1",
        matchdayId: "matchday-1",
        phase: "manual_transfer_window",
        source: "ai_buy",
        seasonLabel: "Season 1",
        transferType: "buy",
        fromTeamId: null,
        toTeamId: "W-W",
        fee: 34,
        salary: 7,
        marketValue: 34,
        remainingContractLength: 1,
        happenedAt: "2026-06-07T08:10:00.000Z",
      },
      {
        id: "history-manual-mm",
        playerId: "manual-buy",
        seasonId: "season-1",
        matchdayId: "matchday-1",
        phase: "manual_transfer_window",
        source: "manual_transfermarkt_buy",
        seasonLabel: "Season 1",
        transferType: "buy",
        fromTeamId: null,
        toTeamId: "M-M",
        fee: 28,
        salary: 6,
        marketValue: 28,
        remainingContractLength: 1,
        happenedAt: "2026-06-07T08:20:00.000Z",
      },
    ],
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

describe("ai pick audit reset service", () => {
  beforeEach(() => {
    persistenceState.save = {
      ...persistenceState.save,
      gameState: buildGameState(),
    };
    persistenceState.savedSnapshots = [];
  });

  it("audits AI/setup picks, protects manual buys and measures berserker/warlord dominance", async () => {
    const { runAiPickAuditReset } = await import("@/lib/ai/ai-pick-audit-reset-service");

    const result = await runAiPickAuditReset({
      source: "sqlite",
      saveId: "save-local",
      seasonId: "season-1",
      dryRun: true,
    });

    expect(result.dryRun).toBe(true);
    expect(result.summary.autoTransfersFound).toBe(2);
    expect(result.summary.manualTransfersProtected).toBe(1);
    expect(result.summary.berserkerCount).toBe(1);
    expect(result.summary.warlordCount).toBe(1);
    expect(result.summary.berserkerWarlordSharePct).toBe(100);
    expect(result.teams.find((team) => team.teamId === "W-W")?.warningFlags).toContain("avoided_class_pick");
    expect(result.resetPreview.safeTransferIds).toEqual(["history-auto-cc", "history-ai-ww"]);
    expect(persistenceState.savedSnapshots).toHaveLength(0);
  });

  it("executes safe reset only with confirm token and appends rollback history", async () => {
    const { runAiPickAuditReset } = await import("@/lib/ai/ai-pick-audit-reset-service");

    const result = await runAiPickAuditReset({
      source: "sqlite",
      saveId: "save-local",
      seasonId: "season-1",
      dryRun: false,
      confirmToken: "RESET_AI_SETUP_TRANSFERS_ONLY",
      force: true,
    });

    expect(result.executed).toBe(true);
    expect(result.status).toBe("applied");
    expect(result.resetExecution.revertedTransferIds).toEqual(["history-auto-cc", "history-ai-ww"]);
    expect(result.resetExecution.appendedHistoryIds).toHaveLength(2);
    expect(persistenceState.save.gameState.rosters.map((entry) => entry.playerId)).not.toContain("pick-berserker");
    expect(persistenceState.save.gameState.rosters.map((entry) => entry.playerId)).not.toContain("pick-warlord");
    expect(persistenceState.save.gameState.rosters.map((entry) => entry.playerId)).toContain("manual-buy");
    expect(persistenceState.save.gameState.teams.find((team) => team.teamId === "C-C")?.cash).toBe(101);
    expect(persistenceState.save.gameState.teams.find((team) => team.teamId === "W-W")?.cash).toBe(89);
    expect(persistenceState.save.gameState.transferHistory[0]?.source).toBe("reset_auto_roster_fill");
    expect(persistenceState.save.gameState.transferHistory[1]?.source).toBe("reset_ai_buy");
    expect(persistenceState.save.gameState.transferHistory.some((entry) => entry.id === "history-manual-mm")).toBe(true);
  });

  it("blocks unsafe reset candidates when player already left the expected roster", async () => {
    persistenceState.save.gameState = {
      ...buildGameState(),
      rosters: buildGameState().rosters.filter((entry) => entry.playerId !== "pick-warlord"),
    };

    const { runAiPickAuditReset } = await import("@/lib/ai/ai-pick-audit-reset-service");

    const result = await runAiPickAuditReset({
      source: "sqlite",
      saveId: "save-local",
      seasonId: "season-1",
      dryRun: true,
    });

    const blocked = result.resetPreview.candidates.find((entry) => entry.transferId === "history-ai-ww");
    expect(blocked?.status).toBe("blocked_reset");
    expect(blocked?.blockingReasons).toContain("player_not_in_expected_roster");
    expect(result.recommendedRecovery?.action).toBe("create_fresh_test_save");
  });
});
