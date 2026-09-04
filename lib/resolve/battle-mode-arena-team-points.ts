/**
 * BATTLE-MODE-ARENA-TEAM-PUNKTE (PR 7 von 9, docs/design/battle-mode-spielmodus-plan.md,
 * Abschnitt 3.3c, ENTSCHIEDEN in Abschnitt 5.1 am 30.08.).
 *
 * WICHTIGE KORREKTUR GEGENUEBER DEM URSPRUENGLICHEN PLAN-TEXT (Abschnitt 3.3c): der Plan-Text
 * schlug vor, aus den 8 Arena-Duellen einer Liga einen synthetischen 1..16-Rang zu bauen und den
 * durch die bestehende `getRankToPointsValue()`-Tabelle laufen zu lassen. Abschnitt 5.1 haelt fest,
 * dass Chris das AM 30.08. anders entschieden hat, VOR PR4/5/6: Battle Mode bekommt eine EIGENE,
 * von `getRankToPointsValue()` VOLLSTAENDIG ENTKOPPELTE Team-Punkteskala: Sieg = 2, Unentschieden
 * = 1, Niederlage = 0 ("Das ist gesetzt."). Kein Rang 1..16, keine Punktdifferenz-Sortierung fuer
 * die Punktevergabe selbst (Punktdifferenz bleibt fuer Tie-Breaking/Anzeige nutzbar, s.
 * `ArenaTeamPointsOverride.seiten`).
 *
 * BOXSCORE-AN-PPS (docs/design/boxscore-an-pps.md, Nachtrag zu PR7) — INZWISCHEN AUF V2
 * UMGESTELLT (docs/design/pps-skalierung-opus.md, docs/design/pps-skalierung-umsetzung.md, 03.09.):
 * die individuellen Spieler-PPs sind SEIT dem Boxscore-an-PPS-PR nicht mehr "bewusst noch nicht
 * umgesetzt" — aber das dort gebaute PERZENTIL-Modell hatte einen von Chris konkret benannten
 * Fehler: „es soll nicht in jedem team duell immer ein spieler volle punktzahl bekommen". Ein
 * Perzentil GEGEN DEN POOL DESSELBEN SPIELTAGS hat strukturell immer einen Spieler nahe 100 %,
 * unabhaengig davon, ob der Spieltag stark oder schwach war (nachgemessen im Opus-Dokument: Impact
 * 33,5 UND Impact 67,4 — das Doppelte — bekamen beide ~6,5 von 6,6). `percentileOf()` ist deshalb
 * ERSATZLOS ENTFERNT (kein anderer Aufrufer im Repo).
 *
 * DAS V2-MODELL — die Impact-Kurve (Opus-Dokument Abschnitt 4, dort hergeleitet und an 400 echten
 * Simulationen belegt):
 *
 *   1. ROHWERT JE SPIELER: unveraendert `ArenaFixtureBoxscoreEintrag.wert` — exakt der Wert, den
 *      der Mockup-Motor selbst als "Impact" anzeigt (`MOTOREN[fd].wert()`), kein zweiter Rechenweg.
 *   2. KEIN POOL MEHR. Der Rohwert wird gegen eine FESTE, EINMALIG GEZOGENE Referenzverteilung
 *      verglichen (`data/generated/basketball-pps-referenz.json`, gebaut von
 *      `scripts/ziehe-basketball-pps-referenz.ts` gegen echte Liga-Kader aus dem `live-save`-
 *      Abbild, s. dort) — NICHT gegen den Pool des aktuellen Spieltags. Das macht die PPs eines
 *      Spielers unabhaengig davon, wie stark oder schwach die ÜBRIGEN Duelle desselben Spieltags
 *      liefen.
 *   3. JE FELDGROESSE GETRENNT. Die Referenz haelt eigene `iMittel`/`iKrass`-Werte fuer
 *      `playerCount` 2..6 (Opus-Dokument Abschnitt 7: derselbe Rohwert bedeutet bei 2v2 etwas
 *      voellig anderes als bei 6v6 — Median-Impact 33,5 gegen 11,1). `resolveBasketballPpsReferenz()`
 *      loest die fuer DIESEN Spieltag gewuerfelte Feldgroesse auf (ueber `disciplineSchedule`,
 *      genau wie `resolveDisciplinePlayerCount()` in `rank-to-points.ts`, hier aber ohne die
 *      d1/d2-Seite vorher wissen zu muessen) und faellt auf die naechstgelegene bekannte
 *      Feldgroesse zurueck, falls sie unbekannt/nicht in der Referenz ist.
 *   4. DIE KURVE: `PPs = MAX * min(1, (max(0, I) / I_krass)^gamma)`, mit
 *      `gamma = ln(a_mitte) / ln(I_mittel / I_krass)` — geht per Konstruktion durch
 *      (I_mittel -> a_mitte*MAX) und (I_krass -> MAX). Siehe `ppsAusBasketballImpact()` unten und
 *      Opus-Dokument Abschnitt 4.1 fuer die volle Herleitung/Begruendung (Deckel statt Asymptote,
 *      Boden bei 0, zwei benannte Anker statt frei getunter Zahlen).
 *
 * `BASKETBALL_INDIVIDUAL_PPS_MAX` (5,5, vorher 6,6) und `BASKETBALL_PPS_ANTEIL_MITTE` (0,25, neu)
 * sind — wie im Auftrag verlangt — die EINZIGEN zwei freien Regler, s. deren eigene Kommentare.
 *
 * DIE VON OPUS BENANNTE, BEWUSST NICHT ZUSAETZLICH GEDAEMPFTE NEBENWIRKUNG (Opus-Dokument
 * Abschnitt 7.1): tritt eine Seite in Unterzahl an (z.B. 3v6, von Chris ausdruecklich erlaubt),
 * bekommt die UEBERZAHL-Seite spuerbar mehr PPs als in einem regulaeren Duell derselben
 * Feldgroesse (gemessen: Team-Summe +42 %, Anteil mit voller Punktzahl 15 % statt 1,7 %) — weil die
 * Referenz weiterhin nach der GEWUERFELTEN Feldgroesse schluesselt, nicht nach der tatsaechlich
 * gefelderten. Das ist teilweise gerechtfertigt (wer gegen ein halbes Team spielt, hat oft wirklich
 * mehr geleistet) und Opus' eigene Empfehlung ist ausdruecklich "erste Umsetzung ohne Daempfer,
 * aber dokumentiert" — genau das ist hier umgesetzt. Ein spaeterer Daempfer waere eine lokale
 * Aenderung an `ppsAusBasketballImpact()`/`computeIndividualBoxscorePpsFromFixtureResults()`, kein
 * Umbau.
 *
 * WAS AUS DER V1-RUNDE UNVERAENDERT GILT (`battle-mode-pps-modell-plan.md` Abschnitt 7):
 *   - Frage 3 (nur eingesetzte Spieler, nicht nominierte Bank): unveraendert — nur Boxscore-
 *     Eintraege mit eindeutig zugeordneter `playerId` bekommen PPs, s. `arena-headless-runner.ts`.
 *   - Frage 6 (Rolling-Historie ueber mehrere Spieltage/Saisons): weiterhin NICHT umgesetzt —
 *     unveraendert ausserhalb dieser Aenderung (Opus-Dokument Abschnitt 8.4 begruendet das erneut:
 *     eine feste Referenz ist reproduzierbar, eine rollende Historie waere vom Spielstand abhaengig).
 *   - Frage 7 (fliessen diese PPs in dieselben Saison-Ledger/Progressions-Toepfe wie PPS-PPs?):
 *     weiterhin NICHT beantwortet, s. docs/design/boxscore-an-pps.md — diese Aenderung setzt nach
 *     wie vor NUR `pointsAwarded` in der Resolve-Preview.
 *
 * INDIVIDUELLE PPs SIND WEITERHIN ECHT ENTKOPPELT VON DEN TEAM-PUNKTEN (Plan Abschnitt 0/1.1):
 * die Summe der Spieler-PPs eines Teams MUSS nicht mehr `teamPoints` ergeben. Das ist gewollt,
 * nicht vergessen.
 *
 * GEWICHTHEBEN-PRODUKTIVIERUNG (S6, docs/design/gewichtheben-produktivierung.md, 04.09.):
 * Gewichtheben ist die zweite Arena-aufgeloeste Disziplin. Die drei bis dahin auf den String
 * "basketball" HARDCODIERTEN Stellen in `runBattleModeArenaMatchday()` (der Aufruf von
 * `runArenaFixtures()`, die Feldgroessen-Aufloesung und die individuelle-PPs-Berechnung) sind
 * durch einen `disciplineId`-Parameter ersetzt, den der Aufrufer explizit reicht -- s.
 * `arena-matchday-resolve-service.ts`, `determineArenaDisciplineContexts()`, die ihn ueber
 * `ARENA_RESOLVED_DISCIPLINE_IDS`-Mengen-Zugehoerigkeit (nicht per Disziplins-Literal) ermittelt.
 * Das macht jede WEITERE Arena-Disziplin (Hockey war die naechste, s. unten) zu einer reinen
 * Konfigurationsaenderung (Eintrag in `ARENA_RESOLVED_DISCIPLINE_IDS` plus eigene
 * PPS-Referenz/Kurvenkonstanten, s. `ARENA_IMPACT_KONFIG_JE_DISZIPLIN` unten) statt eines
 * zweiten Sonderfalls neben Basketball.
 *
 * Die Impact-Kurve selbst (`ppsAusArenaImpact()`, umbenannt aus `ppsAusBasketballImpact()`,
 * s. dort) ist UNVERAENDERT dieselbe Formel -- nur `MAX`/`ANTEIL_MITTE`/die Referenzverteilung
 * sind jetzt je Disziplin parametrisiert statt fest verdrahtet. `ppsAusBasketballImpact()`
 * bleibt als benannter Wrapper mit Basketballs Konstanten exportiert (Testkompatibilitaet,
 * unveraendertes Verhalten).
 *
 * HOCKEY-PRODUKTIVIERUNG (docs/design/hockey-produktivierung.md, 04.09.): dritte Arena-
 * aufgeloeste Disziplin, GENAU DIE reine Konfigurationsaenderung, die der Kommentar oben
 * vorhersagt -- kein neuer Chassis-Dispatch (Hockey nutzt wie Basketball das bestehende
 * Feldspiel-Chassis, `ARENA_BUEHNE_HEBEN_DISCIPLINE_IDS` bleibt unveraendert), keine neue
 * Verzweigung in `ppsAusArenaImpact()`. NUR EINE STRUKTURELLE ERGAENZUNG war noetig, und sie
 * ist ausdruecklich additiv: Hockeys Torwart hat eine EIGENE Wertformel (HK_TW_BASIS/HK_TW_REF,
 * battle-mode.engine.js) mit einer strukturell anderen Wertverteilung als seine Feldspieler --
 * EMPIRISCH GEMESSEN (nicht angenommen), dass eine gemeinsame Referenz den Torwart, je nach
 * Feldgroesse, systematisch UNTER- ODER UEBERBEZAHLT haette. `ArenaImpactKonfig` traegt deshalb
 * eine optionale ZWEITE Referenz (`referenzFeldgroessenTorwart`), `resolveArenaPpsReferenz()`
 * einen `rolle`-Parameter ("feld" | "torwart", Default "feld") und `ArenaFixtureBoxscoreEintrag`
 * (arena-headless-runner.ts) ein `torwart`-Feld, direktes Passthrough von `window.__arena.
 * spieleFeldspiel()`s eigenem `torwart`-Flag (battle-mode.engine.js). Fuer Basketball/
 * Gewichtheben (keine Torwart-Rolle, `torwart` an jedem Eintrag `false`/`undefined`) ist das
 * BYTE-IDENTISCHES Verhalten -- `referenzFeldgroessenTorwart` bleibt dort `undefined`,
 * `resolveArenaPpsReferenz(..., "torwart")` faellt defensiv auf die normale Referenz zurueck,
 * ein Fall, der fuer diese beiden Disziplinen nie eintritt.
 *
 * DER GESAMT-KG-TIEBREAK (Fable-Empfehlung 9.1, docs/design/gewichtheben-gameplay-fertig.md
 * Abschnitt 4): ein Duellgleichstand (z.B. 3:3 der sechs Gewichtheben-Duelle) wird NICHT mehr
 * automatisch zum Unentschieden -- `arenaTeamPointsForFixtureMitTiebreak()` vergleicht dann die
 * kumulierte Zweikampf-Kilogrammsumme beider Seiten (`ArenaFixtureResult.gesamtKg`, geliefert
 * von `spieleBuehneHeben()` im Motor). Fuer jede Disziplin OHNE `gesamtKg` (Basketball) bleibt
 * ein Punktegleichstand ein echtes Unentschieden -- unveraendertes Basketball-Verhalten.
 */
import type { LeagueTier } from "@/lib/season/league-split";
import type { Fixture, GameState } from "@/lib/data/olyDataTypes";
import {
  runArenaFixtures,
  ARENA_BUEHNE_HEBEN_DISCIPLINE_IDS,
  type ArenaFixtureInput,
  type ArenaFixtureResult,
  type RunArenaFixturesOptions,
} from "@/lib/battle/arena-headless-runner";
import basketballPpsReferenzJson from "@/data/generated/basketball-pps-referenz.json";
import gewichthebenPpsReferenzJson from "@/data/generated/gewichtheben-pps-referenz.json";
import hockeyPpsReferenzJson from "@/data/generated/hockey-pps-referenz.json";

/**
 * Arena-aufgeloeste Disziplinen (Plan Abschnitt 3.2, Option a, seit der Gewichtheben-
 * Produktivierung erweitert). JEDER Code-Pfad, der wissen muss "wird dieser Spieltag arena-
 * aufgeloest", prueft Mitgliedschaft in DIESER Menge -- nie einen Disziplins-Literal-Vergleich
 * (`=== "basketball"` o.ae.) direkt. Ein Eintrag hier reicht NICHT allein: eine neue Disziplin
 * braucht zusaetzlich einen Eintrag in `ARENA_IMPACT_KONFIG_JE_DISZIPLIN` (individuelle PPs) und,
 * falls sie ein anderes Chassis als Feldspiel/Buehnen-Heben braucht, Motor-Anbindung in
 * `arena-headless-runner.ts`.
 */
export const ARENA_RESOLVED_DISCIPLINE_IDS: ReadonlySet<string> = new Set(["basketball", "gewichtheben", "hockey"]);

/**
 * QUERPRUEFUNG (Review-Fund PR #776): `ARENA_BUEHNE_HEBEN_DISCIPLINE_IDS` (arena-headless-
 * runner.ts) und `ARENA_RESOLVED_DISCIPLINE_IDS` (hier) sind zwei UNABHAENGIG GEPFLEGTE Mengen,
 * die trotzdem eine Teilmengen-Beziehung einhalten MUESSEN: jede Buehnen-Heben-Chassis-Disziplin
 * ist zwangslaeufig auch arena-aufgeloest (das Chassis ist nur fuer eine Disziplin relevant, die
 * ueberhaupt arena-simuliert wird). Ohne diese Pruefung wuerde eine kuenftige Disziplin, die nur
 * in EINER der beiden Mengen landet (Copy-Paste-Fehler beim Hinzufuegen), STILL auf den falschen
 * Chassis-Dispatch fallen: fehlt sie in `ARENA_RESOLVED_DISCIPLINE_IDS`, wird sie nie arena-
 * aufgeloest (der Fehler bliebe unbemerkt, bis jemand fragt, warum die Disziplin nicht ankommt);
 * fehlt sie umgekehrt (waere hier nicht der Fall, aber symmetrisch denkbar bei einem dritten
 * Chassis) in `ARENA_BUEHNE_HEBEN_DISCIPLINE_IDS`, wuerde `runArenaFixtures()` faelschlich
 * `spieleFeldspiel()` statt eines Buehnen-Einstiegspunkts aufrufen und mit der (jetzt korrigierten,
 * s. `arena-headless-runner.ts`) Fehlermeldung "lieferte null" scheitern -- verwirrend statt klar.
 * Wirft SOFORT beim Modul-Laden (Fail-Fast), nicht erst beim ersten betroffenen Spieltag-Resolve.
 */
for (const buehneHebenId of ARENA_BUEHNE_HEBEN_DISCIPLINE_IDS) {
  if (!ARENA_RESOLVED_DISCIPLINE_IDS.has(buehneHebenId)) {
    throw new Error(
      `battle-mode-arena-team-points: "${buehneHebenId}" steht in ARENA_BUEHNE_HEBEN_DISCIPLINE_IDS ` +
        "(arena-headless-runner.ts), aber NICHT in ARENA_RESOLVED_DISCIPLINE_IDS -- jede Buehnen-Heben-" +
        "Chassis-Disziplin muss auch arena-aufgeloest sein, sonst faellt der Chassis-Dispatch still " +
        "auf den falschen Pfad.",
    );
  }
}

/** Chris' Vorgabe vom 30.08., "das ist gesetzt" — s. Plan Abschnitt 5.1. */
export const ARENA_TEAM_POINTS = {
  win: 2,
  draw: 1,
  loss: 0,
} as const;

/**
 * HOECHSTPUNKTZAHL DER IMPACT-KURVE (Opus-Dokument Abschnitt 6, dort an vier Kandidaten
 * durchgerechnet). Chris' Rahmen war ausdruecklich „max 5-6"; 6,6 (der alte V1-Wert) liegt
 * ausserhalb davon und zahlte ausserdem — reiner Nebeneffekt der Perzentil-Mitte 50 — JEDEM Team
 * an JEDEM Spieltag im Mittel exakt die Meister-Ausschuettung (`6,6/2 * 6 Feldspieler` = 19,8,
 * praktisch identisch mit `rank-to-points.json` Rang-1-Wert 19,9 bei `playerCount` 6). 5,5 ist die
 * Mitte von Chris' Rahmen und draengt die mittlere Team-Ausschuettung auf 10,2 — unteres
 * Mittelfeld statt Meisterniveau, bei weiterhin sichtbarem Abstand Spitze/Mitte (Faktor 4,0 statt
 * vorher 2,0). EIN Wert, EINE Stelle — leicht aenderbar, sobald Chris eine andere Zahl nennt.
 */
export const BASKETBALL_INDIVIDUAL_PPS_MAX = 5.5;

/**
 * ANTEIL DER HOECHSTPUNKTZAHL FUER EINEN „MITTELMAESSIGEN" AUFTRITT — der zweite und letzte
 * Regler der Impact-Kurve, `a_mitte` in deren Formel.
 *
 * ENTSCHIEDEN AN 352 ECHTEN DUELLEN (04.09., docs/design/pps-skalierung-umsetzung.md Abschnitt 9,
 * Sonde: scripts/miss-basketball-pps-anteil-mitte.ts) — vorher stand hier eine Geschmacksfrage
 * zwischen 0,25 und 0,45. Die drei Zahlen, die sie beendet haben:
 *
 *  1. Chris' woertliche Beschwerde („nicht in jedem team duell immer ein spieler volle punktzahl")
 *     haengt NICHT an dieser Konstante: die volle Punktzahl faellt genau dann, wenn `I >= I_krass`,
 *     und diese Bedingung enthaelt `gamma` nicht. Gemessen deshalb IDENTISCHE 5,6 % (6v6) der
 *     Duelle mit voller Punktzahl bei 0,20 / 0,25 / 0,35 / 0,45. Die Deckelquote regelt allein
 *     `I_krass` (p99,5 der Referenz).
 *  2. Was diese Konstante regelt, ist die Naehe DARUNTER und die Trennschaerfe: 0,45 vergibt in
 *     15,6 % der 6v6-Duelle mindestens 90 % der Hoechstnote, 0,25 nur in 9,4 %; die Spreizung der
 *     Duellbesten (p10..p90) betraegt 2,14 PPs bei 0,25 gegen 1,45 bei 0,45. Chris' NEUERE,
 *     praezisere Aussage betont genau diese Trennschaerfe.
 *  3. Kein Geschmack, sondern dieselbe Inflation auf einem anderen Regler: die Team-Summe dieser
 *     PPs ist direkt mit `rank-to-points` vergleichbar (sie ersetzt `pointsAwarded`, s.
 *     legacy-matchday-resolve-engine.ts). Median bei 6v6: 9,3 unter 0,25 (PPS-Rang 10-11, unteres
 *     Mittelfeld) gegen 15,1 unter 0,45 (Rang 4-5). `MAX` wurde in derselben Runde 6,6 -> 5,5
 *     gesenkt, WEIL das Modell sonst jedem Team Meisterniveau zahlt; 0,45 nimmt 64 % davon zurueck.
 *
 * Chris' AELTERES Beispiel („ein Topspieler z.B. fuenf, ein mittlerer Spieler ca. 2,5, ein
 * schlechter Spieler 0,5") spricht ebenfalls nicht fuer 0,45, sobald man es als VERHAELTNIS zum
 * tatsaechlichen Duellbesten misst statt es auf den Deckel zu normieren — s. Abschnitt 9.4.
 */
export const BASKETBALL_PPS_ANTEIL_MITTE = 0.25;

/**
 * HOECHSTPUNKTZAHL/MITTE-ANTEIL FUER GEWICHTHEBEN (Gewichtheben-Produktivierung, S6, 04.09.).
 * Dieselbe Impact-Kurve wie Basketball (`ppsAusArenaImpact()`), aber mit eigenen Reglern:
 * Gewichtheben MISST bereits eine reale, unbeschraenkte physikalische Groesse (Zweikampf-kg,
 * s. `ArenaFixtureBoxscoreEintrag.wert` fuer diese Disziplin -- `MOTOREN.gewichtheben.wert()`
 * liefert `u.summe`, den echten gehobenen Zweikampf, keinen abstrakten "Impact"-Score wie
 * Basketballs Boxscore). Die Kurve braucht dieselben zwei Anker trotzdem, weil die absolute
 * Kilogrammzahl je Kadergeneration/Liga-Niveau driftet (genau der Grund, aus dem Basketballs
 * `iMittel`/`iKrass` je Feldgroesse getrennt gezogen sind) — ein fester kg-Schwellwert waere
 * genauso wenig kaderrobust wie ein fester Impact-Schwellwert bei Basketball.
 *
 * MAX/ANTEIL_MITTE UNVERAENDERT VON BASKETBALLS ENTSCHEIDUNG UEBERNOMMEN (Chris' Rahmen "max
 * 5-6" gilt disziplinuebergreifend, s. `BASKETBALL_INDIVIDUAL_PPS_MAX`-Kommentar; die 04.09.-
 * Messung von `BASKETBALL_PPS_ANTEIL_MITTE` an 352 Duellen ist eine Aussage ueber die Kurvenform
 * selbst, nicht ueber Basketball-spezifische Zahlen) — EXPLIZIT ALS EIGENE KONSTANTEN, nicht als
 * Alias, damit eine spaetere Gewichtheben-spezifische Kalibrierung (z.B. nach echten Spieldaten)
 * Basketball nicht beruehrt.
 */
export const GEWICHTHEBEN_INDIVIDUAL_PPS_MAX = 5.5;
export const GEWICHTHEBEN_PPS_ANTEIL_MITTE = 0.25;

/**
 * HOECHSTPUNKTZAHL/MITTE-ANTEIL FUER HOCKEY (Hockey-Produktivierung, docs/design/
 * hockey-produktivierung.md). Dieselbe Impact-Kurve wie Basketball/Gewichtheben
 * (`ppsAusArenaImpact()`), eigene Regler aus demselben Grund wie bei Gewichtheben: Hockeys
 * roher Boxscore-Wert (`feldspielWert(u,"hockey")`, battle-mode.engine.js -- TORWART UND
 * FELDSPIELER GEMEINSAM, s. `hockey-pps-referenz.json`s `hinweis`) liegt auf einer eigenen
 * Skala, die vom Kader-/Attributniveau der Liga abhaengt, genau wie Basketballs Impact-Score
 * und Gewichthebens Zweikampf-kg.
 *
 * MAX/ANTEIL_MITTE UNVERAENDERT VON BASKETBALLS ENTSCHEIDUNG UEBERNOMMEN -- aus demselben
 * Grund wie bei Gewichtheben (s. dortiger Kommentar): Chris' Rahmen "max 5-6" und die 04.09.-
 * Kurvenform-Messung gelten disziplinuebergreifend. EIGENE Konstanten statt Alias, damit eine
 * spaetere hockey-spezifische Kalibrierung Basketball/Gewichtheben nicht beruehrt.
 */
export const HOCKEY_INDIVIDUAL_PPS_MAX = 5.5;
export const HOCKEY_PPS_ANTEIL_MITTE = 0.25;

/**
 * ARENA-PPS-REFERENZ, GENERISCH JE DISZIPLIN (Gewichtheben-Produktivierung, S6): `iMittel`
 * (Median) und `iKrass` (99,5.-Perzentil) des rohen Boxscore-Werts, JE FELDGROESSE getrennt
 * gezogen — der Rohwert skaliert mit der Feldgroesse (Opus-Dokument Abschnitt 7 fuer Basketball;
 * fuer Gewichtheben ist die Feldgroesse zwar katalogfest 6, aber Unterzahl-Duelle, s.
 * `baueHebenDuelle()`, koennen trotzdem eine kleinere tatsaechlich gefelderte Groesse ergeben).
 * Gezogen von `scripts/ziehe-basketball-pps-referenz.ts` bzw.
 * `scripts/ziehe-gewichtheben-pps-referenz.ts` gegen ECHTE Liga-Kader aus dem `live-save`-Abbild
 * (nicht den Demokader des Mockups) — Provenienz (Motor-SHA1, Repo-Commit, Ziehdatum,
 * Fixture-Zahl) steht in der jeweiligen Datei selbst, s. dortiger `hinweis`.
 */
export type ArenaPpsReferenzFeldgroesse = { iMittel: number; iKrass: number };
type ArenaPpsReferenzFeldgroessenRecord = Record<string, { n: number; iMittel: number; iKrass: number }>;
type ArenaPpsReferenzJson = {
  feldgroessen: ArenaPpsReferenzFeldgroessenRecord;
  /**
   * TORWART-EIGENE REFERENZ (Hockey-Produktivierung, docs/design/hockey-produktivierung.md):
   * NUR fuer Disziplinen mit einer eigenen Torwart-Rolle (aktuell nur Hockey) -- fehlt in
   * Basketballs/Gewichthebens JSON komplett, `ladeReferenzFeldgroessenTorwart()` liefert dann
   * `undefined`.
   */
  feldgroessenTorwart?: ArenaPpsReferenzFeldgroessenRecord;
};

function ladeReferenzFeldgroessenRecord(
  record: ArenaPpsReferenzFeldgroessenRecord,
): ReadonlyMap<number, ArenaPpsReferenzFeldgroesse> {
  return new Map(Object.values(record).map((werte) => [werte.n, { iMittel: werte.iMittel, iKrass: werte.iKrass }]));
}

function ladeReferenzFeldgroessen(json: ArenaPpsReferenzJson): ReadonlyMap<number, ArenaPpsReferenzFeldgroesse> {
  return ladeReferenzFeldgroessenRecord(json.feldgroessen);
}

function ladeReferenzFeldgroessenTorwart(
  json: ArenaPpsReferenzJson,
): ReadonlyMap<number, ArenaPpsReferenzFeldgroesse> | undefined {
  return json.feldgroessenTorwart ? ladeReferenzFeldgroessenRecord(json.feldgroessenTorwart) : undefined;
}

const BASKETBALL_PPS_REFERENZ_FELDGROESSEN = ladeReferenzFeldgroessen(
  basketballPpsReferenzJson as ArenaPpsReferenzJson,
);
const GEWICHTHEBEN_PPS_REFERENZ_FELDGROESSEN = ladeReferenzFeldgroessen(
  gewichthebenPpsReferenzJson as ArenaPpsReferenzJson,
);
const HOCKEY_PPS_REFERENZ_FELDGROESSEN = ladeReferenzFeldgroessen(hockeyPpsReferenzJson as ArenaPpsReferenzJson);
/**
 * HOCKEYS TORWART-REFERENZ (Hockey-Produktivierung): EMPIRISCH ALS NOETIG BEFUNDEN, nicht aus
 * dem Bauch entschieden -- s. docs/design/hockey-produktivierung.md, Abschnitt zur Torwart-
 * Referenz-Entscheidung. Gemessen (scripts/ziehe-hockey-pps-referenz.ts Rollen-Diagnose, 04.09.):
 * bei kleiner Feldgroesse (n=3) liegt der Feldspieler-Median weit UEBER dem Torwart-Median
 * (22,4 gegen 8,4 -- eine gemeinsame Referenz haette den Torwart systematisch unterbezahlt),
 * bei n=6 ist es GENAU UMGEKEHRT (Feld 6,84 gegen Torwart 10,22 --
 * eine gemeinsame Referenz haette JEDEN durchschnittlichen Torwart ueberdurchschnittlich
 * aussehen lassen, exakt die Art systematischer Verzerrung, die die ganze Impact-Kurve
 * (Boxscore-an-PPS V2) eigentlich vermeiden soll). Der Grund: Hockeys Torwart-Wertformel
 * (HK_TW_BASIS/HK_TW_REF, battle-mode.engine.js) ist auf den FELDSPIELER-MITTELWERT bei EINER
 * bestimmten Feldgroesse kalibriert, nicht auf jede -- bei wenigen Feldspielern teilen sich diese
 * denselben "Kuchen" an Punkten/Assists auf weniger Koepfe (hoeherer Medianwert je Spieler), der
 * Torwart-Anteil bleibt aber unabhaengig von der Feldspieleranzahl ungefaehr gleich.
 */
const HOCKEY_PPS_REFERENZ_FELDGROESSEN_TORWART = ladeReferenzFeldgroessenTorwart(
  hockeyPpsReferenzJson as ArenaPpsReferenzJson,
);

/**
 * EIN EINTRAG JE ARENA-AUFGELOESTER DISZIPLIN (s. `ARENA_RESOLVED_DISCIPLINE_IDS`): welche
 * Referenzverteilung und welche zwei Kurvenregler (`max`/`anteilMitte`) ihre individuellen PPs
 * bestimmen, plus der Katalog-Standardgroesse, auf die `resolveArenaPpsReferenz()` faellt, wenn
 * fuer einen Spieltag ueberhaupt keine Feldgroesse ermittelbar war. EINE neue Arena-Disziplin
 * (Hockey war die dritte) braucht NUR einen weiteren Eintrag hier plus ihre eigene gezogene
 * Referenz-JSON — keine neue Verzweigung in `ppsAusArenaImpact()` oder
 * `computeIndividualBoxscorePpsFromFixtureResults()`. Eine Disziplin mit einer EIGENEN Rolle
 * (Hockeys Torwart) braucht zusaetzlich `referenzFeldgroessenTorwart`, s. dort.
 */
type ArenaImpactKonfig = {
  referenzFeldgroessen: ReadonlyMap<number, ArenaPpsReferenzFeldgroesse>;
  /**
   * TORWART-EIGENE REFERENZ (Hockey-Produktivierung) -- `undefined` fuer jede Disziplin ohne
   * eigene Torwart-Rolle (Basketball, Gewichtheben): `resolveArenaPpsReferenz()` faellt dann
   * fuer `rolle:"torwart"` defensiv auf `referenzFeldgroessen` zurueck (s. dort), was fuer diese
   * Disziplinen ohnehin nie angefragt wird (kein Boxscore-Eintrag traegt dort je `torwart:true`).
   */
  referenzFeldgroessenTorwart?: ReadonlyMap<number, ArenaPpsReferenzFeldgroesse>;
  max: number;
  anteilMitte: number;
  katalogStandardgroesse: number;
};

const ARENA_IMPACT_KONFIG_JE_DISZIPLIN: ReadonlyMap<string, ArenaImpactKonfig> = new Map([
  [
    "basketball",
    {
      referenzFeldgroessen: BASKETBALL_PPS_REFERENZ_FELDGROESSEN,
      max: BASKETBALL_INDIVIDUAL_PPS_MAX,
      anteilMitte: BASKETBALL_PPS_ANTEIL_MITTE,
      katalogStandardgroesse: 6,
    },
  ],
  [
    "gewichtheben",
    {
      referenzFeldgroessen: GEWICHTHEBEN_PPS_REFERENZ_FELDGROESSEN,
      max: GEWICHTHEBEN_INDIVIDUAL_PPS_MAX,
      anteilMitte: GEWICHTHEBEN_PPS_ANTEIL_MITTE,
      katalogStandardgroesse: 6,
    },
  ],
  [
    "hockey",
    {
      referenzFeldgroessen: HOCKEY_PPS_REFERENZ_FELDGROESSEN,
      referenzFeldgroessenTorwart: HOCKEY_PPS_REFERENZ_FELDGROESSEN_TORWART,
      max: HOCKEY_INDIVIDUAL_PPS_MAX,
      anteilMitte: HOCKEY_PPS_ANTEIL_MITTE,
      // ANDERS ALS BASKETBALL/GEWICHTHEBEN: Hockeys `Discipline.playerCount` (dataAdapter.ts)
      // ist 5, nicht 6 -- nachgesehen, nicht von den beiden Vorlagen kopiert. Nur der Katalog-
      // Fallback, wenn ueberhaupt kein Spielplan-Eintrag ermittelbar war (seltener Pfad, s.
      // `resolveArenaFieldSizeForMatchday()`); die tatsaechlich GEWUERFELTE Feldgroesse einer
      // Saison liegt fuer JEDE der zwanzig Disziplinen gleichverteilt zwischen 2 und 6
      // (`buildSeasonPlayerCountByDiscipline()`, season-discipline-schedule.ts -- jede der vier
      // Fuenfer-Kategorien bekommt eine Permutation von [2,3,4,5,6] zugeteilt), dieser Wert ist
      // also fuer keine der drei Arena-Disziplinen der "typische" Fall.
      katalogStandardgroesse: 5,
    },
  ],
]);

/**
 * Loest die Impact-Kurven-Konfiguration EINER Disziplin auf — mit Basketballs Konfiguration als
 * Fallback fuer eine unbekannte `disciplineId` (sollte bei einem Eintrag in
 * `ARENA_RESOLVED_DISCIPLINE_IDS` ohne passenden `ARENA_IMPACT_KONFIG_JE_DISZIPLIN`-Eintrag nie
 * vorkommen). EINZIGE Stelle, die diesen Fallback kennt (Review-Fund PR #776: vorher wortgleich
 * doppelt an zwei Stellen — `resolveArenaPpsReferenz()` und
 * `computeIndividualBoxscorePpsFromFixtureResults()` — dupliziert, mit dem Risiko, dass eine
 * kuenftige Aenderung der Fallback-Regel eine der beiden Stellen vergisst).
 */
function loeseArenaImpactKonfigAuf(disciplineId: string): ArenaImpactKonfig {
  return ARENA_IMPACT_KONFIG_JE_DISZIPLIN.get(disciplineId) ?? ARENA_IMPACT_KONFIG_JE_DISZIPLIN.get("basketball")!;
}

/**
 * Loest die Referenzwerte EINER Disziplin fuer eine (moeglicherweise unbekannte oder fehlende)
 * Feldgroesse auf — faellt auf die naechstgelegene GEZOGENE Feldgroesse zurueck, statt einen
 * Fehler zu werfen. Das deckt sowohl "playerCount fuer diesen Spieltag nicht ermittelbar"
 * (`null`) als auch eine Feldgroesse ausserhalb der gezogenen Spanne mit demselben, robusten Pfad
 * ab. Eine unbekannte `disciplineId` (sollte bei einem Eintrag in `ARENA_RESOLVED_DISCIPLINE_IDS`
 * ohne passenden `ARENA_IMPACT_KONFIG_JE_DISZIPLIN`-Eintrag nie vorkommen) faellt defensiv auf
 * Basketballs Konfiguration zurueck statt zu werfen.
 *
 * ENTARTETE EINTRAEGE WERDEN UEBERSPRUNGEN (Gewichtheben-Produktivierung, S6, gefunden bei der
 * echten Erstziehung 04.09.): eine KLEINE Stichprobe kann fuer eine seltene Feldgroesse (hier:
 * `n=2`, ein extremer Unterzahl-Fall) einen Median von 0 liefern (Nullwertungsquote in dieser
 * Stichprobe zufällig ueber 50 %, s. docs/design/gewichtheben-produktivierung.md). Ein exakter
 * Treffer auf so einen Eintrag wuerde `ppsAusArenaImpact()`s eigene Degenerationsbremse
 * (`iMittel > 0`) auslösen und JEDEM Spieler dieser Feldgroesse 0 PPs geben, unabhaengig von
 * seiner tatsaechlichen Leistung — schlimmer als ein Fallback auf die naechste GUELTIGE
 * Feldgroesse, die immer noch naeher an der Wahrheit liegt als eine pauschale Null. Deshalb
 * zaehlt ein Eintrag hier nur als „verfuegbar", wenn `iMittel > 0` UND `iKrass > iMittel` gilt —
 * exakt dieselbe Gueltigkeitsbedingung wie in `ppsAusArenaImpact()` selbst.
 */
export function resolveArenaPpsReferenz(
  disciplineId: string,
  playerCount: number | null,
  rolle: "feld" | "torwart" = "feld",
): { referenz: ArenaPpsReferenzFeldgroesse; feldgroesseGenutzt: number } {
  const konfig = loeseArenaImpactKonfigAuf(disciplineId);
  // TORWART-EIGENE REFERENZ (Hockey-Produktivierung, s. `ArenaImpactKonfig.
  // referenzFeldgroessenTorwart`-Kommentar): faellt fuer eine Disziplin ohne eigene
  // Torwart-Referenz (Basketball, Gewichtheben) defensiv auf die Feldspieler-Referenz zurueck.
  const referenzFeldgroessen =
    (rolle === "torwart" ? konfig.referenzFeldgroessenTorwart : undefined) ?? konfig.referenzFeldgroessen;
  const istGueltig = (referenz: ArenaPpsReferenzFeldgroesse) => referenz.iMittel > 0 && referenz.iKrass > referenz.iMittel;
  const verfuegbareGroessen = [...referenzFeldgroessen.entries()]
    .filter(([, referenz]) => istGueltig(referenz))
    .map(([n]) => n)
    .sort((a, b) => a - b);
  if (verfuegbareGroessen.length === 0) {
    throw new Error(
      `battle-mode-arena-team-points: keine gueltige gezogene PPS-Referenz fuer "${disciplineId}" (Rolle "${rolle}") gefunden — ` +
        "scripts/ziehe-basketball-pps-referenz.ts bzw. scripts/ziehe-gewichtheben-pps-referenz.ts/scripts/ziehe-hockey-pps-referenz.ts (neu) ausfuehren.",
    );
  }
  const gerundet = playerCount != null && Number.isFinite(playerCount) ? Math.round(playerCount) : null;
  if (gerundet != null && referenzFeldgroessen.has(gerundet) && istGueltig(referenzFeldgroessen.get(gerundet)!)) {
    return { referenz: referenzFeldgroessen.get(gerundet)!, feldgroesseGenutzt: gerundet };
  }
  // Der Katalog-Standardwert (`Discipline.playerCount`) als Ziel, wenn ueberhaupt keine
  // Feldgroesse ermittelbar war -- dieselbe Zahl, auf die auch der bestehende PPS-Pfad
  // (`resolveDisciplinePlayerCount()`) ohne Spielplan-Eintrag zurueckfaellt.
  const ziel = gerundet ?? konfig.katalogStandardgroesse;
  let naechste = verfuegbareGroessen[0]!;
  for (const kandidat of verfuegbareGroessen) {
    if (Math.abs(kandidat - ziel) < Math.abs(naechste - ziel)) naechste = kandidat;
  }
  return { referenz: referenzFeldgroessen.get(naechste)!, feldgroesseGenutzt: naechste };
}

/**
 * BASKETBALL-WRAPPER, unveraendertes Verhalten (Testkompatibilitaet PR7/Boxscore-an-PPS):
 * `resolveArenaPpsReferenz("basketball", playerCount)`.
 */
export function resolveBasketballPpsReferenz(
  playerCount: number | null,
): { referenz: ArenaPpsReferenzFeldgroesse; feldgroesseGenutzt: number } {
  return resolveArenaPpsReferenz("basketball", playerCount);
}

/** Gewichtheben-Analogon zu `resolveBasketballPpsReferenz()`, s. dort. */
export function resolveGewichthebenPpsReferenz(
  playerCount: number | null,
): { referenz: ArenaPpsReferenzFeldgroesse; feldgroesseGenutzt: number } {
  return resolveArenaPpsReferenz("gewichtheben", playerCount);
}

/** Hockey-Analogon zu `resolveBasketballPpsReferenz()`, s. dort. */
export function resolveHockeyPpsReferenz(
  playerCount: number | null,
  rolle: "feld" | "torwart" = "feld",
): { referenz: ArenaPpsReferenzFeldgroesse; feldgroesseGenutzt: number } {
  return resolveArenaPpsReferenz("hockey", playerCount, rolle);
}

const LEAGUE_TIERS: readonly LeagueTier[] = ["liga1", "liga2"];

export type ArenaTeamPointsOverride = {
  teamPoints: number;
  arenaMatchSeed: string;
  opponentTeamId: string;
  /** Punktestand [dieses Team, Gegner] — fuer Anzeige/Tie-Breaking, NICHT fuer die Punktevergabe selbst. */
  seiten: [number, number];
  outcome: "win" | "draw" | "loss";
};

/**
 * Deterministischer Seed pro Duell — exakt das im Plan (Abschnitt 3.3c) vorgeschlagene Format.
 * `runArenaFixtures()` haelt Text-Seeds via FNV-1a-Hash selbst in eine Zahl um (s. PR6), diese
 * Funktion muss also NICHT selbst hashen.
 */
export function buildArenaMatchSeed(input: {
  saveId: string;
  seasonId: string;
  matchdayId: string;
  homeTeamId: string;
  awayTeamId: string;
}): string {
  return `${input.saveId}:${input.seasonId}:${input.matchdayId}:arena:${input.homeTeamId}:${input.awayTeamId}`;
}

/**
 * Reine, synchrone Umrechnung: aus dem Punktestand EINES Arena-Duells (`ArenaFixtureResult.seiten`)
 * werden die Team-Punkte fuer BEIDE Seiten nach Chris' 2/1/0-Modell. Kein Rang, keine Sortierung —
 * pro Duell unabhaengig von jedem anderen Duell des Spieltags.
 */
export function arenaTeamPointsForFixture(seiten: readonly [number, number]): [number, number] {
  const [heim, gast] = seiten;
  if (heim === gast) return [ARENA_TEAM_POINTS.draw, ARENA_TEAM_POINTS.draw];
  return heim > gast ? [ARENA_TEAM_POINTS.win, ARENA_TEAM_POINTS.loss] : [ARENA_TEAM_POINTS.loss, ARENA_TEAM_POINTS.win];
}

/**
 * GESAMT-KG-TIEBREAK (Fable-Empfehlung 9.1, docs/design/gewichtheben-gameplay-fertig.md
 * Abschnitt 4, umgesetzt in der Gewichtheben-Produktivierung S6): bei einem Duellgleichstand
 * (z.B. 3:3 der sechs Gewichtheben-Zweikaempfe) entscheidet NICHT mehr automatisch ein
 * Unentschieden, sondern die kumulierte Zweikampf-Kilogrammsumme beider Seiten
 * (`ArenaFixtureResult.gesamtKg`, geliefert von `spieleBuehneHeben()` im Motor).
 *
 * NUR RELEVANT, WENN `gesamtKg` GESETZT IST — also ausschliesslich fuer das Buehnen-Duell-
 * Chassis (aktuell Gewichtheben, s. `ARENA_BUEHNE_HEBEN_DISCIPLINE_IDS` in
 * `arena-headless-runner.ts`). Fuer jede andere Disziplin (Basketball: `gesamtKg` `undefined`)
 * delegiert diese Funktion unveraendert an `arenaTeamPointsForFixture()` — ein Punktegleichstand
 * bleibt dort ein echtes Unentschieden, exakt wie vor dieser Aenderung.
 *
 * Ein exakter Gleichstand AUCH bei der Kilogrammsumme ist mit echten kg-Werten praktisch
 * ausgeschlossen (Sinclair-normierte Fliesskommazahlen aus sechs unabhaengigen Zweikaempfen je
 * Seite), bleibt defensiv aber ein echtes Unentschieden statt eine willkuerliche Seite zu waehlen.
 */
export function arenaTeamPointsForFixtureMitTiebreak(
  result: Pick<ArenaFixtureResult, "seiten" | "gesamtKg">,
): [number, number] {
  const [heim, gast] = result.seiten;
  if (heim !== gast || !result.gesamtKg) {
    return arenaTeamPointsForFixture(result.seiten);
  }
  const [heimKg, gastKg] = result.gesamtKg;
  if (heimKg === gastKg) return [ARENA_TEAM_POINTS.draw, ARENA_TEAM_POINTS.draw];
  return heimKg > gastKg ? [ARENA_TEAM_POINTS.win, ARENA_TEAM_POINTS.loss] : [ARENA_TEAM_POINTS.loss, ARENA_TEAM_POINTS.win];
}

/**
 * Baut aus bereits gelaufenen Arena-Fixture-Ergebnissen (s. `runArenaFixtures()`) die Team-Punkte-
 * Overrides je teamId. Rein, synchron, ohne Playwright/Browser — dafuer in den meisten Tests
 * gedacht (s. Testing-Lektion PR6: Chromium ist in `full-test-suite` nicht installiert).
 *
 * NUTZT `arenaTeamPointsForFixtureMitTiebreak()`, NICHT `arenaTeamPointsForFixture()` direkt (s.
 * dort) — fuer Basketball (kein `gesamtKg`) identisches Verhalten wie vor der Gewichtheben-
 * Produktivierung.
 */
export function computeArenaTeamPointsFromFixtureResults(
  fixtureResults: readonly ArenaFixtureResult[],
  seedByFixtureKey: ReadonlyMap<string, string>,
): Map<string, ArenaTeamPointsOverride> {
  const overridesByTeamId = new Map<string, ArenaTeamPointsOverride>();
  for (const result of fixtureResults) {
    const [heimPunkte, gastPunkte] = arenaTeamPointsForFixtureMitTiebreak(result);
    const seed = seedByFixtureKey.get(`${result.homeTeamId}::${result.awayTeamId}`) ?? "";
    const heimOutcome: ArenaTeamPointsOverride["outcome"] =
      heimPunkte === gastPunkte ? "draw" : heimPunkte > gastPunkte ? "win" : "loss";
    const gastOutcome: ArenaTeamPointsOverride["outcome"] =
      heimOutcome === "draw" ? "draw" : heimOutcome === "win" ? "loss" : "win";
    overridesByTeamId.set(result.homeTeamId, {
      teamPoints: heimPunkte,
      arenaMatchSeed: seed,
      opponentTeamId: result.awayTeamId,
      seiten: result.seiten,
      outcome: heimOutcome,
    });
    overridesByTeamId.set(result.awayTeamId, {
      teamPoints: gastPunkte,
      arenaMatchSeed: seed,
      opponentTeamId: result.homeTeamId,
      seiten: [result.seiten[1], result.seiten[0]],
      outcome: gastOutcome,
    });
  }
  return overridesByTeamId;
}

/** Die 8 Fixtures einer Liga an einem Spieltag — aus dem bereits gebauten Spielplan, nicht neu erzeugt. */
export function findLeagueFixturesForMatchday(
  gameState: Pick<GameState, "seasonState">,
  tier: LeagueTier,
  matchdayId: string,
): Fixture[] {
  return (gameState.seasonState.schedule ?? []).filter(
    (fixture) => fixture.leagueTier === tier && fixture.matchdayId === matchdayId,
  );
}

function roundPps(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * DIE IMPACT-KURVE (Opus-Dokument Abschnitt 4.1): `PPs = MAX * min(1, (max(0,I)/I_krass)^gamma)`,
 * mit `gamma = ln(a_mitte) / ln(I_mittel/I_krass)`. Die Kurve geht per Konstruktion durch zwei
 * benannte Anker — `I_mittel -> a_mitte*MAX` ("ein mittelmaessiger Auftritt") und
 * `I_krass -> MAX` ("ein krasser Auftritt") — beide aus der gezogenen Referenz, keine dritte,
 * frei getunte Zahl. `min(1, …)` ist ein DECKEL, keine Asymptote: wer `I_krass` erreicht oder
 * ueberschreitet, bekommt die volle Punktzahl, nicht nur eine Annaeherung (Chris' "max 5-6"
 * woertlich genommen). `max(0, I)` ist derselbe Boden bei 0 wie in `distributeByValues()`
 * (`rank-to-points.ts`) — ein negativer Impact (real gemessen, s. Opus-Dokument Abschnitt 1.2)
 * gibt 0 PPs, nie negative.
 *
 * Eine entartete Referenz (`iKrass <= iMittel`, koennte nur bei einer kaputten/leeren Ziehung
 * vorkommen, s. `resolveArenaPpsReferenz()`) liefert 0 statt NaN/Infinity durchzureichen —
 * defensiv, sollte an einer echten gezogenen Referenz nie greifen.
 *
 * GENERISCH JE DISZIPLIN (Gewichtheben-Produktivierung, S6): `max`/`anteilMitte` sind jetzt
 * Parameter statt fest verdrahteter Basketball-Konstanten — die Formel selbst ist UNVERAENDERT.
 * `ppsAusBasketballImpact()`/`ppsAusGewichthebenImpact()` darunter sind duenne, disziplinfeste
 * Wrapper (Testkompatibilitaet, unveraendertes Basketball-Verhalten).
 */
export function ppsAusArenaImpact(
  impact: number,
  referenz: ArenaPpsReferenzFeldgroesse,
  max: number,
  anteilMitte: number,
): number {
  const { iMittel, iKrass } = referenz;
  if (!(iKrass > 0) || !(iMittel > 0) || iMittel >= iKrass) return 0;
  const gamma = Math.log(anteilMitte) / Math.log(iMittel / iKrass);
  const basis = Math.max(0, impact) / iKrass;
  const anteil = basis <= 0 ? 0 : Math.min(1, Math.pow(basis, gamma));
  return roundPps(max * anteil);
}

/** BASKETBALL-WRAPPER, unveraendertes Verhalten: `ppsAusArenaImpact()` mit Basketballs Reglern. */
export function ppsAusBasketballImpact(impact: number, referenz: ArenaPpsReferenzFeldgroesse): number {
  return ppsAusArenaImpact(impact, referenz, BASKETBALL_INDIVIDUAL_PPS_MAX, BASKETBALL_PPS_ANTEIL_MITTE);
}

/** Gewichtheben-Analogon zu `ppsAusBasketballImpact()`, s. dort. */
export function ppsAusGewichthebenImpact(impact: number, referenz: ArenaPpsReferenzFeldgroesse): number {
  return ppsAusArenaImpact(impact, referenz, GEWICHTHEBEN_INDIVIDUAL_PPS_MAX, GEWICHTHEBEN_PPS_ANTEIL_MITTE);
}

/** Hockey-Analogon zu `ppsAusBasketballImpact()`, s. dort. */
export function ppsAusHockeyImpact(impact: number, referenz: ArenaPpsReferenzFeldgroesse): number {
  return ppsAusArenaImpact(impact, referenz, HOCKEY_INDIVIDUAL_PPS_MAX, HOCKEY_PPS_ANTEIL_MITTE);
}

/**
 * BOXSCORE-AN-PPS, KERNFUNKTION — V2 (docs/design/pps-skalierung-opus.md,
 * docs/design/pps-skalierung-umsetzung.md): aus ALLEN Boxscore-Ergebnissen EINES Spieltags
 * (typischerweise beide Liga-Stufen zusammen, s. `runBattleModeArenaMatchday()`) individuelle
 * Spieler-PPs nach der Impact-Kurve (`ppsAusBasketballImpact()`) gegen eine FESTE Referenz —
 * NICHT mehr gegen einen Perzentil-Pool des aktuellen Spieltags (V1, entfernt). Rein, synchron,
 * ohne Playwright — nimmt bereits gelaufene `ArenaFixtureResult`s entgegen, genau wie
 * `computeArenaTeamPointsFromFixtureResults()` daneben.
 *
 * `playerCount` ist die fuer DIESEN Spieltag gewuerfelte Feldgroesse dieser Disziplin (s.
 * `resolveArenaFieldSizeForMatchday()` unten) — `null`, wenn sie nicht ermittelbar war;
 * `resolveArenaPpsReferenz()` faellt dafuer robust auf die naechstgelegene gezogene Feldgroesse
 * zurueck, wirft also nie.
 *
 * NUR Boxscore-Eintraege mit eindeutig zugeordneter `playerId` (s. `arena-headless-runner.ts`)
 * bekommen einen Eintrag im Ergebnis — ein Spieler, dessen Name in seinem Duell nicht eindeutig
 * war, bleibt hier schlicht unerwaehnt; der Aufrufer (`legacy-matchday-resolve-engine.ts`) faellt
 * fuer GENAU DIESEN Spieler auf den alten PPS-Pfad zurueck, ohne dass es andere Spieler seines
 * Teams beruehrt. Anders als beim V1-Perzentil braucht diese Funktion keinen Pool mehr — jeder
 * Spieler haengt nur noch von seinem eigenen Boxscore-Wert und der Feldgroesse ab, nicht mehr vom
 * Rest des Spieltags.
 *
 * `disciplineId` (Gewichtheben-Produktivierung, S6) waehlt Referenz UND Kurvenregler — Default
 * `"basketball"` fuer Rueckwaertskompatibilitaet mit Aufrufern von vor dieser Aenderung.
 */
export function computeIndividualBoxscorePpsFromFixtureResults(
  fixtureResults: readonly ArenaFixtureResult[],
  playerCount: number | null,
  disciplineId: string = "basketball",
): Map<string, number> {
  const { referenz: feldReferenz } = resolveArenaPpsReferenz(disciplineId, playerCount, "feld");
  // TORWART-EIGENE REFERENZ (Hockey-Produktivierung): nur aufgeloest, wenn irgendein Eintrag sie
  // ueberhaupt braucht (s. Schleife unten) -- `resolveArenaPpsReferenz()` faellt fuer Basketball/
  // Gewichtheben ohnehin auf `feldReferenz` zurueck, ein zweiter Aufruf hier waere fuer die beiden
  // schlicht verschwendet, nicht falsch.
  let torwartReferenz: ArenaPpsReferenzFeldgroesse | null = null;
  const konfig = loeseArenaImpactKonfigAuf(disciplineId);
  const ppsByPlayerId = new Map<string, number>();
  for (const result of fixtureResults) {
    for (const eintrag of result.boxscore) {
      if (eintrag.playerId === null) continue;
      if (eintrag.torwart) {
        torwartReferenz ??= resolveArenaPpsReferenz(disciplineId, playerCount, "torwart").referenz;
        ppsByPlayerId.set(eintrag.playerId, ppsAusArenaImpact(eintrag.wert, torwartReferenz, konfig.max, konfig.anteilMitte));
      } else {
        ppsByPlayerId.set(eintrag.playerId, ppsAusArenaImpact(eintrag.wert, feldReferenz, konfig.max, konfig.anteilMitte));
      }
    }
  }
  return ppsByPlayerId;
}

/**
 * Die fuer DIESEN Spieltag gewuerfelte Feldgroesse EINER Disziplin (`playerCount` 2..6), fuer die
 * Impact-Kurven-Referenz — ANDERS als `resolveDisciplinePlayerCount()` (`rank-to-points.ts`) OHNE
 * vorher wissen zu muessen, ob diese Disziplin an diesem Spieltag `d1` oder `d2` ist: geprueft
 * werden BEIDE Slots des Spielplan-Eintrags, der erste mit passender `disciplineId` gewinnt.
 * `resolveDisciplinePlayerCount()` selbst waere hier riskant gewesen — bei falsch geratener Seite
 * faellt es NICHT auf den jeweils anderen Slot zurueck, sondern direkt auf den Katalogwert, und
 * wuerde damit einen echten, vom Katalog abweichenden Spielplan-Wert (nachgemessen real
 * vorkommend, s. `Discipline.playerCount`-Kommentar in `olyDataTypes.ts`) stillschweigend
 * ignorieren.
 *
 * GENERISCH JE DISZIPLIN (Gewichtheben-Produktivierung, S6) — `resolveBasketballFieldSizeForMatchday()`
 * darunter bleibt als unveraenderter Wrapper erhalten.
 */
export function resolveArenaFieldSizeForMatchday(
  gameState: Pick<GameState, "disciplines" | "seasonState">,
  matchdayId: string | null,
  disciplineId: string,
): number | null {
  const scheduleRow = (gameState.seasonState.disciplineSchedule ?? []).find((entry) => entry.matchdayId === matchdayId);
  const slot = [scheduleRow?.discipline1, scheduleRow?.discipline2].find(
    (kandidat) => kandidat?.disciplineId === disciplineId,
  );
  if (slot && typeof slot.playerCount === "number" && Number.isFinite(slot.playerCount)) {
    return slot.playerCount;
  }
  const discipline = gameState.disciplines.find((entry) => entry.id === disciplineId);
  return typeof discipline?.playerCount === "number" && Number.isFinite(discipline.playerCount)
    ? discipline.playerCount
    : null;
}

/** BASKETBALL-WRAPPER, unveraendertes Verhalten: `resolveArenaFieldSizeForMatchday()` fuer "basketball". */
export function resolveBasketballFieldSizeForMatchday(
  gameState: Pick<GameState, "disciplines" | "seasonState">,
  matchdayId: string | null,
): number | null {
  return resolveArenaFieldSizeForMatchday(gameState, matchdayId, "basketball");
}

export type RunBattleModeArenaMatchdayInput = {
  gameState: GameState;
  saveId: string;
  seasonId: string;
  matchdayId: string;
  /**
   * Welche arena-aufgeloeste Disziplin (Mitglied von `ARENA_RESOLVED_DISCIPLINE_IDS`) dieser Lauf
   * simuliert. Weggelassen -> `"basketball"` — NUR Rueckwaertskompatibilitaet mit Aufrufern/Tests
   * von vor der Gewichtheben-Produktivierung (PR7, als es nur Basketball gab), KEIN Sonderfall
   * fuer eine zweite Disziplin. Der produktive Aufrufer (`arena-matchday-resolve-service.ts`,
   * `determineArenaDisciplineContexts()`) ermittelt diesen Wert seit dieser Aenderung SELBST ueber
   * `ARENA_RESOLVED_DISCIPLINE_IDS`-Mengen-Zugehoerigkeit der an diesem Spieltag gespielten
   * d1/d2-Disziplinen und reicht ihn IMMER explizit durch.
   */
  disciplineId?: string;
  /** Injektionspunkt fuer Tests — Default ist der echte, Playwright-gestuetzte Runner. */
  runArenaFixturesImpl?: typeof runArenaFixtures;
  runArenaFixturesOptions?: RunArenaFixturesOptions;
};

export type RunBattleModeArenaMatchdayResult = {
  overridesByTeamId: Map<string, ArenaTeamPointsOverride>;
  /**
   * BOXSCORE-AN-PPS (V2, Impact-Kurve): individuelle Spieler-PPs (playerId -> PPs), ueber BEIDE
   * Liga-Stufen dieses Spieltags EINMAL gemeinsam berechnet (s. Dateikopf-Kommentar) — die
   * gemeinsame Berechnung ist reine Bequemlichkeit, keine Referenz-Pool-Notwendigkeit mehr wie
   * bei V1: jeder Spieler haengt nur noch von seinem eigenen Boxscore-Wert und der Feldgroesse ab.
   * Leer, wenn kein einziges Duell einen eindeutig zuordenbaren Boxscore geliefert hat.
   */
  individualBoxscorePpsByPlayerId: Map<string, number>;
  warnings: string[];
};

/**
 * DER ASYNCHRONE ORCHESTRATOR (Plan Abschnitt 3.3c/3.4): fuer JEDE Liga mit Fixtures an diesem
 * Spieltag ein Batch-Aufruf von `runArenaFixtures()` (8 Fixtures in EINEM Aufruf, nicht 8 einzelne
 * — Batching ist bereits in PR6 eingebaut), danach Umrechnung in Team-Punkte nach dem 2/1/0-Modell
 * UND (BOXSCORE-AN-PPS) Sammlung ALLER Boxscore-Ergebnisse fuer die anschliessende Impact-Kurven-
 * Berechnung der individuellen PPs (V2, s. Dateikopf-Kommentar).
 *
 * Startet/schliesst pro Aufruf einen eigenen Chromium-Browser (on-demand, s. PR6/Plan 5.4) — bei
 * zwei Ligen also zwei Browser-Starts nacheinander, nicht parallel (haelt den Speicherbedarf auf
 * einen Browser zur selben Zeit begrenzt).
 */
export async function runBattleModeArenaMatchday(
  input: RunBattleModeArenaMatchdayInput,
): Promise<RunBattleModeArenaMatchdayResult> {
  const { gameState, saveId, seasonId, matchdayId } = input;
  const disciplineId = input.disciplineId ?? "basketball";
  const runImpl = input.runArenaFixturesImpl ?? runArenaFixtures;
  const overridesByTeamId = new Map<string, ArenaTeamPointsOverride>();
  const alleFixtureErgebnisse: ArenaFixtureResult[] = [];
  const warnings: string[] = [];

  for (const tier of LEAGUE_TIERS) {
    const fixtures = findLeagueFixturesForMatchday(gameState, tier, matchdayId);
    if (fixtures.length === 0) {
      continue;
    }

    const seedByFixtureKey = new Map<string, string>();
    const fixtureInputs: ArenaFixtureInput[] = fixtures.map((fixture) => {
      const seed = buildArenaMatchSeed({
        saveId,
        seasonId,
        matchdayId,
        homeTeamId: fixture.homeTeamId,
        awayTeamId: fixture.awayTeamId,
      });
      seedByFixtureKey.set(`${fixture.homeTeamId}::${fixture.awayTeamId}`, seed);
      return { homeTeamId: fixture.homeTeamId, awayTeamId: fixture.awayTeamId, seed };
    });

    let fixtureResults: ArenaFixtureResult[];
    try {
      fixtureResults = await runImpl(gameState, fixtureInputs, disciplineId, input.runArenaFixturesOptions);
    } catch (error) {
      warnings.push(
        `arena_matchday_league_failed:${tier}:${error instanceof Error ? error.message : String(error)}`,
      );
      continue;
    }

    alleFixtureErgebnisse.push(...fixtureResults);

    const tierOverrides = computeArenaTeamPointsFromFixtureResults(fixtureResults, seedByFixtureKey);
    for (const [teamId, override] of tierOverrides) {
      overridesByTeamId.set(teamId, override);
    }

    const expectedTeamIds = new Set(fixtures.flatMap((fixture) => [fixture.homeTeamId, fixture.awayTeamId]));
    for (const teamId of expectedTeamIds) {
      if (!tierOverrides.has(teamId)) {
        warnings.push(`arena_matchday_missing_result:${tier}:${teamId}`);
      }
    }
  }

  // BOXSCORE-AN-PPS (V2, Impact-Kurve): EINMAL ueber alle bereits gelaufenen Liga-Stufen dieses
  // Spieltags, nicht pro Liga getrennt — die Referenz ist ohnehin je Feldgroesse fest, nicht vom
  // Spieltag abhaengig, aber EINE gemeinsame Sammlung bleibt einfacher als zwei getrennte Laeufe
  // derselben Funktion. `resolveArenaFieldSizeForMatchday()` kann `null` liefern (kein
  // Spielplan-Eintrag/kein Katalogwert, sollte an einem echten Spielstand nicht vorkommen --
  // jede Arena-Disziplin fuehrt immer einen Katalog-Standardwert, s. `Discipline.playerCount`) —
  // `computeIndividualBoxscorePpsFromFixtureResults()` faellt dafuer selbst robust auf die
  // naechstgelegene gezogene Feldgroesse zurueck (s. `resolveArenaPpsReferenz()`), deshalb hier
  // bewusst KEINE eigene Warnung: anders als ein fehlendes Fixture-Ergebnis ist das kein Zeichen
  // eines echten Problems.
  const fieldSizeGewuerfelt = resolveArenaFieldSizeForMatchday(gameState, matchdayId, disciplineId);
  const individualBoxscorePpsByPlayerId = computeIndividualBoxscorePpsFromFixtureResults(
    alleFixtureErgebnisse,
    fieldSizeGewuerfelt,
    disciplineId,
  );

  // Ein Team ohne Fixture an diesem Spieltag (z. B. unvollstaendige `leagueTeamIds`) bekommt
  // schlicht keinen Eintrag in `overridesByTeamId` — der Aufrufer (die Resolve-Pipeline) faellt
  // fuer dieses Team automatisch auf den bestehenden PPS-Pfad zurueck, weil die Map dafuer keinen
  // Eintrag hat. Kein gesonderter Fehlerpfad noetig.
  return { overridesByTeamId, individualBoxscorePpsByPlayerId, warnings };
}
