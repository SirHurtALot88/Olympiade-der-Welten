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
  | "developer"
  | "churner"
  | "hoarder"
  | "value_hunter"
  | "loyalist"
  | "balanced";

/** 0 = stabil/halten, 1 = aktiv rotieren und Deals suchen */
export type TransferDoctrineTradeAxis = number;
/** 0 = Value/Tiefe, 1 = Stars/Core/Entwicklung */
export type TransferDoctrineTalentAxis = number;

export type TransferDoctrineAxes = {
  tradeRotation: TransferDoctrineTradeAxis;
  talentFocus: TransferDoctrineTalentAxis;
};

export type TransferDoctrineBlend = Partial<Record<TransferDoctrinePersona, number>>;

export type TransferDoctrineProfile = {
  persona: TransferDoctrinePersona;
  personaBlend: TransferDoctrineBlend;
  axes: TransferDoctrineAxes;
  sellIntentScale: number;
  keepIntentScale: number;
  profitWindowScale: number;
  buyIntentScale: number;
  passIntentScale: number;
  replacementFitScale: number;
  cashBufferScale: number;
  personaHint: string;
};

const ALL_PERSONAS: TransferDoctrinePersona[] = [
  "star_builder",
  "merchant",
  "developer",
  "churner",
  "hoarder",
  "value_hunter",
  "loyalist",
  "balanced",
];

const PERSONA_ANCHORS: Record<TransferDoctrinePersona, TransferDoctrineAxes> = {
  hoarder: { tradeRotation: 0.12, talentFocus: 0.35 },
  loyalist: { tradeRotation: 0.22, talentFocus: 0.58 },
  balanced: { tradeRotation: 0.5, talentFocus: 0.5 },
  star_builder: { tradeRotation: 0.28, talentFocus: 0.88 },
  developer: { tradeRotation: 0.56, talentFocus: 0.78 },
  value_hunter: { tradeRotation: 0.68, talentFocus: 0.22 },
  merchant: { tradeRotation: 0.8, talentFocus: 0.5 },
  churner: { tradeRotation: 0.93, talentFocus: 0.3 },
};

const DEVELOPMENT_ARCHETYPE_TOKENS = ["teacher", "leader", "mentor", "captain", "talent", "prospect", "academy"];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function clamp01(value: number) {
  return clamp(value, 0, 1);
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

function personaLabel(persona: TransferDoctrinePersona) {
  switch (persona) {
    case "star_builder":
      return "Star-Builder";
    case "merchant":
      return "Merchant";
    case "developer":
      return "Developer";
    case "churner":
      return "Churner";
    case "hoarder":
      return "Hoarder";
    case "value_hunter":
      return "Value-Hunter";
    case "loyalist":
      return "Loyalist";
    default:
      return "Balanced";
  }
}

function personaHintFromBlend(blend: TransferDoctrineBlend) {
  const ranked = Object.entries(blend)
    .filter(([, weight]) => (weight ?? 0) >= 0.08)
    .sort((left, right) => (right[1] ?? 0) - (left[1] ?? 0))
    .slice(0, 3) as Array<[TransferDoctrinePersona, number]>;

  if (ranked.length === 0) {
    return "Ausgewogene Transfer-Doktrin";
  }

  return ranked
    .map(([persona, weight]) => `${personaLabel(persona)} ${Math.round(weight * 100)}%`)
    .join(" · ");
}

function deriveDevelopmentFocus(profile: TeamStrategyProfile | null) {
  if (!profile) return 0.5;
  const tokens = [
    ...(profile.preferredArchetypes ?? []),
    ...(profile.preferredClasses ?? []),
    profile.buyStyle ?? "",
    profile.rosterStyle ?? "",
    profile.strategySummary ?? "",
  ]
    .join(" ")
    .toLowerCase();

  const archetypeHits = DEVELOPMENT_ARCHETYPE_TOKENS.filter((token) => tokens.includes(token)).length;
  const depth = profile.bias.rosterDepthPreference ?? 5;
  const eliteSmall = profile.bias.eliteSmallRosterPreference ?? 5;
  const loyalty = profile.bias.loyaltyBias ?? 5;
  const sellAggression = profile.bias.sellForProfitAggression ?? 5;

  return clamp01(
    0.22 +
      Math.min(archetypeHits, 4) * 0.12 +
      (eliteSmall - 5) / 10 * 0.18 +
      (loyalty - 5) / 10 * 0.12 -
      (depth - 5) / 10 * 0.1 +
      (6 - sellAggression) / 10 * 0.08,
  );
}

export function resolveTransferDoctrineAxes(
  profile: TeamStrategyProfile | null,
  identity: TeamIdentity | null = null,
): TransferDoctrineAxes {
  const bias = profile?.bias;
  const starPriority = bias?.starPriority ?? 5;
  const cashPriority = bias?.cashPriority ?? 5;
  const sellAggression = bias?.sellForProfitAggression ?? 5;
  const valuePriority = bias?.valuePriority ?? 5;
  const loyalty = bias?.loyaltyBias ?? 5;
  const shortContract = bias?.shortContractPreference ?? 5;
  const ambition = normalizeIdentityAxis(identity?.ambition, starPriority);
  const finances = normalizeIdentityAxis(identity?.finances, cashPriority);
  const harmony = normalizeIdentityAxis(identity?.harmony, loyalty);
  const cooperation = normalizeIdentityAxis(identity?.cooperation, 5);
  const manners = normalizeIdentityAxis(identity?.manners, 5);
  const developmentFocus = deriveDevelopmentFocus(profile);

  let tradeRotation = clamp01(
    0.5 +
      (sellAggression - 5) / 10 * 0.34 +
      (valuePriority - 5) / 10 * 0.18 +
      (shortContract - 5) / 10 * 0.12 +
      (ambition - 5) / 10 * 0.1 -
      (loyalty - 5) / 10 * 0.16 -
      (harmony - 5) / 10 * 0.08 -
      (finances - 5) / 10 * 0.06,
  );

  if (developmentFocus >= 0.62 && sellAggression <= 6) {
    tradeRotation = clamp01(tradeRotation + 0.1);
  }

  const talentFocus = clamp01(
    0.5 +
      (starPriority - 5) / 10 * 0.28 +
      (loyalty - 5) / 10 * 0.14 +
      (developmentFocus - 0.5) * 0.42 +
      (cooperation - 5) / 10 * 0.08 +
      (manners - 5) / 10 * 0.06 -
      (valuePriority - 5) / 10 * 0.08,
  );

  return { tradeRotation: round(tradeRotation), talentFocus: round(talentFocus) };
}

function personaDistance(left: TransferDoctrineAxes, right: TransferDoctrineAxes) {
  const tradeDelta = left.tradeRotation - right.tradeRotation;
  const talentDelta = left.talentFocus - right.talentFocus;
  return Math.sqrt(tradeDelta * tradeDelta + talentDelta * talentDelta);
}

export function resolveTransferDoctrineBlend(
  axes: TransferDoctrineAxes,
  sharpness = 12,
): TransferDoctrineBlend {
  const rawWeights = ALL_PERSONAS.map((persona) => {
    const distance = personaDistance(axes, PERSONA_ANCHORS[persona]);
    return [persona, Math.exp(-sharpness * distance)] as const;
  });
  const total = rawWeights.reduce((sum, [, weight]) => sum + weight, 0);
  const blend: TransferDoctrineBlend = {};
  for (const [persona, weight] of rawWeights) {
    const normalized = weight / Math.max(total, 0.0001);
    if (normalized >= 0.08) {
      blend[persona] = round(normalized);
    }
  }
  const blendTotal = Object.values(blend).reduce((sum, weight) => sum + (weight ?? 0), 0);
  if (blendTotal > 0) {
    for (const persona of Object.keys(blend) as TransferDoctrinePersona[]) {
      blend[persona] = round((blend[persona] ?? 0) / blendTotal);
    }
  }
  const normalizedBlend = applyDevelopmentDealNudge(blend, axes);
  return ensureBlendDiversity(normalizedBlend, rawWeights);
}

function ensureBlendDiversity(
  blend: TransferDoctrineBlend,
  rawWeights: ReadonlyArray<readonly [TransferDoctrinePersona, number]>,
) {
  const ranked = [...rawWeights].sort((left, right) => right[1] - left[1]);
  const primary = ranked[0]?.[0];
  const secondary = ranked[1]?.[0];
  if (!primary || !secondary) {
    return blend;
  }
  const primaryWeight = blend[primary] ?? 0;
  if (primaryWeight >= 0.92) {
    const next: TransferDoctrineBlend = {
      ...blend,
      [primary]: 0.82,
      [secondary]: round(Math.max(blend[secondary] ?? 0, 0.18)),
    };
    const total = Object.values(next).reduce((sum, weight) => sum + (weight ?? 0), 0);
    for (const persona of Object.keys(next) as TransferDoctrinePersona[]) {
      next[persona] = round((next[persona] ?? 0) / total);
    }
    return next;
  }
  return blend;
}

function applyDevelopmentDealNudge(blend: TransferDoctrineBlend, axes: TransferDoctrineAxes) {
  if (axes.talentFocus >= 0.68 && axes.tradeRotation >= 0.45 && axes.tradeRotation <= 0.62) {
    blend.developer = (blend.developer ?? 0) + 0.08;
    blend.merchant = (blend.merchant ?? 0) + 0.12;
    blend.balanced = Math.max(0, (blend.balanced ?? 0) - 0.08);
  }
  const total = Object.values(blend).reduce((sum, weight) => sum + (weight ?? 0), 0);
  if (total <= 0) {
    return blend;
  }
  for (const persona of Object.keys(blend) as TransferDoctrinePersona[]) {
    blend[persona] = round((blend[persona] ?? 0) / total);
  }
  return blend;
}

export function resolveDominantPersona(blend: TransferDoctrineBlend): TransferDoctrinePersona {
  const ranked = Object.entries(blend).sort((left, right) => (right[1] ?? 0) - (left[1] ?? 0));
  return (ranked[0]?.[0] as TransferDoctrinePersona | undefined) ?? "balanced";
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

type DoctrineScales = Omit<
  TransferDoctrineProfile,
  "persona" | "personaBlend" | "axes" | "personaHint"
>;

function applyPersonaTuning(persona: TransferDoctrinePersona, scales: DoctrineScales): DoctrineScales {
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
    case "developer":
      return {
        ...scales,
        buyIntentScale: round(clamp(scales.buyIntentScale + 0.08, 0.7, 1.45)),
        keepIntentScale: round(clamp(scales.keepIntentScale + 0.08, 0.75, 1.5)),
        sellIntentScale: round(clamp(scales.sellIntentScale + 0.03, 0.7, 1.35)),
        profitWindowScale: round(clamp(scales.profitWindowScale + 0.06, 0.75, 1.4)),
        replacementFitScale: round(clamp(scales.replacementFitScale + 0.08, 0.85, 1.45)),
        passIntentScale: round(clamp(scales.passIntentScale - 0.04, 0.65, 1.35)),
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

function blendDoctrineScales(base: DoctrineScales, blend: TransferDoctrineBlend): DoctrineScales {
  const entries = Object.entries(blend).filter(([, weight]) => (weight ?? 0) > 0) as Array<[TransferDoctrinePersona, number]>;
  if (entries.length === 0) {
    return base;
  }

  const blended: DoctrineScales = {
    sellIntentScale: 0,
    keepIntentScale: 0,
    profitWindowScale: 0,
    buyIntentScale: 0,
    passIntentScale: 0,
    replacementFitScale: 0,
    cashBufferScale: 0,
  };

  for (const [persona, weight] of entries) {
    const tuned = applyPersonaTuning(persona, base);
    blended.sellIntentScale += tuned.sellIntentScale * weight;
    blended.keepIntentScale += tuned.keepIntentScale * weight;
    blended.profitWindowScale += tuned.profitWindowScale * weight;
    blended.buyIntentScale += tuned.buyIntentScale * weight;
    blended.passIntentScale += tuned.passIntentScale * weight;
    blended.replacementFitScale += tuned.replacementFitScale * weight;
    blended.cashBufferScale += tuned.cashBufferScale * weight;
  }

  return {
    sellIntentScale: round(blended.sellIntentScale),
    keepIntentScale: round(blended.keepIntentScale),
    profitWindowScale: round(blended.profitWindowScale),
    buyIntentScale: round(blended.buyIntentScale),
    passIntentScale: round(blended.passIntentScale),
    replacementFitScale: round(blended.replacementFitScale),
    cashBufferScale: round(blended.cashBufferScale),
  };
}

export function getPersonaBlendWeight(blend: TransferDoctrineBlend, persona: TransferDoctrinePersona) {
  return blend[persona] ?? 0;
}

export function resolveTransferDoctrineFromProfile(
  profile: TeamStrategyProfile | null,
  identity: TeamIdentity | null = null,
): TransferDoctrineProfile {
  const axes = resolveTransferDoctrineAxes(profile, identity);
  const personaBlend = resolveTransferDoctrineBlend(axes);
  const persona = resolveDominantPersona(personaBlend);
  const continuous = buildContinuousScales(profile, identity);
  const tuned = blendDoctrineScales(continuous, personaBlend);

  return {
    persona,
    personaBlend,
    axes,
    ...tuned,
    personaHint: personaHintFromBlend(personaBlend),
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
    adjusted += 4 * getPersonaBlendWeight(input.doctrine.personaBlend, "merchant");
    adjusted += 2 * getPersonaBlendWeight(input.doctrine.personaBlend, "developer");
  }
  if (hasSellReason(sellCodes, "negative_cash") || hasSellReason(sellCodes, "low_cash_reserve")) {
    adjusted += 6 * (input.doctrine.sellIntentScale - 1);
  }
  if (getPersonaBlendWeight(input.doctrine.personaBlend, "loyalist") >= 0.2 && hasKeepReason(keepCodes, "long_contract")) {
    adjusted -= 4 * getPersonaBlendWeight(input.doctrine.personaBlend, "loyalist");
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

export function formatPersonaBlend(blend: TransferDoctrineBlend) {
  return Object.entries(blend)
    .sort((left, right) => (right[1] ?? 0) - (left[1] ?? 0))
    .map(([persona, weight]) => `${persona}:${Math.round((weight ?? 0) * 100)}%`)
    .join(" ");
}
