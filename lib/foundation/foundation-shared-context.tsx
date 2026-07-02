"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

import type { FoundationAiLineupBatchApplyResponse } from "@/app/foundation/FoundationPageClient";

export type FoundationSharedContextValue = {
  cockpitBusyKey: string | null;
  setCockpitBusyKey: Dispatch<SetStateAction<string | null>>;
  cockpitAiBatchApplyFeed: FoundationAiLineupBatchApplyResponse | null;
  setCockpitAiBatchApplyFeed: Dispatch<SetStateAction<FoundationAiLineupBatchApplyResponse | null>>;
  cockpitAiIncludeWarningTeams: boolean;
  setCockpitAiIncludeWarningTeams: Dispatch<SetStateAction<boolean>>;
  cockpitAiOverwriteExisting: boolean;
  setCockpitAiOverwriteExisting: Dispatch<SetStateAction<boolean>>;
};

const FoundationSharedContext = createContext<FoundationSharedContextValue | null>(null);

export function FoundationSharedProvider({ children }: { children: ReactNode }) {
  const [cockpitBusyKey, setCockpitBusyKey] = useState<string | null>(null);
  const [cockpitAiBatchApplyFeed, setCockpitAiBatchApplyFeed] =
    useState<FoundationAiLineupBatchApplyResponse | null>(null);
  const [cockpitAiIncludeWarningTeams, setCockpitAiIncludeWarningTeams] = useState<boolean>(false);
  const [cockpitAiOverwriteExisting, setCockpitAiOverwriteExisting] = useState<boolean>(false);

  const value = useMemo<FoundationSharedContextValue>(
    () => ({
      cockpitBusyKey,
      setCockpitBusyKey,
      cockpitAiBatchApplyFeed,
      setCockpitAiBatchApplyFeed,
      cockpitAiIncludeWarningTeams,
      setCockpitAiIncludeWarningTeams,
      cockpitAiOverwriteExisting,
      setCockpitAiOverwriteExisting,
    }),
    [
      cockpitAiBatchApplyFeed,
      cockpitAiIncludeWarningTeams,
      cockpitAiOverwriteExisting,
      cockpitBusyKey,
    ],
  );

  return <FoundationSharedContext.Provider value={value}>{children}</FoundationSharedContext.Provider>;
}

export function useFoundationShared(): FoundationSharedContextValue {
  const context = useContext(FoundationSharedContext);
  if (!context) {
    throw new Error("useFoundationShared must be used within FoundationSharedProvider");
  }
  return context;
}

export function useFoundationSharedOptional(): FoundationSharedContextValue | null {
  return useContext(FoundationSharedContext);
}
