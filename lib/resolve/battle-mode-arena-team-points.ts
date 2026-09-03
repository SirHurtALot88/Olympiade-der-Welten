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
 * BOXSCORE-AN-PPS (docs/design/boxscore-an-pps.md, Nachtrag zu PR7): die individuellen Spieler-PPs
 * sind SEIT DIESER AENDERUNG nicht mehr "bewusst noch nicht umgesetzt". `battle-mode-pps-modell-
 * plan.md` (31.08., VOR dieser Umsetzung geschrieben) hat dafuer bereits ein konkretes, zu weiten
 * Teilen von Chris abgenommenes Modell vorgeschlagen — dieses Modul setzt GENAU DAS um, statt eine
 * eigene Loesung zu erfinden:
 *
 *   1. ROHWERT JE SPIELER: `ArenaFixtureBoxscoreEintrag.wert` (Abschnitt 2/3 des Plans) — exakt der
 *      Wert, den der Mockup-Motor selbst als "Impact" anzeigt (`MOTOREN[fd].wert()`), kein zweiter
 *      Rechenweg.
 *   2. REFERENZ-POOL: alle Boxscore-Werte ALLER Basketball-Fixtures BEIDER Liga-Stufen desselben
 *      Spieltags zusammen (Plan Abschnitt 7, Frage 2 — "ENTSCHIEDEN (31.08.): gemeinsam ueber beide
 *      Ligen"). Das ist exakt der Kontext, den `battle-mode-spielmodus-plan.md` Abschnitt 5.1 noch
 *      als fehlend beschrieb ("sinnvoll erst... wenn Spielerdaten tatsaechlich durch ein Liga-Save
 *      laufen") — `runBattleModeArenaMatchday()` haelt hier beide Liga-Stufen EINES Spieltags
 *      gleichzeitig im Zugriff, bevor es zurueckkehrt.
 *   3. PERZENTILRANG JE SPIELER: `percentileOf(spieler.wert, pool)`, 0-100 — dasselbe Muster wie
 *      `lib/scouting/player-axis-star-rating.ts` (`percentileOf`/binaere Suche auf sortierter
 *      Liste), hier lokal noch einmal ausgeschrieben statt exportiert-und-importiert, um dieses
 *      Modul nicht an ein Scouting-internes Modul zu koppeln (Plan Abschnitt 4.1 nennt diese
 *      Funktion als "direktes Vorbild", nicht als Pflicht-Import).
 *   4. PPs = (Perzentil / 100) * `BASKETBALL_INDIVIDUAL_PPS_MAX` (Plan Abschnitt 5, Schritt 4) —
 *      linear, mit der von Chris genannten Struktur "Topspieler nahe Hoechstwert, Mitte ~halb,
 *      schwach nahe null" als MATHEMATISCHE FOLGE der Perzentil-Definition, nicht als drei separat
 *      gesetzte Zahlen.
 *
 * WAS NOCH NICHT VON CHRIS BEANTWORTET IST (Plan Abschnitt 7) UND HIER BEWUSST, DOKUMENTIERT
 * ENTSCHIEDEN WURDE, MANGELS PRAEZISERER VORGABE:
 *   - Frage 1 (der konkrete Zahlenwert fuer `BASKETBALL_INDIVIDUAL_PPS_MAX`, "ENTSCHIEDEN: fest,
 *     nicht mit playerCount skaliert" — nur die ZAHL selbst offen): hier `6,6` gewaehlt, der von
 *     zwei im Plan genannten Kandidaten (3,3 / 6,6), weil der Plan selbst festhaelt, dass 6,6
 *     "Chris' eigenes Beispiel [5/2,5/0,5] am naechsten trifft" (Plan Abschnitt 6). EIN einziger,
 *     klar benannter Exportwert (`BASKETBALL_INDIVIDUAL_PPS_MAX`) — leicht aenderbar, sobald Chris
 *     eine echte Zahl nennt.
 *   - Frage 3 (nur eingesetzte Spieler im Pool, nicht nominierte Bank): hier so entschieden — der
 *     Pool besteht NUR aus Boxscore-Eintraegen, die tatsaechlich gespielt UND eindeutig einem
 *     Spieler zugeordnet werden konnten (s. `arena-headless-runner.ts`). Ein Spieler, dessen Name
 *     im Duell nicht eindeutig war, taucht auch NICHT im Pool auf (sein roher `wert` ist real, aber
 *     nicht verifizierbar einem Spieler zuzuordnen — ihn trotzdem in den Pool zu mischen wuerde
 *     anderer Spieler Perzentile verzerren, ohne dass irgendjemand von diesem einen Wert PPs
 *     bekaeme).
 *   - Frage 4 (kleine Stichprobe bei playerCount=2): bewusst NICHT abgefedert — 32-64 echte
 *     Spielerleistungen sind (Plan Abschnitt 4.3) eine reale, keine simulierte Stichprobe.
 *   - Frage 5 (linear vs. gebaendert): linear, wie im Plan als "erster Wurf" vorgeschlagen.
 *   - Frage 6 (Rolling-Historie ueber mehrere Spieltage/Saisons): NICHT umgesetzt — braucht
 *     `seasonState.arenaMatchResultLogs`, das laut Plan noch nicht existiert und explizit ausserhalb
 *     dieser Aenderung liegt.
 *   - Frage 7 (fliessen diese PPs in dieselben Saison-Ledger/Progressions-Toepfe wie PPS-PPs?): NICHT
 *     beantwortet, siehe docs/design/boxscore-an-pps.md, Abschnitt "Offene Anschlussfrage" — diese
 *     Aenderung setzt NUR `pointsAwarded` in der Resolve-Preview, ruehrt aber keine
 *     Downstream-Konsumenten an.
 *
 * INDIVIDUELLE PPs SIND JETZT ECHT ENTKOPPELT VON DEN TEAM-PUNKTEN (Plan Abschnitt 0/1.1: "genau
 * diese Kopplung will Chris fuer Battle Mode aufloesen"): die Summe der Spieler-PPs eines Teams
 * MUSS nicht mehr `teamPoints` ergeben — anders als beim alten PPS-Pfad, wo das eine harte Invariante
 * war. Das ist gewollt, nicht vergessen.
 */
import type { LeagueTier } from "@/lib/season/league-split";
import type { Fixture, GameState } from "@/lib/data/olyDataTypes";
import {
  runArenaFixtures,
  type ArenaFixtureInput,
  type ArenaFixtureResult,
  type RunArenaFixturesOptions,
} from "@/lib/battle/arena-headless-runner";

/** Die einzige Disziplin, die in Phase 1 einen Arena-Pfad hat (Plan Abschnitt 3.2, Option a). */
export const ARENA_RESOLVED_DISCIPLINE_IDS: ReadonlySet<string> = new Set(["basketball"]);

/** Chris' Vorgabe vom 30.08., "das ist gesetzt" — s. Plan Abschnitt 5.1. */
export const ARENA_TEAM_POINTS = {
  win: 2,
  draw: 1,
  loss: 0,
} as const;

/**
 * `DISCIPLINE_MAX` aus `battle-mode-pps-modell-plan.md` Abschnitt 5/7 — Frage 1 dort ist noch OHNE
 * konkrete Zahl von Chris ("Rueckfrage an Chris folgt separat"), deshalb hier so gewaehlt wie im
 * Kommentar am Dateikopf begruendet (6,6 statt 3,3, "trifft Chris' eigenes Beispiel am naechsten").
 * EIN Wert, EINE Stelle — kein Suchen-und-Ersetzen noetig, sobald Chris eine echte Zahl nennt.
 */
export const BASKETBALL_INDIVIDUAL_PPS_MAX = 6.6;

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

/**
 * Das Perzentil eines Werts in einer AUFSTEIGEND sortierten Liste — bitgenau dasselbe Muster wie
 * `percentileOf()` in `lib/scouting/player-axis-star-rating.ts` (binaere Suche auf die untere
 * Schranke), hier lokal, um dieses Modul nicht an ein Scouting-internes, nicht exportiertes Modul
 * zu koppeln (`battle-mode-pps-modell-plan.md` Abschnitt 5 nennt es als Vorbild, nicht als
 * Pflicht-Import).
 */
function percentileOf(value: number, sortedValues: readonly number[]): number {
  if (sortedValues.length === 0) return 50;
  let low = 0;
  let high = sortedValues.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (sortedValues[mid]! < value) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return (low / sortedValues.length) * 100;
}

function roundPps(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * BOXSCORE-AN-PPS, KERNFUNKTION: aus ALLEN Boxscore-Ergebnissen EINES Spieltags (typischerweise
 * beide Liga-Stufen zusammen, s. `runBattleModeArenaMatchday()`) individuelle Spieler-PPs nach dem
 * in `battle-mode-pps-modell-plan.md` Abschnitt 5 vorgeschlagenen Modell. Rein, synchron, ohne
 * Playwright — nimmt bereits gelaufene `ArenaFixtureResult`s entgegen, genau wie
 * `computeArenaTeamPointsFromFixtureResults()` daneben.
 *
 * NUR Boxscore-Eintraege mit eindeutig zugeordneter `playerId` (s. `arena-headless-runner.ts`)
 * gehen in den Referenz-Pool ein UND bekommen einen Eintrag im Ergebnis — ein Spieler, dessen Name
 * in seinem Duell nicht eindeutig war, bleibt hier schlicht unerwaehnt; der Aufrufer
 * (`legacy-matchday-resolve-engine.ts`) faellt fuer GENAU DIESEN Spieler auf den alten PPS-Pfad
 * zurueck, ohne dass es andere Spieler seines Teams beruehrt (anders als bei den Team-Punkten oben
 * ist hier jeder Spieler unabhaengig).
 */
export function computeIndividualBoxscorePpsFromFixtureResults(
  fixtureResults: readonly ArenaFixtureResult[],
): Map<string, number> {
  const impactByPlayerId = new Map<string, number>();
  for (const result of fixtureResults) {
    for (const eintrag of result.boxscore) {
      if (eintrag.playerId === null) continue;
      impactByPlayerId.set(eintrag.playerId, eintrag.wert);
    }
  }

  const pool = [...impactByPlayerId.values()].sort((a, b) => a - b);
  const ppsByPlayerId = new Map<string, number>();
  for (const [playerId, wert] of impactByPlayerId) {
    const perzentil = percentileOf(wert, pool);
    ppsByPlayerId.set(playerId, roundPps((perzentil / 100) * BASKETBALL_INDIVIDUAL_PPS_MAX));
  }
  return ppsByPlayerId;
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
   * BOXSCORE-AN-PPS: individuelle Spieler-PPs (playerId -> PPs), ueber BEIDE Liga-Stufen dieses
   * Spieltags EINMAL gemeinsam berechnet (s. Dateikopf-Kommentar, Referenz-Pool). Leer, wenn kein
   * einziges Duell einen eindeutig zuordenbaren Boxscore geliefert hat.
   */
  individualBoxscorePpsByPlayerId: Map<string, number>;
  warnings: string[];
};

/**
 * DER ASYNCHRONE ORCHESTRATOR (Plan Abschnitt 3.3c/3.4): fuer JEDE Liga mit Fixtures an diesem
 * Spieltag ein Batch-Aufruf von `runArenaFixtures()` (8 Fixtures in EINEM Aufruf, nicht 8 einzelne
 * — Batching ist bereits in PR6 eingebaut), danach Umrechnung in Team-Punkte nach dem 2/1/0-Modell
 * UND (BOXSCORE-AN-PPS) Sammlung ALLER Boxscore-Ergebnisse fuer die anschliessende, liga-uebergreifende
 * Perzentil-Berechnung der individuellen PPs.
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

  // BOXSCORE-AN-PPS: EINMAL ueber alle bereits gelaufenen Liga-Stufen dieses Spieltags, nicht pro
  // Liga getrennt — das ist die "gemeinsamer Referenz-Pool"-Entscheidung aus
  // battle-mode-pps-modell-plan.md Abschnitt 7, Frage 2.
  const individualBoxscorePpsByPlayerId = computeIndividualBoxscorePpsFromFixtureResults(alleFixtureErgebnisse);

  // Ein Team ohne Fixture an diesem Spieltag (z. B. unvollstaendige `leagueTeamIds`) bekommt
  // schlicht keinen Eintrag in `overridesByTeamId` — der Aufrufer (die Resolve-Pipeline) faellt
  // fuer dieses Team automatisch auf den bestehenden PPS-Pfad zurueck, weil die Map dafuer keinen
  // Eintrag hat. Kein gesonderter Fehlerpfad noetig.
  return { overridesByTeamId, individualBoxscorePpsByPlayerId, warnings };
}
