import { describe, expect, it } from "vitest";

import type { Player } from "@/lib/data/olyDataTypes";
import { buildPlayerAxisStarProfile } from "@/lib/scouting/player-axis-star-rating";
import {
  attachPotentialCeilingToRecord,
  buildPlayerPotentialCeilingProfile,
  buildPotentialGap,
  revealPotentialStars,
} from "@/lib/scouting/player-potential-ceiling-service";
import { buildPlayerPotentialRecord } from "@/lib/progression/player-potential-service";

function player(partial: Partial<Player> & { id: string }): Player {
  return {
    id: partial.id,
    name: partial.id,
    rating: partial.rating ?? 60,
    marketValue: partial.marketValue ?? 15,
    salaryDemand: partial.salaryDemand ?? 3,
    className: partial.className ?? "Hero",
    race: "Human",
    alignment: "N",
    gender: "x",
    subclasses: [],
    traitsPositive: partial.traitsPositive ?? [],
    traitsNegative: partial.traitsNegative ?? [],
    coreStats: partial.coreStats ?? { pow: 55, spe: 55, men: 55, soc: 55 },
    attributeSheetStats: null,
    preferredDisciplineIds: [],
    disciplineRatings: partial.disciplineRatings ?? { d_pow: 55, d_spe: 55, d_men: 55, d_soc: 55 },
    disciplineTierCounts: { above20: 0, above40: 0, above60: 0, above80: 0 },
    flavorEn: "",
    flavorDe: "",
    fatigue: 0,
    form: 0,
    potential: partial.potential ?? 78,
    trainingMode: "mittel",
    trainingClass: null,
  };
}

describe("player potential ceiling service", () => {
  it("keeps ceiling at or above current axis stars", () => {
    const target = player({ id: "youth", rating: 58, potential: 82, coreStats: { pow: 58, spe: 60, men: 57, soc: 56 } });
    const current = buildPlayerAxisStarProfile({
      gameState: {
        players: [target],
        disciplines: [
          { id: "d_pow", name: "Pow", category: "power", displayOrder: 1, originalOrder: 1, playerCount: 1 },
          { id: "d_spe", name: "Spe", category: "speed", displayOrder: 2, originalOrder: 2, playerCount: 1 },
          { id: "d_men", name: "Men", category: "mental", displayOrder: 3, originalOrder: 3, playerCount: 1 },
          { id: "d_soc", name: "Soc", category: "social", displayOrder: 4, originalOrder: 4, playerCount: 1 },
        ],
      } as never,
      player: target,
    });
    const ceiling = buildPlayerPotentialCeilingProfile({
      saveId: "save-1",
      player: target,
      currentStars: current,
      hiddenPotentialScore: 82,
    });
    expect(ceiling.pow).toBeGreaterThanOrEqual(current.pow);
    expect(buildPotentialGap({ currentStars: current, ceiling })).toBeGreaterThan(0);
  });

  it("persists ceiling on record and hides numeric potential before L3", () => {
    const target = player({ id: "p1" });
    const current = buildPlayerAxisStarProfile({
      gameState: {
        players: [target],
        disciplines: [
          { id: "d_pow", name: "Pow", category: "power", displayOrder: 1, originalOrder: 1, playerCount: 1 },
          { id: "d_spe", name: "Spe", category: "speed", displayOrder: 2, originalOrder: 2, playerCount: 1 },
          { id: "d_men", name: "Men", category: "mental", displayOrder: 3, originalOrder: 3, playerCount: 1 },
          { id: "d_soc", name: "Soc", category: "social", displayOrder: 4, originalOrder: 4, playerCount: 1 },
        ],
      } as never,
      player: target,
    });
    const ceiling = buildPlayerPotentialCeilingProfile({
      saveId: "save-1",
      player: target,
      currentStars: current,
      hiddenPotentialScore: 78,
    });
    const record = attachPotentialCeilingToRecord({
      record: { playerId: "p1", potentialBand: "medium", confidence: 0, source: "generated" },
      ceiling,
    });
    expect(record.hiddenPotentialCeilingByAxis?.pow).toBe(ceiling.pow);
    expect(revealPotentialStars({ ceiling, currentStars: current, scoutingLevel: 1 }).overallMin).toBeNull();
    expect(revealPotentialStars({ ceiling, currentStars: current, scoutingLevel: 3 }).overallMin).not.toBeNull();
  });

  it("allows weak overall players to carry high single-axis potential ceilings", () => {
    const kohanLike = player({
      id: "kohan-like",
      className: "Berserker",
      rating: 30,
      potential: 32,
      coreStats: { pow: 46, spe: 17, men: 19, soc: 29 },
      disciplineRatings: { d_pow: 46, d_spe: 17, d_men: 19, d_soc: 29 },
    });
    const peers = Array.from({ length: 40 }, (_, index) =>
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
      players: [kohanLike, ...peers],
      disciplines: [
        { id: "d_pow", name: "Pow", category: "power", displayOrder: 1, originalOrder: 1, playerCount: 41 },
        { id: "d_spe", name: "Spe", category: "speed", displayOrder: 2, originalOrder: 2, playerCount: 41 },
        { id: "d_men", name: "Men", category: "mental", displayOrder: 3, originalOrder: 3, playerCount: 41 },
        { id: "d_soc", name: "Soc", category: "social", displayOrder: 4, originalOrder: 4, playerCount: 41 },
      ],
    } as never;
    const current = buildPlayerAxisStarProfile({ gameState, player: kohanLike });
    const record = buildPlayerPotentialRecord({ saveId: "save-kohan", player: kohanLike });
    const ceiling = buildPlayerPotentialCeilingProfile({
      saveId: "save-kohan",
      player: kohanLike,
      currentStars: current,
      hiddenPotentialScore: record.hiddenPotentialScore,
    });

    expect(current.overall).toBeLessThanOrEqual(1.5);
    expect(ceiling.pow).toBeGreaterThan(current.pow);
    expect(ceiling.pow - current.pow).toBeGreaterThanOrEqual(1);
    expect(buildPotentialGap({ currentStars: current, ceiling })).toBeGreaterThan(0.5);
  });
});
