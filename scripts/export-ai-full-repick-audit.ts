import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { buildAiFullRepickAudit, type AiFullRepickAuditResult } from "@/lib/ai/ai-full-repick-audit-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

type CliArgs = {
  saveId: string | null;
  seasonId: string | null;
};

function parseArgs(argv: string[]): CliArgs {
  let saveId: string | null = null;
  let seasonId: string | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--save-id") {
      saveId = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (token === "--season-id") {
      seasonId = argv[index + 1] ?? null;
      index += 1;
    }
  }

  return { saveId, seasonId };
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
  const lines = [
    headers.map(csvCell).join(","),
    ...rows.map((row) => headers.map((header) => csvCell(row[header] ?? "")).join(",")),
  ];
  return `${lines.join("\n")}\n`;
}

function buildMarkdown(result: AiFullRepickAuditResult) {
  const lines: string[] = [];
  lines.push(`# AI Full-Repick Audit`);
  lines.push("");
  lines.push(`- Save: ${result.saveContext.saveName ?? "Unbekannt"} (${result.saveContext.resolvedSaveId ?? "missing"})`);
  lines.push(`- Season: ${result.saveContext.resolvedSeasonId ?? result.saveContext.requestedSeasonId}`);
  lines.push(`- Decision: ${result.summary.decision}`);
  lines.push(`- Teams below minimum: ${result.summary.teamsBelowMinimum}`);
  lines.push(`- Resettable transfers: ${result.summary.totalResettableTransfers}`);
  lines.push(`- Berserker/Warlord share: ${result.summary.berserkerWarlordSharePct ?? "—"}%`);
  lines.push("");

  if (result.warnings.length > 0) {
    lines.push(`## Warnings`);
    lines.push("");
    for (const warning of result.warnings) {
      lines.push(`- ${warning}`);
    }
    lines.push("");
  }

  lines.push(`## Focus Teams`);
  lines.push("");
  for (const team of result.focusTeams) {
    lines.push(
      `- ${team.teamCode}: identity=${team.coreIdentityFulfilled ? "ok" : "fraglich"}, primaryAxisCoverage=${team.primaryAxisCoverage}, formColorCoverage=${team.formColorCoverage}, retoolNearness=${team.retoolNearness}`,
    );
    if (team.offThemePicks.length > 0) {
      lines.push(`  offTheme: ${team.offThemePicks.join(", ")}`);
    }
    if (team.strategicExceptions.length > 0) {
      lines.push(`  exceptions: ${team.strategicExceptions.join(", ")}`);
    }
  }
  lines.push("");

  lines.push(`## Minimum Failures`);
  lines.push("");
  for (const team of result.teams.filter((entry) => entry.missingMinimumSlots > 0)) {
    lines.push(
      `- ${team.teamCode}: start=${team.startRosterBeforeFullRepick}, final=${team.finalRosterAfterFullRepick}, minimum=${team.minimumRoster}, missing=${team.missingMinimumSlots}, reason=${team.minimumStatusReason}`,
    );
  }
  lines.push("");

  lines.push(`## Highest Spend Teams`);
  lines.push("");
  for (const team of result.globalBudgetAudit.highestSpendTeams) {
    lines.push(`- ${team.teamCode}: spend=${team.spend}, spendRatio=${team.spendRatio ?? "—"}`);
  }
  lines.push("");

  return `${lines.join("\n")}\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const persistence = createPersistenceService();
  const activeSave = persistence.getActiveSave();

  const saveId = args.saveId ?? activeSave?.saveId ?? null;
  const seasonId = args.seasonId ?? activeSave?.gameState.season.id ?? null;

  if (!saveId || !seasonId) {
    throw new Error("Save or season could not be resolved for AI full-repick audit export.");
  }

  const result = await buildAiFullRepickAudit({
    saveId,
    seasonId,
    source: "sqlite",
  });

  const outputDir = path.resolve(process.cwd(), "tmp", "ai-validation", saveId);
  const exportDir = path.resolve(process.cwd(), "tmp", "exports");
  await mkdir(outputDir, { recursive: true });
  await mkdir(exportDir, { recursive: true });

  const jsonPath = path.join(outputDir, "full-repick-audit.json");
  const markdownPath = path.join(outputDir, "full-repick-audit.md");
  const teamCsvPath = path.join(exportDir, `ai-full-repick-teams-${saveId}.csv`);
  const pickCsvPath = path.join(exportDir, `ai-full-repick-picks-${saveId}.csv`);

  const teamRows = result.teams.map((team) => ({
    saveId: result.saveContext.resolvedSaveId,
    seasonId: result.saveContext.resolvedSeasonId,
    teamCode: team.teamCode,
    teamName: team.teamName,
    startRosterBeforeFullRepick: team.startRosterBeforeFullRepick,
    finalRosterAfterFullRepick: team.finalRosterAfterFullRepick,
    minimumRoster: team.minimumRoster,
    optimumRoster: team.optimumRoster,
    targetRoster: team.targetRoster,
    missingMinimumSlots: team.missingMinimumSlots,
    missingOptimumSlots: team.missingOptimumSlots,
    minimumStatusReason: team.minimumStatusReason,
    startingCash: team.startingCash,
    validationBudgetSource: team.validationBudgetSource,
    expectedCostForMinimum: team.expectedCostForMinimum,
    expectedCostForTarget: team.expectedCostForTarget,
    actualSpend: team.actualSpend,
    remainingCash: team.remainingCash,
    spendRatio: team.spendRatio,
    averagePickMW: team.averagePickMW,
    averagePickSalary: team.averagePickSalary,
    budgetScaleStatus: team.budgetScaleStatus,
    financePosture: team.financePosture,
    spendFactor: team.spendFactor,
    allowedBudgetForSearch: team.allowedBudgetForSearch,
    expectedPrizeFiveSeasonSum: team.expectedPrizeFiveSeasonSum,
    expectedPrizeSourceStatus: team.expectedPrizeSourceStatus,
    plannerTraceStatus: team.plannerTraceStatus,
    offThemePickCount: team.offThemePickCount,
    classSpamPickCount: team.classSpamPickCount,
    coreIdentityFulfilled: team.teamIdentityStatus.coreIdentityFulfilled,
    primaryAxisCoverage: team.teamIdentityStatus.primaryAxisCoverage,
    formColorCoverage: team.teamIdentityStatus.formColorCoverage,
    retoolNearness: team.teamIdentityStatus.retoolNearness,
    offThemePicks: team.teamIdentityStatus.offThemePicks,
    strategicExceptions: team.teamIdentityStatus.strategicExceptions,
    laneDistribution: team.laneDistribution.map((entry) => `${entry.label}:${entry.count}`),
    warnings: team.warnings,
  }));

  const pickRows = result.teams.flatMap((team) =>
    team.picks.map((pick) => ({
      saveId: result.saveContext.resolvedSaveId,
      seasonId: result.saveContext.resolvedSeasonId,
      teamCode: team.teamCode,
      teamName: team.teamName,
      transferId: pick.transferId,
      playerId: pick.playerId,
      playerName: pick.playerName,
      className: pick.className,
      race: pick.race,
      purchasePrice: pick.purchasePrice,
      salary: pick.salary,
      marketValue: pick.marketValue,
      plannerTraceStatus: pick.plannerTraceStatus,
      legacyRoleTag: pick.legacyRoleTag,
      exportedRoleBug: pick.exportedRoleBug,
      pickLane: pick.pickLane,
      rosterRole: pick.rosterRole,
      pickPhase: pick.pickPhase,
      auditRole: pick.auditRole,
      isSuperstar: pick.isSuperstar,
      isStar: pick.isStar,
      isCore: pick.isCore,
      isDepth: pick.isDepth,
      budgetStretchApplied: pick.budgetStretchApplied,
      pickedForFormColor: pick.pickedForFormColor,
      strategicExceptionReason: pick.strategicExceptionReason,
      pickScore: pick.pickScore,
      needLabel: pick.needLabel,
      reasons: pick.reasons,
      teamFit: pick.teamFit,
      warnings: pick.warnings,
    })),
  );

  await Promise.all([
    writeFile(jsonPath, `${JSON.stringify(result, null, 2)}\n`, "utf8"),
    writeFile(markdownPath, buildMarkdown(result), "utf8"),
    writeFile(teamCsvPath, toCsv(teamRows), "utf8"),
    writeFile(pickCsvPath, toCsv(pickRows), "utf8"),
  ]);

  console.log(
    JSON.stringify(
      {
        saveId,
        seasonId,
        decision: result.summary.decision,
        teamsCompared: result.summary.comparedTeams,
        teamsBelowMinimum: result.summary.teamsBelowMinimum,
        totalResettableTransfers: result.summary.totalResettableTransfers,
        artifacts: {
          jsonPath,
          markdownPath,
          teamCsvPath,
          pickCsvPath,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
