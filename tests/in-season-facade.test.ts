import { afterEach, describe, expect, it, vi } from "vitest";

const buildAiMarketPlanPreview = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ai/ai-market-plan-preview-service", () => ({
  buildAiMarketPlanPreview,
}));

import {
  isInSeasonEngineV2Enabled,
  planTransferWindowForTeam,
} from "@/lib/ai/in-season-engine/plan-transfer-window-for-team";
import { TRANSFER_WINDOW_PHASE } from "@/lib/ai/in-season-engine/transfer-window-phase";

function teamEntry(overrides: Record<string, unknown> = {}) {
  return {
    teamId: "team-a",
    teamName: "Team A",
    status: "sell_then_buy",
    currentState: { cash: 100, rosterCount: 10, playerMin: 8, playerOpt: 10 },
    sellPlan: { candidates: [{ playerId: "s1" }, { playerId: "s2" }], warnings: [] },
    buyPlan: { candidates: [{ playerId: "b1" }] },
    reasons: ["r"],
    warnings: ["w"],
    blockingReasons: [],
    ...overrides,
  };
}

afterEach(() => {
  buildAiMarketPlanPreview.mockReset();
});

describe("planTransferWindowForTeam — thin facade over buildAiMarketPlanPreview", () => {
  it("surfaces the matching team's sell/buy plans verbatim (no mangling)", async () => {
    const entry = teamEntry();
    buildAiMarketPlanPreview.mockResolvedValue({ teams: [teamEntry({ teamId: "team-z" }), entry] });

    const result = await planTransferWindowForTeam({
      saveId: "save-1",
      seasonId: "season-2",
      teamId: "team-a",
      phase: TRANSFER_WINDOW_PHASE.SEASON_END,
    });

    expect(result.sellPlan).toBe(entry.sellPlan);
    expect(result.buyPlan).toBe(entry.buyPlan);
    expect(result.sellPlan?.candidates.map((c) => c.playerId)).toEqual(["s1", "s2"]);
    expect(result.status).toBe("sell_then_buy");
    expect(result.reasons).toEqual(["r"]);
    expect(result.warnings).toEqual(["w"]);
  });

  it("resolves the active side's transfer source per phase", async () => {
    buildAiMarketPlanPreview.mockResolvedValue({ teams: [teamEntry()] });
    const seasonEnd = await planTransferWindowForTeam({ saveId: "s", seasonId: "season-2", teamId: "team-a", phase: TRANSFER_WINDOW_PHASE.SEASON_END });
    expect(seasonEnd.transferSource).toBe("season_end_market_sell");

    buildAiMarketPlanPreview.mockResolvedValue({ teams: [teamEntry()] });
    const preseason = await planTransferWindowForTeam({ saveId: "s", seasonId: "season-2", teamId: "team-a", phase: TRANSFER_WINDOW_PHASE.PRESEASON });
    expect(preseason.transferSource).toBe("ai_preseason_market_buy");
  });

  it("derives coarse needs from the preview status without recomputation", async () => {
    buildAiMarketPlanPreview.mockResolvedValue({ teams: [teamEntry({ status: "sell_only" })] });
    const sellOnly = await planTransferWindowForTeam({ saveId: "s", seasonId: "season-2", teamId: "team-a", phase: TRANSFER_WINDOW_PHASE.SEASON_END });
    expect(sellOnly.needs).toEqual({ needsSell: true, needsBuy: false });

    buildAiMarketPlanPreview.mockResolvedValue({ teams: [teamEntry({ status: "buy_only" })] });
    const buyOnly = await planTransferWindowForTeam({ saveId: "s", seasonId: "season-2", teamId: "team-a", phase: TRANSFER_WINDOW_PHASE.PRESEASON });
    expect(buyOnly.needs).toEqual({ needsSell: false, needsBuy: true });
  });

  it("returns a missing-team result when the team is absent from the preview", async () => {
    buildAiMarketPlanPreview.mockResolvedValue({ teams: [] });
    const result = await planTransferWindowForTeam({ saveId: "s", seasonId: "season-2", teamId: "team-a", phase: TRANSFER_WINDOW_PHASE.SEASON_END });
    expect(result.blockingReasons).toContain("in_season_plan_team_missing");
    expect(result.sellPlan).toBeNull();
  });
});

describe("isInSeasonEngineV2Enabled — feature flag (default ON after cutover)", () => {
  const original = process.env.OLY_INSEASON_ENGINE_V2;
  afterEach(() => {
    if (original === undefined) delete process.env.OLY_INSEASON_ENGINE_V2;
    else process.env.OLY_INSEASON_ENGINE_V2 = original;
  });

  it("is on by default and for truthy values", () => {
    delete process.env.OLY_INSEASON_ENGINE_V2;
    expect(isInSeasonEngineV2Enabled()).toBe(true);
    process.env.OLY_INSEASON_ENGINE_V2 = "1";
    expect(isInSeasonEngineV2Enabled()).toBe(true);
    process.env.OLY_INSEASON_ENGINE_V2 = "ON";
    expect(isInSeasonEngineV2Enabled()).toBe(true);
  });

  it("can be explicitly disabled with 0/false/off", () => {
    process.env.OLY_INSEASON_ENGINE_V2 = "0";
    expect(isInSeasonEngineV2Enabled()).toBe(false);
    process.env.OLY_INSEASON_ENGINE_V2 = "false";
    expect(isInSeasonEngineV2Enabled()).toBe(false);
    process.env.OLY_INSEASON_ENGINE_V2 = "off";
    expect(isInSeasonEngineV2Enabled()).toBe(false);
  });
});
