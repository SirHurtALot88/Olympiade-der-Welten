import type { Dispatch, SetStateAction } from "react";

import type { GameInboxItem, GameState } from "@/lib/data/olyDataTypes";
import type { GameFlowStepStatus, GameFlowView } from "@/lib/foundation/game-flow-controller";
import { formatGameFlowBlockerList } from "@/lib/foundation/game-flow-blocker-labels";
import type { FoundationReadMeta, FoundationView } from "@/lib/foundation/tabs/foundation-page-types";
import { getGameFlowStatusClass } from "@/lib/foundation/tabs/cockpit-ui-helpers";

export type FoundationGlobalNextUiInput = {
  primaryInboxItem: GameInboxItem | null;
  gameFlowActionStep: {
    stepId?: string;
    label: string;
    status: GameFlowStepStatus;
    blockers: string[];
    optional?: boolean;
  };
  cockpitBusyKey: string | null;
  seasonTransitionBusy: boolean;
  matchdayArenaBlockerSummary: { reasons: string[] };
  transferWindowHint: { open: boolean; label: string };
};

export type FoundationGlobalNextUi = {
  globalNextDisabled: boolean;
  globalNextLabel: string;
  globalNextTitle: string;
  globalNextStatusClass: string;
};

export function deriveGlobalNextUi(input: FoundationGlobalNextUiInput): FoundationGlobalNextUi {
  const globalNextDisabled = input.primaryInboxItem
    ? false
    : input.gameFlowActionStep.status === "applying" ||
      input.cockpitBusyKey != null ||
      input.seasonTransitionBusy;
  const globalNextLabel = input.primaryInboxItem?.title ?? input.gameFlowActionStep.label;
  const globalNextTitle = input.primaryInboxItem
    ? `${input.primaryInboxItem.title}: ${input.primaryInboxItem.description}`
    : input.gameFlowActionStep.status === "blocked"
      ? formatGameFlowBlockerList(
          input.matchdayArenaBlockerSummary.reasons.length > 0
            ? input.matchdayArenaBlockerSummary.reasons
            : input.gameFlowActionStep.blockers,
        ) || "Leertaste: zum blockierten Schritt springen"
      : globalNextDisabled
        ? "Aktion laeuft gerade."
        : input.gameFlowActionStep.status === "optional" &&
            (input.gameFlowActionStep.stepId === "matchday_facilities" || input.gameFlowActionStep.stepId === "facilities")
          ? "Leertaste: optional prüfen oder überspringen"
          : input.transferWindowHint.open
          ? `Leertaste: Weiter · ${input.transferWindowHint.label}`
          : "Leertaste: Weiter";
  const globalNextStatusClass = input.primaryInboxItem
    ? input.primaryInboxItem.severity === "critical"
      ? "is-blocked"
      : input.primaryInboxItem.severity === "warning"
        ? "is-warning"
        : "is-ready"
    : getGameFlowStatusClass(input.gameFlowActionStep.status);

  return {
    globalNextDisabled,
    globalNextLabel,
    globalNextTitle,
    globalNextStatusClass,
  };
}

export type UpdateInboxItemStatusDeps = {
  readMeta: FoundationReadMeta;
  showReadOnlyNotice: () => void;
  gameState: GameState;
  setGameState: Dispatch<SetStateAction<GameState>>;
  activeSaveId: string;
  persistLocalGameStateImmediately: (nextGameState: GameState) => Promise<void>;
};

export function createUpdateInboxItemStatus(deps: UpdateInboxItemStatusDeps) {
  return (item: GameInboxItem, status: GameInboxItem["status"]) => {
    if (deps.readMeta.readOnly) {
      deps.showReadOnlyNotice();
      return;
    }

    const existingItems = deps.gameState.gameInboxItems ?? [];
    const hasStoredItem = existingItems.some((entry) => entry.itemId === item.itemId);
    const nextItems = hasStoredItem
      ? existingItems.map((entry) => (entry.itemId === item.itemId ? { ...entry, status } : entry))
      : [...existingItems, { ...item, status }];
    const nextGameState = {
      ...deps.gameState,
      gameInboxItems: nextItems,
    };

    deps.setGameState(nextGameState);
    if (deps.readMeta.source !== "prisma" && !deps.readMeta.readOnly && deps.activeSaveId !== "loading-save") {
      void deps.persistLocalGameStateImmediately(nextGameState).catch((error) => {
        console.error(error);
      });
    }
  };
}

export type TriggerGlobalNextDeps = {
  activeView: FoundationView;
  activeManagerTeamId: string | null;
  activeManagerMatchdayReady: boolean;
  homeNextMatchdayStatus: { resultAvailable: boolean };
  primaryInboxItem: GameInboxItem | null;
  globalNextDisabled: boolean;
  gameFlowActionStep: {
    stepId: string;
    status: GameFlowStepStatus;
    targetView: GameFlowView;
    teamId?: string | null;
    targetPanel?: string | null;
  };
  navigateToInboxItem: (item: GameInboxItem) => void;
  navigateToGameFlowStep: (
    targetView: GameFlowView,
    teamId?: string | null,
    targetPanel?: string | null,
  ) => void;
  resolveLineupIssueTeamId: (preferredTeamId?: string | null) => string | null;
  setFoundationView: (view: FoundationView, setActiveView: (view: FoundationView) => void) => void;
  setActiveView: (view: FoundationView) => void;
  setShowGameFlowPanel: (show: boolean) => void;
  matchdayArenaApplyHandlers: {
    runCockpitMatchdayAdvance?: (fromGlobalNext?: boolean) => Promise<{ applied?: boolean } | null | undefined>;
  } | null;
  setAcknowledgedFlowStepIds: Dispatch<SetStateAction<Set<string>>>;
  updateNewGameFlowStepStatus: (stepId: "training_facilities", status: "completed") => void;
  acknowledgeFlowStep: (stepId: string) => void;
};

export function createTriggerGlobalNext(deps: TriggerGlobalNextDeps) {
  return async () => {
    if (deps.activeView === "matchdayArena" && !deps.activeManagerMatchdayReady) {
      const lineupInboxItem =
        deps.primaryInboxItem?.itemId.startsWith("lineup_missing:") ? deps.primaryInboxItem : null;
      if (lineupInboxItem) {
        deps.navigateToInboxItem(lineupInboxItem);
      } else {
        deps.navigateToGameFlowStep("lineup", deps.resolveLineupIssueTeamId(deps.activeManagerTeamId));
      }
      return;
    }
    if (
      deps.activeView === "lineup" &&
      deps.activeManagerMatchdayReady &&
      !deps.homeNextMatchdayStatus.resultAvailable &&
      deps.primaryInboxItem?.itemId.startsWith("lineup_missing:")
    ) {
      deps.setFoundationView("matchdayArena", deps.setActiveView);
      return;
    }
    if (deps.primaryInboxItem) {
      deps.navigateToInboxItem(deps.primaryInboxItem);
      return;
    }
    if (deps.globalNextDisabled) {
      deps.setShowGameFlowPanel(true);
      return;
    }
    if (deps.gameFlowActionStep.stepId === "advance_to_next_matchday" && deps.gameFlowActionStep.status === "ready") {
      const result = await deps.matchdayArenaApplyHandlers?.runCockpitMatchdayAdvance?.(true);
      if (result?.applied) {
        deps.setAcknowledgedFlowStepIds(new Set());
      } else {
        deps.setShowGameFlowPanel(true);
      }
      return;
    }
    if (deps.gameFlowActionStep.stepId === "scouting_facilities") {
      deps.updateNewGameFlowStepStatus("training_facilities", "completed");
    }
    deps.navigateToGameFlowStep(
      deps.gameFlowActionStep.targetView,
      deps.gameFlowActionStep.teamId,
      deps.gameFlowActionStep.targetPanel,
    );
    deps.acknowledgeFlowStep(deps.gameFlowActionStep.stepId);
  };
}
