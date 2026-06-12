import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { runAiPicksExecutePreview } from "@/lib/ai/ai-picks-run-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

type CliArgs = {
  saveId: string | null;
  seasonId: string | null;
  stepsPerTeam: number | null;
};

function parseArgs(argv: string[]): CliArgs {
  let saveId: string | null = null;
  let seasonId: string | null = null;
  let stepsPerTeam: number | null = null;

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
      continue;
    }
    if (token === "--steps-per-team") {
      const parsed = Number(argv[index + 1] ?? "");
      stepsPerTeam = Number.isFinite(parsed) ? parsed : null;
      index += 1;
    }
  }

  return { saveId, seasonId, stepsPerTeam };
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

function round(value: number | null | undefined, digits = 2) {
  if (value == null || !Number.isFinite(value)) {
    return null;
  }
  return Number(value.toFixed(digits));
}

function buildMarkdown(result: Awaited<ReturnType<typeof runAiPicksExecutePreview>>) {
  const lines: string[] = [];
  const targetGapRows = result.teams
    .map((team) => ({
      team,
      actual: team.previewSummary.plannedRosterCount ?? 0,
      target: team.targetRosterSize ?? null,
      gap: team.targetRosterSize != null ? Math.max(team.targetRosterSize - (team.previewSummary.plannedRosterCount ?? 0), 0) : null,
    }))
    .filter((entry) => entry.gap != null && entry.gap > 2);
  const negativeIdentityRows = result.teams.flatMap((team) =>
    team.plannedPicks
      .filter((pick) => pick.status !== "blocked" && (pick.scoreBreakdown.teamIdentityScore ?? 0) < 0)
      .map((pick) => `${team.teamCode}: ${pick.playerName} (${pick.scoreBreakdown.teamIdentityScore})`),
  );
  lines.push("# AI Season1 Preview Audit");
  lines.push("");
  lines.push(`- Save: ${result.saveContext.saveName ?? "Unbekannt"} (${result.saveContext.resolvedSaveId})`);
  lines.push(`- Season: ${result.saveContext.resolvedSeasonId}`);
  lines.push(`- Execute: ${result.executed ? "true" : "false"} / dryRun ${result.dryRun ? "true" : "false"} / readOnly ${result.readOnly ? "true" : "false"}`);
  lines.push(`- Status: ${result.status}`);
  lines.push(`- Quality gate: ${result.qualityGate.passed ? "passed" : "blocked"}`);
  lines.push(`- Planned picks: ${result.globalPreview.plannedPickCount}`);
  lines.push("");
  lines.push("## Target Gaps > 2");
  lines.push("");
  if (targetGapRows.length === 0) {
    lines.push("- Keine Teams mit targetGap > 2.");
  } else {
    for (const entry of targetGapRows) {
      const stopReason =
        entry.team.warnings.find((warning) => warning.includes("target_not_reachable_quality_floor")) ??
        entry.team.warnings.find((warning) => warning.includes("season1_spend_corridor_stop")) ??
        entry.team.warnings.at(-1) ??
        "kein expliziter Stop-Grund";
      lines.push(`- ${entry.team.teamCode}: actual ${entry.actual} / target ${entry.target} / gap ${entry.gap} / Grund: ${stopReason}`);
    }
  }
  lines.push("");
  lines.push("## Negative TeamIdentityScore Picks");
  lines.push("");
  if (negativeIdentityRows.length === 0) {
    lines.push("- Keine negativen teamIdentityScore Picks.");
  } else {
    for (const row of negativeIdentityRows) {
      lines.push(`- ${row}`);
    }
  }
  lines.push("");
  lines.push("## Team Audit");
  lines.push("");

  for (const team of result.teams) {
    const plannedPicks = team.plannedPicks.filter((pick) => pick.status !== "blocked");
    const negativeAi = plannedPicks.filter((pick) => pick.aiScore < 0);
    const negativeIdentity = plannedPicks.filter((pick) => (pick.scoreBreakdown.teamIdentityScore ?? 0) < 0);
    const themeRisk = plannedPicks.filter((pick) => pick.strategicExceptionReason === "value_pick_despite_theme_risk");
    const costBandMismatch = plannedPicks.filter((pick) => !pick.costBandMatch);
    const laneDistribution = new Map<string, number>();
    for (const pick of plannedPicks) {
      laneDistribution.set(pick.pickLane, (laneDistribution.get(pick.pickLane) ?? 0) + 1);
    }
    const laneSummary = [...laneDistribution.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "de"))
      .map(([label, count]) => `${label}:${count}`)
      .join(", ");
    const spendRatio =
      team.cashStrategy?.startingCash != null && team.cashStrategy.startingCash > 0 && team.previewSummary.plannedSpendTotal != null
        ? round(team.previewSummary.plannedSpendTotal / team.cashStrategy.startingCash, 4)
        : null;
    const targetGap =
      team.targetRosterSize != null ? Math.max(team.targetRosterSize - (team.previewSummary.plannedRosterCount ?? 0), 0) : null;
    lines.push(`### ${team.teamCode}`);
    lines.push(
      `- Archetyp/Lane-Plan: ${team.cashStrategy?.season1SpendArchetype ?? "—"} | ${team.planner?.slotPlan.join(", ") ?? "—"}`,
    );
    lines.push(
      `- Roster: target ${team.targetRosterSize ?? "—"} / actual ${team.previewSummary.plannedRosterCount ?? "—"} / gap ${targetGap ?? "—"} / minimum ${team.targetRosterMin ?? "—"}`,
    );
    lines.push(
      `- Spend: ratio ${spendRatio ?? "—"} / cashRest ${round(team.previewSummary.cashAfterPlannedBuys) ?? "—"} / corridor ${team.cashStrategy?.season1SpendMinPct ?? "—"}-${team.cashStrategy?.season1SpendMaxPct ?? "—"}`,
    );
    lines.push(`- Lane distribution: ${laneSummary || "—"}`);
    lines.push(`- negative aiScore picks: ${negativeAi.length}`);
    lines.push(`- negative teamIdentityScore picks: ${negativeIdentity.length}`);
    lines.push(`- value_pick_despite_theme_risk picks: ${themeRisk.length}`);
    lines.push(`- cost_band_mismatch count: ${costBandMismatch.length}`);
    if (["C-C", "A-A", "B-P", "C-S", "M-M"].includes(team.teamCode)) {
      lines.push(`- Focus detail: ${plannedPicks.map((pick) => `${pick.playerName}(${pick.pickLane}/${pick.marketValue ?? "—"})`).join(", ")}`);
    }
    if (team.teamCode === "C-C" && targetGap != null && targetGap > 0) {
      const cCReason =
        team.warnings.find((warning) => warning.includes("target_not_reachable_quality_floor")) ??
        team.warnings.find((warning) => warning.includes("season1_spend_corridor_stop")) ??
        team.warnings.at(-1) ??
        "kein expliziter Stop-Grund";
      lines.push(`- C-C Stop-Begruendung: ${cCReason}`);
    }
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const persistence = createPersistenceService();
  const activeSave = persistence.getActiveSave();

  const saveId = args.saveId ?? activeSave?.saveId ?? null;
  const seasonId = args.seasonId ?? activeSave?.gameState.season.id ?? null;
  if (!saveId || !seasonId) {
    throw new Error("Save or season could not be resolved for AI season1 preview export.");
  }

  const result = await runAiPicksExecutePreview({
    source: "sqlite",
    saveId,
    seasonId,
    dryRun: true,
    teamScope: "all",
    allowSetupAllTeams: true,
    stepsPerTeam: args.stepsPerTeam ?? 12,
    runMode: "season1_optimum_execute",
  });

  const outputDir = path.resolve(process.cwd(), "tmp", "ai-validation", saveId);
  const exportDir = path.resolve(process.cwd(), "tmp", "exports");
  await mkdir(outputDir, { recursive: true });
  await mkdir(exportDir, { recursive: true });

  const teamRows = result.teams.map((team) => {
    const plannedPicks = team.plannedPicks.filter((pick) => pick.status !== "blocked");
    const spendRatio =
      team.cashStrategy?.startingCash != null && team.cashStrategy.startingCash > 0 && team.previewSummary.plannedSpendTotal != null
        ? round(team.previewSummary.plannedSpendTotal / team.cashStrategy.startingCash, 4)
        : null;
    return {
      saveId: result.saveContext.resolvedSaveId,
      seasonId: result.saveContext.resolvedSeasonId,
      teamCode: team.teamCode,
      teamName: team.teamName,
      spendArchetype: team.cashStrategy?.season1SpendArchetype ?? null,
      spendRatio,
      spendMinPct: team.cashStrategy?.season1SpendMinPct ?? null,
      spendMaxPct: team.cashStrategy?.season1SpendMaxPct ?? null,
      targetRoster: team.targetRosterSize,
      actualRoster: team.previewSummary.plannedRosterCount,
      targetGap:
        team.targetRosterSize != null ? Math.max(team.targetRosterSize - (team.previewSummary.plannedRosterCount ?? 0), 0) : null,
      minRoster: team.targetRosterMin,
      cashRest: round(team.previewSummary.cashAfterPlannedBuys),
      lanePlan: team.planner?.slotPlan ?? [],
      laneDistribution: [...new Set(plannedPicks.map((pick) => pick.pickLane))].map((lane) => `${lane}:${plannedPicks.filter((pick) => pick.pickLane === lane).length}`),
      negativeAiScorePicks: plannedPicks.filter((pick) => pick.aiScore < 0).map((pick) => pick.playerName),
      negativeTeamIdentityPicks: plannedPicks.filter((pick) => pick.scoreBreakdown.teamIdentityScore < 0).map((pick) => pick.playerName),
      themeRiskPicks: plannedPicks.filter((pick) => pick.strategicExceptionReason === "value_pick_despite_theme_risk").map((pick) => pick.playerName),
      costBandMismatchCount: plannedPicks.filter((pick) => !pick.costBandMatch).length,
      warnings: team.warnings,
      blockingReasons: team.blockingReasons,
    };
  });

  const pickRows = result.teams.flatMap((team) =>
    team.plannedPicks
      .filter((pick) => pick.status !== "blocked")
      .map((pick) => ({
        saveId: result.saveContext.resolvedSaveId,
        seasonId: result.saveContext.resolvedSeasonId,
        teamCode: team.teamCode,
        teamName: team.teamName,
        playerId: pick.playerId,
        playerName: pick.playerName,
        plannedLane: pick.plannedLane,
        pickLane: pick.pickLane,
        pickPhase: pick.pickPhase,
        marketValue: pick.marketValue,
        aiScore: pick.aiScore,
        teamIdentityScore: pick.scoreBreakdown.teamIdentityScore,
        offThemePenalty: pick.scoreBreakdown.offThemePenalty,
        valueScore: pick.scoreBreakdown.valueScore,
        needMatchScore: pick.scoreBreakdown.needMatchScore,
        disciplineCoverageScore: pick.scoreBreakdown.disciplineCoverageScore,
        strategicExceptionReason: pick.strategicExceptionReason,
        costBandExpected: pick.costBandExpected,
        costBandActual: pick.costBandActual,
        costBandMatch: pick.costBandMatch,
        warnings: pick.warnings,
        reasons: pick.reasons,
      })),
  );

  const jsonPath = path.join(outputDir, "season1-preview-audit.json");
  const markdownPath = path.join(outputDir, "season1-preview-audit.md");
  const teamCsvPath = path.join(exportDir, `ai-season1-preview-teams-${saveId}.csv`);
  const pickCsvPath = path.join(exportDir, `ai-season1-preview-picks-${saveId}.csv`);

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
        status: result.status,
        qualityGatePassed: result.qualityGate.passed,
        plannedPickCount: result.globalPreview.plannedPickCount,
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
