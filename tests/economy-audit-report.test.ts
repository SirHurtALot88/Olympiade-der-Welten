import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { buildEconomyAuditReport } from "@/lib/season/economy-audit-report";

function buildMinimalGameState(overrides: Partial<GameState> = {}): GameState {
  return {
    season: { id: "season-1", name: "Season 1", year: 1, matchdayIds: [] },
    teams: [{ teamId: "A-A", name: "Team A", cash: 1000 }],
    rosters: [],
    transferHistory: [],
    seasonState: {
      cashPrizeApplyLogs: [],
      sponsorPayoutLogs: [],
    },
    ...overrides,
  } as GameState;
}

describe("buildEconomyAuditReport", () => {
  it("flags benchmark cash prize apply and negative cash teams", () => {
    const report = buildEconomyAuditReport({
      saveId: "save-1",
      gameState: buildMinimalGameState({
        teams: [{ teamId: "A-A", name: "Team A", cash: -5 }],
        seasonState: {
          cashPrizeApplyLogs: [{ action: "apply", seasonId: "season-1", teamId: "A-A", amount: 100 }],
          sponsorPayoutLogs: [],
        },
      }),
    });

    expect(report.ok).toBe(false);
    expect(report.violations.some((entry) => entry.startsWith("cash_prize_apply_executed"))).toBe(true);
    expect(report.violations.some((entry) => entry.startsWith("negative_cash_teams"))).toBe(true);
  });

  it("flags preseason repair buys without transfer fees or below market value", () => {
    const report = buildEconomyAuditReport({
      saveId: "save-1",
      gameState: buildMinimalGameState({
        transferHistory: [
          {
            id: "tx-1",
            playerId: "p-1",
            seasonId: "season-2",
            transferType: "buy",
            source: "preseason_roster_repair_buy",
            fee: 0,
            marketValue: 12,
            fromTeamId: null,
            toTeamId: "A-A",
            happenedAt: "2026-01-01T00:00:00.000Z",
          },
          {
            id: "tx-2",
            playerId: "p-2",
            seasonId: "season-2",
            transferType: "buy",
            source: "preseason_roster_repair_buy",
            fee: 8,
            marketValue: 66.91,
            fromTeamId: null,
            toTeamId: "A-A",
            happenedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      }),
    });

    expect(report.ok).toBe(false);
    expect(report.violations).toContain("preseason_roster_repair_buy_zero_fee:1");
    expect(report.violations).toContain("preseason_roster_repair_buy_fee_not_market_value:2");
  });
});
