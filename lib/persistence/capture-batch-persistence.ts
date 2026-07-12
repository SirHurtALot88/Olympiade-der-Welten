import type { GameState } from "@/lib/data/olyDataTypes";
import type { PersistedSaveGame, PersistenceService, SaveStatus } from "@/lib/persistence/types";

/**
 * In-memory Write-Batching-Wrapper um einen echten `PersistenceService`.
 *
 * Motivation: mehrstufige Flows (z. B. die Matchday-Kette
 * Lineups → Result → Standings → Advance) schreiben den kompletten,
 * mit jeder Saison wachsenden Spielstand mehrfach hintereinander auf Platte
 * und lesen ihn zwischen den Schritten jeweils neu ein. Jeder
 * `saveSingleplayerState` re-serialisiert dabei den vollen State — bei N
 * Schritten also N teure Voll-Writes, obwohl nur der Endzustand zaehlt.
 *
 * Dieser Wrapper haelt die Writes fuer EINE Save-ID im Speicher und bedient
 * `getSaveById`/`getActiveSave`/`bootstrapSingleplayerSave` aus diesem
 * Snapshot — die gesamte Kette laeuft im RAM, `flush()` schreibt genau einmal.
 * Writes zu anderen Save-IDs und alle uebrigen Methoden gehen unveraendert
 * an den Delegate. Dasselbe bewaehrte Muster wie
 * `createProgressionCapturePersistence` / die Transfer-Pipeline, nur mit
 * explizitem, wiederholbarem Flush (z. B. einmal pro Matchday).
 */
export function createCaptureBatchPersistence(input: {
  delegate: PersistenceService;
  saveId: string;
  /** Optionaler Start-Snapshot; sonst wird er einmalig vom Delegate gelesen. */
  seed?: PersistedSaveGame | null;
}): {
  persistence: PersistenceService;
  /** Schreibt den gepufferten Stand einmal auf den Delegate (falls dirty) und gibt ihn zurueck. */
  flush: () => PersistedSaveGame | null;
  /** Anzahl der im Speicher gepufferten (nicht-geflushten) Writes seit dem letzten Flush. */
  bufferedWrites: () => number;
  /** Gesamtzahl echter Delegate-Writes (Flushes mit Inhalt). */
  diskWrites: () => number;
  isDirty: () => boolean;
} {
  let latest: PersistedSaveGame | null =
    input.seed ?? input.delegate.getSaveById(input.saveId) ?? null;
  let dirty = false;
  let buffered = 0;
  let disk = 0;

  const persistence: PersistenceService = {
    ...input.delegate,
    bootstrapSingleplayerSave() {
      if (latest) {
        return { save: latest, createdFromSeed: false };
      }
      return input.delegate.bootstrapSingleplayerSave();
    },
    getActiveSave() {
      return latest ?? input.delegate.getActiveSave();
    },
    getSaveById(saveId: string) {
      if (saveId === input.saveId && latest) {
        return latest;
      }
      return input.delegate.getSaveById(saveId);
    },
    saveSingleplayerState(saveId: string, gameState: GameState, options?: { status?: SaveStatus }) {
      if (saveId !== input.saveId) {
        return input.delegate.saveSingleplayerState(saveId, gameState, options);
      }
      latest = {
        ...(latest as PersistedSaveGame),
        saveId,
        status: options?.status ?? latest?.status ?? "active",
        updatedAt: new Date().toISOString(),
        gameState,
      };
      dirty = true;
      buffered += 1;
      return latest;
    },
  };

  const flush = (): PersistedSaveGame | null => {
    if (!latest || !dirty) {
      return latest;
    }
    const written = input.delegate.saveSingleplayerState(
      input.saveId,
      latest.gameState,
      latest.status ? { status: latest.status } : undefined,
    );
    latest = written;
    dirty = false;
    buffered = 0;
    disk += 1;
    return written;
  };

  return {
    persistence,
    flush,
    bufferedWrites: () => buffered,
    diskWrites: () => disk,
    isDirty: () => dirty,
  };
}
