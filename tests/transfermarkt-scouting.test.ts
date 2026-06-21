import { describe, expect, it } from "vitest";

import { getTransfermarktTierFromPoints } from "@/lib/market/transfermarkt-sheet-stats";
import {
  buildTransfermarktScoutedAttributeRows,
  buildScoutedDisciplineTiers,
  getScoutedNumericEstimate,
  getScoutedTraitView,
  getTransfermarktScoutingDisclosure,
  getTransfermarktTrainingAffinityVisibility,
  getTransfermarktScoutingRecruitmentBonus,
} from "@/lib/market/transfermarkt-scouting";

describe("transfermarkt scouting", () => {
  it("shows exact top discipline tiers on max scouting", () => {
    const disciplines = [
      { disciplineId: "basketball", disciplineName: "Basketball", score: 74 },
      { disciplineId: "football", disciplineName: "Football", score: 73 },
      { disciplineId: "showcase", disciplineName: "Showcase", score: 61 },
      { disciplineId: "fechten", disciplineName: "Fechten", score: 55 },
    ];

    const result = buildScoutedDisciplineTiers({
      saveId: "save-a",
      playerId: "player-1",
      scoutingLevel: 5,
      disciplines,
      topN: 3,
    });

    expect(result).toEqual(
      [...disciplines]
        .sort((left, right) => right.score - left.score)
        .slice(0, 3)
        .map((entry) => ({
          disciplineId: entry.disciplineId,
          disciplineName: entry.disciplineName,
          displayedScore: entry.score,
          scoreTier: getTransfermarktTierFromPoints(entry.score),
        })),
    );
  });

  it("stays deterministic but can diverge from the exact ranking on low scouting", () => {
    const disciplines = [
      { disciplineId: "basketball", disciplineName: "Basketball", score: 74 },
      { disciplineId: "football", disciplineName: "Football", score: 73 },
      { disciplineId: "showcase", disciplineName: "Showcase", score: 71 },
      { disciplineId: "fechten", disciplineName: "Fechten", score: 69 },
    ];

    const low = buildScoutedDisciplineTiers({
      saveId: "save-a",
      playerId: "player-1",
      scoutingLevel: 0,
      disciplines,
      topN: 3,
    });
    const lowAgain = buildScoutedDisciplineTiers({
      saveId: "save-a",
      playerId: "player-1",
      scoutingLevel: 0,
      disciplines,
      topN: 3,
    });
    const exact = buildScoutedDisciplineTiers({
      saveId: "save-a",
      playerId: "player-1",
      scoutingLevel: 5,
      disciplines,
      topN: 3,
    });

    expect(low).toEqual(lowAgain);
    expect(
      low.some(
        (entry, index) =>
          entry.disciplineId !== exact[index]?.disciplineId || entry.scoreTier !== exact[index]?.scoreTier,
      ),
    ).toBe(true);
  });

  it("raises recruitment bonus with better scouting", () => {
    expect(getTransfermarktScoutingRecruitmentBonus(0)).toBe(0);
    expect(getTransfermarktScoutingRecruitmentBonus(2)).toBeGreaterThan(getTransfermarktScoutingRecruitmentBonus(1));
    expect(getTransfermarktScoutingRecruitmentBonus(5)).toBeGreaterThan(getTransfermarktScoutingRecruitmentBonus(4));
  });

  it("reveals traits and preferred disciplines by scouting level", () => {
    expect(getTransfermarktScoutingDisclosure(1)).toMatchObject({
      positiveTraitsVisible: 0,
      negativeTraitsVisible: false,
      preferredDisciplinesVisible: false,
      exactAttributeValuesVisible: false,
    });
    expect(getTransfermarktScoutingDisclosure(2).positiveTraitsVisible).toBe(1);
    expect(getTransfermarktScoutingDisclosure(3).positiveTraitsVisible).toBe(2);
    expect(getTransfermarktScoutingDisclosure(4)).toMatchObject({
      negativeTraitsVisible: true,
      preferredDisciplinesVisible: true,
      exactAttributeValuesVisible: false,
    });

    const level3 = getScoutedTraitView({
      traitsPositive: ["Motivated", "Flexible", "Clutch"],
      traitsNegative: ["Lazy"],
      scoutingLevel: 3,
    });
    expect(level3.visiblePositiveTraits).toEqual(["Motivated", "Flexible"]);
    expect(level3.visibleNegativeTraits).toEqual([]);
    expect(level3.hiddenPositiveTraitCount).toBe(1);
    expect(level3.hiddenNegativeTraitCount).toBe(1);

    const level4 = getScoutedTraitView({
      traitsPositive: ["Motivated", "Flexible", "Clutch"],
      traitsNegative: ["Lazy"],
      scoutingLevel: 4,
    });
    expect(level4.visibleNegativeTraits).toEqual(["Lazy"]);
  });

  it("adds deterministic numeric scouting noise until level 4 reveals exact values", () => {
    const low = getScoutedNumericEstimate({
      saveId: "save-a",
      playerId: "player-1",
      field: "power",
      value: 94,
      scoutingLevel: 1,
    });
    const lowAgain = getScoutedNumericEstimate({
      saveId: "save-a",
      playerId: "player-1",
      field: "power",
      value: 94,
      scoutingLevel: 1,
    });
    const exact = getScoutedNumericEstimate({
      saveId: "save-a",
      playerId: "player-1",
      field: "power",
      value: 94,
      scoutingLevel: 4,
    });

    expect(low).toBe(lowAgain);
    expect(exact).toBe(94);
    expect(low).not.toBe(exact);
  });

  it("reveals attributes in scouting stages from coarse bands to exact values", () => {
    const level0 = buildTransfermarktScoutedAttributeRows({
      scoutingLevel: 0,
      values: {
        power: 91,
        speed: 79,
        intelligence: 68,
        charisma: 55,
        health: 62,
      },
      ratings: {
        power: "S+",
        speed: "A",
        intelligence: "C",
        charisma: "E",
        health: "D",
      },
    });
    const level1 = buildTransfermarktScoutedAttributeRows({
      scoutingLevel: 1,
      values: {
        power: 91,
        speed: 79,
        intelligence: 68,
        charisma: 55,
        health: 62,
      },
      ratings: {
        power: "S+",
        speed: "A",
        intelligence: "C",
        charisma: "E",
        health: "D",
      },
    });
    const level4 = buildTransfermarktScoutedAttributeRows({
      scoutingLevel: 4,
      values: {
        power: 91,
        speed: 79,
        intelligence: 68,
        charisma: 55,
      },
      ratings: {
        power: "S+",
        speed: "A",
        intelligence: "C",
        charisma: "E",
      },
    });
    const level5 = buildTransfermarktScoutedAttributeRows({
      scoutingLevel: 5,
      values: {
        power: 91,
        speed: 79,
        intelligence: 68,
        charisma: 55,
      },
      ratings: {
        power: "S+",
        speed: "A",
        intelligence: "C",
        charisma: "E",
      },
    });

    expect(level0.filter((entry) => entry.revealed)).toHaveLength(4);
    expect(level0.find((entry) => entry.key === "power")).toMatchObject({
      revealed: true,
      ratingLabel: null,
      rangeLabel: "S-S+",
      value: null,
    });
    expect(level1.filter((entry) => entry.revealed)).toHaveLength(4);
    expect(level1.find((entry) => entry.key === "power")).toMatchObject({
      revealed: true,
      ratingLabel: null,
      rangeLabel: "S-S+",
      value: null,
    });
    expect(level1.find((entry) => entry.key === "health")).toMatchObject({
      revealed: false,
      revealLevel: 2,
    });
    expect(level4.find((entry) => entry.key === "power")).toMatchObject({
      revealed: true,
      ratingLabel: "S+",
      rangeLabel: null,
      value: null,
    });
    expect(level5.find((entry) => entry.key === "power")?.value).toBe(91);
  });

  it("keeps training affinity names hidden until enough scouting is available", () => {
    expect(getTransfermarktTrainingAffinityVisibility(1)).toEqual({
      positiveVisible: 0,
      negativeVisible: 0,
    });
    expect(getTransfermarktTrainingAffinityVisibility(2)).toEqual({
      positiveVisible: 1,
      negativeVisible: 0,
    });
    expect(getTransfermarktTrainingAffinityVisibility(3)).toEqual({
      positiveVisible: 2,
      negativeVisible: 1,
    });
  });
});
