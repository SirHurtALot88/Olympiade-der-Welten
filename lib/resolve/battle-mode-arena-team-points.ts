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
 */
import type { LeagueTier } from "@/lib/season/league-split";
import type { Fixture, GameState } from "@/lib/data/olyDataTypes";
import {
  runArenaFixtures,
  type ArenaFixtureInput,
  type ArenaFixtureResult,
  type RunArenaFixturesOptions,
} from "@/lib/battle/arena-headless-runner";
import basketballPpsReferenzJson from "@/data/generated/basketball-pps-referenz.json";

/** Die einzige Disziplin, die in Phase 1 einen Arena-Pfad hat (Plan Abschnitt 3.2, Option a). */
export const ARENA_RESOLVED_DISCIPLINE_IDS: ReadonlySet<string> = new Set(["basketball"]);

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
 * BASKETBALL-PPS-REFERENZ (Opus-Dokument Abschnitt 7/8): `iMittel` (Median) und `iKrass`
 * (99,5.-Perzentil) des rohen Boxscore-Impacts, JE FELDGROESSE (`playerCount` 2..6) getrennt
 * gezogen — der Rohwert skaliert massiv mit der Feldgroesse (Median 33,5 bei 2v2 gegen 11,1 bei
 * 6v6, Opus-Dokument Abschnitt 7), eine gemeinsame Kurve fuer alle Feldgroessen wuerde Chris'
 * Problem bei kleiner Besetzung ueber einen anderen Mechanismus reproduzieren. Gezogen von
 * `scripts/ziehe-basketball-pps-referenz.ts` gegen ECHTE Liga-Kader aus dem `live-save`-Abbild
 * (nicht den Demokader des Mockups) — Provenienz (Motor-SHA1, Repo-Commit, Ziehdatum,
 * Fixture-Zahl) steht in der Datei selbst, s. dortiger `hinweis`.
 */
type BasketballPpsReferenzFeldgroesse = { iMittel: number; iKrass: number };
type BasketballPpsReferenzJson = {
  feldgroessen: Record<string, { n: number; iMittel: number; iKrass: number }>;
};

const BASKETBALL_PPS_REFERENZ_FELDGROESSEN: ReadonlyMap<number, BasketballPpsReferenzFeldgroesse> = new Map(
  Object.values((basketballPpsReferenzJson as BasketballPpsReferenzJson).feldgroessen).map((werte) => [
    werte.n,
    { iMittel: werte.iMittel, iKrass: werte.iKrass },
  ]),
);

/**
 * Loest die Referenzwerte fuer eine (moeglicherweise unbekannte oder fehlende) Feldgroesse auf --
 * faellt auf die naechstgelegene GEZOGENE Feldgroesse zurueck, statt einen Fehler zu werfen. Das
 * deckt sowohl "playerCount fuer diesen Spieltag nicht ermittelbar" (`null`) als auch eine
 * Feldgroesse ausserhalb der gezogenen Spanne (z. B. 1 oder 7, sollte am echten Spielplan nicht
 * vorkommen, s. `resolveBasketballFieldSizeForMatchday()`) mit demselben, robusten Pfad ab.
 */
export function resolveBasketballPpsReferenz(
  playerCount: number | null,
): { referenz: BasketballPpsReferenzFeldgroesse; feldgroesseGenutzt: number } {
  const verfuegbareGroessen = [...BASKETBALL_PPS_REFERENZ_FELDGROESSEN.keys()].sort((a, b) => a - b);
  if (verfuegbareGroessen.length === 0) {
    throw new Error(
      "battle-mode-arena-team-points: data/generated/basketball-pps-referenz.json enthaelt keine Feldgroessen — " +
        "scripts/ziehe-basketball-pps-referenz.ts ausfuehren.",
    );
  }
  const gerundet = playerCount != null && Number.isFinite(playerCount) ? Math.round(playerCount) : null;
  if (gerundet != null && BASKETBALL_PPS_REFERENZ_FELDGROESSEN.has(gerundet)) {
    return { referenz: BASKETBALL_PPS_REFERENZ_FELDGROESSEN.get(gerundet)!, feldgroesseGenutzt: gerundet };
  }
  // Basketballs Katalog-Standardwert (`Discipline.playerCount`) als Ziel, wenn ueberhaupt keine
  // Feldgroesse ermittelbar war -- dieselbe Zahl, auf die auch der bestehende PPS-Pfad
  // (`resolveDisciplinePlayerCount()`) ohne Spielplan-Eintrag zurueckfaellt.
  const ziel = gerundet ?? 6;
  let naechste = verfuegbareGroessen[0]!;
  for (const kandidat of verfuegbareGroessen) {
    if (Math.abs(kandidat - ziel) < Math.abs(naechste - ziel)) naechste = kandidat;
  }
  return { referenz: BASKETBALL_PPS_REFERENZ_FELDGROESSEN.get(naechste)!, feldgroesseGenutzt: naechste };
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
 * Baut aus bereits gelaufenen Arena-Fixture-Ergebnissen (s. `runArenaFixtures()`) die Team-Punkte-
 * Overrides je teamId. Rein, synchron, ohne Playwright/Browser — dafuer in den meisten Tests
 * gedacht (s. Testing-Lektion PR6: Chromium ist in `full-test-suite` nicht installiert).
 */
export function computeArenaTeamPointsFromFixtureResults(
  fixtureResults: readonly ArenaFixtureResult[],
  seedByFixtureKey: ReadonlyMap<string, string>,
): Map<string, ArenaTeamPointsOverride> {
  const overridesByTeamId = new Map<string, ArenaTeamPointsOverride>();
  for (const result of fixtureResults) {
    const [heimPunkte, gastPunkte] = arenaTeamPointsForFixture(result.seiten);
    const seed = seedByFixtureKey.get(`${result.homeTeamId}::${result.awayTeamId}`) ?? "";
    const heimOutcome: ArenaTeamPointsOverride["outcome"] =
      result.seiten[0] === result.seiten[1] ? "draw" : result.seiten[0] > result.seiten[1] ? "win" : "loss";
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
 * vorkommen, s. `resolveBasketballPpsReferenz()`) liefert 0 statt NaN/Infinity durchzureichen —
 * defensiv, sollte an einer echten gezogenen Referenz nie greifen.
 */
export function ppsAusBasketballImpact(impact: number, referenz: BasketballPpsReferenzFeldgroesse): number {
  const { iMittel, iKrass } = referenz;
  if (!(iKrass > 0) || !(iMittel > 0) || iMittel >= iKrass) return 0;
  const gamma = Math.log(BASKETBALL_PPS_ANTEIL_MITTE) / Math.log(iMittel / iKrass);
  const basis = Math.max(0, impact) / iKrass;
  const anteil = basis <= 0 ? 0 : Math.min(1, Math.pow(basis, gamma));
  return roundPps(BASKETBALL_INDIVIDUAL_PPS_MAX * anteil);
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
 * `playerCount` ist die fuer DIESEN Spieltag gewuerfelte Basketball-Feldgroesse (s.
 * `resolveBasketballFieldSizeForMatchday()` unten) — `null`, wenn sie nicht ermittelbar war;
 * `resolveBasketballPpsReferenz()` faellt dafuer robust auf die naechstgelegene gezogene
 * Feldgroesse zurueck, wirft also nie.
 *
 * NUR Boxscore-Eintraege mit eindeutig zugeordneter `playerId` (s. `arena-headless-runner.ts`)
 * bekommen einen Eintrag im Ergebnis — ein Spieler, dessen Name in seinem Duell nicht eindeutig
 * war, bleibt hier schlicht unerwaehnt; der Aufrufer (`legacy-matchday-resolve-engine.ts`) faellt
 * fuer GENAU DIESEN Spieler auf den alten PPS-Pfad zurueck, ohne dass es andere Spieler seines
 * Teams beruehrt. Anders als beim V1-Perzentil braucht diese Funktion keinen Pool mehr — jeder
 * Spieler haengt nur noch von seinem eigenen Boxscore-Wert und der Feldgroesse ab, nicht mehr vom
 * Rest des Spieltags.
 */
export function computeIndividualBoxscorePpsFromFixtureResults(
  fixtureResults: readonly ArenaFixtureResult[],
  playerCount: number | null,
): Map<string, number> {
  const { referenz } = resolveBasketballPpsReferenz(playerCount);
  const ppsByPlayerId = new Map<string, number>();
  for (const result of fixtureResults) {
    for (const eintrag of result.boxscore) {
      if (eintrag.playerId === null) continue;
      ppsByPlayerId.set(eintrag.playerId, ppsAusBasketballImpact(eintrag.wert, referenz));
    }
  }
  return ppsByPlayerId;
}

/**
 * Die fuer DIESEN Spieltag gewuerfelte Basketball-Feldgroesse (`playerCount` 2..6), fuer die
 * Impact-Kurven-Referenz — ANDERS als `resolveDisciplinePlayerCount()` (`rank-to-points.ts`)
 * OHNE vorher wissen zu muessen, ob Basketball an diesem Spieltag `d1` oder `d2` ist: geprueft
 * werden BEIDE Slots des Spielplan-Eintrags, der erste mit `disciplineId === "basketball"`
 * gewinnt. `resolveDisciplinePlayerCount()` selbst waere hier riskant gewesen — bei falsch
 * geratener Seite faellt es NICHT auf den jeweils anderen Slot zurueck, sondern direkt auf den
 * Katalogwert, und wuerde damit einen echten, vom Katalog abweichenden Spielplan-Wert (nachgemessen
 * real vorkommend, s. `Discipline.playerCount`-Kommentar in `olyDataTypes.ts`) stillschweigend
 * ignorieren.
 */
export function resolveBasketballFieldSizeForMatchday(
  gameState: Pick<GameState, "disciplines" | "seasonState">,
  matchdayId: string | null,
): number | null {
  const scheduleRow = (gameState.seasonState.disciplineSchedule ?? []).find((entry) => entry.matchdayId === matchdayId);
  const slot = [scheduleRow?.discipline1, scheduleRow?.discipline2].find(
    (kandidat) => kandidat?.disciplineId === "basketball",
  );
  if (slot && typeof slot.playerCount === "number" && Number.isFinite(slot.playerCount)) {
    return slot.playerCount;
  }
  const discipline = gameState.disciplines.find((entry) => entry.id === "basketball");
  return typeof discipline?.playerCount === "number" && Number.isFinite(discipline.playerCount)
    ? discipline.playerCount
    : null;
}

export type RunBattleModeArenaMatchdayInput = {
  gameState: GameState;
  saveId: string;
  seasonId: string;
  matchdayId: string;
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
      fixtureResults = await runImpl(gameState, fixtureInputs, "basketball", input.runArenaFixturesOptions);
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
  // derselben Funktion. `resolveBasketballFieldSizeForMatchday()` kann `null` liefern (kein
  // Spielplan-Eintrag/kein Katalogwert, sollte an einem echten Spielstand nicht vorkommen --
  // Basketball fuehrt immer einen Katalog-Standardwert, s. `Discipline.playerCount`) —
  // `computeIndividualBoxscorePpsFromFixtureResults()` faellt dafuer selbst robust auf die
  // naechstgelegene gezogene Feldgroesse zurueck (s. `resolveBasketballPpsReferenz()`), deshalb
  // hier bewusst KEINE eigene Warnung: anders als ein fehlendes Fixture-Ergebnis ist das kein
  // Zeichen eines echten Problems.
  const fieldSizeGewuerfelt = resolveBasketballFieldSizeForMatchday(gameState, matchdayId);
  const individualBoxscorePpsByPlayerId = computeIndividualBoxscorePpsFromFixtureResults(
    alleFixtureErgebnisse,
    fieldSizeGewuerfelt,
  );

  // Ein Team ohne Fixture an diesem Spieltag (z. B. unvollstaendige `leagueTeamIds`) bekommt
  // schlicht keinen Eintrag in `overridesByTeamId` — der Aufrufer (die Resolve-Pipeline) faellt
  // fuer dieses Team automatisch auf den bestehenden PPS-Pfad zurueck, weil die Map dafuer keinen
  // Eintrag hat. Kein gesonderter Fehlerpfad noetig.
  return { overridesByTeamId, individualBoxscorePpsByPlayerId, warnings };
}
