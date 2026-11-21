// Messung 21.11.: wie lange dauern die Schritte hinter "Einsatzliste speichern" und "Spieltag werten"?
// WEGWERF-Store (OLY_APP_SQLITE_PATH), nie den echten. Aufruf:
//   OLY_APP_SQLITE_PATH=/tmp/x.sqlite OLY_AUTO_EXPORT_SAVES=0 OLY_AUTO_EXPORT_PUSH=0 npx tsx scripts/messe-spieltag-tempo.ts
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { applyNewGameSetup, previewNewGameSetup } from "@/lib/game/new-game-setup-service";
import { fuehreLigaSetupDraftAus } from "@/lib/game/league-setup-draft-service";
import { applyGameModeOwnership } from "@/lib/foundation/team-control-settings";
import { applyAiLegacyLineupBatchLocally } from "@/lib/ai/ai-legacy-lineup-batch-apply-service";
import { ensureMatchdayResolveSnapshot } from "@/lib/foundation/matchday-resolve-snapshot";
import { kickoffArenaVorlauf, beschleunigeArenaVorlaufPerQuickSim } from "@/lib/battle/arena-vorlauf-service";
import { saveLocalLegacyLineupDraft, getLocalLegacyLineupDraft } from "@/lib/lineups/legacy-lineup-local-service";
import { runLocalMatchdayAutoRun, MATCHDAY_AUTO_RUN_CONFIRM_TOKEN } from "@/lib/season/matchday-auto-run-service";

const T = () => Date.now();

async function main() {
  const persistence = createPersistenceService();
  const vorhanden = process.env.OLY_MESS_SAVE ?? null;
  let saveId = vorhanden ?? "";
  if (vorhanden && process.env.OLY_MESS_ALLAI === "1") {
    // Kopie des Live-Abbilds: alle Teams auf KI stellen, damit das Feld komplett werden kann (nur Messkopie!).
    const nach = persistence.getSaveById(saveId)!;
    persistence.saveSingleplayerState(saveId, applyGameModeOwnership(nach.gameState, { saveMode: "solo_1", chrisTeamIds: [], frankyTeamIds: [] }));
  }
  if (!vorhanden) {
    persistence.bootstrapSingleplayerSave();
    const input = { presetId: "solo_1" as const, gameMode: "battle" as const };
    const preview = previewNewGameSetup(input);
    const angelegt = applyNewGameSetup({ ...input, confirmToken: preview.confirmToken }, persistence, { ownerId: null });
    saveId = angelegt.save.saveId;
    await fuehreLigaSetupDraftAus({ persistence, saveId, seasonId: persistence.getSaveById(saveId)!.gameState.season.id, callerWritableTeamIds: null, excludeTeamIds: [], logPrefix: "[mess]" });
    const nach = persistence.getSaveById(saveId)!;
    persistence.saveSingleplayerState(saveId, applyGameModeOwnership(nach.gameState, { saveMode: "solo_1", chrisTeamIds: [], frankyTeamIds: [] }));
  }
  const gs = persistence.getSaveById(saveId)!.gameState;
  const seasonId = gs.season.id;
  const matchdayId = gs.matchdayState.matchdayId;
  const scope = { saveId, seasonId, matchdayId };
  const teamId = gs.teams[0]!.teamId;
  console.log(`Spieltag ${matchdayId}, Teams ${gs.teams.length}`);

  let t = T();
  applyAiLegacyLineupBatchLocally({ saveId, seasonId, matchdayId, dryRun: false, includeWarningTeams: true, overwriteExisting: true }, persistence);
  console.log(`[0 KI-Aufwaermen alle Teams (Prewarm)] ${T() - t} ms`);
  const draft = getLocalLegacyLineupDraft({ saveId, seasonId, matchdayId, teamId }, persistence);
  if (!draft) throw new Error("kein Entwurf");
  const entries = draft.entries as never;
  const modifiers = draft.modifiers as never;

  t = T();
  const res = saveLocalLegacyLineupDraft({ saveId, seasonId, matchdayId, teamId }, entries, modifiers, persistence, { lockMatchday: true });
  console.log(`[1 saveLocalLegacyLineupDraft] ${T() - t} ms ok=${res.ok}`);
  t = T();
  applyAiLegacyLineupBatchLocally({ saveId, seasonId, matchdayId, dryRun: false, includeWarningTeams: false, overwriteExisting: false }, persistence);
  console.log(`[2 KI-Batch (Feld komplett, ueberschreibt nicht)] ${T() - t} ms`);
  t = T();
  const snap = ensureMatchdayResolveSnapshot(scope, persistence);
  console.log(`[3 ensureMatchdayResolveSnapshot] ${T() - t} ms (${snap ? "da" : "null"})`);
  t = T();
  const k = kickoffArenaVorlauf(scope, {}, persistence);
  console.log(`[4 kickoffArenaVorlauf sync-Teil] ${T() - t} ms status=${k.status}`);
  t = T();
  const q = await beschleunigeArenaVorlaufPerQuickSim(scope, {}, persistence);
  console.log(`[5 Vorlauf per Node (Arena-Berechnung bis bereit)] ${T() - t} ms weg=${q.weg} status=${q.status}`);

  t = T();
  const lauf = await runLocalMatchdayAutoRun(
    { saveId, seasonId, matchdayId, source: "sqlite", execute: true, dryRun: false, confirmToken: MATCHDAY_AUTO_RUN_CONFIRM_TOKEN,
      options: { includeWarningLineups: true, overwriteExistingLineups: false, stopOnTie: false, advanceAfterCashApply: false } },
    persistence,
  );
  console.log(`[6 Auto-Run (Wertung)] ${T() - t} ms ok=${lauf.ok} ${lauf.ok ? "" : lauf.blockingReasons?.slice(0, 3).join(" | ")}`);
}
void main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
