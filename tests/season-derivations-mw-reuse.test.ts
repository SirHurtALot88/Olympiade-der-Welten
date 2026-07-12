import { describe, expect, it } from "vitest";

import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { buildPersistedSeasonDerivationsRecord } from "@/lib/foundation/materialize-season-derivations";

/**
 * buildPersistedSeasonDerivationsRecord soll die teure ligaweite MW-Map
 * wiederverwenden, wenn die MW-Signatur (disciplineRatings) unveraendert ist —
 * das Ergebnis muss identisch zum Neuberechnen sein (reine Perf-Optimierung).
 */
describe("season derivations MW-map reuse", () => {
  it("reuses the cached market-value map when the player signature is unchanged, byte-identical", () => {
    const persistence = createPersistenceService();
    const gameState = persistence.createFreshSeasonOneSave({ activate: true }).gameState;

    // Matchday 1: kein persistierter Record → volle Berechnung.
    const first = buildPersistedSeasonDerivationsRecord(gameState);
    expect(first.marketValueByPlayerId).toBeDefined();

    // Matchday 2..10: Record liegt vor, Signatur unveraendert → Reuse.
    const withRecord = {
      ...gameState,
      seasonState: { ...gameState.seasonState, persistedSeasonDerivations: first },
    };
    const reused = buildPersistedSeasonDerivationsRecord(withRecord);

    expect(reused.marketValuePlayerSignature).toBe(first.marketValuePlayerSignature);
    expect(reused.marketValueByPlayerId).toEqual(first.marketValueByPlayerId);
    // Reuse gibt exakt die gepufferte Referenz zurueck (kein Neuaufbau).
    expect(reused.marketValueByPlayerId).toBe(first.marketValueByPlayerId);
  }, 60000);

  it("recomputes the market-value map when the player signature changes", () => {
    const persistence = createPersistenceService();
    const gameState = persistence.createFreshSeasonOneSave({ activate: true }).gameState;
    const first = buildPersistedSeasonDerivationsRecord(gameState);

    // Signatur kuenstlich invalidieren → darf NICHT die alte Map wiederverwenden.
    const stale = {
      ...gameState,
      seasonState: {
        ...gameState.seasonState,
        persistedSeasonDerivations: { ...first, marketValuePlayerSignature: "stale-signature" },
      },
    };
    const recomputed = buildPersistedSeasonDerivationsRecord(stale);
    expect(recomputed.marketValuePlayerSignature).toBe(first.marketValuePlayerSignature);
    expect(recomputed.marketValueByPlayerId).toEqual(first.marketValueByPlayerId);
    expect(recomputed.marketValueByPlayerId).not.toBe(first.marketValueByPlayerId);
  }, 60000);
});
