/**
 * SPONSOR-LIGALEITER — der Sockel nach Startrang plus der Wertungstopf nach Endrang.
 *
 * Bis hierher kam die Sponsorauszahlung aus `sponsorV3BenchmarkLadder()` — also woertlich aus der
 * PREISGELDKURVE der Saison. Zwei Systeme (Sponsoren, Preisgeld) haben damit auf denselben Topf
 * gezogen, und die 11 Kurvenformen in `sponsor-curve-shapes.ts` waren nur noch ein Anzeige-Etikett
 * (`curveShape` stand am Vertrag, aber nichts las es fuer die Abrechnung).
 *
 * DIESE DATEI ERSETZT DAS: eine EIGENE, kleinere Leiter, aus zwei Teilen:
 *   - dem SOCKEL, fix nach dem STARTRANG des Teams (nicht dem Endrang!) — er steht damit fest,
 *     BEVOR die Saison beginnt und bevor Gehaelter zugesagt werden. Ein Sockel nach Endrang waere
 *     keine Absicherung, sondern eine Ueberraschung: das Team wuesste beim Kaderplanen gar nicht,
 *     was es hat.
 *   - dem WERTUNGSTOPF, verteilt nach dem ENDRANG — das ist der Teil, der Leistung honoriert.
 *
 * Die 11 Kurvenformen bestimmen NUR NOCH, WO auf dieser Leiter das Geld liegt (Ankernormierung,
 * siehe `sponsorKurvenLeiter`), nicht mehr WIE VIEL es insgesamt ist — jede Form liefert bei
 * Unterschrift denselben Erwartungswert `A`. Damit ist die Kartenwahl wieder eine PASSUNGSFRAGE
 * (welche Form passt zur eigenen Ambition?) statt einer Staerkefrage (welche Form zahlt am meisten?).
 *
 * Reine Arithmetik: kein `GameState`-Zugriff ausser dem uebergebenen `salaryFactor`, keine
 * Zufallsquelle, keine IO. Einzeln testbar, siehe tests/sponsor-liga-leiter.test.ts.
 */
import type { SponsorCurveShape } from "@/lib/data/olyDataTypes";
import { SPONSOR_CURVE_SHAPES } from "@/lib/sponsor/sponsor-curve-shapes";
import { sponsorV3AnchorWeights } from "@/lib/sponsor/sponsor-v3-model";
import type { LeagueTier } from "@/lib/season/league-split";

/**
 * Ligagroesse, ueber die die Leiter laeuft — dieselbe 32er-Tabelle wie im V3-Modell. Bleibt der
 * DEFAULT fuer alle Funktionen unten (docs/design/liga-split-plan.md, PR 1: reine Parametrisierung,
 * Verhalten bei Default unveraendert). Ein optionaler `leagueSize`-Parameter erlaubt eine kleinere
 * Ligagroesse (z. B. `LEAGUE_SIZE = 16` aus lib/season/league-split.ts), ohne dass ein bestehender
 * Aufruf ohne diesen Parameter sich aendert.
 */
const SPONSOR_LIGA_RANKS = 32;

/**
 * DER EINE REGLER FUER DIE HOEHE DER GANZEN AUSSCHUETTUNG.
 *
 * Er skaliert Sockel, Wertungstopf und Sicherheitsnetz GEMEINSAM — also jede Sprosse jeder Karte um
 * denselben Faktor. Genau deshalb gibt es ihn: die Hoehe der Liga-Auszahlung ist eine einzige
 * Entscheidung und sollte auch an einer einzigen Zahl haengen. Wer stattdessen die drei Konstanten
 * unten einzeln anfasst, verschiebt unweigerlich auch ihr VERHAELTNIS zueinander — und damit die
 * Verteilung zwischen Spitze und Tabellenende, obwohl er nur die Summe meinte.
 *
 * WARUM 1,1: der Messlauf (`scripts/messlauf-sponsoren-gebaeude.ts`) ergab bei 1,0 eine Deckung von
 * 84 % — Σ Sponsorgeld 1694,6 C gegen Σ Gehaelter 2020,0 C. Davon waren rund zwei Drittel der
 * bewusst gewaehlte Cash-Verzicht fuer Gebaeude (195,9 C); ohne ihn lag die Deckung bei 94 %. Das
 * verbleibende Drittel war eine Leiter, die auch ohne Gebaeude knapp unter der Selbstdeckung lag.
 * Chris' Entscheidung: „dann würde ich sagen musst du deine Cash Ausschüttung um 10 % erhöhen."
 *
 * Was das bewirkt und was NICHT: die Liga kann ihre Gehaelter jetzt aus reinen Cash-Sponsoren
 * decken. Wer Gebaeude leiht, bleibt darunter — das ist kein Rest-Fehler, sondern das Rubberband,
 * das Chris ausdruecklich will („wenn die teams overspenden bei den gehältern ist das gewollt").
 */
export const SPONSOR_AUSSCHUETTUNG = 1.1;

/** Sockel fuer Startrang 1 (Titelverteidiger) — er muss sich alles erspielen. */
export const SPONSOR_SOCKEL_MIN = 18 * SPONSOR_AUSSCHUETTUNG;
/** Sockel fuer Startrang 32 (Schlusslicht) — die Absicherung nach unten. */
export const SPONSOR_SOCKEL_MAX = 48 * SPONSOR_AUSSCHUETTUNG;
/** Wertungstopf der Liga bei Salary Factor 1,0. */
export const SPONSOR_WERTUNGSTOPF = 1030 * SPONSOR_AUSSCHUETTUNG;
/**
 * Kruemmung der Rangverteilung des Wertungstopfs. > 1 heisst: die Spitze bekommt ueberproportional
 * mehr als eine lineare Verteilung, das Mittelfeld entsprechend weniger — passend zu einer Liga, in
 * der der Titel das seltene, teure Ereignis ist und Plaetze 15 bis 20 kaum jemanden ueberraschen.
 */
export const SPONSOR_WERTUNG_KURVE = 1.35;
/**
 * Absolute Untergrenze der Auszahlung, UNABHAENGIG von allem — auch vom Sockel. Der neue Sockel
 * reicht bei Startrang 1 bis hinunter auf 18, deutlich unter dem alten `SPONSOR_V3_FLOOR_C` (32):
 * ein Titelfavorit, der auf Rang 32 abstuerzt, braeuchte sonst kein Netz mehr. `SPONSOR_BODEN`
 * greift ausschliesslich ueber den bestehenden Mechanismus in `sponsorV3LadderValue` (Vertrags-Feld
 * `floor`) — er steht NICHT in den Formeln unten, damit die Ankerarithmetik von `sponsorKurvenLeiter`
 * linear und exakt bleibt (ein Clamp in der Leiter selbst wuerde die Ankernormierung verfaelschen).
 */
export const SPONSOR_BODEN = 43 * SPONSOR_AUSSCHUETTUNG;

/**
 * LIGA-SPLIT PR4 (docs/design/liga-split-plan.md, Abschnitt 3 + Chris' Entscheidung): der
 * GESAMTAUSSCHUETTUNGSTOPF der Sponsoren fällt in Liga 2 auf 80 % dessen, was ein identisches
 * Liga-1-Szenario ausschütten würde — „wenn Liga 1 1000 ausschüttet, sind es in Liga 2 ca. 800,
 * bitte einfach als Faktor-Abschlag einbauen", präzisiert: „Der 0,8-Abschlag gilt für die
 * GESAMTAUSSCHÜTTUNG der Sponsoren! Wie das verteilt wird, ist davon weiterhin unabhängig, bitte so
 * handhaben wie bisher."
 *
 * DER FAKTOR WIRKT AUSSCHLIESSLICH AUF `SPONSOR_WERTUNGSTOPF` — also auf den TOPF, BEVOR die
 * bestehende Verteilungsformel (Rang-Gewichte, Kurvenform, Anker) ihn auf die Sprossen der Leiter
 * verteilt. Der SOCKEL (`sponsorSockelFuerStartrang`) bleibt für beide Ligen unangetastet: er ist
 * die planbare Absicherung nach Startrang, kein Teil des "Wertungstopfs", und Chris' Vorgabe nennt
 * ausdrücklich nur die Ausschüttung, nicht die Verteilungsmechanik. Deshalb ist die Liga-2-Gesamt-
 * ausschüttung (Sockel-Summe + 0,8×Topf) nur NAEHERUNGSWEISE 80 % der Liga-1-Summe — exakt trifft
 * es der Wertungstopf selbst (siehe tests/sponsor-liga-leiter.test.ts).
 *
 * Nur wirksam, wenn ein Aufrufer explizit `leagueTier: "liga2"` übergibt — ohne dieses Feld (jeder
 * heutige Aufrufer) ist der Faktor 1 und das Verhalten bit-identisch zu vor diesem PR.
 */
export const SPONSOR_TOPF_FAKTOR_JE_LIGA: Readonly<Record<LeagueTier, number>> = {
  liga1: 1,
  liga2: 0.8,
};

/**
 * AUF-/ABSTIEGS-ZONEN-TERM (Plan Abschnitt 4): ein kleiner, rang-abhaengiger Zuschlag/Abschlag DIREKT
 * in der Sponsorleiter, bevor sie eingefroren wird — analog zum bestehenden `leihVerzicht`-Muster in
 * `sponsor-v3-model.ts` (dort ein Abzug VOR Anker/Tilt in `buildSponsorV3TermsCore`; hier ein
 * Zu-/Abschlag VOR dem Einfrieren, hier in `sponsor-liga-leiter.ts`). Kein zweiter Rechenpfad, keine
 * Drift: `buildSponsorV3TermsCore` berechnet den Erwartungsanker `A` immer FRISCH aus der uebergebenen
 * `baseLadder` — der Zonen-Term ist zu dem Zeitpunkt schon Teil dieser Leiter und wird deshalb
 * automatisch korrekt eingepreist (EV bleibt planbar, kein Sonderfall im Settlement noetig).
 *
 * GROESSENORDNUNG: orientiert an `prize-placement-table.ts` (dort bei den Endraendern der Tabelle
 * gekappt, effektiv +7,71/−5,78 C) — spuerbar, aber kleiner als der Platzierungsbonus und deutlich
 * kleiner als eine typische Salary-Factor-Schwankung (Wertungstopf schwankt um +-30 C zwischen
 * f=0,82 und f=1,24). +-6 C VOR der Salary-Factor-Skalierung ist rund ein Fünftel dieser Schwankung.
 * NACHJUSTIERBAR ausschliesslich ueber diese beiden Konstanten (und die Zonenbreite unten) — sonst
 * nichts an der Rechnung muss angefasst werden.
 */
export const SPONSOR_ZONE_AUFSTIEG_BONUS = 6;
export const SPONSOR_ZONE_ABSTIEG_MALUS = 6;
/** Liga 2, Endraenge 1..N (Aufstiegszone) — N ist diese Konstante. */
export const SPONSOR_ZONE_AUFSTIEG_RANKS = 3;
/** Liga 1, die letzten N Endraenge der Liga (Abstiegszone) — N ist diese Konstante. */
export const SPONSOR_ZONE_ABSTIEG_RANKS = 3;

/**
 * Der Zonen-Term fuer EINEN Endrang. `leagueSize` ist die tatsaechliche Laenge der Leiter, an der er
 * angewandt wird (nicht `SPONSOR_LIGA_RANKS`) — automatisch richtig fuer eine kuenftige 16er-Leiter.
 * Ohne `tier` (jeder heutige Aufrufer) immer 0: der Term ist rein additiv und veraendert nichts, wenn
 * niemand eine Liga-Zugehoerigkeit uebergibt.
 */
function sponsorZonenTermFuerRang(
  rank: number,
  tier: LeagueTier | undefined,
  leagueSize: number,
  salaryFactor: number,
): number {
  if (!tier || !(leagueSize > 0) || !Number.isFinite(salaryFactor)) return 0;
  if (tier === "liga2" && rank <= SPONSOR_ZONE_AUFSTIEG_RANKS) {
    return SPONSOR_ZONE_AUFSTIEG_BONUS * salaryFactor;
  }
  if (tier === "liga1" && rank > leagueSize - SPONSOR_ZONE_ABSTIEG_RANKS) {
    return -SPONSOR_ZONE_ABSTIEG_MALUS * salaryFactor;
  }
  return 0;
}

/** Traegt den Zonen-Term rang-genau auf eine fertige Leiter auf — letzter Schritt vor dem Einfrieren. */
function mitZonenTerm(
  leiter: readonly number[],
  tier: LeagueTier | undefined,
  salaryFactor: number,
): number[] {
  const leagueSize = leiter.length;
  return leiter.map((wert, index) => wert + sponsorZonenTermFuerRang(index + 1, tier, leagueSize, salaryFactor));
}

const clampRank = (rank: number, leagueSize: number = SPONSOR_LIGA_RANKS): number =>
  Math.max(1, Math.min(leagueSize, Math.round(Number.isFinite(rank) ? rank : leagueSize)));

/**
 * Der Sockel eines Teams — linear ueber den STARTRANG, NICHT den Salary Factor. Das ist Absicht: der
 * Sockel ist die planbare Absicherung, gegen die ein Team seine Gehaelter zusagt, bevor die Saison
 * anfaengt. Haenge er am Salary Factor, wuesste ein Team seinen Sockel erst, wenn die Konjunktur der
 * Saison schon feststeht — zu spaet fuer die Kaderplanung.
 *
 * `leagueSize` default `SPONSOR_LIGA_RANKS` (32) — heutiges Verhalten unveraendert.
 */
export function sponsorSockelFuerStartrang(startRank: number, leagueSize: number = SPONSOR_LIGA_RANKS): number {
  const rank = clampRank(startRank, leagueSize);
  return SPONSOR_SOCKEL_MIN + ((SPONSOR_SOCKEL_MAX - SPONSOR_SOCKEL_MIN) * (rank - 1)) / (leagueSize - 1);
}

/** Rang-Gewichte des Wertungstopfs fuer eine gegebene Ligagroesse (siehe `sponsorWertungsGewichte`). */
function computeWertungsGewichte(leagueSize: number): readonly number[] {
  return Array.from({ length: leagueSize }, (_, index) => {
    const rank = index + 1;
    return ((leagueSize - rank) / (leagueSize - 1)) ** SPONSOR_WERTUNG_KURVE;
  });
}

/**
 * Die Rang-Gewichte des Wertungstopfs bei `SPONSOR_LIGA_RANKS` (32), EINMAL berechnet
 * (Modul-Konstante): Rang 1 bekommt das volle Gewicht 1, Rang 32 exakt 0 — der Letzte der Liga
 * bekommt aus dem Wertungstopf nichts, nur seinen Sockel. Dazwischen faellt das Gewicht mit
 * `SPONSOR_WERTUNG_KURVE`.
 */
const WERTUNGS_GEWICHTE: readonly number[] = computeWertungsGewichte(SPONSOR_LIGA_RANKS);
const WERTUNGS_GEWICHTE_SUMME = WERTUNGS_GEWICHTE.reduce((sum, value) => sum + value, 0);

/** `leagueSize` default `SPONSOR_LIGA_RANKS` (32) — liefert bei Default die gecachte 32er-Reihe. */
export function sponsorWertungsGewichte(leagueSize: number = SPONSOR_LIGA_RANKS): readonly number[] {
  return leagueSize === SPONSOR_LIGA_RANKS ? WERTUNGS_GEWICHTE : computeWertungsGewichte(leagueSize);
}

/**
 * Die NEUTRALE Ligaleiter: `leagueSize` Sprossen (default 32), Sockel (konstant ueber den Endrang,
 * haengt nur am Startrang) plus der anteilige Wertungstopf (haengt nur am Endrang, mit
 * `SPONSOR_TOPF_FAKTOR_JE_LIGA` skaliert). OHNE Boden — der wird erst spaeter, ueber das eingefrorene
 * `terms.floor`, angewandt (siehe `sponsor-v3-model.ts`), damit diese Funktion pure, ungeklammerte
 * Arithmetik bleibt und der Anker in `sponsorKurvenLeiter` exakt trifft.
 *
 * Die neutrale Leiter OHNE Zonen-Term — intern wiederverwendet von `sponsorKurvenLeiter`, das den
 * Zonen-Term separat (nach der Kurvenformung) selbst aufträgt, statt ihn über den Erwartungsanker
 * `anspruch` erst zu verwaschen und dann über die ganze Kurve neu zu verteilen (siehe dortiger
 * Kommentar). `sponsorLigaLeiter` (der öffentliche Export) trägt den Zonen-Term direkt auf.
 */
function sponsorLigaLeiterOhneZonenTerm(input: {
  startRank: number;
  salaryFactor: number;
  leagueSize?: number;
  leagueTier?: LeagueTier;
}): number[] {
  const leagueSize = input.leagueSize ?? SPONSOR_LIGA_RANKS;
  const sockel = sponsorSockelFuerStartrang(input.startRank, leagueSize);
  const gewichte = sponsorWertungsGewichte(leagueSize);
  const gewichteSumme = leagueSize === SPONSOR_LIGA_RANKS
    ? WERTUNGS_GEWICHTE_SUMME
    : gewichte.reduce((sum, value) => sum + value, 0);
  // SPONSOR_TOPF_FAKTOR_JE_LIGA wirkt NUR hier, auf den Topf selbst — vor jeder Rang-Gewichtung. Ohne
  // `leagueTier` (jeder heutige Aufrufer) ist der Faktor 1, bit-identisch zu vor diesem PR.
  const topfFaktor = input.leagueTier ? SPONSOR_TOPF_FAKTOR_JE_LIGA[input.leagueTier] : 1;
  const topf = SPONSOR_WERTUNGSTOPF * input.salaryFactor * topfFaktor;
  return gewichte.map((gewicht) => sockel + (topf * gewicht) / gewichteSumme);
}

export function sponsorLigaLeiter(input: {
  startRank: number;
  salaryFactor: number;
  leagueSize?: number;
  /**
   * Liga-Split PR4: nur gesetzt, wenn `isLeagueSplitActive()` UND das Team einer Liga zugeordnet ist.
   * Steuert sowohl den Topf-Rabatt (`SPONSOR_TOPF_FAKTOR_JE_LIGA`) als auch den Zonen-Term
   * (`sponsorZonenTermFuerRang`). Weggelassen (jeder heutige Aufrufer): beides bleibt inaktiv.
   */
  leagueTier?: LeagueTier;
}): number[] {
  const basis = sponsorLigaLeiterOhneZonenTerm(input);
  return mitZonenTerm(basis, input.leagueTier, input.salaryFactor);
}

/**
 * Die GESHAPETE Ligaleiter — dort, wo die 11 Kurvenformen wieder etwas bedeuten.
 *
 * Ankernormierung, exakt und ohne Naeherung: die 11 `reference`-Arrays in `sponsor-curve-shapes.ts`
 * sind auf gleiche FLAECHE normiert (jede zahlt denselben Gesamt-Etat), nicht auf gleichen
 * ERWARTUNGSWERT fuer ein bestimmtes Team. Ohne Renormierung waere derselbe `titeljaeger` fuer ein
 * Spitzenteam (das seinen Titel-Peak oft trifft) mehr wert als fuer ein Kellerteam — die Kartenwahl
 * waere wieder eine Staerkefrage statt einer Passungsfrage, genau der Fehler, den dieser Umbau beheben
 * soll. Die Rechnung:
 *
 *   sockel     = sponsorSockelFuerStartrang(startRank)
 *   neutral    = sponsorLigaLeiter({ startRank, salaryFactor })
 *   gewichte   = sponsorV3AnchorWeights(startRank)          // Endrang-Erwartung dieses Teams
 *   A          = Σ gewichte[i] * neutral[i]                  // der Anspruch DIESES Teams
 *   ref        = SPONSOR_CURVE_SHAPES[shape].reference
 *   refAnker   = Σ gewichte[i] * ref[i]
 *   c          = (A − sockel) / refAnker
 *   leiter[i]  = sockel + c * ref[i]
 *
 * Weil `sockel` ueber alle Raenge konstant ist, gilt `Σ gewichte·leiter = sockel + c·refAnker = A` —
 * EXAKT, fuer jede der 11 Formen. Gleiche Erwartung, andere Verteilung: der Sockel selbst wird nie
 * geshaped (er ist die Absicherung, keine Wahl), nur der Wertungsanteil obendrauf.
 */
export function sponsorKurvenLeiter(input: {
  shape: SponsorCurveShape;
  startRank: number;
  salaryFactor: number;
  /** Liga-Split PR4 — siehe `sponsorLigaLeiter`. Weggelassen: Topf-Rabatt und Zonen-Term bleiben aus. */
  leagueTier?: LeagueTier;
}): number[] {
  const sockel = sponsorSockelFuerStartrang(input.startRank);
  // ZONENFREI: der Zonen-Term wird bewusst NICHT hier eingerechnet, sondern erst ganz unten auf die
  // fertig geshapete Leiter aufgetragen. Ginge er hier in `neutral` ein, würde er zuerst im
  // gewichteten Mittelwert `anspruch` verwaschen (ein kleiner Ausschlag an genau 3 von 32 Rängen) und
  // dann über `c` PROPORTIONAL auf die GESAMTE Kurvenform verteilt — der Bonus/Malus würde also nicht
  // mehr die Endränge 1..3 bzw. die letzten 3 treffen, sondern spurlos in jeder Sprosse aufgehen.
  const neutral = sponsorLigaLeiterOhneZonenTerm({
    startRank: input.startRank,
    salaryFactor: input.salaryFactor,
    leagueTier: input.leagueTier,
  });
  const gewichte = sponsorV3AnchorWeights(input.startRank);
  const anspruch = neutral.reduce((sum, value, index) => sum + value * (gewichte[index] ?? 0), 0);
  const referenz = SPONSOR_CURVE_SHAPES[input.shape].reference;
  const referenzAnker = referenz.reduce((sum, value, index) => sum + value * (gewichte[index] ?? 0), 0);
  // Guardrail, kann bei den heutigen Referenzwerten (alle > 30) nicht vorkommen: ohne einen
  // positiven Nenner waere `c` nicht definiert — dann lieber die neutrale Leiter als eine
  // Kurvenform, die rechnerisch zusammenbricht.
  if (!(referenzAnker > 0)) return mitZonenTerm(neutral, input.leagueTier, input.salaryFactor);
  // Guardrail: `c` nie negativ. Der Anspruch `A` ist immer >= Sockel (er ist der gewichtete
  // Mittelwert einer Leiter, die nirgends unter den Sockel faellt) — der Clamp greift also in der
  // Praxis nie, schuetzt aber davor, dass eine kuenftige Aenderung der Gewichte still eine
  // gespiegelte (invertierte) Kurve erzeugt.
  const c = Math.max(0, (anspruch - sockel) / referenzAnker);
  const geshaped = referenz.map((value) => sockel + c * value);
  // DER ZONEN-TERM ZULETZT, rang-genau auf die fertig geshapete Leiter — dieselbe Regel wie in
  // `sponsorLigaLeiter`. `buildSponsorV3TermsCore` (sponsor-v3-model.ts) berechnet den eingefrorenen
  // Erwartungsanker `A` danach frisch aus GENAU dieser Leiter, absorbiert den Term also automatisch.
  return mitZonenTerm(geshaped, input.leagueTier, input.salaryFactor);
}
