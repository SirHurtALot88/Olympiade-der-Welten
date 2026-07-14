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
import { draftUnit } from "@/lib/ai/market-pick-engine/slot-sequence";

/**
 * Small additive jitter (in buyUtility units) applied ONLY inside the greedy buy comparison, keyed by
 * `${draftSeed}:${playerId}` (hash-based, reproducible — no Math.random). It exists SOLELY to break
 * near-ties between similarly-attractive candidates so different save/team seeds can land on different
 * (but comparably good) picks — composition variance across saves, not randomness overriding the
 * model. It must never be large enough to flip a clear preference: a genuinely better candidate always
 * wins regardless of jitter amplitude choice by the caller. Default 15 (calibrated): a draft-run sweep
 * showed ~80% roster-slot variance across seeds at amplitude 20 while every team's IDENTITY held (same
 * roster sizes, MW tiers, GM character) and the draft audit stayed PASS — 15 keeps that strong
 * different-players-same-team-character variety with a touch more headroom for genuinely-better picks.
 * The jitter only ever engages when a `draftSeed` is passed (real runs, keyed `saveId:teamId`); pure
 * unit tests pass no seed, so they stay deterministic regardless of this amplitude. ENV-tunable (set 0
 * to disable, higher for more spread).
 */
const ORGANIC_DRAFT_JITTER = Number(process.env.OLY_ORGANIC_DRAFT_JITTER ?? 15) || 0;

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
    /**
     * Small flat solvency floor kept while filling the squad from min UP TO opt. Below this the reserve
     * (cashBuffer) is treated as SPENDABLE toward the opt target rather than a hard hold — the club
     * spends its salary-scaled reserve to build the squad it wants and refills it from income over later
     * seasons (user model: "die Reserve muss auch mal ausgegeben werden, kann später aufgefüllt werden").
     * Only ABOVE opt does the full cashBuffer hold again. Defaults to cashBuffer (i.e. the old behaviour:
     * reserve held from min onward) when not provided, so callers that don't opt in are unchanged.
     */
    solvencyFloor?: number;
  };
  /**
   * Optional per-(save, team) seed for the reproducible buy-utility jitter (see ORGANIC_DRAFT_JITTER).
   * Null/undefined ⇒ no jitter regardless of the env amplitude — the builder stays fully deterministic.
   */
  draftSeed?: string | null;
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
  const optTarget = input.economy.weights.optTarget;
  // Floor kept while building from min→opt (see solvencyFloor doc). Defaults to cashBuffer = old behaviour.
  const optFillFloor = Math.min(cashBuffer, input.economy.solvencyFloor ?? cashBuffer);

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
    // Three-tier solvency floor. (1) Below the hard ROSTER_MIN: floor 0 — fielding a legal (≥ min) squad
    // outranks any buffer, so a cash-poor club spends down toward ~0 to reach min (else it stalls below
    // min and breaks autoprep "teams_under_7"). (2) From min UP TO opt: floor = optFillFloor (a small flat
    // solvency floor). Here the salary-scaled reserve is SPENDABLE — a club spends it to build its target
    // squad and refills it from income over later seasons, instead of hoarding it and stalling under opt
    // (user model: "die Reserve muss auch mal ausgegeben werden, kann später aufgefüllt werden"). (3) At or
    // above opt: floor = cashBuffer — the full reserve holds again, so cash beyond the target squad is kept
    // rather than blown on luxury depth. Affordability keeps cash ≥ floor AFTER the buy AND the min-fill.
    const belowMin = squad.length < rosterMin;
    const belowOpt = squad.length < optTarget;
    const affordFloor = belowMin ? 0 : belowOpt ? optFillFloor : cashBuffer;
    // Affordability keeps cash ≥ affordFloor AFTER the buy AND after the reserved min-fill.
    let best: OrganicPlayerView | null = null;
    let bestUtility = -Infinity;
    for (const candidate of pool) {
      if (cash - price(candidate) - reserveForMin < affordFloor) continue;
      const jitter =
        input.draftSeed && ORGANIC_DRAFT_JITTER > 0
          ? ORGANIC_DRAFT_JITTER * (draftUnit(`${input.draftSeed}:${candidate.playerId}`) - 0.5)
          : 0;
      const utility = buyUtility(candidate, state) + jitter;
      if (utility > bestUtility) {
        bestUtility = utility;
        best = candidate;
      }
    }

    // Broke-and-below-min fallback: if the min-reserve made the FULL min-fill unaffordable, a club that
    // can't reach min in one go must still make PARTIAL progress (6→7 beats staying at 6 and breaking
    // autoprep). Drop the reserve and buy the single best candidate it can actually pay for (cash ≥ 0).
    if (!best && belowMin) {
      for (const candidate of pool) {
        if (cash - price(candidate) < 0) continue;
        const jitter =
          input.draftSeed && ORGANIC_DRAFT_JITTER > 0
            ? ORGANIC_DRAFT_JITTER * (draftUnit(`${input.draftSeed}:${candidate.playerId}`) - 0.5)
            : 0;
        const utility = buyUtility(candidate, state) + jitter;
        if (utility > bestUtility) {
          bestUtility = utility;
          best = candidate;
        }
      }
    }

    if (!best) {
      // Nothing affordable — the club is out of cash for even the cheapest remaining candidate. Stop the
      // build here. The preseason buy phase NEVER sells (clean two-phase model: all selling happens at
      // season end — see runOrganicSellCycle / .cursor/rules/balancing-no-sell-floor-full-rebuild.mdc), so
      // a club that can't reach min with its available cash simply stops under-filled; that is logged
      // (stoppedBelowMin), not resolved by shedding a body here.
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
