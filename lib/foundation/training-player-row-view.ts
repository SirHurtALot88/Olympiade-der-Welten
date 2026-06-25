import type { PlayerGeneratorAttributeName } from "@/lib/data/olyDataTypes";
import type { TrainingPlayerRowView } from "@/app/foundation/training-facilities-v2/training-view-types";

type OrganicProgressionBreakdownEntry = {
  attribute: PlayerGeneratorAttributeName;
  before: number;
  after: number;
  delta: number;
};

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
    attributeBreakdown: OrganicProgressionBreakdownEntry[];
  };
  forecast: TrainingPlayerRowView["forecast"];
};

export function buildTrainingPlayerRowView(
  row: TrainingForecastRowInput,
  attributeLabels: Record<PlayerGeneratorAttributeName, string>,
): TrainingPlayerRowView {
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
    organicForecast: {
      classBefore: row.organicProgression.classBefore,
      classAfter: row.organicProgression.classAfter,
      potentialRating: row.organicProgression.potentialRating,
      potentialTrainingMultiplier: row.organicProgression.potentialTrainingMultiplier,
      trainingSetpoints: row.organicProgression.trainingSetpoints,
      performanceSetpoints: row.organicProgression.performanceSetpoints,
      netSetpoints: row.organicProgression.netSetpoints,
      fatigueLoad: row.organicProgression.fatigueLoad,
      topGains: row.organicProgression.attributeBreakdown
        .filter((entry) => entry.delta > 0)
        .sort((left, right) => right.delta - left.delta)
        .slice(0, 3)
        .map((entry) => ({
          attribute: attributeLabels[entry.attribute],
          before: entry.before,
          after: entry.after,
          delta: entry.delta,
        })),
      topLosses: row.organicProgression.attributeBreakdown
        .filter((entry) => entry.delta < 0)
        .sort((left, right) => left.delta - right.delta)
        .slice(0, 2)
        .map((entry) => ({
          attribute: attributeLabels[entry.attribute],
          before: entry.before,
          after: entry.after,
          delta: entry.delta,
        })),
    },
    forecast: row.forecast,
  };
}
