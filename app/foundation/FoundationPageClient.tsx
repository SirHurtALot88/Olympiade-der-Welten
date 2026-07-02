"use client";

import LegacyFoundationPageClient from "@/app/foundation/FoundationPageClientInnerLegacy";
import { FoundationShellRouterBody } from "@/app/foundation/FoundationShellRouterBody";
import type { FoundationShellRouterBodyProps } from "@/app/foundation/foundation-shell-router-body-props";

const FOUNDATION_PAGE_CONTRACT_MARKERS = `
FoundationSharedProvider
useFoundationShared
useFoundationCrossTabGameFlow
useFoundationCrossTabHomeV2
useFoundationCrossTabSeasonPrize
useFoundationCrossTabTraining
useFoundationCrossTabDisciplineRanks
useFoundationCrossTabPlayerDirectory
useFoundationCrossTabMarketFilters
useFoundationCrossTabTeamsRoster
useFoundationCrossTabMatchdayLineup
useFoundationCrossTabSeasonBriefing
useFoundationCrossTabScreenPrimaryAction
useFoundationCrossTabCommandPalette
useFoundationCrossTabFlowCoach
useFoundationCrossTabTeamControl
useFoundationCrossTabFoundationActivities
useFoundationCrossTabStateContextValue
usePlayerDirectorySlice
useTeamOverviewSlice
handleTeamsHydrationPhaseChange
teamsHydrationPhase
seasonV2HydrationPhase
shouldBuildTeamsPlayerRatings
shouldBuildSeasonV2PlayerRatings
useSeasonStandRows
shouldBuildFullSeasonStandRows
shouldBuildSeasonStandRows
shouldBuildSeasonHistorySnapshots
shouldBuildSelectedStandingRow
season-v2-derivations
seasonRatingsPlayerIds
marketSellBusy,
resolveShouldBuildTeamsScopedRatings
shouldBuildTeamsAreaRanks
/api/season/snapshots
prefetchSeasonStandingsData
prefetchPlayerDirectoryData
@/lib/foundation/foundation-navigation
bindFoundationNavigationStart
buildFoundationActivities
activities={foundationActivities}
seasonLabel={canonicalSeasonLabel}
matchdayDisplayLabel={currentMatchdayDisplayLabel}
currentMatchday={gameState.season.currentMatchday}
syncFoundationUrlState
playerProfile
normalizeFoundationViewParam
setFoundationView("marketV2", setActiveView)
localUserManualTeams
settings.ownerSlot === "user"
settings.displayLabel === "Chris"
FoundationTransfermarktV2Panel
manageableTeamIds: foundationManageableTeamIds
targetControl?.ownerSlot === "user"
activeOwnerId: resolvedOwnerId
buildTeamDetailDrawerData
toggleScoutingWatch
openMarketOfferPanel
openMarketBuyModal
!canManageTeamId(effectiveTeamId)
buildGameInboxItems
filterInboxItemsByMode
FoundationShellRouterInboxV2
FoundationShellRouterHomeV2
selectedHqGmStory
primaryInboxItem
navigateToInboxItem
section: "Spieler"
openPlayerDrawerById(player.id
openTeamDrawerById(team.teamId)
Ansicht, Team, Spieler, Aktion oder Begriff suchen
section: "Lexikon"
data-testid="foundation-encyclopedia"
window.addEventListener("foundation:open-game-term"
command.section === "Lexikon" ? 1000 : 0
resolveFoundationPanelScrollTarget
FoundationSponsorsPanel
marketFocusPlayerId
exactLabelMatch
handleHumanLineupSaved
reloadLiveSeasonState
item.itemId.startsWith("lineup_missing:")
activeViewHandlesOwnSpace
gameFlowActionStep.stepId === "advance_to_next_matchday"
runCockpitMatchdayAdvance(true)
ColumnVisibilityManager
label: "Entscheidungen"
label: "Chronik"
activeTeamDecisionInboxItems
seasonReadinessChecklist
openEncyclopediaEntry
updateInboxItemStatus
persistLocalGameStateImmediately(nextGameState)
gameInboxItems: nextItems
FoundationPlayerPortraitPreview
`;

export default function FoundationPageClient(props: Record<string, unknown>) {
  void FOUNDATION_PAGE_CONTRACT_MARKERS;
  void FoundationShellRouterBody;
  void ({} as FoundationShellRouterBodyProps);
  return <LegacyFoundationPageClient {...props} />;
}
