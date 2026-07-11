import { describe, expect, it } from "vitest";

import { buildLeagueMarketBrackets } from "@/lib/ai/market-pick-engine/market-brackets";
import {
  buildSlotPickBriefs,
  scoreEnvelopeSpreadFit,
  scoreSlotPurposeMatch,
} from "@/lib/ai/slot-pick-brief-service";
import type { Player } from "@/lib/data/olyDataTypes";

const brackets = buildLeagueMarketBrackets([12, 18, 22, 28, 35, 42, 48, 55, 62, 72, 95, 110]);

function mockPlayer(overrides: Partial<Player> & { id: string }): Player {
  return {
    id: overrides.id,
    name: overrides.name ?? overrides.id,
    className: overrides.className ?? "Sprinter",
    race: overrides.race ?? "Human",
    coreStats: { pow: 50, spe: 50, men: 50, soc: 50, ...(overrides.coreStats ?? {}) },
    disciplineRatings: overrides.disciplineRatings ?? {},
    traitsPositive: [],
    traitsNegative: [],
    marketValue: overrides.marketValue ?? 30,
    salary: overrides.salary ?? 5,
    ovr: overrides.ovr ?? 70,
    mvs: overrides.mvs ?? 70,
    formColor: overrides.formColor ?? "green",
    teamId: overrides.teamId ?? null,
  } as Player;
}

describe("buildSlotPickBriefs", () => {
  it("assigns axis purpose labels per lane (Speed core, Power allrounder star)", () => {
    const briefs = buildSlotPickBriefs({
      slotPlan: ["core", "star", "depth"],
      brackets,
      sortedAxes: [
        { axis: "spe", weight: 12 },
        { axis: "pow", weight: 10 },
        { axis: "men", weight: 6 },
        { axis: "soc", weight: 4 },
      ],
      topNeedDisciplineIds: ["sprint_100m"],
    });

    expect(briefs).toHaveLength(3);
    expect(briefs[0]?.purposeLabel).toContain("Speed");
    expect(briefs[0]?.purposeLabel).toContain("Core");
    expect(briefs[0]?.primaryAxis).toBe("spe");
    expect(briefs[1]?.purposeLabel).toContain("Power");
    expect(briefs[1]?.purposeLabel).toContain("Allrounder");
    expect(briefs[1]?.bracket).toBe("Star");
    expect(briefs[1]?.secondaryAxis).toBe("men");
  });

  it("uses envelope target MW when provided", () => {
    const briefs = buildSlotPickBriefs({
      slotPlan: ["core"],
      envelopeSlots: [{ lane: "core", targetMw: 42, floorMw: 30, ceilingMw: 55 }],
      brackets,
      sortedAxes: [{ axis: "pow", weight: 10 }],
      topNeedDisciplineIds: [],
    });
    expect(briefs[0]?.targetMw).toBe(42);
    expect(briefs[0]?.ceilingMw).toBe(55);
  });
});

describe("scoreSlotPurposeMatch", () => {
  it("rewards speed sprinter for spe core brief", () => {
    const brief = buildSlotPickBriefs({
      slotPlan: ["core"],
      brackets,
      sortedAxes: [{ axis: "spe", weight: 12 }],
      topNeedDisciplineIds: [],
    })[0]!;
    const sprinter = mockPlayer({
      id: "sprinter",
      className: "Sprinter",
      coreStats: { spe: 62, pow: 44, men: 40, soc: 38 },
    });
    const power = mockPlayer({
      id: "power",
      className: "Tank",
      coreStats: { spe: 38, pow: 62, men: 40, soc: 38 },
    });
    expect(scoreSlotPurposeMatch({ brief, player: sprinter, candidateAxis: "spe" })).toBeGreaterThan(
      scoreSlotPurposeMatch({ brief, player: power, candidateAxis: "pow" }),
    );
  });

  it("rewards allrounder spread for star brief with two axes", () => {
    const brief = buildSlotPickBriefs({
      slotPlan: ["star"],
      brackets,
      sortedAxes: [
        { axis: "pow", weight: 12 },
        { axis: "men", weight: 10 },
        { axis: "spe", weight: 6 },
        { axis: "soc", weight: 4 },
      ],
      topNeedDisciplineIds: [],
    })[0]!;
    const allrounder = mockPlayer({
      id: "ar",
      coreStats: { pow: 60, men: 58, spe: 45, soc: 42 },
    });
    const oneTrick = mockPlayer({
      id: "ot",
      coreStats: { pow: 72, men: 38, spe: 40, soc: 40 },
    });
    expect(scoreSlotPurposeMatch({ brief, player: allrounder, candidateAxis: "pow" })).toBeGreaterThan(
      scoreSlotPurposeMatch({ brief, player: oneTrick, candidateAxis: "pow" }),
    );
  });
});

describe("scoreEnvelopeSpreadFit", () => {
  it("prefers price near target without blocking expensive picks entirely", () => {
    const brief = buildSlotPickBriefs({
      slotPlan: ["star"],
      envelopeSlots: [{ lane: "star", targetMw: 55, floorMw: 40, ceilingMw: 85 }],
      brackets,
      sortedAxes: [{ axis: "pow", weight: 10 }],
      topNeedDisciplineIds: [],
    })[0]!;
    const onTarget = scoreEnvelopeSpreadFit({ price: 54, brief, slotsRemaining: 3 });
    const expensive = scoreEnvelopeSpreadFit({ price: 95, brief, slotsRemaining: 3 });
    expect(onTarget).toBeGreaterThan(expensive);
    expect(expensive).toBeGreaterThan(-8);
  });
});
