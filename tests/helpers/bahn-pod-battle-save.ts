/**
 * TEST-SPIELSTAND MIT BAHN-POD-SPIELTAG (02.11., docs/design/bahn-pod-vier-teams-01-11.md Abschnitt 6).
 *
 * Derselbe echte Weg wie `bauFrischenBattleSaveMitMiniDmAnSpieltag1()` (mini-dm-ffa-battle-save.ts):
 * frischer Battle-Save (solo_1), echter Liga-Setup-Draft (Liga-Split, 16 Teams je Liga), Spieltag 1
 * mit erzwungenen Disziplinen, echte KI-Aufstellung fuer alle Teams. D1 = Staffel, D2 = Takeshi's
 * Castle -- beide Bahn-Pods am SELBEN Spieltag (Chris 01.11.: zwei Pod-Disziplinen an einem Tag sind
 * erlaubt), je Disziplin frisch geloste Gruppen. Kein Fake: was der Vorlauf damit macht, ist der
 * Produktionspfad.
 */
import { applyNewGameSetup, previewNewGameSetup } from "@/lib/game/new-game-setup-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { resetDatabaseForTests } from "@/lib/persistence/sqlite";
import { applyGameModeOwnership } from "@/lib/foundation/team-control-settings";
import { fuehreLigaSetupDraftAus } from "@/lib/game/league-setup-draft-service";
import { applyAiLegacyLineupBatchLocally } from "@/lib/ai/ai-legacy-lineup-batch-apply-service";
import { getPodsForMatchday, type MiniDmPod } from "@/lib/season/mini-dm-pod-schedule";
import { expect } from "vitest";

export const BAHN_POD_TEST_K = 4;

export async function bauFrischenBattleSaveMitBahnPodsAnSpieltag1(k: number = BAHN_POD_TEST_K, sqlitePfad?: string) {
  resetDatabaseForTests();
  process.env.OLY_APP_SQLITE_PATH = sqlitePfad ?? `/tmp/oly-bahn-pod-e2e-${Math.random().toString(36).slice(2)}.sqlite`;
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
    logPrefix: "[bahn-pod-e2e]",
  });
  const nachDraft = persistence.getSaveById(saveId)!;
  persistence.saveSingleplayerState(
    saveId,
    applyGameModeOwnership(nachDraft.gameState, { saveMode: "solo_1", chrisTeamIds: [], frankyTeamIds: [] }),
  );
  const vorher = persistence.getSaveById(saveId)!;
  const seasonId = vorher.gameState.season.id;
  const matchdayId = vorher.gameState.matchdayState.matchdayId;
  const bisher = (vorher.gameState.seasonState.disciplineSchedule ?? []).find((e) => e.matchdayId === matchdayId);
  if (!bisher) throw new Error("bauFrischenBattleSaveMitBahnPodsAnSpieltag1: Spieltag 1 hat keinen Spielplan-Eintrag.");
  const erzwungen = {
    ...bisher,
    discipline1: {
      disciplineId: "staffel",
      displayName: "Staffel",
      order: bisher.discipline1?.order ?? 1,
      playerCount: k,
      legacyScorePlayerCount: k,
      category: "speed" as const,
      occurrenceInSeason: 1 as const,
    },
    discipline2: {
      disciplineId: "takeshis-castle",
      displayName: "Takeshi's Castle",
      order: bisher.discipline2?.order ?? 2,
      playerCount: k,
      legacyScorePlayerCount: k,
      category: "mental" as const,
      occurrenceInSeason: 1 as const,
    },
  };
  persistence.saveSingleplayerState(saveId, {
    ...vorher.gameState,
    seasonState: {
      ...vorher.gameState.seasonState,
      disciplineSchedule: [...(vorher.gameState.seasonState.disciplineSchedule ?? []).filter((e) => e.matchdayId !== matchdayId), erzwungen],
    },
  });

  const stand = persistence.getSaveById(saveId)!.gameState;
  const podsByDisciplineId = new Map<string, MiniDmPod[]>(
    ["staffel", "takeshis-castle"].map((disciplineId) => [disciplineId, getPodsForMatchday(stand, matchdayId, disciplineId, { saveId })]),
  );
  for (const [disciplineId, pods] of podsByDisciplineId) {
    if (pods.length === 0) throw new Error(`bauFrischenBattleSaveMitBahnPodsAnSpieltag1: keine Pods fuer ${disciplineId}.`);
  }

  const batch = applyAiLegacyLineupBatchLocally(
    { saveId, seasonId, matchdayId, dryRun: false, includeWarningTeams: true, overwriteExisting: true },
    persistence,
  );
  expect(batch.summary.blockingReasons, batch.summary.blockingReasons.join(" | ")).toEqual([]);

  return { persistence, scope: { saveId, seasonId, matchdayId }, k, podsByDisciplineId };
}
