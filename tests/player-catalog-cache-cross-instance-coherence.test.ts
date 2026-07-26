import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Bug S13: lib/persistence/save-repository.ts keeps a module-scope
 * `baselineSourcePlayersCache` for the player catalog. The socket server
 * (tsx modules) and the Next.js API route handlers (webpack bundle) each
 * load lib/persistence/save-repository.ts as an INDEPENDENT module
 * instance, so a plain `let cache | null` that is only cleared by an
 * explicit in-process call (as it used to be) can never be invalidated by a
 * catalog write that happens in the other instance -- or by a completely
 * separate process such as scripts/sync-catalog-player-to-db.ts.
 *
 * This test simulates that two-instance situation as faithfully as vitest
 * allows: `vi.resetModules()` forces a brand new evaluation of
 * lib/persistence/save-repository.ts (and everything it transitively
 * imports, including lib/persistence/sqlite.ts), which gives each
 * "instance" its own module-scope `baselineSourcePlayersCache` closure and
 * its own better-sqlite3 connection object -- exactly mirroring two separate
 * module graphs. Both connections point at the same on-disk sqlite file,
 * which is the one piece of state that is genuinely shared across the real
 * process boundary.
 *
 * The test exercises the read-only path (getSaveById -> materializePersisted
 * Save -> ensurePlayerBaselines), which backfills a missing baseline
 * attribute straight from `loadBaselineSourcePlayers()`. It deliberately
 * avoids the player-baseline write guard (a separate, unrelated safety
 * mechanism that rejects baseline drift on the *write* path): the missing
 * attribute is injected via a direct row write, not through saveGameState(),
 * so the guard never enters the picture and the assertion is squarely about
 * cache freshness. Instance A warms its cache, instance B performs a catalog
 * write (the equivalent of an import/resync happening in the other process),
 * and instance A must observe the fresh value on its very next read even
 * though it never received any explicit invalidation call from instance B.
 */

const previousSqlitePath = process.env.OLY_APP_SQLITE_PATH;
let tempDirectory = "";

beforeEach(() => {
  tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "oly-catalog-cache-coherence-test-"));
  process.env.OLY_APP_SQLITE_PATH = path.join(tempDirectory, "data", "oly-app.sqlite");
});

afterEach(async () => {
  vi.resetModules();
  const { resetDatabaseForTests } = await import("@/lib/persistence/sqlite");
  resetDatabaseForTests();
  process.env.OLY_APP_SQLITE_PATH = previousSqlitePath;
  if (tempDirectory && fs.existsSync(tempDirectory)) {
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
});

describe("player-catalog cache coherence across module instances (Bug S13)", () => {
  it("re-backfills a missing baseline attribute from the fresh catalog value after an out-of-process catalog write, with no explicit invalidation", async () => {
    vi.resetModules();
    const instanceA = await import("@/lib/persistence/save-repository");
    const { getDatabase: getDatabaseA } = await import("@/lib/persistence/sqlite");
    const { invalidateSaveSessionCache } = await import("@/lib/persistence/save-session-cache");
    const { createSingleplayerGameState } = await import("@/lib/game-state/singleplayer-state");

    const base = createSingleplayerGameState();
    const playerId = base.players[0]!.id;
    const catalogPlayer = base.players.find((player) => player.id === playerId)!;

    // First save: player baselines already come fully populated straight
    // from seed data at this point (createSingleplayerGameState computes
    // them eagerly), so this just gets a structurally complete save on disk
    // for materializePersistedSave() to have something real to load.
    const repositoryA = instanceA.createSaveRepository();
    repositoryA.saveGameState({ saveId: "save-a", gameState: base });

    // Force this save's persisted baseline for the target player to be
    // missing the "power" attribute, via a direct row write rather than
    // through saveGameState(). This is what triggers ensurePlayerBaselines()'s
    // catalog-sourced backfill on the next read, without involving the
    // (unrelated) player-baseline write guard at all.
    const database = getDatabaseA();
    const persistedBaselineRow = database
      .prepare("SELECT payload_json FROM player_baseline_catalog WHERE player_id = ?")
      .get(playerId) as { payload_json: string } | undefined;
    expect(persistedBaselineRow).toBeTruthy();
    const baselinePayload = JSON.parse(persistedBaselineRow!.payload_json) as { attributes: Record<string, number> };
    const originalPower = baselinePayload.attributes.power;
    expect(typeof originalPower).toBe("number");
    const { power: _omittedPower, ...attributesWithoutPower } = baselinePayload.attributes;
    const baselineWithMissingPower = { ...baselinePayload, attributes: attributesWithoutPower };

    database.prepare("DELETE FROM player_baselines WHERE save_id = ? AND player_id = ?").run("save-a", playerId);
    database
      .prepare("INSERT INTO player_baselines (save_id, player_id, payload_json) VALUES (?, ?, ?)")
      .run("save-a", playerId, JSON.stringify(baselineWithMissingPower));

    // Seed the player catalog with a known, controlled value now (after the
    // baseline attribute was stripped, so the upcoming backfill has a
    // deterministic source to draw from). This is instance A's first ever
    // call into loadBaselineSourcePlayers(), so it also warms its cache.
    const staleePower = 42;
    instanceA.upsertPlayerCatalogEntries([
      { ...catalogPlayer, attributeSheetStats: { ...catalogPlayer.attributeSheetStats, power: staleePower } },
    ]);

    invalidateSaveSessionCache("save-a");
    const firstRead = repositoryA.getSaveById("save-a")!;
    const firstBaseline = firstRead.gameState.playerBaselines?.find((entry) => entry.playerId === playerId);
    expect(firstBaseline?.attributes.power).toBe(staleePower);
    expect(firstBaseline?.attributes.power).not.toBe(originalPower);

    // Instance B: a SEPARATE module instance (own cache closure, own DB
    // connection to the same file) performing a catalog import/resync --
    // exactly what character-import-service.ts / sync-catalog-player-to-db.ts
    // do in a real process. It bumps player_catalog.updated_at as part of the
    // normal write path. Instance A is never told about this write.
    vi.resetModules();
    const instanceB = await import("@/lib/persistence/save-repository");
    const freshPower = 87;
    expect(freshPower).not.toBe(staleePower);
    instanceB.upsertPlayerCatalogEntries([
      { ...catalogPlayer, attributeSheetStats: { ...catalogPlayer.attributeSheetStats, power: freshPower } },
    ]);

    // Back on instance A (still the very same module instance/closure as
    // above -- resetModules() only affects *future* dynamic imports): the
    // persisted baseline row for save-a still has no "power" attribute (a
    // read never writes it back), so the next read must backfill it again
    // from instance A's view of the catalog. A cold reload is forced via
    // invalidateSaveSessionCache because that outer cache is keyed off the
    // save row's own updated_at, which player_catalog writes do not touch --
    // mirroring the existing save-repository-cold-load.test.ts pattern for
    // forcing a real re-materialization instead of a session hit.
    invalidateSaveSessionCache("save-a");
    const secondRead = repositoryA.getSaveById("save-a")!;
    const secondBaseline = secondRead.gameState.playerBaselines?.find((entry) => entry.playerId === playerId);

    expect(secondBaseline?.attributes.power).toBe(freshPower);
    expect(secondBaseline?.attributes.power).not.toBe(staleePower);
  }, 30_000);
});
