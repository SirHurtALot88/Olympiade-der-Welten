import { describe, expect, it } from "vitest";

import type { Discipline, GameState, Player } from "@/lib/data/olyDataTypes";
import {
  buildPlayerAxisStarProfile,
  percentileToCurrentAbilityStars,
  revealAxisStarProfile,
} from "@/lib/scouting/player-axis-star-rating";

function player(partial: Partial<Player> & { id: string }): Player {
  return {
    id: partial.id,
    name: partial.name ?? partial.id,
    rating: partial.rating ?? 65,
    marketValue: partial.marketValue ?? 20,
    salaryDemand: partial.salaryDemand ?? 4,
    className: partial.className ?? "Hero",
    race: partial.race ?? "Human",
    alignment: partial.alignment ?? "N",
    gender: partial.gender ?? "x",
    subclasses: partial.subclasses ?? [],
    traitsPositive: partial.traitsPositive ?? [],
    traitsNegative: partial.traitsNegative ?? [],
    coreStats: partial.coreStats ?? { pow: 60, spe: 60, men: 60, soc: 60 },
    attributeSheetStats: partial.attributeSheetStats ?? null,
    preferredDisciplineIds: partial.preferredDisciplineIds ?? [],
    disciplineRatings: partial.disciplineRatings ?? {},
    disciplineTierCounts: partial.disciplineTierCounts ?? { above20: 0, above40: 0, above60: 0, above80: 0 },
    flavorEn: "",
    flavorDe: "",
    fatigue: partial.fatigue ?? 0,
    form: partial.form ?? 0,
    potential: partial.potential ?? 70,
    trainingMode: partial.trainingMode ?? "mittel",
    trainingClass: partial.trainingClass ?? null,
  };
}

function discipline(id: string, category: Discipline["category"]): Discipline {
  return {
    id,
    name: id,
    category,
    displayOrder: 1,
    originalOrder: 1,
    playerCount: 10,
  };
}

function gameState(players: Player[]): GameState {
  return {
    gamePhase: "season_active",
    season: { id: "s1", name: "S1", currentMatchday: 1, totalMatchdays: 10, isCompleted: false },
    seasonState: { seasonId: "s1", schedule: [], standings: {}, matchdayResults: [], playerDisciplinePerformances: [], disciplineHighlights: [] },
    teams: [],
    players,
    rosters: [],
    disciplines: [
      discipline("d_pow", "power"),
      discipline("d_spe", "speed"),
      discipline("d_men", "mental"),
      discipline("d_soc", "social"),
    ],
    teamIdentities: [],
  } as GameState;
}

describe("player axis star rating", () => {
  it("maps league percentiles to spread half-star values", () => {
    expect(percentileToCurrentAbilityStars(95)).toBeGreaterThanOrEqual(4.5);
    expect(percentileToCurrentAbilityStars(50)).toBeGreaterThanOrEqual(2.5);
    expect(percentileToCurrentAbilityStars(50)).toBeLessThanOrEqual(3.5);
    expect(percentileToCurrentAbilityStars(5)).toBeLessThanOrEqual(2);
  });

  it("allows pow specialist with lower overall", () => {
    const players = [
      player({ id: "p1", coreStats: { pow: 90, spe: 45, men: 45, soc: 45 }, disciplineRatings: { d_pow: 95, d_spe: 40, d_men: 40, d_soc: 40 } }),
      player({ id: "p2", coreStats: { pow: 50, spe: 50, men: 50, soc: 50 }, disciplineRatings: { d_pow: 50, d_spe: 50, d_men: 50, d_soc: 50 } }),
      player({ id: "p3", coreStats: { pow: 30, spe: 30, men: 30, soc: 30 }, disciplineRatings: { d_pow: 30, d_spe: 30, d_men: 30, d_soc: 30 } }),
    ];
    const state = gameState(players);
    const profile = buildPlayerAxisStarProfile({ gameState: state, player: players[0]! });
    expect(profile.pow).toBeGreaterThan(profile.overall);
    expect(profile.overall).toBeLessThan(profile.pow);
  });

  it("reveals axis stars gradually by scouting level", () => {
    const players = [player({ id: "p1", coreStats: { pow: 80, spe: 70, men: 60, soc: 55 } })];
    const state = gameState(players);
    const profile = buildPlayerAxisStarProfile({ gameState: state, player: players[0]! });
    expect(revealAxisStarProfile({ profile, scoutingLevel: 0 }).displayLabel).toContain("Scouting");
    expect(revealAxisStarProfile({ profile, scoutingLevel: 1 }).overallBand).not.toBeNull();
    expect(revealAxisStarProfile({ profile, scoutingLevel: 3 }).pow).not.toBeNull();
    expect(revealAxisStarProfile({ profile, scoutingLevel: 5 }).pow).toBe(profile.pow);
  });
});
