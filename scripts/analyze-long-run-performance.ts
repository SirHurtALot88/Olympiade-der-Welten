/**
 * Analyze long-run phase timings, write report, sync perf observations.
 *
 * Usage:
 *   tsx scripts/analyze-long-run-performance.ts --output-dir outputs/long-run-fresh-s10-...
 */

import {
  analyzeLongRunPerformance,
  syncPerformanceObservations,
  writeLongRunPerformanceReport,
} from "@/lib/season/long-run-performance-analysis";

function argValue(name: string) {
  const prefix = `${name}=`;
  const inline = process.argv.find((entry) => entry.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(name);
  if (index >= 0) return process.argv[index + 1] ?? null;
  return null;
}

function main() {
  const outputDir = argValue("--output-dir");
  if (!outputDir) throw new Error("Missing --output-dir");

  const analysis = analyzeLongRunPerformance(outputDir);
  const reportPath = writeLongRunPerformanceReport(outputDir, analysis);
  const logged = syncPerformanceObservations(outputDir, analysis);

  console.log(`Wrote ${reportPath}`);
  console.log(`Slow phases: ${analysis.slowFindings.length} · New observation entries: ${logged}`);
  if (analysis.topSlowPhases[0]) {
    const top = analysis.topSlowPhases[0];
    console.log(`Top: ${top.seasonId} · ${top.phase} · ${Math.round(top.durationMs / 1000)}s (${top.ratio.toFixed(1)}× budget)`);
  }
}

main();
