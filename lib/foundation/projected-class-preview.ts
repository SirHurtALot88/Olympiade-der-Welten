import type { PlayerGeneratorAttributes } from "@/lib/data/olyDataTypes";
import type { AdminBalancingConfigInput } from "@/lib/data/olyDataTypes";
import {
  calculateDynamicClassScores,
  type ProgressionClassName,
} from "@/lib/training/class-progression-config";

export type ProjectedClassEntry = {
  className: ProgressionClassName;
  score: number;
};

export function buildProjectedClassPreview(
  attributes: PlayerGeneratorAttributes,
  currentClassName: string | null | undefined,
  adminConfig?: AdminBalancingConfigInput | null,
): {
  currentClassName: string | null;
  projectedTop3: ProjectedClassEntry[];
  reclassRecommended: boolean;
  projectedPrimaryClass: ProgressionClassName;
} {
  const projectedTop3 = calculateDynamicClassScores(attributes, adminConfig).slice(0, 3);
  const projectedPrimaryClass = projectedTop3[0]?.className ?? "Hero";
  const current = currentClassName?.trim() || null;
  return {
    currentClassName: current,
    projectedTop3,
    projectedPrimaryClass,
    reclassRecommended: Boolean(current && current !== projectedPrimaryClass),
  };
}
