import type { GameState, LoanRecord } from "@/lib/data/olyDataTypes";

import { estimateUpgradeBuyFloorMw, isCashHoardingTeam, isStrategicHoardTeam } from "@/lib/ai/ai-budget-deploy-service";
import { resolveTeamSpendableCashForPlanning } from "@/lib/ai/planner-cash-buffer-policy";
import { deriveRosterTargets } from "@/lib/foundation/roster-limits";
import { getTeamStrategyProfile } from "@/lib/foundation/team-strategy-profiles";
import { computeEarlyPayoff, computeLoanTerms, estimateTeamAnnualRevenue, getTeamAnnualLoanInstallment, originateLoan } from "@/lib/finance/loan-service";
import { isSeasonOne } from "@/lib/season/transfer-season-policy";
import { getTeamSalarySum } from "@/lib/ai/ai-cash-salary-target-service";
import { calculateFacilityUpkeep, getTeamFacilityState } from "@/lib/facilities/facility-effects";

/**
 * Phase 2 KI-Anbindung, siehe docs/design/kredit-system.md ("KI-Anbindung"). Bedarfsgetrieben und
 * persönlichkeitsgegated, nicht zins-arbitrage-getrieben: eine KI nimmt nur einen Kredit auf, wenn
 * sie echten Kaderbedarf hat und ihn sich sonst nicht leisten kann.
 */

/** Default-Laufzeit (Kapazitäts-Vorschau + neutraler Startwert); der reale Term ergibt sich tragbarkeits-basiert. */
const DEFAULT_TERM_SEASONS = 4;
/**
 * Kandidaten-Laufzeiten, AUFSTEIGEND — die kürzeste tragbare gewinnt (kleiner Bedarf → kurze Laufzeit,
 * nicht ewig gestreckt). Lange Laufzeiten sind ERLAUBT (bis 10), aber nur wenn der Betrag es nötig macht
 * ("wenn begründet"), nicht als Standard. Kein harter Term-Block.
 */
const TERM_CANDIDATES = [2, 3, 4, 5, 6, 8, 10];
const MIN_WILLINGNESS = 0.3;
const MAX_WILLINGNESS = 1.0;
/** Bereitschaft sinkt um diesen Faktor je cashPriority-Punkt über dem neutralen Wert (5). */
const WILLINGNESS_CASH_PRIORITY_STEP = 0.1;
/** Zusätzlicher Dämpfungsfaktor für explizit als Cash-Hoarder markierte Teams. */
const HOARDER_WILLINGNESS_MULTIPLIER = 0.6;
/** Bereitschaft sinkt zusätzlich mit vorhandener Verschuldung (Teams werden bewusst vorsichtiger). */
const LEVERAGE_WILLINGNESS_STEP = 0.7;
/** Nur bei spürbarer Finanzierungslücke leihen — kleine Routine-Top-ups lösen keinen Kredit aus. */
const MIN_MEANINGFUL_SHORTFALL = 8;
/**
 * Kredit-Bedarf zielt NICHT auf das volle Opt, sondern nur auf eine wettbewerbsfähige Zwischenstufe
 * (Min + dieser Anteil des Wegs zu Opt). Den Rest bis Opt füllt ein Team aus eigenem Cash. So wird
 * nicht die ganze Liga jede Preseason auf Opt fremdfinanziert.
 */
const COMPETITIVE_FLOOR_OPT_FRACTION = 0.5;
/**
 * Der Kredit-Bedarf wird zu einem MODERATEN Fill-Preis pro Slot bewertet, nicht zum vollen Upgrade-
 * Qualitätspreis (estimateUpgradeBuyFloorMw liegt bei ~22–52/Slot). Ein Kredit ist ein Liquiditäts-
 * Backstop, um bei knapper Kasse überhaupt einen spielfähigen Kader zu stellen — NICHT um einen ganzen
 * Kader aus teuren Upgrades fremdzufinanzieren. Ohne diese Dämpfung „braucht" selbst ein Team mit 120+
 * Cash einen Kredit, weil Lücke × Upgrade-Preis jeden Cash-Bestand übersteigt (Combined-Run-Befund:
 * H-R/R-L/T-C leihen mit 110–138 Cash). ENV-tunebar zum schnellen Kalibrieren.
 */
const LOAN_NEED_FILL_FRACTION = Number(process.env.OLY_LOAN_NEED_FILL_FRACTION ?? 0.3) || 0.3;
/**
 * Tragfähigkeits-Budget = was vom Sponsor-FC nach den Fixkosten für Kreditdienst übrig bleibt. Das Gehalt
 * wird nur ANTEILIG gegengerechnet (Teams haben auch Transfer-/sonstige Einnahmen), der Gebäude-Unterhalt
 * voll. So behalten Teams Gehalt + Gebäudekosten vs. Sponsor im Blick und nehmen keine zu kurzen (zu
 * teuren) Kredite auf, die sie zusammen mit den Fixkosten nicht stemmen können.
 */
const SALARY_SERVICE_WEIGHT = 0.6;
/** Auch bei hohen Fixkosten bleibt mindestens dieser Anteil des Sponsor-FC als Kreditdienst-Budget nutzbar. */
const MIN_DEBT_SERVICE_FLOOR = 0.15;
/** Ist nach den bestehenden Raten weniger als das übrig, gibt es keinen Spielraum für einen weiteren Kredit. */
const MIN_DEBT_SERVICE_ROOM = 1;

/** Summe der offenen Restschuld (principalOutstanding) über alle aktiven Kredite eines Teams. */
function sumActiveOutstanding(gameState: GameState, teamId: string): number {
  return (gameState.seasonState.loans ?? [])
    .filter((loan) => loan.borrowerTeamId === teamId && loan.status === "active")
    .reduce((sum, loan) => sum + (loan.principalOutstanding ?? 0), 0);
}

/** Wettbewerbsfähige Roster-Zwischenstufe zwischen Min und Opt (Kredit-Zielgröße, nicht das volle Opt). */
function resolveCompetitiveFloor(playerMin: number, playerOpt: number): number {
  return playerMin + Math.ceil(Math.max(0, playerOpt - playerMin) * COMPETITIVE_FLOOR_OPT_FRACTION);
}

/**
 * Jährliches Budget für Kreditraten: Sponsor-FC minus Fixkosten (anteiliges Gehalt + voller Gebäude-
 * Unterhalt), mit einem Floor, damit auch bei hohen Fixkosten ein kleiner Rahmen bleibt. Gegen dieses
 * Budget (nach Abzug der bereits laufenden Raten) wird die Tragfähigkeit geprüft — nicht mehr die Rate
 * blind gegen den vollen Sponsor-FC.
 */
function disposableDebtServiceBudget(gameState: GameState, teamId: string): number {
  const sponsorIncome = estimateTeamAnnualRevenue(gameState, teamId);
  if (sponsorIncome <= 0) return 0;
  const salary = getTeamSalarySum(gameState, teamId);
  const buildingUpkeep = calculateFacilityUpkeep(getTeamFacilityState(gameState, teamId));
  const afterFixedCosts = sponsorIncome - salary * SALARY_SERVICE_WEIGHT - buildingUpkeep;
  return Math.max(sponsorIncome * MIN_DEBT_SERVICE_FLOOR, afterFixedCosts);
}

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
  const { playerMin, playerOpt } = deriveRosterTargets(team, identity);
  // Bedarf nur bis zur wettbewerbsfähigen Zwischenstufe (nicht das volle Opt) — den Rest füllt das Team
  // aus eigenem Cash, damit Kredite die Ausnahme bleiben und nicht die ganze Liga auf Opt fremdfinanziert.
  const competitiveFloor = resolveCompetitiveFloor(playerMin, playerOpt);
  const rosterGap = Math.max(0, competitiveFloor - rosterCount);
  if (rosterGap <= 0) return 0;
  // Moderater Fill-Preis pro Slot (Bruchteil des Upgrade-Preises) — Kredit als Liquiditäts-Backstop für
  // einen spielfähigen Kader, nicht zur Fremdfinanzierung eines ganzen Upgrade-Kaders.
  return round(rosterGap * estimateUpgradeBuyFloorMw(gameState, teamId) * LOAN_NEED_FILL_FRACTION, 1);
}

/** Skaliert die Kreditbereitschaft nach Persönlichkeit runter (Hoarder/Cash-Creator borgen konservativ). */
function resolveWillingness(gameState: GameState, teamId: string, seasonId: string): number {
  const profile = getTeamStrategyProfile(gameState, teamId);
  const cashPriority = profile?.bias.cashPriority ?? 5;
  let willingness = clamp(1 - (cashPriority - 5) * WILLINGNESS_CASH_PRIORITY_STEP, MIN_WILLINGNESS, MAX_WILLINGNESS);
  if (isCashHoardingTeam(gameState, teamId, seasonId)) {
    willingness = clamp(willingness * HOARDER_WILLINGNESS_MULTIPLIER, MIN_WILLINGNESS, MAX_WILLINGNESS);
  }
  // Leverage-Vorsicht: je höher die vorhandene Schuldenlast relativ zu den Einnahmen, desto weniger
  // bereit ist das Team, weiter zu leihen (bewusste Zurückhaltung statt immer weiter aufzuhebeln).
  const revenue = estimateTeamAnnualRevenue(gameState, teamId);
  if (revenue > 0) {
    const leverage = sumActiveOutstanding(gameState, teamId) / revenue;
    willingness = clamp(willingness * (1 - leverage * LEVERAGE_WILLINGNESS_STEP), MIN_WILLINGNESS, MAX_WILLINGNESS);
  }
  return willingness;
}

/**
 * Wählt die KÜRZESTE Laufzeit, deren Rate in das noch freie Kreditdienst-Budget passt (Budget minus
 * bereits laufende Raten) — kleiner Bedarf ⇒ kurze Laufzeit, nicht ewig gestreckt. Passt die Rate erst
 * bei einer langen Laufzeit, wird diese genommen (lange Kredite sind erlaubt, "wenn begründet"): der
 * Fallback ist die LÄNGSTE Laufzeit (kleinste Rate), kein harter Block. `null` nur, wenn nach den
 * bestehenden Raten gar kein Spielraum mehr da ist (echte Überschuldung, kein weiterer Kredit).
 */
function resolveServiceableTermSeasons(input: {
  gameState: GameState;
  teamId: string;
  principal: number;
  finances: number;
}): number | null {
  const budget = disposableDebtServiceBudget(input.gameState, input.teamId);
  const existingInstallment = getTeamAnnualLoanInstallment(input.gameState, input.teamId);
  const room = budget - existingInstallment;
  // Kein Einkommensdatum (budget 0, z. B. brandneues Team ohne Payout-Log): kurze Default-Laufzeit zulassen.
  if (budget <= 0) return DEFAULT_TERM_SEASONS;
  // Bestehende Raten fressen bereits das ganze Budget → keine weitere Rate tragbar.
  if (room <= MIN_DEBT_SERVICE_ROOM) return null;

  for (const termSeasons of TERM_CANDIDATES) {
    const terms = computeLoanTerms({ principal: input.principal, termSeasons, finances: input.finances });
    if (terms.installmentPerSeason <= room) return termSeasons;
  }
  // Selbst die längste Laufzeit liegt knapp über dem Rahmen — als begründete Ausnahme trotzdem die
  // längste (kleinste Rate) nehmen statt abzulehnen; Kapazität + Bereitschaft haben den Betrag bereits
  // gedeckelt.
  return TERM_CANDIDATES[TERM_CANDIDATES.length - 1];
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
  const { playerMin, playerOpt } = deriveRosterTargets(team, identity);
  // Trigger nur unter der wettbewerbsfähigen Zwischenstufe (Min + halber Weg zu Opt), NICHT schon unter
  // Opt. Ein Team, das diese Stufe aus eigener Kraft erreicht, nimmt keinen Kredit auf — den Rest bis Opt
  // finanziert es aus eigenem Cash. So bleibt Kredit die Ausnahme statt Standard-Preseason-Top-up.
  const competitiveFloor = resolveCompetitiveFloor(playerMin, playerOpt);
  const rosterGap = Math.max(0, competitiveFloor - rosterCount);

  if (rosterGap <= 0) return noLoan("no_need");
  // Reine Hort-Teams (Cash-Creator-Identität) borgen aus Charakter nicht.
  if (isStrategicHoardTeam(gameState, teamId)) return noLoan("strategic_hoard");

  // Kein harter Leverage-Block mehr (User: Kredite sollen möglich bleiben, "wenn begründet"): die
  // Vorsicht gegen eine Schuldenspirale läuft jetzt weich über (a) das Kreditdienst-Budget in
  // resolveServiceableTermSeasons, das die bereits laufenden Raten UND Gehalt/Gebäudekosten
  // gegenrechnet, und (b) die leverage-abhängig sinkende Bereitschaft in resolveWillingness.

  const needsEur = estimateRosterNeedEur(gameState, teamId);
  const spendableCash = resolveTeamSpendableCashForPlanning(gameState, teamId, team.cash ?? 0);
  const shortfall = round(needsEur - spendableCash, 1);
  if (shortfall <= 0) return noLoan("cash_sufficient");
  // Kredit ist kein Routine-Top-up: nur bei spürbarer Finanzierungslücke. AUSNAHME: ein Team unter dem
  // harten Roster-Minimum darf immer leihen, um überhaupt einen spielfähigen Kader stellen zu können
  // (sonst hält der Saison-Preflight "teams_under_7" den ganzen Lauf an) — dafür greift die Schwelle nicht.
  const belowHardMin = rosterCount < playerMin;
  if (!belowHardMin && shortfall < MIN_MEANINGFUL_SHORTFALL) return noLoan("shortfall_minor");

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
  // Keine kurze Laufzeit ist zusammen mit der bestehenden Last tragbar → Kredit ablehnen statt strecken.
  if (termSeasons == null) return noLoan("debt_service_ceiling");

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
