import { describe, expect, it } from "vitest";

import type { GameState, LoanRecord } from "@/lib/data/olyDataTypes";
import { buildFinancesViewModel } from "@/lib/foundation/finances/use-finances-view-model";
import { makePlayer, makeRosterEntry, makeTeam, makeTeamIdentity } from "./_fixtures/game-entity-fixtures";

/** Mirror the view-model's 1-decimal rounding so reconciliation assertions are exact. */
function round1(value: number): number {
  return Number(value.toFixed(1));
}

/**
 * Builds a Season-2 GameState for one human team with a real cash-effective facility
 * (fan_shop L2: seasonIncome 6.5, seasonUpkeep 0.8 — flat, NOT popularity-scaled, so the
 * facility numbers are deterministic regardless of league-wide Beliebtheit), a roster salary,
 * an archived Season-1 snapshot (for cashSeasonStart), and a phantom benchmark `cashTotal`
 * that must be ignored in favour of the real `cashEnd`.
 */
function buildGameState(input: {
  teamCash: number;
  salary: number;
  salaryDemand?: number;
  snapshotCashEnd?: number | null;
  snapshotCashTotalPhantom?: number | null;
}): GameState {
  const team = makeTeam({ teamId: "team-1", shortCode: "T1", name: "Test United", cash: input.teamCash, budget: 100 });
  const rival = makeTeam({ teamId: "team-2", shortCode: "T2", name: "Rival City", cash: 80, budget: 100 });
  const player = makePlayer({ id: "player-1", name: "Star One", salaryDemand: input.salaryDemand ?? 99 });
  const roster = makeRosterEntry({ id: "r1", teamId: "team-1", playerId: "player-1", salary: input.salary });

  const seasonSnapshots =
    input.snapshotCashEnd === null
      ? []
      : [
          {
            seasonId: "season-1",
            seasonName: "Season 1",
            finalStandings: [
              {
                teamId: "team-1",
                rank: 1,
                disciplinePointsByArea: { pow: 10, spe: 10, men: 10, soc: 10 },
                // Real carried cash end (must win) vs. phantom projectedCash (must be ignored).
                cashEnd: input.snapshotCashEnd ?? 100,
                cashTotal: input.snapshotCashTotalPhantom ?? 9999,
                // Legacy prize-as-income GuV in the archive — must NOT be surfaced as a bar.
                guv: 42,
              },
              {
                teamId: "team-2",
                rank: 2,
                disciplinePointsByArea: { pow: 8, spe: 8, men: 8, soc: 8 },
                cashEnd: 80,
                cashTotal: 80,
                guv: 10,
              },
            ],
          },
        ];

  return {
    season: { id: "season-2", name: "Season 2", year: 2, currentMatchday: 1, matchdayIds: ["md-1"] },
    matchdayState: { matchdayId: "md-1" },
    teams: [team, rival],
    teamIdentities: [makeTeamIdentity({ teamId: "team-1" }), makeTeamIdentity({ teamId: "team-2" })],
    teamStrategyProfiles: [],
    players: [player],
    rosters: [roster],
    disciplines: [],
    transferHistory: [],
    playerProgressionEvents: [],
    seasonState: {
      seasonId: "season-2",
      loans: [],
      standings: {
        "team-1": { teamId: "team-1", points: 20, rank: 1 },
        "team-2": { teamId: "team-2", points: 10, rank: 2 },
      },
      matchdayResults: [],
      disciplineResults: [],
      playerDisciplinePerformances: [],
      formCards: [],
      facilityEvents: [],
      teamFacilities: {
        "team-1": {
          facilities: {
            fan_shop: { level: 2, enabled: true, conditionPct: 100 },
          },
        },
      },
      seasonSnapshots,
    },
  } as unknown as GameState;
}

describe("finances view-model — cash reconciliation (T-108)", () => {
  it("(a) prize money is a benchmark and never inflates totalIncome/guv", () => {
    const model = buildFinancesViewModel(buildGameState({ teamCash: 200, salary: 20 }), "team-1");
    expect(model.status).toBe("ready");
    if (model.status !== "ready") return;
    const { team } = model;

    // totalIncome is composed ONLY of the real cash-effective streams; prize is excluded.
    const expectedIncome = round1(
      (team.income.sponsor?.total ?? 0) +
        (team.income.facilityIncome?.total ?? 0) +
        (team.income.transferSurplus ?? 0) +
        (team.income.objectiveReward ?? 0),
    );
    expect(team.totalIncome).toBe(expectedIncome);

    // If a prize benchmark is present it is strictly informational and NOT summed in.
    if (team.income.prizeBenchmark && team.income.prizeBenchmark.total > 0) {
      expect(team.totalIncome).not.toBe(round1(expectedIncome + team.income.prizeBenchmark.total));
    }
  });

  it("(b) facility income is on the income side; only PAID upkeep is charged (symmetry)", () => {
    // Plenty of cash → the fan_shop upkeep (0.8) is actually paid.
    const richModel = buildFinancesViewModel(buildGameState({ teamCash: 200, salary: 20 }), "team-1");
    if (richModel.status !== "ready") throw new Error("expected ready");
    expect(richModel.team.income.facilityIncome?.total).toBe(6.5);
    expect(richModel.team.expenses.facilityUpkeep.total).toBe(0.8);

    // Effectively no cash → upkeep can no longer be paid, but the income is still collected.
    // This is the asymmetry the old model got wrong (income missing, gross upkeep charged).
    const brokeModel = buildFinancesViewModel(buildGameState({ teamCash: -50, salary: 20 }), "team-1");
    if (brokeModel.status !== "ready") throw new Error("expected ready");
    expect(brokeModel.team.income.facilityIncome?.total).toBe(6.5);
    expect(brokeModel.team.expenses.facilityUpkeep.total).toBe(0);
  });

  it("(c) salary source is contract.salary (settlement field), not expectedSalary", () => {
    // rosterEntry.salary=20 is contract.salary; the player's salaryDemand=99 would only feed
    // the divergent expectedSalary the old code used.
    const model = buildFinancesViewModel(buildGameState({ teamCash: 200, salary: 20, salaryDemand: 99 }), "team-1");
    if (model.status !== "ready") throw new Error("expected ready");
    expect(model.team.expenses.salaries.total).toBe(20);
  });

  it("(c) board-objective cashDelta is included as income (>0) or expense (<0)", () => {
    const model = buildFinancesViewModel(buildGameState({ teamCash: 200, salary: 20 }), "team-1");
    if (model.status !== "ready") throw new Error("expected ready");
    const { team } = model;
    // Reward and penalty are mutually exclusive and always non-negative.
    expect(team.income.objectiveReward == null || team.income.objectiveReward > 0).toBe(true);
    expect(team.expenses.objectivePenalty == null || team.expenses.objectivePenalty > 0).toBe(true);
    expect(team.income.objectiveReward != null && team.expenses.objectivePenalty != null).toBe(false);
  });

  it("core identity: Σ(income) − Σ(expenses) == guv == real cash delta of the season", () => {
    const model = buildFinancesViewModel(buildGameState({ teamCash: 200, salary: 20, snapshotCashEnd: 150 }), "team-1");
    if (model.status !== "ready") throw new Error("expected ready");
    const { team } = model;

    const incomeSum = round1(
      (team.income.sponsor?.total ?? 0) +
        (team.income.facilityIncome?.total ?? 0) +
        (team.income.transferSurplus ?? 0) +
        (team.income.objectiveReward ?? 0),
    );
    const expenseSum = round1(
      team.expenses.salaries.total +
        team.expenses.facilityUpkeep.total +
        team.expenses.loanInstallments.total +
        (team.expenses.transferDeficit ?? 0) +
        (team.expenses.objectivePenalty ?? 0),
    );
    expect(team.totalIncome).toBe(incomeSum);
    expect(team.totalExpenses).toBe(expenseSum);
    expect(team.guv).toBe(round1(incomeSum - expenseSum));

    // The reconciliation identity the tab renders: start-cash + guv + other movements == cash.
    expect(team.cashSeasonStart).toBe(150);
    expect(round1((team.cashSeasonStart ?? 0) + team.guv + (team.otherCashMovements ?? 0))).toBe(round1(team.cash));
  });

  it("(e) loan expense in the GuV is the INTEREST portion only, not the full installment", () => {
    // Accounting model: only interest is a P&L expense; the principal repayment is a balance movement
    // (mirror of loan proceeds NOT being income). Loan: outstanding 100 @ 10% -> interest 10 per season,
    // while the full installment is 30. The GuV loan expense must be 10, not 30.
    const base = buildGameState({ teamCash: 200, salary: 20 });
    const loan: LoanRecord = {
      loanId: "loan-1",
      borrowerTeamId: "team-1",
      lenderType: "bank",
      principalOriginal: 120,
      principalOutstanding: 100,
      interestRatePerSeason: 0.1,
      termSeasons: 5,
      seasonsRemaining: 4,
      installmentPerSeason: 30,
      originatedSeasonId: "season-1",
      status: "active",
      missedPayments: 0,
    };
    const gameState = { ...base, seasonState: { ...base.seasonState, loans: [loan] } } as GameState;

    const model = buildFinancesViewModel(gameState, "team-1");
    if (model.status !== "ready") throw new Error("expected ready");
    const { team } = model;

    // Loan expense line = interest (10), NOT the full installment (30).
    expect(team.expenses.loanInstallments.total).toBe(10);
    expect(team.expenses.loanInstallments.total).not.toBe(30);
    // Per-loan row carries the interest too (display/total stay consistent -> no share/flow-chart drift).
    expect(team.expenses.loanInstallments.loans).toHaveLength(1);
    expect(team.expenses.loanInstallments.loans[0].installment).toBe(10);
    expect(team.expenses.loanInstallments.loans[0].outstanding).toBe(100);
    // The interest flows into totalExpenses; the principal repayment does not.
    const expenseSum = round1(
      team.expenses.salaries.total +
        team.expenses.facilityUpkeep.total +
        team.expenses.loanInstallments.total +
        (team.expenses.transferDeficit ?? 0) +
        (team.expenses.objectivePenalty ?? 0),
    );
    expect(team.totalExpenses).toBe(expenseSum);
  });

  it("(d) archived history uses REAL cashEnd (not phantom cashTotal) and suppresses stale guv", () => {
    const model = buildFinancesViewModel(
      buildGameState({ teamCash: 200, salary: 20, snapshotCashEnd: 150, snapshotCashTotalPhantom: 9999 }),
      "team-1",
    );
    if (model.status !== "ready") throw new Error("expected ready");
    const archived = model.team.history.filter((point) => !point.isCurrent);
    expect(archived).toHaveLength(1);
    // Real carried cash, not the projectedCash phantom.
    expect(archived[0].cash).toBe(150);
    // Legacy prize-based guv is not surfaced as a phantom bar.
    expect(archived[0].guv).toBeNull();
    // The current season still carries the corrected live guv.
    const current = model.team.history.find((point) => point.isCurrent);
    expect(current?.guv).toBe(model.team.guv);
  });
});
