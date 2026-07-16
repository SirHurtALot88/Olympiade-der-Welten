import type { GameState } from "@/lib/data/olyDataTypes";
import type { ResolvePreviewStatus } from "@/lib/resolve/legacy-matchday-resolve-types";
import type { GameFlowStep } from "@/lib/foundation/game-flow-controller";
import {
  formatLineupOperationalGapDetail,
  getMatchdayArenaReadiness,
  type MatchdayArenaBlockerReason,
} from "@/lib/foundation/matchday-arena-readiness";

export type MatchdayArenaBlockerSummary = {
  reasons: string[];
  primaryReason: string | null;
  detail: string | null;
  isArenaReady: boolean;
  arenaBlocker: MatchdayArenaBlockerReason;
};

function resolvePreviewStatusToBlockers(status: ResolvePreviewStatus | null | undefined): string[] {
  if (!status || status === "ready") {
    return [];
  }
  return [`resolve_status:${status}`];
}

export function buildMatchdayArenaBlockerSummary(input: {
  gameState: GameState;
  activeTeamId: string | null;
  flowStep?: Pick<GameFlowStep, "stepId" | "blockers" | "status"> | null;
  resolvePreviewStatus?: ResolvePreviewStatus | null;
}): MatchdayArenaBlockerSummary {
  const readiness = getMatchdayArenaReadiness(input.gameState, input.activeTeamId);
  const flowBlockers =
    input.flowStep &&
    (input.flowStep.stepId === "open_arena" || input.flowStep.stepId === "run_reveal") &&
    input.flowStep.status === "blocked"
      ? input.flowStep.blockers
      : [];
  const resolveBlockers = resolvePreviewStatusToBlockers(input.resolvePreviewStatus);

  const reasons = Array.from(
    new Set(
      [
        ...(readiness.blocker ? [readiness.blocker] : []),
        ...flowBlockers.filter((blocker) => blocker !== readiness.blocker),
        ...resolveBlockers,
      ].filter(Boolean),
    ),
  );

  const primaryReason = reasons[0] ?? null;
  const detail = formatLineupOperationalGapDetail(readiness);

  return {
    reasons,
    primaryReason,
    detail,
    isArenaReady: readiness.isReady && resolveBlockers.length === 0,
    arenaBlocker: readiness.blocker,
  };
}
