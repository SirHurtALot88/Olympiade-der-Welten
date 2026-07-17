import { beforeEach, describe, expect, it, vi , afterEach} from "vitest";

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
    disciplines: [],
    transferHistory: [],
    ...overrides,
  } as GameState;
}

function buildApplyResult(input: {
  appliedBuys?: number;
  appliedSells?: number;
  teamId?: string;
  rosterAfter?: number;
}) {
  const teamId = input.teamId ?? "team-a";
  const rosterAfter = input.rosterAfter ?? 6;
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
        rosterAfter,
        rosterBefore: rosterAfter,
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

function buildShrinkingSellPersistence(initialRosterSize: number) {
  let rosterSize = initialRosterSize;
  const gameState = () =>
    buildGameState({
      rosters: Array.from({ length: rosterSize }, (_, index) => ({
        id: `r-a-${index}`,
        teamId: "team-a",
        playerId: `p-a-${index}`,
        slot: index,
      })),
    });
  applyAiMarketPlanLocally.mockImplementation(async () => {
    if (rosterSize > 0) rosterSize -= 1;
    return buildApplyResult({ appliedSells: 1, rosterAfter: rosterSize });
  });
  return {
    getSaveById: () => ({ saveId: "save-1", gameState: gameState() }),
  };
}

describe("ai transfer window session service", () => {
  // Der Organic Squad Builder ist jetzt DEFAULT-ON (Cutover). Diese Suite prüft gezielt den Legacy-Pfad
  // (Mock-basiert), daher wird organic hier explizit per Opt-out (=0) abgeschaltet. Die Organic-Verhalten
  // sind in den organic-*-Testdateien + im Long-Run abgedeckt.
  beforeEach(() => {
    process.env.OLY_ORGANIC_SQUAD_BUILDER = "0";
    applyAiMarketPlanLocally.mockReset();
  });
  afterEach(() => {
    delete process.env.OLY_ORGANIC_SQUAD_BUILDER;
  });

  // Design correction (2026-07-04): "Verkauf findet separat statt und vor allem VOR dem Kaufen" —
  // sell and buy no longer coexist in the same team cycle. A preseason session's cycles only ever
  // buy (the Buy-Engine pass, run at season start); a season_end session's cycles only ever sell
  // (the Sell-Engine pass, run at season end). This replaces the old "runs sell then buy in a team
  // cycle" test, which asserted exactly the coupled per-cycle pattern
  // (round=N cycle=1 engine=unified sells=1 buys=1, 228+ occurrences in a real run.log) that this
  // change fixes.
  it("runs buy-only cycles in the preseason phase (never attempts a sell)", async () => {
    let rosterSize = 9;
    const gameState = () =>
      buildGameState({
        rosters: Array.from({ length: rosterSize }, (_, index) => ({
          id: `r-a-${index}`,
          teamId: "team-a",
          playerId: `p-a-${index}`,
          slot: index,
        })),
      });
    applyAiMarketPlanLocally.mockImplementation(async () => {
      rosterSize += 1;
      return buildApplyResult({ appliedBuys: 1, rosterAfter: rosterSize });
    });
    const persistence = {
      getSaveById: () => ({ saveId: "save-1", gameState: gameState() }),
    };

    const result = await runTransferWindowSession({
      saveId: "save-1",
      seasonId: "season-2",
      persistence: persistence as never,
      phase: "preseason",
      preseasonBuyMode: "convergence_loop",
      dryRun: true,
      maxTeamCycles: 1,
      maxLeagueRounds: 1,
      skipIfExistingMarketTransfers: false,
    });

    expect(applyAiMarketPlanLocally).toHaveBeenCalledTimes(1);
    expect(applyAiMarketPlanLocally.mock.calls[0]?.[0].options?.applyBuySteps).toBe(true);
    expect(applyAiMarketPlanLocally.mock.calls[0]?.[0].options?.applySellSteps).toBe(false);
    expect(applyAiMarketPlanLocally.mock.calls[0]?.[0].options?.transferWindowCycleMode).toBe(true);
    expect(result.appliedSells).toBe(0);
    expect(result.appliedBuys).toBe(1);
  });

  it("runs a second buy pass when opt gap remains at or above OPT_GAP_RESCUE_THRESHOLD", async () => {
    let rosterSize = 8;
    const gameState = () =>
      buildGameState({
        rosters: Array.from({ length: rosterSize }, (_, index) => ({
          id: `r-a-${index}`,
          teamId: "team-a",
          playerId: `p-a-${index}`,
          slot: index,
        })),
      });
    applyAiMarketPlanLocally.mockImplementation(async () => {
      rosterSize += 1;
      return buildApplyResult({ appliedBuys: 1, rosterAfter: rosterSize });
    });
    const persistence = {
      getSaveById: () => ({ saveId: "save-1", gameState: gameState() }),
    };

    const result = await runTransferWindowSession({
      saveId: "save-1",
      seasonId: "season-2",
      persistence: persistence as never,
      phase: "preseason",
      preseasonBuyMode: "convergence_loop",
      dryRun: true,
      maxTeamCycles: 1,
      maxLeagueRounds: 3,
      skipIfExistingMarketTransfers: false,
    });

    expect(applyAiMarketPlanLocally.mock.calls.length).toBeGreaterThanOrEqual(2);
    for (const call of applyAiMarketPlanLocally.mock.calls) {
      expect(call[0].options?.applyBuySteps).toBe(true);
      expect(call[0].options?.applySellSteps).toBe(false);
    }
    expect(result.appliedSells).toBe(0);
    expect(result.appliedBuys).toBeGreaterThanOrEqual(2);
  });

  it("runs sell-only cycles in the season_end phase (never attempts a buy)", async () => {
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

    applyAiMarketPlanLocally.mockResolvedValueOnce(buildApplyResult({ appliedSells: 1 }));

    const result = await runTransferWindowSession({
      saveId: "save-1",
      seasonId: "season-2",
      persistence: persistence as never,
      phase: "season_end",
      maxTeamCycles: 1,
      maxLeagueRounds: 1,
      skipIfExistingMarketTransfers: false,
    });

    expect(applyAiMarketPlanLocally).toHaveBeenCalledTimes(1);
    expect(applyAiMarketPlanLocally.mock.calls[0]?.[0].options?.applySellSteps).toBe(true);
    expect(applyAiMarketPlanLocally.mock.calls[0]?.[0].options?.applyBuySteps).toBe(false);
    expect(result.appliedSells).toBe(1);
    expect(result.appliedBuys).toBe(0);
  });

  it("marks a team that sells below Opt at season end as valid_sell_only_below_min, not blocked", async () => {
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

    applyAiMarketPlanLocally.mockResolvedValueOnce(buildApplyResult({ appliedSells: 1 }));

    const result = await runTransferWindowSession({
      saveId: "save-1",
      seasonId: "season-2",
      persistence: persistence as never,
      phase: "season_end",
      maxTeamCycles: 1,
      maxLeagueRounds: 1,
      skipIfExistingMarketTransfers: false,
    });

    expect(result.perTeam[0]?.status).toBe("valid_sell_only_below_min");
    expect(result.blockingReasons).toEqual([]);
  });

  // Design correction (2026-07-04, explicit user decision — see
  // .cursor/rules/balancing-no-sell-floor-full-rebuild.mdc): season_end has NO sell cap. A below-Opt
  // team may sell through every legitimate preview candidate until its roster is empty or a cycle
  // nets zero actions (exhausted). The old cap=3 tests below were removed/replaced accordingly.
  it("allows a below-Opt team to keep selling through season_end until roster is empty (no sell cap)", async () => {
    const persistence = buildShrinkingSellPersistence(9);

    const result = await runTransferWindowSession({
      saveId: "save-1",
      seasonId: "season-2",
      persistence: persistence as never,
      phase: "season_end",
      dryRun: true,
      maxTeamCycles: 5,
      maxLeagueRounds: 5,
      skipIfExistingMarketTransfers: false,
    });

    expect(applyAiMarketPlanLocally).toHaveBeenCalledTimes(9);
    expect(result.appliedSells).toBe(9);
  });

  it("still sells at season_end for a team only below Opt due to this season's contract-expiry tick (no involuntary-drop gate)", async () => {
    const persistence = buildShrinkingSellPersistence(9);

    const result = await runTransferWindowSession({
      saveId: "save-1",
      seasonId: "season-2",
      persistence: persistence as never,
      phase: "season_end",
      dryRun: true,
      maxTeamCycles: 3,
      maxLeagueRounds: 3,
      skipIfExistingMarketTransfers: false,
      preContractExpiryRosterCounts: { "team-a": 10 },
    });

    expect(applyAiMarketPlanLocally).toHaveBeenCalledTimes(9);
    expect(result.appliedSells).toBe(9);
  });

  it("allows persistently below-Opt teams the same uncapped season_end sell path", async () => {
    const persistence = buildShrinkingSellPersistence(9);

    const result = await runTransferWindowSession({
      saveId: "save-1",
      seasonId: "season-2",
      persistence: persistence as never,
      phase: "season_end",
      dryRun: true,
      maxTeamCycles: 5,
      maxLeagueRounds: 5,
      skipIfExistingMarketTransfers: false,
      preContractExpiryRosterCounts: { "team-a": 9 },
    });

    expect(applyAiMarketPlanLocally).toHaveBeenCalledTimes(9);
    expect(result.appliedSells).toBe(9);
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
      preseasonBuyMode: "convergence_loop",
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
      preseasonBuyMode: "convergence_loop",
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
      preseasonBuyMode: "convergence_loop",
      maxTeamCycles: 1,
      maxLeagueRounds: 1,
      skipIfExistingMarketTransfers: false,
    });

    expect(result.emergencyRepairTeams).toContain("team-a");
    expect(result.leagueRounds).toBe(1);
  });

  it("passes exclude lists between buy cycles (preseason is buy-only, so every call here is a buy)", async () => {
    let rosterSize = 6;
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
        rosterSize += 1;
        return {
          ...buildApplyResult({ appliedBuys: 1 }),
          buyGateRows: [{ teamId: "team-a", playerId: "blocked-player", reason: "cash_buffer_failed" }],
          teams: [
            {
              ...buildApplyResult({ appliedBuys: 1 }).teams[0],
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
        };
      })
      .mockImplementation(async () => buildApplyResult({ appliedBuys: 0, appliedSells: 0 }));

    await runTransferWindowSession({
      saveId: "save-1",
      seasonId: "season-2",
      persistence: persistence as never,
      phase: "preseason",
      preseasonBuyMode: "convergence_loop",
      maxTeamCycles: 2,
      maxLeagueRounds: 1,
      skipIfExistingMarketTransfers: false,
    });

    const buyCalls = applyAiMarketPlanLocally.mock.calls.map((call) => call[0]);
    expect(buyCalls.every((params) => params.options?.applyBuySteps)).toBe(true);
    expect(buyCalls.every((params) => params.options?.applySellSteps === false)).toBe(true);
    expect(buyCalls.length).toBeGreaterThan(1);
    expect(buyCalls[1]?.options?.excludeBuyPlayerIds).toContain("blocked-player");
  });

  // Root-cause fix (2026-07-04, S8 real-save regression: preseason buy volume collapsed 85->46
  // buys league-wide despite 30-100+ unspent cash for many teams, and specific teams -- e.g. V-W,
  // W-W on the real save -- ended the session with 0 buys even though they were deeply below Opt
  // with cash available; see outputs/real-engine-s1s5-final/progress-log.md). A candidate that one
  // team's own buy plan merely *considered and rejected* (skippedSteps -- team-specific cash
  // buffer / identity fit reasons) must remain available for the *next* team in the same session;
  // only a candidate that was actually bought/queued (appliedBuyDetails/plannedBuyDetails) or
  // accepted by the final buy gate (buyGateRows status "accepted") is genuinely unavailable to
  // everyone else. Before this fix, team-a's own rejected-for-team-a candidate ("skipped-for-a")
  // was propagated into the shared excludeBuyPlayerIds set and would have starved every later team
  // in the `needing` list of a candidate that might have suited them fine.
  it("does not exclude a candidate that one team's buy plan merely skipped (not claimed) for the next team", async () => {
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
      .mockResolvedValueOnce({
        ...buildApplyResult({ appliedBuys: 1 }),
        buyGateRows: [
          { teamId: "team-a", playerId: "claimed-player", status: "accepted", reason: "picked" },
          { teamId: "team-a", playerId: "skipped-for-a", status: "blocked", reason: "cash_buffer_failed" },
        ],
        teams: [
          {
            ...buildApplyResult({ appliedBuys: 1 }).teams[0],
            appliedBuyDetails: [
              { stepType: "buy", playerId: "claimed-player", playerName: "Claimed", amount: 10, salaryImpact: 1, rosterImpact: 1 },
            ],
            skippedSteps: [
              { stepType: "buy", playerId: "skipped-for-a", playerName: "Skipped", amount: 40, salaryImpact: 4, rosterImpact: 1 },
            ],
          },
        ],
      })
      .mockResolvedValue(buildApplyResult({ appliedBuys: 0, appliedSells: 0 }));

    await runTransferWindowSession({
      saveId: "save-1",
      seasonId: "season-2",
      persistence: persistence as never,
      phase: "preseason",
      preseasonBuyMode: "convergence_loop",
      maxTeamCycles: 2,
      maxLeagueRounds: 1,
      skipIfExistingMarketTransfers: false,
    });

    const buyCalls = applyAiMarketPlanLocally.mock.calls.map((call) => call[0]);
    expect(buyCalls.length).toBeGreaterThan(1);
    expect(buyCalls[1]?.options?.excludeBuyPlayerIds).toContain("claimed-player");
    expect(buyCalls[1]?.options?.excludeBuyPlayerIds).not.toContain("skipped-for-a");
  });
});
