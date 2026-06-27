import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { runLocalSeasonCompletion, SEASON_COMPLETION_CONFIRM_TOKEN } from "@/lib/season/season-completion-service";
import {
  applyPreSeasonNextSeasonSetupLightweight,
  buildPreSeasonNextSeasonSetupToken,
} from "@/lib/season/preseason-workflow-service";

async function main() {
  const saveId = process.argv[2] ?? "fresh-season-1-1782497870094";
  const persistence = createPersistenceService();
  const save = persistence.getSaveById(saveId);
  if (!save) throw new Error(`Save ${saveId} not found`);
  const gs = save.gameState;
  console.log("state", {
    phase: gs.gamePhase,
    matchdayId: gs.matchdayState.matchdayId,
    matchdayStatus: gs.matchdayState.status,
    currentMatchday: gs.season.currentMatchday,
    results: (gs.seasonState.matchdayResults ?? []).filter((row) => row.seasonId === gs.season.id).length,
  });

  const started = Date.now();
  const completion = await runLocalSeasonCompletion(
    {
      saveId,
      seasonId: gs.season.id,
      source: "sqlite",
      execute: true,
      dryRun: false,
      confirmToken: SEASON_COMPLETION_CONFIRM_TOKEN,
    },
    persistence,
  );
  console.log("completion", Date.now() - started, "ms", completion.ok, completion.applied, completion.blockingReasons);

  if (!completion.applied) return;

  const reviewSave = persistence.getSaveById(saveId);
  if (!reviewSave) throw new Error("missing after completion");
  const token = buildPreSeasonNextSeasonSetupToken(reviewSave).confirmToken;
  const next = applyPreSeasonNextSeasonSetupLightweight(reviewSave, token, persistence);
  console.log("s2", next.applied, next.blockingReasons, reviewSave.gameState.season.id, "->", persistence.getSaveById(saveId)?.gameState.season.id);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
