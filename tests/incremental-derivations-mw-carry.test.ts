import { describe, expect, it } from "vitest";

import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { buildPersistedSeasonDerivationsRecord } from "@/lib/foundation/materialize-season-derivations";
import { withIncrementalSeasonDerivationsAfterTransfer } from "@/lib/foundation/incremental-season-derivations";
import type { PersistedSeasonDerivationsRecord } from "@/lib/foundation/materialize-season-derivations";

/**
 * Ein Transfer (Buy/Sell) aendert keine disciplineRatings → die ligaweite
 * MW-Map ist unveraendert. withIncrementalSeasonDerivationsAfterTransfer muss
 * sie deshalb MITNEHMEN (statt zu verwerfen und beim naechsten Read voll neu
 * zu berechnen). Aendert sich die Signatur, darf sie NICHT mitgenommen werden.
 */
describe("incremental season derivations — MW-map carry-forward", () => {
  function seededGameState() {
    const persistence = createPersistenceService();
    const base = persistence.createFreshSeasonOneSave({ activate: true }).gameState;
    const record = buildPersistedSeasonDerivationsRecord(base);
    return {
      gameState: {
        ...base,
        seasonState: { ...base.seasonState, persistedSeasonDerivations: record },
      },
      record,
    };
  }

  it("carries the market-value map forward across a transfer (signature unchanged)", () => {
    const { gameState, record } = seededGameState();
    expect(record.marketValueByPlayerId).toBeDefined();

    const affected = gameState.players.slice(0, 2).map((player) => player.id);
    const after = withIncrementalSeasonDerivationsAfterTransfer(gameState, affected);
    const nextRecord = after.seasonState.persistedSeasonDerivations as PersistedSeasonDerivationsRecord;

    // MW-Map + Signatur unveraendert mitgenommen (kein Neuaufbau).
    expect(nextRecord.marketValuePlayerSignature).toBe(record.marketValuePlayerSignature);
    expect(nextRecord.marketValueByPlayerId).toEqual(record.marketValueByPlayerId);
  }, 60000);

  it("drops the market-value cache when the MW signature changed (forces recompute)", () => {
    const { gameState } = seededGameState();

    // disciplineRatings eines Spielers aendern → MW-Signatur aendert sich.
    const mutated = {
      ...gameState,
      players: gameState.players.map((player, idx) =>
        idx === 0
          ? { ...player, disciplineRatings: { ...(player.disciplineRatings ?? {}), __bench__: 99 } }
          : player,
      ),
    };
    const after = withIncrementalSeasonDerivationsAfterTransfer(mutated, [mutated.players[0].id]);
    const nextRecord = after.seasonState.persistedSeasonDerivations as PersistedSeasonDerivationsRecord;

    // Nicht mitgenommen → Cache leer → naechster Read rechnet neu.
    expect(nextRecord.marketValueByPlayerId).toBeUndefined();
  }, 60000);
});
