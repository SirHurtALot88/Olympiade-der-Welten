/**
 * Organic marginal-utility squad builder — the greedy loop (Master-Plan P2 core).
 *
 * See docs/design/draft-composition-organic-masterplan.md §3. PURE function: given a team's economic
 * state + weights + a pool of available free agents, it greedily picks the highest-utility action
 * (buy best affordable / stop) each step, RE-COMPUTING discipline coverage after every buy so the
 * coverage curve damps further buys in an already-covered discipline. Composition emerges here — no
 * slot quotas. The only hard blockers: roster ∈ [ROSTER_MIN, ROSTER_MAX] and cash ≥ cashBuffer.
 *
 * Nothing here reads gameState or mutates anything — the adapter/wiring (separate, flag-gated) builds
 * the inputs and applies the returned decisions.
 */

import { projectCashFlow } from "@/lib/ai/organic-squad/cash-flow-forecast";
import { computeDisciplineNeeds, deriveNeedAxisWeights } from "@/lib/ai/organic-squad/discipline-need";
import {
  ROSTER_MAX,
  ROSTER_MIN,
  type CoreAxis,
  type OrganicDiscipline,
  type OrganicPlayerView,
  type OrganicUtilityWeights,
} from "@/lib/ai/organic-squad/types";
import { buyUtility, stopUtility } from "@/lib/ai/organic-squad/utility";

export type OrganicBuyDecision = {
  playerId: string;
  /** 0-based order in which this buy was chosen. */
  step: number;
  /** The buy utility at the moment it was chosen (for the decision log / diagnostics). */
  utility: number;
};

export type OrganicSquadPlanInput = {
  /** Players already on the roster at the start (their disciplines count toward coverage). */
  startingSquad: OrganicPlayerView[];
  /** Available free agents to choose from. */
  candidates: OrganicPlayerView[];
  /** Team playstyle axis emphasis (from identity.pow/spe/men/soc), any scale — normalized internally. */
  identityAxisWeights: Record<CoreAxis, number>;
  /** Discipline catalog (id + category) for coverage/need recomputation. */
  disciplines: OrganicDiscipline[];
  economy: {
    cash: number;
    cashBuffer: number;
    salaryTotal: number;
    /** 0..1 board pressure (cash is more precious when high). */
    boardRisk: number;
    /** Forecast planning inputs held constant across the plan (per-season, not per-pick). */
    expectedPrize: number;
    sponsorIncome: number;
    facilityNet: number;
    netTransfer: number;
    weights: OrganicUtilityWeights;
    /** Hard upper roster bound, defaults to ROSTER_MAX (14); pass a team-specific max if smaller. */
    rosterMax?: number;
    /** Hard lower roster bound, defaults to ROSTER_MIN (8). */
    rosterMin?: number;
  };
};

export type OrganicSquadPlanResult = {
  decisions: OrganicBuyDecision[];
  finalSquad: OrganicPlayerView[];
  finalCash: number;
  finalSalaryTotal: number;
  /** Set when the loop broke below rosterMin because nothing was affordable (edge to log, not repair). */
  stoppedBelowMin: boolean;
};

function price(player: OrganicPlayerView): number {
  return Math.max(0, player.marketValue);
}

/**
 * Minimum spend still needed to reach the roster MINIMUM: the sum of the `count` cheapest available
 * prices. Reserving this keeps the hard min-roster rule FEASIBLE, so the builder can't blow its whole
 * budget on a few stars and end below min. This reserves feasibility of a hard rule, NOT composition.
 */
function cheapestPriceSum(pool: OrganicPlayerView[], count: number): number {
  if (count <= 0) return 0;
  const prices = pool.map(price).sort((left, right) => left - right);
  let sum = 0;
  for (let i = 0; i < count && i < prices.length; i += 1) sum += prices[i];
  return sum;
}

/** Greedy organic squad plan. Deterministic; ties broken by pool order (stable). */
export function buildOrganicSquadPlan(input: OrganicSquadPlanInput): OrganicSquadPlanResult {
  const rosterMax = input.economy.rosterMax ?? ROSTER_MAX;
  const rosterMin = input.economy.rosterMin ?? ROSTER_MIN;
  const cashBuffer = input.economy.cashBuffer;

  const squad = [...input.startingSquad];
  const pool = [...input.candidates];
  const decisions: OrganicBuyDecision[] = [];
  let cash = input.economy.cash;
  let salaryTotal = input.economy.salaryTotal;

  const buildState = () => {
    const disciplineNeeds = computeDisciplineNeeds(squad, input.identityAxisWeights, input.disciplines);
    const needAxisWeights = deriveNeedAxisWeights(disciplineNeeds);
    const forecast = projectCashFlow({
      cash,
      salaryTotal,
      expectedPrize: input.economy.expectedPrize,
      sponsorIncome: input.economy.sponsorIncome,
      facilityNet: input.economy.facilityNet,
      netTransfer: input.economy.netTransfer,
      cashBuffer,
    });
    return {
      cash,
      cashBuffer,
      salaryTotal,
      rosterSize: squad.length,
      boardRisk: input.economy.boardRisk,
      forecast,
      weights: input.economy.weights,
      disciplineNeeds,
      needAxisWeights,
    };
  };

  let stoppedBelowMin = false;

  while (squad.length < rosterMax) {
    const state = buildState();
    // Budget pacing for the hard MIN rule: after this buy, keep enough to cheap-fill the remaining
    // mandatory slots. Reserving the cheapest such prices means a rich club can chase a star AND still
    // reach min, while nobody blows the whole budget on a few stars and ends below min. Once at/above
    // min this reserve is 0, so composition past min is fully emergent.
    const remainingToMinAfterBuy = Math.max(0, rosterMin - (squad.length + 1));
    const reserveForMin = cheapestPriceSum(pool, remainingToMinAfterBuy);
    // Affordability keeps cash ≥ buffer AFTER the buy AND after the reserved min-fill (hard blockers).
    let best: OrganicPlayerView | null = null;
    let bestUtility = -Infinity;
    for (const candidate of pool) {
      if (cash - price(candidate) - reserveForMin < cashBuffer) continue;
      const utility = buyUtility(candidate, state);
      if (utility > bestUtility) {
        bestUtility = utility;
        best = candidate;
      }
    }

    if (!best) {
      // Nothing affordable while keeping the buffer.
      if (squad.length < rosterMin) stoppedBelowMin = true;
      break;
    }

    // STOP may only win once the roster minimum is met (min is hard; below it we always fill).
    if (squad.length >= rosterMin && stopUtility(state) >= bestUtility) {
      break;
    }

    squad.push(best);
    cash -= price(best);
    salaryTotal += Math.max(0, best.salary);
    pool.splice(pool.indexOf(best), 1);
    decisions.push({ playerId: best.playerId, step: decisions.length, utility: bestUtility });
  }

  return {
    decisions,
    finalSquad: squad,
    finalCash: cash,
    finalSalaryTotal: salaryTotal,
    stoppedBelowMin,
  };
}
