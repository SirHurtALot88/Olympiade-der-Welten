/**
 * TEST-SPIELSTAND MIT BASKETBALL AM SPIELTAG 1 (Basketball-Review 18.11., docs/design/basketball-review-18-11.md).
 *
 * Derselbe echte Weg wie tests/helpers/bahn-pod-battle-save.ts: frischer Battle-Save (solo_1), echter
 * Liga-Setup-Draft, Spieltag 1 mit erzwungenen Disziplinen (D1 = Basketball, D2 = Hockey, beide Eintraege
 * aus dem Spielplan desselben Saves uebernommen), echte KI-Aufstellung fuer alle Teams. Damit zeigt
 * /foundation?view=matchdayArena das Basketballspiel im Spieltagsablauf (Vollbild-Buehne).
 *
 *   OLY_APP_SQLITE_PATH=/tmp/x.sqlite npx tsx scripts/baue-basketball-spieltag-save.ts
 *
 * Schreibt NUR in die Datei aus OLY_APP_SQLITE_PATH (Pflicht, nie in den echten Spielstand).
 */
import { applyNewGameSetup, previewNewGameSetup } from "@/lib/game/new-game-setup-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { applyGameModeOwnership } from "@/lib/foundation/team-control-settings";
import { fuehreLigaSetupDraftAus } from "@/lib/game/league-setup-draft-service";
import { applyAiLegacyLineupBatchLocally } from "@/lib/ai/ai-legacy-lineup-batch-apply-service";

async function main() {
  const pfad = process.env.OLY_APP_SQLITE_PATH;
  if (!pfad || !pfad.startsWith("/tmp/")) throw new Error("OLY_APP_SQLITE_PATH muss auf eine Kopie unter /tmp zeigen.");
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
    logPrefix: "[basketball-review]",
  });
  const nachDraft = persistence.getSaveById(saveId)!;
  persistence.saveSingleplayerState(
    saveId,
    applyGameModeOwnership(nachDraft.gameState, { saveMode: "solo_1", chrisTeamIds: [], frankyTeamIds: [] }),
  );
  const vorher = persistence.getSaveById(saveId)!;
  const seasonId = vorher.gameState.season.id;
  const matchdayId = vorher.gameState.matchdayState.matchdayId;
  const plan = vorher.gameState.seasonState.disciplineSchedule ?? [];
  const bisher = plan.find((e) => e.matchdayId === matchdayId);
  const finde = (id: string) => plan.flatMap((e) => [e.discipline1, e.discipline2]).find((d) => d?.disciplineId === id);
  const bb = finde("basketball");
  const hk = finde("hockey");
  if (!bisher || !bb || !hk) throw new Error("Spielplan ohne Spieltag 1, Basketball oder Hockey.");
  const erzwungen = { ...bisher, discipline1: { ...bb, order: bisher.discipline1?.order ?? 1 }, discipline2: { ...hk, order: bisher.discipline2?.order ?? 2 } };
  persistence.saveSingleplayerState(saveId, {
    ...vorher.gameState,
    seasonState: { ...vorher.gameState.seasonState, disciplineSchedule: [...plan.filter((e) => e.matchdayId !== matchdayId), erzwungen] },
  });
  const batch = applyAiLegacyLineupBatchLocally(
    { saveId, seasonId, matchdayId, dryRun: false, includeWarningTeams: true, overwriteExisting: true },
    persistence,
  );
  console.log(JSON.stringify({ saveId, seasonId, matchdayId, blockiert: batch.summary.blockingReasons }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
