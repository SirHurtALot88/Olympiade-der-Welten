export {
  MARKET_BRACKET_DEFINITIONS,
  bracketsToLegacyAnchors,
  buildLeagueMarketBrackets,
  classifyMarketBracket,
  getBracketBandForPickLane,
  isPriceEligibleForBracketLane,
  quantilePrice,
  resolveCashBufferMw,
  resolvePickLaneBracket,
  type LeagueMarketBrackets,
  type MarketBracketBand,
  type MarketBracketDefinition,
  type MarketBracketLane,
  type MarketBracketTierLabel,
} from "@/lib/ai/market-pick-engine/market-brackets";

export {
  applyOverspendReconciliation,
  buildBudgetEnvelope,
  buildPlannerEnvelope,
  capExplicitCountsByBudget,
  canAffordPremiumMix,
  planSlotsFromBudget,
  resolveTailReserveMw,
  type BudgetEnvelope,
  type BudgetEnvelopeSlot,
  type PlannerExplicitCounts,
} from "@/lib/ai/market-pick-engine/budget-envelope";

export {
  buildExplicitSlotSequence,
  buildLegacyCompareSlotPlan,
  interleaveLanePyramid,
  type ExplicitSlotSequenceInput,
} from "@/lib/ai/market-pick-engine/explicit-slot-sequence";

export { type PickEngineMode, type PickEngineOptions } from "@/lib/ai/market-pick-engine/pick-engine-options";

export {
  applyDraftSeedLaneVariation,
  buildPremiumFirstSlotSequence,
  type SlotSequenceInput,
} from "@/lib/ai/market-pick-engine/slot-sequence";

export {
  getEnvelopeSlot,
  pickCandidateForSlot,
  reconcileEnvelopeAfterPick,
  type PickStepCandidate,
  type PickStepResult,
} from "@/lib/ai/market-pick-engine/pick-step";
export {
  canExecuteAffordPick,
  listExecuteFreeAgentsForSlot,
  resolveExecutePoolMwBounds,
  resolveExecuteLivePickForSlot,
  resolveSlotLaneFromPick,
  type ExecuteLivePickCandidate,
  type ExecutePoolMwBounds,
} from "@/lib/ai/market-pick-engine/execute-live-pick";
