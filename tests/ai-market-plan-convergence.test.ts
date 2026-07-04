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
} from "@/lib/ai/ai-market-plan-convergence-service";

function buildGameState(overrides?: Partial<GameState>): GameState {
  return {
    season: { id: "season-2", name: "Season 2", year: 2027, currentMatchday: 1, matchdayIds: ["md-1"] },
    seasonState: {
      seasonId: "season-2",
      schedule: [],
      standings: {},
      teamControlSettings: {},
      teamStrategyProfiles: {},
      disciplineSchedule: [{ seasonId: "season-2", discipline1: { playerCount: 4 }, discipline2: { playerCount: 4 } }],
    },
    matchdayState: { matchdayId: "md-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [
      { teamId: "team-a", name: "Team A", shortCode: "TMA", cash: 100, humanControlled: false },
      { teamId: "team-b", name: "Team B", shortCode: "TMB", cash: 50, humanControlled: false },
    ],
    teamIdentities: [
      { teamId: "team-a", playerMin: 8, playerMax: 14, playerOpt: 10 },
      { teamId: "team-b", playerMin: 8, playerMax: 14, playerOpt: 10 },
    ],
    rosters: [
      ...Array.from({ length: 6 }, (_, index) => ({
        id: `r-a-${index}`,
        teamId: "team-a",
        playerId: `p-a-${index}`,
        slot: index,
      })),
      ...Array.from({ length: 8 }, (_, index) => ({
        id: `r-b-${index}`,
        teamId: "team-b",
        playerId: `p-b-${index}`,
        slot: index,
      })),
    ],
    players: [],
    transferHistory: [],
    ...overrides,
  } as GameState;
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

  it("marks sell-only below-min teams as valid without global blockers", async () => {
    const gameState = buildGameState({
      rosters: Array.from({ length: 9 }, (_, index) => ({
        id: `r-a-${index}`,
        teamId: "team-a",
        playerId: `p-a-${index}`,
        slot: index,
      })),
    });
    const persistence = {
      getSaveById: () => ({ saveId: "save-1", gameState }),
    };

    applyAiMarketPlanLocally
      .mockResolvedValueOnce(buildApplyResult({ appliedSells: 1, rosterAfter: 9, result: "applied" }))
      .mockResolvedValueOnce(buildApplyResult({ appliedBuys: 0, appliedSells: 0, rosterAfter: 9, result: "hold" }))
      .mockResolvedValue(buildApplyResult({ appliedBuys: 0, appliedSells: 0, rosterAfter: 9, result: "hold" }));

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
    expect(result.perTeam[0]?.status).toBe("valid_sell_only_below_min");
    expect(result.emergencyRepairTeams).not.toContain("team-a");
  });

  it("blocks teams when buys finish below playerMin", async () => {
    const gameState = buildGameState({
      rosters: Array.from({ length: 7 }, (_, index) => ({
        id: `r-a-${index}`,
        teamId: "team-a",
        playerId: `p-a-${index}`,
        slot: index,
      })),
    });
    const persistence = {
      getSaveById: () => ({ saveId: "save-1", gameState }),
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
          rosters: Array.from({ length: rosterCount }, (_, index) => ({
            id: `r-a-${index}`,
            teamId: "team-a",
            playerId: `p-a-${index}`,
            slot: index,
          })),
        }),
      }),
    };

    applyAiMarketPlanLocally.mockImplementation(async (params) => {
      call += 1;
      if (params.options?.applySellSteps && !params.options?.applyBuySteps) {
        expect(params.options?.maxSellsPerTeam).toBe(1);
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
            rosters: Array.from({ length: rosterCount }, (_, index) => ({
              id: `r-a-${index}`,
              teamId: "team-a",
              playerId: `p-a-${index}`,
              slot: index,
            })),
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

  it("passes exclude lists to avoid repeating the same buy attempts", async () => {
    const gameState = buildGameState({
      rosters: Array.from({ length: 9 }, (_, index) => ({
        id: `r-a-${index}`,
        teamId: "team-a",
        playerId: `p-a-${index}`,
        slot: index,
      })),
    });
    const persistence = {
      getSaveById: () => ({ saveId: "save-1", gameState }),
    };

    applyAiMarketPlanLocally
      .mockResolvedValueOnce(buildApplyResult({ appliedBuys: 0, appliedSells: 0, rosterAfter: 10 }))
      .mockResolvedValueOnce({
        ...buildApplyResult({ appliedBuys: 0, appliedSells: 0, rosterAfter: 10 }),
        buyGateRows: [{ teamId: "team-a", playerId: "fa-blocked", reason: "cash_buffer_failed" }],
        teams: [
          {
            ...buildApplyResult({ rosterAfter: 10 }).teams[0],
            plannedBuyDetails: [{ stepType: "buy", playerId: "fa-blocked", playerName: "Blocked", amount: 10, salaryImpact: 1, rosterImpact: 1, status: "blocked", reason: "cash" }],
            skippedSteps: [],
          },
        ],
      })
      .mockResolvedValueOnce(buildApplyResult({ appliedBuys: 1, executedBuys: 1, rosterAfter: 9 }))
      .mockResolvedValue(buildApplyResult({ appliedBuys: 0, appliedSells: 0, rosterAfter: 9 }));

    const { runMarketPlanConvergence } = await import("@/lib/ai/ai-market-plan-convergence-service");
    await runMarketPlanConvergence({
      saveId: "save-1",
      seasonId: "season-2",
      persistence: persistence as never,
      transferPhase: "manual_transfer_window",
      maxPasses: 1,
      maxRoundsPerPass: 2,
      skipIfExistingMarketTransfers: false,
    });

    const thirdCall = applyAiMarketPlanLocally.mock.calls[2]?.[0];
    expect(thirdCall?.options?.excludeBuyPlayerIds).toContain("fa-blocked");
  });

  it("skips convergence for team already at identity opt even when below slot depth", async () => {
    const gameState = buildGameState({
      teams: [{ teamId: "team-bp", name: "BP", shortCode: "B-P", cash: 50, humanControlled: false }],
      teamIdentities: [{ teamId: "team-bp", playerMin: 8, playerMax: 14, playerOpt: 10 }],
      rosters: Array.from({ length: 10 }, (_, index) => ({
        id: `r-bp-${index}`,
        teamId: "team-bp",
        playerId: `p-bp-${index}`,
        slot: index,
      })),
      seasonState: {
        seasonId: "season-2",
        schedule: [],
        standings: {},
        teamControlSettings: {},
        teamStrategyProfiles: {},
        disciplineSchedule: [{ seasonId: "season-2", discipline1: { playerCount: 6 }, discipline2: { playerCount: 6 } }],
      },
    });
    const persistence = {
      getSaveById: () => ({ saveId: "save-1", gameState }),
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
      rosters: Array.from({ length: 6 }, (_, index) => ({
        id: `r-a-${index}`,
        teamId: "team-a",
        playerId: `p-a-${index}`,
        slot: index,
      })),
    });
    const persistence = { getSaveById: () => ({ saveId: "save-1", gameState }) };
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
      teams: [{ teamId: "team-a", name: "Team A", shortCode: "TMA", cash: -10, humanControlled: false }],
      rosters: Array.from({ length: 9 }, (_, index) => ({
        id: `r-a-${index}`,
        teamId: "team-a",
        playerId: `p-a-${index}`,
        slot: index,
      })),
    });

    // Roster (9) sits strictly between hardMin (8) and Opt (10); negative cash drives the
    // doctrine strategy to cash_recovery. Before the fix, cash_recovery was excluded from
    // CONVERGENCE_BUY_STRATEGIES and this returned false, leaving the team stuck without
    // real buys until it fell below hardMin into the weaker emergency-repair fallback.
    expect(teamNeedsMarketConvergence(gameState, "team-a")).toBe(true);
  });

  it("still skips convergence once a team reaches Opt, regardless of cash pressure", () => {
    const gameState = buildGameState({
      teams: [{ teamId: "team-a", name: "Team A", shortCode: "TMA", cash: -10, humanControlled: false }],
      rosters: Array.from({ length: 10 }, (_, index) => ({
        id: `r-a-${index}`,
        teamId: "team-a",
        playerId: `p-a-${index}`,
        slot: index,
      })),
    });

    expect(teamNeedsMarketConvergence(gameState, "team-a")).toBe(false);
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
