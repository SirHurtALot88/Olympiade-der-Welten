import type { LeagueMarketAnchors, MarketPickLane } from "@/lib/ai/ai-market-slot-plan-service";
import {
  laneFallbackChain,
  scoreCandidateForLane,
  type MarketPickPhase,
  type MarketQualityProfile,
} from "@/lib/ai/ai-market-quality-profile-service";
import {
  applyOverspendReconciliation,
  type BudgetEnvelope,
  type BudgetEnvelopeSlot,
} from "@/lib/ai/market-pick-engine/budget-envelope";
import {
  bracketsToLegacyAnchors,
  isPriceEligibleForBracketLane,
  type LeagueMarketBrackets,
} from "@/lib/ai/market-pick-engine/market-brackets";

export type PickStepCandidate = {
  playerId: string;
  price?: number | null;
  marketValue?: number | null;
  strategicBuyScore?: number | null;
  overallRecommendationScore?: number | null;
  /** Team-need fit for this slot (higher = better match for open need axis / discipline). */
  needMatchScore?: number | null;
};

export type PickStepResult = {
  candidate: PickStepCandidate;
  lane: MarketPickLane;
  overspendDelta: number;
};

function candidatePrice(candidate: PickStepCandidate) {
  return candidate.price ?? candidate.marketValue ?? 0;
}

/** Block reserve-tier filler when the slot expects depth/backup and roster slots remain. */
function antiFillerPenalty(input: {
  price: number;
  lane: MarketPickLane;
  primaryLane: MarketPickLane;
  slotFloorMw: number;
  slotIndex: number;
  totalSlots: number;
  brackets: LeagueMarketBrackets;
}) {
  if (input.primaryLane === "cheap_fill" || input.lane === "cheap_fill") {
    return 0;
  }
  const slotsRemaining = input.totalSlots - input.slotIndex - 1;
  if (slotsRemaining <= 0) return 0;
  const reserveCeiling = input.brackets.reserve.ceilingMw ?? input.brackets.backup.floorMw;
  if (input.price + 0.01 >= input.slotFloorMw) return 0;
  if (input.price + 0.01 >= reserveCeiling) return 0;
  const expectsMidTier =
    input.primaryLane === "depth" ||
    input.primaryLane === "backup" ||
    input.primaryLane === "core" ||
    input.lane === "depth" ||
    input.lane === "backup";
  if (!expectsMidTier) return 0;
  return 45 + slotsRemaining * 8;
}

export function pickCandidateForSlot(input: {
  slotIndex: number;
  envelope: BudgetEnvelope;
  candidates: PickStepCandidate[];
  usedPlayerIds: Set<string>;
  qualityProfile: MarketQualityProfile;
  pickPhase: MarketPickPhase;
  overspendDelta?: number;
  allowMinFillFallback?: boolean;
}): PickStepResult | null {
  const slot = input.envelope.slots[input.slotIndex];
  const primaryLane = input.envelope.slotSequence[input.slotIndex] ?? slot?.lane ?? "depth";
  const brackets = input.envelope.brackets;
  const anchors: LeagueMarketAnchors = bracketsToLegacyAnchors(brackets);
  const lanesForSlot = laneFallbackChain({
    primaryLane,
    pickPhase: input.pickPhase,
    starChaser: input.qualityProfile.starChaser,
  });

  const minScore = input.pickPhase === "post_opt_upgrade" ? -50 : -999;

  for (const lane of lanesForSlot) {
    const ranked = input.candidates
      .filter((candidate) => !input.usedPlayerIds.has(candidate.playerId))
      .map((candidate) => {
        const price = candidatePrice(candidate);
        const eligible = isPriceEligibleForBracketLane(price, lane, brackets);
        let adjustedScore = scoreCandidateForLane({
          price,
          score: candidate.strategicBuyScore ?? candidate.overallRecommendationScore ?? 0,
          lane,
          anchors,
          qualityFloorMw: slot?.floorMw ?? input.qualityProfile.qualityFloorMw,
          disableCheapLanes: input.qualityProfile.disableCheapLanes,
          pickPhase: input.pickPhase,
        });
        if (candidate.needMatchScore != null && candidate.needMatchScore > 0) {
          adjustedScore += candidate.needMatchScore * 0.35;
        }
        if (!eligible) {
          adjustedScore -= 30;
        }
        adjustedScore -= antiFillerPenalty({
          price,
          lane,
          primaryLane,
          slotFloorMw: slot?.floorMw ?? brackets.depth.floorMw,
          slotIndex: input.slotIndex,
          totalSlots: input.envelope.slots.length,
          brackets,
        });
        return { candidate, adjustedScore };
      })
      .sort((left, right) => right.adjustedScore - left.adjustedScore);

    const lanePick = ranked.find((entry) => entry.adjustedScore > minScore);
    if (!lanePick) continue;

    const price = candidatePrice(lanePick.candidate);
    const targetMw = slot?.targetMw ?? brackets.depth.targetMw;
    const overspendDelta = Math.max(0, price - targetMw);

    return {
      candidate: lanePick.candidate,
      lane,
      overspendDelta,
    };
  }

  if (input.allowMinFillFallback && input.qualityProfile.playerMin > 0) {
    const rankedAny = input.candidates
      .filter((candidate) => !input.usedPlayerIds.has(candidate.playerId))
      .sort(
        (left, right) =>
          (right.strategicBuyScore ?? right.overallRecommendationScore ?? 0) -
          (left.strategicBuyScore ?? left.overallRecommendationScore ?? 0),
      );
    const fallback = rankedAny[0];
    if (fallback) {
      const price = candidatePrice(fallback);
      const targetMw = slot?.targetMw ?? brackets.depth.targetMw;
      return {
        candidate: fallback,
        lane: primaryLane,
        overspendDelta: Math.max(0, price - targetMw),
      };
    }
  }

  return null;
}

export function reconcileEnvelopeAfterPick(input: {
  envelope: BudgetEnvelope;
  slotIndex: number;
  overspendDelta: number;
}) {
  if (input.overspendDelta <= 0.01) return;
  applyOverspendReconciliation(
    input.envelope.slots,
    input.slotIndex + 1,
    input.overspendDelta,
    input.envelope.brackets,
  );
}

export function getEnvelopeSlot(input: {
  envelope: BudgetEnvelope;
  slotIndex: number;
}): BudgetEnvelopeSlot | null {
  return input.envelope.slots[input.slotIndex] ?? null;
}
