import { describe, expect, it } from "vitest";

import { LOCAL_TRANSFER_WINDOW_PHASE } from "@/lib/market/transfer-window-policy";
import {
  IN_SEASON_ENGINE_CONFIG,
  TRANSFER_SOURCE,
  TRANSFER_WINDOW_PHASE,
  isTransferSource,
  isTransferWindowPhase,
  resolveTransferSource,
} from "@/lib/ai/in-season-engine";

describe("in-season engine — transfer window phase/source", () => {
  it("uses the exact string literals already present in the codebase as source-of-truth values", () => {
    // These values are the transferHistory `source` strings other files match on — they must not drift.
    expect(TRANSFER_SOURCE.PRESEASON_MARKET_BUY).toBe("ai_preseason_market_buy");
    expect(TRANSFER_SOURCE.PRESEASON_MARKET_SELL).toBe("ai_preseason_market_sell");
    expect(TRANSFER_SOURCE.SEASON_END_MARKET_BUY).toBe("season_end_market_buy");
    expect(TRANSFER_SOURCE.SEASON_END_MARKET_SELL).toBe("season_end_market_sell");
    expect(TRANSFER_SOURCE.MANUAL_TRANSFER_WINDOW).toBe("manual_transfer_window");
  });

  it("anchors the manual source on the pre-existing LOCAL_TRANSFER_WINDOW_PHASE constant", () => {
    expect(TRANSFER_SOURCE.MANUAL_TRANSFER_WINDOW).toBe(LOCAL_TRANSFER_WINDOW_PHASE);
  });

  it("resolves the canonical AI source for every phase/side combination", () => {
    expect(resolveTransferSource({ phase: TRANSFER_WINDOW_PHASE.PRESEASON, side: "buy" })).toBe(
      "ai_preseason_market_buy",
    );
    expect(resolveTransferSource({ phase: TRANSFER_WINDOW_PHASE.PRESEASON, side: "sell" })).toBe(
      "ai_preseason_market_sell",
    );
    expect(resolveTransferSource({ phase: TRANSFER_WINDOW_PHASE.SEASON_END, side: "buy" })).toBe(
      "season_end_market_buy",
    );
    expect(resolveTransferSource({ phase: TRANSFER_WINDOW_PHASE.SEASON_END, side: "sell" })).toBe(
      "season_end_market_sell",
    );
  });

  it("guards known sources and phases", () => {
    expect(isTransferSource("ai_preseason_market_buy")).toBe(true);
    expect(isTransferSource("manual_transfer_window")).toBe(true);
    expect(isTransferSource("something_else")).toBe(false);
    expect(isTransferSource(null)).toBe(false);
    expect(isTransferWindowPhase("preseason")).toBe(true);
    expect(isTransferWindowPhase("season_end")).toBe(true);
    expect(isTransferWindowPhase("midseason")).toBe(false);
  });

  it("freezes the loop/pass constants lifted from the legacy driver", () => {
    expect(IN_SEASON_ENGINE_CONFIG.loop.maxPreseasonBuyCyclesPerTeam).toBe(14);
    expect(IN_SEASON_ENGINE_CONFIG.loop.defaultMaxLeagueRounds).toBe(3);
    expect(IN_SEASON_ENGINE_CONFIG.optGapRescue.threshold).toBe(1);
    expect(IN_SEASON_ENGINE_CONFIG.preseasonBatch.stepsPerTeam).toBe(14);
  });
});
