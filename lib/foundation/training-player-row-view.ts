import type { PlayerGeneratorAttributeName } from "@/lib/data/olyDataTypes";
import type { TrainingPlayerRowView } from "@/app/foundation/training-facilities-v2/training-view-types";
import type { OrganicProgressionAttributeBreakdown } from "@/lib/training/organic-season-progression";
import type { TrainingModeDemandView } from "@/lib/training/training-mode-demand-service";

type TrainingForecastRowInput = {
  entry: { id: string; roleTag?: string | null };
  player: TrainingPlayerRowView["player"] & {
    id: string;
    trainingMode?: string;
    trainingClass?: string;
  };
  mode: TrainingPlayerRowView["mode"];
  trainingClass: string;
  modeConfig: TrainingPlayerRowView["modeConfig"];
  appearances: number;
  playerMvs: number | null;
  playerPps: number | null;
  trainingXp: number;
  performanceXp: number;
  totalXp: number;
  upgradeEstimate: string;
  fatigueWarning: string;
  recoveryForecast: TrainingPlayerRowView["recoveryForecast"];
  organicProgression: {
    classBefore: string;
    classAfter: string;
    potentialRating: number | null;
    potentialTrainingMultiplier: number;
    trainingSetpoints: number;
    performanceSetpoints: number;
    netSetpoints: number;
    fatigueLoad: number;
    traitModifierPct: number;
    traitBreakdown: Array<{
      trait: string;
      legacyTraitTrainingFactorPct: number | null;
      known: boolean;
      tone: "positive" | "negative" | "neutral";
    }>;
    facilityModifierPct: number;
    topTrainingAttributes: Array<{ attribute: PlayerGeneratorAttributeName; weight: number }>;
    negativeTrainingRisks: Array<{ attribute: PlayerGeneratorAttributeName; weight: number }>;
    attributeAffinity: {
      signatureAttributes: PlayerGeneratorAttributeName[];
      weakAttribute: PlayerGeneratorAttributeName;
    };
    attributeBreakdown: OrganicProgressionAttributeBreakdown[];
  };
  forecast: TrainingPlayerRowView["forecast"];
  developmentStars: {
    currentAbilityStars: string | null;
    potentialStars: string | null;
    currentAbilityRating: number | null;
    potentialRating: number | null;
  };
  trainingDemand: TrainingModeDemandView | null;
};

function mapAttributeForecast(
  breakdown: OrganicProgressionAttributeBreakdown[],
  attributeLabels: Record<PlayerGeneratorAttributeName, string>,
  signatureAttributes: PlayerGeneratorAttributeName[],
  weakAttribute: PlayerGeneratorAttributeName,
): TrainingPlayerRowView["attributeForecast"] {
  const signatureSet = new Set(signatureAttributes);
  return breakdown.map((entry) => ({
    attribute: attributeLabels[entry.attribute],
    before: entry.before,
    after: entry.after,
    delta: entry.delta,
    training: entry.training,
    performance: entry.performance,
    regression: entry.regression,
    affinity: signatureSet.has(entry.attribute) ? "signature" : entry.attribute === weakAttribute ? "weak" : "neutral",
  }));
}

export function buildTrainingPlayerRowView(
  row: TrainingForecastRowInput,
  attributeLabels: Record<PlayerGeneratorAttributeName, string>,
): TrainingPlayerRowView {
  const attributeForecast = mapAttributeForecast(
    row.organicProgression.attributeBreakdown,
    attributeLabels,
    row.organicProgression.attributeAffinity.signatureAttributes,
    row.organicProgression.attributeAffinity.weakAttribute,
  );

  return {
    entryId: row.entry.id,
    roleTag: row.entry.roleTag ?? null,
    player: row.player,
    mode: row.mode,
    trainingClass: row.trainingClass,
    modeConfig: row.modeConfig,
    appearances: row.appearances,
    playerMvs: row.playerMvs,
    playerPps: row.playerPps,
    trainingXp: row.trainingXp,
    performanceXp: row.performanceXp,
    totalXp: row.totalXp,
    upgradeEstimate: row.upgradeEstimate,
    fatigueWarning: row.fatigueWarning,
    recoveryForecast: row.recoveryForecast,
    classTrainingFocus: {
      primary: row.organicProgression.topTrainingAttributes.map((entry) => ({
        attribute: attributeLabels[entry.attribute],
        weight: entry.weight,
      })),
      risks: row.organicProgression.negativeTrainingRisks.map((entry) => ({
        attribute: attributeLabels[entry.attribute],
        weight: entry.weight,
      })),
    },
    attributeForecast,
    modifiers: {
      traitModifierPct: row.organicProgression.traitModifierPct,
      facilityModifierPct: row.organicProgression.facilityModifierPct,
      potentialTrainingMultiplier: row.organicProgression.potentialTrainingMultiplier,
      signatureAttributes: row.organicProgression.attributeAffinity.signatureAttributes.map((attribute) => attributeLabels[attribute]),
      weakAttribute: attributeLabels[row.organicProgression.attributeAffinity.weakAttribute] ?? null,
    },
    developmentStars: row.developmentStars,
    traitBoosts: (row.organicProgression.traitBreakdown ?? [])
      .filter((entry) => entry.known && entry.legacyTraitTrainingFactorPct != null && entry.legacyTraitTrainingFactorPct !== 0)
      .map((entry) => ({
        trait: entry.trait,
        pct: entry.legacyTraitTrainingFactorPct ?? 0,
        tone: entry.tone,
      }))
      .sort((left, right) => Math.abs(right.pct) - Math.abs(left.pct)),
    trainingDemand: row.trainingDemand,
    organicForecast: {
      classBefore: row.organicProgression.classBefore,
      classAfter: row.organicProgression.classAfter,
      potentialRating: row.organicProgression.potentialRating,
      potentialTrainingMultiplier: row.organicProgression.potentialTrainingMultiplier,
      trainingSetpoints: row.organicProgression.trainingSetpoints,
      performanceSetpoints: row.organicProgression.performanceSetpoints,
      netSetpoints: row.organicProgression.netSetpoints,
      fatigueLoad: row.organicProgression.fatigueLoad,
      topGains: attributeForecast
        .filter((entry) => entry.delta > 0)
        .sort((left, right) => right.delta - left.delta)
        .slice(0, 3)
        .map((entry) => ({
          attribute: entry.attribute,
          before: entry.before,
          after: entry.after,
          delta: entry.delta,
        })),
      topLosses: attributeForecast
        .filter((entry) => entry.delta < 0)
        .sort((left, right) => left.delta - right.delta)
        .slice(0, 2)
        .map((entry) => ({
          attribute: entry.attribute,
          before: entry.before,
          after: entry.after,
          delta: entry.delta,
        })),
    },
    forecast: row.forecast,
  };
}
