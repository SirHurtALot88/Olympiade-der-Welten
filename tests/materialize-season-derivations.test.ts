import { describe, expect, it } from "vitest";

import {
  buildGameStateContentSignature,
  getSeasonDerivations,
} from "@/lib/foundation/get-season-derivations";
import {
  buildPersistedSeasonDerivationsRecord,
  hydrateSeasonDerivations,
  serializeSeasonDerivations,
  withPersistedSeasonDerivations,
} from "@/lib/foundation/materialize-season-derivations";
import { computeSeasonDerivationsFresh } from "@/lib/foundation/season-derivations-compute";
import { invalidateSeasonDerivationsCache } from "@/lib/foundation/season-derivations-cache";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";

describe("materialized season derivations", () => {
  it(
    "round-trips derivations through serialize and hydrate",
    () => {
    const gameState = createSingleplayerGameState();
    const derivations = computeSeasonDerivationsFresh(gameState, gameState.season.id);
    const signature = buildGameStateContentSignature(gameState);

    const record = serializeSeasonDerivations({
      derivations,
      seasonId: gameState.season.id,
      contentSignature: signature,
      updatedAt: "2026-06-28T12:00:00.000Z",
    });
    const hydrated = hydrateSeasonDerivations(record);

    expect(hydrated.ledger.pointEntries.length).toBe(derivations.ledger.pointEntries.length);
    expect(hydrated.ratingsById.size).toBe(derivations.ratingsById.size);
    expect(hydrated.performanceByPlayerId.size).toBe(derivations.performanceByPlayerId.size);

    const samplePlayerId = gameState.players[0]?.id;
    if (samplePlayerId) {
      expect(hydrated.ratingsById.get(samplePlayerId)).toEqual(derivations.ratingsById.get(samplePlayerId));
    }
  });

  it("reuses persisted derivations when the content signature matches", () => {
    const gameState = createSingleplayerGameState();
    const saveId = "save-materialized-derivations";
    const signature = buildGameStateContentSignature(gameState);

    invalidateSeasonDerivationsCache(saveId);

    const materialized = withPersistedSeasonDerivations(gameState, saveId);
    expect(materialized.seasonState.persistedSeasonDerivations).toBeTruthy();

    const fresh = computeSeasonDerivationsFresh(gameState, gameState.season.id);
    const fromPersisted = getSeasonDerivations({
      gameState: materialized,
      saveId,
      contentSignature: signature,
    });

    expect(fromPersisted.ratingsById.size).toBe(fresh.ratingsById.size);
    expect(fromPersisted.ledger.pointEntries.length).toBe(fresh.ledger.pointEntries.length);
  });

  it("ignores persisted derivations when the signature is stale", () => {
    const gameState = createSingleplayerGameState();
    const saveId = "save-stale-materialized";
    const materialized = withPersistedSeasonDerivations(gameState, saveId);

    invalidateSeasonDerivationsCache(saveId);

    const staleSignature = "stale-signature";
    const fromPersisted = getSeasonDerivations({
      gameState: materialized,
      saveId,
      contentSignature: staleSignature,
    });
    const fresh = computeSeasonDerivationsFresh(gameState, gameState.season.id);

    expect(fromPersisted.ratingsById.size).toBe(fresh.ratingsById.size);
  });

  it("builds a persisted record with matching signature metadata", () => {
    const gameState = createSingleplayerGameState();
    const record = buildPersistedSeasonDerivationsRecord(gameState);

    expect(record.seasonId).toBe(gameState.season.id);
    expect(record.contentSignature).toBe(buildGameStateContentSignature(gameState));
    expect(Object.keys(record.ratingsByPlayerId).length).toBeGreaterThan(0);
    expect(record.marketValueByPlayerId && Object.keys(record.marketValueByPlayerId).length).toBeGreaterThan(0);
    expect(record.marketValuePlayerSignature).toBeTruthy();
  });
});
