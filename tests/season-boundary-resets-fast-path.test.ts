import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { applySeasonBoundaryPlayerResets } from "@/lib/season/preseason-workflow-service";

function buildGameState(): GameState {
  return {
    players: [
      // Rostered Spieler mit stale Vorsaison-Fatigue + Accumulator + aktivem trainingMode.
      {
        id: "p1",
        fatigue: 42,
        trainingMode: "intensiv",
        seasonTrainingAccumulator: { intensiv: 5 },
      },
      // Free Agent — wurde im FAST-Pfad früher NICHT genullt.
      {
        id: "p2",
        fatigue: 17,
        trainingMode: "ausgewogen",
        seasonTrainingAccumulator: { ausgewogen: 3 },
      },
    ],
    rosters: [{ playerId: "p1", teamId: "A" }],
    playerMoraleState: [
      { playerId: "p1", teamId: "A", inactiveSeasons: 0 },
      { playerId: "p2", teamId: null, inactiveSeasons: 1 },
    ],
  } as unknown as GameState;
}

describe("applySeasonBoundaryPlayerResets (audit R2/V5 — FAST-Pfad)", () => {
  it("resets fatigue/accumulator/trainingMode for ALL players (rostered + free agents)", () => {
    const result = applySeasonBoundaryPlayerResets(buildGameState());
    for (const player of result.players) {
      expect(player.fatigue).toBe(0);
      expect(player.trainingMode).toBeNull();
      expect(player.seasonTrainingAccumulator).toBeNull();
    }
  });

  it("advances the morale carry state: rostered inactiveSeasons stays 0, free agent increments", () => {
    const result = applySeasonBoundaryPlayerResets(buildGameState());
    const byId = new Map((result.playerMoraleState ?? []).map((e) => [e.playerId, e] as const));
    expect(byId.get("p1")?.inactiveSeasons).toBe(0);
    // Free Agent p2 war 1 → wird auf 2 fortgeschrieben (eine weitere inaktive Saison).
    expect(byId.get("p2")?.inactiveSeasons).toBe(2);
  });
});
