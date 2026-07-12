import { describe, expect, it } from "vitest";

import { createCaptureBatchPersistence } from "@/lib/persistence/capture-batch-persistence";
import type { GameState } from "@/lib/data/olyDataTypes";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";

/**
 * Verifiziert den Matchday-Save-Batching-Wrapper: read-after-write aus dem
 * Puffer, ein Flush schreibt genau einmal, und der Endzustand ist identisch
 * zu N direkten Voll-Writes — nur eben mit einem statt N Disk-Writes.
 */

function gs(marker: number): GameState {
  return { marker } as unknown as GameState;
}

function makeSave(saveId: string, gameState: GameState): PersistedSaveGame {
  return { saveId, status: "active", updatedAt: "seed", gameState } as unknown as PersistedSaveGame;
}

/** Minimaler In-Memory-Delegate, der echte Disk-Writes zaehlt. */
function makeFakeDelegate(initial: PersistedSaveGame) {
  let store = initial;
  const writes: GameState[] = [];
  const delegate: PersistenceService = {
    bootstrapSingleplayerSave: () => ({ save: store, createdFromSeed: false }),
    getActiveSave: () => store,
    getSaveById: (id) => (id === store.saveId ? store : null),
    getSaveVersionMetadata: () => null,
    saveSingleplayerState: (id, gameState, options) => {
      writes.push(gameState);
      store = { ...store, saveId: id, gameState, updatedAt: `w${writes.length}`, status: options?.status ?? store.status };
      return store;
    },
    createSave: () => store,
    createFreshSeasonOneSave: () => store,
    cloneSave: () => store,
    createScenarioSnapshot: () => store,
    activateSave: () => store,
    listSaves: () => [],
  };
  return { delegate, writes: () => writes, current: () => store };
}

describe("createCaptureBatchPersistence", () => {
  it("serves read-after-write from the buffer and flushes exactly once", () => {
    const fake = makeFakeDelegate(makeSave("s1", gs(0)));
    const capture = createCaptureBatchPersistence({ delegate: fake.delegate, saveId: "s1" });

    capture.persistence.saveSingleplayerState("s1", gs(1));
    // Noch nichts auf Platte, aber der Lese-Pfad sieht den gepufferten Stand.
    expect(fake.writes()).toHaveLength(0);
    expect((capture.persistence.getSaveById("s1")?.gameState as unknown as { marker: number }).marker).toBe(1);
    expect((capture.persistence.getActiveSave()?.gameState as unknown as { marker: number }).marker).toBe(1);

    capture.persistence.saveSingleplayerState("s1", gs(2));
    expect(fake.writes()).toHaveLength(0);
    expect((capture.persistence.getSaveById("s1")?.gameState as unknown as { marker: number }).marker).toBe(2);
    expect(capture.bufferedWrites()).toBe(2);

    const flushed = capture.flush();
    expect(fake.writes()).toHaveLength(1); // genau EIN Disk-Write
    expect((fake.current().gameState as unknown as { marker: number }).marker).toBe(2);
    expect((flushed?.gameState as unknown as { marker: number }).marker).toBe(2);
    expect(capture.isDirty()).toBe(false);
  });

  it("produces the identical final state as N direct writes, with one disk write instead of N", () => {
    // Baseline: N direkte Voll-Writes.
    const direct = makeFakeDelegate(makeSave("s1", gs(0)));
    for (let step = 1; step <= 5; step += 1) {
      const prev = (direct.delegate.getSaveById("s1")?.gameState as unknown as { marker: number }).marker;
      direct.delegate.saveSingleplayerState("s1", gs(prev + step));
    }

    // Batched: dieselbe Kette ueber den Capture-Wrapper, ein Flush.
    const batched = makeFakeDelegate(makeSave("s1", gs(0)));
    const capture = createCaptureBatchPersistence({ delegate: batched.delegate, saveId: "s1" });
    for (let step = 1; step <= 5; step += 1) {
      const prev = (capture.persistence.getSaveById("s1")?.gameState as unknown as { marker: number }).marker;
      capture.persistence.saveSingleplayerState("s1", gs(prev + step));
    }
    capture.flush();

    // Identischer Endzustand …
    expect((batched.current().gameState as unknown as { marker: number }).marker).toBe(
      (direct.current().gameState as unknown as { marker: number }).marker,
    );
    // … aber 1 statt 5 Disk-Writes.
    expect(direct.writes()).toHaveLength(5);
    expect(batched.writes()).toHaveLength(1);
    expect(capture.diskWrites()).toBe(1);
  });

  it("flushes once per cycle to preserve resume granularity", () => {
    const fake = makeFakeDelegate(makeSave("s1", gs(0)));
    const capture = createCaptureBatchPersistence({ delegate: fake.delegate, saveId: "s1" });

    // Zwei "Matchdays" mit je mehreren gepufferten Writes, je ein Flush.
    capture.persistence.saveSingleplayerState("s1", gs(1));
    capture.persistence.saveSingleplayerState("s1", gs(2));
    capture.flush();
    capture.persistence.saveSingleplayerState("s1", gs(3));
    capture.persistence.saveSingleplayerState("s1", gs(4));
    capture.flush();

    expect(capture.diskWrites()).toBe(2); // ein Disk-Write pro Matchday, nicht pro Schritt
    expect(fake.writes().map((state) => (state as unknown as { marker: number }).marker)).toEqual([2, 4]);
  });

  it("passes writes to other save ids straight through to the delegate", () => {
    const fake = makeFakeDelegate(makeSave("s1", gs(0)));
    const capture = createCaptureBatchPersistence({ delegate: fake.delegate, saveId: "s1" });

    capture.persistence.saveSingleplayerState("other-save", gs(99));
    expect(fake.writes()).toHaveLength(1); // sofort durchgereicht, nicht gepuffert
    expect(capture.bufferedWrites()).toBe(0);
  });

  it("no-op flush when nothing was buffered", () => {
    const fake = makeFakeDelegate(makeSave("s1", gs(7)));
    const capture = createCaptureBatchPersistence({ delegate: fake.delegate, saveId: "s1" });
    const result = capture.flush();
    expect(fake.writes()).toHaveLength(0);
    expect(capture.diskWrites()).toBe(0);
    expect((result?.gameState as unknown as { marker: number }).marker).toBe(7);
  });
});
