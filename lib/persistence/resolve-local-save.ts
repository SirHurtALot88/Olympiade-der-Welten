import { NextResponse } from "next/server";

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
 * Maps a `SaveResolutionError` thrown by `requireLocalPersistedSave` to the JSON error response
 * routes should return (400/404 with `{ error: code, message }`, matching the shape the
 * `ai-batch-apply` route established first). Returns `null` for anything else so callers can fall
 * through to their own generic 500 handling. Centralised here (next to the resolver) so the six+
 * gameplay-write routes that call `requireLocalPersistedSave` transitively don't each hand-roll
 * their own copy of this mapping.
 */
export function mapSaveResolutionErrorToResponse(error: unknown): NextResponse | null {
  if (error instanceof SaveResolutionError) {
    return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
  }
  return null;
}

/**
 * Explicit, OPT-IN "continue the current game" resolution: only for genuine read/preview entry
 * points that intentionally want to fall back to the requesting owner's active save when no
 * `saveId` was supplied. `ownerId` (session user, auth-on only) scopes the active-save fallback to
 * THAT owner's `active_saves` pointer — mirrors `PersistenceService.getActiveSave`. Omitting
 * `ownerId` (auth off / solo) keeps the original single-global-active-save behavior.
 *
 * Audit S5: this is a PURE READ — it never bootstraps, activates, or archives anything. It tries
 * the explicit `saveId`, then the resolved owner's active save, and returns `null` when neither
 * exists so the caller can answer with an empty/"no save" result or a 404 instead of silently
 * creating a save or (worse) reaching for some other owner's save. `bootstrapSingleplayerSave` is
 * intentionally never called from here — that capability now lives only behind explicit,
 * intentional "start/continue my game" actions (e.g. the `create`/`fresh-season-1` POST actions
 * on `/api/singleplayer-state`), never behind a GET/read.
 *
 * Do NOT use this for gameplay/season writes — see `requireLocalPersistedSave`.
 */
export function resolveLocalPersistedSave(
  persistence: PersistenceService,
  saveId?: string | null,
  ownerId?: string | null,
): { persistence: PersistenceService; save: PersistedSaveGame } | null {
  const save = (saveId ? persistence.getSaveById(saveId) : null) ?? persistence.getActiveSave(ownerId) ?? null;

  if (!save) {
    return null;
  }

  return { persistence, save };
}
