import { describe, expect, it } from "vitest";

import {
  getTransfermarktAdvancedColumns,
  getTransfermarktBaseColumns,
  TRANSFERMARKT_COLUMN_CONTRACT,
} from "@/lib/market/transfermarkt-column-contract";

describe("transfermarkt column contract", () => {
  it("ensures all visible transfermarkt columns have labels and data keys", () => {
    for (const column of TRANSFERMARKT_COLUMN_CONTRACT) {
      expect(column.label.length).toBeGreaterThan(0);
      expect(column.dataKey.length).toBeGreaterThan(0);
      expect(column.defaultWidth).toBeGreaterThanOrEqual(column.minWidth);
    }
  });

  it("marks team-dependent columns correctly", () => {
    const fit = TRANSFERMARKT_COLUMN_CONTRACT.find((entry) => entry.id === "fitDisplay");
    const fitTraits = TRANSFERMARKT_COLUMN_CONTRACT.find((entry) => entry.id === "fitTraits");
    const marketValue = TRANSFERMARKT_COLUMN_CONTRACT.find((entry) => entry.id === "marketValue");

    expect(fit?.teamDependent).toBe(true);
    expect(fitTraits?.teamDependent).toBe(true);
    expect(marketValue?.teamDependent).toBe(false);
  });

  it("keeps base columns in explicit Retool-style order", () => {
    expect(getTransfermarktBaseColumns().map((entry) => entry.id)).toEqual([
      "imageUrl",
      "name",
      "marketValue",
      "salary",
      "pow",
      "spe",
      "men",
      "soc",
      "className",
      "subclasses",
      "traits",
      "topDisciplineScores",
      "potentialTier",
      "trainingFormTier",
      "developmentRoute",
      "regressionRisk",
      "fitDisplay",
      "bracket",
      "race",
    ]);
  });

  it("keeps advanced columns available for the attribute toggle", () => {
    expect(getTransfermarktAdvancedColumns().map((entry) => entry.id)).toEqual([
      "powerRating",
      "healthRating",
      "staminaRating",
      "intelligenceRating",
      "determinationRating",
      "awarenessRating",
      "speedRating",
      "dexterityRating",
      "charismaRating",
      "willRating",
      "spiritRating",
      "tormentRating",
      "alignment",
      "gender",
      "marketValueSalaryRatio",
      "fitRace",
      "fitSubclasses",
      "fitTraits",
      "fitAlignment",
    ]);
  });
});
