import {
  CHUNKED_REDRAFT_TOPUP_CONFIRM_TOKEN,
  runChunkedRedraftTopup,
  type ChunkedRedraftTarget,
} from "@/lib/ai/chunked-redraft-topup-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

const WRITE_ENABLED = process.argv.includes("--write");
const RESUME_ENABLED = process.argv.includes("--resume");
const TARGET_ARG = process.argv.find((arg) => arg.startsWith("--target="))?.split("=")[1] as ChunkedRedraftTarget | undefined;
const ROUND_LIMIT = Number(process.argv.find((arg) => arg.startsWith("--round-limit="))?.split("=")[1] ?? 16);
const TEAM_TIME_LIMIT_MS = Number(process.argv.find((arg) => arg.startsWith("--team-time-limit-ms="))?.split("=")[1] ?? 10_000);
const OUTPUT_DIR = process.env.OLY_TOPUP_OUTPUT_DIR ?? process.env.OLY_EXPORT_DIR ?? "outputs";
const TARGET_SAVE_ID = process.env.OLY_TARGET_SAVE_ID ?? null;
const TARGET_SEASON_ID = process.env.OLY_TARGET_SEASON_ID ?? "season-1";

function main() {
  const persistence = createPersistenceService();
  const save = (TARGET_SAVE_ID ? persistence.getSaveById(TARGET_SAVE_ID) : null) ?? persistence.getActiveSave() ?? persistence.bootstrapSingleplayerSave().save;
  if (!save) throw new Error("No active local save available.");

  const result = runChunkedRedraftTopup({
    persistence,
    saveId: save.saveId,
    seasonId: TARGET_SEASON_ID,
    dryRun: !WRITE_ENABLED,
    confirmToken: WRITE_ENABLED ? CHUNKED_REDRAFT_TOPUP_CONFIRM_TOKEN : null,
    mode: "season1_initial_topup",
    resume: RESUME_ENABLED,
    target: TARGET_ARG === "playerMax" ? "playerMax" : TARGET_ARG === "playerOpt" ? "playerOpt" : "playerMin",
    roundLimit: Number.isFinite(ROUND_LIMIT) ? ROUND_LIMIT : 16,
    teamTimeLimitMs: Number.isFinite(TEAM_TIME_LIMIT_MS) ? TEAM_TIME_LIMIT_MS : 10_000,
    outputDir: OUTPUT_DIR,
  });

  console.log(JSON.stringify(result, null, 2));
  if (result.summary.teamsBelowMin.length > 0) {
    process.exitCode = 1;
  }
}

main();
