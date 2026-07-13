import { describe, expect, it } from "vitest";

import { resolveAiEarlyPayoffDecision, resolveAiLoanDecision } from "@/lib/ai/ai-loan-decision-service";
import { computeEarlyPayoff, getTeamOutstandingDebt } from "@/lib/finance/loan-service";
import { resolveTeamLiquidityBufferTarget } from "@/lib/ai/planner-cash-buffer-policy";
import type { GameState, LoanRecord } from "@/lib/data/olyDataTypes";

function minimalStrategyProfile(teamId: string, bias: Record<string, number>) {
  return {
    teamId,
    strategySummary: "Test profile",
    preferredArchetypes: [] as string[],
    secondaryArchetypes: [] as string[],
    bias: {
      cashPriority: 5,
      valuePriority: 5,
      starPriority: 5,
      riskTolerance: 5,
      wageSensitivity: 5,
      sellForProfitAggression: 5,
      shortContractPreference: 5,
      longContractPreference: 5,
      loyaltyBias: 5,
      harmonyStrictness: 5,
      rosterDepthPreference: 5,
      eliteSmallRosterPreference: 5,
      ...bias,
    },
  };
}

function buildTeamGameState(input: {
  teamId?: string;
  cash: number;
  rosterCount: number;
  playerOpt: number;
  salaryPerPlayer?: number;
  marketValuePerPlayer?: number;
  cashPriority?: number;
  annualRevenue?: number;
  loans?: LoanRecord[];
  seasonId?: string;
}): GameState {
  const teamId = input.teamId ?? "T-1";
  const seasonId = input.seasonId ?? "season-2";
  const salaryPerPlayer = input.salaryPerPlayer ?? 3;
  const marketValuePerPlayer = input.marketValuePerPlayer ?? 15;

  const rosters = Array.from({ length: input.rosterCount }, (_, index) => ({
    id: `r${index}`,
    teamId,
    playerId: `p${index}`,
    salary: salaryPerPlayer,
    upkeep: salaryPerPlayer,
    contractLength: 2,
    currentValue: marketValuePerPlayer,
  }));
  const players = Array.from({ length: input.rosterCount }, (_, index) => ({
    id: `p${index}`,
    name: `P${index}`,
    marketValue: marketValuePerPlayer,
    displayMarketValue: marketValuePerPlayer,
    rating: 55,
    fatigue: 20,
    salary: salaryPerPlayer,
  }));

  const sponsorPayoutLogs =
    input.annualRevenue == null
      ? []
      : [
          {
            id: "payout-1",
            saveId: "save-1",
            seasonId,
            teamId,
            phase: "season_end",
            componentId: "base",
            cashDelta: input.annualRevenue,
            action: "apply",
            createdAt: "2027-01-01T00:00:00.000Z",
          },
        ];

  return {
    season: { id: seasonId, name: seasonId, year: 2028, currentMatchday: 1, matchdayIds: ["matchday-1"] },
    seasonState: {
      seasonId,
      schedule: [],
      standings: { [teamId]: { points: 0 } },
      loans: input.loans ?? [],
      loanApplyLogs: [],
      sponsorPayoutLogs,
      aiManagerBudgetReservations: {},
      teamStrategyProfiles: {
        [teamId]: minimalStrategyProfile(teamId, { cashPriority: input.cashPriority ?? 5 }),
      },
    },
    matchdayState: { matchdayId: "matchday-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [{ teamId, shortCode: "T-1", name: "Team", budget: input.cash, cash: input.cash, rosterLimit: 14 }],
    teamIdentities: [
      { teamId, playerMin: 8, playerOpt: input.playerOpt, playerMax: 14, finances: 5, ambition: 5 },
    ],
    players,
    disciplines: [],
    disciplineSchedule: [],
    rosters,
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
    mappingReport: {
      mappingSource: "",
      teamSource: "",
      generatedAt: "",
      processedMappingRows: 0,
      importedPlayerCount: 0,
      matchedRosterCount: 0,
      teamCount: 1,
      unmappedPlayers: [],
      teamsWithoutPlayers: [],
      mappingRowsWithoutPlayerMatch: [],
      duplicateMappedPlayers: [],
      unknownTeamCodes: [],
      duplicateTeamCodes: [],
      warnings: [],
    },
  } as unknown as GameState;
}

describe("resolveAiLoanDecision", () => {
  it("does not borrow when the roster is already at optimum (no need)", () => {
    const gameState = buildTeamGameState({ cash: 60, rosterCount: 12, playerOpt: 12, annualRevenue: 50 });
    const decision = resolveAiLoanDecision(gameState, "T-1");
    expect(decision.shouldBorrow).toBe(false);
    expect(decision.reason).toBe("no_need");
    expect(decision.loanAmount).toBe(0);
  });

  it("does not borrow when roster need exists but spendable cash already covers it", () => {
    const gameState = buildTeamGameState({ cash: 300, rosterCount: 8, playerOpt: 12, annualRevenue: 200 });
    const decision = resolveAiLoanDecision(gameState, "T-1");
    expect(decision.shouldBorrow).toBe(false);
    expect(decision.reason).toBe("cash_sufficient");
  });

  it("borrows min(shortfall, capacity) when there is need, a cash gap, and free capacity", () => {
    const gameState = buildTeamGameState({ cash: 60, rosterCount: 8, playerOpt: 12, annualRevenue: 50 });
    const decision = resolveAiLoanDecision(gameState, "T-1");
    expect(decision.shouldBorrow).toBe(true);
    expect(decision.loanAmount).toBeGreaterThan(0);
    // capacity = 0.15*cash + 0.30*marketValueTotal - outstandingDebt
    //          = 0.15*60 + 0.30*120 - 0 = 9+36 = 45
    expect(decision.loanAmount).toBeLessThanOrEqual(45);
    expect(decision.termSeasons).toBeGreaterThanOrEqual(1);
    expect(decision.termSeasons).toBeLessThanOrEqual(10);
  });

  it("scales borrowing down for a high-cashPriority (hoarder-leaning) team vs an aggressive team, same gap", () => {
    const hoarder = buildTeamGameState({ cash: 60, rosterCount: 8, playerOpt: 12, annualRevenue: 50, cashPriority: 10 });
    const aggressive = buildTeamGameState({ cash: 60, rosterCount: 8, playerOpt: 12, annualRevenue: 50, cashPriority: 1 });

    const hoarderDecision = resolveAiLoanDecision(hoarder, "T-1");
    const aggressiveDecision = resolveAiLoanDecision(aggressive, "T-1");

    expect(hoarderDecision.shouldBorrow).toBe(true);
    expect(aggressiveDecision.shouldBorrow).toBe(true);
    expect(hoarderDecision.loanAmount).toBeLessThan(aggressiveDecision.loanAmount);
  });

  it("does not borrow when there is need and a cash gap but no borrowing capacity", () => {
    // Capacity is now purely teamwert-based (cash + marketValueTotal), so zero revenue alone no
    // longer zeroes it out — instead, exhaust the teamwertCap with existing debt: teamwertCap =
    // 0.15*60 + 0.30*(8*15=120) = 45, and an outstanding loan of 100 already exceeds that, so
    // capacity floors at 0.
    const gameState = buildTeamGameState({
      cash: 60,
      rosterCount: 8,
      playerOpt: 12,
      loans: [
        {
          loanId: "loan-existing",
          borrowerTeamId: "T-1",
          lenderType: "bank",
          principalOriginal: 100,
          principalOutstanding: 100,
          interestRatePerSeason: 0.1,
          termSeasons: 5,
          seasonsRemaining: 5,
          installmentPerSeason: 10,
          originatedSeasonId: "season-1",
          status: "active",
          missedPayments: 0,
        },
      ],
    });
    const decision = resolveAiLoanDecision(gameState, "T-1");
    expect(decision.shouldBorrow).toBe(false);
    expect(decision.reason).toBe("no_capacity");
    expect(decision.loanAmount).toBe(0);
  });

  it("Season 1 = keine Kredite: refuses regardless of need/capacity", () => {
    const gameState = buildTeamGameState({
      cash: 60,
      rosterCount: 8,
      playerOpt: 12,
      annualRevenue: 50,
      seasonId: "season-1",
    });
    const decision = resolveAiLoanDecision(gameState, "T-1");
    expect(decision.shouldBorrow).toBe(false);
    expect(decision.reason).toBe("season_one_no_loans");
    expect(decision.loanAmount).toBe(0);
  });
});

describe("resolveAiEarlyPayoffDecision", () => {
  function loanRecord(partial?: Partial<LoanRecord>): LoanRecord {
    return {
      loanId: "loan-1",
      borrowerTeamId: "T-1",
      lenderType: "bank",
      principalOriginal: 10,
      principalOutstanding: 10,
      interestRatePerSeason: 0.14,
      termSeasons: 5,
      seasonsRemaining: 3,
      installmentPerSeason: 3,
      originatedSeasonId: "season-1",
      status: "active",
      missedPayments: 0,
      ...partial,
    };
  }

  it("pays off from genuine surplus (no roster need, cash well above the payoff)", () => {
    const gameState = buildTeamGameState({
      cash: 200,
      rosterCount: 12,
      playerOpt: 12,
      annualRevenue: 100,
      loans: [loanRecord()],
    });
    const decision = resolveAiEarlyPayoffDecision(gameState, "T-1");
    expect(decision.reason).toBe("surplus_payoff");
    expect(decision.loanIdsToPayoff).toEqual(["loan-1"]);
  });

  it("does not pay off when there is no surplus (cash needed for next season's roster gap)", () => {
    const gameState = buildTeamGameState({
      cash: 60,
      rosterCount: 8,
      playerOpt: 12,
      annualRevenue: 50,
      loans: [loanRecord()],
    });
    const decision = resolveAiEarlyPayoffDecision(gameState, "T-1");
    expect(decision.reason).toBe("no_surplus");
    expect(decision.loanIdsToPayoff).toEqual([]);
  });

  it("does not pay off when surplus is positive but below every candidate loan's payoff", () => {
    const gameState = buildTeamGameState({
      cash: 65,
      rosterCount: 12,
      playerOpt: 12,
      annualRevenue: 50,
      loans: [
        loanRecord({ loanId: "big", principalOutstanding: 50, installmentPerSeason: 15, seasonsRemaining: 4 }),
      ],
    });
    const decision = resolveAiEarlyPayoffDecision(gameState, "T-1");
    expect(decision.reason).toBe("insufficient_surplus_for_any_loan");
    expect(decision.loanIdsToPayoff).toEqual([]);
  });

  it("hysteresis: skips a loan originated this season, even with a large surplus", () => {
    const gameState = buildTeamGameState({
      cash: 200,
      rosterCount: 12,
      playerOpt: 12,
      annualRevenue: 100,
      loans: [loanRecord({ originatedSeasonId: "season-2" })], // buildTeamGameState default seasonId
    });
    const decision = resolveAiEarlyPayoffDecision(gameState, "T-1");
    expect(decision.reason).toBe("borrowed_this_season");
    expect(decision.loanIdsToPayoff).toEqual([]);
  });

  it("does not recommend payoff at all when the team also borrowed this season (no borrow+payoff same season)", () => {
    const gameState = buildTeamGameState({
      cash: 200,
      rosterCount: 12,
      playerOpt: 12,
      annualRevenue: 100,
      loans: [
        loanRecord({ loanId: "old-loan", originatedSeasonId: "season-1" }),
        loanRecord({ loanId: "new-loan", originatedSeasonId: "season-2" }),
      ],
    });
    const decision = resolveAiEarlyPayoffDecision(gameState, "T-1");
    expect(decision.reason).toBe("borrowed_this_season");
    expect(decision.loanIdsToPayoff).toEqual([]);
  });

  it("pays off the smallest-payoff loan first, largest last, when surplus covers both", () => {
    const loans: LoanRecord[] = [
      loanRecord({ loanId: "big", principalOutstanding: 50, installmentPerSeason: 15, seasonsRemaining: 4 }),
      loanRecord({ loanId: "small", principalOutstanding: 5, installmentPerSeason: 2, seasonsRemaining: 3 }),
    ];
    const gameState = buildTeamGameState({ cash: 100, rosterCount: 12, playerOpt: 12, annualRevenue: 50, loans });
    const decision = resolveAiEarlyPayoffDecision(gameState, "T-1");
    expect(decision.reason).toBe("surplus_payoff");
    // "small" has a lower computeEarlyPayoff().payoff (5.2) than "big" (52) -> paid first.
    const smallPayoff = computeEarlyPayoff(loans[1]!).payoff;
    const bigPayoff = computeEarlyPayoff(loans[0]!).payoff;
    expect(smallPayoff).toBeLessThan(bigPayoff);
    expect(decision.loanIdsToPayoff).toEqual(["small", "big"]);
  });

  it("does not pay off when the team has no active loans", () => {
    const gameState = buildTeamGameState({ cash: 200, rosterCount: 12, playerOpt: 12, annualRevenue: 100, loans: [] });
    const decision = resolveAiEarlyPayoffDecision(gameState, "T-1");
    expect(decision.reason).toBe("no_active_loans");
    expect(decision.loanIdsToPayoff).toEqual([]);
  });
});

describe("resolveTeamLiquidityBufferTarget with outstanding debt", () => {
  function baseLoan(): LoanRecord {
    return {
      loanId: "loan-1",
      borrowerTeamId: "T-1",
      lenderType: "bank",
      principalOriginal: 30,
      principalOutstanding: 30,
      interestRatePerSeason: 0.14,
      termSeasons: 5,
      seasonsRemaining: 5,
      installmentPerSeason: 8.7,
      originatedSeasonId: "season-2",
      status: "active",
      missedPayments: 0,
    };
  }

  it("raises the liquidity buffer target for an indebted team vs the same team debt-free", () => {
    const debtFree = buildTeamGameState({ cash: 100, rosterCount: 8, playerOpt: 12, annualRevenue: 50 });
    const indebted = buildTeamGameState({
      cash: 100,
      rosterCount: 8,
      playerOpt: 12,
      annualRevenue: 50,
      loans: [baseLoan()],
    });

    expect(getTeamOutstandingDebt(indebted, "T-1")).toBeCloseTo(30, 1);
    expect(getTeamOutstandingDebt(debtFree, "T-1")).toBe(0);

    const debtFreeBuffer = resolveTeamLiquidityBufferTarget(debtFree, "T-1");
    const indebtedBuffer = resolveTeamLiquidityBufferTarget(indebted, "T-1");
    expect(indebtedBuffer).toBeGreaterThan(debtFreeBuffer);
  });
});
