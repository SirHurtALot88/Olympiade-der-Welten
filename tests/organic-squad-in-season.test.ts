import { describe, expect, it } from "vitest";

import { planOrganicSellsForTeam } from "@/lib/ai/organic-squad/draft-adapter";
import { computeDisciplineNeeds, deriveNeedAxisWeights } from "@/lib/ai/organic-squad/discipline-need";
import { ROSTER_MIN } from "@/lib/ai/organic-squad/types";
import type {
  CoreAxis,
  OrganicDiscipline,
  OrganicIdentityInput,
  OrganicPlayerView,
  OrganicTeamState,
  OrganicUtilityWeights,
} from "@/lib/ai/organic-squad/types";
import { sellUtility } from "@/lib/ai/organic-squad/utility";
import { deriveUtilityWeights, resolveRenewalContractLength } from "@/lib/ai/organic-squad/weights";
import type { GameState, Player, Team, TeamIdentity } from "@/lib/data/olyDataTypes";

// A pow-heavy identity with a low OPT (8) so a roster of 9+ is already "over OPT". Finances low so the
// value-tilt (wThrift) is meaningful — an attractive sale value reads as sellable.
const IDENTITY = {
  ambition: 55,
  finances: 45,
  boardConfidence: 55,
  harmony: 50,
  playerOpt: ROSTER_MIN, // 8
  pow: 70,
  spe: 12,
  men: 12,
  soc: 12,
} as unknown as TeamIdentity;

const DISCIPLINES = [
  { id: "tdm", category: "power" },
  { id: "staffel", category: "speed" },
  { id: "tennis", category: "mental" },
  { id: "showcase", category: "social" },
];

function makeGameState(): GameState {
  // Minimal shape the pure planner reads: disciplines + a seasonState (for the optional GM lookup).
  // teamId "team-test" is not a themed team, so the theme runtime context resolves to null (no roster
  // scan needed) — keeping this fixture free of theme wiring.
  return {
    disciplines: DISCIPLINES,
    seasonState: {},
  } as unknown as GameState;
}

const TEAM = {
  teamId: "team-test",
  name: "Test FC",
  cash: 100,
  rosterLimit: 14,
} as unknown as Team;

function player(
  id: string,
  disciplineId: string,
  opts: { pow?: number; spe?: number; rating: number; mv: number; salary?: number },
): Player {
  return {
    id,
    coreStats: { pow: opts.pow ?? 75, spe: opts.spe ?? 50, men: 50, soc: 50 },
    disciplineRatings: { [disciplineId]: opts.rating },
    marketValue: opts.mv,
    salaryDemand: opts.salary ?? 8,
    potential: 0,
  } as unknown as Player;
}

function planSells(roster: Player[]) {
  return planOrganicSellsForTeam({
    gameState: makeGameState(),
    team: TEAM,
    identity: IDENTITY,
    roster,
  });
}

describe("planOrganicSellsForTeam — organic in-season sells", () => {
  it("over-OPT team sells a surplus player from an already-covered discipline", () => {
    // 9 solide bodies stacked in the SAME power discipline (tdm) — deeply covered — plus one clearly
    // surplus body with the most attractive sale value. Roster (10) is above OPT (8).
    const roster: Player[] = [];
    for (let i = 0; i < 9; i += 1) {
      roster.push(player(`tdm-${i}`, "tdm", { pow: 78, rating: 82, mv: 24 }));
    }
    const surplus = player("surplus", "tdm", { pow: 76, rating: 82, mv: 60 });
    roster.push(surplus);

    const result = planSells(roster);

    expect(result.decisions.length).toBeGreaterThan(0);
    // The high-sale-value body in the saturated discipline is the first (best) sell.
    expect(result.decisions[0]?.playerId).toBe("surplus");
    expect(result.decisions.map((d) => d.playerId)).toContain("surplus");
    // The hard floor is respected.
    expect(result.finalRosterSize).toBeGreaterThanOrEqual(ROSTER_MIN);
  });

  it("a team already at ROSTER_MIN sells nothing (min is a hard floor)", () => {
    const roster: Player[] = [];
    for (let i = 0; i < ROSTER_MIN; i += 1) {
      roster.push(player(`tdm-${i}`, "tdm", { pow: 78, rating: 82, mv: 40 }));
    }
    expect(roster.length).toBe(ROSTER_MIN);

    const result = planSells(roster);

    expect(result.decisions).toHaveLength(0);
    expect(result.finalRosterSize).toBe(ROSTER_MIN);
  });

  it("a key starter (high strength loss, uncovered need) is kept, not sold", () => {
    // 11 interchangeable bodies stacked in a saturated power discipline (cheap to shed) + one elite
    // all-rounder who is the SOLE cover of a needed discipline (staffel) and carries a low sale value.
    // The greedy loop sheds the fillers down to OPT/min and never touches the key player.
    const roster: Player[] = [];
    for (let i = 0; i < 11; i += 1) {
      roster.push(player(`tdm-${i}`, "tdm", { pow: 75, rating: 82, mv: 30 }));
    }
    const key = player("key", "staffel", { pow: 95, spe: 95, rating: 95, mv: 5 });
    roster.push(key);

    const result = planSells(roster);

    expect(result.decisions.length).toBeGreaterThan(0);
    expect(result.decisions.map((d) => d.playerId)).not.toContain("key");
    expect(result.finalRosterSize).toBeGreaterThanOrEqual(ROSTER_MIN);
  });
});

describe("planOrganicSellsForTeam — weak-team upgrade swap (season-end hoarder churn)", () => {
  // Identity with a higher opt (12) so a roster of 10 sits BELOW opt — the main loop's strict at/below-opt
  // threshold sheds nobody, isolating the upgrade-swap path. Ten cheap keepers spread across disciplines
  // (low sale value → negative sellUtility → all kept by the normal loop).
  const HOARDER_IDENTITY = {
    ambition: 55,
    finances: 45,
    boardConfidence: 55,
    harmony: 50,
    playerOpt: 12,
    pow: 55,
    spe: 55,
    men: 55,
    soc: 55,
  } as unknown as TeamIdentity;

  function hoarderRoster(): Player[] {
    const disc = ["tdm", "staffel", "tennis", "showcase"];
    const roster: Player[] = [];
    for (let i = 0; i < 10; i += 1) {
      roster.push(player(`body-${i}`, disc[i % disc.length], { pow: 60, rating: 60, mv: 5, salary: 8 }));
    }
    return roster;
  }

  function planSeasonEnd(cash: number, envValue?: string) {
    const prev = process.env.OLY_WEAK_TEAM_UPGRADE_SWAP;
    if (envValue === undefined) delete process.env.OLY_WEAK_TEAM_UPGRADE_SWAP;
    else process.env.OLY_WEAK_TEAM_UPGRADE_SWAP = envValue;
    try {
      return planOrganicSellsForTeam({
        gameState: makeGameState(),
        team: { ...TEAM, cash } as unknown as Team,
        identity: HOARDER_IDENTITY,
        roster: hoarderRoster(),
        allowBelowMin: true,
      });
    } finally {
      if (prev === undefined) delete process.env.OLY_WEAK_TEAM_UPGRADE_SWAP;
      else process.env.OLY_WEAK_TEAM_UPGRADE_SWAP = prev;
    }
  }

  it("a cash-rich hoarder below opt sheds its weakest keeper(s) to fund an upgrade", () => {
    // teamMw = 10*5 = 50, cash 200 → cash/MW 4.0 (deep hoarder) → up to 2 upgrade swaps.
    const result = planSeasonEnd(200);
    const churn = result.decisions.filter((d) => d.reason === "upgrade_churn");
    expect(churn.length).toBeGreaterThan(0);
    expect(result.finalRosterSize).toBeGreaterThanOrEqual(ROSTER_MIN);
  });

  it("a cash-poor team (low cash/MW) sheds nobody via the upgrade path", () => {
    // cash 15 → cash/MW 0.30, below the 0.75 hoarder gate → no upgrade churn.
    const result = planSeasonEnd(15);
    expect(result.decisions.filter((d) => d.reason === "upgrade_churn")).toHaveLength(0);
  });

  it("the upgrade swap is off when OLY_WEAK_TEAM_UPGRADE_SWAP=0", () => {
    const result = planSeasonEnd(200, "0");
    expect(result.decisions.filter((d) => d.reason === "upgrade_churn")).toHaveLength(0);
  });
});

describe("sellUtility profit-flip term (GM sellForProfitAggression → wProfit)", () => {
  // Identity fixed; the ONLY thing separating the two clubs is GM sellForProfitAggression → wProfit
  // (wWin/wThrift/wPatience are identical for both). wAsset differs slightly but is not read by sells.
  const IDENTITY: OrganicIdentityInput = {
    ambition: 55,
    finances: 45,
    boardConfidence: 55,
    harmony: 50,
    playerOpt: ROSTER_MIN, // 8 → optTarget 8
  };

  // A needed key player (sole cover of a needed speed discipline → high on-pitch strength loss if sold)
  // bought cheap and now worth far more: marketValue (40) >> purchasePrice (4).
  const FLIP: OrganicPlayerView = {
    playerId: "flip",
    pow: 50,
    spe: 45,
    men: 50,
    soc: 50,
    disciplineRatings: { staffel: 70 },
    marketValue: 40,
    salary: 6,
    purchasePrice: 4,
  };

  // Build a deterministic single-discipline sell state. rosterSize (10) and rosterSize-1 (9) are both
  // >= optTarget (8) and cash sits far above the buffer, so the wPatience cash-option term nets to 0 —
  // isolating wThrift·saleValue − wWin·strengthLoss (+ wProfit·profit) as the decision.
  function buildSellState(weights: OrganicUtilityWeights): OrganicTeamState {
    const disciplines: OrganicDiscipline[] = [{ id: "staffel", category: "speed" }];
    const identityAxisWeights: Record<CoreAxis, number> = { pow: 0, spe: 1, men: 0, soc: 0 };
    const disciplineNeeds = computeDisciplineNeeds([FLIP], identityAxisWeights, disciplines);
    const needAxisWeights = deriveNeedAxisWeights(disciplineNeeds);
    return {
      cash: 200,
      cashBuffer: 5,
      salaryTotal: FLIP.salary,
      rosterSize: 10,
      boardRisk: 0.45,
      forecast: { projectedSeasonEndCash: 300, sustainabilityMargin: 100 },
      weights,
      disciplineNeeds,
      needAxisWeights,
    };
  }

  it("a trader (high sellForProfitAggression) flips the profitable player; a loyal club keeps it", () => {
    const traderWeights = deriveUtilityWeights(IDENTITY, { sellForProfitAggression: 10 });
    const loyalWeights = deriveUtilityWeights(IDENTITY, { sellForProfitAggression: 1, loyaltyBias: 9 });

    // A loyal/stable club barely values the unrealized profit; a trader values it strongly.
    expect(loyalWeights.wProfit).toBeCloseTo(0);
    expect(traderWeights.wProfit).toBeGreaterThan(0.5);

    const loyalUtility = sellUtility(FLIP, buildSellState(loyalWeights));
    const traderUtility = sellUtility(FLIP, buildSellState(traderWeights));

    // planOrganicSellsForTeam sells only while sellUtility > SELL_THRESHOLD (0): loyal keeps, trader sells.
    expect(loyalUtility).toBeLessThanOrEqual(0);
    expect(traderUtility).toBeGreaterThan(0);
    expect(traderUtility).toBeGreaterThan(loyalUtility);
  });

  it("an unknown cost basis (undefined purchasePrice) contributes no profit term", () => {
    const traderWeights = deriveUtilityWeights(IDENTITY, { sellForProfitAggression: 10 });
    const withProfit = sellUtility(FLIP, buildSellState(traderWeights));
    const noBasis = sellUtility({ ...FLIP, purchasePrice: undefined }, buildSellState(traderWeights));
    // Removing the cost basis removes exactly the wProfit·max(0, mv−pp) contribution.
    expect(withProfit).toBeGreaterThan(noBasis);
  });
});

describe("resolveRenewalContractLength", () => {
  const NEUTRAL: OrganicIdentityInput = {
    ambition: 50,
    finances: 50,
    boardConfidence: 50,
    harmony: 50,
    playerOpt: 10,
  };

  it("returns a SHORT contract for a flexible trader (high short/profit bias)", () => {
    const length = resolveRenewalContractLength(NEUTRAL, {
      shortContractPreference: 9,
      sellForProfitAggression: 9,
    });
    expect(length).toBeGreaterThanOrEqual(1);
    expect(length).toBeLessThanOrEqual(2);
  });

  it("returns a LONG contract for a stable high-harmony/high-boardConfidence club", () => {
    const stableIdentity: OrganicIdentityInput = { ...NEUTRAL, harmony: 90, boardConfidence: 90 };
    const length = resolveRenewalContractLength(stableIdentity, { longContractPreference: 9 });
    expect(length).toBeGreaterThanOrEqual(4);
    expect(length).toBeLessThanOrEqual(5);
  });

  it("a trader renews shorter than a stable club, and both stay in the [1,5] contract range", () => {
    const trader = resolveRenewalContractLength(NEUTRAL, {
      shortContractPreference: 9,
      sellForProfitAggression: 9,
    });
    const stable = resolveRenewalContractLength(
      { ...NEUTRAL, harmony: 90, boardConfidence: 90 },
      { longContractPreference: 9 },
    );
    expect(trader).toBeLessThan(stable);
    for (const length of [trader, stable]) {
      expect(length).toBeGreaterThanOrEqual(1);
      expect(length).toBeLessThanOrEqual(5);
    }
  });
});
