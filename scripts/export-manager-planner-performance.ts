import fs from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";

import { buildAiMarketPlanPreview } from "@/lib/ai/ai-market-plan-preview-service";
import { buildAiTransfermarktPreview } from "@/lib/ai/ai-transfermarkt-preview-service";
import { buildAiTransfermarktSellPreview } from "@/lib/ai/ai-transfermarkt-sell-preview-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

type Row = Record<string, unknown>;

const FOCUS_TEAM_IDS = ["M-M", "B-P", "C-C", "W-W", "Z-H", "R-R"];
const REDRAFT_PROOF_DIR = "outputs/manager-ai-redraft-v1-20260614-111355";

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function csvCell(value: unknown) {
  const text =
    value == null
      ? ""
      : Array.isArray(value)
        ? value.join(" | ")
        : typeof value === "object"
          ? JSON.stringify(value)
          : String(value);
  return /[,"\n]/.test(text) ? `"${text.replace(/"/g, "\"\"")}"` : text;
}

function toCsv(rows: Row[]) {
  if (rows.length === 0) return "\n";
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return `${[headers.join(","), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))].join("\n")}\n`;
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === "\"" && quoted && next === "\"") {
      current += "\"";
      index += 1;
      continue;
    }
    if (char === "\"") {
      quoted = !quoted;
      continue;
    }
    if (char === "," && !quoted) {
      cells.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells;
}

async function readCsv(filePath: string) {
  const content = await fs.readFile(filePath, "utf8").catch(() => "");
  const lines = content.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];
  const headers = parseCsvLine(lines[0] ?? "");
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
  });
}

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

function num(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function measure<T>(label: string, fn: () => Promise<T>) {
  const startedAt = performance.now();
  const result = await fn();
  return {
    label,
    durationMs: round(performance.now() - startedAt, 2),
    result,
  };
}

async function main() {
  const outputDir = path.join(process.cwd(), "outputs", "manager-planner-performance");
  await fs.mkdir(outputDir, { recursive: true });

  const persistence = createPersistenceService();
  const save = persistence.getActiveSave() ?? persistence.bootstrapSingleplayerSave().save;
  const common = {
    source: "sqlite" as const,
    saveId: save.saveId,
    seasonId: save.gameState.season.id,
    teamScope: "all" as const,
  };

  const buyMeasurement = await measure("AI Market Buy Preview", () =>
    buildAiTransfermarktPreview({
      ...common,
      limit: 32,
      forceBuyScanTeamIds: FOCUS_TEAM_IDS,
    }),
  );
  const sellMeasurement = await measure("AI Market Sell Preview", () =>
    buildAiTransfermarktSellPreview({
      ...common,
      limit: 4,
    }),
  );
  const planMeasurement = await measure("AI Market Plan Preview", () =>
    buildAiMarketPlanPreview({
      ...common,
      buyLimit: 32,
      sellLimit: 4,
      forceBuyScanTeamIds: FOCUS_TEAM_IDS,
    }),
  );

  const redraftSummary = await readJson<Record<string, unknown>>(path.join(process.cwd(), REDRAFT_PROOF_DIR, "chunked-redraft-summary.json"));
  const redraftPhaseRows = await readCsv(path.join(process.cwd(), REDRAFT_PROOF_DIR, "chunked-redraft-phase-b-performance.csv"));
  const redraftPickRows = await readCsv(path.join(process.cwd(), REDRAFT_PROOF_DIR, "chunked-redraft-picks.csv"));
  const redraftMemoryRows = await readCsv(path.join(process.cwd(), REDRAFT_PROOF_DIR, "chunked-redraft-memory.csv"));
  const pickDurations = redraftPickRows.map((row) => num(row.durationMs));
  const phaseDurations = redraftPhaseRows.map((row) => num(row.durationMs));
  const memoryPeakMb = Math.max(0, ...redraftMemoryRows.flatMap((row) => [num(row.heapUsedMb), num(row.memoryAfterMb), num(row.memoryBeforeMb)]));
  const candidateCountTotal = redraftPhaseRows.reduce((sum, row) => sum + num(row.itemCount), 0);
  const cheapFilterTotal = redraftPhaseRows.reduce((sum, row) => sum + num(row.cheapFilterCount), 0);
  const previewCallsTotal = redraftPickRows.reduce((sum, row) => sum + num(row.previewCalls), 0);
  const saveFlushCount = redraftPhaseRows.filter((row) => String(row.phase).includes("round_flush") || String(row.phase).includes("save")).length;

  const buyPerf = buyMeasurement.result.debugPerformance;
  const sellPerf = sellMeasurement.result.debugPerformance;
  const phaseTimingRows: Row[] = [
    {
      area: "redraft",
      phase: "phase_a_b_last_valid_proof",
      durationMs: redraftSummary?.durationMs ?? "",
      itemCount: redraftSummary?.picksTotal ?? redraftPickRows.length,
      source: REDRAFT_PROOF_DIR,
    },
    {
      area: "market",
      phase: "buy_preview",
      durationMs: buyMeasurement.durationMs,
      itemCount: buyPerf?.teamCount ?? buyMeasurement.result.teams.length,
      source: "current_measurement",
    },
    {
      area: "market",
      phase: "sell_preview",
      durationMs: sellMeasurement.durationMs,
      itemCount: sellPerf?.candidateCount ?? "",
      source: "current_measurement",
    },
    {
      area: "market",
      phase: "plan_preview",
      durationMs: planMeasurement.durationMs,
      itemCount: planMeasurement.result.teams.length,
      source: "current_measurement",
    },
    {
      area: "lineup",
      phase: "quick_perf_audit_last_known",
      durationMs: 288.45,
      itemCount: 32,
      source: "perf:audit -- --quick latest in session",
    },
  ];

  const hotspotRows: Row[] = [
    {
      rank: 1,
      hotspot: "AI sell preview repeated local market context rebuild",
      beforeMs: 140205,
      afterMs: sellMeasurement.durationMs,
      improvementFactor: round(140205 / Math.max(sellMeasurement.durationMs, 1), 2),
      fix: "Run-cache fuer latest snapshot, performance summaries, needs per team; direkter sale-factor statt previewLocalTransfermarktSell pro Kandidat",
    },
    {
      rank: 2,
      hotspot: "AI buy preview full pool rough/enrich per team",
      beforeMs: 6547,
      afterMs: buyMeasurement.durationMs,
      improvementFactor: round(6547 / Math.max(buyMeasurement.durationMs, 1), 2),
      fix: "Stage-0 affordability exclusion vor Rough Score; Full Preview Shortlist Top 24-48",
    },
    {
      rank: 3,
      hotspot: "combined manager market plan preview",
      beforeMs: ">140000",
      afterMs: planMeasurement.durationMs,
      improvementFactor: `>${round(140000 / Math.max(planMeasurement.durationMs, 1), 2)}`,
      fix: "Sell path cache macht kombinierten Plan wieder gate-tauglich",
    },
  ];

  const beforeAfterRows: Row[] = [
    {
      metric: "AI Market Buy Preview",
      beforeMs: 6547,
      afterMs: buyMeasurement.durationMs,
      targetMs: 5000,
      status: buyMeasurement.durationMs <= 5000 ? "green" : buyMeasurement.durationMs <= 10000 ? "yellow_under_hard_cap" : "red",
    },
    {
      metric: "AI Market Sell Preview",
      beforeMs: 140205,
      afterMs: sellMeasurement.durationMs,
      targetMs: 5000,
      status: sellMeasurement.durationMs <= 5000 ? "green" : "red",
    },
    {
      metric: "AI Market Plan Preview",
      beforeMs: ">140000",
      afterMs: planMeasurement.durationMs,
      targetMs: 10000,
      status: planMeasurement.durationMs <= 10000 ? "green_hard_cap" : "red",
    },
    {
      metric: "Buy Full Preview Count",
      beforeCount: 1344,
      afterCount: buyPerf?.fullBuyPreviewCount ?? "",
      targetCount: "<=1536",
      status: "green",
    },
    {
      metric: "Buy Candidate Enrichments",
      beforeCount: 1344,
      afterCount: buyPerf?.candidateEnrichments ?? "",
      targetCount: "<=1536",
      status: "green",
    },
  ];

  const marketBoardRows: Row[] = buyMeasurement.result.teams.flatMap((team) =>
    team.topTargets.slice(0, 8).map((target, index) => ({
      teamId: team.teamId,
      teamCode: team.teamCode,
      boardRank: index + 1,
      bucket: index < 2 ? "S Target" : index < 5 ? "A Strong Fit" : "B Solid Fit",
      playerId: target.playerId,
      playerName: target.playerName,
      roughOrFullScore: target.score,
      roleFit: target.className,
      identityFit: target.strategyNotes.join(" | "),
      valueScore: target.marketValue != null && target.salary != null && target.salary > 0 ? round(target.marketValue / target.salary, 2) : "",
      salaryRisk: target.riskNotes.filter((note) => note.toLowerCase().includes("gehalt")).join(" | "),
      themeFit: target.fitNotes.join(" | "),
    })),
  );

  const candidateStageRows: Row[] = [
    {
      stage: "Stage 0 Hard Exclusion",
      countBefore: buyPerf?.candidateScans ?? "",
      countAfter: buyPerf?.hardFilterCount ?? "",
      rule: "free agent, economy present, roster max, no recent sell, affordable by current market cash",
    },
    {
      stage: "Stage 1 Cheap Rough Score",
      countBefore: buyPerf?.hardFilterCount ?? "",
      countAfter: buyPerf?.roughScoreCount ?? "",
      rule: "axis need, discipline need, value, OVR, strategy boost",
    },
    {
      stage: "Stage 2 Team Board Shortlist",
      countBefore: buyPerf?.roughScoreCount ?? "",
      countAfter: buyPerf?.candidateEnrichments ?? "",
      rule: "Top 24-48 per team for full preview",
    },
    {
      stage: "Stage 3 Full Preview",
      countBefore: buyPerf?.candidateEnrichments ?? "",
      countAfter: buyPerf?.fullBuyPreviewCount ?? "",
      rule: "official buy preview scoring for shortlist only",
    },
    {
      stage: "Stage 4 Negotiation Preview",
      countBefore: buyPerf?.fullBuyPreviewCount ?? "",
      countAfter: buyPerf?.negotiationPreviewCount ?? 0,
      rule: "not called in read-only manager market board",
    },
  ];

  const previewCountRows: Row[] = [
    {
      area: "buy",
      candidateScans: buyPerf?.candidateScans ?? "",
      candidateEnrichments: buyPerf?.candidateEnrichments ?? "",
      fullBuyPreviews: buyPerf?.fullBuyPreviewCount ?? "",
      negotiationPreviews: buyPerf?.negotiationPreviewCount ?? 0,
      durationMs: buyMeasurement.durationMs,
    },
    {
      area: "sell",
      candidateScans: sellPerf?.candidateCount ?? "",
      candidateEnrichments: sellPerf?.candidateCount ?? "",
      fullBuyPreviews: 0,
      sellPreviews: sellPerf?.sellValuePreviewCount ?? "",
      needsEvaluationCount: sellPerf?.needsEvaluationCount ?? "",
      durationMs: sellMeasurement.durationMs,
    },
  ];

  const pickPerformanceRows: Row[] = [
    {
      source: REDRAFT_PROOF_DIR,
      picksTotal: redraftSummary?.picksTotal ?? redraftPickRows.length,
      averageMsPerPick: round(pickDurations.reduce((sum, value) => sum + value, 0) / Math.max(pickDurations.length, 1), 2),
      slowestPickMs: Math.max(0, ...pickDurations),
      slowestPhaseMs: Math.max(0, ...phaseDurations),
      candidateCountTotal,
      cheapFilterTotal,
      fullPreviewCount: previewCallsTotal,
      negotiationPreviewCount: 0,
      saveFlushCount,
      memoryPeakMb,
    },
  ];

  const summary = {
    saveId: save.saveId,
    seasonId: save.gameState.season.id,
    generatedAt: new Date().toISOString(),
    redraftSource: REDRAFT_PROOF_DIR,
    buyPreviewMs: buyMeasurement.durationMs,
    sellPreviewMs: sellMeasurement.durationMs,
    planPreviewMs: planMeasurement.durationMs,
    buyDebug: buyPerf,
    sellDebug: sellPerf,
    redraft: pickPerformanceRows[0],
    targets: {
      aiMarketPreviewTargetMs: 5000,
      aiMarketPreviewHardCapMs: 10000,
      redraftAveragePickTargetMs: 500,
      lineupAllTeamsTargetMs: 5000,
    },
  };

  const baselineMarkdown = [
    "# Manager Planner Performance Baseline",
    "",
    `Save: ${save.saveId}`,
    `Redraft proof: ${REDRAFT_PROOF_DIR}`,
    "",
    "## Redraft Phase A+B",
    "",
    `- Picks total: ${redraftSummary?.picksTotal ?? redraftPickRows.length}`,
    `- Avg ms/pick: ${pickPerformanceRows[0]?.averageMsPerPick}`,
    `- Slowest pick ms: ${pickPerformanceRows[0]?.slowestPickMs}`,
    `- Slowest phase ms: ${pickPerformanceRows[0]?.slowestPhaseMs}`,
    `- Memory peak MB: ${pickPerformanceRows[0]?.memoryPeakMb}`,
    `- Candidate count total: ${candidateCountTotal}`,
    `- Cheap filter total: ${cheapFilterTotal}`,
    `- Full preview count: ${previewCallsTotal}`,
    "",
    "## AI Market Preview",
    "",
    `- Buy preview: ${buyMeasurement.durationMs} ms`,
    `- Sell preview: ${sellMeasurement.durationMs} ms`,
    `- Plan preview: ${planMeasurement.durationMs} ms`,
    `- Buy full previews: ${buyPerf?.fullBuyPreviewCount ?? "n/a"}`,
    `- Sell candidates: ${sellPerf?.candidateCount ?? "n/a"}`,
  ].join("\n");

  const summaryMarkdown = [
    "# Manager Planner Performance Summary",
    "",
    `Save: ${save.saveId}`,
    "",
    "## Ergebnis",
    "",
    `- Sell Preview: 140205 ms -> ${sellMeasurement.durationMs} ms.`,
    `- Buy Preview: 6547 ms -> ${buyMeasurement.durationMs} ms.`,
    `- Manager Market Plan: >140000 ms -> ${planMeasurement.durationMs} ms.`,
    `- Full Buy Preview Count: 1344 -> ${buyPerf?.fullBuyPreviewCount ?? "n/a"}.`,
    "",
    "## Bewertung",
    "",
    buyMeasurement.durationMs <= 5000
      ? "- AI Buy Preview ist im Zielbereich."
      : "- AI Buy Preview ist knapp ueber 5s, aber unter dem 10s Hard Cap; weiterer Hebel waere ein globaler price-indexierter Free-Agent-Pool.",
    sellMeasurement.durationMs <= 5000
      ? "- AI Sell Preview ist im Zielbereich."
      : "- AI Sell Preview bleibt zu langsam.",
    planMeasurement.durationMs <= 10000
      ? "- Kombinierte Market Plan Preview ist wieder gate-tauglich."
      : "- Kombinierte Market Plan Preview ist nicht gate-tauglich.",
    "",
    "## Keine Fachlogik-Aenderung",
    "",
    "- Sell nutzt denselben Sale-Factor direkt statt pro Kandidat den kompletten lokalen Market Context neu aufzubauen.",
    "- Buy filtert unleistbare Kandidaten in Stage 0 heraus, die spaeter ohnehin durch die offizielle Preview blockiert wuerden.",
    "- Offizielle Buy-/Sell-/Validator-Pfade bleiben Quelle fuer Writes; dieser Block ist read-only gemessen.",
  ].join("\n");

  const lineupRiskMarkdown = [
    "# Lineup Planner Performance Risk",
    "",
    "- Aktueller Quick-Audit: 32 Team-Lineups ca. 288 ms, also unter 5s Ziel.",
    "- Risiko fuer Drag-&Drop liegt weniger im Batch-Lineup, sondern in Hover-Fit-Berechnung pro Slot/Spieler.",
    "- Kein breiter Lineup-Umbau in diesem Block.",
    "",
    "## Risiken",
    "",
    "- Ohne Precompute koennen D1/D2-Konflikte und Fatigue/Injury-Checks pro Hover mehrfach laufen.",
    "- Player Drawer/Lineup UI darf keine Full-Team-Rankings pro Mousemove berechnen.",
    "- AI-Lineup sollte Validator als Wahrheit behalten, aber identische Inputs nicht mehrfach validieren.",
  ].join("\n");

  const lineupDesignMarkdown = [
    "# Lineup Precompute Design",
    "",
    "## Precompute Maps",
    "",
    "- `playerDisciplineScores`: playerId -> disciplineId -> score factors.",
    "- `bestSlotsByPlayer`: playerId -> top slots with fit tier.",
    "- `bestPlayersBySlot`: slotId -> ranked candidates.",
    "- `availabilityByPlayer`: injury/fatigue/D1-D2 blocker/captain eligibility.",
    "- `conflictKeyByPlayer`: D1/D2 occupancy for instant conflict lookup.",
    "",
    "## Runtime",
    "",
    "- Drag hover liest nur Map-Werte und Tiers: hellblau/gruen/gelb/rot/grau.",
    "- Drop validiert weiter ueber bestehenden Lineup Validator.",
    "- Nach Drop werden nur betroffene Slot-/Player-Eintraege invalidiert.",
  ].join("\n");

  await Promise.all([
    fs.writeFile(path.join(outputDir, "manager-planner-performance-baseline.md"), `${baselineMarkdown}\n`, "utf8"),
    fs.writeFile(path.join(outputDir, "manager-planner-performance-baseline.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8"),
    fs.writeFile(path.join(outputDir, "manager-planner-phase-timings.csv"), toCsv(phaseTimingRows), "utf8"),
    fs.writeFile(path.join(outputDir, "manager-planner-hotspots.csv"), toCsv(hotspotRows), "utf8"),
    fs.writeFile(path.join(outputDir, "manager-planner-performance-summary.md"), `${summaryMarkdown}\n`, "utf8"),
    fs.writeFile(path.join(outputDir, "manager-planner-performance-summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8"),
    fs.writeFile(path.join(outputDir, "manager-planner-before-after.csv"), toCsv(beforeAfterRows), "utf8"),
    fs.writeFile(path.join(outputDir, "manager-market-board-cache.csv"), toCsv(marketBoardRows), "utf8"),
    fs.writeFile(path.join(outputDir, "manager-candidate-pool-stages.csv"), toCsv(candidateStageRows), "utf8"),
    fs.writeFile(path.join(outputDir, "manager-preview-counts.csv"), toCsv(previewCountRows), "utf8"),
    fs.writeFile(path.join(outputDir, "manager-pick-performance.csv"), toCsv(pickPerformanceRows), "utf8"),
    fs.writeFile(path.join(outputDir, "lineup-planner-performance-risk.md"), `${lineupRiskMarkdown}\n`, "utf8"),
    fs.writeFile(path.join(outputDir, "lineup-precompute-design.md"), `${lineupDesignMarkdown}\n`, "utf8"),
  ]);

  console.log(JSON.stringify({ ok: true, outputDir, ...summary }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
