import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

import { loadEnvConfig } from "@next/env";

import { AI_MARKET_APPLY_CONFIRM_TOKEN } from "@/lib/ai/ai-market-plan-apply-contract";
import { applyAiMarketPlanLocally } from "@/lib/ai/ai-market-plan-apply-service";
import { buildAiTransfermarktSellPreview } from "@/lib/ai/ai-transfermarkt-sell-preview-service";
import { applyAiLegacyLineupBatchLocally } from "@/lib/ai/ai-legacy-lineup-batch-apply-service";
import { CHUNKED_REDRAFT_TOPUP_CONFIRM_TOKEN, runChunkedRedraftTopup } from "@/lib/ai/chunked-redraft-topup-service";
import { applySeasonEndContractTick, previewSeasonEndContracts } from "@/lib/contracts/contract-renewal-service";
import type { GameState, RosterEntry, TeamControlSettings, TransferHistoryEntry } from "@/lib/data/olyDataTypes";
import { FACILITY_CATALOG } from "@/lib/facilities/facility-catalog";
import { getFacilityEfficiency, getFacilityLevel, getTeamFacilityState } from "@/lib/facilities/facility-effects";
import { applyFacilitySeasonEndFinance, previewFacilitySeasonEndFinance } from "@/lib/facilities/facility-season-end-service";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { getTeamPlayerMax } from "@/lib/foundation/roster-limits";
import { buildTeamControlSettingsMap } from "@/lib/foundation/team-control-settings";
import {
  createLocalTransfermarktRunContext,
  executeLocalTransfermarktSell,
  flushLocalTransfermarktRunContext,
} from "@/lib/market/transfermarkt-local-service";
import { loadLocalLegacyLineupContext, loadLocalLegacyLineupContextFromGameState } from "@/lib/lineups/legacy-lineup-local-service";
import { countSeasonCaptains, SEASON_CAPTAIN_SLOTS } from "@/lib/lineups/lineup-discipline-contract";
import { buildPlayerMoraleAudit } from "@/lib/morale/player-morale-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { getDatabase } from "@/lib/persistence/sqlite";
import { SEASON_START_RESET_CONFIRM_TOKEN } from "@/lib/persistence/season-start-reset-contract";
import { runSeasonStartReset } from "@/lib/persistence/season-start-reset-service";
import { withScenarioMeta } from "@/lib/persistence/scenario-meta";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";
import { previewAiSeasonEndXpSpend } from "@/lib/progression/ai-xp-spend-planner";
import { applySeasonEndXpSpend } from "@/lib/progression/season-end-xp-apply-service";
import { APPLY_CONFIRM_TOKEN, LegacyMatchdayResultApplyService } from "@/lib/resolve/legacy-matchday-result-apply-service";
import { ADVANCE_MATCHDAY_CONFIRM_TOKEN, executeMatchdayAdvance } from "@/lib/season/matchday-progress-service";
import { applyPreSeasonNextSeasonSetupLightweight, buildPreSeasonNextSeasonSetupToken } from "@/lib/season/preseason-workflow-service";
import { CASH_PRIZE_APPLY_CONFIRM_TOKEN, executeCashPrizeApply, previewCashPrizeApply } from "@/lib/season/cash-prize-apply-service";
import { buildSeasonReview } from "@/lib/season/season-review-service";
import { executeStandingsApply, STANDINGS_APPLY_CONFIRM_TOKEN } from "@/lib/standings/standings-apply-service";

const PROJECT_ROOT = path.resolve(__dirname, "..");
const OUTPUT_DIR =
  process.env.OLY_LONG_RUN_OUTPUT_DIR ??
  "/Users/chrisfalk/Documents/Codex/2026-06-11/wir-machen-weiter-mit-dem-olympiade/outputs";
const TARGET_FINAL_SEASON = Number(process.env.OLY_LONG_RUN_FINAL_SEASON ?? 6);
const RUN_LABEL = process.env.OLY_LONG_RUN_LABEL ?? `Long Run Sandbox S1-S${TARGET_FINAL_SEASON}`;
const RESUME_SAVE_ID = process.env.OLY_LONG_RUN_SAVE_ID ?? null;
const FULL_CHURN_STRESS_MODE = process.env.OLY_FULL_CHURN_STRESS_MODE === "true";

type SeasonAudit = {
  seasonId: string;
  champion: string | null;
  matchdaysResolved: number;
  teamCount: number;
  rosterMin: number;
  rosterMax: number;
  rosterAllExactlyTen: boolean;
  transferCount: number;
  buyCount: number;
  sellCount: number;
  contractExitCount: number;
  renewalCount: number;
  injuries: number;
  lineupBlockers: number;
  totalCash: number;
  minCash: number;
  maxCash: number;
  totalSalary: number;
  totalPrizeMoney: number;
  aiMarketStatus: string;
  warnings: string[];
  blockers: string[];
};

type PhaseMetric = {
  seasonId: string;
  matchdayId?: string | null;
  phase: string;
  durationMs: number;
  itemCount?: number | null;
  status: "ok" | "blocked" | "skipped";
  note?: string | null;
  memoryBeforeMb?: number | null;
  memoryAfterMb?: number | null;
  candidatePoolTotal?: number | null;
  candidatePoolLegal?: number | null;
  candidatePoolAfterCheapFit?: number | null;
  expensivePreviewCount?: number | null;
  buyApplyCount?: number | null;
  sellApplyCount?: number | null;
  cacheHits?: number | null;
  cacheMisses?: number | null;
  slowestTeam?: string | null;
  slowestPlayer?: string | null;
  warnings?: string | null;
  errors?: string | null;
};

function ensureOutputDir() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function writeOutput(fileName: string, content: string) {
  ensureOutputDir();
  fs.writeFileSync(path.join(OUTPUT_DIR, fileName), content, "utf8");
}

function csvEscape(value: unknown) {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function writeCsv(fileName: string, rows: Array<Record<string, unknown>>, preferredHeaders: string[] = []) {
  const headers = preferredHeaders.length
    ? preferredHeaders
    : Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  writeOutput(
    fileName,
    `${[headers.join(","), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))].join("\n")}\n`,
  );
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function memoryMb() {
  return round(process.memoryUsage().heapUsed / 1024 / 1024, 2);
}

function asSimulationApplySave(save: PersistedSaveGame): PersistedSaveGame {
  if (save.status === "active") return save;
  return { ...save, status: "active" };
}

function parseSeasonNumber(seasonId: string) {
  return Number(seasonId.match(/(\d+)$/)?.[1] ?? 1) || 1;
}

function countBy<T>(items: T[], predicate: (item: T) => boolean) {
  return items.reduce((sum, item) => sum + (predicate(item) ? 1 : 0), 0);
}

function hasNonEmptyStandings(gameState: GameState) {
  const rows = Object.values(gameState.seasonState.standings ?? {});
  if (rows.length === 0) return false;
  return rows.some((row) =>
    (row.points ?? 0) !== 0 ||
    (row.cashFc ?? 0) !== 0 ||
    (row.sponsorSeason ?? 0) !== 0 ||
    (row.sponsorTotal ?? 0) !== 0 ||
    (row.guv ?? 0) !== 0 ||
    (row.cashTotal ?? 0) !== 0 ||
    (row.rankDiff ?? 0) !== 0,
  );
}

function recordPhase(
  rows: PhaseMetric[],
  input: Omit<PhaseMetric, "durationMs"> & { startedAt: number },
) {
  rows.push({
    seasonId: input.seasonId,
    matchdayId: input.matchdayId ?? null,
    phase: input.phase,
    durationMs: Date.now() - input.startedAt,
    itemCount: input.itemCount ?? null,
    status: input.status,
    note: input.note ?? null,
    memoryBeforeMb: input.memoryBeforeMb ?? null,
    memoryAfterMb: input.memoryAfterMb ?? null,
    candidatePoolTotal: input.candidatePoolTotal ?? null,
    candidatePoolLegal: input.candidatePoolLegal ?? null,
    candidatePoolAfterCheapFit: input.candidatePoolAfterCheapFit ?? null,
    expensivePreviewCount: input.expensivePreviewCount ?? null,
    buyApplyCount: input.buyApplyCount ?? null,
    sellApplyCount: input.sellApplyCount ?? null,
    cacheHits: input.cacheHits ?? null,
    cacheMisses: input.cacheMisses ?? null,
    slowestTeam: input.slowestTeam ?? null,
    slowestPlayer: input.slowestPlayer ?? null,
    warnings: input.warnings ?? null,
    errors: input.errors ?? null,
  });
}

function rosterCounts(gameState: GameState) {
  return gameState.teams.map((team) => ({
    team,
    roster: gameState.rosters.filter((entry) => entry.teamId === team.teamId),
    identity: gameState.teamIdentities.find((entry) => entry.teamId === team.teamId) ?? null,
  }));
}

function setAllTeamsAi(save: PersistedSaveGame, persistence: PersistenceService) {
  const settings = Object.fromEntries(
    save.gameState.teams.map((team) => [
      team.teamId,
      {
        teamId: team.teamId,
        controlMode: "ai",
        ownerId: "ai",
        ownerSlot: "ai",
        displayLabel: `AI · ${team.shortCode}`,
        aiLineupPreviewEnabled: true,
        aiLineupApplyEnabled: true,
        aiLineupAutoApplyEnabled: false,
        aiTransferPreviewEnabled: true,
        aiTransferAutoApplyEnabled: true,
        aiSellPreviewEnabled: true,
        aiSellAutoApplyEnabled: true,
        notes: "long_run_sandbox_all_ai",
        strategyLock: null,
      } satisfies TeamControlSettings,
    ]),
  );
  const gameState = withScenarioMeta(
    {
      ...save.gameState,
      teams: save.gameState.teams.map((team) => ({ ...team, humanControlled: false })),
      seasonState: {
        ...save.gameState.seasonState,
        teamControlSettings: settings,
      },
    },
    {
      scenarioType: "sandbox_multiseason_test",
      label: RUN_LABEL,
      description: "Dedizierter sauberer Long-Run-Sandbox-Save fuer S1-S6 Balance- und Technik-Audit.",
      sourceSaveId: save.saveId,
      isStableTestPoint: true,
      allowTestWrites: true,
      containsSeasonHistory: false,
      containsFinalStandings: false,
    },
  );
  return persistence.saveSingleplayerState(save.saveId, gameState);
}

function assertCleanLongRunStart(save: PersistedSaveGame, stage: string) {
  const state = save.gameState;
  const issues = [
    state.rosters.length > 0 ? `rosters:${state.rosters.length}` : null,
    state.contracts.length > 0 ? `contracts:${state.contracts.length}` : null,
    state.transferHistory.length > 0 ? `transferHistory:${state.transferHistory.length}` : null,
    state.transferListings.length > 0 ? `transferListings:${state.transferListings.length}` : null,
    (state.seasonState.lineupDrafts ?? []).length > 0
      ? `lineupDrafts:${(state.seasonState.lineupDrafts ?? []).length}`
      : null,
    (state.seasonState.matchdayResults ?? []).length > 0
      ? `matchdayResults:${(state.seasonState.matchdayResults ?? []).length}`
      : null,
    (state.seasonState.disciplineResults ?? []).length > 0
      ? `disciplineResults:${(state.seasonState.disciplineResults ?? []).length}`
      : null,
    (state.seasonState.playerDisciplinePerformances ?? []).length > 0
      ? `playerDisciplinePerformances:${(state.seasonState.playerDisciplinePerformances ?? []).length}`
      : null,
    hasNonEmptyStandings(state)
      ? `standings:${Object.keys(state.seasonState.standings ?? {}).length}`
      : null,
  ].filter((entry): entry is string => Boolean(entry));

  if (issues.length > 0) {
    throw new Error(`Long-run clean start failed at ${stage}: ${issues.join(" | ")}`);
  }
}

function topUpSeasonOneToTargets(saveId: string, persistence: PersistenceService) {
  const save = persistence.getSaveById(saveId);
  if (!save) throw new Error("Long-run save missing before S1 top-up.");
  if (save.gameState.season.id !== "season-1") {
    return {
      blockers: [`season1_autoprep_topup_forbidden_after_s1:${save.gameState.season.id}`],
      purchases: [] as Array<Record<string, unknown>>,
    };
  }
  const result = runChunkedRedraftTopup({
    persistence,
    saveId,
    seasonId: save.gameState.season.id,
    dryRun: false,
    confirmToken: CHUNKED_REDRAFT_TOPUP_CONFIRM_TOKEN,
    mode: "season1_initial_topup",
    target: "playerMin",
    roundLimit: 16,
    teamTimeLimitMs: 10_000,
    outputDir: OUTPUT_DIR,
  });
  return {
    blockers: result.summary.teamsBelowMin.map((row) => `season1_topup_below_min:${row.teamId}:${row.rosterCount}/${row.playerMin}`),
    purchases: result.picks.map((pick) => ({
      seasonId: save.gameState.season.id,
      teamId: pick.teamId,
      playerId: pick.playerId,
      playerName: pick.playerName,
      fee: pick.marketValue,
      rosterAfter: pick.rosterAfter,
      cashAfter: pick.cashAfter,
      source: "season1_autoprep_topup",
    })),
  };
}

function getSeasonMaxRequiredSlots(gameState: GameState) {
  const counts = (gameState.seasonState.disciplineSchedule ?? [])
    .filter((entry) => entry.seasonId === gameState.season.id || !entry.seasonId)
    .flatMap((entry) => [entry.discipline1?.playerCount ?? 0, entry.discipline2?.playerCount ?? 0])
    .map((value) => Number(value ?? 0))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (counts.length === 0) return 8;
  return Math.max(7, Math.max(...counts) * 2);
}

function getPreseasonCoverageRiskRows(gameState: GameState) {
  const slotNeed = getSeasonMaxRequiredSlots(gameState);
  return rosterCounts(gameState).filter(({ roster, identity }) => {
    const minRequired = Math.max(identity?.playerMin ?? 7, 7, slotNeed);
    return roster.length < minRequired;
  });
}

function getExistingPreseasonMarketTransfers(gameState: GameState, seasonId: string) {
  return gameState.transferHistory.filter(
    (entry) =>
      entry.seasonId === seasonId &&
      (entry.source === "ai_preseason_market_buy" ||
        entry.source === "ai_preseason_market_sell" ||
        entry.source === "preseason_roster_repair_buy"),
  );
}

async function runPreseasonPlannerReviewBeforeRosterRepair(saveId: string, seasonId: string, persistence: PersistenceService) {
  const performanceRows: PhaseMetric[] = [];
  const save = persistence.getSaveById(saveId);
  if (!save) throw new Error("Long-run save missing before preseason planner review.");
  const coverageRiskRows = getPreseasonCoverageRiskRows(save.gameState);
  if (coverageRiskRows.length === 0) {
    return { performanceRows, reviewed: false, warnings: [] as string[] };
  }
  const existingMarketTransfers = getExistingPreseasonMarketTransfers(save.gameState, seasonId).filter(
    (entry) => entry.source === "ai_preseason_market_buy" || entry.source === "ai_preseason_market_sell",
  );
  if (existingMarketTransfers.length > 0) {
    recordPhase(performanceRows, {
      seasonId,
      phase: "season start planner review before roster repair",
      startedAt: Date.now(),
      itemCount: existingMarketTransfers.length,
      status: "skipped",
      buyApplyCount: existingMarketTransfers.filter((entry) => entry.transferType === "buy").length,
      sellApplyCount: existingMarketTransfers.filter((entry) => entry.transferType === "sell").length,
      note: `existing_preseason_market_transfers:${existingMarketTransfers.length}|coverageRisk:${coverageRiskRows.length}`,
    });
    return {
      performanceRows,
      reviewed: false,
      warnings: [`preseason_planner_review_skipped_existing_market_transfers:${existingMarketTransfers.length}`],
    };
  }

  const startedAt = Date.now();
  console.error(
    `[long-run] planner-review ${seasonId}: ${coverageRiskRows
      .map(({ team, roster, identity }) => `${team.shortCode}:${roster.length}/${Math.max(identity?.playerMin ?? 7, 7, getSeasonMaxRequiredSlots(save.gameState))}`)
      .join(",")}`,
  );
  const review = await applyAiMarketPlanLocally({
    source: "sqlite",
    saveId,
    seasonId,
    teamScope: "all",
    dryRun: false,
    confirmToken: AI_MARKET_APPLY_CONFIRM_TOKEN,
    transferPhase: "manual_transfer_window",
    options: {
      includeWarningTeams: true,
      applySellSteps: true,
      applyBuySteps: true,
      maxBuysPerTeam: null,
      maxSellsPerTeam: 2,
      previewBuyLimit: 96,
      previewSellLimit: 16,
      performanceBudgetMs: 12_000,
      maxApplyMs: 75_000,
      progressLog: true,
      stopOnTeamFailure: false,
    },
  });
  const latest = persistence.getSaveById(saveId);
  if (!latest) throw new Error("Long-run save missing after preseason planner review.");
  const stillBelowMin = getPreseasonCoverageRiskRows(latest.gameState);
  const warnings = [
    ...review.blockingReasons.map((entry) => `planner_review_blocker:${entry}`),
    ...review.warnings.slice(0, 20),
    stillBelowMin.length > 0 ? `planner_review_still_coverage_risk:${stillBelowMin.length}` : null,
  ].filter((entry): entry is string => Boolean(entry));
  recordPhase(performanceRows, {
    seasonId,
    phase: "season start planner review before roster repair",
    startedAt,
    itemCount: review.summary.appliedBuys + review.summary.appliedSells,
    status: "ok",
    buyApplyCount: review.summary.appliedBuys,
    sellApplyCount: review.summary.appliedSells,
    warnings: warnings.join("|"),
    note: `coverageRiskBefore:${coverageRiskRows.length}|coverageRiskAfter:${stillBelowMin.length}`,
  });
  return { performanceRows, reviewed: true, warnings };
}

function repairRosterMinimumBeforeSeasonStart(saveId: string, seasonId: string, persistence: PersistenceService) {
  const performanceRows: PhaseMetric[] = [];
  const save = persistence.getSaveById(saveId);
  if (!save) throw new Error("Long-run save missing before preseason roster repair.");
  const teamsBelowMin = getPreseasonCoverageRiskRows(save.gameState);
  if (teamsBelowMin.length === 0) {
    return { performanceRows, blockers: [] as string[], purchases: [] as Array<Record<string, unknown>>, repaired: false };
  }

  const startedAt = Date.now();
  console.error(
    `[long-run] roster-repair ${seasonId}: ${teamsBelowMin
      .map(({ team, roster, identity }) => `${team.shortCode}:${roster.length}/${Math.max(identity?.playerMin ?? 7, 7, getSeasonMaxRequiredSlots(save.gameState))}`)
      .join(",")}`,
  );
  const result = runChunkedRedraftTopup({
    persistence,
    saveId,
    seasonId,
    dryRun: false,
    confirmToken: CHUNKED_REDRAFT_TOPUP_CONFIRM_TOKEN,
    mode: "preseason_roster_repair",
    target: "playerMax",
    minimumRosterTargetOverride: getSeasonMaxRequiredSlots(save.gameState),
    roundLimit: 16,
    teamTimeLimitMs: 60_000,
    watchdogMs: 120_000,
    outputDir: path.join(OUTPUT_DIR, `preseason-roster-repair-${seasonId}`),
  });
  const after = persistence.getSaveById(saveId);
  if (!after) throw new Error("Long-run save missing after preseason roster repair.");
  const afterCounts = rosterCounts(after.gameState);
  const slotNeedAfter = getSeasonMaxRequiredSlots(after.gameState);
  const stillBelowCoverage = afterCounts
    .filter(({ roster, identity }) => roster.length < Math.max(identity?.playerMin ?? 7, 7, slotNeedAfter))
    .map(({ team, roster, identity }) => ({
      teamId: team.teamId,
      teamName: team.name,
      rosterCount: roster.length,
      playerMin: Math.max(identity?.playerMin ?? 7, 7, slotNeedAfter),
      cash: round(team.cash),
    }));
  const stillBelowHardMin = afterCounts
    .filter(({ roster, identity }) => roster.length < Math.max(identity?.playerMin ?? 7, 7))
    .map(({ team, roster, identity }) => ({
      teamId: team.teamId,
      teamName: team.name,
      rosterCount: roster.length,
      playerMin: Math.max(identity?.playerMin ?? 7, 7),
      cash: round(team.cash),
    }));
  const negativeCash = after.gameState.teams
    .filter((team) => team.cash < 0)
    .map((team) => ({ teamId: team.teamId, teamName: team.name, cash: round(team.cash) }));
  const blockers = [
    ...stillBelowHardMin.map((row) => `preseason_roster_repair_below_min:${row.teamId}:${row.rosterCount}/${row.playerMin}`),
    ...negativeCash.map((row) => `preseason_roster_repair_negative_cash:${row.teamId}:${row.cash}`),
  ];
  const warnings = [
    ...result.warnings.slice(0, 20),
    ...stillBelowCoverage.map((row) => `preseason_roster_repair_below_slot_depth:${row.teamId}:${row.rosterCount}/${row.playerMin}`),
  ];
  const purchases = result.picks.map((pick) => ({
    seasonId,
    teamId: pick.teamId,
    playerId: pick.playerId,
    playerName: pick.playerName,
    fee: pick.marketValue,
    rosterAfter: pick.rosterAfter,
    cashAfter: pick.cashAfter,
    source: "preseason_roster_repair_buy",
  }));
  recordPhase(performanceRows, {
    seasonId,
    phase: "season start roster minimum repair",
    startedAt,
    itemCount: purchases.length,
    status: blockers.length > 0 ? "blocked" : "ok",
    buyApplyCount: purchases.length,
    warnings: warnings.join("|"),
    errors: blockers.join("|"),
  });
  return { performanceRows, blockers, purchases, repaired: true };
}

function runFullChurnSeasonStart(saveId: string, seasonId: string, persistence: PersistenceService) {
  const performanceRows: PhaseMetric[] = [];
  const draftRows: Array<Record<string, unknown>> = [];
  const identityRows: Array<Record<string, unknown>> = [];
  const blockers: string[] = [];
  const warnings: string[] = [];
  const initialSave = persistence.getSaveById(saveId);
  if (!initialSave) throw new Error("Full-churn save missing before season start.");
  const alreadyResolved = (initialSave.gameState.seasonState.matchdayResults ?? []).some((entry) => entry.seasonId === seasonId);
  const alreadyRedrafted = initialSave.gameState.transferHistory.some(
    (entry) => entry.seasonId === seasonId && entry.source === "full_churn_redraft_buy",
  );
  if (alreadyResolved || alreadyRedrafted) {
    recordPhase(performanceRows, {
      seasonId,
      phase: "full churn season start",
      startedAt: Date.now(),
      itemCount: initialSave.gameState.rosters.length,
      status: "skipped",
      note: alreadyResolved ? "season_already_started" : "full_churn_already_applied",
    });
    return { performanceRows, draftRows, identityRows, blockers, warnings, skipped: true };
  }

  const sellMemoryBefore = memoryMb();
  const sellStartedAt = Date.now();
  const runContext = createLocalTransfermarktRunContext({ save: initialSave, persistence });
  const rosterBefore = [...runContext.save.gameState.rosters].sort((left, right) => {
    if (left.teamId !== right.teamId) return left.teamId.localeCompare(right.teamId, "en");
    return left.id.localeCompare(right.id, "en");
  });
  let sellApplyCount = 0;
  for (const [index, rosterEntry] of rosterBefore.entries()) {
    const result = executeLocalTransfermarktSell({
      saveId,
      seasonId,
      teamId: rosterEntry.teamId,
      activePlayerId: rosterEntry.id,
      transferSource: "full_churn_roster_sell",
      localRunContext: runContext,
      deferPersist: true,
    });
    if (!result.canSell) {
      blockers.push(`full_churn_sell:${rosterEntry.teamId}:${rosterEntry.playerId}:${result.blockingReasons.join("|")}`);
      continue;
    }
    sellApplyCount += 1;
    if (sellApplyCount === 1 || sellApplyCount % 25 === 0 || index === rosterBefore.length - 1) {
      console.error(`[long-run] full-churn sell ${seasonId}: ${sellApplyCount}/${rosterBefore.length}`);
    }
    warnings.push(...result.warnings.map((entry) => `sell:${rosterEntry.teamId}:${rosterEntry.playerId}:${entry}`));
  }
  if (runContext.deferredWrites > 0) {
    flushLocalTransfermarktRunContext(runContext);
  }
  const afterSell = persistence.getSaveById(saveId);
  if (!afterSell) throw new Error("Full-churn save missing after sell phase.");
  const rostersAfterSell = afterSell.gameState.rosters.length;
  if (rostersAfterSell > 0) {
    blockers.push(`full_churn_sell_left_rosters:${rostersAfterSell}`);
  }
  recordPhase(performanceRows, {
    seasonId,
    phase: "full churn sell apply",
    startedAt: sellStartedAt,
    itemCount: rosterBefore.length,
    status: blockers.some((entry) => entry.startsWith("full_churn_sell")) ? "blocked" : "ok",
    sellApplyCount,
    memoryBeforeMb: sellMemoryBefore,
    memoryAfterMb: memoryMb(),
    errors: blockers.filter((entry) => entry.startsWith("full_churn_sell")).join("|"),
    warnings: warnings.slice(0, 20).join("|"),
  });
  if (blockers.length > 0) {
    return { performanceRows, draftRows, identityRows, blockers, warnings, skipped: false };
  }

  const redraftMemoryBefore = memoryMb();
  const redraftStartedAt = Date.now();
  console.error(`[long-run] full-churn redraft ${seasonId}`);
  const redraft = runChunkedRedraftTopup({
    persistence,
    saveId,
    seasonId,
    dryRun: false,
    confirmToken: CHUNKED_REDRAFT_TOPUP_CONFIRM_TOKEN,
    mode: "full_clean_redraft",
    target: "playerOpt",
    roundLimit: 16,
    teamTimeLimitMs: 300_000,
    watchdogMs: 300_000,
    outputDir: path.join(OUTPUT_DIR, `full-churn-redraft-${seasonId}`),
  });
  const afterRedraft = persistence.getSaveById(saveId);
  if (!afterRedraft) throw new Error("Full-churn save missing after redraft.");
  const playersById = new Map(afterRedraft.gameState.players.map((player) => [player.id, player]));
  const rosteredPlayerIds = afterRedraft.gameState.rosters.map((entry) => entry.playerId);
  const duplicatePlayers = Array.from(rosteredPlayerIds.reduce((map, playerId) => map.set(playerId, (map.get(playerId) ?? 0) + 1), new Map<string, number>()))
    .filter(([, count]) => count > 1)
    .map(([playerId, count]) => `${playerId}:${count}`);
  const teamRosterRows = rosterCounts(afterRedraft.gameState).map(({ team, roster, identity }) => {
    const minRequired = Math.max(identity?.playerMin ?? 7, 7);
    const playerMax = getTeamPlayerMax(team, identity);
    const teamPicks = redraft.picks.filter((pick) => pick.teamId === team.teamId);
    const anchorPicks = teamPicks.slice(0, Math.min(4, teamPicks.length));
    const avgIdentityFit = teamPicks.length
      ? round(teamPicks.reduce((sum, pick) => sum + Number(pick.identityFit ?? 0), 0) / teamPicks.length, 2)
      : 0;
    const avgPremiumAxisFit = teamPicks.length
      ? round(teamPicks.reduce((sum, pick) => sum + Number(pick.premiumAxisFit ?? 0), 0) / teamPicks.length, 2)
      : 0;
    const status =
      roster.length < minRequired
        ? "RED_under_min_or_slot"
        : roster.length > playerMax
          ? "RED_over_max"
          : avgIdentityFit < 35 || avgPremiumAxisFit < 35
            ? "YELLOW_fit_watch"
            : "GREEN_plausible";
    return {
      seasonId,
      teamId: team.teamId,
      teamName: team.name,
      status,
      rosterCount: roster.length,
      minRequired,
      playerMin: identity?.playerMin ?? null,
      playerOpt: identity?.playerOpt ?? null,
      playerMax,
      cashAfter: round(team.cash),
      picks: teamPicks.length,
      avgIdentityFit,
      avgPremiumAxisFit,
      anchorPicks: anchorPicks.map((pick) => `${pick.playerName}:${pick.role}:${pick.identityFit}/${pick.premiumAxisFit}`).join("|"),
      warnings:
        team.teamId === "M-M" && teamPicks.slice(0, 4).some((pick) => /zaza stardust/i.test(pick.playerName))
          ? "M-M_anchor_zaza_watch"
          : team.teamId === "W-W" && teamPicks.slice(0, 4).some((pick) => /lord belqua/i.test(pick.playerName))
            ? "W-W_anchor_belqua_watch"
            : "",
    };
  });
  const redraftBlockers = [
    ...redraft.summary.teamsBelowMin.map((row) => `full_churn_redraft_below_min:${row.teamId}:${row.rosterCount}/${row.playerMin}`),
    ...redraft.summary.teamsAboveMax.map((row) => `full_churn_redraft_above_max:${row.teamId}:${row.rosterCount}/${row.playerMax}`),
    ...redraft.summary.negativeCashTeams.map((row) => `full_churn_redraft_negative_cash:${row.teamId}:${round(row.cash)}`),
    ...duplicatePlayers.map((entry) => `full_churn_redraft_duplicate_player:${entry}`),
    ...teamRosterRows.filter((row) => String(row.status).startsWith("RED")).map((row) => `full_churn_redraft_${row.status}:${row.teamId}:${row.rosterCount}`),
  ];
  blockers.push(...redraftBlockers);
  warnings.push(...redraft.warnings.map((entry) => `redraft:${entry}`));
  draftRows.push(
    ...redraft.picks.map((pick) => ({
      seasonId,
      mode: "FULL_CHURN_STRESS_MODE",
      ...pick,
      source: "full_churn_redraft_buy",
    })),
  );
  identityRows.push(...teamRosterRows);
  recordPhase(performanceRows, {
    seasonId,
    phase: "full churn redraft/buy apply",
    startedAt: redraftStartedAt,
    itemCount: redraft.picks.length,
    status: redraftBlockers.length > 0 ? "blocked" : "ok",
    candidatePoolTotal: redraft.summary.playerPool,
    candidatePoolLegal: redraft.summary.freeAgentPoolStart,
    candidatePoolAfterCheapFit: redraft.summary.freeAgentPoolStart,
    expensivePreviewCount: redraft.picks.reduce((sum, pick) => sum + Number(pick.previewCalls ?? 0), 0),
    buyApplyCount: redraft.picks.length,
    memoryBeforeMb: redraftMemoryBefore,
    memoryAfterMb: memoryMb(),
    slowestTeam: redraft.summary.slowestPick?.teamId ?? null,
    slowestPlayer: redraft.summary.slowestPick?.playerName ?? null,
    warnings: redraft.warnings.slice(0, 20).join("|"),
    errors: redraftBlockers.join("|"),
  });
  return { performanceRows, draftRows, identityRows, blockers, warnings, skipped: false };
}

function writeSimulationStartState(save: PersistedSaveGame, previousActiveSave: PersistedSaveGame | null) {
  const counts = rosterCounts(save.gameState);
  const rosteredPlayerIds = new Set(save.gameState.rosters.map((entry) => entry.playerId));
  const transferSources = Array.from(new Set(save.gameState.transferHistory.map((entry) => entry.source ?? "unknown")));
  const duplicateRosterPlayers = Array.from(
    save.gameState.rosters.reduce((map, entry) => map.set(entry.playerId, (map.get(entry.playerId) ?? 0) + 1), new Map<string, number>()),
  )
    .filter(([, count]) => count > 1)
    .map(([playerId, count]) => ({ playerId, count }));
  const teamRows = counts.map(({ team, roster, identity }) => ({
    teamId: team.teamId,
    teamName: team.name,
    cash: round(team.cash),
    rosterCount: roster.length,
    playerMin: identity?.playerMin ?? null,
    playerOpt: identity?.playerOpt ?? null,
    playerMax: getTeamPlayerMax(team, identity),
    belowMin: identity?.playerMin != null ? roster.length < identity.playerMin : roster.length < 7,
    aboveMax: roster.length > getTeamPlayerMax(team, identity),
  }));
  const payload = {
    generatedAt: new Date().toISOString(),
    mode: "strict",
    saveId: save.saveId,
    saveName: save.name,
    previousActiveSaveId: previousActiveSave?.saveId ?? null,
    previousActiveSaveName: previousActiveSave?.name ?? null,
    seasonId: save.gameState.season.id,
    matchdayId: save.gameState.matchdayState.matchdayId,
    teamCount: save.gameState.teams.length,
    playerPool: save.gameState.players.length,
    freeAgentPool: save.gameState.players.length - rosteredPlayerIds.size,
    initialRosterTotal: save.gameState.rosters.length,
    transferHistoryInitial: save.gameState.transferHistory.length,
    transferSources,
    duplicateRosterPlayers,
    negativeCashTeams: save.gameState.teams
      .filter((team) => team.cash < 0)
      .map((team) => ({ teamId: team.teamId, teamName: team.name, cash: round(team.cash) })),
    teamsBelowMin: teamRows.filter((row) => row.belowMin),
    teamsAboveMax: teamRows.filter((row) => row.aboveMax),
    teams: teamRows,
    notes: [
      "Der Runner erzeugt einen eigenen Sandbox-Save aus Fresh-Season-1-Seed.",
      "S1-Roster-Fill nutzt den chunked season1_autoprep_topup-Pfad; nach S1 wird dies als Guard geprüft.",
      "Keine Prisma-/Supabase-Writes; lokale SQLite-Persistenz fuer den Sandbox-Save.",
    ],
  };
  writeOutput("simulation-start-state.json", `${JSON.stringify(payload, null, 2)}\n`);
  writeOutput(
    "simulation-start-state.md",
    [
      "# Simulation Start State",
      "",
      `- Save: ${save.name} (${save.saveId})`,
      `- Vorher aktiver Save: ${payload.previousActiveSaveName ?? "unbekannt"} (${payload.previousActiveSaveId ?? "n/a"})`,
      `- Season/Matchday: ${payload.seasonId} / ${payload.matchdayId}`,
      `- Teams: ${payload.teamCount}`,
      `- Spielerpool: ${payload.playerPool}`,
      `- Free Agents: ${payload.freeAgentPool}`,
      `- Roster-Eintraege initial nach S1-Fill: ${payload.initialRosterTotal}`,
      `- Transferhistory initial: ${payload.transferHistoryInitial}`,
      `- Teams unter Min: ${payload.teamsBelowMin.length}`,
      `- Teams ueber Max: ${payload.teamsAboveMax.length}`,
      `- Doppelte Spieler: ${payload.duplicateRosterPlayers.length}`,
      `- Negative Cash Teams: ${payload.negativeCashTeams.length}`,
      "",
      "## Hinweise",
      ...payload.notes.map((entry) => `- ${entry}`),
    ].join("\n"),
  );
}

function parseJsonPayload<T>(value: string): T {
  return JSON.parse(value) as T;
}

function loadRawSaveCollection<T>(saveId: string, tableName: string) {
  const rows = getDatabase()
    .prepare(`SELECT payload_json FROM ${tableName} WHERE save_id = ?`)
    .all(saveId) as Array<{ payload_json: string }>;
  return rows.map((row) => parseJsonPayload<T>(row.payload_json));
}

function buildTeamRatingsPlayerOptSyncRows(save: PersistedSaveGame) {
  const rawTeams = loadRawSaveCollection<GameState["teams"][number]>(save.saveId, "teams");
  const rawIdentities = loadRawSaveCollection<GameState["teamIdentities"][number]>(save.saveId, "team_identities");
  const rawTeamById = new Map(rawTeams.map((team) => [team.teamId, team] as const));
  const rawIdentityById = new Map(rawIdentities.map((identity) => [identity.teamId, identity] as const));
  const identityById = new Map(save.gameState.teamIdentities.map((identity) => [identity.teamId, identity] as const));
  return save.gameState.teams.map((team) => {
    const identity = identityById.get(team.teamId) ?? null;
    const rawIdentity = rawIdentityById.get(team.teamId) ?? null;
    const rawTeam = rawTeamById.get(team.teamId) ?? null;
    const targets = {
      playerMin: identity?.playerMin ?? null,
      playerOpt: identity?.playerOpt ?? null,
      playerMax: getTeamPlayerMax(team, identity),
    };
    return {
      teamId: team.teamId,
      teamName: team.name,
      oldPlayerOpt: rawIdentity?.playerOpt ?? rawTeam?.rosterOptTarget ?? "",
      sheetPlayerOpt: targets.playerOpt,
      appliedPlayerOpt: targets.playerOpt,
      playerMin: targets.playerMin,
      playerMax: targets.playerMax,
      validBounds:
        targets.playerMin != null &&
        targets.playerOpt != null &&
        targets.playerMin <= targets.playerOpt &&
        targets.playerOpt <= targets.playerMax,
      source: identity?.sourceNote ?? "team-ratings-sheet",
    };
  });
}

function buildRosterTargetValidationRows(save: PersistedSaveGame) {
  const rosterByTeam = rosterCounts(save.gameState);
  return rosterByTeam.map(({ team, roster, identity }) => {
    const playerMax = getTeamPlayerMax(team, identity);
    const playerMin = identity?.playerMin ?? null;
    const playerOpt = identity?.playerOpt ?? null;
    return {
      seasonId: save.gameState.season.id,
      teamId: team.teamId,
      teamName: team.name,
      rosterCount: roster.length,
      playerMin,
      playerOpt,
      playerMax,
      optGap: playerOpt == null ? "" : Math.max(0, playerOpt - roster.length),
      atOrAboveOpt: playerOpt == null ? "" : roster.length >= playerOpt,
      at13Or14: roster.length >= 13 && roster.length <= 14,
      belowMin: playerMin == null ? "" : roster.length < playerMin,
      aboveMax: roster.length > playerMax,
      validBounds: playerMin != null && playerOpt != null && playerMin <= playerOpt && playerOpt <= playerMax && playerMax === 14,
    };
  });
}

function buildCaptainBudgetAuditRows(save: PersistedSaveGame) {
  const currentSeasonNumber = parseSeasonNumber(save.gameState.season.id);
  const completedSeasonCount = (save.gameState.gamePhase ?? "") === "season_completed"
    ? currentSeasonNumber
    : Math.max(0, currentSeasonNumber - 1);
  const rows: Array<Record<string, unknown>> = [];
  for (const team of save.gameState.teams) {
    let totalCaptainUsesToDate = 0;
    for (let seasonNumber = 1; seasonNumber <= completedSeasonCount; seasonNumber += 1) {
      const seasonId = `season-${seasonNumber}`;
      const teamSeasonDrafts = (save.gameState.seasonState.lineupDrafts ?? []).filter(
        (draft) => draft.teamId === team.teamId && draft.seasonId === seasonId,
      );
      const sourceStatus = teamSeasonDrafts.length > 0 ? "mapped" : "missing_source";
      const captainUsedThisSeason = countSeasonCaptains({
        lineups: save.gameState.seasonState.lineupDrafts ?? [],
        teamId: team.teamId,
        seasonId,
      });
      totalCaptainUsesToDate += captainUsedThisSeason;
      const expectedCaptainUsesToDate = seasonNumber * SEASON_CAPTAIN_SLOTS;
      rows.push({
        teamId: team.teamId,
        teamName: team.name,
        season: seasonId,
        captainUsedThisSeason,
        captainLimitThisSeason: SEASON_CAPTAIN_SLOTS,
        missingCaptainUsesThisSeason: Math.max(0, SEASON_CAPTAIN_SLOTS - captainUsedThisSeason),
        totalCaptainUsesToDate,
        expectedCaptainUsesToDate,
        delta: totalCaptainUsesToDate - expectedCaptainUsesToDate,
        reasonIfMissing:
          sourceStatus === "missing_source"
            ? "missing_source"
            : captainUsedThisSeason < SEASON_CAPTAIN_SLOTS
              ? "captain_budget_underused"
              : captainUsedThisSeason > SEASON_CAPTAIN_SLOTS
                ? "captain_budget_overused"
                : "ok",
        captainHistoryMissingSource: sourceStatus === "missing_source",
      });
    }
  }
  return rows;
}

function classifyPickCategory(row: Record<string, unknown>) {
  const source = String(row.source ?? row.transferType ?? "");
  const fee = Number(row.fee ?? 0);
  const salary = Number(row.salary ?? 0);
  if (/repair|topup|fallback/i.test(source)) return "emergency_filler_pick";
  if (fee >= 45 || salary >= 10) return "star_pick";
  if (fee >= 25 || salary >= 6) return "core_pick";
  if (/coverage|slot/i.test(source)) return "coverage_pick";
  return "role_pick";
}

function buildStrategicTransferByTeamRows(input: {
  rosterRows: Record<string, unknown>[];
  aiMarketRows: Record<string, unknown>[];
  contractExitRows: Record<string, unknown>[];
  renewalRows: Record<string, unknown>[];
  sellPressureRows: Record<string, unknown>[];
}) {
  const seasonTeamKeys = new Set<string>();
  for (const row of input.rosterRows) {
    const seasonId = String(row.seasonId ?? "");
    const teamId = String(row.teamId ?? "");
    if (seasonId && teamId) seasonTeamKeys.add(`${seasonId}::${teamId}`);
  }
  for (const row of input.aiMarketRows) {
    const seasonId = String(row.seasonId ?? "");
    const teamId = String(row.teamId ?? row.toTeamId ?? row.fromTeamId ?? "");
    if (seasonId && teamId) seasonTeamKeys.add(`${seasonId}::${teamId}`);
  }
  return Array.from(seasonTeamKeys).map((key) => {
    const [seasonId, teamId] = key.split("::");
    const roster = input.rosterRows.find((row) => row.seasonId === seasonId && row.teamId === teamId) ?? {};
    const transfers = input.aiMarketRows.filter(
      (row) => row.seasonId === seasonId && (row.teamId === teamId || row.toTeamId === teamId || row.fromTeamId === teamId),
    );
    const buys = transfers.filter((row) => row.transferType === "buy" || row.toTeamId === teamId);
    const sells = transfers.filter((row) => row.transferType === "sell" || row.fromTeamId === teamId);
    const contractExits = input.contractExitRows.filter((row) => row.seasonId === seasonId && row.teamId === teamId);
    const renewals = input.renewalRows.filter((row) => row.seasonId === seasonId && row.teamId === teamId && row.eventType === "contract_renewed");
    const pressureRows = input.sellPressureRows.filter((row) => row.teamId === teamId);
    const salaryTotal = Number(roster.salarySum ?? 0);
    const cash = Number(roster.cash ?? 0);
    const playerOpt = Number(roster.playerOpt ?? 0);
    const rosterSize = Number(roster.rosterSize ?? 0);
    const plannedPicks = buys.filter((row) => classifyPickCategory(row) !== "emergency_filler_pick").length;
    const fillerPicks = buys.length - plannedPicks;
    return {
      seasonId,
      teamId,
      teamName: roster.teamName ?? teamId,
      personaMarketBias:
        teamId === "C-C"
          ? "value_cash"
          : teamId === "M-M"
            ? "win_now_pressure"
            : teamId === "Z-H"
              ? "risky_upside_rotation"
              : "team_profile",
      buys: buys.length,
      sells: sells.length,
      contractExits: contractExits.length,
      renewedBeforeExpiry: renewals.length,
      plannedExpiries: contractExits.filter((row) => String(row.reasons ?? row.reason ?? "").includes("planned")).length,
      forcedExpiries: contractExits.length,
      soldBeforeExpiry: sells.filter((row) => Number(row.remainingContractLength ?? 99) <= 1).length,
      replacedBeforeExpiry: buys.length > 0 && contractExits.length > 0 ? Math.min(buys.length, contractExits.length) : 0,
      plannedPicks,
      fillerPicks,
      sellPressure: pressureRows.length ? Math.max(...pressureRows.map((row) => Number(row.sellPriority ?? 0))) : 0,
      salaryPressure: cash > 0 ? round(salaryTotal / Math.max(cash, 1), 2) : salaryTotal > 0 ? 99 : 0,
      boardPressure: "",
      cashBefore: roster.cash ?? "",
      cashAfter: roster.cash ?? "",
      rosterBefore: rosterSize,
      rosterAfter: rosterSize,
      playerOpt: playerOpt || "",
      playerMax: 14,
      optGapBefore: playerOpt ? Math.max(0, playerOpt - rosterSize) : "",
      optGapAfter: playerOpt ? Math.max(0, playerOpt - rosterSize) : "",
      reasonIfBelowOpt:
        playerOpt && rosterSize < playerOpt
          ? cash <= 0
            ? "cash_pressure_below_opt"
            : "planner_or_market_scope_below_opt"
          : "",
    };
  });
}

function buildTransferDecisionRows(aiMarketRows: Record<string, unknown>[], contractExitRows: Record<string, unknown>[], renewalRows: Record<string, unknown>[]) {
  return [
    ...aiMarketRows.map((row) => ({
      seasonId: row.seasonId,
      teamId: row.teamId ?? row.toTeamId ?? row.fromTeamId,
      playerId: row.playerId,
      playerName: row.playerName,
      decision: row.transferType ?? "market_action",
      pickCategory: row.transferType === "buy" ? classifyPickCategory(row) : "",
      amount: row.fee ?? row.amount ?? "",
      salary: row.salary ?? "",
      reason: row.source ?? row.reason ?? "",
      source: row.source ?? "transfer_history",
    })),
    ...contractExitRows.map((row) => ({
      seasonId: row.seasonId,
      teamId: row.teamId,
      playerId: row.playerId,
      playerName: row.playerName,
      decision: "forced_or_planned_expiry",
      pickCategory: "",
      amount: "",
      salary: row.salary ?? "",
      reason: row.reasons ?? row.reason ?? "contract_expired_exit",
      source: "contract_expiry",
    })),
    ...renewalRows
      .filter((row) => row.eventType === "contract_renewed")
      .map((row) => ({
        seasonId: row.seasonId,
        teamId: row.teamId,
        playerId: row.playerId,
        playerName: row.playerName,
        decision: "renewedBeforeExpiry",
        pickCategory: "",
        amount: "",
        salary: row.salary ?? "",
        reason: row.reason ?? "contract_renewed",
        source: "contract_renewal",
      })),
  ];
}

function prepSeasonLineups(saveId: string, seasonId: string) {
  console.error(`[long-run] autoprep ${seasonId}`);
  execFileSync("npm", ["exec", "--", "tsx", "scripts/season1-autoprep.ts", "--write"], {
    cwd: PROJECT_ROOT,
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_OPTIONS: [process.env.NODE_OPTIONS, "--max-old-space-size=8192"].filter(Boolean).join(" "),
      OLY_TARGET_SAVE_ID: saveId,
      OLY_TARGET_SEASON_ID: seasonId,
      OLY_EXPORT_PREFIX: `long-run-${seasonId}`,
    },
  });
}

function getCaptainPickScore(player: GameState["players"][number] | undefined) {
  if (!player) return 0;
  return Math.max(
    Number(player.pps ?? 0),
    Number(player.ovr ?? 0),
    Number(player.rating ?? 0),
    Number(player.coreStats?.pow ?? 0),
    Number(player.coreStats?.spe ?? 0),
    Number(player.coreStats?.men ?? 0),
    Number(player.coreStats?.soc ?? 0),
  );
}

function autoFixCaptainsAfterAutoprep(saveId: string, seasonId: string, persistence: PersistenceService) {
  const save = persistence.getSaveById(saveId);
  if (!save) throw new Error("Long-run save disappeared during captain autofix.");
  const startedAt = Date.now();
  const playerById = new Map(save.gameState.players.map((player) => [player.id, player]));
  const rows: Array<Record<string, unknown>> = [];
  let changed = false;
  const drafts = [...(save.gameState.seasonState.lineupDrafts ?? [])];
  const nextDrafts = drafts.map((draft) => ({
    ...draft,
    entries: draft.entries.map((entry) => ({ ...entry })),
  }));
  for (const team of save.gameState.teams) {
    const teamDrafts = nextDrafts
      .filter((draft) => draft.seasonId === seasonId && draft.teamId === team.teamId)
      .sort((left, right) => {
        const leftIndex = save.gameState.season.matchdayIds.indexOf(left.matchdayId);
        const rightIndex = save.gameState.season.matchdayIds.indexOf(right.matchdayId);
        return leftIndex - rightIndex;
      });
    const usedCaptainSides = new Set(
      teamDrafts.flatMap((draft) =>
        draft.entries
          .filter((entry) => entry.isCaptain)
          .map((entry) => `${entry.disciplineId}:${entry.disciplineSide}`),
      ),
    );
    let usedCaptainCount = usedCaptainSides.size;
    for (const draft of teamDrafts) {
      const sideKeys = Array.from(new Set(draft.entries.map((entry) => `${entry.disciplineId}:${entry.disciplineSide}`))).sort();
      for (const sideKey of sideKeys) {
        const sideEntries = draft.entries.filter((entry) => `${entry.disciplineId}:${entry.disciplineSide}` === sideKey);
        const hadCaptain = sideEntries.some((entry) => entry.isCaptain);
        if (hadCaptain) {
          rows.push({
            seasonId,
            matchdayId: draft.matchdayId,
            teamId: team.teamId,
            teamName: team.name,
            sideKey,
            status: "already_set",
            captainAutoSet: 0,
            captainStillMissing: 0,
          });
          continue;
        }
        if (usedCaptainCount >= 3) {
          rows.push({
            seasonId,
            matchdayId: draft.matchdayId,
            teamId: team.teamId,
            teamName: team.name,
            sideKey,
            status: "season_limit_reached",
            captainAutoSet: 0,
            captainStillMissing: 1,
          });
          continue;
        }
        const best = [...sideEntries].sort((left, right) => {
          const scoreDelta = getCaptainPickScore(playerById.get(right.playerId)) - getCaptainPickScore(playerById.get(left.playerId));
          if (scoreDelta !== 0) return scoreDelta;
          return left.playerId.localeCompare(right.playerId, "en");
        })[0] ?? null;
        if (!best) {
          rows.push({
            seasonId,
            matchdayId: draft.matchdayId,
            teamId: team.teamId,
            teamName: team.name,
            sideKey,
            status: "no_legal_player",
            captainAutoSet: 0,
            captainStillMissing: 1,
          });
          continue;
        }
        best.isCaptain = true;
        usedCaptainCount += 1;
        usedCaptainSides.add(sideKey);
        changed = true;
        rows.push({
          seasonId,
          matchdayId: draft.matchdayId,
          teamId: team.teamId,
          teamName: team.name,
          sideKey,
          status: "auto_set",
          captainAutoSet: 1,
          captainStillMissing: 0,
          playerId: best.playerId,
          playerName: playerById.get(best.playerId)?.name ?? best.playerId,
        });
      }
    }
  }
  if (changed) {
    const nextSeasonState = {
      ...save.gameState.seasonState,
      lineupDrafts: nextDrafts,
    };
    getDatabase()
      .prepare(
        `INSERT INTO season_states (save_id, payload_json) VALUES (?, ?)
         ON CONFLICT(save_id) DO UPDATE SET payload_json = excluded.payload_json`,
      )
      .run(saveId, JSON.stringify(nextSeasonState));
  }
  console.error(`[long-run] captain-autofix ${seasonId}: rows=${rows.length} changed=${changed ? 1 : 0} elapsed=${Date.now() - startedAt}ms`);
  return rows;
}

function auditSlotCoverageAfterAutoprep(saveId: string, seasonId: string, persistence: PersistenceService) {
  const save = persistence.getSaveById(saveId);
  if (!save) throw new Error("Long-run save disappeared during slot coverage audit.");
  const startedAt = Date.now();
  const rows: Array<Record<string, unknown>> = [];
  for (const [matchdayIndex, matchdayId] of save.gameState.season.matchdayIds.entries()) {
    const matchdayStartedAt = Date.now();
    for (const team of save.gameState.teams) {
      const contextResult = loadLocalLegacyLineupContextFromGameState(save.gameState, {
        saveId,
        seasonId,
        matchdayId,
        teamId: team.teamId,
      });
      if (!contextResult.ok) {
        rows.push({
          seasonId,
          matchdayId,
          teamId: team.teamId,
          teamName: team.name,
          status: "hard_unresolved",
          reason: "missing_context",
          missingSlots: "",
          duplicateConflicts: "",
          captainMissing: "",
          formCardInvalid: "",
          hardCoverageUnresolved: 1,
          captainWarnings: 0,
          depthWarnings: 0,
          ready: 0,
          repairedBy: "unresolved",
          warnings: contextResult.warnings.join("|"),
          blockers: contextResult.errors.join("|"),
        });
        continue;
      }
      const context = contextResult.context;
      const draft = context.existingDraft;
      const entries = draft?.entries ?? [];
      const sides = [
        context.matchdayContract?.discipline1
          ? {
              disciplineId: context.matchdayContract.discipline1.disciplineId,
              side: "d1" as const,
              requiredPlayers: context.matchdayContract.discipline1.requiredPlayers ?? 0,
            }
          : null,
        context.matchdayContract?.discipline2
          ? {
              disciplineId: context.matchdayContract.discipline2.disciplineId,
              side: "d2" as const,
              requiredPlayers: context.matchdayContract.discipline2.requiredPlayers ?? 0,
            }
          : null,
      ].filter((entry): entry is { disciplineId: string; side: "d1" | "d2"; requiredPlayers: number } => Boolean(entry));
      const duplicateKeys = entries.reduce((map, entry) => {
        const key = `${entry.disciplineSide}:${entry.playerId}`;
        map.set(key, (map.get(key) ?? 0) + 1);
        return map;
      }, new Map<string, number>());
      const duplicateConflicts = Array.from(duplicateKeys.values()).filter((count) => count > 1).length;
      const missingSlots = sides.reduce((sum, side) => {
        const selected = entries.filter((entry) => entry.disciplineId === side.disciplineId && entry.disciplineSide === side.side).length;
        return sum + Math.max(0, side.requiredPlayers - selected);
      }, 0);
      const captainMissing = sides.filter((side) => {
        const sideEntries = entries.filter((entry) => entry.disciplineId === side.disciplineId && entry.disciplineSide === side.side);
        return sideEntries.length > 0 && !sideEntries.some((entry) => entry.isCaptain);
      }).length;
      const selectedFormCards = [
        draft?.modifiers?.d1?.primaryFormCardId,
        draft?.modifiers?.d1?.secondaryFormCardId,
        draft?.modifiers?.d2?.primaryFormCardId,
        draft?.modifiers?.d2?.secondaryFormCardId,
      ].filter(Boolean);
      const uniqueFormCards = new Set(selectedFormCards);
      const formCardInvalid = selectedFormCards.length - uniqueFormCards.size;
      const reasons = [
        missingSlots > 0 ? "missing_slots" : null,
        duplicateConflicts > 0 ? "duplicate_conflict" : null,
        formCardInvalid > 0 ? "form_card_invalid" : null,
      ].filter((entry): entry is string => Boolean(entry));
      const warningReasons = [
        captainMissing > 0 ? "captain_missing" : null,
        context.activePlayers.length < sides.reduce((sum, side) => sum + side.requiredPlayers, 0) ? "under_slot_depth" : null,
      ].filter((entry): entry is string => Boolean(entry));
      const status = reasons.length > 0 ? "hard_unresolved" : warningReasons.length > 0 ? "warning" : "ready";
      rows.push({
        seasonId,
        matchdayId,
        teamId: team.teamId,
        teamName: team.name,
        status,
        reason: reasons.join("|") || "ready",
        warningReason: warningReasons.join("|"),
        missingSlots,
        duplicateConflicts,
        captainMissing,
        formCardInvalid,
        hardCoverageUnresolved: reasons.length > 0 ? 1 : 0,
        captainWarnings: captainMissing > 0 ? 1 : 0,
        depthWarnings: warningReasons.includes("under_slot_depth") ? 1 : 0,
        ready: status === "ready" ? 1 : 0,
        activePlayers: context.activePlayers.length,
        requiredSlots: sides.reduce((sum, side) => sum + side.requiredPlayers, 0),
        repairedBy: reasons.length === 0 ? "not_needed" : "unresolved",
        warnings: contextResult.warnings.join("|"),
        blockers: "",
      });
    }
    console.error(
      `[long-run] slot-audit ${seasonId} ${matchdayIndex + 1}/${save.gameState.season.matchdayIds.length}: rows=${rows.length} elapsed=${Date.now() - matchdayStartedAt}ms total=${Date.now() - startedAt}ms`,
    );
  }
  return rows;
}

function buildContractExpiryRiskRows(save: PersistedSaveGame) {
  const gameState = save.gameState;
  const playerById = new Map(gameState.players.map((player) => [player.id, player]));
  const rosterByTeam = new Map<string, RosterEntry[]>();
  for (const roster of gameState.rosters) {
    rosterByTeam.set(roster.teamId, [...(rosterByTeam.get(roster.teamId) ?? []), roster]);
  }
  return gameState.rosters
    .map((roster) => {
      const team = gameState.teams.find((entry) => entry.teamId === roster.teamId) ?? null;
      const identity = gameState.teamIdentities.find((entry) => entry.teamId === roster.teamId) ?? null;
      const player = playerById.get(roster.playerId);
      const economy = resolvePlayerEconomyContract({ player, rosterEntry: roster });
      const teamRoster = rosterByTeam.get(roster.teamId) ?? [];
      const expiringInTeam = teamRoster.filter((entry) => entry.contractLength <= 1).length;
      const rosterAfterExpiry = teamRoster.length - expiringInTeam;
      const minRequired = Math.max(identity?.playerMin ?? 7, 7);
      const playerOpt = identity?.playerOpt ?? minRequired;
      const playerMax = getTeamPlayerMax(team, identity);
      const salaryShare = economy.salary != null && teamRoster.length > 0
        ? economy.salary /
          Math.max(
            1,
            teamRoster.reduce((sum, entry) => {
              const entryPlayer = playerById.get(entry.playerId);
              return sum + (resolvePlayerEconomyContract({ player: entryPlayer, rosterEntry: entry }).salary ?? 0);
            }, 0),
          )
        : 0;
      const riskReasons = [
        roster.contractLength <= 1 ? "expires_next_tick" : null,
        rosterAfterExpiry < minRequired ? "coverage_risk_after_expiry" : null,
        rosterAfterExpiry < playerOpt ? "opt_risk_after_expiry" : null,
        salaryShare >= 0.18 ? "large_salary_share" : null,
        team != null && team.cash <= 0 ? "cash_not_positive" : null,
      ].filter((entry): entry is string => Boolean(entry));
      const expiryCreatesSlotRisk = roster.contractLength <= 1 && rosterAfterExpiry < minRequired;
      const expiryCreatesOptRisk = roster.contractLength <= 1 && rosterAfterExpiry < playerOpt;
      const renewalRecommended = (expiryCreatesSlotRisk || expiryCreatesOptRisk) && team != null && team.cash > 0 && salaryShare < 0.22;
      const replacementNeeded = (expiryCreatesSlotRisk || expiryCreatesOptRisk) && !renewalRecommended;
      return {
        seasonId: gameState.season.id,
        teamId: roster.teamId,
        teamName: team?.name ?? roster.teamId,
        playerId: roster.playerId,
        playerName: player?.name ?? roster.playerId,
        roleTag: roster.roleTag ?? "",
        contractLength: roster.contractLength,
        salary: round(economy.salary ?? 0, 2),
        marketValue: round(economy.marketValue ?? 0, 2),
        rosterNow: teamRoster.length,
        rosterSize: teamRoster.length,
        expiringInTeam,
        expiringPlayers: expiringInTeam,
        rosterAfterExpiry,
        minRequired,
        playerOpt,
        playerMax,
        optRisk: expiryCreatesOptRisk,
        slotRisk: expiryCreatesSlotRisk,
        cash: round(team?.cash ?? 0, 2),
        riskLevel:
          roster.contractLength > 1
            ? "none"
            : riskReasons.includes("coverage_risk_after_expiry") || riskReasons.includes("opt_risk_after_expiry") || riskReasons.includes("cash_not_positive")
              ? "high"
              : salaryShare >= 0.18
                ? "medium"
                : "low",
        expiryCreatesSlotRisk,
        expiryCreatesOptRisk,
        renewalRecommended,
        replacementNeeded,
        reasons: riskReasons.join("|") || "stable",
      };
    })
    .sort((left, right) => {
      const riskOrder = { high: 0, medium: 1, low: 2, none: 3 } as Record<string, number>;
      return riskOrder[left.riskLevel] - riskOrder[right.riskLevel] || String(left.teamName).localeCompare(String(right.teamName), "de");
    });
}

async function buildSellPressureRows(save: PersistedSaveGame) {
  const preview = await buildAiTransfermarktSellPreview({
    source: "sqlite",
    saveId: save.saveId,
    seasonId: save.gameState.season.id,
    teamScope: "all",
    limit: 8,
  });
  return preview.teams.flatMap((team) =>
    team.sellCandidates.map((candidate, index) => ({
      seasonId: save.gameState.season.id,
      teamId: team.teamId,
      teamName: team.teamName,
      teamStatus: team.status,
      cash: round(team.cash ?? 0, 2),
      budgetPressure: team.budgetPressure,
      rosterSize: team.rosterSize,
      salaryTotal: round(team.salaryTotal ?? 0, 2),
      rankInTeam: index + 1,
      playerId: candidate.playerId,
      playerName: candidate.playerName,
      roleTag: "",
      contractLength: candidate.contractLength,
      salary: round(candidate.salary ?? 0, 2),
      expectedSellValue: round(candidate.expectedSellValue ?? 0, 2),
      cashAfter: round(candidate.cashAfter ?? 0, 2),
      sellPriority: candidate.sellPriority,
      boardTrustPolicy: candidate.boardTrustPolicy,
      reasonsToSell: candidate.reasonToSell.join("|"),
      reasonsToKeep: candidate.reasonToKeep.join("|"),
      warnings: candidate.warnings.join("|"),
    })),
  );
}

function buildRepairPerformanceRows(performanceRows: PhaseMetric[]) {
  return performanceRows
    .filter((row) => /repair|planner review|negative cash recovery|ai market/i.test(row.phase))
    .map((row) => ({
      seasonId: row.seasonId,
      matchdayId: row.matchdayId ?? "",
      phase: row.phase,
      durationMs: row.durationMs,
      itemCount: row.itemCount ?? "",
      status: row.status,
      buyApplyCount: row.buyApplyCount ?? "",
      sellApplyCount: row.sellApplyCount ?? "",
      candidatePoolTotal: row.candidatePoolTotal ?? "",
      candidatePoolLegal: row.candidatePoolLegal ?? "",
      candidatePoolAfterCheapFit: row.candidatePoolAfterCheapFit ?? "",
      expensivePreviewCount: row.expensivePreviewCount ?? "",
      cacheHits: row.cacheHits ?? "",
      cacheMisses: row.cacheMisses ?? "",
      warnings: row.warnings ?? "",
      errors: row.errors ?? "",
      note: row.note ?? "",
    }));
}

function finalizeSeasonIfNeeded(saveId: string, persistence: PersistenceService) {
  const save = persistence.getSaveById(saveId);
  if (!save) throw new Error("Long-run save disappeared during season finalization.");
  const seasonId = save.gameState.season.id;
  const lastMatchdayId = save.gameState.season.matchdayIds[save.gameState.season.matchdayIds.length - 1];
  const hasLastResult = (save.gameState.seasonState.matchdayResults ?? []).some(
    (result) => result.seasonId === seasonId && result.matchdayId === lastMatchdayId,
  );
  const hasLastStandings = (save.gameState.seasonState.standingsApplyLogs ?? []).some(
    (log) => log.seasonId === seasonId && log.matchdayId === lastMatchdayId,
  );
  if (!hasLastResult || !hasLastStandings) {
    return false;
  }
  const now = new Date().toISOString();
  persistence.saveSingleplayerState(save.saveId, {
    ...save.gameState,
    gamePhase: "season_completed",
    season: save.gameState.season,
    seasonState: {
      ...save.gameState.seasonState,
      schedule: (save.gameState.seasonState.schedule ?? []).map((fixture) =>
        fixture.matchdayId === lastMatchdayId ? { ...fixture, status: "resolved" as const } : fixture,
      ),
      lineupDrafts: (save.gameState.seasonState.lineupDrafts ?? []).map((draft) =>
        draft.seasonId === seasonId && draft.matchdayId === lastMatchdayId
          ? { ...draft, status: "resolved" as const, updatedAt: now }
          : draft,
      ),
    },
    matchdayState: {
      matchdayId: lastMatchdayId,
      status: "resolved",
      pendingTeamIds: [],
      resolvedFixtureIds: [],
    },
    logs: [
      ...save.gameState.logs,
      {
        id: `long-run-season-complete-${seasonId}-${Date.now()}`,
        type: "season",
        message: `${save.gameState.season.name} im Long-Run abgeschlossen.`,
        createdAt: now,
      },
    ],
  });
  return true;
}

async function runSeasonMatchdays(saveId: string, persistence: PersistenceService) {
  const matchdayRows: Array<Record<string, unknown>> = [];
  const performanceRows: PhaseMetric[] = [];
  const blockers: string[] = [];
  const resultApplyService = new LegacyMatchdayResultApplyService(undefined, undefined, persistence);
  const initialSave = persistence.getSaveById(saveId);
  if (
    initialSave &&
    (initialSave.gameState.gamePhase === "season_completed" || initialSave.gameState.gamePhase === "season_review")
  ) {
    return { matchdayRows, performanceRows, blockers };
  }
  const startIndex = Math.max(0, initialSave?.gameState.season.matchdayIds.findIndex((entry) => entry === initialSave.gameState.matchdayState.matchdayId) ?? 0);
  for (const matchdayId of initialSave?.gameState.season.matchdayIds.slice(startIndex) ?? []) {
    const currentSave = persistence.getSaveById(saveId);
    if (!currentSave) throw new Error("Long-run save disappeared during matchday loop.");
    const seasonId = currentSave.gameState.season.id;
    const existingResult = (currentSave.gameState.seasonState.matchdayResults ?? []).some(
      (entry) => entry.seasonId === seasonId && entry.matchdayId === matchdayId,
    );
    if (existingResult) {
      matchdayRows.push({
        seasonId,
        matchdayId,
        status: "already_resolved",
        source: "resume_existing_matchday_result",
      });
      continue;
    }
    console.error(`[long-run] resolve ${seasonId} ${matchdayId}`);
    const activeMatchdayId = currentSave.gameState.matchdayState.matchdayId;
    if (activeMatchdayId !== matchdayId) {
      blockers.push(`active_matchday_mismatch:${seasonId}:${activeMatchdayId}:${matchdayId}`);
      break;
    }
    const matchdayStartedAt = Date.now();
    let startedAt = Date.now();
    const lineups = applyAiLegacyLineupBatchLocally(
      {
        saveId,
        seasonId,
        matchdayId,
        dryRun: false,
        includeWarningTeams: true,
        overwriteExisting: true,
      },
      persistence,
    );
    recordPhase(performanceRows, {
      seasonId,
      matchdayId,
      phase: "matchday lineup generation + save",
      startedAt,
      itemCount: lineups.summary.totalTeams,
      status: lineups.summary.blockingReasons.length > 0 ? "blocked" : "ok",
      note: [...lineups.summary.blockingReasons, ...lineups.summary.warnings].join("|"),
    });
    if (lineups.summary.blockingReasons.length > 0) {
      blockers.push(`lineups:${seasonId}:${matchdayId}:${lineups.summary.blockingReasons.join("|")}`);
      matchdayRows.push({
        seasonId,
        matchdayId,
        status: "blocked",
        blockers: lineups.summary.blockingReasons.join("|"),
        warnings: lineups.summary.warnings.join("|"),
      });
      break;
    }
    startedAt = Date.now();
    const result = await resultApplyService.applyLegacyMatchdayResult(
      {
        saveId,
        seasonId,
        matchdayId,
        source: "sqlite",
        execute: true,
        dryRun: false,
        confirm: APPLY_CONFIRM_TOKEN,
        allowIncompleteOverride: true,
        forceReplace: true,
      },
    );
    recordPhase(performanceRows, {
      seasonId,
      matchdayId,
      phase: "matchday resolve",
      startedAt,
      itemCount: result.ok ? result.teamsTotal : null,
      status: result.ok && result.applied ? "ok" : "blocked",
      note: result.ok ? result.blockingReasons.join("|") : result.error,
    });
    if (!result.ok || !result.applied) {
      blockers.push(`result:${seasonId}:${matchdayId}:${result.ok ? result.blockingReasons.join("|") : result.error}`);
      matchdayRows.push({
        seasonId,
        matchdayId,
        status: "blocked",
        resultAudit: result.ok ? result.matchdayResultId : null,
        blockers: result.ok ? result.blockingReasons.join("|") : result.error,
      });
      break;
    }
    startedAt = Date.now();
    const standings = await executeStandingsApply(
      {
        saveId,
        seasonId,
        matchdayId,
        source: "sqlite",
        execute: true,
        dryRun: false,
        confirm: STANDINGS_APPLY_CONFIRM_TOKEN,
        forceReplace: true,
      },
      persistence,
    );
    recordPhase(performanceRows, {
      seasonId,
      matchdayId,
      phase: "matchday standings",
      startedAt,
      itemCount: standings.tieGroups.length,
      status: standings.ok && standings.applied ? "ok" : "blocked",
      note: standings.ok ? standings.warnings.join("|") : standings.blockingReasons.join("|"),
    });
    matchdayRows.push({
      seasonId,
      matchdayId,
      status: standings.ok && standings.applied ? "applied" : "blocked",
      durationMs: Date.now() - matchdayStartedAt,
      lineupsReady: result.teamsTotal,
      warningTeams: result.warningsCount,
      tieBlockers: standings.tieGroups.length,
      aiLineupTeamsSaved: 0,
      resultAudit: result.matchdayResultId,
      standingsAudit: standings.auditLogId,
      blockers: standings.ok ? "" : standings.blockingReasons.join("|"),
      warnings: standings.warnings.join("|"),
    });
    if (!standings.ok || !standings.applied) {
      blockers.push(`standings:${seasonId}:${matchdayId}:${standings.blockingReasons.join("|")}`);
      break;
    }
    const latest = persistence.getSaveById(saveId);
    if (!latest) throw new Error("Long-run save disappeared after matchday auto-run.");
    const isLast = latest.gameState.season.matchdayIds.at(-1) === matchdayId;
    if (!isLast) {
      startedAt = Date.now();
      const advance = await executeMatchdayAdvance(
        {
          saveId,
          seasonId,
          source: "sqlite",
          execute: true,
          confirm: ADVANCE_MATCHDAY_CONFIRM_TOKEN,
        },
        persistence,
      );
      recordPhase(performanceRows, {
        seasonId,
        matchdayId,
        phase: "matchday advance",
        startedAt,
        itemCount: null,
        status: advance.ok && advance.applied ? "ok" : "blocked",
        note: advance.blockingReasons.join("|"),
      });
      matchdayRows[matchdayRows.length - 1] = {
        ...matchdayRows[matchdayRows.length - 1],
        advanceAudit: advance.auditLogId,
        advanceBlockers: advance.blockingReasons.join("|"),
      };
      if (!advance.ok || !advance.applied) {
        blockers.push(`advance:${seasonId}:${matchdayId}:${advance.blockingReasons.join("|")}`);
        break;
      }
    }
  }
  return { matchdayRows, performanceRows, blockers };
}

function emergencyLiquidateNegativeCashTeams(saveId: string, seasonId: string, persistence: PersistenceService) {
  const performanceRows: PhaseMetric[] = [];
  const blockers: string[] = [];
  const startedAt = Date.now();
  let save = persistence.getSaveById(saveId);
  if (!save) throw new Error("Long-run save disappeared before emergency cash liquidation.");
  const negativeTeams = save.gameState.teams.filter((team) => team.cash < 0);
  if (negativeTeams.length === 0) {
    return { performanceRows, blockers, sales: 0 };
  }

  console.error(`[long-run] emergency-cash-liquidation ${seasonId}: ${negativeTeams.map((team) => team.shortCode).join(",")}`);
  const runContext = createLocalTransfermarktRunContext({ save, persistence });
  let sales = 0;
  for (const team of negativeTeams) {
    for (let index = 0; index < 8; index += 1) {
      const latestTeam = runContext.save.gameState.teams.find((entry) => entry.teamId === team.teamId);
      if (!latestTeam || latestTeam.cash >= 0) break;
      const playersById = new Map(runContext.save.gameState.players.map((player) => [player.id, player] as const));
      const sellCandidate = runContext.save.gameState.rosters
        .filter((entry) => entry.teamId === team.teamId)
        .map((entry) => {
          const player = playersById.get(entry.playerId) ?? null;
          const economy = resolvePlayerEconomyContract({ player, rosterEntry: entry });
          return {
            entry,
            reliefScore: (economy.marketValue ?? 0) + (economy.salary ?? 0) * 2,
          };
        })
        .sort((left, right) => right.reliefScore - left.reliefScore)[0];
      if (!sellCandidate) {
        blockers.push(`emergency_cash_no_sell_candidate:${team.shortCode}:${round(latestTeam.cash)}`);
        break;
      }
      const result = executeLocalTransfermarktSell({
        saveId,
        seasonId,
        teamId: team.teamId,
        activePlayerId: sellCandidate.entry.id,
        transferSource: "emergency_negative_cash_liquidation",
        localRunContext: runContext,
        deferPersist: true,
      });
      if (!result.canSell) {
        blockers.push(`emergency_cash_sell_blocked:${team.shortCode}:${result.blockingReasons.join("|")}`);
        break;
      }
      sales += 1;
    }
  }
  flushLocalTransfermarktRunContext(runContext);
  save = persistence.getSaveById(saveId);
  const stillNegative = save?.gameState.teams.filter((team) => team.cash < 0) ?? [];
  recordPhase(performanceRows, {
    seasonId,
    phase: "emergency negative cash liquidation",
    startedAt,
    itemCount: sales,
    status: stillNegative.length > 0 || blockers.length > 0 ? "blocked" : "ok",
    sellApplyCount: sales,
    warnings: negativeTeams.map((team) => `${team.shortCode}:${round(team.cash)}`).join("|"),
    errors: [...blockers, ...stillNegative.map((team) => `still_negative:${team.shortCode}:${round(team.cash)}`)].join("|"),
  });
  return { performanceRows, blockers, sales };
}

async function recoverNegativeCashBeforeSeasonStart(saveId: string, seasonId: string, persistence: PersistenceService) {
  const performanceRows: PhaseMetric[] = [];
  const blockers: string[] = [];
  let save = persistence.getSaveById(saveId);
  if (!save) throw new Error("Long-run save disappeared before cash recovery.");
  const negativeBefore = save.gameState.teams.filter((team) => team.cash < 0);
  if (negativeBefore.length === 0) {
    return { performanceRows, blockers, recovered: false };
  }

  console.error(`[long-run] cash-recovery ${seasonId}: ${negativeBefore.map((team) => team.shortCode).join(",")}`);
  const startedAt = Date.now();
  const emergency = emergencyLiquidateNegativeCashTeams(saveId, seasonId, persistence);
  performanceRows.push(...emergency.performanceRows);
  save = persistence.getSaveById(saveId);
  if (!save) throw new Error("Long-run save disappeared after cash recovery.");
  let negativeAfter = save.gameState.teams.filter((team) => team.cash < 0);
  if (negativeAfter.length > 0) {
    blockers.push(...emergency.blockers);
    blockers.push(
      ...negativeAfter.map((team) => `negative_cash_after_recovery:${team.shortCode}:${round(team.cash)}`),
    );
  }
  recordPhase(performanceRows, {
    seasonId,
    phase: "season start negative cash recovery sell-only",
    startedAt,
    itemCount: emergency.sales,
    status: blockers.length > 0 ? "blocked" : "ok",
    note: [
      `before:${negativeBefore.map((team) => `${team.shortCode}:${round(team.cash)}`).join("|")}`,
      `after:${negativeAfter.map((team) => `${team.shortCode}:${round(team.cash)}`).join("|")}`,
      ...emergency.blockers,
    ].join("|"),
  });
  return { performanceRows, blockers, recovered: true };
}

async function applySeasonEnd(saveId: string, persistence: PersistenceService) {
  const rows: Record<string, unknown>[] = [];
  const performanceRows: PhaseMetric[] = [];
  const blockers: string[] = [];
  let save = persistence.getSaveById(saveId);
  if (!save) throw new Error("Long-run save disappeared before season-end.");
  const seasonId = save.gameState.season.id;
  console.error(`[long-run] season-end ${seasonId}: cash`);

  let startedAt = Date.now();
  const cashPreview = await previewCashPrizeApply(
    { saveId, seasonId, matchdayId: save.gameState.matchdayState.matchdayId, source: "sqlite", phase: "season_end" },
    persistence,
  );
  let totalPrizeMoney = cashPreview.plannedChanges.reduce((sum, row) => sum + (row.prizeMoney ?? 0), 0);
  if (cashPreview.blockingReasons.length === 0 && !cashPreview.duplicateDetected) {
    const cashApply = await executeCashPrizeApply(
      {
        saveId,
        seasonId,
        matchdayId: save.gameState.matchdayState.matchdayId,
        source: "sqlite",
        phase: "season_end",
        execute: true,
        confirm: CASH_PRIZE_APPLY_CONFIRM_TOKEN,
      },
      persistence,
    );
    totalPrizeMoney = cashApply.plannedChanges.reduce((sum, row) => sum + (row.prizeMoney ?? 0), 0);
    if (!cashApply.ok || !cashApply.applied) blockers.push(...cashApply.blockingReasons.map((entry) => `cash:${entry}`));
  }
  recordPhase(performanceRows, {
    seasonId,
    phase: "season end prize money",
    startedAt,
    itemCount: cashPreview.plannedChanges.length,
    status: blockers.some((entry) => entry.startsWith("cash:")) ? "blocked" : "ok",
    note: cashPreview.blockingReasons.join("|"),
  });

  save = persistence.getSaveById(saveId);
  if (!save) throw new Error("Long-run save disappeared before facilities.");
  console.error(`[long-run] season-end ${seasonId}: facilities`);
  startedAt = Date.now();
  let facilityAppliedTeams = 0;
  for (const team of save.gameState.teams) {
    const latest = persistence.getSaveById(saveId);
    if (!latest) throw new Error("Long-run save disappeared during facility finance.");
    const preview = previewFacilitySeasonEndFinance(latest, team.teamId);
    if (preview.confirmToken && preview.ok && (preview.facilityIncomeTotal > 0 || preview.facilityUpkeepTotal > 0)) {
      const applied = applyFacilitySeasonEndFinance(latest, team.teamId, preview.confirmToken, persistence);
      if (applied.applied) facilityAppliedTeams += 1;
      if (!applied.ok) blockers.push(...applied.blockingReasons.map((entry) => `facility:${team.teamId}:${entry}`));
    }
  }
  recordPhase(performanceRows, {
    seasonId,
    phase: "season end buildings/facilities",
    startedAt,
    itemCount: save.gameState.teams.length,
    status: blockers.some((entry) => entry.startsWith("facility:")) ? "blocked" : "ok",
    note: `facilityAppliedTeams:${facilityAppliedTeams}`,
  });

  save = persistence.getSaveById(saveId);
  if (!save) throw new Error("Long-run save disappeared before AI XP.");
  console.error(`[long-run] season-end ${seasonId}: ai-xp`);
  startedAt = Date.now();
  let xpAppliedPlayers = 0;
  let xpPositive = 0;
  let xpStagnant = 0;
  let xpNegative = 0;
  const xpWarnings: string[] = [];
  const xpBlockers: string[] = [];
  for (const team of save.gameState.teams) {
    const latest = persistence.getSaveById(saveId);
    if (!latest) throw new Error("Long-run save disappeared during AI XP.");
    const xpSave = asSimulationApplySave(latest);
    const plan = previewAiSeasonEndXpSpend(xpSave, team.teamId);
    xpWarnings.push(...plan.warnings.map((entry) => `${team.shortCode}:${entry}`));
    if (plan.blockers.length > 0) {
      if (plan.blockers.every((entry) => entry === "season_xp_no_unmaterialized_xp")) {
        xpWarnings.push(`${team.shortCode}:season_xp_no_unmaterialized_xp`);
        continue;
      }
      xpBlockers.push(...plan.blockers.map((entry) => `${team.shortCode}:${entry}`));
      continue;
    }
    if (!plan.confirmToken || plan.normalizedPlannedUpgrades.length === 0) {
      continue;
    }
    const applied = applySeasonEndXpSpend(xpSave, team.teamId, plan.plannedUpgrades, plan.confirmToken, persistence, {
      allowAiTeams: true,
    });
    if (!applied.applied) {
      xpBlockers.push(...applied.blockingReasons.map((entry) => `${team.shortCode}:${entry}`));
      continue;
    }
    xpAppliedPlayers += applied.players.filter((player) => player.plannedUpgrades.length > 0).length;
  }
  save = persistence.getSaveById(saveId);
  if (!save) throw new Error("Long-run save disappeared after AI XP.");
  const seasonXpEvents = (save.gameState.playerProgressionEvents ?? []).filter((entry) => entry.seasonId === seasonId);
  xpPositive = seasonXpEvents.filter((entry) => (entry.upgrades?.length ?? 0) > 0).length;
  xpStagnant = seasonXpEvents.filter((entry) => (entry.upgrades?.length ?? 0) === 0).length;
  xpNegative = seasonXpEvents.filter((entry) => (entry.xpEarned ?? 0) < 0).length;
  if (xpBlockers.length > 0) blockers.push(...xpBlockers.map((entry) => `ai_xp:${entry}`));
  recordPhase(performanceRows, {
    seasonId,
    phase: "season end training/development",
    startedAt,
    itemCount: seasonXpEvents.length,
    status: xpBlockers.length > 0 ? "blocked" : "ok",
    note: [...xpWarnings.slice(0, 20), ...xpBlockers.slice(0, 20)].join("|"),
  });

  save = persistence.getSaveById(saveId);
  if (!save) throw new Error("Long-run save disappeared before contracts.");
  console.error(`[long-run] season-end ${seasonId}: contracts`);
  startedAt = Date.now();
  const contractPreview = previewSeasonEndContracts(save);
  let contractApply = null as ReturnType<typeof applySeasonEndContractTick> | null;
  if (contractPreview.blockingReasons.length === 0) {
    contractApply = applySeasonEndContractTick(save, contractPreview.confirmToken, persistence, contractPreview);
    if (!contractApply.applied) blockers.push(...contractApply.blockingReasons.map((entry) => `contract:${entry}`));
  } else {
    blockers.push(...contractPreview.blockingReasons.map((entry) => `contract:${entry}`));
  }
  recordPhase(performanceRows, {
    seasonId,
    phase: "season end contracts/renewals",
    startedAt,
    itemCount: contractPreview.expiringCount,
    status: blockers.some((entry) => entry.startsWith("contract:")) ? "blocked" : "ok",
    note: contractPreview.blockingReasons.join("|"),
  });

  save = persistence.getSaveById(saveId);
  if (!save) throw new Error("Long-run save disappeared before AI market.");
  console.error(`[long-run] season-end ${seasonId}: ai-market`);
  startedAt = Date.now();
  const existingMarketTransfers = save.gameState.transferHistory.filter(
    (entry) =>
      entry.seasonId === seasonId &&
      entry.matchdayId === save.gameState.matchdayState.matchdayId &&
      (entry.source === "manual_transfer_window" ||
        entry.source === "ai_preseason_market_buy" ||
        entry.source === "ai_preseason_market_sell"),
  );
  let marketStatus = existingMarketTransfers.length > 0 ? "already_applied" : "not_started";
  let marketAppliedBuys = existingMarketTransfers.filter((entry) => entry.transferType === "buy").length;
  let marketAppliedSells = existingMarketTransfers.filter((entry) => entry.transferType === "sell").length;
  let marketBlockedTeams = 0;
  let marketWarnings = existingMarketTransfers.length > 0 ? [`existing_market_transfers:${existingMarketTransfers.length}`] : [];
  let marketBlockers: string[] = [];
  let plannerFinalGateRows: Record<string, unknown>[] = [];
  if (existingMarketTransfers.length === 0) {
    const market = await applyAiMarketPlanLocally({
      source: "sqlite",
      saveId,
      seasonId,
      teamScope: "all",
      dryRun: false,
      confirmToken: AI_MARKET_APPLY_CONFIRM_TOKEN,
      transferPhase: "manual_transfer_window",
      options: {
        includeWarningTeams: true,
        applySellSteps: true,
        applyBuySteps: true,
        maxBuysPerTeam: null,
        maxSellsPerTeam: 2,
        previewBuyLimit: 48,
        previewSellLimit: 8,
        performanceBudgetMs: 8_000,
        maxApplyMs: 120_000,
        progressLog: true,
        stopOnTeamFailure: false,
      },
    });
    marketStatus = market.status;
    marketAppliedBuys = market.summary.appliedBuys;
    marketAppliedSells = market.summary.appliedSells;
    marketBlockedTeams = market.summary.blockedTeams;
    marketWarnings = market.warnings;
    marketBlockers = market.blockingReasons;
    plannerFinalGateRows = market.teams.map((team) => ({
      seasonId,
      teamId: team.teamId,
      teamName: team.teamName,
      result: team.result,
      plannedBuys: team.plannedBuys,
      executedBuys: team.executedBuys,
      plannedSells: team.plannedSells,
      executedSells: team.executedSells,
      rosterBefore: team.rosterBefore,
      rosterAfter: team.rosterAfter,
      cashBefore: team.cashBefore,
      cashAfter: team.cashAfter,
      projectedCash: team.projectedCash,
      warnings: team.warnings.filter((entry) => entry.includes("planner_final_gate")).join("|"),
      blockingReasons: team.blockingReasons.join("|"),
    }));
    if (market.status === "blocked") blockers.push(...market.blockingReasons.map((entry) => `ai_market:${entry}`));
  }
  recordPhase(performanceRows, {
    seasonId,
    phase: "season end ai market",
    startedAt,
    itemCount: marketAppliedBuys + marketAppliedSells,
    status: marketStatus === "blocked" ? "blocked" : "ok",
    note: [...marketBlockers, ...marketWarnings].join("|"),
  });

  const finalCashRecovery = await recoverNegativeCashBeforeSeasonStart(saveId, seasonId, persistence);
  performanceRows.push(
    ...finalCashRecovery.performanceRows.map((row) => ({
      ...row,
      phase: `season end final stabilization ${row.phase}`,
    })),
  );
  const finalRosterRepair = repairRosterMinimumBeforeSeasonStart(saveId, seasonId, persistence);
  performanceRows.push(
    ...finalRosterRepair.performanceRows.map((row) => ({
      ...row,
      phase: `season end final stabilization ${row.phase}`,
    })),
  );
  save = persistence.getSaveById(saveId);
  if (!save) throw new Error("Long-run save disappeared after final season-end stabilization.");
  const finalRosterCounts = rosterCounts(save.gameState);
  const finalBelowMin = finalRosterCounts.filter(
    ({ roster, identity }) => roster.length < Math.max(identity?.playerMin ?? 7, 7),
  );
  const finalNegativeCash = save.gameState.teams.filter((team) => team.cash < 0);
  if (finalBelowMin.length > 0) {
    blockers.push(
      ...finalBelowMin.map(({ team, roster, identity }) =>
        `final_stabilization:roster_below_min:${team.shortCode}:${roster.length}/${Math.max(identity?.playerMin ?? 7, 7)}`,
      ),
    );
  }
  if (finalNegativeCash.length > 0) {
    blockers.push(
      ...finalNegativeCash.map((team) => `final_stabilization:negative_cash:${team.shortCode}:${round(team.cash)}`),
    );
  }

  rows.push({
    seasonId,
    totalPrizeMoney: round(totalPrizeMoney),
    facilityAppliedTeams,
    xpAppliedPlayers,
    xpPositive,
    xpStagnant,
    xpNegative,
    xpAuditNote: xpBlockers.length > 0 ? xpBlockers.join("|") : xpWarnings.slice(0, 20).join("|"),
    contractReleasedPlayers: contractApply?.releasedPlayers ?? 0,
    contractRenewedPlayers: contractApply?.renewedPlayers ?? 0,
    contractEventsWritten: contractApply?.contractEventsWritten ?? 0,
    aiMarketStatus: marketStatus,
    aiMarketExecutedSells: marketAppliedSells,
    aiMarketExecutedBuys: marketAppliedBuys,
    aiMarketBlockedTeams: marketBlockedTeams,
    aiMarketWarnings: marketWarnings.join("|"),
    blockers: blockers.join("|"),
  });

  return { rows, performanceRows, blockers, totalPrizeMoney, aiMarketStatus: marketStatus, plannerFinalGateRows };
}

function collectAuditRows(save: PersistedSaveGame, seasonId: string, seasonEnd: { totalPrizeMoney: number; aiMarketStatus: string }) {
  const gameState = save.gameState;
  const standings = gameState.seasonState.standings ?? {};
  const transfers = gameState.transferHistory.filter((entry) => entry.seasonId === seasonId);
  const contractEvents = (gameState.seasonState.contractEvents ?? []).filter((entry) => entry.seasonId === seasonId);
  const availability = (gameState.seasonState.playerAvailabilityState ?? {}) as Record<
    string,
    { fatigue?: number; injuryStatus?: string }
  >;
  const playerEvents = (gameState.playerProgressionEvents ?? []).filter((entry) => entry.seasonId === seasonId);
  const playerById = new Map(gameState.players.map((player) => [player.id, player]));
  const moraleAudit = buildPlayerMoraleAudit(gameState);
  const moraleByPlayerId = new Map(moraleAudit.rows.map((row) => [row.playerId, row]));
  const teamRows = rosterCounts(gameState).map(({ team, roster, identity }) => {
    const teamTransfers = transfers.filter((entry) => entry.fromTeamId === team.teamId || entry.toTeamId === team.teamId);
    const salary = roster.reduce((sum, entry) => {
      const player = playerById.get(entry.playerId);
      return sum + (resolvePlayerEconomyContract({ player, rosterEntry: entry }).salary ?? 0);
    }, 0);
    const fatigueValues = roster.map((entry) => playerById.get(entry.playerId)?.fatigue ?? availability[entry.playerId]?.fatigue ?? 0);
    const injured = roster.filter((entry) => availability[entry.playerId]?.injuryStatus === "injured").length;
    const teamMoraleRows = roster.map((entry) => moraleByPlayerId.get(entry.playerId)).filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
    const boardTrust = gameState.seasonState.boardConfidence?.[team.teamId] ?? null;
    return {
      seasonId,
      teamId: team.teamId,
      teamName: team.name,
      rank: standings[team.teamId]?.rank ?? null,
      points: standings[team.teamId]?.points ?? 0,
      cash: round(team.cash),
      salarySum: round(salary),
      rosterSize: roster.length,
      playerMin: identity?.playerMin ?? null,
      playerOpt: identity?.playerOpt ?? null,
      playerMax: getTeamPlayerMax(team, identity),
      buys: teamTransfers.filter((entry) => entry.transferType === "buy").length,
      sells: teamTransfers.filter((entry) => entry.transferType === "sell").length,
      contractExits: teamTransfers.filter((entry) => entry.transferType === "contract_exit").length,
      transferFeesIn: round(teamTransfers.filter((entry) => entry.fromTeamId === team.teamId).reduce((sum, entry) => sum + (entry.fee ?? 0), 0)),
      transferFeesOut: round(teamTransfers.filter((entry) => entry.toTeamId === team.teamId).reduce((sum, entry) => sum + (entry.fee ?? 0), 0)),
      injuries: injured,
      fatigueAvg: fatigueValues.length ? round(fatigueValues.reduce((sum, value) => sum + value, 0) / fatigueValues.length) : 0,
      fatigue70Plus: fatigueValues.filter((value) => value >= 70).length,
      fatigue85Plus: fatigueValues.filter((value) => value >= 85).length,
      moraleAvg: teamMoraleRows.length ? round(teamMoraleRows.reduce((sum, entry) => sum + entry.morale, 0) / teamMoraleRows.length, 1) : null,
      moraleCritical: teamMoraleRows.filter((entry) => entry.visibleMood === "angry" || entry.visibleMood === "unhappy").length,
      boardTrust: boardTrust?.value ?? identity?.boardConfidence ?? null,
      boardPressure: boardTrust?.pressure ?? null,
      renewalCount: contractEvents.filter((entry) => entry.teamId === team.teamId && entry.eventType === "contract_renewed").length,
      contractExitCount: contractEvents.filter((entry) => entry.teamId === team.teamId && entry.eventType === "contract_expired_exit").length,
      xpEvents: playerEvents.filter((entry) => entry.teamId === team.teamId).length,
    };
  });
  const facilityRows = gameState.teams.flatMap((team) => {
    const facilities = getTeamFacilityState(gameState, team.teamId);
    return FACILITY_CATALOG.map((facility) => {
      const level = getFacilityLevel(facilities, facility.facilityId);
      const raw = facilities.facilities[facility.facilityId];
      const efficiency = getFacilityEfficiency(facilities, facility.facilityId);
      const seasonEvents = (gameState.seasonState.facilityEvents ?? []).filter(
        (entry) => entry.seasonId === seasonId && entry.teamId === team.teamId && entry.facilityId === facility.facilityId,
      );
      return {
        seasonId,
        teamId: team.teamId,
        teamName: team.name,
        facilityId: facility.facilityId,
        facilityLabel: facility.label,
        level,
        enabled: raw?.enabled ?? false,
        conditionPct: efficiency.conditionPct,
        efficiencyPct: efficiency.efficiencyPct,
        disabledReason: raw?.disabledReason ?? null,
        spend: round(seasonEvents.filter((entry) => entry.cost > 0).reduce((sum, entry) => sum + entry.cost, 0)),
        income: round(Math.abs(seasonEvents.filter((entry) => entry.cost < 0).reduce((sum, entry) => sum + entry.cost, 0))),
        eventSources: Array.from(new Set(seasonEvents.map((entry) => entry.source))).join("|"),
      };
    });
  });
  const moraleRows = gameState.rosters.map((entry) => {
    const player = playerById.get(entry.playerId);
    const morale = moraleByPlayerId.get(entry.playerId) ?? null;
    const boardTrust = gameState.seasonState.boardConfidence?.[entry.teamId] ?? null;
    return {
      seasonId,
      teamId: entry.teamId,
      playerId: entry.playerId,
      playerName: player?.name ?? entry.playerId,
      morale: morale?.morale ?? null,
      mood: morale?.visibleMood ?? null,
      contractIntent: morale?.contractIntent ?? null,
      renewalRisk: morale?.moraleRenewalRisk ?? null,
      boardTrust: boardTrust?.value ?? null,
      boardPressure: boardTrust?.pressure ?? null,
      warnings: morale?.warnings.join("|") ?? "",
    };
  });
  const marketValueSalaryRows = gameState.rosters.map((entry) => {
    const player = playerById.get(entry.playerId);
    const economy = resolvePlayerEconomyContract({ player, rosterEntry: entry });
    return {
      seasonId,
      teamId: entry.teamId,
      playerId: entry.playerId,
      playerName: player?.name ?? entry.playerId,
      className: player?.className ?? null,
      race: player?.race ?? null,
      ovr: player?.ovr ?? player?.rating ?? null,
      pps: player?.pps ?? null,
      finalMarketValue: economy.marketValue,
      marketValueSource: economy.marketValueSource,
      baseMarketValue: economy.baseMarketValue,
      salaryMarketValue: economy.salaryMarketValue,
      allrounderBonus: economy.allrounderBonus,
      specialistBonus: economy.specialistBonus,
      contractSalary: economy.salary,
      salarySource: economy.salarySource,
      expectedSalary: economy.expectedSalary,
      salaryBase: economy.salaryBase,
      traitPercentSum: economy.traitPercentSum,
      contractLength: economy.contractLength,
      economyStatus: economy.economyStatus,
    };
  });
  return {
    teamRows,
    transferRows: transfers.map((entry) => ({ ...entry, seasonId: entry.seasonId ?? seasonId })),
    contractRows: contractEvents.map((entry) => ({ ...entry, seasonId: entry.seasonId ?? seasonId })),
    progressionRows: playerEvents.map((entry) => ({
      seasonId,
      eventId: entry.eventId,
      teamId: entry.teamId,
      playerId: entry.playerId,
      playerName: playerById.get(entry.playerId)?.name ?? entry.playerId,
      xpEarned: entry.xpEarned ?? null,
      xpSpent: entry.xpSpent,
      upgradeCount: entry.upgrades?.length ?? 0,
      attributeDelta: Object.entries(entry.progressionSnapshotAfter?.attributes ?? {}).reduce((sum, [attribute, afterValue]) => {
        const beforeValue = (entry.progressionSnapshotBefore?.attributes as Record<string, number | undefined> | undefined)?.[attribute];
        return sum + (typeof afterValue === "number" && typeof beforeValue === "number" ? afterValue - beforeValue : 0);
      }, 0),
      disciplineDelta: Object.entries(entry.progressionSnapshotAfter?.disciplineRatings ?? {}).reduce((sum, [disciplineId, afterValue]) => {
        const beforeValue = entry.progressionSnapshotBefore?.disciplineRatings?.[disciplineId];
        return sum + (typeof afterValue === "number" && typeof beforeValue === "number" ? afterValue - beforeValue : 0);
      }, 0),
      ovrDelta:
        entry.progressionSnapshotAfter?.ovr != null && entry.progressionSnapshotBefore?.ovr != null
          ? round(entry.progressionSnapshotAfter.ovr - entry.progressionSnapshotBefore.ovr, 2)
          : null,
      mvsDelta:
        entry.progressionSnapshotAfter?.mvs != null && entry.progressionSnapshotBefore?.mvs != null
          ? round(entry.progressionSnapshotAfter.mvs - entry.progressionSnapshotBefore.mvs, 2)
          : null,
      marketValuePreviewDelta:
        entry.progressionSnapshotAfter?.marketValuePreview != null && entry.progressionSnapshotBefore?.marketValue != null
          ? round(entry.progressionSnapshotAfter.marketValuePreview - entry.progressionSnapshotBefore.marketValue, 2)
          : null,
      source: entry.source,
    })),
    fatigueRows: teamRows.map((row) => ({
      seasonId,
      teamId: row.teamId,
      rosterSize: row.rosterSize,
      injuredPlayers: row.injuries,
      fatigueAvg: row.fatigueAvg,
      fatigue70Plus: row.fatigue70Plus,
      fatigue85Plus: row.fatigue85Plus,
      lineupPressure: row.rosterSize - row.injuries < Math.min(7, row.playerMin ?? 7),
    })),
    medalRows: teamRows
      .filter((row) => row.rank != null && row.rank <= 3)
      .map((row) => ({
        seasonId,
        teamId: row.teamId,
        teamName: row.teamName,
        medal: row.rank === 1 ? "gold" : row.rank === 2 ? "silver" : "bronze",
        rank: row.rank,
        points: row.points,
      })),
    facilityRows,
    moraleRows,
    marketValueSalaryRows,
    summary: {
      seasonId,
      champion: teamRows.find((row) => row.rank === 1)?.teamName ?? null,
      matchdaysResolved: (gameState.seasonState.matchdayResults ?? []).filter((entry) => entry.seasonId === seasonId).length,
      teamCount: gameState.teams.length,
      rosterMin: Math.min(...teamRows.map((row) => row.rosterSize)),
      rosterMax: Math.max(...teamRows.map((row) => row.rosterSize)),
      rosterAllExactlyTen: teamRows.every((row) => row.rosterSize === 10),
      transferCount: transfers.length,
      buyCount: countBy(transfers, (entry) => entry.transferType === "buy"),
      sellCount: countBy(transfers, (entry) => entry.transferType === "sell"),
      contractExitCount: countBy(transfers, (entry) => entry.transferType === "contract_exit"),
      renewalCount: countBy(contractEvents, (entry) => entry.eventType === "contract_renewed"),
      injuries: teamRows.reduce((sum, row) => sum + row.injuries, 0),
      lineupBlockers: teamRows.filter((row) => row.rosterSize - row.injuries < Math.min(7, row.playerMin ?? 7)).length,
      totalCash: round(teamRows.reduce((sum, row) => sum + Number(row.cash ?? 0), 0)),
      minCash: Math.min(...teamRows.map((row) => Number(row.cash ?? 0))),
      maxCash: Math.max(...teamRows.map((row) => Number(row.cash ?? 0))),
      totalSalary: round(teamRows.reduce((sum, row) => sum + Number(row.salarySum ?? 0), 0)),
      totalPrizeMoney: round(seasonEnd.totalPrizeMoney),
      aiMarketStatus: seasonEnd.aiMarketStatus,
      warnings: [
        teamRows.every((row) => row.rosterSize === 10) ? "all_rosters_exactly_10" : null,
        teamRows.some((row) => Number(row.cash) > 180) ? "cash_hoarding_detected" : null,
        transfers.some((entry) => entry.source === "season1_autoprep_topup" && seasonId !== "season-1")
          ? "season1_autoprep_topup_after_s1_detected"
          : null,
      ].filter((entry): entry is string => Boolean(entry)),
      blockers: [],
    } satisfies SeasonAudit,
  };
}

async function main() {
  loadEnvConfig(PROJECT_ROOT);
  const persistence = createPersistenceService();
  const previousActiveSave = persistence.getActiveSave();
  let save: PersistedSaveGame;
  if (RESUME_SAVE_ID) {
    const existing = persistence.getSaveById(RESUME_SAVE_ID);
    if (!existing) throw new Error(`Resume save ${RESUME_SAVE_ID} not found.`);
    save = existing;
    persistence.activateSave(save.saveId);
    console.error(`[long-run] resume ${save.saveId}`);
  } else {
    const created = persistence.createFreshSeasonOneSave({
      name: `${RUN_LABEL} ${new Date().toLocaleString("de-DE")}`,
    });
    const reset = await runSeasonStartReset({
      source: "sqlite",
      saveId: created.saveId,
      seasonId: created.gameState.season.id,
      dryRun: false,
      confirmToken: SEASON_START_RESET_CONFIRM_TOKEN,
    });
    if (reset.status !== "applied") {
      throw new Error(`S1 clean reset blocked: ${reset.blockingReasons.join(" | ") || reset.warnings.join(" | ")}`);
    }
    save = persistence.getSaveById(created.saveId) ?? created;
    assertCleanLongRunStart(save, "after season-start-reset before S1 top-up");
    save = setAllTeamsAi(save, persistence);
    assertCleanLongRunStart(save, "after AI control setup before S1 top-up");
    console.error(`[long-run] created ${save.saveId}`);
    if (!FULL_CHURN_STRESS_MODE) {
      const topUp = topUpSeasonOneToTargets(save.saveId, persistence);
      if (topUp.blockers.length > 0) {
        throw new Error(`S1 top-up blocked: ${topUp.blockers.join(" | ")}`);
      }
    }
    save = persistence.getSaveById(save.saveId) ?? save;
  }
  const teamRatingsPlayerOptSyncRowsAtStart = buildTeamRatingsPlayerOptSyncRows(save);
  save = persistence.saveSingleplayerState(save.saveId, save.gameState);
  if ((save.gameState.gamePhase ?? "") === "season_completed" && parseSeasonNumber(save.gameState.season.id) < TARGET_FINAL_SEASON) {
    const setup = buildPreSeasonNextSeasonSetupToken(save);
    const next = applyPreSeasonNextSeasonSetupLightweight(save, setup.confirmToken, persistence);
    if (!next.applied) {
      throw new Error(`Resume next-season setup blocked: ${next.blockingReasons.join(" | ")}`);
    }
    save = persistence.getSaveById(save.saveId) ?? save;
  }
  writeSimulationStartState(save, previousActiveSave);

  const allSeasonSummaries: SeasonAudit[] = [];
  const economyRows: Record<string, unknown>[] = [];
  const rosterRows: Record<string, unknown>[] = [];
  const aiMarketRows: Record<string, unknown>[] = [];
  const contractExitRows: Record<string, unknown>[] = [];
  const renewalRows: Record<string, unknown>[] = [];
  const buildingsRows: Record<string, unknown>[] = [];
  const moraleBoardTrustRows: Record<string, unknown>[] = [];
  const marketValueSalaryRows: Record<string, unknown>[] = [];
  const fatigueRows: Record<string, unknown>[] = [];
  const playerDevelopmentRows: Record<string, unknown>[] = [];
  const freeAgentRows: Record<string, unknown>[] = [];
  const medalRows: Record<string, unknown>[] = [];
  const performanceRows: PhaseMetric[] = [];
  const technicalBugsFixed: string[] = [];
  const openTechnicalBugs: string[] = [];
  const balanceIssues: string[] = [];
  const matchdayRows: Record<string, unknown>[] = [];
  const slotCoverageRows: Record<string, unknown>[] = [];
  const captainAutoFixRows: Record<string, unknown>[] = [];
  const plannerFinalGateRows: Record<string, unknown>[] = [];
  const fullChurnDraftRows: Record<string, unknown>[] = [];
  const fullChurnIdentityRows: Record<string, unknown>[] = [];

  const startSeasonNumber = Math.max(1, parseSeasonNumber(save.gameState.season.id));
  for (let seasonNumber = startSeasonNumber; seasonNumber <= TARGET_FINAL_SEASON; seasonNumber += 1) {
    save = persistence.getSaveById(save.saveId) ?? save;
    const seasonId = save.gameState.season.id;
    if (parseSeasonNumber(seasonId) !== seasonNumber) {
      throw new Error(`Expected season-${seasonNumber}, got ${seasonId}.`);
    }
    console.error(`[long-run] season ${seasonId} start`);
    if (FULL_CHURN_STRESS_MODE && save.gameState.matchdayState.matchdayId === save.gameState.season.matchdayIds[0]) {
      const churn = runFullChurnSeasonStart(save.saveId, seasonId, persistence);
      performanceRows.push(...churn.performanceRows);
      fullChurnDraftRows.push(...churn.draftRows);
      fullChurnIdentityRows.push(...churn.identityRows);
      if (churn.warnings.length > 0) balanceIssues.push(...churn.warnings.map((warning) => `${seasonId}:${warning}`));
      if (churn.blockers.length > 0) {
        openTechnicalBugs.push(...churn.blockers);
        break;
      }
      save = persistence.getSaveById(save.saveId) ?? save;
    }
    const cashRecovery = await recoverNegativeCashBeforeSeasonStart(save.saveId, seasonId, persistence);
    performanceRows.push(...cashRecovery.performanceRows);
    if (cashRecovery.blockers.length > 0) {
      openTechnicalBugs.push(...cashRecovery.blockers);
      break;
    }
    save = persistence.getSaveById(save.saveId) ?? save;
    const plannerReview = await runPreseasonPlannerReviewBeforeRosterRepair(save.saveId, seasonId, persistence);
    performanceRows.push(...plannerReview.performanceRows);
    if (plannerReview.warnings.length > 0) {
      balanceIssues.push(...plannerReview.warnings.map((warning) => `${seasonId}:planner_review:${warning}`));
    }
    save = persistence.getSaveById(save.saveId) ?? save;
    const rosterRepair = repairRosterMinimumBeforeSeasonStart(save.saveId, seasonId, persistence);
    performanceRows.push(...rosterRepair.performanceRows);
    aiMarketRows.push(...rosterRepair.purchases);
    if (rosterRepair.blockers.length > 0) {
      openTechnicalBugs.push(...rosterRepair.blockers);
      break;
    }
    save = persistence.getSaveById(save.saveId) ?? save;
    if (save.gameState.matchdayState.matchdayId === save.gameState.season.matchdayIds[0]) {
      const startedAt = Date.now();
      prepSeasonLineups(save.saveId, seasonId);
      recordPhase(performanceRows, {
        seasonId,
        phase: "season start lineup/autoprep",
        startedAt,
        itemCount: save.gameState.teams.length,
        status: "ok",
      });
      const captainRows = autoFixCaptainsAfterAutoprep(save.saveId, seasonId, persistence);
      captainAutoFixRows.push(...captainRows);
      const slotRows = auditSlotCoverageAfterAutoprep(save.saveId, seasonId, persistence);
      slotCoverageRows.push(...slotRows);
      const unresolvedSlotRows = slotRows.filter((row) => row.status === "hard_unresolved");
      if (unresolvedSlotRows.length > 0) {
        balanceIssues.push(`${seasonId}:slot_coverage_hard_unresolved:${unresolvedSlotRows.length}`);
      }
    }
    const matchdayRun = await runSeasonMatchdays(save.saveId, persistence);
    matchdayRows.push(...matchdayRun.matchdayRows);
    performanceRows.push(...matchdayRun.performanceRows);
    if (matchdayRun.blockers.length > 0) {
      openTechnicalBugs.push(...matchdayRun.blockers);
      break;
    }
    const finalizeStartedAt = Date.now();
    if (!finalizeSeasonIfNeeded(save.saveId, persistence)) {
      openTechnicalBugs.push(`season_finalize_failed:${seasonId}`);
      break;
    }
    recordPhase(performanceRows, {
      seasonId,
      phase: "season end standings/snapshot gate",
      startedAt: finalizeStartedAt,
      itemCount: null,
      status: "ok",
    });
    const seasonEnd = await applySeasonEnd(save.saveId, persistence);
    performanceRows.push(...seasonEnd.performanceRows);
    plannerFinalGateRows.push(...seasonEnd.plannerFinalGateRows);
    if (seasonEnd.blockers.length > 0) {
      openTechnicalBugs.push(...seasonEnd.blockers.map((entry) => `${seasonId}:${entry}`));
      break;
    }
    save = persistence.getSaveById(save.saveId) ?? save;
    const audit = collectAuditRows(save, seasonId, seasonEnd);
    allSeasonSummaries.push(audit.summary);
    economyRows.push(...audit.teamRows.map((row) => ({
      seasonId,
      teamId: row.teamId,
      teamName: row.teamName,
      cash: row.cash,
      salarySum: row.salarySum,
      transferFeesIn: row.transferFeesIn,
      transferFeesOut: row.transferFeesOut,
      prizeMoneySeasonTotal: seasonEnd.totalPrizeMoney,
      rank: row.rank,
      points: row.points,
    })));
    rosterRows.push(...audit.teamRows);
    aiMarketRows.push(...audit.transferRows);
    contractExitRows.push(...audit.contractRows.filter((row) => row.eventType === "contract_expired_exit"));
    renewalRows.push(...audit.contractRows);
    buildingsRows.push(...audit.facilityRows);
    moraleBoardTrustRows.push(...audit.moraleRows);
    marketValueSalaryRows.push(...audit.marketValueSalaryRows);
    fatigueRows.push(...audit.fatigueRows);
    playerDevelopmentRows.push(...audit.progressionRows);
    medalRows.push(...audit.medalRows);
    freeAgentRows.push({
      seasonId,
      freeAgents: save.gameState.players.length - new Set(save.gameState.rosters.map((entry) => entry.playerId)).size,
      ambientDevelopmentEvents: 0,
      source: "ambient_free_agent_development_not_applied_in_long_run",
    });
    if (audit.summary.warnings.length > 0) balanceIssues.push(...audit.summary.warnings.map((warning) => `${seasonId}:${warning}`));

    if (seasonNumber < TARGET_FINAL_SEASON) {
      const latest = persistence.getSaveById(save.saveId);
      if (!latest) throw new Error("Long-run save disappeared before next-season setup.");
      const transitionStartedAt = Date.now();
      const setup = buildPreSeasonNextSeasonSetupToken(latest);
      const next = applyPreSeasonNextSeasonSetupLightweight(latest, setup.confirmToken, persistence);
      recordPhase(performanceRows, {
        seasonId,
        phase: "season transition",
        startedAt: transitionStartedAt,
        itemCount: null,
        status: next.applied ? "ok" : "blocked",
        note: next.blockingReasons.join("|"),
      });
      if (!next.applied) {
        openTechnicalBugs.push(`next_season_setup:${seasonId}:${next.blockingReasons.join("|")}`);
        break;
      }
    }
  }

  const finalSave = persistence.getSaveById(save.saveId) ?? save;
  persistence.activateSave(finalSave.saveId);
  const contractExpiryRiskRows = buildContractExpiryRiskRows(finalSave);
  const sellPressureRows = await buildSellPressureRows(finalSave);
  const repairPerformanceRows = buildRepairPerformanceRows(performanceRows);
  const rosterTargetValidationRows = buildRosterTargetValidationRows(finalSave);
  const captainBudgetAuditRows = buildCaptainBudgetAuditRows(finalSave);
  const strategicTransferByTeamRows = buildStrategicTransferByTeamRows({
    rosterRows,
    aiMarketRows,
    contractExitRows,
    renewalRows,
    sellPressureRows,
  });
  const transferDecisionRows = buildTransferDecisionRows(aiMarketRows, contractExitRows, renewalRows);
  const plannedVsFillerRows = strategicTransferByTeamRows.map((row) => ({
    seasonId: row.seasonId,
    teamId: row.teamId,
    teamName: row.teamName,
    plannedPicks: row.plannedPicks,
    fillerPicks: row.fillerPicks,
    emergencyFillerShare:
      Number(row.plannedPicks) + Number(row.fillerPicks) > 0
        ? round(Number(row.fillerPicks) / (Number(row.plannedPicks) + Number(row.fillerPicks)), 3)
        : 0,
    reasonIfOnlyFiller:
      Number(row.fillerPicks) > 0 && Number(row.plannedPicks) === 0
        ? row.reasonIfBelowOpt || "repair_or_market_scope"
        : "",
  }));
  const salaryPressureByTeamRows = strategicTransferByTeamRows.map((row) => ({
    seasonId: row.seasonId,
    teamId: row.teamId,
    teamName: row.teamName,
    salaryPressure: row.salaryPressure,
    salaryRiskLevel: Number(row.salaryPressure) >= 1 ? "critical" : Number(row.salaryPressure) >= 0.65 ? "high" : Number(row.salaryPressure) >= 0.35 ? "medium" : "low",
    sellPressure: row.sellPressure,
    buys: row.buys,
    sells: row.sells,
    contractExits: row.contractExits,
    rosterAfter: row.rosterAfter,
    playerOpt: row.playerOpt,
  }));
  const contractExitDecisionRows = strategicTransferByTeamRows.map((row) => ({
    seasonId: row.seasonId,
    teamId: row.teamId,
    teamName: row.teamName,
    contractExits: row.contractExits,
    plannedExpiries: row.plannedExpiries,
    forcedExpiries: row.forcedExpiries,
    soldBeforeExpiry: row.soldBeforeExpiry,
    renewedBeforeExpiry: row.renewedBeforeExpiry,
    replacedBeforeExpiry: row.replacedBeforeExpiry,
  }));
  const transferActivityComparisonRows = ["season-10", "season-11"].map((seasonId) => {
    const rowsForSeason = strategicTransferByTeamRows.filter((row) => row.seasonId === seasonId);
    return {
      seasonId,
      buys: rowsForSeason.reduce((sum, row) => sum + Number(row.buys ?? 0), 0),
      sells: rowsForSeason.reduce((sum, row) => sum + Number(row.sells ?? 0), 0),
      contractExits: rowsForSeason.reduce((sum, row) => sum + Number(row.contractExits ?? 0), 0),
      plannedPicks: rowsForSeason.reduce((sum, row) => sum + Number(row.plannedPicks ?? 0), 0),
      fillerPicks: rowsForSeason.reduce((sum, row) => sum + Number(row.fillerPicks ?? 0), 0),
      teamsBelowOpt: rosterRows.filter((row) => row.seasonId === seasonId && Number(row.rosterSize ?? 0) < Number(row.playerOpt ?? 0)).length,
      teamsAt13Or14: rosterRows.filter((row) => row.seasonId === seasonId && Number(row.rosterSize ?? 0) >= 13 && Number(row.rosterSize ?? 0) <= 14).length,
    };
  });
  const optCoverageComparisonRows = ["season-10", "season-11"].map((seasonId) => {
    const rowsForSeason = rosterRows.filter((row) => row.seasonId === seasonId);
    const coverageRows = slotCoverageRows.filter((row) => row.seasonId === seasonId);
    return {
      seasonId,
      averageRoster: rowsForSeason.length ? round(rowsForSeason.reduce((sum, row) => sum + Number(row.rosterSize ?? 0), 0) / rowsForSeason.length, 2) : "",
      rosterMin: rowsForSeason.length ? Math.min(...rowsForSeason.map((row) => Number(row.rosterSize ?? 0))) : "",
      rosterMax: rowsForSeason.length ? Math.max(...rowsForSeason.map((row) => Number(row.rosterSize ?? 0))) : "",
      teamsBelowOpt: rowsForSeason.filter((row) => Number(row.rosterSize ?? 0) < Number(row.playerOpt ?? 0)).length,
      teamsAtOrAboveOpt: rowsForSeason.filter((row) => Number(row.rosterSize ?? 0) >= Number(row.playerOpt ?? 0)).length,
      teamsAt13Or14: rowsForSeason.filter((row) => Number(row.rosterSize ?? 0) >= 13 && Number(row.rosterSize ?? 0) <= 14).length,
      hardCoverageUnresolved: coverageRows.filter((row) => row.status === "hard_unresolved").length,
      missingSlots: coverageRows.reduce((sum, row) => sum + Number(row.missingSlots ?? 0), 0),
      depthWarnings: coverageRows.filter((row) => Number(row.depthWarnings ?? 0) > 0).length,
      captainWarnings: coverageRows.filter((row) => Number(row.captainWarnings ?? 0) > 0).length,
      buys: transferActivityComparisonRows.find((row) => row.seasonId === seasonId)?.buys ?? "",
      sells: transferActivityComparisonRows.find((row) => row.seasonId === seasonId)?.sells ?? "",
      contractExits: transferActivityComparisonRows.find((row) => row.seasonId === seasonId)?.contractExits ?? "",
      negativeCashTeams: rowsForSeason.filter((row) => Number(row.cash ?? 0) < 0).length,
    };
  });

  const seasonHistory = finalSave.gameState.seasonState.seasonSnapshots ?? [];
  const unresolvedSlotCoverage = slotCoverageRows.filter((row) => row.status === "hard_unresolved").length;
  const captainWarningRows = slotCoverageRows.filter((row) => Number(row.captainWarnings ?? 0) > 0).length;
  const depthWarningRows = slotCoverageRows.filter((row) => Number(row.depthWarnings ?? 0) > 0).length;
  const highContractRiskRows = contractExpiryRiskRows.filter((row) => row.riskLevel === "high").length;
  const pressureSellRows = sellPressureRows.filter((row) => Number(row.sellPriority ?? 0) >= 55).length;
  const summary = {
    generatedAt: new Date().toISOString(),
    saveId: finalSave.saveId,
    saveName: finalSave.name,
    previousActiveSaveId: previousActiveSave?.saveId ?? null,
    finalSeasonId: finalSave.gameState.season.id,
    finalGamePhase: finalSave.gameState.gamePhase ?? "season_active",
    seasonsCompleted: allSeasonSummaries.length,
    seasonHistorySnapshots: seasonHistory.length,
    summaries: allSeasonSummaries,
    guardChecks: {
      season1AutoprepTopupAfterSeason1: aiMarketRows.some((row) => row.source === "season1_autoprep_topup" && row.seasonId !== "season-1"),
      anyRosterAllExactlyTen: allSeasonSummaries.some((entry) => entry.rosterAllExactlyTen),
      negativeCashTeams: rosterRows.filter((row) => Number(row.cash ?? 0) < 0).length,
      contractExitRows: contractExitRows.length,
      unresolvedSlotCoverage,
      hardCoverageUnresolved: unresolvedSlotCoverage,
      captainWarningRows,
      depthWarningRows,
      highContractRiskRows,
      pressureSellRows,
      historyHasS1ToFinal: seasonHistory.map((entry) => entry.seasonId),
      medals: medalRows.length,
    },
    technicalBugsFixed,
    openTechnicalBugs,
    balanceIssues: Array.from(new Set(balanceIssues)),
    recommendations: [
      allSeasonSummaries.some((entry) => entry.lineupBlockers > 0)
        ? "Roster-Max 14/15 weiter testen, weil Lineup-Druck auftrat."
        : "Roster-Max 14 wirkt im Long-Run technisch spielbar; Rotation trotzdem mit Balance-Audit vergleichen.",
      allSeasonSummaries.some((entry) => entry.maxCash > 180)
        ? "Cash-Inflation/Contract-Exit-Cash separat balancen."
        : "Cash wirkt nicht sofort absurd inflationär.",
      allSeasonSummaries.some((entry) => entry.injuries > 24)
        ? "Injury 85+ 22% nicht direkt nerfen, aber Recovery/Rotation weiter beobachten."
        : "Injury 85+ 22% wirkt im Lauf zunächst spielbar.",
    ],
  };

  writeOutput("multi-season-s1-s6-summary.json", `${JSON.stringify(summary, null, 2)}\n`);
  writeOutput(
    "multi-season-s1-s6-summary.md",
    [
      "# Multi-Season Sandbox Audit S1→S6",
      "",
      `- Save behalten/aktiviert: ${summary.saveName} (${summary.saveId})`,
      `- Seasons abgeschlossen: ${summary.seasonsCompleted}`,
      `- Finaler Stand: ${summary.finalSeasonId} · ${summary.finalGamePhase}`,
      `- Season-History-Snapshots: ${summary.seasonHistorySnapshots}`,
      `- Offene technische Blocker: ${summary.openTechnicalBugs.length ? summary.openTechnicalBugs.join(" · ") : "keine"}`,
      `- Balance-Flags: ${summary.balanceIssues.length ? summary.balanceIssues.join(" · ") : "keine"}`,
      "",
      "## Season Summary",
      ...summary.summaries.map(
        (entry) =>
          `- ${entry.seasonId}: Champion ${entry.champion ?? "—"} · Cash ${entry.minCash}-${entry.maxCash} · Roster ${entry.rosterMin}-${entry.rosterMax} · Transfers ${entry.transferCount} · Injuries ${entry.injuries}`,
      ),
      "",
      "## Empfehlungen",
      ...summary.recommendations.map((entry) => `- ${entry}`),
    ].join("\n"),
  );
  writeCsv("economy-cash-flow-s1-s6.csv", economyRows);
  writeCsv("roster-size-s1-s6.csv", rosterRows);
  writeCsv("ai-market-actions-s1-s6.csv", aiMarketRows);
  writeCsv("contract-exits-s1-s6.csv", contractExitRows);
  writeCsv("renewals-s1-s6.csv", renewalRows);
  writeCsv("buildings-ai-s1-s6.csv", buildingsRows);
  writeCsv("morale-boardtrust-s1-s6.csv", moraleBoardTrustRows);
  writeCsv("marketvalue-salary-s1-s6.csv", marketValueSalaryRows);
  writeCsv("fatigue-injury-s1-s6.csv", fatigueRows);
  writeCsv("player-development-s1-s6.csv", playerDevelopmentRows);
  writeCsv("free-agent-development-s1-s6.csv", freeAgentRows);
  writeCsv("season-history-medals-s1-s6.csv", medalRows);
  writeCsv("long-run-matchdays-s1-s6.csv", matchdayRows);
  writeCsv("slot-coverage-repair-after-autoprep.csv", slotCoverageRows);
  writeCsv("contract-expiry-risk-after-fix.csv", contractExpiryRiskRows);
  writeCsv("ai-sell-pressure-after-fix.csv", sellPressureRows);
  writeCsv("repair-performance-after-index.csv", repairPerformanceRows);
  writeCsv("slot-coverage-audit-cleanup-v3.csv", slotCoverageRows);
  writeCsv(
    "slot-coverage-hard-vs-warning-v3.csv",
    slotCoverageRows.map((row) => ({
      seasonId: row.seasonId,
      matchdayId: row.matchdayId,
      teamId: row.teamId,
      teamName: row.teamName,
      status: row.status,
      hardCoverageUnresolved: row.hardCoverageUnresolved,
      captainWarnings: row.captainWarnings,
      depthWarnings: row.depthWarnings,
      missingSlots: row.missingSlots,
      duplicateConflicts: row.duplicateConflicts,
      formCardInvalid: row.formCardInvalid,
      captainMissing: row.captainMissing,
      reason: row.reason,
      warningReason: row.warningReason,
    })),
  );
  writeCsv("captain-autofix-v3.csv", captainAutoFixRows);
  writeCsv("planner-final-gate-v3.csv", plannerFinalGateRows);
  writeCsv("contract-expiry-risk-v3.csv", contractExpiryRiskRows);
  writeCsv("team-ratings-playeropt-sync-v1.csv", teamRatingsPlayerOptSyncRowsAtStart);
  writeCsv("s11-roster-target-validation.csv", rosterTargetValidationRows);
  writeCsv("s10-vs-s11-opt-coverage-comparison.csv", optCoverageComparisonRows);
  writeCsv("s11-contract-expiry-opt-risk.csv", contractExpiryRiskRows);
  writeCsv("s11-captain-budget-audit.csv", captainBudgetAuditRows);
  writeCsv("s11-captain-autofix-diagnostics.csv", captainAutoFixRows);
  writeCsv("strategic-transfer-market-by-team.csv", strategicTransferByTeamRows);
  writeCsv("transfer-decision-log-v1.csv", transferDecisionRows);
  writeCsv("planned-picks-vs-filler-picks.csv", plannedVsFillerRows);
  writeCsv("salary-pressure-by-team.csv", salaryPressureByTeamRows);
  writeCsv("contract-exit-decision-audit.csv", contractExitDecisionRows);
  writeCsv("s10-vs-s11-transfer-activity-comparison.csv", transferActivityComparisonRows);
  writeCsv("performance-longrun-s1-s6.csv", performanceRows);
  const slowestOperationsRows = [...performanceRows]
    .sort((left, right) => right.durationMs - left.durationMs)
    .slice(0, 50)
    .map((row, index) => ({ rank: index + 1, ...row }));
  const cacheAuditRows = performanceRows.map((row) => ({
    seasonId: row.seasonId,
    matchdayId: row.matchdayId ?? "",
    phase: row.phase,
    durationMs: row.durationMs,
    cacheHits: row.cacheHits ?? "",
    cacheMisses: row.cacheMisses ?? "",
    candidatePoolTotal: row.candidatePoolTotal ?? "",
    candidatePoolLegal: row.candidatePoolLegal ?? "",
    candidatePoolAfterCheapFit: row.candidatePoolAfterCheapFit ?? "",
    expensivePreviewCount: row.expensivePreviewCount ?? "",
    note: row.note ?? "",
  }));
  const bugfixRows = [
    ...technicalBugsFixed.map((entry) => ({ status: "fixed", issue: entry })),
    ...openTechnicalBugs.map((entry) => ({ status: "open", issue: entry })),
  ];
  const developmentSummaryRows = playerDevelopmentRows.map((row) => ({
    seasonId: row.seasonId,
    teamId: row.teamId,
    playerId: row.playerId,
    playerName: row.playerName,
    xpEarned: row.xpEarned,
    xpSpent: row.xpSpent,
    upgradeCount: row.upgradeCount,
    attributeDelta: row.attributeDelta,
    disciplineDelta: row.disciplineDelta,
    ovrDelta: row.ovrDelta,
    mvsDelta: row.mvsDelta,
    marketValuePreviewDelta: row.marketValuePreviewDelta,
    snapshotStatus:
      row.attributeDelta != null && row.disciplineDelta != null ? "before_after_snapshot_present" : "snapshot_incomplete",
  }));
  for (const seasonId of Array.from(new Set(developmentSummaryRows.map((row) => String(row.seasonId))))) {
    const seasonRows = developmentSummaryRows
      .filter((row) => row.seasonId === seasonId)
      .sort((left, right) => Number(right.attributeDelta ?? 0) - Number(left.attributeDelta ?? 0));
    writeCsv(`${seasonId}-xp-development-rankings.csv`, seasonRows);
  }
  const fiveSeasonSummary = {
    ...summary,
    stressMode: FULL_CHURN_STRESS_MODE ? "FULL_CHURN_STRESS_MODE" : "standard_long_run",
    targetFinalSeason: TARGET_FINAL_SEASON,
    fullChurnDraftPicks: fullChurnDraftRows.length,
    fullChurnIdentityRows: fullChurnIdentityRows.length,
    slowestOperations: slowestOperationsRows.slice(0, 10),
  };
  writeOutput("five-season-full-churn-report.json", `${JSON.stringify(fiveSeasonSummary, null, 2)}\n`);
  writeOutput(
    "five-season-full-churn-summary.md",
    [
      "# Five-Season Full-Churn Summary",
      "",
      `- Modus: ${fiveSeasonSummary.stressMode}`,
      `- Save: ${summary.saveName} (${summary.saveId})`,
      `- Seasons abgeschlossen: ${summary.seasonsCompleted}/${TARGET_FINAL_SEASON}`,
      `- Finaler Stand: ${summary.finalSeasonId} · ${summary.finalGamePhase}`,
      `- Full-Churn Picks: ${fullChurnDraftRows.length}`,
      `- Season-History-Snapshots: ${summary.seasonHistorySnapshots}`,
      `- Offene RED/Tech-Blocker: ${summary.openTechnicalBugs.length ? summary.openTechnicalBugs.join(" · ") : "keine"}`,
      `- Balance-Flags: ${summary.balanceIssues.length ? summary.balanceIssues.join(" · ") : "keine"}`,
      "",
      "## Seasons",
      ...summary.summaries.map(
        (entry) =>
          `- ${entry.seasonId}: Champion ${entry.champion ?? "—"} · Roster ${entry.rosterMin}-${entry.rosterMax} · Cash ${entry.minCash}-${entry.maxCash} · Transfers ${entry.transferCount}`,
      ),
    ].join("\n"),
  );
  writeCsv("five-season-performance.csv", performanceRows);
  writeOutput("five-season-phase-timings.json", `${JSON.stringify(performanceRows, null, 2)}\n`);
  writeCsv("five-season-cache-audit.csv", cacheAuditRows);
  writeCsv("five-season-slowest-operations.csv", slowestOperationsRows);
  writeCsv("five-season-bugfix-log.csv", bugfixRows, ["status", "issue"]);
  writeCsv("five-season-draft-audit.csv", fullChurnDraftRows);
  writeCsv("five-season-team-identity-audit.csv", fullChurnIdentityRows);
  writeCsv("five-season-economy-audit.csv", economyRows);
  writeOutput(
    "five-season-no-ovr-mvs-mw-scoring-audit.md",
    [
      "# No OVR/MVS/MW Scoring Audit",
      "",
      "- Pick-Scoring im Full-Clean-Redraft nutzt Attribute, Disziplin-/Achsenfit, Identity/Theme, Needs, Traits, Potential-Kontext, Gehalt/Budget und Contract-Risk.",
      "- OVR und MVS werden im Churn-Pickpfad nicht als Scorebonus verwendet.",
      "- Marktwert wird im Churn-Pickpfad fuer Cash-Legalitaet, Budget-Sicherheit, Zukunftskosten und Value-/Salary-Risk genutzt, nicht als 'besserer Spieler'-Signal.",
      "- Alphabetische Spieler-Tie-Breaker wurden aus dem Redraft-Pickpfad entfernt; Ties laufen deterministisch ueber Save-/Team-/Pick-Salt und Player-ID.",
      "- `full_churn_redraft_buy` ist als eigene Transferquelle getrennt von `season1_autoprep_topup`.",
    ].join("\n"),
  );
  writeOutput(
    "five-season-development-integrity.md",
    [
      "# Five-Season Development Integrity",
      "",
      `- Progression Events: ${developmentSummaryRows.length}`,
      `- Events mit Upgrades: ${developmentSummaryRows.filter((row) => Number(row.upgradeCount ?? 0) > 0).length}`,
      `- Snapshot-unvollstaendig: ${developmentSummaryRows.filter((row) => row.snapshotStatus !== "before_after_snapshot_present").length}`,
      `- Max Attribute-Delta: ${Math.max(0, ...developmentSummaryRows.map((row) => Number(row.attributeDelta ?? 0)))}`,
      `- Max Disziplin-Delta Summe: ${Math.max(0, ...developmentSummaryRows.map((row) => Number(row.disciplineDelta ?? 0)))}`,
      "",
      "Siehe `season-X-xp-development-rankings.csv` fuer die saisonalen Top/Bottom-Reihen.",
    ].join("\n"),
  );
  writeOutput(
    "five-season-open-balance-questions.md",
    [
      "# Open Balance Questions",
      "",
      ...(summary.balanceIssues.length ? summary.balanceIssues.map((entry) => `- ${entry}`) : ["- Keine offenen Balance-Fragen aus diesem Lauf."]),
    ].join("\n"),
  );
  writeOutput(
    "five-season-open-tech-debt.md",
    [
      "# Open Tech Debt",
      "",
      ...(summary.openTechnicalBugs.length ? summary.openTechnicalBugs.map((entry) => `- ${entry}`) : ["- Keine offenen technischen Blocker aus diesem Lauf."]),
      "",
      "- Production `build:clean` bleibt separat zu beobachten, falls der bekannte Collecting-page-data-Haenger wieder auftaucht.",
    ].join("\n"),
  );
  writeOutput(
    "balance-issues-report.md",
    [`# Balance Issues`, "", ...(summary.balanceIssues.length ? summary.balanceIssues.map((entry) => `- ${entry}`) : ["- Keine Balance-Flags."])].join("\n"),
  );
  writeOutput(
    "yellow-stations-fix-v2.md",
    [
      "# Yellow Stations Fix V2",
      "",
      `- Save: ${summary.saveName} (${summary.saveId})`,
      `- Finaler Stand: ${summary.finalSeasonId} · ${summary.finalGamePhase}`,
      `- Seasons im Lauf abgeschlossen: ${summary.seasonsCompleted}/${TARGET_FINAL_SEASON}`,
      "",
      "## Fixes",
      "- Slot-Coverage-Repair prueft vor Autoprep jetzt den maximalen D1+D2-Slotbedarf der Season und kauft im Notfall bis Depth/Max statt nur bis Optimum.",
      "- Autoprep-Audit exportiert pro Team/Matchday fehlende Slots, Captain-Info, Duplikate und Formkarten-Konflikte; Captain-Luecken sind kein Coverage-Hardblock.",
      "- Sell-Preview erhoeht Verkaufsdruck bei zu kleiner Cash-Reserve und bei auslaufenden Vertraegen ohne aktuelle Achsen-Notwendigkeit.",
      "- Contract-Expiry-Audit zeigt, ob auslaufende Vertraege nach dem Tick Coverage- oder Cash-Risiken erzeugen.",
      "- Repair-Performance-Export filtert die teuren Planner/Repair/Market-Phasen fuer Performancevergleich.",
      "",
      "## Checks",
      `- Slot-Coverage unresolved: ${unresolvedSlotCoverage}`,
      `- Contract-Expiry high risk: ${highContractRiskRows}`,
      `- Sell-Pressure Kandidaten >=55: ${pressureSellRows}`,
      `- Negative Cash Team-Seasons im Lauf: ${summary.guardChecks.negativeCashTeams}`,
      `- Offene technische Blocker: ${summary.openTechnicalBugs.length ? summary.openTechnicalBugs.join(" · ") : "keine"}`,
      `- Balance-Flags: ${summary.balanceIssues.length ? summary.balanceIssues.join(" · ") : "keine"}`,
      "",
      "## Exports",
      "- `slot-coverage-repair-after-autoprep.csv`",
      "- `contract-expiry-risk-after-fix.csv`",
      "- `ai-sell-pressure-after-fix.csv`",
      "- `repair-performance-after-index.csv`",
    ].join("\n"),
  );
  writeOutput(
    "yellow-stations-fix-v3.md",
    [
      "# Yellow Stations Fix V3",
      "",
      `- Save: ${summary.saveName} (${summary.saveId})`,
      `- Finaler Stand: ${summary.finalSeasonId} · ${summary.finalGamePhase}`,
      `- Seasons im Lauf abgeschlossen: ${summary.seasonsCompleted}/${TARGET_FINAL_SEASON}`,
      "",
      "## Fixes",
      "- Coverage-Audit trennt `hard_unresolved`, `warning` und `ready`.",
      "- Reine Captain-Luecken sind Warning-only und kein Coverage-Hardblock.",
      "- Captain-Autofix setzt nach Autoprep legale Captains bis zum Season-Captain-Limit.",
      "- Planner-Final-Gate prueft Kaufkandidaten gegen Cashpuffer, Coverage-Fallback und Hard-No-Go.",
      "- Contract-Expiry-Risk exportiert `expiryCreatesSlotRisk`, `renewalRecommended` und `replacementNeeded`.",
      "",
      "## Checks",
      `- hardCoverageUnresolved: ${unresolvedSlotCoverage}`,
      `- captainWarnings: ${captainWarningRows}`,
      `- depthWarnings: ${depthWarningRows}`,
      `- captainAutoSet: ${captainAutoFixRows.filter((row) => row.status === "auto_set").length}`,
      `- captainStillMissing: ${captainAutoFixRows.filter((row) => Number(row.captainStillMissing ?? 0) > 0).length}`,
      `- Contract-Expiry high risk: ${highContractRiskRows}`,
      `- Negative Cash Team-Seasons im Lauf: ${summary.guardChecks.negativeCashTeams}`,
      `- Offene technische Blocker: ${summary.openTechnicalBugs.length ? summary.openTechnicalBugs.join(" · ") : "keine"}`,
      `- Balance-Flags: ${summary.balanceIssues.length ? summary.balanceIssues.join(" · ") : "keine"}`,
      "",
      "## Exports",
      "- `slot-coverage-audit-cleanup-v3.csv`",
      "- `slot-coverage-hard-vs-warning-v3.csv`",
      "- `captain-autofix-v3.csv`",
      "- `planner-final-gate-v3.csv`",
      "- `contract-expiry-risk-v3.csv`",
    ].join("\n"),
  );
  writeOutput(
    "team-ratings-playeropt-sync-v1.md",
    [
      "# Team Ratings PlayerOpt Sync V1",
      "",
      `- Save: ${summary.saveName} (${summary.saveId})`,
      `- Teams geprueft: ${teamRatingsPlayerOptSyncRowsAtStart.length}`,
      `- Alle Max14: ${teamRatingsPlayerOptSyncRowsAtStart.every((row) => Number(row.playerMax) === 14) ? "ja" : "nein"}`,
      `- Gueltige Bounds: ${teamRatingsPlayerOptSyncRowsAtStart.filter((row) => row.validBounds).length}/${teamRatingsPlayerOptSyncRowsAtStart.length}`,
      `- Opt-Min/Max: ${Math.min(...teamRatingsPlayerOptSyncRowsAtStart.map((row) => Number(row.appliedPlayerOpt ?? 0)))}-${Math.max(...teamRatingsPlayerOptSyncRowsAtStart.map((row) => Number(row.appliedPlayerOpt ?? 0)))}`,
      "",
      "Nur Team-Target-Metadaten wurden normalisiert; Spieler, Results, Transfers und History bleiben fachlich unberuehrt.",
    ].join("\n"),
  );
  writeOutput(
    "strategic-transfer-market-v1.md",
    [
      "# Strategic Transfer Market V1",
      "",
      `- Save: ${summary.saveName} (${summary.saveId})`,
      `- Finaler Stand: ${summary.finalSeasonId} · ${summary.finalGamePhase}`,
      `- S10/S11 Vergleich: siehe s10-vs-s11-transfer-activity-comparison.csv`,
      `- Planned Picks: ${plannedVsFillerRows.reduce((sum, row) => sum + Number(row.plannedPicks ?? 0), 0)}`,
      `- Emergency Filler Picks: ${plannedVsFillerRows.reduce((sum, row) => sum + Number(row.fillerPicks ?? 0), 0)}`,
      `- Sell-Pressure Kandidaten >=55: ${pressureSellRows}`,
      `- Contract-Exit Decision Rows: ${contractExitDecisionRows.length}`,
      "",
      "## Implementiert",
      "- Markt-Preflight scannt Opt-Gaps, Roster-after-Expiry, Salary Pressure, Board Pressure und Value-Sell-Fenster.",
      "- Buy-Plan darf Richtung PlayerOpt mehrere Picks planen; Coverage-Fallback bleibt moeglich.",
      "- Sell-Preview erhoeht Druck bei Cash-/Salary-/Board-/Expiry-Risiko, schuetzt aber Star/Core-Spieler ohne echten Druck.",
      "- Reports trennen planned picks und emergency filler picks sowie forced/planned expiry-Indikatoren.",
      "",
      "## Offene Balance-Fragen",
      ...(summary.balanceIssues.length ? summary.balanceIssues.map((entry) => `- ${entry}`) : ["- Keine Balance-Flags aus diesem Lauf."]),
    ].join("\n"),
  );
  writeOutput(
    "s11-playeropt-max14-playability-report.md",
    [
      "# S11 PlayerOpt/Max14 Playability Report",
      "",
      `- Save: ${summary.saveName} (${summary.saveId})`,
      `- Finaler Stand: ${summary.finalSeasonId} · ${summary.finalGamePhase}`,
      `- PlayerMax Validation: ${rosterTargetValidationRows.every((row) => Number(row.playerMax) === 14) ? "GREEN" : "RED"}`,
      `- Bounds Validation: ${rosterTargetValidationRows.every((row) => row.validBounds) ? "GREEN" : "RED"}`,
      `- Negative Cash Teams: ${summary.guardChecks.negativeCashTeams}`,
      `- Hard Coverage Unresolved: ${summary.guardChecks.hardCoverageUnresolved}`,
      `- Captain Warnings: ${summary.guardChecks.captainWarningRows}`,
      "",
      "## S10 vs S11",
      ...optCoverageComparisonRows.map(
        (row) =>
          `- ${row.seasonId}: AvgRoster ${row.averageRoster} · BelowOpt ${row.teamsBelowOpt} · 13/14 ${row.teamsAt13Or14} · Buys/Sells/Exits ${row.buys}/${row.sells}/${row.contractExits}`,
      ),
      "",
      "## Captain Budget",
      `- Erwartet pro abgeschlossener Season/Team: ${SEASON_CAPTAIN_SLOTS}`,
      `- Missing Source Rows: ${captainBudgetAuditRows.filter((row) => row.captainHistoryMissingSource).length}`,
      `- Underused Rows: ${captainBudgetAuditRows.filter((row) => row.reasonIfMissing === "captain_budget_underused").length}`,
    ].join("\n"),
  );
  writeOutput(
    "technical-bugs-fixed.md",
    [
      "# Technical Bugs Fixed During Long-Run",
      "",
      technicalBugsFixed.length ? technicalBugsFixed.map((entry) => `- ${entry}`).join("\n") : "- Keine technischen Bugfixes während dieses Laufs.",
      "",
      "## Offen",
      openTechnicalBugs.length ? openTechnicalBugs.map((entry) => `- ${entry}`).join("\n") : "- Keine offenen technischen Blocker.",
    ].join("\n"),
  );
  writeOutput(
    "technical-blockers-open.md",
    [
      "# Technical Blockers Open",
      "",
      openTechnicalBugs.length
        ? openTechnicalBugs.map((entry) => `- ${entry}`).join("\n")
        : "- Keine offenen technischen Blocker.",
      "",
      "## Validitaet",
      openTechnicalBugs.length ? "- Run ist ab erstem technischen Blocker nicht vollstaendig strict." : "- Run blieb bis zum Export strict.",
    ].join("\n"),
  );

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
