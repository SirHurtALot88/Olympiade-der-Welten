import type { GameState } from "@/lib/data/olyDataTypes";
import { buildGameFlowState } from "@/lib/foundation/game-flow-controller";
import { evaluateGamePhaseAction } from "@/lib/foundation/game-phase-action-policy";
import { buildSeasonPlayabilityGate } from "@/lib/foundation/season-playability-gate";
import { loadPlayerFormulaSources } from "@/lib/player-formulas/formula-source-loader";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

function requireValue<T>(value: T | null | undefined, message: string): T {
  if (value == null) throw new Error(message);
  return value;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function getLatestBlockOneSaveId() {
  const persistence = createPersistenceService();
  return persistence
    .listSaves()
    .filter((save) => save.name.includes("Block 1 Full Season Smoke"))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0]?.saveId ?? null;
}

function pickCompletedSeasonId(saveId: string) {
  const persistence = createPersistenceService();
  const save = requireValue(persistence.getSaveById(saveId), `Save ${saveId} missing.`);
  const explicitSeasonId = process.env.BLOCK3_SEASON_ID?.trim();
  if (explicitSeasonId) return explicitSeasonId;
  const snapshots = [...(save.gameState.seasonState.seasonSnapshots ?? [])].sort((left, right) =>
    right.seasonId.localeCompare(left.seasonId, "de", { numeric: true }),
  );
  return snapshots[0]?.seasonId ?? null;
}

function collectConsequenceWarnings(consequence: Record<string, unknown>) {
  const warnings = new Set<string>(asStringArray(consequence.warnings));
  const cashPrize = asRecord(consequence.cashPrize);
  const relationships = asRecord(consequence.relationships);
  const aiSeasonAudit = asRecord(consequence.aiSeasonAudit);
  const aiTeams = Array.isArray(aiSeasonAudit.teams) ? aiSeasonAudit.teams.map(asRecord) : [];
  const aiWarningCounts = aiTeams.reduce<Record<string, number>>((summary, team) => {
    for (const warning of asStringArray(team.warnings)) {
      summary[warning] = (summary[warning] ?? 0) + 1;
    }
    return summary;
  }, {});

  asStringArray(cashPrize.warnings).forEach((warning) => warnings.add(warning));
  asStringArray(relationships.warnings).forEach((warning) => warnings.add(warning));
  asStringArray(aiSeasonAudit.warnings).forEach((warning) => warnings.add(warning));
  if (Object.keys(aiWarningCounts).length > 0) {
    warnings.add(`ai_audit_team_warnings:${JSON.stringify(aiWarningCounts)}`);
  }

  return [...warnings];
}

function assertStepTarget(
  label: string,
  flow: ReturnType<typeof buildGameFlowState>,
  stepId: string,
  expectedTargetView: string,
) {
  const step = flow.steps.find((entry) => entry.stepId === stepId) ?? null;
  if (!step) return `${label}:${stepId}:missing`;
  if (step.targetView !== expectedTargetView) return `${label}:${stepId}:target_${step.targetView}_expected_${expectedTargetView}`;
  return null;
}

function buildFlowContractFailures(gameState: GameState, activeTeamId: string | null) {
  const currentFlow = buildGameFlowState({ gameState, activeTeamId });
  const matchdayFlow = buildGameFlowState({
    gameState: {
      ...gameState,
      gamePhase: "season_active",
      matchdayState: { ...gameState.matchdayState, status: "planning" },
    },
    activeTeamId,
  });
  const reviewFlow = buildGameFlowState({
    gameState: {
      ...gameState,
      gamePhase: "season_completed",
      matchdayState: { ...gameState.matchdayState, status: "resolved" },
    },
    activeTeamId,
  });

  return [
    assertStepTarget("current", currentFlow, "season_intro", "home"),
    assertStepTarget("current", currentFlow, "buy_players", "market"),
    assertStepTarget("matchday", matchdayFlow, "check_training", "trainingV2"),
    assertStepTarget("matchday", matchdayFlow, "set_lineup", "lineup"),
    assertStepTarget("matchday", matchdayFlow, "open_arena", "matchdayArena"),
    assertStepTarget("review", reviewFlow, "review_previous_season", "cockpit"),
  ].filter((entry): entry is string => Boolean(entry));
}

function buildPhasePolicyFailures(gameState: GameState) {
  const currentPolicyChecks = [
    evaluateGamePhaseAction(gameState, "buy_players"),
    evaluateGamePhaseAction(gameState, "sell_players"),
    evaluateGamePhaseAction(gameState, "set_training"),
    evaluateGamePhaseAction(gameState, "set_lineup"),
  ];
  const completedPolicyChecks = [
    evaluateGamePhaseAction({ ...gameState, gamePhase: "season_completed" }, "complete_season"),
    evaluateGamePhaseAction({ ...gameState, gamePhase: "season_completed" }, "buy_players"),
  ];

  return [
    ...currentPolicyChecks
      .filter((check) => !check.allowed)
      .map((check) => `current:${check.action}:${check.reason ?? "blocked"}`),
    ...completedPolicyChecks
      .filter((check) => (check.action === "complete_season" ? !check.allowed : check.allowed))
      .map((check) => `completed:${check.action}:${check.reason ?? "unexpected_allowed"}`),
  ];
}

function main() {
  const persistence = createPersistenceService();
  const saveId = process.env.BLOCK3_SAVE_ID?.trim() || getLatestBlockOneSaveId();
  if (!saveId) {
    throw new Error("No Block 1 save found. Run `npm run season:smoke-block-1` and `npm run season:smoke-block-2` first or set BLOCK3_SAVE_ID.");
  }

  const save = requireValue(persistence.getSaveById(saveId), `Save ${saveId} missing.`);
  const seasonId = requireValue(pickCompletedSeasonId(saveId), "No completed season snapshot found for Block 3 gate.");
  const gameState = save.gameState;
  const activeTeamId = gameState.seasonState.newGameFlow?.selectedTeamId ?? gameState.teams.find((team) => team.humanControlled)?.teamId ?? gameState.teams[0]?.teamId ?? null;
  const seasonConsequences = asRecord(asRecord(gameState.seasonReviewState).seasonConsequences);
  const consequence = asRecord(seasonConsequences[seasonId]);
  const snapshot = gameState.seasonState.seasonSnapshots?.find((entry) => entry.seasonId === seasonId) ?? null;
  const formulaWarnings = loadPlayerFormulaSources().warnings;
  const warnings = [
    ...collectConsequenceWarnings(consequence),
    ...formulaWarnings,
    Object.keys(consequence).length === 0 ? "season_consequences_missing" : null,
    snapshot == null ? "season_snapshot_missing" : null,
  ].filter((entry): entry is string => Boolean(entry));
  const gate = buildSeasonPlayabilityGate({ gameState, activeTeamId, warnings });
  const flowContractFailures = buildFlowContractFailures(gameState, activeTeamId);
  const phasePolicyFailures = buildPhasePolicyFailures(gameState);

  if (flowContractFailures.length > 0 || phasePolicyFailures.length > 0) {
    gate.blockers.push(
      ...[...flowContractFailures, ...phasePolicyFailures].map((failure) => ({
        warning: failure,
        key: failure,
        severity: "blocker" as const,
        quiet: false,
        label: failure.startsWith("current:") || failure.startsWith("completed:")
          ? `Phasenvertrag verletzt: ${failure}`
          : `Flow-Vertrag verletzt: ${failure}`,
      })),
    );
  }

  const output = {
    saveId,
    seasonId,
    testStatus: gate.blockers.length > 0 ? "blocked" : "passed",
    currentFlow: gate.flow,
    warningBuckets: {
      blockers: gate.blockers.map((entry) => ({ key: entry.key, label: entry.label })),
      auditHints: gate.auditHints.map((entry) => ({ key: entry.key, quiet: entry.quiet, label: entry.label })),
      knownDataGaps: gate.knownDataGaps.map((entry) => ({ key: entry.key, label: entry.label })),
    },
    flowContractFailures,
    phasePolicyFailures,
    playtestGuide: "docs/SEASON_PLAYTEST_GUIDE_BLOCK_3.md",
  };

  if (gate.blockers.length > 0) {
    console.log(JSON.stringify(output, null, 2));
    throw new Error(`Block 3 playability gate failed: ${gate.blockers.map((entry) => entry.key).join(" | ")}`);
  }

  console.log(JSON.stringify(output, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
