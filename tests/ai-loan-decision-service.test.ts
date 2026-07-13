import { describe, expect, it } from "vitest";

import { resolveAiLoanDecision } from "@/lib/ai/ai-loan-decision-service";
import { getTeamOutstandingDebt } from "@/lib/finance/loan-service";
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
    // capacity = min(0.35 * marketValueTotal, 1.25 * annualRevenue) - outstandingDebt
    //          = min(0.35 * 120, 1.25 * 50) - 0 = min(42, 62.5) = 42
    expect(decision.loanAmount).toBeLessThanOrEqual(42);
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
    // No sponsor revenue at all -> annualRevenue 0 -> revenue cap 0 -> capacity 0.
    const gameState = buildTeamGameState({ cash: 60, rosterCount: 8, playerOpt: 12 });
    const decision = resolveAiLoanDecision(gameState, "T-1");
    expect(decision.shouldBorrow).toBe(false);
    expect(decision.reason).toBe("no_capacity");
    expect(decision.loanAmount).toBe(0);
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
