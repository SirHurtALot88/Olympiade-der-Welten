import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { loadSeedData } from "@/lib/data/dataAdapter";
import { DEFAULT_ACTIVE_OWNER_ID, FRANKY_OWNER_ID } from "@/lib/foundation/team-control-settings";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import {
  requireLocalPersistedSave,
  resolveLocalPersistedSave,
  SaveResolutionError,
} from "@/lib/persistence/resolve-local-save";
import { createSaveRepository } from "@/lib/persistence/save-repository";
import { getDatabase, resetDatabaseForTests } from "@/lib/persistence/sqlite";

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

describe("requireLocalPersistedSave (strict, write-path resolver — audit S4)", () => {
  it(
    "throws save_id_required and never touches persistence when saveId is missing/empty — even though a global active save exists",
    () => {
      const repository = createSaveRepository();
      createRealSave(repository, "save-active-fallback-target");
      repository.setActiveSave("save-active-fallback-target");

      const persistence = createPersistenceService();

      expect(() => requireLocalPersistedSave(persistence, undefined)).toThrow(SaveResolutionError);
      expect(() => requireLocalPersistedSave(persistence, "")).toThrow(SaveResolutionError);
      expect(() => requireLocalPersistedSave(persistence, "   ")).toThrow(SaveResolutionError);

      try {
        requireLocalPersistedSave(persistence, null);
        expect.unreachable("expected SaveResolutionError");
      } catch (error) {
        expect(error).toBeInstanceOf(SaveResolutionError);
        expect((error as SaveResolutionError).code).toBe("save_id_required");
        expect((error as SaveResolutionError).status).toBe(400);
      }
    },
    30_000,
  );

  it(
    "throws save_not_found for an unknown/stale saveId instead of silently redirecting to the active save",
    () => {
      const repository = createSaveRepository();
      createRealSave(repository, "save-active-fallback-target");
      repository.setActiveSave("save-active-fallback-target");

      const persistence = createPersistenceService();

      try {
        requireLocalPersistedSave(persistence, "save-does-not-exist");
        expect.unreachable("expected SaveResolutionError");
      } catch (error) {
        expect(error).toBeInstanceOf(SaveResolutionError);
        expect((error as SaveResolutionError).code).toBe("save_not_found");
        expect((error as SaveResolutionError).status).toBe(404);
      }
    },
    30_000,
  );

  it(
    "resolves exactly the requested save, never the active one, when the ids differ",
    () => {
      const repository = createSaveRepository();
      createRealSave(repository, "save-requested");
      createRealSave(repository, "save-globally-active");
      repository.setActiveSave("save-globally-active");

      const persistence = createPersistenceService();
      const { save } = requireLocalPersistedSave(persistence, "save-requested");

      expect(save.saveId).toBe("save-requested");
    },
    30_000,
  );
});

describe("resolveLocalPersistedSave (explicit opt-in read fallback, now per-owner — audit S4)", () => {
  it(
    "with ownerId, falls back to THAT owner's active save, not the other owner's",
    () => {
      const repository = createSaveRepository();
      createRealSave(repository, "save-chris");
      createRealSave(repository, "save-franky");
      repository.setActiveSave("save-chris", DEFAULT_ACTIVE_OWNER_ID);
      repository.setActiveSave("save-franky", FRANKY_OWNER_ID);

      const persistence = createPersistenceService();

      const chrisResolved = resolveLocalPersistedSave(persistence, null, DEFAULT_ACTIVE_OWNER_ID);
      expect(chrisResolved).not.toBeNull();
      expect(chrisResolved?.save.saveId).toBe("save-chris");

      const frankyResolved = resolveLocalPersistedSave(persistence, null, FRANKY_OWNER_ID);
      expect(frankyResolved).not.toBeNull();
      expect(frankyResolved?.save.saveId).toBe("save-franky");
    },
    30_000,
  );

  it(
    "omitting ownerId keeps the original single-global-active-save fallback behavior (auth off / solo)",
    () => {
      const repository = createSaveRepository();
      createRealSave(repository, "save-a");
      repository.setActiveSave("save-a");

      const persistence = createPersistenceService();
      const resolved = resolveLocalPersistedSave(persistence, null);
      expect(resolved).not.toBeNull();
      expect(resolved?.save.saveId).toBe("save-a");
    },
    30_000,
  );

  it(
    // Audit S5 regression: Franky has never activated a save of his own, so `getActiveSave`
    // gracefully falls through to the single globally-active save (Chris's) as a READ — that
    // read-only fallback is pre-existing, accepted behavior (see per-user-active-save.test.ts).
    // What must NOT happen (the actual S5 bug) is `resolveLocalPersistedSave` reaching for
    // `activateSave`/`bootstrapSingleplayerSave` to "fix" the situation: it must never insert an
    // active_saves pointer for Franky, and must never touch Chris's save status, purely because
    // Franky performed a read.
    "resolving for an owner with no active save of their own never inserts a pointer or touches the other owner's save status",
    () => {
      const repository = createSaveRepository();
      createRealSave(repository, "save-chris");
      repository.setActiveSave("save-chris", DEFAULT_ACTIVE_OWNER_ID);

      const database = getDatabase();
      const savesBefore = database.prepare("SELECT save_id, status FROM saves ORDER BY save_id").all();
      const activeSavesBefore = database.prepare("SELECT owner_id, save_id FROM active_saves ORDER BY owner_id").all();
      expect(activeSavesBefore).toEqual([{ owner_id: DEFAULT_ACTIVE_OWNER_ID, save_id: "save-chris" }]);

      const persistence = createPersistenceService();
      // Franky has never played -> no active_saves row for FRANKY_OWNER_ID. The read may still
      // resolve to Chris's save via the pre-existing global-fallback read path (no ownership claim
      // is made), but it must create/mutate nothing.
      resolveLocalPersistedSave(persistence, null, FRANKY_OWNER_ID);

      const savesAfter = database.prepare("SELECT save_id, status FROM saves ORDER BY save_id").all();
      const activeSavesAfter = database.prepare("SELECT owner_id, save_id FROM active_saves ORDER BY owner_id").all();
      expect(savesAfter).toEqual(savesBefore);
      // No new pointer for Franky was created by the read.
      expect(activeSavesAfter).toEqual(activeSavesBefore);

      // Chris's own read is completely unaffected.
      const chrisResolved = resolveLocalPersistedSave(persistence, null, DEFAULT_ACTIVE_OWNER_ID);
      expect(chrisResolved?.save.saveId).toBe("save-chris");
    },
    30_000,
  );

  it(
    // Audit S5 regression: a read with no resolvable save id at all (auth off / no active save
    // anywhere) must create nothing and archive nothing — it answers "no save" instead of
    // bootstrapping or guessing.
    "creates and archives nothing when no save can be resolved at all",
    () => {
      const database = getDatabase();
      const savesBefore = database.prepare("SELECT save_id, status FROM saves ORDER BY save_id").all();

      const persistence = createPersistenceService();
      const resolved = resolveLocalPersistedSave(persistence, null);
      expect(resolved).toBeNull();

      const savesAfter = database.prepare("SELECT save_id, status FROM saves ORDER BY save_id").all();
      expect(savesAfter).toEqual(savesBefore);
    },
    30_000,
  );
});
