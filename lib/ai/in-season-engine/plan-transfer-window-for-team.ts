import type { GameState } from "@/lib/data/olyDataTypes";
import type { LocalTransfermarktRunContext } from "@/lib/market/transfermarkt-local-service";
import {
  buildAiMarketPlanPreview,
  type AiMarketPlanBuyPlan,
  type AiMarketPlanCurrentState,
  type AiMarketPlanPreviewParams,
  type AiMarketPlanPreviewStatus,
  type AiMarketPlanSellPlan,
} from "@/lib/ai/ai-market-plan-preview-service";
import {
  TRANSFER_WINDOW_PHASE,
  resolveTransferSource,
  type TransferWindowPhase,
} from "@/lib/ai/in-season-engine/transfer-window-phase";

/**
 * Thin facade for planning one team's in-season transfer window — the analogue of the draft
 * engine's `planUnifiedTeamPicks`. It wraps the proven per-team plan builder
 * (`buildAiMarketPlanPreview`, which already composes sell scoring + unified-pick buy planning) so
 * the V2 driver plans through ONE typed entry point without re-implementing composition. Because it
 * reuses the same builder the legacy path uses, parity is structural.
 *
 * No persistence writes happen here (async only because the underlying preview builder is async).
 */
export type PlanTransferWindowForTeamInput = {
  saveId: string;
  seasonId: string;
  teamId: string;
  phase: TransferWindowPhase;
  source?: AiMarketPlanPreviewParams["source"];
  buyLimit?: number | null;
  sellLimit?: number | null;
  candidateScopeMode?: AiMarketPlanPreviewParams["candidateScopeMode"];
  forceBuyScan?: boolean;
  localRunContext?: LocalTransfermarktRunContext | null;
  gameState?: GameState | null;
};

export type TransferWindowTeamNeeds = {
  needsSell: boolean;
  needsBuy: boolean;
};

export type PlanTransferWindowForTeamResult = {
  teamId: string;
  phase: TransferWindowPhase;
  status: AiMarketPlanPreviewStatus | null;
  currentState: AiMarketPlanCurrentState | null;
  sellPlan: AiMarketPlanSellPlan | null;
  buyPlan: AiMarketPlanBuyPlan | null;
  needs: TransferWindowTeamNeeds;
  /** The AI transfer-source string for this phase's active side (sell at season_end, buy at preseason). */
  transferSource: string;
  reasons: string[];
  warnings: string[];
  blockingReasons: string[];
};

/** Coarse sell/buy needs derived from the preview status — no recomputation, so it cannot diverge. */
function deriveNeeds(status: AiMarketPlanPreviewStatus | null): TransferWindowTeamNeeds {
  return {
    needsSell: status === "sell_only" || status === "sell_then_buy",
    needsBuy: status === "buy_only" || status === "sell_then_buy",
  };
}

export async function planTransferWindowForTeam(
  input: PlanTransferWindowForTeamInput,
): Promise<PlanTransferWindowForTeamResult> {
  const activeSide = input.phase === TRANSFER_WINDOW_PHASE.SEASON_END ? "sell" : "buy";
  const transferSource = resolveTransferSource({ phase: input.phase, side: activeSide });

  const preview = await buildAiMarketPlanPreview({
    source: input.source ?? "sqlite",
    saveId: input.saveId,
    seasonId: input.seasonId,
    teamId: input.teamId,
    teamScope: "all",
    buyLimit: input.buyLimit ?? null,
    sellLimit: input.sellLimit ?? null,
    candidateScopeMode: input.candidateScopeMode ?? null,
    forceBuyScanTeamIds: input.forceBuyScan ? [input.teamId] : null,
    localRunContext: input.localRunContext ?? null,
    gameState: input.gameState ?? null,
  });

  const team = preview.teams.find((entry) => entry.teamId === input.teamId) ?? null;
  if (!team) {
    return {
      teamId: input.teamId,
      phase: input.phase,
      status: null,
      currentState: null,
      sellPlan: null,
      buyPlan: null,
      needs: { needsSell: false, needsBuy: false },
      transferSource,
      reasons: [],
      warnings: ["in_season_plan_team_missing"],
      blockingReasons: ["in_season_plan_team_missing"],
    };
  }

  return {
    teamId: team.teamId,
    phase: input.phase,
    status: team.status,
    currentState: team.currentState,
    sellPlan: team.sellPlan,
    buyPlan: team.buyPlan,
    needs: deriveNeeds(team.status),
    transferSource,
    reasons: team.reasons ?? [],
    warnings: team.warnings ?? [],
    blockingReasons: team.blockingReasons ?? [],
  };
}

/**
 * Feature flag for the in-season clean engine (V2). Mirrors `isUnifiedPickEnabledForMarket()` but
 * DEFAULTS OFF: production keeps running the legacy driver until parity is proven and the default is
 * deliberately flipped in a follow-up cutover commit. Set `OLY_INSEASON_ENGINE_V2=1` to opt in.
 */
export function isInSeasonEngineV2Enabled(): boolean {
  const raw = process.env.OLY_INSEASON_ENGINE_V2?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "on";
}
