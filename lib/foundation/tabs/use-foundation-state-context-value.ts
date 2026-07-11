import { useMemo } from "react";

import type { GameState } from "@/lib/data/olyDataTypes";
import type { FoundationStateContextValue } from "@/lib/foundation/foundation-state-context";
import type { FoundationSaveMode } from "@/lib/persistence/foundation-save-mode";
import type { FoundationReadMeta } from "@/lib/foundation/tabs/foundation-page-types";

export function useFoundationStateContextValue(input: {
  gameState: GameState;
  setGameState: FoundationStateContextValue["setGameState"];
  activeSaveId: string;
  activeSaveName: string;
  foundationSaveMode: FoundationSaveMode;
  readMeta: FoundationReadMeta;
  selectedTeamId: string;
  activeManagerTeamId: string | null;
  isFoundationBootstrapState: boolean;
  foundationManageableTeamIds: string[];
  loadSave: FoundationStateContextValue["loadSave"];
  reloadLiveSeasonState: FoundationStateContextValue["reloadLiveSeasonState"];
}): FoundationStateContextValue {
  return useMemo<FoundationStateContextValue>(
    () => ({
      gameState: input.gameState,
      setGameState: input.setGameState,
      activeSaveId: input.activeSaveId,
      activeSaveName: input.activeSaveName,
      foundationSaveMode: input.foundationSaveMode,
      readMeta: input.readMeta,
      selectedTeamId: input.selectedTeamId,
      activeManagerTeamId: input.activeManagerTeamId,
      isFoundationBootstrapState: input.isFoundationBootstrapState,
      foundationManageableTeamIds: input.foundationManageableTeamIds,
      loadSave: input.loadSave,
      reloadLiveSeasonState: input.reloadLiveSeasonState,
    }),
    [
      input.activeManagerTeamId,
      input.activeSaveId,
      input.activeSaveName,
      input.foundationManageableTeamIds,
      input.foundationSaveMode,
      input.gameState,
      input.isFoundationBootstrapState,
      input.readMeta,
      input.selectedTeamId,
    ],
  );
}

export function getFoundationReadOnlyActionReason(action: string) {
  return `Im Nur-Ansicht-Modus kannst du ${action} nicht aendern.`;
}

export function getFoundationBusyActionReason(task: string) {
  return `${task} laeuft gerade. Bitte kurz warten.`;
}

export function getFoundationCockpitBusyReason() {
  return "Gerade laeuft schon ein anderer Saisonabschluss-Schritt. Bitte erst diesen Schritt fertig werden lassen.";
}
