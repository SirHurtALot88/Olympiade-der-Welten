import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { buildBuyEconomics, buildTransferFinanceAudit } from "@/lib/season/transfer-finance-audit";

function minimalGameState(overrides: Partial<GameState> = {}): GameState {
  return {
    season: { id: "season-1" },
    teams: [
      { teamId: "T1", name: "Team One", cash: 50, shortCode: "T1" },
      { teamId: "T2", name: "Team Two", cash: 40, shortCode: "T2" },
    ],
    players: [{ id: "p1", name: "Player One", salaryDemand: 3 }],
    rosters: [],
    transferHistory: [
      {
        seasonId: "season-1",
        transferType: "buy",
        playerId: "p1",
        playerName: "Player One",
        toTeamId: "T1",
        fromTeamId: null,
        fee: 10,
        salary: 3,
        source: "ai_market_plan",
      },
      {
        seasonId: "season-1",
        transferType: "sell",
        playerId: "p2",
        playerName: "Sold",
        fromTeamId: "T2",
        toTeamId: null,
        fee: 8,
        source: "ai_market_plan",
      },
    ],
    seasonState: {
      seasonSnapshots: [
        {
          seasonId: "season-1",
          finalStandings: [
            { teamId: "T1", cashEnd: 37, cashTotal: 37 },
            { teamId: "T2", cashEnd: 48, cashTotal: 48 },
          ],
        },
      ],
      sponsorPayoutLogs: [
        { seasonId: "season-1", teamId: "T1", cashDelta: 5, phase: "settlement" },
        { seasonId: "season-1", teamId: "T1", cashDelta: -3, phase: "salary" },
      ],
    },
    teamIdentities: [],
    ...overrides,
  } as GameState;
}

describe("transfer-finance-audit", () => {
  it("buildBuyEconomics mirrors fee + salary for buys", () => {
    const rows = buildBuyEconomics(minimalGameState());
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      seasonId: "season-1",
      fee: 10,
      annualSalary: 3,
      totalFirstYearCost: 13,
    });
  });

  it("flags zero-fee non-repair buys and computes reconciliation rows", () => {
    const audit = buildTransferFinanceAudit(
      minimalGameState({
        transferHistory: [
          {
            seasonId: "season-1",
            transferType: "buy",
            playerId: "p-free",
            toTeamId: "T1",
            fee: 0,
            source: "ai_market_plan",
          },
        ],
      }),
    );

    expect(audit.violations.some((entry) => entry.startsWith("zero_fee_buy:"))).toBe(true);
    expect(audit.rows.some((row) => row.teamId === "T1" && row.seasonId === "season-1")).toBe(true);
    expect(audit.rows.find((row) => row.teamId === "T1" && row.seasonId === "season-1")).toMatchObject({
      buyCount: 1,
      draftBuyCount: 0,
      marketBuyCount: 1,
    });
    expect(audit.doctrineStats.length).toBeGreaterThan(0);
    expect(audit.doctrineStats.find((row) => row.teamId === "T1" && row.seasonId === "season-1")).toMatchObject({
      buys: 1,
      draftBuys: 0,
      marketBuys: 1,
    });
  });

  it("counts draft picks separately from market buys in season 1", () => {
    const audit = buildTransferFinanceAudit(
      minimalGameState({
        transferHistory: [
          {
            seasonId: "season-1",
            transferType: "buy",
            playerId: "p-draft",
            toTeamId: "T1",
            fee: 25,
            source: "ai_roster_fill",
          },
          {
            seasonId: "season-1",
            transferType: "buy",
            playerId: "p-draft-2",
            toTeamId: "T1",
            fee: 18,
            source: "season1_autoprep_topup",
          },
        ],
      }),
    );

    expect(audit.rows.find((row) => row.teamId === "T1" && row.seasonId === "season-1")).toMatchObject({
      buyCount: 0,
      draftBuyCount: 2,
      marketBuyCount: 0,
      buyFeesPaid: 43,
    });
    expect(audit.doctrineStats.find((row) => row.teamId === "T1" && row.seasonId === "season-1")).toMatchObject({
      buys: 0,
      draftBuys: 2,
      marketBuys: 0,
    });
  });

  it("reconciles a season anchored to the TRUE prior-season cashEnd, including auto-settle sponsor events", () => {
    // Season-1 true season-end cash = 100 (the reconciliation ANCHOR for season-2). Season-2 flows:
    //   buy fee 10        → netTransferCash = -10
    //   sponsor payout +5 → netSponsorCash = +5   (season-end settlement, in sponsorPayoutLogs)
    //   sponsor event +4  → netSponsorEventCash = +4 (auto-settled, credited straight to team.cash)
    // Expected season-2 cashEnd = 100 - 10 + 5 + 4 = 99  →  reconciliation delta = 0.
    const gameState = {
      season: { id: "season-2" },
      teams: [{ teamId: "T1", name: "Team One", cash: 99, shortCode: "T1" }],
      players: [],
      rosters: [],
      transferHistory: [
        {
          seasonId: "season-2",
          transferType: "buy",
          playerId: "pb",
          toTeamId: "T1",
          fromTeamId: null,
          fee: 10,
          source: "ai_market_plan",
        },
      ],
      seasonState: {
        seasonSnapshots: [
          { seasonId: "season-1", finalStandings: [{ teamId: "T1", cashEnd: 100, cashTotal: 100 }] },
          { seasonId: "season-2", finalStandings: [{ teamId: "T1", cashEnd: 99, cashTotal: 99 }] },
        ],
        sponsorPayoutLogs: [{ seasonId: "season-2", teamId: "T1", cashDelta: 5, phase: "settlement" }],
        sponsorEvents: [
          { seasonId: "season-2", teamId: "T1", cashDelta: 4, status: "resolved" }, // applied → counted
          { seasonId: "season-2", teamId: "T1", cashDelta: 3, status: "dismissed" }, // rejected → excluded
          { seasonId: "season-2", teamId: "T1", cashDelta: 7, status: "open" }, // pending → excluded
        ],
      },
      teamIdentities: [],
    } as unknown as GameState;

    const audit = buildTransferFinanceAudit(gameState);
    const season2 = audit.rows.find((row) => row.teamId === "T1" && row.seasonId === "season-2");

    expect(season2?.cashStart).toBe(100);
    expect(season2?.netTransferCash).toBe(-10);
    expect(season2?.netSponsorCash).toBe(5);
    // Only the resolved event is cash-effective; dismissed/open are excluded.
    expect(season2?.netSponsorEventCash).toBe(4);
    // Delta is ~0 (not inflated by preseason spend, not left with a sponsor-event residual).
    expect(season2?.cashReconciliationDelta).toBe(0);
    expect(audit.violations.some((entry) => entry.startsWith("cash_reconciliation_delta_hard:season-2"))).toBe(false);
    expect(audit.violations.some((entry) => entry.startsWith("cash_reconciliation_delta:season-2"))).toBe(false);
  });
});
