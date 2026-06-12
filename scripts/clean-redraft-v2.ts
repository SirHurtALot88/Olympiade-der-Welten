import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { AI_PICKS_RUN_CONFIRM_TOKEN } from "@/lib/ai/ai-picks-run-contract";
import {
  runAiPicksExecutePreview,
  type AiPicksRunResult,
  type AiPicksRunTeamResult,
} from "@/lib/ai/ai-picks-run-service";
import type { FormCardColor, GameState, Player } from "@/lib/data/olyDataTypes";
import { getPlayerClassColor } from "@/lib/lineups/legacy-lineup-modifiers";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { withScenarioMeta } from "@/lib/persistence/scenario-meta";
import { buildRedraftRunAudit, buildRedraftTeamSpendAudit, type RedraftRunAudit } from "@/lib/ai/redraft-mode-audit";

const OUTPUT_DIR = "/Users/chrisfalk/Documents/Codex/2026-06-11/wir-machen-weiter-mit-dem-olympiade/outputs";
const FOCUS_TEAMS = new Set(["M-M", "C-S", "C-C", "W-W", "T-T", "N-W", "G-G", "A-A", "R-R", "H-R", "B-P", "P-C", "Z-H"]);

type CliArgs = {
  saveId: string | null;
  execute: boolean;
  stepsPerTeam: number;
};

function parseArgs(argv: string[]): CliArgs {
  let saveId: string | null = null;
  let execute = false;
  let stepsPerTeam = 12;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--save-id") {
      saveId = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (token === "--execute") {
      execute = true;
      continue;
    }
    if (token === "--steps-per-team") {
      const parsed = Number(argv[index + 1] ?? "");
      stepsPerTeam = Number.isFinite(parsed) ? Math.max(1, Math.min(Math.round(parsed), 16)) : stepsPerTeam;
      index += 1;
    }
  }

  return { saveId, execute, stepsPerTeam };
}

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
  if (rows.length === 0) {
    return "";
  }
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return `${[
    headers.map(csvCell).join(","),
    ...rows.map((row) => headers.map((header) => csvCell(row[header] ?? "")).join(",")),
  ].join("\n")}\n`;
}

function round(value: number | null | undefined, digits = 2) {
  return value == null || !Number.isFinite(value) ? null : Number(value.toFixed(digits));
}

function activePicks(team: AiPicksRunTeamResult) {
  return team.plannedPicks.filter((pick) => pick.status !== "blocked");
}

function targetGap(team: AiPicksRunTeamResult) {
  const target = team.targetRosterSize ?? team.targetRosterOpt;
  const actual = team.previewSummary.plannedRosterCount ?? team.rosterAfter;
  return target == null ? null : Math.max(target - actual, 0);
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

function laneDistributionCount(team: AiPicksRunTeamResult) {
  return laneDistribution(team).length;
}

function spendRatio(team: AiPicksRunTeamResult) {
  const start = team.previewSummary.startingCash;
  const spend = team.previewSummary.plannedSpendTotal;
  return start != null && start > 0 && spend != null ? round(spend / start, 4) : null;
}

function axisToColor(axis: string | null | undefined): FormCardColor | null {
  if (axis === "pow") return "red";
  if (axis === "spe") return "green";
  if (axis === "men") return "blue";
  if (axis === "soc") return "yellow";
  return null;
}

function playerMap(gameState: GameState) {
  return new Map(gameState.players.map((player) => [player.id, player]));
}

function getRosterPlayerIds(gameState: GameState) {
  return gameState.rosters.map((entry) => entry.playerId);
}

function countDuplicates(ids: string[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      duplicates.add(id);
    }
    seen.add(id);
  }
  return duplicates.size;
}

function strictMetrics(result: AiPicksRunResult, gameState: GameState) {
  const picks = result.teams.flatMap(activePicks);
  const plannedIds = picks.map((pick) => pick.playerId);
  const rosterIds = getRosterPlayerIds(gameState);
  return {
    status: result.status,
    qualityGatePassed: result.qualityGate.passed,
    plannedPickCount: picks.length,
    teamsBelowMin: result.teams
      .filter((team) => {
        const min = team.targetRosterMin;
        const actual = team.previewSummary.plannedRosterCount ?? team.rosterAfter;
        return min != null && actual < min;
      })
      .map((team) => team.teamCode),
    targetGapGt2: result.teams
      .filter((team) => (targetGap(team) ?? 0) > 2)
      .map((team) => `${team.teamCode}:${team.previewSummary.plannedRosterCount ?? team.rosterAfter}/${team.targetRosterSize ?? team.targetRosterOpt}`),
    negativeAiScorePicks: picks.filter((pick) => pick.aiScore < 0).map((pick) => `${pick.playerName}:${pick.aiScore}`),
    negativeTeamIdentityPicks: picks
      .filter((pick) => (pick.scoreBreakdown.teamIdentityScore ?? 0) < 0)
      .map((pick) => `${pick.playerName}:${pick.scoreBreakdown.teamIdentityScore}`),
    valuePickDespiteThemeRiskPicks: picks
      .filter((pick) => pick.strategicExceptionReason === "value_pick_despite_theme_risk")
      .map((pick) => pick.playerName),
    costBandMismatchCount: picks.filter((pick) => !pick.costBandMatch).length,
    plannedDuplicateCount: countDuplicates(plannedIds),
    rosterDuplicateCount: countDuplicates(rosterIds),
    teamsUnderSeven: result.teams
      .filter((team) => (team.previewSummary.plannedRosterCount ?? team.rosterAfter) < 7)
      .map((team) => team.teamCode),
    cashMin: round(Math.min(...result.teams.map((team) => team.previewSummary.cashAfterPlannedBuys ?? team.cashAfter ?? 0))),
    cashMax: round(Math.max(...result.teams.map((team) => team.previewSummary.cashAfterPlannedBuys ?? team.cashAfter ?? 0))),
    freeAgents: gameState.players.length - rosterIds.length,
  };
}

function previewIsClean(result: AiPicksRunResult, gameState: GameState) {
  const metrics = strictMetrics(result, gameState);
  return (
    result.qualityGate.passed &&
    result.blockingReasons.length === 0 &&
    metrics.teamsBelowMin.length === 0 &&
    metrics.targetGapGt2.length === 0 &&
    metrics.negativeAiScorePicks.length === 0 &&
    metrics.negativeTeamIdentityPicks.length === 0 &&
    metrics.valuePickDespiteThemeRiskPicks.length === 0 &&
    metrics.costBandMismatchCount === 0 &&
    metrics.plannedDuplicateCount === 0
  );
}

function buildTeamRows(result: AiPicksRunResult) {
  const boughtByTeam = new Map(result.teams.map((team) => [team.teamCode, activePicks(team).length] as const));
  return result.teams.map((team) => ({
    redraftMode: inferRedraftRunAudit(result, null).redraftMode,
    saveId: result.saveContext.resolvedSaveId,
    seasonId: result.saveContext.resolvedSeasonId,
    teamCode: team.teamCode,
    teamName: team.teamName,
    focusTeam: FOCUS_TEAMS.has(team.teamCode),
    archetype: team.cashStrategy?.season1SpendArchetype ?? null,
    lanePlan: team.planner?.slotPlan ?? [],
    laneDistribution: laneDistribution(team),
    targetRoster: team.targetRosterSize ?? team.targetRosterOpt,
    actualRoster: team.previewSummary.plannedRosterCount ?? team.rosterAfter,
    boughtPlayers: boughtByTeam.get(team.teamCode) ?? 0,
    preservedPlayers: Math.max(0, (team.previewSummary.plannedRosterCount ?? team.rosterAfter ?? 0) - (boughtByTeam.get(team.teamCode) ?? 0)),
    minimumRoster: team.targetRosterMin,
    targetGap: targetGap(team),
    spendRatio: spendRatio(team),
    spendMinPct: team.cashStrategy?.season1SpendMinPct ?? null,
    spendMaxPct: team.cashStrategy?.season1SpendMaxPct ?? null,
    plannedSpend: round(team.previewSummary.plannedSpendTotal),
    cashRest: round(team.previewSummary.cashAfterPlannedBuys),
    negativeAiScorePicks: activePicks(team).filter((pick) => pick.aiScore < 0).map((pick) => pick.playerName),
    negativeTeamIdentityPicks: activePicks(team).filter((pick) => pick.scoreBreakdown.teamIdentityScore < 0).map((pick) => pick.playerName),
    valuePickDespiteThemeRiskPicks: activePicks(team).filter((pick) => pick.strategicExceptionReason === "value_pick_despite_theme_risk").map((pick) => pick.playerName),
    costBandMismatchCount: activePicks(team).filter((pick) => !pick.costBandMatch).length,
    spendAuditReason: buildRedraftTeamSpendAudit({
      teamCode: team.teamCode,
      actualRoster: team.previewSummary.plannedRosterCount ?? team.rosterAfter ?? null,
      targetRoster: team.targetRosterSize ?? team.targetRosterOpt ?? null,
      boughtPlayers: boughtByTeam.get(team.teamCode) ?? 0,
      plannedSpend: team.previewSummary.plannedSpendTotal ?? null,
      spendRatio: spendRatio(team),
      laneDistributionCount: laneDistributionCount(team),
    }).spendAuditReason,
    warnings: [
      ...team.warnings,
      ...buildRedraftTeamSpendAudit({
        teamCode: team.teamCode,
        actualRoster: team.previewSummary.plannedRosterCount ?? team.rosterAfter ?? null,
        targetRoster: team.targetRosterSize ?? team.targetRosterOpt ?? null,
        boughtPlayers: boughtByTeam.get(team.teamCode) ?? 0,
        plannedSpend: team.previewSummary.plannedSpendTotal ?? null,
        spendRatio: spendRatio(team),
        laneDistributionCount: laneDistributionCount(team),
      }).warnings,
    ],
    blockingReasons: team.blockingReasons,
  }));
}

function buildPickRows(result: AiPicksRunResult, playersById: Map<string, Player>) {
  return result.teams.flatMap((team) =>
    activePicks(team).map((pick) => {
      const player = playersById.get(pick.playerId) ?? null;
      return {
        saveId: result.saveContext.resolvedSaveId,
        seasonId: result.saveContext.resolvedSeasonId,
        teamCode: team.teamCode,
        teamName: team.teamName,
        focusTeam: FOCUS_TEAMS.has(team.teamCode),
        step: pick.step,
        playerId: pick.playerId,
        playerName: pick.playerName,
        className: pick.className,
        race: pick.race,
        playerClassColor: player ? getPlayerClassColor(player) : null,
        pickedForFormColor: pick.pickedForFormColor,
        formColorCoverageBefore: pick.formColorCoverageBefore ?? null,
        formColorCoverageAfter: pick.formColorCoverageAfter ?? null,
        doubleBoostPotential: Boolean(pick.formColorDoubleBoostPotential),
        relatedDisciplineColor: axisToColor(pick.plannedAxisNeed ?? pick.actualPlayerPrimaryAxis),
        colorFitReason: pick.formColorReason,
        plannedLane: pick.plannedLane,
        pickLane: pick.pickLane,
        pickPhase: pick.pickPhase,
        marketValue: pick.marketValue,
        salary: pick.salary,
        ovr: pick.ovr,
        aiScore: pick.aiScore,
        teamIdentityScore: pick.scoreBreakdown.teamIdentityScore,
        offThemePenalty: pick.scoreBreakdown.offThemePenalty,
        needMatchScore: pick.scoreBreakdown.needMatchScore,
        valueScore: pick.scoreBreakdown.valueScore,
        strategicExceptionReason: pick.strategicExceptionReason,
        costBandExpected: pick.costBandExpected,
        costBandActual: pick.costBandActual,
        costBandMatch: pick.costBandMatch,
        laneMatch: pick.laneMatch,
        axisMatch: pick.axisMatch,
        expectedCashAfter: pick.expectedCashAfter,
        reasons: pick.reasons,
        warnings: pick.warnings,
      };
    }),
  );
}

function buildRosterAuditRows(gameState: GameState) {
  const byTeam = new Map(gameState.teams.map((team) => [team.teamId, team]));
  const counts = new Map<string, number>();
  for (const entry of gameState.rosters) {
    counts.set(entry.teamId, (counts.get(entry.teamId) ?? 0) + 1);
  }
  return gameState.teams.map((team) => ({
    teamCode: team.shortCode,
    teamName: team.name,
    rosterCount: counts.get(team.teamId) ?? 0,
    cash: round(team.cash),
    playerIds: gameState.rosters.filter((entry) => entry.teamId === team.teamId).map((entry) => entry.playerId),
    duplicatePlayersInTeam: countDuplicates(gameState.rosters.filter((entry) => entry.teamId === team.teamId).map((entry) => entry.playerId)),
    teamKnown: Boolean(byTeam.get(team.teamId)),
  }));
}

function buildTransferRows(gameState: GameState) {
  const byTeam = new Map(gameState.teams.map((team) => [team.teamId, team]));
  const byPlayer = playerMap(gameState);
  return gameState.transferHistory.map((entry) => ({
    transferId: entry.id,
    source: entry.source,
    phase: entry.phase,
    seasonId: entry.seasonId,
    transferType: entry.transferType,
    playerId: entry.playerId,
    playerName: byPlayer.get(entry.playerId)?.name ?? entry.playerId,
    fromTeam: entry.fromTeamId ? byTeam.get(entry.fromTeamId)?.shortCode ?? entry.fromTeamId : null,
    toTeam: entry.toTeamId ? byTeam.get(entry.toTeamId)?.shortCode ?? entry.toTeamId : null,
    fee: entry.fee,
    salary: entry.salary,
    marketValue: entry.marketValue,
    happenedAt: entry.happenedAt,
  }));
}

function inferRedraftRunAudit(result: AiPicksRunResult, finalState: GameState | null): RedraftRunAudit {
  const boughtPlayers = result.teams.reduce((sum, team) => sum + activePicks(team).length, 0);
  const rosterAfter = finalState?.rosters.length ?? result.teams.reduce((sum, team) => sum + (team.previewSummary.plannedRosterCount ?? team.rosterAfter ?? 0), 0);
  const rosterBefore = Math.max(0, rosterAfter - boughtPlayers);
  const facilityEventsPreserved = finalState?.seasonState.facilityEvents?.length ?? 0;
  const seasonResultsPreserved = Boolean(
    (finalState?.seasonState.matchdayResults?.length ?? 0) > 0 ||
    (finalState?.seasonState.disciplineResults?.length ?? 0) > 0,
  );

  return buildRedraftRunAudit({
    rosterBefore,
    rosterAfter,
    removedPlayers: 0,
    boughtPlayers,
    resetTransfersCount: 0,
    manualTransfersPreserved: finalState?.transferHistory.filter((entry) => entry.source !== "ai_roster_fill").length ?? 0,
    aiTransfersReset: 0,
    facilityEventsPreserved,
    seasonResultsPreserved,
  });
}

function buildMarkdown(input: {
  title: string;
  result: AiPicksRunResult;
  gameState: GameState;
  clean: boolean;
  executed: boolean;
  executeSkippedReason?: string | null;
}) {
  const metrics = strictMetrics(input.result, input.gameState);
  const redraftAudit = inferRedraftRunAudit(input.result, input.gameState);
  const lines: string[] = [];
  lines.push(`# ${input.title}`);
  lines.push("");
  lines.push(`- Save: ${input.result.saveContext.saveName ?? "Unbekannt"} (${input.result.saveContext.resolvedSaveId})`);
  lines.push(`- Season: ${input.result.saveContext.resolvedSeasonId}`);
  lines.push(`- Redraft Mode: ${redraftAudit.redraftMode}`);
  lines.push(`- Roster before/after: ${redraftAudit.rosterBefore} -> ${redraftAudit.rosterAfter}`);
  lines.push(`- Bought/preserved/removed players: ${redraftAudit.boughtPlayers} / ${redraftAudit.preservedPlayers} / ${redraftAudit.removedPlayers}`);
  lines.push(`- Reset transfers/manual preserved/AI reset: ${redraftAudit.resetTransfersCount} / ${redraftAudit.manualTransfersPreserved} / ${redraftAudit.aiTransfersReset}`);
  lines.push(`- Facility events preserved: ${redraftAudit.facilityEventsPreserved}`);
  lines.push(`- Season results preserved: ${redraftAudit.seasonResultsPreserved ? "true" : "false"}`);
  lines.push(`- Status: ${input.result.status}`);
  lines.push(`- Execute: ${input.executed ? "true" : "false"}`);
  lines.push(`- Preview clean: ${input.clean ? "true" : "false"}`);
  if (input.executeSkippedReason) {
    lines.push(`- Execute skipped: ${input.executeSkippedReason}`);
  }
  lines.push(`- Planned picks: ${metrics.plannedPickCount}`);
  lines.push(`- Teams below minimum: ${metrics.teamsBelowMin.length === 0 ? "0" : metrics.teamsBelowMin.join(", ")}`);
  lines.push(`- Target gaps > 2: ${metrics.targetGapGt2.length === 0 ? "0" : metrics.targetGapGt2.join(", ")}`);
  lines.push(`- Negative aiScore picks: ${metrics.negativeAiScorePicks.length}`);
  lines.push(`- Negative teamIdentityScore picks: ${metrics.negativeTeamIdentityPicks.length}`);
  lines.push(`- value_pick_despite_theme_risk picks: ${metrics.valuePickDespiteThemeRiskPicks.length}`);
  lines.push(`- cost_band_mismatch count: ${metrics.costBandMismatchCount}`);
  lines.push(`- Planned duplicates: ${metrics.plannedDuplicateCount}`);
  lines.push(`- Roster duplicates: ${metrics.rosterDuplicateCount}`);
  lines.push(`- Cash min/max: ${metrics.cashMin} / ${metrics.cashMax}`);
  lines.push(`- Free agents: ${metrics.freeAgents}`);
  lines.push("");
  lines.push("## Redraft Mode Einordnung");
  lines.push("");
  if (redraftAudit.redraftMode === "target_topup_redraft") {
    lines.push("- Dieser Lauf war ein Target-/Top-Up-Redraft auf bestehender Kaderbasis, kein Full-Clean-Redraft von leer.");
  } else {
    lines.push("- Dieser Lauf war ein Full-Clean-Redraft von leerer Kaderbasis.");
  }
  if (redraftAudit.warnings.length > 0) {
    redraftAudit.warnings.forEach((warning) => lines.push(`- Warning: ${warning}`));
  }
  lines.push("");
  lines.push("## SpendRatio 0 Erklaerung");
  lines.push("");
  const zeroSpendTeams = input.result.teams
    .map((team) => ({
      team,
      audit: buildRedraftTeamSpendAudit({
        teamCode: team.teamCode,
        actualRoster: team.previewSummary.plannedRosterCount ?? team.rosterAfter ?? null,
        targetRoster: team.targetRosterSize ?? team.targetRosterOpt ?? null,
        boughtPlayers: activePicks(team).length,
        plannedSpend: team.previewSummary.plannedSpendTotal ?? null,
        spendRatio: spendRatio(team),
        laneDistributionCount: laneDistributionCount(team),
      }),
    }))
    .filter(({ team }) => spendRatio(team) === 0 || activePicks(team).length === 0);
  if (zeroSpendTeams.length === 0) {
    lines.push("- Keine Teams mit SpendRatio 0 oder ohne neue Picks.");
  } else {
    for (const { team, audit } of zeroSpendTeams) {
      lines.push(`- ${team.teamCode}: ${audit.spendAuditReason ?? "spend_nonzero_or_unclassified"}; bought=${activePicks(team).length}; roster=${team.previewSummary.plannedRosterCount ?? team.rosterAfter}/${team.targetRosterSize ?? team.targetRosterOpt ?? "—"}`);
    }
  }
  lines.push("");
  lines.push("## Blocking Reasons");
  lines.push("");
  if (input.result.blockingReasons.length === 0) {
    lines.push("- Keine.");
  } else {
    input.result.blockingReasons.forEach((reason) => lines.push(`- ${reason}`));
  }
  lines.push("");
  lines.push("## Focus Teams");
  lines.push("");
  for (const team of input.result.teams.filter((entry) => FOCUS_TEAMS.has(entry.teamCode))) {
    lines.push(
      `- ${team.teamCode}: ${team.previewSummary.plannedRosterCount ?? team.rosterAfter}/${team.targetRosterSize ?? team.targetRosterOpt} ` +
        `gap=${targetGap(team) ?? "—"} spendRatio=${spendRatio(team) ?? "—"} cash=${round(team.previewSummary.cashAfterPlannedBuys) ?? "—"} lanes=${laneDistribution(team).join(", ") || "—"}`,
    );
  }
  lines.push("");
  lines.push("## Team Details");
  lines.push("");
  for (const team of input.result.teams) {
    lines.push(
      `- ${team.teamCode}: actual ${team.previewSummary.plannedRosterCount ?? team.rosterAfter} / target ${team.targetRosterSize ?? team.targetRosterOpt ?? "—"} / ` +
        `gap ${targetGap(team) ?? "—"} / spendRatio ${spendRatio(team) ?? "—"} / lanes ${laneDistribution(team).join(", ") || "—"}`,
    );
  }
  return `${lines.join("\n")}\n`;
}

async function writeRunExports(input: {
  preview: AiPicksRunResult;
  execute: AiPicksRunResult | null;
  previewState: GameState;
  finalState: GameState;
  previewClean: boolean;
  executeSkippedReason: string | null;
}) {
  const previewPlayers = playerMap(input.previewState);
  const finalPlayers = playerMap(input.finalState);
  const executeResult = input.execute ?? input.preview;
  const redraftAudit = inferRedraftRunAudit(executeResult, input.finalState);
  await mkdir(OUTPUT_DIR, { recursive: true });
  await Promise.all([
    writeFile(path.join(OUTPUT_DIR, "clean-redraft-preview-summary.md"), buildMarkdown({
      title: "Clean Redraft V2 Preview",
      result: input.preview,
      gameState: input.previewState,
      clean: input.previewClean,
      executed: false,
    }), "utf8"),
    writeFile(path.join(OUTPUT_DIR, "clean-redraft-preview.json"), `${JSON.stringify({
      redraftAudit: inferRedraftRunAudit(input.preview, input.previewState),
      metrics: strictMetrics(input.preview, input.previewState),
      result: input.preview,
    }, null, 2)}\n`, "utf8"),
    writeFile(path.join(OUTPUT_DIR, "clean-redraft-preview-teams.csv"), toCsv(buildTeamRows(input.preview)), "utf8"),
    writeFile(path.join(OUTPUT_DIR, "clean-redraft-preview-picks.csv"), toCsv(buildPickRows(input.preview, previewPlayers)), "utf8"),
    writeFile(path.join(OUTPUT_DIR, "clean-redraft-execute-summary.md"), buildMarkdown({
      title: "Clean Redraft V2 Execute",
      result: input.execute ?? input.preview,
      gameState: input.finalState,
      clean: input.previewClean,
      executed: Boolean(input.execute?.executed),
      executeSkippedReason: input.executeSkippedReason,
    }), "utf8"),
    writeFile(path.join(OUTPUT_DIR, "clean-redraft-execute.json"), `${JSON.stringify({
      skippedReason: input.executeSkippedReason,
      redraftAudit,
      metrics: strictMetrics(input.execute ?? input.preview, input.finalState),
      result: input.execute,
    }, null, 2)}\n`, "utf8"),
    writeFile(path.join(OUTPUT_DIR, "clean-redraft-mode-audit.json"), `${JSON.stringify({
      generatedAt: new Date().toISOString(),
      saveId: executeResult.saveContext.resolvedSaveId,
      seasonId: executeResult.saveContext.resolvedSeasonId,
      redraftAudit,
      teamSpendAudit: buildTeamRows(executeResult).map((row) => ({
        teamCode: row.teamCode,
        actualRoster: row.actualRoster,
        targetRoster: row.targetRoster,
        boughtPlayers: row.boughtPlayers,
        preservedPlayers: row.preservedPlayers,
        spendRatio: row.spendRatio,
        plannedSpend: row.plannedSpend,
        laneDistribution: row.laneDistribution,
        spendAuditReason: row.spendAuditReason,
        warnings: row.warnings,
      })),
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
    }, null, 2)}\n`, "utf8"),
    writeFile(path.join(OUTPUT_DIR, "clean-redraft-mode-audit.csv"), toCsv(buildTeamRows(executeResult)), "utf8"),
    writeFile(path.join(OUTPUT_DIR, "clean-redraft-transfer-history-audit.csv"), toCsv(buildTransferRows(input.finalState)), "utf8"),
    writeFile(path.join(OUTPUT_DIR, "clean-redraft-roster-audit.csv"), toCsv(buildRosterAuditRows(input.finalState)), "utf8"),
  ]);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const persistence = createPersistenceService();
  const save =
    args.saveId != null
      ? persistence.getSaveById(args.saveId)
      : persistence.createFreshSeasonOneSave({
          saveId: `clean-redraft-v2-${Date.now()}`,
          name: `Clean Redraft V2 Testsave ${new Date().toLocaleString("de-DE")}`,
        });
  if (!save) {
    throw new Error(`Save ${args.saveId ?? "fresh"} could not be resolved.`);
  }
  persistence.saveSingleplayerState(save.saveId, withScenarioMeta(save.gameState, {
    scenarioType: "ai_redraft_test",
    label: save.name,
    description: "Clean-Redraft-Testsave mit Kader-/Pickdaten; keine abgeschlossene Season erforderlich.",
    sourceSaveId: args.saveId ?? undefined,
    isStableTestPoint: true,
  }));

  const preview = await runAiPicksExecutePreview({
    source: "sqlite",
    saveId: save.saveId,
    seasonId: save.gameState.season.id,
    dryRun: true,
    teamScope: "all",
    allowSetupAllTeams: true,
    stepsPerTeam: args.stepsPerTeam,
    runMode: "season1_optimum_execute",
  });
  const freshPreviewSave = persistence.getSaveById(save.saveId) ?? save;
  const clean = previewIsClean(preview, freshPreviewSave.gameState);
  let execute: AiPicksRunResult | null = null;
  let executeSkippedReason: string | null = null;

  if (!args.execute) {
    executeSkippedReason = "execute_flag_missing";
  } else if (!clean) {
    executeSkippedReason = "preview_not_clean";
  } else {
    execute = await runAiPicksExecutePreview({
      source: "sqlite",
      saveId: save.saveId,
      seasonId: save.gameState.season.id,
      dryRun: false,
      confirmToken: AI_PICKS_RUN_CONFIRM_TOKEN,
      teamScope: "all",
      allowSetupAllTeams: true,
      stepsPerTeam: args.stepsPerTeam,
      runMode: "season1_optimum_execute",
    });
    if (!execute.executed) {
      executeSkippedReason = "execute_service_returned_not_executed";
    }
  }

  const finalSaveBeforeScenario = persistence.getSaveById(save.saveId) ?? freshPreviewSave;
  const finalSave = persistence.saveSingleplayerState(finalSaveBeforeScenario.saveId, withScenarioMeta(finalSaveBeforeScenario.gameState, {
    scenarioType: "ai_redraft_test",
    label: finalSaveBeforeScenario.name,
    description: "Clean-Redraft-Testsave mit Kader-/Pickdaten; keine abgeschlossene Season erforderlich.",
    sourceSaveId: args.saveId ?? undefined,
    isStableTestPoint: true,
  }));
  await writeRunExports({
    preview,
    execute,
    previewState: freshPreviewSave.gameState,
    finalState: finalSave.gameState,
    previewClean: clean,
    executeSkippedReason,
  });

  const finalMetrics = strictMetrics(execute ?? preview, finalSave.gameState);
  console.log(JSON.stringify({
    saveId: save.saveId,
    seasonId: save.gameState.season.id,
    previewStatus: preview.status,
    previewClean: clean,
    executeRequested: args.execute,
    executed: Boolean(execute?.executed),
    executeSkippedReason,
    metrics: finalMetrics,
    outputDir: OUTPUT_DIR,
  }, null, 2));
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
