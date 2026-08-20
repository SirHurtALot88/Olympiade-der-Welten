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
 * BEMESSUNGSGRUNDLAGE: `getTeamActualSalaryTotal` — die REAL in DIESER Saison zu zahlende
 * Gehaltssumme, also `yearlySalarySchedule[0]` je Vertrag (das Feld, das
 * `resolvePlayerEconomyContract().salary` liefert und das die Saisonende-Abrechnung wirklich
 * abbucht). Nicht das Formel-Gehalt aus Marktwert/Attributen, und seit dem 13.08.2026 auch nicht
 * mehr das bei Unterschrift verhandelte Jahresgehalt.
 *
 * WARUM ZWEIMAL UMGESTELLT — die Meldungen bauen aufeinander auf:
 *
 *   1. Das FORMEL-Gehalt hing weder an der Verhandlung noch an der Form. Ein Team, das seinen
 *      ganzen Kader 10 % unter Formel verhandelte, zahlte trotzdem die volle Abgabe (Cold Steel:
 *      3,18 Abgabe bei einer echten Gehaltssumme von 63,6 unter der ersten Linie von 76,8).
 *   2. Das VERHANDELTE Jahresgehalt behob das, blieb aber eine GEGLAETTETE Groesse: es ist der
 *      Durchschnitt ueber die Laufzeit, nicht das, was in diesem Jahr vom Konto geht. Chris:
 *      „Apron ist noch falsch, das sollte doch umgestellt sein auf die REAL zu zahlende summe des
 *      jahres nach vertrag und nicht geglättet." Besteuert wird ab hier, was man in dieser Saison
 *      wirklich zahlt.
 *
 * DAMIT IST DIE FRUEHERE ANTI-GAMING-ZUSAGE AUSDRUECKLICH AUFGEHOBEN. Sie lautete „ein Formwechsel
 * aendert die Apron-Abgabe um 0,00" und hing genau daran, dass die Basis formunabhaengig war. Die
 * Jahreszahlung ist es nicht: `front_loaded` hebt die Basis dieser Saison, `back_loaded` senkt sie.
 * Das ist die gewollte Folge der Entscheidung — und es ist ein VERSCHIEBEN, kein Vermeiden: der
 * Apron wird jede Saison neu abgerechnet, und was `back_loaded` heute spart, faellt in den
 * Folgejahren an, wenn die Rate steigt. Der Waechter-Test misst jetzt genau diese neue Regel
 * (`tests/apron-faktor-horizont-und-vertragsform.test.ts`), statt die alte zu behaupten.
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
import { teamHasFormCardPool } from "@/lib/foundation/form-card-flow";
import { SPONSOR_V3_REFERENCE_SALARY_PER_TEAM } from "@/lib/sponsor/sponsor-v3-offer-service";
import { getTeamActualSalaryTotal } from "@/lib/sponsor/sponsor-team-salary-display";
import { SPONSOR_WERTUNGSTOPF, sponsorWertungsGewichte } from "@/lib/sponsor/sponsor-liga-leiter";
import {
  SEASON_ECONOMY_FACTOR_WINDOW_SIZE,
  getSeasonEconomyFactorWindow,
  isBeforeSeasonEconomyFactorAdvance,
} from "@/lib/season/season-economy-factors";

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
/**
 * Konjunkturhebel: 0 bei salaryFactor <= diesem Wert.
 *
 * 0,95 → 0,88, CHRIS' ENTSCHEIDUNG zu Meldung `6fv43h` („Apron scheint nicht korrekt zu ziehen!
 * M-M hat Gehalt 123,5 Mio und die 2. Linie ist 67,3 Mio! Die müssten fast 60 mio Strafe zahlen!"),
 * Weg 1 von dreien: die Schwelle senken.
 *
 * DER BEFUND, der dahin führte: der Salary Factor bewegt sich zwischen 0,82 und 1,24. Mit der
 * Schwelle bei 0,95 war der Apron über das gesamte untere Drittel dieser Spanne KOMPLETT
 * wirkungslos — nicht gedämpft, aus. In Chris' Saison stand `f` bei 0,96, also `k = 0,03`: elf
 * Teams über der Linie zahlten zusammen 5,4.
 *
 * DURCHGEMESSEN über alle sieben Live-Spielstände, laufende und kommende Saison (14 Beobachtungen,
 * `scripts/messe-apron-schwelle.ts`) — die Schwelle entscheidet NICHT, wer zahlt (das tun die
 * Linien), sondern wie viel:
 *
 *   Schwelle        0,95   0,92   0,88   0,85   0,82
 *   hwz8fk f=0,96    5,4   19,6   34,9   44,3   52,3     ← der gemeldete Spielstand
 *   n90y4m f=0,92    0,0    0,0    4,7    7,6    9,9
 *   1hf25q f=0,87    0,0    0,0    0,0    4,4   10,3
 *   hwz8fk f=1,16   91,8   93,4   95,1   96,1   97,0     ← Boomsaison, kaum Bewegung
 *   Saisons mit k=0   2/14   2/14   1/14   0/14   0/14
 *
 * WARUM 0,88 UND NICHT 0,82: bei 0,82 fiele die Schwelle mit der Untergrenze der Spanne zusammen,
 * der Hebel griffe also IMMER — und die ursprüngliche Absicht ginge verloren. Die steht im
 * Kommentar an `apronKonjunkturhebel`: die Gehälter stehen fest, bevor die Konjunktur gewürfelt
 * wird; in einer schwachen Saison soll die Abgabe nicht genau dann am meisten schmerzen, wenn
 * ohnehin niemand Geld hat. Bei 0,88 bleibt genau EINE von 14 beobachteten Saisons abgabefrei
 * (f = 0,87) — der Ausnahmefall statt der Regel.
 *
 * An den Sätzen und Linien ist keine Zeile angefasst.
 */
export const APRON_KONJUNKTUR_FACTOR_MIN = 0.88;
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
export function apronKonjunkturhebel(salaryFactor: number, factorMin?: number): number {
  if (!Number.isFinite(salaryFactor)) return 0;
  const min = factorMin ?? APRON_KONJUNKTUR_FACTOR_MIN;
  if (!(APRON_KONJUNKTUR_FACTOR_MAX > min)) return salaryFactor >= min ? 1 : 0;
  return clamp01((salaryFactor - min) / (APRON_KONJUNKTUR_FACTOR_MAX - min));
}

/**
 * EIN LESER FÜR ALLE APRON-FAKTOREN — kein zweiter Nachbau des Fensters.
 *
 * Das Fenster (5 Saisons Vorausschau, deterministisch je Save) gehört `season-economy-factors.ts`;
 * hier wird nur ein HORIZONT daraus gezogen. Der Zugriff läuft bewusst über
 * `getSeasonEconomyFactorWindow` und sucht `horizonIndex` explizit statt über den Array-Index — die
 * Reihenfolge im gespeicherten Zustand ist keine Zusage, die Normierung dort ist es.
 *
 * OHNE GESPEICHERTES FENSTER KEIN ERSATZWURF: `getSeasonEconomyFactorWindow` würfelt ein
 * vollständiges Fenster nach, wenn keins (oder ein unvollständiges) im Spielstand steht. Für die
 * Abgabe wäre das die falsche Antwort — der dokumentierte Apron-Fallback ist 1 (siehe unten), also
 * eine gedämpfte Steuer, nicht ein zufälliger Konjunkturwert. Jeder geladene Spielstand trägt das
 * Fenster ohnehin vollständig (`withSeededSeasonEconomyFactors`, save-repository.ts) — der Fall
 * betrifft nur konstruierte Zustände.
 */
function readApronFactorHorizon(gameState: GameState, horizonIndex: number): number | null {
  const gespeichert = gameState.seasonState?.seasonEconomyFactors ?? [];
  if (gespeichert.length < SEASON_ECONOMY_FACTOR_WINDOW_SIZE) return null;
  const seasonId = gameState.season?.id ?? "";
  const window = getSeasonEconomyFactorWindow({
    saveId: seasonId,
    seasonId,
    seasonState: gameState.seasonState,
  });
  const factor = window.find((entry) => entry.horizonIndex === horizonIndex)?.factor;
  return typeof factor === "number" && Number.isFinite(factor) && factor > 0 ? factor : null;
}

/**
 * Der Salary Factor der laufenden Saison — die Eingangsgröße des Hebels oben.
 *
 * Stand vorher wortgleich zweimal im Baum (`apron-settlement-service.ts`, `apron-projection.ts`); mit
 * der KI-Anbindung wäre es die dritte Kopie geworden. Abrechnung, Hochrechnung und Kaufentscheidung
 * MÜSSEN denselben Faktor lesen, sonst kauft die KI gegen eine andere Steuer, als am Saisonende
 * gebucht wird. Fallback 1, nicht 0: ein 0-Faktor machte die Abgabe unsichtbar statt sie nur zu
 * dämpfen.
 *
 * DIES IST DER FAKTOR DER ABRECHNUNG. Wer über eine KÜNFTIGE Saison entscheidet (verkaufen,
 * verlängern), nimmt `resolveApronDecisionSalaryFactor` — siehe dort.
 */
export function resolveApronSalaryFactor(gameState: GameState): number {
  return readApronFactorHorizon(gameState, 0) ?? 1;
}

/**
 * Der Salary Factor der KOMMENDEN Saison (`horizonIndex 1`) — kein Schätzwert, ein bereits
 * gewürfelter und dem Spieler auf den Sponsorkarten schon gezeigter Wert
 * (`buildSponsorOfferTermForecast`).
 *
 * Fallback ist bewusst der AKTUELLE Faktor und nicht 1: fehlt der Horizont, ist „so wie jetzt" die
 * ehrlichere Annahme als „neutrale Konjunktur" — 1 läge mitten in der Spanne 0,82–1,24 und würde
 * eine Aussage erfinden, die der Spielstand nicht hergibt.
 */
export function resolveApronSalaryFactorForNextSeason(gameState: GameState): number {
  return readApronFactorHorizon(gameState, 1) ?? resolveApronSalaryFactor(gameState);
}

/** Welcher Horizont hinter `resolveApronDecisionSalaryFactor` steckt — für Begründungstexte. */
export type ApronDecisionSalaryFactor = {
  factor: number;
  /** 0 = laufende Saison, 1 = kommende Saison. */
  horizonIndex: 0 | 1;
};

/**
 * DER FAKTOR, GEGEN DEN EINE KADER-ENTSCHEIDUNG RECHNEN MUSS — gemessener Fehler, nicht Kosmetik.
 *
 * Verkäufe und Verlängerungen laufen in der Saisonende-Kette; das Faktor-Fenster rückt aber erst in
 * deren letztem Schritt (`next_season_setup`) vor. Wer dort `resolveApronSalaryFactor` liest,
 * bekommt den Faktor der ABGELAUFENEN Saison — während die Abgabe, die der Verkauf beeinflusst,
 * erst in der NÄCHSTEN anfällt, deren Faktor im selben Fenster bereits steht.
 *
 * GEMESSEN am Abbild (Save `1hf25q`, Saison 2 abgerechnet, f=1,19 → k=0,83; nächste Saison f=0,87 →
 * k=0): `buildApronAbbauZiel("Hell Raisers").reliefBisZiel` stand auf 9,67, real ist es 0,00. Die KI
 * hätte Spieler verkauft, um eine Abgabe zu vermeiden, die es nachweislich nicht geben wird (drei
 * kommende Saisons liegen mit 0,87/0,83/0,91 unter der k=0-Schwelle 0,95).
 *
 * AB DEM SAISONSTART GILT WIEDER `horizonIndex 0`: gekauft wird ausschliesslich in der neuen Saison
 * vor ihrem ersten Spieltag (`isEarlySeasonTransferSetup`, transfer-window-policy.ts). Dort ist das
 * Fenster bereits vorgerückt und die Abgabe, die der Zugang auslöst, fällt am Ende genau dieser
 * Saison an — `horizonIndex 0` ist dann der richtige Wert und bleibt es.
 *
 * NUR EIN ZWEITER LESEHORIZONT DERSELBEN QUELLE, keine zweite Formel: die Abgabe rechnet weiter
 * `apronLevyForSalary`, die Abrechnung weiter `resolveApronSalaryFactor`.
 */
export function resolveApronDecisionSalaryFactor(gameState: GameState): ApronDecisionSalaryFactor {
  if (isBeforeSeasonEconomyFactorAdvance(gameState.gamePhase)) {
    return { factor: resolveApronSalaryFactorForNextSeason(gameState), horizonIndex: 1 };
  }
  return { factor: resolveApronSalaryFactor(gameState), horizonIndex: 0 };
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
 * BEMESSUNGSGRUNDLAGE des Apron — und die ist ausdrücklich `getTeamApronSalaryBase`, nicht ein
 * zweiter Direktgriff auf irgendeine Gehaltssumme. LINIEN UND BASIS MÜSSEN DIESELBE GRÖSSE MESSEN:
 * die Linien sind der Median genau der Zahl, gegen die anschließend verglichen wird. Ein Median
 * aus dem Formel-Gehalt gegen eine Basis aus dem verhandelten Gehalt verschöbe die ganze Liga
 * gegen ihre eigene Linie. Schwelle und Referenzwert sind dieselben wie beim Sponsorsystem, keine
 * zweite erfundene Zahl: gemessene Summe unter 25 % der erwarteten (32 × Referenz) ⇒ Referenz je Team.
 */
function getLeagueDisplaySalaries(gameState: GameState): { salaries: number[]; usedReference: boolean } {
  const measured = gameState.teams.map((team) => getTeamApronSalaryBase(gameState, team.teamId));
  const teamCount = Math.max(1, measured.length);
  const measuredSum = measured.reduce((sum, value) => sum + value, 0);
  if (measuredSum >= teamCount * SPONSOR_V3_REFERENCE_SALARY_PER_TEAM * 0.25) {
    return { salaries: measured, usedReference: false };
  }
  return { salaries: measured.map(() => SPONSOR_V3_REFERENCE_SALARY_PER_TEAM), usedReference: true };
}

/**
 * DIE GEHALTSSUMME, GEGEN DIE DER APRON EIN TEAM BEMISST — was in DIESER Saison wirklich gezahlt
 * wird.
 *
 * Eigene Funktion statt eines direkten Aufrufs, damit jede Apron-Frage im Baum nachweislich
 * dieselbe Grundlage nimmt. Genau hier lag schon einmal ein Fehler: die KI prüfte ihre
 * Gehaltsdecke gegen die ECHTE Vertragssumme, während besteuert wurde, was diese Funktion liefert.
 * Seit der Umstellung sind beide dasselbe — der Widerspruch kann nicht wiederkommen.
 *
 * Sie steht in der SAISON-Ebene und nicht bei der KI, obwohl die KI ihr Hauptnutzer ist: sie gehört
 * zur Definition des Apron, nicht zu seiner Verwendung. Praktisch entscheidet das auch die
 * Importrichtung — die KI-Decke (`resolveTeamApronSalaryCeiling`) baut auf dieser Zahl auf, und ein
 * Zuhause bei der KI hätte einen Zyklus ergeben.
 *
 * ZWEITE UMSTELLUNG (Chris: „das sollte doch umgestellt sein auf die REAL zu zahlende summe des
 * jahres nach vertrag und nicht geglättet"): vorher `getTeamNegotiatedSalaryTotal`, das bei
 * Unterschrift verhandelte Jahresgehalt. Es war formunabhängig und trug damit die alte
 * Anti-Gaming-Zusage — aber es ist der Durchschnitt über die Laufzeit und nicht das, was in dieser
 * Saison vom Konto geht. Die Begründung samt Folgen steht im Dateikopf.
 */
export function getTeamApronSalaryBase(gameState: GameState, teamId: string): number {
  return getTeamActualSalaryTotal(gameState, teamId);
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
  const seasonId = gameState.season?.id;
  const hatErgebnis = (gameState.seasonState?.matchdayResults ?? []).some(
    (result) => result.seasonId === seasonId,
  );
  const hatTabellenbuchung = (gameState.seasonState?.standingsApplyLogs ?? []).some(
    (log) => log.seasonId === seasonId,
  );
  return hatErgebnis || hatTabellenbuchung;
}

/**
 * HABEN DIE MENSCHEN IHRE TRANSFERS FINALISIERT? — das Schließen des Kauffensters, als Zustand
 * lesbar.
 *
 * GEMELDET VON CHRIS: „ich habe nun transfers finalisiert -> apron müsste nun eingefroren werden
 * und hier entsprechend auch angezeigt werden in der GuV und den anderen finanz Seiten!"
 *
 * Er hat recht, und der bisherige Zeitpunkt (erster abgerechneter Spieltag) war eine Stufe zu spät:
 * „Transfers finalisieren" IST der Moment, in dem der Kaderbau der Saison endet — danach folgen nur
 * noch Aufstellung und Spieltag. Bis dahin sollen die Linien mitwandern (siehe
 * `resolveSeasonApronLines`), ab da stehen sie.
 *
 * KEINE ZWEITE DEFINITION VON „FINALISIERT": gelesen wird `teamHasFormCardPool` — dieselbe Zusage,
 * an der auch der Spielfluss den Schritt abhakt (form-card-flow.ts: „pool presence *is*
 * finalized"). Gefragt sind ausschließlich MENSCHLICHE Teams mit Kader: KI-Teams bekommen ihre
 * Karten über den Stapel-Lauf und sagen deshalb nichts darüber aus, ob der Mensch fertig ist. Gibt
 * es kein menschliches Team (reine Simulation), bleibt es bei der alten Schranke — dann ist der
 * erste Spieltag das einzige Signal, das es gibt.
 */
export function haveSeasonTransfersBeenFinalized(gameState: GameState): boolean {
  const kaderTeamIds = new Set((gameState.rosters ?? []).map((entry) => entry.teamId));
  const menschlicheTeamsMitKader = (gameState.teams ?? []).filter(
    (team) => team.humanControlled && kaderTeamIds.has(team.teamId),
  );
  if (menschlicheTeamsMitKader.length === 0) return false;
  return menschlicheTeamsMitKader.every((team) => teamHasFormCardPool(gameState, team.teamId));
}

/**
 * IST DAS KAUFFENSTER ZU? — ab hier dürfen die Linien nicht mehr wandern.
 *
 * Zwei Wege dorthin, und beide zählen: der Mensch hat finalisiert, oder es wurde bereits gespielt.
 * Der zweite bleibt als Rückfall drin, weil es Spielstände ohne menschliches Team gibt (Simulation)
 * und weil ein Spieltag ohnehin nach dem Finalisieren kommt — er kann das Fenster nur bestätigen,
 * nie wieder öffnen.
 */
export function isApronBuyWindowClosed(gameState: GameState): boolean {
  return hasSeasonBeenPlayed(gameState) || haveSeasonTransfersBeenFinalized(gameState);
}

/**
 * STEHEN DIE LINIEN FEST? — die einzige Stelle, die das entscheidet, und die Antwort, die die
 * Anzeige ausweist.
 *
 * BEWUSST ZWEITEILIG: das Fenster muss zu sein UND ein zur Saison passender Snapshot muss
 * vorliegen. „Eingefroren" ohne gespeicherten Stand wäre eine Behauptung ohne Deckung — gerechnet
 * würde weiter live, die Grenze könnte sich also noch bewegen, während die Oberfläche das Gegenteil
 * sagt. Der Snapshot wird beim Finalisieren geschrieben (`ensureSeasonApronLinesFrozen`), also
 * fallen beide Teile im Normalfall im selben Augenblick zusammen.
 */
export function areSeasonApronLinesFrozen(gameState: GameState): boolean {
  const snapshot = gameState.seasonState?.apronLinesSnapshot;
  if (snapshot?.seasonId !== gameState.season?.id) return false;
  return isApronBuyWindowClosed(gameState);
}

/**
 * DIE LINIEN, DIE GERADE GELTEN — abgeleitet aus `areSeasonApronLinesFrozen`, nicht zweitgerechnet.
 *
 * Solange das Kauffenster offen ist, wandern sie mit dem Median mit; sobald es zu ist, gilt der
 * eingefrorene Stand.
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
 * nicht für die Aufbauphase davor. Mit dem Finalisieren endet der Kaderbau, ab da steht die Grenze.
 */
export function resolveSeasonApronLines(gameState: GameState): ApronLines {
  if (areSeasonApronLinesFrozen(gameState)) {
    return gameState.seasonState!.apronLinesSnapshot!;
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
 * DIE ABGABE EINES EINZELNEN GEHALTS, vor dem Deckel — die eine Stelle, an der die Zonen-Arithmetik
 * steht. `computeApronSettlement` unten benutzt sie, und die KI benutzt sie, um VOR einem Kauf zu
 * wissen, was der Kauf sie an Abgabe kosten wird (`lib/ai/ai-apron-cost-service.ts`).
 *
 * Herausgelöst, weil die KI sonst die Formel nachbauen müsste: zwei Formeln für dieselbe Zahl driften
 * auseinander, sobald jemand einen Satz oder eine Zone anfasst — und dann kauft die KI gegen eine
 * Steuer, die es so nicht mehr gibt.
 *
 * OHNE DECKEL, und zwar bewusst: der Deckel (`APRON_CAP_SHARE_OF_RANK_PAYOUT` × Wertungsanteil)
 * hängt am ENDRANG der Saison, den zum Kaufzeitpunkt niemand kennt. Er kann die Abgabe nur SENKEN,
 * nie erhöhen — die KI rechnet also mit der Obergrenze und irrt damit höchstens in Richtung
 * Zurückhaltung. Laut Kalibrierung greift er bei den vorkommenden Rangverteilungen ohnehin nie.
 */
export function apronLevyForSalary(input: {
  salary: number;
  line1: number;
  line2: number;
  salaryFactor: number;
  /** Nur für die Kalibrierung (siehe `computeApronSettlement`); sonst weglassen. */
  rateZone1?: number;
  rateZone2?: number;
  konjunkturFactorMin?: number;
}): number {
  if (!Number.isFinite(input.salary) || input.salary <= 0) return 0;
  const rateZone1 = input.rateZone1 ?? APRON_RATE_ZONE_1;
  const rateZone2 = input.rateZone2 ?? APRON_RATE_ZONE_2;
  const ueberLinie1 = Math.max(0, Math.min(input.salary, input.line2) - input.line1);
  const ueberLinie2 = Math.max(0, input.salary - input.line2);
  return (ueberLinie1 * rateZone1 + ueberLinie2 * rateZone2) * apronKonjunkturhebel(input.salaryFactor, input.konjunkturFactorMin);
}

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
  konjunkturFactorMin?: number;
}): ApronSettlement {
  const { line1, line2 } = input.lines;
  const rateZone1 = input.rateZone1 ?? APRON_RATE_ZONE_1;
  const rateZone2 = input.rateZone2 ?? APRON_RATE_ZONE_2;
  const capShareOfRankPayout = input.capShareOfRankPayout ?? APRON_CAP_SHARE_OF_RANK_PAYOUT;

  const partial = input.teams.map((team) => {
    const ueberLinie1 = Math.max(0, Math.min(team.salary, line2) - line1);
    const ueberLinie2 = Math.max(0, team.salary - line2);
    // Dieselbe Formel, die die KI vor dem Kauf befragt — herausgelöst, damit es nur eine gibt.
    const rohAbgabe = apronLevyForSalary({
      salary: team.salary,
      line1,
      line2,
      salaryFactor: input.salaryFactor,
      rateZone1,
      rateZone2,
      konjunkturFactorMin: input.konjunkturFactorMin,
    });
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
