/**
 * Validate S1 draft theme/vibe gate before continuing simulation.
 *
 * Default: exit 0 and emit WARN on failure (non-blocking for pipeline).
 * Use --strict to exit 1 when hard theme minimums are missed.
 *
 * Usage: npx tsx scripts/validate-draft-theme-gate.ts --save-id <id> [--strict]
 */
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { auditDraftThemeComposition } from "@/lib/season/draft-theme-gate-service";

const PROJECT_ROOT = path.resolve(__dirname, "..");

function argValue(flag: string) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

async function main() {
  loadEnvConfig(PROJECT_ROOT);
  const saveId = argValue("--save-id");
  if (!saveId) throw new Error("Missing --save-id");

  const save = createPersistenceService().getSaveById(saveId);
  if (!save) throw new Error(`Save not found: ${saveId}`);

  const audit = auditDraftThemeComposition(save.gameState);
  const payload = {
    saveId,
    pass: audit.pass,
    failures: audit.failures,
    warnings: audit.warnings,
    statusCounts: audit.statusCounts,
    hardRedTeams: audit.hardRedTeams,
    strongWarnTeams: audit.strongWarnTeams,
  };

  console.log(JSON.stringify(payload, null, 2));
  if (!audit.pass) {
    const hardRedSummary = audit.hardRedTeams.map((row) => `${row.code}:${row.primaryPct}%<${row.minPct}%`).join(", ");
    console.warn(
      `[draft-theme-gate] WARN: pass=false — ${audit.failures.length} failure(s), ${audit.hardRedTeams.length} hard red team(s)${hardRedSummary ? `: ${hardRedSummary}` : ""}`,
    );
    if (process.argv.includes("--strict")) process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
