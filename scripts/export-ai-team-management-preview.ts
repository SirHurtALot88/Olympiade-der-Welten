import fs from "node:fs/promises";
import path from "node:path";

import { buildAiLeagueManagementPreview } from "@/lib/ai/ai-team-management-preview-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

function csvCell(value: unknown) {
  const text =
    value == null
      ? ""
      : Array.isArray(value)
        ? value.join(" | ")
        : typeof value === "object"
          ? JSON.stringify(value)
          : String(value);
  return /[,"\n]/.test(text) ? `"${text.replace(/"/g, "\"\"")}"` : text;
}

function toCsv(rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) {
    return "\n";
  }
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return `${[
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvCell(row[header] ?? "")).join(",")),
  ].join("\n")}\n`;
}

function countBy<T extends string>(values: T[]) {
  return values.reduce<Record<T, number>>(
    (counts, value) => {
      counts[value] = (counts[value] ?? 0) + 1;
      return counts;
    },
    {} as Record<T, number>,
  );
}

function identitySignal(value: number) {
  return value <= 10 ? value * 10 : value;
}

async function main() {
  const persistence = createPersistenceService();
  const bootstrapped = persistence.bootstrapSingleplayerSave();
  const save = persistence.getActiveSave() ?? bootstrapped.save;
  if (!save) {
    throw new Error("Kein lokaler Save gefunden.");
  }

  const preview = buildAiLeagueManagementPreview(save.gameState);
  const outputDir = path.join(process.cwd(), "outputs", "ai-team-management-preview");
  await fs.mkdir(outputDir, { recursive: true });

  const teamRows = preview.teams.map((team) => ({
    teamId: team.teamId,
    teamCode: team.teamCode,
    teamName: team.teamName,
    controlMode: team.profile.controlMode,
    strategicIntent: team.profile.strategicIntent,
    riskProfile: team.profile.riskProfile,
    cash: team.budgetPlan.cash,
    calculatedMarketValueSum: team.budgetPlan.calculatedMarketValueSum,
    salarySumRaw: team.budgetPlan.salarySumRaw,
    salarySumBudget: team.budgetPlan.salarySumBudget,
    salaryUnitScale: team.budgetPlan.salaryUnitScale,
    salarySum: team.budgetPlan.salarySum,
    expectedSalarySum: team.budgetPlan.expectedSalarySum,
    cashReserve: team.budgetPlan.bucketsBefore.cashReserve,
    salaryReserve: team.budgetPlan.bucketsBefore.salaryReserve,
    transferBudget: team.budgetPlan.bucketsBefore.transferBudget,
    buildingBudget: team.budgetPlan.bucketsBefore.buildingBudget,
    maintenanceBudget: team.budgetPlan.bucketsBefore.maintenanceBudget,
    emergencyBudget: team.budgetPlan.bucketsBefore.emergencyBudget,
    trainingFocus: team.trainingPlan.selectedTrainingFocus,
    trainingIntensity: team.trainingPlan.selectedTrainingIntensity,
    warnings: team.warnings,
  }));

  const buildingRows = preview.teams.flatMap((team) =>
    team.buildingPlan.map((row) => ({
      teamId: row.teamId,
      teamCode: row.teamCode,
      buildingType: row.buildingType,
      buildingLabel: row.buildingLabel,
      currentLevel: row.currentLevel,
      action: row.action,
      cost: row.cost,
      maintenanceCost: row.maintenanceCost,
      score: row.score,
      expectedEffect: row.expectedEffect,
      reasonsPositive: row.reasonsPositive,
      reasonsNegative: row.reasonsNegative,
      warnings: row.warnings,
    })),
  );

  const trainingRows = preview.teams.map((team) => ({
    teamId: team.teamId,
    teamCode: team.teamCode,
    trainingFocus: team.trainingPlan.selectedTrainingFocus,
    trainingIntensity: team.trainingPlan.selectedTrainingIntensity,
    expectedXpEffect: team.trainingPlan.expectedXpEffect,
    expectedRecoveryEffect: team.trainingPlan.expectedRecoveryEffect,
    expectedInjuryRiskEffect: team.trainingPlan.expectedInjuryRiskEffect,
    reasons: team.trainingPlan.reasons,
    warnings: team.trainingPlan.warnings,
  }));

  const budgetRows = preview.teams.map((team) => ({
    teamId: team.teamId,
    teamCode: team.teamCode,
    teamName: team.teamName,
    strategicIntent: team.profile.strategicIntent,
    riskProfile: team.profile.riskProfile,
    ambitionRaw: save.gameState.teamIdentities.find((identity) => identity.teamId === team.teamId)?.ambition ?? "",
    ambition: identitySignal(save.gameState.teamIdentities.find((identity) => identity.teamId === team.teamId)?.ambition ?? 0),
    financesRaw: save.gameState.teamIdentities.find((identity) => identity.teamId === team.teamId)?.finances ?? "",
    finances: identitySignal(save.gameState.teamIdentities.find((identity) => identity.teamId === team.teamId)?.finances ?? 0),
    rosterPressure: team.profile.rosterPressure,
    injuryPressure: team.profile.injuryPressure,
    fatiguePressure: team.profile.fatiguePressure,
    cash: team.budgetPlan.cash,
    calculatedMarketValueSum: team.budgetPlan.calculatedMarketValueSum,
    salarySumRaw: team.budgetPlan.salarySumRaw,
    salarySumBudget: team.budgetPlan.salarySumBudget,
    expectedSalarySum: team.budgetPlan.expectedSalarySum,
    salaryUnitScale: team.budgetPlan.salaryUnitScale,
    cashReserve: team.budgetPlan.bucketsBefore.cashReserve,
    salaryReserve: team.budgetPlan.bucketsBefore.salaryReserve,
    freeCashAfterReserves: team.budgetPlan.freeCashAfterReserves,
    transferBudget: team.budgetPlan.bucketsBefore.transferBudget,
    buildingBudget: team.budgetPlan.bucketsBefore.buildingBudget,
    maintenanceBudget: team.budgetPlan.bucketsBefore.maintenanceBudget,
    emergencyBudget: team.budgetPlan.bucketsBefore.emergencyBudget,
    spendMaintenance: team.budgetPlan.spendPlan.maintenance,
    spendBuildings: team.budgetPlan.spendPlan.buildings,
    spendTransfers: team.budgetPlan.spendPlan.transfers,
    warnings: team.budgetPlan.warnings,
  }));

  const warningRows = Object.entries(
    preview.teams.reduce<Record<string, { count: number; teams: string[]; sources: Set<string> }>>((counts, team) => {
      const add = (warning: string, source: string) => {
        counts[warning] ??= { count: 0, teams: [], sources: new Set<string>() };
        counts[warning].count += 1;
        counts[warning].teams.push(team.teamCode);
        counts[warning].sources.add(source);
      };
      for (const warning of team.profile.warnings) add(warning, "profile");
      for (const warning of team.budgetPlan.warnings) add(warning, "budget");
      for (const warning of team.trainingPlan.warnings) add(warning, "training");
      for (const warning of team.buildingPlan.flatMap((row) => row.warnings)) add(warning, "building");
      return counts;
    }, {}),
  ).map(([warning, entry]) => ({
    warning,
    count: entry.count,
    teamCount: new Set(entry.teams).size,
    sources: [...entry.sources].join(" | "),
    teams: [...new Set(entry.teams)].join(" | "),
  })).sort((left, right) => Number(right.count) - Number(left.count));

  const trainingCounts = countBy(preview.teams.map((team) => team.trainingPlan.selectedTrainingIntensity));
  const trainingDistributionRows = (["light", "normal", "hard"] as const).map((intensity) => {
    const teams = preview.teams.filter((team) => team.trainingPlan.selectedTrainingIntensity === intensity);
    const avg = (values: number[]) => values.length > 0 ? Number((values.reduce((total, value) => total + value, 0) / values.length).toFixed(2)) : 0;
    return {
      intensity,
      count: trainingCounts[intensity] ?? 0,
      teams: teams.map((team) => team.teamCode).join(" | "),
      avgAmbition: avg(teams.map((team) => identitySignal(save.gameState.teamIdentities.find((identity) => identity.teamId === team.teamId)?.ambition ?? 0))),
      avgInjuryPressure: avg(teams.map((team) => team.profile.injuryPressure)),
      avgFatiguePressure: avg(teams.map((team) => team.profile.fatiguePressure)),
    };
  });

  const salaryPressureWarnings = warningRows.find((row) => row.warning === "salary_and_maintenance_pressure")?.teamCount ?? 0;
  const zeroBuildingBudgets = budgetRows.filter((row) => Number(row.buildingBudget) <= 0).length;
  const zeroTransferBudgets = budgetRows.filter((row) => Number(row.transferBudget) <= 0).length;
  const maxRawSalary = Math.max(...preview.teams.map((team) => team.budgetPlan.salarySumRaw));
  const maxBudgetSalary = Math.max(...preview.teams.map((team) => team.budgetPlan.salarySumBudget));
  const unitAuditMarkdown = [
    "# AI Management Unit Audit",
    "",
    `Save: ${save.saveId}`,
    `Generated: ${preview.generatedAt}`,
    "",
    "## Cash / Salary Einheiten",
    "",
    "- Cash wird in Management-/Spielbudget-Einheiten gefuehrt, z. B. 175.",
    "- Roster-Salary kommt aus den Vertragsdaten teilweise als Rohwert, z. B. 25000.",
    "- Fuer Budget-Buckets wird Salary nicht mehr aus dem alten Vertragsrohwert genommen, sondern aus berechnetem MW -> Salary.",
    "- Die Rohsalary bleibt nur als Audit-Spalte sichtbar: 25000 -> Altlast, nicht Budget-Basis.",
    "- `expectedSalarySum` ist die Summe der berechneten Salary-Werte aus der Salary-Formel.",
    `- Groesste rohe SalarySum: ${maxRawSalary}. Groesste normalisierte SalarySum: ${maxBudgetSalary}.`,
    "",
    "## salary_and_maintenance_pressure",
    "",
    `- Teams mit Warning: ${salaryPressureWarnings} von ${preview.teams.length}.`,
    "- Die Warning wird nur noch gesetzt, wenn normalisierte Salary-Reserve plus echte Maintenance im gleichen Einheitensystem kritisch gegen Cash steht.",
    "- Bei Buildings 0 ist Maintenance 0 und loest diese Warning nicht pauschal aus.",
    "",
    "## Budget Buckets",
    "",
    `- Teams mit Building-Budget 0: ${zeroBuildingBudgets} von ${preview.teams.length}.`,
    `- Teams mit Transfer-Budget 0: ${zeroTransferBudgets} von ${preview.teams.length}.`,
    "- Nach CashReserve, SalaryReserve, Maintenance und Emergency wird freies Cash kontrolliert auf Buildings und Transfers verteilt.",
    "- Finances halten Reserven, blockieren Investitionen aber nicht komplett. Ambition erhoeht die Investitionsbereitschaft.",
    "- Injury-/Fatigue-Probleme erhoehen den Building-Bias fuer Recovery-Infrastruktur.",
    "",
    "## Training Intensity",
    "",
    ...trainingDistributionRows.map((row) => `- ${row.intensity}: ${row.count} Teams (${row.teams || "keine"})`),
    "",
  ].join("\n");

  const markdown = [
    "# AI Management Preview",
    "",
    `Save: ${save.saveId}`,
    `Generated: ${preview.generatedAt}`,
    "",
    ...preview.teams.map((team) =>
      [
        `## ${team.teamCode} - ${team.teamName}`,
        `- Intent: ${team.profile.strategicIntent}`,
        `- Risk: ${team.profile.riskProfile}`,
        `- Cash / Salary: ${team.budgetPlan.cash} / ${team.budgetPlan.salarySumBudget} (raw ${team.budgetPlan.salarySumRaw})`,
        `- Buckets: Reserve ${team.budgetPlan.bucketsBefore.cashReserve}, Salary ${team.budgetPlan.bucketsBefore.salaryReserve}, Buildings ${team.budgetPlan.bucketsBefore.buildingBudget}, Transfers ${team.budgetPlan.bucketsBefore.transferBudget}`,
        `- Training: ${team.trainingPlan.selectedTrainingFocus} / ${team.trainingPlan.selectedTrainingIntensity}`,
        `- Warnings: ${team.warnings.join(", ") || "keine"}`,
        "",
      ].join("\n"),
    ),
  ].join("\n");

  await Promise.all([
    fs.writeFile(path.join(outputDir, "ai-management-preview.json"), `${JSON.stringify(preview, null, 2)}\n`, "utf8"),
    fs.writeFile(path.join(outputDir, "ai-management-preview.md"), `${markdown}\n`, "utf8"),
    fs.writeFile(path.join(outputDir, "ai-management-by-team.csv"), toCsv(teamRows), "utf8"),
    fs.writeFile(path.join(outputDir, "ai-building-plan-preview.csv"), toCsv(buildingRows), "utf8"),
    fs.writeFile(path.join(outputDir, "ai-training-plan-preview.csv"), toCsv(trainingRows), "utf8"),
    fs.writeFile(path.join(outputDir, "ai-budget-buckets-preview.csv"), toCsv(budgetRows), "utf8"),
    fs.writeFile(path.join(outputDir, "ai-management-unit-audit.md"), `${unitAuditMarkdown}\n`, "utf8"),
    fs.writeFile(path.join(outputDir, "ai-management-warning-distribution.csv"), toCsv(warningRows), "utf8"),
    fs.writeFile(path.join(outputDir, "ai-management-budget-bucket-debug.csv"), toCsv(budgetRows), "utf8"),
    fs.writeFile(path.join(outputDir, "ai-training-intensity-distribution.csv"), toCsv(trainingDistributionRows), "utf8"),
  ]);

  console.log(
    JSON.stringify(
      {
        ok: true,
        saveId: save.saveId,
        outputDir,
        teams: preview.teams.length,
      },
      null,
      2,
    ),
  );
}

void main();
