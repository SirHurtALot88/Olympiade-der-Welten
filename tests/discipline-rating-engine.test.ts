import { describe, expect, it } from "vitest";

import type { Player, PlayerGeneratorAttributes } from "@/lib/data/olyDataTypes";
import {
  buildCompetitionRanks,
  calculateRawDisciplineScore,
  mapRankToDisciplineStat,
} from "@/lib/player-formulas/discipline-rating-engine";

function makeAttributes(overrides: Partial<PlayerGeneratorAttributes> = {}): PlayerGeneratorAttributes {
  return {
    power: 50,
    health: 50,
    stamina: 50,
    intelligence: 50,
    awareness: 50,
    determination: 50,
    speed: 50,
    dexterity: 50,
    charisma: 50,
    will: 50,
    spirit: 50,
    torment: 50,
    ...overrides,
  };
}

function makePlayer(id: string, attributes: PlayerGeneratorAttributes): Player {
  return {
    id,
    name: id,
    rating: 50,
    className: "Fighter",
    race: "Human",
    alignment: "N",
    gender: "m",
    subclasses: [],
    traitsPositive: [],
    traitsNegative: [],
    coreStats: { pow: 50, spe: 50, men: 50, soc: 50 },
    attributeSheetStats: attributes,
    preferredDisciplineIds: [],
    disciplineRatings: {},
    disciplineTierCounts: { above20: 0, above40: 0, above60: 0, above80: 0 },
    flavorEn: "",
    flavorDe: "",
    fatigue: 0,
    form: 0,
    potential: 55,
    cost: 0,
    upkeepBase: 0,
    portraitPath: null,
    referenceClass: null,
    imageSource: null,
    bracketLabel: null,
    marketValue: 10,
    salaryDemand: 1,
    displayMarketValue: 10,
    displaySalary: 1,
  };
}

describe("discipline-rating-engine", () => {
  it("maps rank 1 and rank 510 to table values", () => {
    expect(mapRankToDisciplineStat(1)).toBe(100);
    expect(mapRankToDisciplineStat(510)).toBeCloseTo(58.7, 1);
  });

  it("uses weighted attribute sum without dividing by weight count", () => {
    const attrs = makeAttributes({ speed: 80, dexterity: 70, awareness: 60 });
    const score = calculateRawDisciplineScore(attrs, "tennis");
    expect(score).toBeGreaterThan(50 * 3);
    expect(score).not.toBeCloseTo((80 + 70 + 60) / 3, 0);
  });

  it("ranks players league-wide instead of averaging to /100", async () => {
    const { buildLeagueDisciplineRatingsWithAttributeOverrides } = await import(
      "@/lib/player-formulas/discipline-rating-engine"
    );
    const strong = makePlayer("strong", makeAttributes({ speed: 90, dexterity: 88, awareness: 86 }));
    const mid = makePlayer("mid", makeAttributes({ speed: 70, dexterity: 68, awareness: 66 }));
    const weak = makePlayer("weak", makeAttributes({ speed: 40, dexterity: 38, awareness: 36 }));
    const ratings = buildLeagueDisciplineRatingsWithAttributeOverrides([strong, mid, weak], {});

    expect(ratings.get("strong")?.tennis).toBe(100);
    expect(ratings.get("mid")?.tennis).toBeLessThan(ratings.get("strong")?.tennis ?? 999);
    expect(ratings.get("weak")?.tennis).toBeLessThan(ratings.get("mid")?.tennis ?? 999);
    expect(ratings.get("mid")?.tennis).toBeGreaterThan(50);
  });

  it("assigns competition ranks with tie handling", () => {
    const ranks = buildCompetitionRanks([
      { playerId: "a", score: 100 },
      { playerId: "b", score: 100 },
      { playerId: "c", score: 90 },
    ]);
    expect(ranks.get("a")).toBe(1);
    expect(ranks.get("b")).toBe(1);
    expect(ranks.get("c")).toBe(3);
  });

  it("exposes raw discipline scores separately from mapped display stats", async () => {
    const { buildRawDisciplineScoresByPlayerId } = await import("@/lib/player-formulas/discipline-rating-engine");
    const strong = makePlayer("strong", makeAttributes({ speed: 90, dexterity: 88, awareness: 86 }));
    const weak = makePlayer("weak", makeAttributes({ speed: 40, dexterity: 38, awareness: 36 }));
    const rawScores = buildRawDisciplineScoresByPlayerId([strong, weak]);
    expect(rawScores.get("strong")?.tennis).toBeGreaterThan(rawScores.get("weak")?.tennis ?? 0);
    expect(rawScores.get("strong")?.tennis).toBeGreaterThan(100);
  });

  it("rebuilds coreStats from corrected discipline ratings", async () => {
    const { rebuildLeagueDisciplineRatings } = await import("@/lib/player-formulas/discipline-rating-engine");
    const strong = makePlayer("strong", makeAttributes({ speed: 90, dexterity: 88, awareness: 86 }));
    strong.coreStats = { pow: 10, spe: 10, men: 10, soc: 10 };
    const [rebuilt] = rebuildLeagueDisciplineRatings([strong, makePlayer("weak", makeAttributes({ speed: 40, dexterity: 38, awareness: 36 }))]);
    expect(rebuilt.coreStats.spe).toBeGreaterThan(50);
    expect(rebuilt.coreStats.pow).toBeGreaterThan(10);
  });
});
