import type { GameState, TeamStrategyProfile } from "@/lib/data/olyDataTypes";
import { getTeamStrategyProfile } from "@/lib/foundation/team-strategy-profiles";

export type TransferDoctrinePersona = "star_builder" | "churner" | "hoarder" | "value_hunter" | "balanced";

export type TransferDoctrineProfile = {
  persona: TransferDoctrinePersona;
  sellIntentScale: number;
  keepIntentScale: number;
  profitWindowScale: number;
  buyIntentScale: number;
  passIntentScale: number;
  replacementFitScale: number;
  cashBufferScale: number;
  personaHint: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function resolvePersona(profile: TeamStrategyProfile | null): TransferDoctrinePersona {
  if (!profile) return "balanced";
  const bias = profile.bias;
  const starPriority = bias.starPriority ?? 5;
  const cashPriority = bias.cashPriority ?? 5;
  const sellAggression = bias.sellForProfitAggression ?? 5;
  const valuePriority = bias.valuePriority ?? 5;
  const loyalty = bias.loyaltyBias ?? 5;

  if (starPriority >= 7 && loyalty >= 6 && sellAggression <= 5) {
    return "star_builder";
  }
  if (cashPriority >= 7 && sellAggression <= 4) {
    return "hoarder";
  }
  if (sellAggression >= 7 && bias.shortContractPreference >= 6) {
    return "churner";
  }
  if (valuePriority >= 7 && sellAggression >= 5) {
    return "value_hunter";
  }
  return "balanced";
}

function personaHint(persona: TransferDoctrinePersona) {
  switch (persona) {
    case "star_builder":
      return "Star-Builder haelt Core-Spieler laenger";
    case "churner":
      return "Churner nutzt Verkaufsfenster aktiv";
    case "hoarder":
      return "Hoarder kauft sparsam und schuetzt Cash";
    case "value_hunter":
      return "Value-Hunter sucht guenstige Nachfolger";
    default:
      return "Ausgewogene Transfer-Doktrin";
  }
}

export function resolveTransferDoctrineFromProfile(profile: TeamStrategyProfile | null): TransferDoctrineProfile {
  const persona = resolvePersona(profile);
  const bias = profile?.bias;
  const starPriority = bias?.starPriority ?? 5;
  const cashPriority = bias?.cashPriority ?? 5;
  const sellAggression = bias?.sellForProfitAggression ?? 5;
  const valuePriority = bias?.valuePriority ?? 5;
  const loyalty = bias?.loyaltyBias ?? 5;
  const depth = bias?.rosterDepthPreference ?? 5;

  const base = {
    persona,
    sellIntentScale: 1,
    keepIntentScale: 1,
    profitWindowScale: 1,
    buyIntentScale: 1,
    passIntentScale: 1,
    replacementFitScale: 1,
    cashBufferScale: 1,
    personaHint: personaHint(persona),
  };

  switch (persona) {
    case "star_builder":
      return {
        ...base,
        keepIntentScale: round(clamp(1 + (starPriority - 5) * 0.06 + (loyalty - 5) * 0.04, 0.7, 1.35)),
        profitWindowScale: round(clamp(1 - (starPriority - 5) * 0.05, 0.65, 1.1)),
        sellIntentScale: round(clamp(1 - (loyalty - 5) * 0.03, 0.75, 1.05)),
        buyIntentScale: round(clamp(1 + (starPriority - 5) * 0.04, 0.85, 1.25)),
        passIntentScale: round(clamp(1 + (starPriority - 5) * 0.03, 0.9, 1.2)),
      };
    case "churner":
      return {
        ...base,
        sellIntentScale: round(clamp(1 + (sellAggression - 5) * 0.06, 0.85, 1.35)),
        profitWindowScale: round(clamp(1 + (sellAggression - 5) * 0.05, 0.9, 1.3)),
        keepIntentScale: round(clamp(1 - (sellAggression - 5) * 0.04, 0.7, 1.05)),
        buyIntentScale: round(clamp(1 + (depth - 5) * 0.03, 0.9, 1.2)),
      };
    case "hoarder":
      return {
        ...base,
        buyIntentScale: round(clamp(1 - (cashPriority - 5) * 0.06, 0.65, 1.05)),
        passIntentScale: round(clamp(1 + (cashPriority - 5) * 0.07, 0.9, 1.35)),
        cashBufferScale: round(clamp(1 + (cashPriority - 5) * 0.08, 0.85, 1.4)),
        sellIntentScale: round(clamp(1 + (sellAggression - 5) * 0.03, 0.85, 1.15)),
      };
    case "value_hunter":
      return {
        ...base,
        replacementFitScale: round(clamp(1 + (valuePriority - 5) * 0.07, 0.9, 1.35)),
        buyIntentScale: round(clamp(1 + (valuePriority - 5) * 0.04, 0.85, 1.2)),
        profitWindowScale: round(clamp(1 + (sellAggression - 5) * 0.04, 0.9, 1.25)),
      };
    default:
      return base;
  }
}

export function resolveTransferDoctrine(gameState: GameState, teamId: string): TransferDoctrineProfile {
  return resolveTransferDoctrineFromProfile(getTeamStrategyProfile(gameState, teamId));
}

export function adjustSellScoreForDoctrine(input: {
  baseScore: number;
  reasonToSell: string[];
  reasonToKeep: string[];
  doctrine: TransferDoctrineProfile;
}) {
  let adjusted = input.baseScore;
  const hasStarKeep = input.reasonToKeep.some(
    (reason) => reason.includes("Star") || reason.includes("Topstar") || reason.includes("Core"),
  );
  const hasUnderperformance = input.reasonToSell.some(
    (reason) => reason.includes("Performance") || reason.includes("PPS-Rang") || reason.includes("Abgang sinnvoll"),
  );
  const hasProfitWindow = input.reasonToSell.some((reason) => reason.includes("Verkaufsfenster") || reason.includes("Gewinn"));

  if (hasUnderperformance) {
    adjusted += 6 * (input.doctrine.sellIntentScale - 1);
  }
  if (hasStarKeep) {
    adjusted -= 10 * (input.doctrine.keepIntentScale - 1);
  }
  if (hasProfitWindow) {
    adjusted += 5 * (input.doctrine.profitWindowScale - 1);
  }

  return round(clamp(adjusted, 0, 100));
}

export function adjustBuyDecisionForDoctrine(input: {
  buyIntentScore: number;
  passIntentScore: number;
  replacementFitScore: number;
  doctrine: TransferDoctrineProfile;
}) {
  const buyIntent = round(input.buyIntentScore * input.doctrine.buyIntentScale + input.replacementFitScore * (input.doctrine.replacementFitScale - 1));
  const passIntent = round(input.passIntentScore * input.doctrine.passIntentScale);
  const strategicBuyScore = round(clamp(buyIntent + input.replacementFitScore - passIntent, 0, 100));
  return { buyIntent, passIntent, strategicBuyScore };
}

export function compareStrategicBuyCandidates(
  left: { strategicBuyScore?: number | null; overallRecommendationScore?: number | null; price?: number | null },
  right: { strategicBuyScore?: number | null; overallRecommendationScore?: number | null; price?: number | null },
  tieBreakBand = 8,
) {
  const leftScore = left.strategicBuyScore ?? left.overallRecommendationScore ?? 0;
  const rightScore = right.strategicBuyScore ?? right.overallRecommendationScore ?? 0;
  if (Math.abs(rightScore - leftScore) > tieBreakBand) {
    return rightScore - leftScore;
  }
  const leftPrice = left.price ?? Number.POSITIVE_INFINITY;
  const rightPrice = right.price ?? Number.POSITIVE_INFINITY;
  if (leftPrice !== rightPrice) {
    return leftPrice - rightPrice;
  }
  return rightScore - leftScore;
}
