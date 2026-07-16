import { describe, expect, it } from "vitest";

import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import { withPersistedSeasonDerivations } from "@/lib/foundation/materialize-season-derivations";
import { recomputeSeasonDerivationsForPlayerIds } from "@/lib/foundation/incremental-season-derivations";
import { buildGameStateContentSignature } from "@/lib/foundation/season-derivations-signature";

describe("incremental season derivations", () => {
  it(
    "updates persisted block for affected player ids after roster change",
    () => {
    const base = withPersistedSeasonDerivations(createSingleplayerGameState());
    const playerId = base.players[0]?.id;
    expect(playerId).toBeTruthy();

    const mutated = recomputeSeasonDerivationsForPlayerIds(
      {
        ...base,
        players: base.players.map((player) =>
          player.id === playerId ? { ...player, rating: (player.rating ?? 50) + 1 } : player,
        ),
      },
      [playerId!],
    );

    const persisted = mutated.seasonState.persistedSeasonDerivations as {
      contentSignature: string;
      ratingsByPlayerId: Record<string, unknown>;
    };
    expect(persisted.contentSignature).toBe(buildGameStateContentSignature(mutated));
    expect(Object.keys(persisted.ratingsByPlayerId).length).toBeGreaterThan(0);
  },
  60_000,
  );
});
