import { PRESEASON_CASH_PRESSURE_THRESHOLD } from "@/lib/ai/preseason-cash-recovery-service";
import { getTeamCashSalarySoftTarget } from "@/lib/ai/ai-cash-salary-target-service";
import { buildSchuldenlastFruehwarnung } from "@/lib/ai/schuldenlast-fruehwarnung";
import type { GameState, Team } from "@/lib/data/olyDataTypes";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function countTeamSeasonSells(gameState: GameState, teamId: string, seasonId = gameState.season.id) {
  return gameState.transferHistory.filter(
    (entry) => entry.transferType === "sell" && entry.fromTeamId === teamId && entry.seasonId === seasonId,
  ).length;
}

/**
 * Aufschlag fuer eine absolut duenne Kasse, unabhaengig von der Gehaltsquote.
 *
 * Die Quote allein reicht nicht: ein Team mit 5 Gehalt und 4 Cash steht quotenmaessig glaenzend da,
 * kann aber keinen einzigen Transfer stemmen. Bewusst klein und gedeckelt — er ergaenzt die Quote,
 * er ersetzt sie nicht.
 */
const KNAPPE_KASSE_AUFSCHLAG = 0.15;

/**
 * 0–1 pressure signal — raises sell intent but never forces a minimum sell count.
 *
 * NEU BERECHNET (gemeldet aus der Gegenpruefung der Apron-Verkaufslogik). Die alte Formel addierte
 * vier Ja/Nein-Merkmale mit festen Gewichten, und drei davon trafen in der heutigen Oekonomie fast
 * immer zu. Am Spielstand gemessen: `salaryExceedsCash` 31/32, `tightCashRunway` 31/32,
 * `lowSellActivity` 32/32 — **31 der 32 Teams landeten bei 0,92 oder 1,00**. Ein Signal, das fuer
 * alle gleich laut ist, unterscheidet nichts mehr; die „Emergency"-Schwelle bei 0,45 war damit
 * bedeutungslos, und weil sie in `selectCompositeSellCandidates` den `hardMin`-Schutz aussetzt, war
 * dieser Schutz ligaweit faktisch abgeschaltet.
 *
 * ZWEITER, SCHAERFERER FEHLER — DAS VORZEICHEN STAND KOPF: drei der fuenf Summanden waren mit
 * `cash > 0` bewacht. Ein Team im MINUS verlor damit 0,52 + 0,28 + 0,18 und bekam nur die 0,35 fuer
 * negatives Cash. Gemessen: Project Suicide, als einziges Team der Liga im Minus (−1,2), hatte mit
 * 0,47 den NIEDRIGSTEN Druckwert der ganzen Liga — unter allen 31 Teams mit Guthaben.
 *
 * DIE NEUE RECHNUNG misst die Kasse an dem Ziel, das dieses Team ohnehin schon hat:
 * `getTeamCashSalarySoftTarget` (0,25–0,75 je nach Finance-Wert). Kein neuer erfundener Grenzwert,
 * sondern die Zahl, gegen die die Cash-Planung des Teams sowieso arbeitet — Druck heisst jetzt „wie
 * weit unter meinem eigenen Ziel stehe ich". Negatives Cash ist per Definition der Hoechstwert.
 */
export function assessTeamSellRunwayPressure(input: {
  gameState: GameState;
  team: Team;
  salaryTotal: number;
  seasonId?: string;
}) {
  const cash = input.team.cash ?? 0;
  const salaryTotal = Math.max(0, input.salaryTotal);
  const seasonSells = countTeamSeasonSells(input.gameState, input.team.teamId, input.seasonId);

  // Die Merkmale bleiben im Rueckgabewert: `salaryExceedsCash` liest die Verkaufsvorschau fuer eine
  // Begruendung, `lowCashBuffer` die Markt-Anwendung. Nur ihre Rolle als Summanden entfaellt.
  const salaryExceedsCash = cash > 0 && salaryTotal > cash * 0.85;
  const tightCashRunway = cash > 0 && salaryTotal > 0 && cash < Math.max(12, salaryTotal * 0.95);
  const lowSellActivity = seasonSells === 0 && salaryTotal > 0 && cash < salaryTotal * 1.15;
  const lowCashBuffer = cash > 0 && cash < PRESEASON_CASH_PRESSURE_THRESHOLD && salaryTotal > 0;

  const cashPressureScore = resolveCashPressureScore({
    gameState: input.gameState,
    teamId: input.team.teamId,
    cash,
    salaryTotal,
  });

  /**
   * ZWEITES, GETRENNTES SIGNAL — bewusst KEIN Summand im `cashPressureScore`. Der misst die Kasse
   * von heute und steht bei allen Teams mit leerer Kasse ohnehin auf 1; dort eingerechnet würde die
   * Frühwarnung gleich wieder in der Sättigung verschwinden, gegen die dieser Wert gerade erst neu
   * gerechnet wurde. Sie beantwortet die ANDERE Frage: reicht Cash + Umsatz für die nächste
   * Saisonend-Abbuchung (Gehalt + Kreditrate), oder muss dieses Team eher verkaufen?
   */
  const schuldenlast = buildSchuldenlastFruehwarnung(input.gameState, input.team.teamId, {
    cash,
    salaryTotal,
  });

  return {
    seasonSells,
    salaryExceedsCash,
    tightCashRunway,
    lowSellActivity,
    lowCashBuffer,
    cashPressureScore,
    schuldenlast,
  };
}

/**
 * Der eigentliche Druckwert — eigene Funktion, damit er ohne einen kompletten Spielstand pruefbar
 * ist.
 *
 * `lowSellActivity` geht BEWUSST NICHT EIN. Das Merkmal ist wahr, solange ein Team in dieser Saison
 * noch nichts verkauft hat, also am Saisonanfang bei allen 32 Teams. Es misst „hat noch nicht
 * gehandelt", nicht „ist in Not" — als Summand hat es nur den Sockel aller Teams gemeinsam angehoben
 * und damit exakt die Unterscheidung gekostet, um die es hier geht.
 */
export function resolveCashPressureScore(input: {
  gameState: GameState;
  teamId: string;
  cash: number;
  salaryTotal: number;
}): number {
  if (input.salaryTotal <= 0) return 0;
  // Kein Guthaben ist die schlimmste Lage, die es gibt — hier stand der Fehler frueher auf dem Kopf.
  if (input.cash < 0) return 1;

  const ziel = getTeamCashSalarySoftTarget(input.gameState, input.teamId);
  const quote = input.cash / input.salaryTotal;
  // 1 bei leerer Kasse, 0 sobald das eigene Ziel erreicht ist, linear dazwischen.
  const kern = ziel > 0 ? clamp((ziel - quote) / ziel, 0, 1) : 0;
  const knappeKasse = input.cash < PRESEASON_CASH_PRESSURE_THRESHOLD ? KNAPPE_KASSE_AUFSCHLAG : 0;
  return round(clamp(kern + knappeKasse, 0, 1), 3);
}

function round(value: number, digits = 3) {
  return Number(value.toFixed(digits));
}

export function getProfitWindowSellThreshold(cashPressureScore: number) {
  if (cashPressureScore >= 0.65) return 28;
  if (cashPressureScore >= 0.45) return 32;
  return 36;
}

/**
 * Cost-dependent probability that a team proactively cashes out a player entering his last
 * contract year (contractLength === 1) instead of carrying him to natural expiry.
 *
 * `buyoutCost` models the economic size of the commitment being cut short (we use the player's
 * current salary as a simple, auditable proxy: a bigger recurring commitment is a bigger decision
 * to walk away from early). The higher this cost is relative to the team's own cash cushion, the
 * less likely the team pulls the trigger — unless genuine roster or cash pressure overrides the
 * hesitation (a team that actually needs the slot/cash acts regardless of "cost comfort").
 */
export function estimateBuyoutLikelihood(input: {
  buyoutCost: number;
  teamCash: number;
  baseLikelihood: number;
  pressureOverride?: boolean;
}) {
  const base = clamp(input.baseLikelihood, 0, 1);
  if (input.pressureOverride) return round(base, 3);
  if (input.buyoutCost <= 0) return round(base, 3);
  const teamCash = Math.max(0, input.teamCash);
  const costRatio = teamCash > 0 ? input.buyoutCost / teamCash : 1;
  const affordabilityFactor = clamp(1 - costRatio, 0.1, 1);
  return round(base * affordabilityFactor, 3);
}

/**
 * 0 (strongest roster in the league) .. 1 (weakest). Scales the "proactive strong offer" bar
 * below: weak teams only need a genuine ~15% premium to be tempted, strong teams need ~25%+.
 * Never lower than 0.15 and never higher than 0.25 — always a real premium, never marginal profit.
 */
export function getProactiveStrongOfferPremiumBar(teamWeaknessScore: number) {
  const weakness = clamp(teamWeaknessScore, 0, 1);
  return round(clamp(0.25 - weakness * 0.1, 0.15, 0.25), 3);
}

export function isAttractiveProfitSell(input: {
  expectedSellValue: number | null;
  marketValue: number | null;
  purchasePrice?: number | null;
  cashPressureScore: number;
  /**
   * 0 (strongest roster in the league) .. 1 (weakest). ONLY used for the no-cash-pressure
   * "proactive strong offer" path: when provided, it REPLACES the flat no-pressure edge below
   * with a bar that scales from ~15% (weakest teams) up to ~25%+ (strongest teams) — a clear,
   * deliberate premium, not the marginal profit-taking the flat edge already allows. Omit it
   * (all pre-existing callers) to keep the original flat no-pressure thresholds untouched.
   */
  teamWeaknessScore?: number;
}) {
  const { expectedSellValue, marketValue, purchasePrice, cashPressureScore, teamWeaknessScore } = input;
  if (expectedSellValue == null || marketValue == null || marketValue <= 0) {
    return false;
  }
  const profitAbsolute = expectedSellValue - marketValue;
  const vsMarket = profitAbsolute / marketValue;
  const vsPurchase =
    purchasePrice != null && purchasePrice > 0 ? (expectedSellValue - purchasePrice) / purchasePrice : null;

  // Team-situativ: knappes Cash akzeptiert kleinere absolute Gewinne (3–4 C) und niedrigere MW-Kante.
  if (cashPressureScore >= 0.45) {
    if (profitAbsolute >= 3 && vsMarket >= 0.08) return true;
    if (vsPurchase != null && vsPurchase >= 0.05) return true;
    return vsMarket >= 0.05;
  }

  if (teamWeaknessScore != null) {
    const strongOfferBar = getProactiveStrongOfferPremiumBar(teamWeaknessScore);
    return profitAbsolute > 0 && vsMarket >= strongOfferBar;
  }

  const minMarketEdge = cashPressureScore >= 0.5 ? 0.05 : 0.07;
  const minPurchaseEdge = cashPressureScore >= 0.5 ? 0 : 0.08;
  const minAbsoluteProfit = cashPressureScore >= 0.35 ? 4 : 5;
  return (
    (profitAbsolute >= minAbsoluteProfit && vsMarket >= minMarketEdge) ||
    (vsPurchase != null && vsPurchase >= minPurchaseEdge)
  );
}
