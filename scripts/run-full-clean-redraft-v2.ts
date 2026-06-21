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
const MAX_TEAMS = Number(process.env.OLY_FULL_CLEAN_REDRAFT_V2_MAX_TEAMS ?? Number.NaN);
const WATCHDOG_MS = Number(process.env.OLY_FULL_CLEAN_REDRAFT_V2_WATCHDOG_MS ?? 30_000);
const DRY_RUN = process.env.OLY_FULL_CLEAN_REDRAFT_V2_DRY_RUN === "true";
const REPORT_MODE = process.env.OLY_FULL_CLEAN_REDRAFT_V2_REPORT_MODE === "light" ? "light" : "full";
const TARGET_TEAM_IDS = (process.env.OLY_FULL_CLEAN_REDRAFT_V2_TARGET_TEAMS ?? "")
  .split(",")
  .map((teamId) => teamId.trim())
  .filter(Boolean);

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
      description: "Full Clean Redraft V2: leerer Season-1 Startsave, chunked AI Picklauf bis playerOpt.",
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
    dryRun: DRY_RUN,
    confirmToken: DRY_RUN ? null : CHUNKED_REDRAFT_TOPUP_CONFIRM_TOKEN,
    mode: "full_clean_redraft",
    target: "playerOpt",
    roundLimit: Number.isFinite(ROUND_LIMIT) ? ROUND_LIMIT : 18,
    teamTimeLimitMs: Number.isFinite(TEAM_TIME_LIMIT_MS) ? TEAM_TIME_LIMIT_MS : 10_000,
    maxTeams: Number.isFinite(MAX_TEAMS) ? MAX_TEAMS : undefined,
    targetTeamIds: TARGET_TEAM_IDS.length > 0 ? TARGET_TEAM_IDS : undefined,
    watchdogMs: Number.isFinite(WATCHDOG_MS) ? WATCHDOG_MS : 30_000,
    reportMode: REPORT_MODE,
    outputDir: OUTPUT_DIR,
  });

  copyIfExists("chunked-redraft-summary.json", "full-clean-redraft-v2-summary.json");
  copyIfExists("chunked-redraft-summary.md", "full-clean-redraft-v2-summary.md");
  copyIfExists("chunked-redraft-picks.csv", "full-clean-redraft-v2-picks.csv");
  copyIfExists("chunked-redraft-team-status.csv", "full-clean-redraft-v2-team-status.csv");
  copyIfExists("redraft-pick-quality.csv", "full-clean-redraft-v2-pick-quality.csv");
  copyIfExists("chunked-redraft-warnings.csv", "full-clean-redraft-v2-warnings.csv");
  copyIfExists("chunked-redraft-memory.csv", "full-clean-redraft-v2-memory.csv");
  copyIfExists("chunked-redraft-summary.json", "draft1-green-summary.json");
  copyIfExists("chunked-redraft-summary.md", "draft1-green-summary.md");
  copyIfExists("chunked-redraft-team-status.csv", "draft1-team-status.csv");
  copyIfExists("chunked-redraft-picks.csv", "draft1-picks.csv");
  copyIfExists("redraft-pick-quality.csv", "draft1-pick-quality.csv");
  copyIfExists("chunked-redraft-phase-b-cash-audit.csv", "draft1-cash-audit.csv");
  copyIfExists("team-theme-composition-audit.csv", "draft1-theme-composition-audit.csv");
  copyIfExists("redraft-phase-timings.csv", "draft1-redraft-runner-timings.csv");

  const summary = readJson<typeof result.summary>(path.join(OUTPUT_DIR, "chunked-redraft-summary.json"));
  const finalSave = persistence.getSaveById(save.saveId);
  persistence.activateSave(save.saveId);

  const proofTitle = DRY_RUN && Number.isFinite(MAX_TEAMS) && MAX_TEAMS === 1 ? "First Pick Proof" : Number.isFinite(ROUND_LIMIT) && ROUND_LIMIT === 1 ? "One Round Proof" : "Draft 1 Green Proof";
  fs.writeFileSync(
    path.join(OUTPUT_DIR, DRY_RUN && Number.isFinite(MAX_TEAMS) && MAX_TEAMS === 1 ? "first-pick-proof.md" : Number.isFinite(ROUND_LIMIT) && ROUND_LIMIT === 1 ? "one-round-proof.md" : "draft1-green-proof.md"),
    [
      `# ${proofTitle}`,
      "",
      `- Dry run: ${DRY_RUN ? "ja" : "nein"}`,
      `- Max Teams: ${Number.isFinite(MAX_TEAMS) ? MAX_TEAMS : "alle"}`,
      `- Target Teams: ${TARGET_TEAM_IDS.length > 0 ? TARGET_TEAM_IDS.join(", ") : "alle"}`,
      `- Round Limit: ${Number.isFinite(ROUND_LIMIT) ? ROUND_LIMIT : 18}`,
      `- Watchdog: ${Number.isFinite(WATCHDOG_MS) ? WATCHDOG_MS : 30_000}ms`,
      `- Picks: ${summary.picksTotal}`,
      `- DRAFT_VALID: ${summary.draftValid ? "true" : "false"}`,
      `- Teams unter Min: ${summary.teamsBelowMin.length}`,
      `- Doppelte Spieler: ${summary.duplicatePlayers.length}`,
      `- Negative Cash Teams: ${summary.negativeCashTeams.length}`,
    ].join("\n"),
    "utf8",
  );
  copyIfExists("redraft-first-team-trace.json", DRY_RUN && Number.isFinite(MAX_TEAMS) && MAX_TEAMS === 1 ? "first-pick-trace.json" : "one-round-trace.json");
  copyIfExists("chunked-redraft-picks.csv", "one-round-picks.csv");
  copyIfExists("chunked-redraft-team-status.csv", "one-round-team-status.csv");

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
        dryRun: DRY_RUN,
        maxTeams: Number.isFinite(MAX_TEAMS) ? MAX_TEAMS : null,
        targetTeamIds: TARGET_TEAM_IDS,
      },
      null,
      2,
    ),
  );

  const firstPickProofPassed = DRY_RUN && Number.isFinite(MAX_TEAMS) && MAX_TEAMS === 1 && summary.picksTotal > 0 && summary.duplicatePlayers.length === 0;
  const oneRoundProofPassed =
    !DRY_RUN &&
    Number.isFinite(ROUND_LIMIT) &&
    ROUND_LIMIT === 1 &&
    summary.picksTotal > 0 &&
    summary.picksTotal <= 32 &&
    summary.duplicatePlayers.length === 0 &&
    summary.negativeCashTeams.length === 0;
  const targetTeamSet = new Set(TARGET_TEAM_IDS);
  const targetedProofPassed =
    TARGET_TEAM_IDS.length > 0 &&
    summary.picksTotal > 0 &&
    summary.duplicatePlayers.length === 0 &&
    summary.teamsBelowMin.filter((row) => targetTeamSet.has(row.teamId)).length === 0 &&
    summary.negativeCashTeams.filter((row) => targetTeamSet.has(row.teamId)).length === 0;

  if (!summary.draftValid && !firstPickProofPassed && !oneRoundProofPassed && !targetedProofPassed) {
    process.exitCode = 1;
  }
}

main();
