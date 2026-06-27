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
    expect(audit.doctrineStats.length).toBeGreaterThan(0);
  });
});
