import { describe, expect, it } from "vitest";

import type { Player } from "@/lib/data/olyDataTypes";
import { buildPlayerAxisStarProfile } from "@/lib/scouting/player-axis-star-rating";
import { buildPlayerPotentialRecord } from "@/lib/progression/player-potential-service";
import {
  attachPotentialCeilingToRecord,
  buildPlayerPotentialCeilingProfile,
  buildPotentialGap,
  clampPotentialCeilingToCurrentStars,
  revealPotentialStars,
} from "@/lib/scouting/player-potential-ceiling-service";

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
    expect(ceiling.overall).toBeGreaterThanOrEqual(current.overall);
    expect(buildPotentialGap({ currentStars: current, ceiling })).toBeGreaterThanOrEqual(0);
  });

  it("never reveals overall potential below current overall stars", () => {
    const target = player({ id: "overall-floor", rating: 58, potential: 82, coreStats: { pow: 58, spe: 60, men: 57, soc: 56 } });
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
    const staleCeiling = {
      pow: Math.max(current.pow, 4),
      spe: Math.max(current.spe, 3.5),
      men: Math.max(current.men, 3.5),
      soc: Math.max(current.soc, 3.5),
      overall: 3.5,
    };
    const revealed = revealPotentialStars({
      ceiling: staleCeiling,
      currentStars: current,
      scoutingLevel: 3,
    });

    expect(revealed.overallMin).toBeGreaterThanOrEqual(current.overall);
    expect(revealed.overallMax).toBeGreaterThanOrEqual(current.overall);
    expect(revealed.overallMin).toBeLessThanOrEqual(revealed.overallMax ?? revealed.overallMin);
  });

  it("raises stored overall ceiling when CA overall exceeds axis-derived PO overall", () => {
    const current = {
      pow: 3,
      spe: 4.5,
      men: 3,
      soc: 3,
      overall: 4.5,
      disciplineTags: [],
    };
    const staleCeiling = {
      pow: 3,
      spe: 4.5,
      men: 3,
      soc: 3,
      overall: 3.5,
    };
    const clamped = clampPotentialCeilingToCurrentStars(current, staleCeiling);
    expect(clamped.overall).toBe(4.5);
    expect(clamped.overall).toBeGreaterThanOrEqual(current.overall);
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
      player: target,
      saveId: "save-1",
      currentStars: current,
    });
    expect(record.hiddenAttributeCeiling?.power).toBeDefined();
    expect(record.hiddenPotentialCeilingByAxis?.pow).toBeGreaterThanOrEqual(current.pow);
    expect(revealPotentialStars({ ceiling, currentStars: current, scoutingLevel: 1 }).overallMin).toBeNull();
    expect(revealPotentialStars({ ceiling, currentStars: current, scoutingLevel: 3 }).overallMin).not.toBeNull();
  });

  it("spreads potential-ceiling overall stars by potential score instead of saturating at 5", () => {
    // Regression guard for the "every player shows 5★ potential" bug: the ceiling→star
    // mapping must SPREAD by potential score (weak→low, only genuine top→5★), never
    // collapse the whole league onto 5★. A young, roughly balanced prospect (so CA does
    // not dominate) is scored across the potential range and the overall PO stars must
    // rise monotonically and stay below 5★ for weak/mid potential.
    const prospect = player({
      id: "spread-prospect",
      rating: 41,
      coreStats: { pow: 42, spe: 40, men: 41, soc: 39 },
      disciplineRatings: { d_pow: 42, d_spe: 40, d_men: 41, d_soc: 39 },
    });
    const peers = Array.from({ length: 40 }, (_, index) =>
      player({
        id: `spread-peer-${index}`,
        coreStats: {
          pow: 35 + index,
          spe: 33 + (index % 9),
          men: 30 + (index % 11),
          soc: 32 + (index % 7),
        },
      }),
    );
    const gameState = {
      players: [prospect, ...peers],
      disciplines: [
        { id: "d_pow", name: "Pow", category: "power", displayOrder: 1, originalOrder: 1, playerCount: 41 },
        { id: "d_spe", name: "Spe", category: "speed", displayOrder: 2, originalOrder: 2, playerCount: 41 },
        { id: "d_men", name: "Men", category: "mental", displayOrder: 3, originalOrder: 3, playerCount: 41 },
        { id: "d_soc", name: "Soc", category: "social", displayOrder: 4, originalOrder: 4, playerCount: 41 },
      ],
    } as never;
    const current = buildPlayerAxisStarProfile({ gameState, player: prospect });

    const byScore = [45, 55, 65, 75, 90].map(
      (hiddenPotentialScore) =>
        buildPlayerPotentialCeilingProfile({
          saveId: "spread-save",
          player: prospect,
          currentStars: current,
          hiddenPotentialScore,
        }).overall,
    );

    // Monotonic non-decreasing in potential score.
    for (let index = 1; index < byScore.length; index += 1) {
      expect(byScore[index]).toBeGreaterThanOrEqual(byScore[index - 1]!);
    }
    // Weak/mid potential must NOT read as a maxed 5★ ceiling (anti-saturation).
    expect(byScore[0]).toBeLessThan(5);
    expect(byScore[1]).toBeLessThan(5);
    // Genuine top potential still climbs to the ceiling.
    expect(byScore[byScore.length - 1]).toBeGreaterThanOrEqual(4.5);
    // Real spread across the range — the whole league is not pinned to one value.
    expect(byScore[byScore.length - 1]! - byScore[0]!).toBeGreaterThanOrEqual(1.5);
    // Potential can never drop below current ability.
    for (const overall of byScore) {
      expect(overall).toBeGreaterThanOrEqual(current.overall);
    }
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
