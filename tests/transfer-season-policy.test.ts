import { describe, expect, it } from "vitest";

import {
  countSeasonBuyTransfers,
  findSeasonOneForbiddenBuySources,
  formatSeasonTransferCountsLabel,
  isMarketBuyTransferEntry,
  isSeasonOneDraftBuySource,
  isSeasonOneForbiddenBuySource,
  isTransferActionAllowed,
  resolveSeasonOneMarketBuyBlocker,
  SEASON_ONE_MARKET_BUY_BLOCKER,
} from "@/lib/season/transfer-season-policy";

describe("transfer-season-policy", () => {
  it("allows only draft and season-end sells in season 1", () => {
    expect(isTransferActionAllowed("season-1", "season1_draft")).toBe(true);
    expect(isTransferActionAllowed("season-1", "season_end_market_sell")).toBe(true);
    expect(isTransferActionAllowed("season-1", "preseason_roster_repair")).toBe(false);
    expect(isTransferActionAllowed("season-1", "season_end_market_buy")).toBe(false);
    expect(isTransferActionAllowed("season-1", "preseason_market_buy")).toBe(false);
  });

  it("allows all transfer actions from season 2 onward", () => {
    for (const action of [
      "season1_draft",
      "preseason_roster_repair",
      "season_end_market_buy",
      "season_end_market_sell",
      "preseason_market_buy",
    ] as const) {
      expect(isTransferActionAllowed("season-2", action)).toBe(true);
    }
  });

  it("flags any non-draft S1 buy source in transfer history", () => {
    const violations = findSeasonOneForbiddenBuySources([
      { seasonId: "season-1", transferType: "buy", source: "season1_autoprep_topup" },
      { seasonId: "season-1", transferType: "buy", source: "preseason_roster_repair_buy" },
      { seasonId: "season-1", transferType: "buy", source: "manual_transfermarkt_buy" },
      { seasonId: "season-1", transferType: "sell", source: "ai_preseason_market_sell" },
      { seasonId: "season-2", transferType: "buy", source: "preseason_roster_repair_buy" },
    ]);
    expect(violations).toEqual(["preseason_roster_repair_buy", "manual_transfermarkt_buy"]);
    expect(isSeasonOneForbiddenBuySource("ai_preseason_market_buy")).toBe(true);
    expect(isSeasonOneForbiddenBuySource("season1_autoprep_topup")).toBe(false);
    expect(isSeasonOneDraftBuySource("ai_roster_fill")).toBe(true);
    expect(isSeasonOneDraftBuySource("full_churn_redraft_buy")).toBe(true);
  });

  it("blocks non-draft buys in season 1 at apply layer", () => {
    expect(resolveSeasonOneMarketBuyBlocker("season-1", "ai_roster_fill")).toBeNull();
    expect(resolveSeasonOneMarketBuyBlocker("season-1", "ai_preseason_market_buy")).toBe(SEASON_ONE_MARKET_BUY_BLOCKER);
    expect(resolveSeasonOneMarketBuyBlocker("season-2", "ai_preseason_market_buy")).toBeNull();
  });

  it("counts draft vs market buys separately", () => {
    const counts = countSeasonBuyTransfers(
      [
        { seasonId: "season-1", transferType: "buy", source: "ai_roster_fill" },
        { seasonId: "season-1", transferType: "buy", source: "season1_autoprep_topup" },
        { seasonId: "season-1", transferType: "buy", source: "ai_preseason_market_buy" },
        { seasonId: "season-1", transferType: "sell", source: "ai_preseason_market_sell" },
      ],
      "season-1",
    );
    expect(counts).toEqual({ draftBuyCount: 2, marketBuyCount: 1, totalBuyCount: 3 });
    expect(isMarketBuyTransferEntry({ transferType: "buy", source: "ai_roster_fill" })).toBe(false);
    expect(isMarketBuyTransferEntry({ transferType: "buy", source: "ai_preseason_market_buy" })).toBe(true);
  });

  it("formats season transfer count labels with draft/market split in S1", () => {
    const counts = { draftBuyCount: 672, marketBuyCount: 0 };
    expect(
      formatSeasonTransferCountsLabel("season-1", counts, {
        sellCount: 154,
        exitCount: 172,
        style: "audit",
      }),
    ).toBe("672Draft/0Markt/154V/172X");
    expect(
      formatSeasonTransferCountsLabel("season-2", { draftBuyCount: 0, marketBuyCount: 48 }, { sellCount: 52, style: "recap" }),
    ).toBe("48 Markt-K · 52 V");
  });
});
