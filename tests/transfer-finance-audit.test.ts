import { describe, expect, it } from "vitest";

import type { GameState, LoanRecord, Player, RosterEntry, Team, TeamIdentity } from "@/lib/data/olyDataTypes";
import { buildBuyEconomics, buildTransferFinanceAudit } from "@/lib/season/transfer-finance-audit";
import { applyEarlyPayoff } from "@/lib/finance/loan-service";
import {
  applyTeamSeasonObjectiveRewards,
  buildTeamSeasonObjectiveSettlement,
} from "@/lib/board/team-season-objectives-service";

function minimalGameState(overrides: Partial<GameState> = {}): GameState {
  return {
    season: { id: "season-1" },
    teams: [
      { teamId: "T1", name: "Team One", cash: 50, shortCode: "T1" },
      { teamId: "T2", name: "Team Two", cash: 40, shortCode: "T2" },
    ],
    players: [{ id: "p1", name: "Player One", salaryDemand: 3 }],
    rosters: [],
    transferHistory: [
      {
        seasonId: "season-1",
        transferType: "buy",
        playerId: "p1",
        playerName: "Player One",
        toTeamId: "T1",
        fromTeamId: null,
        fee: 10,
        salary: 3,
        source: "ai_market_plan",
      },
      {
        seasonId: "season-1",
        transferType: "sell",
        playerId: "p2",
        playerName: "Sold",
        fromTeamId: "T2",
        toTeamId: null,
        fee: 8,
        source: "ai_market_plan",
      },
    ],
    seasonState: {
      seasonSnapshots: [
        {
          seasonId: "season-1",
          finalStandings: [
            { teamId: "T1", cashEnd: 37, cashTotal: 37 },
            { teamId: "T2", cashEnd: 48, cashTotal: 48 },
          ],
        },
      ],
      sponsorPayoutLogs: [
        { seasonId: "season-1", teamId: "T1", cashDelta: 5, phase: "settlement" },
        { seasonId: "season-1", teamId: "T1", cashDelta: -3, phase: "salary" },
      ],
    },
    teamIdentities: [],
    ...overrides,
  } as GameState;
}

describe("transfer-finance-audit", () => {
  it("buildBuyEconomics mirrors fee + salary for buys", () => {
    const rows = buildBuyEconomics(minimalGameState());
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      seasonId: "season-1",
      fee: 10,
      annualSalary: 3,
      totalFirstYearCost: 13,
    });
  });

  it("flags zero-fee non-repair buys and computes reconciliation rows", () => {
    const audit = buildTransferFinanceAudit(
      minimalGameState({
        transferHistory: [
          {
            seasonId: "season-1",
            transferType: "buy",
            playerId: "p-free",
            toTeamId: "T1",
            fee: 0,
            source: "ai_market_plan",
          },
        ],
      }),
    );

    expect(audit.violations.some((entry) => entry.startsWith("zero_fee_buy:"))).toBe(true);
    expect(audit.rows.some((row) => row.teamId === "T1" && row.seasonId === "season-1")).toBe(true);
    expect(audit.rows.find((row) => row.teamId === "T1" && row.seasonId === "season-1")).toMatchObject({
      buyCount: 1,
      draftBuyCount: 0,
      marketBuyCount: 1,
    });
    expect(audit.doctrineStats.length).toBeGreaterThan(0);
    expect(audit.doctrineStats.find((row) => row.teamId === "T1" && row.seasonId === "season-1")).toMatchObject({
      buys: 1,
      draftBuys: 0,
      marketBuys: 1,
    });
  });

  it("counts draft picks separately from market buys in season 1", () => {
    const audit = buildTransferFinanceAudit(
      minimalGameState({
        transferHistory: [
          {
            seasonId: "season-1",
            transferType: "buy",
            playerId: "p-draft",
            toTeamId: "T1",
            fee: 25,
            source: "ai_roster_fill",
          },
          {
            seasonId: "season-1",
            transferType: "buy",
            playerId: "p-draft-2",
            toTeamId: "T1",
            fee: 18,
            source: "season1_autoprep_topup",
          },
        ],
      }),
    );

    expect(audit.rows.find((row) => row.teamId === "T1" && row.seasonId === "season-1")).toMatchObject({
      buyCount: 0,
      draftBuyCount: 2,
      marketBuyCount: 0,
      buyFeesPaid: 43,
    });
    expect(audit.doctrineStats.find((row) => row.teamId === "T1" && row.seasonId === "season-1")).toMatchObject({
      buys: 0,
      draftBuys: 2,
      marketBuys: 0,
    });
  });

  it("reconciles a season anchored to the TRUE prior-season cashEnd, including auto-settle sponsor events", () => {
    // Season-1 true season-end cash = 100 (the reconciliation ANCHOR for season-2). Season-2 flows:
    //   buy fee 10        → netTransferCash = -10
    //   sponsor payout +5 → netSponsorCash = +5   (season-end settlement, in sponsorPayoutLogs)
    //   sponsor event +4  → netSponsorEventCash = +4 (auto-settled, credited straight to team.cash)
    // Expected season-2 cashEnd = 100 - 10 + 5 + 4 = 99  →  reconciliation delta = 0.
    const gameState = {
      season: { id: "season-2" },
      teams: [{ teamId: "T1", name: "Team One", cash: 99, shortCode: "T1" }],
      players: [],
      rosters: [],
      transferHistory: [
        {
          seasonId: "season-2",
          transferType: "buy",
          playerId: "pb",
          toTeamId: "T1",
          fromTeamId: null,
          fee: 10,
          source: "ai_market_plan",
        },
      ],
      seasonState: {
        seasonSnapshots: [
          { seasonId: "season-1", finalStandings: [{ teamId: "T1", cashEnd: 100, cashTotal: 100 }] },
          { seasonId: "season-2", finalStandings: [{ teamId: "T1", cashEnd: 99, cashTotal: 99 }] },
        ],
        sponsorPayoutLogs: [{ seasonId: "season-2", teamId: "T1", cashDelta: 5, phase: "settlement" }],
        sponsorEvents: [
          { seasonId: "season-2", teamId: "T1", cashDelta: 4, status: "resolved" }, // applied → counted
          { seasonId: "season-2", teamId: "T1", cashDelta: 3, status: "dismissed" }, // rejected → excluded
          { seasonId: "season-2", teamId: "T1", cashDelta: 7, status: "open" }, // pending → excluded
        ],
      },
      teamIdentities: [],
    } as unknown as GameState;

    const audit = buildTransferFinanceAudit(gameState);
    const season2 = audit.rows.find((row) => row.teamId === "T1" && row.seasonId === "season-2");

    expect(season2?.cashStart).toBe(100);
    expect(season2?.netTransferCash).toBe(-10);
    expect(season2?.netSponsorCash).toBe(5);
    // Only the resolved event is cash-effective; dismissed/open are excluded.
    expect(season2?.netSponsorEventCash).toBe(4);
    // Delta is ~0 (not inflated by preseason spend, not left with a sponsor-event residual).
    expect(season2?.cashReconciliationDelta).toBe(0);
    expect(audit.violations.some((entry) => entry.startsWith("cash_reconciliation_delta_hard:season-2"))).toBe(false);
    expect(audit.violations.some((entry) => entry.startsWith("cash_reconciliation_delta:season-2"))).toBe(false);
  });

  it("reconciles a season to ~0 after an early loan payoff (applyEarlyPayoff emits a ledger entry)", () => {
    // Season-1 true season-end cash = 100 (the reconciliation ANCHOR for season-2). During season-2 the
    // team pays off a loan early: cash -15.6 (principal 15 + 0.2 * foregoneInterest 3). Before the fix
    // applyEarlyPayoff moved cash WITHOUT any loan log, so getSeasonLoanCashByTeam missed it → a false
    // cash_reconciliation_delta_hard. Now the early-payoff loanApplyLog makes netLoanCash = -15.6, so
    // the season reconciles to 0.
    const loan: LoanRecord = {
      loanId: "loan-1",
      borrowerTeamId: "T1",
      lenderType: "bank",
      principalOriginal: 20,
      principalOutstanding: 15,
      interestRatePerSeason: 0.152,
      termSeasons: 3,
      seasonsRemaining: 3,
      installmentPerSeason: 6,
      originatedSeasonId: "season-1",
      status: "active",
      missedPayments: 0,
    };
    const before = {
      season: { id: "season-2" },
      teams: [{ teamId: "T1", name: "Team One", cash: 100, shortCode: "T1" }],
      players: [],
      rosters: [],
      transferHistory: [],
      seasonState: {
        seasonSnapshots: [
          { seasonId: "season-1", finalStandings: [{ teamId: "T1", cashEnd: 100, cashTotal: 100 }] },
        ],
        loans: [loan],
        loanApplyLogs: [],
      },
      teamIdentities: [],
    } as unknown as GameState;

    const payoff = applyEarlyPayoff(before, "loan-1", { execute: true });
    expect(payoff.ok).toBe(true);
    expect(payoff.payoff).toBeCloseTo(15.6, 1);

    const audit = buildTransferFinanceAudit(payoff.gameState);
    const season2 = audit.rows.find((row) => row.teamId === "T1" && row.seasonId === "season-2");
    expect(season2?.cashStart).toBe(100);
    expect(season2?.cashEnd).toBeCloseTo(84.4, 1); // live cash of the current season after payoff
    expect(season2?.netLoanCash).toBeCloseTo(-15.6, 1);
    expect(season2?.cashReconciliationDelta ?? 1).toBeCloseTo(0, 1);
    expect(audit.violations.some((entry) => entry.startsWith("cash_reconciliation_delta_hard:season-2"))).toBe(false);
    expect(audit.violations.some((entry) => entry.startsWith("cash_reconciliation_delta:season-2"))).toBe(false);
  });

  it("reconciles a season to 0 ONLY once the board-objective reward cash channel is included", () => {
    // Board-Objective-Rewards werden am Saisonende via applyTeamSeasonObjectiveRewards direkt auf
    // team.cash gebucht (team.cash += settlement.byTeamId[teamId].cashDelta) und landen so im
    // reconcilten cashEnd — waren aber bis dato nicht in cashReconciliationDelta abgezogen. Hier wird
    // ein realer Reward tatsächlich gebucht und danach reconciled: MIT dem neuen Term = Delta 0,
    // OHNE ihn wäre das Delta genau der (von Null verschiedene) Reward-Betrag.
    const buildTeam = (teamId: string, cash: number): Team =>
      ({
        teamId,
        shortCode: teamId,
        name: teamId,
        budget: 120,
        cash,
        identityId: teamId,
        humanControlled: false,
        rosterLimit: 12,
        logoPath: null,
      }) as Team;
    const buildIdentity = (teamId: string): TeamIdentity =>
      ({
        teamId,
        playerType: null,
        pow: 8,
        spe: 7,
        men: 5,
        soc: 3,
        ambition: 8,
        finances: 5,
        boardConfidence: 7,
        harmony: 5,
        manners: 5,
        popularity: 5,
        cooperation: 5,
        playerMin: 7,
        playerOpt: 10,
      }) as TeamIdentity;
    const buildPlayer = (id: string): Player =>
      ({
        id,
        name: id,
        rating: 60,
        marketValue: 20,
        salaryDemand: 5,
        displayMarketValue: 20,
        displaySalary: 5,
        className: "Hero",
        race: "Human",
        alignment: "N",
        gender: "f",
        referenceClass: null,
        imageSource: null,
        bracketLabel: null,
        subclasses: [],
        traitsPositive: [],
        traitsNegative: [],
        coreStats: { pow: 40, spe: 40, men: 40, soc: 40 },
        preferredDisciplineIds: [],
        disciplineRatings: { d1: 50 },
        disciplineTierCounts: { above20: 1, above40: 1, above60: 0, above80: 0 },
        flavorEn: "",
        flavorDe: "",
        fatigue: 0,
        form: 0,
        potential: 0,
        portraitPath: null,
        portraitUrl: null,
      }) as Player;
    const buildRoster = (playerId: string, teamId: string): RosterEntry =>
      ({
        id: `roster:${teamId}:${playerId}`,
        teamId,
        playerId,
        contractLength: 2,
        salary: 5,
        upkeep: 5,
        purchasePrice: 20,
        currentValue: 20,
        roleTag: "starter",
        joinedSeasonId: "season-1",
      }) as RosterEntry;

    const teams = [buildTeam("M-M", 90), buildTeam("A-A", -8)];
    const players = [buildPlayer("m1"), buildPlayer("a1")];
    const baseState = {
      season: { id: "season-3", name: "Season 3", year: 2026, currentMatchday: 1, matchdayIds: ["md-1"] },
      seasonState: {
        seasonId: "season-3",
        schedule: [],
        standings: {
          "M-M": { points: 140, rank: 1 },
          "A-A": { points: 10, rank: 32 },
        },
      },
      matchdayState: { matchdayId: "md-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
      teams,
      teamIdentities: teams.map((team) => buildIdentity(team.teamId)),
      players,
      disciplines: [],
      rosters: [buildRoster("m1", "M-M"), buildRoster("a1", "A-A")],
      contracts: [],
      transferListings: [],
      transferHistory: [],
      logs: [],
    } as unknown as GameState;

    // Pre-apply cash je Team = reconciliation-ANKER (Vor-Saison-Snapshot season-2).
    const cashByTeamBeforeReward = new Map(teams.map((team) => [team.teamId, team.cash] as const));

    // Reward real buchen: team.cash += cashDelta, plus Idempotenz-Log objectiveRewardApplyLogs.
    const applied = applyTeamSeasonObjectiveRewards(baseState, { seasonId: "season-3", execute: true });
    expect(applied.applied).toBe(true);
    const settlement = buildTeamSeasonObjectiveSettlement(baseState);
    const mmRewardCash = settlement.byTeamId["M-M"]?.cashDelta ?? 0;
    expect(mmRewardCash).not.toBe(0); // es gibt überhaupt einen Reward-Kanal zu reconcilen

    // Prior-Saison-Snapshot (season-2) = Anker; KEIN season-3-Snapshot → cashEnd fällt auf live team.cash
    // (inkl. gebuchtem Reward) zurück. Keine Transfer-/Sponsor-/Kredit-/Gebäude-Kanäle: der Reward ist
    // der EINZIGE Cashflow zwischen Anker und cashEnd.
    const gameState = {
      ...applied.gameState,
      seasonState: {
        ...applied.gameState.seasonState,
        seasonSnapshots: [
          {
            seasonId: "season-2",
            finalStandings: teams.map((team, index) => ({
              teamId: team.teamId,
              teamCode: team.teamId,
              teamName: team.name,
              rank: index + 1,
              points: 100 - index * 10,
              disciplinePoints: 0,
              disciplinePointsByArea: { pow: 0, spe: 0, men: 0, soc: 0 },
              rosterEnd: 1,
              salaryEnd: 5,
              marketValueEnd: 20,
              transferCount: 0,
              transferBuyCount: 0,
              transferSellCount: 0,
              transferNet: 0,
              cashEnd: cashByTeamBeforeReward.get(team.teamId) ?? 0,
              cashTotal: cashByTeamBeforeReward.get(team.teamId) ?? 0,
            })),
          },
        ],
      },
    } as GameState;

    const audit = buildTransferFinanceAudit(gameState);
    const mm = audit.rows.find((row) => row.teamId === "M-M" && row.seasonId === "season-3");

    expect(mm?.cashStart).toBe(cashByTeamBeforeReward.get("M-M"));
    // Der rekonstruierte Kanal == der real gebuchte Reward.
    expect(mm?.netObjectiveRewardCash).toBeCloseTo(mmRewardCash, 1);
    // MIT dem neuen Term geht die Reconciliation auf.
    expect(mm?.cashReconciliationDelta ?? 1).toBeCloseTo(0, 1);
    // OHNE den Term (Kanal herausgerechnet) bliebe exakt der Reward-Betrag als Delta übrig → != 0.
    const deltaWithoutObjectiveTerm = (mm?.cashReconciliationDelta ?? 0) + (mm?.netObjectiveRewardCash ?? 0);
    expect(Math.abs(deltaWithoutObjectiveTerm)).toBeCloseTo(Math.abs(mmRewardCash), 1);
    expect(Math.abs(deltaWithoutObjectiveTerm)).toBeGreaterThan(0.5);

    // Und kein falsch-positiver Reconciliation-Blocker mehr für diese Saison.
    expect(audit.violations.some((entry) => entry.startsWith("cash_reconciliation_delta_hard:season-3"))).toBe(false);
    expect(audit.violations.some((entry) => entry.startsWith("cash_reconciliation_delta:season-3"))).toBe(false);
  });
});
