/**
 * Append a long-run observation or ingest audit JSON checks.
 *
 * Usage:
 *   tsx scripts/append-long-run-observation.ts --output-dir outputs/... --category perf --phase draft --message "..." [--detail "..."]
 *   tsx scripts/append-long-run-observation.ts --output-dir outputs/... --from-audit path/to/audit.json
 *   tsx scripts/append-long-run-observation.ts --output-dir outputs/... --slow-phase draft --duration-ms 720000
 */

import {
  appendObservation,
  logAuditJsonObservations,
  logSlowPhaseObservation,
  type LongRunObservationCategory,
} from "@/lib/season/long-run-observation-log";

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

  const auditPath = argValue("--from-audit");
  if (auditPath) {
    logAuditJsonObservations(outputDir, auditPath);
    return;
  }

  const slowPhase = argValue("--slow-phase");
  const durationMs = Number(argValue("--duration-ms") ?? "0");
  if (slowPhase && durationMs > 0) {
    logSlowPhaseObservation(outputDir, {
      phase: slowPhase,
      durationMs,
      seasonId: argValue("--season-id") ?? undefined,
    });
    return;
  }

  const category = argValue("--category") as LongRunObservationCategory | null;
  const phase = argValue("--phase");
  const message = argValue("--message");
  if (!category || !phase || !message) {
    throw new Error("Missing --category, --phase, and --message (or use --from-audit / --slow-phase)");
  }

  appendObservation(outputDir, {
    category,
    phase,
    message,
    detail: argValue("--detail") ?? undefined,
  });
}

main();
