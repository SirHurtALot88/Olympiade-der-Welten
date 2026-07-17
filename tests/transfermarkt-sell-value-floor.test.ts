import { describe, expect, it } from "vitest";

import type { GameState, Player, RosterEntry, Team, TeamIdentity } from "@/lib/data/olyDataTypes";
import { planOrganicSellsForTeam } from "@/lib/ai/organic-squad/draft-adapter";
import { buildTransfermarktSaleFactorBreakdown } from "@/lib/market/transfermarkt-sale-factor";
import {
  applySellPricingPolicyToBreakdown,
  isBigHaircut,
  resolveValueAwareSellFloor,
} from "@/lib/market/transfermarkt-sell-pricing-policy";
import type { TransfermarktSaleFactorBreakdown } from "@/lib/market/transfermarkt-sale-factor";

// ---------------------------------------------------------------------------
// Shared floor helper — owner rule: never lose more than max(25% of MW, 5 mio).
//   floor = min(0.75 × MW, MW − 5)
// ---------------------------------------------------------------------------
describe("resolveValueAwareSellFloor / isBigHaircut (shared math)", () => {
  it("caps loss at 25% for expensive players (MW > 20)", () => {
    expect(resolveValueAwareSellFloor(40)).toBe(30); // min(30, 35)
    expect(resolveValueAwareSellFloor(100)).toBe(75); // min(75, 95)
  });

  it("caps absolute loss at 5 for cheap players (MW <= 20)", () => {
    expect(resolveValueAwareSellFloor(8)).toBe(3); // min(6, 3)
    expect(resolveValueAwareSellFloor(10)).toBe(5); // min(7.5, 5)
  });

  it("crosses over exactly at MW = 20 (25% == 5 absolute)", () => {
    expect(resolveValueAwareSellFloor(20)).toBe(15); // min(15, 15)
  });

  it("gives no effective protection when MW <= 5 (trivial money)", () => {
    expect(resolveValueAwareSellFloor(4)).toBeLessThanOrEqual(0);
  });

  it("flags a breach only below the floor", () => {
    expect(isBigHaircut(40, 29.99)).toBe(true);
    expect(isBigHaircut(40, 30)).toBe(false);
    expect(isBigHaircut(40, 31)).toBe(false);
    expect(isBigHaircut(8, 2.9)).toBe(true);
    expect(isBigHaircut(8, 3)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Part 1 — mechanical price floor in applySellPricingPolicyToBreakdown.
// ---------------------------------------------------------------------------
function createTeam(cash: number): Team {
  return {
    teamId: "A-A",
    shortCode: "A-A",
    name: "Team A",
    budget: 100,
    cash,
    identityId: "A-A",
    humanControlled: true,
    rosterLimit: 12,
  } as Team;
}

function createIdentity(): TeamIdentity {
  return {
    teamId: "A-A",
    pow: 5,
    spe: 5,
    men: 5,
    soc: 5,
    ambition: 5,
    finances: 5,
    boardConfidence: 5,
    harmony: 5,
    manners: 5,
    popularity: 5,
    cooperation: 5,
    playerMin: 7,
    playerOpt: 10,
  } as unknown as TeamIdentity;
}

function createGameState(cash: number): GameState {
  return {
    gamePhase: "transfer_sell_phase",
    season: { id: "season-2", currentMatchday: 1, matchdayIds: [] },
    matchdayState: { matchdayId: "season-2-md-1", status: "open" },
    teams: [createTeam(cash)],
    players: [],
    rosters: [],
    teamIdentities: [createIdentity()],
    seasonState: { matchdayResults: [], playerDisciplinePerformances: [] },
  } as unknown as GameState;
}

// A ranked base breakdown (factorSource != fallback ⇒ seasonStartDiscount = 1) with a hand-set
// pre-Stage-B sale price, so the combined multiplier is deterministic (1.0 for a non-distress sell
// in the sell window: timing 1 × liquidation 1 × identityFit 1 [player=null] × seasonStart 1).
function baseBreakdown(marketValue: number, saleFactor: number): TransfermarktSaleFactorBreakdown {
  return {
    bracket: 6,
    bracketGroupSize: 20,
    baseMarketValue: marketValue,
    mvs: 10,
    ppsSeason: 10,
    rankInBracket: 18,
    baseFactor: saleFactor,
    rankBonus: 0,
    saleFactor,
    salePrice: Number((marketValue * saleFactor).toFixed(2)),
    factorSource: "bracket_mvs_live",
  };
}

describe("Part 1 — value-aware sale-price floor", () => {
  it("(a) floors a 40-MW voluntary sale at 30 (not below)", () => {
    const gameState = createGameState(100); // non-distress
    const base = baseBreakdown(40, 0.5); // natural price 20 (loss 50%)
    const priced = applySellPricingPolicyToBreakdown({
      gameState,
      teamId: "A-A",
      player: null, // identityFit = 1 ⇒ combined multiplier deterministic
      rosterEntry: null,
      baseBreakdown: base,
      rosterAfter: 10, // >= playerMin ⇒ no liquidation malus
    });

    expect(priced.policy.combinedMultiplier).toBe(1);
    expect(priced.preFloorSalePrice).toBe(20);
    expect(priced.floorApplied).toBe(true);
    expect(priced.breakdown.salePrice).toBe(30);
    expect(priced.breakdown.saleFactor).toBe(0.75);
  });

  it("(b) floors an 8-MW voluntary sale at 3 (MW − 5)", () => {
    const gameState = createGameState(100);
    const base = baseBreakdown(8, 0.35); // natural price 2.8
    const priced = applySellPricingPolicyToBreakdown({
      gameState,
      teamId: "A-A",
      player: null,
      rosterEntry: null,
      baseBreakdown: base,
      rosterAfter: 10,
    });

    expect(priced.preFloorSalePrice).toBe(2.8);
    expect(priced.floorApplied).toBe(true);
    expect(priced.breakdown.salePrice).toBe(3);
  });

  it("does not raise a price already above the floor", () => {
    const gameState = createGameState(100);
    const base = baseBreakdown(40, 0.9); // natural price 36 > floor 30
    const priced = applySellPricingPolicyToBreakdown({
      gameState,
      teamId: "A-A",
      player: null,
      rosterEntry: null,
      baseBreakdown: base,
      rosterAfter: 10,
    });

    expect(priced.floorApplied).toBe(false);
    expect(priced.breakdown.salePrice).toBe(36);
  });

  it("(c) lets a distressed (cash < 0) sale realize below the floor", () => {
    const gameState = createGameState(-5); // distressed ⇒ exempt from raised floor
    const base = baseBreakdown(40, 0.4); // natural price 16
    const priced = applySellPricingPolicyToBreakdown({
      gameState,
      teamId: "A-A",
      player: null,
      rosterEntry: null,
      baseBreakdown: base,
      rosterAfter: 10,
    });

    expect(priced.floorApplied).toBe(false);
    // liquidationMalus (cash<0) trims the price; it stays well below the 30 floor.
    expect(priced.breakdown.salePrice).toBeLessThan(30);
  });
});

// ---------------------------------------------------------------------------
// Part 2 — "think twice" decision gate in planOrganicSellsForTeam.
// A bracket of 18 same-MW players with descending performance: the lowest-ranked get the lowest base
// sale factor (floored at 0.65) ⇒ their realized price breaches the value-aware floor. A non-distressed
// club should KEEP those breaching bodies; a distressed (cash<0) club may still shed them all.
// ---------------------------------------------------------------------------
const GATE_IDENTITY = {
  teamId: "team-test",
  ambition: 55,
  finances: 45,
  boardConfidence: 55,
  harmony: 50,
  playerMin: 8,
  playerOpt: 8,
  pow: 70,
  spe: 12,
  men: 12,
  soc: 12,
} as unknown as TeamIdentity;

function gatePlayer(id: string): Player {
  return {
    id,
    name: id,
    coreStats: { pow: 75, spe: 50, men: 50, soc: 50 },
    disciplineRatings: { tdm: 60 },
    marketValue: 40,
    salaryDemand: 8,
    potential: 0,
    className: "Hero",
    race: "Human",
    alignment: "N",
    gender: "f",
    subclasses: [],
    traitsPositive: [],
    traitsNegative: [],
    pps: 0,
    ovr: 70,
  } as unknown as Player;
}

function gateRoster(id: string, playerId: string): RosterEntry {
  return {
    id,
    teamId: "team-test",
    playerId,
    contractLength: 2,
    salary: 8,
    upkeep: 8,
    purchasePrice: 60,
    currentValue: 40,
    roleTag: "starter",
    joinedSeasonId: "season-2",
  } as RosterEntry;
}

function buildGateState(cash: number) {
  const n = 18;
  const players: Player[] = [];
  const rosters: RosterEntry[] = [];
  const perfs: unknown[] = [];
  for (let i = 0; i < n; i++) {
    const pid = `p${i}`;
    players.push(gatePlayer(pid));
    rosters.push(gateRoster(`r${i}`, pid));
    perfs.push({
      id: `perf-${i}`,
      matchdayResultId: "result-1",
      teamId: "team-test",
      playerId: pid,
      activePlayerId: `r${i}`,
      disciplineId: "tdm",
      disciplineSide: "tdm",
      slotIndex: i,
      baseValue: 90 - i * 4,
      finalPlayerScore: 90 - i * 4,
      scoreContribution: 90 - i * 4, // descending ⇒ p17 ranks last ⇒ lowest sale factor
      rankInTeam: i + 1,
      rankInDiscipline: i + 1,
      isTop10: true,
      isMvpCandidate: false,
      storyWeight: 1,
      createdAt: "2026-06-10T12:00:00.000Z",
    });
  }
  const team = {
    teamId: "team-test",
    name: "T",
    shortCode: "T",
    cash,
    rosterLimit: 20,
    budget: 100,
    identityId: "team-test",
    humanControlled: false,
  } as unknown as Team;
  const gameState = {
    gamePhase: "season_active",
    season: { id: "season-2", name: "S2", currentMatchday: 1, matchdayIds: [] },
    matchdayState: { matchdayId: "season-2-md-1", status: "open" },
    teams: [team],
    players,
    rosters,
    teamIdentities: [GATE_IDENTITY],
    disciplines: [{ id: "tdm", category: "power" }],
    seasonState: {
      matchdayResults: [{ id: "result-1", seasonId: "season-2", status: "preview_applied" }],
      playerDisciplinePerformances: perfs,
      seasonSnapshots: [],
    },
  } as unknown as GameState;
  return { gameState, team, players };
}

describe("Part 2 — organic sell 'think twice' floor gate", () => {
  it("the lowest-ranked player's realized price actually breaches the floor", () => {
    const { gameState, players } = buildGateState(100);
    const worst = players[players.length - 1]; // p17, ranked last
    const rosterEntry = gameState.rosters.find((entry) => entry.playerId === worst.id) ?? null;
    const base = buildTransfermarktSaleFactorBreakdown(gameState, worst, rosterEntry);
    const priced = applySellPricingPolicyToBreakdown({
      gameState,
      teamId: "team-test",
      player: worst,
      rosterEntry,
      baseBreakdown: base,
      rosterAfter: 6,
    });
    const realized = priced.preFloorSalePrice ?? priced.breakdown.salePrice;
    expect(isBigHaircut(worst.marketValue, realized ?? 0)).toBe(true);
  });

  it("(d) skips a voluntary breaching sale for a solvent club but keeps it for a distressed one", () => {
    const solvent = buildGateState(100);
    const distressed = buildGateState(-5);

    const solventPlan = planOrganicSellsForTeam({
      gameState: solvent.gameState,
      team: solvent.team,
      identity: GATE_IDENTITY,
      roster: solvent.players,
      allowBelowMin: true,
    });
    const distressedPlan = planOrganicSellsForTeam({
      gameState: distressed.gameState,
      team: distressed.team,
      identity: GATE_IDENTITY,
      roster: distressed.players,
      allowBelowMin: true,
    });

    const solventSold = new Set(solventPlan.decisions.map((d) => d.playerId));
    const distressedSold = new Set(distressedPlan.decisions.map((d) => d.playerId));

    // The solvent club is blocked from shedding the breaching bottom-of-bracket bodies...
    expect(solventPlan.decisions.length).toBeLessThan(distressedPlan.decisions.length);
    expect(solventSold.has("p17")).toBe(false);
    // ...while the distressed club (cash < 0) bypasses the gate and may shed them.
    expect(distressedSold.has("p17")).toBe(true);
  });
});
