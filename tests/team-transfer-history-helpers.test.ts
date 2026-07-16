import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { resolveTeamSellProfit } from "@/lib/foundation/team-transfer-history-helpers";

describe("team transfer history helpers", () => {
  it("computes sell profit from acquisition price and sell fee", () => {
    const gameState = {
      rosters: [],
      transferHistory: [
        {
          id: "buy-1",
          playerId: "player-1",
          seasonId: "season-1",
          seasonLabel: "Season 1",
          transferType: "buy",
          fromTeamId: null,
          toTeamId: "S-S",
          fee: 30.8,
          salary: 5,
          marketValue: 30.8,
          remainingContractLength: 2,
          happenedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    } as GameState;

    expect(resolveTeamSellProfit(gameState, "S-S", "player-1", 36.81)).toBe(6.01);
  });
});
