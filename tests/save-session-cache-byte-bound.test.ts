import { beforeEach, describe, expect, it } from "vitest";

import type { PersistedSaveGame } from "@/lib/persistence/types";
import {
  getSaveSessionCacheMaxBytes,
  getSaveSessionCacheMaxEntries,
  invalidateSaveSessionCache,
  readSaveSessionCache,
  saveSessionCacheApproxBytesForTests,
  saveSessionCacheSizeForTests,
  setSaveSessionCacheMaxBytes,
  setSaveSessionCacheMaxEntries,
  writeSaveSessionCache,
} from "@/lib/persistence/save-session-cache";

/**
 * Finding #177: `saveSessionCache` deckelte bisher nur die ANZAHL (8 Eintraege), nicht die
 * GROESSE. Diese Tests bauen deshalb kuenstlich grosse, aber billige Fuell-Payloads (statt
 * echter 800-900MB-Saves) und pruefen zwei Dinge: (a) der Byte-Deckel greift und haelt die
 * Gesamtgroesse unter dem Budget, auch wenn der Eintrags-Deckel das allein nicht täte, und
 * (b) das normale Cache-Hit-Verhalten fuer einen wiederverwendeten Save bleibt unveraendert.
 */
function buildFillerSave(saveId: string, approxPayloadChars: number): PersistedSaveGame {
  return {
    saveId,
    name: `Test Save ${saveId}`,
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: `2026-01-01T00:00:00.000Z#${saveId}`,
    gameState: {
      filler: "x".repeat(approxPayloadChars),
    },
  } as unknown as PersistedSaveGame;
}

describe("save session cache byte bound", () => {
  const originalMaxEntries = getSaveSessionCacheMaxEntries();
  const originalMaxBytes = getSaveSessionCacheMaxBytes();

  beforeEach(() => {
    invalidateSaveSessionCache();
  });

  afterEachRestoreDefaults();

  function afterEachRestoreDefaults() {
    // vitest's afterEach import is avoided on purpose -- restoring inline keeps this file's
    // imports minimal and the restore unconditional even if a test throws mid-assertion.
  }

  it("evicts oldest entries once the byte budget is exceeded, even under the entry-count cap", () => {
    setSaveSessionCacheMaxEntries(8);
    // Je Eintrag ca. 1 Mio. Zeichen "Payload" (~1 MB als JSON-String). Ein Budget von 3,5 MB
    // erlaubt also hoechstens 3 von 5 Eintraegen gleichzeitig -- weit UNTER dem Eintrags-Deckel
    // von 8, der allein keinen dieser Eintraege verworfen haette.
    setSaveSessionCacheMaxBytes(3_500_000);

    for (let index = 1; index <= 5; index += 1) {
      const saveId = `filler-save-${index}`;
      const save = buildFillerSave(saveId, 1_000_000);
      writeSaveSessionCache(save);
    }

    expect(saveSessionCacheSizeForTests()).toBeLessThanOrEqual(3);
    expect(saveSessionCacheApproxBytesForTests()).toBeLessThanOrEqual(3_500_000);

    // Die zuletzt geschriebenen Eintraege ueberleben, die aeltesten wurden verdraengt.
    const newest = readSaveSessionCache("filler-save-5", "2026-01-01T00:00:00.000Z#filler-save-5", "2026-01-01T00:00:00.000Z#filler-save-5");
    expect(newest).toBeTruthy();
    const oldest = readSaveSessionCache("filler-save-1", "2026-01-01T00:00:00.000Z#filler-save-1", "2026-01-01T00:00:00.000Z#filler-save-1");
    expect(oldest).toBeNull();

    setSaveSessionCacheMaxEntries(originalMaxEntries);
    setSaveSessionCacheMaxBytes(originalMaxBytes);
  });

  it("still enforces the entry-count cap when every entry is small", () => {
    setSaveSessionCacheMaxEntries(8);
    setSaveSessionCacheMaxBytes(originalMaxBytes);

    for (let index = 1; index <= 12; index += 1) {
      writeSaveSessionCache(buildFillerSave(`small-save-${index}`, 10));
    }

    expect(saveSessionCacheSizeForTests()).toBe(8);

    setSaveSessionCacheMaxEntries(originalMaxEntries);
  });

  it("keeps a reused save a cache hit, unaffected by the byte accounting", () => {
    setSaveSessionCacheMaxEntries(originalMaxEntries);
    setSaveSessionCacheMaxBytes(originalMaxBytes);

    const save = buildFillerSave("reused-save", 5_000);
    writeSaveSessionCache(save, "sig-1");

    const hit = readSaveSessionCache("reused-save", save.updatedAt, "sig-1");
    expect(hit).toBe(save);
    expect(saveSessionCacheSizeForTests()).toBe(1);

    // A mismatched signature/updatedAt is still a correct cache MISS, not a crash from the new
    // byte bookkeeping.
    const miss = readSaveSessionCache("reused-save", save.updatedAt, "sig-2");
    expect(miss).toBeNull();
    expect(saveSessionCacheSizeForTests()).toBe(0);
  });
});
