/**
 * Deliberately dependency-free (no imports from lib/room or lib/persistence): this is a thin
 * shared leaf module so BOTH the room store (which binds a saveId to a live co-op room) and the
 * persistence/retention layer (which must never delete a save that is still "live" for a room)
 * can reference the same registry without creating a circular import between
 * lib/room/room-store.ts <-> lib/persistence/save-repository.ts.
 *
 * CORRECTED (F5, docs/MULTIPLAYER_VOLLAUSBAU_PLAN.md, Notausfahrt-Audit): this comment used to
 * claim "rooms live purely in-memory ... and are never persisted to SQLite" — that stopped being
 * true with Stufe 0.1 (`lib/room/room-persistence.ts`: rooms/seats now DO have a SQLite table and
 * survive a restart via `rehydrateRuntimeRoomsFromPersistence`). This registry is a SEPARATE,
 * still purely in-memory Map (on purpose — see below), so it did NOT automatically inherit that
 * protection: `registerLiveRoomSaveId` was called only once, from `startRoom`'s lobby ->
 * season_active transition. A process restart wiped this Map (globalThis is recreated) while the
 * room itself came back via rehydration — "room lives, protection gone" for every save whose room
 * had already started before the restart. `rehydrateRuntimeRoomsFromPersistence` (room-store.ts)
 * now re-registers every restored room's saveId here, closing that gap. The registry also used to
 * never be CLEARED (neither `closeRoom` nor the 7-day eviction removed an entry) — both now go
 * through `removeRoomFromActiveSet` (room-store.ts), which clears it alongside the room itself.
 *
 * WHY THIS MAP STAYS IN-MEMORY-ONLY RATHER THAN GAINING ITS OWN TABLE: it is fully DERIVABLE from
 * the `rooms` table's `save_id` column (room-persistence.ts) — a room's currently-bound save IS
 * exactly what this registry needs to know, no separate fact to persist. Adding a table for it
 * would be a second, redundant source of the same information (the project's own "keine zweite
 * Quelle" rule) — rebuilding it from the already-persisted rooms on every restart, as done now, is
 * the smaller surface.
 *
 * Whenever a room binds/rebinds its co-op save (see room-store.ts `startRoom`), it registers the
 * saveId here. Rolling save retention (lib/persistence/save-retention.ts) reads it to protect that
 * save from ever being swept out by the 5-save rolling limit while the room is still using it.
 *
 * Same globalThis-backed-Map trick as __olyRuntimeRooms so the socket server (tsx) and Next.js
 * route handlers (separate bundle) share ONE registry instead of two independent module
 * instances.
 */

declare global {
  // eslint-disable-next-line no-var
  var __olyLiveRoomSaveIds: Map<string, string> | undefined;
}

const liveRoomSaveIdsByRoomCode: Map<string, string> = (globalThis.__olyLiveRoomSaveIds ??= new Map<string, string>());

/** Registers (or clears, when saveId is null/undefined) the save currently bound to a live room. */
export function registerLiveRoomSaveId(roomCode: string, saveId: string | null | undefined): void {
  if (!saveId) {
    liveRoomSaveIdsByRoomCode.delete(roomCode);
    return;
  }
  liveRoomSaveIdsByRoomCode.set(roomCode, saveId);
}

/** All saveIds currently bound to a live (in-memory) co-op room, de-duplicated. */
export function getLiveRoomSaveIds(): string[] {
  return [...new Set(liveRoomSaveIdsByRoomCode.values())];
}

/**
 * TEST-ONLY: leert die Registry, um -- zusammen mit `resetRuntimeRoomsForTests()` in room-store.ts
 * -- einen echten Prozess-Neustart zu simulieren (der `globalThis.__olyLiveRoomSaveIds` genauso
 * neu anlegt wie `globalThis.__olyRuntimeRooms`). `resetRuntimeRoomsForTests()` allein leert NUR
 * die Room-Map, nicht diese hier -- ohne diese Funktion liesse sich F5s Kern-Eigenschaft ("die
 * Registry wird nach einem Neustart korrekt wiederhergestellt") gar nicht pruefen, weil ohne
 * geleerte Registry der Eintrag schlicht nie verschwunden waere. Gleiches Schutzmuster wie
 * `resetDatabaseForTests()`/`resetRuntimeRoomsForTests()`.
 */
export function resetLiveRoomSaveIdsForTests(): void {
  if (process.env.NODE_ENV !== "test" && process.env.VITEST !== "true") {
    throw new Error("resetLiveRoomSaveIdsForTests darf nur in Tests laufen.");
  }
  liveRoomSaveIdsByRoomCode.clear();
}
