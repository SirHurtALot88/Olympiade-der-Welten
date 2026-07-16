import { describe, expect, it } from "vitest";

import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import { evaluateAiNeeds } from "@/lib/ai/aiNeedsEngine";

describe("ai needs engine", () => {
  it("detects roster and discipline needs", () => {
    const gameState = createSingleplayerGameState();
    const summary = evaluateAiNeeds(gameState, "B-B");

    expect(summary.teamId).toBe("B-B");
    expect(summary.topNeedDisciplineIds.length).toBeGreaterThan(0);
    expect(summary.overallNeedScore).toBeGreaterThanOrEqual(0);
    expect(summary.uncoveredNeedAxes.length).toBeGreaterThanOrEqual(0);
  });
});
