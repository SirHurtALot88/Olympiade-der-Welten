import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { loadSeedData } from "@/lib/data/dataAdapter";
import { DEFAULT_ACTIVE_OWNER_ID, FRANKY_OWNER_ID } from "@/lib/foundation/team-control-settings";
import { createSaveRepository } from "@/lib/persistence/save-repository";
import { getDatabase, resetDatabaseForTests } from "@/lib/persistence/sqlite";

// Audit S5: GET /api/singleplayer-state resolves `ownerId` via `resolveSessionOwnerId()` (auth-on
// only). Mocking it here lets us drive the route as "Franky" without standing up a real
// next/headers cookie session.
const resolveSessionOwnerId = vi.fn(async (): Promise<string | null> => null);

vi.mock("@/lib/auth/session", () => ({
  resolveSessionOwnerId,
}));

let GET: typeof import("@/app/api/singleplayer-state/route").GET;

beforeAll(async () => {
  ({ GET } = await import("@/app/api/singleplayer-state/route"));
}, 30000);

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

async function getSingleplayerState() {
  return GET(new Request("http://localhost/api/singleplayer-state"));
}

describe("GET /api/singleplayer-state — read side effects (audit S5)", () => {
  beforeEach(() => {
    resetDatabaseForTests();
    resolveSessionOwnerId.mockReset();
  });

  afterEach(() => {
    resetDatabaseForTests();
  });

  it(
    // Before the fix, a GET with no explicit saveId and no active save for the requesting owner
    // fell back to "the most recently updated save in the whole DB" (easily the OTHER player's)
    // and called `activateSave` on it — silently creating an active_saves pointer for the reading
    // owner onto the other player's save and flipping that save's status. A plain page load must
    // never do this.
    "loading as Franky (no save of his own) leaves Chris's save status and active_saves pointer completely unchanged",
    async () => {
      const repository = createSaveRepository();
      createRealSave(repository, "save-chris");
      repository.setActiveSave("save-chris", DEFAULT_ACTIVE_OWNER_ID);

      const before = snapshotDb();
      expect(before.activeSaves).toEqual([{ owner_id: DEFAULT_ACTIVE_OWNER_ID, save_id: "save-chris" }]);

      resolveSessionOwnerId.mockResolvedValue(FRANKY_OWNER_ID);
      const response = await getSingleplayerState();
      await response.json();

      const after = snapshotDb();
      expect(after.activeSaves).toEqual(before.activeSaves);
      expect(after.saves).toEqual(before.saves);
    },
    30_000,
  );

  it(
    "a read with no resolvable save creates nothing and archives nothing, and answers with save: null",
    async () => {
      const repository = createSaveRepository();
      // A save exists, but nobody has ever activated it -> no global active row, no per-owner
      // pointer for Franky.
      createRealSave(repository, "save-untouched");

      const before = snapshotDb();

      resolveSessionOwnerId.mockResolvedValue(FRANKY_OWNER_ID);
      const response = await getSingleplayerState();
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.save).toBeNull();

      const after = snapshotDb();
      expect(after).toEqual(before);
    },
    30_000,
  );

  it(
    "solo/auth-off read (resolveSessionOwnerId resolves null) still opens into the current active save",
    async () => {
      const repository = createSaveRepository();
      createRealSave(repository, "save-solo");
      repository.setActiveSave("save-solo");

      resolveSessionOwnerId.mockResolvedValue(null);
      const response = await getSingleplayerState();
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.save?.saveId).toBe("save-solo");
    },
    30_000,
  );
});
