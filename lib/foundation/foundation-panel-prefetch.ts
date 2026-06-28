import type { FoundationViewId } from "@/lib/foundation/foundation-view-routing";

const panelPrefetchByView: Partial<Record<FoundationViewId, () => Promise<unknown>>> = {
  homeV2: () => import("@/app/foundation/home-v2/FoundationHomeV2Panel"),
  teams: () => import("@/app/foundation/teams-v2/FoundationTeamsDetailPanel"),
  marketV2: () => import("@/app/foundation/transfermarkt-v2/FoundationTransfermarktV2Panel"),
  lineup: () => import("@/app/foundation/legacy-lineup-lab/FoundationLineupPanel"),
  lineupV2: () => import("@/app/foundation/legacy-lineup-lab/FoundationLineupPanel"),
  matchdayArena: () => import("@/app/foundation/matchday-arena-v2/FoundationMatchdayArenaPanel"),
  seasonV2: () => import("@/app/foundation/season-v2/FoundationSeasonV2Panel"),
  trainingCompact: () => import("@/app/foundation/training-compact/TrainingCompactClient"),
  trainingV2: () => import("@/app/foundation/facilities-v2/FacilitiesV2Client"),
  facilitiesOverviewV2: () => import("@/app/foundation/facilities-overview-v2/FacilitiesOverviewV2Client"),
  scoutingCenterV2: () => import("@/app/foundation/scouting-center-v2/ScoutingCenterV2Client"),
  inboxV2: () => import("@/app/foundation/inbox-v2/InboxV2Client"),
  historyV2: () => import("@/app/foundation/transfer-history-v2/TransferHistoryV2Client"),
};

const prefetchedViews = new Set<FoundationViewId>();

export function prefetchFoundationPanel(view: FoundationViewId) {
  const loader = panelPrefetchByView[view];
  if (!loader || prefetchedViews.has(view)) {
    return;
  }
  prefetchedViews.add(view);
  void loader();
}

export function prefetchFoundationDefaultPanels() {
  prefetchFoundationPanel("homeV2");
  prefetchFoundationPanel("teams");
  prefetchFoundationPanel("lineup");
}
