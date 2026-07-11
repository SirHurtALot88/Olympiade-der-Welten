import { useState } from "react";

export type MatchdaySummaryTab = "matchday" | "season";

/**
 * Matchday result panel derivations (Strangler Phase 5.3). Runs only while
 * `FoundationMatchdayResultShellHost` is mounted (`activeView === "matchdayResult"`).
 */
export function useMatchdayResultDerivations() {
  const [matchdaySummaryTab, setMatchdaySummaryTab] = useState<MatchdaySummaryTab>("matchday");

  return {
    matchdaySummaryTab,
    setMatchdaySummaryTab,
  };
}
