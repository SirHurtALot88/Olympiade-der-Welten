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
import { ensureMatchdayResolveSnapshot } from "@/lib/foundation/matchday-resolve-snapshot";
import { kickoffArenaVorlauf, stelleArenaVorlaufSicher } from "@/lib/battle/arena-vorlauf-service";
import { ARENA_RESOLVED_DISCIPLINE_IDS } from "@/lib/battle/arena-resolved-disciplines";
import type { ArenaFixtureResult, RunArenaFixturesOptions } from "@/lib/battle/arena-headless-runner";
import type { GameState } from "@/lib/data/olyDataTypes";

/** Baut einen frischen Battle-Save mit vollstaendig befuelltem Feld fuer Spieltag 1. */
async function bauFrischenBattleSaveMitVollemFeld() {
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
  // Der volle Saison-Spielplan (alle 20 Spieltage) steht schon nach `applyNewGameSetup` --
  // unabhaengig davon, welcher Spieltag gerade "aktiv" ist. 13 von 20 Disziplinen sind
  // arena-aufgeloest, aber WELCHE Disziplin an Spieltag 1 steht, ist zufaellig (Formkarten-/
  // Spielplan-Saat je Save) -- deshalb den ERSTEN Spieltag mit einer arena-aufgeloesten
  // Disziplin suchen, statt sich auf Spieltag 1 zu verlassen (gemessen: Spieltag 1 trifft es
  // nicht immer, ~11 % der Saves haben dort weder D1 noch D2 arena-aufgeloest).
  const schedule = aktuell.gameState.seasonState.disciplineSchedule ?? [];
  let matchdayId: string | null = null;
  let arenaDisciplineId: string | null = null;
  for (const eintrag of schedule) {
    const kandidat = [eintrag.discipline1?.disciplineId, eintrag.discipline2?.disciplineId].find(
      (id): id is string => Boolean(id) && ARENA_RESOLVED_DISCIPLINE_IDS.has(id as string),
    );
    if (kandidat) {
      matchdayId = eintrag.matchdayId;
      arenaDisciplineId = kandidat;
      break;
    }
  }
  expect(matchdayId, "Kein Spieltag dieser Saison hat ueberhaupt eine arena-aufgeloeste Disziplin -- unerwartet").not.toBeNull();
  expect(arenaDisciplineId).not.toBeNull();
  // Alle 32 Teams fuer DIESEN Spieltag aufstellen (KI-Batch), damit `isMatchdayFieldComplete()`
  // zutrifft -- unabhaengig davon, ob es der aktuell aktive Spieltag ist.
  const batch = applyAiLegacyLineupBatchLocally(
    { saveId, seasonId, matchdayId: matchdayId!, dryRun: false, includeWarningTeams: true, overwriteExisting: true },
    persistence,
  );
  expect(batch.summary.blockingReasons, batch.summary.blockingReasons.join(" | ")).toEqual([]);
  const scope = { saveId, seasonId, matchdayId: matchdayId! };
  return { persistence, scope, arenaDisciplineId: arenaDisciplineId! };
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
    180_000,
  );
});

describe("Arena-Vorlauf-Service · Koop/Doppellauf (Plan Abschnitt 6.2 #5)", () => {
  it(
    "zwei fast gleichzeitige Vorlauf-Anstoesse mit derselben Signatur rufen den Runner nur einmal je Liga auf",
    async () => {
      const { persistence, scope } = await bauFrischenBattleSaveMitVollemFeld();
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

      // Der Runner wurde NICHT doppelt aufgerufen: hoechstens einmal je Liga mit Fixtures an
      // diesem Spieltag (1 oder 2 Ligen) -- NIE das Doppelte davon (waere der Fall ohne
      // In-Prozess-Entdopplung).
      expect(aufrufe).toBeGreaterThan(0);
      expect(aufrufe).toBeLessThanOrEqual(2);
    },
    180_000,
  );
});
