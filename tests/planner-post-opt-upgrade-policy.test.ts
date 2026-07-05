import { describe, expect, it } from "vitest";

import {
  resolveEffectiveUpgradeBuyPriceFloor,
  resolvePostOptUpgradeMandate,
} from "@/lib/ai/planner-post-opt-upgrade-policy";
import type { GameState } from "@/lib/data/olyDataTypes";

function richOptGameState(input: {
  cash: number;
  salary: number;
  roster: number;
  playerOpt: number;
}): GameState {
  const teamId = "S-S";
  const perPlayerSalary = input.salary / Math.max(input.roster, 1);
  const players = Array.from({ length: input.roster }, (_, index) => ({
    id: `p${index}`,
    name: `P${index}`,
    marketValue: 20,
    displayMarketValue: 20,
    salary: perPlayerSalary,
    rating: 55,
  }));
  return {
    season: { id: "season-2" },
    teams: [{ teamId, shortCode: teamId, cash: input.cash, name: teamId }],
    teamIdentities: [{ teamId, playerMin: 7, playerOpt: input.playerOpt, playerMax: 14, ambition: 8 }],
    rosters: players.map((player, index) => ({
      id: `r${index}`,
      teamId,
      playerId: player.id,
      salary: player.salary,
      contractLength: 2,
    })),
    players,
    seasonState: {},
    transferHistory: [],
  } as unknown as GameState;
}

function gameStateWithPrices(prices: number[]): GameState {
  return {
    season: { id: "season-2" },
    players: prices.map((marketValue, index) => ({
      id: `p${index}`,
      marketValue,
      displayMarketValue: marketValue,
    })),
    teams: [{ teamId: "T-1", shortCode: "T-1", cash: 100 }],
    rosters: [],
    teamIdentities: [],
    transferHistory: [],
  } as unknown as GameState;
}

describe("planner-post-opt-upgrade-policy", () => {
  it("allows 1-2 on-top buys at opt when spendable cash remains", () => {
    const mandate = resolvePostOptUpgradeMandate(
      richOptGameState({ cash: 100, salary: 40, roster: 8, playerOpt: 8 }),
      "S-S",
    );
    expect(mandate.active).toBe(true);
    expect(mandate.mode).toBe("expand");
    expect(mandate.maxBuys).toBeGreaterThanOrEqual(1);
    expect(mandate.maxBuys).toBeLessThanOrEqual(2);
    expect(mandate.maxSells).toBe(0);
  });

  it("stays inactive when cash is near salary buffer only", () => {
    const mandate = resolvePostOptUpgradeMandate(
      richOptGameState({ cash: 45, salary: 42, roster: 10, playerOpt: 10 }),
      "S-S",
    );
    expect(mandate.active).toBe(false);
  });
});

describe("resolveEffectiveUpgradeBuyPriceFloor", () => {
  it("keeps strict floor when a candidate qualifies", () => {
    const floor = resolveEffectiveUpgradeBuyPriceFloor({
      gameState: gameStateWithPrices([20, 25, 30, 35, 40]),
      strictFloor: 32,
      candidatePrices: [28, 35],
      spendableCash: 80,
    });
    expect(floor).toBe(32);
  });

  it("relaxes toward league Q75 when strict floor matches nothing", () => {
    const floor = resolveEffectiveUpgradeBuyPriceFloor({
      gameState: gameStateWithPrices([20, 25, 28, 30, 35]),
      strictFloor: 32,
      candidatePrices: [28, 30],
      spendableCash: 80,
    });
    expect(floor).not.toBe(32);
    expect(floor).toBeLessThanOrEqual(32);
    expect(floor).toBeGreaterThanOrEqual(18);
  });
});
