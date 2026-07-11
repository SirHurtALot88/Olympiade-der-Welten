/**
 * S1→S2 transfer from fixed post-draft save — skips S1 draft, runs sell/buy only.
 *
 * Usage:
 *   node --import tsx scripts/run-s1-s2-transfer-from-save.ts --after-draft-only
 *   node --import tsx scripts/run-s1-s2-transfer-from-save.ts --save-db path/to/balancing-run.sqlite
 */
import fs from "node:fs";
import path from "node:path";

import { loadEnvConfig } from "@next/env";

import { readSaveDbSnapshot } from "@/lib/persistence/overwrite-save-from-source-db";
import Database from "better-sqlite3";

import {
  DEFAULT_BASELINE_SAVE_DB,
  FALLBACK_BASELINE_SAVE_DB,
  buildTransferReport,
  cloneSourceDatabase,
  collectTeamRows,
  countDraftBuys,
  log,
  resolvePersistenceFromEnv,
  round,
  runTransferPipeline,
  setAllTeamsAi,
  type TransferRunResult,
} from "./s1-s2-transfer-shared";

function argValue(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function hasFlag(flag: string) {
  return process.argv.includes(flag);
}

async function main() {
  loadEnvConfig(path.resolve(__dirname, ".."));
  const afterDraftOnly = hasFlag("--after-draft-only") || hasFlag("--skip-draft");
  if (!afterDraftOnly) {
    throw new Error("Requires --after-draft-only (or --skip-draft).");
  }

  const saveDbArg = argValue("--save-db");
  const saveDb =
    saveDbArg ??
    (fs.existsSync(DEFAULT_BASELINE_SAVE_DB) ? DEFAULT_BASELINE_SAVE_DB : FALLBACK_BASELINE_SAVE_DB);
  if (!fs.existsSync(saveDb)) {
    throw new Error(`Source DB not found: ${saveDb}`);
  }

  const rankShuffle = Number(argValue("--rank-shuffle") ?? "2");
  const seed = Number(argValue("--seed") ?? "42");
  const runs = Math.max(1, Number(argValue("--runs") ?? "1"));

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const rootOutput = path.join(path.resolve(__dirname, ".."), "outputs", `s1-s2-transfer-from-save-${timestamp}`);
  fs.mkdirSync(rootOutput, { recursive: true });

  log(`Source DB → ${saveDb}`);
  log(`Output → ${rootOutput}`);

  const sourceDb = new Database(saveDb, { readonly: true });
  const sourceSaveId =
    (sourceDb.prepare("SELECT save_id FROM saves ORDER BY updated_at DESC LIMIT 1").get() as { save_id: string } | undefined)
      ?.save_id ?? null;
  sourceDb.close();
  if (!sourceSaveId) throw new Error(`No save found in ${saveDb}`);

  const sourceSnapshot = (() => {
    const db = new Database(saveDb, { readonly: true });
    try {
      return readSaveDbSnapshot(db, sourceSaveId);
    } finally {
      db.close();
    }
  })();
  if (!sourceSnapshot || sourceSnapshot.seasonId !== "season-1") {
    throw new Error(
      `Expected post-draft season-1 save in source DB, got season=${sourceSnapshot?.seasonId ?? "missing"} rosters=${sourceSnapshot?.rosterCount ?? 0}`,
    );
  }

  const results: TransferRunResult[] = [];
  for (let runIndex = 1; runIndex <= runs; runIndex += 1) {
    const label = `Run ${runIndex}`;
    const outputDir = path.join(rootOutput, `run${runIndex}-${timestamp}`);
    delete process.env.OLY_APP_SQLITE_PATH;
    const sqlitePath = cloneSourceDatabase(saveDb, outputDir);
    log(`${label}: cloned DB → ${sqlitePath}`);

    const persistence = resolvePersistenceFromEnv();
    let save = persistence.getSaveById(sourceSaveId);
    if (!save) {
      const saves = persistence.listSaves();
      save = persistence.getSaveById(saves.find((entry) => entry.saveId === sourceSaveId)?.saveId ?? saves[0]?.saveId ?? "");
    }
    if (!save) throw new Error(`${label}: save missing after clone`);

    save = setAllTeamsAi(save, persistence);
    const draftRows = collectTeamRows(save.gameState);
    const draftMeta = {
      picks: countDraftBuys(save.gameState),
      teamsAtMin: draftRows.filter((row) => row.atMin).length,
      teamsAtOpt: draftRows.filter((row) => row.atOpt).length,
      avgCash: round(draftRows.reduce((sum, row) => sum + row.cash, 0) / Math.max(1, draftRows.length)),
      blockers: [],
    };

    const result = await runTransferPipeline({
      label,
      save,
      persistence,
      outputDir,
      sqlitePath,
      startedAt: Date.now(),
      bootstrapOpts: { rankShuffle, seed: seed + runIndex - 1 },
      draftMeta,
      logTag: "s1-s2-from-save",
    });
    results.push(result);
  }

  const report = buildTransferReport(
    results,
    "S1→S2 Transfer from-save",
    "Baseline: fester S1-Draft-Save → Sponsor/Preisgeld-Preview → Fast `season_completed` → S1-Sell → S2-Buy. Single-Cash S2+ (10% MW Puffer).",
  );
  fs.writeFileSync(path.join(rootOutput, "report.md"), report);
  fs.writeFileSync(
    path.join(rootOutput, "transfer-summary.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        sourceDb: saveDb,
        runCount: results.length,
        allHardGreen: results.every((row) => row.hardFails.length === 0),
        runs: results.map((row) => ({
          label: row.label,
          saveId: row.saveId,
          hardFails: row.hardFails,
          economy: row.economy,
          afterPreseason: {
            totalBuys: row.afterPreseason.totalBuys,
            teamsAtMin: row.afterPreseason.teamsAtMin,
            teamsAtOpt: row.afterPreseason.teamsAtOpt,
            avgCash: row.afterPreseason.avgCash,
          },
        })),
      },
      null,
      2,
    ),
  );

  log(`Done → ${rootOutput}`);
  if (results.some((row) => row.hardFails.length > 0)) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
