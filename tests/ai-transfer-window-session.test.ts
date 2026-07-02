import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";

const applyAiMarketPlanLocally = vi.hoisted(() => vi.fn());

vi.mock("@/lib/ai/ai-market-plan-apply-service", () => ({
  applyAiMarketPlanLocally,
}));

import { runTransferWindowSession } from "@/lib/ai/ai-transfer-window-session-service";

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
    teams: [{ teamId: "team-a", name: "Team A", shortCode: "TMA", cash: 100, humanControlled: false }],
    teamIdentities: [{ teamId: "team-a", identityId: "team-a", playerMin: 8, playerMax: 14, playerOpt: 10 }],
    rosters: Array.from({ length: 6 }, (_, index) => ({
      id: `r-a-${index}`,
      teamId: "team-a",
      playerId: `p-a-${index}`,
      slot: index,
    })),
    players: [],
    transferHistory: [],
    ...overrides,
  } as GameState;
}

function buildApplyResult(input: {
  appliedBuys?: number;
  appliedSells?: number;
  teamId?: string;
}) {
  const teamId = input.teamId ?? "team-a";
  return {
    summary: {
      appliedBuys: input.appliedBuys ?? 0,
      appliedSells: input.appliedSells ?? 0,
      blockedTeams: 0,
    },
    teams: [
      {
        teamId,
        teamName: "Team A",
        result: "applied",
        executedBuys: input.appliedBuys ?? 0,
        executedSells: input.appliedSells ?? 0,
        rosterAfter: 6,
        rosterBefore: 6,
        blockingReasons: [],
        warnings: [],
        appliedBuyDetails: [],
        appliedSellDetails: [],
        plannedBuyDetails: [],
        plannedSellDetails: [],
        skippedSteps: [],
      },
    ],
    blockingReasons: [],
    warnings: [],
    buyGateRows: [],
  };
}

describe("ai transfer window session service", () => {
  beforeEach(() => {
    applyAiMarketPlanLocally.mockReset();
  });

  it("runs sell then buy in a team cycle with transferWindowCycleMode", async () => {
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
      .mockResolvedValueOnce(buildApplyResult({ appliedSells: 1 }))
      .mockResolvedValueOnce(buildApplyResult({ appliedBuys: 2 }));

    const result = await runTransferWindowSession({
      saveId: "save-1",
      seasonId: "season-2",
      persistence: persistence as never,
      phase: "preseason",
      maxTeamCycles: 1,
      maxLeagueRounds: 1,
      skipIfExistingMarketTransfers: false,
    });

    expect(applyAiMarketPlanLocally).toHaveBeenCalledTimes(2);
    expect(applyAiMarketPlanLocally.mock.calls[0]?.[0].options?.applySellSteps).toBe(true);
    expect(applyAiMarketPlanLocally.mock.calls[0]?.[0].options?.applyBuySteps).toBe(false);
    expect(applyAiMarketPlanLocally.mock.calls[0]?.[0].options?.transferWindowCycleMode).toBe(true);
    expect(applyAiMarketPlanLocally.mock.calls[1]?.[0].options?.applyBuySteps).toBe(true);
    expect(result.appliedSells).toBe(1);
    expect(result.appliedBuys).toBe(2);
  });

  it("stalls league rounds when no progress is made", async () => {
    const gameState = buildGameState();
    const persistence = {
      getSaveById: () => ({ saveId: "save-1", gameState }),
    };

    applyAiMarketPlanLocally.mockResolvedValue(buildApplyResult({ appliedBuys: 0, appliedSells: 0 }));

    const result = await runTransferWindowSession({
      saveId: "save-1",
      seasonId: "season-2",
      persistence: persistence as never,
      phase: "preseason",
      maxTeamCycles: 2,
      maxLeagueRounds: 3,
      skipIfExistingMarketTransfers: false,
    });

    expect(result.warnings.some((entry) => entry.startsWith("transfer_window_stalled"))).toBe(true);
    expect(result.emergencyRepairTeams).toContain("team-a");
    expect(result.perTeam[0]?.status).toBe("convergence_exhausted");
  });

  it("aborts early when a round has zero transfers and unchanged coverage risk", async () => {
    const gameState = buildGameState();
    const persistence = {
      getSaveById: () => ({ saveId: "save-1", gameState }),
    };

    applyAiMarketPlanLocally.mockResolvedValue(buildApplyResult({ appliedBuys: 0, appliedSells: 0 }));

    const result = await runTransferWindowSession({
      saveId: "save-1",
      seasonId: "season-2",
      persistence: persistence as never,
      phase: "preseason",
      maxTeamCycles: 1,
      maxLeagueRounds: 3,
      skipIfExistingMarketTransfers: false,
    });

    expect(
      result.warnings.some((entry) => entry.startsWith("transfer_window_stalled_coverage_risk_unchanged")),
    ).toBe(true);
    expect(result.leagueRounds).toBe(1);
  });

  it("delegates remaining coverage-risk teams after max league rounds", async () => {
    const gameState = buildGameState();
    const persistence = {
      getSaveById: () => ({ saveId: "save-1", gameState }),
    };

    applyAiMarketPlanLocally.mockResolvedValue(buildApplyResult({ appliedBuys: 0, appliedSells: 0 }));

    const result = await runTransferWindowSession({
      saveId: "save-1",
      seasonId: "season-2",
      persistence: persistence as never,
      phase: "preseason",
      maxTeamCycles: 1,
      maxLeagueRounds: 1,
      skipIfExistingMarketTransfers: false,
    });

    expect(result.emergencyRepairTeams).toContain("team-a");
    expect(result.leagueRounds).toBe(1);
  });

  it("passes exclude lists between cycles", async () => {
    let rosterSize = 9;
    const buildState = () =>
      buildGameState({
        rosters: Array.from({ length: rosterSize }, (_, index) => ({
          id: `r-a-${index}`,
          teamId: "team-a",
          playerId: `p-a-${index}`,
          slot: index,
        })),
      });
    const persistence = {
      getSaveById: () => ({ saveId: "save-1", gameState: buildState() }),
    };

    applyAiMarketPlanLocally
      .mockImplementationOnce(async () => {
        rosterSize -= 1;
        return buildApplyResult({ appliedSells: 1 });
      })
      .mockImplementationOnce(async () =>
        ({
          ...buildApplyResult({ appliedBuys: 0 }),
          buyGateRows: [{ teamId: "team-a", playerId: "blocked-player", reason: "cash_buffer_failed" }],
          teams: [
            {
              ...buildApplyResult({}).teams[0],
              plannedBuyDetails: [
                {
                  stepType: "buy",
                  playerId: "blocked-player",
                  playerName: "Blocked",
                  amount: 10,
                  salaryImpact: 1,
                  rosterImpact: 1,
                  status: "blocked",
                  reason: "cash",
                },
              ],
            },
          ],
        }),
      )
      .mockImplementationOnce(async () => {
        rosterSize += 1;
        return buildApplyResult({ appliedSells: 0 });
      })
      .mockImplementationOnce(async () => {
        rosterSize += 1;
        return buildApplyResult({ appliedBuys: 1 });
      })
      .mockImplementation(async () => buildApplyResult({ appliedBuys: 0, appliedSells: 0 }));

    await runTransferWindowSession({
      saveId: "save-1",
      seasonId: "season-2",
      persistence: persistence as never,
      phase: "preseason",
      maxTeamCycles: 2,
      maxLeagueRounds: 1,
      skipIfExistingMarketTransfers: false,
    });

    const buyCalls = applyAiMarketPlanLocally.mock.calls
      .map((call) => call[0])
      .filter((params) => params.options?.applyBuySteps);
    expect(buyCalls.length).toBeGreaterThan(1);
    expect(buyCalls.slice(1).some((params) => params.options?.excludeBuyPlayerIds?.includes("blocked-player"))).toBe(true);
  });
});
