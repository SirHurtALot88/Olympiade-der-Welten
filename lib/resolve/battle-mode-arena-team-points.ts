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
 * `ArenaTeamPointsOverride.seitenDiff`).
 *
 * INDIVIDUELLE SPIELER-PPs BLEIBEN UNANGETASTET (Abschnitt 5.1, Zusatzentscheidung): Chris will sie
 * langfristig von den Team-Punkten entkoppeln und liga-relativ aus dem Impact Rating der
 * Arena-Simulation skalieren — aber der Plan selbst haelt fest, dass das "bewusst noch nicht
 * umgesetzt" ist (fehlende Liga-Kontextdaten). Diese Datei liefert deshalb NUR die TEAM-Punkte;
 * `legacy-matchday-resolve-engine.ts` laesst die bestehende `distributeRankPointsToPlayers()`-
 * Verteilung der individuellen PPs fuer Battle-Mode-Basketball unveraendert (auf Basis des alten,
 * PPS-rang-basierten Team-Totals) — GENAU wie fuer jede andere Disziplin auch.
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
  warnings: string[];
};

/**
 * DER ASYNCHRONE ORCHESTRATOR (Plan Abschnitt 3.3c/3.4): fuer JEDE Liga mit Fixtures an diesem
 * Spieltag ein Batch-Aufruf von `runArenaFixtures()` (8 Fixtures in EINEM Aufruf, nicht 8 einzelne
 * — Batching ist bereits in PR6 eingebaut), danach Umrechnung in Team-Punkte nach dem 2/1/0-Modell.
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

  // Ein Team ohne Fixture an diesem Spieltag (z. B. unvollstaendige `leagueTeamIds`) bekommt
  // schlicht keinen Eintrag in `overridesByTeamId` — der Aufrufer (die Resolve-Pipeline) faellt
  // fuer dieses Team automatisch auf den bestehenden PPS-Pfad zurueck, weil die Map dafuer keinen
  // Eintrag hat. Kein gesonderter Fehlerpfad noetig.
  return { overridesByTeamId, warnings };
}
