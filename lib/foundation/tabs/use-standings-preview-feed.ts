import type { FoundationViewId } from "@/lib/foundation/foundation-view-routing";

export function shouldLoadStandingsPreviewFeed(activeView: FoundationViewId): boolean {
  return activeView === "season" || activeView === "cockpit" || activeView === "matchdayArena";
}

export function shouldLoadSeasonManagementFeed(
  activeView: FoundationViewId,
  homeV2Tab: string,
): boolean {
  return (activeView === "homeV2" && homeV2Tab === "office") || activeView === "inboxV2" || activeView === "cockpit";
}

export function shouldLoadTransferHistoryFeed(activeView: FoundationViewId): boolean {
  return activeView === "history" || activeView === "historyV2";
}

export function shouldRefreshSeasonOverviewOnReload(activeView: FoundationViewId): boolean {
  return (
    activeView === "seasonV2" ||
    activeView === "prize" ||
    activeView === "teams" ||
    activeView === "ranks" ||
    activeView === "diszis"
  );
}
