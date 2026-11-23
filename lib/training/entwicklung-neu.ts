/**
 * ENTWICKLUNG NEU (Chris, 22.11., docs/design/entwicklung-balance-22-11.md) -- reine Rechenbausteine.
 *
 * RUNDE 2 (22.11.): ALLES JE SPIELTAG, keine Saisonend-Rechnung mehr. Je Spieltag und Attribut gilt
 *   Delta = T (Training, Gewicht wT) + L (Leistung, Gewicht wL, mit Vorzeichen) - A (Abbau)
 * gebucht und im Trainingsverlauf gezeigt (`z` = T, `p` = L, `a` = A). Chris: Training 60 %, Leistung 40 %; ein Spieler mit dem
 * Merkmal Diligent 75 % / 25 %. Das Saisonende bucht keine Entwicklung mehr nach (nur die Potentialdrift).
 *
 * Gilt nur, wenn der Spielstand die Saison mit `seasonState.entwicklungsRegel = "neu"` gestempelt hat
 * (`lib/resolve/entwicklung-regel.ts`); jeder Aufrufer fragt `entwicklungNeuFuer(gameState)`.
 *
 * Die Zahlen sind an einem Messlauf geeicht (32 KI-Teams von Anfang an, `scripts/miss-entwicklung.ts`); die Doku nennt
 * Vorher/Nachher je Saison. Einzelne Werte ueberschreibt NUR ein Messlauf, und zwar ausdruecklich ueber
 * `setzeEntwicklungsParameterFuerMessung` (`scripts/miss-entwicklung.ts`); die Umgebung wird im Spiel nie gelesen.
 */

import { entwicklungVerteilungFuer, type EntwicklungsRegelQuelle } from "@/lib/resolve/entwicklung-regel";

export type EntwicklungsParameter = {
  /** Gewichte Training / Leistung (Chris, 22.11.: 60 / 40) und fuer Spieler mit dem Merkmal Diligent (75 / 25). */
  gewichtTraining: number;
  gewichtLeistung: number;
  gewichtTrainingDiligent: number;
  gewichtLeistungDiligent: number;
  /** Eichfaktor des Trainingsbudgets je Spieltag (gilt fuer Gewicht 0,6; bei anderem Gewicht proportional). */
  trainingsSkala: number;
  /** Eichfaktor der Leistung (gilt fuer Gewicht 0,4; bei anderem Gewicht proportional). */
  leistungsSkala: number;
  /** Eichfaktor des Abbaus je Spieltag (Grundabbau + Marktwertdruck, durch die Saisonlaenge geteilt). */
  abbauSkala: number;
  /** Grundabbau je Attribut und Saison (alt: 0,3). */
  abbauBasis: number;
  /** Faktor auf den Marktwertdruck des Abbaus: staerkere (teurere) Spieler bauen mehr ab -- gleicht, dass sie mehr Leistung buchen. */
  abbauMarktwertSkala: number;
  /** Leistung: PP-Abstand zum Liga-Median (derselben Liga, am selben Spieltag) pro Einheit, Obergrenze der Einheiten. */
  ppEinheit: number;
  zMax: number;
  /** Leistungsformel: ueber dem Median z^gamma, darunter beta * |z|^betaExponent. */
  gamma: number;
  beta: number;
  betaExponent: number;
  /**
   * Schwung (die "verstaerkende Kurve", je Spieltag statt am Saisonende): geht die Saison eines Spielers bisher in die Richtung
   * der heutigen Leistung (Netto bisher > 0 und Leistung > 0, oder beides < 0), zaehlt diese Leistung mit
   * 1 + schwungStaerke * min(schwungMax, (|Netto bisher| / schwungSumme)^schwungExponent). Daraus entstehen die wenigen starken
   * Schuebe und Einbrueche; wer kaum Netto hat, wird nicht verstaerkt (die Masse bleibt kaum veraendert).
   */
  schwungStaerke: number;
  schwungSumme: number;
  schwungExponent: number;
  schwungMax: number;
  /**
   * Obergrenze des NEGATIVEN Schwungs (gleiche Rolle wie `schwungMax`, aber fuer Einbrueche): Formkarten-Minus, Moral und Form duerfen
   * nicht ueber den Schwung zu dauerhaften Attributverlusten werden (Review 22.11.: ab Netto -5,7 galt durchgehend x10).
   */
  schwungMaxNegativ: number;
  /** Saisongrenze fuer den negativen Leistungsanteil (Summe der negativen `p` ueber alle Attribute und Spieltage, als Betrag). */
  negativSaisonGrenze: number;
  /** Der Ligafaktor des Abbaus darf sich je Spieltag um hoechstens so viel aendern. */
  ligaFaktorSchritt: number;
  /** Gewicht (in Spieltagen) der Leistungs-Erwartung aus der Vorsaison in der Prognose; mit jedem gebuchten Spieltag zaehlt die echte Saison mehr. */
  erwartungGewichtTage: number;
  /** Fokus: wer sein Trainingsziel haelt, bekommt bis zu +fokusStaerke, wer es dauernd wechselt bis zu -fokusStaerke auf das Training. */
  fokusStaerke: number;
  /** Ab so vielen Trainingstagen mit Ziel zaehlt der Fokus (davor neutral). */
  fokusMinTage: number;
};

export const ENTWICKLUNGS_PARAMETER_STANDARD: EntwicklungsParameter = {
  gewichtTraining: 0.6,
  gewichtLeistung: 0.4,
  gewichtTrainingDiligent: 0.75,
  gewichtLeistungDiligent: 0.25,
  trainingsSkala: 0.6,
  leistungsSkala: 0.9,
  abbauSkala: 1,
  abbauBasis: 0.031,
  abbauMarktwertSkala: 1.437,
  ppEinheit: 3,
  zMax: 3,
  gamma: 1.35,
  beta: 1.65,
  betaExponent: 1,
  schwungStaerke: 3.3,
  schwungSumme: 3.8,
  schwungExponent: 2.75,
  schwungMax: 3,
  schwungMaxNegativ: 0.8,
  negativSaisonGrenze: 10,
  ligaFaktorSchritt: 0.1,
  erwartungGewichtTage: 4,
  fokusStaerke: 0.5,
  fokusMinTage: 5,
};

/**
 * VERTEILUNG 10/20/40/20/10 (Chris, 23.11.; Stempel "neu2", docs/design/entwicklung-balance-22-11.md Abschnitt 9).
 *
 * Gemessen wird die Aenderung des Gesamtwerts (OVR der Trainingsseite und des Profils, `computeCurrentAbilityScore`): sie liegt je Saison bei
 * rund 0,14 x der Netto-Summe der zwoelf Attribute. Die Runde 2 (Stempel "neu") gab dort bei 81 % der Spieler eine Aenderung unter +-1; Chris will je Saison
 * 10 % deutlich besser (>= +3), 20 % etwas besser, 40 % etwa gleich, 20 % etwas schlechter, 10 % deutlich schlechter. Die Form der Runde 2 bleibt
 * (60 / 40, Schwung, Ligafaktor, Matrix nur gelesen); alle Raten wachsen um den Faktor `ENTWICKLUNGS_TEMPO_NEU2`, die Summengrenzen mit ihnen.
 * Die Spreizung innerhalb der Liga kommt aus der Trainingsguete (`trainingsGuete`), nicht aus dem Zufall.
 */
export const ENTWICKLUNGS_TEMPO_NEU2 = 3.9;

export const ENTWICKLUNGS_PARAMETER_NEU2: EntwicklungsParameter = {
  ...ENTWICKLUNGS_PARAMETER_STANDARD,
  // Training wiegt staerker als im reinen Tempo (x1,25): Training soll sich spuerbar auswirken (Chris, 23.11.); das Verhaeltnis 60 / 40 der Gewichte bleibt.
  trainingsSkala: ENTWICKLUNGS_PARAMETER_STANDARD.trainingsSkala * ENTWICKLUNGS_TEMPO_NEU2 * 1.25,
  leistungsSkala: ENTWICKLUNGS_PARAMETER_STANDARD.leistungsSkala * ENTWICKLUNGS_TEMPO_NEU2,
  abbauSkala: ENTWICKLUNGS_PARAMETER_STANDARD.abbauSkala * ENTWICKLUNGS_TEMPO_NEU2,
  // Teure Spieler geben weniger ab als im Stand 22.11. (Messung 23.11.: sonst bilden sie den halben negativen Rand allein durch den Abbau).
  abbauMarktwertSkala: 1.0,
  schwungSumme: ENTWICKLUNGS_PARAMETER_STANDARD.schwungSumme * ENTWICKLUNGS_TEMPO_NEU2,
  // Schwung: die positiven Raender kuerzer (sonst zieht ein einzelner Ausreisser die Mitte der Liga ab), der negative Rand tiefer (Ueberlastete,
  // Verletzte, Schwache sollen spuerbar absacken: Chris 23.11. ca. 10 % deutlich schlechter).
  schwungStaerke: 2.4,
  schwungMax: 2,
  schwungMaxNegativ: 1.5,
  negativSaisonGrenze: 60,
};

let parameterCache: EntwicklungsParameter | null = null;
let parameterNeu2Cache: EntwicklungsParameter | null = null;
let messUeberschreibung: Partial<EntwicklungsParameter> = {};

/**
 * NUR MESSLAEUFE (`scripts/miss-entwicklung.ts`): ueberschreibt einzelne Parameter fuer den laufenden Prozess. Das Spiel ruft das nie auf
 * und liest keine Umgebungsvariable dafuer -- die Eichung ist Code, kein Betriebs-Schalter (Review 22.11.).
 */
export function setzeEntwicklungsParameterFuerMessung(ueberschreibung: Partial<EntwicklungsParameter> | null): void {
  messUeberschreibung = ueberschreibung ?? {};
  parameterCache = null;
  parameterNeu2Cache = null;
}

export function entwicklungsParameter(): EntwicklungsParameter {
  if (parameterCache) return parameterCache;
  parameterCache = { ...ENTWICKLUNGS_PARAMETER_STANDARD, ...messUeberschreibung };
  return parameterCache;
}

/** Die Parameter der Saison: Stempel "neu2" (Verteilung, 23.11.) rechnet mit `ENTWICKLUNGS_PARAMETER_NEU2`, "neu" mit dem Stand vom 22.11. */
export function entwicklungsParameterFuer(gameState: EntwicklungsRegelQuelle): EntwicklungsParameter {
  if (!entwicklungVerteilungFuer(gameState)) return entwicklungsParameter();
  if (!parameterNeu2Cache) parameterNeu2Cache = { ...ENTWICKLUNGS_PARAMETER_NEU2, ...messUeberschreibung };
  return parameterNeu2Cache;
}

/**
 * Abnehmender Ertrag je Abstand zur Decke (h = Decke - aktueller Wert): bis 1 Punkt Abstand kaum noch Zuwachs (0,05, wie
 * bisher "capped"), ab 10 Punkten voller Satz, dazwischen stetig. Der alte Zustandsschritt (1 / 0,45 / 0,05) lag bei 5 Punkten
 * Abstand auf 0,45 -- die Kurve trifft dort 0,47 und ist ueber 5 bis 10 Punkte neu abfallend statt voll.
 */
export function ertragsFaktor(abstandZurDecke: number | null | undefined): number {
  if (abstandZurDecke == null || !Number.isFinite(abstandZurDecke)) return 1;
  if (abstandZurDecke <= 1) return 0.05;
  if (abstandZurDecke >= 10) return 1;
  return 0.05 + (0.95 * (abstandZurDecke - 1)) / 9;
}

/** Fokus-Faktor aus dem Anteil des meistgewaehlten Trainingsziels (0..1): 1 - s bei <= 0,4, 1 + s bei 1,0. */
export function fokusFaktor(dominanz: number, p: EntwicklungsParameter = entwicklungsParameter()): number {
  const t = Math.max(0, Math.min(1, (dominanz - 0.4) / 0.6));
  return 1 - p.fokusStaerke + 2 * p.fokusStaerke * t;
}

/** Gewichte Training/Leistung; `diligent` = der Spieler hat das Merkmal Diligent (75 / 25 statt 60 / 40). */
export function entwicklungsGewichte(diligent: boolean, p: EntwicklungsParameter = entwicklungsParameter()) {
  return diligent
    ? { training: p.gewichtTrainingDiligent, leistung: p.gewichtLeistungDiligent }
    : { training: p.gewichtTraining, leistung: p.gewichtLeistung };
}

/** Faktor auf das Trainingsbudget eines Spieltags: Eichung x (Gewicht / 0,6) x Fokus. */
export function trainingsBudgetFaktor(diligent: boolean, dominanz: number | null, p: EntwicklungsParameter = entwicklungsParameter()): number {
  return p.trainingsSkala * (entwicklungsGewichte(diligent, p).training / p.gewichtTraining) * (dominanz == null ? 1 : fokusFaktor(dominanz, p));
}

/** Leistung eines Spieltags in Einheiten (mit Vorzeichen) aus dem PP-Abstand zum Liga-Median. */
export function leistungsEinheit(ppAbstand: number, p: EntwicklungsParameter = entwicklungsParameter()): number {
  const z = Math.max(-p.zMax, Math.min(p.zMax, ppAbstand / p.ppEinheit));
  return z >= 0 ? Math.pow(z, p.gamma) : -p.beta * Math.pow(-z, p.betaExponent);
}

/**
 * Schwung-Multiplikator: `nettoBisher` = bisherige Netto-Entwicklung der Saison (Summe ueber die Attribute), `leistung` = heutige Leistung.
 * Der positive Schwung ist bis `schwungMax`, der negative nur bis `schwungMaxNegativ` offen.
 */
export function schwungFaktor(nettoBisher: number, leistung: number, p: EntwicklungsParameter = entwicklungsParameter()): number {
  if (leistung === 0 || nettoBisher === 0 || Math.sign(nettoBisher) !== Math.sign(leistung)) return 1;
  const obergrenze = leistung < 0 ? p.schwungMaxNegativ : p.schwungMax;
  return 1 + p.schwungStaerke * Math.min(obergrenze, Math.pow(Math.abs(nettoBisher) / p.schwungSumme, p.schwungExponent));
}

/** Faktor auf die Leistung eines Spieltags: Eichung x (Gewicht / 0,4). Der Schwung kommt je Spieltag dazu (`schwungFaktor`). */
export function leistungsFaktor(diligent: boolean, p: EntwicklungsParameter = entwicklungsParameter()): number {
  return p.leistungsSkala * (entwicklungsGewichte(diligent, p).leistung / p.gewichtLeistung);
}
