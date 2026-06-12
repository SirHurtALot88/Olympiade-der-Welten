import fs from "node:fs";
import path from "node:path";

import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { getSandboxLocalWritePolicy } from "@/lib/persistence/sandbox-write-permissions";
import { withScenarioMeta } from "@/lib/persistence/scenario-meta";

const SANDBOX_LABEL = "Oly Sandbox Multi-Season Test";
const SANDBOX_DESCRIPTION =
  "Persistenter Testsave fuer echte lokale Season-Simulationen, Balancing und UI-Pruefung.";
const SNAPSHOT_LABEL = "Oly Sandbox Before Multi-Season Run";
const SNAPSHOT_DESCRIPTION =
  "Archivierter Ruecksprungpunkt vor groesseren Sandbox-Multi-Season-Tests.";

function ensureOutputDir() {
  const outputDir =
    process.env.OLY_OUTPUT_DIR ??
    "/Users/chrisfalk/Documents/Codex/2026-06-11/wir-machen-weiter-mit-dem-olympiade/outputs";
  fs.mkdirSync(outputDir, { recursive: true });
  return outputDir;
}

function writeSummary(outputDir: string, summary: Record<string, unknown>) {
  const jsonPath = path.join(outputDir, "sandbox-save-v1-summary.json");
  const markdownPath = path.join(outputDir, "sandbox-save-v1-summary.md");
  fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  fs.writeFileSync(
    markdownPath,
    [
      "# Sandbox Save V1",
      "",
      `- Active save: ${summary.activeSaveName} (${summary.activeSaveId})`,
      `- Snapshot: ${summary.snapshotName} (${summary.snapshotSaveId})`,
      `- Scenario type: ${summary.scenarioType}`,
      `- Allow test writes: ${summary.allowTestWrites}`,
      `- Snapshot status: ${summary.snapshotStatus}`,
      `- Local service writes: ${summary.writePolicy && typeof summary.writePolicy === "object" && "allowLocalServiceWrites" in summary.writePolicy ? summary.writePolicy.allowLocalServiceWrites : "—"}`,
      `- Prisma writes: verboten`,
      `- Remote writes: verboten`,
      `- Direct inserts: verboten`,
      "",
    ].join("\n"),
    "utf8",
  );
  return { jsonPath, markdownPath };
}

function main() {
  const persistence = createPersistenceService();
  const active = persistence.bootstrapSingleplayerSave().save;
  const now = new Date().toISOString();

  const existingSnapshotSummary = persistence
    .listSaves()
    .find(
      (save) =>
        save.name === SNAPSHOT_LABEL &&
        save.scenarioMeta?.scenarioType === "sandbox_snapshot" &&
        save.scenarioMeta.sourceSaveId === active.saveId,
    );
  const snapshot =
    (existingSnapshotSummary ? persistence.getSaveById(existingSnapshotSummary.saveId) : null) ??
    persistence.createScenarioSnapshot({
      sourceSaveId: active.saveId,
      name: SNAPSHOT_LABEL,
      status: "archived",
      scenarioMeta: {
        scenarioType: "sandbox_snapshot",
        label: SNAPSHOT_LABEL,
        description: SNAPSHOT_DESCRIPTION,
        createdAt: now,
        sourceSaveId: active.saveId,
        isStableTestPoint: true,
        allowTestWrites: false,
        containsFinalStandings: active.gameState.scenarioMeta?.containsFinalStandings ?? false,
        containsSeasonHistory: active.gameState.scenarioMeta?.containsSeasonHistory ?? false,
        activeSeasonId: active.gameState.season.id,
        activeMatchday: active.gameState.season.currentMatchday,
        gamePhase: active.gameState.gamePhase ?? "season_active",
      },
    });

  const sandboxGameState = withScenarioMeta(active.gameState, {
    scenarioType: "sandbox_multiseason_test",
    label: SANDBOX_LABEL,
    description: SANDBOX_DESCRIPTION,
    createdAt: active.gameState.scenarioMeta?.createdAt ?? now,
    sourceSaveId: active.gameState.scenarioMeta?.sourceSaveId,
    isStableTestPoint: true,
    allowTestWrites: true,
    containsSeasonHistory: true,
  });
  const sandbox = persistence.saveSingleplayerState(active.saveId, sandboxGameState);
  persistence.activateSave(sandbox.saveId);

  const summary = {
    activeSaveId: sandbox.saveId,
    activeSaveName: sandbox.name,
    snapshotSaveId: snapshot.saveId,
    snapshotName: snapshot.name,
    snapshotStatus: snapshot.status,
    scenarioType: sandbox.gameState.scenarioMeta?.scenarioType,
    label: sandbox.gameState.scenarioMeta?.label,
    description: sandbox.gameState.scenarioMeta?.description,
    allowTestWrites: sandbox.gameState.scenarioMeta?.allowTestWrites,
    containsSeasonHistory: sandbox.gameState.scenarioMeta?.containsSeasonHistory,
    containsFinalStandings: sandbox.gameState.scenarioMeta?.containsFinalStandings,
    activeSeasonId: sandbox.gameState.scenarioMeta?.activeSeasonId,
    activeMatchday: sandbox.gameState.scenarioMeta?.activeMatchday,
    gamePhase: sandbox.gameState.scenarioMeta?.gamePhase,
    writePolicy: getSandboxLocalWritePolicy(sandbox),
  };
  const paths = writeSummary(ensureOutputDir(), summary);

  console.log(JSON.stringify({ ...summary, ...paths }, null, 2));
}

main();
