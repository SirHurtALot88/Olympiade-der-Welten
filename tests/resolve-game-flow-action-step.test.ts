import { describe, expect, it } from "vitest";

import type { GameFlowStep } from "@/lib/foundation/game-flow-controller";
import { resolveGameFlowActionStep } from "@/lib/foundation/resolve-game-flow-action-step";

function step(partial: Partial<GameFlowStep> & Pick<GameFlowStep, "stepId" | "status">): GameFlowStep {
  return {
    label: partial.stepId,
    cta: partial.stepId,
    targetView: "home",
    blockers: [],
    warnings: [],
    ...partial,
  };
}

describe("resolveGameFlowActionStep", () => {
  it("offers optional facilities after post-matchday acknowledgements", () => {
    const facilities = step({ stepId: "matchday_facilities", status: "optional" });
    const advance = step({ stepId: "advance_to_next_matchday", status: "ready" });
    const acknowledged = new Set(["review_matchday_results", "open_season_standings"]);
    const fallback = step({ stepId: "review_matchday_results", status: "ready" });

    expect(resolveGameFlowActionStep([advance, facilities], fallback, acknowledged)).toBe(facilities);
  });

  it("prefers non-advance ready steps before advance", () => {
    const standings = step({ stepId: "open_season_standings", status: "ready" });
    const advance = step({ stepId: "advance_to_next_matchday", status: "ready" });
    const fallback = standings;

    expect(resolveGameFlowActionStep([advance, standings], fallback, new Set())).toBe(standings);
  });

  it("skips facilities when already acknowledged", () => {
    const facilities = step({ stepId: "matchday_facilities", status: "optional" });
    const advance = step({ stepId: "advance_to_next_matchday", status: "ready" });
    const acknowledged = new Set([
      "review_matchday_results",
      "open_season_standings",
      "matchday_facilities",
    ]);

    expect(resolveGameFlowActionStep([advance, facilities], advance, acknowledged)).toBe(advance);
  });
});
