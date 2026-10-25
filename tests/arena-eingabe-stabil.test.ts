import { describe, expect, it } from "vitest";

import { applyNewGameSetup, previewNewGameSetup } from "@/lib/game/new-game-setup-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { applyGameModeOwnership } from "@/lib/foundation/team-control-settings";
import { fuehreLigaSetupDraftAus } from "@/lib/game/league-setup-draft-service";
import { applyAiLegacyLineupBatchLocally } from "@/lib/ai/ai-legacy-lineup-batch-apply-service";
import { ensureMatchdayResolveSnapshot } from "@/lib/foundation/matchday-resolve-snapshot";
import { stelleArenaVorlaufSicher } from "@/lib/battle/arena-vorlauf-service";
import { kickoffArenaMatchdayApply } from "@/lib/season/arena-matchday-resolve-service";
import { ARENA_RESOLVED_DISCIPLINE_IDS } from "@/lib/battle/arena-resolved-disciplines";
import type { ArenaFixtureResult } from "@/lib/battle/arena-headless-runner";
import { buildHarmlosenMiniDmFfaFakeRunner } from "@/tests/helpers/mini-dm-ffa-battle-save";

/**
 * CI-FIX (25.10., dedizierte Root-Cause-Untersuchung): `bauFrischenBattleSaveMitVollemFeld()`
 * unten akzeptiert JEDE arena-aufgeloeste Disziplin an D1/D2 eines zufaelligen Liga-Drafts, OHNE
 * Mini-DM auszuschliessen -- landet Mini-DM (zufaellig, unabhaengig von der arena-aufgeloesten
 * Disziplin) SELBST an diesem Spieltag, laeuft seit PR 5 ein eigener, NICHT gefakter
 * `runMiniDmFfaPodFixtures()`-Zweig mit echtem Chromium, das in `full-test-suite`/`persistenz-
 * suiten` (kein Chromium installiert) scheitert. `buildHarmlosenMiniDmFfaFakeRunner()` wird deshalb
 * ab jetzt NEBEN `runArenaFixturesImpl` mitgegeben.
 */

/**
 * GEGENSTUECK zu tests/arena-eingabe-instabil.test.ts (Opus-Nachtrag 18.10.): der NORMALFALL
 * (Wizard, KI-Lineup-Speichern, Auto-Run) darf NIEMALS in die B3-Instabilitaets-Falle laufen --
 * der echte (NICHT gemockte) `berechneArenaEingabeHash()` ist deterministisch ueber denselben
 * Spielstand, solange sich zwischen Vorlauf und Buchung nichts an Kader/Aufstellung/Mutatoren/
 * Motor aendert. Dieser Test belegt das OHNE echtes Chromium (injizierter, erfolgreicher Runner --
 * der Hash selbst ist chromium-unabhaengig, s. arena-eingabe-hash.ts-Kopfkommentar), laeuft
 * deshalb IMMER, auch in `full-test-suite`/`ci:persistenz-suiten`.
 */
async function bauFrischenBattleSaveMitVollemFeld() {
  for (let versuch = 1; versuch <= 3; versuch += 1) {
    process.env.OLY_APP_SQLITE_PATH = `/tmp/oly-arena-eingabe-stabil-${Math.random().toString(36).slice(2)}.sqlite`;
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
      logPrefix: "[arena-eingabe-stabil-test]",
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

describe("Arena-Vorlauf-Service · eingabe_instabil bleibt 0 im Normalfall (Opus-Review, B3-Nachtrag)", () => {
  it(
    "ein stabiler (nicht gemockter) Eingabe-Hash bucht beim ersten Versuch durch -- kein erzwungener Neuversuch, 0 Zeilen eingabe_instabil",
    async () => {
      const { persistence, scope, arenaDisciplineId } = await bauFrischenBattleSaveMitVollemFeld();
      ensureMatchdayResolveSnapshot(scope, persistence);

      const erfolgreicherRunner = async (
        _gameState: unknown,
        fixtures: { homeTeamId: string; awayTeamId: string; seed: string | number }[],
      ): Promise<ArenaFixtureResult[]> =>
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

      const gebucht = await kickoffArenaMatchdayApply({
        persistence,
        saveId: scope.saveId,
        seasonId: scope.seasonId,
        matchdayId: scope.matchdayId,
        forceReplace: true,
        allowIncompleteOverride: true,
        logPrefix: "[arena-eingabe-stabil-test]",
      });
      if (!gebucht.applicable || !gebucht.booked) {
        throw new Error(`Arena-Matchday-Apply nicht gebucht: ${JSON.stringify(gebucht).slice(0, 500)}`);
      }

      const stand = persistence.getSaveById(scope.saveId)!.gameState;
      const alleZeilenDiesesSpieltags = (stand.seasonState.disciplineResults ?? []).filter((zeile) =>
        zeile.matchdayResultId?.includes(scope.matchdayId),
      );
      const instabilZeilen = alleZeilenDiesesSpieltags.filter(
        (zeile) => (zeile.arenaAusfall as { grund?: string } | null | undefined)?.grund === "eingabe_instabil",
      );
      expect(instabilZeilen).toHaveLength(0);

      const gebuchteZeilen = alleZeilenDiesesSpieltags.filter((zeile) => zeile.disciplineId === arenaDisciplineId);
      expect(gebuchteZeilen.length).toBeGreaterThan(0);
      for (const zeile of gebuchteZeilen) {
        // Der Normalfall bucht ARENA, nicht die Bruecke -- kein arenaAusfall jeglicher Art.
        expect(zeile.resolutionSource).toBe("arena");
        expect(zeile.arenaAusfall ?? null).toBeNull();
      }
    },
    420_000,
  );
});
