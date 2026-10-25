/**
 * ARENA-VORLAUF-SERVICE (PR 3, K1 — Plan `docs/design/
 * battle-arena-auto-run-anbindung-plan-16-10.md` Abschnitt 6.2 #3/#5). Zwei Faelle, beide mit
 * `runArenaFixturesImpl`-Injektion (KEIN echtes Chromium -- das ist `tests/
 * battle-mode-auto-run-invarianten.test.ts`/`tests/battle-mode-arena-ausfall-sichtbar.test.ts`):
 *
 *   1. Ausfall-Probe: der injizierte Runner wirft -- `runBattleModeArenaMatchday()` faengt das
 *      PRO LIGA (`arena_matchday_league_failed:<tier>:<msg>`), der Vorlauf leitet daraus einen
 *      `ArenaAusfall` ab und bucht ueber die PPS-Duell-Bruecke, NIE stillschweigend.
 *   2. Koop/Doppellauf: zwei nahezu gleichzeitige Vorlauf-Anstoesse mit DERSELBEN Signatur duerfen
 *      den injizierten Runner nur EINMAL je Liga aufrufen (In-Prozess-Entdopplung, Plan 2.7).
 *
 * Fährt dafuer denselben echten Wizard-/Liga-Draft-Pfad wie die Invariantentests (keine
 * konstruierten Contexts) — Gewichtheben (`D1_ARENA`-Analog hier: die erste arena-aufgeloeste
 * Disziplin, die der Spielplan dem ersten Spieltag zuweist) ist arena-aufgeloest.
 */
import { describe, expect, it } from "vitest";

import { applyNewGameSetup, previewNewGameSetup } from "@/lib/game/new-game-setup-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { applyGameModeOwnership } from "@/lib/foundation/team-control-settings";
import { fuehreLigaSetupDraftAus } from "@/lib/game/league-setup-draft-service";
import { applyAiLegacyLineupBatchLocally } from "@/lib/ai/ai-legacy-lineup-batch-apply-service";
import { ensureMatchdayResolveSnapshot, readArenaVorlaufRecord, resolveMatchdayPreviewToBook } from "@/lib/foundation/matchday-resolve-snapshot";
import { kickoffArenaVorlauf, stelleArenaVorlaufSicher } from "@/lib/battle/arena-vorlauf-service";
import { ARENA_RESOLVED_DISCIPLINE_IDS } from "@/lib/battle/arena-resolved-disciplines";
import { invalidateLocalTransfermarktCachesForSave } from "@/lib/market/transfermarkt-local-service";
import type { ArenaFixtureResult, RunArenaFixturesOptions } from "@/lib/battle/arena-headless-runner";
import type { GameState } from "@/lib/data/olyDataTypes";
import { buildHarmlosenMiniDmFfaFakeRunner } from "@/tests/helpers/mini-dm-ffa-battle-save";

/**
 * CI-FIX (25.10., dedizierte Root-Cause-Untersuchung der Mini-DM-CI-Flakiness): diese Datei faket
 * seit jeher NUR `runArenaFixturesImpl` -- `bauFrischenBattleSaveMitVollemFeld()` unten akzeptiert
 * JEDE arena-aufgeloeste Disziplin an D1/D2 eines zufaelligen (unseeded) Liga-Drafts, OHNE Mini-DM
 * auszuschliessen. Landet Mini-DM (zufaellig, unabhaengig von der gefundenen Arena-Disziplin)
 * SELBST an diesem Spieltag, laeuft seit PR 5 ("Vorlauf-Verdrahtung") ein eigener, NICHT gefakter
 * `runMiniDmFfaPodFixtures()`-Zweig mit echtem Chromium -- das scheitert in CI-Jobs ohne Chromium-
 * Installation (`full-test-suite`/`persistenz-suiten`) mit `chromium_start`. `buildHarmlosenMiniDmFfaFakeRunner()`
 * (geteilter Helfer, `tests/helpers/mini-dm-ffa-battle-save.ts`) wird deshalb ab jetzt NEBEN jedem
 * `runArenaFixturesImpl` mitgegeben -- unabhaengig davon, ob Mini-DM an einem konkreten Testlauf
 * tatsaechlich dabei ist.
 */

/**
 * CI-OOM-FUND (18.10., root-caused per Heap-Snapshot-Diff -- NICHT per Vermutung): dieser Datei
 * allein reichten 4 unabhaengige, volle 32-Team-Battle-Saves in EINEM Prozess, um den Node-Heap
 * zu sprengen ("JavaScript heap out of memory", sowohl im isolierten `arena-chromium-tests`-Job
 * als auch mitten in der 200+-Datei-`persistenz-suiten`-Invocation -- immer an genau dieser
 * Datei). ZWEI vorherige Fix-Kandidaten (save-session-cache invalidieren, resetDatabaseForTests()
 * fuer echte DB-Isolation) wurden beide GEMESSEN WIDERLEGT -- der Heap wuchs identisch weiter.
 * Der tatsaechliche Taeter, gefunden per Top-Retainer-Analyse eines echten Heap-Snapshots:
 * `lib/market/transfermarkt-local-service.ts`s `localMarketContextCache` ist ein UNGEBUNDENER
 * `Map<string, LocalMarketContext>` (kein Count-Cap wie bei anderen Caches im Projekt) -- sein Key
 * ist ein mehrere-MB-grosser String (`getPlayerPotentialCacheSignature()` dumpt ALLE Spieler als
 * "id:score:confidence:source", gejoint). Jeder einzigartige, frische Save (genau das, was
 * `bauFrischenBattleSaveMitVollemFeld()` unten viermal tut) erzeugt einen NEUEN, nie entfernten
 * Eintrag -- Key UND Value bleiben fuer die Prozesslebensdauer. Das ist generische, VORHANDENE
 * Markt-Infrastruktur ausserhalb des K1-Scopes dieses PRs (nicht selbst angefasst) -- die dafuer
 * schon exportierte Aufraeumfunktion `invalidateLocalTransfermarktCachesForSave(saveId)` reicht als
 * Fix hier aus, gemessen bestaetigt (4 Builds vorher: Crash vor Build 3; danach: alle 4 durch, 419
 * -> 725 -> 1033 -> 1339 MB statt 923 -> 1735 MB -> Crash).
 */

/**
 * Baut einen frischen Battle-Save mit vollstaendig befuelltem Feld fuer Spieltag 1.
 *
 * REVIEW-FUND (#1273, CI-Flake): WELCHE Disziplin an Spieltag 1 steht, ist zufaellig
 * (Formkarten-/Spielplan-Saat je Save) -- gemessen ~11 % der Saves ohne JEDE arena-aufgeloeste
 * Disziplin an Spieltag 1. Ein einzelner Versuch liess den Test deshalb gelegentlich an einer
 * Vorbedingung scheitern, die nichts mit dem eigentlich geprueften Verhalten zu tun hat. Bis zu
 * drei frische Saves werden deshalb versucht (je ~89 % Erfolgswahrscheinlichkeit -> <0,2 %
 * Restausfall bei drei Versuchen), bevor der Test tatsaechlich als "kein passender Save"
 * fehlschlaegt.
 */
async function bauFrischenBattleSaveMitVollemFeld() {
  for (let versuch = 1; versuch <= 3; versuch += 1) {
    process.env.OLY_APP_SQLITE_PATH = `/tmp/oly-arena-vorlauf-service-${Math.random().toString(36).slice(2)}.sqlite`;
    const persistence = createPersistenceService();
    persistence.bootstrapSingleplayerSave();
    const input = { presetId: "solo_1" as const, gameMode: "battle" as const };
    const preview = previewNewGameSetup(input);
    const angelegt = applyNewGameSetup({ ...input, confirmToken: preview.confirmToken }, persistence, { ownerId: null });
    const saveId = angelegt.save.saveId;
    await fuehreLigaSetupDraftAus({
      persistence,
      saveId,
      seasonId: persistence.getSaveById(saveId)!.gameState.season.id,
      callerWritableTeamIds: null,
      excludeTeamIds: [],
      logPrefix: "[arena-vorlauf-service-test]",
    });
    const nachDraft = persistence.getSaveById(saveId)!;
    persistence.saveSingleplayerState(
      saveId,
      applyGameModeOwnership(nachDraft.gameState, { saveMode: "solo_1", chrisTeamIds: [], frankyTeamIds: [] }),
    );
    const aktuell = persistence.getSaveById(saveId)!;
    const seasonId = aktuell.gameState.season.id;
    // `applyAiLegacyLineupBatchLocally()` darf NUR fuer den gerade AKTIVEN Spieltag aufgerufen
    // werden (`lineup_matchday_is_not_active`, nachgemessen -- s. Review-Fund #1273: ein
    // frueherer Versuch scannte vorwaerts im Spielplan auf der Suche nach "genau einer
    // arena-aufgeloesten Disziplin" und traf dabei oft einen SPAeTEREN, noch nicht aktiven
    // Spieltag). Deshalb bleibt es bei Spieltag 1 (dem einzig aktiven auf einem frischen Save).
    const matchdayId = aktuell.gameState.matchdayState.matchdayId;
    const spieltag = (aktuell.gameState.seasonState.disciplineSchedule ?? []).find((e) => e.matchdayId === matchdayId);
    const d1 = spieltag?.discipline1?.disciplineId;
    const d2 = spieltag?.discipline2?.disciplineId;
    const arenaDisciplineIds = [d1, d2].filter((id): id is string => id != null && ARENA_RESOLVED_DISCIPLINE_IDS.has(id));
    if (arenaDisciplineIds.length === 0) {
      // Verworfener Versuch -- ohne dieses Aufraeumen bleibt der (mehrere MB grosse) Markt-
      // Kontext-Cache-Eintrag dieses Saves fuer immer im Prozess stehen (s. Kopfkommentar).
      invalidateLocalTransfermarktCachesForSave(saveId);
      continue; // dieser Save: Spieltag 1 ohne arena-aufgeloeste Disziplin -- neuer Versuch
    }
    // Alle 32 Teams fuer DIESEN (aktiven) Spieltag aufstellen (KI-Batch), damit
    // `isMatchdayFieldComplete()` zutrifft.
    const batch = applyAiLegacyLineupBatchLocally(
      { saveId, seasonId, matchdayId, dryRun: false, includeWarningTeams: true, overwriteExisting: true },
      persistence,
    );
    expect(batch.summary.blockingReasons, batch.summary.blockingReasons.join(" | ")).toEqual([]);
    const scope = { saveId, seasonId, matchdayId };
    // Die Anzahl arena-aufgeloester Disziplinen (1 oder 2, WEG B gemessen ~41 % der Spieltage)
    // wird mit zurueckgegeben, statt sie wegzudefinieren -- abhaengige Tests leiten ihre
    // Aufruf-Obergrenzen daraus ab, statt "genau eine" anzunehmen.
    return { persistence, scope, arenaDisciplineId: arenaDisciplineIds[0]!, arenaDisciplineCount: arenaDisciplineIds.length };
  }
  throw new Error("bauFrischenBattleSaveMitVollemFeld: drei Saves hintereinander ohne arena-aufgeloeste Disziplin an Spieltag 1 -- statistisch extrem unwahrscheinlich, Setup pruefen.");
}

describe("Arena-Vorlauf-Service · Ausfall-Probe (Plan Abschnitt 6.2 #3)", () => {
  it(
    "ein durchgehend werfender Runner fuehrt zu arenaAusfall statt einer stillen Bruecke",
    async () => {
      const { persistence, scope, arenaDisciplineId } = await bauFrischenBattleSaveMitVollemFeld();
      const snapshot = ensureMatchdayResolveSnapshot(scope, persistence);
      expect(snapshot).not.toBeNull();

      const werfenderRunner = async (): Promise<ArenaFixtureResult[]> => {
        throw new Error("Simulierter Chromium-Absturz (Testinjektion)");
      };

      const ergebnis = await stelleArenaVorlaufSicher(
        scope,
        { runArenaFixturesImpl: werfenderRunner, runMiniDmFfaPodFixturesImpl: buildHarmlosenMiniDmFfaFakeRunner() },
        persistence,
      );
      expect(ergebnis.applicable).toBe(true);
      expect(ergebnis.status).toBe("failed");
      expect(ergebnis.record).not.toBeNull();
      const eintrag = ergebnis.record!.disziplinen[arenaDisciplineId];
      expect(eintrag?.status).toBe("ausgefallen");
      expect(eintrag?.ausfall?.grund).toBe("absturz");

      // Gebucht wurde trotzdem gueltig -- die PPS-Duell-Bruecke, mit sichtbarer Markierung
      // (Engine-Strukturpruefung bzw. expliziter Grund), nie eine stille Luecke.
      const nachher = persistence.getSaveById(scope.saveId)!;
      const bookedSnapshot = (nachher.gameState.seasonState.matchdayResolveSnapshots ?? [])[0];
      expect(bookedSnapshot?.arenaVorlauf?.status).toBe("failed");
      const previewZeilen = (bookedSnapshot?.payload as { preview?: { disciplinePreviews?: Array<{ disciplineId: string; teamResults: Array<{ arenaAusfall?: unknown; resolutionSource?: string }> }> } })
        ?.preview?.disciplinePreviews?.find((d) => d.disciplineId === arenaDisciplineId);
      expect(previewZeilen).toBeDefined();
      for (const team of previewZeilen!.teamResults) {
        expect(team.resolutionSource).toBe("pps_duell");
        expect(team.arenaAusfall).toBeTruthy();
      }
      invalidateLocalTransfermarktCachesForSave(scope.saveId); // s. Kopfkommentar: CI-OOM-Fix
    },
    420_000, // bis zu 3 Setup-Versuche (Review-Fund #1273) + echtes Chromium
  );
});

describe("Arena-Vorlauf-Service · Koop/Doppellauf (Plan Abschnitt 6.2 #5)", () => {
  it(
    "zwei fast gleichzeitige Vorlauf-Anstoesse mit derselben Signatur rufen den Runner nur einmal je Liga auf",
    async () => {
      const { persistence, scope, arenaDisciplineCount } = await bauFrischenBattleSaveMitVollemFeld();
      ensureMatchdayResolveSnapshot(scope, persistence);

      let aufrufe = 0;
      const verzoegerterRunner = async (
        gameState: GameState,
        fixtures: { homeTeamId: string; awayTeamId: string; seed: string | number }[],
        _disziplin: string,
        _options?: RunArenaFixturesOptions,
      ): Promise<ArenaFixtureResult[]> => {
        aufrufe += 1;
        await new Promise((resolve) => setTimeout(resolve, 50));
        return fixtures.map((fixture) => ({
          homeTeamId: fixture.homeTeamId,
          awayTeamId: fixture.awayTeamId,
          seiten: [1, 0] as [number, number],
          boxscore: [],
        }));
      };

      // Zwei Aufrufe "gleichzeitig" (kein await zwischen ihnen) -- GENAU der Fall aus Plan 2.7:
      // zwei Koop-Spieler speichern fast gleichzeitig ihre Aufstellung.
      const [ergebnisA, ergebnisB] = await Promise.all([
        stelleArenaVorlaufSicher(
          scope,
          { runArenaFixturesImpl: verzoegerterRunner, runMiniDmFfaPodFixturesImpl: buildHarmlosenMiniDmFfaFakeRunner() },
          persistence,
        ),
        stelleArenaVorlaufSicher(
          scope,
          { runArenaFixturesImpl: verzoegerterRunner, runMiniDmFfaPodFixturesImpl: buildHarmlosenMiniDmFfaFakeRunner() },
          persistence,
        ),
      ]);

      expect(ergebnisA.applicable).toBe(true);
      expect(ergebnisB.applicable).toBe(true);
      // Beide liefern dasselbe Endergebnis (dieselbe Promise bzw. derselbe fertige Record).
      expect(ergebnisA.status).toBe(ergebnisB.status);

      // Der Runner wurde NICHT doppelt aufgerufen: hoechstens einmal je Liga (1 oder 2) UND je
      // arena-aufgeloester Disziplin dieses Spieltags (1 bei "normal", 2 bei WEG B) -- NIE das
      // Doppelte davon (waere der Fall ohne In-Prozess-Entdopplung).
      expect(aufrufe).toBeGreaterThan(0);
      expect(aufrufe).toBeLessThanOrEqual(arenaDisciplineCount * 2);
      invalidateLocalTransfermarktCachesForSave(scope.saveId); // s. Kopfkommentar: CI-OOM-Fix
    },
    420_000, // bis zu 3 Setup-Versuche (Review-Fund #1273) + echtes Chromium
  );
});

/**
 * B1 (Opus-Review, kritisch), NEU GEFASST nach dem Design-Fix vom 18.10. ("Wiederholung gehoert in
 * den Vorlauf selbst", s. arena-vorlauf-service.ts): die automatische Wiederholung bei einem
 * retrybaren Ausfall (absturz/timeout/chromium_start) passiert jetzt INNERHALB EINES
 * `stelleArenaVorlaufSicher()`/`kickoffArenaVorlauf()`-Aufrufs, BEVOR irgendetwas geschrieben wird.
 * Persistiert wird nur noch das ENDGUELTIGE Ergebnis -- kein Leser sieht je ein Zwischen-"failed",
 * das in Wahrheit noch einen zweiten Versuch vor sich hat (das alte Flacker-Problem: die Buehne
 * zeigte kurz "ausgefallen" und sprang dann wieder auf "laeuft").
 */
describe("Arena-Vorlauf-Service · B1 (Opus-Review, kritisch): automatische Wiederholung INNERHALB des Vorlaufs", () => {
  it(
    "ein Runner, der beim ERSTEN Aufruf wirft und danach klappt, endet in EINEM Aufruf als 'ready' -- nie wird ein 'failed' persistiert",
    async () => {
      const { persistence, scope } = await bauFrischenBattleSaveMitVollemFeld();
      ensureMatchdayResolveSnapshot(scope, persistence);

      let aufrufe = 0;
      const einmalWerfenderRunner = async (
        _gameState: GameState,
        fixtures: { homeTeamId: string; awayTeamId: string; seed: string | number }[],
      ): Promise<ArenaFixtureResult[]> => {
        aufrufe += 1;
        if (aufrufe === 1) {
          throw new Error("Chromium kaputt (Testinjektion, B1, nur beim allerersten Aufruf)");
        }
        return fixtures.map((fixture) => ({
          homeTeamId: fixture.homeTeamId,
          awayTeamId: fixture.awayTeamId,
          seiten: [1, 0] as [number, number],
          boxscore: [],
        }));
      };

      const ergebnis = await stelleArenaVorlaufSicher(
        scope,
        { runArenaFixturesImpl: einmalWerfenderRunner, runMiniDmFfaPodFixturesImpl: buildHarmlosenMiniDmFfaFakeRunner() },
        persistence,
      );
      expect(ergebnis.applicable).toBe(true);
      // DAS Versprechen dieses Fixes: EIN einziger externer Aufruf liefert bereits das
      // ENDGUELTIGE Ergebnis -- die interne Wiederholung ist fuer den Aufrufer unsichtbar.
      expect(ergebnis.status).toBe("ready");
      // Die Wiederholung hat tatsaechlich stattgefunden (mehr als ein Aufruf des Runners).
      expect(aufrufe).toBeGreaterThan(1);

      // Genau EIN Schreibvorgang fuer diese Signatur -- und der zeigt schon das Endergebnis, nie
      // ein Zwischen-"failed", das ein spaeterer Leser faelschlich fuer endgueltig halten koennte.
      const stand = persistence.getSaveById(scope.saveId)!.gameState;
      const record = readArenaVorlaufRecord(stand, scope);
      expect(record?.status).toBe("ready");
      for (const eintrag of Object.values(record?.disziplinen ?? {})) {
        expect(eintrag.status).toBe("arena");
        expect(eintrag.ausfall).toBeFalsy();
      }
      invalidateLocalTransfermarktCachesForSave(scope.saveId); // s. Kopfkommentar: CI-OOM-Fix
    },
    420_000, // bis zu 3 Setup-Versuche (Review-Fund #1273) + echtes Chromium
  );

  it(
    "ein durchgehend werfender Runner endet NACH der internen Wiederholung endgueltig als 'failed' -- 10 weitere Aufrufe (Kickoff/Auto-Run/Buehne) loesen KEINEN weiteren Runner-Aufruf mehr aus und buchen stattdessen die markierte Bruecke",
    async () => {
      const { persistence, scope, arenaDisciplineCount } = await bauFrischenBattleSaveMitVollemFeld();
      ensureMatchdayResolveSnapshot(scope, persistence);

      let aufrufeGesamt = 0;
      const werfenderRunner = async (): Promise<ArenaFixtureResult[]> => {
        aufrufeGesamt += 1;
        throw new Error("Chromium kaputt (Testinjektion, B1, durchgehend)");
      };

      const ergebnis = await stelleArenaVorlaufSicher(
        scope,
        { runArenaFixturesImpl: werfenderRunner, runMiniDmFfaPodFixturesImpl: buildHarmlosenMiniDmFfaFakeRunner() },
        persistence,
      );
      expect(ergebnis.applicable).toBe(true);
      expect(ergebnis.status).toBe("failed");

      // Hoechstens 2 interne Versuche (MAX_AUTOMATISCHE_VERSUCHE) je Liga UND je arena-aufgeloester
      // Disziplin dieses Spieltags -- NIE unbegrenzt viele, schon innerhalb DIESES EINEN Aufrufs.
      const aufrufeNachErstemLauf = aufrufeGesamt;
      expect(aufrufeNachErstemLauf).toBeGreaterThan(0);
      expect(aufrufeNachErstemLauf).toBeLessThanOrEqual(arenaDisciplineCount * 2 * 2);

      const endstand = persistence.getSaveById(scope.saveId)!.gameState;
      const endgueltigerRecord = readArenaVorlaufRecord(endstand, scope);
      expect(endgueltigerRecord?.status).toBe("failed");

      // 10x weiter anstossen (genau das Muster, das Buehne, Lineup-Routen und Auto-Run-
      // "hintergrund" bei jedem Request/Poll taeten) -- KEIN einziger weiterer Runner-Aufruf
      // mehr, weil "failed" seit dem Design-Fix ohne Ausnahme terminal ist (ausser
      // `erzwingeNeuenVersuch`, das hier niemand setzt).
      for (let i = 0; i < 10; i += 1) {
        const nochEinAnstoss = kickoffArenaVorlauf(
          scope,
          { runArenaFixturesImpl: werfenderRunner, runMiniDmFfaPodFixturesImpl: buildHarmlosenMiniDmFfaFakeRunner() },
          persistence,
        );
        expect(nochEinAnstoss.status).toBe("failed");
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(aufrufeGesamt).toBe(aufrufeNachErstemLauf);

      // Der Auto-Run/Kickoff kann mit diesem endgueltig "failed" Vorlauf jetzt die PPS-Duell-
      // Bruecke buchen, statt fuer immer auf "in_progress" zu stehen (das war B1s eigentliche
      // Gefahr: der Spieltag haette NIE gebucht werden koennen).
      const previewToBook = resolveMatchdayPreviewToBook({
        gameState: endstand,
        scope,
        livePreview: (await import("@/lib/resolve/legacy-matchday-resolve-engine")).buildLegacyMatchdayResolvePreview(
          (await import("@/lib/lineups/legacy-lineup-local-service")).loadAllLocalLegacyLineupContexts(scope, persistence).flatMap((r) => (r.ok ? [r.context] : [])),
        ),
      });
      expect(previewToBook.source).toBe("snapshot");
      invalidateLocalTransfermarktCachesForSave(scope.saveId); // s. Kopfkommentar: CI-OOM-Fix
    },
    420_000, // bis zu 3 Setup-Versuche (Review-Fund #1273) + echtes Chromium
  );
});

describe("Arena-Vorlauf-Service · B3 (Opus-Review, kritisch): arenaEingabeHash-Divergenz", () => {
  it(
    "ein Snapshot, dessen Arena-Eingaben sich nach einem erfolgreichen Vorlauf geaendert haben, wird beim Buchen als Divergenz erkannt (nicht als stille Bruecke gebucht)",
    async () => {
      const { persistence, scope } = await bauFrischenBattleSaveMitVollemFeld();
      ensureMatchdayResolveSnapshot(scope, persistence);

      const erfolgreicherRunner = async (
        _gameState: GameState,
        fixtures: { homeTeamId: string; awayTeamId: string; seed: string | number }[],
      ): Promise<ArenaFixtureResult[]> =>
        fixtures.map((fixture) => ({
          homeTeamId: fixture.homeTeamId,
          awayTeamId: fixture.awayTeamId,
          seiten: [1, 0] as [number, number],
          boxscore: [],
        }));

      const ergebnis = await stelleArenaVorlaufSicher(
        scope,
        { runArenaFixturesImpl: erfolgreicherRunner, runMiniDmFfaPodFixturesImpl: buildHarmlosenMiniDmFfaFakeRunner() },
        persistence,
      );
      expect(ergebnis.status).toBe("ready");

      const vorStand = persistence.getSaveById(scope.saveId)!.gameState;
      const previewVorMutation = resolveMatchdayPreviewToBook({ gameState: vorStand, scope, livePreview: vorStand as never });
      // Noch KEINE Divergenz direkt nach dem Vorlauf.
      expect(previewVorMutation.arenaEingabeDivergenz).toBeUndefined();
      expect(previewVorMutation.source).toBe("snapshot");

      // EINE Spieler-Attribut-Aenderung, die `arenaEingabeHash` (voller Kader-JSON) trifft, aber
      // NICHT `buildMatchdayResolveSignature()` (nur Aufstellungen/Verfuegbarkeit) -- GENAU die
      // Luecke, die B2/arenaEingabeHash zusaetzlich zur groeberen Signatur abdecken soll. Der
      // mutierte Spieler MUSS auf einem der beiden Teams eines Fixtures DIESES Spieltags stehen
      // (`buildArenaTeam()` baut den Kader-JSON nur aus den rostierten Spielern der am Fixture
      // beteiligten Teams) -- sonst wuerde die Mutation den Hash gar nicht beruehren.
      const fixtureAnDiesemSpieltag = (vorStand.seasonState.schedule ?? []).find(
        (f) => f.matchdayId === scope.matchdayId && f.homeTeamId && f.awayTeamId,
      );
      expect(fixtureAnDiesemSpieltag, "kein Fixture an diesem Spieltag -- Testaufbau unerwartet unvollstaendig").toBeDefined();
      const rosterEintrag = vorStand.rosters.find((r) => r.teamId === fixtureAnDiesemSpieltag!.homeTeamId);
      expect(rosterEintrag, "homeTeamId dieses Fixtures hat keinen rostierten Spieler -- Testaufbau unerwartet unvollstaendig").toBeDefined();
      const zuMutierenderSpielerId = rosterEintrag!.playerId;
      // FELDNAME (Test-Fund): `attributeSheetStats` fuehrt das Attribut als `power`, nicht `pow`
      // (s. `zuArenaSpieler()`, lib/foundation/battle-arena/arena-kader-adapter.ts) -- ein
      // frueherer Versuch mit `pow` traf kein tatsaechlich gelesenes Feld und zeigte deshalb nie
      // eine Divergenz (Testfehler, keine Produktionsluecke).
      const mutierterStand: GameState = {
        ...vorStand,
        players: vorStand.players.map((spieler) =>
          spieler.id === zuMutierenderSpielerId
            ? {
                ...spieler,
                attributeSheetStats: {
                  ...(spieler.attributeSheetStats ?? {}),
                  power: ((spieler.attributeSheetStats as { power?: number } | undefined)?.power ?? 50) + 25,
                } as typeof spieler.attributeSheetStats,
              }
            : spieler,
        ),
      };
      persistence.saveSingleplayerState(scope.saveId, mutierterStand);

      const nachMutation = persistence.getSaveById(scope.saveId)!.gameState;
      const previewNachMutation = resolveMatchdayPreviewToBook({ gameState: nachMutation, scope, livePreview: nachMutation as never });
      // OPUS-REVIEW B3: Divergenz MUSS jetzt erkannt werden, UND die Bruecke darf nicht
      // stillschweigend als Buchungsgrundlage zurueckkommen (`source !== "snapshot"`).
      expect(previewNachMutation.arenaEingabeDivergenz).toBe(true);
      expect(previewNachMutation.source).toBe("live");
      invalidateLocalTransfermarktCachesForSave(scope.saveId); // s. Kopfkommentar: CI-OOM-Fix
    },
    420_000, // bis zu 3 Setup-Versuche (Review-Fund #1273) + echtes Chromium
  );
});
