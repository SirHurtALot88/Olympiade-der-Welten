import { randomUUID } from "@/lib/utils/random-id";

import type { GameState, LoanRecord } from "@/lib/data/olyDataTypes";
import { buildTeamSeasonOverviewRows } from "@/lib/foundation/team-management-overview";
import { getTeamSponsorContract } from "@/lib/sponsor/sponsor-offer-read";

/** Bank-Kredit-Kern (Phase 1). KI-Anbindung (Phase 2) und Team-zu-Team-Kredite (Phase 3) folgen später. */

const MIN_INTEREST_RATE = 0.07;
const MAX_INTEREST_RATE = 0.2;
const BASE_INTEREST_RATE = 0.1;
const RISK_PER_MISSING_FINANCE_POINT = 0.012;
const TERM_DISCOUNT_PER_SEASON = 0.004;
const CAPACITY_MARKET_VALUE_SHARE = 0.35;
const CAPACITY_REVENUE_SHARE = 1.25;
const DEFAULT_PENALTY_RATE = 0.05;
const DEFAULT_MISSED_PAYMENTS_THRESHOLD = 2;
const MIN_TERM_SEASONS = 1;
const MAX_TERM_SEASONS = 10;

function roundCash(value: number) {
  return Number(value.toFixed(1));
}

function roundRate(value: number) {
  return Number(value.toFixed(4));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export type LoanTerms = {
  interestRatePerSeason: number;
  installmentPerSeason: number;
};

/**
 * Zins- & Annuitätenberechnung, siehe docs/design/kredit-system.md.
 * rate = clamp(0.10 + (10 - finances) * 0.012 - (termSeasons - 1) * 0.004, 0.07, 0.20)
 * A = P * r / (1 - (1 + r)^(-n))
 */
export function computeLoanTerms(input: { principal: number; termSeasons: number; finances: number }): LoanTerms {
  const termSeasons = clamp(Math.round(input.termSeasons), MIN_TERM_SEASONS, MAX_TERM_SEASONS);
  const finances = clamp(input.finances, 0, 10);
  const risk = (10 - finances) * RISK_PER_MISSING_FINANCE_POINT;
  const termDiscount = (termSeasons - 1) * TERM_DISCOUNT_PER_SEASON;
  const rate = roundRate(clamp(BASE_INTEREST_RATE + risk - termDiscount, MIN_INTEREST_RATE, MAX_INTEREST_RATE));
  const principal = Math.max(0, input.principal);

  if (principal === 0) {
    return { interestRatePerSeason: rate, installmentPerSeason: 0 };
  }

  // Annuität: bei r === 0 (theoretisch außerhalb Floor/Cap) linear tilgen, sonst Standardformel.
  const installment =
    rate === 0 ? principal / termSeasons : (principal * rate) / (1 - Math.pow(1 + rate, -termSeasons));

  return {
    interestRatePerSeason: rate,
    installmentPerSeason: roundCash(installment),
  };
}

/**
 * Kreditlimit: min(0.35 * marketValueTotal, 1.25 * jährlicheEinnahmen) - aktuelleRestschuld, floor 0.
 */
export function computeBorrowingCapacity(input: {
  marketValueTotal: number;
  annualRevenue: number;
  currentOutstandingDebt: number;
}): number {
  const marketValueCap = CAPACITY_MARKET_VALUE_SHARE * Math.max(0, input.marketValueTotal);
  const revenueCap = CAPACITY_REVENUE_SHARE * Math.max(0, input.annualRevenue);
  const cap = Math.min(marketValueCap, revenueCap);
  return roundCash(Math.max(0, cap - Math.max(0, input.currentOutstandingDebt)));
}

export function getTeamOutstandingDebt(gameState: GameState, teamId: string): number {
  const loans = gameState.seasonState.loans ?? [];
  return roundCash(
    loans
      .filter((loan) => loan.borrowerTeamId === teamId && loan.status === "active")
      .reduce((sum, loan) => sum + loan.principalOutstanding, 0),
  );
}

/**
 * Summe der jährlichen Kreditraten (`installmentPerSeason`) über alle aktiven Kredite eines
 * Teams — die Cash-Belastung, die `applyLoanSettlement` am Saisonende abbucht. Für UI-Zwecke
 * gedacht (Kreditrate neben Gehälter/Gebäudekosten als Ausgabenzeile), nicht Teil der
 * Settlement-Logik selbst.
 */
export function getTeamAnnualLoanInstallment(gameState: GameState, teamId: string): number {
  const loans = gameState.seasonState.loans ?? [];
  return roundCash(
    loans
      .filter((loan) => loan.borrowerTeamId === teamId && loan.status === "active")
      .reduce((sum, loan) => sum + loan.installmentPerSeason, 0),
  );
}

/**
 * Proxy für jährliche Einnahmen: letzte abgerechnete Saison-Summe der Sponsoren-Payouts für das
 * Team; ohne historische Payout-Logs fällt der Proxy auf die Basis-Komponente des laufenden
 * Sponsorenvertrags zurück. Kein Preisgeld-Benchmark eingerechnet (TODO: sauberen
 * Jahres-Cashflow-Proxy inkl. Preisgeld ergänzen, sobald ein dedizierter Wert existiert — bis
 * dahin bleibt die marketValueTotal-Kappe die dominante Bremse für gut verdienende, aber junge Teams).
 */
export function estimateTeamAnnualRevenue(gameState: GameState, teamId: string): number {
  const logs = (gameState.seasonState.sponsorPayoutLogs ?? []).filter(
    (log) => log.teamId === teamId && log.cashDelta > 0,
  );
  if (logs.length > 0) {
    const totalsBySeasonId = new Map<string, number>();
    for (const log of logs) {
      totalsBySeasonId.set(log.seasonId, (totalsBySeasonId.get(log.seasonId) ?? 0) + log.cashDelta);
    }
    const latestSeasonId = [...totalsBySeasonId.keys()].sort().at(-1);
    if (latestSeasonId) {
      return roundCash(totalsBySeasonId.get(latestSeasonId) ?? 0);
    }
  }

  const contract = getTeamSponsorContract(gameState, teamId);
  const baseComponent = contract?.components.find((component) => component.kind === "base");
  if (baseComponent) {
    return roundCash(baseComponent.rewardCash);
  }

  return 0;
}

function getTeamMarketValueTotal(gameState: GameState, teamId: string): number {
  const row = buildTeamSeasonOverviewRows({ gameState }).find((entry) => entry.teamId === teamId) ?? null;
  return row?.marketValueTotal ?? 0;
}

export type OriginateLoanInput = {
  borrowerTeamId: string;
  principal: number;
  termSeasons: number;
};

export type OriginateLoanResult = {
  ok: boolean;
  loan: LoanRecord | null;
  reason: string | null;
  capacity: number;
  terms: LoanTerms | null;
  gameState: GameState;
};

/**
 * Kreditaufnahme (nur Preseason — wird vom Aufrufer erzwungen, dieser Service ist phasenlos).
 * Ohne execute: reine Vorschau/Validierung (keine Mutation).
 */
export function originateLoan(
  gameState: GameState,
  input: OriginateLoanInput,
  options?: { execute?: boolean },
): OriginateLoanResult {
  const borrower = gameState.teams.find((team) => team.teamId === input.borrowerTeamId) ?? null;
  const identity = gameState.teamIdentities.find((entry) => entry.teamId === input.borrowerTeamId) ?? null;

  if (!borrower) {
    return { ok: false, loan: null, reason: "borrower_not_found", capacity: 0, terms: null, gameState };
  }

  const termSeasons = Math.round(input.termSeasons);
  if (!Number.isFinite(input.principal) || input.principal <= 0) {
    return { ok: false, loan: null, reason: "invalid_principal", capacity: 0, terms: null, gameState };
  }
  if (!Number.isFinite(termSeasons) || termSeasons < MIN_TERM_SEASONS || termSeasons > MAX_TERM_SEASONS) {
    return { ok: false, loan: null, reason: "invalid_term_seasons", capacity: 0, terms: null, gameState };
  }

  const finances = identity?.finances ?? 5;
  const marketValueTotal = getTeamMarketValueTotal(gameState, input.borrowerTeamId);
  const annualRevenue = estimateTeamAnnualRevenue(gameState, input.borrowerTeamId);
  const currentOutstandingDebt = getTeamOutstandingDebt(gameState, input.borrowerTeamId);
  const capacity = computeBorrowingCapacity({ marketValueTotal, annualRevenue, currentOutstandingDebt });

  if (input.principal > capacity) {
    return { ok: false, loan: null, reason: "over_capacity", capacity, terms: null, gameState };
  }

  const terms = computeLoanTerms({ principal: input.principal, termSeasons, finances });

  const loan: LoanRecord = {
    loanId: `loan:${gameState.season.id}:${input.borrowerTeamId}:${randomUUID()}`,
    borrowerTeamId: input.borrowerTeamId,
    lenderType: "bank",
    principalOriginal: roundCash(input.principal),
    principalOutstanding: roundCash(input.principal),
    interestRatePerSeason: terms.interestRatePerSeason,
    termSeasons,
    seasonsRemaining: termSeasons,
    installmentPerSeason: terms.installmentPerSeason,
    originatedSeasonId: gameState.season.id,
    status: "active",
    missedPayments: 0,
  };

  if (!options?.execute) {
    return { ok: true, loan, reason: null, capacity, terms, gameState };
  }

  const nextGameState: GameState = {
    ...gameState,
    teams: gameState.teams.map((team) =>
      team.teamId === input.borrowerTeamId ? { ...team, cash: roundCash(team.cash + input.principal) } : team,
    ),
    seasonState: {
      ...gameState.seasonState,
      loans: [...(gameState.seasonState.loans ?? []), loan],
    },
  };

  return { ok: true, loan, reason: null, capacity, terms, gameState: nextGameState };
}

export type LoanSettlementRow = {
  loanId: string;
  borrowerTeamId: string;
  status: "paid_full" | "paid_partial" | "defaulted_capitalized" | "already_paid" | "already_defaulted";
  installmentCharged: number;
  interestPortion: number;
  principalPortion: number;
  cashDelta: number;
  capitalizedShortfall: number;
  penaltyApplied: number;
  boardConfidenceDelta: number;
  loanBecomesDefaulted: boolean;
  loanBecomesPaid: boolean;
};

export type LoanSettlementPreview = {
  seasonId: string;
  rows: LoanSettlementRow[];
  totalCashDelta: number;
  duplicateDetected: boolean;
  canApply: boolean;
};

function buildSettlementRows(gameState: GameState, seasonId: string): LoanSettlementRow[] {
  const loans = gameState.seasonState.loans ?? [];
  const cashByTeamId = new Map(gameState.teams.map((team) => [team.teamId, team.cash] as const));
  const rows: LoanSettlementRow[] = [];

  for (const loan of loans) {
    if (loan.status === "paid") {
      rows.push({
        loanId: loan.loanId,
        borrowerTeamId: loan.borrowerTeamId,
        status: "already_paid",
        installmentCharged: 0,
        interestPortion: 0,
        principalPortion: 0,
        cashDelta: 0,
        capitalizedShortfall: 0,
        penaltyApplied: 0,
        boardConfidenceDelta: 0,
        loanBecomesDefaulted: false,
        loanBecomesPaid: false,
      });
      continue;
    }
    if (loan.status === "defaulted") {
      rows.push({
        loanId: loan.loanId,
        borrowerTeamId: loan.borrowerTeamId,
        status: "already_defaulted",
        installmentCharged: 0,
        interestPortion: 0,
        principalPortion: 0,
        cashDelta: 0,
        capitalizedShortfall: 0,
        penaltyApplied: 0,
        boardConfidenceDelta: 0,
        loanBecomesDefaulted: false,
        loanBecomesPaid: false,
      });
      continue;
    }

    const interestPortion = roundCash(loan.principalOutstanding * loan.interestRatePerSeason);
    const rawInstallment = loan.seasonsRemaining <= 1 ? loan.principalOutstanding + interestPortion : loan.installmentPerSeason;
    const installment = roundCash(Math.min(rawInstallment, loan.principalOutstanding + interestPortion));
    const principalPortion = roundCash(Math.max(0, installment - interestPortion));

    const availableCash = cashByTeamId.get(loan.borrowerTeamId) ?? 0;

    if (availableCash >= installment) {
      cashByTeamId.set(loan.borrowerTeamId, roundCash(availableCash - installment));
      const nextOutstanding = roundCash(loan.principalOutstanding - principalPortion);
      const nextSeasonsRemaining = Math.max(0, loan.seasonsRemaining - 1);
      rows.push({
        loanId: loan.loanId,
        borrowerTeamId: loan.borrowerTeamId,
        status: "paid_full",
        installmentCharged: installment,
        interestPortion,
        principalPortion,
        cashDelta: -installment,
        capitalizedShortfall: 0,
        penaltyApplied: 0,
        boardConfidenceDelta: 0,
        loanBecomesDefaulted: false,
        loanBecomesPaid: nextOutstanding <= 0 || nextSeasonsRemaining === 0,
      });
      continue;
    }

    // Zahlungsausfall: verfügbares Cash wird vollständig eingezogen, der Rest kapitalisiert.
    const paidPortion = roundCash(Math.max(0, availableCash));
    const shortfall = roundCash(Math.max(0, installment - paidPortion));
    const penalty = roundCash(shortfall * DEFAULT_PENALTY_RATE);
    const capitalizedShortfall = roundCash(shortfall + penalty);
    cashByTeamId.set(loan.borrowerTeamId, 0);
    const nextMissedPayments = loan.missedPayments + 1;

    rows.push({
      loanId: loan.loanId,
      borrowerTeamId: loan.borrowerTeamId,
      status: "defaulted_capitalized",
      installmentCharged: paidPortion,
      interestPortion: Math.min(interestPortion, paidPortion),
      principalPortion: Math.max(0, paidPortion - Math.min(interestPortion, paidPortion)),
      cashDelta: -paidPortion,
      capitalizedShortfall,
      penaltyApplied: penalty,
      boardConfidenceDelta: -1,
      loanBecomesDefaulted: nextMissedPayments >= DEFAULT_MISSED_PAYMENTS_THRESHOLD,
      loanBecomesPaid: false,
    });
  }

  return rows;
}

export function previewLoanSettlement(gameState: GameState, seasonId?: string): LoanSettlementPreview {
  const resolvedSeasonId = seasonId ?? gameState.season.id;
  const existingLog = (gameState.seasonState.loanApplyLogs ?? []).some((log) => log.seasonId === resolvedSeasonId);
  const rows = buildSettlementRows(gameState, resolvedSeasonId);
  const totalCashDelta = roundCash(rows.reduce((sum, row) => sum + row.cashDelta, 0));

  return {
    seasonId: resolvedSeasonId,
    rows,
    totalCashDelta,
    duplicateDetected: existingLog,
    canApply: !existingLog && rows.some((row) => row.status === "paid_full" || row.status === "defaulted_capitalized"),
  };
}

export type LoanSettlementApplyResult = {
  ok: boolean;
  applied: boolean;
  duplicateDetected: boolean;
  preview: LoanSettlementPreview;
  gameState: GameState;
};

/**
 * Saison-Abschluss-Schritt `loan_settlement`. Belastet Cash pro aktivem Kredit, reduziert
 * Restschuld/Restlaufzeit, kapitalisiert Zahlungsausfälle inkl. Strafzins und Board-Confidence-Hit.
 * Idempotent über `loanApplyLogs` (seasonId), analog `objectiveRewardApplyLogs`.
 */
export function applyLoanSettlement(
  gameState: GameState,
  options?: { execute?: boolean; seasonId?: string },
): LoanSettlementApplyResult {
  const seasonId = options?.seasonId ?? gameState.season.id;
  const preview = previewLoanSettlement(gameState, seasonId);

  if (preview.duplicateDetected) {
    return { ok: true, applied: false, duplicateDetected: true, preview, gameState };
  }
  if (!options?.execute) {
    return { ok: true, applied: false, duplicateDetected: false, preview, gameState };
  }
  if (!preview.canApply) {
    return { ok: true, applied: false, duplicateDetected: false, preview, gameState };
  }

  const rowsByLoanId = new Map(preview.rows.map((row) => [row.loanId, row] as const));
  const cashDeltaByTeamId = new Map<string, number>();
  for (const row of preview.rows) {
    if (row.cashDelta === 0) continue;
    cashDeltaByTeamId.set(row.borrowerTeamId, roundCash((cashDeltaByTeamId.get(row.borrowerTeamId) ?? 0) + row.cashDelta));
  }

  const nextLoans = (gameState.seasonState.loans ?? []).map((loan) => {
    const row = rowsByLoanId.get(loan.loanId);
    if (!row || row.status === "already_paid" || row.status === "already_defaulted") {
      return loan;
    }
    if (row.status === "paid_full") {
      const nextOutstanding = roundCash(Math.max(0, loan.principalOutstanding - row.principalPortion));
      const nextSeasonsRemaining = Math.max(0, loan.seasonsRemaining - 1);
      const becomesPaid = nextOutstanding <= 0 || nextSeasonsRemaining === 0;
      return {
        ...loan,
        principalOutstanding: becomesPaid ? 0 : nextOutstanding,
        seasonsRemaining: nextSeasonsRemaining,
        status: becomesPaid ? ("paid" as const) : loan.status,
      };
    }
    // defaulted_capitalized
    const nextOutstanding = roundCash(loan.principalOutstanding - row.principalPortion + row.capitalizedShortfall);
    const nextMissedPayments = loan.missedPayments + 1;
    return {
      ...loan,
      principalOutstanding: Math.max(0, nextOutstanding),
      missedPayments: nextMissedPayments,
      status: row.loanBecomesDefaulted ? ("defaulted" as const) : loan.status,
    };
  });

  const nextBoardConfidence = { ...(gameState.seasonState.boardConfidence ?? {}) };
  for (const row of preview.rows) {
    if (row.boardConfidenceDelta === 0) continue;
    const current = nextBoardConfidence[row.borrowerTeamId];
    const nextValue = clamp(roundCash((current?.value ?? 5) + row.boardConfidenceDelta), 1, 10);
    nextBoardConfidence[row.borrowerTeamId] = {
      teamId: row.borrowerTeamId,
      value: nextValue,
      pressure: clamp(roundCash(11 - nextValue), 1, 10),
      warnings: current?.warnings ?? [],
    };
  }

  const now = new Date().toISOString();
  const newLogs = preview.rows
    .filter((row) => row.status === "paid_full" || row.status === "defaulted_capitalized")
    .map((row) => ({
      seasonId,
      loanId: row.loanId,
      installmentCharged: row.installmentCharged,
      interestPortion: row.interestPortion,
      principalPortion: row.principalPortion,
      createdAt: now,
    }));

  const nextGameState: GameState = {
    ...gameState,
    teams: gameState.teams.map((team) => {
      const delta = cashDeltaByTeamId.get(team.teamId) ?? 0;
      return delta === 0 ? team : { ...team, cash: roundCash(Math.max(0, team.cash + delta)) };
    }),
    seasonState: {
      ...gameState.seasonState,
      loans: nextLoans,
      boardConfidence: nextBoardConfidence,
      loanApplyLogs: [...(gameState.seasonState.loanApplyLogs ?? []), ...newLogs],
    },
  };

  return { ok: true, applied: true, duplicateDetected: false, preview, gameState: nextGameState };
}
