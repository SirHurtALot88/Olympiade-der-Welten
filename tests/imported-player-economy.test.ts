import { describe, expect, it } from "vitest";

import type { Player } from "@/lib/data/olyDataTypes";
import {
  calculateImportedPlayerEconomy,
  materializeCalculatedEconomyForPlayers,
} from "@/lib/player-formulas/imported-player-economy";

function createPlayer(partial?: Partial<Player>): Player {
  return {
    id: partial?.id ?? "player-1",
    name: partial?.name ?? "Player One",
    rating: partial?.rating ?? 65,
    marketValue: partial?.marketValue ?? 85000,
    salaryDemand: partial?.salaryDemand ?? 8000,
    displayMarketValue: partial?.displayMarketValue ?? 72.57,
    displaySalary: partial?.displaySalary ?? 16.54,
    className: partial?.className ?? "Berserker",
    race: partial?.race ?? "Human",
    alignment: partial?.alignment ?? "N",
    gender: partial?.gender ?? "m",
    subclasses: partial?.subclasses ?? [],
    traitsPositive: partial?.traitsPositive ?? [],
    traitsNegative: partial?.traitsNegative ?? [],
    coreStats: partial?.coreStats ?? { pow: 70, spe: 55, men: 65, soc: 60 },
    attributeSheetStats: partial?.attributeSheetStats ?? {
      height: null,
      power: 70,
      health: 72,
      stamina: 68,
      intelligence: 66,
      awareness: 58,
      determination: 60,
      speed: 55,
      dexterity: 52,
      charisma: 62,
      will: 64,
      spirit: 58,
      torment: 50,
    },
    preferredDisciplineIds: partial?.preferredDisciplineIds ?? ["hockey"],
    disciplineRatings: partial?.disciplineRatings ?? { hockey: 78, football: 72, tennis: 66 },
    disciplineTierCounts: partial?.disciplineTierCounts ?? { above20: 3, above40: 3, above60: 3, above80: 0 },
    flavorEn: partial?.flavorEn ?? "",
    flavorDe: partial?.flavorDe ?? "",
    fatigue: partial?.fatigue ?? 0,
    form: partial?.form ?? 0,
    potential: partial?.potential ?? 70,
  };
}

describe("imported-player-economy", () => {
  it("calculates MW and salary from rank table instead of stale sheet values", () => {
    const players = [
      createPlayer({ id: "player-a", disciplineRatings: { hockey: 90, football: 88, tennis: 84 } }),
      createPlayer({ id: "player-b", disciplineRatings: { hockey: 40, football: 42, tennis: 38 } }),
    ];

    const economy = calculateImportedPlayerEconomy(players[0]!, players);
    expect(economy).not.toBeNull();
    expect(economy!.marketValue).not.toBe(85000);
    expect(economy!.marketValue).not.toBe(72.57);
    expect(economy!.marketValue).toBeGreaterThan(economy!.displayMarketValue * 0.5);
    expect(economy!.salaryDemand).toBe(economy!.displaySalary);
  });

  it("overwrites stale JSON economy fields for the full catalog batch", () => {
    const players = [
      createPlayer({ id: "player-a", marketValue: 85000, displayMarketValue: 72.57 }),
      createPlayer({ id: "player-b", marketValue: 12000, displayMarketValue: 12.5, disciplineRatings: { hockey: 35, football: 33, tennis: 31 } }),
    ];

    const [first] = materializeCalculatedEconomyForPlayers(players);
    expect(first?.marketValue).toBeLessThan(1000);
    expect(first?.marketValue).toBe(first?.displayMarketValue);
    expect(first?.salaryDemand).toBe(first?.displaySalary);
  });
});
