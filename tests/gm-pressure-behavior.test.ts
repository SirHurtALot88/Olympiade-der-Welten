import { describe, expect, it } from "vitest";

import type { GameState, Team } from "@/lib/data/olyDataTypes";
import { resolveGmPressureBehavior } from "@/lib/foundation/gm-pressure-behavior";
import { applyTransferBalanceRiskToReplacementProbability } from "@/lib/foundation/team-general-managers";

function createTeam(partial?: Partial<Team>): Team {
  return {
    teamId: partial?.teamId ?? "A-A",
    shortCode: partial?.shortCode ?? "A-A",
    name: partial?.name ?? "Team A",
    budget: partial?.budget ?? 100,
    cash: partial?.cash ?? 100,
    identityId: partial?.identityId ?? "A-A",
    humanControlled: partial?.humanControlled ?? true,
    rosterLimit: partial?.rosterLimit ?? 12,
  };
}

describe("gm-pressure-behavior", () => {
  it("escalates demand concession under hot-seat pressure", () => {
    const gameState = {
      season: { id: "season-2" },
      teams: [createTeam()],
      teamIdentities: [
        {
          teamId: "A-A",
          pow: 5,
          spe: 5,
          men: 5,
          soc: 5,
          ambition: 8,
          finances: 4,
          boardConfidence: 2,
          harmony: 4,
          manners: 5,
          popularity: 5,
          cooperation: 5,
          playerMin: 7,
          playerOpt: 10,
        },
      ],
      seasonState: {
        teamGeneralManagers: {
          "A-A": {
            teamId: "A-A",
            gmId: "gm-culture-keeper-01",
            assignedSeasonId: "season-2",
            influencePct: 30,
            source: "human_slot",
          },
        },
      },
    } as GameState;

    const behavior = resolveGmPressureBehavior(gameState, "A-A");
    expect(behavior.pressureLevel).not.toBe("stable");
    expect(behavior.concedeDemandsMultiplier).toBeGreaterThan(1);
    expect(behavior.chaseBoardObjectivesMultiplier).toBeGreaterThan(1);
  });
});

describe("applyTransferBalanceRiskToReplacementProbability", () => {
  it("raises replacement probability for churn without replacement under hot seat", () => {
    const boosted = applyTransferBalanceRiskToReplacementProbability(0.6, {
      sellCount: 3,
      buyCount: 0,
      netTransferCash: 40,
      isHotSeat: true,
    });
    expect(boosted).toBeGreaterThan(0.6);
  });
});
