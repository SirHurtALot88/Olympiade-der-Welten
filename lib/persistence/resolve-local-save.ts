import type { PersistedSaveGame } from "@/lib/persistence/types";
import type { PersistenceService } from "@/lib/persistence/types";

/**
 * Thrown by `requireLocalPersistedSave` when a save id cannot be resolved. Routes should catch
 * this and map `.status`/`.code` to a 4xx response instead of letting the write silently retarget
 * (audit S4: gameplay/season writes must never fall back to "the active save").
 */
export class SaveResolutionError extends Error {
  readonly code: "save_id_required" | "save_not_found";
  readonly status: 400 | 404;

  constructor(code: "save_id_required" | "save_not_found", message: string) {
    super(message);
    this.name = "SaveResolutionError";
    this.code = code;
    this.status = code === "save_id_required" ? 400 : 404;
  }
}

/**
 * Strict save resolution for GAMEPLAY/SEASON WRITE paths (audit S4). Requires an explicit,
 * non-empty `saveId` that resolves to a real save — NEVER falls back to "the active save" or a
 * freshly bootstrapped save. A missing or unknown save id throws a typed `SaveResolutionError`
 * (`save_id_required` / `save_not_found`) instead of silently redirecting the write to a
 * different (possibly another player's) save while still reporting success.
 *
 * Use this for every write that mutates a specific save's gameState. For the small set of
 * genuinely intentional "continue my current game" entry points, use `resolveLocalPersistedSave`
 * instead — but that must be an explicit, opt-in choice at the call site, not an implicit
 * fallback inside a write.
 */
export function requireLocalPersistedSave(
  persistence: PersistenceService,
  saveId: string | null | undefined,
): { persistence: PersistenceService; save: PersistedSaveGame } {
  const trimmed = saveId?.trim();
  if (!trimmed) {
    throw new SaveResolutionError(
      "save_id_required",
      "A saveId is required for this write; refusing to fall back to the active save.",
    );
  }

  const save = persistence.getSaveById(trimmed);
  if (!save) {
    throw new SaveResolutionError(
      "save_not_found",
      `Save ${trimmed} could not be resolved; refusing to fall back to the active save for a write.`,
    );
  }

  return { persistence, save };
}

/**
 * Explicit, OPT-IN "continue the current game" resolution: only for genuine read/preview entry
 * points that intentionally want to fall back to the requesting owner's active save (or bootstrap
 * one) when no `saveId` was supplied. `ownerId` (session user, auth-on only) scopes the active-save
 * fallback to THAT owner's `active_saves` pointer — mirrors `PersistenceService.getActiveSave`.
 * Omitting `ownerId` (auth off / solo) keeps the original single-global-active-save behavior.
 *
 * Do NOT use this for gameplay/season writes — see `requireLocalPersistedSave`.
 */
export function resolveLocalPersistedSave(
  persistence: PersistenceService,
  saveId?: string | null,
  ownerId?: string | null,
): { persistence: PersistenceService; save: PersistedSaveGame } {
  const bootstrapped = persistence.bootstrapSingleplayerSave();
  const save =
    (saveId ? persistence.getSaveById(saveId) : null) ??
    persistence.getActiveSave(ownerId) ??
    bootstrapped.save;

  if (!save) {
    throw new Error("SQLite save could not be loaded.");
  }

  return { persistence, save };
}
