/**
 * SPONSOREN-SEITE: reine Hilfen (24.11., Seiten-PR, Mockup public/mockups/sponsoren-modern-22-11.html).
 *
 * Die Seite rechnet nichts ein zweites Mal: alle Betraege kommen aus `baueSponsorUebersicht`. Hier steht nur, was die Darstellung ueber das
 * View-Modell hinaus braucht (Formatierung, Scouting-Nebel des Erwartungsrangs, Auszahlungsstufen je Endrang, Faktor-Regler der Rechenansicht)
 * und was ohne React testbar sein soll.
 */
import { runde1 } from "@/lib/sponsors/sponsor-topf-modell";
import type { SponsorUebersicht } from "@/lib/sponsors/sponsor-uebersicht";

const MINUS = "−";

export function zahlDe(wert: number, stellen = 1): string {
  const n = Number.isFinite(wert) ? wert : 0;
  const t = Math.abs(n).toLocaleString("de-DE", { minimumFractionDigits: stellen, maximumFractionDigits: stellen });
  const istNull = Number(Math.abs(n).toFixed(stellen)) === 0;
  return n < 0 && !istNull ? `${MINUS}${t}` : t;
}

/** Mit Vorzeichen: +1,3 / −2,1 / ±0,0. */
export function vorzeichenDe(wert: number, stellen = 1): string {
  const n = Number.isFinite(wert) ? wert : 0;
  if (Number(Math.abs(n).toFixed(stellen)) === 0) return `±${zahlDe(0, stellen)}`;
  return `${n > 0 ? "+" : MINUS}${zahlDe(Math.abs(n), stellen)}`;
}

export function tonVon(wert: number): "plus" | "minus" | "leise" {
  if (wert > 0.049) return "plus";
  if (wert < -0.049) return "minus";
  return "leise";
}

/**
 * Scouting-Nebel (Server, `liga_vergleich`): fremde Teams liefern den Erwartungsrang schon in Vierer-Schritten (`nebel: true`). Die Seite
 * zeigt und sortiert nur, was ankommt: "ca. 8" fuer eine Stufe, exakt fuer das eigene Team.
 */
export type ErwartungsAnzeige = { text: string; sort: number; exakt: boolean };

export function erwartungsAnzeige(nebel: boolean, erwartungsrang: number): ErwartungsAnzeige {
  if (nebel) return { text: `ca. ${Math.round(erwartungsrang)}`, sort: erwartungsrang, exakt: false };
  return { text: zahlDe(Math.round(erwartungsrang * 10) / 10, 1).replace(/,0$/, ""), sort: erwartungsrang, exakt: true };
}

/** Auszahlungsstufen eines Angebots: Grundbetrag + Leistungsteil (Mittelterm 0) bei den gezeigten Endraengen. Rang 1 = bester. */
export const AUSZAHLUNG_RAENGE = [1, 2, 4, 8, 12, 16] as const;

export type AuszahlungsZeile = { rang: number; erwartung: boolean; leistung: number; summe: number };

export function auszahlungsZeilen(grund: number, satzJePlatz: number, erwartungsrang: number): AuszahlungsZeile[] {
  const erw = Math.round(erwartungsrang);
  const raenge = Array.from(new Set<number>([...AUSZAHLUNG_RAENGE, erw])).sort((a, b) => a - b);
  return raenge.map((rang) => {
    const leistung = runde1(satzJePlatz * (erwartungsrang - rang));
    return { rang, erwartung: rang === erw, leistung, summe: runde1(grund + leistung) };
  });
}

/**
 * Faktor-Regler der Rechenansicht: T = F x (K_B + K_E) - Uebertrag - Korrektur. Die Korrektur (Liga-Wert-Rueckkopplung) kommt als
 * `rechnung.wertKorrektur` aus dem View-Modell. Gibt den Topf bei verschobenem Faktor und die Differenz je Team (32 Teams) zurueck.
 */
export function topfBeiFaktor(r: SponsorUebersicht["rechnung"], faktorAlt: number, faktorNeu: number, teams = 32) {
  const basis = r.betriebsteil + r.kaderErsatz;
  const korrektur = r.wertKorrektur;
  void faktorAlt;
  const topf = faktorNeu * basis - r.uebertrag - korrektur;
  return { topf: runde1(topf), differenz: runde1(topf - r.topf), jeTeam: runde1((topf - r.topf) / Math.max(1, teams)), basis: runde1(basis) };
}

/** Kennzahlen der Liga-Bilanz (rechte Spalte der Rechenansicht), alle aus `ligaBilanz` und `liga_vergleich`. */
export function bilanzKennzahlen(u: SponsorUebersicht, teamId: string) {
  const eigenes = u.ligaBilanz.teams.find((t) => t.teamId === teamId)?.guvBeiErwartung ?? 0;
  const alle = u.ligaBilanz.teams;
  const mittel = alle.length ? alle.reduce((s, t) => s + t.guvBeiErwartung, 0) / alle.length : 0;
  const imPlus = alle.filter((t) => t.guvBeiErwartung >= 0).length;
  const eigene = u.liga_vergleich;
  const gruende = eigene.map((t) => t.grund).filter((g) => g > 0);
  const gross = gruende.length ? Math.max(...gruende) : 0;
  const klein = gruende.length ? Math.min(...gruende) : 0;
  const l1 = u.ligaBilanz.grundSummeJeLiga.liga1;
  const l2 = u.ligaBilanz.grundSummeJeLiga.liga2;
  return {
    mittel: runde1(mittel),
    eigenesErgebnis: eigenes,
    imPlus,
    imMinus: alle.length - imPlus,
    anzahl: alle.length,
    groessterZuKleinster: klein > 0 ? Math.round((gross / klein) * 100) / 100 : 0,
    ligaVerhaeltnis: l2 > 0 ? Math.round((l1 / l2) * 100) / 100 : 0,
  };
}
