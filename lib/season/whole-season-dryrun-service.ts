import type { GameState } from "@/lib/data/olyDataTypes";
import { buildTeamControlSettingsMap, isAiLineupBatchApplyEnabled } from "@/lib/foundation/team-control-settings";
import { buildSeasonPointsLedger } from "@/lib/foundation/season-points-ledger";
import { buildTeamSeasonOverviewRows } from "@/lib/foundation/team-management-overview";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";
import { loadPlayerFormulaSources } from "@/lib/player-formulas/formula-source-loader";
import {
  MATCHDAY_AUTO_RUN_CONFIRM_TOKEN,
  runLocalMatchdayAutoRun,
  type MatchdayAutoRunResult,
} from "@/lib/season/matchday-auto-run-service";
import { ADVANCE_MATCHDAY_CONFIRM_TOKEN, executeMatchdayAdvance } from "@/lib/season/matchday-progress-service";
import { buildSeasonSnapshotDryRun } from "@/lib/season/season-snapshot-service";

export type WholeSeasonDryRunParams = {
  source?: "sqlite" | "prisma";
  saveId: string;
  seasonId?: string;
  startMatchdayId?: string;
  maxMatchdays?: number;
  dryRun?: boolean;
  execute?: boolean;
  options?: {
    includeWarningLineups?: boolean;
    overwriteExistingLineups?: boolean;
    stopOnTie?: boolean;
    stopOnMissingManualLineups?: boolean;
    advanceAfterEachMatchday?: boolean;
    includeMarketPhase?: false;
  };
};

export type WholeSeasonDryRunMatchdaySummary = {
  matchdayId: string;
  label: string;
  status: MatchdayAutoRunResult["status"];
  lineupsReady: number;
  missingManualTeams: number;
  warningTeams: number;
  tieBlockers: number;
  plannedWrites: number;
  warnings: string[];
  blockingReasons: string[];
  steps: MatchdayAutoRunResult["steps"];
};

export type WholeSeasonDryRunStandingRow = {
  rank: number | null;
  teamId: string;
  teamCode: string;
  teamName: string;
  points: number | null;
  cash: number | null;
};

export type WholeSeasonDryRunTeamSummary = WholeSeasonDryRunStandingRow & {
  rosterCount: number;
  salaryTotal: number;
  avgContractLength: number | null;
  marketValueTotal: number | null;
};

export type WholeSeasonDryRunSnapshotReadiness = {
  status: "ready" | "warning" | "blocked";
  canCreate: boolean;
  seasonCompleted: boolean;
  duplicateDetected: boolean;
  sourceStatus: "mapped" | "partial" | "missing_source";
  completedMatchdays: number;
  totalMatchdays: number;
  warnings: string[];
  blockingReasons: string[];
};

export type WholeSeasonDryRunPlayerPpsReconciliation = {
  status: "reconciled" | "warning" | "missing_source";
  hasResultSource: boolean;
  playersWithPoints: number;
  pointEntries: number;
  totalPlayerPoints: number;
  warnings: string[];
};

export type WholeSeasonDryRunTeamPpsReconciliation = {
  status: "reconciled" | "warning" | "missing_source";
  hasResultSource: boolean;
  reconciledTeams: number;
  missingPlayerPointsTeams: number;
  failedTeams: number;
  totalTeamPoints: number;
  totalPlayerDerivedPoints: number;
  warnings: string[];
};

export type WholeSeasonDryRunMarketPhaseStatus = {
  status: "not_simulated" | "policy_missing";
  warning: string | null;
};

export type WholeSeasonDryRunResult = {
  ok: boolean;
  readOnly: true;
  source: "sqlite" | "prisma";
  dryRun: true;
  simulationMode: "in_memory_local_copy";
  status: "ready" | "completed" | "warning" | "blocked";
  scope: {
    saveId: string;
    seasonId: string;
    startMatchdayId: string;
    totalMatchdays: number;
    maxMatchdays: number | null;
  };
  simulatedMatchdays: number;
  blockedAtMatchday: {
    matchdayId: string;
    label: string;
  } | null;
  tieBlockers: number;
  missingLineups: number;
  missingManualLineups: number;
  missingAiLineups: number;
  missingPassiveLineups: number;
  manualTeamsReady: number;
  aiTeamsReady: number;
  passiveTeamsReady: number;
  skippedDisabledAiTeams: number;
  missingFormulaSources: string[];
  missingPerformanceSources: string[];
  marketPhaseStatus: WholeSeasonDryRunMarketPhaseStatus;
  snapshotReadiness: WholeSeasonDryRunSnapshotReadiness;
  playerPPsReconciliation: WholeSeasonDryRunPlayerPpsReconciliation;
  teamPPsReconciliation: WholeSeasonDryRunTeamPpsReconciliation;
  projectedFinalStandings: WholeSeasonDryRunStandingRow[];
  projectedCash: Array<{
    teamId: string;
    teamName: string;
    cash: number | null;
  }>;
  projectedCashTable: Array<{
    teamId: string;
    teamName: string;
    cash: number | null;
  }>;
  projectedTeamSummaries: WholeSeasonDryRunTeamSummary[];
  teamSummaries: WholeSeasonDryRunTeamSummary[];
  matchdays: WholeSeasonDryRunMatchdaySummary[];
  stepsByMatchday: WholeSeasonDryRunMatchdaySummary[];
  warnings: string[];
  blockingReasons: string[];
};

function normalizeSource(source?: string): "sqlite" | "prisma" {
  return source === "prisma" ? "prisma" : "sqlite";
}

function resolveLocalSave(persistence: PersistenceService, saveId: string) {
  const bootstrapped = persistence.bootstrapSingleplayerSave();
  const save = persistence.getSaveById(saveId) ?? persistence.getActiveSave() ?? bootstrapped.save;

  if (!save) {
    throw new Error(`Local save ${saveId} could not be loaded for whole season dryrun.`);
  }

  return save;
}

function cloneSave(save: PersistedSaveGame): PersistedSaveGame {
  return structuredClone(save);
}

function createInMemoryPersistenceService(initialSave: PersistedSaveGame): PersistenceService {
  let currentSave = cloneSave(initialSave);

  function cloneCurrentSave() {
    return cloneSave(currentSave);
  }

  return {
    bootstrapSingleplayerSave() {
      return {
        save: cloneCurrentSave(),
        createdFromSeed: false,
      };
    },
    getActiveSave() {
      return cloneCurrentSave();
    },
    getSaveById(saveId) {
      return currentSave.saveId === saveId ? cloneCurrentSave() : null;
    },
    saveSingleplayerState(saveId, gameState) {
      if (currentSave.saveId !== saveId) {
        throw new Error(`In-memory save ${saveId} could not be found.`);
      }

      currentSave = {
        ...currentSave,
        updatedAt: new Date().toISOString(),
        gameState: structuredClone(gameState),
      };

      return cloneCurrentSave();
    },
    createSave() {
      throw new Error("Whole season dryrun does not create new saves.");
    },
    createFreshSeasonOneSave() {
      throw new Error("Whole season dryrun does not create fresh saves.");
    },
    cloneSave() {
      throw new Error("Whole season dryrun does not clone saves through persistence.");
    },
    activateSave(saveId) {
      return currentSave.saveId === saveId ? cloneCurrentSave() : null;
    },
    listSaves() {
      return [
        {
          saveId: currentSave.saveId,
          name: currentSave.name,
          status: currentSave.status,
          createdAt: currentSave.createdAt,
          updatedAt: currentSave.updatedAt,
        },
      ];
    },
  };
}

function buildMatchdayLabel(gameState: GameState, matchdayId: string) {
  const index = gameState.season.matchdayIds.findIndex((entry) => entry === matchdayId);
  return index >= 0 ? `Spieltag ${index + 1}` : matchdayId;
}

function applyDryRunStartMatchday(gameState: GameState, startMatchdayId: string) {
  const matchdayIndex = gameState.season.matchdayIds.findIndex((entry) => entry === startMatchdayId);
  if (matchdayIndex < 0) {
    throw new Error(`Start matchday ${startMatchdayId} is not part of local season ${gameState.season.id}.`);
  }

  return {
    ...gameState,
    season: {
      ...gameState.season,
      currentMatchday: matchdayIndex + 1,
    },
    matchdayState: {
      matchdayId: startMatchdayId,
      status: "planning" as const,
      pendingTeamIds: gameState.teams.map((team) => team.teamId),
      resolvedFixtureIds: [],
    },
  };
}

function buildProjectedRows(gameState: GameState): WholeSeasonDryRunTeamSummary[] {
  return buildTeamSeasonOverviewRows({ gameState })
    .map((row) => ({
      rank: row.rank,
      teamId: row.teamId,
      teamCode: row.teamCode,
      teamName: row.teamName,
      points: row.points,
      cash: row.cash,
      rosterCount: row.rosterCount,
      salaryTotal: row.salaryTotal,
      avgContractLength: row.avgContractLength,
      marketValueTotal: row.marketValueTotal,
    }))
    .sort((left, right) => {
      if (left.rank != null && right.rank != null && left.rank !== right.rank) {
        return left.rank - right.rank;
      }
      return (right.points ?? Number.NEGATIVE_INFINITY) - (left.points ?? Number.NEGATIVE_INFINITY) || left.teamName.localeCompare(right.teamName, "de");
    });
}

function createEmptySnapshotReadiness(saveId: string, seasonId: string): WholeSeasonDryRunSnapshotReadiness {
  return {
    status: "blocked",
    canCreate: false,
    seasonCompleted: false,
    duplicateDetected: false,
    sourceStatus: "missing_source",
    completedMatchdays: 0,
    totalMatchdays: 0,
    warnings: [],
    blockingReasons: saveId ? [`snapshot_unavailable:${seasonId}`] : ["snapshot_unavailable"],
  };
}

function createEmptyPlayerPpsReconciliation(): WholeSeasonDryRunPlayerPpsReconciliation {
  return {
    status: "missing_source",
    hasResultSource: false,
    playersWithPoints: 0,
    pointEntries: 0,
    totalPlayerPoints: 0,
    warnings: [],
  };
}

function createEmptyTeamPpsReconciliation(): WholeSeasonDryRunTeamPpsReconciliation {
  return {
    status: "missing_source",
    hasResultSource: false,
    reconciledTeams: 0,
    missingPlayerPointsTeams: 0,
    failedTeams: 0,
    totalTeamPoints: 0,
    totalPlayerDerivedPoints: 0,
    warnings: [],
  };
}

function buildMissingPerformanceSources(gameState: GameState, seasonId: string) {
  const warnings: string[] = [];
  const seasonMatchdayResults = (gameState.seasonState.matchdayResults ?? []).filter(
    (entry) => entry.seasonId === seasonId && entry.status === "preview_applied",
  );
  const seasonResultIds = new Set(seasonMatchdayResults.map((entry) => entry.id));
  const seasonDisciplineResults = (gameState.seasonState.disciplineResults ?? []).filter((entry) =>
    seasonResultIds.has(entry.matchdayResultId),
  );
  const seasonPlayerPerformances = (gameState.seasonState.playerDisciplinePerformances ?? []).filter((entry) =>
    seasonResultIds.has(entry.matchdayResultId),
  );

  if (seasonMatchdayResults.length === 0) {
    warnings.push("season_matchday_results_missing");
  }
  if (seasonDisciplineResults.length === 0) {
    warnings.push("season_discipline_results_missing");
  }
  if (seasonPlayerPerformances.length === 0) {
    warnings.push("season_player_performances_missing");
  }

  return warnings;
}

export async function runWholeSeasonDryRun(
  params: WholeSeasonDryRunParams,
  persistence: PersistenceService = createPersistenceService(),
): Promise<WholeSeasonDryRunResult> {
  const source = normalizeSource(params.source);
  if (source === "prisma") {
    return {
      ok: false,
      readOnly: true,
      source,
      dryRun: true,
      simulationMode: "in_memory_local_copy",
      status: "blocked",
      scope: {
        saveId: params.saveId,
        seasonId: params.seasonId ?? "season-1",
        startMatchdayId: "",
        totalMatchdays: 0,
        maxMatchdays: params.maxMatchdays ?? null,
      },
      simulatedMatchdays: 0,
      blockedAtMatchday: null,
      tieBlockers: 0,
      missingLineups: 0,
      missingManualLineups: 0,
      missingAiLineups: 0,
      missingPassiveLineups: 0,
      manualTeamsReady: 0,
      aiTeamsReady: 0,
      passiveTeamsReady: 0,
      skippedDisabledAiTeams: 0,
      missingFormulaSources: [],
      missingPerformanceSources: [],
      marketPhaseStatus: {
        status: "not_simulated",
        warning: null,
      },
      snapshotReadiness: createEmptySnapshotReadiness(params.saveId, params.seasonId ?? "season-1"),
      playerPPsReconciliation: createEmptyPlayerPpsReconciliation(),
      teamPPsReconciliation: createEmptyTeamPpsReconciliation(),
      projectedFinalStandings: [],
      projectedCash: [],
      projectedCashTable: [],
      projectedTeamSummaries: [],
      teamSummaries: [],
      matchdays: [],
      stepsByMatchday: [],
      warnings: [],
      blockingReasons: ["Prisma/Supabase mode is read-only. Whole season dryrun is only available on the local SQLite save."],
    };
  }

  if (params.execute || params.dryRun === false) {
    return {
      ok: false,
      readOnly: true,
      source,
      dryRun: true,
      simulationMode: "in_memory_local_copy",
      status: "blocked",
      scope: {
        saveId: params.saveId,
        seasonId: params.seasonId ?? "season-1",
        startMatchdayId: "",
        totalMatchdays: 0,
        maxMatchdays: params.maxMatchdays ?? null,
      },
      simulatedMatchdays: 0,
      blockedAtMatchday: null,
      tieBlockers: 0,
      missingLineups: 0,
      missingManualLineups: 0,
      missingAiLineups: 0,
      missingPassiveLineups: 0,
      manualTeamsReady: 0,
      aiTeamsReady: 0,
      passiveTeamsReady: 0,
      skippedDisabledAiTeams: 0,
      missingFormulaSources: [],
      missingPerformanceSources: [],
      marketPhaseStatus: {
        status: "not_simulated",
        warning: null,
      },
      snapshotReadiness: createEmptySnapshotReadiness(params.saveId, params.seasonId ?? "season-1"),
      playerPPsReconciliation: createEmptyPlayerPpsReconciliation(),
      teamPPsReconciliation: createEmptyTeamPpsReconciliation(),
      projectedFinalStandings: [],
      projectedCash: [],
      projectedCashTable: [],
      projectedTeamSummaries: [],
      teamSummaries: [],
      matchdays: [],
      stepsByMatchday: [],
      warnings: [],
      blockingReasons: ["Whole season simulation is dry-run only in this block."],
    };
  }

  const realSave = resolveLocalSave(persistence, params.saveId);
  const startMatchdayId = params.startMatchdayId?.trim() || realSave.gameState.matchdayState.matchdayId;
  const initializedSave: PersistedSaveGame = {
    ...realSave,
    gameState:
      startMatchdayId === realSave.gameState.matchdayState.matchdayId
        ? structuredClone(realSave.gameState)
        : applyDryRunStartMatchday(structuredClone(realSave.gameState), startMatchdayId),
  };
  const inMemoryPersistence = createInMemoryPersistenceService(initializedSave);
  const initialGameState = initializedSave.gameState;
  const seasonId = params.seasonId?.trim() || initialGameState.season.id;
  const totalMatchdays = initialGameState.season.matchdayIds.length;
  const startMatchdayIndex = initialGameState.season.matchdayIds.findIndex((entry) => entry === startMatchdayId);
  if (startMatchdayIndex < 0) {
    throw new Error(`Start matchday ${startMatchdayId} is not part of local season ${seasonId}.`);
  }
  const maxMatchdays =
    params.maxMatchdays != null
      ? Math.max(1, Math.min(params.maxMatchdays, totalMatchdays - startMatchdayIndex))
      : totalMatchdays - startMatchdayIndex;
  const stopOnMissingManualLineups = params.options?.stopOnMissingManualLineups ?? true;
  const advanceAfterEachMatchday = params.options?.advanceAfterEachMatchday ?? true;
  const matchdaySummaries: WholeSeasonDryRunMatchdaySummary[] = [];
  const warnings = new Set<string>();
  const blockingReasons = new Set<string>();
  const formulaSources = loadPlayerFormulaSources();
  const missingFormulaSources = formulaSources.warnings.filter(
    (warning) => warning.endsWith("_source_missing") || warning.endsWith("_source_incomplete"),
  );
  for (const warning of missingFormulaSources) {
    warnings.add(warning);
  }
  const marketPhaseWarning = "market_phase_policy_missing";
  warnings.add(marketPhaseWarning);
  let missingManualLineups = 0;
  let missingAiLineups = 0;
  let missingPassiveLineups = 0;
  let manualTeamsReady = 0;
  let aiTeamsReady = 0;
  let passiveTeamsReady = 0;
  let skippedDisabledAiTeams = 0;
  let blockedAtMatchday: WholeSeasonDryRunResult["blockedAtMatchday"] = null;

  for (let iteration = 0; iteration < maxMatchdays; iteration += 1) {
    const currentSave = resolveLocalSave(inMemoryPersistence, initializedSave.saveId);
    const currentMatchdayId = currentSave.gameState.matchdayState.matchdayId;
    const currentMatchdayIndex = currentSave.gameState.season.matchdayIds.findIndex((entry) => entry === currentMatchdayId);
    if (currentMatchdayIndex < 0) {
      blockingReasons.add("current_matchday_missing_from_local_season");
      blockedAtMatchday = {
        matchdayId: currentMatchdayId,
        label: currentMatchdayId,
      };
      break;
    }
    const controlSettingsMap = buildTeamControlSettingsMap(
      currentSave.gameState.teams,
      currentSave.gameState.seasonState.teamControlSettings,
    );
    const aiTeams = currentSave.gameState.teams.filter((team) => controlSettingsMap[team.teamId]?.controlMode === "ai");
    const manualTeams = currentSave.gameState.teams.filter((team) => controlSettingsMap[team.teamId]?.controlMode === "manual");
    const passiveTeams = currentSave.gameState.teams.filter((team) => controlSettingsMap[team.teamId]?.controlMode === "passive");
    const disabledAiTeams = aiTeams.filter((team) => !isAiLineupBatchApplyEnabled(controlSettingsMap[team.teamId])).length;
    const eligibleAiTeams = aiTeams.length - disabledAiTeams;

    const isLastMatchday = currentMatchdayIndex === currentSave.gameState.season.matchdayIds.length - 1;
    const autoRun = await runLocalMatchdayAutoRun(
      {
        saveId: currentSave.saveId,
        seasonId,
        matchdayId: currentMatchdayId,
        source,
        execute: true,
        dryRun: false,
        confirmToken: MATCHDAY_AUTO_RUN_CONFIRM_TOKEN,
        options: {
          includeWarningLineups: params.options?.includeWarningLineups ?? false,
          overwriteExistingLineups: params.options?.overwriteExistingLineups ?? false,
          stopOnTie: params.options?.stopOnTie ?? true,
          advanceAfterCashApply: advanceAfterEachMatchday && !isLastMatchday,
        },
      },
      inMemoryPersistence,
    );

    matchdaySummaries.push({
      matchdayId: currentMatchdayId,
      label: buildMatchdayLabel(currentSave.gameState, currentMatchdayId),
      status: autoRun.status,
      lineupsReady: autoRun.summary.lineupsReady,
      missingManualTeams: autoRun.summary.missingManualTeams,
      warningTeams: autoRun.summary.warningTeams,
      tieBlockers: autoRun.summary.tieBlockers,
      plannedWrites: autoRun.summary.plannedWrites,
      warnings: autoRun.warnings,
      blockingReasons: autoRun.blockingReasons,
      steps: autoRun.steps,
    });

    autoRun.warnings.forEach((warning) => warnings.add(warning));
    missingManualLineups += autoRun.summary.manualMissing;
    missingPassiveLineups += autoRun.summary.passiveMissing;
    manualTeamsReady += autoRun.summary.manualReady;
    aiTeamsReady += autoRun.summary.aiReady;
    passiveTeamsReady += autoRun.summary.passiveReady;
    skippedDisabledAiTeams += disabledAiTeams;
    missingAiLineups += Math.max(0, eligibleAiTeams - autoRun.summary.aiReady);

    if (stopOnMissingManualLineups && autoRun.summary.manualMissing > 0) {
      blockingReasons.add("missing_manual_lineup");
      blockedAtMatchday = {
        matchdayId: currentMatchdayId,
        label: buildMatchdayLabel(currentSave.gameState, currentMatchdayId),
      };
      break;
    }

    if (!autoRun.ok) {
      autoRun.blockingReasons.forEach((reason) => blockingReasons.add(reason));
      blockedAtMatchday = {
        matchdayId: currentMatchdayId,
        label: buildMatchdayLabel(currentSave.gameState, currentMatchdayId),
      };
      break;
    }

    if (isLastMatchday) {
      warnings.add("Season DryRun endet nach dem letzten vorhandenen Matchday. Season-End-Logik wird in diesem Block bewusst nicht ausgeführt.");
      break;
    }

    if (!advanceAfterEachMatchday) {
      warnings.add("Season DryRun wurde nach einem Matchday gestoppt, weil advanceAfterEachMatchday deaktiviert ist.");
      break;
    }

    const advance = await executeMatchdayAdvance(
      {
        saveId: currentSave.saveId,
        seasonId,
        source,
        execute: true,
        confirm: ADVANCE_MATCHDAY_CONFIRM_TOKEN,
      },
      inMemoryPersistence,
    );
    const currentSummary = matchdaySummaries[matchdaySummaries.length - 1];
    currentSummary?.steps.push({
      key: "matchday_advance",
      label: "Matchday Advance",
      status: advance.ok && advance.applied ? "applied" : "blocked",
      dryRun: false,
      canContinue: advance.ok && advance.applied,
      warnings: advance.warnings,
      blockingReasons: advance.ok ? [] : advance.blockingReasons,
      metrics: {
        nextMatchday: advance.scope.nextMatchdayId,
        lockedLineups: advance.summary.lockedLineups,
      },
      plannedWrites: 0,
      appliedWrites: advance.applied ? 1 : 0,
      auditId: advance.auditLogId,
    });
    advance.warnings.forEach((warning) => warnings.add(warning));
    if (!advance.ok || !advance.applied) {
      advance.blockingReasons.forEach((reason) => blockingReasons.add(reason));
      blockedAtMatchday = {
        matchdayId: currentMatchdayId,
        label: buildMatchdayLabel(currentSave.gameState, currentMatchdayId),
      };
      break;
    }
  }

  const projectedGameState = resolveLocalSave(inMemoryPersistence, initializedSave.saveId).gameState;
  const projectedRows = buildProjectedRows(projectedGameState);
  const snapshotPreview = buildSeasonSnapshotDryRun(projectedGameState, {
    saveId: realSave.saveId,
    seasonId,
  });
  const seasonPointsLedger = buildSeasonPointsLedger(projectedGameState, seasonId);
  const missingPerformanceSources = buildMissingPerformanceSources(projectedGameState, seasonId);
  snapshotPreview.warnings.forEach((warning) => warnings.add(warning));
  seasonPointsLedger.warnings.forEach((warning) => warnings.add(warning));
  for (const warning of missingPerformanceSources) {
    warnings.add(warning);
  }
  const simulatedMatchdays = matchdaySummaries.filter((entry) => entry.status === "applied").length;
  const tieBlockers = matchdaySummaries.reduce((sum, entry) => sum + entry.tieBlockers, 0);
  const missingLineups = missingManualLineups;
  const warningList = Array.from(warnings);
  const blockingList = Array.from(blockingReasons);
  const projectedCash = projectedRows.map((row) => ({
    teamId: row.teamId,
    teamName: row.teamName,
    cash: row.cash,
  }));
  const playerPPsReconciliation: WholeSeasonDryRunPlayerPpsReconciliation = {
    status: !seasonPointsLedger.hasResultSource
      ? "missing_source"
      : seasonPointsLedger.warnings.length > 0
        ? "warning"
        : "reconciled",
    hasResultSource: seasonPointsLedger.hasResultSource,
    playersWithPoints: seasonPointsLedger.playerSummariesByPlayerId.size,
    pointEntries: seasonPointsLedger.pointEntries.length,
    totalPlayerPoints: Number(
      Array.from(seasonPointsLedger.playerSummariesByPlayerId.values())
        .reduce((sum, summary) => sum + summary.totalPoints, 0)
        .toFixed(1),
    ),
    warnings: seasonPointsLedger.warnings,
  };
  const teamSummaries = Array.from(seasonPointsLedger.teamSummariesByTeamId.values());
  const teamPPsReconciliation: WholeSeasonDryRunTeamPpsReconciliation = {
    status: !seasonPointsLedger.hasResultSource
      ? "missing_source"
      : teamSummaries.some((summary) => summary.reconciliationStatus === "reconciliation_failed")
        ? "warning"
        : "reconciled",
    hasResultSource: seasonPointsLedger.hasResultSource,
    reconciledTeams: teamSummaries.filter((summary) => summary.reconciliationStatus === "reconciled").length,
    missingPlayerPointsTeams: teamSummaries.filter((summary) => summary.reconciliationStatus === "missing_player_points").length,
    failedTeams: teamSummaries.filter((summary) => summary.reconciliationStatus === "reconciliation_failed").length,
    totalTeamPoints: Number(teamSummaries.reduce((sum, summary) => sum + summary.totalPoints, 0).toFixed(1)),
    totalPlayerDerivedPoints: Number(teamSummaries.reduce((sum, summary) => sum + summary.playerDerivedTotal, 0).toFixed(1)),
    warnings: Array.from(new Set(teamSummaries.flatMap((summary) => summary.warnings).concat(seasonPointsLedger.warnings))),
  };
  const snapshotReadiness: WholeSeasonDryRunSnapshotReadiness = {
    status: snapshotPreview.blockingReasons.length > 0 ? "blocked" : snapshotPreview.warnings.length > 0 ? "warning" : "ready",
    canCreate: snapshotPreview.canCreate,
    seasonCompleted: snapshotPreview.seasonCompleted,
    duplicateDetected: snapshotPreview.duplicateDetected,
    sourceStatus: snapshotPreview.sourceStatus,
    completedMatchdays: snapshotPreview.coverage.completedMatchdayIds.length,
    totalMatchdays: snapshotPreview.coverage.totalMatchdays,
    warnings: snapshotPreview.warnings,
    blockingReasons: snapshotPreview.blockingReasons,
  };
  const status: WholeSeasonDryRunResult["status"] =
    blockingList.length > 0
      ? "blocked"
      : warningList.length > 0
        ? "warning"
        : simulatedMatchdays > 0
          ? "completed"
          : "ready";

  return {
    ok: blockingList.length === 0,
    readOnly: true,
    source,
    dryRun: true,
    simulationMode: "in_memory_local_copy",
    status,
    scope: {
      saveId: realSave.saveId,
      seasonId,
      startMatchdayId,
      totalMatchdays,
      maxMatchdays: params.maxMatchdays ?? null,
    },
    simulatedMatchdays,
    blockedAtMatchday,
    tieBlockers,
    missingLineups,
    missingManualLineups,
    missingAiLineups,
    missingPassiveLineups,
    manualTeamsReady,
    aiTeamsReady,
    passiveTeamsReady,
    skippedDisabledAiTeams,
    missingFormulaSources,
    missingPerformanceSources,
    marketPhaseStatus: {
      status: "policy_missing",
      warning: marketPhaseWarning,
    },
    snapshotReadiness,
    playerPPsReconciliation,
    teamPPsReconciliation,
    projectedFinalStandings: projectedRows.map((row) => ({
      rank: row.rank,
      teamId: row.teamId,
      teamCode: row.teamCode,
      teamName: row.teamName,
      points: row.points,
      cash: row.cash,
    })),
    projectedCash,
    projectedCashTable: projectedCash,
    projectedTeamSummaries: projectedRows,
    teamSummaries: projectedRows,
    matchdays: matchdaySummaries,
    stepsByMatchday: matchdaySummaries,
    warnings: warningList,
    blockingReasons: blockingList,
  };
}
