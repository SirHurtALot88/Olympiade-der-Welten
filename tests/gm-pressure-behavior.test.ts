import { describe, expect, it } from "vitest";

import type { GameState, Team } from "@/lib/data/olyDataTypes";
import {
  applyGmPressureDemandConcession,
  resolveGmPressureBehavior,
  type GmPressureBehavior,
} from "@/lib/foundation/gm-pressure-behavior";
import { applyTransferBalanceRiskToReplacementProbability } from "@/lib/foundation/team-general-managers";

function createPressure(partial?: Partial<GmPressureBehavior>): GmPressureBehavior {
  return {
    pressureLevel: partial?.pressureLevel ?? "hot",
    isHotSeat: partial?.isHotSeat ?? true,
    concedeDemandsMultiplier: partial?.concedeDemandsMultiplier ?? 1.4,
    chaseBoardObjectivesMultiplier: partial?.chaseBoardObjectivesMultiplier ?? 1.4,
    sellCoreUnderPressure: partial?.sellCoreUnderPressure ?? false,
    acceptPlayerDemandsUnderPressure: partial?.acceptPlayerDemandsUnderPressure ?? true,
    warning: partial?.warning ?? null,
    softBlockStarSell: partial?.softBlockStarSell ?? false,
    detail: partial?.detail ?? "",
  };
}

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

describe("applyGmPressureDemandConcession", () => {
  it("concedes more with a higher concedeDemandsMultiplier (graduated, not on/off)", () => {
    const base = 0.4;
    const lowMultiplier = applyGmPressureDemandConcession({
      baseScore: base,
      pressure: createPressure({ concedeDemandsMultiplier: 1.1 }),
      demandPriority: "high",
    });
    const highMultiplier = applyGmPressureDemandConcession({
      baseScore: base,
      pressure: createPressure({ concedeDemandsMultiplier: 1.7 }),
      demandPriority: "high",
    });

    expect(lowMultiplier).toBeGreaterThan(base);
    expect(highMultiplier).toBeGreaterThan(lowMultiplier);
  });

  it("scales concession by demand priority", () => {
    const pressure = createPressure({ concedeDemandsMultiplier: 1.6 });
    const low = applyGmPressureDemandConcession({ baseScore: 0.3, pressure, demandPriority: "low" });
    const high = applyGmPressureDemandConcession({ baseScore: 0.3, pressure, demandPriority: "high" });

    expect(high).toBeGreaterThan(low);
  });

  it("is a no-op when the GM is not conceding under pressure", () => {
    const result = applyGmPressureDemandConcession({
      baseScore: 0.55,
      pressure: createPressure({ acceptPlayerDemandsUnderPressure: false, concedeDemandsMultiplier: 1.7 }),
      demandPriority: "high",
    });

    expect(result).toBe(0.55);
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
