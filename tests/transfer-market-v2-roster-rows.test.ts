import { describe, expect, it } from "vitest";

import type { GameState, Player, RosterEntry } from "@/lib/data/olyDataTypes";
import { buildTransferMarketV2RosterRows } from "@/lib/foundation/tabs/use-market-v2-derivations";

function createPlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: "player-1",
    name: "Test Player",
    rating: 60,
    marketValue: 20,
    salaryDemand: 5,
    className: "Hero",
    race: "Human",
    coreStats: { pow: 50, spe: 50, men: 50, soc: 50 },
    disciplineRatings: {},
    pps: 47.8,
    ovr: 69,
    ...overrides,
  } as Player;
}

function createRosterEntry(overrides: Partial<RosterEntry> = {}): RosterEntry {
  return {
    id: "roster-1",
    playerId: "player-1",
    teamId: "team-1",
    salary: 6,
    currentValue: 25,
    contractLength: 2,
    ...overrides,
  } as RosterEntry;
}

describe("buildTransferMarketV2RosterRows", () => {
  it("uses live season pps and mvs from ratings instead of imported player.pps", () => {
    const gameState = {
      players: [createPlayer({ pps: 47.8, ovr: 69 })],
      rosters: [createRosterEntry()],
      season: { id: "season-1" },
      seasonState: { playerDisciplinePerformances: [] },
    } as unknown as GameState;

    const playerRatingsById = new Map([
      [
        "player-1",
        {
          ppsSeason: 12.5,
          ovrNormalized: 64,
          mvs: 8.5,
        },
      ],
    ]);

    const [row] = buildTransferMarketV2RosterRows({
      gameState,
      playerRatingsById,
      seasonPointsLedger: null,
      getRosterEntryDisplayMarketValue: () => 25,
      getRosterEntryDisplaySalary: () => 6,
    });

    expect(row?.pps).toBe(12.5);
    expect(row?.mvs).toBe(8.5);
    expect(row?.ovr).toBe(64);
  });

  it("shows null mvs instead of zero when the player has no live performances yet", () => {
    const gameState = {
      players: [createPlayer()],
      rosters: [createRosterEntry()],
      season: { id: "season-1" },
      seasonState: { playerDisciplinePerformances: [] },
    } as unknown as GameState;

    const playerRatingsById = new Map([
      [
        "player-1",
        {
          ppsSeason: null,
          ovrNormalized: 64,
          mvs: 0,
        },
      ],
    ]);

    const [row] = buildTransferMarketV2RosterRows({
      gameState,
      playerRatingsById,
      seasonPointsLedger: null,
      getRosterEntryDisplayMarketValue: () => 25,
      getRosterEntryDisplaySalary: () => 6,
    });

    expect(row?.mvs).toBeNull();
    expect(row?.pps).toBeNull();
  });
});
