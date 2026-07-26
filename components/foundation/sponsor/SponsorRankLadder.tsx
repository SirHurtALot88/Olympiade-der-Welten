"use client";

import { buildSponsorRankTierRows } from "@/lib/sponsor/sponsor-offer-presenter";

/**
 * Grafische Gewinnstufen-Leiter (Meister … Platz 32) mit hervorgehobener aktuell erreichter Stufe.
 *
 * Lag vorher nur inline in `SponsorOfferCardNewLook` und war damit ausschliesslich auf der eigenen
 * Angebotskarte zu sehen; ueberall sonst standen die Gewinnstufen als gequetschte Textzeile
 * ("Top 28 (+7 C) · Top 24 (+5 C) · …"). Als eigene Komponente ist dieselbe Darstellung jetzt
 * mehrfach nutzbar — Markup und CSS-Klassen sind unveraendert uebernommen, damit die bestehende
 * Karte optisch exakt gleich bleibt.
 */
export function SponsorRankLadder({
  rankLadder,
  baseCash,
  currentTeamRank,
  formatCash,
}: {
  /** Gelockte curveShape-Rang-Payout-Leiter (1..32) — dieselbe Quelle, aus der das Settlement zahlt. */
  rankLadder: number[];
  baseCash: number;
  /** Aktueller Liga-Rang des Teams; `null` blendet die Hervorhebung aus. */
  currentTeamRank: number | null;
  formatCash: (value: number) => string;
}) {
  const tierRows = buildSponsorRankTierRows({ baseCash, rankLadder, includeFloorRung: true });

  // Hoechste Stufe, deren Rang-Schwelle der aktuelle Liga-Rang erfuellt
  // (Meilensteine sind aufsteigend schwerer sortiert).
  let currentTierIndex = -1;
  if (currentTeamRank != null) {
    tierRows.forEach((row, index) => {
      if (currentTeamRank <= row.rankAt) {
        currentTierIndex = index;
      }
    });
  }

  return (
    <ul className="nl-sponsor-rank-ladder" data-testid="sponsor-rank-tier-list">
      {/* Meister (hoechste Stufe) oben: die Leiter wird von stark→schwach gerendert, waehrend
          rankAt-Index/Balkenbreite an der Tier-Staerke haengen bleiben (Meister = voller Balken). */}
      {tierRows
        .map((row, tierIndex) => ({ row, tierIndex }))
        .reverse()
        .map(({ row, tierIndex }) => {
          const isReached = currentTierIndex >= 0 && tierIndex <= currentTierIndex;
          const isCurrent = tierIndex === currentTierIndex;
          return (
            <li
              key={row.label}
              className={`nl-sponsor-rank-rung${isReached ? " is-reached" : ""}${isCurrent ? " is-current" : ""}`}
            >
              <span
                className="nl-sponsor-rank-rung-bar"
                aria-hidden="true"
                style={{ width: `${Math.round(((tierIndex + 1) / tierRows.length) * 100)}%` }}
              />
              <span className="nl-sponsor-rank-rung-label">
                {row.label}
                {isCurrent ? <span className="nl-sponsor-rank-rung-live">● aktuell</span> : null}
              </span>
              <span className="nl-sponsor-rank-rung-payout nl-tnum">{formatCash(row.absolutePayout)}</span>
            </li>
          );
        })}
    </ul>
  );
}

export default SponsorRankLadder;
