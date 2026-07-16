import { describe, expect, it } from "vitest";

import type { GameState, TransferHistoryEntry } from "@/lib/data/olyDataTypes";
import {
  buildSoldPlayerSeasonBans,
  isPlayerTransferBuyBlocked,
  SOLD_PLAYER_SEASON_COOLDOWN_BLOCKER,
} from "@/lib/market/transfer-sold-cooldown";

function createSellEntry(partial?: Partial<TransferHistoryEntry>): TransferHistoryEntry {
  return {
    id: partial?.id ?? "sell-1",
    playerId: partial?.playerId ?? "player-1",
    seasonId: partial?.seasonId ?? "season-2",
    transferType: "sell",
    fromTeamId: partial?.fromTeamId ?? "A-A",
    toTeamId: null,
    fee: partial?.fee ?? 25,
    salary: partial?.salary ?? 5,
    marketValue: partial?.marketValue ?? 25,
    remainingContractLength: partial?.remainingContractLength ?? 1,
    happenedAt: partial?.happenedAt ?? "2027-01-01T00:00:00.000Z",
    seasonLabel: partial?.seasonLabel ?? "Season 2",
    source: partial?.source ?? "manual_transfermarkt_sell",
  };
}

describe("transfer-sold-cooldown", () => {
  it("blocks any team from buying a player sold in the current season", () => {
    const gameState = {
      season: { id: "season-2" },
      transferHistory: [createSellEntry()],
    } as GameState;

    expect(isPlayerTransferBuyBlocked({ gameState, playerId: "player-1" })).toBe(true);
    expect(SOLD_PLAYER_SEASON_COOLDOWN_BLOCKER).toBe("player_sold_this_season_unavailable");
  });

  it("does not block players sold in a previous season", () => {
    const gameState = {
      season: { id: "season-3" },
      transferHistory: [createSellEntry({ seasonId: "season-2" })],
    } as GameState;

    expect(isPlayerTransferBuyBlocked({ gameState, playerId: "player-1" })).toBe(false);
  });

  it("tracks the latest sell per player in a season", () => {
    const gameState = {
      season: { id: "season-2" },
      transferHistory: [
        createSellEntry({ id: "sell-old", happenedAt: "2027-01-01T00:00:00.000Z", fee: 10 }),
        createSellEntry({ id: "sell-new", happenedAt: "2027-02-01T00:00:00.000Z", fee: 30 }),
      ],
    } as GameState;

    const ban = buildSoldPlayerSeasonBans(gameState).get("player-1");
    expect(ban?.transferId).toBe("sell-new");
    expect(ban?.fee).toBe(30);
  });
});
