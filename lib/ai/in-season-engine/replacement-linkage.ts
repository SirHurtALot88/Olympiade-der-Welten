/**
 * Canonical sell -> rebuy replacement-linkage surface for the in-season transfer engine.
 *
 * The replacement memory (a star sale opens a scored "successor" slot that biases the following buy
 * pass toward a cheaper like-for-like replacement) already lives in the clean, pure
 * `ai-transfer-replacement-memory` module. This is a thin re-export so the facade has a single
 * import point for the linkage; behaviour is unchanged.
 */
export {
  buildReplacementSlotsFromPlannedSells,
  buildReplacementSlotsFromHistory,
  scoreReplacementFit,
  scoreReplacementFitForSlots,
  markReplacementSlotFulfilled,
  type ReplacementSlot,
  type ReplacementSlotUrgency,
} from "@/lib/ai/ai-transfer-replacement-memory";
