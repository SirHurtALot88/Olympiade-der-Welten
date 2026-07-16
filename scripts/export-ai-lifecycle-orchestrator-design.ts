import fs from "node:fs/promises";
import path from "node:path";

import {
  AI_LIFECYCLE_PHASE_DEFINITIONS,
  AI_LIFECYCLE_TRIGGER_RULES,
  buildAiManagerMemoryPreview,
} from "@/lib/ai/ai-season-lifecycle-orchestrator";
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

async function main() {
  const outputDir = path.join(process.cwd(), "outputs", "ai-lifecycle-orchestrator");
  await fs.mkdir(outputDir, { recursive: true });

  const persistence = createPersistenceService();
  const save = persistence.getActiveSave() ?? persistence.bootstrapSingleplayerSave().save;
  const memoryPreview = buildAiManagerMemoryPreview(save.gameState);
  const sampleTeamId = save.gameState.teams[0]?.teamId ?? "T-1";
  const sampleMemory = memoryPreview[sampleTeamId] ?? null;

  const phaseMap = {
    generatedAt: new Date().toISOString(),
    saveId: save.saveId,
    seasonId: save.gameState.season.id,
    phases: AI_LIFECYCLE_PHASE_DEFINITIONS,
  };

  const performanceRows = AI_LIFECYCLE_PHASE_DEFINITIONS.map((phase) => ({
    phase: phase.phase,
    label: phase.label,
    timing: phase.timing,
    targetMs: phase.performanceBudget.targetMs,
    hardCapMs: phase.performanceBudget.hardCapMs,
    targetAvgPickMs: phase.performanceBudget.targetAvgPickMs ?? "",
    hardCapAvgPickMs: phase.performanceBudget.hardCapAvgPickMs ?? "",
    singleTeamTargetMs: phase.performanceBudget.singleTeamTargetMs ?? "",
    resumePossible: phase.resumePossible,
    degradedAllowed: phase.degradedAllowed,
  }));

  const triggerRows = AI_LIFECYCLE_TRIGGER_RULES.map((rule) => ({
    triggerId: rule.triggerId,
    phase: rule.phase,
    category: rule.category,
    condition: rule.condition,
    action: rule.action,
    writeAllowed: rule.writeAllowed,
  }));

  const teamExampleRows = save.gameState.teams.slice(0, 5).map((team) => {
    const memory = memoryPreview[team.teamId];
    return {
      teamId: team.teamId,
      teamName: team.name,
      lastSeasonRank: memory?.lastSeasonRank ?? "",
      lastSeasonPoints: memory?.lastSeasonPoints ?? "",
      underperformingPlayers: memory?.underperformingPlayers ?? [],
      breakoutPlayers: memory?.breakoutPlayers ?? [],
      injuryProblems: memory?.injuryProblems ?? [],
      fatigueProblems: memory?.fatigueProblems ?? [],
      nextSeasonHints: memory?.nextSeasonHints ?? [],
    };
  });

  const designMarkdown = [
    "# AI Season Lifecycle Orchestrator V1",
    "",
    "Ziel: Die Manager-AI laeuft nicht als ein grosser Block, sondern in messbaren, resumefaehigen Phasen.",
    "",
    "## Write Ownership",
    "",
    "- Transfers: nur Buy-/Sell-Service.",
    "- Lineups: nur Lineup-Service und Validator.",
    "- Facilities: nur Facility-Service.",
    "- Training: nur Training-Service.",
    "- Seasonwechsel: nur Season-/Preseason-Transition-Service.",
    "- Manager-AI erzeugt Plaene, Actions und Memory, schreibt aber keine Fachzustaende direkt.",
    "",
    "## Phasen",
    "",
    ...AI_LIFECYCLE_PHASE_DEFINITIONS.map(
      (phase) =>
        `- ${phase.phase}: ${phase.label}; Timing ${phase.timing}; Writes ${phase.writeMode}; Ziel ${phase.performanceBudget.targetMs}ms, Hard Cap ${phase.performanceBudget.hardCapMs}ms.`,
    ),
    "",
    "## Human/Remote/AI Controls",
    "",
    "- Human/User Teams erhalten keine automatische Transfer-/Lineup-/Training-Apply ohne Nutzeraktion.",
    "- Remote Teams werden nicht von AI-Apply ueberschrieben; Multiplayer Ready/Locks entscheiden spaeter.",
    "- AI Teams duerfen nur in AI-Phasen und nur ueber offizielle Services applyen.",
    "- Passive Teams bleiben ohne echte Apply-Writes, ausser ein spaeterer expliziter Block erlaubt es.",
  ].join("\n");

  const seasonReviewTemplate = [
    "# Season Review Template",
    "",
    "## Team Review",
    "",
    "- Ziel erreicht?",
    "- Board zufrieden?",
    "- Cash besser/schlechter?",
    "- Kader staerker/schwaecher?",
    "- Top-Spieler / Underperformer",
    "- Verletzungsprobleme",
    "- Beste und schlechteste Disziplinen",
    "- Transfererfolg",
    "- Gebaeude-/Trainingserfolg",
    "- Naechste Saisonstrategie",
    "",
    "## Player Review",
    "",
    "- Performance vs Expectation",
    "- Board Trust / Morale",
    "- Development / Regression",
    "- Injury/Fatigue",
    "- Contract/Renewal Status",
    "- Sell/Hold/Extend Recommendation",
  ].join("\n");

  const openSteps = [
    "# AI Lifecycle Open Implementation Steps",
    "",
    "1. Phase-Status optional lokal persistieren, sobald Apply-Runner aktiviert wird.",
    "2. `preseason_strategy` mit konkretem Manager-Plan/Market-Board-Service verbinden.",
    "3. `preseason_market` nur ueber Chunked Redraft/Transfermarkt-Service ausfuehren.",
    "4. `matchday_preparation` mit Lineup-Precompute-Maps verbinden.",
    "5. Season Review UI auf Teamseite/Home sichtbar machen.",
    "6. Spaeter Queue/Worker anschliessen; Interface ist vorbereitet.",
  ].join("\n");

  const memorySchema = {
    generatedAt: new Date().toISOString(),
    schemaName: "AiManagerMemoryRecord",
    sampleTeamId,
    sample: sampleMemory,
    fields: [
      "lastSeasonRank",
      "lastSeasonPoints",
      "prizeMoney",
      "cashTrend",
      "salaryTrend",
      "rosterSizeTrend",
      "playerPerformanceNotes",
      "underperformingPlayers",
      "breakoutPlayers",
      "injuryProblems",
      "fatigueProblems",
      "disciplineWeaknesses",
      "disciplineStrengths",
      "boardTrustTrend",
      "moraleTrend",
      "transferMistakes",
      "goodTransfers",
      "facilityNeeds",
      "trainingEffectiveness",
      "nextSeasonHints",
    ],
  };

  await Promise.all([
    fs.writeFile(path.join(outputDir, "ai-lifecycle-orchestrator-design.md"), `${designMarkdown}\n`, "utf8"),
    fs.writeFile(path.join(outputDir, "ai-lifecycle-phase-map.json"), `${JSON.stringify(phaseMap, null, 2)}\n`, "utf8"),
    fs.writeFile(path.join(outputDir, "ai-lifecycle-performance-budget.csv"), toCsv(performanceRows), "utf8"),
    fs.writeFile(path.join(outputDir, "ai-lifecycle-trigger-map.csv"), toCsv(triggerRows), "utf8"),
    fs.writeFile(path.join(outputDir, "ai-manager-memory-schema.json"), `${JSON.stringify(memorySchema, null, 2)}\n`, "utf8"),
    fs.writeFile(path.join(outputDir, "season-review-template.md"), `${seasonReviewTemplate}\n`, "utf8"),
    fs.writeFile(path.join(outputDir, "season-review-team-example.csv"), toCsv(teamExampleRows), "utf8"),
    fs.writeFile(path.join(outputDir, "ai-lifecycle-open-implementation-steps.md"), `${openSteps}\n`, "utf8"),
  ]);

  console.log(JSON.stringify({ ok: true, outputDir, saveId: save.saveId, seasonId: save.gameState.season.id }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
