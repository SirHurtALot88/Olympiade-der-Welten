/**
 * Finanzkonzept V2, Stufe 2 ("Schraube C"): erwarteter Sponsor fuer den Planungs-Forecast der KI.
 *
 * Bisher bekamen alle drei Aufrufer von `planOrganicDraftForTeam` kein `forecast`, der Planer rechnete mit
 * `sponsorIncome = 0` und bremste sponsor-blind. Jetzt: `0,92 x terms.anchor` des laufenden Vertrags (der
 * Anker ist der Erwartungswert der Karte am Startrang; gemessen werden im Median 92 % davon ausgezahlt,
 * docs/design/ki-kaufverhalten-analyse-18-11.md Abschnitt 3). Ohne v3-Terms faellt es auf den
 * Umsatz-Schaetzer (`estimateTeamAnnualRevenue`) zurueck, ohne Vertrag auf 0 (altes Verhalten).
 *
 * KEIN harter Deckel (Chris, 18.11.: der alte Gehaltsdeckel hat die Teams "nur Mist kaufen" lassen): der
 * Wert fuettert nur die weiche Prognose (`projectCashFlow` -> Bleed-Druck im Kauf-/Stop-Nutzen).
 */

import type { GameState } from "@/lib/data/olyDataTypes";
import { estimateTeamAnnualRevenue } from "@/lib/finance/loan-service";
import { getTeamSponsorContract } from "@/lib/sponsor/sponsor-offer-read";
import { topfPlanungSponsor } from "@/lib/sponsors/sponsor-topf-stichtag";
import { getSponsorV3Terms } from "@/lib/sponsor/sponsor-v3-offer-service";

/** Gemessene Realisationsquote Auszahlung / Anker (Median ueber 93 Team-Laeufe). */
export const SPONSOR_REALISATION = 0.92;

/** A/B-Schalter: `OLY_KI_FORECAST_SPONSOR=0` laesst den Forecast bei 0 wie vor Finanzkonzept V2. */
export function istSponsorForecastAktiv(): boolean {
  return process.env.OLY_KI_FORECAST_SPONSOR !== "0";
}

export function erwarteterSponsorFuerPlanung(gameState: GameState, teamId: string): number {
  // SPONSOR-TOPF (24.11.): die Planung rechnet mit der Vorab-Zusage (90 % des vorlaeufigen Grundbetrags, Leistungsteil 0), nach dem Stichtag mit dem Grundbetrag.
  const topf = topfPlanungSponsor(gameState, teamId);
  if (topf != null) return topf;
  const vertrag = getTeamSponsorContract(gameState, teamId);
  const anker = getSponsorV3Terms(vertrag)?.anchor;
  if (typeof anker === "number" && Number.isFinite(anker) && anker > 0) {
    return Math.round(anker * SPONSOR_REALISATION * 100) / 100;
  }
  const umsatz = estimateTeamAnnualRevenue(gameState, teamId);
  return umsatz > 0 ? Math.round(umsatz * 100) / 100 : 0;
}
