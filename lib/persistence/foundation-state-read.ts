import type { GameState } from "@/lib/data/olyDataTypes";
import { withNormalizedTeamIdentityOverrides } from "@/lib/foundation/team-identity-settings";
import { withNormalizedTeamGeneralManagers } from "@/lib/foundation/team-general-managers";
import { withNormalizedTeamControlSettings } from "@/lib/foundation/team-control-settings";
import { withNormalizedTeamStrategyProfiles } from "@/lib/foundation/team-strategy-profiles";
import { compactFoundationInitialGameState } from "@/lib/persistence/foundation-initial-compact-state";
import {
  matchesFoundationSaveMode,
  normalizeFoundationSaveMode,
  resolveFoundationSaveMode,
  type FoundationSaveMode,
} from "@/lib/persistence/foundation-save-mode";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import type { SaveSummary } from "@/lib/persistence/types";

export type FoundationPersistenceReadMeta = {
  source: "sqlite";
  readOnly: false;
  generatedAt: string;
  saveMode: FoundationSaveMode;
};

export type FoundationInitialPersistenceState = {
  save: { saveId: string; name: string; gameState: GameState };
  saves: SaveSummary[];
  _meta: FoundationPersistenceReadMeta;
};

function withNormalizedLocalTeamSettings(gameState: GameState): GameState {
  return withNormalizedTeamStrategyProfiles(
    withNormalizedTeamControlSettings(
      withNormalizedTeamGeneralManagers(withNormalizedTeamIdentityOverrides(gameState)),
    ),
  );
}

function enrichSaveSummary(save: SaveSummary): SaveSummary {
  return {
    ...save,
    saveMode: resolveFoundationSaveMode(save),
  };
}

/** Server-side Foundation bootstrap payload (compact initial slice). */
export function loadFoundationInitialPersistenceState(input?: {
  saveId?: string | null;
  saveMode?: string | null;
  /**
   * Owner of the current session (only set when auth is on). When present, the active-save
   * fallback resolves (read-only, never activates) THIS owner's active save instead of the shared
   * global one, so Chris and Franky never see or touch each other's active pointer. Null/undefined
   * -> unchanged global (auth-off/solo) behavior.
   */
  ownerId?: string | null;
}): FoundationInitialPersistenceState | null {
  const requestedSaveMode = normalizeFoundationSaveMode(input?.saveMode?.trim());
  const persistence = createPersistenceService();
  let allSaves = persistence.listSaves().map(enrichSaveSummary);
  if (allSaves.length === 0) {
    persistence.bootstrapSingleplayerSave();
    allSaves = persistence.listSaves().map(enrichSaveSummary);
  }

  const saveId = input?.saveId?.trim() || undefined;
  const ownerId = input?.ownerId?.trim() || undefined;
  // Audit S5: this is the /foundation page LOADER — a plain GET page load. It may resolve THIS
  // owner's active save (or the explicit saveId), but it must never activate/archive anything.
  // Falling back to "some other save in the list" and calling `activateSave` on it here is
  // exactly the S5 bug: it would silently repoint this owner's active_saves pointer at another
  // player's save (and flip that save's status) just because they opened the page. If neither an
  // explicit saveId nor an active save can be resolved for this owner, return `null` ("no save")
  // instead of guessing.
  const activeSave = persistence.getActiveSave(ownerId);
  const activeSaveSummary =
    activeSave && (requestedSaveMode === "all" || matchesFoundationSaveMode(requestedSaveMode, activeSave))
      ? activeSave
      : null;
  const save = saveId ? persistence.getSaveById(saveId) : activeSaveSummary;

  if (!save) {
    return null;
  }

  const responseModeSaves =
    requestedSaveMode === "all"
      ? allSaves
      : allSaves.filter((summary) => matchesFoundationSaveMode(requestedSaveMode, summary));
  const normalizedGameState = withNormalizedLocalTeamSettings(save.gameState);

  return {
    save: {
      saveId: save.saveId,
      name: save.name,
      gameState: compactFoundationInitialGameState(normalizedGameState),
    },
    saves: responseModeSaves,
    _meta: {
      source: "sqlite",
      readOnly: false,
      generatedAt: new Date().toISOString(),
      saveMode: requestedSaveMode,
    },
  };
}
