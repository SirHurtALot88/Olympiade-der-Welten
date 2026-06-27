import type { GameState, TeamIdentity, TeamStrategyProfile } from "@/lib/data/olyDataTypes";
import { getTeamStrategyProfile } from "@/lib/foundation/team-strategy-profiles";
import {
  hasKeepReason,
  hasSellReason,
  mergeKeepReasonCodes,
  mergeSellReasonCodes,
  type AiKeepReasonCode,
  type AiSellReasonCode,
} from "@/lib/ai/ai-transfer-reason-codes";

export type TransferDoctrinePersona =
  | "star_builder"
  | "merchant"
  | "churner"
  | "hoarder"
  | "value_hunter"
  | "loyalist"
  | "balanced";

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

function normalizeIdentityAxis(value: number | null | undefined, fallback = 5) {
  if (value == null || !Number.isFinite(value)) {
    return fallback;
  }
  return clamp(value, 0, 10);
}

function personaHint(persona: TransferDoctrinePersona) {
  switch (persona) {
    case "star_builder":
      return "Star-Builder haelt Core-Spieler laenger";
    case "merchant":
      return "Merchant rotiert fuer Profit und saubere Ratio";
    case "churner":
      return "Churner nutzt Verkaufsfenster aktiv";
    case "hoarder":
      return "Hoarder kauft sparsam und schuetzt Cash";
    case "value_hunter":
      return "Value-Hunter sucht guenstige Nachfolger";
    case "loyalist":
      return "Loyalist bevorzugt Stabilitaet und Harmonie";
    default:
      return "Ausgewogene Transfer-Doktrin";
  }
}

function resolvePersona(profile: TeamStrategyProfile | null, identity: TeamIdentity | null): TransferDoctrinePersona {
  if (!profile) return "balanced";
  const bias = profile.bias;
  const starPriority = bias.starPriority ?? 5;
  const cashPriority = bias.cashPriority ?? 5;
  const sellAggression = bias.sellForProfitAggression ?? 5;
  const valuePriority = bias.valuePriority ?? 5;
  const loyalty = bias.loyaltyBias ?? 5;
  const shortContract = bias.shortContractPreference ?? 5;
  const harmony = normalizeIdentityAxis(identity?.harmony, loyalty);

  if (cashPriority >= 8 && valuePriority >= 8 && sellAggression >= 7) {
    return "merchant";
  }
  if (starPriority >= 7 && loyalty >= 6 && sellAggression <= 5) {
    return "star_builder";
  }
  if (cashPriority >= 7 && sellAggression <= 4 && starPriority <= 6) {
    return "hoarder";
  }
  if (loyalty >= 7 && harmony >= 7 && sellAggression <= 5) {
    return "loyalist";
  }
  if (sellAggression >= 7 && shortContract >= 6) {
    return "churner";
  }
  if (valuePriority >= 7 && sellAggression >= 5) {
    return "value_hunter";
  }
  return "balanced";
}

function buildContinuousScales(profile: TeamStrategyProfile | null, identity: TeamIdentity | null) {
  const bias = profile?.bias;
  const starPriority = bias?.starPriority ?? 5;
  const cashPriority = bias?.cashPriority ?? 5;
  const sellAggression = bias?.sellForProfitAggression ?? 5;
  const valuePriority = bias?.valuePriority ?? 5;
  const loyalty = bias?.loyaltyBias ?? 5;
  const shortContract = bias?.shortContractPreference ?? 5;
  const depth = bias?.rosterDepthPreference ?? 5;
  const ambition = normalizeIdentityAxis(identity?.ambition, starPriority);
  const finances = normalizeIdentityAxis(identity?.finances, cashPriority);
  const harmony = normalizeIdentityAxis(identity?.harmony, loyalty);
  const cooperation = normalizeIdentityAxis(identity?.cooperation, 5);

  const centered = (delta: number, min = 0.65, max = 1.45) => round(clamp(1 + delta, min, max));

  return {
    sellIntentScale: centered(
      (sellAggression - 5) * 0.07 + (shortContract - 5) * 0.03 + (ambition - 5) * 0.015 - (harmony - 5) * 0.01,
    ),
    keepIntentScale: centered(
      (loyalty - 5) * 0.07 + (harmony - 5) * 0.012 + (cooperation - 5) * 0.008 - (sellAggression - 5) * 0.015,
      0.7,
      1.5,
    ),
    profitWindowScale: centered((sellAggression - 5) * 0.05 + (valuePriority - 5) * 0.04 + (finances - 5) * 0.01, 0.7, 1.4),
    buyIntentScale: centered(
      (starPriority - 5) * 0.05 + (depth - 5) * 0.03 + (ambition - 5) * 0.015 - (cashPriority - 5) * 0.04,
      0.65,
      1.4,
    ),
    passIntentScale: centered((cashPriority - 5) * 0.07 + (finances - 5) * 0.012 - (starPriority - 5) * 0.015, 0.7, 1.45),
    replacementFitScale: centered((valuePriority - 5) * 0.06 + (cooperation - 5) * 0.008, 0.85, 1.35),
    cashBufferScale: centered((cashPriority - 5) * 0.08 + (finances - 5) * 0.015, 0.75, 1.5),
  };
}

function applyPersonaTuning(
  persona: TransferDoctrinePersona,
  scales: ReturnType<typeof buildContinuousScales>,
): Omit<TransferDoctrineProfile, "persona" | "personaHint"> {
  switch (persona) {
    case "star_builder":
      return {
        ...scales,
        keepIntentScale: round(clamp(scales.keepIntentScale + 0.12, 0.7, 1.55)),
        sellIntentScale: round(clamp(scales.sellIntentScale - 0.08, 0.65, 1.35)),
        buyIntentScale: round(clamp(scales.buyIntentScale + 0.06, 0.65, 1.45)),
      };
    case "merchant":
      return {
        ...scales,
        profitWindowScale: round(clamp(scales.profitWindowScale + 0.12, 0.75, 1.5)),
        sellIntentScale: round(clamp(scales.sellIntentScale + 0.1, 0.7, 1.5)),
        passIntentScale: round(clamp(scales.passIntentScale + 0.05, 0.75, 1.5)),
      };
    case "churner":
      return {
        ...scales,
        sellIntentScale: round(clamp(scales.sellIntentScale + 0.1, 0.75, 1.5)),
        keepIntentScale: round(clamp(scales.keepIntentScale - 0.08, 0.65, 1.35)),
      };
    case "hoarder":
      return {
        ...scales,
        buyIntentScale: round(clamp(scales.buyIntentScale - 0.12, 0.6, 1.1)),
        passIntentScale: round(clamp(scales.passIntentScale + 0.12, 0.85, 1.55)),
        cashBufferScale: round(clamp(scales.cashBufferScale + 0.1, 0.85, 1.6)),
      };
    case "value_hunter":
      return {
        ...scales,
        replacementFitScale: round(clamp(scales.replacementFitScale + 0.1, 0.9, 1.45)),
        profitWindowScale: round(clamp(scales.profitWindowScale + 0.06, 0.75, 1.45)),
      };
    case "loyalist":
      return {
        ...scales,
        keepIntentScale: round(clamp(scales.keepIntentScale + 0.1, 0.8, 1.55)),
        sellIntentScale: round(clamp(scales.sellIntentScale - 0.06, 0.65, 1.3)),
        passIntentScale: round(clamp(scales.passIntentScale + 0.04, 0.75, 1.45)),
      };
    default:
      return scales;
  }
}

export function resolveTransferDoctrineFromProfile(
  profile: TeamStrategyProfile | null,
  identity: TeamIdentity | null = null,
): TransferDoctrineProfile {
  const persona = resolvePersona(profile, identity);
  const continuous = buildContinuousScales(profile, identity);
  const tuned = applyPersonaTuning(persona, continuous);
  return {
    persona,
    ...tuned,
    personaHint: personaHint(persona),
  };
}

export function resolveTransferDoctrine(gameState: GameState, teamId: string): TransferDoctrineProfile {
  const identity = gameState.teamIdentities.find((entry) => entry.teamId === teamId) ?? null;
  return resolveTransferDoctrineFromProfile(getTeamStrategyProfile(gameState, teamId), identity);
}

export function adjustSellScoreForDoctrine(input: {
  baseScore: number;
  reasonToSell?: string[];
  reasonToKeep?: string[];
  sellReasonCodes?: AiSellReasonCode[];
  keepReasonCodes?: AiKeepReasonCode[];
  doctrine: TransferDoctrineProfile;
}) {
  const sellCodes = mergeSellReasonCodes(input.sellReasonCodes, input.reasonToSell ?? []);
  const keepCodes = mergeKeepReasonCodes(input.keepReasonCodes, input.reasonToKeep ?? []);
  let adjusted = input.baseScore;

  if (
    hasSellReason(sellCodes, "underperformance") ||
    hasSellReason(sellCodes, "weak_contribution") ||
    hasSellReason(sellCodes, "poor_team_fit")
  ) {
    adjusted += 8 * (input.doctrine.sellIntentScale - 1);
  }
  if (
    hasKeepReason(keepCodes, "star_core_protection") ||
    hasKeepReason(keepCodes, "good_team_fit") ||
    hasKeepReason(keepCodes, "covers_need_axis")
  ) {
    adjusted -= 12 * (input.doctrine.keepIntentScale - 1);
  }
  if (hasSellReason(sellCodes, "profit_window")) {
    adjusted += 7 * (input.doctrine.profitWindowScale - 1);
  }
  if (hasSellReason(sellCodes, "negative_cash") || hasSellReason(sellCodes, "low_cash_reserve")) {
    adjusted += 6 * (input.doctrine.sellIntentScale - 1);
  }
  if (input.doctrine.persona === "loyalist" && hasKeepReason(keepCodes, "long_contract")) {
    adjusted -= 4;
  }
  if (input.doctrine.persona === "merchant" && hasSellReason(sellCodes, "profit_window")) {
    adjusted += 4;
  }

  return round(clamp(adjusted, 0, 100));
}

export function adjustBuyDecisionForDoctrine(input: {
  buyIntentScore: number;
  passIntentScore: number;
  replacementFitScore: number;
  doctrine: TransferDoctrineProfile;
}) {
  const buyIntent = round(
    input.buyIntentScore * input.doctrine.buyIntentScale + input.replacementFitScore * (input.doctrine.replacementFitScale - 1),
  );
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

export function summarizeDoctrineSpread(profiles: TransferDoctrineProfile[]) {
  const byPersona = new Map<TransferDoctrinePersona, number>();
  for (const profile of profiles) {
    byPersona.set(profile.persona, (byPersona.get(profile.persona) ?? 0) + 1);
  }
  return Object.fromEntries(byPersona.entries()) as Record<TransferDoctrinePersona, number>;
}
