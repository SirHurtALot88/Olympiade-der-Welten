import { describe, expect, it, vi } from "vitest";

/**
 * OPUS-REVIEW (Nachtrag 18.10., B3-Instabilitaets-Fix): "Zweite Abweichung bei GLEICHER
 * Signatur: der Vorlauf endet als 'failed' mit neuem Grund `eingabe_instabil` ... Gebucht wird
 * die markierte Bruecke."
 *
 * HINTERGRUND: eine Hash-Abweichung zaehlte vorher als EXTERNER Neustart (`erzwingeNeuenVersuch`,
 * `versuch+1`). Ist der `arenaEingabeHash` zwischen Vorlauf und Buchung NICHT stabil (z. B. weil
 * `buildArenaTeam()`/`buildArenaAufstellungBeide()` etwas lesen, das sich zwischen Vorlauf und
 * Buchung OHNE Signaturwechsel aendert -- Fatigue, ein von der KI neu gespeichertes Lineup mit
 * gleicher Belegung, Zeitstempel, Map-Reihenfolge), entstand eine Endlosschleife: Vorlauf "ready"
 * -> Buchung erkennt Abweichung -> neuer Vorlauf -> "ready" -> Buchung erkennt wieder Abweichung
 * -> ... Ein Spieltag, der nie bucht, plus Chromium im Dauerlauf.
 *
 * Dieser Test mockt `berechneArenaEingabeHash()` auf einen Wert, der bei JEDEM Aufruf anders ist
 * (kuenstlich instabil, unabhaengig von echten Spielstand-Aenderungen) -- der zuverlaessigste Weg,
 * eine echte Instabilitaet deterministisch nachzustellen, ohne auf einen echten, aber seltenen
 * Nebeneffekt (z. B. eine zufaellige Fatigue-Rundung) warten zu muessen. KEIN echtes Chromium
 * noetig (injizierter Runner, s. andere Tests in dieser Datei-Familie).
 */

let hashZaehler = 0;
vi.mock("@/lib/battle/arena-eingabe-hash", () => ({
  // Garantiert verschieden bei jedem Aufruf -- weder beim Schreiben (Vorlauf) noch beim Lesen
  // (Buchung) kommt je zweimal derselbe Wert heraus.
  berechneArenaEingabeHash: () => `instabil-${(hashZaehler += 1)}`,
}));

const { applyNewGameSetup, previewNewGameSetup } = await import("@/lib/game/new-game-setup-service");
const { createPersistenceService } = await import("@/lib/persistence/persistence-service");
const { applyGameModeOwnership } = await import("@/lib/foundation/team-control-settings");
const { fuehreLigaSetupDraftAus } = await import("@/lib/game/league-setup-draft-service");
const { applyAiLegacyLineupBatchLocally } = await import("@/lib/ai/ai-legacy-lineup-batch-apply-service");
const { ensureMatchdayResolveSnapshot } = await import("@/lib/foundation/matchday-resolve-snapshot");
const { stelleArenaVorlaufSicher } = await import("@/lib/battle/arena-vorlauf-service");
const { kickoffArenaMatchdayApply } = await import("@/lib/season/arena-matchday-resolve-service");
const { ARENA_RESOLVED_DISCIPLINE_IDS } = await import("@/lib/battle/arena-resolved-disciplines");
const { buildHarmlosenMiniDmFfaFakeRunner } = await import("@/tests/helpers/mini-dm-ffa-battle-save");
type ArenaFixtureResultType = Awaited<ReturnType<typeof import("@/lib/battle/arena-headless-runner").runArenaFixtures>>[number];

/**
 * CI-FIX (25.10., dedizierte Root-Cause-Untersuchung): wie `tests/arena-eingabe-stabil.test.ts`
 * (Gegenstueck dieser Datei) -- `bauFrischenBattleSaveMitVollemFeld()` unten schliesst Mini-DM an
 * D1/D2 nicht aus. Landet es zufaellig dort, braucht sowohl der erste `stelleArenaVorlaufSicher()`-
 * Aufruf ALS AUCH der erzwungene Neuversuch innerhalb von `kickoffArenaMatchdayApply()` (Divergenz-
 * Zweig, s. `erzwingeNeuenVersuch` in `arena-matchday-resolve-service.ts` -- dort inzwischen
 * ebenfalls auf `runMiniDmFfaPodFixturesImpl` erweitert) denselben Fake.
 */

async function bauFrischenBattleSaveMitVollemFeld() {
  for (let versuch = 1; versuch <= 3; versuch += 1) {
    process.env.OLY_APP_SQLITE_PATH = `/tmp/oly-arena-eingabe-instabil-${Math.random().toString(36).slice(2)}.sqlite`;
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
      logPrefix: "[arena-eingabe-instabil-test]",
    });
    const nachDraft = persistence.getSaveById(saveId)!;
    persistence.saveSingleplayerState(
      saveId,
      applyGameModeOwnership(nachDraft.gameState, { saveMode: "solo_1", chrisTeamIds: [], frankyTeamIds: [] }),
    );
    const aktuell = persistence.getSaveById(saveId)!;
    const seasonId = aktuell.gameState.season.id;
    const matchdayId = aktuell.gameState.matchdayState.matchdayId;
    const spieltag = (aktuell.gameState.seasonState.disciplineSchedule ?? []).find((e) => e.matchdayId === matchdayId);
    const d1 = spieltag?.discipline1?.disciplineId;
    const d2 = spieltag?.discipline2?.disciplineId;
    const arenaDisciplineIds = [d1, d2].filter((id): id is string => id != null && ARENA_RESOLVED_DISCIPLINE_IDS.has(id));
    if (arenaDisciplineIds.length === 0) {
      continue;
    }
    const batch = applyAiLegacyLineupBatchLocally(
      { saveId, seasonId, matchdayId, dryRun: false, includeWarningTeams: true, overwriteExisting: true },
      persistence,
    );
    expect(batch.summary.blockingReasons, batch.summary.blockingReasons.join(" | ")).toEqual([]);
    const scope = { saveId, seasonId, matchdayId };
    return { persistence, scope, arenaDisciplineId: arenaDisciplineIds[0]! };
  }
  throw new Error("bauFrischenBattleSaveMitVollemFeld: drei Saves hintereinander ohne arena-aufgeloeste Disziplin an Spieltag 1.");
}

describe("Arena-Vorlauf-Service · eingabe_instabil (Opus-Review, B3-Nachtrag)", () => {
  it(
    "ein Eingabe-Hash, der bei JEDEM Aufruf anders ist, endet nach hoechstens 2 Vorlaeufen mit 'eingabe_instabil' gebucht -- kein dritter Vorlauf, keine Endlosschleife",
    async () => {
      const { persistence, scope, arenaDisciplineId } = await bauFrischenBattleSaveMitVollemFeld();
      ensureMatchdayResolveSnapshot(scope, persistence);

      // Erfolgreicher Runner (KEIN Chromium-Ausfall) -- die Instabilitaet kommt ausschliesslich
      // aus dem gemockten Hash, nicht aus einem Simulations-Fehlschlag.
      const erfolgreicherRunner = async (
        _gameState: unknown,
        fixtures: { homeTeamId: string; awayTeamId: string; seed: string | number }[],
      ): Promise<ArenaFixtureResultType[]> =>
        fixtures.map((fixture) => ({
          homeTeamId: fixture.homeTeamId,
          awayTeamId: fixture.awayTeamId,
          seiten: [1, 0] as [number, number],
          boxscore: [],
        }));

      const vorlauf = await stelleArenaVorlaufSicher(
        scope,
        { runArenaFixturesImpl: erfolgreicherRunner, runMiniDmFfaPodFixturesImpl: buildHarmlosenMiniDmFfaFakeRunner() },
        persistence,
      );
      expect(vorlauf.applicable).toBe(true);
      expect(vorlauf.status).toBe("ready");

      // Die Buchung sieht JEDES MAL eine Divergenz (der gemockte Hash ist bei jedem Aufruf neu) --
      // erzwingt deshalb genau EINEN zusaetzlichen Vorlauf und markiert danach "eingabe_instabil",
      // statt einen dritten, nutzlosen Vorlauf anzustossen.
      const gebucht = await kickoffArenaMatchdayApply({
        persistence,
        saveId: scope.saveId,
        seasonId: scope.seasonId,
        matchdayId: scope.matchdayId,
        runArenaFixturesImpl: erfolgreicherRunner,
        // CI-FIX (25.10.), s. Dateikopf-Kommentar: der erzwungene Neuversuch bei der (hier
        // kuenstlich erzeugten) Divergenz braucht denselben Mini-DM-Fake wie der erste Vorlauf.
        runMiniDmFfaPodFixturesImpl: buildHarmlosenMiniDmFfaFakeRunner(),
        forceReplace: true,
        allowIncompleteOverride: true,
        logPrefix: "[arena-eingabe-instabil-test]",
      });
      if (!gebucht.applicable || !gebucht.booked) {
        throw new Error(`Arena-Matchday-Apply nicht gebucht: ${JSON.stringify(gebucht).slice(0, 500)}`);
      }

      const stand = persistence.getSaveById(scope.saveId)!.gameState;
      const gebuchteZeilen = (stand.seasonState.disciplineResults ?? []).filter(
        (zeile) => zeile.disciplineId === arenaDisciplineId && zeile.matchdayResultId?.includes(scope.matchdayId),
      );
      expect(gebuchteZeilen.length).toBeGreaterThan(0);
      for (const zeile of gebuchteZeilen) {
        // NICHT "arena" -- der instabile Fingerabdruck darf nicht gebucht werden.
        expect(zeile.resolutionSource).toBe("pps_duell");
        const ausfall = zeile.arenaAusfall as { grund?: string } | null | undefined;
        expect(ausfall?.grund).toBe("eingabe_instabil");
      }
    },
    420_000, // bis zu 3 Setup-Versuche + bis zu 2 interne Arena-Vorlaeufe, kein echtes Chromium
  );
});
