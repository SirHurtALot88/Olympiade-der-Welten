import fs from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";

import { withPersistedSeasonDerivations } from "@/lib/foundation/materialize-season-derivations";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { readPersistedSeasonDerivationsProjection } from "@/lib/persistence/save-projection-read";
import { resetDatabaseForTests } from "@/lib/persistence/sqlite";
import {
  clearSeasonDerivationsSidecarsForTests,
  readSeasonDerivationsSidecar,
  seasonDerivationsSidecarPath,
} from "@/lib/persistence/season-derivations-sidecar";

describe("season derivations sidecar", () => {
  beforeEach(() => {
    resetDatabaseForTests();
    clearSeasonDerivationsSidecarsForTests();
  });

  it(
    "persists derivations next to sqlite and reads them via projection",
    () => {
    const persistence = createPersistenceService();
    const created = persistence.createSave("sidecar-test");
    const materialized = withPersistedSeasonDerivations(createSingleplayerGameState());
    persistence.saveSingleplayerState(created.saveId, materialized);

    const sidecar = readSeasonDerivationsSidecar(created.saveId);
    expect(sidecar).toBeTruthy();
    expect(fs.existsSync(seasonDerivationsSidecarPath(created.saveId))).toBe(true);

    const projection = readPersistedSeasonDerivationsProjection(
      created.saveId,
      sidecar?.contentSignature,
    );
    expect(projection?.signatureMatches).toBe(true);
    expect(Object.keys(projection?.persistedSeasonDerivations?.ratingsByPlayerId ?? {}).length).toBeGreaterThan(0);
    },
    60_000,
  );
});
