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
 * BOXSCORE-AN-PPS (docs/design/boxscore-an-pps.md, Nachtrag zu PR7): die individuellen Spieler-PPs
 * sind SEIT DIESER AENDERUNG nicht mehr laenger "bewusst noch nicht umgesetzt". Der urspruengliche
 * Blockierer im Plan ("fehlende Liga-Kontextdaten... sinnvoll erst mit der echten Resolve-Pipeline,
 * wenn Spielerdaten tatsaechlich durch ein Liga-Save laufen", Abschnitt 5.1) ist inzwischen aufgeloest:
 * `runBattleModeArenaMatchday()` laeuft laengst gegen die echte Resolve-Pipeline (PR7/8 sind gebaut)
 * und bekommt hier, PRO LIGA-STUFE, alle 8 Fixtures/96 gefelderten Spieler EINES Spieltags auf einmal
 * zurueck — genau der Liga-Kontext, der frueher fehlte.
 *
 * WAS "LIGA-RELATIV SKALIERT AUS DEM IMPACT RATING" HIER KONKRET HEISST (Chris' Vorgabe war absichtlich
 * vage — "z.B." —, diese Entscheidung ist deshalb explizit dokumentiert, nicht versteckt):
 *   1. TEAM-EBENE: `boxscoreRank` ist der Rang DIESES Teams unter allen Teams DERSELBEN Liga-Stufe an
 *      diesem Spieltag, sortiert nach der SUMME der Boxscore-Impact-Werte (`ArenaFixtureBoxscoreEintrag
 *      .wert`) seiner gefeldeten Spieler -- Shared-Ties wie ueberall sonst im Resolve. Das ist die
 *      "liga-relative" Komponente: ein Team mit starker Arena-Leistung bekommt einen besseren Rang
 *      als ein anderes Team mit schwacher Arena-Leistung, UNABHAENGIG vom Sieg/Niederlage-Ausgang
 *      (der beim 2/1/0-Modell oben bleibt, s. Kommentar dort).
 *   2. INDIVIDUAL-EBENE: `legacy-matchday-resolve-engine.ts` speist `boxscoreRank` GENAU DORT in
 *      `getRankToPointsValue()` ein, wo bisher der PPS-Rang stand (dieselbe Tabelle, keine neue
 *      Punkte-Oekonomie) und verteilt den resultierenden Team-Pool NICHT mehr nach PPS-Anteil,
 *      sondern nach dem Anteil, den jeder Spieler an der Boxscore-Impact-SUMME seines Teams hat.
 *      Stars (hoher Impact) bekommen dadurch mehr vom Pool, schwache Spieler weniger -- UND der Pool
 *      selbst faellt groesser aus, wenn das Team insgesamt gegen die Liga stark spielte.
 *   3. WARUM NICHT EIN GLOBALER Rang ueber alle ~96 Spieler einer Liga-Stufe direkt in
 *      `getRankToPointsValue()`: die Tabelle (`references/sheets/rank-to-points.json`) deckt nur
 *      Raenge 1..32 ab (Team-Groesse der ganzen Liga), nicht die Groessenordnung einer vollen
 *      Spieler-Population -- ein direkter Spieler-Rang liefe ab Rang 33 ins Leere (`null`, keine
 *      Punkte). Der Team-Rang-plus-Anteils-Ansatz oben bleibt darum innerhalb der bestehenden
 *      Tabellendomaene.
 *   4. SICHERHEITSNETZ: `boxscoreRank`/`playerImpactByPlayerId` werden NUR gesetzt, wenn JEDER
 *      Boxscore-Name des betroffenen Duells eindeutig einem Spieler zugeordnet werden konnte (s.
 *      `arena-headless-runner.ts`, `baueEindeutigeNamenZuordnung()`). Fehlt auch nur ein Spieler
 *      (Namens-Kollision, Runner-Fehler), bleibt das GESAMTE Team beim alten PPS-Pfad -- kein
 *      Team bekommt eine teilweise aus Boxscore, teilweise aus PPS gemischte Verteilung.
 *
 * Diese Datei liefert weiterhin ausschliesslich TEAM-seitige Vorverarbeitung (Team-Punkte 2/1/0 UND
 * die neuen Boxscore-Rang-/Impact-Felder); die tatsaechliche Anwendung auf einzelne Spieler-PPs
 * passiert erst in `legacy-matchday-resolve-engine.ts`.
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
  /**
   * BOXSCORE-AN-PPS: Rang dieses Teams unter allen Teams DERSELBEN Liga-Stufe an diesem
   * Spieltag, nach Summe der Boxscore-Impact-Werte seiner gefeldeten Spieler (s. Dateikopf-
   * Kommentar). `null`, wenn fuer dieses Team keine vollstaendig zugeordneten Boxscore-Daten
   * vorliegen (Namens-Kollision, fehlender Boxscore) — der Aufrufer faellt dann fuer die
   * individuellen PPs dieses Teams auf den PPS-Pfad zurueck, waehrend `teamPoints` oben
   * unveraendert beim 2/1/0-Ergebnis bleibt.
   */
  boxscoreRank: number | null;
  /**
   * Boxscore-Impact-Wert je Spieler DIESES Teams (playerId -> `ArenaFixtureBoxscoreEintrag.wert`).
   * Nur gesetzt (und nur dann vollstaendig), wenn boxscoreRank ebenfalls gesetzt ist.
   */
  playerImpactByPlayerId: ReadonlyMap<string, number> | null;
};

/**
 * Shared-Ties-Rang absteigend nach `wertVon(item)` — dieselbe Regel wie im uebrigen Resolve
 * (`legacy-matchday-resolve-engine.ts`, `rankDescendingSharedTies`), hier lokal noch einmal
 * ausgeschrieben, um dieses Modul frei von einem Import aus dem Resolve-Engine zu halten (dieses
 * Modul wird selbst VON dort importiert — ein Ruecksprung waere ein Zirkel).
 */
function rangAbsteigendMitGleichstand<T>(items: T[], wertVon: (item: T) => number): Map<T, number> {
  const sortiert = [...items].sort((a, b) => wertVon(b) - wertVon(a));
  const rangByItem = new Map<T, number>();
  let vorherigerWert: number | null = null;
  let geteilterRang = 0;
  sortiert.forEach((item, index) => {
    const wert = wertVon(item);
    if (vorherigerWert === null || wert !== vorherigerWert) {
      geteilterRang = index + 1;
      vorherigerWert = wert;
    }
    rangByItem.set(item, geteilterRang);
  });
  return rangByItem;
}

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
 * Boxscore-Impact-Werte GENAU EINER Team-Seite eines Duells, nur aus Eintraegen, die eindeutig
 * zugeordnet werden konnten (s. `ArenaFixtureBoxscoreEintrag.playerId`). `vollstaendig` ist false,
 * sobald irgendein Eintrag im Duell ueberhaupt nicht zugeordnet werden konnte (Namens-Kollision) —
 * dann ist unklar, ob der fehlende Spieler zu DIESER oder der gegnerischen Seite gehoert haette,
 * und BEIDE Seiten dieses Duells gelten als unvollstaendig (s. Aufrufer).
 */
function sammleImpactJeSeite(
  boxscore: ArenaFixtureResult["boxscore"],
  seite: "home" | "away",
): { impactByPlayerId: Map<string, number>; vollstaendig: boolean } {
  const impactByPlayerId = new Map<string, number>();
  let vollstaendig = true;
  for (const eintrag of boxscore) {
    if (eintrag.playerId === null) {
      vollstaendig = false;
      continue;
    }
    if (eintrag.side !== seite) continue;
    impactByPlayerId.set(eintrag.playerId, eintrag.wert);
  }
  return { impactByPlayerId, vollstaendig };
}

/**
 * Baut aus bereits gelaufenen Arena-Fixture-Ergebnissen (s. `runArenaFixtures()`) die Team-Punkte-
 * Overrides je teamId. Rein, synchron, ohne Playwright/Browser — dafuer in den meisten Tests
 * gedacht (s. Testing-Lektion PR6: Chromium ist in `full-test-suite` nicht installiert).
 *
 * BOXSCORE-AN-PPS: `fixtureResults` sollte hier bereits ALLE Fixtures EINER Liga-Stufe EINES
 * Spieltags enthalten (so wie `runBattleModeArenaMatchday()` es aufruft) — `boxscoreRank` rankt
 * NUR unter den hier uebergebenen Teams. Weniger Fixtures (z. B. ein einzelnes, isoliertes Duell
 * in einem Test) ergeben einen technisch gueltigen, aber kleineren Rangraum — fuer die Team-Punkte
 * (2/1/0) macht das keinen Unterschied, sie sind schon pro Duell unabhaengig.
 */
export function computeArenaTeamPointsFromFixtureResults(
  fixtureResults: readonly ArenaFixtureResult[],
  seedByFixtureKey: ReadonlyMap<string, string>,
): Map<string, ArenaTeamPointsOverride> {
  const overridesByTeamId = new Map<string, ArenaTeamPointsOverride>();
  const impactByPlayerIdByTeamId = new Map<string, Map<string, number>>();
  const impactSummeByTeamId = new Map<string, number>();

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
      boxscoreRank: null,
      playerImpactByPlayerId: null,
    });
    overridesByTeamId.set(result.awayTeamId, {
      teamPoints: gastPunkte,
      arenaMatchSeed: seed,
      opponentTeamId: result.homeTeamId,
      seiten: [result.seiten[1], result.seiten[0]],
      outcome: gastOutcome,
      boxscoreRank: null,
      playerImpactByPlayerId: null,
    });

    // Ein leerer Boxscore heisst "keine Daten", nicht "jeder Spieler hatte Impact 0" — z.B. der
    // synchrone `[]`-Platzhalter aelterer Tests, die Boxscore-Zuordnung bewusst nicht pruefen.
    // Beide Seiten gelten dann als unvollstaendig, exakt wie bei einer Namens-Kollision.
    const hatBoxscore = result.boxscore.length > 0;
    const heimImpact = hatBoxscore
      ? sammleImpactJeSeite(result.boxscore, "home")
      : { impactByPlayerId: new Map<string, number>(), vollstaendig: false };
    const gastImpact = hatBoxscore
      ? sammleImpactJeSeite(result.boxscore, "away")
      : { impactByPlayerId: new Map<string, number>(), vollstaendig: false };
    if (heimImpact.vollstaendig && gastImpact.vollstaendig) {
      impactByPlayerIdByTeamId.set(result.homeTeamId, heimImpact.impactByPlayerId);
      impactByPlayerIdByTeamId.set(result.awayTeamId, gastImpact.impactByPlayerId);
      impactSummeByTeamId.set(result.homeTeamId, [...heimImpact.impactByPlayerId.values()].reduce((a, b) => a + b, 0));
      impactSummeByTeamId.set(result.awayTeamId, [...gastImpact.impactByPlayerId.values()].reduce((a, b) => a + b, 0));
    }
    // Unvollstaendig (Namens-Kollision o.ae.): weder impactByPlayerIdByTeamId noch
    // impactSummeByTeamId bekommen einen Eintrag fuer eines der beiden Teams — sie bleiben unten
    // bei boxscoreRank/playerImpactByPlayerId=null, der Aufrufer faellt fuer BEIDE Seiten dieses
    // einen Duells auf den PPS-Pfad zurueck (andere Duelle derselben Liga-Stufe sind davon nicht
    // betroffen).
  }

  const boxscoreRangByTeamId = rangAbsteigendMitGleichstand(
    [...impactSummeByTeamId.keys()],
    (teamId) => impactSummeByTeamId.get(teamId) ?? 0,
  );
  for (const [teamId, override] of overridesByTeamId) {
    const playerImpactByPlayerId = impactByPlayerIdByTeamId.get(teamId) ?? null;
    const boxscoreRank = playerImpactByPlayerId ? boxscoreRangByTeamId.get(teamId) ?? null : null;
    overridesByTeamId.set(teamId, { ...override, boxscoreRank, playerImpactByPlayerId });
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
