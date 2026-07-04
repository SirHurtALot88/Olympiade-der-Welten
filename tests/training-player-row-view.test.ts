import { describe, expect, it } from "vitest";

import { buildTrainingPlayerRowView } from "@/lib/foundation/training-player-row-view";
import { TRAINING_ATTRIBUTE_LABELS } from "@/lib/training/training-levelup-service";

describe("buildTrainingPlayerRowView", () => {
  it("maps class focus, attribute forecast and modifiers", () => {
    const row = buildTrainingPlayerRowView(
      {
        entry: { id: "entry-1", roleTag: "Starter" },
        player: {
          id: "player-1",
          name: "Test Player",
          className: "Berserker",
          coreStats: { pow: 40, spe: 35, men: 30, soc: 25 },
        },
        mode: "mittel",
        trainingClass: "Berserker",
        modeConfig: { label: "Mittel", note: "Standard", fatigueRisk: "mittel" },
        appearances: 3,
        playerMvs: 12,
        playerPps: 45,
        trainingXp: 70,
        performanceXp: 30,
        totalXp: 100,
        fatigueWarning: "ok",
        recoveryForecast: { before: 10, after: 10, modifierPct: 0 },
        organicProgression: {
          classBefore: "Berserker",
          classAfter: "Berserker",
          potentialRating: 80,
          potentialTrainingMultiplier: 1.1,
          trainingSetpoints: 3,
          performanceSetpoints: 7.19,
          appliedPerformanceSetpoints: 1.2,
          netSetpoints: 2.4,
          fatigueLoad: 12,
          traitModifierPct: 5,
          traitBreakdown: [
            { trait: "Diligent", legacyTraitTrainingFactorPct: 25, known: true, tone: "positive" as const },
            { trait: "Lazy", legacyTraitTrainingFactorPct: -20, known: true, tone: "negative" as const },
          ],
          facilityModifierPct: 8,
          topTrainingAttributes: [{ attribute: "power", weight: 1.6 }],
          negativeTrainingRisks: [{ attribute: "charisma", weight: -0.3 }],
          attributeAffinity: {
            signatureAttributes: ["power", "will"],
            weakAttribute: "dexterity",
          },
          attributeBreakdown: [
            {
              attribute: "power",
              before: 50,
              after: 51.2,
              delta: 1.2,
              regression: -0.1,
              training: 1.0,
              performance: 0.3,
              affinity: "signature",
              trainingGrowthMultiplier: 1.15,
              performanceGrowthMultiplier: 1.15,
            },
            {
              attribute: "dexterity",
              before: 44,
              after: 44.1,
              delta: 0.1,
              regression: -0.1,
              training: 0.05,
              performance: 0.15,
              affinity: "weak",
              trainingGrowthMultiplier: 0.8,
              performanceGrowthMultiplier: 0.8,
            },
          ],
        },
        forecast: {
          netDevelopmentXP: 55,
          trainingFormTier: "B",
          regressionRisk: "low",
          regressionPressure: 4,
          appearanceXP: 10,
          mvsXP: 8,
          ppsBonusXP: 6,
          topPlayerXP: 0,
          highlightXP: 0,
          traitModifierPct: 5,
          fatigueStrain: { label: "mittel" },
        },
        developmentStars: {
          currentAbilityStars: "3,5 Sterne",
          potentialStars: "4,0 Sterne",
          currentAbilityRating: 70,
          potentialRating: 80,
        },
        trainingDemand: null,
      },
      TRAINING_ATTRIBUTE_LABELS,
    );

    expect(row.classTrainingFocus.primary[0]?.attribute).toBe("Power");
    expect(row.classTrainingFocus.primary[0]?.weight).toBe(1.2);
    expect(row.classTrainingFocus.risks[0]?.attribute).toBe("Dexterity");
    expect(row.attributeForecast[0]?.affinity).toBe("signature");
    expect(row.modifiers.signatureAttributes).toContain("Power");
    expect(row.modifiers.weakAttribute).toBe("Dexterity");
    expect(row.traitBoosts[0]?.trait).toBe("Diligent");
    expect(row.organicForecast.performanceSetpoints).toBe(1.2);
    expect(row.developmentStars.potentialStars).toBe("4,0 Sterne");
  });
});
