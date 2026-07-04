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
} from "@/lib/season/transfer-season-policy";

describe("transfer-season-policy", () => {
  // Course correction (2026-07-04): S1 buys are NOT forbidden — the draft is just the first
  // ordinary application of the same acquisition engine to empty rosters with starting budget. A
  // team that sells down (or organically drops) below hardMin/Opt in S1 must be able to rebuy in
  // the same season, exactly like any later season.
  it("allows every transfer action in season 1 (draft is just the first ordinary buy)", () => {
    for (const action of [
      "season1_draft",
      "preseason_roster_repair",
      "season_end_market_buy",
      "season_end_market_sell",
      "preseason_market_buy",
    ] as const) {
      expect(isTransferActionAllowed("season-1", action)).toBe(true);
    }
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

  it("no longer flags any S1 buy source as forbidden (only draft-vs-market labeling remains)", () => {
    const violations = findSeasonOneForbiddenBuySources([
      { seasonId: "season-1", transferType: "buy", source: "season1_autoprep_topup" },
      { seasonId: "season-1", transferType: "buy", source: "preseason_roster_repair_buy" },
      { seasonId: "season-1", transferType: "buy", source: "manual_transfermarkt_buy" },
      { seasonId: "season-1", transferType: "sell", source: "ai_preseason_market_sell" },
      { seasonId: "season-2", transferType: "buy", source: "preseason_roster_repair_buy" },
    ]);
    expect(violations).toEqual([]);
    expect(isSeasonOneForbiddenBuySource("ai_preseason_market_buy")).toBe(false);
    expect(isSeasonOneForbiddenBuySource("season1_autoprep_topup")).toBe(false);
    expect(isSeasonOneDraftBuySource("ai_roster_fill")).toBe(true);
    expect(isSeasonOneDraftBuySource("full_churn_redraft_buy")).toBe(true);
  });

  it("no longer blocks non-draft buys in season 1 at apply layer", () => {
    expect(resolveSeasonOneMarketBuyBlocker("season-1", "ai_roster_fill")).toBeNull();
    expect(resolveSeasonOneMarketBuyBlocker("season-1", "ai_preseason_market_buy")).toBeNull();
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
