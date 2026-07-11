import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  analyzeLongRunPerformance,
  PHASE_BUDGET_MS,
  renderLongRunPerformanceMarkdown,
  type PerformanceRow,
} from "@/lib/season/long-run-performance-analysis";

describe("long-run-performance-analysis", () => {
  it("flags planner convergence over budget", () => {
    const analysis = analyzeLongRunPerformanceFromRows([
      {
        seasonId: "season-2",
        phase: "season start planner convergence",
        durationMs: 1_665_833,
        status: "ok",
        note: "passes:3|rounds:79",
      },
      {
        seasonId: "season-1",
        phase: "season start lineup/autoprep",
        durationMs: 34_622,
        status: "ok",
      },
    ]);

    expect(analysis.slowFindings.some((entry) => entry.phase === "season start planner convergence")).toBe(true);
    const planner = analysis.slowFindings.find((entry) => entry.phase === "season start planner convergence");
    expect(planner?.ratio).toBeGreaterThan(5);
    expect(planner?.accelerationIdeas.length).toBeGreaterThan(2);
    expect(analysis.slowFindings.some((entry) => entry.phase === "season start lineup/autoprep")).toBe(false);
  });

  it("renders markdown with acceleration section", () => {
    const analysis = analyzeLongRunPerformanceFromRows([
      {
        seasonId: "season-2",
        phase: "canonical manager preseason",
        durationMs: 218_923,
        status: "ok",
      },
    ]);
    const md = renderLongRunPerformanceMarkdown(analysis);
    expect(md).toContain("Beschleunigungsvorschläge");
    expect(md).toContain("canonical manager preseason");
  });

  it("uses configured phase budgets", () => {
    expect(PHASE_BUDGET_MS["season start planner convergence"]).toBe(5 * 60 * 1000);
  });
});

function analyzeLongRunPerformanceFromRows(rows: PerformanceRow[]) {
  const dir = mkdtempSync(join(tmpdir(), "lr-perf-"));
  writeFileSync(join(dir, "five-season-phase-timings.json"), JSON.stringify(rows));
  const analysis = analyzeLongRunPerformance(dir);
  rmSync(dir, { recursive: true, force: true });
  return analysis;
}
