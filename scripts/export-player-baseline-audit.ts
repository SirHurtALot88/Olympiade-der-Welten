import fs from "node:fs";
import path from "node:path";

import { createGameStateFromSeed, loadSeedData } from "@/lib/data/dataAdapter";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { buildPlayerBaselineAudit, ensurePlayerBaselines } from "@/lib/players/player-baseline-service";

const OUTPUT_DIR =
  process.env.OLY_OUTPUT_DIR ??
  "/Users/chrisfalk/Documents/Codex/2026-06-11/wir-machen-weiter-mit-dem-olympiade/outputs";

function csvEscape(value: unknown) {
  if (value == null) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows: Array<Record<string, unknown>>, columns: string[]) {
  return [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(",")),
  ].join("\n");
}

function writeOutput(name: string, content: string) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const filePath = path.join(OUTPUT_DIR, name);
  fs.writeFileSync(filePath, content.endsWith("\n") ? content : `${content}\n`, "utf8");
  return filePath;
}

function main() {
  const persistence = createPersistenceService();
  const active = persistence.bootstrapSingleplayerSave().save;
  const ensured = ensurePlayerBaselines(active.gameState, {
    sourcePlayers: createGameStateFromSeed(loadSeedData()).players,
    createdAt: active.createdAt,
  });
  const save = persistence.saveSingleplayerState(active.saveId, ensured.gameState);
  const audit = buildPlayerBaselineAudit(save.gameState);

  const missingRows = audit.missing.map((player) => ({
    playerId: player.id,
    playerName: player.name,
    warning: "player_baseline_missing",
  }));
  const deltaRows = audit.deltaRows
    .sort((left, right) => Math.abs(right.delta ?? 0) - Math.abs(left.delta ?? 0))
    .map((row) => ({
      playerId: row.playerId,
      playerName: row.playerName,
      attribute: row.attribute,
      baselineValue: row.baselineValue,
      currentValue: row.currentValue,
      delta: row.delta,
    }));
  const reconstructedRows = audit.reconstructed.map((baseline) => ({
    playerId: baseline.playerId,
    playerName: baseline.name,
    source: baseline.source,
    warning: baseline.reconstructionWarning,
  }));

  const summary = {
    saveId: save.saveId,
    saveName: save.name,
    scenarioType: save.gameState.scenarioMeta?.scenarioType ?? null,
    persistedBaselinesThisRun: true,
    ensureWarnings: ensured.warnings,
    ...audit.summary,
  };

  const jsonPath = writeOutput(
    "player-baseline-audit.json",
    JSON.stringify({ summary, missingRows, deltaRows, reconstructedRows }, null, 2),
  );
  const missingCsvPath = writeOutput(
    "player-baseline-missing.csv",
    toCsv(missingRows, ["playerId", "playerName", "warning"]),
  );
  const deltaCsvPath = writeOutput(
    "player-baseline-delta.csv",
    toCsv(deltaRows, ["playerId", "playerName", "attribute", "baselineValue", "currentValue", "delta"]),
  );
  const markdownPath = writeOutput(
    "player-baseline-audit.md",
    [
      "# Player Baseline Audit",
      "",
      `- Save: ${save.name} (${save.saveId})`,
      `- Spieler: ${summary.playerCount}`,
      `- Baselines: ${summary.baselineCount}`,
      `- Fehlende Baselines: ${summary.missingBaselineCount}`,
      `- Spieler mit Attribut-Deltas: ${summary.deltaPlayerCount}`,
      `- Delta-Zeilen: ${summary.deltaRowCount}`,
      `- Rekonstruierte Baselines: ${summary.reconstructedBaselineCount}`,
      `- Baseline-Versionen: ${summary.baselineVersions.join(", ") || "—"}`,
      `- Baselines in diesem Run persistiert: ${summary.persistedBaselinesThisRun ? "ja" : "nein"}`,
      `- Warnings: ${summary.ensureWarnings.length > 0 ? summary.ensureWarnings.join(" | ") : "none"}`,
      "",
      "## Dateien",
      "",
      `- JSON: ${jsonPath}`,
      `- Missing CSV: ${missingCsvPath}`,
      `- Delta CSV: ${deltaCsvPath}`,
      "",
    ].join("\n"),
  );

  console.log(
    JSON.stringify(
      {
        ok: audit.summary.missingBaselineCount === 0,
        summary,
        exports: {
          markdown: markdownPath,
          json: jsonPath,
          missingCsv: missingCsvPath,
          deltaCsv: deltaCsvPath,
        },
      },
      null,
      2,
    ),
  );
}

main();
