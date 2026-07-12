import { describe, expect, it, vi } from "vitest";

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

  it("trades down: a cash-poor club below min sheds an expendable expensive body to refill toward opt", () => {
    // Reproduce the S-C stall: 7 players, cash too low to buy the cheapest free agent, but the roster
    // holds a pricey surplus (a 4th body in an already-covered discipline → low marginalStrength, high
    // price). The club must SELL that body (even at a loss) to fund the cheap fills and reach min/opt.
    const surplusRoster: OrganicPlayerView[] = [];
    // Three tdm bodies already cover that discipline well; the 4th (expensive) is pure surplus.
    for (let i = 0; i < 4; i += 1) {
      surplusRoster.push({
        playerId: `tdm-held-${i}`,
        pow: 78,
        spe: 60,
        men: 60,
        soc: 60,
        disciplineRatings: { tdm: 80 },
        marketValue: i === 3 ? 60 : 8, // the 4th body is the pricey, expendable one
        salary: i === 3 ? 12 : 4,
      });
    }
    // Three more cheap bodies spread over other disciplines → roster of 7, still below min (8) and opt.
    for (const d of ["spurt", "tennis", "showcase"]) {
      surplusRoster.push({
        playerId: `${d}-held`,
        pow: 70,
        spe: 60,
        men: 60,
        soc: 60,
        disciplineRatings: { [d]: 74 },
        marketValue: 8,
        salary: 4,
      });
    }

    const input = baseInput({ cash: 6, cashBuffer: 5, salaryTotal: 32 });
    input.startingSquad = surplusRoster;
    // Cheapest free agent (marketValue 20) is unaffordable from cash 6 — only a trade-down unblocks it.

    const result = buildOrganicSquadPlan(input);

    expect(result.sellDecisions.length).toBeGreaterThanOrEqual(1);
    // The pricey 4th tdm body is the one shed (highest price − marginalStrength).
    expect(result.sellDecisions.some((sell) => sell.playerId === "tdm-held-3")).toBe(true);
    // Having freed the cash, the club fills back up to at least the hard minimum.
    expect(result.finalSquad.length).toBeGreaterThanOrEqual(ROSTER_MIN);
    expect(result.stoppedBelowMin).toBe(false);
    expect(result.finalCash).toBeGreaterThanOrEqual(0);
    // The sold body is gone from the final squad.
    expect(result.finalSquad.some((player) => player.playerId === "tdm-held-3")).toBe(false);
  });

  it("never trades down a freshly-bought player on an empty-start draft (no phantom sells)", () => {
    // Regression: on an empty starting squad the builder must NOT 'sell' a player it just planned to
    // buy — those aren't on the live roster, so the executor can't realize the proceeds and the later
    // buys they were meant to fund fail with insufficient_cash. Give it a tight budget so it gets stuck
    // below opt mid-draft; the correct behaviour is to simply stop, not to shed a planned buy.
    const tight = baseInput({ cash: 120, cashBuffer: 20 });
    const result = buildOrganicSquadPlan(tight);
    // No trade-downs at all from an empty start.
    expect(result.sellDecisions).toHaveLength(0);
    // And no player is ever both bought and sold in the same plan.
    const soldIds = new Set(result.sellDecisions.map((sell) => sell.playerId));
    expect(result.decisions.every((buy) => !soldIds.has(buy.playerId))).toBe(true);
  });

  it("SEED-based draft jitter: reproducible per seed, varies composition across seeds on near-tied candidates", async () => {
    // Build a pool of EXACT ties per discipline (identical stats/price) so buyUtility is dead-even
    // within a group — the only thing that can pick a WINNER among ties is the seed-keyed jitter.
    function tiedCandidate(id: string, disciplineId: string): OrganicPlayerView {
      return {
        playerId: id,
        pow: 78,
        spe: 60,
        men: 60,
        soc: 60,
        disciplineRatings: { [disciplineId]: 80 },
        marketValue: 30,
        salary: 8,
      };
    }
    function makeTiedPool(): OrganicPlayerView[] {
      const pool: OrganicPlayerView[] = [];
      for (const d of DISCIPLINES) {
        for (let i = 0; i < 6; i += 1) {
          pool.push(tiedCandidate(`${d.id}-tied-${i}`, d.id));
        }
      }
      return pool;
    }

    const previousEnv = process.env.OLY_ORGANIC_DRAFT_JITTER;
    process.env.OLY_ORGANIC_DRAFT_JITTER = "20";
    vi.resetModules();
    try {
      // ORGANIC_DRAFT_JITTER is read ONCE at module load, so a fresh dynamic import is required to
      // pick up the env var set above (module-level const, not read per-call).
      const { buildOrganicSquadPlan: buildWithJitter } = await import("@/lib/ai/organic-squad/draft-builder");

      const seedAInput: OrganicSquadPlanInput = { ...baseInput({}), candidates: makeTiedPool(), draftSeed: "save-A:team-1" };
      const seedAInput2: OrganicSquadPlanInput = { ...baseInput({}), candidates: makeTiedPool(), draftSeed: "save-A:team-1" };
      const seedBInput: OrganicSquadPlanInput = { ...baseInput({}), candidates: makeTiedPool(), draftSeed: "save-B:team-2" };

      const resultA1 = buildWithJitter(seedAInput);
      const resultA2 = buildWithJitter(seedAInput2);
      const resultB = buildWithJitter(seedBInput);

      // Reproducibility: identical seed ⇒ identical finalSquad (same players, same order).
      expect(resultA1.finalSquad.map((p) => p.playerId)).toEqual(resultA2.finalSquad.map((p) => p.playerId));

      // Seed variance: different seeds ⇒ at least one different player in the final squad.
      const idsA = new Set(resultA1.finalSquad.map((p) => p.playerId));
      const idsB = new Set(resultB.finalSquad.map((p) => p.playerId));
      const differs = [...idsA].some((id) => !idsB.has(id)) || [...idsB].some((id) => !idsA.has(id));
      expect(differs).toBe(true);
    } finally {
      if (previousEnv === undefined) delete process.env.OLY_ORGANIC_DRAFT_JITTER;
      else process.env.OLY_ORGANIC_DRAFT_JITTER = previousEnv;
      vi.resetModules();
    }
  });
});
