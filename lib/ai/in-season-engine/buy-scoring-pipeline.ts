/**
 * Canonical buy-side gate + ranking surface for the in-season transfer engine.
 *
 * Transitional seam (behaviour-preserving cutover): the final buy GATE (`buildFinalBuyGate`) and the
 * candidate RANKING comparator (`rankFinalBuyCandidates`) are the proven apply-time logic. They are
 * deeply entangled with apply-service execution helpers (roster token counts, hard-no-go matching,
 * cash buffers, diversity-adjusted scoring), so relocating them wholesale would be a large, risky
 * churn with no behavioural benefit — the V2 driver reuses `applyAiMarketPlanLocally` as its
 * executor, where these already run. This module therefore re-exports them from apply-service as the
 * clean engine's single, documented reference point for buy gate/ranking, decoupling every future
 * caller from the monolith's internal layout. A later dedicated refactor can move the implementation
 * behind this stable surface without touching consumers.
 */
export {
  buildFinalBuyGate,
  rankFinalBuyCandidates,
} from "@/lib/ai/ai-market-plan-apply-service";
