/**
 * GETEILTER TESTHELFER (nicht selbst eine `.test.ts`-Datei!): baut einen frischen Battle-Mode-Save
 * mit AKTIVEM Liga-Split (`isLeagueSplitActive() === true`, 32 Teams in 2 Ligen a 16, echter
 * Rundenplan-Spielplan ueber `buildSeasonFixtureSchedule()` statt der alten Dummy-Paarung) --
 * fuer Messungen, die echte Spieltags-Fixtures brauchen (Task #199, s.
 * docs/design/pps-duell-bruecke-punkteverhaeltnis-16-10.md Abschnitt 8.7: alle acht Saves des
 * Live-Abbilds haben `isLeagueSplitActive() === false` und damit nur die alte 1-Fixture/Spieltag-
 * Dummy-Kette -- jede bisherige Messung der PPS-Duell-Bruecke lief deshalb zu >90% ueber den alten
 * `"pps"`-Rueckfall, nie ueber `ppAusSpielerScore()` ("pps_duell") selbst).
 *
 * Nutzt denselben Wizard-Pfad wie `scripts/e2e-battle-pps-duell.ts` und
 * `tests/helpers/mini-dm-ffa-battle-save.ts` (applyNewGameSetup({gameMode:"battle"}) ->
 * fuehreLigaSetupDraftAus()) -- EINE Quelle fuer "wie baue ich einen vollstaendigen Battle-Save
 * zum Testen", keine dritte Kopie. `fuehreLigaSetupDraftAus` ist unvermeidlich (~40s je Aufruf,
 * echte organische KI-Engine): ein frischer Save hat `rosters: []`, bis der Liga-Draft gelaufen
 * ist (s. `buildNewGameStateFromBaseline` in `lib/game/new-game-setup-service.ts`).
 *
 * WARUM DAS `isLeagueSplitActive()`-ERGEBNIS HIER NICHT ZUFAELLIG IST: `buildNewGameStateFromBaseline`
 * setzt `seasonState.leagueByTeamId` und einen echten `buildSeasonFixtureSchedule()`-Spielplan NUR,
 * wenn `gameMode === "battle"` uebergeben wird (lib/game/new-game-setup-service.ts, Kommentar
 * "LIGA-SPLIT AKTIVIERUNG NUR FUER BATTLE-MODE-SAVES") -- das ist unabhaengig vom (unseeded)
 * Liga-Draft deterministisch der Fall, nicht nur wahrscheinlich.
 *
 * Schreibt bewusst in eine EIGENE, temporaere SQLite unter dem System-Temp-Verzeichnis (nie in die
 * echte Live-Save-Kopie, nie auf den Server) -- reine Testinfrastruktur/Messgrundlage, kein
 * Spielstand im Sinne von CLAUDE.md ("Die Olympiade laeuft ausschliesslich auf dem
 * Hetzner-Server"). Der Aufrufer ist fuer das Aufraeumen der Datei verantwortlich (z. B.
 * `rmSync(sqlitePath, { force: true })` nach der Messung); diese Funktion raeumt nicht selbst auf,
 * damit ein Skript mehrere Messlaeufe gegen denselben Save fahren kann, ohne ihn zwischendurch neu
 * zu bauen.
 */
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";

import { applyNewGameSetup, previewNewGameSetup, type NewGamePresetId } from "@/lib/game/new-game-setup-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { resetDatabaseForTests } from "@/lib/persistence/sqlite";
import { applyGameModeOwnership } from "@/lib/foundation/team-control-settings";
import { fuehreLigaSetupDraftAus } from "@/lib/game/league-setup-draft-service";
import { isLeagueSplitActive, LEAGUE_SIZE } from "@/lib/season/league-split";
import type { GameState } from "@/lib/data/olyDataTypes";
import type { PersistenceService } from "@/lib/persistence/types";

export type BattleModeLeagueSplitSave = {
  persistence: PersistenceService;
  saveId: string;
  seasonId: string;
  gameState: GameState;
  sqlitePath: string;
};

/**
 * Je Liga (16 Teams) mindestens 1 Runde a 8 Paarungen, also mindestens 16 Fixtures je Spieltag mit
 * Spielplan-Eintrag -- die Schranke, an der sich ein echter Rundenplan von der alten Dummy-Kette
 * (1 Fixture pro Spieltag ueber die GESAMTE Saison) unterscheiden laesst.
 */
const MIN_FIXTURES_PRO_GEPLANTEM_SPIELTAG = LEAGUE_SIZE; // 2 Ligen x 8 Paarungen = 16

export async function buildBattleModeLeagueSplitSave(options?: {
  presetId?: NewGamePresetId;
  sqlitePath?: string;
  logPrefix?: string;
  /**
   * Dieselbe Falle wie in tests/helpers/mini-dm-ffa-battle-save.ts: `getDatabase()`
   * (lib/persistence/sqlite.ts) cached die SQLite-Verbindung prozessweit beim ERSTEN Aufruf -- ein
   * neuer `OLY_APP_SQLITE_PATH` allein wirkt nicht mehr, wenn schon eine Verbindung offen ist.
   * `resetDatabaseForTests()` selbst darf aber NUR unter Vitest/`NODE_ENV=test` laufen (Guard in
   * `lib/persistence/sqlite.ts`) -- ein eigenstaendiges Messskript (per `tsx`, kein Vitest-Prozess)
   * hat beim ersten Aufruf dieser Funktion noch gar keine offene Verbindung und darf/muss diesen
   * Parameter weglassen (Default `false`). Nur ein Aufrufer, der im SELBEN Prozess bereits einmal
   * eine DB-Verbindung geoeffnet hat (z. B. ein Vitest-Testfall, der diesen Helfer zweimal ruft),
   * setzt ihn auf `true`.
   */
  resetExistingConnection?: boolean;
}): Promise<BattleModeLeagueSplitSave> {
  const sqlitePath = options?.sqlitePath ?? path.join(os.tmpdir(), `oly-battle-liga-split-${randomUUID()}.sqlite`);
  if (options?.resetExistingConnection) {
    resetDatabaseForTests();
  }
  process.env.OLY_APP_SQLITE_PATH = sqlitePath;
  const persistence = createPersistenceService();
  persistence.bootstrapSingleplayerSave();

  const presetId = options?.presetId ?? "solo_1";
  const input = { presetId, gameMode: "battle" as const };
  const preview = previewNewGameSetup(input);
  const angelegt = applyNewGameSetup({ ...input, confirmToken: preview.confirmToken }, persistence, { ownerId: null });
  const saveId = angelegt.save.saveId;

  const draft = await fuehreLigaSetupDraftAus({
    persistence,
    saveId,
    seasonId: persistence.getSaveById(saveId)!.gameState.season.id,
    callerWritableTeamIds: null,
    excludeTeamIds: [],
    logPrefix: options?.logPrefix ?? "[battle-liga-split-save]",
  });
  if (draft.status !== "ready") {
    throw new Error(
      `buildBattleModeLeagueSplitSave: Liga-Draft fuer Save ${saveId} blieb bei status="${draft.status}" ` +
        `(${draft.versuche} Versuch(e)) -- kein vollstaendiger Kader, Messung darauf waere nicht belastbar.`,
    );
  }

  const nachDraft = persistence.getSaveById(saveId)!;
  persistence.saveSingleplayerState(
    saveId,
    applyGameModeOwnership(nachDraft.gameState, { saveMode: presetId, chrisTeamIds: [], frankyTeamIds: [] }),
  );

  const fertig = persistence.getSaveById(saveId)!;
  const gameState = fertig.gameState;

  // SELBSTPRUEFUNG, NICHT NUR HOFFNUNG (dasselbe Muster wie `stelleVollstaendigeMiniDmTeilnahmeSicher`
  // in tests/helpers/mini-dm-ffa-battle-save.ts): wer diesen Helfer fuer eine Pp/rho-Messung nutzt,
  // darf sich nicht erst nach Stunden Rechenzeit wundern, warum die Zeilen trotzdem ueberwiegend
  // `resolutionSource: "pps"` (Dummy-Rueckfall) statt `"pps_duell"` liefern.
  if (!isLeagueSplitActive(gameState)) {
    throw new Error(
      "buildBattleModeLeagueSplitSave: isLeagueSplitActive() ist nach dem Aufbau trotzdem false -- " +
        "die Annahme ueber buildNewGameStateFromBaseline()s gameMode==='battle'-Zweig " +
        "(lib/game/new-game-setup-service.ts) stimmt nicht mehr. Setup pruefen, bevor eine Messung " +
        "darauf aufsetzt.",
    );
  }
  const fixtures = gameState.seasonState.schedule ?? [];
  const spieltageMitPlan = new Set(fixtures.map((f) => f.matchdayId));
  for (const matchdayId of gameState.season.matchdayIds) {
    const anzahl = fixtures.filter((f) => f.matchdayId === matchdayId).length;
    if (spieltageMitPlan.has(matchdayId) && anzahl < MIN_FIXTURES_PRO_GEPLANTEM_SPIELTAG) {
      throw new Error(
        `buildBattleModeLeagueSplitSave: Spieltag ${matchdayId} hat nur ${anzahl} Fixtures, erwartet ` +
          `mindestens ${MIN_FIXTURES_PRO_GEPLANTEM_SPIELTAG} (volle 2x${LEAGUE_SIZE}-Liga-Rundenplan-Fixtures, ` +
          "keine Dummy-Kette). buildSeasonFixtureSchedule()/buildCircleRounds() pruefen.",
      );
    }
  }

  return {
    persistence,
    saveId,
    seasonId: gameState.season.id,
    gameState,
    sqlitePath,
  };
}
