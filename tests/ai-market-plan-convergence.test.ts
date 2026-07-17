import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";

const applyAiMarketPlanLocally = vi.hoisted(() => vi.fn());

vi.mock("@/lib/ai/ai-market-plan-apply-service", () => ({
  applyAiMarketPlanLocally,
}));

vi.mock("@/lib/ai/chunked-redraft-topup-service", () => ({
  CHUNKED_REDRAFT_TOPUP_CONFIRM_TOKEN: "CONFIRM",
  runChunkedRedraftTopup: vi.fn(() => ({
    picks: [],
    warnings: [],
  })),
}));

import {
  getTeamHardMinRequired,
  getTeamOptTarget,
  getTeamsBelowHardMin,
  resolveActiveConvergencePickEngine,
  runEmergencyRosterRepairForTeams,
  runMarketPlanConvergence,
  teamNeedsMarketConvergence,
  teamSkipsPreseasonMarketBuys,
} from "@/lib/ai/ai-market-plan-convergence-service";
import { makeRosterEntry, makeScheduleEntry, makeScheduleSlot, makeTeam, makeTeamIdentity } from "./_fixtures/game-entity-fixtures";

function buildRoster(teamId: string, count: number, idPrefix: string) {
  return Array.from({ length: count }, (_, index) =>
    makeRosterEntry({ id: `r-${idPrefix}-${index}`, teamId, playerId: `p-${idPrefix}-${index}` }),
  );
}

function buildGameState(overrides?: Partial<GameState>): GameState {
  return {
    season: { id: "season-2", name: "Season 2", year: 2027, currentMatchday: 1, matchdayIds: ["md-1"] },
    seasonState: {
      seasonId: "season-2",
      schedule: [],
      standings: {},
      teamControlSettings: {},
      teamStrategyProfiles: {},
      disciplineSchedule: [
        makeScheduleEntry({
          seasonId: "season-2",
          matchdayId: "md-1",
          discipline1: makeScheduleSlot({ disciplineId: "d1", playerCount: 4 }),
          discipline2: makeScheduleSlot({ disciplineId: "d2", playerCount: 4 }),
        }),
      ],
    },
    matchdayState: { matchdayId: "md-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [
      makeTeam({ teamId: "team-a", name: "Team A", shortCode: "TMA", cash: 100 }),
      makeTeam({ teamId: "team-b", name: "Team B", shortCode: "TMB", cash: 50 }),
    ],
    teamIdentities: [
      makeTeamIdentity({ teamId: "team-a", playerMin: 8, playerOpt: 10 }),
      makeTeamIdentity({ teamId: "team-b", playerMin: 8, playerOpt: 10 }),
    ],
    rosters: [...buildRoster("team-a", 6, "a"), ...buildRoster("team-b", 8, "b")],
    players: [],
    disciplines: [],
    transferHistory: [],
    ...overrides,
  } as GameState;
}

// Minimal saveSingleplayerState stub: runTransferWindowSession may originate AI loans mid-session
// (see ai-transfer-window-session-service.ts), which persists the post-loan gameState via
// persistence.saveSingleplayerState. The test doubles below only implement getSaveById, so any
// persistence object handed to runMarketPlanConvergence needs this stub to avoid a runtime
// "not a function" crash whenever a scenario's cash pressure triggers an AI borrow decision.
function stubSaveSingleplayerState(_saveId: string, nextGameState: GameState) {
  return {
    saveId: "save-1",
    name: "Test Save",
    status: "active" as const,
    createdAt: "2027-01-01T00:00:00.000Z",
    updatedAt: "2027-01-01T00:00:00.000Z",
    gameState: nextGameState,
  };
}

function buildApplyResult(input: {
  appliedBuys?: number;
  appliedSells?: number;
  teamId?: string;
  rosterAfter?: number;
  executedBuys?: number;
  blockingReasons?: string[];
  result?: string;
}) {
  const teamId = input.teamId ?? "team-a";
  return {
    status: "applied",
    summary: {
      appliedBuys: input.appliedBuys ?? 0,
      appliedSells: input.appliedSells ?? 0,
      blockedTeams: 0,
    },
    teams: [
      {
        teamId,
        teamName: "Team A",
        result: input.result ?? "applied",
        executedBuys: input.executedBuys ?? input.appliedBuys ?? 0,
        executedSells: input.appliedSells ?? 0,
        rosterAfter: input.rosterAfter ?? 6,
        rosterBefore: 6,
        blockingReasons: input.blockingReasons ?? [],
        warnings: [],
        appliedBuyDetails: [],
        appliedSellDetails: [],
        plannedBuyDetails: [],
        plannedSellDetails: [],
        skippedSteps: [],
      },
    ],
    blockingReasons: input.blockingReasons ?? [],
    warnings: [],
    buyGateRows: [],
  };
}

describe("ai market plan convergence service", () => {
  beforeEach(() => {
    applyAiMarketPlanLocally.mockReset();
  });

  // Design correction (2026-07-04): runMarketPlanConvergence always drives runTransferWindowSession
  // with phase: "preseason", which is now strictly buy-only (sell and buy no longer coexist in the
  // same cycle — see ai-transfer-window-session-service.ts). A below-Opt team that never lands a buy
  // there is "convergence_exhausted", not "valid_sell_only_below_min" (that status now only arises
  // from a season_end sell-only session — see tests/ai-transfer-window-session.test.ts).
  it("keeps a below-Opt team exhausted (not blocked) when preseason buys don't land, and never attempts a sell", async () => {
    const gameState = buildGameState({
      rosters: buildRoster("team-a", 9, "a"),
    });
    const persistence = {
      getSaveById: () => ({ saveId: "save-1", gameState }),
      saveSingleplayerState: stubSaveSingleplayerState,
    };

    applyAiMarketPlanLocally.mockResolvedValue(
      buildApplyResult({ appliedBuys: 0, appliedSells: 0, rosterAfter: 9, result: "hold" }),
    );

    const result = await runMarketPlanConvergence({
      saveId: "save-1",
      seasonId: "season-2",
      persistence: persistence as never,
      transferPhase: "manual_transfer_window",
      maxPasses: 1,
      maxRoundsPerPass: 1,
      skipIfExistingMarketTransfers: false,
    });

    expect(result.blockingReasons).toEqual([]);
    expect(result.perTeam[0]?.status).toBe("convergence_exhausted");
    expect(result.emergencyRepairTeams).not.toContain("team-a");
    expect(applyAiMarketPlanLocally.mock.calls.every((call) => call[0].options?.applySellSteps === false)).toBe(
      true,
    );
  });

  it("blocks teams when buys finish below playerMin", async () => {
    const gameState = buildGameState({
      rosters: buildRoster("team-a", 7, "a"),
    });
    const persistence = {
      getSaveById: () => ({ saveId: "save-1", gameState }),
      saveSingleplayerState: stubSaveSingleplayerState,
    };

    applyAiMarketPlanLocally.mockResolvedValue(
      buildApplyResult({
        appliedBuys: 1,
        executedBuys: 1,
        rosterAfter: 7,
        blockingReasons: ["roster_after_market_plan_below_player_min"],
        result: "blocked",
      }),
    );

    const result = await runMarketPlanConvergence({
      saveId: "save-1",
      seasonId: "season-2",
      persistence: persistence as never,
      transferPhase: "manual_transfer_window",
      maxPasses: 1,
      maxRoundsPerPass: 1,
      skipIfExistingMarketTransfers: false,
    });

    expect(result.perTeam[0]?.status).toBe("blocked");
  });

  it("runs a second pass with different profile when the first pass stalls", async () => {
    let call = 0;
    let rosterCount = 6;
    const persistence = {
      getSaveById: () => ({
        saveId: "save-1",
        gameState: buildGameState({
          rosters: buildRoster("team-a", rosterCount, "a"),
        }),
      }),
      saveSingleplayerState: stubSaveSingleplayerState,
    };

    applyAiMarketPlanLocally.mockImplementation(async (params) => {
      call += 1;
      if (params.options?.applySellSteps && !params.options?.applyBuySteps) {
        return buildApplyResult({ appliedSells: 1, rosterAfter: 6 });
      }
      rosterCount = 8;
      // Mirror what the real applyAiMarketPlanLocally does when given a localRunContext: it writes
      // the post-apply state back into runContext.save so subsequent readLiveSave() calls in
      // runTransferWindowSession see the updated roster instead of the stale save captured when the
      // session context was created. Without this, rosterAfter checks in resolveTeamStatus keep
      // seeing the pre-buy roster count forever and team-a would wrongly stay "blocked".
      if (params.localRunContext?.save) {
        params.localRunContext.save = {
          ...params.localRunContext.save,
          gameState: buildGameState({
            rosters: buildRoster("team-a", rosterCount, "a"),
          }),
        };
      }
      return buildApplyResult({ appliedBuys: 2, appliedSells: 0, rosterAfter: rosterCount, executedBuys: 2 });
    });

    const result = await runMarketPlanConvergence({
      saveId: "save-1",
      seasonId: "season-2",
      persistence: persistence as never,
      transferPhase: "manual_transfer_window",
      maxPasses: 2,
      maxRoundsPerPass: 1,
      skipIfExistingMarketTransfers: false,
    });

    expect(call).toBeGreaterThanOrEqual(2);
    expect(result.passes).toBe(2);
    expect(result.appliedBuys).toBeGreaterThan(0);
    expect(result.emergencyRepairTeams).not.toContain("team-a");
  });

  it("does not repeat identical round fingerprints and escalates to emergency repair", async () => {
    let call = 0;
    const gameState = buildGameState();
    const persistence = {
      getSaveById: () => ({ saveId: "save-1", gameState }),
      saveSingleplayerState: stubSaveSingleplayerState,
    };

    applyAiMarketPlanLocally.mockImplementation(async () => {
      call += 1;
      return buildApplyResult({ appliedBuys: 0, appliedSells: 0, rosterAfter: 6, result: "hold" });
    });

    const result = await runMarketPlanConvergence({
      saveId: "save-1",
      seasonId: "season-2",
      persistence: persistence as never,
      transferPhase: "manual_transfer_window",
      maxPasses: 2,
      maxRoundsPerPass: 4,
      skipIfExistingMarketTransfers: false,
    });

    expect(call).toBeLessThan(8);
    expect(result.warnings.some((entry) => entry.startsWith("transfer_window_stalled"))).toBe(true);
    expect(result.emergencyRepairTeams).toContain("team-a");
    expect(result.perTeam[0]?.status).toBe("convergence_exhausted");
  });

  it("passes exclude lists to avoid repeating the same blocked buy candidate for the next team", async () => {
    // Note: buildGameState's `rosters` override replaces the whole roster list, so team-b (not
    // overridden below) implicitly has 0 rosters here and is below hardMin — both teams need
    // convergence and get their own buy-only preseason cycle.
    const gameState = buildGameState({
      rosters: buildRoster("team-a", 9, "a"),
    });
    const persistence = {
      getSaveById: () => ({ saveId: "save-1", gameState }),
      saveSingleplayerState: stubSaveSingleplayerState,
    };

    applyAiMarketPlanLocally
      .mockResolvedValueOnce({
        ...buildApplyResult({ appliedBuys: 0, appliedSells: 0, rosterAfter: 9 }),
        buyGateRows: [{ teamId: "team-a", playerId: "fa-blocked", reason: "cash_buffer_failed" }],
        teams: [
          {
            ...buildApplyResult({ rosterAfter: 9 }).teams[0],
            plannedBuyDetails: [{ stepType: "buy", playerId: "fa-blocked", playerName: "Blocked", amount: 10, salaryImpact: 1, rosterImpact: 1, status: "blocked", reason: "cash" }],
            skippedSteps: [],
          },
        ],
      })
      .mockResolvedValue(buildApplyResult({ appliedBuys: 0, appliedSells: 0, rosterAfter: 0, teamId: "team-b" }));

    const { runMarketPlanConvergence } = await import("@/lib/ai/ai-market-plan-convergence-service");
    await runMarketPlanConvergence({
      saveId: "save-1",
      seasonId: "season-2",
      persistence: persistence as never,
      transferPhase: "manual_transfer_window",
      maxPasses: 1,
      maxRoundsPerPass: 1,
      skipIfExistingMarketTransfers: false,
    });

    const secondCall = applyAiMarketPlanLocally.mock.calls[1]?.[0];
    expect(secondCall?.options?.excludeBuyPlayerIds).toContain("fa-blocked");
  });

  it("skips convergence for team already at identity opt even when below slot depth", async () => {
    const gameState = buildGameState({
      teams: [makeTeam({ teamId: "team-bp", name: "BP", shortCode: "B-P", cash: 5 })],
      teamIdentities: [makeTeamIdentity({ teamId: "team-bp", playerMin: 8, playerOpt: 10 })],
      rosters: buildRoster("team-bp", 10, "bp"),
      seasonState: {
        seasonId: "season-2",
        schedule: [],
        standings: {},
        teamControlSettings: {},
        teamStrategyProfiles: {},
        disciplineSchedule: [
          makeScheduleEntry({
            seasonId: "season-2",
            matchdayId: "md-1",
            discipline1: makeScheduleSlot({ disciplineId: "d1", playerCount: 6 }),
            discipline2: makeScheduleSlot({ disciplineId: "d2", playerCount: 6 }),
          }),
        ],
      },
    });
    const persistence = {
      getSaveById: () => ({ saveId: "save-1", gameState }),
      saveSingleplayerState: stubSaveSingleplayerState,
    };

    const result = await runMarketPlanConvergence({
      saveId: "save-1",
      seasonId: "season-2",
      persistence: persistence as never,
      transferPhase: "manual_transfer_window",
      targetTeamIds: ["team-bp"],
      maxPasses: 2,
      maxRoundsPerPass: 4,
      skipIfExistingMarketTransfers: false,
    });

    expect(applyAiMarketPlanLocally).not.toHaveBeenCalled();
    expect(result.emergencyRepairTeams).not.toContain("team-bp");
    expect(result.rounds).toBe(0);
    expect(getTeamOptTarget(gameState, "team-bp")).toBe(10);
  });
  it("tags exhausted teams for repair engine logging", async () => {
    process.env.OLY_UNIFIED_PICK = "1";
    const gameState = buildGameState({
      rosters: buildRoster("team-a", 6, "a"),
    });
    const persistence = { getSaveById: () => ({ saveId: "save-1", gameState }), saveSingleplayerState: stubSaveSingleplayerState };
    applyAiMarketPlanLocally.mockResolvedValue(buildApplyResult({ appliedBuys: 0, appliedSells: 0, rosterAfter: 6 }));

    const result = await runMarketPlanConvergence({
      saveId: "save-1",
      seasonId: "season-2",
      persistence: persistence as never,
      transferPhase: "manual_transfer_window",
      maxPasses: 1,
      maxRoundsPerPass: 1,
      skipIfExistingMarketTransfers: false,
    });

    expect(resolveActiveConvergencePickEngine()).toBe("unified");
    const teamA = result.perTeam.find((entry) => entry.teamId === "team-a");
    expect(teamA?.pickEngine).toBeDefined();
    delete process.env.OLY_UNIFIED_PICK;
  });
});

describe("teamNeedsMarketConvergence", () => {
  it("grants a buy pass to cash_recovery teams between hardMin and Opt (regression: gate used to block them)", () => {
    const gameState = buildGameState({
      teams: [makeTeam({ teamId: "team-a", name: "Team A", shortCode: "TMA", cash: -10 })],
      rosters: buildRoster("team-a", 9, "a"),
    });

    // Roster (9) sits strictly between hardMin (8) and Opt (10); negative cash drives the
    // doctrine strategy to cash_recovery. Before the fix, cash_recovery was excluded from
    // CONVERGENCE_BUY_STRATEGIES and this returned false, leaving the team stuck without
    // real buys until it fell below hardMin into the weaker emergency-repair fallback.
    expect(teamNeedsMarketConvergence(gameState, "team-a")).toBe(true);
  });

  it("grants a buy pass to eco_round teams between hardMin and Opt (regression: gate used to freeze them out for the whole season)", () => {
    const gameState = buildGameState({
      teams: [makeTeam({ teamId: "team-a", name: "Team A", shortCode: "TMA", cash: 100 })],
      teamIdentities: [
        makeTeamIdentity({ teamId: "team-a", playerMin: 8, playerOpt: 10, finances: 9 }),
        makeTeamIdentity({ teamId: "team-b", playerMin: 8, playerOpt: 10 }),
      ],
      rosters: buildRoster("team-a", 9, "a"),
    });

    // Roster (9) sits strictly between hardMin (8) and Opt (10), cash is healthy and positive —
    // only the team's high identity.finances (>=8) drives the doctrine strategy to eco_round. Before
    // the fix, eco_round was excluded from CONVERGENCE_BUY_STRATEGIES and this returned false,
    // permanently freezing the team out of every convergence buy pass for the rest of the season
    // regardless of how much cash it had (the exact "Opt-skip that strands them" failure mode the
    // comment above CONVERGENCE_BUY_STRATEGIES already warns against for cash_recovery).
    expect(teamNeedsMarketConvergence(gameState, "team-a")).toBe(true);
  });

  it("grants a buy pass to balanced_growth teams between hardMin and Opt (regression: strategy gate used to stop at hardMin)", () => {
    const gameState = buildGameState({
      teams: [makeTeam({ teamId: "team-a", name: "Team A", shortCode: "TMA", cash: 40 })],
      rosters: buildRoster("team-a", 9, "a"),
    });

    expect(teamNeedsMarketConvergence(gameState, "team-a")).toBe(true);
  });

  it("still skips convergence once a team reaches Opt, regardless of cash pressure", () => {
    const gameState = buildGameState({
      teams: [makeTeam({ teamId: "team-a", name: "Team A", shortCode: "TMA", cash: -10 })],
      rosters: buildRoster("team-a", 10, "a"),
    });

    expect(teamNeedsMarketConvergence(gameState, "team-a")).toBe(false);
    expect(teamSkipsPreseasonMarketBuys(gameState, "team-a")).toBe(true);
  });

  it("still allows market buys below Opt including emergency gap above hardMin", () => {
    const gameState = buildGameState({
      teams: [makeTeam({ teamId: "team-a", name: "Team A", shortCode: "TMA", cash: 40 })],
      rosters: buildRoster("team-a", 5, "a"),
    });

    expect(teamSkipsPreseasonMarketBuys(gameState, "team-a")).toBe(false);
    expect(teamNeedsMarketConvergence(gameState, "team-a")).toBe(true);
  });
});

describe("emergency roster repair helper", () => {
  it("returns empty result when no team ids are provided", () => {
    const result = runEmergencyRosterRepairForTeams({
      saveId: "save-1",
      seasonId: "season-2",
      teamIds: [],
      persistence: { getSaveById: () => null } as never,
    });
    expect(result.repaired).toBe(false);
    expect(result.purchases).toEqual([]);
  });
});
