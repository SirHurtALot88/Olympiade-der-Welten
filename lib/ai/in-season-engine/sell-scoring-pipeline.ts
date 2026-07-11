/**
 * Canonical sell-scoring surface for the in-season transfer engine.
 *
 * Sell scoring is layered across three already-clean, pure services that must stay consistent:
 *   1. `evaluateAiSellDecision` — per-candidate strategic sell score + keep/sell intent + label.
 *   2. `computeCompositeSellScore` — team-profile-weighted composite over the candidate.
 *   3. `selectCompositeSellCandidates` — final selection/ordering of the scored candidates.
 *
 * The proven composition of these stages lives in `ai-market-plan-preview-service` (which the V2
 * facade reuses verbatim, guaranteeing parity). This module re-exports the three stages plus the
 * ordering comparator as ONE documented import point, so no caller has to re-wire them ad hoc and
 * the stages can never silently drift apart. Behaviour is unchanged — these are the same functions.
 */
export {
  evaluateAiSellDecision,
  isProductiveElite,
  compareStrategicSellCandidates,
  enrichSellCandidateWithDecision,
  type AiSellDecisionInput,
  type AiSellDecisionResult,
} from "@/lib/ai/ai-sell-decision-engine";

export {
  computeCompositeSellScore,
  selectCompositeSellCandidates,
  resolveCompositeSellTeamProfile,
  resolveEffectiveSellThreshold,
  type CompositeSellScoreInput,
  type CompositeSellScoreResult,
  type CompositeSellTeamProfile,
} from "@/lib/ai/ai-composite-sell-score";
