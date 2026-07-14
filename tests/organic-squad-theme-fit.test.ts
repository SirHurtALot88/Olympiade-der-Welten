import { describe, expect, it } from "vitest";

import { projectCashFlow } from "@/lib/ai/organic-squad/cash-flow-forecast";
import type { CoreAxis, DisciplineNeed, OrganicPlayerView, OrganicTeamState } from "@/lib/ai/organic-squad/types";
import { buyUtility } from "@/lib/ai/organic-squad/utility";
import { deriveUtilityWeights } from "@/lib/ai/organic-squad/weights";

/**
 * Focused test for the theme-fit signal added to buyUtility (Master-Plan: identity should be
 * visible in the PICKS, not just save-vs-spend). Does not touch team-theme-composition-service
 * directly — that's exercised by tests/team-theme-composition-service.test.ts and
 * tests/draft-theme-gate.test.ts; this only checks the organic utility wiring/scale.
 */

const NEED_AXIS: Record<CoreAxis, number> = { pow: 0.25, spe: 0.25, men: 0.25, soc: 0.25 };

function makePlayer(
  over: Partial<OrganicPlayerView> & { disciplineRatings: Record<string, number> },
): OrganicPlayerView {
  return {
    playerId: "p",
    pow: 60,
    spe: 55,
    men: 55,
    soc: 55,
    marketValue: 30,
    salary: 10,
    potential: 0,
    ...over,
  };
}

function makeState(over: Partial<OrganicTeamState> = {}): OrganicTeamState {
  const weights = deriveUtilityWeights(
    { ambition: 55, finances: 55, boardConfidence: 50, harmony: 50, playerOpt: 11 },
    {},
  );
  const forecast = projectCashFlow({
    cash: 100,
    salaryTotal: 60,
    expectedPrize: 20,
    sponsorIncome: 30,
    facilityNet: 0,
    netTransfer: 0,
    cashBuffer: 20,
  });
  return {
    cash: 100,
    cashBuffer: 20,
    salaryTotal: 60,
    rosterSize: 9,
    boardRisk: 0.5,
    forecast,
    weights,
    disciplineNeeds: [],
    needAxisWeights: NEED_AXIS,
    ...over,
  };
}

describe("buyUtility — theme/identity fit is a modest additive nudge", () => {
  it("prefers an otherwise-identical candidate with perfect theme fit over one with none", () => {
    const themed = makePlayer({ disciplineRatings: { tdm: 40 }, themeFit: 1 });
    const untheme = makePlayer({ disciplineRatings: { tdm: 40 }, themeFit: 0 });
    const state = makeState();
    expect(buyUtility(themed, state)).toBeGreaterThan(buyUtility(untheme, state));
  });

  it("themeFit undefined behaves identically to themeFit 0 (no signal, no term added)", () => {
    const noSignal = makePlayer({ disciplineRatings: { tdm: 40 } });
    const explicitZero = makePlayer({ disciplineRatings: { tdm: 40 }, themeFit: 0 });
    const state = makeState();
    expect(buyUtility(noSignal, state)).toBeCloseTo(buyUtility(explicitZero, state), 9);
  });

  it("theme fit is a modest nudge: it must not flip a large affordability/need gap", () => {
    // A cheap, needed player with NO theme fit must still beat an expensive, unneeded player that
    // has perfect theme fit — theme tilts ties, it does not override need/affordability.
    const cheapNeeded = makePlayer({
      pow: 88,
      disciplineRatings: { tdm: 84 },
      marketValue: 20,
      salary: 5,
      themeFit: 0,
    });
    const expensiveThemed = makePlayer({
      pow: 40,
      disciplineRatings: { unrelated: 10 },
      marketValue: 90,
      salary: 40,
      themeFit: 1,
    });
    const needs: DisciplineNeed[] = [{ disciplineId: "tdm", category: "power", needWeight: 1, coveredCount: 0 }];
    const state = makeState({ disciplineNeeds: needs });
    expect(buyUtility(cheapNeeded, state)).toBeGreaterThan(buyUtility(expensiveThemed, state));
  });
});
