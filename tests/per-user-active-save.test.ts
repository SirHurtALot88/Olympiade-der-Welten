import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { loadSeedData } from "@/lib/data/dataAdapter";
import { DEFAULT_ACTIVE_OWNER_ID, FRANKY_OWNER_ID } from "@/lib/foundation/team-control-settings";
import { createSaveRepository } from "@/lib/persistence/save-repository";
import { closeDatabaseForMaintenance, getDatabase, resetDatabaseForTests } from "@/lib/persistence/sqlite";

beforeEach(() => {
  resetDatabaseForTests();
});

afterEach(() => {
  resetDatabaseForTests();
});

/**
 * Creates a real, fully-materializable save (with all child payloads) so getActiveSave — which
 * rebuilds the full game state from child tables — can resolve it. Created "archived" so it does
 * not implicitly become the global active save.
 */
function createRealSave(repository: ReturnType<typeof createSaveRepository>, saveId: string) {
  return repository.createSaveFromSeed({
    saveId,
    name: saveId,
    status: "archived",
    seedData: loadSeedData(),
  });
}

function readActivePointer(ownerId: string): string | null {
  const row = getDatabase()
    .prepare("SELECT save_id FROM active_saves WHERE owner_id = ?")
    .get(ownerId) as { save_id: string } | undefined;
  return row?.save_id ?? null;
}

function readStatus(saveId: string): string | null {
  const row = getDatabase()
    .prepare("SELECT status FROM saves WHERE save_id = ?")
    .get(saveId) as { status: string } | undefined;
  return row?.status ?? null;
}

describe("per-user active-save scoping", () => {
  it(
    "keeps each owner's active save independent (activating Franky's save does not touch Chris's)",
    () => {
      const repository = createSaveRepository();
      createRealSave(repository, "save-chris");
      createRealSave(repository, "save-franky");

      repository.setActiveSave("save-chris", DEFAULT_ACTIVE_OWNER_ID);
      repository.setActiveSave("save-franky", FRANKY_OWNER_ID);

      // Each owner resolves to their own save.
      expect(repository.getActiveSave(DEFAULT_ACTIVE_OWNER_ID)?.saveId).toBe("save-chris");
      expect(repository.getActiveSave(FRANKY_OWNER_ID)?.saveId).toBe("save-franky");

      // Franky activating his save must NOT have archived Chris's save nor moved Chris's pointer.
      expect(readActivePointer(DEFAULT_ACTIVE_OWNER_ID)).toBe("save-chris");
      expect(readActivePointer(FRANKY_OWNER_ID)).toBe("save-franky");
      expect(readStatus("save-chris")).toBe("active");
      expect(readStatus("save-franky")).toBe("active");

      // Now Chris switches saves — Franky's pointer/save stay untouched.
      createRealSave(repository, "save-chris-2");
      repository.setActiveSave("save-chris-2", DEFAULT_ACTIVE_OWNER_ID);
      expect(repository.getActiveSave(DEFAULT_ACTIVE_OWNER_ID)?.saveId).toBe("save-chris-2");
      expect(repository.getActiveSave(FRANKY_OWNER_ID)?.saveId).toBe("save-franky");
      expect(readStatus("save-franky")).toBe("active");
    },
    30_000,
  );

  it(
    "auth-off (no ownerId) keeps the single global active save and blanket-archives on activate",
    () => {
      const repository = createSaveRepository();
      createRealSave(repository, "save-a");
      createRealSave(repository, "save-b");

      // Activate save-a globally (no ownerId) -> it becomes the single global active save.
      repository.setActiveSave("save-a");
      expect(repository.getActiveSave()?.saveId).toBe("save-a");
      expect(readStatus("save-a")).toBe("active");
      expect(readStatus("save-b")).toBe("archived");

      // Activating save-b globally blanket-archives every other active save.
      repository.setActiveSave("save-b");
      expect(readStatus("save-a")).toBe("archived");
      expect(readStatus("save-b")).toBe("active");
      expect(repository.getActiveSave()?.saveId).toBe("save-b");
    },
    30_000,
  );

  it(
    "owner with no pointer falls back to the global active save",
    () => {
      const repository = createSaveRepository();
      createRealSave(repository, "save-global");
      repository.setActiveSave("save-global"); // global activate, no pointer for Franky

      // Franky has no pointer yet -> graceful fallback to the global active save.
      expect(repository.getActiveSave(FRANKY_OWNER_ID)?.saveId).toBe("save-global");
    },
    30_000,
  );

  it(
    "creating a new game (global activate) does not leave the old save active via a stale pointer",
    () => {
      const repository = createSaveRepository();
      createRealSave(repository, "save-old");
      createRealSave(repository, "save-new");

      // Boot state: the old save is the global active one and DEFAULT owner points at it
      // (exactly what backfillDefaultActiveSavePointer seeds).
      repository.setActiveSave("save-old", DEFAULT_ACTIVE_OWNER_ID);
      expect(repository.getActiveSave(DEFAULT_ACTIVE_OWNER_ID)?.saveId).toBe("save-old");

      // "New game" in the solo/auth-off flow: a global activate (no ownerId) of the new save.
      repository.setActiveSave("save-new");

      // The old save must NOT resurface via the stale DEFAULT pointer.
      expect(readStatus("save-old")).toBe("archived");
      expect(readStatus("save-new")).toBe("active");
      expect(repository.getActiveSave(DEFAULT_ACTIVE_OWNER_ID)?.saveId).toBe("save-new");
      expect(repository.getActiveSave()?.saveId).toBe("save-new");
      // Pointer was repointed to the freshly activated save.
      expect(readActivePointer(DEFAULT_ACTIVE_OWNER_ID)).toBe("save-new");
    },
    30_000,
  );

  it(
    "owner pointer to a deleted save falls back to the global active save",
    () => {
      const repository = createSaveRepository();
      createRealSave(repository, "save-global");
      repository.setActiveSave("save-global");
      // Point Franky at a non-existent save.
      getDatabase()
        .prepare("INSERT INTO active_saves (owner_id, save_id, updated_at) VALUES (?, ?, ?)")
        .run(FRANKY_OWNER_ID, "save-gone", new Date().toISOString());

      expect(repository.getActiveSave(FRANKY_OWNER_ID)?.saveId).toBe("save-global");
    },
    30_000,
  );

  it(
    "migration backfills the existing global active save to DEFAULT_ACTIVE_OWNER_ID on reboot",
    () => {
      // Simulate a pre-migration DB: a global active save exists but no pointer row.
      const repository = createSaveRepository();
      createRealSave(repository, "save-existing-active");
      repository.setActiveSave("save-existing-active"); // global active, no pointer
      getDatabase().prepare("DELETE FROM active_saves").run();
      expect(readActivePointer(DEFAULT_ACTIVE_OWNER_ID)).toBeNull();

      // Reboot: closing + re-opening re-runs runMigrations() (and its idempotent backfill) against
      // the same file, exactly as a server restart would.
      closeDatabaseForMaintenance();
      getDatabase();

      expect(readActivePointer(DEFAULT_ACTIVE_OWNER_ID)).toBe("save-existing-active");
    },
    30_000,
  );

  it(
    "backfill is idempotent and never overwrites an owner's existing pointer on reboot",
    () => {
      const repository = createSaveRepository();
      createRealSave(repository, "save-chris-current");
      createRealSave(repository, "save-chris-older");

      // Chris deliberately points at save-chris-older.
      repository.setActiveSave("save-chris-older", DEFAULT_ACTIVE_OWNER_ID);
      // Make save-chris-current the newest global active row so a naive backfill would prefer it.
      getDatabase()
        .prepare("UPDATE saves SET status = 'active', updated_at = ? WHERE save_id = ?")
        .run(new Date(Date.UTC(2027, 0, 1)).toISOString(), "save-chris-current");

      closeDatabaseForMaintenance();
      getDatabase();

      // Reboot must NOT clobber Chris's chosen pointer.
      expect(readActivePointer(DEFAULT_ACTIVE_OWNER_ID)).toBe("save-chris-older");
    },
    30_000,
  );
});
