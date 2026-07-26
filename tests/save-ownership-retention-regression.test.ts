import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DEFAULT_ACTIVE_OWNER_ID, FRANKY_OWNER_ID } from "@/lib/foundation/team-control-settings";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { enforceRollingSaveRetention } from "@/lib/persistence/save-repository";
import { buildScenarioMeta } from "@/lib/persistence/scenario-meta";
import { getDatabase, resetDatabaseForTests } from "@/lib/persistence/sqlite";
import { registerLiveRoomSaveId } from "@/lib/room/live-room-save-registry";

beforeEach(() => {
  resetDatabaseForTests();
});

afterEach(() => {
  resetDatabaseForTests();
  // The live-room registry is process-global (see live-room-save-registry.ts), not reset by
  // resetDatabaseForTests() — clear anything a test registered so it can't leak into the next one.
  registerLiveRoomSaveId("regression-test-room", null);
});

/**
 * BUG A regression coverage: lib/persistence/persistence-service.ts createSave/cloneSave/
 * createFreshSeasonOneSave/createScenarioSnapshot all end up calling
 * SaveRepository.setActiveSave() internally. Without threading the acting user's ownerId
 * through, that call hits the GLOBAL branch (blanket-archive every other active save + repoint
 * every owner's active_saves pointer + run rolling retention right after) even though the
 * request was scoped to a single user. These tests exercise the persistence-service surface
 * exactly like the API routes do (app/api/singleplayer-state/route.ts, app/api/new-game/route.ts)
 * to prove that acting as Franky can never touch Chris's active save.
 */
describe("BUG A regression: creating/cloning/snapshotting a save must not steal or archive another owner's active save", () => {
  it(
    "Franky creating a save leaves Chris's active-save pointer and Chris's save completely untouched",
    () => {
      const persistence = createPersistenceService();

      const chrisSave = persistence.createSave("Chris Save", DEFAULT_ACTIVE_OWNER_ID);
      expect(persistence.getActiveSave(DEFAULT_ACTIVE_OWNER_ID)?.saveId).toBe(chrisSave.saveId);

      const frankySave = persistence.createSave("Franky Save", FRANKY_OWNER_ID);

      // Franky's new save became active FOR FRANKY only.
      expect(persistence.getActiveSave(FRANKY_OWNER_ID)?.saveId).toBe(frankySave.saveId);

      // Chris's pointer must still resolve to his own save, and that save must still be "active"
      // (not archived by Franky's creation hitting the global blanket-archive branch).
      expect(persistence.getActiveSave(DEFAULT_ACTIVE_OWNER_ID)?.saveId).toBe(chrisSave.saveId);
      expect(persistence.getSaveById(chrisSave.saveId)?.status).toBe("active");
    },
    30_000,
  );

  it(
    "Franky cloning a save leaves Chris's active save untouched",
    () => {
      const persistence = createPersistenceService();

      const chrisSave = persistence.createSave("Chris Save", DEFAULT_ACTIVE_OWNER_ID);
      const frankyClone = persistence.cloneSave(chrisSave.saveId, "Franky Clone", FRANKY_OWNER_ID);

      expect(persistence.getActiveSave(FRANKY_OWNER_ID)?.saveId).toBe(frankyClone.saveId);
      expect(persistence.getActiveSave(DEFAULT_ACTIVE_OWNER_ID)?.saveId).toBe(chrisSave.saveId);
      expect(persistence.getSaveById(chrisSave.saveId)?.status).toBe("active");
    },
    30_000,
  );

  it(
    "Franky starting a fresh Season 1 leaves Chris's active save untouched",
    () => {
      const persistence = createPersistenceService();

      const chrisSave = persistence.createSave("Chris Save", DEFAULT_ACTIVE_OWNER_ID);
      const frankyFresh = persistence.createFreshSeasonOneSave({
        name: "Franky Fresh Season 1",
        ownerId: FRANKY_OWNER_ID,
      });

      expect(persistence.getActiveSave(FRANKY_OWNER_ID)?.saveId).toBe(frankyFresh.saveId);
      expect(persistence.getActiveSave(DEFAULT_ACTIVE_OWNER_ID)?.saveId).toBe(chrisSave.saveId);
      expect(persistence.getSaveById(chrisSave.saveId)?.status).toBe("active");
    },
    30_000,
  );

  it(
    "Franky creating a scenario snapshot leaves Chris's active save untouched",
    () => {
      const persistence = createPersistenceService();

      const chrisSave = persistence.createSave("Chris Save", DEFAULT_ACTIVE_OWNER_ID);
      const scenarioMeta = buildScenarioMeta({
        gameState: chrisSave.gameState,
        label: "Franky Snapshot",
        sourceSaveId: chrisSave.saveId,
        isStableTestPoint: true,
      });
      const frankySnapshot = persistence.createScenarioSnapshot({
        sourceSaveId: chrisSave.saveId,
        name: "Franky Snapshot",
        scenarioMeta,
        ownerId: FRANKY_OWNER_ID,
      });

      expect(persistence.getActiveSave(FRANKY_OWNER_ID)?.saveId).toBe(frankySnapshot.saveId);
      expect(persistence.getActiveSave(DEFAULT_ACTIVE_OWNER_ID)?.saveId).toBe(chrisSave.saveId);
      expect(persistence.getSaveById(chrisSave.saveId)?.status).toBe("active");
    },
    30_000,
  );
});

function insertRetentionSave(input: {
  saveId: string;
  index: number;
  status?: "active" | "archived" | "template";
}) {
  const database = getDatabase();
  const timestamp = new Date(Date.UTC(2026, 0, 1, 0, input.index)).toISOString();
  database
    .prepare(
      `INSERT INTO saves (save_id, name, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(input.saveId, input.saveId, input.status ?? "archived", timestamp, timestamp);
  database
    .prepare("INSERT INTO game_metadata (save_id, payload_json) VALUES (?, ?)")
    .run(
      input.saveId,
      JSON.stringify({ scenarioMeta: { scenarioType: "new_game", label: input.saveId, createdAt: timestamp } }),
    );
}

function listRemainingSaveIds() {
  return (getDatabase().prepare("SELECT save_id FROM saves ORDER BY save_id ASC").all() as Array<{ save_id: string }>).map(
    (row) => row.save_id,
  );
}

/**
 * BUG B regression coverage: enforceRollingSaveRetention (lib/persistence/save-retention.ts) used
 * to only protect the explicit `protectedSaveIds` list passed by its caller (almost always just
 * `[justWrittenSaveId]`, see save-repository.ts). A save that is demoted but still in active use —
 * another owner's active_saves pointer target, or a live co-op/room save (created "archived" on
 * purpose, see createRoomCoopSave) — was NOT in that list and could be swept out of the rolling
 * 5-save-per-bucket limit by writes that have nothing to do with it.
 */
describe("BUG B regression: rolling save retention must never delete a save that is still live", () => {
  it(
    "protects a save pointed to by another owner's active_saves pointer even though it is not status='active' and not explicitly protected",
    () => {
      for (let index = 0; index < 7; index += 1) {
        insertRetentionSave({ saveId: `single-${index}`, index, status: index === 0 ? "active" : "archived" });
      }

      // Franky's active_saves pointer references single-1 -- an archived, non-recent row that the
      // naive top-5-by-recency sweep (single-0,3,4,5,6) would otherwise delete.
      getDatabase()
        .prepare("INSERT INTO active_saves (owner_id, save_id, updated_at) VALUES (?, ?, ?)")
        .run(FRANKY_OWNER_ID, "single-1", new Date().toISOString());

      enforceRollingSaveRetention(getDatabase());

      expect(listRemainingSaveIds()).toContain("single-1");
    },
    30_000,
  );

  it(
    "protects a live co-op/room save across repeated solo autosaves that would otherwise rotate it out",
    () => {
      // A live co-op room's save is created "archived" on purpose (getActiveSave() must never
      // resolve it) but must still survive while the room is using it.
      insertRetentionSave({ saveId: "coop-live-save", index: 0, status: "archived" });
      registerLiveRoomSaveId("regression-test-room", "coop-live-save");

      // Simulate repeated solo autosaves in the same retention bucket: every real write calls
      // enforceRollingSaveRetention(database, [justWrittenSaveId]) — protecting ONLY the save
      // being written, exactly like lib/persistence/save-repository.ts createPersistedSaveRecord.
      for (let index = 1; index <= 8; index += 1) {
        const saveId = `solo-autosave-${index}`;
        insertRetentionSave({ saveId, index });
        enforceRollingSaveRetention(getDatabase(), [saveId]);
      }

      expect(listRemainingSaveIds()).toContain("coop-live-save");
    },
    30_000,
  );
});
