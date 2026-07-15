"use client";

import type { Dispatch, SetStateAction } from "react";

import type { Team, TeamControlSettings } from "@/lib/data/olyDataTypes";
import type { FoundationViewId } from "@/lib/foundation/foundation-view-routing";
import type { MatchdaySummary, MatchdaySummaryTeamRow } from "@/lib/foundation/matchday-summary";
import MatchdayResultNewLook from "@/app/foundation/matchday-result-v2/MatchdayResultNewLook";

export type MatchdaySummaryOption = {
  matchdayId: string;
  matchdayNumber: number | null;
  resultId: string;
};

export type FoundationMatchdayResultShellHostProps = {
  sourceBadgeLabel: string;
  matchdaySummary: MatchdaySummary;
  activeMatchdaySummaryId: string;
  matchdaySummaryOptions: MatchdaySummaryOption[];
  activeTeamMatchdaySummaryRow: MatchdaySummaryTeamRow | null;
  activeManagerTeamId: string | null;
  selectedTeam: Team | null;
  resolvedTeamControlSettings: Record<string, TeamControlSettings>;
  setSelectedMatchdaySummaryId: Dispatch<SetStateAction<string | null>>;
  setActiveView: Dispatch<SetStateAction<FoundationViewId>>;
  openTeamProfileById: (teamId: string) => void;
  /** Kanonische "Weiter"-Aktion (schließt den Loop / startet den nächsten Spieltag). */
  triggerGlobalNext: () => void | Promise<void>;
};

/**
 * Matchday result shell host (Strangler Phase 5.3). Mounts result-only tab state
 * and full Spieltagsergebnis panel only while the matchdayResult tab is active.
 */
export default function FoundationMatchdayResultShellHost(props: FoundationMatchdayResultShellHostProps) {
  return <MatchdayResultNewLook {...props} />;
}
