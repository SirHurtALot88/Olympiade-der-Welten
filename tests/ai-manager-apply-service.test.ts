import { describe, expect, it, vi } from "vitest";

import {
  applyAiManagerPlan,
  buildAiManagerApplyPreview,
  getAiManagerMarketSpendableCash,
} from "@/lib/ai/ai-manager-apply-service";
import type { GameState, Player, Team, TeamIdentity } from "@/lib/data/olyDataTypes";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";
import { previewTeamTrainingSettings } from "@/lib/training/training-settings-service";

function team(overrides: Partial<Team> = {}): Team {
  return {
    teamId: "T-1",
    shortCode: "T1",
    name: "Test Team",
    budget: 120,
    cash: 80,
    identityId: "I-1",
    humanControlled: false,
    rosterLimit: 14,
    rosterMinTarget: 4,
    rosterOptTarget: 6,
    ...overrides,
  };
}

function identity(overrides: Partial<TeamIdentity> = {}): TeamIdentity {
  return {
    teamId: "T-1",
    playerType: "balanced",
    pow: 70,
    spe: 55,
    men: 60,
    soc: 45,
    ambition: 75,
    finances: 70,
    boardConfidence: 60,
    harmony: 60,
    manners: 60,
    popularity: 60,
    cooperation: 65,
    playerMin: 4,
    playerOpt: 6,
    ...overrides,
  };
}

function player(id: string, overrides: Partial<Player> = {}): Player {
  return {
    id,
    name: id,
    rating: 60,
    marketValue: 20,
    salaryDemand: 5,
    displayMarketValue: 20,
    displaySalary: 5,
    className: "Hero",
    race: "Human",
    alignment: "neutral",
    gender: "m",
    subclasses: [],
    traitsPositive: [],
    traitsNegative: [],
    coreStats: { pow: 60, spe: 60, men: 60, soc: 60 },
    preferredDisciplineIds: [],
    disciplineRatings: {},
    disciplineTierCounts: { above20: 0, above40: 0, above60: 0, above80: 0 },
    flavorEn: "",
    flavorDe: "",
    fatigue: 20,
    form: 50,
    potential: 50,
    ...overrides,
  };
}

function gameState(input?: {
  cash?: number;
  playerFatigue?: number[];
  injuries?: string[];
  teamFacilities?: GameState["seasonState"]["teamFacilities"];
  budgetReservations?: GameState["seasonState"]["aiManagerBudgetReservations"];
}): GameState {
  const players = (input?.playerFatigue ?? [20, 22, 24, 26, 28, 30]).map((fatigue, index) =>
    player(`p-${index + 1}`, { fatigue, potential: index < 4 ? 82 : 55 }),
  );
  return {
    gamePhase: "preseason_management",
    season: { id: "season-1", name: "Season 1", year: 1, currentMatchday: 1, matchdayIds: ["matchday-1"] },
    seasonState: {
      seasonId: "season-1",
      schedule: [],
      disciplineSchedule: [],
      standings: {},
      teamControlSettings: {
        "T-1": {
          teamId: "T-1",
          controlMode: "ai",
          aiLineupPreviewEnabled: true,
          aiLineupAutoApplyEnabled: true,
          aiTransferPreviewEnabled: true,
          aiTransferAutoApplyEnabled: false,
          aiSellPreviewEnabled: true,
          aiSellAutoApplyEnabled: false,
        },
      },
      teamFacilities: input?.teamFacilities ?? {
        "T-1": {
          facilities: {
            training_center: { level: 1, enabled: true, conditionPct: 50 },
            recovery_center: { level: 0, enabled: false },
            scouting_office: { level: 0, enabled: false },
            analytics_room: { level: 0, enabled: false },
            fan_shop: { level: 0, enabled: false },
            arena_upgrade: { level: 0, enabled: false },
            academy: { level: 0, enabled: false },
            specialist_wing: { level: 0, enabled: false },
          },
        },
      },
      playerAvailabilityState: (input?.injuries ?? []).map((playerId) => ({
        playerId,
        teamId: "T-1",
        seasonId: "season-1",
        injuryStatus: "injured",
        status: "injured",
        fatigue: 90,
        injuryNote: "injured",
      })),
      aiManagerBudgetReservations: input?.budgetReservations,
    },
    matchdayState: { matchdayId: "matchday-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [team({ cash: input?.cash ?? 80 })],
    teamIdentities: [identity()],
    players,
    disciplines: [],
    rosters: players.map((entry, index) => ({
      id: `r-${index + 1}`,
      teamId: "T-1",
      playerId: entry.id,
      contractLength: index < 2 ? 2 : 1,
      salary: index < 2 ? 6 : 4,
      upkeep: index < 2 ? 6 : 4,
      roleTag: index < 2 ? "starter" : "prospect",
      joinedSeasonId: "season-1",
    })),
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
    mappingReport: {
      mappingSource: "test",
      teamSource: "test",
      generatedAt: "2026-06-14T00:00:00.000Z",
      processedMappingRows: 0,
      importedPlayerCount: 0,
      matchedRosterCount: 0,
      teamCount: 1,
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

function save(state = gameState()): PersistedSaveGame {
  return {
    saveId: "save-test",
    name: "Test Save",
    status: "active",
    createdAt: "2026-06-14T00:00:00.000Z",
    updatedAt: "2026-06-14T00:00:00.000Z",
    gameState: state,
  };
}

function persistenceMock(initial: PersistedSaveGame) {
  let current = initial;
  const saveSingleplayerState = vi.fn((saveId: string, nextGameState: GameState) => {
    current = { ...current, saveId, gameState: nextGameState };
    return current;
  });
  return {
    persistence: {
      saveSingleplayerState,
      getSaveById: vi.fn(() => current),
    } as unknown as PersistenceService,
    get current() {
      return current;
    },
    saveSingleplayerState,
  };
}

describe("ai manager apply service", () => {
  it("orders maintenance before upgrades and buys", () => {
    const preview = buildAiManagerApplyPreview(save());
    const maintenanceIndex = preview.actions.findIndex((action) => action.actionType === "maintain_building");
    const upgradeIndex = preview.actions.findIndex((action) => action.actionType === "upgrade_building" || action.actionType === "buy_building");

    expect(maintenanceIndex).toBeGreaterThanOrEqual(0);
    expect(upgradeIndex).toBeGreaterThanOrEqual(0);
    expect(maintenanceIndex).toBeLessThan(upgradeIndex);
  });

  it("keeps building and maintenance reserves out of AI market spendable cash", () => {
    const state = gameState({
      cash: 100,
      budgetReservations: {
        "T-1": {
          teamId: "T-1",
          seasonId: "season-1",
          sourcePlanId: "test-plan",
          cashReserve: 10,
          salaryReserve: 15,
          transferBudget: 18,
          buildingBudget: 25,
          maintenanceBudget: 20,
          emergencyBudget: 8,
          updatedAt: "2026-06-14T00:00:00.000Z",
        },
      },
    });

    expect(getAiManagerMarketSpendableCash(state, "T-1", 100)).toBe(18);
  });

  it("stores team training settings and player training modes through the training service", () => {
    const source = save();
    const mock = persistenceMock(source);
    const result = applyAiManagerPlan({
      save: source,
      dryRun: false,
      actionTypes: ["set_training_focus", "set_training_intensity"],
      persistence: mock.persistence,
    });

    expect(result.applied).toBe(true);
    expect(mock.current.gameState.seasonState.aiManagerTrainingSettings?.["T-1"]).toMatchObject({
      teamId: "T-1",
      trainingIntensity: "hard",
      playerTrainingMode: "hart",
    });
    expect(mock.current.gameState.players.every((entry) => entry.trainingMode === "hart")).toBe(true);
  });

  it("hard training lowers recovery forecast while light training improves it", () => {
    const source = save();
    const hard = previewTeamTrainingSettings({
      save: source,
      teamId: "T-1",
      trainingFocus: "BALANCED",
      trainingIntensity: "hard",
    });
    const light = previewTeamTrainingSettings({
      save: source,
      teamId: "T-1",
      trainingFocus: "RECOVERY",
      trainingIntensity: "light",
    });

    expect(hard.expectedRecoveryEffect).toBeLessThan(100);
    expect(light.expectedRecoveryEffect).toBeGreaterThan(100);
  });

  it("blocks luxury building actions for negative cash teams", () => {
    const preview = buildAiManagerApplyPreview(save(gameState({ cash: -5 })));
    const luxuryActions = preview.actions.filter((action) => action.actionType === "upgrade_building" || action.actionType === "buy_building");

    expect(luxuryActions.every((action) => !action.canApply || action.blockers.includes("negative_cash_blocks_luxury"))).toBe(true);
  });
});
