"use client";

import {
  SPONSOR_RANK_FLOOR_AT,
  SPONSOR_RANK_FLOOR_LABEL,
  SPONSOR_RANK_LADDER_RUNGS,
} from "@/lib/sponsor/sponsor-offer-presenter";

/**
 * GEFRAGT: „Wenn man über das jahr drüber hovert würde ich dann auch erwarten dass die rangtabelle
 * gezeigt wird wie viel cash pro rang man bekommt."
 *
 * Die Tabelle gehoert zur EINZELNEN Vertragssaison, nicht zum Angebot als Ganzem: der Salary Factor
 * und die Laufzeit-Erosion unterscheiden sich je Jahr, also unterscheiden sich auch die Betraege.
 * Genau darin liegt der Informationswert — eine Leiter, die fuer alle drei Jahre dieselbe waere,
 * muesste man nicht dreimal aufklappen koennen.
 *
 * Die Betraege kommen fertig aus `SponsorOfferTermForecastEntry.rankPayouts` (Rang 1..32, Faktor und
 * Erosion bereits eingerechnet) — dieselbe Rechnung, aus der auch der Zeilenbetrag stammt. Hier wird
 * nichts nachgerechnet, nur ausgewaehlt.
 */
export function SponsorSeasonRankTable({
  rankPayouts,
  currentTeamRank,
  formatCash,
}: {
  /** Auszahlung je Liga-Rang 1..32 fuer genau diese Vertragssaison. */
  rankPayouts: number[];
  /** Aktueller Liga-Rang des Teams; `null` blendet die Hervorhebung aus. */
  currentTeamRank: number | null;
  formatCash: (value: number) => string;
}) {
  if (rankPayouts.length === 0) {
    return null;
  }
  const zahlung = (rang: number) => rankPayouts[Math.min(rankPayouts.length, Math.max(1, rang)) - 1] ?? 0;
  // Stark → schwach, wie die Liga sie liest.
  const zeilen: Array<{ label: string; rankAt: number }> = SPONSOR_RANK_LADDER_RUNGS.map((rung) => ({
    label: rung.label,
    rankAt: rung.maxRank,
  })).sort((links, rechts) => links.rankAt - rechts.rankAt);
  zeilen.push({ label: SPONSOR_RANK_FLOOR_LABEL, rankAt: SPONSOR_RANK_FLOOR_AT });

  // Die BESTE Stufe, deren Schwelle der aktuelle Rang noch haelt. Die Zeilen stehen aufsteigend
  // nach Schwelle (Meister 1 … Platz 32), also ist das die erste passende — nicht die letzte.
  const erreicht = currentTeamRank == null ? null : zeilen.find((zeile) => currentTeamRank <= zeile.rankAt) ?? null;

  return (
    <table className="nl-sponsor-season-rank-table" data-testid="sponsor-season-rank-table">
      <caption className="nl-sponsor-season-rank-caption">Cash je Endrang in dieser Saison</caption>
      <tbody>
        {zeilen.map((zeile) => {
          const istAktuell = erreicht?.label === zeile.label;
          return (
            <tr key={zeile.label} className={istAktuell ? "is-current" : undefined}>
              <th scope="row">
                {zeile.label}
                {istAktuell ? <span className="nl-sponsor-season-rank-live"> ● aktuell</span> : null}
              </th>
              <td className="nl-tnum">{formatCash(zahlung(zeile.rankAt))}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default SponsorSeasonRankTable;
