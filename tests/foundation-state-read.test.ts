import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { loadSeedData } from "@/lib/data/dataAdapter";
import { DEFAULT_ACTIVE_OWNER_ID, FRANKY_OWNER_ID } from "@/lib/foundation/team-control-settings";
import { loadFoundationInitialPersistenceState } from "@/lib/persistence/foundation-state-read";
import { createSaveRepository } from "@/lib/persistence/save-repository";
import { getDatabase, resetDatabaseForTests } from "@/lib/persistence/sqlite";

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

describe("loadFoundationInitialPersistenceState — read side effects (audit S5)", () => {
  beforeEach(() => {
    resetDatabaseForTests();
  });

  afterEach(() => {
    resetDatabaseForTests();
  });

  function createRealSave(repository: ReturnType<typeof createSaveRepository>, saveId: string) {
    return repository.createSaveFromSeed({
      saveId,
      name: saveId,
      status: "archived",
      seedData: loadSeedData(),
    });
  }

  function snapshotDb() {
    const database = getDatabase();
    return {
      saves: database.prepare("SELECT save_id, status FROM saves ORDER BY save_id").all(),
      activeSaves: database.prepare("SELECT owner_id, save_id FROM active_saves ORDER BY owner_id").all(),
    };
  }

  it(
    // This is the exact S5 hole: a plain /foundation page load (this loader) for an owner with no
    // save of their own used to fall back to "the most recently updated save in the whole DB" —
    // which could easily be the OTHER player's — and call `activateSave` on it. That silently
    // created an active_saves pointer for the reading owner onto someone else's save and flipped
    // that save's status, purely as a side effect of loading a page. It must now be a pure read.
    "loading the page as Franky never creates a pointer onto Chris's save or touches its status",
    () => {
      const repository = createSaveRepository();
      createRealSave(repository, "save-chris");
      repository.setActiveSave("save-chris", DEFAULT_ACTIVE_OWNER_ID);

      const before = snapshotDb();
      expect(before.activeSaves).toEqual([{ owner_id: DEFAULT_ACTIVE_OWNER_ID, save_id: "save-chris" }]);

      // Franky opens the page for the first time — no saveId, no active save of his own.
      loadFoundationInitialPersistenceState({ ownerId: FRANKY_OWNER_ID });

      const after = snapshotDb();
      // No new active_saves row was created for Franky, and Chris's save/pointer are untouched.
      expect(after.activeSaves).toEqual(before.activeSaves);
      expect(after.saves).toEqual(before.saves);
    },
    30_000,
  );

  it(
    "returns null (no save) instead of guessing when neither an explicit saveId nor an active save exists for this owner",
    () => {
      const repository = createSaveRepository();
      // A save exists, but it has never been activated by anyone — no global active row, no
      // per-owner pointer.
      createRealSave(repository, "save-untouched");

      const before = snapshotDb();

      const payload = loadFoundationInitialPersistenceState({ ownerId: FRANKY_OWNER_ID });

      expect(payload).toBeNull();
      const after = snapshotDb();
      expect(after).toEqual(before);
    },
    30_000,
  );

  it(
    "solo/auth-off read (no ownerId) still opens into the current global active save",
    () => {
      const repository = createSaveRepository();
      createRealSave(repository, "save-solo");
      repository.setActiveSave("save-solo");

      const payload = loadFoundationInitialPersistenceState();

      expect(payload?.save.saveId).toBe("save-solo");
    },
    30_000,
  );
});
