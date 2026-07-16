import { describe, expect, it } from "vitest";

import {
  buildSeasonRatingsSlice,
  hydrateSeasonRatingsSliceMap,
} from "@/lib/foundation/season-ratings-slice";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";

describe("season ratings slice", () => {
  it(
    "builds a compact ratings payload for all players",
    () => {
    const gameState = createSingleplayerGameState();
    const payload = buildSeasonRatingsSlice({
      gameState,
      saveId: "save-ratings-slice",
    });

    expect(payload.scope.saveId).toBe("save-ratings-slice");
    expect(payload.scope.seasonId).toBe(gameState.season.id);
    expect(payload.count).toBeGreaterThan(0);
    expect(Object.keys(payload.ratingsByPlayerId).length).toBe(payload.count);

    const samplePlayerId = gameState.players[0]?.id;
    if (samplePlayerId) {
      expect(payload.ratingsByPlayerId[samplePlayerId]?.playerId).toBe(samplePlayerId);
    }
    },
    60_000,
  );

  it(
    "filters ratings to requested player ids",
    () => {
    const gameState = createSingleplayerGameState();
    const playerIds = gameState.players.slice(0, 2).map((player) => player.id);
    const payload = buildSeasonRatingsSlice({
      gameState,
      saveId: "save-ratings-slice-filter",
      playerIds,
    });

    expect(payload.count).toBe(playerIds.length);
    expect(Object.keys(payload.ratingsByPlayerId).sort()).toEqual([...playerIds].sort());
    },
    60_000,
  );

  it(
    "hydrates slice rows back into a rating map",
    () => {
    const gameState = createSingleplayerGameState();
    const payload = buildSeasonRatingsSlice({
      gameState,
      saveId: "save-ratings-slice-hydrate",
    });
    const hydrated = hydrateSeasonRatingsSliceMap(payload.ratingsByPlayerId);

    expect(hydrated.size).toBe(payload.count);
    const samplePlayerId = gameState.players[0]?.id;
    if (samplePlayerId) {
      expect(hydrated.get(samplePlayerId)?.ovrNormalized).toBe(
        payload.ratingsByPlayerId[samplePlayerId]?.ovrNormalized ?? null,
      );
    }
    },
    60_000,
  );
});
