import type { GameState, Player, PlayerGeneratorAttributeName, PlayerPotentialRecord, AdminBalancingConfigInput } from "@/lib/data/olyDataTypes";
import type { TrainingPlayerRowView } from "@/app/foundation/training-facilities-v2/training-view-types";
import { buildAffinityAlignedTopGains, buildAffinityForecastFocus } from "@/lib/training/affinity-forecast-focus";
import type { OrganicProgressionAttributeBreakdown } from "@/lib/training/organic-season-progression";
import { resolveTeamTrainingFocusAxis } from "@/lib/training/organic-season-progression";
import type { TrainingModeDemandView } from "@/lib/training/training-mode-demand-service";
import { getAttributeHeadroom, getHeadroomLabel } from "@/lib/scouting/player-attribute-ceiling-service";

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
  fatigueWarning: string;
  recoveryForecast: TrainingPlayerRowView["recoveryForecast"];
  organicProgression: {
    classBefore: string;
    classAfter: string;
    potentialRating: number | null;
    potentialTrainingMultiplier: number;
    trainingSetpoints: number;
    performanceSetpoints: number;
    appliedPerformanceSetpoints: number;
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
  potentialRecord?: PlayerPotentialRecord | null;
  adminBalancingConfig?: AdminBalancingConfigInput | null;
  /**
   * Full game state — used only to resolve the team's current training focus axis via
   * `resolveTeamTrainingFocusAxis`. Optional so existing callers/tests that don't need the
   * route bonus surfaced can omit it (resolves to `trainingFocusAxis: null`, i.e. no bonus,
   * same as today's behavior).
   */
  gameState?: GameState;
};

function mapAttributeForecast(
  breakdown: OrganicProgressionAttributeBreakdown[],
  attributeLabels: Record<PlayerGeneratorAttributeName, string>,
  signatureAttributes: PlayerGeneratorAttributeName[],
  weakAttribute: PlayerGeneratorAttributeName,
  player?: Player | null,
  potentialRecord?: PlayerPotentialRecord | null,
): TrainingPlayerRowView["attributeForecast"] {
  const signatureSet = new Set(signatureAttributes);
  return breakdown.map((entry) => {
    const headroom =
      player != null
        ? getAttributeHeadroom({
            player,
            attribute: entry.attribute,
            record: potentialRecord,
          })
        : null;
    return {
      attributeKey: entry.attribute,
      attribute: attributeLabels[entry.attribute],
      before: entry.before,
      after: entry.after,
      delta: entry.delta,
      training: entry.training,
      performance: entry.performance,
      regression: entry.regression,
      affinity: signatureSet.has(entry.attribute) ? "signature" : entry.attribute === weakAttribute ? "weak" : "neutral",
      ceilingState: headroom?.state,
      headroomLabel: headroom ? getHeadroomLabel(headroom.state, headroom.headroom) : null,
    };
  });
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
    row.player as Player,
    row.potentialRecord,
  );
  const affinityForecastFocus = buildAffinityForecastFocus({
    attributeBreakdown: row.organicProgression.attributeBreakdown,
    attributeLabels,
    signatureAttributes: row.organicProgression.attributeAffinity.signatureAttributes,
    weakAttribute: row.organicProgression.attributeAffinity.weakAttribute,
  });
  const trainingFocusAxis = row.gameState ? resolveTeamTrainingFocusAxis(row.gameState, row.player.id) : null;

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
    fatigueWarning: row.fatigueWarning,
    recoveryForecast: row.recoveryForecast,
    classTrainingFocus: {
      primary: affinityForecastFocus.primary.map((entry) => ({
        attribute: entry.attribute,
        weight: entry.delta,
      })),
      risks: affinityForecastFocus.weak.map((entry) => ({
        attribute: entry.attribute,
        weight: entry.delta,
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
      performanceSetpoints: row.organicProgression.appliedPerformanceSetpoints,
      netSetpoints: row.organicProgression.netSetpoints,
      fatigueLoad: row.organicProgression.fatigueLoad,
      topGains: buildAffinityAlignedTopGains({
        attributeBreakdown: row.organicProgression.attributeBreakdown,
        attributeLabels,
        signatureAttributes: row.organicProgression.attributeAffinity.signatureAttributes,
        limit: 3,
      }),
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
    adminBalancingConfig: row.adminBalancingConfig ?? null,
    trainingFocusAxis,
  };
}
