import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { isTeamTrainingComplete } from "@/lib/foundation/team-training-status";

function stateWith(trainingModes: Array<string | null>): GameState {
  return {
    players: trainingModes.map((mode, index) => ({ id: `p-${index}`, trainingMode: mode })),
    rosters: trainingModes.map((_, index) => ({ teamId: "M-M", playerId: `p-${index}` })),
  } as unknown as GameState;
}

describe("isTeamTrainingComplete", () => {
  it("is true only when every roster player has a training mode", () => {
    expect(isTeamTrainingComplete(stateWith(["balanced", "offense"]), "M-M")).toBe(true);
    expect(isTeamTrainingComplete(stateWith(["balanced", null]), "M-M")).toBe(false);
  });

  it("is false for an empty roster or missing team", () => {
    expect(isTeamTrainingComplete(stateWith([]), "M-M")).toBe(false);
    expect(isTeamTrainingComplete(stateWith(["balanced"]), null)).toBe(false);
  });
});
