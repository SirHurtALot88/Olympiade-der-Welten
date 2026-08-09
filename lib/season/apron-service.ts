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
 * Mehrausgabe treffen, nicht Buchungstechnik. FOLGE, gemessen: ein Team KANN trotzdem eine echte
 * Vertragssumme weit über der Linie haben, während seine geglättete Zahl nur knapp darüber liegt
 * (Save-Beispiel Z-H: 97,7 echt gegen 83,3 geglättet).
 *
 * SAETZE UND LINIENFAKTOREN, GEMESSEN GEGEN DEN GESPIELTEN SAVE (nicht die ursprüngliche Vorgabe):
 * ENDGÜLTIGE ENTSCHEIDUNG (Nutzer, nach drei Kalibrierungsrunden — siehe scripts/apron-kalibrierung.ts
 * und PR #368 für die vollständige Herleitung): die 2. Linie rückt von × 1,28 auf × 1,25 näher an die
 * 1. Linie heran, die Sätze steigen von den ursprünglich vorgegebenen 0,7 / 1,8 auf 0,8 / 1,6. Eine
 * erste Kalibrierungsrunde hatte gegen ein Kriterium "kein Team unter etwa −5 GuV" auf 0,2 / 0,45
 * herabgerechnet — das Kriterium wurde ausdrücklich AUFGEHOBEN: ein Team, das die Liga um rund ein
 * Drittel überzahlt, SOLL das im Ergebnis spüren — das ist der Sinn des Gummibands, keine
 * Fehlkalibrierung. Eine zweite Runde (1,10 / 1,20 / 0,7 / 1,8) konzentrierte die Last zu stark auf
 * die zwei Extremzahler (53 % des Topfes); die hier stehende Kombination — 2. Linie etwas weiter
 * aussen (1,25 statt 1,20), dafür ein höherer erster Satz (0,8 statt 0,7) und ein niedrigerer zweiter
 * (1,6 statt 1,8) — verlagert die Last von den Extremzahlern auf die breitere Gruppe: die
 * Spitzenzahler geben je rund 3,5 weniger ab, die fünf mittleren Zahler je etwa 0,5 mehr, der Anteil
 * der beiden größten Zahler am Topf fällt auf 47 %, der Topf selbst schrumpft dabei nur um 8 %. Die
 * Abgabekurve wird flacher statt einem Sprung von 4 auf 20 zahlende Teams zu folgen.
 *
 * Gegen den gespielten Save (new-game-1785174792968-8d7mdx, Median [geglättet] 63,2, Linien
 * 69,5 / 79,0) ergibt das bei f=1,00/1,10/1,24 einen Topf von 11,3 / 33,9 / 65,6 bei 12 von 32
 * zahlenden Teams (nicht die halbe Liga) und einem Ausgleich von 0,6 / 1,7 / 3,3 je Empfänger (an 20
 * Empfänger) — vollständig gegengerechnet mit `scripts/apron-kalibrierung.ts --guv-basis recorded`,
 * das die AUFGEZEICHNETE Ist-GuV des Saves als Baseline nutzt (nicht eine Neuberechnung). Der Deckel
 * (Hälfte des Wertungsanteils) GREIFT bei den in diesem Save vorkommenden Rangverteilungen NIE — er
 * ist eine Sicherung für einen Randfall (Großverdiener stürzt trotzdem auf einen schlechten Rang),
 * nicht der Hebel, der die Abgabenhöhe im Alltag bestimmt. Miss NACH JEDER Änderung an Median-Gehalt,
 * Wertungstopf, Sockelfächer oder Ligagröße neu — die Werte sind ein MESSERGEBNIS, kein Naturgesetz.
 */
import type { GameState } from "@/lib/data/olyDataTypes";
import { SPONSOR_V3_REFERENCE_SALARY_PER_TEAM } from "@/lib/sponsor/sponsor-v3-offer-service";
import { getTeamDisplaySalaryTotal } from "@/lib/sponsor/sponsor-team-salary-display";
import { SPONSOR_WERTUNGSTOPF, sponsorWertungsGewichte } from "@/lib/sponsor/sponsor-liga-leiter";

export { SPONSOR_V3_REFERENCE_SALARY_PER_TEAM };

// ── Konstanten ─────────────────────────────────────────────────────────────────────────────────

/** 1. Apron-Linie = Median-Gehalt × diesen Faktor. */
export const APRON_LINE_1_MEDIAN_FACTOR = 1.1;
/** 2. Apron-Linie = Median-Gehalt × diesen Faktor. Bewusst nah an der 1. Linie (siehe Kopfkommentar). */
export const APRON_LINE_2_MEDIAN_FACTOR = 1.25;
/** Satz auf den Gehaltsüberschuss ZWISCHEN 1. und 2. Linie. Gemessen, siehe Kopfkommentar. */
export const APRON_RATE_ZONE_1 = 0.8;
/** Satz auf den Gehaltsüberschuss ÜBER der 2. Linie. Gemessen, siehe Kopfkommentar. */
export const APRON_RATE_ZONE_2 = 1.6;
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

// ── Wann die Linien endgültig sind ─────────────────────────────────────────────────────────────

/**
 * Hat die laufende Saison schon STATTGEFUNDEN — ist also mindestens ein Spieltag abgerechnet?
 *
 * Zwei Zeugen, weil beide getrennt geschrieben werden und ein reparierter Spielstand den einen
 * verlieren kann, ohne den anderen: das Spieltag-Ergebnis und die Tabellen-Buchung. Der aktive
 * Spieltag TAUGT NICHT als Signal — `matchdayState.matchdayId` steht schon auf Spieltag 1, bevor
 * irgendetwas gespielt wurde (auf Chris' Save standen so 106 Zugänge unter „Spieltag 1", bei null
 * Ergebnissen).
 */
export function hasSeasonBeenPlayed(gameState: GameState): boolean {
  const seasonId = gameState.season.id;
  const hatErgebnis = (gameState.seasonState.matchdayResults ?? []).some(
    (result) => result.seasonId === seasonId,
  );
  const hatTabellenbuchung = (gameState.seasonState.standingsApplyLogs ?? []).some(
    (log) => log.seasonId === seasonId,
  );
  return hatErgebnis || hatTabellenbuchung;
}

/**
 * DIE LINIEN, DIE GERADE GELTEN — die einzige Stelle, die das entscheidet.
 *
 * Solange nicht gespielt wurde, wandern sie mit dem Median mit; ab dem ersten abgerechneten
 * Spieltag gilt der eingefrorene Stand.
 *
 * WARUM ÜBERHAUPT MITWANDERN: Der Kopfkommentar dieser Datei nennt es als Kern des Entwurfs — die
 * Linien hängen am Median und nicht an einer festen Zahl, „damit die Linien mitwandern, wenn die
 * ganze Liga aufrüstet". Der Einfrier-Schritt lief bislang am Ende des Saisonübergangs, also BEVOR
 * der Kaderbau der neuen Saison überhaupt begann. Auf Chris' Spielstand lagen zwischen dem
 * Einfrieren (06:05:23) und dem ersten Zugang 99 Sekunden; danach kamen ALLE 106 Zugänge der Saison
 * über 717,5 Mio Gehalt. Der Median sprang von 45,0 auf 69,8 — die eingefrorene 2. Linie stand bei
 * 56,2, und 28 von 32 Teams lagen darüber. Eine Grenze, die fast jeder reißt, unterscheidet nichts
 * mehr; die Abrechnung hätte 29 Zahler mit zusammen 587,4 Mio getroffen.
 *
 * WARUM TROTZDEM EINFRIEREN: Die ursprüngliche Sorge bleibt richtig — man darf nicht gegen eine
 * Grenze kaufen, die sich durch die eigenen Käufe verschiebt. Nur gilt das für die laufende Saison,
 * nicht für die Aufbauphase davor. Ab dem ersten Spieltag steht die Grenze fest.
 */
export function resolveSeasonApronLines(gameState: GameState): ApronLines {
  const snapshot = gameState.seasonState.apronLinesSnapshot;
  const passtZurSaison = snapshot?.seasonId === gameState.season.id;
  if (passtZurSaison && snapshot && hasSeasonBeenPlayed(gameState)) {
    return snapshot;
  }
  return computeApronLines(gameState);
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
  /**
   * Empfangsberechtigt, also unter der 1. Linie. Nicht aus `ausgleich > 0` ableitbar: Sammelt in
   * einer Saison niemand etwas ein, ist der Anteil 0 und ein Empfänger wäre von einem Zahler ohne
   * Abgabe nicht mehr zu unterscheiden. Der Liga-Ausweis auf der Finanzenseite trennt beide.
   */
  istEmpfaenger: boolean;
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

  const empfaenger = partial.filter((row) => row.salary < line1);
  const empfaengerIds = new Set(empfaenger.map((row) => row.teamId));

  // Liegt KEIN Team unter der 1. Linie, wird auch nichts eingesammelt. Der Apron verteilt um; er
  // vernichtet kein Geld. Vorher floss die Abgabe in diesem Fall ersatzlos aus der Liga heraus —
  // ein stiller Kapitalabfluss, den niemand bestellt hat. Mit Linien, die erst nach dem Kaderbau
  // einrasten, ist der Fall ohnehin fast unmoeglich: Der Median trennt die Liga, es liegt also
  // immer mindestens die Haelfte darunter. Er bleibt trotzdem definiert.
  const topf = empfaenger.length > 0 ? partial.reduce((sum, row) => sum + row.abgabe, 0) : 0;
  const anteil = empfaenger.length > 0 ? topf / empfaenger.length : 0;

  const rows: ApronTeamRow[] = partial.map((row) => {
    const istEmpfaenger = empfaengerIds.has(row.teamId);
    const ausgleich = istEmpfaenger ? anteil : 0;
    const abgabe = empfaenger.length > 0 ? row.abgabe : 0;
    return { ...row, abgabe, ausgleich, istEmpfaenger, nettoDelta: ausgleich - abgabe };
  });

  return {
    rows,
    topf,
    zahlerCount: rows.filter((row) => row.abgabe > 0).length,
    empfaengerCount: empfaenger.length,
  };
}
