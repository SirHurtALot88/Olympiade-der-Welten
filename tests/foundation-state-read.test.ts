import { describe, expect, it } from "vitest";

import { loadFoundationInitialPersistenceState } from "@/lib/persistence/foundation-state-read";

describe("loadFoundationInitialPersistenceState", () => {
  it(
    "returns a compact sqlite bootstrap payload with real season data",
    () => {
      const payload = loadFoundationInitialPersistenceState();
      expect(payload).not.toBeNull();
      expect(payload?.save.saveId).toBeTruthy();
      expect(payload?.save.gameState.season.id).not.toBe("loading");
      expect(payload?.save.gameState.players.length).toBeGreaterThan(0);
      expect(payload?._meta.source).toBe("sqlite");
      expect(payload?.save.gameState.seasonState.seasonSnapshots).toBeUndefined();
    },
    20_000,
  );
});
