/**
 * Build REVIEW_PROMPT.md for Sonnet reviewer after an iterate iteration.
 *
 * Usage:
 *   npx tsx scripts/build-s11-reviewer-brief.ts --iteration 1
 */
import fs from "node:fs";
import path from "node:path";

import {
  iterDir,
  PROJECT_ROOT,
  S10_BASELINE,
  type IterateMetrics,
} from "@/scripts/s11-iterate-shared";

function argValue(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function loadMetrics(outputDir: string, iteration: number): IterateMetrics | null {
  const filePath = path.join(iterDir(outputDir, iteration), "metrics.json");
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as IterateMetrics;
}

function delta(a: number, b: number | undefined, suffix = "") {
  if (b == null) return "—";
  const d = a - b;
  return `${d >= 0 ? "+" : ""}${d}${suffix}`;
}

function main() {
  const iteration = Number(argValue("--iteration") ?? "1");
  const outputDir = path.resolve(PROJECT_ROOT, argValue("--output-dir") ?? "outputs/s11-iterate-10x");
  const outIter = iterDir(outputDir, iteration);

  const current = loadMetrics(outputDir, iteration);
  if (!current) {
    throw new Error(`No metrics for iteration ${iteration} at ${outIter}`);
  }
  const previous = iteration > 1 ? loadMetrics(outputDir, iteration - 1) : null;

  const regressionFlags: string[] = [];
  if (previous) {
    if (current.atOpt < previous.atOpt - 2) regressionFlags.push(`Opt dropped ${previous.atOpt} → ${current.atOpt}`);
    if (current.emergencyPct > previous.emergencyPct + 5) {
      regressionFlags.push(`Emergency rose ${previous.emergencyPct}% → ${current.emergencyPct}%`);
    }
    if (current.hoardingProxy > previous.hoardingProxy + 3) {
      regressionFlags.push(`Hoarding rose ${previous.hoardingProxy} → ${current.hoardingProxy}`);
    }
  }

  const lines = [
    `# S11 Iterate Review · Iteration ${iteration}`,
    "",
    "## Metrics",
    "",
    "| Metric | S10 Baseline | Previous | Current | Δ vs Prev | Δ vs S10 |",
    "|---|---:|---:|---:|---:|---:|",
    `| Teams ≥ Opt | ${S10_BASELINE.atOpt}/32 | ${previous?.atOpt ?? "—"}/32 | **${current.atOpt}/32** | ${previous ? delta(current.atOpt, previous.atOpt) : "—"} | ${delta(current.atOpt, S10_BASELINE.atOpt)} |`,
    `| Emergency-Filler % | ${S10_BASELINE.emergencyPct}% | ${previous?.emergencyPct ?? "—"}% | **${current.emergencyPct}%** | ${previous ? delta(current.emergencyPct, previous.emergencyPct, " pp") : "—"} | ${delta(current.emergencyPct, S10_BASELINE.emergencyPct, " pp")} |`,
    `| Market Buys | ${S10_BASELINE.marketBuys} | ${previous?.marketBuys ?? "—"} | **${current.marketBuys}** | ${previous ? delta(current.marketBuys, previous.marketBuys) : "—"} | ${delta(current.marketBuys, S10_BASELINE.marketBuys)} |`,
    `| Cash-Hoarding Proxy | — | ${previous?.hoardingProxy ?? "—"} | **${current.hoardingProxy}** | ${previous ? delta(current.hoardingProxy, previous.hoardingProxy) : "—"} | — |`,
    `| Trash Estimate % | — | ${previous?.trashEstimatePct ?? "—"}% | **${current.trashEstimatePct}%** | ${previous ? delta(current.trashEstimatePct, previous.trashEstimatePct, " pp") : "—"} | — |`,
    `| Sensible Estimate % | — | ${previous?.sensibleEstimatePct ?? "—"}% | **${current.sensibleEstimatePct}%** | ${previous ? delta(current.sensibleEstimatePct, previous.sensibleEstimatePct, " pp") : "—"} | — |`,
    `| Top-8 Trash % | — | ${previous?.top8TrashPct ?? "—"}% | **${current.top8TrashPct}%** | — | — |`,
    `| S10 season_end sells | — | ${previous?.seasonEndSells ?? "—"} | **${current.seasonEndSells}** | — | — |`,
    `| Convergence buys | — | ${previous?.convergenceBuys ?? "—"} | **${current.convergenceBuys}** | — | — |`,
    `| Teams below hardMin | — | ${previous?.teamsBelowHardMin ?? "—"} | **${current.teamsBelowHardMin}** | — | — |`,
    `| Min roster team | — | — | **${current.minRosterTeam ? `${current.minRosterTeam.teamCode} (${current.minRosterTeam.roster})` : "—"}** | — | — |`,
    `| Under Opt + Cash>30 | — | ${previous?.cashUnderOptHighCash ?? "—"} | **${current.cashUnderOptHighCash}** | — | — |`,
    `| Under Opt + 0 buys | — | ${previous?.zeroBuyTeamsUnderOpt ?? "—"} | **${current.zeroBuyTeamsUnderOpt}** | — | — |`,
    "",
  ];

  if (regressionFlags.length > 0) {
    lines.push("## Regression Flags", "", ...regressionFlags.map((flag) => `- **${flag}**`), "");
  }

  lines.push(
    "## Code Hotspots (prioritized)",
    "",
    "1. `lib/ai/ai-market-plan-convergence-service.ts` — Opt convergence, emergency scope",
    "2. `lib/ai/ai-market-plan-apply-service.ts` — sell execution, preflight sellLimit",
    "3. `lib/ai/planner-opt-buy-policy.ts` — planned vs emergency at Opt",
    "4. `lib/ai/chunked-redraft-topup-service.ts` — reserve lane vs emergency fallback",
    "5. `lib/ai/ai-team-cash-reserve-service.ts` — buffer 0 below Opt, transfer bucket",
    "6. `lib/ai/unified-pick-planner-service.ts` — lane/bracket selection",
    "",
    "## Constraints (DO NOT violate)",
    "",
    "- NO sell caps (`SEASON_END_BELOW_OPT_QUALITY_SELL_CAP` forbidden)",
    "- Planned buys above Opt ALLOWED (depth/injury buffer)",
    "- Emergency/trash filler BLOCKED at/above Opt",
    "- Cash reserve = 0 until Opt; then 0.25–0.70× salary OK",
    "- Transfer bucket enforced for market buys",
    "- Max **1–2 focused fixes** this iteration",
    "",
    "## Acceptance for Iteration " + (iteration + 1),
    "",
    "- Opt ≥ " + Math.min(28, current.atOpt + 2) + "/32 OR clear improvement vs this run",
    "- Emergency ≤ " + Math.max(15, current.emergencyPct - 3) + "% OR decreasing trend",
    "- Hoarding proxy ≤ " + Math.max(0, current.hoardingProxy - 2),
    "- No team below hardMin unless sell wave edge case (min roster ≥ hardMin after buys)",
    "",
    "## Artifacts",
    "",
    `- checkpoint: \`${outIter}/checkpoint.md\``,
    `- transfers: \`${outIter}/transfers-season-11.csv\``,
    "",
    "## Task for Reviewer",
    "",
    "Write `reviewer-plan.md` in this folder with:",
    "1. Root cause hypothesis (1 paragraph)",
    "2. Fix 1 (file + change, expected metric impact)",
    "3. Fix 2 (optional, only if high confidence)",
    "4. Tests to run",
    "",
  );

  const reviewPath = path.join(outIter, "REVIEW_PROMPT.md");
  fs.writeFileSync(reviewPath, lines.join("\n"));
  console.log(JSON.stringify({ iteration, reviewPath }, null, 2));
}

main();
