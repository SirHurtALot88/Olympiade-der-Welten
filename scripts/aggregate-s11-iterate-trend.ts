/**
 * Aggregate metrics from all iterate iterations into trend.md + trend.csv
 *
 * Usage:
 *   npx tsx scripts/aggregate-s11-iterate-trend.ts
 */
import fs from "node:fs";
import path from "node:path";

import { iterDir, PROJECT_ROOT, S10_BASELINE, type IterateMetrics } from "@/scripts/s11-iterate-shared";

function argValue(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function loadAllMetrics(outputDir: string): IterateMetrics[] {
  const results: IterateMetrics[] = [];
  for (let i = 1; i <= 10; i++) {
    const filePath = path.join(iterDir(outputDir, i), "metrics.json");
    if (!fs.existsSync(filePath)) continue;
    results.push(JSON.parse(fs.readFileSync(filePath, "utf8")) as IterateMetrics);
  }
  return results.sort((a, b) => a.iteration - b.iteration);
}

function main() {
  const outputDir = path.resolve(PROJECT_ROOT, argValue("--output-dir") ?? "outputs/s11-iterate-10x");
  const metrics = loadAllMetrics(outputDir);

  if (metrics.length === 0) {
    throw new Error(`No iteration metrics found in ${outputDir}`);
  }

  const keys: Array<{ key: keyof IterateMetrics; label: string; suffix?: string }> = [
    { key: "atOpt", label: "Teams >= Opt" },
    { key: "emergencyPct", label: "Emergency-Filler %", suffix: "%" },
    { key: "plannedPct", label: "Planned %", suffix: "%" },
    { key: "marketBuys", label: "Market Buys" },
    { key: "seasonEndSells", label: "S10 season_end Sells" },
    { key: "convergenceBuys", label: "Convergence Buys" },
    { key: "hoardingProxy", label: "Cash-Hoarding Proxy" },
    { key: "trashEstimatePct", label: "Trash Estimate %", suffix: "%" },
    { key: "sensibleEstimatePct", label: "Sensible Estimate %", suffix: "%" },
    { key: "top8TrashPct", label: "Top-8 Trash %", suffix: "%" },
    { key: "teamsBelowHardMin", label: "Teams below hardMin" },
    { key: "cashUnderOptHighCash", label: "Under Opt + Cash>30" },
    { key: "zeroBuyTeamsUnderOpt", label: "Under Opt + 0 buys" },
  ];

  const header = ["Metric", "S10 Baseline", ...metrics.map((m) => `Iter ${m.iteration}`)];
  const csvRows = [header.join(";")];

  const mdLines = [
    "# S11 Iterate 10x — Trend",
    "",
    `**Iterations recorded:** ${metrics.length}`,
    `**Generated:** ${new Date().toISOString()}`,
    "",
    "| Metric | S10 | " + metrics.map((m) => `Iter ${m.iteration}`).join(" | ") + " | Best |",
    "|---|---:|" + metrics.map(() => "---:").join("|") + "|---:|",
  ];

  for (const { key, label, suffix } of keys) {
    const baseline =
      key === "atOpt"
        ? S10_BASELINE.atOpt
        : key === "emergencyPct"
          ? S10_BASELINE.emergencyPct
          : key === "marketBuys"
            ? S10_BASELINE.marketBuys
            : "—";

    const values = metrics.map((m) => {
      const v = m[key];
      if (v == null || typeof v === "object") return "—";
      return String(v);
    });

    const numeric = values.filter((v) => v !== "—").map(Number);
    const best =
      key === "emergencyPct" || key === "trashEstimatePct" || key === "top8TrashPct" || key === "hoardingProxy"
        ? numeric.length ? Math.min(...numeric) : "—"
        : key === "atOpt" || key === "sensibleEstimatePct" || key === "marketBuys"
          ? numeric.length
            ? Math.max(...numeric)
            : "—"
          : "—";

    mdLines.push(`| ${label} | ${baseline} | ${values.join(" | ")} | ${best}${suffix ?? ""} |`);
    csvRows.push([label, String(baseline), ...values].join(";"));
  }

  const regressions: string[] = [];
  for (let i = 1; i < metrics.length; i++) {
    const prev = metrics[i - 1];
    const cur = metrics[i];
    if (cur.atOpt < prev.atOpt - 2) regressions.push(`Iter ${cur.iteration}: Opt ${prev.atOpt} → ${cur.atOpt}`);
    if (cur.emergencyPct > prev.emergencyPct + 5) {
      regressions.push(`Iter ${cur.iteration}: Emergency ${prev.emergencyPct}% → ${cur.emergencyPct}%`);
    }
  }

  if (regressions.length > 0) {
    mdLines.push("", "## Regressions", "", ...regressions.map((r) => `- ${r}`));
  }

  const bestOpt = Math.max(...metrics.map((m) => m.atOpt));
  const bestEmergency = Math.min(...metrics.map((m) => m.emergencyPct));
  const bestIter = metrics.find((m) => m.atOpt === bestOpt && m.emergencyPct === bestEmergency) ?? metrics.at(-1);

  mdLines.push(
    "",
    "## Best Iteration",
    "",
    `**Iter ${bestIter?.iteration}:** Opt ${bestIter?.atOpt}/32, Emergency ${bestIter?.emergencyPct}%, Buys ${bestIter?.marketBuys}, Hoarding ${bestIter?.hoardingProxy}`,
    "",
  );

  fs.writeFileSync(path.join(outputDir, "trend.md"), mdLines.join("\n"));
  fs.writeFileSync(path.join(outputDir, "trend.csv"), csvRows.join("\n") + "\n");

  console.log(JSON.stringify({ iterations: metrics.length, bestIter: bestIter?.iteration, trendPath: path.join(outputDir, "trend.md") }, null, 2));
}

main();
