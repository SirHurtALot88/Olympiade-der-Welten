import { describe, expect, it } from "vitest";

import { buildOrganicSquadPlan, type OrganicSquadPlanInput } from "@/lib/ai/organic-squad/draft-builder";
import {
  ROSTER_MAX,
  ROSTER_MIN,
  type CoreAxis,
  type OrganicDiscipline,
  type OrganicPlayerView,
} from "@/lib/ai/organic-squad/types";
import { deriveUtilityWeights } from "@/lib/ai/organic-squad/weights";

const DISCIPLINES: OrganicDiscipline[] = [
  { id: "tdm", category: "power" },
  { id: "spurt", category: "power" },
  { id: "tennis", category: "mental" },
  { id: "showcase", category: "social" },
  { id: "staffel", category: "speed" },
];

const POW_HEAVY_AXIS: Record<CoreAxis, number> = { pow: 0.55, spe: 0.15, men: 0.15, soc: 0.15 };

function candidate(
  id: string,
  disciplineId: string,
  tier: number,
): OrganicPlayerView {
  // Quality scales with price: pricier players are genuinely better (a value-vs-quality tradeoff).
  const quality = 74 + tier * 3; // 74..89
  return {
    playerId: id,
    pow: quality,
    spe: 60,
    men: 60,
    soc: 60,
    disciplineRatings: { [disciplineId]: quality + 2 },
    marketValue: 20 + tier * 8, // 20,28,36,44,52,60
    salary: 6 + tier,
  };
}

/** A varied pool: several players per discipline, price/quality tiers 0..5. */
function makePool(): OrganicPlayerView[] {
  const pool: OrganicPlayerView[] = [];
  for (const d of DISCIPLINES) {
    for (let tier = 0; tier < 6; tier += 1) {
      pool.push(candidate(`${d.id}-${tier}`, d.id, tier));
    }
  }
  return pool;
}

function baseInput(over: Partial<OrganicSquadPlanInput["economy"]>): OrganicSquadPlanInput {
  return {
    startingSquad: [],
    candidates: makePool(),
    identityAxisWeights: POW_HEAVY_AXIS,
    disciplines: DISCIPLINES,
    economy: {
      cash: 800,
      cashBuffer: 20,
      salaryTotal: 0,
      boardRisk: 0.4,
      expectedPrize: 20,
      sponsorIncome: 30,
      facilityNet: 0,
      netTransfer: 0,
      weights: deriveUtilityWeights(
        { ambition: 55, finances: 55, boardConfidence: 50, harmony: 50, playerOpt: 11 },
        {},
      ),
      ...over,
    },
  };
}

describe("buildOrganicSquadPlan — emergent composition", () => {
  it("respects the hard blockers: roster in [MIN,MAX] and cash never below buffer", () => {
    const result = buildOrganicSquadPlan(baseInput({}));
    expect(result.finalSquad.length).toBeGreaterThanOrEqual(ROSTER_MIN);
    expect(result.finalSquad.length).toBeLessThanOrEqual(ROSTER_MAX);
    expect(result.finalCash).toBeGreaterThanOrEqual(20);
    expect(result.stoppedBelowMin).toBe(false);
  });

  it("an elite-small-roster GM builds a smaller squad than a depth GM (OPT-driven size)", () => {
    const eliteWeights = deriveUtilityWeights(
      { ambition: 70, finances: 55, boardConfidence: 45, harmony: 50, playerOpt: 11 },
      { eliteSmallRosterPreference: 9 },
    );
    const depthWeights = deriveUtilityWeights(
      { ambition: 55, finances: 55, boardConfidence: 50, harmony: 50, playerOpt: 11 },
      { rosterDepthPreference: 9 },
    );
    const elite = buildOrganicSquadPlan(baseInput({ weights: eliteWeights }));
    const depth = buildOrganicSquadPlan(baseInput({ weights: depthWeights }));
    expect(elite.finalSquad.length).toBeLessThan(depth.finalSquad.length);
  });

  it("a thrifty team keeps more cash than an ambitious spender (save vs. spend)", () => {
    const ambitiousWeights = deriveUtilityWeights(
      { ambition: 90, finances: 45, boardConfidence: 30, harmony: 50, playerOpt: 11 },
      { starPriority: 9 },
    );
    const thriftyWeights = deriveUtilityWeights(
      { ambition: 40, finances: 70, boardConfidence: 70, harmony: 50, playerOpt: 11 },
      { valuePriority: 9, cashPriority: 9 },
    );
    const ambitious = buildOrganicSquadPlan(baseInput({ weights: ambitiousWeights }));
    const thrifty = buildOrganicSquadPlan(baseInput({ weights: thriftyWeights }));
    expect(thrifty.finalCash).toBeGreaterThan(ambitious.finalCash);
  });

  it("spreads across disciplines instead of stacking one (coverage curve at work)", () => {
    const result = buildOrganicSquadPlan(baseInput({}));
    const coveredDisciplines = new Set<string>();
    for (const player of result.finalSquad) {
      for (const [disciplineId, rating] of Object.entries(player.disciplineRatings)) {
        if (rating > 60) coveredDisciplines.add(disciplineId);
      }
    }
    // With 5 needed disciplines and diminishing returns, a healthy squad touches several.
    expect(coveredDisciplines.size).toBeGreaterThanOrEqual(3);
  });

  it("flags stoppedBelowMin when nothing is affordable to reach the minimum", () => {
    const brokeInput = baseInput({ cash: 25, cashBuffer: 20 });
    // Only players cheap enough to keep cash>=buffer from cash 25 are those priced <=5 — none exist.
    const result = buildOrganicSquadPlan(brokeInput);
    expect(result.finalSquad.length).toBeLessThan(ROSTER_MIN);
    expect(result.stoppedBelowMin).toBe(true);
  });
});
