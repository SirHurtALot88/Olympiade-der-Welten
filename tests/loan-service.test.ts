import { describe, expect, it } from "vitest";

import type { GameState, LoanRecord, StandingRecord, Team, TeamIdentity } from "@/lib/data/olyDataTypes";
import {
  applyEarlyPayoff,
  applyLoanSettlement,
  computeBorrowingCapacity,
  computeEarlyPayoff,
  computeLoanTerms,
  estimateTeamAnnualRevenue,
  getTeamOutstandingDebt,
  originateLoan,
  previewLoanSettlement,
} from "@/lib/finance/loan-service";

function createTeam(partial?: Partial<Team>): Team {
  return {
    teamId: partial?.teamId ?? "A-A",
    shortCode: partial?.shortCode ?? "A-A",
    name: partial?.name ?? "Armageddon Aftermath",
    budget: partial?.budget ?? 100,
    cash: partial?.cash ?? 50,
    identityId: partial?.identityId ?? partial?.teamId ?? "A-A",
    humanControlled: partial?.humanControlled ?? true,
    rosterLimit: partial?.rosterLimit ?? 12,
    logoPath: partial?.logoPath ?? null,
  };
}

function createIdentity(teamId: string, partial?: Partial<TeamIdentity>): TeamIdentity {
  return {
    teamId,
    playerType: null,
    pow: 8,
    spe: 7,
    men: 5,
    soc: 3,
    ambition: 8,
    finances: partial?.finances ?? 5,
    boardConfidence: 7,
    harmony: 5,
    manners: 5,
    popularity: 5,
    cooperation: 5,
    playerMin: 7,
    playerOpt: 10,
  };
}

function createGameState(input?: {
  teams?: Team[];
  teamIdentities?: TeamIdentity[];
  loans?: LoanRecord[];
  loanApplyLogs?: GameState["seasonState"]["loanApplyLogs"];
  standings?: Record<string, StandingRecord>;
  sponsorPayoutLogs?: GameState["seasonState"]["sponsorPayoutLogs"];
  seasonId?: string;
}): GameState {
  const teams = input?.teams ?? [createTeam()];
  const seasonId = input?.seasonId ?? "season-3";
  return {
    season: {
      id: seasonId,
      name: "Season 3",
      year: 2028,
      currentMatchday: 1,
      matchdayIds: ["matchday-1"],
    },
    seasonState: {
      seasonId,
      schedule: [],
      standings: input?.standings ?? Object.fromEntries(teams.map((team) => [team.teamId, { points: 0 }])),
      loans: input?.loans ?? [],
      loanApplyLogs: input?.loanApplyLogs ?? [],
      sponsorPayoutLogs: input?.sponsorPayoutLogs ?? [],
    },
    matchdayState: {
      matchdayId: "matchday-1",
      status: "planning",
      pendingTeamIds: [],
      resolvedFixtureIds: [],
    },
    teams,
    teamIdentities: input?.teamIdentities ?? teams.map((team) => createIdentity(team.teamId)),
    players: [],
    disciplines: [],
    rosters: [],
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
      teamCount: teams.length,
      unmappedPlayers: [],
      teamsWithoutPlayers: [],
      mappingRowsWithoutPlayerMatch: [],
      duplicateMappedPlayers: [],
      unknownTeamCodes: [],
      duplicateTeamCodes: [],
      warnings: [],
    },
  };
}

describe("computeLoanTerms", () => {
  // Doc example table: 20M principal, finances 5 (risk +6%).
  const rows: Array<{ termSeasons: number; rate: number; installment: number }> = [
    { termSeasons: 1, rate: 0.16, installment: 23.2 },
    { termSeasons: 3, rate: 0.152, installment: 8.79 },
    { termSeasons: 5, rate: 0.144, installment: 5.88 },
    { termSeasons: 8, rate: 0.132, installment: 4.2 },
    { termSeasons: 10, rate: 0.124, installment: 3.6 },
  ];

  for (const row of rows) {
    it(`matches doc example for ${row.termSeasons} season(s)`, () => {
      const terms = computeLoanTerms({ principal: 20, termSeasons: row.termSeasons, finances: 5 });
      expect(terms.interestRatePerSeason).toBeCloseTo(row.rate, 3);
      expect(terms.installmentPerSeason).toBeCloseTo(row.installment, 1);
    });
  }

  it("has a monotonically increasing total interest even though the rate decreases with term", () => {
    const totals = rows.map((row) => {
      const terms = computeLoanTerms({ principal: 20, termSeasons: row.termSeasons, finances: 5 });
      return terms.installmentPerSeason * row.termSeasons - 20;
    });
    for (let i = 1; i < totals.length; i += 1) {
      expect(totals[i]).toBeGreaterThan(totals[i - 1]);
    }
  });

  it("floors the rate at 7%", () => {
    const terms = computeLoanTerms({ principal: 10, termSeasons: 10, finances: 10 });
    expect(terms.interestRatePerSeason).toBeCloseTo(0.07, 4);
  });

  it("caps the rate at 20%", () => {
    const terms = computeLoanTerms({ principal: 10, termSeasons: 1, finances: 0 });
    expect(terms.interestRatePerSeason).toBeCloseTo(0.2, 4);
  });
});

describe("computeBorrowingCapacity", () => {
  it("caps at the teamwert (cash+marketvalue) share", () => {
    // teamwertCap = 0.15*cash + 0.30*marketValueTotal.
    expect(
      computeBorrowingCapacity({ cash: 100, marketValueTotal: 200, annualRevenue: 80, currentOutstandingDebt: 0 }),
    ).toBeCloseTo(75, 1); // 0.15*100=15 + 0.30*200=60 -> 75 - 0 = 75
    expect(
      computeBorrowingCapacity({ cash: 20, marketValueTotal: 40, annualRevenue: 200, currentOutstandingDebt: 0 }),
    ).toBeCloseTo(15, 1); // 0.15*20=3 + 0.30*40=12 -> 15 - 0 = 15
  });

  it("subtracts existing debt and floors at 0", () => {
    expect(
      computeBorrowingCapacity({ cash: 100, marketValueTotal: 200, annualRevenue: 80, currentOutstandingDebt: 65 }),
    ).toBeCloseTo(10, 1); // teamwertCap 75 - 65 = 10
    expect(
      computeBorrowingCapacity({ cash: 100, marketValueTotal: 200, annualRevenue: 80, currentOutstandingDebt: 999 }),
    ).toBe(0);
  });

  it("is not zeroed by zero annual revenue (team-value only, no revenue cap)", () => {
    // Zero-revenue team (e.g. no sponsor payout yet) still gets a real, non-zero
    // capacity purely from cash + market value — the old revenue cap used to
    // collapse this to 0.
    expect(
      computeBorrowingCapacity({ cash: 100, marketValueTotal: 200, annualRevenue: 0, currentOutstandingDebt: 0 }),
    ).toBeCloseTo(75, 1);
  });
});

describe("getTeamOutstandingDebt", () => {
  it("sums only active loans for the given team", () => {
    const gameState = createGameState({
      loans: [
        { ...baseLoan(), loanId: "l1", borrowerTeamId: "A-A", principalOutstanding: 10, status: "active" },
        { ...baseLoan(), loanId: "l2", borrowerTeamId: "A-A", principalOutstanding: 5, status: "active" },
        { ...baseLoan(), loanId: "l3", borrowerTeamId: "A-A", principalOutstanding: 999, status: "paid" },
        { ...baseLoan(), loanId: "l4", borrowerTeamId: "B-B", principalOutstanding: 999, status: "active" },
      ],
    });
    expect(getTeamOutstandingDebt(gameState, "A-A")).toBeCloseTo(15, 1);
  });
});

describe("estimateTeamAnnualRevenue", () => {
  it("uses the most recent season of sponsor payout logs", () => {
    const gameState = createGameState({
      sponsorPayoutLogs: [
        { id: "p1", saveId: "s", seasonId: "season-1", teamId: "A-A", phase: "season_end", componentId: "base", cashDelta: 20, action: "apply", createdAt: "2026-01-01T00:00:00.000Z" },
        { id: "p2", saveId: "s", seasonId: "season-2", teamId: "A-A", phase: "season_end", componentId: "base", cashDelta: 80, action: "apply", createdAt: "2027-01-01T00:00:00.000Z" },
      ],
    });
    expect(estimateTeamAnnualRevenue(gameState, "A-A")).toBeCloseTo(80, 1);
  });

  it("returns 0 when no sponsor data exists for the team", () => {
    const gameState = createGameState();
    expect(estimateTeamAnnualRevenue(gameState, "A-A")).toBe(0);
  });
});

function baseLoan(): LoanRecord {
  return {
    loanId: "loan-base",
    borrowerTeamId: "A-A",
    lenderType: "bank",
    principalOriginal: 20,
    principalOutstanding: 20,
    interestRatePerSeason: 0.152,
    termSeasons: 3,
    seasonsRemaining: 3,
    installmentPerSeason: 8.79,
    originatedSeasonId: "season-1",
    status: "active",
    missedPayments: 0,
  };
}

describe("originateLoan", () => {
  function gameStateWithCapacity() {
    return createGameState({
      teams: [createTeam({ teamId: "A-A", cash: 50 })],
      teamIdentities: [createIdentity("A-A", { finances: 5 })],
      standings: { "A-A": { points: 0, marketValueTotal: 200 } as unknown as StandingRecord },
      sponsorPayoutLogs: [
        {
          id: "p1",
          saveId: "s",
          seasonId: "season-2",
          teamId: "A-A",
          phase: "season_end",
          componentId: "base",
          cashDelta: 80,
          action: "apply",
          createdAt: "2027-01-01T00:00:00.000Z",
        },
      ],
    });
    // capacity = 0.15*50 + 0.30*200 = 67.5 - 0 = 67.5 (annualRevenue no longer caps capacity)
  }

  it("previews without mutating when execute is not set", () => {
    const gameState = gameStateWithCapacity();
    const result = originateLoan(gameState, { borrowerTeamId: "A-A", principal: 50, termSeasons: 3 });
    expect(result.ok).toBe(true);
    expect(result.loan).not.toBeNull();
    expect(result.gameState).toBe(gameState);
    expect(result.gameState.teams.find((t) => t.teamId === "A-A")?.cash).toBe(50);
  });

  it("credits cash and appends a LoanRecord on execute", () => {
    const gameState = gameStateWithCapacity();
    const result = originateLoan(gameState, { borrowerTeamId: "A-A", principal: 50, termSeasons: 3 }, { execute: true });
    expect(result.ok).toBe(true);
    expect(result.gameState.teams.find((t) => t.teamId === "A-A")?.cash).toBeCloseTo(100, 1);
    expect(result.gameState.seasonState.loans).toHaveLength(1);
    expect(result.gameState.seasonState.loans?.[0]?.principalOutstanding).toBeCloseTo(50, 1);
    expect(result.gameState.seasonState.loans?.[0]?.lenderType).toBe("bank");
    expect(result.gameState.seasonState.loans?.[0]?.status).toBe("active");
  });

  it("rejects a principal above the borrowing capacity", () => {
    const gameState = gameStateWithCapacity();
    const result = originateLoan(gameState, { borrowerTeamId: "A-A", principal: 100, termSeasons: 3 }, { execute: true });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("over_capacity");
    expect(result.capacity).toBeCloseTo(67.5, 1);
    expect(result.gameState).toBe(gameState);
    expect(result.gameState.seasonState.loans ?? []).toHaveLength(0);
  });

  it("rejects invalid principal and term inputs", () => {
    const gameState = gameStateWithCapacity();
    expect(originateLoan(gameState, { borrowerTeamId: "A-A", principal: 0, termSeasons: 3 }).reason).toBe(
      "invalid_principal",
    );
    expect(originateLoan(gameState, { borrowerTeamId: "A-A", principal: 10, termSeasons: 11 }).reason).toBe(
      "invalid_term_seasons",
    );
  });

  it("Season 1 = keine Kredite: refuses regardless of capacity, no mutation", () => {
    const gameState = { ...gameStateWithCapacity(), season: { ...gameStateWithCapacity().season, id: "season-1" } };
    const result = originateLoan(gameState, { borrowerTeamId: "A-A", principal: 10, termSeasons: 3 }, { execute: true });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("season_one_no_loans");
    expect(result.loan).toBeNull();
    expect(result.gameState).toBe(gameState);
    expect(result.gameState.seasonState.loans ?? []).toHaveLength(0);
    expect(result.gameState.teams.find((t) => t.teamId === "A-A")?.cash).toBe(50);
  });
});

describe("applyLoanSettlement", () => {
  it("debits cash and reduces outstanding principal and remaining term", () => {
    const gameState = createGameState({
      teams: [createTeam({ teamId: "A-A", cash: 50 })],
      loans: [baseLoan()],
    });

    const result = applyLoanSettlement(gameState, { execute: true });
    expect(result.applied).toBe(true);

    const team = result.gameState.teams.find((t) => t.teamId === "A-A");
    expect(team?.cash).toBeCloseTo(50 - 8.79, 1);

    const loan = result.gameState.seasonState.loans?.[0];
    expect(loan?.status).toBe("active");
    expect(loan?.seasonsRemaining).toBe(2);
    // interest portion = round(20 * 0.152, 1) = 3.0, principal portion = 8.79 - 3.0 = 5.79 -> rounded 5.8
    expect(loan?.principalOutstanding).toBeCloseTo(20 - 5.8, 1);
  });

  it("marks the loan paid when seasonsRemaining reaches 0", () => {
    const gameState = createGameState({
      teams: [createTeam({ teamId: "A-A", cash: 50 })],
      loans: [{ ...baseLoan(), seasonsRemaining: 1, termSeasons: 3 }],
    });

    const result = applyLoanSettlement(gameState, { execute: true });
    const loan = result.gameState.seasonState.loans?.[0];
    expect(loan?.status).toBe("paid");
    expect(loan?.seasonsRemaining).toBe(0);
    expect(loan?.principalOutstanding).toBe(0);
  });

  it("does not charge twice for the same season (idempotent)", () => {
    const gameState = createGameState({
      teams: [createTeam({ teamId: "A-A", cash: 50 })],
      loans: [baseLoan()],
    });

    const first = applyLoanSettlement(gameState, { execute: true });
    expect(first.applied).toBe(true);
    const cashAfterFirst = first.gameState.teams.find((t) => t.teamId === "A-A")?.cash;

    const second = applyLoanSettlement(first.gameState, { execute: true });
    expect(second.applied).toBe(false);
    expect(second.duplicateDetected).toBe(true);
    expect(second.gameState.teams.find((t) => t.teamId === "A-A")?.cash).toBe(cashAfterFirst);
    expect(second.gameState.seasonState.loans).toEqual(first.gameState.seasonState.loans);
  });

  it("does not mutate on preview (execute not set)", () => {
    const gameState = createGameState({
      teams: [createTeam({ teamId: "A-A", cash: 50 })],
      loans: [baseLoan()],
    });
    const preview = previewLoanSettlement(gameState);
    expect(preview.canApply).toBe(true);
    expect(preview.duplicateDetected).toBe(false);

    const result = applyLoanSettlement(gameState);
    expect(result.applied).toBe(false);
    expect(result.gameState).toBe(gameState);
  });

  it("capitalizes the shortfall plus penalty and records a missed payment when cash is insufficient", () => {
    const gameState = createGameState({
      teams: [createTeam({ teamId: "A-A", cash: 3 })],
      loans: [baseLoan()],
    });

    const result = applyLoanSettlement(gameState, { execute: true });
    const team = result.gameState.teams.find((t) => t.teamId === "A-A");
    // All available cash gets swept.
    expect(team?.cash).toBeCloseTo(0, 1);
    expect(team?.cash).not.toBeLessThan(0);

    const loan = result.gameState.seasonState.loans?.[0];
    expect(loan?.missedPayments).toBe(1);
    expect(loan?.status).toBe("active");
    // Shortfall (installment 8.79 - paid 3 = 5.79) plus 5% penalty gets capitalized onto principal.
    // principalOutstanding should now exceed the pre-installment outstanding of 20.
    expect(loan?.principalOutstanding ?? 0).toBeGreaterThan(20);
  });

  it("marks the loan defaulted after repeated missed payments", () => {
    const gameState = createGameState({
      teams: [createTeam({ teamId: "A-A", cash: 0 })],
      loans: [{ ...baseLoan(), missedPayments: 1 }],
    });

    const result = applyLoanSettlement(gameState, { execute: true });
    const loan = result.gameState.seasonState.loans?.[0];
    expect(loan?.missedPayments).toBe(2);
    expect(loan?.status).toBe("defaulted");
  });

  it("applies a board-confidence hit on default/capitalization", () => {
    const gameState = createGameState({
      teams: [createTeam({ teamId: "A-A", cash: 0 })],
      loans: [baseLoan()],
    });
    const result = applyLoanSettlement(gameState, { execute: true });
    const board = result.gameState.seasonState.boardConfidence?.["A-A"];
    expect(board).toBeDefined();
    expect(board?.value).toBeLessThan(5);
  });

  it("ignores loans that are already paid or defaulted", () => {
    const gameState = createGameState({
      teams: [createTeam({ teamId: "A-A", cash: 50 })],
      loans: [
        { ...baseLoan(), loanId: "paid-loan", status: "paid", principalOutstanding: 0, seasonsRemaining: 0 },
        { ...baseLoan(), loanId: "defaulted-loan", status: "defaulted" },
      ],
    });
    const preview = previewLoanSettlement(gameState);
    expect(preview.canApply).toBe(false);
    const result = applyLoanSettlement(gameState, { execute: true });
    expect(result.applied).toBe(false);
    expect(result.gameState.teams.find((t) => t.teamId === "A-A")?.cash).toBe(50);
  });
});

describe("computeEarlyPayoff", () => {
  it("matches the doc example: 18 remaining scheduled, 15 outstanding -> 15.6 payoff", () => {
    // installmentPerSeason * seasonsRemaining = 18 ("noch offen"), principalOutstanding = 15.
    const loan: LoanRecord = { ...baseLoan(), installmentPerSeason: 6, seasonsRemaining: 3, principalOutstanding: 15 };
    const quote = computeEarlyPayoff(loan);
    expect(quote.foregoneInterest).toBeCloseTo(3, 1); // 18 - 15
    expect(quote.feePortion).toBeCloseTo(0.6, 1); // 0.20 * 3
    expect(quote.principalPortion).toBeCloseTo(15, 1);
    expect(quote.payoff).toBeCloseTo(15.6, 1);
  });

  it("has zero foregone interest and fee when remaining scheduled payments no longer exceed principal", () => {
    const loan: LoanRecord = { ...baseLoan(), installmentPerSeason: 5, seasonsRemaining: 1, principalOutstanding: 20 };
    const quote = computeEarlyPayoff(loan);
    expect(quote.foregoneInterest).toBe(0);
    expect(quote.feePortion).toBe(0);
    expect(quote.payoff).toBeCloseTo(20, 1);
  });
});

describe("applyEarlyPayoff", () => {
  it("debits cash and marks the loan paid on execute", () => {
    const gameState = createGameState({
      teams: [createTeam({ teamId: "A-A", cash: 50 })],
      loans: [{ ...baseLoan(), installmentPerSeason: 6, seasonsRemaining: 3, principalOutstanding: 15 }],
    });
    const result = applyEarlyPayoff(gameState, "loan-base", { execute: true });
    expect(result.ok).toBe(true);
    expect(result.payoff).toBeCloseTo(15.6, 1);
    expect(result.gameState.teams.find((t) => t.teamId === "A-A")?.cash).toBeCloseTo(50 - 15.6, 1);
    const loan = result.gameState.seasonState.loans?.[0];
    expect(loan?.status).toBe("paid");
    expect(loan?.principalOutstanding).toBe(0);
    expect(loan?.seasonsRemaining).toBe(0);
  });

  it("previews without mutating when execute is not set", () => {
    const gameState = createGameState({
      teams: [createTeam({ teamId: "A-A", cash: 50 })],
      loans: [{ ...baseLoan(), installmentPerSeason: 6, seasonsRemaining: 3, principalOutstanding: 15 }],
    });
    const result = applyEarlyPayoff(gameState, "loan-base");
    expect(result.ok).toBe(true);
    expect(result.gameState).toBe(gameState);
    expect(result.gameState.teams.find((t) => t.teamId === "A-A")?.cash).toBe(50);
    expect(result.gameState.seasonState.loans?.[0]?.status).toBe("active");
  });

  it("rejects when borrower cash is insufficient, no mutation", () => {
    const gameState = createGameState({
      teams: [createTeam({ teamId: "A-A", cash: 5 })],
      loans: [{ ...baseLoan(), installmentPerSeason: 6, seasonsRemaining: 3, principalOutstanding: 15 }],
    });
    const result = applyEarlyPayoff(gameState, "loan-base", { execute: true });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("insufficient_cash");
    expect(result.gameState).toBe(gameState);
    expect(result.gameState.seasonState.loans?.[0]?.status).toBe("active");
  });

  it("rejects a loan that is not active", () => {
    const gameState = createGameState({
      teams: [createTeam({ teamId: "A-A", cash: 50 })],
      loans: [{ ...baseLoan(), status: "paid", principalOutstanding: 0, seasonsRemaining: 0 }],
    });
    const result = applyEarlyPayoff(gameState, "loan-base", { execute: true });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("loan_not_active");
  });

  it("rejects an unknown loan id", () => {
    const gameState = createGameState({ teams: [createTeam({ teamId: "A-A", cash: 50 })], loans: [baseLoan()] });
    const result = applyEarlyPayoff(gameState, "does-not-exist", { execute: true });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("loan_not_found");
  });
});
