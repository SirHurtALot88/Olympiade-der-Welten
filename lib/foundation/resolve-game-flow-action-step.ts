import type { GameFlowStep } from "@/lib/foundation/game-flow-controller";

const POST_MATCHDAY_ACK_STEP_IDS = ["review_matchday_results", "open_season_standings"] as const;

function isReadyLike(step: GameFlowStep) {
  return step.status === "ready" || step.status === "warning" || step.status === "blocked";
}

export function resolveGameFlowActionStep(
  actionableSteps: GameFlowStep[],
  fallbackStep: GameFlowStep,
  acknowledgedFlowStepIds: ReadonlySet<string>,
): GameFlowStep {
  const readyLike = actionableSteps.filter(isReadyLike);
  const optional = actionableSteps.filter((step) => step.status === "optional");

  const postMatchdayAckDone = POST_MATCHDAY_ACK_STEP_IDS.every((stepId) => acknowledgedFlowStepIds.has(stepId));
  const facilitiesOptional = optional.find((step) => step.stepId === "matchday_facilities");
  const facilitiesPending =
    facilitiesOptional != null && !acknowledgedFlowStepIds.has("matchday_facilities");

  if (postMatchdayAckDone && facilitiesPending) {
    return facilitiesOptional;
  }

  const advanceStep = readyLike.find((step) => step.stepId === "advance_to_next_matchday");
  const nonAdvanceReady = readyLike.filter((step) => step.stepId !== "advance_to_next_matchday");

  if (nonAdvanceReady.length > 0) {
    return nonAdvanceReady[0]!;
  }

  if (advanceStep) {
    return advanceStep;
  }

  if (optional.length > 0) {
    return optional[0]!;
  }

  return fallbackStep;
}
