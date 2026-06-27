import type { GameState, TransferHistoryEntry } from "@/lib/data/olyDataTypes";
import { describe, expect, it } from "vitest";

import {
  buildStandingsTransferBalanceForTeam,
  buildStandingsTransferBalanceByTeamId,
} from "@/lib/season/transfer-standings-balance";

function transfer(partial: Partial<TransferHistoryEntry> & Pick<TransferHistoryEntry, "transferType">): TransferHistoryEntry {
  return {
    id: partial.id ?? "history-1",
    playerId: partial.playerId ?? "p1",
    seasonId: partial.seasonId ?? "season-1",
    matchdayId: partial.matchdayId ?? "matchday-10",
    phase: partial.phase ?? "manual_transfer_window",
    seasonLabel: partial.seasonLabel ?? "Season 1",
    transferType: partial.transferType,
    fromTeamId: partial.fromTeamId ?? null,
    toTeamId: partial.toTeamId ?? null,
    fee: partial.fee ?? 0,
    salary: partial.salary ?? 0,
    marketValue: partial.marketValue ?? 0,
    remainingContractLength: partial.remainingContractLength ?? 1,
    happenedAt: partial.happenedAt ?? "2026-06-06T00:00:00.000Z",
    source: partial.source,
  };
}

function gameState(history: TransferHistoryEntry[]): GameState {
  return {
    season: { id: "season-2", matchdayIds: ["matchday-1"] },
    teams: [{ teamId: "A-A", shortCode: "A-A", name: "Team A", cash: 100 }],
    transferHistory: history,
  } as GameState;
}

describe("transfer-standings-balance", () => {
  it("ignores draft buys in season 1 and counts only end-of-season market sells", () => {
    const balance = buildStandingsTransferBalanceForTeam(
      gameState([
        transfer({
          transferType: "buy",
          seasonId: "season-1",
          toTeamId: "A-A",
          source: "season1_autoprep_topup",
          fee: 200,
        }),
        transfer({
          transferType: "sell",
          seasonId: "season-1",
          fromTeamId: "A-A",
          source: "ai_preseason_market_sell",
          fee: 30,
        }),
      ]),
      "season-1",
      "A-A",
    );

    expect(balance.transferBuyCount).toBe(0);
    expect(balance.transferBuyTotal).toBe(0);
    expect(balance.transferSellCount).toBe(1);
    expect(balance.transferSellTotal).toBe(30);
    expect(balance.transferNet).toBe(30);
  });

  it("pairs prior-season end sells with current-season preseason buys from season 2 onward", () => {
    const balance = buildStandingsTransferBalanceForTeam(
      gameState([
        transfer({
          transferType: "sell",
          seasonId: "season-1",
          fromTeamId: "A-A",
          source: "ai_preseason_market_sell",
          fee: 40,
        }),
        transfer({
          transferType: "buy",
          seasonId: "season-2",
          toTeamId: "A-A",
          source: "preseason_roster_repair_buy",
          fee: 120,
        }),
        transfer({
          transferType: "buy",
          seasonId: "season-2",
          toTeamId: "A-A",
          source: "ai_preseason_market_buy",
          fee: 25,
        }),
      ]),
      "season-2",
      "A-A",
    );

    expect(balance.transferSellTotal).toBe(40);
    expect(balance.transferBuyTotal).toBe(145);
    expect(balance.transferNet).toBe(-105);
  });

  it("builds per-team maps for the active season", () => {
    const balances = buildStandingsTransferBalanceByTeamId(
      gameState([
        transfer({
          transferType: "sell",
          seasonId: "season-1",
          fromTeamId: "A-A",
          source: "ai_preseason_market_sell",
          fee: 10,
        }),
      ]),
      "season-1",
    );

    expect(balances["A-A"]?.transferNet).toBe(10);
  });
});
