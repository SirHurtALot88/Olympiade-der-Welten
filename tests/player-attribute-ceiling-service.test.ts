import { describe, expect, it } from "vitest";

import type { Player, PlayerPotentialRecord } from "@/lib/data/olyDataTypes";
import { buildPlayerAxisStarProfile } from "@/lib/scouting/player-axis-star-rating";
import {
  buildHiddenAttributeCeilingsFromPotentialScore,
  deriveAxisPoStarsFromAttributeCeilings,
  getAttributeGrowthMultiplier,
  getAttributeHeadroom,
  getPerformanceHeadroomGrowthMultiplier,
  mapNumericCeilingToAxisPoStars,
} from "@/lib/scouting/player-attribute-ceiling-service";
import { buildPlayerPotentialCeilingProfile } from "@/lib/scouting/player-potential-ceiling-service";
import { buildPlayerPotentialRecord } from "@/lib/progression/player-potential-service";
import { getCombinedAttributeTrainingMultiplier } from "@/lib/foundation/player-potential-display-service";

function player(partial: Partial<Player> & { id: string }): Player {
  return {
    id: partial.id,
    name: partial.id,
    rating: partial.rating ?? 30,
    marketValue: partial.marketValue ?? 8,
    salaryDemand: partial.salaryDemand ?? 2,
    className: partial.className ?? "Berserker",
    race: "Human",
    alignment: "N",
    gender: "x",
    subclasses: [],
    traitsPositive: partial.traitsPositive ?? [],
    traitsNegative: partial.traitsNegative ?? [],
    coreStats: partial.coreStats ?? { pow: 46, spe: 17, men: 19, soc: 29 },
    attributeSheetStats: partial.attributeSheetStats ?? {
      power: 58,
      health: 52,
      stamina: 50,
      speed: 28,
      dexterity: 24,
      awareness: 22,
      intelligence: 26,
      will: 24,
      charisma: 30,
      spirit: 28,
      determination: 32,
      torment: 40,
    },
    preferredDisciplineIds: [],
    disciplineRatings: partial.disciplineRatings ?? { d_pow: 46, d_spe: 17, d_men: 19, d_soc: 29 },
    disciplineTierCounts: { above20: 0, above40: 0, above60: 0, above80: 0 },
    flavorEn: "",
    flavorDe: "",
    fatigue: 0,
    form: 0,
    potential: partial.potential ?? 32,
    trainingMode: "mittel",
    trainingClass: null,
  };
}

describe("player attribute ceiling service", () => {
  it("builds Kohan-like divergent axis ceilings and attribute spreads", () => {
    const kohan = player({ id: "kohan" });
    const peers = Array.from({ length: 30 }, (_, index) =>
      player({
        id: `peer-${index}`,
        coreStats: {
          pow: 35 + index,
          spe: 30 + (index % 7),
          men: 28 + (index % 5),
          soc: 27 + (index % 6),
        },
      }),
    );
    const gameState = {
      players: [kohan, ...peers],
      disciplines: [
        { id: "d_pow", name: "Pow", category: "power", displayOrder: 1, originalOrder: 1, playerCount: 31 },
        { id: "d_spe", name: "Spe", category: "speed", displayOrder: 2, originalOrder: 2, playerCount: 31 },
        { id: "d_men", name: "Men", category: "mental", displayOrder: 3, originalOrder: 3, playerCount: 31 },
        { id: "d_soc", name: "Soc", category: "social", displayOrder: 4, originalOrder: 4, playerCount: 31 },
      ],
    } as never;
    const currentStars = buildPlayerAxisStarProfile({ gameState, player: kohan });
    const record = buildPlayerPotentialRecord({ saveId: "save-kohan", player: kohan });
    const ceiling = buildPlayerPotentialCeilingProfile({
      saveId: "save-kohan",
      player: kohan,
      currentStars,
      hiddenPotentialScore: record.hiddenPotentialScore,
    });
    const attributeCeiling = buildHiddenAttributeCeilingsFromPotentialScore({
      saveId: "save-kohan",
      player: kohan,
      currentStars,
      hiddenPotentialScore: record.hiddenPotentialScore,
    });
    const derivedAxis = deriveAxisPoStarsFromAttributeCeilings(attributeCeiling);

    expect(attributeCeiling.power!).toBeGreaterThan(attributeCeiling.speed! + 5);
    expect(attributeCeiling.power).toBeDefined();
    expect(attributeCeiling.speed).toBeDefined();
    expect(attributeCeiling.power!).not.toBe(attributeCeiling.speed!);
    expect(attributeCeiling.power!).toBeGreaterThanOrEqual(kohan.attributeSheetStats!.power!);
    expect(ceiling.pow).toBeGreaterThanOrEqual(derivedAxis.pow);
  });

  it("derives axis PO stars from per-attribute ceilings", () => {
    const attributeCeiling = {
      power: 88,
      health: 72,
      stamina: 70,
      speed: 55,
      dexterity: 54,
      awareness: 52,
      intelligence: 60,
      will: 58,
      charisma: 50,
      spirit: 48,
      determination: 49,
      torment: 80,
    };
    const axis = deriveAxisPoStarsFromAttributeCeilings(attributeCeiling);
    expect(axis.pow).toBe(mapNumericCeilingToAxisPoStars(88));
    expect(axis.spe).toBe(mapNumericCeilingToAxisPoStars(55));
  });

  it("caps attribute growth multiplier at 0.05 when at ceiling", () => {
    expect(getAttributeGrowthMultiplier("capped")).toBe(0.05);
    expect(getAttributeGrowthMultiplier("closing")).toBe(0.45);
    expect(getAttributeGrowthMultiplier("open")).toBe(1);
  });

  it("only soft-tapers performance growth near attribute ceiling", () => {
    expect(getPerformanceHeadroomGrowthMultiplier(20)).toBe(1);
    expect(getPerformanceHeadroomGrowthMultiplier(8)).toBe(1);
    expect(getPerformanceHeadroomGrowthMultiplier(5)).toBe(1);
    expect(getPerformanceHeadroomGrowthMultiplier(3)).toBeCloseTo(0.88, 2);
    expect(getPerformanceHeadroomGrowthMultiplier(2)).toBeGreaterThan(0.72);
    expect(getPerformanceHeadroomGrowthMultiplier(0)).toBeGreaterThan(0.5);
    expect(getPerformanceHeadroomGrowthMultiplier(0)).toBeGreaterThan(getAttributeGrowthMultiplier("capped"));
  });

  it("detects capped headroom when current value is near ceiling", () => {
    const target = player({
      id: "capped-player",
      attributeSheetStats: {
        power: 72,
        health: 70,
        stamina: 68,
        speed: 40,
        dexterity: 38,
        awareness: 36,
        intelligence: 35,
        will: 34,
        charisma: 40,
        spirit: 38,
        determination: 42,
        torment: 45,
      },
    });
    const record: PlayerPotentialRecord = {
      playerId: target.id,
      potentialBand: "medium",
      hiddenPotentialScore: 70,
      confidence: 0,
      source: "generated",
      hiddenAttributeCeiling: {
        power: 72,
        health: 75,
        stamina: 70,
        speed: 80,
        dexterity: 78,
        awareness: 76,
        intelligence: 74,
        will: 72,
        charisma: 78,
        spirit: 76,
        determination: 80,
        torment: 73,
      },
    };

    const powerHeadroom = getAttributeHeadroom({ player: target, attribute: "power", record });
    const speedHeadroom = getAttributeHeadroom({ player: target, attribute: "speed", record });

    expect(powerHeadroom.state).toBe("capped");
    expect(speedHeadroom.state).toBe("open");
    expect(
      getCombinedAttributeTrainingMultiplier({
        player: target,
        attribute: "power",
        record,
      }),
    ).toBeLessThan(
      getCombinedAttributeTrainingMultiplier({
        player: target,
        attribute: "determination",
        record,
      }),
    );
  });

  it("reports an at/over-cap attribute as capped with 0 headroom (not open/0.80 multiplier)", () => {
    // Bugfix: Ein bruchteilig ueber dem ganzzahligen Ceiling liegender Wert wurde frueher
    // als state:"open"/headroom:2 gemeldet, was den Performance-Wachstumsmultiplikator von
    // 0.55 (am Limit) auf 0.80 anhob und den Potenzial-Cap durchbrach.
    const target = player({
      id: "over-cap-player",
      attributeSheetStats: {
        power: 72.4, // gebrochen ueber dem ganzzahligen Ceiling 72
        health: 70,
        stamina: 68,
        speed: 40,
        dexterity: 38,
        awareness: 36,
        intelligence: 35,
        will: 34,
        charisma: 40,
        spirit: 38,
        determination: 42,
        torment: 45,
      },
    });
    const record: PlayerPotentialRecord = {
      playerId: target.id,
      potentialBand: "medium",
      hiddenPotentialScore: 70,
      confidence: 0,
      source: "generated",
      hiddenAttributeCeiling: {
        power: 72,
        health: 75,
        stamina: 70,
        speed: 80,
        dexterity: 78,
        awareness: 76,
        intelligence: 74,
        will: 72,
        charisma: 78,
        spirit: 76,
        determination: 80,
        torment: 73,
      },
    };

    const headroom = getAttributeHeadroom({ player: target, attribute: "power", record });
    expect(headroom.state).toBe("capped");
    expect(headroom.headroom).toBe(0);
    expect(headroom.ceiling).toBe(72); // echtes Ceiling, kein kuenstliches current+2
    // At-cap Performance-Multiplikator = 0.55, NICHT 0.80.
    expect(getPerformanceHeadroomGrowthMultiplier(headroom.headroom)).toBeCloseTo(0.55, 5);
    expect(getPerformanceHeadroomGrowthMultiplier(headroom.headroom)).toBeLessThan(0.8);
  });
});
