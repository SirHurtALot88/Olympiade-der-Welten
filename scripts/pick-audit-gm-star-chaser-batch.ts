import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const PROJECT_ROOT = path.resolve(__dirname, "..");
const OUTPUT_ROOT = path.join(PROJECT_ROOT, "outputs", "pick-audit-loop", "gm-star-chaser-batch");
const CLONE_FROM = process.env.OLY_PICK_AUDIT_CLONE_FROM ?? "fresh-season-1-1782726659026";
const GM_OVERRIDE = process.env.OLY_PICK_AUDIT_GM_OVERRIDE ?? "C-S:star_chaser,G-G:star_chaser";
const RUN_COUNT = Number(process.env.OLY_PICK_AUDIT_BATCH_RUNS ?? "5");
const PASSES = process.env.OLY_PICK_AUDIT_PASSES ?? "5";
const ROUNDS = process.env.OLY_PICK_AUDIT_ROUNDS ?? "5";

type Kpi = Record<string, unknown>;

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function avg(values: number[]) {
  if (values.length === 0) return null;
  return round(values.reduce((sum, value) => sum + value, 0) / values.length, 2);
}

async function main() {
  await mkdir(OUTPUT_ROOT, { recursive: true });
  const runSummaries: Array<Record<string, unknown>> = [];

  for (let index = 1; index <= RUN_COUNT; index += 1) {
    const outputDir = path.join(OUTPUT_ROOT, `run-${index}`);
    const runLabel = `gm-sc-${index}`;
    console.error(`[gm-star-chaser-batch] Starting ${runLabel} → ${outputDir}`);
    execFileSync(
      process.execPath,
      ["--import", "tsx", path.join(PROJECT_ROOT, "scripts", "pick-audit-preseason-fast.ts")],
      {
        cwd: PROJECT_ROOT,
        stdio: "inherit",
        env: {
          ...process.env,
          OLY_PICK_AUDIT_CLONE_FROM: CLONE_FROM,
          OLY_PICK_AUDIT_OUTPUT_DIR: outputDir,
          OLY_PICK_AUDIT_RUN_LABEL: runLabel,
          OLY_PICK_AUDIT_PASSES: PASSES,
          OLY_PICK_AUDIT_ROUNDS: ROUNDS,
          OLY_PICK_AUDIT_GM_OVERRIDE: GM_OVERRIDE,
        },
      },
    );
    const kpi = JSON.parse(await readFile(path.join(outputDir, "pick-audit-kpi.json"), "utf8")) as Kpi;
    runSummaries.push({
      runLabel,
      outputDir,
      teamsAtOpt: kpi.teamsAtOpt,
      hoardersAfter: kpi.hoardersAfter,
      avgPickMw: kpi.avgPickMw,
      csMaxPick: kpi.csMaxPick,
      ggMaxPick: kpi.ggMaxPick,
      spotIdentityQuality: kpi.spotIdentityQuality,
    });
  }

  const teamsAtOpt = runSummaries.map((row) => Number(row.teamsAtOpt)).filter(Number.isFinite);
  const hoarders = runSummaries.map((row) => Number(row.hoardersAfter)).filter(Number.isFinite);
  const avgPickMw = runSummaries.map((row) => Number(row.avgPickMw)).filter(Number.isFinite);
  const csMax = runSummaries.map((row) => Number(row.csMaxPick)).filter(Number.isFinite);
  const ggMax = runSummaries.map((row) => Number(row.ggMaxPick)).filter(Number.isFinite);

  const ggPrimaryShare = runSummaries
    .map((row) => Number((row.spotIdentityQuality as Record<string, unknown>)?.["G-G"]?.themePrimaryShareAfter))
    .filter(Number.isFinite);
  const csPrimaryShare = runSummaries
    .map((row) => Number((row.spotIdentityQuality as Record<string, unknown>)?.["C-S"]?.themePrimaryShareAfter))
    .filter(Number.isFinite);
  const ggPrimaryPickMatches = runSummaries
    .map((row) => Number((row.spotIdentityQuality as Record<string, unknown>)?.["G-G"]?.primaryThemePickMatches))
    .filter(Number.isFinite);

  const aggregate = {
    gmOverride: GM_OVERRIDE,
    cloneFrom: CLONE_FROM,
    runCount: RUN_COUNT,
    teamsAtOpt: { min: Math.min(...teamsAtOpt), max: Math.max(...teamsAtOpt), avg: avg(teamsAtOpt) },
    hoardersAfter: { min: Math.min(...hoarders), max: Math.max(...hoarders), avg: avg(hoarders) },
    avgPickMw: { min: Math.min(...avgPickMw), max: Math.max(...avgPickMw), avg: avg(avgPickMw) },
    csMaxPick: { min: Math.min(...csMax), max: Math.max(...csMax), avg: avg(csMax) },
    ggMaxPick: { min: Math.min(...ggMax), max: Math.max(...ggMax), avg: avg(ggMax) },
    ggThemePrimaryShareAfter: { min: Math.min(...ggPrimaryShare), max: Math.max(...ggPrimaryShare), avg: avg(ggPrimaryShare) },
    csThemePrimaryShareAfter: { min: Math.min(...csPrimaryShare), max: Math.max(...csPrimaryShare), avg: avg(csPrimaryShare) },
    ggPrimaryThemePickMatchesAvg: avg(ggPrimaryPickMatches),
    runs: runSummaries,
  };

  const md = [
    "# GM Star-Chaser Batch Audit",
    "",
    `- GM override: \`${GM_OVERRIDE}\``,
    `- Runs: ${RUN_COUNT} × ${PASSES} passes × ${ROUNDS} rounds`,
    `- Clone: \`${CLONE_FROM}\``,
    "",
    "## Aggregate",
    "",
    `| KPI | min | avg | max |`,
    `| --- | --- | --- | --- |`,
    `| Teams ≥ Opt | ${aggregate.teamsAtOpt.min} | ${aggregate.teamsAtOpt.avg} | ${aggregate.teamsAtOpt.max} |`,
    `| Hoarders | ${aggregate.hoardersAfter.min} | ${aggregate.hoardersAfter.avg} | ${aggregate.hoardersAfter.max} |`,
    `| avg pick MW | ${aggregate.avgPickMw.min} | ${aggregate.avgPickMw.avg} | ${aggregate.avgPickMw.max} |`,
    `| C-S max pick | ${aggregate.csMaxPick.min} | ${aggregate.csMaxPick.avg} | ${aggregate.csMaxPick.max} |`,
    `| G-G max pick | ${aggregate.ggMaxPick.min} | ${aggregate.ggMaxPick.avg} | ${aggregate.ggMaxPick.max} |`,
    `| G-G theme share after | ${aggregate.ggThemePrimaryShareAfter.min} | ${aggregate.ggThemePrimaryShareAfter.avg} | ${aggregate.ggThemePrimaryShareAfter.max} |`,
    `| C-S theme share after | ${aggregate.csThemePrimaryShareAfter.min} | ${aggregate.csThemePrimaryShareAfter.avg} | ${aggregate.csThemePrimaryShareAfter.max} |`,
    `| G-G primary-theme pick matches (avg/run) | ${aggregate.ggPrimaryThemePickMatchesAvg ?? "n/a"} | | |`,
    "",
    "## Per Run",
    "",
    ...runSummaries.map((row) => {
      const gg = (row.spotIdentityQuality as Record<string, Record<string, unknown>>)?.["G-G"];
      const cs = (row.spotIdentityQuality as Record<string, Record<string, unknown>>)?.["C-S"];
      return `- **${row.runLabel}**: opt ${row.teamsAtOpt}/32 | hoard ${row.hoardersAfter} | C-S max ${row.csMaxPick} | G-G max ${row.ggMaxPick} | G-G theme ${gg?.themePrimaryShareAfter}/${gg?.themeTargetShare} | G-G primary picks ${gg?.primaryThemePickMatches}/${gg?.buyCount}`;
    }),
  ].join("\n");

  await writeFile(path.join(OUTPUT_ROOT, "batch-kpi.json"), `${JSON.stringify(aggregate, null, 2)}\n`);
  await writeFile(path.join(OUTPUT_ROOT, "batch-summary.md"), `${md}\n`);
  console.log(JSON.stringify(aggregate, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
