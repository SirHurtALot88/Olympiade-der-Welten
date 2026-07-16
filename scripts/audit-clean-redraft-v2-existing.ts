import fs from "node:fs";
import path from "node:path";

import type { AiPicksRunResult, AiPicksRunTeamResult } from "@/lib/ai/ai-picks-run-service";
import { buildRedraftRunAudit, buildRedraftTeamSpendAudit } from "@/lib/ai/redraft-mode-audit";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

const OUTPUT_DIR = "/Users/chrisfalk/Documents/Codex/2026-06-11/wir-machen-weiter-mit-dem-olympiade/outputs";
const EXECUTE_JSON_PATH = path.join(OUTPUT_DIR, "clean-redraft-execute.json");

function csvCell(value: unknown) {
  const normalized =
    value == null
      ? ""
      : Array.isArray(value)
        ? value.join(" | ")
        : typeof value === "object"
          ? JSON.stringify(value)
          : String(value);
  return `"${normalized.replaceAll(`"`, `""`)}"`;
}

function toCsv(rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) return "";
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return `${[
    headers.map(csvCell).join(","),
    ...rows.map((row) => headers.map((header) => csvCell(row[header] ?? "")).join(",")),
  ].join("\n")}\n`;
}

function round(value: number | null | undefined, digits = 4) {
  return value == null || !Number.isFinite(value) ? null : Number(value.toFixed(digits));
}

function activePicks(team: AiPicksRunTeamResult) {
  return team.plannedPicks.filter((pick) => pick.status !== "blocked");
}

function laneDistribution(team: AiPicksRunTeamResult) {
  const counts = new Map<string, number>();
  for (const pick of activePicks(team)) {
    counts.set(pick.pickLane, (counts.get(pick.pickLane) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "de"))
    .map(([label, count]) => `${label}:${count}`);
}

function spendRatio(team: AiPicksRunTeamResult) {
  const start = team.previewSummary.startingCash;
  const spend = team.previewSummary.plannedSpendTotal;
  return start != null && start > 0 && spend != null ? round(spend / start) : null;
}

function readExecuteResult() {
  const payload = JSON.parse(fs.readFileSync(EXECUTE_JSON_PATH, "utf8")) as { result?: AiPicksRunResult | null };
  if (!payload.result) {
    throw new Error("clean-redraft-execute.json does not contain an execute result.");
  }
  return payload.result;
}

function main() {
  const result = readExecuteResult();
  const persistence = createPersistenceService();
  const save = persistence.getSaveById(result.saveContext.resolvedSaveId);
  if (!save) {
    throw new Error(`Clean redraft save ${result.saveContext.resolvedSaveId} could not be found.`);
  }

  const boughtPlayers = result.teams.reduce((sum, team) => sum + activePicks(team).length, 0);
  const rosterAfter = save.gameState.rosters.length;
  const rosterBefore = Math.max(0, rosterAfter - boughtPlayers);
  const redraftAudit = buildRedraftRunAudit({
    rosterBefore,
    rosterAfter,
    removedPlayers: 0,
    boughtPlayers,
    resetTransfersCount: 0,
    manualTransfersPreserved: save.gameState.transferHistory.filter((entry) => entry.source !== "ai_roster_fill").length,
    aiTransfersReset: 0,
    facilityEventsPreserved: save.gameState.seasonState.facilityEvents?.length ?? 0,
    seasonResultsPreserved: Boolean(
      (save.gameState.seasonState.matchdayResults?.length ?? 0) > 0 ||
      (save.gameState.seasonState.disciplineResults?.length ?? 0) > 0,
    ),
  });

  const teamRows = result.teams.map((team) => {
    const bought = activePicks(team).length;
    const actualRoster = team.previewSummary.plannedRosterCount ?? team.rosterAfter ?? null;
    const targetRoster = team.targetRosterSize ?? team.targetRosterOpt ?? null;
    const lanes = laneDistribution(team);
    const spend = spendRatio(team);
    const spendAudit = buildRedraftTeamSpendAudit({
      teamCode: team.teamCode,
      actualRoster,
      targetRoster,
      boughtPlayers: bought,
      plannedSpend: team.previewSummary.plannedSpendTotal ?? null,
      spendRatio: spend,
      laneDistributionCount: lanes.length,
    });
    return {
      redraftMode: redraftAudit.redraftMode,
      teamCode: team.teamCode,
      teamName: team.teamName,
      actualRoster,
      targetRoster,
      boughtPlayers: bought,
      preservedPlayers: actualRoster == null ? null : Math.max(0, actualRoster - bought),
      spendRatio: spend,
      plannedSpend: round(team.previewSummary.plannedSpendTotal, 2),
      cashRest: round(team.previewSummary.cashAfterPlannedBuys, 2),
      laneDistribution: lanes,
      spendAuditReason: spendAudit.spendAuditReason,
      warnings: [...team.warnings, ...spendAudit.warnings],
    };
  });

  const zeroSpendRows = teamRows.filter((row) => row.spendRatio === 0 || row.boughtPlayers === 0);
  const md = [
    "# Clean Redraft V2 Mode Audit",
    "",
    `- Save: ${save.name} (${save.saveId})`,
    `- Redraft Mode: ${redraftAudit.redraftMode}`,
    `- Roster before/after: ${redraftAudit.rosterBefore} -> ${redraftAudit.rosterAfter}`,
    `- Bought/preserved/removed players: ${redraftAudit.boughtPlayers} / ${redraftAudit.preservedPlayers} / ${redraftAudit.removedPlayers}`,
    `- Reset transfers/manual preserved/AI reset: ${redraftAudit.resetTransfersCount} / ${redraftAudit.manualTransfersPreserved} / ${redraftAudit.aiTransfersReset}`,
    `- Facility events preserved: ${redraftAudit.facilityEventsPreserved}`,
    `- Season results preserved: ${redraftAudit.seasonResultsPreserved ? "true" : "false"}`,
    "",
    "## Einordnung",
    "",
    redraftAudit.redraftMode === "target_topup_redraft"
      ? "- Der Lauf war ein Target-/Top-Up-Redraft auf bestehender Kaderbasis, kein Full-Clean-Redraft von leer."
      : "- Der Lauf war ein Full-Clean-Redraft von leerer Kaderbasis.",
    "",
    "## SpendRatio 0 / Keine neuen Picks",
    "",
    ...zeroSpendRows.map((row) => `- ${row.teamCode}: ${row.spendAuditReason ?? "spend_nonzero_or_unclassified"}; bought=${row.boughtPlayers}; preserved=${row.preservedPlayers}; roster=${row.actualRoster}/${row.targetRoster ?? "—"}`),
    "",
    "## Full-Clean-Redraft Vorbereitung",
    "",
    "- vorbereitet_not_executed: Separaten Save anlegen, AI-Testkäufe entfernen, Cash auf Startbasis setzen, dann Full-Pool von leer picken.",
    "- Nicht ausgeführt: Für diesen Block wurden keine neuen Picks gekauft und kein Redraft-Reset durchgeführt.",
    "",
  ].join("\n");

  fs.writeFileSync(path.join(OUTPUT_DIR, "clean-redraft-mode-audit.md"), md, "utf8");
  fs.writeFileSync(path.join(OUTPUT_DIR, "clean-redraft-mode-audit.csv"), toCsv(teamRows), "utf8");
  fs.writeFileSync(
    path.join(OUTPUT_DIR, "clean-redraft-mode-audit.json"),
    `${JSON.stringify({
      generatedAt: new Date().toISOString(),
      saveId: save.saveId,
      seasonId: save.gameState.season.id,
      redraftAudit,
      teamSpendAudit: teamRows,
      fullCleanRedraftPrepared: {
        status: "prepared_not_executed",
        requiredExplicitApproval: true,
        steps: [
          "create separate save",
          "remove AI test buys from roster and transfer history",
          "reset cash to start basis",
          "run full-pool pick from empty roster",
        ],
      },
    }, null, 2)}\n`,
    "utf8",
  );

  console.log(JSON.stringify({ ok: true, redraftAudit, zeroSpendTeams: zeroSpendRows.length }, null, 2));
}

main();
