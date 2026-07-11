import type { AdminBalancingConfigInput, PlayerGeneratorAttributeName } from "@/lib/data/olyDataTypes";
import type { TrainingAttributeForecastEntry } from "@/app/foundation/training-facilities-v2/training-view-types";
import {
  getClassTrainingProfile,
  PROGRESSION_ATTRIBUTE_ORDER,
} from "@/lib/training/class-progression-config";

function buildClassAttributeWeightMap(
  trainingClass: string,
  adminConfig?: AdminBalancingConfigInput | null,
): Map<PlayerGeneratorAttributeName, number> {
  const profile = getClassTrainingProfile(trainingClass, adminConfig);
  return new Map(PROGRESSION_ATTRIBUTE_ORDER.map((attribute) => [attribute, profile[attribute]] as const));
}

export function sortTrainingAttributeForecastByClassProfile(
  forecast: TrainingAttributeForecastEntry[],
  trainingClass: string,
  adminConfig?: AdminBalancingConfigInput | null,
): TrainingAttributeForecastEntry[] {
  const weightByKey = buildClassAttributeWeightMap(trainingClass, adminConfig);

  return [...forecast].sort((left, right) => {
    const leftWeight = weightByKey.get(left.attributeKey) ?? 0;
    const rightWeight = weightByKey.get(right.attributeKey) ?? 0;
    if (leftWeight !== rightWeight) {
      return rightWeight - leftWeight;
    }
    const deltaDiff = Math.abs(right.delta) - Math.abs(left.delta);
    if (deltaDiff !== 0) {
      return deltaDiff;
    }
    return (
      PROGRESSION_ATTRIBUTE_ORDER.indexOf(left.attributeKey) -
      PROGRESSION_ATTRIBUTE_ORDER.indexOf(right.attributeKey)
    );
  });
}

export function getClassPrimaryAttributeKeys(
  trainingClass: string,
  adminConfig?: AdminBalancingConfigInput | null,
): PlayerGeneratorAttributeName[] {
  const profile = getClassTrainingProfile(trainingClass, adminConfig);
  return PROGRESSION_ATTRIBUTE_ORDER.map((attribute) => ({ attribute, weight: profile[attribute] }))
    .filter((entry) => entry.weight > 0)
    .sort((left, right) => right.weight - left.weight)
    .slice(0, 3)
    .map((entry) => entry.attribute);
}
