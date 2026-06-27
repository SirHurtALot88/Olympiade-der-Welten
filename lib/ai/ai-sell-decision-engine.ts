import { adjustSellScoreForDoctrine, type TransferDoctrineProfile } from "@/lib/ai/ai-transfer-doctrine-layer";
import {
  hasKeepReason,
  hasSellReason,
  mergeKeepReasonCodes,
  mergeSellReasonCodes,
  type AiKeepReasonCode,
  type AiSellReasonCode,
} from "@/lib/ai/ai-transfer-reason-codes";
import type { AiSellPreviewCandidate } from "@/lib/ai/ai-transfermarkt-sell-preview-service";

export type AiSellDecisionInput = {
  sellPriority: number;
  reasonToSell: string[];
  reasonToKeep: string[];
  sellReasonCodes?: AiSellReasonCode[];
  keepReasonCodes?: AiKeepReasonCode[];
  expectedSellValue: number | null;
  marketValue: number | null;
  contractLength: number | null;
  teamCash: number | null;
  ovrRank: number | null;
  ppsSeasonRank: number | null;
  productiveElite?: boolean;
  underperformed?: boolean;
  doctrine?: TransferDoctrineProfile | null;
};

export type AiSellDecisionResult = {
  sellIntentScore: number;
  keepIntentScore: number;
  strategicSellScore: number;
  sellDecisionLabel: string;
  productiveElite: boolean;
  sellReasonCodes: AiSellReasonCode[];
  keepReasonCodes: AiKeepReasonCode[];
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

export function isProductiveElite(input: { ovrRank: number | null; ppsSeasonRank: number | null; keepIntentScore?: number }) {
  if ((input.keepIntentScore ?? 0) >= 55) return true;
  if (input.ovrRank != null && input.ovrRank <= 10) return true;
  if (input.ppsSeasonRank != null && input.ppsSeasonRank <= 10) return true;
  return false;
}

export function evaluateAiSellDecision(input: AiSellDecisionInput): AiSellDecisionResult {
  const sellReasonCodes = mergeSellReasonCodes(input.sellReasonCodes, input.reasonToSell);
  const keepReasonCodes = mergeKeepReasonCodes(input.keepReasonCodes, input.reasonToKeep);
  let sellIntentScore = input.sellPriority;
  let keepIntentScore = 0;

  if (hasSellReason(sellReasonCodes, "negative_cash") || hasSellReason(sellReasonCodes, "low_cash_reserve")) {
    sellIntentScore += 10;
  }
  if (input.underperformed || hasSellReason(sellReasonCodes, "underperformance")) {
    sellIntentScore += 8;
  }
  if (
    input.expectedSellValue != null &&
    input.marketValue != null &&
    input.marketValue > 0 &&
    (input.expectedSellValue - input.marketValue) / input.marketValue >= 0.1
  ) {
    sellIntentScore += 6;
  }
  if (hasSellReason(sellReasonCodes, "short_contract") || hasSellReason(sellReasonCodes, "expiring_contract")) {
    sellIntentScore += 5;
  }

  if (hasKeepReason(keepReasonCodes, "star_core_protection")) {
    keepIntentScore += 18;
  }
  if (hasKeepReason(keepReasonCodes, "long_contract")) {
    keepIntentScore += 8;
  }
  if (hasKeepReason(keepReasonCodes, "healthy_cash")) {
    keepIntentScore += 6;
  }
  if (input.contractLength != null && input.contractLength >= 5) {
    keepIntentScore += 10;
  } else if (input.contractLength != null && input.contractLength >= 3) {
    keepIntentScore += 5;
  }

  const productiveElite =
    input.productiveElite ?? isProductiveElite({ ovrRank: input.ovrRank, ppsSeasonRank: input.ppsSeasonRank, keepIntentScore });
  if (productiveElite && (input.teamCash ?? 0) >= 0) {
    keepIntentScore += 14;
  }

  let strategicSellScore = round(clamp(sellIntentScore - keepIntentScore * 0.45, 0, 100));
  if (input.doctrine) {
    strategicSellScore = adjustSellScoreForDoctrine({
      baseScore: strategicSellScore,
      sellReasonCodes,
      keepReasonCodes,
      doctrine: input.doctrine,
    });
  }

  let sellDecisionLabel = "abwaegen";
  if (hasSellReason(sellReasonCodes, "negative_cash")) {
    sellDecisionLabel = "Cash-Notverkauf";
  } else if (input.underperformed) {
    sellDecisionLabel = "Underperformer";
  } else if (hasSellReason(sellReasonCodes, "profit_window")) {
    sellDecisionLabel = "Verkaufsfenster";
  } else if (productiveElite && strategicSellScore < 45) {
    sellDecisionLabel = "Core halten";
  } else if (strategicSellScore >= 55) {
    sellDecisionLabel = "strategischer Verkauf";
  } else if (strategicSellScore < 25) {
    sellDecisionLabel = "halten";
  }

  return {
    sellIntentScore: round(sellIntentScore),
    keepIntentScore: round(keepIntentScore),
    strategicSellScore,
    sellDecisionLabel,
    productiveElite,
    sellReasonCodes,
    keepReasonCodes,
  };
}

export function enrichSellCandidateWithDecision(
  candidate: AiSellPreviewCandidate,
  input: Omit<AiSellDecisionInput, "sellPriority" | "reasonToSell" | "reasonToKeep" | "expectedSellValue" | "marketValue" | "contractLength">,
): AiSellPreviewCandidate & AiSellDecisionResult {
  const decision = evaluateAiSellDecision({
    sellPriority: candidate.sellPriority ?? candidate.sellPriorityScore ?? 0,
    reasonToSell: candidate.reasonToSell,
    reasonToKeep: candidate.reasonToKeep,
    sellReasonCodes: candidate.sellReasonCodes,
    keepReasonCodes: candidate.keepReasonCodes,
    expectedSellValue: candidate.expectedSellValue,
    marketValue: candidate.marketValue,
    contractLength: candidate.contractLength,
    ...input,
  });
  return { ...candidate, ...decision };
}

export function compareStrategicSellCandidates(
  left: { strategicSellScore?: number | null; sellPriority?: number | null },
  right: { strategicSellScore?: number | null; sellPriority?: number | null },
  tieBreakBand = 8,
) {
  const leftScore = left.strategicSellScore ?? left.sellPriority ?? 0;
  const rightScore = right.strategicSellScore ?? right.sellPriority ?? 0;
  if (Math.abs(rightScore - leftScore) > tieBreakBand) {
    return rightScore - leftScore;
  }
  return rightScore - leftScore;
}
