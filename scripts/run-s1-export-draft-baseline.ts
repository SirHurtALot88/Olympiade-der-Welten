/**
 * One-time: run S1 draft and export isolated DB as reusable baseline for from-save runs.
 */
import fs from "node:fs";
import path from "node:path";

import { loadEnvConfig } from "@next/env";

import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { SEASON_START_RESET_CONFIRM_TOKEN } from "@/lib/persistence/season-start-reset-contract";
import { runSeasonStartReset } from "@/lib/persistence/season-start-reset-service";
import {
  finalizeSeasonOneBootstrapPhase,
  finalizeSeasonOneDraftAuditReady,
  runCanonicalSeasonOneBootstrap,
} from "@/lib/season/long-run-canonical";
import { ensureIsolatedLongRunDatabase } from "@/lib/season/long-run-db-isolation";

import { PROJECT_ROOT, collectTeamRows, countDraftBuys, log, round, setAllTeamsAi } from "./s1-s2-transfer-shared";

async function main() {
  loadEnvConfig(PROJECT_ROOT);
  const outputDir = path.join(PROJECT_ROOT, "outputs", "s1-draft-baseline-export");
  fs.mkdirSync(outputDir, { recursive: true });
  delete process.env.OLY_APP_SQLITE_PATH;
  const isolation = ensureIsolatedLongRunDatabase({ outputDir, projectRoot: PROJECT_ROOT });
  const persistence = createPersistenceService();

  const created = persistence.createFreshSeasonOneSave({ name: "S1 draft baseline export" });
  const reset = await runSeasonStartReset({
    source: "sqlite",
    saveId: created.saveId,
    seasonId: created.gameState.season.id,
    dryRun: false,
    confirmToken: SEASON_START_RESET_CONFIRM_TOKEN,
  });
  if (reset.status !== "applied") throw new Error(reset.blockingReasons.join(" | "));

  let save = persistence.getSaveById(created.saveId) ?? created;
  save = setAllTeamsAi(save, persistence);
  const bootstrap = await runCanonicalSeasonOneBootstrap(save, persistence);
  if (bootstrap.blockers.length > 0) throw new Error(bootstrap.blockers.join(" | "));
  save = finalizeSeasonOneDraftAuditReady(bootstrap.save, persistence);
  save = finalizeSeasonOneBootstrapPhase(save, persistence).save;

  const rows = collectTeamRows(save.gameState);
  const baselinePath = path.join(PROJECT_ROOT, "outputs/s1-draft-baseline.sqlite");
  fs.copyFileSync(isolation.sqlitePath, baselinePath);
  for (const suffix of ["-wal", "-shm"]) {
    const sidecar = `${isolation.sqlitePath}${suffix}`;
    if (fs.existsSync(sidecar)) fs.copyFileSync(sidecar, `${baselinePath}${suffix}`);
  }

  const meta = {
    saveId: save.saveId,
    picks: countDraftBuys(save.gameState),
    teamsAtMin: rows.filter((row) => row.atMin).length,
    teamsAtOpt: rows.filter((row) => row.atOpt).length,
    avgCash: round(rows.reduce((sum, row) => sum + row.cash, 0) / Math.max(1, rows.length)),
    exportedAt: new Date().toISOString(),
    sqlitePath: baselinePath,
  };
  fs.writeFileSync(path.join(PROJECT_ROOT, "outputs/s1-draft-baseline.json"), JSON.stringify(meta, null, 2));
  log(`Draft baseline → ${baselinePath} (${meta.picks} picks, min ${meta.teamsAtMin}/32)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
