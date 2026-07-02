import { beforeEach, describe, expect, it } from "vitest";

import { withPersistedSeasonDerivations } from "@/lib/foundation/materialize-season-derivations";
import { buildGameStateContentSignature } from "@/lib/foundation/season-derivations-signature";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { resetDatabaseForTests } from "@/lib/persistence/sqlite";
import { clearSeasonDerivationsSidecarsForTests } from "@/lib/persistence/season-derivations-sidecar";

describe("player directory slice api", () => {
  beforeEach(() => {
    resetDatabaseForTests();
    clearSeasonDerivationsSidecarsForTests();
  });

  it(
    "uses projection path when content signature matches",
    async () => {
    const persistence = createPersistenceService();
    const created = persistence.createSave("save-directory-projection");
    const gameState = withPersistedSeasonDerivations(createSingleplayerGameState());
    persistence.saveSingleplayerState(created.saveId, gameState);
    const contentSignature = buildGameStateContentSignature(gameState);

    const { GET } = await import("@/app/api/season/player-directory-slice/route");
    const response = await GET(
      new Request(
        `http://localhost/api/season/player-directory-slice?saveId=${created.saveId}&contentSignature=${encodeURIComponent(contentSignature)}`,
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.warnings).toContain("projection_read");
    expect(payload.count).toBeGreaterThan(0);
    },
    60_000,
  );
});
