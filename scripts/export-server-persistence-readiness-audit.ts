import fs from "node:fs";
import path from "node:path";

import { createPersistenceService } from "@/lib/persistence/persistence-service";
import {
  buildServerPersistenceReadinessAudit,
  exportLocalSandboxSaveForServer,
  importServerGameSave,
} from "@/lib/server/server-save-migration";

const OUTPUT_DIR =
  process.env.OLY_OUTPUT_DIR ??
  "/Users/chrisfalk/Documents/Codex/2026-06-11/wir-machen-weiter-mit-dem-olympiade/outputs";

function writeOutput(name: string, content: string) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const filePath = path.join(OUTPUT_DIR, name);
  fs.writeFileSync(filePath, content.endsWith("\n") ? content : `${content}\n`, "utf8");
  return filePath;
}

function issueLine(issue: { code: string; severity: string; message: string; count?: number }) {
  const count = Number.isFinite(issue.count) ? ` (${issue.count})` : "";
  return `- ${issue.severity}: ${issue.code}${count} - ${issue.message}`;
}

function renderMarkdown(input: {
  audit: ReturnType<typeof buildServerPersistenceReadinessAudit>;
  importDryRun: ReturnType<typeof importServerGameSave>;
}) {
  const { audit, importDryRun } = input;
  return [
    "# Server Persistence Readiness Audit",
    "",
    "## Aktiver Save",
    "",
    `- Save: ${audit.save.name} (${audit.save.saveId})`,
    `- Season: ${audit.save.activeSeasonId}`,
    `- Matchday: ${audit.save.activeMatchday ?? "-"}`,
    `- GamePhase: ${audit.save.gamePhase}`,
    `- Scenario: ${audit.save.scenarioType ?? "-"}`,
    `- saveVersion: ${audit.save.saveVersion}`,
    "",
    "## Validierung",
    "",
    `- Export OK: ${audit.validation.ok ? "ja" : "nein"}`,
    `- Import Dry-Run OK: ${importDryRun.ok ? "ja" : "nein"}`,
    `- Produktive Writes: ${importDryRun.productiveWrites ? "ja" : "nein"}`,
    `- Spieler/Baselines: ${audit.validation.counts.players}/${audit.validation.counts.playerBaselines}`,
    `- Teams: ${audit.validation.counts.teams}`,
    `- Aktive Kaderplaetze: ${audit.validation.counts.activeRosterEntries}`,
    `- Transferhistorie: ${audit.validation.counts.transferHistory}`,
    `- Season Snapshots: ${audit.validation.counts.seasonSnapshots}`,
    `- Matchday Results: ${audit.validation.counts.matchdayResults}`,
    `- Lineups/Formkarten: ${audit.validation.counts.lineups}/${audit.validation.counts.formCards}`,
    "",
    "### Blocker",
    "",
    ...(audit.validation.blockers.length ? audit.validation.blockers.map(issueLine) : ["- keine"]),
    "",
    "### Warnings",
    "",
    ...(audit.validation.warnings.length ? audit.validation.warnings.map(issueLine) : ["- keine"]),
    "",
    "## Dateninventar",
    "",
    ...audit.dataInventory.map(
      (row) =>
        `- ${row.area}: ${row.currentSource}, ${row.mode}, server=${row.laterServerPersistence}. ${row.notes}`,
    ),
    "",
    "## Write-Pfade",
    "",
    `- Lokal okay: ${audit.writePaths.localOkay.join(", ")}`,
    `- Server-pflichtig: ${audit.writePaths.serverRequired.join(", ")}`,
    `- Verboten: ${audit.writePaths.forbidden.join(", ")}`,
    "",
    "## Server-Modell V1",
    "",
    `- Save Record Felder: ${audit.serverModel.saveRecordFields.join(", ")}`,
    `- State Buckets: ${audit.serverModel.stateBuckets.join(", ")}`,
    `- Baseline Policy: ${audit.serverModel.baselinePolicy}`,
    "",
    "## Konflikte / Versionierung",
    "",
    `- Version: ${audit.concurrency.versionField}`,
    `- Idempotenz: ${audit.concurrency.idempotencyField}`,
    `- Konflikte: ${audit.concurrency.conflictCodes.join(", ")}`,
    "",
    "## Deployment-Readiness",
    "",
    `- ENV: ${audit.deploymentReadiness.envVars.join(", ")}`,
    `- Infrastruktur: ${audit.deploymentReadiness.infrastructure.join(", ")}`,
    `- Offen: ${audit.deploymentReadiness.openItems.join(", ")}`,
    "",
  ].join("\n");
}

function main() {
  const persistence = createPersistenceService();
  const save = persistence.getActiveSave();
  if (!save) {
    throw new Error("No active local save found. Refusing to bootstrap or switch saves for this audit.");
  }

  const exportPayload = exportLocalSandboxSaveForServer(save);
  const importDryRun = importServerGameSave(exportPayload);
  const audit = buildServerPersistenceReadinessAudit(save);
  const jsonPath = writeOutput(
    "server-persistence-readiness-audit.json",
    JSON.stringify({ audit, exportPayload, importDryRun }, null, 2),
  );
  const markdownPath = writeOutput("server-persistence-readiness-audit.md", renderMarkdown({ audit, importDryRun }));

  console.log(
    JSON.stringify(
      {
        ok: audit.validation.ok,
        saveId: save.saveId,
        saveName: save.name,
        exports: {
          markdown: markdownPath,
          json: jsonPath,
        },
        blockers: audit.validation.blockers,
        warnings: audit.validation.warnings,
      },
      null,
      2,
    ),
  );
}

main();
