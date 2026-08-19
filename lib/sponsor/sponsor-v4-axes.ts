/**
 * NUR NOCH FUER ALTVERTRAEGE. Neu erzeugte Angebote tragen seit dem Gebäude-Umbau keine Achse mehr:
 * Gebäude-Karten fuehren stattdessen eines der zwei Leih-Ziele (`sponsor-leih-ziele.ts`, Frische und
 * Achsen-Rang, fest bepreist mit p = 0), die reine Cash-Karte gar keins. Die Rechnung hier bleibt
 * vollstaendig erhalten und wird weiter getestet, weil bereits unterschriebene Vertraege nach altem
 * Recht abgerechnet werden (Invariante 3 in `docs/SPONSOREN_BAUVORLAGE.md`) — sie ist ab jetzt aber
 * Bestandspflege und keine Erzeugungslogik mehr. Der folgende Kommentar beschreibt das Modell aus
 * der Zeit, als sie es noch war.
 */
/**
 * SPONSOR-ACHSEN (V4) — WOFUER EIN SPONSOR BEZAHLT, AUSSER FUER DEN TABELLENPLATZ.
 *
 * Warum es sie gibt: bis V3 unterschieden sich die fuenf Karten eines Slates ausschliesslich im
 * RISIKOPROFIL um dieselbe Rangleiter. Alle hatten denselben Erwartungswert, und der Ausschlag lag
 * bei +-1 bis 3 C gegen eine Faktorschwankung von +-30 C. Damit war die Wahl praktisch belanglos:
 * es gab keine falsche Entscheidung, also auch keine Entscheidung.
 *
 * Eine Achse ist ein zweiter Kanal, ueber den ein Sponsor zahlt — Kaderwert, Ausbau, Finanzen,
 * Talententwicklung, Frische. Die Wahl ist damit keine Wette mehr, sondern eine PASSUNGSFRAGE: das
 * Team weiss, worin es diese Saison gut sein will, das Spiel weiss es nicht.
 *
 * ZWEI EIGENSCHAFTEN TRAGEN DIE BALANCE:
 *
 * 1. Gemessen wird gegen die EIGENE, bei Angebotserzeugung eingefrorene Ausgangslage — nie gegen die
 *    Liga. Deshalb ist eine Achse fuer den Tabellenletzten genauso ausreizbar wie fuer den Meister,
 *    und der Betrag ist derselbe. Das ist der Mechanismus, der jedem Team Chancen gibt; ein
 *    rangbezogenes Ziel waere nur eine zweite Preisgeldtabelle.
 * 2. Bepreist wird fix mit `p = 0,5` statt mit einer geschaetzten Erfolgswahrscheinlichkeit. Das war
 *    in V3 der groesste ungemessene Parameter (36 Schaetzwerte in GOAL_PROBABILITY): dort war der
 *    Schaetzwert DER PREIS, ein Fehler also eine dauerhafte Etatverzerrung. Hier ist der Preis fest
 *    und die Schaetzung steckt nur noch in der Skala — ein Skalenfehler verschiebt, wie leicht die
 *    Achse faellt, nicht wie viel sie im Erwartungswert wert ist.
 *
 * Diese Datei ist reine Messung: sie liest Zustand und liefert Zahlen. Bepreisung und Auszahlung
 * bleiben im V3-Modell (`sponsorV3Settle`), damit es weiterhin genau EINE Rechenstelle gibt.
 */
import type { GameState } from "@/lib/data/olyDataTypes";
import {
  ENTWICKLUNG_ATTRIBUT_PUNKTE,
  zaehleEntwickelteSpieler,
} from "@/lib/progression/spieler-entwicklung-zaehler";
import { FACILITY_CATALOG } from "@/lib/facilities/facility-catalog";
import { getFacilityLevel, getTeamFacilityState } from "@/lib/facilities/facility-effects";
import { DEFAULT_ROSTER_MAX, FIXED_ROSTER_MIN } from "@/lib/foundation/roster-limits";
import { buildTeamSeasonOverviewRows } from "@/lib/foundation/team-management-overview";
import {
  SPONSOR_V4_AXIS_KEYS, type SponsorV4AxisKey, type SponsorV4AxisTerms,
} from "@/lib/sponsor/sponsor-v3-model";

export { SPONSOR_V4_AXIS_KEYS };
export type { SponsorV4AxisKey, SponsorV4AxisTerms };

/** Der `specialKey`, unter dem eine Achse als Komponente im Vertrag steht. */
export const sponsorV4AxisSpecialKey = (key: SponsorV4AxisKey): string => `axis_v4_${key}`;

/** Liest die Achse aus einem specialKey zurueck — null, wenn es keine Achsen-Komponente ist. */
export function sponsorV4AxisKeyFromSpecialKey(specialKey: string | null | undefined): SponsorV4AxisKey | null {
  const match = /^axis_v4_(.+)$/.exec(specialKey ?? "");
  const key = match?.[1];
  return key && (SPONSOR_V4_AXIS_KEYS as readonly string[]).includes(key) ? (key as SponsorV4AxisKey) : null;
}

type SponsorV4AxisDefinition = {
  key: SponsorV4AxisKey;
  label: string;
  /** Einheit der Messgroesse — fuer Karten- und Settlement-Text. */
  unit: string;
  /**
   * WAS GENAU GEZAEHLT WIRD, in einem Satz und in Nutzersprache.
   *
   * Gemeldet von Chris: „Ziele muessen klarer formuliert sein — was bedeutet 20 Sprünge? Sind damit
   * 20 SP gemeint, die die Spieler erreichen muessen? Und ist das brutto oder netto nach Regression?"
   *
   * Vorher stand auf JEDER Karte derselbe Sammelsatz („X Einheiten Zuwachs gegenueber dem eigenen
   * Saisonstart"). Der war fuer manche Achsen sogar sachlich falsch: `entwicklung` hat gar keine
   * Ausgangslage (`baseline: () => 0`), es gibt also nichts, wogegen „gegenueber dem Saisonstart"
   * gemessen wuerde. Und die Einheit allein sagt nie, WAS springt oder waechst.
   *
   * `{ziel}` wird beim Anzeigen durch den Zielwert samt Einheit ersetzt.
   */
  erklaerung: string;
  /**
   * Zielmarke, wenn ein Vertrag keine eigene mitfuehrt (Altvertraege ohne `axisscale`).
   * Fuer NEUE Angebote entscheidet `scaleFor`, sofern die Achse eines hat.
   */
  scale: number;
  /**
   * TEAMABHAENGIGE ZIELMARKE — der Grund, warum es sie gibt, steht bei `entwicklung`.
   *
   * Eine feste Zahl ist fuer jede Achse richtig, deren Messgroesse nach oben offen ist (Cash,
   * Prozent, Gebaeudestufen). Sobald die Messgroesse an einer Obergrenze des Spiels haengt — der
   * Kader hat hoechstens `DEFAULT_ROSTER_MAX` Spieler — kann eine feste Zahl ueber diese Grenze
   * hinauslaufen und verspricht dann etwas, das kein Team einloesen kann.
   */
  scaleFor?: (gameState: GameState, teamId: string) => number;
  offset: number;
  /** Ausgangswert bei Angebotserzeugung. 0, wenn die Achse ohnehin nur Saisonzuwachs zaehlt. */
  baseline: (gameState: GameState, teamId: string) => number;
  /** Rohe Messgroesse am Messzeitpunkt, gegen die eingefrorene Ausgangslage gerechnet. */
  metric: (gameState: GameState, teamId: string, baseline: number) => number;
  /**
   * Wird die Achse diesem Team ueberhaupt angeboten? GEFILTERT STATT GEKLAMMERT — eine Achse, die
   * ein Team gar nicht bewegen kann, darf nicht als wertlose Karte im Slate liegen.
   */
  offerable: (gameState: GameState, teamId: string) => boolean;
};

function teamMarketValue(gameState: GameState, teamId: string): number {
  const row = buildTeamSeasonOverviewRows({ gameState }).find((entry) => entry.teamId === teamId);
  return row?.marketValueTotal ?? 0;
}

/** Summe aller Gebaeudestufen eines Teams — ueber den ganzen Katalog, nicht nur die Einkommensbauten. */
function facilityLevelSum(gameState: GameState, teamId: string): number {
  const facilities = getTeamFacilityState(gameState, teamId);
  return FACILITY_CATALOG.reduce((sum, entry) => sum + getFacilityLevel(facilities, entry.facilityId), 0);
}

function facilityLevelHeadroom(gameState: GameState, teamId: string): number {
  const facilities = getTeamFacilityState(gameState, teamId);
  return FACILITY_CATALOG.reduce(
    (sum, entry) => sum + Math.max(0, entry.maxLevel - getFacilityLevel(facilities, entry.facilityId)),
    0,
  );
}

/**
 * Nettofinanzposition: Kasse minus alles, was noch zurueckzuzahlen ist.
 *
 * Hier stand frueher zusaetzlich der SPONSOR-VORSCHUSS als Verbindlichkeit. Er musste mitzaehlen,
 * weil er bei Unterschrift die Kasse hob und am Saisonende samt Gebuehr wieder abgezogen wurde:
 * ohne den Abzug waere "Solidität + Vorschuss" ein Selbstlaeufer gewesen — das blosse Unterschreiben
 * haette die Achse zu einem guten Teil ohne jede Leistung bezahlt (gemessen 5,2 C fuer 0,7 C
 * Gebuehr). Den Vorschuss gibt es nicht mehr, also gibt es auch diese Verbindlichkeit nicht mehr,
 * und das Schlupfloch kann gar nicht erst entstehen: Unterschreiben bewegt kein Geld.
 *
 * BEWUSST AUCH FUER ALTVERTRAEGE: ein Vertrag aus einem laufenden Spiel kann das `advance`-Feld noch
 * tragen. Es wird hier NICHT mehr gelesen, weil der Betrag auch nicht mehr zurueckgefordert wird —
 * eine Schuld auszuweisen, die niemand mehr eintreibt, waere die Drift, die wir gerade abstellen.
 */
function netFinancialPosition(gameState: GameState, teamId: string): number {
  const cash = gameState.teams.find((team) => team.teamId === teamId)?.cash ?? 0;
  const debt = (gameState.seasonState.loans ?? [])
    .filter((loan) => loan.borrowerTeamId === teamId && loan.status === "active")
    .reduce((sum, loan) => sum + (loan.principalOutstanding ?? 0), 0);
  return cash - debt;
}

// Schwelle und Zaehlung liegen in `lib/progression/spieler-entwicklung-zaehler.ts` — dieselbe
// Stelle benutzt das Sonderziel `golden_talent_forge`. Der Befund, warum die alte
// Marktwert-Rechnung ersetzt wurde, steht im Kopf jener Datei.
/** Match-Fatigue, bis zu der ein Spieler als frisch zaehlt — dieselbe Grenze wie fatigue_management. */
const AXIS_FRESH_FATIGUE_CAP = 45;

/**
 * Steht der Kaderaufbau eines neuen Spiels noch aus?
 *
 * Gebraucht, um zwei Zustaende zu trennen, die beide „keine Kaderzeilen" heissen und doch das
 * Gegenteil bedeuten: „der Liga-Draft ist noch nicht gelaufen" (jedes Team bekommt einen Kader)
 * gegen „dieses Team hat keinen" (die kaderbezogenen Achsen sind fuer es sinnlos).
 *
 * Der Neues-Spiel-Ablauf haelt genau das fest. Solange sein `fill_roster`-Schritt offen ist,
 * ist ein leerer Kader eine Reihenfolge und kein Befund.
 */
function isRosterFillPending(gameState: GameState): boolean {
  const flow = gameState.seasonState.newGameFlow;
  if (!flow?.active || flow.dismissed) return false;
  // Nur „open" heisst ausstehend. „completed" und „skipped" heissen beide: der Kaderaufbau
  // findet nicht (mehr) statt — ein leerer Kader ist dann ein echter Befund.
  return (flow.steps ?? []).some((step) => step.stepId === "fill_roster" && step.status === "open");
}

/**
 * Zahl der Spieler mit echtem Attribut-Zuwachs — siehe `spieler-entwicklung-zaehler.ts`.
 *
 * Hier stand bis zum 19.08.2026 eine eigene Marktwert-Rechnung. Sie mass den absoluten Marktwert
 * statt eines Zuwachses, weil `progressionSnapshotBefore.marketValue` in ALLEN gemessenen 1017
 * Ereignissen 0 war (Meldung `u3wlh4`).
 */
function talentJumpCount(gameState: GameState, teamId: string): number {
  return zaehleEntwickelteSpieler(gameState, teamId);
}

function freshSharePct(gameState: GameState, teamId: string): number {
  const rosterIds = new Set(
    gameState.rosters.filter((entry) => entry.teamId === teamId).map((entry) => entry.playerId),
  );
  if (rosterIds.size === 0) return 0;
  // Dieselbe Fatigue-Quelle, gegen die auch die Mechanik rechnet: die reine Match-Fatigue aus
  // playerAvailabilityState. `player.fatigue` traegt zusaetzlich die Trainingsschicht und wuerde
  // eine andere Groesse messen als die, die das Team tatsaechlich steuert.
  const availabilityFatigueByPlayerId = new Map<string, number>();
  for (const entry of gameState.seasonState.playerAvailabilityState ?? []) {
    if (entry.teamId === teamId) availabilityFatigueByPlayerId.set(entry.playerId, entry.fatigue);
  }
  const fresh = gameState.players.filter((player) => {
    if (!rosterIds.has(player.id)) return false;
    const availabilityFatigue = availabilityFatigueByPlayerId.get(player.id);
    const matchFatigue =
      typeof availabilityFatigue === "number"
        ? availabilityFatigue
        : typeof player.fatigue === "number"
          ? player.fatigue
          : 0;
    return matchFatigue <= AXIS_FRESH_FATIGUE_CAP;
  }).length;
  return (100 * fresh) / rosterIds.size;
}

/**
 * DIE FUENF ACHSEN.
 *
 * Die Skalen sind DESIGNWERTE, kalibriert gegen eine komplett durchgespielte Saison 1 (32 Teams,
 * `scripts/sponsor-achsen-messung.ts`, Befund in `docs/analyse/sponsor-achsen-messung.md`). Ein
 * Skalenfehler verschiebt nur, wie leicht eine Achse faellt — der Erwartungswert haengt an `p = 0,5`
 * und bleibt davon unberuehrt. Zielkorridor der Ø Erfuellung (= Trefferquote gegen `p = 0,5`):
 * 35 bis 65 %, Anker ist die Stelle, an der etwa die Haelfte der gemessenen Vertraege landet.
 *
 * `entwicklung` (Ziel 3 → 20 Sprünge) und `soliditaet` (Ziel 30 → 110 C) wurden nachkalibriert, weil
 * die alten Ziele bei 100 % bzw. 99,3 % Ø Erfuellung lagen (siehe „Nachkalibrierung" im Messdokument).
 * `kaderpflege` lag mit 44,3 % bereits im Korridor und blieb unveraendert. `wachstum` wird ab
 * Saison 1 nicht mehr angeboten (siehe Kommentar dort) statt mit geratenen Skalenwerten kalibriert.
 * `ausbau` hat mit n = 0 keine Messgrundlage und blieb unveraendert.
 */
const SPONSOR_V4_AXIS_DEFINITIONS: Readonly<Record<SponsorV4AxisKey, SponsorV4AxisDefinition>> = {
  wachstum: {
    key: "wachstum",
    label: "Kaderwert",
    unit: "%",
    erklaerung:
      "Dein Kader soll am Saisonende {ziel} mehr wert sein als beim Vertragsabschluss. Gemessen am " +
      "Gesamt-Marktwert, prozentual — damit ein kleiner Kader dieselbe Chance hat wie ein großer.",
    // 12 Prozent Kaderwert-Zuwachs. Prozentual gemessen, damit ein kleiner Kader dieselbe Chance hat
    // wie ein grosser — absolut waere die Achse ein verkappter Reichtums-Bonus.
    //
    // UNVERAENDERT GELASSEN, NICHT KALIBRIERT — die gemessene Saison-1-Verteilung (6 Vertraege, Ø
    // Rohmetrik −29,91 %, kein einziger positiv) ist kein Skalenproblem. Ursache: der Kaderwert
    // eines Teams (`teamMarketValue`) liest `player.marketValue`. Direkt nach dem Draft steht dort
    // die HEURISTISCHE Draft-Schaetzung (`commit-draft-to-free-agent.ts`, Kommentar dort: "the
    // draft's heuristic estimate"), noch nicht gegen die Liga gerankt. Am Saisonende (nach dem
    // letzten Spieltag, `season-end-xp-apply-service.ts` → `applyRankTableMarketValuesToGameState`)
    // wird `player.marketValue` fuer JEDEN Spieler einmalig durch den rang-basierten Wert ersetzt
    // (`calculateMarketValueFromRankTable`, `league-market-value-snapshot.ts`) — eine andere, nicht
    // vergleichbare Bewertungsmethode. Die Vertrags-Baseline (bei Preseason-Angebot eingefroren)
    // steht damit auf der heuristischen Skala, der Endwert auf der rang-basierten — der gemessene
    // Einbruch ist ueberwiegend ein Methodenwechsel, keine reale Kaderwert-Entwicklung.
    //
    // Das trifft NUR Saison 1: ab Saison 2 ist die Baseline selbst schon rang-basiert (vom Vorjahres-
    // Saisonende), Baseline und Endwert nutzen dieselbe Methode. Fuer S2+ liegen keine Messdaten vor
    // — eine Skala zu raten waere Ratenkalibrierung, siehe Dateikopf-Kommentar. Deshalb: Achse bleibt
    // auf Zielwert 12 % stehen, wird aber in Saison 1 gar nicht mehr angeboten (`offerable` unten).
    // Fuer das historische Vorbild einer eigenen S1-Leiter siehe `resolveMarketValueGrowthStages` in
    // `sponsor-special-objectives.ts` (Stand vor PR #361 / Commit 3efa6801^) — dort war "S1 hat keinen
    // Transfermarkt, nur organisches Training" bereits als eigener Fall behandelt, allerdings ohne
    // den hier gefundenen Methodenwechsel-Effekt, der deutlich groesser ist als reine Trainingsdaempfung.
    scale: 12,
    offset: 0,
    baseline: (gameState, teamId) => teamMarketValue(gameState, teamId),
    metric: (gameState, teamId, baseline) =>
      baseline > 0 ? (100 * (teamMarketValue(gameState, teamId) - baseline)) / baseline : 0,
    // Saison 1 ausgenommen — siehe Begruendung oben.
    offerable: (gameState, teamId) => gameState.season.id !== "season-1" && teamMarketValue(gameState, teamId) > 0,
  },
  ausbau: {
    key: "ausbau",
    label: "Ausbau",
    unit: "Stufen",
    erklaerung:
      "Bau deine Gebäude bis Saisonende um insgesamt {ziel} aus. Gezählt wird die Summe über alle " +
      "Gebäude — welches du ausbaust, ist egal.",
    // UNVERAENDERT — n = 0 in der gemessenen Saison ist keine Messgrundlage fuer eine Skala.
    // Kurz nachgeschaut, warum: `offerable` war fuer alle 32 Teams true (Headroom 37–40 von 40
    // Gebaeudestufen), und die Slate-Ziehung (`rollSponsorOfferSlate`) hat die Achse nur bei 7 von 32
    // Teams aus dem 5-Slot-Angebot herausrotiert — 25 Teams hatten die Karte also im Angebot. Trotzdem
    // hat sie kein einziges Team unterschrieben. Der Ausschluss liegt also nicht in `offerable`, aus
    // dieser Datei, sondern vermutlich in der KI-Angebotswahl (`scoreOfferForAi` /
    // `chooseSponsorOfferForAiTeams` in `sponsor-offer-service.ts`) oder in der Kartengroesse
    // (`goalSize`) der Achse — nicht weiter untersucht, siehe docs/analyse/sponsor-achsen-messung.md.
    scale: 2,
    offset: 0,
    baseline: (gameState, teamId) => facilityLevelSum(gameState, teamId),
    metric: (gameState, teamId, baseline) => facilityLevelSum(gameState, teamId) - baseline,
    // Ohne Ausbauspielraum waere die Achse unerfuellbar — dann wird sie gar nicht erst angeboten.
    offerable: (gameState, teamId) => facilityLevelHeadroom(gameState, teamId) >= 2,
  },
  soliditaet: {
    key: "soliditaet",
    label: "Solidität",
    unit: "C",
    erklaerung:
      "Steh am Saisonende {ziel} besser da als beim Vertragsabschluss. Gerechnet wird Cash minus " +
      "laufende Kredite.",
    // Nullpunkt bei -10: ein Team darf ein moderates Minus fahren und liegt trotzdem nicht bei 0.
    // Ziel nachkalibriert 30 → 110 C (2026-08-03): bei 30 C lagen 9 von 10 gemessenen Vertraegen bei
    // voller Erfuellung (Ø 99,3 %, Rohmetrik-Median 44,7 C, Spanne 27,3–117,0 C). Bei 110 C liegt die
    // Ø Erfuellung derselben zehn Vertraege bei 56,1 % — im Zielkorridor 35–65 %. Siehe
    // docs/analyse/sponsor-achsen-messung.md, Abschnitt „Nachkalibrierung".
    scale: 120,
    offset: 10,
    baseline: (gameState, teamId) => netFinancialPosition(gameState, teamId),
    metric: (gameState, teamId, baseline) => netFinancialPosition(gameState, teamId) - baseline,
    offerable: () => true,
  },
  entwicklung: {
    key: "entwicklung",
    label: "Entwicklung",
    // Einheit war "Sprünge" — genau das Wort, das Chris nicht deuten konnte ("sind das 20 SP?").
    // Gezaehlt werden Spieler, also heisst die Einheit auch so. Die Einheit steht auch im
    // Abrechnungstext, dort liest sich "20 Spieler" ebenso richtig.
    unit: "Spieler",
    erklaerung:
      "{ziel} sollen über die Saison mindestens " + String(ENTWICKLUNG_ATTRIBUT_PUNKTE) +
      " Attributpunkte dazugewinnen — über alle Werte zusammen, Rückschritte abgezogen. " +
      "Gezählt werden Spieler, nicht Punkte: wer in zwei Werten zulegt, zählt einmal.",
    /**
     * ZIEL 20 → 8, zusammen mit dem Wechsel der Messgröße auf Attributpunkte (Meldung `u3wlh4`,
     * Chris' Entscheidung nach dem Befund).
     *
     * ZWEI FEHLER LAGEN HIER ÜBEREINANDER:
     *
     *  1. Gemessen wurde der MARKTWERT, und zwar gegen einen Ausgangswert, der in allen 1017
     *     geprüften Ereignissen 0 war — die Achse zählte „Spieler mit Marktwert über 6", also
     *     praktisch den ganzen Kader. Behoben durch `zaehleEntwickelteSpieler`.
     *  2. Das Ziel 20 lag ÜBER der Kadergrenze `DEFAULT_ROSTER_MAX` = 14. Volle Erfüllung war
     *     selbst dann unmöglich, wenn jeder Spieler springt — Chris' „20 spieler kann man gar
     *     nicht haben" traf zu.
     *
     * NEU GEMESSEN über einen Sweep aus Schwelle × Ziel (1017 Spieler, drei Live-Spielstände,
     * Teams ohne Treffer als 0 mitgezählt):
     *
     *   Schwelle (Attributpunkte)  0,5    1    1,5    2    2,5     3     4     5
     *   Median Spieler je Team       6    6      5    4      3     2     1     1
     *   Maximum                     12   12     12   11     10     9     6     3
     *   Ziel (2× Median, ≤ 14)      12   12     10    8      6     4     2     2
     *   Ø Erfüllung                56%  49%    49%  49%    49%   54%   54%   33%
     *
     * Gewählt: Schwelle 2, Ziel 8 — Ø Erfüllung 49 %, mittig im Korridor 35–65 %, Ziel deutlich
     * unter der Kadergrenze UND vom höchsten gemessenen Wert (11) tatsächlich übertroffen. Die
     * Schwelle liegt zwischen Median (1,3) und p75 (2,8) der Zuwachsverteilung: darunter wäre sie
     * wieder wirkungslos, darüber träfe sie nur Ausreißer.
     */
    scale: 8,

    /**
     * KEIN `scaleFor` MEHR — bewusst, und das ist die Aufloesung eines echten Widerspruchs.
     *
     * Auf `main` bekam diese Achse zwischenzeitlich eine kadergroessen-abhaengige Marke
     * (`scaleFor: min(14, max(8, Kadergroesse))`). Sie war die richtige Antwort auf den DAMALIGEN
     * Fehler: das Ziel 20 lag ueber `DEFAULT_ROSTER_MAX` = 14, war also fuer jeden Kader
     * unerreichbar, und der Kommentar dort hielt ausdruecklich fest, dass die MESSGROESSE noch
     * offen ist und in dieser Aenderung entschieden wird.
     *
     * Mit der Umstellung auf Attributpunkte ist sie es. Und dann traegt `scaleFor` den Fehler
     * wieder herein: gemessen ueber 1017 Ereignisse erreicht das BESTE Team 11 entwickelte
     * Spieler, der Median 4. Ein Kader mit 14 Spielern bekaeme mit `scaleFor` die Marke 14 — die
     * kein Team der Liga je erreicht hat — und ein Kader mit 8 Spielern die Marke 8, also
     * dieselbe, die hier ohnehin steht. Die Kadergroesse skaliert die Marke also genau in die
     * falsche Richtung: sie bestraft den grossen Kader fuer seine Groesse.
     *
     * Die feste 8 ist an der Verteilung gemessen (2x Median, unter der Kadergrenze, vom Maximum
     * uebertroffen) und trifft grosse wie kleine Kader gleich.
     */
    offset: 0,
    // Zaehlt nur den Saisonzuwachs — es gibt keinen Ausgangsbestand, gegen den zu messen waere.
    baseline: () => 0,
    metric: (gameState, teamId) => talentJumpCount(gameState, teamId),
    offerable: () => true,
  },
  kaderpflege: {
    key: "kaderpflege",
    label: "Frische",
    unit: "%",
    erklaerung:
      "{ziel} deines Kaders sollen am Saisonende frisch sein. Frisch heißt Match-Fatigue höchstens " +
      String(AXIS_FRESH_FATIGUE_CAP) + "; unter 40 % zählt die Achse gar nicht.",
    // 40 % frischer Kader ist der Nullpunkt, 90 % die volle Erfuellung.
    scale: 50,
    offset: -40,
    baseline: () => 0,
    metric: (gameState, teamId) => freshSharePct(gameState, teamId),
    /**
     * „Hat dieses Team einen Kader?" — aber nicht zum Zeitpunkt des Spielaufbaus.
     *
     * BEFUND: Die Angebote eines neuen Spiels entstehen in `buildNewGameStateFromBaseline`, und
     * dort ist `rosters: []` — der Liga-Draft laeuft erst im spaeteren Flow-Schritt
     * `fill_roster`. Diese Achse fiel damit fuer JEDES Team aus dem Angebot. Zusammen mit dem
     * Saison-1-Ausschluss von `wachstum` blieben nur drei angebotsfaehige Achsen uebrig, und der
     * Deckel `min(5, 1 + Achsen)` in `rollSponsorOfferSlate` lieferte 4 statt 5 Karten.
     *
     * Der Schaden bleibt: Direkt nach dem Seeden unterschreiben die KI-Teams
     * (`chooseSponsorOfferForAiTeams`), und unterschriebene Angebote werden nie neu gebaut
     * (`ensureSeasonSponsorOffers` uebergeht Teams mit Vertrag). Eine ganze Achse fehlte damit
     * dauerhaft aus der Sponsorwahl aller 31 KI-Teams in Saison 1.
     *
     * Der Deckel selbst ist richtig — zwei Karten auf derselben Achse waeren keine Wahl. Falsch
     * war die Frage: Waehrend des Spielaufbaus hat NIEMAND einen Kader, und jedes Team bekommt
     * einen. Ein leerer Kader heisst dort „noch nicht ausgelost", nicht „dieses Team kann die
     * Achse nicht bewegen".
     *
     * Woran das haengt: am `fill_roster`-Schritt des Neues-Spiel-Ablaufs, nicht daran, ob die
     * Liga zufaellig gerade leer aussieht. Ein erster Versuch hatte auf `rosters.length === 0`
     * geprueft — das trifft aber auch den echten Fall „EIN Team ohne Kader", wenn ihn jemand
     * isoliert betrachtet, und genau den soll die Achse weiterhin ausschliessen. Der Ablauf sagt
     * es dagegen eindeutig: Solange der Kaderaufbau aussteht, ist ein leerer Kader kein Befund.
     */
    offerable: (gameState, teamId) =>
      isRosterFillPending(gameState) || gameState.rosters.some((entry) => entry.teamId === teamId),
  },
};

export function sponsorV4AxisDefinition(key: SponsorV4AxisKey): SponsorV4AxisDefinition {
  return SPONSOR_V4_AXIS_DEFINITIONS[key];
}

export function sponsorV4AxisLabel(key: SponsorV4AxisKey): string {
  return SPONSOR_V4_AXIS_DEFINITIONS[key].label;
}

/** Achsen, die diesem Team ueberhaupt angeboten werden duerfen. */
export function sponsorV4OfferableAxes(gameState: GameState, teamId: string): SponsorV4AxisKey[] {
  return SPONSOR_V4_AXIS_KEYS.filter((key) => SPONSOR_V4_AXIS_DEFINITIONS[key].offerable(gameState, teamId));
}

/** Die bei Angebotserzeugung einzufrierenden Konditionen einer Achse. */
export function buildSponsorV4AxisTerms(
  gameState: GameState, teamId: string, key: SponsorV4AxisKey,
): SponsorV4AxisTerms {
  const definition = SPONSOR_V4_AXIS_DEFINITIONS[key];
  return {
    key,
    baseline: Math.round(definition.baseline(gameState, teamId) * 100) / 100,
    scale: definition.scaleFor?.(gameState, teamId) ?? definition.scale,
    offset: definition.offset,
  };
}

export type SponsorV4AxisProgress = {
  key: SponsorV4AxisKey;
  label: string;
  /** Erfuellungsgrad 0..1 — genau der Wert, mit dem das Settlement rechnet. */
  fraction: number;
  /** Rohe Messgroesse, fuer die Anzeige. */
  metric: number;
  /** Messgroesse, die volle Erfuellung bedeutet. */
  target: number;
  unit: string;
};

/**
 * DER ERFUELLUNGSGRAD EINER ACHSE. Die eine Stelle, an der aus Spielzustand eine Zahl 0..1 wird —
 * Karte, Anzeige und Settlement lesen alle hier, damit sie nicht auseinanderlaufen koennen.
 */
export function evaluateSponsorV4Axis(
  gameState: GameState, teamId: string, terms: SponsorV4AxisTerms,
): SponsorV4AxisProgress {
  const definition = SPONSOR_V4_AXIS_DEFINITIONS[terms.key];
  const scale = Number.isFinite(terms.scale) && terms.scale > 0 ? terms.scale : definition.scale;
  const offset = Number.isFinite(terms.offset) ? terms.offset : definition.offset;
  const metric = definition.metric(gameState, teamId, terms.baseline);
  const raw = (metric + offset) / scale;
  return {
    key: terms.key,
    label: definition.label,
    fraction: Math.max(0, Math.min(1, Number.isFinite(raw) ? raw : 0)),
    metric: Math.round(metric * 100) / 100,
    target: Math.round((scale - offset) * 100) / 100,
    unit: definition.unit,
  };
}
