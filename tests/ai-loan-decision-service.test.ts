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
  riskTolerance?: number;
  starPriority?: number;
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
        [teamId]: minimalStrategyProfile(teamId, {
          cashPriority: input.cashPriority ?? 5,
          ...(input.riskTolerance != null ? { riskTolerance: input.riskTolerance } : {}),
          ...(input.starPriority != null ? { starPriority: input.starPriority } : {}),
        }),
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

  it("borrows only for a genuinely distressed team (below the competitive floor, meaningful cash gap), on a SHORT term", () => {
    // Competitive floor = playerMin(8) + ceil((14-8)*0.5) = 11; roster 6 is well below it with almost no cash.
    const gameState = buildTeamGameState({ cash: 3, rosterCount: 6, playerOpt: 14, annualRevenue: 50 });
    const decision = resolveAiLoanDecision(gameState, "T-1");
    expect(decision.shouldBorrow).toBe(true);
    expect(decision.loanAmount).toBeGreaterThan(0);
    // Merged capacity model (from origin/main): capacity = 0.15*cash + 0.30*marketValueTotal − debt
    // (no revenue cap). marketValueTotal = 6*15 = 90 → 0.15*3 + 0.30*90 = 27.45.
    expect(decision.loanAmount).toBeLessThanOrEqual(27.45);
    // Prudent serviceability-driven term (TERM_CANDIDATES [2..10]); a small distressed loan stays short.
    expect(decision.termSeasons).toBeGreaterThanOrEqual(2);
    expect(decision.termSeasons).toBeLessThanOrEqual(10);
  });

  it("does not borrow to top up a team that already reaches the competitive floor with its own cash", () => {
    // Roster 11 == competitive floor for opt 14; even though it is below OPT, no loan (own cash fills the rest).
    const gameState = buildTeamGameState({ cash: 60, rosterCount: 11, playerOpt: 14, annualRevenue: 50 });
    const decision = resolveAiLoanDecision(gameState, "T-1");
    expect(decision.shouldBorrow).toBe(false);
    expect(decision.reason).toBe("no_need");
  });

  function existingLoan(installmentPerSeason: number, outstanding: number): LoanRecord {
    return {
      loanId: "existing",
      borrowerTeamId: "T-1",
      lenderType: "bank",
      principalOriginal: outstanding,
      principalOutstanding: outstanding,
      interestRatePerSeason: 0.14,
      termSeasons: 4,
      seasonsRemaining: 3,
      installmentPerSeason,
      originatedSeasonId: "season-1",
      status: "active",
      missedPayments: 0,
    };
  }

  it("borrows LESS when already carrying debt than the same team debt-free (soft leverage caution, no hard block)", () => {
    const debtFree = buildTeamGameState({ cash: 3, rosterCount: 6, playerOpt: 14, annualRevenue: 50 });
    const indebted = buildTeamGameState({
      cash: 3,
      rosterCount: 6,
      playerOpt: 14,
      annualRevenue: 50,
      loans: [existingLoan(8, 25)],
    });
    const debtFreeDecision = resolveAiLoanDecision(debtFree, "T-1");
    const indebtedDecision = resolveAiLoanDecision(indebted, "T-1");
    // A moderately indebted team can still borrow (loans stay possible "wenn begründet")...
    expect(indebtedDecision.shouldBorrow).toBe(true);
    // ...but is more cautious: it borrows a strictly smaller amount than the debt-free version.
    expect(indebtedDecision.loanAmount).toBeLessThan(debtFreeDecision.loanAmount);
  });

  it("refuses a further loan only when existing installments have consumed the debt-service budget", () => {
    // Existing installment 45 > disposable debt-service budget (max(7.5, 50 - 18) = 32) -> no room.
    // (Stand hier mit `18*0.6 = 39,2`; das Gehalt zaehlt seit Chris' Entscheidung voll, siehe unten.)
    // Outstanding kept modest (20) so borrowing capacity stays positive and we reach the serviceability gate.
    const gameState = buildTeamGameState({
      cash: 3,
      rosterCount: 6,
      playerOpt: 14,
      annualRevenue: 50,
      loans: [existingLoan(45, 20)],
    });
    const decision = resolveAiLoanDecision(gameState, "T-1");
    expect(decision.shouldBorrow).toBe(false);
    expect(decision.reason).toBe("debt_service_ceiling");
  });

  it("scales borrowing down for a high-cashPriority (hoarder-leaning) team vs an aggressive team, same gap", () => {
    const hoarder = buildTeamGameState({ cash: 3, rosterCount: 6, playerOpt: 14, annualRevenue: 50, cashPriority: 10 });
    const aggressive = buildTeamGameState({ cash: 3, rosterCount: 6, playerOpt: 14, annualRevenue: 50, cashPriority: 1 });

    const hoarderDecision = resolveAiLoanDecision(hoarder, "T-1");
    const aggressiveDecision = resolveAiLoanDecision(aggressive, "T-1");

    expect(hoarderDecision.shouldBorrow).toBe(true);
    expect(aggressiveDecision.shouldBorrow).toBe(true);
    expect(hoarderDecision.loanAmount).toBeLessThan(aggressiveDecision.loanAmount);
  });

  it("does not borrow when there is need and a cash gap but no borrowing capacity", () => {
    // Merged model: capacity is purely teamwert-based (cash + marketValueTotal − debt), no revenue cap,
    // AND the need-gate (competitive floor + cash gap) still runs first. So the team must be GENUINELY
    // needy (roster 6 < floor 11, cash 3 can't fill it → passes need) yet have its small teamwertCap
    // exhausted by debt: teamwertCap = 0.15*3 + 0.30*(6*15=90) = 27.45, an outstanding loan of 35 exceeds
    // it → capacity floors at 0 → no_capacity (checked before the serviceability/term gate).
    const gameState = buildTeamGameState({
      cash: 3,
      rosterCount: 6,
      playerOpt: 14,
      annualRevenue: 50,
      loans: [
        {
          loanId: "loan-existing",
          borrowerTeamId: "T-1",
          lenderType: "bank",
          principalOriginal: 35,
          principalOutstanding: 35,
          interestRatePerSeason: 0.1,
          termSeasons: 5,
          seasonsRemaining: 5,
          installmentPerSeason: 8,
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
    // Roster 6 vs competitive floor 11 (opt 14) -> a real need that exceeds the modest cash -> no surplus.
    const gameState = buildTeamGameState({
      cash: 30,
      rosterCount: 6,
      playerOpt: 14,
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

  it("organic disposition: a disciplined GM deploys its surplus to pay debt down where a spender holds it back", () => {
    // Same moderate surplus for both; only the GM disposition differs. The disciplined saver deploys the
    // full surplus into early payoff and clears the loan; the spender keeps a chunk as transfer dry powder
    // and its reduced payoff budget no longer covers the loan.
    const disciplined = buildTeamGameState({
      cash: 32,
      rosterCount: 12,
      playerOpt: 12,
      annualRevenue: 50,
      cashPriority: 10,
      riskTolerance: 2,
      starPriority: 3,
      loans: [loanRecord()],
    });
    const spender = buildTeamGameState({
      cash: 32,
      rosterCount: 12,
      playerOpt: 12,
      annualRevenue: 50,
      cashPriority: 1,
      riskTolerance: 9,
      starPriority: 9,
      loans: [loanRecord()],
    });

    const disciplinedDecision = resolveAiEarlyPayoffDecision(disciplined, "T-1");
    const spenderDecision = resolveAiEarlyPayoffDecision(spender, "T-1");

    expect(disciplinedDecision.reason).toBe("surplus_payoff");
    expect(disciplinedDecision.loanIdsToPayoff).toEqual(["loan-1"]);
    // The spender pays down strictly fewer loans out of the identical surplus.
    expect(spenderDecision.loanIdsToPayoff.length).toBeLessThan(disciplinedDecision.loanIdsToPayoff.length);
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

/**
 * GEMELDET: „Gerade auch bei teams wie D-P die mit negativem Cash rein gehen. Nach den Käufen darf
 * man kein negatives Cash haben. Also müssten die einen Kredit aufnehmen oder nicht?"
 *
 * BEFUND: ein Team mit vollem Kader und negativem Cash bekam `no_need` — die Pruefung fragt nur nach
 * der Kaderluecke, nicht nach dem Konto. Seit die Verkaeufe am Saisonende stattfinden (#445) und das
 * Kauffenster reines Kaufen ist, hat so ein Team dort keinen Weg mehr aus dem Minus: verkaufen darf
 * es nicht, leihen wollte es nicht.
 */
describe("Liquiditaets-Kredit bei negativem Cash", () => {
  it("leiht auch bei vollem Kader, wenn das Konto im Minus steht", () => {
    // Genau der gemeldete Fall: Kader auf Optimum, also keine Luecke — aber Cash negativ.
    const gameState = buildTeamGameState({ cash: -4.2, rosterCount: 12, playerOpt: 12, annualRevenue: 50 });
    const decision = resolveAiLoanDecision(gameState, "T-1");
    expect(decision.shouldBorrow).toBe(true);
    expect(decision.reason).toBe("liquidity_negative_cash");
  });

  it("leiht mindestens so viel, dass das Konto wieder ins Plus kommt", () => {
    // Ein zu kleiner Kredit waere derselbe Zustand, nur mit Zinsen.
    const gameState = buildTeamGameState({ cash: -4.2, rosterCount: 12, playerOpt: 12, annualRevenue: 50 });
    const decision = resolveAiLoanDecision(gameState, "T-1");
    expect(decision.loanAmount).toBeGreaterThan(4.2);
  });

  it("deckt zusaetzlich den Liquiditaetspuffer ab, nicht nur die nackte Null", () => {
    // Cash exakt 0 wuerde jeden Kauf weiterhin am Puffer scheitern lassen — das Team waere formal
    // schuldenfrei im Plus und trotzdem handlungsunfaehig.
    const gameState = buildTeamGameState({ cash: -4.2, rosterCount: 12, playerOpt: 12, annualRevenue: 50 });
    const puffer = resolveTeamLiquidityBufferTarget(gameState, "T-1");
    const decision = resolveAiLoanDecision(gameState, "T-1");
    expect(decision.loanAmount).toBeGreaterThanOrEqual(4.2 + puffer - 0.05);
  });

  it("laesst ein Team im Plus unangetastet", () => {
    // Die wichtigste Eigenschaft: der neue Zweig darf den Normalfall nicht anfassen.
    const gameState = buildTeamGameState({ cash: 60, rosterCount: 12, playerOpt: 12, annualRevenue: 50 });
    const decision = resolveAiLoanDecision(gameState, "T-1");
    expect(decision.shouldBorrow).toBe(false);
    expect(decision.reason).toBe("no_need");
  });

  it("gilt auch fuer ein Hort-Team — im Minus zaehlt der Charakter nicht", () => {
    // `strategic_hoard` blockt sonst jede Kreditaufnahme. Ein Konto im Minus muss trotzdem aufgeloest
    // werden; sonst haengt ausgerechnet das sparsamste Team am laengsten fest.
    const gameState = buildTeamGameState({
      cash: -9.6,
      rosterCount: 12,
      playerOpt: 12,
      annualRevenue: 50,
      cashPriority: 9,
    });
    const decision = resolveAiLoanDecision(gameState, "T-1");
    expect(decision.shouldBorrow).toBe(true);
    expect(decision.reason).toBe("liquidity_negative_cash");
  });

  it("bleibt in Saison 1 gesperrt", () => {
    // Die harte Regel aus docs/design/kredit-system.md gilt weiter — auch fuer den Liquiditaetsfall.
    const gameState = buildTeamGameState({
      cash: -4.2,
      rosterCount: 12,
      playerOpt: 12,
      annualRevenue: 50,
      seasonId: "season-1",
    });
    const decision = resolveAiLoanDecision(gameState, "T-1");
    expect(decision.shouldBorrow).toBe(false);
    expect(decision.reason).toBe("season_one_no_loans");
  });
});

/**
 * CHRIS' ENTSCHEIDUNG: „100% der gehälter sind fixkosten logischerweise! da ist das problem".
 *
 * `SALARY_SERVICE_WEIGHT` stand auf 0,6 — 40 % der Gehaltssumme fielen aus der Tragfaehigkeits-
 * rechnung heraus und gaben Kreditrahmen frei, den es nie gab. Der Test haelt die Zahl an der
 * WIRKUNG fest, nicht an der Konstanten: dieselbe Vorlage muss mit vollem Gewicht ablehnen und
 * haette mit 0,6 noch Rahmen gehabt.
 *
 * Die Vorlage ist so gerechnet, dass genau dieses Gewicht die Entscheidung kippt:
 *   Sponsor 60 · Gehalt 9 x 4 = 36 · Unterhalt 0 · laufende Rate 30
 *   mit 0,6:  60 - 21,6 = 38,4  ->  Rahmen 8,4 uebrig, ein weiterer Kredit ist tragbar
 *   mit 1,0:  60 - 36,0 = 24,0  ->  Rahmen -6,0, kein weiterer Kredit
 * Der Boden (15 % von 60 = 9) greift in beiden Faellen nicht, sonst pruefte der Test ihn statt
 * des Gewichts.
 */
describe("Gehaelter zaehlen voll als Fixkosten", () => {
  const laufenderKredit: LoanRecord = {
    loanId: "laufend",
    borrowerTeamId: "T-1",
    lenderType: "bank",
    principalOriginal: 20,
    principalOutstanding: 20,
    interestRatePerSeason: 0.14,
    termSeasons: 4,
    seasonsRemaining: 3,
    installmentPerSeason: 30,
    originatedSeasonId: "season-1",
    status: "active",
    missedPayments: 0,
  };

  it("lehnt einen weiteren Kredit ab, sobald das volle Gehalt gegengerechnet wird", () => {
    const gameState = buildTeamGameState({
      cash: 3,
      rosterCount: 9,
      playerOpt: 14,
      salaryPerPlayer: 4,
      annualRevenue: 60,
      loans: [laufenderKredit],
    });
    const decision = resolveAiLoanDecision(gameState, "T-1");
    expect(decision.shouldBorrow).toBe(false);
    expect(decision.reason).toBe("debt_service_ceiling");
  });
});

/**
 * CHRIS' ENTSCHEIDUNG vom 21.08.2026: „1b" — der Kreditboden wird eine RAMPE statt einer Schwelle.
 *
 * DER ANLASS: seit das Gehalt voll gegengerechnet wird (#597), lag die ehrliche Rechnung bei 107
 * von 129 gemessenen Teamzeilen unter dem Boden. Er war von der Ausnahme zur Regel geworden — und
 * gab bei 79 Zeilen Rahmen frei, obwohl die Rechnung negativ war.
 *
 * WARUM RAMPE UND NICHT SCHWELLE: „Boden nur unter dem Spielerminimum" hätte einen
 * Einbahnstraßen-Fall — ein Team am Minimum mit negativer Rechnung dürfte nie wieder kaufen UND
 * bekäme kein Geld. Die Rampe macht den Rahmen davon abhängig, ob das Team überhaupt Spieler
 * braucht.
 *
 * Die Vorlage ist so gerechnet, dass die drei Stufen sich am ERGEBNIS unterscheiden: Sponsor 60,
 * Gehalt und Unterhalt fressen alles auf, also entscheidet allein der Boden. 15 % = 9, 7,5 % = 4,5,
 * 0 % = 0 — und die laufende Rate ist so gesetzt, dass genau dazwischen die Grenze liegt.
 */
describe("Der Kreditboden ist eine Rampe, keine Schwelle", () => {
  const teuerLaufend = (installmentPerSeason: number): LoanRecord => ({
    loanId: "laufend",
    borrowerTeamId: "T-1",
    lenderType: "bank",
    principalOriginal: 20,
    principalOutstanding: 20,
    interestRatePerSeason: 0.14,
    termSeasons: 4,
    seasonsRemaining: 3,
    installmentPerSeason,
    originatedSeasonId: "season-1",
    status: "active",
    missedPayments: 0,
  });

  /** Kader so gross wie angegeben, Gehalt so hoch, dass die ehrliche Rechnung negativ ist. */
  const lage = (rosterCount: number, playerOpt: number, rate: number) =>
    buildTeamGameState({
      cash: 3,
      rosterCount,
      playerOpt,
      salaryPerPlayer: 12,
      annualRevenue: 60,
      loans: [teuerLaufend(rate)],
    });

  it("auf OPT gibt es KEINEN Boden mehr — der Kader ist voll, es gibt nichts zu kaufen", () => {
    // playerOpt 9 bei 9 Spielern: dritte Stufe.
    //
    // EHRLICH DAZU, nachgemessen: diese Stufe aendert heute NICHTS. Ein Team auf oder ueber seiner
    // Zielgroesse erreicht den Kreditdienst-Riegel gar nicht — es wird vorher geblockt. Ueber alle
    // Live-Abbilder sind das 26 Teams, und ihre Antwort lautet 24x `season_one_no_loans`, 1x
    // `no_need`, 1x `liquidity_negative_cash`. Die Stufe ist ein Guertel zum Hosentraeger: sie
    // wuerde greifen, wenn die Bedarfspruefung je gelockert wird, und schadet bis dahin nicht.
    const decision = resolveAiLoanDecision(lage(9, 9, 1), "T-1");
    expect(decision.shouldBorrow).toBe(false);
  });

  it("zwischen Minimum und OPT gilt der HALBE Boden — und das macht den Unterschied", () => {
    // Der Fall, an dem sich Rampe und alter Flachboden trennen. Sponsor 60, Fixkosten fressen
    // alles, laufende Rate 5:
    //   halber Boden  7,5 % = 4,5  ->  Rahmen 4,5 - 5 = -0,5  ->  KEIN weiterer Kredit
    //   alter Boden    15 %  = 9    ->  Rahmen 9   - 5 =  4    ->  Kredit waere tragbar
    // Ohne die Rampe ist dieser Test gruen — deshalb steht er hier und nicht ein bequemerer.
    const decision = resolveAiLoanDecision(lage(9, 14, 5), "T-1");
    expect(decision.shouldBorrow).toBe(false);
    expect(decision.reason).toBe("debt_service_ceiling");
  });

  it("unter dem Minimum traegt derselbe Fall noch — der volle Boden ist wirklich groesser", () => {
    // Identische Finanzen und Rate wie oben, nur der Kader ist kleiner: erste Stufe, Boden 9,
    // Rahmen 4. Das trennt die erste von der zweiten Stufe.
    const decision = resolveAiLoanDecision(lage(6, 14, 5), "T-1");
    expect(decision.reason).not.toBe("debt_service_ceiling");
  });

  it("die Stufe haengt am KADER — dieselbe Kasse, anderes Ziel, andere Antwort", () => {
    // Der Beweis, dass wirklich die Rampe entscheidet: identische Finanzen, identische Rate,
    // nur die Zielgroesse unterscheidet sich.
    const aufOpt = resolveAiLoanDecision(lage(9, 9, 3), "T-1");
    const unterOpt = resolveAiLoanDecision(lage(9, 14, 3), "T-1");
    expect(aufOpt.shouldBorrow).toBe(false);
    expect(unterOpt.reason).not.toBe("debt_service_ceiling");
  });

  it("unter dem Spielerminimum gilt der volle Boden — 15 % von 60 = 9", () => {
    // Spielerminimum ist fix 8. Bei 6 Spielern greift die erste Stufe; eine Rate von 6 laesst
    // 3 uebrig. Mit dem halben Boden (4,5) waere hier kein Spielraum mehr.
    const decision = resolveAiLoanDecision(lage(6, 14, 6), "T-1");
    expect(decision.reason).not.toBe("debt_service_ceiling");
  });
});
