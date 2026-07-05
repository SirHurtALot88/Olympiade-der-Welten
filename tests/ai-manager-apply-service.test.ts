import { describe, expect, it, vi } from "vitest";

import {
  applyAiManagerPlan,
  applyTransferBudgetSpend,
  buildAiManagerApplyPreview,
  getAiManagerMarketSpendableCash,
  resolveMarketSpendableCashForPlanner,
} from "@/lib/ai/ai-manager-apply-service";
import { buildAiLeagueManagementPreview } from "@/lib/ai/ai-team-management-preview-service";
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

  it("does not phantom-deduct unspent building budget from AI market spendable cash", () => {
    const state = gameState({
      cash: 100,
      budgetReservations: {
        "T-1": {
          teamId: "T-1",
          seasonId: "season-1",
          sourcePlanId: "test-plan",
          cashReserve: 10,
          salaryReserve: 10,
          transferBudget: 80,
          buildingBudget: 35,
          maintenanceBudget: 15,
          emergencyBudget: 5,
          updatedAt: "2026-06-14T00:00:00.000Z",
        },
      },
    });

    // Only salary/maintenance/emergency are protected buffers; unspent buildingBudget/cashReserve
    // still physically sit in team.cash and must not be double-subtracted from the transfer pool.
    expect(getAiManagerMarketSpendableCash(state, "T-1", 100)).toBe(70);
  });

  it("only opens drawable budget pools when includeFallbackPools (rebuild mode) is set", () => {
    const state = gameState({
      cash: 100,
      budgetReservations: {
        "T-1": {
          teamId: "T-1",
          seasonId: "season-1",
          sourcePlanId: "test-plan",
          cashReserve: 10,
          salaryReserve: 10,
          transferBudget: 5,
          buildingBudget: 12,
          maintenanceBudget: 15,
          emergencyBudget: 5,
          updatedAt: "2026-06-14T00:00:00.000Z",
        },
      },
    });

    expect(getAiManagerMarketSpendableCash(state, "T-1", 100)).toBe(5);
    // Rebuild: transfer + building + combined liquidity reserve; emergency + maintenance stay protected.
    expect(
      getAiManagerMarketSpendableCash(state, "T-1", 100, { includeFallbackPools: true }),
    ).toBe(37);
  });

  it("decrements transferBudget when a market buy executes", () => {
    const state = gameState({
      cash: 100,
      budgetReservations: {
        "T-1": {
          teamId: "T-1",
          seasonId: "season-1",
          sourcePlanId: "test-plan",
          cashReserve: 10,
          salaryReserve: 10,
          transferBudget: 40,
          buildingBudget: 20,
          maintenanceBudget: 10,
          emergencyBudget: 5,
          updatedAt: "2026-06-14T00:00:00.000Z",
        },
      },
    });

    const next = applyTransferBudgetSpend(state, "T-1", 12);
    expect(next.seasonState.aiManagerBudgetReservations?.["T-1"]?.transferBudget).toBe(28);
  });

  it("cascades spend through buildingBudget, cashReserve, salaryReserve, maintenanceBudget once transferBudget is exhausted", () => {
    const state = gameState({
      cash: 100,
      budgetReservations: {
        "T-1": {
          teamId: "T-1",
          seasonId: "season-1",
          sourcePlanId: "test-plan",
          cashReserve: 10,
          salaryReserve: 10,
          transferBudget: 15,
          buildingBudget: 8,
          maintenanceBudget: 10,
          emergencyBudget: 5,
          updatedAt: "2026-06-14T00:00:00.000Z",
        },
      },
    });

    const next = applyTransferBudgetSpend(state, "T-1", 20);
    const reservation = next.seasonState.aiManagerBudgetReservations?.["T-1"];
    expect(reservation?.transferBudget).toBe(0);
    expect(reservation?.buildingBudget).toBe(3);
    expect(reservation?.cashReserve).toBe(10);

    const beyondBuildingAndCashReserve = applyTransferBudgetSpend(state, "T-1", 30);
    const reservation2 = beyondBuildingAndCashReserve.seasonState.aiManagerBudgetReservations?.["T-1"];
    expect(reservation2?.transferBudget).toBe(0);
    expect(reservation2?.buildingBudget).toBe(0);
    expect(reservation2?.cashReserve).toBe(3);
    expect(reservation2?.salaryReserve).toBe(10);
    expect(reservation2?.emergencyBudget).toBe(5);

    const beyondAllPools = applyTransferBudgetSpend(state, "T-1", 53);
    const reservation3 = beyondAllPools.seasonState.aiManagerBudgetReservations?.["T-1"];
    expect(reservation3?.transferBudget).toBe(0);
    expect(reservation3?.buildingBudget).toBe(0);
    expect(reservation3?.cashReserve).toBe(0);
    expect(reservation3?.salaryReserve).toBe(0);
    expect(reservation3?.maintenanceBudget).toBe(0);
    expect(reservation3?.emergencyBudget).toBe(5);
  });

  it("caps planner market spend at transfer bucket when reservations exist and roster is at Opt", () => {
    const playersAtOpt = Array.from({ length: 8 }, (_, index) => player(`p-${index + 1}`));
    const state = gameState({
      cash: 100,
      playerFatigue: playersAtOpt.map(() => 20),
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
    state.players = playersAtOpt;
    state.rosters = playersAtOpt.map((entry, index) => ({
      id: `r-${index + 1}`,
      teamId: "T-1",
      playerId: entry.id,
      contractLength: 2,
      salary: 5,
      upkeep: 5,
      roleTag: "starter",
      joinedSeasonId: "season-1",
    }));

    expect(
      resolveMarketSpendableCashForPlanner({
        gameState: state,
        teamId: "T-1",
        teamCash: 100,
        rosterBelowMin: false,
      }),
    ).toBe(18);
  });

  it("S2+ ignores stale budget buckets and uses 10% MW buffer", () => {
    const state = gameState({
      cash: 154,
      budgetReservations: {
        "T-1": {
          teamId: "T-1",
          seasonId: "season-2",
          sourcePlanId: "test-plan",
          cashReserve: 10,
          salaryReserve: 15,
          transferBudget: 0,
          buildingBudget: 0,
          maintenanceBudget: 10,
          emergencyBudget: 5,
          updatedAt: "2026-06-14T00:00:00.000Z",
        },
      },
    });
    state.season = { ...state.season, id: "season-2", name: "Season 2" };
    state.seasonState.seasonId = "season-2";
    state.players = [player("p1", { marketValue: 200, displayMarketValue: 200 })];
    state.rosters = [{ id: "r1", teamId: "T-1", playerId: "p1", slot: 0, salary: 2, contractLength: 2, upkeep: 2, roleTag: "starter", joinedSeasonId: "season-2" }];

    const spendable = resolveMarketSpendableCashForPlanner({
      gameState: state,
      teamId: "T-1",
      teamCash: 154,
      rosterBelowMin: false,
    });

    expect(spendable).toBe(134);
  });

  it("unlocks current cash for hard-min fill even when stale budget reservations exist", () => {
    const state = gameState({
      cash: 154,
      rosters: [{ id: "r1", teamId: "T-1", playerId: "p1", slot: 0, salary: 2 }],
      players: [player("p1")],
      budgetReservations: {
        "T-1": {
          teamId: "T-1",
          seasonId: "season-2",
          sourcePlanId: "test-plan",
          cashReserve: 10,
          salaryReserve: 15,
          transferBudget: 8,
          buildingBudget: 5,
          maintenanceBudget: 10,
          emergencyBudget: 5,
          updatedAt: "2026-06-14T00:00:00.000Z",
        },
      },
    });

    const spendable = resolveMarketSpendableCashForPlanner({
      gameState: state,
      teamId: "T-1",
      teamCash: 154,
      rosterBelowMin: true,
    });

    expect(spendable).toBeGreaterThan(140);
    expect(spendable).toBeLessThan(154);
  });

  it("falls back to salary runway reserve when no budget reservations exist and roster is at Opt", () => {
    const playersAtOpt = Array.from({ length: 8 }, (_, index) => player(`p-${index + 1}`));
    const state = gameState({ cash: 100, playerFatigue: playersAtOpt.map(() => 20) });
    state.players = playersAtOpt;
    state.rosters = playersAtOpt.map((entry, index) => ({
      id: `r-${index + 1}`,
      teamId: "T-1",
      playerId: entry.id,
      contractLength: 2,
      salary: 5,
      upkeep: 5,
      roleTag: "starter",
      joinedSeasonId: "season-1",
    }));

    const spendable = resolveMarketSpendableCashForPlanner({
      gameState: state,
      teamId: "T-1",
      teamCash: 100,
      rosterBelowMin: false,
    });

    expect(spendable).toBeGreaterThan(0);
    expect(spendable).toBeLessThan(100);
  });

  it("unlocks most cash for draft when roster is below Opt", () => {
    const state = gameState({
      cash: 50,
      rosters: [
        { id: "r1", teamId: "T-1", playerId: "p1", slot: 0, salary: 5 },
        { id: "r2", teamId: "T-1", playerId: "p2", slot: 1, salary: 5 },
      ],
      players: [player("p1"), player("p2")],
    });

    const spendable = resolveMarketSpendableCashForPlanner({
      gameState: state,
      teamId: "T-1",
      teamCash: 50,
      rosterBelowMin: false,
    });

    expect(spendable).toBeGreaterThan(35);
    expect(spendable).toBeLessThan(50);
  });

  it("applies maintenance through the facility service and restores condition", () => {
    const source = save();
    const mock = persistenceMock(source);
    const result = applyAiManagerPlan({
      save: source,
      dryRun: false,
      actionTypes: ["maintain_building"],
      persistence: mock.persistence,
    });

    const appliedMaintenance = result.actions.find((action) => action.actionType === "maintain_building" && action.applied);
    const team = mock.current.gameState.teams.find((entry) => entry.teamId === "T-1");
    const trainingCenter = mock.current.gameState.seasonState.teamFacilities?.["T-1"]?.facilities.training_center;

    expect(appliedMaintenance).toBeTruthy();
    expect(team?.cash).toBeLessThan(80);
    expect(trainingCenter?.conditionPct).toBe(100);
    expect(mock.current.gameState.seasonState.facilityEvents?.[0]?.source).toBe("manual_facility_maintenance");
  });

  it("applies building upgrades through the facility service and resets condition", () => {
    const source = save(gameState({ cash: 200 }));
    const mock = persistenceMock(source);
    const result = applyAiManagerPlan({
      save: source,
      dryRun: false,
      actionTypes: ["upgrade_building", "buy_building"],
      persistence: mock.persistence,
    });

    const appliedUpgrade = result.actions.find(
      (action) => (action.actionType === "upgrade_building" || action.actionType === "buy_building") && action.applied,
    );
    const team = mock.current.gameState.teams.find((entry) => entry.teamId === "T-1");
    const facilityId = appliedUpgrade?.facilityId;

    expect(appliedUpgrade).toBeTruthy();
    expect(team?.cash).toBeLessThan(200);
    expect(facilityId ? mock.current.gameState.seasonState.teamFacilities?.["T-1"]?.facilities[facilityId]?.conditionPct : null).toBe(100);
    expect(mock.current.gameState.seasonState.facilityEvents?.[0]?.source).toBe("manual_facility_upgrade");
  });

  it("lets AI downgrade low-priority buildings under cash pressure", () => {
    const source = save(gameState({
      cash: 2,
      teamFacilities: {
        "T-1": {
          facilities: {
            analytics_room: { level: 3, enabled: true, conditionPct: 45 },
          },
        },
      },
    }));
    const preview = buildAiManagerApplyPreview(source);
    const plannedDowngrade = preview.actions.find((action) => action.actionType === "downgrade_building");
    const mock = persistenceMock(source);
    const result = applyAiManagerPlan({
      save: source,
      dryRun: false,
      actionTypes: ["downgrade_building"],
      persistence: mock.persistence,
    });

    const appliedDowngrade = result.actions.find((action) => action.actionType === "downgrade_building" && action.applied);
    const analyticsRoom = mock.current.gameState.seasonState.teamFacilities?.["T-1"]?.facilities.analytics_room;

    expect(plannedDowngrade).toBeTruthy();
    expect(appliedDowngrade).toBeTruthy();
    expect(appliedDowngrade?.cost).toBeLessThan(0);
    expect(mock.current.gameState.teams.find((team) => team.teamId === "T-1")?.cash).toBeGreaterThan(2);
    expect(analyticsRoom).toMatchObject({ level: 2, enabled: true, conditionPct: 100 });
    expect(mock.current.gameState.seasonState.facilityEvents?.[0]?.source).toBe("manual_facility_downgrade");
  });

  it("stores team training settings and per-player training modes through the training service", () => {
    const source = save();
    const mock = persistenceMock(source);
    const leaguePreview = buildAiLeagueManagementPreview(source.gameState);
    const teamPreview = leaguePreview.teams.find((team) => team.teamId === "T-1");
    expect(teamPreview?.trainingPlan.playerTrainingPlans.length).toBeGreaterThan(0);
    const result = applyAiManagerPlan({
      save: source,
      dryRun: false,
      actionTypes: ["set_training_focus", "set_training_intensity", "set_player_training_modes"],
      persistence: mock.persistence,
    });

    expect(result.applied).toBe(true);
    expect(mock.current.gameState.seasonState.aiManagerTrainingSettings?.["T-1"]).toMatchObject({
      teamId: "T-1",
      trainingIntensity: "hard",
      playerTrainingMode: "hart",
    });
    expect(mock.current.gameState.players.every((entry) => entry.trainingMode != null)).toBe(true);
    expect(result.actions.some((action) => action.actionType === "set_player_training_modes" && action.applied)).toBe(true);
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
