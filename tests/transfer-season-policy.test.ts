import { describe, expect, it } from "vitest";

import {
  findSeasonOneForbiddenBuySources,
  isSeasonOneForbiddenBuySource,
  isTransferActionAllowed,
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

  it("flags forbidden S1 buy sources in transfer history", () => {
    const violations = findSeasonOneForbiddenBuySources([
      { seasonId: "season-1", transferType: "buy", source: "season1_autoprep_topup" },
      { seasonId: "season-1", transferType: "buy", source: "preseason_roster_repair_buy" },
      { seasonId: "season-1", transferType: "sell", source: "ai_preseason_market_sell" },
      { seasonId: "season-2", transferType: "buy", source: "preseason_roster_repair_buy" },
    ]);
    expect(violations).toEqual(["preseason_roster_repair_buy"]);
    expect(isSeasonOneForbiddenBuySource("ai_preseason_market_buy")).toBe(true);
    expect(isSeasonOneForbiddenBuySource("season1_autoprep_topup")).toBe(false);
  });
});
