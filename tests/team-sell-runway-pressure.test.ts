import { describe, expect, it } from "vitest";

import {
  PRESEASON_REPAIR_MARKET_VALUE_CAP,
  isPreseasonRepairCandidateEligible,
} from "@/lib/ai/chunked-redraft-topup-service";
import {
  assessTeamSellRunwayPressure,
  countTeamSeasonSells,
  getProfitWindowSellThreshold,
  isAttractiveProfitSell,
} from "@/lib/ai/team-sell-runway-pressure";
import type { GameState } from "@/lib/data/olyDataTypes";

describe("preseason repair eligibility", () => {
  it("rejects expensive free agents above the cheap-fill cap", () => {
    expect(isPreseasonRepairCandidateEligible({ marketValue: 66.91, teamCash: 200 })).toBe(false);
    expect(isPreseasonRepairCandidateEligible({ marketValue: PRESEASON_REPAIR_MARKET_VALUE_CAP, teamCash: 20 })).toBe(true);
  });

  it("requires full market value cash, never a discounted fee", () => {
    expect(isPreseasonRepairCandidateEligible({ marketValue: 12, teamCash: 8 })).toBe(false);
    expect(isPreseasonRepairCandidateEligible({ marketValue: 12, teamCash: 12 })).toBe(true);
  });
});

describe("team sell runway pressure", () => {
  const baseState = {
    season: { id: "season-2" },
    transferHistory: [],
    teams: [{ teamId: "L-K", cash: 8, name: "L-K", shortCode: "L-K", budget: 100 }],
  } as unknown as GameState;

  it("raises cash pressure score without mandating a sell", () => {
    const result = assessTeamSellRunwayPressure({
      gameState: baseState,
      team: baseState.teams[0]!,
      salaryTotal: 58,
    });
    expect(result.seasonSells).toBe(0);
    expect(result.cashPressureScore).toBeGreaterThan(0.5);
    expect("needsProactiveSell" in result).toBe(false);
  });

  it("lowers profit-window threshold when cash pressure is high", () => {
    expect(getProfitWindowSellThreshold(0.7)).toBeLessThan(getProfitWindowSellThreshold(0.1));
  });

  it("treats sell value above market value as attractive under cash pressure", () => {
    expect(
      isAttractiveProfitSell({
        expectedSellValue: 55,
        marketValue: 50,
        cashPressureScore: 0.6,
      }),
    ).toBe(true);
  });

  it("does not flag attractive profit when edge is too small and cash is healthy", () => {
    expect(
      isAttractiveProfitSell({
        expectedSellValue: 51,
        marketValue: 50,
        cashPressureScore: 0.1,
      }),
    ).toBe(false);
  });

  it("counts season sells", () => {
    const gameState = {
      ...baseState,
      transferHistory: [
        {
          seasonId: "season-2",
          transferType: "sell",
          fromTeamId: "L-K",
          fee: 20,
        },
      ],
    } as unknown as GameState;
    expect(countTeamSeasonSells(gameState, "L-K")).toBe(1);
  });
});
