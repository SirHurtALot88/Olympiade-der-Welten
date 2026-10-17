import { describe, expect, it } from "vitest";

import { applyNewGameSetup, previewNewGameSetup } from "@/lib/game/new-game-setup-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { applyGameModeOwnership } from "@/lib/foundation/team-control-settings";
import { fuehreLigaSetupDraftAus } from "@/lib/game/league-setup-draft-service";
import { applyAiLegacyLineupBatchLocally } from "@/lib/ai/ai-legacy-lineup-batch-apply-service";
import { ensureMatchdayResolveSnapshot, readArenaVorlaufRecord } from "@/lib/foundation/matchday-resolve-snapshot";
import { stelleArenaVorlaufSicher } from "@/lib/battle/arena-vorlauf-service";
import { kickoffArenaMatchdayApply } from "@/lib/season/arena-matchday-resolve-service";
import { ARENA_RESOLVED_DISCIPLINE_IDS } from "@/lib/battle/arena-resolved-disciplines";

/**
 * ABNAHME-CHECK #3 (Opus-Review, PR 3/K1): "Was du siehst, wird gebucht" -- ECHTER Chromium-Lauf
 * (kein injizierter Runner), der beweist, dass die Zeilen, die der fertige Arena-Vorlauf-Snapshot
 * zeigt (das, was die Buehne dem Spieler praesentieren wuerde), ZAHLENGLEICH mit den Zeilen sind,
 * die anschliessend tatsaechlich in `seasonState.disciplineResults` gebucht werden -- keine
 * zweite, abweichende Berechnung beim Buchen selbst.
 *
 * Deckt zugleich ab, dass `attachMatchdayInjuryPerformanceToContexts` an BEIDEN Stellen
 * (`writeMatchdayResolveSnapshot()` beim Vorlauf-Start UND `kickoffArenaMatchdayApply()`s eigener
 * `buildLegacyMatchdayResolvePreview()`-Fallback) denselben Verletzungs-Malus anwenden -- eine
 * Divergenz dort waere ein Zahlen-Unterschied zwischen Vorschau und Buchung, den dieser Test
 * sofort zeigen wuerde.
 */
async function bauFrischenBattleSaveMitVollemFeld() {
  for (let versuch = 1; versuch <= 3; versuch += 1) {
    process.env.OLY_APP_SQLITE_PATH = `/tmp/oly-arena-vorlauf-parity-${Math.random().toString(36).slice(2)}.sqlite`;
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
      logPrefix: "[arena-vorlauf-parity-test]",
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

describe("Arena-Vorlauf-Service · Was-du-siehst-wird-gebucht-Parität (Opus-Review, Abnahme-Check #3)", () => {
  it(
    "bucht fuer eine arena-aufgeloeste Disziplin GENAU die Zeilen, die der fertige Vorlauf-Snapshot zeigte (echtes Chromium)",
    async () => {
      const { persistence, scope, arenaDisciplineId } = await bauFrischenBattleSaveMitVollemFeld();

      ensureMatchdayResolveSnapshot(scope, persistence);
      // ECHTER Lauf -- KEIN injizierter Runner. Falls lokal kein Chromium verfuegbar ist, scheitert
      // dieser Test mit einer klaren Chromium-Fehlermeldung statt eines stillen Falsch-Gruens.
      const vorlauf = await stelleArenaVorlaufSicher(scope, {}, persistence);
      expect(vorlauf.applicable).toBe(true);
      expect(vorlauf.status).toBe("ready");

      // Das ist GENAU das, was die Buehne nach dem Vorlauf zeigen wuerde (der Snapshot-Payload im
      // Save, derselbe, aus dem FoundationBattleArenaHost/DisciplineStageArena ihre Preview lesen).
      const nachVorlauf = persistence.getSaveById(scope.saveId)!;
      const gezeigterSnapshot = (nachVorlauf.gameState.seasonState.matchdayResolveSnapshots ?? []).find(
        (s) => s.matchdayId === scope.matchdayId,
      );
      expect(gezeigterSnapshot).toBeDefined();
      const gezeigteDisziplin = (
        gezeigterSnapshot!.payload as {
          preview?: { disciplinePreviews?: Array<{ disciplineId: string; teamResults: Array<{ teamId: string; teamPoints: number | null; resolutionSource?: string }> }> };
        }
      ).preview?.disciplinePreviews?.find((d) => d.disciplineId === arenaDisciplineId);
      expect(gezeigteDisziplin).toBeDefined();
      expect(gezeigteDisziplin!.teamResults.length).toBeGreaterThan(0);
      for (const team of gezeigteDisziplin!.teamResults) {
        expect(team.resolutionSource).toBe("arena");
      }
      const gezeigtByTeam = new Map(gezeigteDisziplin!.teamResults.map((t) => [t.teamId, t.teamPoints]));

      const gebucht = await kickoffArenaMatchdayApply({
        persistence,
        saveId: scope.saveId,
        seasonId: scope.seasonId,
        matchdayId: scope.matchdayId,
        forceReplace: true,
        allowIncompleteOverride: true,
        logPrefix: "[arena-vorlauf-parity-test]",
      });
      if (!gebucht.applicable || !gebucht.booked) {
        throw new Error(`Arena-Matchday-Apply nicht gebucht: ${JSON.stringify(gebucht)}`);
      }

      const nachBuchung = persistence.getSaveById(scope.saveId)!;
      const gebuchteZeilen = (nachBuchung.gameState.seasonState.disciplineResults ?? []).filter(
        (zeile) => zeile.disciplineId === arenaDisciplineId && zeile.matchdayResultId?.includes(scope.matchdayId),
      );
      expect(gebuchteZeilen.length).toBe(gezeigteDisziplin!.teamResults.length);
      for (const zeile of gebuchteZeilen) {
        expect(zeile.resolutionSource).toBe("arena");
        // PARITAET: die gebuchte Zahl ist EXAKT die, die der Snapshot vorher zeigte -- keine
        // zweite, beim Buchen abweichend berechnete Zahl (das waere der Bruch im "Was du siehst,
        // wird gebucht"-Versprechen).
        expect(zeile.teamPoints).toBe(gezeigtByTeam.get(zeile.teamId));
      }

      // Spiegelprobe fuer die Kontextkette selbst (statt nur das Endergebnis): kein
      // arenaAusfall-Marker bei einem tatsaechlich erfolgreichen Chromium-Lauf.
      for (const d of Object.values(readArenaVorlaufRecord(nachBuchung.gameState, scope)?.disziplinen ?? {})) {
        expect(d.status).toBe("ready");
        expect(d.ausfall).toBeFalsy();
      }
    },
    420_000,
  );
});
