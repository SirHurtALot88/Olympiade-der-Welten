import type { GameState, LoanRecord } from "@/lib/data/olyDataTypes";

import { estimateUpgradeBuyFloorMw, isCashHoardingTeam, teamNeedsTransferBudgetDeploy } from "@/lib/ai/ai-budget-deploy-service";
import { resolveTeamSpendableCashForPlanning } from "@/lib/ai/planner-cash-buffer-policy";
import { deriveRosterTargets } from "@/lib/foundation/roster-limits";
import { getTeamStrategyProfile } from "@/lib/foundation/team-strategy-profiles";
import { computeEarlyPayoff, computeLoanTerms, estimateTeamAnnualRevenue, originateLoan } from "@/lib/finance/loan-service";
import { getSeasonEconomyFactorWindow } from "@/lib/season/season-economy-factors";
import { isSeasonOne } from "@/lib/season/transfer-season-policy";

/**
 * Phase 2 KI-Anbindung, siehe docs/design/kredit-system.md ("KI-Anbindung"). Bedarfsgetrieben und
 * persönlichkeitsgegated, nicht zins-arbitrage-getrieben: eine KI nimmt nur einen Kredit auf, wenn
 * sie echten Kaderbedarf hat und ihn sich sonst nicht leisten kann.
 */

const DEFAULT_TERM_SEASONS = 4;
/** Kandidaten-Laufzeiten, aufsteigend probiert, bis die Rate gegen die Einnahmen tragbar ist. */
const TERM_CANDIDATES = [DEFAULT_TERM_SEASONS, 5, 6, 7, 8, 10];
/** Jahresrate darf höchstens diesen Anteil der projizierten Jahreseinnahmen ausmachen. */
const SERVICEABILITY_INCOME_RATIO = 0.5;
const MIN_WILLINGNESS = 0.3;
const MAX_WILLINGNESS = 1.0;
/** Bereitschaft sinkt um diesen Faktor je cashPriority-Punkt über dem neutralen Wert (5). */
const WILLINGNESS_CASH_PRIORITY_STEP = 0.1;
/** Zusätzlicher Dämpfungsfaktor für explizit als Cash-Hoarder markierte Teams. */
const HOARDER_WILLINGNESS_MULTIPLIER = 0.6;

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export type AiLoanDecision = {
  shouldBorrow: boolean;
  loanAmount: number;
  termSeasons: number;
  reason: string;
};

function noLoan(reason: string): AiLoanDecision {
  return { shouldBorrow: false, loanAmount: 0, termSeasons: 0, reason };
}

/**
 * Roster-Bedarf in € (Lücke bis playerOpt * Preisfloor pro Upgrade-Kauf), siehe
 * docs/design/kredit-system.md ("KI-Anbindung" Schritt 1). Geteilt zwischen `resolveAiLoanDecision`
 * (Bedarf für Kreditaufnahme) und `resolveAiEarlyPayoffDecision` (erwarteter Bedarf der nächsten
 * Saison, gegen den ein Überschuss geprüft wird).
 */
function estimateRosterNeedEur(gameState: GameState, teamId: string): number {
  const team = gameState.teams.find((entry) => entry.teamId === teamId) ?? null;
  if (!team) return 0;
  const identity = gameState.teamIdentities.find((entry) => entry.teamId === teamId) ?? null;
  const rosterCount = gameState.rosters.filter((entry) => entry.teamId === teamId).length;
  const { playerOpt } = deriveRosterTargets(team, identity);
  const rosterGap = Math.max(0, playerOpt - rosterCount);
  if (rosterGap <= 0) return 0;
  return round(rosterGap * estimateUpgradeBuyFloorMw(gameState, teamId), 1);
}

/** Skaliert die Kreditbereitschaft nach Persönlichkeit runter (Hoarder/Cash-Creator borgen konservativ). */
function resolveWillingness(gameState: GameState, teamId: string, seasonId: string): number {
  const profile = getTeamStrategyProfile(gameState, teamId);
  const cashPriority = profile?.bias.cashPriority ?? 5;
  let willingness = clamp(1 - (cashPriority - 5) * WILLINGNESS_CASH_PRIORITY_STEP, MIN_WILLINGNESS, MAX_WILLINGNESS);
  if (isCashHoardingTeam(gameState, teamId, seasonId)) {
    willingness = clamp(willingness * HOARDER_WILLINGNESS_MULTIPLIER, MIN_WILLINGNESS, MAX_WILLINGNESS);
  }
  return willingness;
}

/** Projiziert die Jahreseinnahmen über das Saison-Ökonomie-Fenster, um die Tragfähigkeit zu prüfen. */
function resolveProjectedAnnualIncome(gameState: GameState, teamId: string): number {
  const baseRevenue = estimateTeamAnnualRevenue(gameState, teamId);
  if (baseRevenue <= 0) return 0;
  const factorWindow = getSeasonEconomyFactorWindow({
    saveId: gameState.season.id,
    seasonId: gameState.season.id,
    seasonState: gameState.seasonState,
  }).map((entry) => entry.factor);
  const nearTermFactor = factorWindow[0] ?? 1;
  return round(baseRevenue * Math.max(0.1, nearTermFactor));
}

/** Wählt die kürzeste Kandidaten-Laufzeit, deren Jahresrate gegen die projizierten Einnahmen tragbar ist. */
function resolveServiceableTermSeasons(input: {
  gameState: GameState;
  teamId: string;
  principal: number;
  finances: number;
}): number {
  const projectedAnnualIncome = resolveProjectedAnnualIncome(input.gameState, input.teamId);
  let fallbackTerm = DEFAULT_TERM_SEASONS;

  for (const termSeasons of TERM_CANDIDATES) {
    const terms = computeLoanTerms({ principal: input.principal, termSeasons, finances: input.finances });
    fallbackTerm = termSeasons;
    if (projectedAnnualIncome <= 0 || terms.installmentPerSeason <= projectedAnnualIncome * SERVICEABILITY_INCOME_RATIO) {
      return termSeasons;
    }
  }

  // Keine Kandidaten-Laufzeit ist klar tragbar — nimm die längste probierte (kleinste Rate).
  return fallbackTerm;
}

/**
 * Entscheidet, ob ein KI-Team im Preseason (unmittelbar vor der Kaufphase) einen Bankkredit
 * aufnimmt. Rein bedarfsgetrieben: kein Kaderbedarf → kein Kredit; genug Cash für den Bedarf →
 * kein Kredit; keine Kreditkapazität → kein Kredit. Deterministisch, kein Zufall.
 */
export function resolveAiLoanDecision(gameState: GameState, teamId: string): AiLoanDecision {
  const team = gameState.teams.find((entry) => entry.teamId === teamId) ?? null;
  if (!team) return noLoan("team_not_found");

  const seasonId = gameState.season.id;

  // Season 1 = keine Kredite (harte Regel), siehe docs/design/kredit-system.md.
  if (isSeasonOne(seasonId)) return noLoan("season_one_no_loans");

  const identity = gameState.teamIdentities.find((entry) => entry.teamId === teamId) ?? null;
  const rosterCount = gameState.rosters.filter((entry) => entry.teamId === teamId).length;
  const { playerOpt } = deriveRosterTargets(team, identity);
  const rosterGap = Math.max(0, playerOpt - rosterCount);

  if (rosterGap <= 0) return noLoan("no_need");
  if (!teamNeedsTransferBudgetDeploy(gameState, teamId, seasonId)) return noLoan("no_need");

  const needsEur = estimateRosterNeedEur(gameState, teamId);
  const spendableCash = resolveTeamSpendableCashForPlanning(gameState, teamId, team.cash ?? 0);
  const shortfall = round(needsEur - spendableCash, 1);
  if (shortfall <= 0) return noLoan("cash_sufficient");

  // Reuse loan-service's own capacity math (market value + revenue + outstanding debt) instead of
  // duplicating it — a provisional preview call is enough to read back `capacity`.
  const capacityPreview = originateLoan(
    gameState,
    { borrowerTeamId: teamId, principal: shortfall, termSeasons: DEFAULT_TERM_SEASONS },
    { execute: false },
  );
  const capacity = capacityPreview.capacity;
  if (capacity <= 0) return noLoan("no_capacity");

  const willingness = resolveWillingness(gameState, teamId, seasonId);
  const cappedAmount = Math.min(shortfall, capacity);
  const loanAmount = round(cappedAmount * willingness, 1);
  if (loanAmount <= 0) return noLoan("no_capacity");

  const finances = identity?.finances ?? 5;
  const termSeasons = resolveServiceableTermSeasons({ gameState, teamId, principal: loanAmount, finances });

  return { shouldBorrow: true, loanAmount, termSeasons, reason: "need_driven_borrow" };
}

export type AiEarlyPayoffDecision = {
  loanIdsToPayoff: string[];
  reason: string;
};

/**
 * Ordnet Ablöse-Kandidaten so, dass mit begrenztem Überschuss möglichst viele Kredite abgelöst
 * werden können: kleinste Ablösesumme zuerst, bei Gleichstand die höher verzinsten Kredite zuerst
 * (die teuerste laufende Last wird zuerst los).
 */
function sortEarlyPayoffCandidates(loans: LoanRecord[]): Array<{ loan: LoanRecord; payoff: number }> {
  return loans
    .map((loan) => ({ loan, payoff: computeEarlyPayoff(loan).payoff }))
    .sort((left, right) => {
      if (left.payoff !== right.payoff) return left.payoff - right.payoff;
      return right.loan.interestRatePerSeason - left.loan.interestRatePerSeason;
    });
}

/**
 * Anti-Churn-KI-Entscheidung für Vorab-Rückzahlung (Verkaufsphase), siehe
 * docs/design/kredit-system.md ("Vorab-Rückzahlung" / "Anti-Churn-Balancing"). Löst nur aus
 * echtem Überschuss ab (spendableCash über dem erwarteten Kaufbedarf der nächsten Saison), nie
 * einen gerade erst (dieselbe Saison) aufgenommenen Kredit (Hysterese) und nie, wenn das Team in
 * derselben Saison bereits geliehen hat (kein Leihen+Ablösen in einer Saison). Deterministisch,
 * kein Zufall.
 */
export function resolveAiEarlyPayoffDecision(gameState: GameState, teamId: string): AiEarlyPayoffDecision {
  const team = gameState.teams.find((entry) => entry.teamId === teamId) ?? null;
  if (!team) return { loanIdsToPayoff: [], reason: "team_not_found" };

  const seasonId = gameState.season.id;
  const activeLoans = (gameState.seasonState.loans ?? []).filter(
    (loan) => loan.borrowerTeamId === teamId && loan.status === "active",
  );
  if (activeLoans.length === 0) return { loanIdsToPayoff: [], reason: "no_active_loans" };

  // Ein Team, das in dieser Saison bereits geliehen hat, löst nicht gleichzeitig ab.
  if (activeLoans.some((loan) => loan.originatedSeasonId === seasonId)) {
    return { loanIdsToPayoff: [], reason: "borrowed_this_season" };
  }

  const needsEur = estimateRosterNeedEur(gameState, teamId);
  const spendableCash = resolveTeamSpendableCashForPlanning(gameState, teamId, team.cash ?? 0);
  let surplus = round(spendableCash - needsEur, 1);
  if (surplus <= 0) return { loanIdsToPayoff: [], reason: "no_surplus" };

  // Hysterese: ein gerade erst (dieselbe Saison) aufgenommener Kredit wird nicht abgelöst.
  const candidates = activeLoans.filter((loan) => loan.originatedSeasonId !== seasonId);
  if (candidates.length === 0) return { loanIdsToPayoff: [], reason: "no_eligible_loans" };

  const loanIdsToPayoff: string[] = [];
  for (const { loan, payoff } of sortEarlyPayoffCandidates(candidates)) {
    if (surplus < payoff) continue;
    loanIdsToPayoff.push(loan.loanId);
    surplus = round(surplus - payoff, 1);
  }

  if (loanIdsToPayoff.length === 0) {
    return { loanIdsToPayoff: [], reason: "insufficient_surplus_for_any_loan" };
  }
  return { loanIdsToPayoff, reason: "surplus_payoff" };
}
