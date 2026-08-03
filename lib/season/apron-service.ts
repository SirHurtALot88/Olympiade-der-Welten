/**
 * APRON-SERVICE — ein Gummiband gegen "Reich wird reicher".
 *
 * Vorbild ist der NBA-Apron, angepasst an ein Spiel ohne Paarungen und ohne Heimspiele (32 Teams
 * treten gemeinsam an, 10 Spieltage): wer deutlich mehr fuer Gehaelter ausgibt als die Liga, gibt
 * einen Teil ab; der Topf geht an die sparsamen Teams. Zwei Linien am MEDIAN-Gehalt der Liga — nicht
 * an einer festen Zahl, damit die Linien mitwandern, wenn die ganze Liga aufruestet. Bestraft wird
 * nur, MEHR als die anderen auszugeben.
 *
 * REINE ARITHMETIK: kein Zustand, keine Zufallsquelle, keine IO (bis auf die eine GameState-lesende
 * Funktion `computeApronLines`, die die Liga-Gehaltssumme braucht). Die eigentliche Anwendung
 * (Cash-Aenderungen schreiben, Ledger fuehren) lebt in `lib/season/apron-settlement-service.ts`.
 *
 * BEMESSUNGSGRUNDLAGE: `getTeamDisplaySalaryTotal` (geglättet, `contract.expectedSalary`) — DIESELBE
 * Zahl, die die Sponsorenübersicht als "Gehälter" zeigt, NICHT die echte, front-/back-loaded
 * Vertragssumme (`resolvePlayerEconomyContract().salary`, wie sie `applySponsorSettlement` beim
 * Gehaltsabzug real bucht). Bewusst so, aus zwei Gründen: (1) die geglättete Zahl ist genau das, was
 * ein Team in der UI als seine Gehaltslast sieht — die Apron-Badges müssen gegen dieselbe Zahl
 * rechnen, sonst zeigt die Zeile eine Warnung, die der daneben stehende Betrag nicht erklärt. (2) sie
 * glättet gerade die Front-/Back-Loading-Spitzen weg, die sonst ein Team allein durch die zeitliche
 * Verteilung seiner Vertragsraten über oder unter die Linie schieben würden — der Apron soll echte
 * Mehrausgabe treffen, nicht Buchungstechnik. FOLGE, gemessen (siehe unten): ein Team KANN trotzdem
 * eine echte Vertragssumme weit über der Linie haben, während seine geglättete Zahl nur knapp
 * darüber liegt (Save-Beispiel Z-H: 97,7 echt gegen 83,3 geglättet) — DAS ist der Fall, gegen den die
 * Raten unten kalibriert sind, nicht der Regelfall.
 *
 * SAETZE UND LINIENFAKTOREN, GEMESSEN GEGEN DEN GESPIELTEN SAVE (nicht die ursprüngliche Vorgabe):
 * die Ausgangswerte (Raten 0,7 / 1,8 auf den Ueberschuss) stammen aus einer Rechnung gegen ein
 * AELTERES Sponsormodell. Gegen das AKTUELLE Modell (Sockel 18-48, Wertungstopf 1030, Boden 43 —
 * siehe sponsor-liga-leiter.ts) nachgerechnet (Save new-game-1785174792968-8d7mdx, 32 Teams,
 * Median-Gehalt [geglättet] 63,2) waeren SELBST die stark reduzierten 0,4/1,0 einer ersten
 * Nachmessung noch zu hoch gewesen: das Team Z-H (Rang 5, GuV vor Apron nur −1,4 — sein Gehalt ist
 * ECHT weit ueber der Linie, aber GEGLAETTET nur knapp drueber) waere bei f=1,24 auf −8,4 GuV
 * gedrueckt worden — mehr als die vom Reviewer gesetzte Grenze "keine ABGABE drueckt ein gesundes
 * Team (GuV vor Apron > −5) unter etwa −5". Die hier stehenden Raten (0,2 / 0,45) sind das Ergebnis
 * einer Rastersuche ueber Ratenpaare GEGEN GENAU DIESES KRITERIUM (Skript-Vorlage im PR): der
 * groesstmoegliche Topf, bei dem KEIN gesundes Team durch die Abgabe unter −5 GuV faellt (Z-H bleibt
 * bei −4,8..−5,0, je nach Salary Factor). Der Deckel (Haelfte des Wertungsanteils) GREIFT DABEI NIE —
 * bei den in diesem Save vorkommenden Rangverteilungen ist der Wertungsanteil selbst der Topteams
 * immer gross genug, dass die Abgabe darunter bleibt. Er ist damit eine Sicherung fuer einen
 * Randfall (ein Grossverdiener, der trotzdem auf einen schlechten Rang faellt), nicht der Hebel, der
 * die Hoehe der Abgabe im Alltag bestimmt — das sind ausschliesslich die beiden Raten hier. Miss NACH
 * JEDER Aenderung an Median-Gehalt, Wertungstopf oder Ligagroesse neu — die Raten sind ein
 * MESSERGEBNIS, kein Naturgesetz, und mit ihnen bleibt der Ausgleich je Empfaenger bewusst moderat
 * (rund 1,5 % der Fixkosten eines Empfaengers bei f=1,24 in diesem Save) statt spuerbar gross — DAS
 * ist der Preis dafuer, dass ein einzelnes fragiles Team (Z-H) nicht unter die Raeder kommt. Erlaubt
 * die Gehaltsverteilung einer kuenftigen Saison groessere Raten (kein Team so nah an −5 vor Apron),
 * gehoert das hierher neu gemessen und die Raten entsprechend angehoben.
 */
import type { GameState } from "@/lib/data/olyDataTypes";
import { SPONSOR_V3_REFERENCE_SALARY_PER_TEAM } from "@/lib/sponsor/sponsor-v3-offer-service";
import { getTeamDisplaySalaryTotal } from "@/lib/sponsor/sponsor-team-salary-display";
import { SPONSOR_WERTUNGSTOPF, sponsorWertungsGewichte } from "@/lib/sponsor/sponsor-liga-leiter";

export { SPONSOR_V3_REFERENCE_SALARY_PER_TEAM };

// ── Konstanten ─────────────────────────────────────────────────────────────────────────────────

/** 1. Apron-Linie = Median-Gehalt × diesen Faktor. */
export const APRON_LINE_1_MEDIAN_FACTOR = 1.1;
/** 2. Apron-Linie = Median-Gehalt × diesen Faktor. */
export const APRON_LINE_2_MEDIAN_FACTOR = 1.28;
/** Satz auf den Gehaltsüberschuss ZWISCHEN 1. und 2. Linie. Gemessen, siehe Kopfkommentar. */
export const APRON_RATE_ZONE_1 = 0.2;
/** Satz auf den Gehaltsüberschuss ÜBER der 2. Linie. Gemessen, siehe Kopfkommentar. */
export const APRON_RATE_ZONE_2 = 0.45;
/** Deckel: höchstens dieser Anteil des rangabhängigen Sponsor-Wertungsanteils. */
export const APRON_CAP_SHARE_OF_RANK_PAYOUT = 0.5;
/** Konjunkturhebel: 0 bei salaryFactor <= diesem Wert. */
export const APRON_KONJUNKTUR_FACTOR_MIN = 0.95;
/** Konjunkturhebel: 1 bei salaryFactor >= diesem Wert. */
export const APRON_KONJUNKTUR_FACTOR_MAX = 1.24;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2 : (sorted[mid] ?? 0);
}

// ── Konjunkturhebel ────────────────────────────────────────────────────────────────────────────

/**
 * k(f) = clamp((f − 0,95) / 0,29, 0, 1). Unter 0,95 gar keine Abgabe, bei 1,24 die volle.
 *
 * GRUND: die Gehälter stehen fest, wenn die Konjunktur der Saison gewürfelt wird (Salaries werden im
 * Preseason-/Draft-Fenster festgezurrt, der Salary Factor erst danach). Der Gehaltsüberschuss über
 * den Linien wäre in einer schwachen Saison (niedriges f) rechnerisch derselbe wie in einer starken —
 * ohne den Hebel schmerzte die Abgabe also genau dann am meisten, wenn ohnehin niemand Geld hat. Der
 * Hebel bindet die Abgabe an die tatsächliche wirtschaftliche Lage der Saison statt an eine im
 * Voraus fixierte Gehaltszahl.
 */
export function apronKonjunkturhebel(salaryFactor: number): number {
  if (!Number.isFinite(salaryFactor)) return 0;
  return clamp01((salaryFactor - APRON_KONJUNKTUR_FACTOR_MIN) / (APRON_KONJUNKTUR_FACTOR_MAX - APRON_KONJUNKTUR_FACTOR_MIN));
}

// ── Eingefrorene Linien ────────────────────────────────────────────────────────────────────────

export type ApronLines = {
  medianSalary: number;
  line1: number;
  line2: number;
  usedReferenceSalary: boolean;
};

/**
 * Dieselbe Frisch-Save-Schranke wie `getSponsorV3LeagueSalaries` (Sponsorsystem), nur auf der
 * GEGLÄTTETEN Gehaltszahl (`getTeamDisplaySalaryTotal`) statt der echten — siehe Kopfkommentar,
 * warum der Apron geglättet rechnet. Schwelle und Referenzwert sind dieselben, keine zweite
 * erfundene Zahl: gemessene Summe unter 25 % der erwarteten (32 × Referenz) ⇒ Referenz je Team.
 */
function getLeagueDisplaySalaries(gameState: GameState): { salaries: number[]; usedReference: boolean } {
  const measured = gameState.teams.map((team) => getTeamDisplaySalaryTotal(gameState, team.teamId));
  const teamCount = Math.max(1, measured.length);
  const measuredSum = measured.reduce((sum, value) => sum + value, 0);
  if (measuredSum >= teamCount * SPONSOR_V3_REFERENCE_SALARY_PER_TEAM * 0.25) {
    return { salaries: measured, usedReference: false };
  }
  return { salaries: measured.map(() => SPONSOR_V3_REFERENCE_SALARY_PER_TEAM), usedReference: true };
}

/**
 * Bestimmt die Apron-Linien aus dem AKTUELL gültigen Gehaltsstand des GameState. Wird zu
 * Saisonbeginn EINMAL aufgerufen und das Ergebnis eingefroren (siehe apron-settlement-service.ts) —
 * diese Funktion selbst kennt "Saisonbeginn" nicht, sie liest nur, was gerade da ist.
 *
 * Season-1/leere-Liga-Fallback: dieselbe Referenz und dieselbe Schranke, die das Sponsorsystem dafür
 * schon benutzt (gemessene Summe unter 25 % der erwarteten ⇒ Referenz `SPONSOR_V3_REFERENCE_SALARY_PER_TEAM`
 * je Team). Keine zweite erfundene Zahl.
 */
export function computeApronLines(gameState: GameState): ApronLines {
  const { salaries, usedReference } = getLeagueDisplaySalaries(gameState);
  const medianSalary = median(salaries);
  return {
    medianSalary: round1(medianSalary),
    line1: round1(medianSalary * APRON_LINE_1_MEDIAN_FACTOR),
    line2: round1(medianSalary * APRON_LINE_2_MEDIAN_FACTOR),
    usedReferenceSalary: usedReference,
  };
}

// ── Wertungsanteil (für den Deckel) ────────────────────────────────────────────────────────────

const WERTUNGS_GEWICHTE = sponsorWertungsGewichte();
const WERTUNGS_GEWICHTE_SUMME = WERTUNGS_GEWICHTE.reduce((sum, value) => sum + value, 0);

/**
 * Der rangabhängige Teil des Sponsors dieses Teams — reine Endrang-Funktion aus
 * sponsor-liga-leiter.ts (SPONSOR_WERTUNGSTOPF × Rang-Gewicht), UNABHÄNGIG von Startrang, Kurvenform
 * oder ob überhaupt ein Vertrag unterschrieben ist. Das macht den Deckel robust: er braucht keinen
 * signierten Sponsorvertrag, um zu greifen (wichtig für KI-Teams vor der Sponsorwahl und für
 * Messungen gegen bereits abgerechnete Saisons).
 *
 * `finalRank` ist der ENDRANG, nicht der Startrang: der Apron läuft am Saisonende (siehe
 * apron-settlement-service.ts — nach der Sponsor-Abrechnung, die zu diesem Zeitpunkt bereits mit der
 * finalen, ggf. formkarten-bestraften Tabelle rechnet), also ist der Endrang zu diesem Zeitpunkt die
 * einzig sinnvolle Größe. Der Startrang bestimmt stattdessen den SOCKEL des Sponsors
 * (`sponsorSockelFuerStartrang`) — beide Ränge messen bewusst Verschiedenes und werden hier nicht
 * vermischt.
 */
export function apronWertungsanteil(finalRank: number, salaryFactor: number): number {
  const league = WERTUNGS_GEWICHTE.length;
  const rank = Math.max(1, Math.min(league, Math.round(Number.isFinite(finalRank) ? finalRank : league)));
  const gewicht = WERTUNGS_GEWICHTE[rank - 1] ?? 0;
  const factor = Number.isFinite(salaryFactor) && salaryFactor > 0 ? salaryFactor : 1;
  return (SPONSOR_WERTUNGSTOPF * factor * gewicht) / WERTUNGS_GEWICHTE_SUMME;
}

// ── Abgaben und Ausgleiche ─────────────────────────────────────────────────────────────────────

export type ApronTeamInput = {
  teamId: string;
  /** Gehaltssumme des Teams (Bemessungsgrundlage). */
  salary: number;
  /** Rangabhängiger Sponsor-Wertungsanteil dieses Teams (siehe apronWertungsanteil) — Basis des Deckels. */
  rankShare: number;
};

export type ApronTeamRow = ApronTeamInput & {
  /** Gehaltsanteil in der Zone zwischen 1. und 2. Linie. */
  ueberLinie1: number;
  /** Gehaltsanteil über der 2. Linie. */
  ueberLinie2: number;
  /** Abgabe vor dem Deckel. */
  rohAbgabe: number;
  /** Deckel: höchstens die Hälfte von rankShare. */
  deckel: number;
  /** Tatsächliche Abgabe = min(rohAbgabe, deckel), nie negativ. */
  abgabe: number;
  /** Anteil am ausgeschütteten Topf (nur Teams unter der 1. Linie). */
  ausgleich: number;
  /** ausgleich − abgabe. */
  nettoDelta: number;
};

export type ApronSettlement = {
  rows: ApronTeamRow[];
  topf: number;
  zahlerCount: number;
  empfaengerCount: number;
};

/**
 * Bemessen wird der GEHALTSÜBERSCHUSS: der Teil zwischen 1. und 2. Linie zum ersten Satz, alles über
 * der 2. Linie zum zweiten. Der Deckel begrenzt die Abgabe auf höchstens die Hälfte dessen, was das
 * Team selbst aus dem Wertungstopf bekommen hat — wer viel zahlt und trotzdem hinten landet, wird
 * nicht zusätzlich ausgenommen. Die Ausschüttung geht zu GLEICHEN TEILEN an alle Teams STRENG UNTER
 * der 1. Linie (ein Team GENAU auf der Linie zahlt nichts UND bekommt nichts — Grenzfall bewusst
 * neutral).
 *
 * Bewusst UNGERUNDET bis zum Schluss: eine Rundung je Team würde die Erhaltung (Σ Abgaben = Σ
 * Ausgleiche) verletzen. Rundung passiert erst beim Schreiben der echten Cash-Änderung
 * (apron-settlement-service.ts), so wie an jeder anderen Cash-Schreibstelle im Spiel.
 */
export function computeApronSettlement(input: {
  lines: Pick<ApronLines, "line1" | "line2">;
  salaryFactor: number;
  teams: readonly ApronTeamInput[];
  /**
   * Überschreibt die Sätze/den Deckelanteil für DIESEN Aufruf — ausschließlich für Kalibrierung
   * (siehe scripts/apron-kalibrierung.ts), die Ratenpaare gegeneinander messen muss, ohne die
   * Modul-Konstanten (und damit die echte Abrechnung) anzufassen. Default: die aktuellen,
   * gemessenen Modul-Konstanten — jeder andere Aufrufer lässt diese Felder weg und bekommt exakt
   * das bisherige Verhalten.
   */
  rateZone1?: number;
  rateZone2?: number;
  capShareOfRankPayout?: number;
}): ApronSettlement {
  const { line1, line2 } = input.lines;
  const k = apronKonjunkturhebel(input.salaryFactor);
  const rateZone1 = input.rateZone1 ?? APRON_RATE_ZONE_1;
  const rateZone2 = input.rateZone2 ?? APRON_RATE_ZONE_2;
  const capShareOfRankPayout = input.capShareOfRankPayout ?? APRON_CAP_SHARE_OF_RANK_PAYOUT;

  const partial = input.teams.map((team) => {
    const ueberLinie1 = Math.max(0, Math.min(team.salary, line2) - line1);
    const ueberLinie2 = Math.max(0, team.salary - line2);
    const rohAbgabe = (ueberLinie1 * rateZone1 + ueberLinie2 * rateZone2) * k;
    const deckel = capShareOfRankPayout * Math.max(0, team.rankShare);
    const abgabe = Math.max(0, Math.min(rohAbgabe, deckel));
    return { ...team, ueberLinie1, ueberLinie2, rohAbgabe, deckel, abgabe };
  });

  const topf = partial.reduce((sum, row) => sum + row.abgabe, 0);
  const empfaenger = partial.filter((row) => row.salary < line1);
  const anteil = empfaenger.length > 0 ? topf / empfaenger.length : 0;
  const empfaengerIds = new Set(empfaenger.map((row) => row.teamId));

  const rows: ApronTeamRow[] = partial.map((row) => {
    const ausgleich = empfaengerIds.has(row.teamId) ? anteil : 0;
    return { ...row, ausgleich, nettoDelta: ausgleich - row.abgabe };
  });

  return {
    rows,
    topf,
    zahlerCount: rows.filter((row) => row.abgabe > 0).length,
    empfaengerCount: empfaenger.length,
  };
}
