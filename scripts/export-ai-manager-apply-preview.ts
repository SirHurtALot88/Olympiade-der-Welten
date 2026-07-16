import fs from "node:fs/promises";
import path from "node:path";

import { applyAiManagerPlan, buildAiManagerApplyPreview } from "@/lib/ai/ai-manager-apply-service";
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
  if (rows.length === 0) return "\n";
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return `${[headers.join(","), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))].join("\n")}\n`;
}

async function main() {
  const shouldApply = process.argv.includes("--apply");
  const persistence = createPersistenceService();
  const bootstrapped = persistence.bootstrapSingleplayerSave();
  const save = persistence.getActiveSave() ?? bootstrapped.save;
  if (!save) throw new Error("Kein lokaler Save gefunden.");

  const result = shouldApply
    ? applyAiManagerPlan({ save, dryRun: false, persistence })
    : buildAiManagerApplyPreview(save);
  const outputDir = path.join(process.cwd(), "outputs", "ai-manager-apply-preview");
  await fs.mkdir(outputDir, { recursive: true });

  const actionRows = result.actions.map((action) => ({
    actionId: action.actionId,
    teamId: action.teamId,
    teamCode: action.teamCode,
    teamName: action.teamName,
    actionType: action.actionType,
    cost: action.cost,
    cashBefore: action.cashBefore,
    cashAfter: action.cashAfter,
    expectedEffect: action.expectedEffect,
    reason: action.reason,
    risk: action.risk,
    sourcePlanId: action.sourcePlanId,
    canApply: action.canApply,
    applied: action.applied ?? false,
    blockers: action.blockers,
    warnings: action.warnings,
    facilityId: action.facilityId ?? "",
    trainingFocus: action.trainingFocus ?? "",
    trainingIntensity: action.trainingIntensity ?? "",
    playerId: action.playerId ?? "",
    contractStrategy: action.contractStrategy ?? "",
  }));
  const buildingRows = actionRows.filter((row) =>
    ["maintain_building", "upgrade_building", "buy_building"].includes(String(row.actionType)),
  );
  const trainingRows = actionRows.filter((row) => ["set_training_focus", "set_training_intensity"].includes(String(row.actionType)));
  const contractRows = actionRows.filter((row) => ["mark_contract_strategy", "mark_sell_strategy"].includes(String(row.actionType)));
  const markdown = [
    "# AI Manager Apply Preview",
    "",
    `Save: ${result.saveId}`,
    `Season: ${result.seasonId}`,
    `Generated: ${result.generatedAt}`,
    `Mode: ${result.dryRun ? "preview" : "apply"}`,
    `Applied: ${result.applied}`,
    "",
    "## Summary",
    "",
    `- Teams: ${result.teams}`,
    `- Actions: ${result.actions.length}`,
    `- Can Apply: ${result.actions.filter((action) => action.canApply).length}`,
    `- Blockers: ${result.blockers.length}`,
    `- Warnings: ${result.warnings.length}`,
    "",
    "## Action Counts",
    "",
    ...Object.entries(
      result.actions.reduce<Record<string, number>>((counts, action) => {
        counts[action.actionType] = (counts[action.actionType] ?? 0) + 1;
        return counts;
      }, {}),
    ).map(([type, count]) => `- ${type}: ${count}`),
    "",
    "## Blockers",
    "",
    ...(result.blockers.length ? result.blockers.slice(0, 30).map((entry) => `- ${entry}`) : ["- keine"]),
  ].join("\n");

  await Promise.all([
    fs.writeFile(path.join(outputDir, "ai-manager-apply-preview.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8"),
    fs.writeFile(path.join(outputDir, "ai-manager-apply-preview.md"), `${markdown}\n`, "utf8"),
    fs.writeFile(path.join(outputDir, "ai-manager-actions.csv"), toCsv(actionRows), "utf8"),
    fs.writeFile(path.join(outputDir, "ai-manager-budget-application.csv"), toCsv(result.budgetRows), "utf8"),
    fs.writeFile(path.join(outputDir, "ai-manager-building-actions.csv"), toCsv(buildingRows), "utf8"),
    fs.writeFile(path.join(outputDir, "ai-manager-training-actions.csv"), toCsv(trainingRows), "utf8"),
    fs.writeFile(path.join(outputDir, "ai-manager-contract-strategy.csv"), toCsv(contractRows), "utf8"),
  ]);

  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: result.dryRun ? "preview" : "apply",
        saveId: result.saveId,
        outputDir,
        actions: result.actions.length,
        canApply: result.actions.filter((action) => action.canApply).length,
        blockers: result.blockers.length,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
