import fs from "node:fs/promises";
import path from "node:path";

import { buildDoctrineAuditBundle } from "@/lib/ai/ai-manager-doctrine-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

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

async function writeCsv(outputDir: string, fileName: string, rows: Row[]) {
  await fs.writeFile(path.join(outputDir, fileName), toCsv(rows), "utf8");
}

function doctrineMarkdown(bundle: ReturnType<typeof buildDoctrineAuditBundle>) {
  return [
    "# Team Doctrine Map",
    "",
    `Generated: ${bundle.generatedAt}`,
    `Season: ${bundle.seasonId}`,
    "",
    "## Doctrines",
    "",
    ...bundle.doctrines.flatMap((doctrine) => [
      `### ${doctrine.teamId} - ${doctrine.doctrineName}`,
      "",
      `- Identity Pillars: ${doctrine.identityPillars.join(", ") || "n/a"}`,
      `- Preferred Win Path: ${doctrine.preferredWinPath}`,
      `- Secondary Win Path: ${doctrine.secondaryWinPath}`,
      `- Forbidden Paths: ${doctrine.forbiddenPaths.join(", ") || "n/a"}`,
      `- Roster: ${doctrine.rosterPhilosophy}`,
      `- Transfer: ${doctrine.transferPhilosophy}`,
      `- Training: ${doctrine.trainingPhilosophy}`,
      `- Facilities: ${doctrine.facilityPhilosophy}`,
      `- Contracts: ${doctrine.contractPhilosophy}`,
      `- Risk: ${doctrine.riskPhilosophy}`,
      `- Strictness/Flexibility: ${doctrine.identityStrictness}/${doctrine.adaptationFlexibility}`,
      "",
    ]),
  ].join("\n");
}

function managerReviewMarkdown(bundle: ReturnType<typeof buildDoctrineAuditBundle>) {
  return [
    "# Manager Review Summary",
    "",
    "Read-only Doctrine/Audit-Preview. Keine Prisma-/Supabase-Writes, keine Apply-Logik.",
    "",
    "| Team | Strategy | Identity | Adaptation | Recommendation | Notes |",
    "| --- | ---: | ---: | ---: | --- | --- |",
    ...bundle.managerReview.map(
      (row) =>
        `| ${row.teamCode} ${row.teamName} | ${row.strategyScore} | ${row.identityScore} | ${row.adaptationScore} | ${row.nextSeasonRecommendation} | ${row.notes.join("; ")} |`,
    ),
    "",
    "## Red Flags",
    "",
    ...bundle.identityGuardAudit
      .filter((row) => row.doctrineFit === "red")
      .map((row) => `- ${row.teamId}: ${row.reason}`),
  ].join("\n");
}

async function main() {
  const outputDir = path.join(process.cwd(), "outputs", "ai-manager-doctrine");
  await fs.mkdir(outputDir, { recursive: true });

  const persistence = createPersistenceService();
  const save = persistence.getActiveSave() ?? persistence.bootstrapSingleplayerSave().save;
  const bundle = buildDoctrineAuditBundle(save.gameState);

  await fs.writeFile(path.join(outputDir, "team-doctrine-map.md"), doctrineMarkdown(bundle), "utf8");
  await writeCsv(outputDir, "team-doctrine-map.csv", bundle.doctrines);
  await writeCsv(outputDir, "strategy-shift-matrix.csv", bundle.strategyShiftMatrix);
  await writeCsv(outputDir, "identity-guard-audit.csv", bundle.identityGuardAudit);
  await writeCsv(outputDir, "manager-decision-journal.csv", bundle.decisionJournal);
  await writeCsv(outputDir, "season-review-team-summary.csv", bundle.seasonTeamReview);
  await writeCsv(outputDir, "season-review-player-summary.csv", bundle.seasonPlayerReview);
  await fs.writeFile(path.join(outputDir, "manager-review-summary.md"), managerReviewMarkdown(bundle), "utf8");
  await writeCsv(outputDir, "tactical-adaptation-audit.csv", bundle.tacticalAdaptationAudit);
  await writeCsv(outputDir, "lineup-strategy-audit.csv", bundle.lineupStrategyAudit);

  console.log(
    JSON.stringify(
      {
        ok: true,
        outputDir,
        saveId: save.saveId,
        seasonId: save.gameState.season.id,
        doctrines: bundle.doctrines.length,
        redIdentityGuards: bundle.identityGuardAudit.filter((row) => row.doctrineFit === "red").length,
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
