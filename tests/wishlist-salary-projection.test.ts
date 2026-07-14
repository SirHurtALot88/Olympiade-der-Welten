import { describe, expect, it } from "vitest";

import type { GameState, Player } from "@/lib/data/olyDataTypes";
import { projectWishlistSalarySchedule } from "@/lib/market/contract-negotiation-preview";

function buildPlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: "wishlist-player-1",
    name: "Kaelith",
    rating: 0,
    marketValue: 75000,
    salaryDemand: 8000,
    displayMarketValue: 62.52,
    displaySalary: 16.78,
    pps: null,
    ovr: null,
    className: "Templar",
    race: "Tauren",
    alignment: "neutral",
    gender: "m",
    subclasses: [],
    traitsPositive: ["Loyal", "Disciplined"],
    traitsNegative: ["Cruel"],
    coreStats: { pow: 76.43, spe: 51.66, men: 63.58, soc: 47.43 },
    attributeSheetStats: {
      power: 86,
      health: 79,
      stamina: 74,
      intelligence: 42,
      awareness: 48,
      determination: 81,
      speed: 33,
      dexterity: 28,
      charisma: 67,
      will: 76,
      spirit: 18,
      torment: 84,
    },
    disciplineRatings: {
      tennis: 80.56,
      "mini-dm": 79.96,
      showcase: 46.79,
      "time-trial": 35.82,
      spurt: 67.4,
      basketball: 33.81,
      tdm: 73.48,
      battlefield: 58.01,
      staffel: 38.88,
      football: 63.72,
      wettessen: 79.12,
      gewichtheben: 76.72,
      "speed-schach": 43.18,
      "takeshis-castle": 67.32,
      hockey: 67.04,
      eiskunstlauf: 34.84,
      climbing: 66.92,
      fechten: 49.3,
      "i-spy": 47.74,
      breaking: 84.94,
    },
    ...overrides,
  };
}

function buildGameState(players: Player[]): GameState {
  return {
    season: { id: "season-1", name: "Season 1", year: 1, currentMatchday: 1, matchdayIds: ["md-1"] },
    seasonState: {
      seasonId: "season-1",
      schedule: [],
      standings: {},
      transferWishlist: [],
      teamFacilities: {},
    },
    matchdayState: { matchdayId: "md-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [],
    teamIdentities: [],
    players,
    disciplines: [],
    rosters: [],
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
  } as unknown as GameState;
}

describe("projectWishlistSalarySchedule", () => {
  it("returns null for an unknown player id", () => {
    const gameState = buildGameState([buildPlayer()]);

    expect(projectWishlistSalarySchedule(gameState, "does-not-exist")).toBeNull();
  });

  it("projects a non-empty yearly schedule matching the player's default contract term", () => {
    const player = buildPlayer();
    const gameState = buildGameState([player]);

    const projection = projectWishlistSalarySchedule(gameState, player.id);

    expect(projection).not.toBeNull();
    expect(projection!.playerId).toBe(player.id);
    expect(projection!.yearlySalarySchedule.length).toBeGreaterThan(0);
    expect(projection!.yearlySalarySchedule).toHaveLength(projection!.contractLength);
    expect(projection!.yearlySalarySchedule.every((row) => typeof row.salary === "number" && row.salary > 0)).toBe(true);
    expect(projection!.totalSalary).not.toBeNull();
  });

  it("is deterministic across repeated calls for the same input", () => {
    const player = buildPlayer();
    const gameState = buildGameState([player]);

    const first = projectWishlistSalarySchedule(gameState, player.id);
    const second = projectWishlistSalarySchedule(gameState, player.id);

    expect(second).toEqual(first);
  });

  it("respects an explicit contract length/shape override", () => {
    const player = buildPlayer();
    const gameState = buildGameState([player]);

    const projection = projectWishlistSalarySchedule(gameState, player.id, {
      contractLength: 3,
      shape: "front_loaded",
    });

    expect(projection!.contractLength).toBe(3);
    expect(projection!.contractShape).toBe("front_loaded");
    expect(projection!.yearlySalarySchedule).toHaveLength(3);
  });
});
