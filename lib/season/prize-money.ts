/**
 * @deprecated LEGACY — PREISGELD IST ABGESCHAFFT.
 *
 * Preisgeld (Liga-Pool) wird NICHT mehr ausgezahlt und NICHT mehr genutzt. Die einzige
 * cash-wirksame Saison-Einnahme sind SPONSOREN (siehe `lib/sponsor/*` +
 * `sponsor-settlement-service.ts`); die Cash-Prize-Apply-Kette ist reiner Benchmark
 * (`CASH_PRIZE_BENCHMARK_ONLY = true`).
 *
 * Dieses Modul bleibt nur für Back-Compat bestehen (historische Standings-Felder, die
 * historisch `sponsor*` heißen, aber Preisgeld meinen — siehe `team-management-overview.ts`).
 * Für NEUE Features NICHT verwenden — überall Sponsoren nutzen. Ziel: bei einem späteren
 * Cleanup ganz entfernen.
 */
import type { PrizeMoneyRow, TeamPrizeSummaryRow } from "@/lib/season/types";
import type { AdminBalancingConfigInput } from "@/lib/data/olyDataTypes";
import { resolveAdminBalancingConfig } from "@/lib/admin/balancing-config";
import { getPrizePlacementBonus } from "@/lib/season/prize-placement-table";

const SPONSOR_SEASON_PERCENTS = [
  7.67, 7.29, 6.9, 6.52, 6.13, 5.75, 5.37, 4.98, 4.6, 4.22, 3.99, 3.76, 3.53, 3.3, 3.07, 2.84,
  2.61, 2.38, 2.15, 1.92, 1.76, 1.61, 1.46, 1.3, 1.15, 1, 0.84, 0.69, 0.54, 0.38, 0.23, 0.08,
] as const;

/**
 * ANTEIL DES TOPFES, DER FLACH AUF ALLE 32 PLAETZE VERTEILT WIRD (V4).
 *
 * Der Rest laeuft ueber `SPONSOR_SEASON_PERCENTS`. Der Wert ist auf den Eigentuemer-Benchmark
 * kalibriert: bei der echten Liga-Gehaltssumme des Live-Saves (2056,6 C) und Gehaltsfaktor 1,0
 * bekommt der Meister 90,9 C — bei einem Meister-Gehalt von 95,7 C also ein netto etwa stabiles
 * Jahr. Die Schere Rang 1 zu Rang 32 liegt damit bei 1,96x und bleibt unter dem Balancingziel 2x.
 *
 * Kleinerer Anteil = steilere Kurve (mehr fuer die Spitze), groesserer = flachere.
 */
export const SPONSOR_SOCKEL_SHARE = 0.715;

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

/**
 * DIE AUSZAHLUNGSKURVE DER SAISON — `Kurve(r) = f*S*s/32 + f*S*(1-s)*p_r/Sum(p)`.
 *
 * `S` ist die echte Liga-Gehaltssumme, `f` der Gehaltsfaktor, `s` der flache Sockelanteil. Der Topf
 * ist damit exakt `S*f`, wie zuvor — geaendert hat sich, WIE er verteilt wird.
 *
 * FRUEHER hing an jedem Rang ein eigener Sockel (`BASIS_DIFFS`, viertniedrigstes Gehalt plus einen
 * mit dem Rang WACHSENDEN Aufschlag), und der verteilbare Rest war `max(0, S*f - Sockelsumme)`.
 * Beide Groessen liefen gegeneinander: der Sockel war faktor-fix, der Rest schrumpfte mit dem
 * Faktor. Unterhalb Faktor 0,8722 ueberholte die Sockelsteigung die Prozentkurve und die Tabelle
 * KIPPTE — bei 0,82, dem echten Boden des Saison-Wurfs, verdiente der Tabellenletzte mehr als der
 * Meister. Da die Sponsorleiter diese Kurve woertlich einfriert, erbte sie die Inversion; ~12 % aller
 * Saisons lagen im gekippten Bereich.
 *
 * Der flache Sockel behebt das STRUKTURELL statt kalibriert: er ist rangneutral und skaliert mit dem
 * Faktor, also ist die Kurve fuer jedes `f > 0` streng fallend im Rang. Ein schlechtes Jahr trifft
 * damit alle proportional, statt die Spitze allein zahlen zu lassen.
 */
export function buildPrizeMoneyTable(teamSalaries: number[], salaryFactor = 1, adminConfig?: AdminBalancingConfigInput | null): PrizeMoneyRow[] {
  const sponsorSeasonPercents = adminConfig ? resolveAdminBalancingConfig(adminConfig).prizeMoneyPercents : [...SPONSOR_SEASON_PERCENTS];
  const sumPercent = sponsorSeasonPercents.reduce((sum, value) => sum + value, 0);
  const salaries = teamSalaries.filter((value) => Number.isFinite(value));
  const totalSalaries = salaries.reduce((sum, value) => sum + value, 0);

  // DER TOPF GEHOERT ZUR TABELLE, NICHT ZUR TEAMLISTE. Die Kurve hat feste 32 Raenge; kaemen weniger
  // Gehaelter herein (Testzustaende, Teil-Ligen), waere der Topf auf denselben Bruchteil geschrumpft
  // und die Kurve liefe unter die Sponsor-Untergrenze — dort klammert sie, und das Klammern zerstoert
  // die Erwartungswert-Gleichheit der Karten. Ueber das MITTLERE Gehalt hochgerechnet ist der Topf
  // fuer die echte 32er-Liga rechnerisch identisch zur Gehaltssumme und bleibt sonst massstabstreu.
  const meanSalary = salaries.length > 0 ? totalSalaries / salaries.length : 0;
  const pot = Math.max(0, meanSalary * sponsorSeasonPercents.length * salaryFactor);
  const flatBasis = (pot * SPONSOR_SOCKEL_SHARE) / sponsorSeasonPercents.length;
  const seasonTotal = pot - flatBasis * sponsorSeasonPercents.length;

  return sponsorSeasonPercents.map((percent, index) => {
    const seasonShare = round2(sumPercent > 0 ? seasonTotal * (percent / sumPercent) : 0);
    const basis = round2(flatBasis);
    return {
      rank: index + 1,
      basis,
      percent,
      // Der rangabhaengige Sockelaufschlag ist entfallen; das Feld bleibt fuer die Zeilenform.
      diff: 0,
      seasonShare,
      totalPrizeMoney: round2(basis + seasonShare),
    };
  });
}

export function buildTeamPrizeSummary(
  seasonStandRows: Array<{
    rank: number;
    startPlace?: number;
    team: { teamId: string; name: string; cash: number };
    upkeep: number;
    transfers?: number;
  }>,
  salaryFactor = 1,
  adminConfig?: AdminBalancingConfigInput | null,
): TeamPrizeSummaryRow[] {
  const prizeRows = buildPrizeMoneyTable(seasonStandRows.map((row) => row.upkeep), salaryFactor, adminConfig);
  const prizeMap = new Map(prizeRows.map((row) => [row.rank, row]));

  return seasonStandRows.map((row, index) => {
    const prize = prizeMap.get(row.rank);
    const startPlace = row.startPlace ?? index + 1;
    const rankDiff = startPlace - row.rank;
    const transfers = round2(row.transfers ?? 0);
    const basis = prize?.basis ?? 0;
    const sponsorSeason = prize?.seasonShare ?? 0;
    // EINE Platzierungstabelle, die des Sheets — dieselbe, aus der der Preisgeld-Benchmark und die
    // Sponsorleiter rechnen. Die frueher hier benutzte Code-Tabelle (`getSponsorPlacementLookup`,
    // ±8,33 fuer einen Platz) war das zweite Exemplar desselben Begriffs und lag um Faktor sechs
    // daneben; sie ist mit dem V3-Umbau ersatzlos entfallen.
    const placementBonus = getPrizePlacementBonus(rankDiff);
    const sponsorTotal = round2(basis + sponsorSeason + placementBonus);
    const profitLoss = round2(sponsorTotal - row.upkeep);
    // `team.cash` is already the local in-season cash state, including transfer effects.
    // Season-end preview must not subtract transfer spend a second time.
    const cashForecast = round2(row.team.cash - row.upkeep);
    const cashTotal = round2(cashForecast + sponsorTotal);

    return {
      teamId: row.team.teamId,
      teamName: row.team.name,
      place: row.rank,
      startPlace,
      rankDiff,
      salary: round2(row.upkeep),
      cash: round2(row.team.cash),
      transfers,
      basis: round2(basis),
      sponsorSeason: round2(sponsorSeason),
      placementBonus: round2(placementBonus),
      sponsorTotal,
      profitLoss,
      cashForecast,
      cashTotal,
    };
  });
}

export function getDefaultSalaryFactors() {
  return [1, 1, 1, 1, 1];
}
