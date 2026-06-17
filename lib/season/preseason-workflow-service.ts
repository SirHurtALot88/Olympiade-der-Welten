import { createHash, randomUUID } from "node:crypto";

import { previewSeasonEndContracts } from "@/lib/contracts/contract-renewal-service";
import { buildGeneratedFormCardRecordsForSeason } from "@/lib/lineups/legacy-lineup-modifiers";
import type { Fixture, GameState, PreSeasonWorkflowLogRecord, SeasonState, StandingRecord } from "@/lib/data/olyDataTypes";
import { previewFacilitySeasonEndFinance } from "@/lib/facilities/facility-season-end-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";
import { buildSeasonSeededDisciplineSchedule } from "@/lib/season/season-discipline-schedule";
import { buildPlayerProgressionForecast } from "@/lib/training/player-progression-forecast";
import { buildSeasonEndProgressionPreview } from "@/lib/training/season-end-progression-preview";
import { buildPrizeMoneyPreview } from "@/lib/season/prize-money-preview";
import { buildSeasonSnapshotDryRun, upsertSeasonSnapshotRecord } from "@/lib/season/season-snapshot-service";

export const PRESEASON_NEXT_SEASON_SETUP_CONFIRM_TOKEN = "APPLY_PRESEASON_NEXT_SEASON_SETUP";

export type PreSeasonWorkflowStepId =
  | "season_review"
  | "season_rewards"
  | "facilities"
  | "player_development"
  | "preseason_management"
  | "transfer_sell_phase"
  | "contract_renewal"
  | "transfer_buy_phase"
  | "next_season_setup"
  | "next_season_ready";

export type PreSeasonWorkflowStep = {
  stepId: PreSeasonWorkflowStepId;
  label: string;
  status: "ready" | "warning" | "blocked" | "preview_only" | "applied";
  productive: boolean;
  summary: Record<string, number | string | boolean | null>;
  warnings: string[];
  blockingReasons: string[];
  confirmToken: string | null;
};

export type PreSeasonWorkflowPreview = {
  ok: boolean;
  dryRun: true;
  productiveWrites: false;
  saveContext: {
    saveId: string;
    seasonId: string;
    nextSeasonId: string;
    nextSeasonLabel: string;
    gamePhase: string;
  };
  controlSummary: {
    manualTeams: number;
    aiTeams: number;
    passiveTeams: number;
  };
  steps: PreSeasonWorkflowStep[];
  warnings: string[];
  blockingReasons: string[];
};

export type PreSeasonWorkflowApplyResult = Omit<PreSeasonWorkflowPreview, "dryRun" | "productiveWrites"> & {
  dryRun: false;
  productiveWrites: true;
  applied: boolean;
  appliedStepId: PreSeasonWorkflowStepId | null;
  auditLogId: string | null;
};

function roundValue(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function toFiniteNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseSeasonNumber(season: GameState["season"]) {
  const fromId = season.id.match(/(\d+)$/)?.[1];
  const fromName = season.name.match(/(\d+)$/)?.[1];
  return Math.max(1, Number(fromId ?? fromName ?? season.year ?? 1) || 1);
}

function buildNextSeasonContext(gameState: GameState) {
  const nextNumber = parseSeasonNumber(gameState.season) + 1;
  return {
    nextSeasonNumber: nextNumber,
    nextSeasonId: `season-${nextNumber}`,
    nextSeasonLabel: `Season ${nextNumber}`,
  };
}

function buildConfirmToken(input: { saveId: string; fromSeasonId: string; nextSeasonId: string; teamCount: number; rosterCount: number }) {
  return createHash("sha256")
    .update([input.saveId, input.fromSeasonId, input.nextSeasonId, input.teamCount, input.rosterCount].join(":"))
    .digest("hex");
}

function getTeamControlMode(save: PersistedSaveGame, teamId: string) {
  const setting = save.gameState.seasonState.teamControlSettings?.[teamId]?.controlMode;
  if (setting === "ai" || setting === "passive" || setting === "manual") return setting;
  const team = save.gameState.teams.find((entry) => entry.teamId === teamId);
  return team?.humanControlled ? "manual" : "ai";
}

function getSalaryTotal(gameState: GameState, teamId: string) {
  return roundValue(gameState.rosters.filter((entry) => entry.teamId === teamId).reduce((sum, entry) => sum + (entry.salary ?? 0), 0));
}

function buildZeroStandings(gameState: GameState): Record<string, StandingRecord> {
  return Object.fromEntries(
    gameState.teams.map((team, index) => [
      team.teamId,
      {
        points: 0,
        rank: index + 1,
      } satisfies StandingRecord,
    ]),
  );
}

function buildSeasonFixtures(input: { seasonId: string; matchdayIds: string[]; teamIds: string[] }): Fixture[] {
  if (input.teamIds.length < 2) {
    return [];
  }

  return input.matchdayIds.map((matchdayId, index) => ({
    id: `fixture:${input.seasonId}:${matchdayId}`,
    homeTeamId: input.teamIds[index % input.teamIds.length] ?? input.teamIds[0],
    awayTeamId: input.teamIds[(index + 1) % input.teamIds.length] ?? input.teamIds[1],
    matchdayId,
    status: "scheduled" as const,
  }));
}

function signatureSchedule(entries: NonNullable<SeasonState["disciplineSchedule"]>) {
  return entries
    .map((entry) => `${entry.discipline1?.disciplineId ?? "-"}:${entry.discipline2?.disciplineId ?? "-"}`)
    .join("|");
}

function buildNextSeasonGameState(save: PersistedSaveGame): { gameState: GameState; auditLog: PreSeasonWorkflowLogRecord } {
  const { nextSeasonId, nextSeasonLabel, nextSeasonNumber } = buildNextSeasonContext(save.gameState);
  const schedulePlan = buildSeasonSeededDisciplineSchedule({
    saveId: save.saveId,
    seasonId: nextSeasonId,
    disciplines: save.gameState.disciplines,
    matchdayCount: save.gameState.season.matchdayIds.length || 10,
  });
  const matchdayIds = schedulePlan.matchdayIds;
  const previousSchedule = save.gameState.seasonState.disciplineSchedule ?? [];
  const scheduleSameAsPrevious =
    previousSchedule.length > 0 &&
    signatureSchedule(previousSchedule) === signatureSchedule(schedulePlan.entries);
  const scheduleWarnings = [
    ...schedulePlan.warnings,
    scheduleSameAsPrevious ? "season_schedule_same_as_previous_warning" : null,
  ].filter((entry): entry is string => Boolean(entry));
  const nextFormCards = buildGeneratedFormCardRecordsForSeason(
    {
      ...save.gameState,
      season: {
        ...save.gameState.season,
        id: nextSeasonId,
        name: nextSeasonLabel,
        year: Math.max(save.gameState.season.year + 1, nextSeasonNumber),
        currentMatchday: 1,
        matchdayIds,
      },
    },
    save.saveId,
    nextSeasonId,
  );
  const nextSeasonState: SeasonState = {
    ...save.gameState.seasonState,
    seasonId: nextSeasonId,
    schedule: buildSeasonFixtures({
      seasonId: nextSeasonId,
      matchdayIds,
      teamIds: save.gameState.teams.map((team) => team.teamId),
    }),
    disciplineSchedule: schedulePlan.entries,
    standings: buildZeroStandings(save.gameState),
    formCards: nextFormCards,
    lineupDrafts: [],
    matchdayResults: [],
    disciplineResults: [],
    playerDisciplinePerformances: [],
    disciplineHighlights: [],
    resultAuditLogs: [],
    standingsApplyLogs: [],
    matchdayAdvanceLogs: [],
    cashPrizeApplyLogs: [],
  };
  const auditLog: PreSeasonWorkflowLogRecord = {
    logId: `preseason-workflow__${save.saveId}__${save.gameState.season.id}__${nextSeasonId}__${randomUUID()}`,
    saveId: save.saveId,
    fromSeasonId: save.gameState.season.id,
    toSeasonId: nextSeasonId,
    stepId: "next_season_setup",
    status: "applied",
    errors: [],
    warnings: [
      ...scheduleWarnings,
      nextFormCards.length === 0 ? "season_formcards_generation_empty" : null,
      "season_mutator_state_reset_lineup_modifiers_cleared",
    ].filter((entry): entry is string => Boolean(entry)),
    affectedEntities: [
      "season",
      "matchdayState",
      "seasonState.schedule",
      "seasonState.disciplineSchedule",
      "seasonState.standings",
      "seasonState.formCards",
      "seasonState.lineupDrafts",
      "seasonState.matchdayResults",
      "seasonState.disciplineResults",
      "seasonState.playerDisciplinePerformances",
      "arena_state_reset",
    ],
    timestamp: new Date().toISOString(),
  };

  return {
    auditLog,
    gameState: {
      ...save.gameState,
      gamePhase: "season_active",
      season: {
        ...save.gameState.season,
        id: nextSeasonId,
        name: nextSeasonLabel,
        year: Math.max(save.gameState.season.year + 1, nextSeasonNumber),
        currentMatchday: 1,
        matchdayIds,
      },
      seasonState: {
        ...nextSeasonState,
        preSeasonWorkflowLogs: [auditLog, ...(save.gameState.seasonState.preSeasonWorkflowLogs ?? [])],
      },
      matchdayState: {
        matchdayId: matchdayIds[0],
        status: "planning",
        pendingTeamIds: save.gameState.teams.map((team) => team.teamId),
        resolvedFixtureIds: [],
      },
      logs: [
        {
          id: auditLog.logId,
          type: "season",
          message: `${nextSeasonLabel} aktiviert. Pre-Season Workflow abgeschlossen.`,
          createdAt: auditLog.timestamp,
        },
        ...save.gameState.logs,
      ],
    },
  };
}

function buildSaveWithRequiredSeasonSnapshot(save: PersistedSaveGame): {
  save: PersistedSaveGame;
  snapshotId: string | null;
  blockingReasons: string[];
  warnings: string[];
} {
  const snapshotPreview = buildSeasonSnapshotDryRun(save.gameState, {
    saveId: save.saveId,
    seasonId: save.gameState.season.id,
  });
  const blockingReasons = [...snapshotPreview.blockingReasons];
  const warnings = [...snapshotPreview.warnings];
  const duplicateIndex = blockingReasons.indexOf("duplicate_season_snapshot");

  if (duplicateIndex >= 0) {
    blockingReasons.splice(duplicateIndex, 1);
    warnings.push("season_snapshot_replaced_before_next_season_setup");
  }
  if (snapshotPreview.snapshot.finalStandings.length === 0) {
    blockingReasons.push("season_snapshot_final_standings_missing");
  }
  if (snapshotPreview.snapshot.playerPerformances.length === 0) {
    blockingReasons.push("season_snapshot_player_performances_missing");
  }

  if (blockingReasons.length > 0) {
    return {
      save,
      snapshotId: null,
      blockingReasons: Array.from(new Set(blockingReasons)),
      warnings: Array.from(new Set(warnings)),
    };
  }

  const nextGameState: GameState = {
    ...save.gameState,
    seasonState: {
      ...save.gameState.seasonState,
      seasonSnapshots: upsertSeasonSnapshotRecord(save.gameState.seasonState.seasonSnapshots, {
        ...snapshotPreview.snapshot,
        status: snapshotPreview.seasonCompleted ? "completed" : "partial",
      }),
    },
  };

  return {
    save: {
      ...save,
      gameState: nextGameState,
    },
    snapshotId: snapshotPreview.snapshot.snapshotId ?? null,
    blockingReasons: [],
    warnings: Array.from(new Set(warnings)),
  };
}

export function buildPreSeasonNextSeasonSetupToken(save: PersistedSaveGame) {
  const { nextSeasonId, nextSeasonLabel } = buildNextSeasonContext(save.gameState);
  return {
    nextSeasonId,
    nextSeasonLabel,
    confirmToken: buildConfirmToken({
      saveId: save.saveId,
      fromSeasonId: save.gameState.season.id,
      nextSeasonId,
      teamCount: save.gameState.teams.length,
      rosterCount: save.gameState.rosters.length,
    }),
  };
}

export function applyPreSeasonNextSeasonSetupLightweight(
  save: PersistedSaveGame,
  confirmToken: string | null | undefined,
  persistence: PersistenceService = createPersistenceService(),
): PreSeasonWorkflowApplyResult {
  const setup = buildPreSeasonNextSeasonSetupToken(save);
  const basePreview: PreSeasonWorkflowPreview = {
    ok: true,
    dryRun: true,
    productiveWrites: false,
    saveContext: {
      saveId: save.saveId,
      seasonId: save.gameState.season.id,
      nextSeasonId: setup.nextSeasonId,
      nextSeasonLabel: setup.nextSeasonLabel,
      gamePhase: save.gameState.gamePhase ?? "season_active",
    },
    controlSummary: {
      manualTeams: save.gameState.teams.filter((team) => getTeamControlMode(save, team.teamId) === "manual").length,
      aiTeams: save.gameState.teams.filter((team) => getTeamControlMode(save, team.teamId) === "ai").length,
      passiveTeams: save.gameState.teams.filter((team) => getTeamControlMode(save, team.teamId) === "passive").length,
    },
    steps: [
      {
        stepId: "next_season_setup",
        label: "Season Setup",
        status: "ready",
        productive: true,
        summary: {
          nextSeasonId: setup.nextSeasonId,
          nextSeasonLabel: setup.nextSeasonLabel,
          resetLineups: save.gameState.seasonState.lineupDrafts?.length ?? 0,
          resetFormCards: save.gameState.seasonState.formCards?.length ?? 0,
          matchday: 1,
          standingsReset: true,
        },
        warnings: ["lightweight_next_season_setup_skip_expensive_preview"],
        blockingReasons: [],
        confirmToken: setup.confirmToken,
      },
    ],
    warnings: ["lightweight_next_season_setup_skip_expensive_preview"],
    blockingReasons: [],
  };

  if (confirmToken !== setup.confirmToken) {
    return {
      ...basePreview,
      dryRun: false,
      productiveWrites: true,
      applied: false,
      appliedStepId: null,
      auditLogId: null,
      blockingReasons: [confirmToken ? "preseason_preview_stale" : "confirm_token_required"],
    };
  }

  const snapshotResult = buildSaveWithRequiredSeasonSnapshot(save);
  if (snapshotResult.blockingReasons.length > 0) {
    return {
      ...basePreview,
      dryRun: false,
      productiveWrites: true,
      applied: false,
      appliedStepId: null,
      auditLogId: null,
      warnings: [...basePreview.warnings, ...snapshotResult.warnings],
      blockingReasons: snapshotResult.blockingReasons,
    };
  }

  const { gameState, auditLog } = buildNextSeasonGameState(snapshotResult.save);
  persistence.saveSingleplayerState(save.saveId, gameState);
  return {
    ...basePreview,
    dryRun: false,
    productiveWrites: true,
    applied: true,
    appliedStepId: "next_season_setup",
    auditLogId: auditLog.logId,
    saveContext: {
      ...basePreview.saveContext,
      seasonId: gameState.season.id,
      gamePhase: gameState.gamePhase ?? "season_active",
    },
    warnings: [...basePreview.warnings, ...snapshotResult.warnings],
    steps: basePreview.steps.map((step) => ({ ...step, status: "applied" as const })),
  };
}

export async function buildPreSeasonWorkflowPreview(
  save: PersistedSaveGame,
  persistence: PersistenceService = createPersistenceService(),
): Promise<PreSeasonWorkflowPreview> {
  const { nextSeasonId, nextSeasonLabel } = buildNextSeasonContext(save.gameState);
  const controlModes = save.gameState.teams.map((team) => getTeamControlMode(save, team.teamId));
  const controlSummary = {
    manualTeams: controlModes.filter((mode) => mode === "manual").length,
    aiTeams: controlModes.filter((mode) => mode === "ai").length,
    passiveTeams: controlModes.filter((mode) => mode === "passive").length,
  };
  const prizePreview = await buildPrizeMoneyPreview(
    { saveId: save.saveId, seasonId: save.gameState.season.id, source: "sqlite", phase: "season_end" },
    persistence,
  );
  const facilityPreviews = save.gameState.teams.map((team) => previewFacilitySeasonEndFinance(save, team.teamId));
  const totalPrizeMoney = roundValue(prizePreview.items.reduce((sum, item) => sum + (item.prizeMoney ?? 0), 0));
  const totalRankChangePrize = prizePreview.summary.totalRankChangePrize == null ? null : roundValue(prizePreview.summary.totalRankChangePrize);
  const totalSponsor = roundValue(prizePreview.items.reduce((sum, item) => sum + (item.seasonCash ?? 0), 0));
  const totalUpkeep = roundValue(facilityPreviews.reduce((sum, item) => sum + item.facilityUpkeepTotal, 0));
  const totalFacilityIncome = roundValue(facilityPreviews.reduce((sum, item) => sum + item.facilityIncomeTotal, 0));
  const totalSalary = roundValue(save.gameState.teams.reduce((sum, team) => sum + getSalaryTotal(save.gameState, team.teamId), 0));
  const cashBefore = roundValue(save.gameState.teams.reduce((sum, team) => sum + (toFiniteNumber(team.cash) ?? 0), 0));
  const cashAfterRewards = roundValue(
    prizePreview.items.reduce((sum, item) => sum + (item.projectedCash ?? item.currentCash ?? 0), 0),
  );
  const cashAfterFacilities = roundValue(cashAfterRewards + totalFacilityIncome - totalUpkeep);
  const prizeApplyLogs = save.gameState.seasonState.cashPrizeApplyLogs ?? [];
  const currentSeasonPrizeApplyLogs = prizeApplyLogs.filter((log) => log.seasonId === save.gameState.season.id);
  const prizeApplied = currentSeasonPrizeApplyLogs.length > 0;
  const forecastsByPlayerId = new Map(
    save.gameState.rosters.map((entry) => {
      const player = save.gameState.players.find((candidate) => candidate.id === entry.playerId)!;
      return [
        entry.playerId,
        buildPlayerProgressionForecast({
          gameState: save.gameState,
          player,
          playerRating: null,
          seasonPerformance: null,
          trainingModeByPlayerId: {},
          currentXP: player.currentXP ?? 0,
          spentXP: player.spentXP ?? 0,
          lifetimeXP: player.lifetimeXP ?? null,
        }),
      ] as const;
    }).filter((entry) => Boolean(entry[1])),
  );
  const progressionPreview = buildSeasonEndProgressionPreview({
    gameState: save.gameState,
    forecastsByPlayerId,
    upgradeRequests: save.gameState.rosters.map((entry) => ({ playerId: entry.playerId, attribute: "power" })),
  });
  const contractPreview = previewSeasonEndContracts(save);
  const marketPreviewWarning = "market_candidate_scan_deferred_use_transfermarkt_tab_or_ai_market_apply_service";
  const nextSeasonConfirmToken = buildConfirmToken({
    saveId: save.saveId,
    fromSeasonId: save.gameState.season.id,
    nextSeasonId,
    teamCount: save.gameState.teams.length,
    rosterCount: save.gameState.rosters.length,
  });
  const rewardsWarnings = [
    ...prizePreview.globalWarnings,
    ...facilityPreviews.flatMap((preview) => preview.warnings.map((warning) => `${preview.team?.shortCode ?? preview.team?.teamId}:${warning}`)),
    prizePreview.source.prizeTable === "missing" ? "prize_money_source_missing" : null,
    totalSponsor <= 0 ? "sponsor_source_missing" : null,
  ].filter((entry): entry is string => Boolean(entry));
  const steps: PreSeasonWorkflowStep[] = [
    {
      stepId: "season_review",
      label: "Season Review",
      status: "preview_only",
      productive: false,
      summary: {
        seasonId: save.gameState.season.id,
        finalStandings: Object.keys(save.gameState.seasonState.standings ?? {}).length,
        snapshots: save.gameState.seasonState.seasonSnapshots?.length ?? 0,
        productiveWrites: false,
      },
      warnings: [],
      blockingReasons: [],
      confirmToken: null,
    },
    {
      stepId: "season_rewards",
      label: "Preisgeld & Finanzen",
      status: prizePreview.blockedRules.length > 0 ? "blocked" : rewardsWarnings.length > 0 ? "warning" : "ready",
      productive: true,
      summary: {
        cashBefore,
        prizeMoney: totalPrizeMoney,
        rankChangePrize: totalRankChangePrize,
        sponsor: totalSponsor,
        cashAfterRewards,
        prizeApplied,
        alreadyApplied: prizeApplied,
        applyLogCount: currentSeasonPrizeApplyLogs.length,
      },
      warnings: [...rewardsWarnings, prizeApplied ? "already_applied" : "prize_money_open"],
      blockingReasons: prizePreview.blockedRules,
      confirmToken: "USE_CASH_PRIZE_AND_FACILITY_CONFIRM_STEPS",
    },
    {
      stepId: "facilities",
      label: "Facilities",
      status: facilityPreviews.some((preview) => preview.blockingReasons.length > 0) ? "blocked" : facilityPreviews.some((preview) => preview.warnings.length > 0) ? "warning" : "ready",
      productive: true,
      summary: { facilityUpkeep: totalUpkeep, facilityIncome: totalFacilityIncome, salaryTotal: totalSalary, cashAfterFacilities },
      warnings: facilityPreviews.flatMap((preview) => preview.warnings.map((warning) => `${preview.team?.shortCode ?? preview.team?.teamId}:${warning}`)),
      blockingReasons: facilityPreviews.flatMap((preview) => preview.blockingReasons.map((blocker) => `${preview.team?.shortCode ?? preview.team?.teamId}:${blocker}`)),
      confirmToken: "USE_FACILITY_SEASON_END_CONFIRM_STEP",
    },
    {
      stepId: "player_development",
      label: "XP / Spielerentwicklung",
      status: "preview_only",
      productive: false,
      summary: { players: progressionPreview.rows.length, planned: progressionPreview.rows.filter((row) => row.status === "planned").length, blocked: progressionPreview.rows.filter((row) => row.status === "blocked").length, productiveWrites: false },
      warnings: progressionPreview.warnings,
      blockingReasons: [],
      confirmToken: null,
    },
    {
      stepId: "preseason_management",
      label: "Training / Ziele",
      status: "preview_only",
      productive: false,
      summary: { facilityUpgradeServiceReady: true, specialistWingPrepared: true, manualTeamsWaiting: controlSummary.manualTeams, aiTeamsReady: controlSummary.aiTeams },
      warnings: ["existing_apply_services_only", "manual_teams_wait_for_user_decision"],
      blockingReasons: [],
      confirmToken: null,
    },
    {
      stepId: "transfer_sell_phase",
      label: "Verkäufe",
      status: controlSummary.aiTeams > 0 ? "ready" : "preview_only",
      productive: true,
      summary: { aiTeams: controlSummary.aiTeams, sellTeams: null, manualTeamsSkipped: controlSummary.manualTeams, passiveTeamsSkipped: controlSummary.passiveTeams, usesSellService: true },
      warnings: ["human_teams_no_auto_sell", "ai_sell_before_buy", "uses executeLocalTransfermarktSell via ai-market-plan-apply-service", "transfer_history_required", marketPreviewWarning],
      blockingReasons: [],
      confirmToken: "USE_AI_MARKET_APPLY_CONFIRM_TOKEN_SELL_ONLY",
    },
    {
      stepId: "contract_renewal",
      label: "Verlängern",
      status: contractPreview.blockingReasons.length > 0 ? "blocked" : contractPreview.expiringCount > 0 ? "warning" : "ready",
      productive: true,
      summary: {
        renewalServiceReady: true,
        expiringContracts: contractPreview.expiringCount,
        outOfContractAfterTick: contractPreview.outOfContractAfterTickCount,
        manualDecisionsRequired: contractPreview.manualDecisionCount,
        aiRenewalCandidates: contractPreview.aiRenewalCandidates,
        aiReleaseCandidates: contractPreview.aiReleaseCandidates,
        contractEventsExisting: save.gameState.seasonState.contractEvents?.length ?? 0,
      },
      warnings: contractPreview.warnings,
      blockingReasons: contractPreview.blockingReasons,
      confirmToken: contractPreview.confirmToken,
    },
    {
      stepId: "transfer_buy_phase",
      label: "Kaufen",
      status: controlSummary.aiTeams > 0 ? "ready" : "preview_only",
      productive: true,
      summary: { aiTeams: controlSummary.aiTeams, buyTeams: null, manualTeamsSkipped: controlSummary.manualTeams, passiveTeamsSkipped: controlSummary.passiveTeams, usesBuyService: true },
      warnings: ["human_teams_no_auto_buy", "buy_after_sell", "uses executeLocalTransfermarktBuy via ai-market-plan-apply-service", "transfer_history_required", marketPreviewWarning],
      blockingReasons: [],
      confirmToken: "USE_AI_MARKET_APPLY_CONFIRM_TOKEN_BUY_AFTER_SELL",
    },
    {
      stepId: "next_season_setup",
      label: "Season Setup",
      status: "ready",
      productive: true,
      summary: { nextSeasonId, nextSeasonLabel, resetLineups: save.gameState.seasonState.lineupDrafts?.length ?? 0, resetFormCards: save.gameState.seasonState.formCards?.length ?? 0, matchday: 1, standingsReset: true },
      warnings: ["team_control_settings_preserved", "rosters_and_transfer_history_preserved"],
      blockingReasons: [],
      confirmToken: nextSeasonConfirmToken,
    },
    {
      stepId: "next_season_ready",
      label: "Neue Saison aktivieren",
      status: "ready",
      productive: true,
      summary: { button: "Neue Saison starten", gamePhaseAfterApply: "season_active", reconciliation: "local_save_scope_and_counts" },
      warnings: [],
      blockingReasons: [],
      confirmToken: nextSeasonConfirmToken,
    },
  ];
  const warnings = [...new Set(steps.flatMap((step) => step.warnings))];
  const blockingReasons = [...new Set(steps.flatMap((step) => step.blockingReasons))];

  return {
    ok: blockingReasons.length === 0,
    dryRun: true,
    productiveWrites: false,
    saveContext: {
      saveId: save.saveId,
      seasonId: save.gameState.season.id,
      nextSeasonId,
      nextSeasonLabel,
      gamePhase: save.gameState.gamePhase ?? "season_active",
    },
    controlSummary,
    steps,
    warnings,
    blockingReasons,
  };
}

export async function applyPreSeasonNextSeasonSetup(
  save: PersistedSaveGame,
  confirmToken: string | null | undefined,
  persistence: PersistenceService = createPersistenceService(),
): Promise<PreSeasonWorkflowApplyResult> {
  const preview = await buildPreSeasonWorkflowPreview(save, persistence);
  const setupStep = preview.steps.find((step) => step.stepId === "next_season_setup");
  if (!setupStep?.confirmToken || confirmToken !== setupStep.confirmToken) {
    return {
      ...preview,
      dryRun: false,
      productiveWrites: true,
      applied: false,
      appliedStepId: null,
      auditLogId: null,
      blockingReasons: [...preview.blockingReasons, confirmToken ? "preseason_preview_stale" : "confirm_token_required"],
    };
  }
  const snapshotResult = buildSaveWithRequiredSeasonSnapshot(save);
  if (snapshotResult.blockingReasons.length > 0) {
    return {
      ...preview,
      dryRun: false,
      productiveWrites: true,
      applied: false,
      appliedStepId: null,
      auditLogId: null,
      warnings: [...preview.warnings, ...snapshotResult.warnings],
      blockingReasons: snapshotResult.blockingReasons,
    };
  }

  const { gameState, auditLog } = buildNextSeasonGameState(snapshotResult.save);
  persistence.saveSingleplayerState(save.saveId, gameState);
  const nextPreview = await buildPreSeasonWorkflowPreview({ ...snapshotResult.save, gameState }, persistence);

  return {
    ...nextPreview,
    dryRun: false,
    productiveWrites: true,
    applied: true,
    appliedStepId: "next_season_setup",
    auditLogId: auditLog.logId,
    warnings: [...nextPreview.warnings, ...snapshotResult.warnings],
    steps: nextPreview.steps.map((step) =>
      step.stepId === "next_season_setup" || step.stepId === "next_season_ready"
        ? { ...step, status: "applied" as const }
        : step,
    ),
  };
}
