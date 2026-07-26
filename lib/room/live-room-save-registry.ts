/**
 * Deliberately dependency-free (no imports from lib/room or lib/persistence): this is a thin
 * shared leaf module so BOTH the room store (which binds a saveId to a live co-op room) and the
 * persistence/retention layer (which must never delete a save that is still "live" for a room)
 * can reference the same registry without creating a circular import between
 * lib/room/room-store.ts <-> lib/persistence/save-repository.ts.
 *
 * Rooms live purely in-memory (process-wide, see room-store.ts's __olyRuntimeRooms) and are never
 * persisted to SQLite, so there is no DB table `enforceRollingSaveRetention` could join against to
 * learn "which save currently backs a live room". This registry is that missing link: whenever a
 * room binds/rebinds its co-op save (see room-store.ts `startRoom`), it registers the saveId here.
 * Rolling save retention (lib/persistence/save-retention.ts) reads it to protect that save from
 * ever being swept out by the 5-save rolling limit while the room is still using it.
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
