import fs from "node:fs";
import path from "node:path";

import {
  CHUNKED_REDRAFT_TOPUP_CONFIRM_TOKEN,
  runChunkedRedraftTopup,
} from "@/lib/ai/chunked-redraft-topup-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { withScenarioMeta } from "@/lib/persistence/scenario-meta";

const OUTPUT_ROOT = process.env.OLY_EXPORT_DIR ?? "outputs";
const OUTPUT_DIR =
  process.env.OLY_FULL_CLEAN_REDRAFT_V2_OUTPUT_DIR ??
  path.join(OUTPUT_ROOT, `full-clean-redraft-v2-${new Date().toISOString().replaceAll(/[:.]/g, "-")}`);
const ROUND_LIMIT = Number(process.env.OLY_FULL_CLEAN_REDRAFT_V2_ROUND_LIMIT ?? 18);
const TEAM_TIME_LIMIT_MS = Number(process.env.OLY_FULL_CLEAN_REDRAFT_V2_TEAM_TIME_LIMIT_MS ?? 10_000);

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function copyIfExists(sourceName: string, targetName: string) {
  const source = path.join(OUTPUT_DIR, sourceName);
  if (fs.existsSync(source)) {
    fs.copyFileSync(source, path.join(OUTPUT_DIR, targetName));
  }
}

function main() {
  const persistence = createPersistenceService();
  const save = persistence.createFreshSeasonOneSave({
    name: `Full Clean Redraft V2 ${new Date().toLocaleString("de-DE")}`,
  });

  if (save.gameState.rosters.length !== 0) {
    throw new Error(`full_clean_redraft_v2_start_rosters_not_empty:${save.gameState.rosters.length}`);
  }
  if (save.gameState.transferHistory.length !== 0) {
    throw new Error(`full_clean_redraft_v2_start_transferhistory_not_empty:${save.gameState.transferHistory.length}`);
  }

  persistence.saveSingleplayerState(
    save.saveId,
    withScenarioMeta(save.gameState, {
      scenarioType: "ai_redraft_test",
      label: save.name,
      description: "Full Clean Redraft V2: leerer Season-1 Startsave, chunked AI Picklauf bis mindestens playerMin.",
      isStableTestPoint: true,
      allowTestWrites: true,
      gamePhase: "draft",
    }),
  );
  persistence.activateSave(save.saveId);

  const result = runChunkedRedraftTopup({
    persistence,
    saveId: save.saveId,
    seasonId: "season-1",
    dryRun: false,
    confirmToken: CHUNKED_REDRAFT_TOPUP_CONFIRM_TOKEN,
    mode: "full_clean_redraft",
    target: "playerOpt",
    roundLimit: Number.isFinite(ROUND_LIMIT) ? ROUND_LIMIT : 18,
    teamTimeLimitMs: Number.isFinite(TEAM_TIME_LIMIT_MS) ? TEAM_TIME_LIMIT_MS : 10_000,
    outputDir: OUTPUT_DIR,
  });

  copyIfExists("chunked-redraft-summary.json", "full-clean-redraft-v2-summary.json");
  copyIfExists("chunked-redraft-summary.md", "full-clean-redraft-v2-summary.md");
  copyIfExists("chunked-redraft-picks.csv", "full-clean-redraft-v2-picks.csv");
  copyIfExists("chunked-redraft-team-status.csv", "full-clean-redraft-v2-team-status.csv");
  copyIfExists("redraft-pick-quality.csv", "full-clean-redraft-v2-pick-quality.csv");
  copyIfExists("chunked-redraft-warnings.csv", "full-clean-redraft-v2-warnings.csv");
  copyIfExists("chunked-redraft-memory.csv", "full-clean-redraft-v2-memory.csv");

  const summary = readJson<typeof result.summary>(path.join(OUTPUT_DIR, "chunked-redraft-summary.json"));
  const finalSave = persistence.getSaveById(save.saveId);
  persistence.activateSave(save.saveId);

  fs.writeFileSync(
    path.join(OUTPUT_DIR, "full-clean-redraft-v2-validity.md"),
    [
      "# Full Clean Redraft V2 Validity",
      "",
      `- DRAFT_VALID: ${summary.draftValid ? "true" : "false"}`,
      `- Save aktiv: ${finalSave?.saveId ?? save.saveId}`,
      `- Start war leer: ${summary.startWasEmpty ? "ja" : "nein"}`,
      `- Teams unter Min: ${summary.teamsBelowMin.length}`,
      `- Cash uebrig trotz unter Min: ${summary.cashLeftWhileBelowMin.length}`,
      `- Picks ohne Score: ${summary.picksMissingScores.length}`,
      `- Transferhistory mismatch: ${summary.transferHistoryMismatch ? "ja" : "nein"}`,
      `- Doppelte Spieler: ${summary.duplicatePlayers.length}`,
      `- Negative Cash Teams: ${summary.negativeCashTeams.length}`,
      `- Picks total: ${summary.picksTotal}`,
      `- Transferhistory total: ${summary.transferHistoryTotal}`,
      `- Memory Peak: ${summary.memoryPeakMb} MB`,
      "",
      "## Invalid Gruende",
      ...(summary.invalidReasons.length ? summary.invalidReasons.map((reason) => `- ${reason}`) : ["- keine"]),
      "",
      "## Teams unter Min",
      ...(summary.teamsBelowMin.length
        ? summary.teamsBelowMin.map((row) => `- ${row.teamId}: ${row.rosterCount}/${row.playerMin}`)
        : ["- keine"]),
    ].join("\n"),
    "utf8",
  );

  console.log(
    JSON.stringify(
      {
        saveId: save.saveId,
        outputDir: OUTPUT_DIR,
        draftValid: summary.draftValid,
        invalidReasons: summary.invalidReasons,
        teamsBelowMin: summary.teamsBelowMin.length,
        picksTotal: summary.picksTotal,
        transferHistoryTotal: summary.transferHistoryTotal,
        memoryPeakMb: summary.memoryPeakMb,
        activeSave: finalSave?.saveId ?? save.saveId,
      },
      null,
      2,
    ),
  );

  if (!summary.draftValid) {
    process.exitCode = 1;
  }
}

main();
