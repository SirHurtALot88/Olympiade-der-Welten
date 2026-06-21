import { foundationSeedDisciplines } from "@/lib/data/dataAdapter";
import type { Player, Team, TeamIdentity, TeamStrategyProfile } from "@/lib/data/olyDataTypes";
import {
  buildRetoolAi2BudgetPlan,
  buildTeamNeedState,
  scoreFormColorStackPenalty,
  scoreInAxisHoleCompletion,
  scoreMarginalNeedGain,
  scoreOffAxisDetourPenalty,
  scoreOverpayPenalty,
  scoreRoleMismatchPenalty,
} from "@/lib/ai/retool-ai2-pick-engine";
import { describe, expect, it } from "vitest";

function player(input: {
  id: string;
  name: string;
  pow: number;
  spe: number;
  men: number;
  soc: number;
  className?: string;
  race?: string;
  disciplines?: Record<string, number>;
}): Player {
  return {
    id: input.id,
    name: input.name,
    rating: Math.round((input.pow + input.spe + input.men + input.soc) / 4),
    marketValue: 20,
    salaryDemand: 5,
    className: input.className ?? "Rogue",
    race: input.race ?? "Human",
    alignment: "Neutral",
    gender: "unknown",
    subclasses: [],
    traitsPositive: [],
    traitsNegative: [],
    coreStats: { pow: input.pow, spe: input.spe, men: input.men, soc: input.soc },
    preferredDisciplineIds: [],
    disciplineRatings: input.disciplines ?? {},
    disciplineTierCounts: { above20: 0, above40: 0, above60: 0, above80: 0 },
    flavorEn: "",
    flavorDe: "",
    fatigue: 0,
    form: 0,
    potential: 50,
  };
}

function identity(input: Partial<TeamIdentity> & { teamId: string }): TeamIdentity {
  return {
    ...input,
    teamId: input.teamId,
    pow: input.pow ?? 5,
    spe: input.spe ?? 5,
    men: input.men ?? 5,
    soc: input.soc ?? 5,
    ambition: 6,
    finances: 6,
    boardConfidence: 50,
    harmony: 6,
    manners: 5,
    popularity: 5,
    cooperation: 5,
    playerMin: 9,
    playerOpt: 10,
  };
}

function team(teamId: string, cash = 180): Team {
  return {
    teamId,
    shortCode: teamId,
    name: teamId,
    budget: cash,
    cash,
    identityId: teamId,
    humanControlled: false,
    rosterLimit: 12,
  };
}

function strategy(input: {
  teamId: string;
  cashPriority?: number;
  starPriority?: number;
  wageSensitivity?: number;
  spendAggression?: TeamStrategyProfile["spendAggression"];
  saveDiscipline?: TeamStrategyProfile["saveDiscipline"];
}): TeamStrategyProfile {
  return {
    teamId: input.teamId,
    strategySummary: input.teamId,
    buyStyle: "",
    sellStyle: "",
    contractStyle: "",
    rosterStyle: "",
    preferredArchetypes: [],
    avoidedArchetypes: [],
    preferredRaces: [],
    avoidedRaces: [],
    preferredClasses: [],
    avoidedClasses: [],
    hardNoGos: [],
    spendAggression: input.spendAggression,
    saveDiscipline: input.saveDiscipline,
    bias: {
      cashPriority: input.cashPriority ?? 5,
      valuePriority: 5,
      starPriority: input.starPriority ?? 5,
      riskTolerance: 5,
      wageSensitivity: input.wageSensitivity ?? 5,
      sellForProfitAggression: 5,
      shortContractPreference: 5,
      longContractPreference: 5,
      loyaltyBias: 5,
      harmonyStrictness: 5,
      rosterDepthPreference: 5,
      eliteSmallRosterPreference: 5,
    },
  };
}

function needStateFor(input: {
  teamId: string;
  identity: TeamIdentity;
  rosterPlayers?: Player[];
  targetRosterSize?: number;
  plannedPicksRemaining?: number;
}) {
  return buildTeamNeedState({
    gameState: { disciplines: foundationSeedDisciplines },
    team: team(input.teamId),
    teamIdentity: input.identity,
    rosterPlayers: input.rosterPlayers ?? [],
    targetRosterSize: input.targetRosterSize ?? 10,
    plannedPicksRemaining: input.plannedPicksRemaining ?? 10,
  });
}

function netNeedScore(needState: ReturnType<typeof buildTeamNeedState>, candidate: Player) {
  const gain = scoreMarginalNeedGain({ needState, candidate });
  return gain.needScoreApplied + scoreInAxisHoleCompletion({ needState, marginalGain: gain }) - scoreOffAxisDetourPenalty({ needState, marginalGain: gain });
}

describe("Retool AI2 pick engine", () => {
  it("M-M premium pick targets speed/power identity before a social OVR-style detour", () => {
    const needState = needStateFor({
      teamId: "M-M",
      identity: identity({ teamId: "M-M", pow: 18, spe: 17, men: 4, soc: 2 }),
    });
    const speedPowerFit = player({
      id: "speed-power-star",
      name: "Speed Power Star",
      pow: 82,
      spe: 87,
      men: 42,
      soc: 38,
      disciplines: { spurt: 88, climbing: 86, staffel: 84, tdm: 78, breaking: 76 },
    });
    const zazaLikeDetour = player({
      id: "social-bard-detour",
      name: "Social Bard Detour",
      pow: 48,
      spe: 55,
      men: 68,
      soc: 94,
      className: "Bard",
      disciplines: { showcase: 96, basketball: 93, eiskunstlauf: 91 },
    });

    expect(netNeedScore(needState, speedPowerFit)).toBeGreaterThan(netNeedScore(needState, zazaLikeDetour));
  });

  it("A-A-style speed stacks still create Formkarten needs for other colors", () => {
    const greenRoster = Array.from({ length: 7 }, (_, index) =>
      player({
        id: `green-${index}`,
        name: `Green ${index}`,
        pow: 38,
        spe: 72,
        men: 42,
        soc: 40,
        className: "Sprinter",
        disciplines: { "time-trial": 70, staffel: 68, climbing: 66 },
      }),
    );
    const needState = needStateFor({
      teamId: "A-A",
      identity: identity({ teamId: "A-A", pow: 2, spe: 20, men: 4, soc: 3 }),
      rosterPlayers: greenRoster,
      targetRosterSize: 10,
      plannedPicksRemaining: 3,
    });
    const usefulRed = player({
      id: "red-form-card",
      name: "Red Form Card",
      pow: 68,
      spe: 64,
      men: 40,
      soc: 38,
      className: "Berserker",
      disciplines: { tdm: 70, gewichtheben: 67, "time-trial": 62 },
    });
    const anotherGreen = player({
      id: "another-green",
      name: "Another Green",
      pow: 38,
      spe: 66,
      men: 39,
      soc: 37,
      className: "Sprinter",
      disciplines: { "time-trial": 66, staffel: 64, climbing: 62 },
    });
    const redGain = scoreMarginalNeedGain({ needState, candidate: usefulRed });
    const greenGain = scoreMarginalNeedGain({ needState, candidate: anotherGreen });
    const greenStackPenalty = scoreFormColorStackPenalty({ needState, candidate: anotherGreen, marginalGain: greenGain });
    const redStackPenalty = scoreFormColorStackPenalty({ needState, candidate: usefulRed, marginalGain: redGain });

    expect(needState.primaryFormColorNeed).not.toBe("green");
    expect(needState.formColorTargetCounts.green).toBeGreaterThan(0);
    expect(needState.formColorCounts.green).toBeGreaterThanOrEqual(needState.formColorTargetCounts.green);
    expect(redGain.formColorNeedScore).toBeGreaterThan(3);
    expect(redGain.formColorNeedScore).toBeGreaterThan(greenGain.formColorNeedScore);
    expect(greenStackPenalty).toBeGreaterThan(redStackPenalty);
    expect(redGain.needScoreApplied).toBeGreaterThan(greenGain.needScoreApplied);
  });

  it("W-W rewards mental/mage/arcane style holes over a power detour", () => {
    const needState = needStateFor({
      teamId: "W-W",
      identity: identity({ teamId: "W-W", pow: 2, spe: 4, men: 20, soc: 8 }),
    });
    const mageMental = player({
      id: "arcane-mage",
      name: "Arcane Mage",
      pow: 25,
      spe: 35,
      men: 91,
      soc: 63,
      className: "Mage",
      disciplines: { "speed-schach": 92, "takeshis-castle": 88, tennis: 84, "i-spy": 87 },
    });
    const powerBruiser = player({
      id: "power-bruiser",
      name: "Power Bruiser",
      pow: 91,
      spe: 42,
      men: 46,
      soc: 36,
      className: "Warlord",
      disciplines: { gewichtheben: 92, tdm: 88, hockey: 87 },
    });

    expect(netNeedScore(needState, mageMental)).toBeGreaterThan(netNeedScore(needState, powerBruiser));
  });

  it("B-P can stay smaller/value-oriented without buying low-impact trash", () => {
    const goodValuePenalty = scoreOverpayPenalty({
      candidateMarketValue: 18,
      candidateSalary: 3,
      remainingBudget: 90,
      plannedPicksRemaining: 5,
      needScoreApplied: 20,
      financePressure01: 0.65,
    });
    const trashPenalty = scoreOverpayPenalty({
      candidateMarketValue: 16,
      candidateSalary: 4,
      remainingBudget: 90,
      plannedPicksRemaining: 5,
      needScoreApplied: 1,
      financePressure01: 0.65,
    });

    expect(goodValuePenalty).toBeLessThanOrEqual(trashPenalty);
  });

  it("R-R is not destroyed by a false identity penalty when the pick solves a real hole", () => {
    const needState = needStateFor({
      teamId: "R-R",
      identity: identity({ teamId: "R-R", pow: 8, spe: 8, men: 8, soc: 8 }),
    });
    const aquaFit = player({
      id: "aqua-hole-solver",
      name: "Aqua Hole Solver",
      pow: 48,
      spe: 76,
      men: 54,
      soc: 73,
      race: "Aqua",
      disciplines: { climbing: 84, fechten: 82, football: 78 },
    });
    const gain = scoreMarginalNeedGain({ needState, candidate: aquaFit });

    expect(scoreOffAxisDetourPenalty({ needState, marginalGain: gain })).toBeLessThan(12);
  });

  it("C-C may prioritize value, but useful candidates beat empty cheap fillers", () => {
    const needState = needStateFor({
      teamId: "C-C",
      identity: identity({ teamId: "C-C", pow: 6, spe: 6, men: 6, soc: 6, finances: 10 }),
    });
    const usefulCheap = player({
      id: "useful-cheap",
      name: "Useful Cheap",
      pow: 66,
      spe: 64,
      men: 70,
      soc: 61,
      disciplines: { tennis: 72, staffel: 69, tdm: 67 },
    });
    const trashCheap = player({
      id: "trash-cheap",
      name: "Trash Cheap",
      pow: 22,
      spe: 24,
      men: 20,
      soc: 18,
      disciplines: { tennis: 22, staffel: 24, tdm: 20 },
    });

    expect(scoreMarginalNeedGain({ needState, candidate: usefulCheap }).needScoreApplied).toBeGreaterThan(
      scoreMarginalNeedGain({ needState, candidate: trashCheap }).needScoreApplied,
    );
  });

  it("an expensive low-impact star is penalized before it blocks the rest of the roster", () => {
    const lowImpactExpensive = scoreOverpayPenalty({
      candidateMarketValue: 100,
      candidateSalary: 22,
      remainingBudget: 160,
      plannedPicksRemaining: 9,
      needScoreApplied: 4,
      financePressure01: 0.7,
    });
    const highImpactExpensive = scoreOverpayPenalty({
      candidateMarketValue: 70,
      candidateSalary: 14,
      remainingBudget: 160,
      plannedPicksRemaining: 9,
      needScoreApplied: 30,
      financePressure01: 0.7,
    });

    expect(lowImpactExpensive).toBeGreaterThan(highImpactExpensive);
    expect(lowImpactExpensive).toBeGreaterThan(20);
  });

  it("penalizes W-L style red stacking once other Formfarben are still missing", () => {
    const redStackRoster = Array.from({ length: 3 }, (_, index) =>
      player({
        id: `wl-red-${index}`,
        name: `W-L Red ${index}`,
        pow: 72,
        spe: 38,
        men: 58,
        soc: 34,
        className: "Warlord",
        disciplines: { tdm: 72, gewichtheben: 68, wettessen: 62 },
      }),
    );
    const needState = needStateFor({
      teamId: "W-L",
      identity: identity({ teamId: "W-L", pow: 12, spe: 4, men: 9, soc: 4 }),
      rosterPlayers: redStackRoster,
      targetRosterSize: 10,
      plannedPicksRemaining: 7,
    });
    const anotherRed = player({
      id: "wl-another-red",
      name: "Another Legion Red",
      pow: 74,
      spe: 42,
      men: 60,
      soc: 36,
      className: "Warlord",
      disciplines: { tdm: 75, gewichtheben: 71 },
    });
    const usefulGreen = player({
      id: "wl-useful-green",
      name: "Useful Green Merc",
      pow: 58,
      spe: 68,
      men: 54,
      soc: 40,
      className: "Sprinter",
      disciplines: { climbing: 69, staffel: 66, tdm: 62 },
    });

    const redGain = scoreMarginalNeedGain({ needState, candidate: anotherRed });
    const greenGain = scoreMarginalNeedGain({ needState, candidate: usefulGreen });

    expect(scoreFormColorStackPenalty({ needState, candidate: anotherRed, marginalGain: redGain })).toBeGreaterThan(16);
    expect(scoreFormColorStackPenalty({ needState, candidate: usefulGreen, marginalGain: greenGain })).toBe(0);
  });

  it("rewards in-axis hole completion and penalizes off-axis detours", () => {
    const needState = needStateFor({
      teamId: "M-M",
      identity: identity({ teamId: "M-M", pow: 20, spe: 5, men: 2, soc: 1 }),
    });
    const inAxis = scoreMarginalNeedGain({
      needState,
      candidate: player({
        id: "in-axis",
        name: "In Axis",
        pow: 90,
        spe: 84,
        men: 30,
        soc: 20,
        disciplines: { gewichtheben: 94, tdm: 88, spurt: 86 },
      }),
    });
    const offAxis = scoreMarginalNeedGain({
      needState,
      candidate: player({
        id: "off-axis",
        name: "Off Axis",
        pow: 20,
        spe: 28,
        men: 30,
        soc: 92,
        disciplines: { showcase: 95, basketball: 92 },
      }),
    });

    expect(scoreInAxisHoleCompletion({ needState, marginalGain: inAxis })).toBeGreaterThan(0);
    expect(scoreOffAxisDetourPenalty({ needState, marginalGain: offAxis })).toBeGreaterThan(0);
  });

  it("avoid-theme prevents star/core premium picks", () => {
    expect(
      scoreRoleMismatchPenalty({
        plannedRole: "star",
        candidateQuality: 92,
        needScoreApplied: 30,
        themeTier: "avoid",
        classFit: 90,
      }),
    ).toBeGreaterThan(200);
  });

  it("ports Retool budget planning so C-C keeps more cash buffer than M-M with identical cash", () => {
    const cashCreatorPlan = buildRetoolAi2BudgetPlan({
      team: team("C-C", 180),
      teamIdentity: identity({ teamId: "C-C", ambition: 4, finances: 10, harmony: 8 }),
      strategyProfile: strategy({ teamId: "C-C", cashPriority: 10, starPriority: 2, wageSensitivity: 9, saveDiscipline: "high" }),
      rosterSize: 10,
      rosterSalaryKnown: 45,
      rosterMarketValue: 180,
      playerMin: 10,
      optimum: 11,
      currentRank: 12,
      previousRank: 13,
      sponsorSupport: 28,
    });
    const mayhemPlan = buildRetoolAi2BudgetPlan({
      team: team("M-M", 180),
      teamIdentity: identity({ teamId: "M-M", ambition: 10, finances: 4, harmony: 5 }),
      strategyProfile: strategy({ teamId: "M-M", cashPriority: 3, starPriority: 10, wageSensitivity: 3, spendAggression: "high" }),
      rosterSize: 8,
      rosterSalaryKnown: 45,
      rosterMarketValue: 180,
      playerMin: 9,
      optimum: 11,
      currentRank: 24,
      previousRank: 14,
      sponsorSupport: 28,
    });

    expect(cashCreatorPlan.reserveTarget).toBeGreaterThan(mayhemPlan.reserveTarget);
    expect(cashCreatorPlan.allowedBudgetForSearch).toBeLessThan(mayhemPlan.allowedBudgetForSearch);
    expect(cashCreatorPlan.reservePolicy).toBe("conservative");
    expect(mayhemPlan.aggression01).toBeGreaterThan(cashCreatorPlan.aggression01);
  });

  it("raises budget reserve when salary burden and weak sponsor runway create Retool-style pressure", () => {
    const safeRunway = buildRetoolAi2BudgetPlan({
      team: team("VALUE", 180),
      teamIdentity: identity({ teamId: "VALUE", ambition: 5, finances: 8, harmony: 7 }),
      strategyProfile: strategy({ teamId: "VALUE", cashPriority: 8, wageSensitivity: 8, saveDiscipline: "high" }),
      rosterSize: 10,
      rosterSalaryKnown: 35,
      rosterMarketValue: 120,
      playerMin: 10,
      optimum: 11,
      sponsorSupport: 55,
    });
    const stressedRunway = buildRetoolAi2BudgetPlan({
      team: team("VALUE", 180),
      teamIdentity: identity({ teamId: "VALUE", ambition: 5, finances: 8, harmony: 7 }),
      strategyProfile: strategy({ teamId: "VALUE", cashPriority: 8, wageSensitivity: 8, saveDiscipline: "high" }),
      rosterSize: 10,
      rosterSalaryKnown: 85,
      rosterMarketValue: 260,
      playerMin: 10,
      optimum: 11,
      sponsorSupport: 15,
    });

    expect(stressedRunway.salaryBurdenRatio).toBeGreaterThan(safeRunway.salaryBurdenRatio);
    expect(stressedRunway.reserveTarget).toBeGreaterThan(safeRunway.reserveTarget);
    expect(stressedRunway.allowedBudgetForSearch).toBeLessThan(safeRunway.allowedBudgetForSearch);
  });
});
