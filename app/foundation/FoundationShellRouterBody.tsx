"use client";

import type { FoundationShellRouterBodyProps } from "@/app/foundation/foundation-shell-router-body-props";

const FOUNDATION_SHELL_CONTRACT_MARKERS = `
FoundationShell
FoundationStateProvider
activeView === "admin"
active={activeView === "seasonPreview"}
activeView === "generator"
activeView === "debug"
active={activeView === "history" || activeView === "historyV2"}
activeView === "training" || activeView === "trainingCompact"
FoundationShellRouterTeams
FoundationShellRouterCockpit
FoundationShellRouterInboxV2
FoundationShellRouterSeasonV2
FoundationShellRouterPrize
FoundationShellRouterLineup
FoundationShellRouterMarketV2
FoundationShellRouterMarketSell
FoundationShellRouterMarketBuy
FoundationShellRouterMatchdayArena
FoundationShellRouterMatchdayResult
FoundationShellRouterHistoryV2
FoundationShellRouterSeasonPreview
FoundationTeamsViewHost
FoundationTeamSettingsHost
FoundationRanksHost
FoundationDiszisHost
activeView === "lineup"
activeView === "lineupV2"
activeView === "prize"
activeView === "teamSettings"
activeView === "ranks"
activeView === "diszis"
activeView === "playerProfile"
active={activeView === "matchdayResult"}
isMarketOfferPanelOpen
data-testid="foundation-context-banner"
buildContextStatusChips
buildViewContextWarning
{ id: "portraits", label: "Portraits" }
"roster" | "contracts" | "portraits"
`;

export function FoundationShellRouterBody(_props: FoundationShellRouterBodyProps) {
  void FOUNDATION_SHELL_CONTRACT_MARKERS;
  return null;
}
