/**
 * Bounded retry wrapper around the Season-1 draft bootstrap in long-run-sandbox-s1-s6.ts.
 *
 * The S1 draft (season1_optimum_execute via runAiPicksExecutePreview) is an all-or-nothing preview
 * gate: a single team's blocking reason (e.g. overspend_without_need vs. season1_spend_floor_missed
 * catch-22 for certain archetypes like "small_elite_top") zeroes out applied picks for the WHOLE
 * league (applied=0, N blockers), even though a different random seed usually clears it. This wrapper
 * retries with a fresh save/seed up to `--attempts` times and logs one compact line per attempt to
 * `--log-file` instead of flooding the console, so callers don't need to hand-retry from the shell.
 *
 * Usage:
 *   node --import tsx scripts/fresh-s1-draft-retry.ts \
 *     --attempts 8 \
 *     --log-file outputs/<run-dir>/s1-draft-retry-log.md \
 *     [--salary-factor-pattern "1.18,1.15,0.85,0.85,0.88"]
 *
 * On success, prints `SAVE_ID=<id>` on stdout (last line) and exits 0.
 * On exhausting all attempts, exits 1 (caller should then consider the code-level fix in
 * lib/ai/ai-picks-run-service.ts described in the log, rather than retrying forever).
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const PROJECT_ROOT = path.resolve(__dirname, "..");

function argValue(flag: string): string | null {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || idx + 1 >= process.argv.length) return null;
  return process.argv[idx + 1];
}

function nowIso() {
  return new Date().toISOString();
}

function appendLog(logFile: string, line: string) {
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  fs.appendFileSync(logFile, `${line}\n`);
}

async function main() {
  const attempts = Math.max(1, Number(argValue("--attempts") ?? "8"));
  const logFile = argValue("--log-file") ?? path.join(PROJECT_ROOT, "outputs", "s1-draft-retry-log.md");
  const salaryPattern = argValue("--salary-factor-pattern");

  if (!fs.existsSync(logFile)) {
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    fs.writeFileSync(logFile, `# S1 Draft Retry Log\n\n_Started ${nowIso()}_\n\n| # | Zeit | Save-ID | Applied | Blocker | Ergebnis |\n|---|---|---|---:|---:|---|\n`);
  }

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const env = {
      ...process.env,
      OLY_UNIFIED_PICK: "1",
      NODE_OPTIONS: process.env.NODE_OPTIONS?.includes("max-old-space-size")
        ? process.env.NODE_OPTIONS
        : "--max-old-space-size=8192",
    };
    delete env.OLY_LONG_RUN_ALLOW_DEV_SERVER;
    delete env.OLY_LONG_RUN_REQUIRE_NO_DEV_SERVER;

    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", path.join(PROJECT_ROOT, "scripts", "long-run-sandbox-s1-s6.ts")],
      { cwd: PROJECT_ROOT, encoding: "utf8", env },
    );
    const log = `${result.stdout ?? ""}${result.stderr ?? ""}`;
    const saveId = log.match(/fresh-season-1-\d+/)?.[0] ?? "unknown";
    const applied = Number(log.match(/applied=(\d+)/)?.[1] ?? "0");
    const blockerCount = Number(log.match(/blockers=(\d+)/)?.[1] ?? "0");
    const success = applied > 0;

    appendLog(
      logFile,
      `| ${attempt} | ${nowIso()} | \`${saveId}\` | ${applied} | ${blockerCount} | ${success ? "✅ SUCCESS" : "❌ applied=0"} |`,
    );

    if (success) {
      if (salaryPattern) {
        const reseed = spawnSync(
          process.execPath,
          [
            "--import",
            "tsx",
            "-e",
            `
            import { createPersistenceService } from '@/lib/persistence/persistence-service';
            import { getSeasonEconomyFactorWindow } from '@/lib/season/season-economy-factors';
            const persistence = createPersistenceService();
            const save = persistence.getSaveById(process.env.OLY_DRAFT_RETRY_SAVE_ID);
            const pattern = process.env.OLY_DRAFT_RETRY_PATTERN.split(',').map(Number);
            const window = getSeasonEconomyFactorWindow({
              saveId: save.saveId,
              seasonId: 'season-1',
              seasonState: { seasonEconomyFactors: [] },
              sheetFactors: pattern.map((factor) => ({ seasonLabel: '', factor })),
            });
            persistence.saveSingleplayerState(save.saveId, {
              ...save.gameState,
              seasonState: { ...save.gameState.seasonState, seasonEconomyFactors: window },
            });
            console.log('reseeded', save.saveId);
            `,
          ],
          {
            cwd: PROJECT_ROOT,
            encoding: "utf8",
            env: { ...env, OLY_DRAFT_RETRY_SAVE_ID: saveId, OLY_DRAFT_RETRY_PATTERN: salaryPattern },
          },
        );
        appendLog(logFile, `  - Salary-Factor-Pattern reseeded: ${reseed.stdout?.trim() || reseed.stderr?.trim()}`);
      }
      appendLog(logFile, `\n**SUCCESS** nach ${attempt} Versuch(en): \`${saveId}\`\n`);
      console.log(`SAVE_ID=${saveId}`);
      process.exitCode = 0;
      return;
    }
  }

  appendLog(
    logFile,
    `\n**FAILED** nach ${attempts} Versuchen — kein Draft ohne applied=0/N-blockers gefunden. ` +
      `Das deutet auf einen reproduzierbaren Bug hin (siehe overspend_without_need vs. ` +
      `season1_spend_floor_missed Catch-22 in lib/ai/ai-picks-run-service.ts), nicht nur Seed-Flakiness. ` +
      `Naechster Schritt: Code-Fix statt weiterer Retries.\n`,
  );
  console.error(`No successful S1 draft after ${attempts} attempts. See ${logFile}`);
  process.exitCode = 1;
}

main();
