import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import type { PersistedSaveGame } from "@/lib/persistence/types";
import { runPhaseAuditDe } from "@/lib/season/long-run-phase-audit";

function minimalSave(gameState: GameState): PersistedSaveGame {
  return {
    saveId: "test-save",
    name: "Test",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    gameState,
  };
}

describe("long-run phase audit fatigue gates", () => {
  it("flags injury_pipeline_active RED when season complete but no injuries", () => {
    const save = minimalSave({
      season: { id: "season-1", name: "S1", currentMatchday: 10, matchdayIds: Array.from({ length: 10 }, (_, i) => `md${i + 1}`) },
      gamePhase: "season_completed",
      teams: [{ teamId: "t1", shortCode: "A-A", name: "A", budget: 200, cash: 50, rosterLimit: 32, humanControlled: false }],
      teamIdentities: [{ teamId: "t1", playerMin: 8, playerOpt: 12 }],
      players: [{ id: "p1", name: "P", gender: "male", race: "human", rating: 50, potential: 60, trainingMode: "mittel", fatigue: 40 }],
      rosters: [{ id: "r1", teamId: "t1", playerId: "p1", contractLength: 2, salary: 10, upkeep: 0, roleTag: "starter", joinedSeasonId: "season-1" }],
      transferHistory: [],
      contracts: [],
      transferListings: [],
      seasonState: {
        standings: { t1: { rank: 1, points: 30, teamId: "t1" } },
        matchdayResults: Array.from({ length: 10 }, (_, i) => ({ seasonId: "season-1", matchdayId: `md${i + 1}` })),
        injuryEvents: [],
      },
      matchdayState: { matchdayId: "md10" },
    } as unknown as GameState);

    const audit = runPhaseAuditDe(save, "season_end");
    expect(audit.checks.find((entry) => entry.id === "injury_pipeline_active")?.status).toBe("RED");
    expect(audit.checks.find((entry) => entry.id === "fatigue_pipeline_active")?.status).toBe("PASS");
  });
});
