import { describe, expect, it } from "vitest";

import { computePlayerQuality } from "@/lib/ai/organic-squad/quality";
import { marginalCoverageValue } from "@/lib/ai/organic-squad/coverage-curve";
import {
  computeDisciplineNeeds,
  deriveNeedAxisWeights,
} from "@/lib/ai/organic-squad/discipline-need";
import type {
  CoreAxis,
  OrganicDiscipline,
  OrganicPlayerView,
} from "@/lib/ai/organic-squad/types";

function makePlayer(overrides: Partial<OrganicPlayerView> = {}): OrganicPlayerView {
  return {
    playerId: "p1",
    pow: 60,
    spe: 60,
    men: 60,
    soc: 60,
    disciplineRatings: {},
    marketValue: 1000,
    salary: 100,
    ...overrides,
  };
}

const EVEN_WEIGHTS: Record<CoreAxis, number> = { pow: 0.25, spe: 0.25, men: 0.25, soc: 0.25 };

describe("computePlayerQuality", () => {
  it("scores a needed-axis specialist strictly higher than a flat player", () => {
    const flatPlayer = makePlayer();

    const strongPlayer = makePlayer({
      pow: 90,
      spe: 90,
      disciplineRatings: {
        d1: 85,
        d2: 82,
        d3: 90,
      },
    });

    const needAxisWeights: Record<CoreAxis, number> = { pow: 0.5, spe: 0.5, men: 0, soc: 0 };

    const flatQuality = computePlayerQuality(flatPlayer, needAxisWeights);
    const strongQuality = computePlayerQuality(strongPlayer, needAxisWeights);

    expect(strongQuality).toBeGreaterThan(flatQuality);
  });

  it("never reads mvs/ovr/marketValue as quality (flat stats + high marketValue stays flat)", () => {
    const cheapFlatPlayer = makePlayer({ marketValue: 1 });
    const expensiveFlatPlayer = makePlayer({ marketValue: 999_999 });

    expect(computePlayerQuality(cheapFlatPlayer, EVEN_WEIGHTS)).toBeCloseTo(
      computePlayerQuality(expensiveFlatPlayer, EVEN_WEIGHTS),
    );
  });

  it("defensively normalizes needAxisWeights that don't sum to 1", () => {
    const player = makePlayer({ pow: 80, spe: 40, men: 40, soc: 40 });

    // Weights sum to 2 (double the intended scale); should behave like the normalized {pow:1}.
    const skewedWeights: Record<CoreAxis, number> = { pow: 2, spe: 0, men: 0, soc: 0 };
    const normalizedWeights: Record<CoreAxis, number> = { pow: 1, spe: 0, men: 0, soc: 0 };

    expect(computePlayerQuality(player, skewedWeights)).toBeCloseTo(
      computePlayerQuality(player, normalizedWeights),
    );
  });

  it("handles all-zero needAxisWeights without throwing or producing NaN", () => {
    const player = makePlayer();
    const zeroWeights: Record<CoreAxis, number> = { pow: 0, spe: 0, men: 0, soc: 0 };

    const quality = computePlayerQuality(player, zeroWeights);

    expect(Number.isNaN(quality)).toBe(false);
    expect(quality).toBeGreaterThanOrEqual(0);
  });
});

describe("marginalCoverageValue", () => {
  it("is strictly decreasing as coveredCount increases", () => {
    const values = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(marginalCoverageValue);
    for (let i = 1; i < values.length; i += 1) {
      expect(values[i]).toBeLessThan(values[i - 1]);
    }
  });

  it("keeps the 3rd/4th player clearly above the 6th, and the 6th clearly above the 8th", () => {
    const thirdPlayerValue = marginalCoverageValue(2); // value of adding the 3rd solide player
    const fourthPlayerValue = marginalCoverageValue(3); // value of adding the 4th
    const sixthPlayerValue = marginalCoverageValue(5); // value of adding the 6th
    const eighthPlayerValue = marginalCoverageValue(7); // value of adding the 8th

    expect(thirdPlayerValue).toBeGreaterThan(sixthPlayerValue + 0.2);
    expect(fourthPlayerValue).toBeGreaterThan(sixthPlayerValue + 0.1);
    expect(sixthPlayerValue).toBeGreaterThan(eighthPlayerValue + 0.05);
  });

  it("approaches ~0 from the 7th covered player on (N>=7 <= 0.06 by contract, tighter near the tail)", () => {
    expect(marginalCoverageValue(6)).toBeLessThanOrEqual(0.06 + 1e-9);
    expect(marginalCoverageValue(7)).toBeLessThanOrEqual(0.03 + 1e-9);
    expect(marginalCoverageValue(10)).toBeLessThanOrEqual(0.03);
  });

  it("keeps all outputs within [0, 1], including for negative/absurd inputs", () => {
    const inputs = [-5, -1, 0, 1, 3, 6, 7, 20, 1000];
    for (const input of inputs) {
      const value = marginalCoverageValue(input);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
    expect(marginalCoverageValue(-5)).toBeCloseTo(marginalCoverageValue(0));
  });
});

describe("computeDisciplineNeeds / deriveNeedAxisWeights", () => {
  const disciplines: OrganicDiscipline[] = [
    { id: "sprint", category: "speed" },
    { id: "shotput", category: "power" },
  ];

  function squadWithCoverage(count: number): OrganicPlayerView[] {
    const squad: OrganicPlayerView[] = [];
    for (let i = 0; i < count; i += 1) {
      squad.push(
        makePlayer({
          playerId: `covered-${i}`,
          disciplineRatings: { sprint: 75 },
        }),
      );
    }
    return squad;
  }

  it("gives a discipline with 0 covered players a higher needWeight than with 5 covered", () => {
    const identityWeights: Record<CoreAxis, number> = { pow: 0.25, spe: 0.25, men: 0.25, soc: 0.25 };

    const needsUncovered = computeDisciplineNeeds(squadWithCoverage(0), identityWeights, disciplines);
    const needsCovered = computeDisciplineNeeds(squadWithCoverage(5), identityWeights, disciplines);

    const sprintUncovered = needsUncovered.find((n) => n.disciplineId === "sprint")!;
    const sprintCovered = needsCovered.find((n) => n.disciplineId === "sprint")!;

    expect(sprintUncovered.coveredCount).toBe(0);
    expect(sprintCovered.coveredCount).toBe(5);
    expect(sprintUncovered.needWeight).toBeGreaterThan(sprintCovered.needWeight);
  });

  it("derives axis weights that sum to ~1", () => {
    const identityWeights: Record<CoreAxis, number> = { pow: 0.4, spe: 0.3, men: 0.2, soc: 0.1 };
    const needs = computeDisciplineNeeds(squadWithCoverage(2), identityWeights, disciplines);

    const axisWeights = deriveNeedAxisWeights(needs);
    const sum = axisWeights.pow + axisWeights.spe + axisWeights.men + axisWeights.soc;

    expect(sum).toBeCloseTo(1);
    for (const axis of Object.keys(axisWeights) as CoreAxis[]) {
      expect(axisWeights[axis]).toBeGreaterThanOrEqual(0);
    }
  });

  it("falls back to a flat 0.25 per axis when every discipline needWeight is 0", () => {
    const axisWeights = deriveNeedAxisWeights([
      { disciplineId: "sprint", category: "speed", needWeight: 0, coveredCount: 10 },
      { disciplineId: "shotput", category: "power", needWeight: 0, coveredCount: 10 },
    ]);

    expect(axisWeights).toEqual({ pow: 0.25, spe: 0.25, men: 0.25, soc: 0.25 });
  });
});
