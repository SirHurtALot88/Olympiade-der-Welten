import { describe, expect, it } from "vitest";

import { evaluateAiNeeds } from "@/lib/ai/aiNeedsEngine";
import type { GameState } from "@/lib/data/olyDataTypes";

function buildMinimalGameState(disciplines: GameState["disciplines"]): GameState {
  return {
    teams: [
      {
        teamId: "A-A",
        name: "Team A",
        shortCode: "AA",
        budget: 1000,
        cash: 500,
        rosterLimit: 12,
      },
    ],
    teamIdentities: [
      {
        teamId: "A-A",
        playerOpt: 12,
        pow: 25,
        spe: 25,
        men: 25,
        soc: 25,
      },
    ],
    rosters: [],
    players: [],
    disciplines,
  } as unknown as GameState;
}

describe("evaluateAiNeeds", () => {
  it("handles teams with no disciplines without throwing", () => {
    const summary = evaluateAiNeeds(buildMinimalGameState([]), "A-A");
    expect(summary.teamId).toBe("A-A");
    expect(Number.isFinite(summary.overallNeedScore)).toBe(true);
    expect(summary.topNeedDisciplineIds).toEqual([]);
  });
});
