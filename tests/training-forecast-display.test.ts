import { describe, expect, it } from "vitest";

import type { TrainingAttributeForecastEntry } from "@/app/foundation/training-facilities-v2/training-view-types";
import {
  getClassPrimaryAttributeKeys,
  sortTrainingAttributeForecastByClassProfile,
} from "@/lib/training/training-forecast-display";

function buildEntry(
  attributeKey: TrainingAttributeForecastEntry["attributeKey"],
  delta = 0,
): TrainingAttributeForecastEntry {
  return {
    attributeKey,
    attribute: attributeKey,
    before: 50,
    after: 50 + delta,
    delta,
    training: delta,
    performance: 0,
    regression: 0,
    affinity: "neutral",
  };
}

describe("training-forecast-display", () => {
  it("orders forecast attributes by class profile weight for Tactician", () => {
    const forecast = [
      buildEntry("torment", 0.2),
      buildEntry("power", 1.1),
      buildEntry("charisma", 0.4),
      buildEntry("intelligence", 0.9),
      buildEntry("awareness", 0.3),
      buildEntry("spirit", 0.1),
    ];

    const sorted = sortTrainingAttributeForecastByClassProfile(forecast, "Tactician");
    expect(sorted.map((entry) => entry.attributeKey).slice(0, 3)).toEqual(["torment", "spirit", "awareness"]);
  });

  it("exposes primary class attributes in weight order", () => {
    expect(getClassPrimaryAttributeKeys("Hero")).toEqual(["charisma", "spirit", "power"]);
    expect(getClassPrimaryAttributeKeys("Tactician")).toEqual(["spirit", "torment", "awareness"]);
  });

  it("uses delta magnitude as tiebreaker for equal class weights", () => {
    const forecast = [buildEntry("spirit", 0.1), buildEntry("torment", 0.8), buildEntry("awareness", 0.5)];
    const sorted = sortTrainingAttributeForecastByClassProfile(forecast, "Tactician");
    expect(sorted.map((entry) => entry.attributeKey)).toEqual(["torment", "spirit", "awareness"]);
  });
});
