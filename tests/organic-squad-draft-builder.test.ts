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
    // The GM roster-size nudge is intentionally gentle now (K=1 on top of the sheet playerOpt, see
    // deriveUtilityWeights — a larger K used to re-inflate the sheet opt). A one-sided preference (with
    // the opposite pole left neutral) no longer shifts optTarget enough to change size: both round to
    // the same target. To exercise the OPT-driven size divergence the test is about, set BOTH poles —
    // the elite GM strongly prefers a small roster AND weakly wants depth, the depth GM the reverse.
    const eliteWeights = deriveUtilityWeights(
      { ambition: 70, finances: 55, boardConfidence: 45, harmony: 50, playerOpt: 11 },
      { eliteSmallRosterPreference: 10, rosterDepthPreference: 1 },
    );
    const depthWeights = deriveUtilityWeights(
      { ambition: 55, finances: 55, boardConfidence: 50, harmony: 50, playerOpt: 11 },
      { rosterDepthPreference: 10, eliteSmallRosterPreference: 1 },
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

  it("pure buy: a cash-poor club below min never sheds its pricey surplus body, it only buys what it can afford", () => {
    // Two-phase model (see .cursor/rules/balancing-no-sell-floor-full-rebuild.mdc): the preseason BUY
    // cycle NEVER sells — trade-down was removed. A cash-poor club (e.g. after paying renewal salaries)
    // holding a pricey surplus body (a 4th body in an already-covered discipline) must keep that body no
    // matter how expendable it looks; selling only ever happens at season end (runOrganicSellCycle).
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
        marketValue: i === 3 ? 60 : 8, // the 4th body is the pricey, expendable-looking one
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
    const originalIds = surplusRoster.map((player) => player.playerId);

    // Case A: cash (6) is below even the cheapest free agent (marketValue 20) — pure buy can afford
    // nothing at all. The correct behaviour is to simply stop under-filled, NOT to shed a body to unblock
    // a buy: the plan must be a strict no-op on the roster.
    const brokeInput = baseInput({ cash: 6, cashBuffer: 5, salaryTotal: 32 });
    brokeInput.startingSquad = surplusRoster;
    const broke = buildOrganicSquadPlan(brokeInput);

    expect(broke.decisions).toHaveLength(0);
    expect(broke.finalSquad.map((player) => player.playerId).sort()).toEqual([...originalIds].sort());
    // Nothing was ever removed — the pricey surplus body is still there.
    expect(broke.finalSquad.some((player) => player.playerId === "tdm-held-3")).toBe(true);
    expect(broke.stoppedBelowMin).toBe(true);
    expect("sellDecisions" in broke).toBe(false);

    // Case B: cash (25) covers exactly one cheap fill. Pure buy spends toward min, keeps every original
    // roster player (including the pricey surplus body — it is never shed to fund the buy), and reaches
    // the hard minimum via growth only.
    const affordableInput = baseInput({ cash: 25, cashBuffer: 5, salaryTotal: 32 });
    affordableInput.startingSquad = surplusRoster.map((player) => ({ ...player }));
    const affordable = buildOrganicSquadPlan(affordableInput);

    expect(affordable.decisions.length).toBeGreaterThanOrEqual(1);
    // Every original starting-squad id survives untouched — pure buy only grows the squad.
    for (const id of originalIds) {
      expect(affordable.finalSquad.some((player) => player.playerId === id)).toBe(true);
    }
    expect(affordable.finalSquad.some((player) => player.playerId === "tdm-held-3")).toBe(true);
    expect(affordable.finalSquad.length).toBeGreaterThanOrEqual(ROSTER_MIN);
    expect(affordable.stoppedBelowMin).toBe(false);
    expect(affordable.finalCash).toBeGreaterThanOrEqual(0);
    expect("sellDecisions" in affordable).toBe(false);
  });

  it("empty-start draft only ever buys — finalSquad is exactly the bought decisions, never a sell", () => {
    // Regression guard for the removed trade-down: on an empty starting squad the builder must never
    // produce anything but buys. Give it a tight budget so it gets stuck below opt mid-draft; the correct
    // behaviour is to simply stop, not to shed a planned buy (there is no sellDecisions concept anymore).
    const tight = baseInput({ cash: 120, cashBuffer: 20 });
    const result = buildOrganicSquadPlan(tight);

    // The result type no longer carries sellDecisions at all.
    expect("sellDecisions" in result).toBe(false);
    // Every decision is a buy, and the final squad is exactly (and only) what was bought — nothing to
    // sell because there was nothing on the roster to begin with.
    expect(result.decisions.length).toBeGreaterThan(0);
    expect(result.finalSquad.map((player) => player.playerId).sort()).toEqual(
      result.decisions.map((decision) => decision.playerId).sort(),
    );
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
