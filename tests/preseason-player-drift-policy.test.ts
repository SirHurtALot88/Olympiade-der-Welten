import { describe, expect, it } from "vitest";

import { createPlayerBaselineFromPlayer } from "@/lib/players/player-baseline-service";
import { applySeasonBaselineProgression } from "@/lib/season/preseason-workflow-service";
import type { GameState, Player } from "@/lib/data/olyDataTypes";

function player(overrides: Partial<Player> = {}): Player {
  return {
    id: "p1",
    name: "Test",
    className: "Hero",
    rating: 60,
    marketValue: 20,
    salaryDemand: 4,
    displayMarketValue: 20,
    displaySalary: 4,
    attributeSheetStats: {
      power: 50,
      health: 50,
      stamina: 50,
      intelligence: 50,
      awareness: 50,
      determination: 50,
      speed: 50,
      dexterity: 50,
      charisma: 50,
      will: 50,
      spirit: 50,
      torment: 50,
    },
    coreStats: { pow: 50, spe: 50, men: 50, soc: 50 },
    subclasses: [],
    traitsPositive: [],
    traitsNegative: [],
    fatigue: 88,
    ...overrides,
  } as Player;
}

describe("preseason player drift policy", () => {
  it("resets rostered fatigue and keeps rostered attributes without baseline drift", () => {
    const rostered = player({ id: "r1", fatigue: 91, attributeSheetStats: { ...player().attributeSheetStats!, power: 44 } });
    const freeAgent = player({ id: "f1", fatigue: 80, attributeSheetStats: { ...player().attributeSheetStats!, power: 40 } });
    const freeAgentBaseline = createPlayerBaselineFromPlayer(freeAgent, {
      source: "seed",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    freeAgentBaseline.attributes.power = 55;

    const gameState = {
      season: { id: "season-2", name: "Season 2" },
      rosters: [{ id: "ro1", teamId: "T-1", playerId: "r1", salary: 4, upkeep: 4, contractLength: 2 }],
      players: [rostered, freeAgent],
      playerBaselines: [
        createPlayerBaselineFromPlayer(rostered, { source: "seed", createdAt: "2026-01-01T00:00:00.000Z" }),
        freeAgentBaseline,
      ],
      playerProgressionEvents: [],
      disciplines: [],
    } as unknown as GameState;

    const next = applySeasonBaselineProgression(gameState, { completedSeasonId: "season-1" });
    const nextRostered = next.players.find((entry) => entry.id === "r1");
    const nextFreeAgent = next.players.find((entry) => entry.id === "f1");

    expect(nextRostered?.fatigue).toBe(0);
    expect(nextRostered?.attributeSheetStats?.power).toBe(44);
    expect(nextFreeAgent?.attributeSheetStats?.power).toBeGreaterThan(40);
  });
});
