import type { FoundationViewId } from "@/lib/foundation/foundation-view-routing";

export function shouldBuildPrizeV2Ui(
  activeView: FoundationViewId,
  prizeFinanceTab: "sponsors" | "prize",
): boolean {
  return activeView === "prize" && prizeFinanceTab === "prize";
}

export function shouldBuildPrizeCockpitContext(activeView: FoundationViewId): boolean {
  return activeView === "cockpit" || activeView === "prize";
}

export function shouldLoadPrizePreviewFeed(
  activeView: FoundationViewId,
  prizeFinanceTab: "sponsors" | "prize",
): boolean {
  return activeView === "cockpit" || shouldBuildPrizeV2Ui(activeView, prizeFinanceTab);
}
