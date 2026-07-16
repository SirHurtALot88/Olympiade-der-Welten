import fs from "node:fs";
import path from "node:path";

import { createGameStateFromSeed, loadSeedData } from "@/lib/data/dataAdapter";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import {
  buildPlayerBaselineAudit,
  createNewGameFromPlayerBaseline,
  ensurePlayerBaselines,
} from "@/lib/players/player-baseline-service";

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
  const checksumRows = audit.checksumRows.map((row) => ({
    playerId: row.playerId,
    playerName: row.playerName,
    baselineVersion: row.baselineVersion,
    source: row.source,
    sourceFile: row.sourceFile,
    sourceHash: row.sourceHash,
    checksum: row.checksum,
    checksumValid: row.checksumValid,
    importedAt: row.importedAt,
    createdAt: row.createdAt,
    reconstructionWarning: row.reconstructionWarning,
  }));
  const economyRows = audit.economyRows
    .sort((left, right) => Math.abs(right.marketValueDelta ?? 0) - Math.abs(left.marketValueDelta ?? 0))
    .map((row) => ({
      playerId: row.playerId,
      playerName: row.playerName,
      baselineMarketValue: row.baselineMarketValue,
      baselineSalary: row.baselineSalary,
      baselinePurchasePrice: row.baselinePurchasePrice,
      currentMarketValue: row.currentMarketValue,
      currentSalary: row.currentSalary,
      marketValueDelta: row.marketValueDelta,
      salaryDelta: row.salaryDelta,
      source: row.source,
      marketValueSource: row.marketValueSource,
      salarySource: row.salarySource,
    }));
  const proofPlayer = save.gameState.players.find((player) => player.attributeSheetStats?.power != null) ?? save.gameState.players[0] ?? null;
  const proofBaseline = proofPlayer
    ? save.gameState.playerBaselines?.find((baseline) => baseline.playerId === proofPlayer.id) ?? null
    : null;
  const mutatedForProof =
    proofPlayer && proofBaseline
      ? {
          ...save.gameState,
          players: save.gameState.players.map((player) =>
            player.id === proofPlayer.id
              ? {
                  ...player,
                  attributeSheetStats: { ...(player.attributeSheetStats ?? {}), power: 99 },
                  currentXP: 123,
                  spentXP: 45,
                  lifetimeXP: 999,
                  fatigue: 88,
                  currentDisciplineValues: {},
                }
              : player,
          ),
          playerProgressionEvents: [
            ...(save.gameState.playerProgressionEvents ?? []),
            {
              eventId: "baseline-reset-proof-event",
              seasonId: save.gameState.season.id,
              teamId: "proof",
              playerId: proofPlayer.id,
              upgrades: [],
              xpSpent: 45,
              timestamp: new Date().toISOString(),
              source: "manual_season_end_xp_spend" as const,
            },
          ],
        }
      : null;
  const resetProof = mutatedForProof ? createNewGameFromPlayerBaseline({ gameState: mutatedForProof }) : null;
  const resetProofPlayer = resetProof?.gameState.players.find((player) => player.id === proofPlayer?.id) ?? null;

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
    JSON.stringify({ summary, missingRows, deltaRows, economyRows, reconstructedRows }, null, 2),
  );
  const missingCsvPath = writeOutput(
    "player-baseline-missing.csv",
    toCsv(missingRows, ["playerId", "playerName", "warning"]),
  );
  const deltaCsvPath = writeOutput(
    "player-baseline-delta.csv",
    toCsv(deltaRows, ["playerId", "playerName", "attribute", "baselineValue", "currentValue", "delta"]),
  );
  const checksumCsvPath = writeOutput(
    "player-baseline-checksum-audit.csv",
    toCsv(checksumRows, [
      "playerId",
      "playerName",
      "baselineVersion",
      "source",
      "sourceFile",
      "sourceHash",
      "checksum",
      "checksumValid",
      "importedAt",
      "createdAt",
      "reconstructionWarning",
    ]),
  );
  const economyCsvPath = writeOutput(
    "player-baseline-season0-economy.csv",
    toCsv(economyRows, [
      "playerId",
      "playerName",
      "baselineMarketValue",
      "baselineSalary",
      "baselinePurchasePrice",
      "currentMarketValue",
      "currentSalary",
      "marketValueDelta",
      "salaryDelta",
      "source",
      "marketValueSource",
      "salarySource",
    ]),
  );
  const resetProofPath = writeOutput(
    "player-baseline-reset-proof.json",
    JSON.stringify(
      {
        ok: resetProof?.ok ?? false,
        proofPlayerId: proofPlayer?.id ?? null,
        proofPlayerName: proofPlayer?.name ?? null,
        baselinePower: proofBaseline?.attributes.power ?? null,
        resetPower: resetProofPlayer?.attributeSheetStats?.power ?? null,
        resetCurrentXP: resetProofPlayer?.currentXP ?? null,
        resetSpentXP: resetProofPlayer?.spentXP ?? null,
        resetLifetimeXP: resetProofPlayer?.lifetimeXP ?? null,
        resetFatigue: resetProofPlayer?.fatigue ?? null,
        resetProgressionEvents: resetProof?.gameState.playerProgressionEvents?.length ?? null,
        currentDisciplineValuesFromBaseline:
          proofBaseline && resetProofPlayer
            ? JSON.stringify(resetProofPlayer.currentDisciplineValues ?? {}) === JSON.stringify(proofBaseline.disciplineRatings ?? {})
            : false,
        blockers: resetProof?.blockers ?? [],
      },
      null,
      2,
    ),
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
      `- Season-0 Economy Referenzen: ${summary.seasonZeroEconomyReferenceCount}`,
      `- Fehlende berechnete Economy Referenzen: ${summary.missingComputedEconomyReferenceCount}`,
      `- Baseline-Versionen: ${summary.baselineVersions.join(", ") || "—"}`,
      `- Ungültige Checksums: ${summary.invalidChecksumCount}`,
      `- Write-Guard Events: ${summary.writeGuardEventCount}`,
      `- Baselines in diesem Run persistiert: ${summary.persistedBaselinesThisRun ? "ja" : "nein"}`,
      `- Warnings: ${summary.ensureWarnings.length > 0 ? summary.ensureWarnings.join(" | ") : "none"}`,
      "",
      "## Dateien",
      "",
      `- JSON: ${jsonPath}`,
      `- Missing CSV: ${missingCsvPath}`,
      `- Delta CSV: ${deltaCsvPath}`,
      `- Season-0 Economy CSV: ${economyCsvPath}`,
      `- Checksum CSV: ${checksumCsvPath}`,
      `- Reset Proof: ${resetProofPath}`,
      "",
    ].join("\n"),
  );
  const hardeningMarkdownPath = writeOutput(
    "player-baseline-hardening-audit.md",
    [
      "# Player Baseline Hardening Audit",
      "",
      `- Save: ${save.name} (${save.saveId})`,
      `- Baseline-Versionen: ${summary.baselineVersions.join(", ") || "—"}`,
      `- Source Hashes vorhanden: ${checksumRows.filter((row) => row.sourceHash).length}/${checksumRows.length}`,
      `- Checksums gueltig: ${checksumRows.filter((row) => row.checksumValid).length}/${checksumRows.length}`,
      `- Season-0 Economy Referenzen: ${summary.seasonZeroEconomyReferenceCount}/${summary.baselineCount}`,
      `- Write-Guard Events: ${summary.writeGuardEventCount}`,
      `- Reset Proof OK: ${resetProof?.ok ? "ja" : "nein"}`,
      `- Reset Proof XP leer: ${resetProofPlayer?.currentXP === 0 && resetProofPlayer?.spentXP === 0 ? "ja" : "nein"}`,
      `- Reset Proof Progression-Events leer: ${(resetProof?.gameState.playerProgressionEvents?.length ?? -1) === 0 ? "ja" : "nein"}`,
      "",
      "## Dateien",
      "",
      `- Checksum CSV: ${checksumCsvPath}`,
      `- Season-0 Economy CSV: ${economyCsvPath}`,
      `- Reset Proof: ${resetProofPath}`,
      `- Legacy Audit: ${markdownPath}`,
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
          hardeningMarkdown: hardeningMarkdownPath,
          json: jsonPath,
          missingCsv: missingCsvPath,
          deltaCsv: deltaCsvPath,
          economyCsv: economyCsvPath,
          checksumCsv: checksumCsvPath,
          resetProof: resetProofPath,
        },
      },
      null,
      2,
    ),
  );
}

main();
