import fs from "node:fs";
import path from "node:path";

import { appendObservation } from "@/lib/season/long-run-observation-log";

export type PerformanceRow = {
  seasonId: string;
  matchdayId?: string | null;
  phase: string;
  durationMs: number;
  itemCount?: number | null;
  status?: string | null;
  note?: string | null;
  buyApplyCount?: number | null;
  sellApplyCount?: number | null;
  warnings?: string | null;
};

export type SlowPerformanceFinding = {
  seasonId: string;
  matchdayId?: string | null;
  phase: string;
  durationMs: number;
  budgetMs: number;
  ratio: number;
  note?: string | null;
  accelerationIdeas: string[];
};

export type SeasonDurationSummary = {
  seasonId: string;
  totalMs: number;
  budgetMs: number;
  slowPhaseCount: number;
};

export type LongRunPerformanceAnalysis = {
  rows: PerformanceRow[];
  slowFindings: SlowPerformanceFinding[];
  seasonSummaries: SeasonDurationSummary[];
  topSlowPhases: SlowPerformanceFinding[];
};

export const LONG_RUN_PERFORMANCE_REPORT = "long-run-performance-analysis.md";
export const LONG_RUN_PERF_LOGGED_KEYS = ".long-run-perf-logged-keys.json";

/** Per-phase budgets derived from S1 baseline + headroom. */
export const PHASE_BUDGET_MS: Record<string, number> = {
  draft: 10 * 60 * 1000,
  "canonical manager preseason": 3 * 60 * 1000,
  "season start planner convergence": 5 * 60 * 1000,
  "season start lineup/autoprep": 60 * 1000,
  "season end ai market": 2 * 60 * 1000,
  "season end training/development": 60 * 1000,
  "season end contracts/renewals": 30 * 1000,
  "season end sponsor settlement": 30 * 1000,
  "season end final stabilization season start emergency roster repair": 2 * 60 * 1000,
};

export const PHASE_PREFIX_BUDGET_MS: Array<{ prefix: string; budgetMs: number }> = [
  { prefix: "matchday lineup generation", budgetMs: 8 * 1000 },
  { prefix: "matchday resolve", budgetMs: 15 * 1000 },
  { prefix: "matchday standings", budgetMs: 12 * 1000 },
  { prefix: "matchday advance", budgetMs: 8 * 1000 },
];

export const SEASON_TOTAL_BUDGET_MS = 45 * 60 * 1000;

const ACCELERATION_BY_PHASE: Record<string, string[]> = {
  "season start planner convergence": [
    "Long-Run-Profil: maxLeagueRounds 3→2, maxTeamCycles 5→3 (Env `OLY_LONG_RUN_PLANNER_MAX_ROUNDS`).",
    "Früher Abbruch wenn eine Liga-Runde 0 Buys/0 Sells liefert und coverageRisk unverändert.",
    "Teams mit existing_preseason_market_transfers überspringen (bereits implementiert — S2 Retry war instant).",
    "Rest-Coverage-Risk nach N Runden an emergency roster repair delegieren statt weiter zu konvergieren.",
    "Market-Plan-Preview pro Team cachen (Slot-Fingerprint); transfer-window-profiler für Hot-Teams.",
    "S1-Ende: Roster-Hard-Gates reparieren damit S2 nicht 29 coverage-risk Teams startet.",
  ],
  "canonical manager preseason": [
    "Long-Run: Training-Focus/Intensity-Warnpfad überspringen wenn keine UI-Ausgabe nötig.",
    "Building-Preview batchen — ein Pass pro Team statt pro Action.",
    "Actions mit identischem Outcome (income_source_missing) früh filtern.",
  ],
  "season end ai market": [
    "transfer_window_stalled früher erkennen (nach 1 leerer Runde abbrechen).",
    "Long-Run: maxLeagueRounds für season_end auf 2 capen.",
    "existing_market_transfers → skip (bereits in Logs sichtbar).",
  ],
  "season end training/development": [
    "Per-Player-Audit-Strings in Long-Run auf Summary reduzieren.",
    "Organic batch: Teams parallel vorbereiten, Save einmal am Ende.",
  ],
  "season start lineup/autoprep": [
    "Lineup-Lab-Context-Cache über Saisongrenzen warm halten.",
    "AI-Lineup nur für Teams ohne gültiges gespeichertes Lineup.",
  ],
  "season end sponsor settlement": [
    "already_applied früh prüfen (S2=0ms — Pattern übernehmen).",
    "Sponsor-Settlement einmal pro Saison, nicht pro Team-Loop mit redundanten Reads.",
  ],
  "season end contracts/renewals": [
    "Renewal-Kandidaten vorfiltern (nur expiring / flagged contracts).",
  ],
  "season end final stabilization season start emergency roster repair": [
    "Nur Teams unter hardMin — nicht alle coverage-risk Teams.",
    "Cheap-Fit-Buy-Pool cachen pro Save-Snapshot.",
  ],
};

const MATCHDAY_ACCELERATION = [
  "matchday standings: team_power_debuff-Strings in Long-Run weglassen (größter note-Bloat).",
  "Standings/Resolve: incomplete_result-Warnungen nur zählen, nicht serialisieren.",
];

function phaseBudgetMs(phase: string) {
  if (PHASE_BUDGET_MS[phase]) return PHASE_BUDGET_MS[phase]!;
  const prefixHit = PHASE_PREFIX_BUDGET_MS.find((entry) => phase.startsWith(entry.prefix));
  return prefixHit?.budgetMs ?? null;
}

function accelerationIdeasFor(phase: string) {
  if (ACCELERATION_BY_PHASE[phase]) return ACCELERATION_BY_PHASE[phase]!;
  if (phase.startsWith("matchday")) return MATCHDAY_ACCELERATION;
  return ["Profiler-Lauf (`scripts/profile-transfer-window.ts`) für diese Phase.", "Phase-Timing in five-season-phase-timings.json vergleichen."];
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      cells.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells;
}

function readPerformanceRows(outputDir: string): PerformanceRow[] {
  const jsonPath = path.join(outputDir, "five-season-phase-timings.json");
  const csvPath = path.join(outputDir, "performance-longrun-s1-s6.csv");

  const jsonRows = fs.existsSync(jsonPath)
    ? (JSON.parse(fs.readFileSync(jsonPath, "utf8")) as PerformanceRow[])
    : [];
  const csvRows = readPerformanceCsv(csvPath);

  if (jsonRows.length === 0) return csvRows;
  if (csvRows.length === 0) return jsonRows;

  const merged = new Map<string, PerformanceRow>();
  for (const row of [...jsonRows, ...csvRows]) {
    const key = `${row.seasonId}|${row.matchdayId ?? ""}|${row.phase}|${row.durationMs}`;
    merged.set(key, row);
  }
  return [...merged.values()];
}

function readPerformanceCsv(csvPath: string): PerformanceRow[] {
  if (!fs.existsSync(csvPath)) return [];

  const lines = fs.readFileSync(csvPath, "utf8").trim().split("\n");
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]!);
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const row = Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
    return {
      seasonId: String(row.seasonId ?? ""),
      matchdayId: row.matchdayId || null,
      phase: String(row.phase ?? ""),
      durationMs: Number(row.durationMs ?? 0),
      itemCount: row.itemCount ? Number(row.itemCount) : null,
      status: row.status || null,
      note: row.note || null,
      buyApplyCount: row.buyApplyCount ? Number(row.buyApplyCount) : null,
      sellApplyCount: row.sellApplyCount ? Number(row.sellApplyCount) : null,
      warnings: row.warnings || null,
    } satisfies PerformanceRow;
  });
}

function findingKey(finding: Pick<SlowPerformanceFinding, "seasonId" | "matchdayId" | "phase" | "durationMs">) {
  return `${finding.seasonId}|${finding.matchdayId ?? ""}|${finding.phase}|${finding.durationMs}`;
}

export function analyzeLongRunPerformance(outputDir: string): LongRunPerformanceAnalysis {
  const rows = readPerformanceRows(outputDir).filter((row) => row.durationMs > 0 && row.status !== "skipped");

  const slowFindings: SlowPerformanceFinding[] = [];
  for (const row of rows) {
    const budgetMs = phaseBudgetMs(row.phase);
    if (!budgetMs || row.durationMs <= budgetMs) continue;
    slowFindings.push({
      seasonId: row.seasonId,
      matchdayId: row.matchdayId,
      phase: row.phase,
      durationMs: row.durationMs,
      budgetMs,
      ratio: row.durationMs / budgetMs,
      note: row.note,
      accelerationIdeas: accelerationIdeasFor(row.phase),
    });
  }

  slowFindings.sort((a, b) => b.durationMs - a.durationMs);

  const seasonTotals = new Map<string, { totalMs: number; slowPhaseCount: number }>();
  for (const row of rows) {
    const bucket = seasonTotals.get(row.seasonId) ?? { totalMs: 0, slowPhaseCount: 0 };
    bucket.totalMs += row.durationMs;
    seasonTotals.set(row.seasonId, bucket);
  }
  for (const finding of slowFindings) {
    const bucket = seasonTotals.get(finding.seasonId);
    if (bucket) bucket.slowPhaseCount += 1;
  }

  const seasonSummaries: SeasonDurationSummary[] = [...seasonTotals.entries()]
    .map(([seasonId, stats]) => ({
      seasonId,
      totalMs: stats.totalMs,
      budgetMs: SEASON_TOTAL_BUDGET_MS,
      slowPhaseCount: stats.slowPhaseCount,
    }))
    .sort((a, b) => parseSeasonNumber(a.seasonId) - parseSeasonNumber(b.seasonId));

  return {
    rows,
    slowFindings,
    seasonSummaries,
    topSlowPhases: slowFindings.slice(0, 15),
  };
}

function parseSeasonNumber(seasonId: string) {
  const match = seasonId.match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

function formatMinutes(ms: number) {
  const minutes = ms / 60_000;
  return minutes >= 10 ? `${Math.round(minutes)}min` : `${minutes.toFixed(1)}min`;
}

function formatDuration(ms: number) {
  if (ms >= 60_000) return formatMinutes(ms);
  return `${Math.round(ms / 1000)}s`;
}

export function renderLongRunPerformanceMarkdown(analysis: LongRunPerformanceAnalysis) {
  const lines: string[] = [
    "# Long-Run Performance-Analyse",
    "",
    `_Generiert: ${new Date().toISOString()}_`,
    "",
    "## Saison-Gesamtdauer (instrumentiert)",
    "",
    "| Season | Summe | Budget | Slow-Phasen | Status |",
    "|---|---:|---:|---:|---|",
  ];

  for (const summary of analysis.seasonSummaries) {
    const over = summary.totalMs > summary.budgetMs;
    lines.push(
      `| ${summary.seasonId} | ${formatDuration(summary.totalMs)} | ${formatMinutes(summary.budgetMs)} | ${summary.slowPhaseCount} | ${over ? "⚠ über Budget" : "OK"} |`,
    );
  }

  lines.push("", "## Langsame Phasen (> Budget)", "");
  if (analysis.slowFindings.length === 0) {
    lines.push("_Keine Phase über dem definierten Budget._");
  } else {
    lines.push("| Season | Phase | Dauer | Budget | Faktor | Hinweis |");
    lines.push("|---|---|---:|---:|---:|---|");
    for (const finding of analysis.slowFindings) {
      const md = finding.matchdayId ? `${finding.matchdayId}` : "—";
      const note = (finding.note ?? "").slice(0, 80).replace(/\|/g, "/") || "—";
      lines.push(
        `| ${finding.seasonId} | ${finding.phase}${finding.matchdayId ? ` (${md})` : ""} | ${formatDuration(finding.durationMs)} | ${formatDuration(finding.budgetMs)} | ${finding.ratio.toFixed(1)}× | ${note} |`,
      );
    }
  }

  lines.push("", "## Beschleunigungsvorschläge (priorisiert)", "");
  const phasesSeen = new Set<string>();
  for (const finding of analysis.topSlowPhases) {
    if (phasesSeen.has(finding.phase)) continue;
    phasesSeen.add(finding.phase);
    lines.push(`### ${finding.phase}`, "");
    lines.push(`_Schwerster Fall: ${finding.seasonId} · ${formatDuration(finding.durationMs)} (${finding.ratio.toFixed(1)}× Budget)_`, "");
    for (const idea of finding.accelerationIdeas) {
      lines.push(`- ${idea}`);
    }
    lines.push("");
  }

  lines.push("## Meta / Pipeline", "");
  lines.push("- Dev-Server während Long-Run stoppen (weniger I/O-Konkurrenz).");
  lines.push("- `long-run-by-season/season-N-performance.csv`: Unterordner vor Export anlegen (Fix in appendCsvRows).");
  lines.push("- Nach jedem Season-End: `tsx scripts/analyze-long-run-performance.ts --output-dir …`");
  lines.push("");

  return lines.join("\n");
}

function readLoggedKeys(outputDir: string) {
  const filePath = path.join(outputDir, LONG_RUN_PERF_LOGGED_KEYS);
  if (!fs.existsSync(filePath)) return new Set<string>();
  return new Set(JSON.parse(fs.readFileSync(filePath, "utf8")) as string[]);
}

function writeLoggedKeys(outputDir: string, keys: Set<string>) {
  fs.writeFileSync(path.join(outputDir, LONG_RUN_PERF_LOGGED_KEYS), `${JSON.stringify([...keys], null, 2)}\n`);
}

export function writeLongRunPerformanceReport(outputDir: string, analysis = analyzeLongRunPerformance(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
  const reportPath = path.join(outputDir, LONG_RUN_PERFORMANCE_REPORT);
  fs.writeFileSync(reportPath, `${renderLongRunPerformanceMarkdown(analysis)}\n`);
  return reportPath;
}

export function syncPerformanceObservations(outputDir: string, analysis = analyzeLongRunPerformance(outputDir)) {
  const loggedKeys = readLoggedKeys(outputDir);
  const newKeys: string[] = [];

  for (const summary of analysis.seasonSummaries) {
    if (summary.totalMs <= summary.budgetMs) continue;
    const key = `season-total|${summary.seasonId}|${summary.totalMs}`;
    if (loggedKeys.has(key)) continue;
    appendObservation(outputDir, {
      category: "perf",
      phase: summary.seasonId,
      message: `Saison-Gesamt >${Math.round(summary.budgetMs / 60_000)}min`,
      detail: `${formatMinutes(summary.totalMs)} · ${summary.slowPhaseCount} slow phases`,
    });
    loggedKeys.add(key);
    newKeys.push(key);
  }

  for (const finding of analysis.slowFindings) {
    const key = findingKey(finding);
    if (loggedKeys.has(key)) continue;
    appendObservation(outputDir, {
      category: "perf",
      phase: finding.matchdayId ? `${finding.seasonId}/${finding.phase}` : `${finding.seasonId}/${finding.phase}`,
      message: `${finding.phase} >${formatDuration(finding.budgetMs)}`,
      detail: `${formatDuration(finding.durationMs)} (${finding.ratio.toFixed(1)}×)${finding.note ? ` · ${finding.note.slice(0, 120)}` : ""}`,
    });
    loggedKeys.add(key);
    newKeys.push(key);
  }

  if (newKeys.length > 0) writeLoggedKeys(outputDir, loggedKeys);
  return newKeys.length;
}
