import { useEffect, useMemo, useState } from "react";

import type { GameInboxItem, GameState } from "@/lib/data/olyDataTypes";
import {
  buildGameFlowState,
  getGameFlowTransferWindowHint,
  isActiveMatchdayPreparation,
} from "@/lib/foundation/game-flow-controller";
import { buildFoundationNavAttention } from "@/lib/foundation/foundation-nav-attention";
import {
  filterGameInboxItems,
  filterInboxItemsByMode,
  getPrimaryInboxTask,
  isGameInboxDecisionItem,
} from "@/lib/foundation/game-inbox-service";
import {
  buildMatchdayArenaBlockerSummary,
  type MatchdayArenaBlockerSummary,
} from "@/lib/foundation/matchday-arena-blocker-summary";
import { extractMatchdayResolveBlockerStatus } from "@/lib/foundation/matchday-resolve-blocker-status";
import { getMatchdayArenaReadiness } from "@/lib/foundation/matchday-arena-readiness";
import { isTeamMatchdayLineupComplete } from "@/lib/foundation/matchday-lineup-readiness";
import { formatCockpitReason } from "@/lib/foundation/tabs/cockpit-ui-helpers";
import type { FoundationResolvePreviewResponse, FoundationView } from "@/lib/foundation/tabs/foundation-page-types";
import {
  isInboxItemOwnedByTeam,
  normalizeInboxTargetView,
} from "@/lib/foundation/tabs/foundation-page-module-helpers";
import {
  shouldBuildFoundationGameFlow,
  useFoundationGameInboxItems,
} from "@/lib/foundation/tabs/use-foundation-game-flow";

export function shouldBuildFoundationGameInboxDerivations(activeView: string, homeV2Tab?: string): boolean {
  return shouldBuildFoundationGameFlow(activeView, homeV2Tab);
}

export function shouldBuildFoundationMatchdayFlowDerivations(activeView: string): boolean {
  return (
    activeView === "matchdayArena" ||
    activeView === "cockpit" ||
    activeView === "lineup" ||
    activeView === "lineupV2" ||
    activeView === "homeV2"
  );
}

export function shouldBuildFoundationCockpitFlowWarnings(activeView: string, homeV2Tab?: string): boolean {
  return activeView === "cockpit" || activeView === "homeV2";
}

const EMPTY_MATCHDAY_ARENA_BLOCKER_SUMMARY: MatchdayArenaBlockerSummary = {
  reasons: [],
  primaryReason: null,
  detail: null,
  isArenaReady: true,
  arenaBlocker: null,
};

export type FoundationWarningInboxItem = {
  id: string;
  title: string;
  detail: string;
  severity: "blocked" | "warning" | "info";
  targetView: FoundationView;
  targetTeamId?: string | null;
  targetPanel?: string | null;
  inboxItem?: GameInboxItem;
};

export function useFoundationCrossTabGameFlow(input: {
  activeView: string;
  homeV2Tab?: string;
  inboxGameState: GameState;
  gameState: GameState;
  activeSaveId: string;
  activeManagerTeamId: string | null;
  effectiveActiveOwnerId: string;
  teamContextFilter: string;
  selectedTeamCanManage: boolean;
  activeContextMeta: { allowTestWrites?: boolean } | null;
  activeViewContextWarning: string | null;
  activeManagerTeamWarning: string | null;
  resolvePreviewFeed: FoundationResolvePreviewResponse | null;
  shouldBuildGameInbox: boolean;
}) {
  const shouldBuildInboxDerivations = shouldBuildFoundationGameInboxDerivations(
    input.activeView,
    input.homeV2Tab,
  );
  const shouldBuildMatchdayDerivations = shouldBuildFoundationMatchdayFlowDerivations(input.activeView);
  const shouldBuildFlowWarnings = shouldBuildFoundationCockpitFlowWarnings(input.activeView, input.homeV2Tab);

  const gameFlowState = useMemo(
    () => buildGameFlowState({ gameState: input.inboxGameState, activeTeamId: input.activeManagerTeamId }),
    [input.activeManagerTeamId, input.inboxGameState],
  );

  const gameInboxItems = useFoundationGameInboxItems({
    enabled: input.shouldBuildGameInbox,
    gameState: input.inboxGameState,
    saveId: input.activeSaveId,
    activeTeamId: input.activeManagerTeamId,
    activeOwnerId: input.effectiveActiveOwnerId,
    hostMode: input.teamContextFilter === "all",
    gameFlowState,
  });

  const activeTeamInboxItems = useMemo(() => {
    if (!shouldBuildInboxDerivations) {
      return [] as GameInboxItem[];
    }
    return gameInboxItems.filter((item) => isInboxItemOwnedByTeam(item, input.activeManagerTeamId));
  }, [gameInboxItems, input.activeManagerTeamId, shouldBuildInboxDerivations]);

  const activeTeamOpenInboxItems = useMemo(() => {
    if (!shouldBuildInboxDerivations) {
      return [] as GameInboxItem[];
    }
    return activeTeamInboxItems.filter((item) => item.status === "open");
  }, [activeTeamInboxItems, shouldBuildInboxDerivations]);

  const flowCycleKey = `${input.gameState.season.id}:${input.gameState.matchdayState.matchdayId}:${gameFlowState.phase}:${input.activeManagerTeamId ?? "no-team"}`;
  const [flowCycleKeyState, setFlowCycleKeyState] = useState(flowCycleKey);
  const [acknowledgedFlowStepIds, setAcknowledgedFlowStepIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (flowCycleKeyState === flowCycleKey) {
      return;
    }
    setFlowCycleKeyState(flowCycleKey);
    setAcknowledgedFlowStepIds(new Set());
  }, [flowCycleKey, flowCycleKeyState]);

  const activeTeamDecisionInboxItems = useMemo(() => {
    if (!shouldBuildInboxDerivations) {
      return [] as GameInboxItem[];
    }
    return activeTeamOpenInboxItems.filter(isGameInboxDecisionItem);
  }, [activeTeamOpenInboxItems, shouldBuildInboxDerivations]);

  const activeTeamChronicleInboxItems = useMemo(() => {
    if (!shouldBuildInboxDerivations) {
      return [] as GameInboxItem[];
    }
    return filterInboxItemsByMode(activeTeamOpenInboxItems, "chronicle");
  }, [activeTeamOpenInboxItems, shouldBuildInboxDerivations]);

  const activeTeamDecisionCriticalInboxItems = useMemo(() => {
    if (!shouldBuildInboxDerivations) {
      return [] as GameInboxItem[];
    }
    return activeTeamDecisionInboxItems.filter((item) => item.severity === "critical");
  }, [activeTeamDecisionInboxItems, shouldBuildInboxDerivations]);

  const foundationNavAttention = useMemo(
    () =>
      buildFoundationNavAttention({
        gameState: input.gameState,
        activeManagerTeamId: input.activeManagerTeamId,
        canManageActiveTeam: input.selectedTeamCanManage,
        criticalDecisionCount: activeTeamDecisionCriticalInboxItems.length,
      }),
    [
      activeTeamDecisionCriticalInboxItems.length,
      input.activeManagerTeamId,
      input.gameState,
      input.selectedTeamCanManage,
    ],
  );

  const focusMatchdayLoop = useMemo(
    () => isActiveMatchdayPreparation(input.gameState),
    [input.gameState],
  );

  const inboxPrimaryTeamItem = useMemo(() => {
    if (!shouldBuildInboxDerivations) {
      return null;
    }
    const scheduleEntry = (input.gameState.seasonState.disciplineSchedule ?? []).find(
      (entry) =>
        entry.seasonId === input.gameState.season.id &&
        entry.matchdayId === input.gameState.matchdayState.matchdayId,
    );
    void scheduleEntry;
    const openItems = filterGameInboxItems(activeTeamInboxItems, { includeDismissed: false, includeDone: false }).filter(
      (item) => {
        if (!item.itemId.startsWith("lineup_missing:")) {
          return true;
        }
        const teamId = item.teamId ?? (typeof item.targetParams.team === "string" ? item.targetParams.team : null);
        if (!teamId) {
          return true;
        }
        const draft = (input.gameState.seasonState.lineupDrafts ?? []).find(
          (entry) =>
            entry.seasonId === input.gameState.season.id &&
            entry.matchdayId === input.gameState.matchdayState.matchdayId &&
            entry.teamId === teamId,
        );
        return !isTeamMatchdayLineupComplete(input.gameState, teamId, draft ?? null);
      },
    );
    return getPrimaryInboxTask(openItems, { focusMatchdayLoop });
  }, [
    activeTeamInboxItems,
    focusMatchdayLoop,
    input.gameState,
    shouldBuildInboxDerivations,
  ]);

  const gameFlowActionStep = useMemo(() => {
    const actionableSteps = gameFlowState.steps.filter(
      (stepEntry) =>
        stepEntry.status !== "completed" &&
        !(stepEntry.status !== "blocked" && acknowledgedFlowStepIds.has(stepEntry.stepId)),
    );
    return (
      actionableSteps.find(
        (stepEntry) =>
          stepEntry.status === "ready" || stepEntry.status === "warning" || stepEntry.status === "blocked",
      ) ??
      actionableSteps.find((stepEntry) => stepEntry.status === "optional") ??
      (gameFlowState.currentStep.status === "completed"
        ? (gameFlowState.nextStep ?? gameFlowState.currentStep)
        : gameFlowState.currentStep)
    );
  }, [acknowledgedFlowStepIds, gameFlowState]);

  const matchdayArenaReadiness = useMemo(
    () => getMatchdayArenaReadiness(input.gameState, input.activeManagerTeamId),
    [input.activeManagerTeamId, input.gameState],
  );

  const matchdayArenaBlockerSummary = useMemo(() => {
    if (!shouldBuildMatchdayDerivations) {
      return EMPTY_MATCHDAY_ARENA_BLOCKER_SUMMARY;
    }
    return buildMatchdayArenaBlockerSummary({
      gameState: input.gameState,
      activeTeamId: input.activeManagerTeamId,
      flowStep: gameFlowActionStep,
      resolvePreviewStatus: extractMatchdayResolveBlockerStatus({
        preview: input.resolvePreviewFeed,
        activeTeamId: input.activeManagerTeamId,
      }),
    });
  }, [
    gameFlowActionStep,
    input.activeManagerTeamId,
    input.gameState,
    input.resolvePreviewFeed,
    shouldBuildMatchdayDerivations,
  ]);

  const transferWindowHint = useMemo(() => getGameFlowTransferWindowHint(input.gameState), [input.gameState]);

  const shouldPreferGameFlowAction =
    gameFlowActionStep.status !== "completed" &&
    (gameFlowActionStep.stepId === "season_intro" ||
      gameFlowActionStep.stepId === "team_confirm" ||
      gameFlowActionStep.stepId === "roster_review" ||
      gameFlowActionStep.stepId === "first_transfers" ||
      gameFlowActionStep.stepId === "fill_roster" ||
      gameFlowActionStep.stepId === "training_facilities" ||
      gameFlowActionStep.stepId === "set_lineup" ||
      gameFlowActionStep.stepId === "assign_formcards" ||
      gameFlowActionStep.stepId === "confirm_lineup" ||
      gameFlowActionStep.stepId === "open_arena" ||
      gameFlowActionStep.stepId === "run_reveal" ||
      gameFlowActionStep.stepId === "check_training" ||
      gameFlowActionStep.stepId === "advance_to_next_matchday" ||
      gameFlowActionStep.stepId === "scouting_facilities" ||
      gameFlowActionStep.stepId === "choose_sponsor" ||
      gameFlowActionStep.stepId === "buy_players" ||
      gameFlowActionStep.targetView === "market");

  const flowOverrideInboxItem = useMemo(() => {
    if (!shouldBuildInboxDerivations) {
      return null;
    }
    return shouldPreferGameFlowAction && gameFlowActionStep.stepId === "choose_sponsor"
      ? (activeTeamOpenInboxItems.find((item) => item.category === "sponsor") ?? null)
      : null;
  }, [
    activeTeamOpenInboxItems,
    gameFlowActionStep.stepId,
    shouldBuildInboxDerivations,
    shouldPreferGameFlowAction,
  ]);

  const primaryInboxItem = useMemo(() => {
    if (flowOverrideInboxItem) {
      return flowOverrideInboxItem;
    }
    if (shouldPreferGameFlowAction) {
      return null;
    }
    if (inboxPrimaryTeamItem) {
      return inboxPrimaryTeamItem;
    }
    if (!shouldBuildInboxDerivations) {
      return null;
    }
    const globalTasks = filterGameInboxItems(gameInboxItems, { includeDismissed: false, includeDone: false }).filter(
      (item) => !item.itemId.startsWith("lineup_missing:") || item.teamId === input.activeManagerTeamId,
    );
    return getPrimaryInboxTask(globalTasks, { focusMatchdayLoop });
  }, [
    flowOverrideInboxItem,
    focusMatchdayLoop,
    gameInboxItems,
    inboxPrimaryTeamItem,
    input.activeManagerTeamId,
    shouldBuildInboxDerivations,
    shouldPreferGameFlowAction,
  ]);

  const foundationWarningInboxItems = useMemo(() => {
    if (!shouldBuildFlowWarnings) {
      return [] as FoundationWarningInboxItem[];
    }
    const items: FoundationWarningInboxItem[] = [];

    if (primaryInboxItem) {
      items.push({
        id: `inbox-${primaryInboxItem.itemId}`,
        title: primaryInboxItem.title,
        detail: primaryInboxItem.description,
        severity:
          primaryInboxItem.severity === "critical"
            ? "blocked"
            : primaryInboxItem.severity === "warning"
              ? "warning"
              : "info",
        targetView: normalizeInboxTargetView(primaryInboxItem.targetView),
        inboxItem: primaryInboxItem,
      });
    }

    if (gameFlowActionStep.blockers.length > 0) {
      items.push({
        id: `flow-blocker-${gameFlowActionStep.stepId}`,
        title: "Flow blockiert",
        detail: gameFlowActionStep.blockers.map(formatCockpitReason).join(" · "),
        severity: "blocked",
        targetView: gameFlowActionStep.targetView as FoundationView,
        targetTeamId: gameFlowActionStep.teamId,
        targetPanel: gameFlowActionStep.targetPanel,
      });
    } else if (gameFlowActionStep.warnings.length > 0) {
      items.push({
        id: `flow-warning-${gameFlowActionStep.stepId}`,
        title: "Flow prüfen",
        detail: gameFlowActionStep.warnings.map(formatCockpitReason).join(" · "),
        severity: "warning",
        targetView: gameFlowActionStep.targetView as FoundationView,
        targetTeamId: gameFlowActionStep.teamId,
        targetPanel: gameFlowActionStep.targetPanel,
      });
    }

    if (input.activeManagerTeamWarning) {
      items.push({
        id: "manager-team-warning",
        title: "Team-Kontext",
        detail: input.activeManagerTeamWarning,
        severity: "warning",
        targetView: "teams",
      });
    }

    if (input.activeViewContextWarning) {
      items.push({
        id: `view-warning-${input.activeView}`,
        title: "Ansicht prüfen",
        detail: input.activeViewContextWarning,
        severity: "info",
        targetView: input.activeView as FoundationView,
      });
    }

    return items.slice(0, 4);
  }, [
    gameFlowActionStep,
    input.activeManagerTeamWarning,
    input.activeView,
    input.activeViewContextWarning,
    primaryInboxItem,
    shouldBuildFlowWarnings,
  ]);

  const acknowledgeFlowStep = (stepId: string) => {
    const acknowledgeableStepIds = new Set([
      "season_intro",
      "review_previous_season",
      "review_last_matchday",
      "scouting_facilities",
      "review_matchday_results",
      "open_season_standings",
    ]);
    if (!acknowledgeableStepIds.has(stepId)) {
      return;
    }
    setAcknowledgedFlowStepIds((current) => {
      if (current.has(stepId)) {
        return current;
      }
      const next = new Set(current);
      next.add(stepId);
      return next;
    });
  };

  return {
    gameFlowState,
    gameInboxItems,
    activeTeamInboxItems,
    activeTeamOpenInboxItems,
    activeTeamDecisionInboxItems,
    activeTeamChronicleInboxItems,
    activeTeamDecisionCriticalInboxItems,
    foundationNavAttention,
    focusMatchdayLoop,
    inboxPrimaryTeamItem,
    gameFlowActionStep,
    matchdayArenaReadiness,
    matchdayArenaBlockerSummary,
    transferWindowHint,
    flowOverrideInboxItem,
    primaryInboxItem,
    foundationWarningInboxItems,
    acknowledgedFlowStepIds,
    setAcknowledgedFlowStepIds,
    acknowledgeFlowStep,
  };
}
