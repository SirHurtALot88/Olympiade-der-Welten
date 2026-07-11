import { describe, expect, it } from "vitest";

import type { GameState, Player, RosterEntry, Team } from "@/lib/data/olyDataTypes";
import { buildTransfermarktSaleFactorBreakdown } from "@/lib/market/transfermarkt-sale-factor";
import { applySellPricingPolicyToBreakdown } from "@/lib/market/transfermarkt-sell-pricing-policy";

function createTeam(partial?: Partial<Team>): Team {
  return {
    teamId: partial?.teamId ?? "A-A",
    shortCode: partial?.shortCode ?? "A-A",
    name: partial?.name ?? "Team A",
    budget: partial?.budget ?? 100,
    cash: partial?.cash ?? 100,
    identityId: partial?.identityId ?? "A-A",
    humanControlled: partial?.humanControlled ?? true,
    rosterLimit: partial?.rosterLimit ?? 12,
  };
}

function createPlayer(id: string, partial?: Partial<Player>): Player {
  return {
    id,
    name: partial?.name ?? id,
    rating: partial?.rating ?? 70,
    marketValue: partial?.marketValue ?? 60,
    salaryDemand: partial?.salaryDemand ?? 10,
    className: partial?.className ?? "Hero",
    race: partial?.race ?? "Human",
    alignment: partial?.alignment ?? "N",
    gender: partial?.gender ?? "f",
    coreStats: partial?.coreStats ?? { pow: 70, spe: 60, men: 55, soc: 50 },
    disciplineRatings: partial?.disciplineRatings ?? {},
    subclasses: partial?.subclasses ?? [],
    traitsPositive: partial?.traitsPositive ?? [],
    traitsNegative: partial?.traitsNegative ?? [],
    pps: partial?.pps ?? 0,
    ovr: partial?.ovr ?? 70,
  } as Player;
}

function createRoster(teamId: string, playerId: string): RosterEntry {
  return {
    id: `roster:${teamId}:${playerId}`,
    teamId,
    playerId,
    contractLength: 2,
    salary: 10,
    upkeep: 10,
    purchasePrice: 50,
    currentValue: 60,
    roleTag: "starter",
    joinedSeasonId: "season-2",
  };
}

describe("transfermarkt-sell-pricing-policy", () => {
  it("applies a season-start discount when ranking data is missing", () => {
    const team = createTeam();
    const player = createPlayer("player-1");
    const roster = createRoster(team.teamId, player.id);
    const gameState = {
      gamePhase: "transfer_sell_phase",
      season: { id: "season-2", currentMatchday: 1, matchdayIds: [] },
      matchdayState: { matchdayId: "season-2-md-1", status: "open" },
      teams: [team],
      players: [player],
      rosters: [roster],
      teamIdentities: [
        {
          teamId: team.teamId,
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
        },
      ],
      seasonState: { matchdayResults: [], playerDisciplinePerformances: [] },
    } as GameState;

    const base = buildTransfermarktSaleFactorBreakdown(gameState, player, roster);
    const priced = applySellPricingPolicyToBreakdown({
      gameState,
      teamId: team.teamId,
      player,
      rosterEntry: roster,
      baseBreakdown: base,
      rosterAfter: 0,
    });

    expect(base.saleFactor).toBe(1);
    expect(priced.policy.seasonStartDiscount).toBe(0.92);
    expect(priced.breakdown.salePrice).toBeLessThan(base.salePrice ?? 999);
  });

  it("applies liquidation malus for negative cash", () => {
    const team = createTeam({ cash: -5 });
    const player = createPlayer("player-1");
    const roster = createRoster(team.teamId, player.id);
    const gameState = {
      gamePhase: "transfer_sell_phase",
      season: { id: "season-2", currentMatchday: 1, matchdayIds: [] },
      matchdayState: { matchdayId: "season-2-md-1", status: "open" },
      teams: [team],
      players: [player],
      rosters: [roster],
      teamIdentities: [
        {
          teamId: team.teamId,
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
        },
      ],
      seasonState: { matchdayResults: [], playerDisciplinePerformances: [] },
    } as GameState;

    const base = buildTransfermarktSaleFactorBreakdown(gameState, player, roster);
    const priced = applySellPricingPolicyToBreakdown({
      gameState,
      teamId: team.teamId,
      player,
      rosterEntry: roster,
      baseBreakdown: base,
      rosterAfter: 6,
    });

    expect(priced.policy.liquidationMalus).toBeLessThan(1);
  });
});
