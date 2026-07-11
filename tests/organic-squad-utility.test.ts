import { describe, expect, it } from "vitest";

import { projectCashFlow } from "@/lib/ai/organic-squad/cash-flow-forecast";
import type {
  CoreAxis,
  DisciplineNeed,
  OrganicPlayerView,
  OrganicTeamState,
} from "@/lib/ai/organic-squad/types";
import { buyUtility, marginalStrength, sellUtility, stopUtility } from "@/lib/ai/organic-squad/utility";
import { deriveUtilityWeights } from "@/lib/ai/organic-squad/weights";

const NEED_AXIS: Record<CoreAxis, number> = { pow: 0.55, spe: 0.15, men: 0.15, soc: 0.15 };

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

const NEEDS_UNDER: DisciplineNeed[] = [
  { disciplineId: "tdm", category: "power", needWeight: 1, coveredCount: 0 },
];
const NEEDS_SATURATED: DisciplineNeed[] = [
  { disciplineId: "tdm", category: "power", needWeight: 1, coveredCount: 6 },
];

describe("marginalStrength — coverage damping", () => {
  it("an under-covered needed discipline is worth more than a saturated one", () => {
    const player = makePlayer({ pow: 88, disciplineRatings: { tdm: 84 } });
    const under = marginalStrength(player, NEEDS_UNDER, NEED_AXIS);
    const saturated = marginalStrength(player, NEEDS_SATURATED, NEED_AXIS);
    expect(under).toBeGreaterThan(saturated);
    expect(saturated).toBeGreaterThanOrEqual(0);
  });

  it("a player covering no needed discipline still gets a positive baseline", () => {
    const generic = makePlayer({ pow: 70, disciplineRatings: { football: 40 } });
    expect(marginalStrength(generic, NEEDS_UNDER, NEED_AXIS)).toBeGreaterThan(0);
  });
});

describe("buyUtility — identity/GM drives spend appetite", () => {
  it("an ambitious/pressured team values a strong needed player more than a thrifty/secure one", () => {
    const strongNeeded = makePlayer({ pow: 92, disciplineRatings: { tdm: 86, spurt: 82 }, marketValue: 70 });
    const needs: DisciplineNeed[] = [
      { disciplineId: "tdm", category: "power", needWeight: 1, coveredCount: 0 },
      { disciplineId: "spurt", category: "power", needWeight: 0.8, coveredCount: 0 },
    ];
    const ambWeights = deriveUtilityWeights(
      { ambition: 90, finances: 45, boardConfidence: 30, harmony: 50, playerOpt: 10 },
      { starPriority: 9 },
    );
    const thriftyWeights = deriveUtilityWeights(
      { ambition: 25, finances: 80, boardConfidence: 80, harmony: 50, playerOpt: 12 },
      { valuePriority: 9, cashPriority: 9 },
    );
    const ambState = makeState({ weights: ambWeights, disciplineNeeds: needs });
    const thriftyState = makeState({ weights: thriftyWeights, disciplineNeeds: needs });
    expect(buyUtility(strongNeeded, ambState)).toBeGreaterThan(buyUtility(strongNeeded, thriftyState));
  });

  it("prefers filling an under-covered discipline over duplicating a saturated one", () => {
    const player = makePlayer({ pow: 88, disciplineRatings: { tdm: 84 }, marketValue: 50 });
    const under = buyUtility(player, makeState({ disciplineNeeds: NEEDS_UNDER }));
    const saturated = buyUtility(player, makeState({ disciplineNeeds: NEEDS_SATURATED }));
    expect(under).toBeGreaterThan(saturated);
  });
});

describe("sellUtility — cheap to sell from a covered discipline", () => {
  it("a player in an already-covered discipline is more sellable than one filling a need", () => {
    const player = makePlayer({ pow: 84, disciplineRatings: { tdm: 82 }, marketValue: 40 });
    const fromCovered = sellUtility(player, makeState({ disciplineNeeds: NEEDS_SATURATED }));
    const fromNeed = sellUtility(player, makeState({ disciplineNeeds: NEEDS_UNDER }));
    expect(fromCovered).toBeGreaterThan(fromNeed);
  });
});

describe("stopUtility — organic saving + soft OPT brake", () => {
  it("saving is more attractive when cash is scarce", () => {
    expect(stopUtility(makeState({ cash: 15 }))).toBeGreaterThan(stopUtility(makeState({ cash: 300 })));
  });

  it("saving is more attractive once the roster reaches OPT", () => {
    expect(stopUtility(makeState({ rosterSize: 14 }))).toBeGreaterThanOrEqual(
      stopUtility(makeState({ rosterSize: 8 })),
    );
  });
});
