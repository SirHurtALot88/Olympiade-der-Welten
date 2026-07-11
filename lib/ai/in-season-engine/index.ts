/**
 * In-season transfer engine (clean rebuild) — barrel re-export.
 *
 * Mirrors `lib/ai/market-pick-engine/index.ts`: one concern per file, composed behind a thin facade
 * (`plan-transfer-window-for-team`) and driven by a clean session driver, all gated behind the
 * `OLY_INSEASON_ENGINE_V2` feature flag until parity with the legacy path is proven.
 *
 * Files are added here phase by phase; this barrel grows as each lands.
 */
export {
  TRANSFER_WINDOW_PHASE,
  TRANSFER_SOURCE,
  resolveTransferSource,
  isTransferSource,
  isTransferWindowPhase,
  type TransferWindowPhase,
  type TransferSource,
  type TransferSide,
} from "@/lib/ai/in-season-engine/transfer-window-phase";

export {
  IN_SEASON_ENGINE_CONFIG,
  type InSeasonEngineConfig,
} from "@/lib/ai/golden-master/in-season-engine-config";

export {
  computeSalaryPressure,
  computeBoardPressure,
  evaluateTeamBuyNeed,
  evaluateTeamSellNeed,
  evaluateTeamMaintenanceNeed,
  type TeamBuyNeedInput,
  type TeamSellNeedInput,
  type TeamMaintenanceNeedInput,
} from "@/lib/ai/in-season-engine/need-detection";

export {
  buildFinalBuyGate,
  rankFinalBuyCandidates,
} from "@/lib/ai/in-season-engine/buy-scoring-pipeline";

export {
  evaluateAntiChurn,
  resolveAntiChurnOverrides,
  type AntiChurnInput,
  type AntiChurnResult,
} from "@/lib/ai/in-season-engine/anti-churn-guard";

export {
  evaluateAiSellDecision,
  computeCompositeSellScore,
  selectCompositeSellCandidates,
  compareStrategicSellCandidates,
  resolveCompositeSellTeamProfile,
  type CompositeSellScoreInput,
  type CompositeSellScoreResult,
} from "@/lib/ai/in-season-engine/sell-scoring-pipeline";

export {
  buildReplacementSlotsFromPlannedSells,
  scoreReplacementFitForSlots,
  markReplacementSlotFulfilled,
  type ReplacementSlot,
} from "@/lib/ai/in-season-engine/replacement-linkage";

export {
  planTransferWindowForTeam,
  isInSeasonEngineV2Enabled,
  type PlanTransferWindowForTeamInput,
  type PlanTransferWindowForTeamResult,
  type TransferWindowTeamNeeds,
} from "@/lib/ai/in-season-engine/plan-transfer-window-for-team";
