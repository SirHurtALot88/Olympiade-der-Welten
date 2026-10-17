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
import type { ArenaFixtureResult, RunArenaFixturesOptions } from "@/lib/battle/arena-headless-runner";
import type { GameState } from "@/lib/data/olyDataTypes";

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

      const ergebnis = await stelleArenaVorlaufSicher(scope, { runArenaFixturesImpl: werfenderRunner }, persistence);
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
        stelleArenaVorlaufSicher(scope, { runArenaFixturesImpl: verzoegerterRunner }, persistence),
        stelleArenaVorlaufSicher(scope, { runArenaFixturesImpl: verzoegerterRunner }, persistence),
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
    },
    420_000, // bis zu 3 Setup-Versuche (Review-Fund #1273) + echtes Chromium
  );
});

describe("Arena-Vorlauf-Service · B1 (Opus-Review, kritisch): genau eine automatische Wiederholung", () => {
  it(
    "ein durchgehend werfender Runner wird ueber den Hintergrund-Pfad (kickoffArenaVorlauf) hoechstens 2x je Liga aufgerufen -- danach endgueltig failed, kein CPU-Sturm",
    async () => {
      const { persistence, scope, arenaDisciplineCount } = await bauFrischenBattleSaveMitVollemFeld();
      ensureMatchdayResolveSnapshot(scope, persistence);

      let aufrufeGesamt = 0;
      const werfenderRunner = async (): Promise<ArenaFixtureResult[]> => {
        aufrufeGesamt += 1;
        throw new Error("Chromium kaputt (Testinjektion, B1)");
      };

      // 10x hintereinander ueber den DETACHED Pfad anstossen -- genau das Muster, das Buehne,
      // Lineup-Routen und Auto-Run-"hintergrund" bei jedem Request/Poll tun wuerden, wenn
      // Chromium auf dem Server kaputt ist. Zwischen den Anstoessen wird auf den jeweils
      // laufenden (detachten) Versuch gewartet, sonst wuerde derselbe In-Prozess-Lauf mehrfach
      // "getroffen" statt wirklich mehrere Anlaeufe zu erzeugen.
      for (let i = 0; i < 10; i += 1) {
        kickoffArenaVorlauf(scope, { runArenaFixturesImpl: werfenderRunner }, persistence);
        for (let warten = 0; warten < 300; warten += 1) {
          const aktuellerStand = persistence.getSaveById(scope.saveId)!.gameState;
          const record = readArenaVorlaufRecord(aktuellerStand, scope);
          if (record && record.status !== "in_progress") break;
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
      }

      // Hoechstens 2 automatische Versuche (MAX_AUTOMATISCHE_VERSUCHE), je bis zu 2 Ligen UND je
      // arena-aufgeloester Disziplin dieses Spieltags -- NIE 10 (einer je Schleifendurchlauf, der
      // Bug-Zustand vor dem Fix) und NIE unbegrenzt viele.
      expect(aufrufeGesamt).toBeGreaterThan(0);
      expect(aufrufeGesamt).toBeLessThanOrEqual(arenaDisciplineCount * 2 * 2);

      const endstand = persistence.getSaveById(scope.saveId)!.gameState;
      const endgueltigerRecord = readArenaVorlaufRecord(endstand, scope);
      expect(endgueltigerRecord?.status).toBe("failed");
      expect(endgueltigerRecord?.versuch).toBeLessThanOrEqual(2);

      // Ein weiterer Anstoss (z. B. die Buehne pollt noch einmal) loest KEINEN dritten Versuch
      // mehr aus -- die Zahl der Aufrufe bleibt stehen.
      const aufrufeVorher = aufrufeGesamt;
      const nochEinAnstoss = kickoffArenaVorlauf(scope, { runArenaFixturesImpl: werfenderRunner }, persistence);
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(nochEinAnstoss.status).toBe("failed");
      expect(aufrufeGesamt).toBe(aufrufeVorher);

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

      const ergebnis = await stelleArenaVorlaufSicher(scope, { runArenaFixturesImpl: erfolgreicherRunner }, persistence);
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
    },
    420_000, // bis zu 3 Setup-Versuche (Review-Fund #1273) + echtes Chromium
  );
});
