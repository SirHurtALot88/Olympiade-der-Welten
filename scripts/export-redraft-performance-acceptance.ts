import fs from "node:fs";
import path from "node:path";

const OUTPUT_DIR = process.env.OLY_REDRAFT_ACCEPTANCE_OUTPUT_DIR ?? "outputs/redraft-performance-acceptance";
const OLD_REDFRAFT_DIR = "outputs/full-clean-redraft";
const OLD_TOPUP_DIR = "outputs/multi-season-s1-s6-blocked-2026-06-14T02-31-02-625Z";
const NEW_PROOF_DIR = process.env.OLY_NEW_REDFRAFT_PROOF_DIR ?? "outputs/chunked-redraft-proof-20260614-075114";

function ensureOutputDir() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function readJson<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function readCsv(filePath: string) {
  if (!fs.existsSync(filePath)) return [] as Record<string, string>[];
  const lines = fs.readFileSync(filePath, "utf8").trim().split(/\r?\n/);
  const headers = lines.shift()?.split(",") ?? [];
  return lines.map((line) => {
    const values = line.split(",");
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function csvEscape(value: unknown) {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function writeCsv(fileName: string, rows: Array<Record<string, unknown>>) {
  ensureOutputDir();
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  fs.writeFileSync(
    path.join(OUTPUT_DIR, fileName),
    `${[headers.join(","), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))].join("\n")}\n`,
    "utf8",
  );
}

function writeJson(fileName: string, payload: unknown) {
  ensureOutputDir();
  fs.writeFileSync(path.join(OUTPUT_DIR, fileName), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function writeMarkdown(fileName: string, content: string) {
  ensureOutputDir();
  fs.writeFileSync(path.join(OUTPUT_DIR, fileName), content.endsWith("\n") ? content : `${content}\n`, "utf8");
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

type OldRedraftSummary = {
  summary: {
    saveName: string;
    finalRosterCountAllTeams: number;
    transferHistoryCount: number;
    teamsUnderMin: string[];
    runnerStoppedAt: string;
    stopReason: string;
  };
};

type OldTopupSummary = {
  generatedAt: string;
  blockerPhase: string;
  blocker: string;
  lastObservedPhase: string;
  rosterCount: number;
  transferHistoryCount: number;
  teamsBelowMin: unknown[];
  duplicatePlayers: unknown[];
  negativeCashTeams: unknown[];
};

type NewSummary = {
  picksTotal: number;
  transferHistoryTotal: number;
  teamsBelowMin: unknown[];
  duplicatePlayers: unknown[];
  negativeCashTeams: unknown[];
  memoryPeakMb: number;
  roundDurations: Array<{ round: number; durationMs: number; picks: number }>;
  slowestPick: { durationMs: number; teamId: string; playerName: string } | null;
};

function buildBaseline() {
  const oldRedraft = readJson<OldRedraftSummary>(path.join(OLD_REDFRAFT_DIR, "full-clean-redraft-summary.json"));
  const oldTopup = readJson<OldTopupSummary>(path.join(OLD_TOPUP_DIR, "multi-season-s1-s6-summary.json"));
  const newSummary = readJson<NewSummary>(path.join(NEW_PROOF_DIR, "chunked-redraft-summary.json"));
  const oldPicks = readCsv(path.join(OLD_REDFRAFT_DIR, "full-clean-redraft-picks.csv"));
  const newPicks = readCsv(path.join(NEW_PROOF_DIR, "chunked-redraft-picks.csv"));
  const newPhases = readCsv(path.join(NEW_PROOF_DIR, "redraft-phase-timings.csv"));

  const oldStart = oldRedraft?.summary.saveName.match(/(\d{1,2}\.\d{1,2}\.\d{4}, \d{2}:\d{2}:\d{2})/)?.[1] ?? "unknown";
  const oldStopped = oldRedraft?.summary.runnerStoppedAt ?? oldTopup?.lastObservedPhase ?? "unknown";
  const baselinePicks = oldRedraft?.summary.transferHistoryCount ?? oldPicks.length;
  const newPicksTotal = newSummary?.picksTotal ?? newPicks.length;
  const newTotalDuration = newSummary?.roundDurations.reduce((sum, row) => sum + row.durationMs, 0) ?? 0;
  const newMsPerPick = newPicksTotal > 0 ? newTotalDuration / newPicksTotal : 0;
  const oldKnownMinimumDurationMs = 5 * 60 * 1000;
  const oldMsPerPickLowerBound = baselinePicks > 0 ? oldKnownMinimumDurationMs / baselinePicks : 0;

  const phaseTotals = newPhases.reduce((map, row) => {
    const phase = row.phase || "unknown";
    const value = Number(row.durationMs || 0);
    map.set(phase, (map.get(phase) ?? 0) + value);
    return map;
  }, new Map<string, number>());
  const phaseRows = [...phaseTotals.entries()]
    .map(([phase, durationMs]) => ({ phase, durationMs: round(durationMs) }))
    .sort((left, right) => right.durationMs - left.durationMs);

  const comparison = {
    baseline: {
      source: OLD_REDFRAFT_DIR,
      start: oldStart,
      stoppedAt: oldStopped,
      stopReason: oldRedraft?.summary.stopReason ?? oldTopup?.blocker ?? "unknown",
      picks: baselinePicks,
      teamsBelowMin: oldRedraft?.summary.teamsUnderMin.length ?? oldTopup?.teamsBelowMin.length ?? null,
      roundsCompleted: 8,
      durationTotalMsKnownLowerBound: oldKnownMinimumDurationMs,
      msPerPickKnownLowerBound: round(oldMsPerPickLowerBound),
      memoryPeakMb: "unknown",
      note: "Alter Redraft hatte keine durchgehenden Phase-Timings; mindestens 5 Minuten Stillstand vor Stop sind dokumentiert.",
    },
    newRun: {
      source: NEW_PROOF_DIR,
      durationTotalMs: round(newTotalDuration),
      durationTotalSeconds: round(newTotalDuration / 1000),
      picks: newPicksTotal,
      msPerPick: round(newMsPerPick),
      memoryPeakMb: newSummary?.memoryPeakMb ?? null,
      teamsBelowMin: newSummary?.teamsBelowMin.length ?? null,
      duplicatePlayers: newSummary?.duplicatePlayers.length ?? null,
      negativeCashTeams: newSummary?.negativeCashTeams.length ?? null,
      slowestPickMs: newSummary?.slowestPick?.durationMs ?? null,
      slowestPhase: phaseRows[0] ?? null,
    },
    acceptance: {
      under10Minutes: newTotalDuration < 10 * 60 * 1000,
      under5Minutes: newTotalDuration < 5 * 60 * 1000,
      avgPickUnder1000Ms: newMsPerPick < 1000,
      avgPickUnder500Ms: newMsPerPick < 500,
      allTeamsAtMin: (newSummary?.teamsBelowMin.length ?? 1) === 0,
    },
  };

  const pickTimingRows = newPicks.map((row) => ({
    round: row.round,
    teamId: row.teamId,
    playerId: row.playerId,
    playerName: row.playerName,
    durationMs: row.durationMs,
    selectedScore: row.selectedScore,
    candidateCount: row.candidateCount,
    previewCalls: row.previewCalls,
    topRejectedCandidates: row.topRejectedCandidates,
  }));
  const slowestRows = [...pickTimingRows]
    .sort((left, right) => Number(right.durationMs || 0) - Number(left.durationMs || 0))
    .slice(0, 20);

  writeJson("redraft-performance-baseline.json", {
    generatedAt: new Date().toISOString(),
    comparison,
    phaseTotals: phaseRows,
  });
  writeCsv("redraft-pick-timings.csv", pickTimingRows);
  writeCsv("redraft-slowest-picks.csv", slowestRows);
  writeMarkdown(
    "redraft-performance-baseline.md",
    [
      "# Redraft Performance Baseline",
      "",
      "## Alter Lauf",
      `- Start: ${comparison.baseline.start}`,
      `- Stop: ${comparison.baseline.stoppedAt}`,
      `- Stop-Grund: ${comparison.baseline.stopReason}`,
      `- Erfolgreiche Picks: ${comparison.baseline.picks}`,
      `- Teams unter playerMin: ${comparison.baseline.teamsBelowMin}`,
      `- Abgeschlossene Runden: ${comparison.baseline.roundsCompleted}`,
      `- Dokumentierte Mindest-Laufzeit vor Stop: ${round(oldKnownMinimumDurationMs / 1000)}s`,
      `- Mindest-ms/Pick: ${comparison.baseline.msPerPickKnownLowerBound}`,
      "",
      "## Neuer Chunked Lauf",
      `- Laufzeit: ${comparison.newRun.durationTotalSeconds}s`,
      `- Picks: ${comparison.newRun.picks}`,
      `- ms/Pick: ${comparison.newRun.msPerPick}`,
      `- Memory Peak: ${comparison.newRun.memoryPeakMb} MB`,
      `- Teams unter playerMin: ${comparison.newRun.teamsBelowMin}`,
      `- Doppelte Spieler: ${comparison.newRun.duplicatePlayers}`,
      `- Negative Cash Teams: ${comparison.newRun.negativeCashTeams}`,
      `- Langsamster Pick: ${comparison.newRun.slowestPickMs}ms`,
      `- Langsamste Phase: ${comparison.newRun.slowestPhase?.phase ?? "n/a"} (${comparison.newRun.slowestPhase?.durationMs ?? "n/a"}ms)`,
      "",
      "## Acceptance",
      `- Unter 10 Minuten: ${comparison.acceptance.under10Minutes ? "ja" : "nein"}`,
      `- Unter 5 Minuten: ${comparison.acceptance.under5Minutes ? "ja" : "nein"}`,
      `- Avg Pick <1000ms: ${comparison.acceptance.avgPickUnder1000Ms ? "ja" : "nein"}`,
      `- Avg Pick <500ms: ${comparison.acceptance.avgPickUnder500Ms ? "ja" : "nein"}`,
      `- Alle Teams >= playerMin: ${comparison.acceptance.allTeamsAtMin ? "ja" : "nein"}`,
    ].join("\n"),
  );

  writeMarkdown(
    "lineup-efficiency-risk-report.md",
    [
      "# Lineup Efficiency Risk Report",
      "",
      "- Risiko: repeated full roster scans pro Slot koennen bei D1/D2 parallel teuer werden.",
      "- Risiko: repeated validator calls mit identischem Input sollten per Lineup-State-Signature gecacht werden.",
      "- Risiko: repeated context build fuer gleiche Save/Team/Matchday-Kombination sollte lazy/deferred bleiben.",
      "- Risiko: candidate ranking pro Slot sollte PlayerScore/DisciplineScore pro Matchday wiederverwenden.",
      "- Risiko: D1/D2-Konflikte sollten einmal aus Assignment-Map berechnet werden, nicht pro Slot neu.",
      "- Noch keine breite Optimierung in diesem Block umgesetzt.",
    ].join("\n"),
  );

  console.log(JSON.stringify(comparison, null, 2));
}

buildBaseline();
