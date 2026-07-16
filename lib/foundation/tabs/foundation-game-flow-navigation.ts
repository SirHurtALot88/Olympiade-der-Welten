import type { GameInboxItem } from "@/lib/data/olyDataTypes";
import type { GameFlowView } from "@/lib/foundation/game-flow-controller";
import type { ActiveManagerTeamSource, FoundationView } from "@/lib/foundation/tabs/foundation-page-types";
import {
  normalizeInboxTargetView,
  resolveFoundationPanelScrollTarget,
  resolveFoundationViewTarget,
  scrollToFoundationTarget,
} from "@/lib/foundation/tabs/foundation-page-module-helpers";

export type FoundationGameFlowNavigationDeps = {
  navigateHomeTab: (tab: "overview" | "office") => void;
  setShowGameFlowPanel: (show: boolean) => void;
  resolveLineupIssueTeamId: (preferredTeamId?: string | null) => string | null;
  activeManagerTeamId: string | null;
  setActiveManagerTeam: (teamId: string, source?: ActiveManagerTeamSource) => void;
  setLineupFocusRequestKey: (key: string) => void;
  setLineupDraftBoardViewRequest: (view: "formBoard" | null) => void;
  setFoundationView: (view: FoundationView, setActiveView: (view: FoundationView) => void) => void;
  setActiveView: (view: FoundationView) => void;
  openSeasonBriefingPanel: (options?: { push?: boolean }) => void;
  setSelectedTeamDetailTab: (tab: "roster" | "contracts") => void;
  setMarketFocusPlayerId: (playerId: string | null) => void;
  navigateToPrizeFinanceViewFromRouting: (panel: string | null | undefined, push: boolean) => void;
  openPrizeFinanceView: (options?: { tab?: "sponsors" | "prize"; push?: boolean }) => void;
};

export type FoundationGameFlowNavigator = {
  navigateToGameFlowStep: (
    targetView: GameFlowView,
    teamId?: string | null,
    targetPanel?: string | null,
  ) => void;
  navigateToInboxItem: (item: GameInboxItem) => void;
};

export function createFoundationGameFlowNavigator(deps: FoundationGameFlowNavigationDeps): FoundationGameFlowNavigator {
  const navigateToGameFlowStep = (
    targetView: GameFlowView,
    teamId?: string | null,
    targetPanel?: string | null,
  ) => {
    if (targetView === "hq") {
      deps.navigateHomeTab("office");
      deps.setShowGameFlowPanel(false);
      return;
    }
    const navigationTeamId = targetView === "lineup" ? deps.resolveLineupIssueTeamId(teamId) : teamId;
    if (navigationTeamId && navigationTeamId !== deps.activeManagerTeamId) {
      deps.setActiveManagerTeam(navigationTeamId, "manual_select");
    }
    if (targetView === "lineup") {
      deps.setLineupFocusRequestKey(`lineup-${navigationTeamId ?? deps.activeManagerTeamId ?? "team"}-${Date.now()}`);
      if (targetPanel === "form-board") {
        deps.setLineupDraftBoardViewRequest("formBoard");
      }
    }
    if (targetPanel === "season-briefing") {
      deps.setFoundationView("homeV2", deps.setActiveView);
      deps.setShowGameFlowPanel(false);
      deps.openSeasonBriefingPanel();
      scrollToFoundationTarget("foundation-home");
      return;
    }
    if (targetPanel === "captain-picker") {
      deps.navigateHomeTab("office");
      deps.setShowGameFlowPanel(false);
      scrollToFoundationTarget("foundation-hq-captain-picker");
      return;
    }
    if (targetPanel === "sponsor-choice") {
      deps.openPrizeFinanceView({ tab: "sponsors", push: false });
      deps.setShowGameFlowPanel(false);
      return;
    }
    if (targetView === "teams") {
      if (targetPanel === "contracts") {
        deps.setSelectedTeamDetailTab("contracts");
      } else {
        deps.setSelectedTeamDetailTab("roster");
      }
    }
    const resolvedView = resolveFoundationViewTarget(targetView as FoundationView);
    if (resolvedView === "marketV2") {
      deps.setMarketFocusPlayerId(null);
    }
    if (resolvedView === "prize") {
      deps.navigateToPrizeFinanceViewFromRouting(targetPanel, false);
      deps.setShowGameFlowPanel(false);
      return;
    }
    deps.setFoundationView(resolvedView, deps.setActiveView);
    deps.setShowGameFlowPanel(false);
    scrollToFoundationTarget(
      resolveFoundationPanelScrollTarget({
        targetView: resolvedView,
        panel: targetPanel,
      }),
    );
  };

  const navigateToInboxItem = (item: GameInboxItem) => {
    const targetView = normalizeInboxTargetView(item.targetView);
    const itemTeamId = item.teamId ?? (typeof item.targetParams.team === "string" ? item.targetParams.team : null);
    const navigationTeamId =
      targetView === "lineup" && (item.source === "lineup_drafts" || item.title.toLowerCase().includes("lineup"))
        ? deps.resolveLineupIssueTeamId(itemTeamId)
        : itemTeamId;
    const panel = typeof item.targetParams.panel === "string" ? item.targetParams.panel : null;
    if (navigationTeamId && navigationTeamId !== deps.activeManagerTeamId) {
      deps.setActiveManagerTeam(navigationTeamId, "manual_select");
    }
    if (targetView === "lineup") {
      deps.setLineupFocusRequestKey(`lineup-${navigationTeamId ?? deps.activeManagerTeamId ?? "team"}-${Date.now()}`);
      if (panel === "form-board") {
        deps.setLineupDraftBoardViewRequest("formBoard");
      }
    }
    const focusPlayerId =
      item.playerId ?? (typeof item.targetParams.player === "string" ? item.targetParams.player : null);
    if (targetView === "teams") {
      if (panel === "contracts") {
        deps.setSelectedTeamDetailTab("contracts");
      } else {
        deps.setSelectedTeamDetailTab("roster");
      }
    }
    const resolvedView = resolveFoundationViewTarget(targetView);
    if (resolvedView === "marketV2" && focusPlayerId) {
      deps.setMarketFocusPlayerId(focusPlayerId);
    } else if (resolvedView === "marketV2") {
      deps.setMarketFocusPlayerId(null);
    }
    if (resolvedView === "prize") {
      deps.navigateToPrizeFinanceViewFromRouting(panel, false);
      deps.setShowGameFlowPanel(false);
      return;
    }
    deps.setFoundationView(resolvedView, deps.setActiveView);
    deps.setShowGameFlowPanel(false);
    scrollToFoundationTarget(
      resolveFoundationPanelScrollTarget({
        targetView: resolvedView,
        panel,
      }),
    );
  };

  return { navigateToGameFlowStep, navigateToInboxItem };
}
