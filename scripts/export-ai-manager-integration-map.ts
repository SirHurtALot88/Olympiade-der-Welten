import fs from "node:fs/promises";
import path from "node:path";

import { buildAiManagerIntegrationContract } from "@/lib/ai/ai-manager-integration-contract";

type Row = Record<string, unknown>;

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

function toCsv(rows: Row[]) {
  if (rows.length === 0) return "\n";
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return `${[headers.join(","), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))].join("\n")}\n`;
}

function renderMarkdown(contract: ReturnType<typeof buildAiManagerIntegrationContract>) {
  const lines = [
    "# AI Manager Integration Contract V1",
    "",
    `Generated: ${contract.generatedAt}`,
    "",
    "## Write Ownership",
    "",
    "- Nur Buy-Service schreibt Kaeufe.",
    "- Nur Sell-Service schreibt Verkaeufe.",
    "- Nur Facility-Service schreibt Gebaeude.",
    "- Nur Training-Service schreibt Training.",
    "- Nur Lineup-Service schreibt Lineups.",
    "- Nur Season/Transition-Service schreibt Seasonwechsel.",
    "- Manager-AI schreibt keine Fachzustaende direkt, sondern erzeugt Plaene/Actions fuer offizielle Services.",
    "",
    "## Modules",
    "",
    ...contract.modules.flatMap((module) => [
      `### ${module.module}`,
      "",
      `- Purpose: ${module.purpose}`,
      `- Inputs: ${module.inputs.join(", ")}`,
      `- Outputs: ${module.outputs.join(", ")}`,
      `- Write Permission: ${module.writePermission}`,
      `- Phases: ${module.phases.join(", ")}`,
      `- Reports: ${module.reports.join(", ")}`,
      `- Caches: ${module.caches.join(", ")}`,
      `- Consumes: ${module.consumes.join(", ") || "none"}`,
      `- Source of Truth: ${module.sourceOfTruth.join(", ")}`,
      "",
    ]),
    "## Data Flows",
    "",
    ...contract.dataFlows.flatMap((flow) => [
      `### ${flow.label}`,
      "",
      `- Status: ${flow.status}`,
      `- Modules: ${flow.modules.join(" -> ")}`,
      `- Required Handoffs: ${flow.requiredHandoffs.join(", ")}`,
      `- Blockers: ${flow.blockers.join(", ")}`,
      `- Notes: ${flow.notes.join(" ")}`,
      "",
    ]),
    "## Phase Permissions",
    "",
    "| Phase | Allowed | Blocked | Budget | Resume | Degraded |",
    "| --- | --- | --- | ---: | --- | --- |",
    ...contract.phasePermissions.map(
      (phase) =>
        `| ${phase.phase} | ${phase.allowedActions.join(" / ")} | ${phase.blockedActions.join(" / ")} | ${phase.performanceBudget.targetMs}/${phase.performanceBudget.hardCapMs}ms | ${phase.resumePossible} | ${phase.degradedAllowed} |`,
    ),
    "",
    "## Cache & Performance Contract",
    "",
    ...contract.cacheContracts.flatMap((cache) => [
      `- ${cache.phase}: caches ${cache.cachesBuilt.join(", ") || "none"}; exclude from normal UI load: ${cache.excludedFromNormalUiLoad.join(", ")}.`,
    ]),
    "",
    "## UI Contract",
    "",
    ...contract.uiContracts.map(
      (ui) => `- ${ui.view}: ${ui.field} <- ${ui.sourceModule} (${ui.loadingMode}; Source: ${ui.sourceOfTruth})`,
    ),
    "",
    "## Acceptance",
    "",
    ...Object.entries(contract.acceptance).map(([key, value]) => `- ${key}: ${value ? "GREEN" : "RED"}`),
  ];

  return `${lines.join("\n")}\n`;
}

function moduleRows(contract: ReturnType<typeof buildAiManagerIntegrationContract>) {
  return contract.modules.map((module) => ({
    module: module.module,
    purpose: module.purpose,
    inputs: module.inputs,
    outputs: module.outputs,
    mayWrite: module.mayWrite,
    writePermission: module.writePermission,
    phases: module.phases,
    reports: module.reports,
    caches: module.caches,
    consumes: module.consumes,
    sourceOfTruth: module.sourceOfTruth,
  }));
}

async function main() {
  const outputDir = path.join(process.cwd(), "outputs", "ai-manager-integration-contract");
  await fs.mkdir(outputDir, { recursive: true });

  const contract = buildAiManagerIntegrationContract();
  await fs.writeFile(path.join(outputDir, "ai-manager-integration-map.md"), renderMarkdown(contract), "utf8");
  await fs.writeFile(path.join(outputDir, "ai-manager-integration-map.json"), JSON.stringify(contract, null, 2), "utf8");
  await fs.writeFile(path.join(outputDir, "ai-manager-data-contracts.csv"), toCsv(moduleRows(contract)), "utf8");

  console.log(
    JSON.stringify(
      {
        ok: Object.values(contract.acceptance).every(Boolean),
        outputDir,
        modules: contract.modules.length,
        dataFlows: contract.dataFlows.length,
        phases: contract.phasePermissions.length,
        acceptance: contract.acceptance,
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
