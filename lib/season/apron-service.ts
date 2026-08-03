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
 * SAETZE UND LINIENFAKTOREN, GEMESSEN GEGEN DEN GESPIELTEN SAVE (nicht die ursprüngliche Vorgabe):
 * die Ausgangswerte (Raten 0,7 / 1,8 auf den Ueberschuss) stammen aus einer Rechnung gegen ein
 * AELTERES Sponsormodell. Gegen das AKTUELLE Modell (Sockel 18-48, Wertungstopf 1030, Boden 43 —
 * siehe sponsor-liga-leiter.ts) nachgerechnet (Save new-game-1785174792968-8d7mdx, 32 Teams,
 * Median-Gehalt ~65,7 zum gemessenen Zeitpunkt) haetten die urspruenglichen Raten bei f=1,24 ein
 * Team (Startrang 1, hohes Gehalt, aber nur mittlere GuV vor Apron) von +15,6 auf -13,6 GuV gekippt —
 * ein Bruch der Vorgabe "kein Team darf von positiv auf stark negativ kippen". Die hier stehenden,
 * auf ~55 % herabgesetzten Raten (0,4 / 1,0) halten alle drei Kriterien gleichzeitig ein (siehe
 * Messkriterien unten) und liegen bei f=1,00/1,24 nahe an der urspruenglichen Groessenordnungs-
 * Erwartung (Topf ~9 / ~52 gegen die Annahme ~10 / ~55). Miss NACH JEDER Aenderung an Median-Gehalt,
 * Wertungstopf oder Ligagroesse neu (siehe scripts/apron-messung.ts-Vorlage im PR) — die Raten sind
 * ein MESSERGEBNIS, kein Naturgesetz.
 */
import type { GameState } from "@/lib/data/olyDataTypes";
import {
  SPONSOR_V3_REFERENCE_SALARY_PER_TEAM,
  getSponsorV3LeagueSalaries,
} from "@/lib/sponsor/sponsor-v3-offer-service";
import { SPONSOR_WERTUNGSTOPF, sponsorWertungsGewichte } from "@/lib/sponsor/sponsor-liga-leiter";

export { SPONSOR_V3_REFERENCE_SALARY_PER_TEAM };

// ── Konstanten ─────────────────────────────────────────────────────────────────────────────────

/** 1. Apron-Linie = Median-Gehalt × diesen Faktor. */
export const APRON_LINE_1_MEDIAN_FACTOR = 1.1;
/** 2. Apron-Linie = Median-Gehalt × diesen Faktor. */
export const APRON_LINE_2_MEDIAN_FACTOR = 1.28;
/** Satz auf den Gehaltsüberschuss ZWISCHEN 1. und 2. Linie. Gemessen, siehe Kopfkommentar. */
export const APRON_RATE_ZONE_1 = 0.4;
/** Satz auf den Gehaltsüberschuss ÜBER der 2. Linie. Gemessen, siehe Kopfkommentar. */
export const APRON_RATE_ZONE_2 = 1.0;
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
 * Bestimmt die Apron-Linien aus dem AKTUELL gültigen Gehaltsstand des GameState. Wird zu
 * Saisonbeginn EINMAL aufgerufen und das Ergebnis eingefroren (siehe apron-settlement-service.ts) —
 * diese Funktion selbst kennt "Saisonbeginn" nicht, sie liest nur, was gerade da ist.
 *
 * Season-1/leere-Liga-Fallback: dieselbe Referenz und dieselbe Schranke, die das Sponsorsystem dafür
 * schon benutzt (`getSponsorV3LeagueSalaries` — gemessene Summe unter 25 % der erwarteten ⇒
 * Referenz `SPONSOR_V3_REFERENCE_SALARY_PER_TEAM` je Team). Keine zweite erfundene Zahl.
 */
export function computeApronLines(gameState: GameState): ApronLines {
  const { salaries, usedReference } = getSponsorV3LeagueSalaries(gameState);
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
}): ApronSettlement {
  const { line1, line2 } = input.lines;
  const k = apronKonjunkturhebel(input.salaryFactor);

  const partial = input.teams.map((team) => {
    const ueberLinie1 = Math.max(0, Math.min(team.salary, line2) - line1);
    const ueberLinie2 = Math.max(0, team.salary - line2);
    const rohAbgabe = (ueberLinie1 * APRON_RATE_ZONE_1 + ueberLinie2 * APRON_RATE_ZONE_2) * k;
    const deckel = APRON_CAP_SHARE_OF_RANK_PAYOUT * Math.max(0, team.rankShare);
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
