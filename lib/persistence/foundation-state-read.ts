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
   * fallback resolves and (re)activates THIS owner's active save instead of the shared global
   * one, so Chris and Franky never overwrite each other's active pointer. Null/undefined ->
   * unchanged global behavior.
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
  const modeSaves =
    requestedSaveMode === "all"
      ? allSaves
      : allSaves.filter((summary) => matchesFoundationSaveMode(requestedSaveMode, summary));
  const activeSave = persistence.getActiveSave(ownerId);
  const activeSaveSummary =
    activeSave && (requestedSaveMode === "all" || matchesFoundationSaveMode(requestedSaveMode, activeSave))
      ? activeSave
      : null;
  const fallbackSummary = modeSaves[0] ?? allSaves[0] ?? null;
  const save = saveId
    ? persistence.getSaveById(saveId)
    : activeSaveSummary
      ? activeSaveSummary
      : fallbackSummary
        ? persistence.activateSave(fallbackSummary.saveId, ownerId) ?? persistence.getSaveById(fallbackSummary.saveId)
        : null;

  if (!save) {
    return null;
  }

  if (!saveId && fallbackSummary) {
    allSaves = persistence.listSaves().map(enrichSaveSummary);
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
