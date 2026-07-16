import fs from "node:fs";
import path from "node:path";

import type { PhaseAuditResult } from "@/lib/season/long-run-phase-audit";

export type LongRunObservationCategory = "perf" | "expectation" | "balance";

export type LongRunObservation = {
  category: LongRunObservationCategory;
  phase: string;
  message: string;
  detail?: string;
};

export const LONG_RUN_OBSERVATIONS_FILE = "long-run-observations.md";

const DRAFT_SLOW_MS = 10 * 60 * 1000;
const SEASON_PHASE_SLOW_MS = 45 * 60 * 1000;

const BALANCE_CHECK_IDS = new Set([
  "organic_league_net_delta",
  "transfer_profit_activity",
  "recovery_center_adoption",
]);

function observationsPath(outputDir: string) {
  return path.join(outputDir, LONG_RUN_OBSERVATIONS_FILE);
}

function formatObservationLine(entry: LongRunObservation, timestamp = new Date().toISOString()) {
  const detail = entry.detail ? ` — ${entry.detail}` : "";
  return `- [${timestamp}] **${entry.category}** · ${entry.phase} · ${entry.message}${detail}`;
}

export function appendObservation(outputDir: string, entry: LongRunObservation) {
  fs.mkdirSync(outputDir, { recursive: true });
  const filePath = observationsPath(outputDir);
  const line = `${formatObservationLine(entry)}\n`;
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, `# Long-Run Beobachtungen\n\n${line}`);
    return;
  }
  fs.appendFileSync(filePath, line);
}

export function readObservationsMarkdown(outputDir: string) {
  const filePath = observationsPath(outputDir);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, "utf8").trimEnd();
}

export function logSlowPhaseObservation(
  outputDir: string,
  input: { phase: string; durationMs: number; seasonId?: string },
) {
  const isDraft = input.phase === "draft";
  const thresholdMs = isDraft ? DRAFT_SLOW_MS : SEASON_PHASE_SLOW_MS;
  if (input.durationMs <= thresholdMs) return;

  const minutes = Math.round(input.durationMs / 60_000);
  const thresholdMinutes = Math.round(thresholdMs / 60_000);
  appendObservation(outputDir, {
    category: "perf",
    phase: input.seasonId ? `${input.seasonId}/${input.phase}` : input.phase,
    message: `${isDraft ? "Draft" : "Saison-Phase"} >${thresholdMinutes}min`,
    detail: `${minutes}min`,
  });
}

export function logPhaseAuditObservations(outputDir: string, audit: PhaseAuditResult) {
  for (const check of audit.checks) {
    if (check.status === "WARN" || check.status === "RED") {
      appendObservation(outputDir, {
        category: "expectation",
        phase: audit.phase,
        message: `Audit ${check.status}: ${check.id}`,
        detail: check.detail,
      });
    }

    if (check.status === "WARN" && BALANCE_CHECK_IDS.has(check.id)) {
      appendObservation(outputDir, {
        category: "balance",
        phase: audit.phase,
        message: check.id,
        detail: check.detail,
      });
    }
  }
}

export function logRunPausedObservation(
  outputDir: string,
  input: { phase: string; reason: string; seasonId?: string },
) {
  appendObservation(outputDir, {
    category: "expectation",
    phase: input.phase,
    message: "RUN-PAUSED",
    detail: input.seasonId ? `${input.seasonId}: ${input.reason}` : input.reason,
  });
}

export function logAuditJsonObservations(outputDir: string, auditJsonPath: string) {
  if (!fs.existsSync(auditJsonPath)) return;
  const audit = JSON.parse(fs.readFileSync(auditJsonPath, "utf8")) as PhaseAuditResult;
  logPhaseAuditObservations(outputDir, audit);
}
