import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

import { loadEnvConfig } from "@next/env";

import { AI_MARKET_APPLY_CONFIRM_TOKEN } from "@/lib/ai/ai-market-plan-apply-contract";
import {
  getTeamsNeedingConvergence,
  runEmergencyRosterRepairForTeams,
} from "@/lib/ai/ai-market-plan-convergence-service";
import { runTransferWindowSession } from "@/lib/ai/ai-transfer-window-session-service";
import { buildAiTransfermarktSellPreview } from "@/lib/ai/ai-transfermarkt-sell-preview-service";
import { applyAiLegacyLineupBatchLocally } from "@/lib/ai/ai-legacy-lineup-batch-apply-service";
import type { AiPicksRunResult } from "@/lib/ai/ai-picks-run-service";
import { CHUNKED_REDRAFT_TOPUP_CONFIRM_TOKEN, runChunkedRedraftTopup } from "@/lib/ai/chunked-redraft-topup-service";
import { applySeasonEndContractTick, previewSeasonEndContracts } from "@/lib/contracts/contract-renewal-service";
import type { GameState, Player, RosterEntry, TeamControlSettings, TransferHistoryEntry } from "@/lib/data/olyDataTypes";
import { FACILITY_CATALOG } from "@/lib/facilities/facility-catalog";
import { getFacilityEfficiency, getFacilityLevel, getTeamFacilityState } from "@/lib/facilities/facility-effects";
import { applyFacilitySeasonEndFinance, previewFacilitySeasonEndFinance } from "@/lib/facilities/facility-season-end-service";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { deriveRosterTargets, getTeamPlayerMax } from "@/lib/foundation/roster-limits";
import {
  countSeasonBuyTransfers,
  findSeasonOneForbiddenBuySources,
  formatSeasonTransferCountsLabel,
  isMarketBuyTransferEntry,
  isSeasonOne,
  isTransferActionAllowed,
} from "@/lib/season/transfer-season-policy";
import { isDraftBuySource } from "@/lib/season/transfer-standings-balance";
import { buildTeamControlSettingsMap } from "@/lib/foundation/team-control-settings";
import { isVdWomenOnlyEligiblePlayer } from "@/lib/ai/team-theme-composition-service";
import {
  createLocalTransfermarktRunContext,
  executeLocalTransfermarktSell,
  flushLocalTransfermarktRunContext,
} from "@/lib/market/transfermarkt-local-service";
import { loadLocalLegacyLineupContext, loadLocalLegacyLineupContextFromGameState } from "@/lib/lineups/legacy-lineup-local-service";
import { countSeasonCaptains, SEASON_CAPTAIN_SLOTS } from "@/lib/lineups/lineup-discipline-contract";
import { buildPlayerMoraleAudit } from "@/lib/morale/player-morale-service";
import {
  buildPlayerAvailabilityByPlayerId,
  collectTeamFatigueInjuryMetrics,
  countSeasonInjuryEvents,
} from "@/lib/season/long-run-fatigue-collect";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { getDatabase } from "@/lib/persistence/sqlite";
import { SEASON_START_RESET_CONFIRM_TOKEN } from "@/lib/persistence/season-start-reset-contract";
import { runSeasonStartReset } from "@/lib/persistence/season-start-reset-service";
import { withScenarioMeta } from "@/lib/persistence/scenario-meta";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";
import { runSeasonEndProgressionBatch } from "@/lib/progression/season-end-progression-batch";
import { APPLY_CONFIRM_TOKEN, LegacyMatchdayResultApplyService } from "@/lib/resolve/legacy-matchday-result-apply-service";
import { ADVANCE_MATCHDAY_CONFIRM_TOKEN, executeMatchdayAdvance } from "@/lib/season/matchday-progress-service";
import { applyPreSeasonNextSeasonSetupLightweight, buildPreSeasonNextSeasonSetupToken } from "@/lib/season/preseason-workflow-service";
import { previewCashPrizeApply } from "@/lib/season/cash-prize-apply-service";
import { buildSeasonReview } from "@/lib/season/season-review-service";
import { applySponsorSettlement } from "@/lib/sponsor/sponsor-settlement-service";
import { executeStandingsApply, STANDINGS_APPLY_CONFIRM_TOKEN } from "@/lib/standings/standings-apply-service";
import { buildTransferFinanceAudit, isTransferFinanceViolationForSeason } from "@/lib/season/transfer-finance-audit";
import {
  applyCanonicalManagerPlan,
  getAllTeamsBelowMinIds,
  repairSeasonOneEndRosterBeforeS2,
  resolveEmergencyRepairTeamIds,
  runCanonicalSeasonOneDraftPhase,
  finalizeSeasonOneDraftAuditReady,
  finalizeSeasonOneBootstrapPhase,
  backfillMissingPlayerTrainingModes,
  normalizeGeneralManagers,
  backfillMissingPlayerTrainingClasses,
} from "@/lib/season/long-run-canonical";
import {
  getLongRunPlannerMaxLeagueRounds,
  getLongRunPlannerMaxTeamCycles,
  isLongRunAllowDevServer,
  isLongRunRequireNoDevServer,
} from "@/lib/season/long-run-profile";
import { getTeamsNeedingTransferBudgetDeploy } from "@/lib/ai/ai-budget-deploy-service";
import { runPreseasonProactiveCashRecovery } from "@/lib/ai/preseason-cash-recovery-service";
import {
  assertPhaseAuditNoRed,
  runPhaseAuditDe,
  type LongRunPhaseAuditContext,
  type LongRunPhaseAuditPhase,
  type PhaseAuditResult,
} from "@/lib/season/long-run-phase-audit";
import {
  isExpectedSeasonOneMarketRosterBlocker,
  isSoftLongRunBlocker,
  isSoftOpenTechnicalBug,
} from "@/lib/season/long-run-soft-blockers";
import { buildPhaseFeedbackMarkdownDe, printPhaseFeedbackDe } from "@/lib/season/long-run-phase-feedback";

const PROJECT_ROOT = path.resolve(__dirname, "..");
const OUTPUT_DIR =
  process.env.OLY_LONG_RUN_OUTPUT_DIR ??
  "/Users/chrisfalk/Documents/Codex/2026-06-11/wir-machen-weiter-mit-dem-olympiade/outputs";
const TARGET_FINAL_SEASON = Number(process.env.OLY_LONG_RUN_FINAL_SEASON ?? 6);
const RUN_LABEL = process.env.OLY_LONG_RUN_LABEL ?? `Long Run Sandbox S1-S${TARGET_FINAL_SEASON}`;
const RESUME_SAVE_ID = process.env.OLY_LONG_RUN_SAVE_ID ?? null;
const FULL_CHURN_STRESS_MODE = process.env.OLY_FULL_CHURN_STRESS_MODE === "true";
const LONG_RUN_DEV_SERVER_URL = (process.env.OLY_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const LONG_RUN_REQUIRE_NO_DEV_SERVER = isLongRunRequireNoDevServer();
const LONG_RUN_ALLOW_DEV_SERVER = isLongRunAllowDevServer();
const LONG_RUN_PLANNER_MAX_LEAGUE_ROUNDS = getLongRunPlannerMaxLeagueRounds();
const LONG_RUN_PLANNER_MAX_TEAM_CYCLES = getLongRunPlannerMaxTeamCycles();
const LONG_RUN_SKIP_LINEUP_REAPPLY = process.env.OLY_LONG_RUN_SKIP_LINEUP_REAPPLY === "1";
const LONG_RUN_STOP_AFTER =
  process.env.OLY_LONG_RUN_STOP_AFTER === "draft" || process.env.OLY_LONG_RUN_STOP_AFTER === "season_end"
    ? process.env.OLY_LONG_RUN_STOP_AFTER
    : null;
const SUMMARY_ONLY = process.argv.includes("--summary-only");

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
  draftBuyCount: number;
  marketBuyCount: number;
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

function formatSeasonAuditTransferSummary(entry: SeasonAudit): string {
  const label = formatSeasonTransferCountsLabel(
    entry.seasonId,
    { draftBuyCount: entry.draftBuyCount, marketBuyCount: entry.marketBuyCount },
    { sellCount: entry.sellCount, exitCount: entry.contractExitCount, style: "recap" },
  );
  return `${label} (${entry.transferCount} gesamt)`;
}

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

function appendCsvRows(fileName: string, rows: Array<Record<string, unknown>>, preferredHeaders: string[] = []) {
  if (rows.length === 0) {
    return;
  }

  ensureOutputDir();
  const filePath = path.join(OUTPUT_DIR, fileName);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const headers = preferredHeaders.length
    ? preferredHeaders
    : Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const body = rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")).join("\n");
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, `${headers.join(",")}\n${body}\n`, "utf8");
    return;
  }

  fs.appendFileSync(filePath, `${body}\n`, "utf8");
}

function flushSeasonRowBuffers(input: {
  seasonId: string;
  economyRows: Record<string, unknown>[];
  rosterRows: Record<string, unknown>[];
  aiMarketRows: Record<string, unknown>[];
  contractExitRows: Record<string, unknown>[];
  renewalRows: Record<string, unknown>[];
  buildingsRows: Record<string, unknown>[];
  moraleBoardTrustRows: Record<string, unknown>[];
  marketValueSalaryRows: Record<string, unknown>[];
  fatigueRows: Record<string, unknown>[];
  playerDevelopmentRows: Record<string, unknown>[];
  medalRows: Record<string, unknown>[];
  matchdayRows: Record<string, unknown>[];
  performanceRows: PhaseMetric[];
  economyStart: number;
  rosterStart: number;
  aiMarketStart: number;
  contractExitStart: number;
  renewalStart: number;
  buildingsStart: number;
  moraleBoardTrustStart: number;
  marketValueSalaryStart: number;
  fatigueStart: number;
  playerDevelopmentStart: number;
  medalStart: number;
  matchdayStart: number;
  performanceStart: number;
}) {
  const seasonEconomyRows = input.economyRows.splice(input.economyStart);
  const seasonRosterRows = input.rosterRows.splice(input.rosterStart);
  const seasonAiMarketRows = input.aiMarketRows.splice(input.aiMarketStart);
  const seasonContractExitRows = input.contractExitRows.splice(input.contractExitStart);
  const seasonRenewalRows = input.renewalRows.splice(input.renewalStart);
  const seasonBuildingsRows = input.buildingsRows.splice(input.buildingsStart);
  const seasonMoraleRows = input.moraleBoardTrustRows.splice(input.moraleBoardTrustStart);
  const seasonMarketValueSalaryRows = input.marketValueSalaryRows.splice(input.marketValueSalaryStart);
  const seasonFatigueRows = input.fatigueRows.splice(input.fatigueStart);
  const seasonPlayerDevelopmentRows = input.playerDevelopmentRows.splice(input.playerDevelopmentStart);
  const seasonMedalRows = input.medalRows.splice(input.medalStart);
  const seasonMatchdayRows = input.matchdayRows.splice(input.matchdayStart);
  const seasonPerformanceRows = input.performanceRows.splice(input.performanceStart);

  appendCsvRows("economy-cash-flow-s1-s6.csv", seasonEconomyRows);
  appendCsvRows("roster-size-s1-s6.csv", seasonRosterRows);
  appendCsvRows("ai-market-actions-s1-s6.csv", seasonAiMarketRows);
  appendCsvRows("contract-exits-s1-s6.csv", seasonContractExitRows);
  appendCsvRows("renewals-s1-s6.csv", seasonRenewalRows);
  appendCsvRows("buildings-ai-s1-s6.csv", seasonBuildingsRows);
  appendCsvRows("morale-boardtrust-s1-s6.csv", seasonMoraleRows);
  appendCsvRows("marketvalue-salary-s1-s6.csv", seasonMarketValueSalaryRows);
  appendCsvRows("fatigue-injury-s1-s6.csv", seasonFatigueRows);
  appendCsvRows("player-development-s1-s6.csv", seasonPlayerDevelopmentRows);
  appendCsvRows("season-history-medals-s1-s6.csv", seasonMedalRows);
  appendCsvRows("long-run-matchdays-s1-s6.csv", seasonMatchdayRows);
  appendCsvRows("performance-longrun-s1-s6.csv", seasonPerformanceRows);
  appendCsvRows(`long-run-by-season/${input.seasonId}-performance.csv`, seasonPerformanceRows);
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function buildCashEconomyAudit(gameState: GameState) {
  const cashPrizeLogs = gameState.seasonState.cashPrizeApplyLogs ?? [];
  const sponsorLogs = gameState.seasonState.sponsorPayoutLogs ?? [];
  const cashValues = gameState.teams.map((team) => team.cash);
  const violations: string[] = [];
  if (cashPrizeLogs.some((log) => log.action === "apply")) {
    violations.push("cash_prize_apply_executed");
  }
  const baseFirstLogs = sponsorLogs.filter((log) => log.phase === "base_first");
  if (baseFirstLogs.length > 0) {
    violations.push(`sponsor_base_first_executed:${baseFirstLogs.length}`);
  }
  const seasonEndLogs = sponsorLogs.filter((log) => log.phase === "season_end");
  const seasonsWithEnd = new Set(seasonEndLogs.map((log) => log.seasonId));
  const cashPrizeBySeason = Object.fromEntries(
    [...new Set(cashPrizeLogs.map((log) => log.seasonId))].map((seasonId) => [
      seasonId,
      {
        applyLogs: cashPrizeLogs.filter((log) => log.seasonId === seasonId && log.action === "apply").length,
        totalPrizeMoney: cashPrizeLogs
          .filter((log) => log.seasonId === seasonId && log.action === "apply")
          .reduce((sum, log) => sum + Number((log.payload as { totalPrizeMoney?: number })?.totalPrizeMoney ?? 0), 0),
      },
    ]),
  );
  const sponsorBySeasonPhase = Object.fromEntries(
    [...new Set(sponsorLogs.map((log) => `${log.seasonId}:${log.phase}`))].map((key) => {
      const [seasonId, phase] = key.split(":");
      const rows = sponsorLogs.filter((log) => log.seasonId === seasonId && log.phase === phase);
      return [
        key,
        {
          seasonId,
          phase,
          count: rows.length,
          totalCashDelta: round(rows.reduce((sum, log) => sum + log.cashDelta, 0)),
        },
      ];
    }),
  );
  return {
    violations,
    cashPrizeBySeason,
    sponsorBySeasonPhase,
    seasonsWithSponsorEndSettlement: [...seasonsWithEnd],
    leagueCash: {
      min: cashValues.length ? Math.min(...cashValues) : 0,
      max: cashValues.length ? Math.max(...cashValues) : 0,
      avg: cashValues.length ? round(cashValues.reduce((sum, value) => sum + value, 0) / cashValues.length) : 0,
    },
  };
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

// Guards against resuming a save whose Season-1 roster was seeded for free (e.g. the
// full-season-ui-playthrough harness pushes rosters via topUpRostersForLineups without
// deducting cash or writing transfer history). The real draft (runAiPicksExecutePreview /
// season1_optimum_execute) writes one transfer-history acquisition per pick and deducts
// cash, so a paid S1 has acquisition coverage close to its roster count. A free-seeded
// S1 has near-zero coverage.
function assertResumedSeasonOnePaid(save: PersistedSaveGame) {
  const state = save.gameState;
  if (state.season.id !== "season-1") {
    return;
  }
  const rosterCount = state.rosters.length;
  if (rosterCount === 0) {
    return;
  }
  const acquisitionCount = state.transferHistory.filter((entry) => Boolean(entry.toTeamId)).length;
  const acquisitionCoverage = rosterCount > 0 ? acquisitionCount / rosterCount : 1;
  const totalBudget = state.teams.reduce((sum, team) => sum + (team.budget ?? 0), 0);
  const totalCash = state.teams.reduce((sum, team) => sum + (team.cash ?? 0), 0);
  const totalSpent = Math.round((totalBudget - totalCash) * 100) / 100;

  if (acquisitionCoverage < 0.5) {
    throw new Error(
      `Resume blocked: Season-1 roster appears free-seeded (rosters=${rosterCount}, ` +
        `acquisitions=${acquisitionCount}, coverage=${acquisitionCoverage.toFixed(2)}, ` +
        `totalSpent=${totalSpent}). The long-run must draft S1 via the real cash path. ` +
        `Re-run without OLY_LONG_RUN_SAVE_ID to start a fresh, paid S1 draft, or resume only ` +
        `saves whose S1 draft was paid (cash deducted + a transfer-history entry per pick).`,
    );
  }
}

function runPhaseCheckpoint(
  saveId: string,
  persistence: PersistenceService,
  phase: LongRunPhaseAuditPhase,
  context: LongRunPhaseAuditContext = {},
): { save: PersistedSaveGame; audit: PhaseAuditResult } {
  ensureOutputDir();
  let save = persistence.getSaveById(saveId);
  if (!save) throw new Error(`Long-run save missing for phase checkpoint ${phase}.`);
  if (phase === "season_end") {
    const lastMatchdayId = save.gameState.season.matchdayIds.at(-1);
    const hasLastMatchdayResult =
      Boolean(lastMatchdayId) &&
      (save.gameState.seasonState.matchdayResults ?? []).some(
        (result) => result.seasonId === save.gameState.season.id && result.matchdayId === lastMatchdayId,
      );
    if (hasLastMatchdayResult && (save.gameState.gamePhase ?? "") !== "season_completed") {
      persistence.saveSingleplayerState(saveId, {
        ...save.gameState,
        gamePhase: "season_completed",
        matchdayState: {
          ...save.gameState.matchdayState,
          matchdayId: lastMatchdayId ?? save.gameState.matchdayState.matchdayId,
          status: "resolved",
          pendingTeamIds: [],
          resolvedFixtureIds: [],
        },
      });
      save = persistence.getSaveById(saveId) ?? save;
    }
  }
  const audit = runPhaseAuditDe(save, phase, context);
  printPhaseFeedbackDe({ save, phase, audit, picksRun: context.picksRun });
  const feedbackPath = path.join(OUTPUT_DIR, `long-run-feedback-${phase}-${save.saveId}.md`);
  const auditJsonPath = path.join(OUTPUT_DIR, `long-run-audit-${phase}-${save.saveId}.json`);
  const auditMdPath = path.join(OUTPUT_DIR, `long-run-audit-${phase}-${save.saveId}.md`);
  fs.writeFileSync(feedbackPath, buildPhaseFeedbackMarkdownDe({ save, phase, audit, picksRun: context.picksRun }));
  fs.writeFileSync(auditJsonPath, JSON.stringify(audit, null, 2));
  fs.writeFileSync(
    auditMdPath,
    [`# Long-Run Audit · ${phase} · ${save.gameState.season.id}`, "", buildPhaseFeedbackMarkdownDe({ save, phase, audit, picksRun: context.picksRun })].join("\n"),
  );
  assertPhaseAuditNoRed(audit);
  return { save, audit };
}

async function runCanonicalPreseasonStart(saveId: string, seasonId: string, persistence: PersistenceService) {
  let save = persistence.getSaveById(saveId);
  if (!save) throw new Error("Long-run save missing before canonical preseason start.");
  save = normalizeGeneralManagers(save, persistence);
  const performanceRows: PhaseMetric[] = [];
  const managerStartedAt = Date.now();
  const manager = applyCanonicalManagerPlan(save, persistence, `preseason_${seasonId}`);
  save = manager.save;
  recordPhase(performanceRows, {
    seasonId,
    phase: "canonical manager preseason",
    startedAt: managerStartedAt,
    itemCount: manager.appliedActions,
    status: manager.blockers.length > 0 ? "blocked" : "ok",
    warnings: manager.warnings.slice(0, 20).join("|"),
    note: `actions:${manager.appliedActions}`,
  });

  const plannerConvergence = await runPreseasonPlannerConvergenceBeforeEmergencyRepair(saveId, seasonId, persistence);
  performanceRows.push(...plannerConvergence.performanceRows);

  const rosterRepair = emergencyRepairRosterMinimumBeforeSeasonStart(
    saveId,
    seasonId,
    persistence,
    plannerConvergence.emergencyRepairTeams,
  );
  performanceRows.push(...rosterRepair.performanceRows);

  save = persistence.getSaveById(saveId) ?? save;
  let slotHardUnresolved = 0;
  let slotCoverageWarnings = 0;
  const captainAutoFixRows: Array<Record<string, unknown>> = [];
  const slotCoverageRows: Array<Record<string, unknown>> = [];
  if (save.gameState.matchdayState.matchdayId === save.gameState.season.matchdayIds[0]) {
    const startedAt = Date.now();
    prepSeasonLineups(saveId, seasonId);
    recordPhase(performanceRows, {
      seasonId,
      phase: "season start lineup/autoprep",
      startedAt,
      itemCount: save.gameState.teams.length,
      status: "ok",
    });
    captainAutoFixRows.push(...autoFixCaptainsAfterAutoprep(saveId, seasonId, persistence));
    slotCoverageRows.push(...auditSlotCoverageAfterAutoprep(saveId, seasonId, persistence));
    slotHardUnresolved = slotCoverageRows.filter((row) => row.status === "hard_unresolved").length;
    slotCoverageWarnings = slotCoverageRows.filter((row) => row.status === "warning").length;
  }

  save = persistence.getSaveById(saveId) ?? save;
  const trainingBackfill = backfillMissingPlayerTrainingModes(save, persistence);
  if (trainingBackfill.appliedPlayers > 0) {
    recordPhase(performanceRows, {
      seasonId,
      phase: "preseason training mode backfill",
      startedAt: Date.now(),
      itemCount: trainingBackfill.appliedPlayers,
      status: "ok",
      note: `default_mittel:${trainingBackfill.appliedPlayers}`,
    });
    save = trainingBackfill.save;
  }
  save = persistence.getSaveById(saveId) ?? save;
  const classBackfill = backfillMissingPlayerTrainingClasses(save, persistence);
  if (classBackfill.appliedPlayers > 0) {
    recordPhase(performanceRows, {
      seasonId,
      phase: "preseason training class backfill",
      startedAt: Date.now(),
      itemCount: classBackfill.appliedPlayers,
      status: "ok",
      note: `default_className:${classBackfill.appliedPlayers}`,
    });
    save = classBackfill.save;
  }

  return {
    performanceRows,
    blockers: [...manager.blockers, ...rosterRepair.blockers],
    warnings: [...manager.warnings, ...plannerConvergence.warnings, ...rosterRepair.warnings],
    purchases: rosterRepair.purchases,
    slotHardUnresolved,
    slotCoverageWarnings,
    captainAutoFixRows,
    slotCoverageRows,
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
  return getTeamsNeedingConvergence(gameState).map((entry) => {
    const team = gameState.teams.find((row) => row.teamId === entry.teamId);
    const identity = gameState.teamIdentities.find((row) => row.teamId === entry.teamId);
    const roster = gameState.rosters.filter((row) => row.teamId === entry.teamId);
    return { team: team!, roster, identity, ...entry };
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

async function runPreseasonPlannerConvergenceBeforeEmergencyRepair(
  saveId: string,
  seasonId: string,
  persistence: PersistenceService,
) {
  const performanceRows: PhaseMetric[] = [];
  const save = persistence.getSaveById(saveId);
  if (!save) throw new Error("Long-run save missing before preseason planner convergence.");
  const coverageRiskRows = getPreseasonCoverageRiskRows(save.gameState);
  const deployTeams = getTeamsNeedingTransferBudgetDeploy(save.gameState, seasonId);
  const existingMarketTransfers = getExistingPreseasonMarketTransfers(save.gameState, seasonId).filter(
    (entry) => entry.source === "ai_preseason_market_buy" || entry.source === "ai_preseason_market_sell",
  );
  if (existingMarketTransfers.length > 0) {
    recordPhase(performanceRows, {
      seasonId,
      phase: "season start planner convergence",
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
      warnings: [`preseason_planner_convergence_skipped_existing_market_transfers:${existingMarketTransfers.length}`],
      emergencyRepairTeams: [] as string[],
    };
  }
  if (coverageRiskRows.length === 0 && deployTeams.length === 0) {
    return { performanceRows, reviewed: false, warnings: [] as string[], emergencyRepairTeams: [] as string[] };
  }

  const startedAt = Date.now();
  console.error(
    `[long-run] planner-convergence ${seasonId}: ${coverageRiskRows
      .map(({ team, rosterCount, optTarget, strategy }) => `${team.shortCode}:${rosterCount}/${optTarget}:${strategy}`)
      .join(",")}`,
  );
  const convergence = await runTransferWindowSession({
    saveId,
    seasonId,
    persistence,
    phase: "preseason",
    dryRun: false,
    confirmToken: AI_MARKET_APPLY_CONFIRM_TOKEN,
    transferPhase: "manual_transfer_window",
    teamScope: "all",
    maxTeamCycles: LONG_RUN_PLANNER_MAX_TEAM_CYCLES,
    maxLeagueRounds: LONG_RUN_PLANNER_MAX_LEAGUE_ROUNDS,
    allowBuys: true,
    skipIfExistingMarketTransfers: false,
    progressLog: false,
  });
  const latest = persistence.getSaveById(saveId);
  if (!latest) throw new Error("Long-run save missing after preseason planner convergence.");
  const stillBelowMin = getPreseasonCoverageRiskRows(latest.gameState);
  const stillNeedDeploy = getTeamsNeedingTransferBudgetDeploy(latest.gameState, seasonId);
  const warnings = [
    ...convergence.warnings.slice(0, 20),
    ...convergence.blockingReasons.map((entry) => `planner_convergence_blocker:${entry}`),
    stillBelowMin.length > 0 ? `planner_convergence_still_coverage_risk:${stillBelowMin.length}` : null,
    stillNeedDeploy.length > 0 ? `planner_convergence_still_needs_deploy:${stillNeedDeploy.length}` : null,
    convergence.emergencyRepairTeams.length > 0
      ? `planner_convergence_emergency_repair_teams:${convergence.emergencyRepairTeams.length}`
      : null,
  ].filter((entry): entry is string => Boolean(entry));
  recordPhase(performanceRows, {
    seasonId,
    phase: "season start planner convergence",
    startedAt,
    itemCount: convergence.appliedBuys + convergence.appliedSells,
    status: "ok",
    buyApplyCount: convergence.appliedBuys,
    sellApplyCount: convergence.appliedSells,
    warnings: warnings.join("|"),
    note: `passes:${convergence.passes}|rounds:${convergence.rounds}|coverageRiskBefore:${coverageRiskRows.length}|coverageRiskAfter:${stillBelowMin.length}|emergency:${convergence.emergencyRepairTeams.length}`,
  });
  return {
    performanceRows,
    reviewed: true,
    warnings,
    emergencyRepairTeams: convergence.emergencyRepairTeams,
  };
}

function emergencyRepairRosterMinimumBeforeSeasonStart(
  saveId: string,
  seasonId: string,
  persistence: PersistenceService,
  teamIds: string[],
) {
  const performanceRows: PhaseMetric[] = [];
  const save = persistence.getSaveById(saveId);
  if (!save) throw new Error("Long-run save missing before emergency roster repair.");
  const effectiveSeasonId = save.gameState.season.id;
  const uniqueTeamIds = resolveEmergencyRepairTeamIds(save.gameState, teamIds);
  if (uniqueTeamIds.length === 0) {
    return { performanceRows, blockers: [] as string[], warnings: [] as string[], purchases: [] as Array<Record<string, unknown>>, repaired: false };
  }
  if (!isTransferActionAllowed(effectiveSeasonId, "preseason_roster_repair")) {
    const belowMinIds = getAllTeamsBelowMinIds(save.gameState);
    const warnings = belowMinIds.map((teamId) => `roster_hard_gate_repair_forbidden:${effectiveSeasonId}:${teamId}`);
    recordPhase(performanceRows, {
      seasonId: effectiveSeasonId,
      phase: "season start emergency roster repair",
      startedAt: Date.now(),
      itemCount: 0,
      status: warnings.length > 0 ? "skipped" : "ok",
      note: `repair_forbidden:${effectiveSeasonId}|requested:${seasonId}|belowMin:${belowMinIds.length}`,
      warnings: warnings.join("|"),
    });
    return { performanceRows, blockers: [] as string[], warnings, purchases: [] as Array<Record<string, unknown>>, repaired: false };
  }
  const startedAt = Date.now();
  console.error(`[long-run] emergency-roster-repair ${effectiveSeasonId}: ${uniqueTeamIds.join(",")}`);
  let result: ReturnType<typeof runEmergencyRosterRepairForTeams> = {
    repaired: false,
    teamIds: [],
    purchases: [],
    blockers: [],
    warnings: [],
  };
  let repairTeamIds = uniqueTeamIds;
  const allPurchases: Array<Record<string, unknown>> = [];
  const allWarnings: string[] = [];
  try {
    for (let attempt = 0; attempt < 3 && repairTeamIds.length > 0; attempt += 1) {
      result = runEmergencyRosterRepairForTeams({
        saveId,
        seasonId: effectiveSeasonId,
        teamIds: repairTeamIds,
        persistence,
        outputDir: path.join(OUTPUT_DIR, `preseason-emergency-roster-repair-${effectiveSeasonId}`),
        convergenceExhaustedTeamIds: teamIds.filter(Boolean),
      });
      allPurchases.push(...result.purchases);
      allWarnings.push(...result.warnings);
      const mid = persistence.getSaveById(saveId);
      if (!mid) throw new Error("Long-run save missing during emergency roster repair retry.");
      repairTeamIds = getAllTeamsBelowMinIds(mid.gameState);
      if (repairTeamIds.length === 0) break;
      console.error(
        `[long-run] emergency-roster-repair retry ${attempt + 2}/3 ${effectiveSeasonId}: ${repairTeamIds.join(",")}`,
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    recordPhase(performanceRows, {
      seasonId: effectiveSeasonId,
      phase: "season start emergency roster repair",
      startedAt,
      itemCount: 0,
      status: "blocked",
      errors: message,
      note: `requested:${seasonId}`,
    });
    return {
      performanceRows,
      blockers: [`emergency_roster_repair_failed:${message}`],
      warnings: [] as string[],
      purchases: [] as Array<Record<string, unknown>>,
      repaired: false,
    };
  }
  const after = persistence.getSaveById(saveId);
  if (!after) throw new Error("Long-run save missing after emergency roster repair.");
  const stillBelowMinIds = getAllTeamsBelowMinIds(after.gameState);
  const negativeCash = after.gameState.teams
    .filter((team) => team.cash < 0)
    .map((team) => ({ teamId: team.teamId, teamName: team.name, cash: round(team.cash) }));
  const blockers = [
    ...result.blockers,
    ...stillBelowMinIds.map((teamId) => `roster_hard_gate_below_min:${teamId}`),
    ...negativeCash.map((row) => `emergency_roster_repair_negative_cash:${row.teamId}:${row.cash}`),
  ];
  const warnings = [...new Set([...allWarnings, ...result.warnings].slice(0, 20))];
  recordPhase(performanceRows, {
    seasonId: effectiveSeasonId,
    phase: "season start emergency roster repair",
    startedAt,
    itemCount: allPurchases.length,
    status: blockers.length > 0 ? "blocked" : "ok",
    buyApplyCount: allPurchases.length,
    warnings: warnings.join("|"),
    errors: blockers.join("|"),
    note: `emergency_fallback:true|teams:${uniqueTeamIds.length}|stillBelowMin:${stillBelowMinIds.length}`,
  });
  return { performanceRows, blockers, warnings, purchases: allPurchases, repaired: result.repaired };
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
      "S1-Roster-Fill nutzt runAiPicksExecutePreview (season1_optimum_execute, frozen plannedPicks); Legacy chunked topup nur im Full-Churn-Stress.",
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
  execFileSync(process.execPath, ["--import", "tsx", path.join(PROJECT_ROOT, "scripts/season1-autoprep.ts"), "--write"], {
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

type SlotCoverageStatus = "ready" | "warning" | "hard_unresolved";

function assessTeamSlotCoverageRow(input: {
  save: PersistedSaveGame;
  saveId: string;
  seasonId: string;
  matchdayId: string;
  team: GameState["teams"][number];
}): Record<string, unknown> {
  const { save, saveId, seasonId, matchdayId, team } = input;
  const contextResult = loadLocalLegacyLineupContextFromGameState(save.gameState, {
    saveId,
    seasonId,
    matchdayId,
    teamId: team.teamId,
  });
  if (!contextResult.ok) {
    return {
      seasonId,
      matchdayId,
      teamId: team.teamId,
      teamName: team.name,
      status: "hard_unresolved" satisfies SlotCoverageStatus,
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
    };
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
  const requiredSlots = sides.reduce((sum, side) => sum + side.requiredPlayers, 0);
  const rosterLimitedMissing = Math.max(0, requiredSlots - context.activePlayers.length);
  const reasons = [
    duplicateConflicts > 0 ? "duplicate_conflict" : null,
    formCardInvalid > 0 ? "form_card_invalid" : null,
  ].filter((entry): entry is string => Boolean(entry));
  const warningReasons = [
    missingSlots > 0 ? "missing_slots" : null,
    captainMissing > 0 ? "captain_missing" : null,
    rosterLimitedMissing > 0 ? "under_slot_depth" : null,
  ].filter((entry): entry is string => Boolean(entry));
  const status: SlotCoverageStatus = reasons.length > 0 ? "hard_unresolved" : warningReasons.length > 0 ? "warning" : "ready";
  return {
    seasonId,
    matchdayId,
    teamId: team.teamId,
    teamName: team.name,
    status,
    reason: reasons.join("|") || "ready",
    warningReason: warningReasons.join("|"),
    missingSlots,
    rosterLimitedMissing,
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
  };
}

function canReuseAutoprepLineupsForMatchday(input: {
  save: PersistedSaveGame;
  saveId: string;
  seasonId: string;
  matchdayId: string;
}): { skipLineupReapply: boolean; hardUnresolvedTeams: number; warningTeams: number } {
  let hardUnresolvedTeams = 0;
  let warningTeams = 0;
  for (const team of input.save.gameState.teams) {
    const row = assessTeamSlotCoverageRow({
      save: input.save,
      saveId: input.saveId,
      seasonId: input.seasonId,
      matchdayId: input.matchdayId,
      team,
    });
    if (row.status === "hard_unresolved") {
      hardUnresolvedTeams += 1;
    } else if (row.status === "warning") {
      warningTeams += 1;
    }
  }
  return {
    skipLineupReapply: hardUnresolvedTeams === 0,
    hardUnresolvedTeams,
    warningTeams,
  };
}

function auditSlotCoverageAfterAutoprep(saveId: string, seasonId: string, persistence: PersistenceService) {
  const save = persistence.getSaveById(saveId);
  if (!save) throw new Error("Long-run save disappeared during slot coverage audit.");
  const startedAt = Date.now();
  const rows: Array<Record<string, unknown>> = [];
  for (const [matchdayIndex, matchdayId] of save.gameState.season.matchdayIds.entries()) {
    const matchdayStartedAt = Date.now();
    for (const team of save.gameState.teams) {
      rows.push(
        assessTeamSlotCoverageRow({
          save,
          saveId,
          seasonId,
          matchdayId,
          team,
        }),
      );
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

function hasMatchdayResult(gameState: GameState, seasonId: string, matchdayId: string) {
  return (gameState.seasonState.matchdayResults ?? []).some(
    (entry) => entry.seasonId === seasonId && entry.matchdayId === matchdayId,
  );
}

function findFirstUnresolvedMatchdayId(gameState: GameState) {
  const seasonId = gameState.season.id;
  for (const matchdayId of gameState.season.matchdayIds) {
    if (!hasMatchdayResult(gameState, seasonId, matchdayId)) return matchdayId;
  }
  return null;
}

function syncStaleMatchdayPointerIfNeeded(
  saveId: string,
  persistence: PersistenceService,
  seasonId: string,
  expectedMatchdayId: string,
) {
  const save = persistence.getSaveById(saveId);
  if (!save) return false;
  const { matchdayIds } = save.gameState.season;
  const activeMatchdayId = save.gameState.matchdayState.matchdayId;
  if (activeMatchdayId === expectedMatchdayId) return true;
  const activeIndex = matchdayIds.indexOf(activeMatchdayId);
  const expectedIndex = matchdayIds.indexOf(expectedMatchdayId);
  if (activeIndex < 0 || expectedIndex < 0 || expectedIndex <= activeIndex) return false;
  for (let index = activeIndex; index < expectedIndex; index += 1) {
    const matchdayId = matchdayIds[index];
    if (!hasMatchdayResult(save.gameState, seasonId, matchdayId)) return false;
  }
  persistence.saveSingleplayerState(saveId, {
    ...save.gameState,
    season: {
      ...save.gameState.season,
      currentMatchday: expectedIndex + 1,
    },
    matchdayState: {
      ...save.gameState.matchdayState,
      matchdayId: expectedMatchdayId,
      status: "planning",
    },
  });
  console.error(`[long-run] synced stale matchday pointer ${activeMatchdayId} -> ${expectedMatchdayId}`);
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
  const loopStartMatchdayId =
    (initialSave ? findFirstUnresolvedMatchdayId(initialSave.gameState) : null) ??
    initialSave?.gameState.matchdayState.matchdayId;
  const startIndex = Math.max(
    0,
    initialSave?.gameState.season.matchdayIds.findIndex((entry) => entry === loopStartMatchdayId) ?? 0,
  );
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
      if (!syncStaleMatchdayPointerIfNeeded(saveId, persistence, seasonId, matchdayId)) {
        blockers.push(`active_matchday_mismatch:${seasonId}:${activeMatchdayId}:${matchdayId}`);
        break;
      }
    }
    const matchdayStartedAt = Date.now();
    let startedAt = Date.now();
    const lineupReuse = LONG_RUN_SKIP_LINEUP_REAPPLY
      ? canReuseAutoprepLineupsForMatchday({
          save: currentSave,
          saveId,
          seasonId,
          matchdayId,
        })
      : { skipLineupReapply: false, hardUnresolvedTeams: 0, warningTeams: 0 };
    if (lineupReuse.skipLineupReapply) {
      console.error(
        `[long-run] lineup-skip ${seasonId} ${matchdayId}: reuse autoprep (warnings=${lineupReuse.warningTeams})`,
      );
      recordPhase(performanceRows, {
        seasonId,
        matchdayId,
        phase: "matchday lineup generation + save",
        startedAt,
        itemCount: currentSave.gameState.teams.length,
        status: "ok",
        note: `skipped_autoprep_reuse|warningTeams:${lineupReuse.warningTeams}`,
      });
    } else {
      console.error(
        `[long-run] lineup-reapply ${seasonId} ${matchdayId}: hardUnresolved=${lineupReuse.hardUnresolvedTeams}`,
      );
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

function repairVdWomenOnlyIdentityViolations(saveId: string, seasonId: string, persistence: PersistenceService) {
  const performanceRows: PhaseMetric[] = [];
  const blockers: string[] = [];
  const startedAt = Date.now();
  let save = persistence.getSaveById(saveId);
  if (!save) throw new Error("Long-run save disappeared before V-D identity repair.");
  const vd = save.gameState.teams.find((team) => team.shortCode === "V-D");
  if (!vd) return { performanceRows, blockers, sales: 0 };

  const playerById = new Map(save.gameState.players.map((player) => [player.id, player]));
  const violatingPlayers = save.gameState.rosters
    .filter((entry) => entry.teamId === vd.teamId)
    .map((entry) => playerById.get(entry.playerId))
    .filter((player): player is Player => Boolean(player && !isVdWomenOnlyEligiblePlayer(player)));
  if (violatingPlayers.length === 0) {
    return { performanceRows, blockers, sales: 0 };
  }

  console.error(
    `[long-run] identity-repair ${seasonId} V-D: sell ${violatingPlayers.map((player) => player.name).join(", ")}`,
  );
  const runContext = createLocalTransfermarktRunContext({ save, persistence });
  let sales = 0;
  for (const player of violatingPlayers) {
    const rosterEntry = runContext.save.gameState.rosters.find(
      (entry) => entry.teamId === vd.teamId && entry.playerId === player.id,
    );
    if (!rosterEntry) continue;
    const result = executeLocalTransfermarktSell({
      saveId,
      seasonId,
      teamId: vd.teamId,
      activePlayerId: rosterEntry.id,
      transferSource: "identity_vd_women_only_repair",
      localRunContext: runContext,
      deferPersist: true,
    });
    if (!result.canSell) {
      blockers.push(`identity_repair_sell_blocked:${player.name}:${result.blockingReasons.join("|")}`);
      continue;
    }
    sales += 1;
  }
  flushLocalTransfermarktRunContext(runContext);
  recordPhase(performanceRows, {
    seasonId,
    phase: "identity V-D women-only repair",
    startedAt,
    itemCount: sales,
    status: blockers.length > 0 ? "blocked" : "ok",
    sellApplyCount: sales,
    note: `violations:${violatingPlayers.length}`,
    errors: blockers.join("|"),
  });
  return { performanceRows, blockers, sales };
}

async function recoverNegativeCashBeforeSeasonStart(saveId: string, seasonId: string, persistence: PersistenceService) {
  const performanceRows: PhaseMetric[] = [];
  const blockers: string[] = [];
  let save = persistence.getSaveById(saveId);
  if (!save) throw new Error("Long-run save disappeared before cash recovery.");

  const proactiveStartedAt = Date.now();
  const proactive = await runPreseasonProactiveCashRecovery({ saveId, seasonId, persistence });
  recordPhase(performanceRows, {
    seasonId,
    phase: "season start proactive cash recovery",
    startedAt: proactiveStartedAt,
    itemCount: proactive.sold,
    status: proactive.blockers.length > 0 ? "blocked" : "ok",
    sellApplyCount: proactive.sold,
    note: [
      `teams:${proactive.teamsAffected}`,
      ...proactive.teamResults.map((row) => `${row.shortCode}:${row.cashBefore}->${row.cashAfter}:${row.sells}`),
    ].join("|"),
    errors: proactive.blockers.join("|"),
  });
  if (proactive.blockers.length > 0) {
    blockers.push(...proactive.blockers);
  }

  save = persistence.getSaveById(saveId);
  if (!save) throw new Error("Long-run save disappeared after proactive cash recovery.");
  const negativeBefore = save.gameState.teams.filter((team) => team.cash < 0);
  if (negativeBefore.length === 0 && proactive.sold === 0) {
    return { performanceRows, blockers, recovered: false };
  }

  console.error(
    `[long-run] cash-recovery ${seasonId}: proactive=${proactive.sold} negative=${negativeBefore.map((team) => team.shortCode).join(",")}`,
  );
  const startedAt = Date.now();
  const emergency =
    negativeBefore.length > 0
      ? emergencyLiquidateNegativeCashTeams(saveId, seasonId, persistence)
      : { performanceRows: [] as PhaseMetric[], blockers: [] as string[], sales: 0 };
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
  return { performanceRows, blockers, recovered: proactive.sold > 0 || negativeBefore.length > 0 };
}


async function applySeasonEnd(saveId: string, persistence: PersistenceService) {
  const rows: Record<string, unknown>[] = [];
  const performanceRows: PhaseMetric[] = [];
  const blockers: string[] = [];
  let save = persistence.getSaveById(saveId);
  if (!save) throw new Error("Long-run save disappeared before season-end.");
  const seasonId = save.gameState.season.id;
  console.error(`[long-run] season-end ${seasonId}: prize-benchmark-preview`);

  let startedAt = Date.now();
  const cashPreview = await previewCashPrizeApply(
    { saveId, seasonId, matchdayId: save.gameState.matchdayState.matchdayId, source: "sqlite", phase: "season_end" },
    persistence,
  );
  const totalPrizeMoney = cashPreview.plannedChanges.reduce((sum, row) => sum + (row.prizeMoney ?? 0), 0);
  if (cashPreview.blockingReasons.length > 0) {
    blockers.push(...cashPreview.blockingReasons.map((entry) => `cash_preview:${entry}`));
  }
  recordPhase(performanceRows, {
    seasonId,
    phase: "season end prize benchmark preview",
    startedAt,
    itemCount: cashPreview.plannedChanges.length,
    status: blockers.some((entry) => entry.startsWith("cash_preview:")) ? "blocked" : "ok",
    note: `benchmarkOnly:true|totalPrizeMoney:${totalPrizeMoney}|${cashPreview.blockingReasons.join("|")}`,
  });

  save = persistence.getSaveById(saveId);
  if (!save) throw new Error("Long-run save disappeared before sponsor settlement.");
  console.error(`[long-run] season-end ${seasonId}: sponsor-settlement`);
  startedAt = Date.now();
  const existingSponsorEndPayout = (save.gameState.seasonState.sponsorPayoutLogs ?? []).some(
    (log) => log.seasonId === seasonId && log.phase === "season_end",
  );
  if (existingSponsorEndPayout) {
    recordPhase(performanceRows, {
      seasonId,
      phase: "season end sponsor settlement",
      startedAt,
      itemCount: 0,
      status: "ok",
      note: "already_applied",
    });
  } else {
    const sponsorApply = applySponsorSettlement({
      gameState: save.gameState,
      saveId,
      phase: "season_end",
      execute: true,
      deductSalary: true,
    });
    if (!sponsorApply.applied) {
      blockers.push(...sponsorApply.preview.blockingReasons.map((entry) => `sponsor:${entry}`));
      if (sponsorApply.preview.warnings.length > 0) {
        blockers.push(...sponsorApply.preview.warnings.slice(0, 8).map((entry) => `sponsor_warn:${entry}`));
      }
    } else {
      persistence.saveSingleplayerState(saveId, sponsorApply.gameState);
    }
    recordPhase(performanceRows, {
      seasonId,
      phase: "season end sponsor settlement",
      startedAt,
      itemCount: sponsorApply.preview.rows.filter((row) => row.cashDelta !== 0).length,
      status: blockers.some((entry) => entry.startsWith("sponsor:")) ? "blocked" : "ok",
      note: `totalCashDelta:${sponsorApply.preview.totalCashDelta}|benchmarkPrizeMoney:${totalPrizeMoney}|deductSalary:true`,
    });
  }

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
  const lastMatchdayId = save.gameState.season.matchdayIds.at(-1);
  const hasLastMatchdayResult =
    Boolean(lastMatchdayId) &&
    (save.gameState.seasonState.matchdayResults ?? []).some(
      (result) => result.seasonId === save.gameState.season.id && result.matchdayId === lastMatchdayId,
    );
  if (hasLastMatchdayResult && (save.gameState.gamePhase ?? "") === "season_active") {
    persistence.saveSingleplayerState(saveId, {
      ...save.gameState,
      gamePhase: "season_completed",
      matchdayState: {
        ...save.gameState.matchdayState,
        matchdayId: lastMatchdayId ?? save.gameState.matchdayState.matchdayId,
        status: "resolved",
        pendingTeamIds: [],
        resolvedFixtureIds: [],
      },
    });
    save = persistence.getSaveById(saveId) ?? save;
  }
  console.error(`[long-run] season-end ${seasonId}: ai-xp`);
  startedAt = Date.now();
  const xpBatch = runSeasonEndProgressionBatch({
    save: asSimulationApplySave(save),
    persistence,
    persistFinalState: true,
  });
  const xpWarnings = xpBatch.warnings;
  const xpBlockers = xpBatch.blockingReasons;
  save = persistence.getSaveById(saveId);
  if (!save) throw new Error("Long-run save disappeared after AI XP.");
  const seasonXpEvents = (save.gameState.playerProgressionEvents ?? []).filter((entry) => entry.seasonId === seasonId);
  const xpAppliedPlayers = xpBatch.playerEventsCreated;
  const xpPositive = seasonXpEvents.filter((entry) => (entry.upgrades?.length ?? 0) > 0).length;
  const xpStagnant = seasonXpEvents.filter((entry) => (entry.upgrades?.length ?? 0) === 0).length;
  const xpNegative = seasonXpEvents.filter((entry) => (entry.xpEarned ?? 0) < 0).length;
  if (xpBlockers.length > 0) blockers.push(...xpBlockers.map((entry) => `ai_xp:${entry}`));
  recordPhase(performanceRows, {
    seasonId,
    phase: "season end training/development",
    startedAt,
    itemCount: seasonXpEvents.length,
    status: xpBlockers.length > 0 ? "blocked" : "ok",
    note: `teamsApplied:${xpBatch.teamsApplied}|playerEvents:${xpBatch.playerEventsCreated}|${[...xpWarnings.slice(0, 12), ...xpBlockers.slice(0, 8)].join("|")}`,
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
  const seasonEndMatchdayId = save.gameState.matchdayState.matchdayId;
  const existingMarketTransfers = save.gameState.transferHistory.filter(
    (entry) =>
      entry.seasonId === seasonId &&
      entry.matchdayId === seasonEndMatchdayId &&
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
  let seasonEndEmergencyRepairTeams: string[] = [];
  const allowSeasonEndMarketBuys = isTransferActionAllowed(seasonId, "season_end_market_buy");
  if (existingMarketTransfers.length === 0) {
    const marketConvergence = await runTransferWindowSession({
      saveId,
      seasonId,
      persistence,
      phase: "season_end",
      dryRun: false,
      confirmToken: AI_MARKET_APPLY_CONFIRM_TOKEN,
      transferPhase: "manual_transfer_window",
      teamScope: "all",
      maxTeamCycles: LONG_RUN_PLANNER_MAX_TEAM_CYCLES,
      maxLeagueRounds: LONG_RUN_PLANNER_MAX_LEAGUE_ROUNDS,
      allowBuys: allowSeasonEndMarketBuys,
      skipIfExistingMarketTransfers: false,
      progressLog: false,
    });
    marketStatus = marketConvergence.blockingReasons.length > 0 ? "blocked" : "applied";
    marketAppliedBuys = marketConvergence.appliedBuys;
    marketAppliedSells = marketConvergence.appliedSells;
    marketBlockedTeams = marketConvergence.perTeam.filter((team) => team.status === "blocked").length;
    marketWarnings = marketConvergence.warnings;
    marketBlockers = marketConvergence.blockingReasons;
    seasonEndEmergencyRepairTeams = marketConvergence.emergencyRepairTeams;
    plannerFinalGateRows = marketConvergence.perTeam.map((team) => ({
      seasonId,
      teamId: team.teamId,
      teamName: team.teamName,
      result: team.status,
      plannedBuys: team.appliedBuys,
      executedBuys: team.appliedBuys,
      plannedSells: team.appliedSells,
      executedSells: team.appliedSells,
      rosterAfter: team.rosterAfter,
      minRequired: team.minRequired,
      warnings: team.warnings.join("|"),
      blockingReasons: team.blockingReasons.join("|"),
    }));
    if (marketConvergence.blockingReasons.length > 0) {
      blockers.push(
        ...marketConvergence.blockingReasons
          .filter((entry) => !isExpectedSeasonOneMarketRosterBlocker(seasonId, entry))
          .map((entry) => `ai_market:${entry}`),
      );
    }
  }
  recordPhase(performanceRows, {
    seasonId,
    phase: "season end ai market",
    startedAt,
    itemCount: marketAppliedBuys + marketAppliedSells,
    status: marketStatus === "blocked" ? "blocked" : "ok",
    note: [...marketBlockers, ...marketWarnings].join("|"),
  });

  const identityRepair = repairVdWomenOnlyIdentityViolations(saveId, seasonId, persistence);
  performanceRows.push(
    ...identityRepair.performanceRows.map((row) => ({
      ...row,
      phase: `season end ${row.phase}`,
    })),
  );
  if (identityRepair.blockers.length > 0) {
    blockers.push(...identityRepair.blockers.map((entry) => `identity_repair:${entry}`));
  }

  const finalCashRecovery = await recoverNegativeCashBeforeSeasonStart(saveId, seasonId, persistence);
  performanceRows.push(
    ...finalCashRecovery.performanceRows.map((row) => ({
      ...row,
      phase: `season end final stabilization ${row.phase}`,
    })),
  );
  const finalRosterRepair = isTransferActionAllowed(seasonId, "preseason_roster_repair")
    ? emergencyRepairRosterMinimumBeforeSeasonStart(
        saveId,
        seasonId,
        persistence,
        seasonEndEmergencyRepairTeams,
      )
    : isSeasonOne(seasonId)
      ? (() => {
          const repair = repairSeasonOneEndRosterBeforeS2(saveId, persistence, {
            plannerExhaustedTeamIds: seasonEndEmergencyRepairTeams,
            outputDir: path.join(OUTPUT_DIR, `s1-end-roster-repair-${seasonId}`),
          });
          const performanceRows: PhaseMetric[] = [];
          recordPhase(performanceRows, {
            seasonId,
            phase: "season start emergency roster repair",
            startedAt: Date.now(),
            itemCount: repair.purchases.length,
            status: repair.blockers.length > 0 ? "blocked" : repair.repaired ? "ok" : "skipped",
            buyApplyCount: repair.purchases.length,
            warnings: repair.warnings.join("|"),
            errors: repair.blockers.join("|"),
            note: `s1_end_stabilization:true|teams:${repair.purchases.length > 0 ? "repaired" : "none"}`,
          });
          return {
            performanceRows,
            blockers: repair.blockers,
            warnings: repair.warnings,
            purchases: repair.purchases,
            repaired: repair.repaired,
          };
        })()
      : (() => {
        const latest = persistence.getSaveById(saveId) ?? save;
        const belowMinIds = getAllTeamsBelowMinIds(latest.gameState);
        return {
          performanceRows: [] as PhaseMetric[],
          blockers: [] as string[],
          warnings: belowMinIds.map((teamId) => `roster_hard_gate_repair_forbidden:${seasonId}:${teamId}`),
          purchases: [] as Array<Record<string, unknown>>,
          repaired: false,
        };
      })();
  performanceRows.push(
    ...finalRosterRepair.performanceRows.map((row) => ({
      ...row,
      phase: `season end final stabilization ${row.phase}`,
    })),
  );
  let seasonEndStabilizationPurchases = [...finalRosterRepair.purchases];
  if (finalRosterRepair.blockers.length > 0) {
    blockers.push(...finalRosterRepair.blockers);
  }
  if (finalRosterRepair.warnings.length > 0) {
    recordPhase(performanceRows, {
      seasonId,
      phase: "season end final stabilization roster repair policy",
      startedAt: Date.now(),
      itemCount: finalRosterRepair.warnings.length,
      status: "skipped",
      warnings: finalRosterRepair.warnings.slice(0, 20).join("|"),
      note: "repair_forbidden_by_policy",
    });
  }
  save = persistence.getSaveById(saveId);
  if (!save) throw new Error("Long-run save disappeared after final season-end stabilization.");
  for (let cashRecoveryAttempt = 0; cashRecoveryAttempt < 3; cashRecoveryAttempt += 1) {
    const negativeTeams = save.gameState.teams.filter((team) => team.cash < 0);
    if (negativeTeams.length === 0) break;
    const repeatRecovery = await recoverNegativeCashBeforeSeasonStart(saveId, seasonId, persistence);
    performanceRows.push(
      ...repeatRecovery.performanceRows.map((row) => ({
        ...row,
        phase: `season end final stabilization ${row.phase}`,
      })),
    );
    if (repeatRecovery.blockers.length > 0) {
      blockers.push(...repeatRecovery.blockers);
      break;
    }
    save = persistence.getSaveById(saveId);
    if (!save) throw new Error("Long-run save disappeared during repeat cash recovery.");
  }
  const finalNegativeCash = save.gameState.teams.filter((team) => team.cash < 0);
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

  return {
    rows,
    performanceRows,
    blockers,
    totalPrizeMoney,
    aiMarketStatus: marketStatus,
    plannerFinalGateRows,
    stabilizationPurchases: seasonEndStabilizationPurchases,
  };
}

function printSeasonInterimUpdate(
  save: PersistedSaveGame,
  seasonId: string,
  teamRows: Array<{
    teamId: string;
    teamName: string;
    rank: number | null;
    cash: number;
    salarySum: number;
    rosterSize: number;
    marketBuyCount: number;
    draftBuyCount: number;
    sells: number;
    transferFeesIn: number;
    transferFeesOut: number;
  }>,
) {
  const playerById = new Map(save.gameState.players.map((player) => [player.id, player]));
  const mwByTeam = new Map<string, number>();
  for (const entry of save.gameState.rosters) {
    const player = playerById.get(entry.playerId);
    const economy = resolvePlayerEconomyContract({ player, rosterEntry: entry });
    mwByTeam.set(entry.teamId, (mwByTeam.get(entry.teamId) ?? 0) + (economy.marketValue ?? 0));
  }

  const seasonTransfers = save.gameState.transferHistory.filter((entry) => entry.seasonId === seasonId);
  const seasonBuyCounts = countSeasonBuyTransfers(seasonTransfers, seasonId);
  const sellCount = seasonTransfers.filter((entry) => entry.transferType === "sell").length;
  const transferLabel = formatSeasonTransferCountsLabel(seasonId, seasonBuyCounts, { sellCount });
  const sourceCounts = new Map<string, number>();
  for (const entry of seasonTransfers) {
    const source = entry.source ?? "unknown";
    sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1);
  }

  const negativeCash = save.gameState.teams.filter((team) => (team.cash ?? 0) < 0);
  const totalCash = save.gameState.teams.reduce((sum, team) => sum + (team.cash ?? 0), 0);
  const totalMw = [...mwByTeam.values()].reduce((sum, value) => sum + value, 0);
  const totalSalary = teamRows.reduce((sum, row) => sum + row.salarySum, 0);

  const teamById = new Map(save.gameState.teams.map((team) => [team.teamId, team]));
  const identityByTeamId = new Map(save.gameState.teamIdentities.map((identity) => [identity.teamId, identity]));
  const rows = teamRows
    .map((row) => {
      const team = teamById.get(row.teamId);
      const identity = identityByTeamId.get(row.teamId);
      const targets = deriveRosterTargets(team, identity);
      return {
        ...row,
        shortCode: team?.shortCode ?? row.teamId,
        marketValue: round(mwByTeam.get(row.teamId) ?? 0),
        playerMin: targets.playerMin,
        playerOpt: targets.playerOpt,
        rosterLabel: `${row.rosterSize}/${targets.playerMin}/${targets.playerOpt}`,
      };
    })
    .sort((left, right) => (left.rank ?? 99) - (right.rank ?? 99) || left.shortCode.localeCompare(right.shortCode));
  const teamsAtMin = rows.filter((row) => row.rosterSize >= row.playerMin).length;
  const teamsAtOpt = rows.filter((row) => row.rosterSize >= row.playerOpt).length;

  console.error(`\n[long-run] ===== SEASON INTERIM ${seasonId} · ${save.saveId} =====`);
  console.error(
    `[long-run] Liga: Cash Σ ${round(totalCash)} · MW Σ ${round(totalMw)} · Gehalt Σ ${round(totalSalary)} · Kader ≥Min ${teamsAtMin}/${rows.length} · ≥Opt ${teamsAtOpt}/${rows.length} · Transfers ${transferLabel}`,
  );
  if (negativeCash.length > 0) {
    console.error(`[long-run] WARN negative cash: ${negativeCash.map((team) => `${team.shortCode}:${round(team.cash)}`).join(", ")}`);
  }
  if (sourceCounts.size > 0) {
    console.error(
      `[long-run] Quellen: ${[...sourceCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([source, count]) => `${source}:${count}`)
        .join(" | ")}`,
    );
  }
  console.error("[long-run] Team · Rang · Kader(min/opt) · Cash · MW · Gehalt · K/V · Fee+ · Fee-");
  for (const row of rows) {
    console.error(
      `[long-run] ${row.shortCode.padEnd(4)} · ${String(row.rank ?? "-").padStart(2)} · ${row.rosterLabel.padStart(11)} · ${String(row.cash).padStart(6)} · ${String(row.marketValue).padStart(6)} · ${String(row.salarySum).padStart(5)} · ${String(row.marketBuyCount).padStart(2)}/${String(row.sells).padStart(2)} · ${String(row.transferFeesIn).padStart(5)}/${String(row.transferFeesOut).padStart(5)}`,
    );
  }
  console.error(`[long-run] ===== END ${seasonId} =====\n`);
}

function collectAuditRows(save: PersistedSaveGame, seasonId: string, seasonEnd: { totalPrizeMoney: number; aiMarketStatus: string }) {
  const gameState = save.gameState;
  const standings = gameState.seasonState.standings ?? {};
  const transfers = gameState.transferHistory.filter((entry) => entry.seasonId === seasonId);
  const seasonBuyCounts = countSeasonBuyTransfers(transfers, seasonId);
  const contractEvents = (gameState.seasonState.contractEvents ?? []).filter((entry) => entry.seasonId === seasonId);
  const availabilityByPlayerId = buildPlayerAvailabilityByPlayerId(gameState);
  const leagueInjuryEventsSeason = countSeasonInjuryEvents(gameState, seasonId);
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
    const fatigueMetrics = collectTeamFatigueInjuryMetrics({
      gameState,
      team,
      roster,
      playerById,
      seasonId,
      availabilityByPlayerId,
    });
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
      marketBuyCount: teamTransfers.filter((entry) => entry.transferType === "buy" && isMarketBuyTransferEntry(entry)).length,
      draftBuyCount: teamTransfers.filter((entry) => entry.transferType === "buy" && isDraftBuySource(entry.source)).length,
      sells: teamTransfers.filter((entry) => entry.transferType === "sell").length,
      contractExits: teamTransfers.filter((entry) => entry.transferType === "contract_exit").length,
      transferFeesIn: round(teamTransfers.filter((entry) => entry.fromTeamId === team.teamId).reduce((sum, entry) => sum + (entry.fee ?? 0), 0)),
      transferFeesOut: round(teamTransfers.filter((entry) => entry.toTeamId === team.teamId).reduce((sum, entry) => sum + (entry.fee ?? 0), 0)),
      injuries: fatigueMetrics.injuries,
      injuredNow: fatigueMetrics.injuredNow,
      recoveringNow: fatigueMetrics.recoveringNow,
      fatigueAvg: fatigueMetrics.fatigueAvg,
      fatigueMax: fatigueMetrics.fatigueMax,
      fatigueP90: fatigueMetrics.fatigueP90,
      fatigue70Plus: fatigueMetrics.fatigue70Plus,
      fatigue85Plus: fatigueMetrics.fatigue85Plus,
      injuryEventsSeason: fatigueMetrics.injuryEventsSeason,
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
      injuredNow: row.injuredNow,
      recoveringNow: row.recoveringNow,
      injuryEventsSeason: row.injuryEventsSeason,
      leagueInjuryEventsSeason,
      fatigueAvg: row.fatigueAvg,
      fatigueMax: row.fatigueMax,
      fatigueP90: row.fatigueP90,
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
      buyCount: seasonBuyCounts.marketBuyCount,
      draftBuyCount: seasonBuyCounts.draftBuyCount,
      marketBuyCount: seasonBuyCounts.marketBuyCount,
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
        findSeasonOneForbiddenBuySources(transfers).length > 0
          ? `s1_market_buy_detected:${findSeasonOneForbiddenBuySources(transfers).join("|")}`
          : null,
        seasonId === "season-1" && seasonBuyCounts.marketBuyCount > 0
          ? `s1_market_buy_count:${seasonBuyCounts.marketBuyCount}`
          : null,
      ].filter((entry): entry is string => Boolean(entry)),
      blockers: [],
    } satisfies SeasonAudit,
  };
}

async function assertLongRunSimEnvironment() {
  if (LONG_RUN_ALLOW_DEV_SERVER) {
    return;
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    try {
      const response = await fetch(`${LONG_RUN_DEV_SERVER_URL}/foundation`, {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) {
        return;
      }
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return;
  }

  const message =
    `Dev-Server unter ${LONG_RUN_DEV_SERVER_URL} ist aktiv — parallele Foundation-UI verlangsamt SQLite-Writes der Sim stark. ` +
    "Browser/Foundation schließen und Dev-Server stoppen, oder OLY_LONG_RUN_ALLOW_DEV_SERVER=1 setzen.";
  if (LONG_RUN_REQUIRE_NO_DEV_SERVER) {
    throw new Error(message);
  }
  console.error(`[long-run] WARN: ${message}`);
}

async function main() {
  loadEnvConfig(PROJECT_ROOT);
  await assertLongRunSimEnvironment();
  const persistence = createPersistenceService();
  const previousActiveSave = persistence.getActiveSave();
  let save: PersistedSaveGame;
  if (RESUME_SAVE_ID) {
    const existing = persistence.getSaveById(RESUME_SAVE_ID);
    if (!existing) throw new Error(`Resume save ${RESUME_SAVE_ID} not found.`);
    save = existing;
    persistence.activateSave(save.saveId);
    console.error(`[long-run] resume ${save.saveId}`);
    assertResumedSeasonOnePaid(save);
    save = setAllTeamsAi(save, persistence);
    console.error(`[long-run] resume: switched all teams to AI control (lineup+transfer apply enabled)`);
    if (
      !FULL_CHURN_STRESS_MODE &&
      save.gameState.season.id === "season-1" &&
      save.gameState.rosters.length === 0
    ) {
      console.error(`[long-run] resume: unbootstrapped S1 — running canonical bootstrap`);
      const draftPhase = await runCanonicalSeasonOneDraftPhase(save, persistence);
      if (draftPhase.blockers.length > 0) {
        throw new Error(`S1 canonical bootstrap blocked: ${draftPhase.blockers.join(" | ")}`);
      }
      const auditReady = finalizeSeasonOneDraftAuditReady(draftPhase.save, persistence);
      runPhaseCheckpoint(auditReady.saveId, persistence, "draft", { picksRun: draftPhase.picksRun });
      const postPhase = finalizeSeasonOneBootstrapPhase(auditReady, persistence);
      save = postPhase.save;
    }
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
      const draftPhase = await runCanonicalSeasonOneDraftPhase(save, persistence);
      if (draftPhase.blockers.length > 0) {
        throw new Error(`S1 canonical bootstrap blocked: ${draftPhase.blockers.join(" | ")}`);
      }
      const auditReady = finalizeSeasonOneDraftAuditReady(draftPhase.save, persistence);
      runPhaseCheckpoint(auditReady.saveId, persistence, "draft", { picksRun: draftPhase.picksRun });
      const postPhase = finalizeSeasonOneBootstrapPhase(auditReady, persistence);
      save = postPhase.save;
      printSeasonInterimUpdate(
        save,
        save.gameState.season.id,
        collectAuditRows(save, save.gameState.season.id, { totalPrizeMoney: 0, aiMarketStatus: "post_draft" }).teamRows,
      );
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

  if (LONG_RUN_STOP_AFTER === "draft" && !RESUME_SAVE_ID) {
    persistence.activateSave(save.saveId);
    console.error(`[long-run] STOP_AFTER=draft — Save \`${save.saveId}\` bereit. S1 mit:`);
    console.error(
      `[long-run] OLY_LONG_RUN_SAVE_ID=${save.saveId} OLY_LONG_RUN_STOP_AFTER=season_end OLY_LONG_RUN_FINAL_SEASON=1 node --import tsx scripts/long-run-sandbox-s1-s6.ts`,
    );
    return;
  }

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
    const economyStart = economyRows.length;
    const rosterStart = rosterRows.length;
    const aiMarketStart = aiMarketRows.length;
    const contractExitStart = contractExitRows.length;
    const renewalStart = renewalRows.length;
    const buildingsStart = buildingsRows.length;
    const moraleBoardTrustStart = moraleBoardTrustRows.length;
    const marketValueSalaryStart = marketValueSalaryRows.length;
    const fatigueStart = fatigueRows.length;
    const playerDevelopmentStart = playerDevelopmentRows.length;
    const medalStart = medalRows.length;
    const matchdayStart = matchdayRows.length;
    const performanceStart = performanceRows.length;
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
    const preseason = await runCanonicalPreseasonStart(save.saveId, seasonId, persistence);
    performanceRows.push(...preseason.performanceRows);
    aiMarketRows.push(...preseason.purchases);
    if (preseason.warnings.length > 0) {
      balanceIssues.push(...preseason.warnings.map((warning) => `${seasonId}:preseason:${warning}`));
    }
    if (preseason.blockers.length > 0) {
      const hardPreseasonBlockers = preseason.blockers.filter(
        (entry) => !isSoftOpenTechnicalBug(`${seasonId}:${entry}`),
      );
      if (hardPreseasonBlockers.length > 0) {
        openTechnicalBugs.push(...hardPreseasonBlockers.map((entry) => `${seasonId}:${entry}`));
        break;
      }
    }
    save = persistence.getSaveById(save.saveId) ?? save;
    runPhaseCheckpoint(save.saveId, persistence, "preseason", {
      slotHardUnresolved: preseason.slotHardUnresolved,
      slotCoverageWarnings: preseason.slotCoverageWarnings,
    });
    save = persistence.getSaveById(save.saveId) ?? save;
    captainAutoFixRows.push(...preseason.captainAutoFixRows);
    slotCoverageRows.push(...preseason.slotCoverageRows);
    const unresolvedSlotRows = preseason.slotCoverageRows.filter((row) => row.status === "hard_unresolved");
    if (unresolvedSlotRows.length > 0) {
      balanceIssues.push(`${seasonId}:slot_coverage_hard_unresolved:${unresolvedSlotRows.length}`);
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
      const hardBlockers = seasonEnd.blockers.filter((entry) => !isSoftLongRunBlocker(seasonId, entry));
      if (hardBlockers.length > 0) {
        openTechnicalBugs.push(...hardBlockers.map((entry) => `${seasonId}:${entry}`));
        break;
      }
      balanceIssues.push(
        ...seasonEnd.blockers
          .filter((entry) => isSoftLongRunBlocker(seasonId, entry))
          .map((entry) => `${seasonId}:expected_soft:${entry}`),
      );
    }
    save = persistence.getSaveById(save.saveId) ?? save;
    const audit = collectAuditRows(save, seasonId, seasonEnd);
    printSeasonInterimUpdate(save, seasonId, audit.teamRows);
    try {
      runPhaseCheckpoint(save.saveId, persistence, "season_end", { seasonEndBlockers: seasonEnd.blockers });
    } catch (error) {
      openTechnicalBugs.push(`${seasonId}:season_end_audit:${error instanceof Error ? error.message : String(error)}`);
      break;
    }
    save = persistence.getSaveById(save.saveId) ?? save;
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
    aiMarketRows.push(...seasonEnd.stabilizationPurchases ?? []);
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

    flushSeasonRowBuffers({
      seasonId,
      economyRows,
      rosterRows,
      aiMarketRows,
      contractExitRows,
      renewalRows,
      buildingsRows,
      moraleBoardTrustRows,
      marketValueSalaryRows,
      fatigueRows,
      playerDevelopmentRows,
      medalRows,
      matchdayRows,
      performanceRows,
      economyStart,
      rosterStart,
      aiMarketStart,
      contractExitStart,
      renewalStart,
      buildingsStart,
      moraleBoardTrustStart,
      marketValueSalaryStart,
      fatigueStart,
      playerDevelopmentStart,
      medalStart,
      matchdayStart,
      performanceStart,
    });

    if (LONG_RUN_STOP_AFTER === "season_end") {
      console.error(`[long-run] STOP_AFTER=season_end — ${seasonId} abgeschlossen, Save \`${save.saveId}\`.`);
      break;
    }

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
  const cashEconomyAudit = buildCashEconomyAudit(finalSave.gameState);
  const transferFinanceAudit = buildTransferFinanceAudit(finalSave.gameState);
  const currentSeasonId = finalSave.gameState.season.id;
  const currentSeasonFinanceViolations = transferFinanceAudit.violations.filter((entry) =>
    isTransferFinanceViolationForSeason(entry, currentSeasonId),
  );
  if (cashEconomyAudit.violations.length > 0) {
    openTechnicalBugs.push(...cashEconomyAudit.violations.map((entry) => `cash_economy:${entry}`));
  }
  if (currentSeasonFinanceViolations.length > 0) {
    openTechnicalBugs.push(...currentSeasonFinanceViolations.map((entry) => `transfer_finance:${entry}`));
  }
  const s1ForbiddenBuySources = findSeasonOneForbiddenBuySources(finalSave.gameState.transferHistory);
  if (s1ForbiddenBuySources.length > 0) {
    openTechnicalBugs.push(`s1_forbidden_buy_source_detected:${s1ForbiddenBuySources.join("|")}`);
  }
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
      season1ForbiddenBuySources: s1ForbiddenBuySources,
      cashEconomyViolations: cashEconomyAudit.violations,
      transferFinanceViolations: transferFinanceAudit.violations,
      seasonsWithSponsorEndSettlement: cashEconomyAudit.seasonsWithSponsorEndSettlement,
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
  writeOutput("cash-economy-audit.json", `${JSON.stringify(cashEconomyAudit, null, 2)}\n`);
  writeOutput("transfer-finance-violations.json", `${JSON.stringify({ violations: transferFinanceAudit.violations, doctrineStats: transferFinanceAudit.doctrineStats }, null, 2)}\n`);
  writeCsv(
    "transfer-finance-by-season.csv",
    transferFinanceAudit.rows,
    [
      "seasonId",
      "teamId",
      "teamName",
      "cashStart",
      "cashEnd",
      "buyFeesPaid",
      "sellProceeds",
      "netTransferCash",
      "sponsorCashIn",
      "salaryPaidOut",
      "netSponsorCash",
      "buyCount",
      "draftBuyCount",
      "marketBuyCount",
      "sellCount",
      "cashReconciliationDelta",
    ],
  );
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
          `- ${entry.seasonId}: Champion ${entry.champion ?? "—"} · Cash ${entry.minCash}-${entry.maxCash} · Roster ${entry.rosterMin}-${entry.rosterMax} · Transfers ${formatSeasonAuditTransferSummary(entry)} · Injuries ${entry.injuries}`,
      ),
      "",
      "## Empfehlungen",
      ...summary.recommendations.map((entry) => `- ${entry}`),
    ].join("\n"),
  );
  if (economyRows.length > 0) writeCsv("economy-cash-flow-s1-s6.csv", economyRows);
  if (rosterRows.length > 0) {
    writeCsv("roster-size-s1-s6.csv", rosterRows, [
      "seasonId",
      "teamId",
      "teamName",
      "rank",
      "points",
      "cash",
      "salarySum",
      "rosterSize",
      "playerMin",
      "playerOpt",
      "playerMax",
      "marketBuyCount",
      "draftBuyCount",
      "sells",
      "contractExits",
      "transferFeesIn",
      "transferFeesOut",
      "injuries",
      "injuredNow",
      "recoveringNow",
      "fatigueAvg",
      "fatigueMax",
      "fatigueP90",
      "fatigue70Plus",
      "fatigue85Plus",
      "injuryEventsSeason",
      "moraleAvg",
      "moraleCritical",
      "boardTrust",
      "boardPressure",
      "renewalCount",
      "contractExitCount",
      "xpEvents",
    ]);
  }
  if (aiMarketRows.length > 0) writeCsv("ai-market-actions-s1-s6.csv", aiMarketRows);
  if (contractExitRows.length > 0) writeCsv("contract-exits-s1-s6.csv", contractExitRows);
  if (renewalRows.length > 0) writeCsv("renewals-s1-s6.csv", renewalRows);
  if (buildingsRows.length > 0) writeCsv("buildings-ai-s1-s6.csv", buildingsRows);
  if (moraleBoardTrustRows.length > 0) writeCsv("morale-boardtrust-s1-s6.csv", moraleBoardTrustRows);
  if (marketValueSalaryRows.length > 0) writeCsv("marketvalue-salary-s1-s6.csv", marketValueSalaryRows);
  if (fatigueRows.length > 0) writeCsv("fatigue-injury-s1-s6.csv", fatigueRows);
  if (playerDevelopmentRows.length > 0) writeCsv("player-development-s1-s6.csv", playerDevelopmentRows);
  if (freeAgentRows.length > 0) writeCsv("free-agent-development-s1-s6.csv", freeAgentRows);
  if (medalRows.length > 0) writeCsv("season-history-medals-s1-s6.csv", medalRows);
  if (matchdayRows.length > 0) writeCsv("long-run-matchdays-s1-s6.csv", matchdayRows);
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
  if (performanceRows.length > 0) writeCsv("performance-longrun-s1-s6.csv", performanceRows);
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
          `- ${entry.seasonId}: Champion ${entry.champion ?? "—"} · Roster ${entry.rosterMin}-${entry.rosterMax} · Cash ${entry.minCash}-${entry.maxCash} · Transfers ${formatSeasonAuditTransferSummary(entry)}`,
      ),
    ].join("\n"),
  );
  if (performanceRows.length > 0) writeCsv("five-season-performance.csv", performanceRows);
  if (performanceRows.length > 0) {
    writeOutput("five-season-phase-timings.json", `${JSON.stringify(performanceRows, null, 2)}\n`);
  }
  if (performanceRows.length > 0) writeCsv("five-season-cache-audit.csv", cacheAuditRows);
  if (performanceRows.length > 0) writeCsv("five-season-slowest-operations.csv", slowestOperationsRows);
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

  writeOutput("long-run-summary.json", JSON.stringify(summary, null, 2));

  const hardBugs = summary.openTechnicalBugs.filter(
    (entry) =>
      entry.includes("manual_xp") ||
      entry.includes("season_end_organic_only") ||
      (entry.includes("organic_peak_net_corridor") && entry.includes("season_end_audit")),
  );
  if (hardBugs.length > 0) {
    process.exitCode = 2;
  }

  if (SUMMARY_ONLY) {
    console.log(
      JSON.stringify({
        saveId: summary.saveId,
        finalSeasonId: summary.finalSeasonId,
        seasonsCompleted: summary.seasonsCompleted,
        openTechnicalBugs: summary.openTechnicalBugs.length,
        outputDir: OUTPUT_DIR,
      }),
    );
  } else {
    console.log(JSON.stringify(summary, null, 2));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
