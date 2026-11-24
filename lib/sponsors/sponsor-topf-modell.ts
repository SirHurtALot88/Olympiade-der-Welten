/**
 * SPONSOR-TOPF: REINE RECHENSCHICHT (24.11., Konzept docs/design/sponsoren-rework-22-11.md Abschnitt 4, Entscheidungen Abschnitt 13).
 *
 * Kein GameState, kein IO, kein Zufall. Angebot, Anzeige, KI, Buchung und Messskript rechnen ALLE mit diesen Funktionen
 * ("gezeigt = gebucht": eine Rechenstelle). Beträge sind C; jeder an die Kasse gehende Betrag wird auf 0,1 gerundet, und zwar so,
 * dass die Liga-Summe exakt stimmt (Methode des groessten Rests):
 *
 *   Topf          T   = F x (K_B + K_E) - Uebertrag
 *   Hauptsponsor  T_H = T - Farb-Toepfe - Treueboni
 *   Grundbetrag   x_i = T_H/32 x a_L - F x s_L x (E_i - Mittel_L(E)) + m x (Beliebtheit_i - Mittel_L)
 *                 G_i = x_i x p_i x (Summe_L x / Summe_L x p)      Summe je Liga bleibt Summe x (Passung topfneutral)
 *   Leistungsteil L_i = F x p_L x sigma x [ h_i (E_i - R_i) - Mittel_L( h_j (E_j - R_j) ) ]      Summe je Liga = 0
 *   Farb-Partner  Topf je Liga und Farbe, 40/25/15/10/5/5 % nach Farbpunkten, Gleichstand teilt
 *   Ziel          Einsatz x (2 x Erfuellung - 1), Einsatz 0 / 4 / 8 C
 */
import type { SponsorFarbe, SponsorVertragsart } from "@/lib/sponsors/sponsor-topf-typen";

// ── Stellschrauben (Konzept 4.2 bis 4.6) ───────────────────────────────────────────────────────────

export const SPONSOR_TOPF_LIGEN = [1, 2] as const;
export type SponsorLiga = (typeof SPONSOR_TOPF_LIGEN)[number];

export const SPONSOR_TOPF = {
  /** Liga-Anteil a_L (Verhaeltnis 1,25). */
  anteil: { 1: 1.11, 2: 0.89 } as Record<SponsorLiga, number>,
  /** Steigung s_L in C je Erwartungsrang ohne Kader-Ersatz (Saison 1) und mit (ab Saison 2, kappa = 1). */
  steigung: { 1: 1.2, 2: 1.0 } as Record<SponsorLiga, number>,
  /**
   * Mit Kader-Ersatz (immer, kappa = 1): gemessen nachkalibriert. Konzept 2,2 / 2,0 stand fuer ein System ohne eigene Tickets und Marketing; weil diese
   * Einnahmen mit der Staerke steigen (+4 C zwischen oberem und unterem Budget-Viertel), lag das reichste Viertel bei Erwartung 2,8 bis 7,0 C vor dem
   * aermsten (Abnahme: hoechstens +2). Die Modellrechnung auf den eingefrorenen Staenden der Laeufe A/B ergibt bei 1,8 / 1,6 im Mittel +2,0.
   */
  steigungKaderErsatz: { 1: 1.8, 2: 1.6 } as Record<SponsorLiga, number>,
  /** Marktgroesse m: C je Beliebtheitspunkt. */
  markt: 0.8,
  /** Leistungsteil: C je Platz ueber/unter Erwartung. */
  proPlatz: { 1: 3.0, 2: 2.5 } as Record<SponsorLiga, number>,
  /** sigma: in Saison 1 trifft die Erwartung schlecht. */
  sigmaSaison1: 0.5,
  /** Farb-Topf je Farbe und Liga bei F = 1 (Summe 84 C). */
  farbTopf: { 1: 12, 2: 9 } as Record<SponsorLiga, number>,
  farbAnteile: [0.4, 0.25, 0.15, 0.1, 0.05, 0.05] as readonly number[],
  /**
   * Kader-Ersatz: Anteil des Kaderwerts im Topf (Entscheidung Chris 23.11.: kappa = 1; gilt auch in Saison 1, weil der Liga-Wert schon von
   * Saison 1 auf 2 stehen bleiben soll). Gemessen (Laeufe 24.11., 32 KI-Teams, Faktor 1): die Kaufphase kostet die Liga je Saison rund 730 C
   * Wert (Kasse -1.940, Kader +1.212: der Markt zahlt mehr, als der Kader danach wert ist), das sind etwa 10 % des Kaderwerts.
   */
  kaderErsatzAnteil: 0.06,
  /**
   * Zuschlag in Saison 1: der erste Entwicklungsschritt nach der Draft-Saison schreibt den Kaderwert um rund 6 % ab (BASIS -418 C, TOPF -442 C;
   * ab Saison 2 +1 %). Damit der Liga-Wert auch von Saison 1 auf 2 stehen bleibt, traegt der Ersatz in Saison 1 diesen Betrag mit.
   */
  kaderErsatzZuschlagSaison1: 0.08,
  /** Kaderwert je Team, mit dem der VORLAEUFIGE Topf rechnet, solange es keine Kader gibt (Neues Spiel vor dem Draft; gemessen 201 bis 204 C). */
  richtwertKaderwert: 200,
  /** Bremse des Betriebsteils je Saison und Richtwert Saison 1 (32 Teams x 62 C). */
  bremse: [0.85, 1.15] as readonly [number, number],
  /**
   * Richtwert der Kosten je Team in Saison 1 (Gehalt + Unterhalt eines KI-Kaders am Stichtag, gemessen 58,3 + 0,8 C im Lauf BASIS 24.11.). Der Bezug
   * der Bremse in Saison 1 ist `Summe (Richtwert - uebrige Planeinnahmen P_i)`: er folgt damit den GEBAUTEN Posten (Tickets, Marketing, Medaillen
   * aus), statt einer festen Zahl (32 x 62 C stand fuer ein System ohne diese Posten und haette den Topf um rund 600 C zu hoch gehalten).
   */
  richtwertKostenSaison1: 59,
  /**
   * Liga-Wert-Rueckkopplung: der Topf wird um `wertRueckkopplung x (Liga-Wert heute - Liga-Wert zum Stichtag der Vorsaison)` gesenkt (waechst der
   * Wert, sinkt der Topf; schrumpft er, steigt er), die Korrektur schreibt sich fort (integrierend) und ist auf `wertKorrekturDeckel` des Topfs begrenzt.
   * 0,75 = 1 / (1 + Rueckfluss): ein Teil des Geldes kommt als Kaufphasen-Verlust ohnehin wieder heraus.
   */
  wertRueckkopplung: 0.75,
  wertKorrekturDeckel: 0.06,
  /** Uebertrag in den Topf der naechsten Saison: hoechstens dieser Anteil des Topfs. */
  uebertragDeckel: 0.03,
  /** Treuebonus im 2. und 3. Vertragsjahr in C. */
  treueBonus: [0, 1, 2] as readonly number[],
  /** Vorab-Zusage: mindestens dieser Anteil des vorlaeufigen Grundbetrags. */
  zusage: 0.9,
  /** Passung: Spanne +-5 %, Gewicht Beliebtheit 2/3, Treue 1/3. */
  passungSpanne: 0.05,
  passungGewichtBeliebtheit: 2 / 3,
  passungGewichtTreue: 1 / 3,
  /** Konjunktur: Spanne um den Grundwert. */
  konjunkturSpanne: 0.05,
  /** Planwerte der uebrigen Einnahmen: Vorstandsziele, Medaillen je Liga, Sponsorentermine (C je Team und Saison). */
  planVorstandsziele: 6.5,
  planMedaillen: { 1: 1.25, 2: 0.75 } as Record<SponsorLiga, number>,
  planTermine: 1.5,
  /** Sponsorentermin: Betrag bei Zusage, Form-Abzug des benannten Spielers, Obergrenze je Saison. */
  terminBetrag: 1.5,
  terminForm: -1,
  terminMax: 2,
} as const;

export const SPONSOR_FARBEN: readonly SponsorFarbe[] = ["pow", "spe", "men", "soc"];
export const SPONSOR_FARBE_LABEL: Record<SponsorFarbe, string> = { pow: "Power", spe: "Speed", men: "Mental", soc: "Social" };

const VERTRAGSARTEN: Record<SponsorVertragsart, { hebel: number; einsatz: number; label: string }> = {
  fest: { hebel: 0.5, einsatz: 0, label: "Festvertrag" },
  leistung: { hebel: 1, einsatz: 4, label: "Leistungsvertrag" },
  praemie: { hebel: 1.5, einsatz: 8, label: "Prämienvertrag" },
};

export const SPONSOR_VERTRAGSARTEN: readonly SponsorVertragsart[] = ["fest", "leistung", "praemie"];

export function vertragsartHebel(art: SponsorVertragsart | null | undefined): number {
  return art ? VERTRAGSARTEN[art].hebel : 1;
}
export function vertragsartZielEinsatz(art: SponsorVertragsart | null | undefined): number {
  return art ? VERTRAGSARTEN[art].einsatz : 0;
}
export function vertragsartLabel(art: SponsorVertragsart): string {
  return VERTRAGSARTEN[art].label;
}

export function runde1(wert: number): number {
  return Math.round(wert * 10) / 10;
}

/**
 * Rundet `werte` auf 0,1 so, dass die Summe genau `ziel` (auf 0,1 gerundet) ist: erst abrunden, dann die fehlenden Zehntel an die
 * groessten Reste. Deterministisch (Gleichstand: Reihenfolge der Schluessel).
 */
export function rundeMitSumme<K extends string>(werte: Record<K, number>, ziel: number): Record<K, number> {
  const schluessel = Object.keys(werte) as K[];
  const zehntel = schluessel.map((k) => werte[k] * 10);
  const unten = zehntel.map((z) => Math.floor(z + 1e-9));
  let fehlt = Math.round(ziel * 10) - unten.reduce((a, b) => a + b, 0);
  const reste = zehntel.map((z, i) => ({ i, rest: z - unten[i]! })).sort((a, b) => b.rest - a.rest || a.i - b.i);
  const ergebnis = [...unten];
  // Fehlt mehr als Teams da sind (Ziel weit weg von der Summe), verteilt der Rundlauf weiter, bis die Summe stimmt.
  for (let n = 0; fehlt > 0 && reste.length > 0; n = (n + 1) % reste.length) {
    ergebnis[reste[n]!.i]! += 1;
    fehlt -= 1;
  }
  for (let n = reste.length - 1; fehlt < 0 && reste.length > 0; n = (n - 1 + reste.length) % reste.length) {
    ergebnis[reste[n]!.i]! -= 1;
    fehlt += 1;
  }
  return Object.fromEntries(schluessel.map((k, i) => [k, ergebnis[i]! / 10 + 0])) as Record<K, number>;
}

/** Konjunktur um den Grundwert: `1 + (f - 1) x 0,24`, geklammert auf 0,95 bis 1,05. Der Faktor 1 bleibt genau 1. */
export function sponsorKonjunktur(wirtschaftsFaktor: number): number {
  if (!Number.isFinite(wirtschaftsFaktor)) return 1;
  const s = SPONSOR_TOPF.konjunkturSpanne;
  return Math.min(1 + s, Math.max(1 - s, 1 + (wirtschaftsFaktor - 1) * 0.24));
}

// ── Erwartungsrang, Passung ─────────────────────────────────────────────────────────────────────────

/**
 * Schiebt die Erwartungsraenge jeder Liga so, dass ihre Summe n(n+1)/2 ist (136 bei 16 Teams). Die Abstaende bleiben, nur der
 * Mittelwert wird auf (n+1)/2 gesetzt. Damit ist der Grundbetrag-Term ohne Rest und "alle auf Erwartungsrang" exakt Mittel 0.
 */
export function schiebeErwartungsraenge(
  roh: Record<string, number>,
  ligaVon: Record<string, SponsorLiga>,
): Record<string, number> {
  const aus: Record<string, number> = {};
  for (const liga of SPONSOR_TOPF_LIGEN) {
    const ids = Object.keys(roh).filter((id) => ligaVon[id] === liga);
    if (ids.length === 0) continue;
    const mittel = ids.reduce((s, id) => s + roh[id]!, 0) / ids.length;
    const ziel = (ids.length + 1) / 2;
    for (const id of ids) aus[id] = Math.round((roh[id]! - mittel + ziel) * 1e6) / 1e6;
  }
  return aus;
}

/** Beliebtheit des Kaders (Werbegeld der Spieler) gegen das Liga-Mittel, auf -1..1 (halbes Liga-Mittel = Anschlag). */
export function zBeliebtheit(werbegeld: number, mittel: number): number {
  if (!(mittel > 0)) return 0;
  return Math.min(1, Math.max(-1, (werbegeld / mittel - 1) / 0.5));
}

/** Treue zur Marke 0..3 Saisons auf -1..1 (1,5 Saisons = neutral). */
export function zTreue(saisons: number): number {
  const s = Math.min(3, Math.max(0, saisons));
  return (s - 1.5) / 1.5;
}

/** Die Passung eines Angebots vor der Liga-Normierung: 0,95 bis 1,05. Kein Wuerfel. */
export function passungRoh(zBel: number, zTr: number): number {
  const t = SPONSOR_TOPF;
  return 1 + t.passungSpanne * (t.passungGewichtBeliebtheit * zBel + t.passungGewichtTreue * zTr);
}

/** Treuebonus in C fuer das Vertragsjahr (1 = 0, 2 = 1, 3 = 2). */
export function treueBonus(jahr: number): number {
  return SPONSOR_TOPF.treueBonus[Math.min(3, Math.max(1, Math.round(jahr))) - 1] ?? 0;
}

// ── Der Topf und der Grundbetrag ───────────────────────────────────────────────────────────────────

export type TopfTeamEingabe = {
  teamId: string;
  liga: SponsorLiga;
  /** Erwartungsrang, geschoben (Summe je Liga n(n+1)/2). */
  erwartungsrang: number;
  beliebtheit: number;
  /** Passung vor der Normierung (0,95 bis 1,05); 1 ohne Vertrag. */
  passungRoh: number;
  /** Treuebonus dieser Saison in C. */
  treue: number;
  /** Kosten B und uebrige Planeinnahmen P (Jahr), Kaderwert W. */
  kosten: number;
  planEinnahmen: number;
  kaderwert: number;
};

export type TopfEingabe = {
  teams: TopfTeamEingabe[];
  /** Gesamtfaktor F (Grundwert x Konjunktur). */
  faktor: number;
  saison1: boolean;
  kaderErsatz: 0 | 1;
  /** K_B der Vorsaison (Bezug der Bremse); `null` in Saison 1 (Richtwert). */
  betriebsteilVorjahr: number | null;
  uebertrag: number;
  /** Fortgeschriebene Liga-Wert-Korrektur (roh, vor dem Deckel); siehe `SPONSOR_TOPF.wertRueckkopplung`. */
  wertKorrektur?: number;
  /** Untergrenze je Team (Vorab-Zusage = 90 % des vorlaeufigen Grundbetrags). */
  zusage?: Record<string, number>;
};

export type TopfTeamErgebnis = { teamId: string; x: number; passung: number; grundbetrag: number };

export type TopfErgebnis = {
  faktor: number;
  betriebsteil: number;
  betriebsteilRoh: number;
  kaderErsatz: number;
  uebertrag: number;
  /** Angewandte Liga-Wert-Korrektur (nach dem Deckel). */
  wertKorrektur: number;
  topf: number;
  hauptTopf: number;
  farbTopf: [number, number];
  treueSumme: number;
  sigma: number;
  teams: Record<string, TopfTeamErgebnis>;
};

export function topfSigma(saison1: boolean): number {
  return saison1 ? SPONSOR_TOPF.sigmaSaison1 : 1;
}

/** Bezug der Bremse in Saison 1: Summe der Richtwert-Kosten minus die geplanten uebrigen Einnahmen der Teams. */
export function richtwertSaison1(teams: ReadonlyArray<Pick<TopfTeamEingabe, "planEinnahmen">>): number {
  return teams.reduce((s, x) => s + SPONSOR_TOPF.richtwertKostenSaison1 - x.planEinnahmen, 0);
}

export function berechneTopf(e: TopfEingabe): TopfErgebnis {
  const t = SPONSOR_TOPF;
  const F = e.faktor;
  const betriebsteilRoh = e.teams.reduce((s, x) => s + (x.kosten - x.planEinnahmen), 0);
  const vor = e.betriebsteilVorjahr ?? richtwertSaison1(e.teams);
  const betriebsteil = Math.min(vor * t.bremse[1], Math.max(vor * t.bremse[0], betriebsteilRoh));
  const kaderErsatz = e.kaderErsatz === 1 ? (t.kaderErsatzAnteil + (e.saison1 ? t.kaderErsatzZuschlagSaison1 : 0)) * e.teams.reduce((s, x) => s + x.kaderwert, 0) : 0;
  const deckel = t.wertKorrekturDeckel * F * (betriebsteil + kaderErsatz);
  const wertKorrektur = Math.round(Math.min(deckel, Math.max(-deckel, e.wertKorrektur ?? 0)) * 10) / 10;
  const topf = F * (betriebsteil + kaderErsatz) - e.uebertrag - wertKorrektur;
  const farbTopf: [number, number] = [runde1(t.farbTopf[1] * F), runde1(t.farbTopf[2] * F)];
  const treueSumme = e.teams.reduce((s, x) => s + x.treue, 0);
  // Je Liga vier Farb-Toepfe (Summe fest, egal wie die Teams die Farben waehlen).
  const farbGesamt = (e.teams.some((x) => x.liga === 1) ? 4 * farbTopf[0] : 0) + (e.teams.some((x) => x.liga === 2) ? 4 * farbTopf[1] : 0);
  const hauptTopf = topf - farbGesamt - treueSumme;
  const n = e.teams.length;
  const steigung = e.kaderErsatz === 1 ? t.steigungKaderErsatz : t.steigung;

  // Rohwerte x je Team (Liga-Mittel von E und Beliebtheit zentriert: die Summe je Liga ist exakt der Liga-Anteil am Topf).
  const mittel: Record<number, { e: number; b: number; n: number }> = {};
  for (const liga of SPONSOR_TOPF_LIGEN) {
    const ids = e.teams.filter((x) => x.liga === liga);
    mittel[liga] = { n: ids.length, e: ids.reduce((s, x) => s + x.erwartungsrang, 0) / Math.max(1, ids.length), b: ids.reduce((s, x) => s + x.beliebtheit, 0) / Math.max(1, ids.length) };
  }
  const anteilSumme = e.teams.reduce((s, x) => s + t.anteil[x.liga], 0);
  const anteilMittel = anteilSumme / Math.max(1, n);
  const roh: Record<string, number> = {};
  for (const x of e.teams) {
    roh[x.teamId] =
      (hauptTopf / Math.max(1, n)) * (t.anteil[x.liga] / anteilMittel) +
      F * steigung[x.liga] * (mittel[x.liga]!.e - x.erwartungsrang) +
      t.markt * (x.beliebtheit - mittel[x.liga]!.b);
  }
  // Passung: topfneutral je Liga (Summe x bleibt Summe G).
  const grund: Record<string, number> = {};
  const passungNormiert: Record<string, number> = {};
  for (const liga of SPONSOR_TOPF_LIGEN) {
    const ids = e.teams.filter((x) => x.liga === liga);
    if (ids.length === 0) continue;
    const sx = ids.reduce((s, x) => s + roh[x.teamId]!, 0);
    const sxp = ids.reduce((s, x) => s + roh[x.teamId]! * x.passungRoh, 0);
    const passungMittel = ids.reduce((s, x) => s + x.passungRoh, 0) / ids.length;
    for (const x of ids) {
      passungNormiert[x.teamId] = passungMittel > 0 ? x.passungRoh / passungMittel : 1;
      grund[x.teamId] = Math.abs(sxp) > 1e-9 ? roh[x.teamId]! * x.passungRoh * (sx / sxp) : roh[x.teamId]!;
    }
  }
  // Auf 0,1 mit exakter Liga-Summe runden.
  const gerundet: Record<string, number> = {};
  for (const liga of SPONSOR_TOPF_LIGEN) {
    const ids = e.teams.filter((x) => x.liga === liga).map((x) => x.teamId);
    if (ids.length === 0) continue;
    const teil = Object.fromEntries(ids.map((id) => [id, grund[id]!]));
    Object.assign(gerundet, rundeMitSumme(teil, ids.reduce((s, id) => s + grund[id]!, 0)));
  }
  // Vorab-Zusage: wer unter seiner Untergrenze liegt, wird angehoben; den Fehlbetrag tragen die Teams ueber ihrer Untergrenze anteilig.
  if (e.zusage) {
    for (const liga of SPONSOR_TOPF_LIGEN) {
      const ids = e.teams.filter((x) => x.liga === liga).map((x) => x.teamId);
      hebeAufZusage(gerundet, ids, e.zusage);
    }
  }
  const teams: Record<string, TopfTeamErgebnis> = {};
  for (const x of e.teams) {
    teams[x.teamId] = { teamId: x.teamId, x: roh[x.teamId]!, passung: passungNormiert[x.teamId] ?? 1, grundbetrag: gerundet[x.teamId]! };
  }
  return { faktor: F, betriebsteil, betriebsteilRoh, kaderErsatz, uebertrag: e.uebertrag, wertKorrektur, topf, hauptTopf, farbTopf, treueSumme, sigma: topfSigma(e.saison1), teams };
}

/** Hebt Teams unter ihrer Zusage an und holt den Betrag anteilig bei den Teams ueber ihrer Zusage (Liga-Summe bleibt). */
function hebeAufZusage(g: Record<string, number>, ids: string[], zusageRoh: Record<string, number>): void {
  // Die Zusage kann nie mehr verteilen, als der Topf der Liga hergibt (die Bremse erlaubt bis 15 % weniger als vorlaeufig gerechnet, die Zusage
  // verspricht 90 %): ueberschreiten die Untergrenzen 97 % der Liga-Summe, werden sie anteilig gekuerzt, damit die Verteilung ein Gefaelle behaelt.
  const summeG = ids.reduce((a, id) => a + g[id]!, 0);
  const summeZ = ids.reduce((a, id) => a + (zusageRoh[id] ?? 0), 0);
  const lambda = summeZ > 0 ? Math.min(1, (0.97 * summeG) / summeZ) : 1;
  const zusage: Record<string, number> = lambda >= 1 ? zusageRoh : Object.fromEntries(Object.entries(zusageRoh).map(([id, z]) => [id, Math.floor(z * lambda * 10) / 10]));
  for (let runde = 0; runde < 6; runde += 1) {
    let fehl = 0;
    for (const id of ids) {
      const z = zusage[id];
      if (z != null && g[id]! < z - 1e-9) { fehl += z - g[id]!; g[id] = z; }
    }
    if (fehl < 1e-9) return;
    const spielraum = ids.map((id) => ({ id, luft: Math.max(0, g[id]! - (zusage[id] ?? 0)) })).filter((x) => x.luft > 1e-9);
    const gesamt = spielraum.reduce((s, x) => s + x.luft, 0);
    if (gesamt < 1e-9) return;
    const anteil = rundeMitSumme(
      Object.fromEntries(spielraum.map((x) => [x.id, (fehl * x.luft) / gesamt])),
      fehl,
    );
    for (const x of spielraum) g[x.id] = runde1(g[x.id]! - anteil[x.id]!);
  }
}

// ── Leistungsteil ───────────────────────────────────────────────────────────────────────────────────

export type LeistungsEingabe = { teamId: string; liga: SponsorLiga; erwartungsrang: number; rang: number; hebel: number };

/**
 * Der Leistungsteil je Team. `rang` ist der Platz in der EIGENEN Liga (aktueller Tabellenplatz je Spieltag, Endrang am Saisonende).
 * Die Liga-Summe ist exakt 0, egal wer welchen Hebel hat (Liga-Ausgleich) und auch nach dem Runden auf 0,1.
 */
export function berechneLeistungsteile(eingabe: LeistungsEingabe[], faktor: number, sigma: number): Record<string, number> {
  const aus: Record<string, number> = {};
  for (const liga of SPONSOR_TOPF_LIGEN) {
    const ids = eingabe.filter((x) => x.liga === liga);
    if (ids.length === 0) continue;
    const roh = ids.map((x) => x.hebel * (x.erwartungsrang - x.rang));
    const mittel = roh.reduce((a, b) => a + b, 0) / ids.length;
    const werte = Object.fromEntries(ids.map((x, i) => [x.teamId, faktor * SPONSOR_TOPF.proPlatz[liga] * sigma * (roh[i]! - mittel)]));
    Object.assign(aus, rundeMitSumme(werte, 0));
  }
  return aus;
}

// ── Farb-Partner ────────────────────────────────────────────────────────────────────────────────────

/**
 * Verteilt EINEN Farb-Topf (Liga x Farbe) unter den Teams, die diese Farbe unterschrieben haben, nach ihren Farbpunkten:
 * 40/25/15/10/5/5 %; Gleichstand teilt die Anteile der belegten Plaetze; bei weniger als sechs Teilnehmern werden die belegten
 * Anteile auf 100 % hochgerechnet. Die Summe ist exakt `topf` (0,1er-Raster). Ohne Teilnehmer: leer (der Topf bleibt unverteilt).
 */
export function verteileFarbTopf(topf: number, teilnehmer: Array<{ teamId: string; punkte: number }>): Record<string, number> {
  if (teilnehmer.length === 0 || !(topf > 0)) return {};
  const sortiert = [...teilnehmer].sort((a, b) => b.punkte - a.punkte || a.teamId.localeCompare(b.teamId));
  const anteile = SPONSOR_TOPF.farbAnteile;
  const belegt = anteile.slice(0, sortiert.length);
  const norm = belegt.reduce((a, b) => a + b, 0);
  const gleich = (a: number, b: number) => Math.round(a * 10000) === Math.round(b * 10000);
  const roh: Record<string, number> = {};
  let i = 0;
  while (i < sortiert.length) {
    let j = i;
    while (j + 1 < sortiert.length && gleich(sortiert[j + 1]!.punkte, sortiert[i]!.punkte)) j += 1;
    const gruppe = sortiert.slice(i, j + 1);
    const summe = belegt.slice(i, j + 1).reduce((a, b) => a + b, 0);
    for (const g of gruppe) roh[g.teamId] = (topf * summe) / norm / gruppe.length;
    i = j + 1;
  }
  return rundeMitSumme(roh, topf);
}

// ── Ziel ────────────────────────────────────────────────────────────────────────────────────────────

/** Auszahlung des Ziels: Einsatz x (2 x Erfuellung - 1). Im Mittel 0, der Rest geht in den Uebertrag. */
export function zielAuszahlung(einsatz: number, erfuellung: number): number {
  if (!(einsatz > 0)) return 0;
  return runde1(einsatz * (2 * Math.min(1, Math.max(0, erfuellung)) - 1));
}

// ── KI-Wahl (Konzept 7) ─────────────────────────────────────────────────────────────────────────────

/** Erwarteter Endrang bei Erwartungsrang E: Rueckfall zur Mitte (gemessene Steigung 0,7). */
export function erwarteterEndrang(erwartungsrang: number, ligaGroesse = 16): number {
  const mitte = (ligaGroesse + 1) / 2;
  return mitte + 0.7 * (erwartungsrang - mitte);
}

/**
 * Vertragsart der KI. Erwartungsrang 11 oder schlechter: Praemie; 4 oder besser: Fest; dazwischen entscheidet der Finanzwert
 * (ab 7 Fest, unter 4 Praemie, sonst Leistung). Eine ambitionierte Fuehrung (>= 7) verschiebt die Grenzen um einen Rang Richtung
 * Wagnis (Praemie ab 10, Fest bis 3), eine vorsichtige (<= 3) Richtung Sicherheit (Praemie ab 12, Fest bis 5).
 */
export function kiVertragsart(input: { erwartungsrang: number; finanzwert: number; ambition: number }): SponsorVertragsart {
  const verschub = input.ambition >= 7 ? -1 : input.ambition <= 3 ? 1 : 0;
  const praemieAb = 11 + verschub;
  const festBis = 4 + verschub;
  if (input.erwartungsrang >= praemieAb) return "praemie";
  if (input.erwartungsrang <= festBis) return "fest";
  if (input.finanzwert >= 7) return "fest";
  if (input.finanzwert < 4) return "praemie";
  return "leistung";
}

/** Laufzeit der KI: Finanzwert ab 6 lang, unter 4 kurz. */
export function kiLaufzeit(finanzwert: number): 1 | 2 | 3 {
  if (finanzwert >= 6) return 3;
  if (finanzwert < 4) return 1;
  return 2;
}

/** Die zwei Farben der KI: je Farbe der Staerkerang des Kaders (kleiner = besser); Gleichstand entscheidet die Farb-Identitaet. */
export function kiFarben(staerkeRang: Record<SponsorFarbe, number>, identitaetsFarbe: SponsorFarbe | null): SponsorFarbe[] {
  return [...SPONSOR_FARBEN]
    .sort((a, b) => {
      const d = staerkeRang[a] - staerkeRang[b];
      if (d !== 0) return d;
      const ia = a === identitaetsFarbe ? 0 : 1;
      const ib = b === identitaetsFarbe ? 0 : 1;
      return ia - ib || SPONSOR_FARBEN.indexOf(a) - SPONSOR_FARBEN.indexOf(b);
    })
    .slice(0, 2);
}

// ── Hochrechnung ────────────────────────────────────────────────────────────────────────────────────

/** Satz je Platz des Leistungsteils fuer ein Team: F x p_L x sigma x Hebel. */
export function leistungSatzJePlatz(liga: SponsorLiga, faktor: number, sigma: number, hebel: number): number {
  return Math.round(faktor * SPONSOR_TOPF.proPlatz[liga] * sigma * hebel * 100) / 100;
}

/** Zusammenfassung der Plan-Posten, die den Topf verdraengen (Planwerte je Team, Konzept 5.5). */
export function planMedaillen(liga: SponsorLiga): number {
  return SPONSOR_TOPF.planMedaillen[liga];
}

/**
 * Leih-Kurs einer Gebaeude-Leihe folgt der Passung statt der Seltenheit (Entscheidung 3, 23.11.): von 1,4 (Passung 0,95) bis 3,0 (1,05),
 * dieselbe Spanne wie die frueheren Seltenheitsstufen. Ein hoeherer Kurs heisst weniger Verzicht je Saison.
 */
export function leihKursFuerPassung(passungNormiert: number): number {
  const t = Math.min(1, Math.max(0, (passungNormiert - 0.95) / 0.1));
  return Math.round((1.4 + t * 1.6) * 10) / 10;
}

/** Text der Passungszeile auf der Angebotskarte: "Passung +3 % (Beliebtheit hoch, 2 Saisons Treue)". */
export function passungText(passungNormiert: number, zBel: number, treueSaisons: number): string {
  const prozent = Math.round((passungNormiert - 1) * 100);
  const vorzeichen = prozent > 0 ? "+" : prozent < 0 ? "\u2212" : "\u00b1";
  const bel = zBel > 0.34 ? "hoch" : zBel < -0.34 ? "niedrig" : "durchschnittlich";
  const treue = treueSaisons === 1 ? "1 Saison Treue" : `${treueSaisons} Saisons Treue`;
  return `Passung ${vorzeichen}${Math.abs(prozent)} % (Beliebtheit ${bel}, ${treue})`;
}
