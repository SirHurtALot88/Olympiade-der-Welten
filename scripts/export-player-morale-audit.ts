import fs from "node:fs";
import path from "node:path";

import { buildPlayerMoraleAudit } from "@/lib/morale/player-morale-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { assertOlyProjectRoot } from "@/lib/persistence/project-root-guard";

const OUTPUT_DIR =
  process.env.OLY_OUTPUT_DIR ??
  "/Users/chrisfalk/Documents/Codex/2026-06-11/wir-machen-weiter-mit-dem-olympiade/outputs";

function escapeCsv(value: string | number | null | undefined) {
  const text = value == null ? "—" : String(value);
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function renderMarkdown(audit: ReturnType<typeof buildPlayerMoraleAudit>, saveName: string) {
  const lines = [
    "# Player Morale Audit",
    "",
    `Generated: ${audit.generatedAt}`,
    `Save: ${saveName}`,
    `Season: ${audit.seasonId}`,
    "",
    "## Summary",
    "",
    `- Players: ${audit.totalPlayers}`,
    `- Average Morale: ${audit.averageMorale ?? "—"}`,
    `- Unhappy/Angry: ${audit.criticalCount}`,
    `- Exit/Refusal Risk: ${audit.refusalRiskCount}`,
    "",
    "## Highest Risk",
    "",
    "| Player | Team | Mood | Morale | Intent | Salary Modifier | Renewal Risk | Top Reasons | Suggested Actions |",
    "| --- | --- | --- | ---: | --- | ---: | ---: | --- | --- |",
  ];

  for (const row of [...audit.rows].sort((left, right) => left.morale - right.morale).slice(0, 25)) {
    lines.push(
      [
        row.playerId,
        row.teamId,
        `${row.smiley} ${row.moodLabel}`,
        row.morale,
        row.contractIntent,
        row.moraleSalaryModifier,
        row.moraleRenewalRisk,
        row.reasons.slice(0, 3).map((reason) => `${reason.reasonId} (${reason.valueDelta > 0 ? "+" : ""}${reason.valueDelta})`).join("; "),
        row.suggestedActions.join("; "),
      ]
        .map((value) => String(value).replaceAll("|", "\\|"))
        .join(" | ")
        .replace(/^/, "| ")
        .replace(/$/, " |"),
    );
  }

  return `${lines.join("\n")}\n`;
}

function renderRiskCsv(audit: ReturnType<typeof buildPlayerMoraleAudit>) {
  const header = [
    "playerId",
    "teamId",
    "morale",
    "visibleMood",
    "contractIntent",
    "salaryModifier",
    "contractLengthLimit",
    "refusalRisk",
    "reasons",
    "suggestedActions",
    "warnings",
  ];
  const rows = audit.rows.map((row) => [
    row.playerId,
    row.teamId,
    row.morale,
    row.visibleMood,
    row.contractIntent,
    row.moraleSalaryModifier,
    row.moraleContractLengthLimit,
    row.moraleRenewalRisk,
    row.reasons.map((reason) => `${reason.reasonId}:${reason.valueDelta}`).join("; "),
    row.suggestedActions.join("; "),
    row.warnings.join("; "),
  ]);
  return [header, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n") + "\n";
}

function main() {
  assertOlyProjectRoot();
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const persistence = createPersistenceService();
  const save = persistence.getActiveSave() ?? persistence.bootstrapSingleplayerSave().save;
  const audit = buildPlayerMoraleAudit(save.gameState);
  const jsonPath = path.join(OUTPUT_DIR, "player-morale-audit.json");
  const mdPath = path.join(OUTPUT_DIR, "player-morale-audit.md");
  const csvPath = path.join(OUTPUT_DIR, "player-morale-contract-risk.csv");

  fs.writeFileSync(jsonPath, JSON.stringify({ saveId: save.saveId, saveName: save.name, ...audit }, null, 2));
  fs.writeFileSync(mdPath, renderMarkdown(audit, save.name ?? save.saveId));
  fs.writeFileSync(csvPath, renderRiskCsv(audit));

  console.log(`Wrote ${mdPath}`);
  console.log(`Wrote ${jsonPath}`);
  console.log(`Wrote ${csvPath}`);
}

main();
