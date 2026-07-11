import type { Dispatch, MutableRefObject, SetStateAction } from "react";

import type {
  GameState,
  NewGameFlowStepId,
  NewGameFlowStepStatus,
  Team,
} from "@/lib/data/olyDataTypes";
import type { GameFlowView } from "@/lib/foundation/game-flow-controller";
import type { FoundationReadMeta, FoundationView } from "@/lib/foundation/tabs/foundation-page-types";
import {
  buildSeasonBriefingDismissKey,
  clearSeasonBriefingDismissedFromStorage,
  resolveFoundationTeamId,
  scrollToFoundationTarget,
} from "@/lib/foundation/tabs/foundation-page-module-helpers";
import { SEASON_SETUP_STEP_IDS } from "@/lib/foundation/tabs/foundation-page-types";

export type FoundationNewGameFlowHandlersDeps = {
  readMeta: FoundationReadMeta;
  showReadOnlyNotice: () => void;
  skipNextFullPersistCountRef: MutableRefObject<number>;
  persistNewGameFlowStepStatus: (stepId: NewGameFlowStepId, status: NewGameFlowStepStatus) => Promise<void>;
  setGameState: Dispatch<SetStateAction<GameState>>;
  selectedTeamId: string | null;
  gameState: GameState;
  activeSaveId: string;
  activeManagerTeamId: string | null;
  setActiveManagerTeam: (teamId: string, source?: "manual_select") => void;
  setFoundationView: (view: FoundationView, setActiveView: (view: FoundationView) => void) => void;
  setActiveView: (view: FoundationView) => void;
  seasonBriefingDismissedRef: MutableRefObject<Set<string>>;
  seasonBriefingAutoOpenedRef: MutableRefObject<string | null>;
  openSeasonBriefingPanel: (options?: { push?: boolean }) => void;
  navigateHomeTab: (tab: "overview" | "office") => void;
  setSelectedTeamDetailTab: (tab: "roster" | "contracts") => void;
  selectedTeam: Team | null;
  setMarketTeamId: Dispatch<SetStateAction<string | null>>;
  setMarketSearch: Dispatch<SetStateAction<string>>;
  setMarketClassFilter: Dispatch<SetStateAction<string>>;
  setMarketRaceFilter: Dispatch<SetStateAction<string>>;
  setMarketSubclassFilter: Dispatch<SetStateAction<string>>;
  setMarketAlignmentFilter: Dispatch<SetStateAction<string>>;
  setMarketGenderFilter: Dispatch<SetStateAction<string>>;
  setMarketPositiveTraitFilter: Dispatch<SetStateAction<string>>;
  setMarketNegativeTraitFilter: Dispatch<SetStateAction<string>>;
  setMarketBracketFilter: Dispatch<SetStateAction<string>>;
  setMarketMaxValue: Dispatch<SetStateAction<number>>;
  marketValueFilterManualRef: MutableRefObject<boolean>;
  setMarketMaxSalary: Dispatch<SetStateAction<number>>;
  setMarketMinRatio: Dispatch<SetStateAction<number>>;
  setMarketMinPow: Dispatch<SetStateAction<number>>;
  setMarketMinSpe: Dispatch<SetStateAction<number>>;
  setMarketMinMen: Dispatch<SetStateAction<number>>;
  setMarketMinSoc: Dispatch<SetStateAction<number>>;
  setMarketShowAutoAnalysis: Dispatch<SetStateAction<boolean>>;
  openPrizeFinanceView: (options?: { tab?: "sponsors" | "prize"; push?: boolean }) => void;
  navigateToGameFlowStep: (targetView: GameFlowView, teamId?: string | null, targetPanel?: string | null) => void;
};

export type FoundationNewGameFlowHandlers = {
  updateNewGameFlowStepStatus: (stepId: NewGameFlowStepId, status: NewGameFlowStepStatus) => void;
  dismissNewGameFlow: () => void;
  navigateSeasonSetupStep: (stepId: NewGameFlowStepId) => void;
};

export function createFoundationNewGameFlowHandlers(
  deps: FoundationNewGameFlowHandlersDeps,
): FoundationNewGameFlowHandlers {
  const updateNewGameFlowStepStatus = (stepId: NewGameFlowStepId, status: NewGameFlowStepStatus) => {
    if (deps.readMeta.readOnly) {
      deps.showReadOnlyNotice();
      return;
    }

    const now = new Date().toISOString();
    deps.skipNextFullPersistCountRef.current += 1;
    void deps.persistNewGameFlowStepStatus(stepId, status).catch((error) => {
      console.error(error);
      deps.skipNextFullPersistCountRef.current = Math.max(0, deps.skipNextFullPersistCountRef.current - 1);
    });
    deps.setGameState((current) => {
      const previous = current.seasonState.newGameFlow ?? {
        active: true,
        selectedTeamId: deps.selectedTeamId,
        steps: [],
      };
      const nextSteps = SEASON_SETUP_STEP_IDS.map((id) => {
        const stored = previous.steps?.find((step) => step.stepId === id);
        if (id !== stepId) {
          return stored ?? { stepId: id, status: "open" as const };
        }

        return {
          stepId: id,
          status,
          completedAt: status === "completed" ? now : stored?.completedAt ?? null,
          skippedAt: status === "skipped" ? now : stored?.skippedAt ?? null,
        };
      });
      const isHandled = nextSteps.every((step) => step.status === "completed" || step.status === "skipped");

      return {
        ...current,
        seasonState: {
          ...current.seasonState,
          newGameFlow: {
            ...previous,
            active: true,
            dismissed: false,
            selectedTeamId: deps.selectedTeamId ?? previous.selectedTeamId ?? null,
            steps: nextSteps,
            updatedAt: now,
            completedAt: isHandled ? previous.completedAt ?? now : previous.completedAt ?? null,
          },
        },
      };
    });
  };

  const dismissNewGameFlow = () => {
    if (deps.readMeta.readOnly) {
      deps.showReadOnlyNotice();
      return;
    }

    const now = new Date().toISOString();
    deps.setGameState((current) => ({
      ...current,
      seasonState: {
        ...current.seasonState,
        newGameFlow: {
          ...(current.seasonState.newGameFlow ?? { steps: [] }),
          active: false,
          dismissed: true,
          selectedTeamId: deps.selectedTeamId ?? current.seasonState.newGameFlow?.selectedTeamId ?? null,
          updatedAt: now,
        },
      },
    }));
  };

  const navigateSeasonSetupStep = (stepId: NewGameFlowStepId) => {
    const targetTeamId =
      resolveFoundationTeamId(
        deps.gameState.teams,
        deps.gameState.seasonState.newGameFlow?.selectedTeamId ?? deps.selectedTeamId ?? deps.activeManagerTeamId,
      ) ?? deps.activeManagerTeamId;
    if (targetTeamId && targetTeamId !== deps.activeManagerTeamId) {
      deps.setActiveManagerTeam(targetTeamId, "manual_select");
    }

    if (stepId === "season_intro") {
      const briefingKey = buildSeasonBriefingDismissKey(deps.activeSaveId, deps.gameState.season.id);
      deps.seasonBriefingDismissedRef.current.delete(briefingKey);
      clearSeasonBriefingDismissedFromStorage(deps.activeSaveId, deps.gameState.season.id);
      deps.seasonBriefingAutoOpenedRef.current = null;
      deps.setFoundationView("homeV2", deps.setActiveView);
      deps.openSeasonBriefingPanel();
      scrollToFoundationTarget("foundation-home");
      return;
    }

    if (stepId === "team_confirm") {
      deps.setFoundationView("homeV2", deps.setActiveView);
      scrollToFoundationTarget("foundation-home");
      return;
    }

    if (stepId === "roster_review") {
      deps.setSelectedTeamDetailTab("roster");
      deps.setFoundationView("teams", deps.setActiveView);
      scrollToFoundationTarget("team-focus-roster");
      return;
    }

    if (stepId === "appoint_captain") {
      deps.navigateHomeTab("office");
      scrollToFoundationTarget("foundation-hq-captain-picker");
      return;
    }

    if (stepId === "first_transfers" || stepId === "fill_roster") {
      const targetTeam = deps.gameState.teams.find((team) => team.teamId === targetTeamId) ?? deps.selectedTeam;
      const cashBudget = Math.max(12, Math.min(150, Math.floor(((targetTeam?.cash ?? 40) * 0.65))));
      deps.setMarketTeamId(targetTeamId);
      deps.setMarketSearch("");
      deps.setMarketClassFilter("ALL");
      deps.setMarketRaceFilter("ALL");
      deps.setMarketSubclassFilter("ALL");
      deps.setMarketAlignmentFilter("ALL");
      deps.setMarketGenderFilter("ALL");
      deps.setMarketPositiveTraitFilter("ALL");
      deps.setMarketNegativeTraitFilter("ALL");
      deps.setMarketBracketFilter("ALL");
      deps.setMarketMaxValue(cashBudget);
      deps.marketValueFilterManualRef.current = true;
      deps.setMarketMaxSalary(40);
      deps.setMarketMinRatio(stepId === "first_transfers" ? 3 : 2);
      deps.setMarketMinPow(1);
      deps.setMarketMinSpe(1);
      deps.setMarketMinMen(1);
      deps.setMarketMinSoc(1);
      deps.setMarketShowAutoAnalysis(true);
      deps.setFoundationView("marketV2", deps.setActiveView);
      scrollToFoundationTarget("transfer-market");
      return;
    }

    if (stepId === "training_facilities") {
      deps.setFoundationView("scoutingCenterV2", deps.setActiveView);
      scrollToFoundationTarget("foundation-scouting-hub-v2");
      return;
    }

    if (stepId === "choose_sponsor") {
      deps.openPrizeFinanceView({ tab: "sponsors" });
      return;
    }

    deps.navigateToGameFlowStep("lineup", targetTeamId);
  };

  return { updateNewGameFlowStepStatus, dismissNewGameFlow, navigateSeasonSetupStep };
}
