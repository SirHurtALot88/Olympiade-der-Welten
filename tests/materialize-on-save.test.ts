import { describe, expect, it } from "vitest";

import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import {
  hasRatingRelevantGameStateChange,
  prepareGameStateForPersistence,
} from "@/lib/foundation/materialize-on-save";

describe("materialize on save", () => {
  it("does not materialize when only training mode changes", () => {
    const before = createSingleplayerGameState();
    const after = {
      ...before,
      saveVersion: (before.saveVersion ?? 0) + 1,
      players: before.players.map((player, index) =>
        index === 0 ? { ...player, trainingMode: "hart" as const } : player,
      ),
    };

    expect(hasRatingRelevantGameStateChange(before, after)).toBe(false);
    expect(prepareGameStateForPersistence(before, after)).toBe(after);
    expect(prepareGameStateForPersistence(before, after).seasonState.persistedSeasonDerivations).toBeUndefined();
  });

  it("materializes when player rating changes", () => {
    const before = createSingleplayerGameState();
    const after = {
      ...before,
      saveVersion: (before.saveVersion ?? 0) + 1,
      players: before.players.map((player, index) =>
        index === 0 ? { ...player, rating: (player.rating ?? 50) + 1 } : player,
      ),
    };

    expect(hasRatingRelevantGameStateChange(before, after)).toBe(true);
    expect(prepareGameStateForPersistence(before, after).seasonState.persistedSeasonDerivations).toBeTruthy();
  });
});
