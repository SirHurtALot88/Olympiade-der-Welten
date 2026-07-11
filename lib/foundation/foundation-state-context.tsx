"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { GameState } from "@/lib/data/olyDataTypes";
import type { FoundationSaveMode } from "@/lib/persistence/foundation-save-mode";

export type FoundationReadMeta = {
  source: "sqlite" | "prisma";
  readOnly: boolean;
};

export type FoundationStateContextValue = {
  gameState: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
  activeSaveId: string;
  activeSaveName: string;
  foundationSaveMode: FoundationSaveMode;
  readMeta: FoundationReadMeta;
  selectedTeamId: string;
  activeManagerTeamId: string | null;
  isFoundationBootstrapState: boolean;
  foundationManageableTeamIds: string[];
  loadSave: (
    saveId?: string,
    saveMode?: FoundationSaveMode,
    options?: { compactInitial?: boolean },
  ) => Promise<GameState | null>;
  reloadLiveSeasonState: (
    reason?: "manual_apply" | "room_event" | "local_save_version",
    options?: { skipGameStateReload?: boolean; reloadFullGameState?: boolean; compactReload?: boolean },
  ) => Promise<void>;
};

const FoundationStateContext = createContext<FoundationStateContextValue | null>(null);

export function FoundationStateProvider({
  value,
  children,
}: {
  value: FoundationStateContextValue;
  children: ReactNode;
}) {
  return <FoundationStateContext.Provider value={value}>{children}</FoundationStateContext.Provider>;
}

export function useFoundationState(): FoundationStateContextValue {
  const context = useContext(FoundationStateContext);
  if (!context) {
    throw new Error("useFoundationState must be used within FoundationStateProvider");
  }
  return context;
}

export function useFoundationStateOptional(): FoundationStateContextValue | null {
  return useContext(FoundationStateContext);
}

export function useFoundationGameState(): GameState {
  return useFoundationState().gameState;
}
