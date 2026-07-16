import { describe, expect, it } from "vitest";

import { buildAffinityAlignedTopGains, buildAffinityForecastFocus } from "@/lib/training/affinity-forecast-focus";
import { TRAINING_ATTRIBUTE_LABELS } from "@/lib/training/training-levelup-service";

describe("affinity-forecast-focus", () => {
  it("prioritizes signature attributes in top gains and forecast chips", () => {
    const breakdown = [
      {
        attribute: "torment" as const,
        before: 40,
        after: 40.6,
        delta: 0.6,
        regression: -0.1,
        training: 0.5,
        performance: 0.2,
        affinity: "neutral" as const,
        trainingGrowthMultiplier: 1,
        performanceGrowthMultiplier: 1,
      },
      {
        attribute: "health" as const,
        before: 70,
        after: 70.4,
        delta: 0.4,
        regression: -0.1,
        training: 0.35,
        performance: 0.15,
        affinity: "signature" as const,
        trainingGrowthMultiplier: 1.15,
        performanceGrowthMultiplier: 1.15,
      },
      {
        attribute: "spirit" as const,
        before: 68,
        after: 68.5,
        delta: 0.5,
        regression: -0.1,
        training: 0.4,
        performance: 0.2,
        affinity: "signature" as const,
        trainingGrowthMultiplier: 1.15,
        performanceGrowthMultiplier: 1.15,
      },
      {
        attribute: "determination" as const,
        before: 55,
        after: 55.1,
        delta: 0.1,
        regression: -0.1,
        training: 0.05,
        performance: 0.15,
        affinity: "weak" as const,
        trainingGrowthMultiplier: 0.8,
        performanceGrowthMultiplier: 0.8,
      },
    ];

    const focus = buildAffinityForecastFocus({
      attributeBreakdown: breakdown,
      attributeLabels: TRAINING_ATTRIBUTE_LABELS,
      signatureAttributes: ["health", "spirit"],
      weakAttribute: "determination",
    });
    const topGains = buildAffinityAlignedTopGains({
      attributeBreakdown: breakdown,
      attributeLabels: TRAINING_ATTRIBUTE_LABELS,
      signatureAttributes: ["health", "spirit"],
      limit: 2,
    });

    expect(focus.primary.map((entry) => entry.attribute)).toEqual(["Spirit", "Health"]);
    expect(focus.weak[0]?.attribute).toBe("Determination");
    expect(topGains.map((entry) => entry.attribute)).toEqual(["Spirit", "Health"]);
  });
});
