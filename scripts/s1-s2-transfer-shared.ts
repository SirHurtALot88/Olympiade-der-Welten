/**
 * Shared S1→S2 transfer smoke / from-save pipeline helpers.
 */
import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

import { AI_MARKET_APPLY_CONFIRM_TOKEN } from "@/lib/ai/ai-market-plan-apply-contract";
import {
  getTeamHardMinRequired,
  getTeamsNeedingConvergence,
  runCompareRescueBeforeEmergencyRepair,
  runEmergencyRosterRepairForTeams,
} from "@/lib/ai/ai-market-plan-convergence-service";
import {
  PLANNER_LIQUIDITY_BUFFER_MW_RATIO,
  resolveTeamLiquidityBufferTarget,
  resolveTeamRosterMarketValue,
} from "@/lib/ai/planner-cash-buffer-policy";
import { runPreseasonProactiveCashRecovery } from "@/lib/ai/preseason-cash-recovery-service";
import { runTransferWindowSession } from "@/lib/ai/ai-transfer-window-session-service";
import {
  applySeasonEndContractTick,
  previewSeasonEndContracts,
} from "@/lib/contracts/contract-renewal-service";
import type { GameState, TeamControlSettings } from "@/lib/data/olyDataTypes";
import { applyFacilitySeasonEndFinance, previewFacilitySeasonEndFinance } from "@/lib/facilities/facility-season-end-service";
import { deriveRosterTargets } from "@/lib/foundation/roster-limits";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { closeDatabaseForMaintenance } from "@/lib/persistence/sqlite";
import { previewCashPrizeApply, type CashPrizeApplyResult } from "@/lib/season/cash-prize-apply-service";
import { S2_MANAGER_ACTION_TYPES, applyCanonicalManagerPlan } from "@/lib/season/long-run-canonical";
import {
  formatPhaseAuditSummaryDe,
  runPhaseAuditDe,
  type PhaseAuditResult,
} from "@/lib/season/long-run-phase-audit";
import {
  getLongRunPlannerMaxLeagueRounds,
  getLongRunPlannerMaxTeamCycles,
} from "@/lib/season/long-run-profile";
import {
  applyPreSeasonNextSeasonSetupLightweight,
  buildPreSeasonNextSeasonSetupToken,
} from "@/lib/season/preseason-workflow-service";
import { isTransferActionAllowed } from "@/lib/season/transfer-season-policy";
import {
  chooseSponsorOfferForAiTeams,
  ensureSeasonSponsorOffers,
} from "@/lib/sponsor/sponsor-offer-service";
import { applySponsorSettlement } from "@/lib/sponsor/sponsor-settlement-service";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";

export const PROJECT_ROOT = path.resolve(__dirname, "..");
export const DEFAULT_BASELINE_SAVE_DB = path.join(PROJECT_ROOT, "outputs/s1-draft-baseline.sqlite");
export const FALLBACK_BASELINE_SAVE_DB = path.join(
  PROJECT_ROOT,
  "outputs/s1-s2-transfer-smoke-2026-07-05T13-06-24/run1-2026-07-05T13-06-24/balancing-run.sqlite",
);
export const SPECIAL_TEAMS = ["S-C", "W-L", "T-T", "S-S"] as const;

export type TeamRow = {
  teamCode: string;
  roster: number;
  playerMin: number;
  playerOpt: number;
  hardMin: number;
  cash: number;
  sumMw: number;
  atMin: boolean;
  atOpt: boolean;
  status: string;
};

export type EconomyRow = {
  teamCode: string;
  sellFeesS1: number;
  buyFeesS2: number;
  prizeBenchmark: number;
  sponsorDelta: number;
  salaryTotal: number;
  cashEnd: number;
  mwEnd: number;
  buffer10: number;
  excessOverBuffer: number;
  guvEstimate: number;
};

export type TransferRunResult = {
  label: string;
  saveId: string;
  sqlitePath: string;
  outputDir: string;
  durationMs: number;
  draft: {
    picks: number;
    teamsAtMin: number;
    teamsAtOpt: number;
    avgCash: number;
    blockers: string[];
  };
  afterSell: {
    totalSells: number;
    teamsWithSell: number;
    zeroRosterTeams: string[];
    teamRows: TeamRow[];
    blockingReasons: string[];
  };
  afterPreseason: {
    totalBuys: number;
    totalSells: number;
    teamsAtMin: number;
    teamsAtOpt: number;
    avgCash: number;
    belowHardMin: string[];
    negativeCash: string[];
    engineSummary: Record<string, number>;
    blockingReasons: string[];
    warnings: string[];
    emergencyRepairTeams: number;
  };
  economy: {
    rows: EconomyRow[];
    leagueSellFees: number;
    leagueBuyFeesS2: number;
    leaguePrizeBenchmark: number;
    leagueSalaryTotal: number;
    leagueExcessOverBuffer: number;
    sellBuyCountGap: number;
  };
  audits: {
    seasonEnd: PhaseAuditResult;
    preseason: PhaseAuditResult;
  };
  hardFails: string[];
};

export type BootstrapOptions = {
  rankShuffle?: number;
  seed?: number;
};

export function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

export function pct(n: number, total: number) {
  return total > 0 ? round((n / total) * 100, 1) : 0;
}

export function log(message: string, tag = "s1-s2-transfer") {
  console.error(`[${tag}] ${message}`);
}

function hashSeed(input: string, seed: number) {
  let hash = seed;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function buildShuffledStandings(gameState: GameState, maxDelta: number, seed: number) {
  const teams = [...gameState.teams];
  const jittered = teams.map((team, index) => {
    const hash = hashSeed(team.teamId, seed);
    const delta = (hash % (maxDelta * 2 + 1)) - maxDelta;
    return { teamId: team.teamId, sortKey: index + 1 + delta };
  });
  jittered.sort((left, right) => left.sortKey - right.sortKey || left.teamId.localeCompare(right.teamId));
  return Object.fromEntries(
    jittered.map((entry, index) => {
      const rank = index + 1;
      return [
        entry.teamId,
        {
          points: Math.max(0, 30 - index),
          rank,
          startplatz: rank,
          rankDiff: 0,
        },
      ];
    }),
  );
}

/** Fast-path: seed standings + season_completed without running matchdays. */
export function bootstrapFastSeasonOneCompleted(
  gameState: GameState,
  saveId: string,
  opts: BootstrapOptions = {},
): GameState {
  const seasonId = gameState.season.id;
  const matchdayIds = gameState.season.matchdayIds ?? [];
  const lastMatchdayId = matchdayIds[matchdayIds.length - 1] ?? "md-10";
  const now = new Date().toISOString();
  const teamCount = gameState.teams.length;
  const defaultDisciplineId = gameState.disciplines[0]?.id ?? "discipline-1";
  const rankShuffle = opts.rankShuffle ?? 0;
  const seed = opts.seed ?? 42;

  const standings =
    rankShuffle > 0
      ? buildShuffledStandings(gameState, rankShuffle, seed)
      : Object.fromEntries(
          gameState.teams.map((team, index) => {
            const rank = index + 1;
            const points = Math.max(0, 30 - index);
            return [team.teamId, { points, rank, startplatz: rank, rankDiff: 0 }];
          }),
        );

  const existingResults = [...(gameState.seasonState.matchdayResults ?? [])];
  const matchdayResults = [...existingResults];
  for (const matchdayId of matchdayIds) {
    if (matchdayResults.some((entry) => entry.seasonId === seasonId && entry.matchdayId === matchdayId)) continue;
    matchdayResults.push({
      id: `smoke-md-result-${seasonId}-${matchdayId}`,
      saveId,
      seasonId,
      matchdayId,
      status: "preview_applied",
      sourceVersion: "s1-s2-transfer-shared",
      teamsTotal: teamCount,
      teamsReady: teamCount,
      teamsUnderfilled: 0,
      teamsMissingLineup: 0,
      teamsInvalidLineup: 0,
      teamsMissingScoreCoverage: 0,
      warningsCount: 0,
      createdAt: now,
      updatedAt: now,
    });
  }

  const existingStandingsLogs = [...(gameState.seasonState.standingsApplyLogs ?? [])];
  const standingsApplyLogs = [...existingStandingsLogs];
  for (const matchdayId of matchdayIds) {
    if (standingsApplyLogs.some((entry) => entry.seasonId === seasonId && entry.matchdayId === matchdayId)) continue;
    standingsApplyLogs.push({
      id: `smoke-standings-apply-${seasonId}-${matchdayId}`,
      saveId,
      seasonId,
      matchdayId,
      action: "apply",
      payload: {
        idempotencyKey: `smoke-${seasonId}-${matchdayId}`,
        totalTeams: teamCount,
        appliedTeams: teamCount,
        tieGroupsCount: 0,
        previewWarningsCount: 0,
      },
      createdAt: now,
    });
  }

  const lastMatchdayResultId =
    matchdayResults.find((entry) => entry.seasonId === seasonId && entry.matchdayId === lastMatchdayId)?.id ??
    `smoke-md-result-${seasonId}-${lastMatchdayId}`;
  const existingPerformances = [...(gameState.seasonState.playerDisciplinePerformances ?? [])];
  const playerDisciplinePerformances = [...existingPerformances];
  if (playerDisciplinePerformances.length === 0) {
    for (const rosterEntry of gameState.rosters) {
      playerDisciplinePerformances.push({
        id: `smoke-perf-${seasonId}-${rosterEntry.playerId}`,
        matchdayResultId: lastMatchdayResultId,
        teamId: rosterEntry.teamId,
        playerId: rosterEntry.playerId,
        activePlayerId: null,
        disciplineId: defaultDisciplineId,
        disciplineSide: "d1",
        slotIndex: 0,
        baseValue: 50,
        finalPlayerScore: 55,
        scoreContribution: 10,
        rankInTeam: 1,
        rankInDiscipline: 1,
        isTop10: false,
        isMvpCandidate: false,
        storyWeight: null,
        createdAt: now,
      });
    }
  }

  const resolvedFixtures = gameState.seasonState.schedule
    .filter((fixture) => fixture.matchdayId === lastMatchdayId)
    .map((fixture) => fixture.id);

  return {
    ...gameState,
    gamePhase: "season_completed",
    season: { ...gameState.season, currentMatchday: matchdayIds.length },
    seasonState: {
      ...gameState.seasonState,
      standings,
      matchdayResults,
      standingsApplyLogs,
      playerDisciplinePerformances,
      schedule: (gameState.seasonState.schedule ?? []).map((fixture) =>
        fixture.matchdayId === lastMatchdayId ? { ...fixture, status: "resolved" as const } : fixture,
      ),
    },
    matchdayState: {
      matchdayId: lastMatchdayId,
      status: "resolved",
      pendingTeamIds: [],
      resolvedFixtureIds: resolvedFixtures,
    },
    logs: [
      ...gameState.logs,
      {
        id: `smoke-season-complete-${seasonId}-${Date.now()}`,
        type: "season",
        message: `${gameState.season.name} per Fast-Smoke abgeschlossen (keine MD-Simulation).`,
        createdAt: now,
      },
    ],
  };
}

export function collectTeamRows(gameState: GameState): TeamRow[] {
  const playerById = new Map(gameState.players.map((player) => [player.id, player]));
  return gameState.teams.map((team) => {
    const identity = gameState.teamIdentities.find((entry) => entry.teamId === team.teamId);
    const { playerMin, playerOpt } = deriveRosterTargets(team, identity);
    const hardMin = getTeamHardMinRequired(gameState, team.teamId);
    const rosterEntries = gameState.rosters.filter((entry) => entry.teamId === team.teamId);
    const roster = rosterEntries.length;
    let sumMw = 0;
    for (const entry of rosterEntries) {
      const player = playerById.get(entry.playerId);
      const economy = resolvePlayerEconomyContract({ player, rosterEntry: entry });
      sumMw += economy.marketValue ?? 0;
    }
    const atMin = roster >= playerMin;
    const atOpt = roster >= playerOpt;
    return {
      teamCode: team.shortCode ?? team.teamId,
      roster,
      playerMin,
      playerOpt,
      hardMin,
      cash: round(team.cash ?? 0),
      sumMw: round(sumMw),
      atMin,
      atOpt,
      status: atOpt ? "opt" : atMin ? "min" : "unter min",
    };
  });
}

export function countDraftBuys(gameState: GameState) {
  return gameState.transferHistory.filter(
    (entry) => entry.seasonId === "season-1" && entry.transferType === "buy" && entry.source === "ai_roster_fill",
  ).length;
}

function countSeasonTransfers(gameState: GameState, seasonId: string, type: "buy" | "sell") {
  return gameState.transferHistory.filter(
    (entry) =>
      entry.seasonId === seasonId &&
      entry.transferType === type &&
      (entry.source === "ai_preseason_market_buy" ||
        entry.source === "ai_preseason_market_sell" ||
        entry.source === "manual_transfer_window" ||
        entry.source === "preseason_roster_repair_buy"),
  ).length;
}

export function summarizeEngines(perTeam: Array<{ pickEngine?: string | null }>) {
  return perTeam.reduce(
    (counts, entry) => {
      const key = entry.pickEngine ?? "unknown";
      counts[key] = (counts[key] ?? 0) + 1;
      return counts;
    },
    {} as Record<string, number>,
  );
}

export function buildEconomyRows(
  gameState: GameState,
  prizePreview: CashPrizeApplyResult | null,
): EconomyRow[] {
  const prizeByTeam = new Map(
    (prizePreview?.plannedChanges ?? []).map((row) => [row.teamId, row.prizeMoney ?? 0] as const),
  );
  const sponsorByTeam = new Map<string, number>();
  for (const log of gameState.seasonState.sponsorPayoutLogs ?? []) {
    if (log.seasonId !== "season-1" || log.phase !== "season_end") continue;
    sponsorByTeam.set(log.teamId, (sponsorByTeam.get(log.teamId) ?? 0) + (log.cashDelta ?? 0));
  }

  return gameState.teams.map((team) => {
    const teamId = team.teamId;
    const teamCode = team.shortCode ?? teamId;
    const sellFeesS1 = round(
      gameState.transferHistory
        .filter((entry) => entry.seasonId === "season-1" && entry.transferType === "sell" && entry.fromTeamId === teamId)
        .reduce((sum, entry) => sum + (entry.fee ?? 0), 0),
    );
    const buyFeesS2 = round(
      gameState.transferHistory
        .filter((entry) => entry.seasonId === "season-2" && entry.transferType === "buy" && entry.toTeamId === teamId)
        .reduce((sum, entry) => sum + (entry.fee ?? 0), 0),
    );
    const salaryTotal = round(
      gameState.rosters
        .filter((entry) => entry.teamId === teamId)
        .reduce((sum, entry) => sum + (entry.salary ?? entry.upkeep ?? 0), 0),
    );
    const mwEnd = resolveTeamRosterMarketValue(gameState, teamId);
    const buffer10 = resolveTeamLiquidityBufferTarget(gameState, teamId);
    const cashEnd = round(team.cash ?? 0);
    const prizeBenchmark = round(prizeByTeam.get(teamId) ?? 0);
    const sponsorDelta = round(sponsorByTeam.get(teamId) ?? 0);
    const excessOverBuffer = round(Math.max(0, cashEnd - buffer10));
    const guvEstimate = round(prizeBenchmark + sponsorDelta - salaryTotal);
    return {
      teamCode,
      sellFeesS1,
      buyFeesS2,
      prizeBenchmark,
      sponsorDelta,
      salaryTotal,
      cashEnd,
      mwEnd,
      buffer10,
      excessOverBuffer,
      guvEstimate,
    };
  });
}

export function summarizeEconomy(rows: EconomyRow[], gameState: GameState) {
  const s1Sells = gameState.transferHistory.filter((e) => e.seasonId === "season-1" && e.transferType === "sell").length;
  const s2Buys = gameState.transferHistory.filter((e) => e.seasonId === "season-2" && e.transferType === "buy").length;
  return {
    rows,
    leagueSellFees: round(rows.reduce((sum, row) => sum + row.sellFeesS1, 0)),
    leagueBuyFeesS2: round(rows.reduce((sum, row) => sum + row.buyFeesS2, 0)),
    leaguePrizeBenchmark: round(rows.reduce((sum, row) => sum + row.prizeBenchmark, 0)),
    leagueSalaryTotal: round(rows.reduce((sum, row) => sum + row.salaryTotal, 0)),
    leagueExcessOverBuffer: round(rows.reduce((sum, row) => sum + row.excessOverBuffer, 0)),
    sellBuyCountGap: s1Sells - s2Buys,
  };
}

export type QuickSimSeasonEndStackResult = {
  save: PersistedSaveGame;
  prizePreview: CashPrizeApplyResult;
  sponsorApplied: boolean;
  sponsorGrossCashDelta: number;
  sponsorNetCashDelta: number;
  sponsorWarnings: string[];
  contractsReleased: number;
  contractsRenewed: number;
  contractExitCashDelta: number;
  facilityActionsApplied: number;
  facilityIncomeTotal: number;
  facilityUpkeepTotal: number;
};

function hasSeasonEndSponsorComponentPayout(gameState: GameState, seasonId: string) {
  return (gameState.seasonState.sponsorPayoutLogs ?? []).some(
    (log) =>
      log.seasonId === seasonId &&
      log.phase === "season_end" &&
      log.componentId !== "salary_deduct" &&
      log.cashDelta !== 0,
  );
}

export async function applyQuickSimSeasonEndStack(
  save: PersistedSaveGame,
  persistence: PersistenceService,
  bootstrapOpts: BootstrapOptions = {},
): Promise<QuickSimSeasonEndStackResult> {
  const seasonId = save.gameState.season.id;
  const lastMatchdayId = save.gameState.season.matchdayIds.at(-1) ?? save.gameState.matchdayState.matchdayId;
  let current = save;

  // Transfer-only sims: final standings must exist before sponsor rank payouts (no matchday sim).
  if ((current.gameState.gamePhase ?? "season_active") !== "season_completed") {
    current = persistence.saveSingleplayerState(
      current.saveId,
      bootstrapFastSeasonOneCompleted(current.gameState, current.saveId, bootstrapOpts),
    );
  }

  // Contract-tick BEFORE sponsor settlement: renew/release decisions change the roster's salary
  // total, which the sponsor salary-deduction step below needs to reflect. Without this, contracts
  // never naturally expire/renew in the transfer-only pipeline — every AI-initiated exit is forced
  // through the (buyout-heavy) market-sell path instead, which inflates buyout losses artificially.
  let contractsReleased = 0;
  let contractsRenewed = 0;
  let contractExitCashDelta = 0;
  const contractPreview = previewSeasonEndContracts(current);
  if (contractPreview.expiringCount > 0) {
    const contractApply = applySeasonEndContractTick(current, contractPreview.confirmToken, persistence, contractPreview);
    if (contractApply.applied) {
      current = persistence.getSaveById(current.saveId)!;
      contractsReleased = contractApply.releasedPlayers;
      contractsRenewed = contractApply.renewedPlayers;
      contractExitCashDelta = round(
        (current.gameState.seasonState.contractEvents ?? [])
          .filter((event) => event.seasonId === seasonId && event.eventType === "contract_expired_exit")
          .reduce((sum, event) => sum + (event.exitValue ?? 0), 0),
      );
    }
  }

  // Rough facility simulation: let AI teams build/upgrade/maintain facilities (bounded by their
  // own affordability gates inside the manager plan), then settle upkeep/income for whatever is
  // actually built — so facility costs show up in the balance instead of always being zero.
  const managerPlanResult = applyCanonicalManagerPlan(current, persistence, `${seasonId}_facilities`, S2_MANAGER_ACTION_TYPES);
  current = managerPlanResult.save;
  const facilityActionsApplied = managerPlanResult.appliedActions;

  let facilityIncomeTotal = 0;
  let facilityUpkeepTotal = 0;
  for (const team of current.gameState.teams) {
    const facilityPreview = previewFacilitySeasonEndFinance(current, team.teamId);
    if (!facilityPreview.ok || !facilityPreview.confirmToken) continue;
    const facilityApply = applyFacilitySeasonEndFinance(current, team.teamId, facilityPreview.confirmToken, persistence);
    if (facilityApply.applied) {
      current = persistence.getSaveById(current.saveId)!;
      facilityIncomeTotal += facilityPreview.facilityIncomeTotal;
      facilityUpkeepTotal += facilityPreview.facilityUpkeepTotal;
    }
  }
  facilityIncomeTotal = round(facilityIncomeTotal);
  facilityUpkeepTotal = round(facilityUpkeepTotal);

  let sponsorApplied = false;
  let sponsorGrossCashDelta = 0;
  let sponsorNetCashDelta = 0;
  let sponsorWarnings: string[] = [];

  const existingSponsorEndPayout = hasSeasonEndSponsorComponentPayout(current.gameState, seasonId);
  if (!existingSponsorEndPayout) {
    const withOffers = ensureSeasonSponsorOffers(current.gameState);
    const withContracts = chooseSponsorOfferForAiTeams(withOffers);
    if (withContracts !== current.gameState) {
      current = persistence.saveSingleplayerState(current.saveId, withContracts);
    }

    const sponsorApply = applySponsorSettlement({
      gameState: current.gameState,
      saveId: current.saveId,
      phase: "season_end",
      execute: true,
      deductSalary: true,
    });
    sponsorWarnings = sponsorApply.preview.warnings.slice(0, 12);
    sponsorGrossCashDelta = round(
      sponsorApply.preview.rows.reduce((sum, row) => sum + Math.max(0, row.cashDelta), 0),
    );
    sponsorNetCashDelta = round(sponsorApply.preview.totalCashDelta);
    if (sponsorApply.applied) {
      current = persistence.saveSingleplayerState(current.saveId, sponsorApply.gameState);
      sponsorApplied = true;
      const logs = current.gameState.seasonState.sponsorPayoutLogs ?? [];
      sponsorNetCashDelta = round(
        logs
          .filter((log) => log.seasonId === seasonId && log.phase === "season_end")
          .reduce((sum, log) => sum + log.cashDelta, 0),
      );
      sponsorGrossCashDelta = round(
        logs
          .filter(
            (log) =>
              log.seasonId === seasonId &&
              log.phase === "season_end" &&
              log.componentId !== "salary_deduct" &&
              log.cashDelta > 0,
          )
          .reduce((sum, log) => sum + log.cashDelta, 0),
      );
    } else if (sponsorApply.preview.canApply) {
      sponsorWarnings.push("sponsor_settlement_can_apply_but_not_applied");
    }
  }

  const prizePreview = await previewCashPrizeApply(
    {
      saveId: current.saveId,
      seasonId,
      matchdayId: lastMatchdayId,
      source: "sqlite",
      phase: "season_end",
    },
    persistence,
  );

  return {
    save: current,
    prizePreview,
    sponsorApplied,
    sponsorGrossCashDelta,
    sponsorNetCashDelta,
    sponsorWarnings,
    contractsReleased,
    contractsRenewed,
    contractExitCashDelta,
    facilityActionsApplied,
    facilityIncomeTotal,
    facilityUpkeepTotal,
  };
}

/** Deep-copy SQLite via VACUUM INTO — avoids hardlink/WAL pollution between batch runs. */
export function cloneSourceDatabase(sourceDbPath: string, outputDir: string): string {
  fs.mkdirSync(outputDir, { recursive: true });
  const targetPath = path.join(outputDir, "balancing-run.sqlite");
  closeDatabaseForMaintenance();
  const db = new Database(sourceDbPath, { readonly: true });
  try {
    db.exec(`VACUUM INTO '${targetPath.replace(/'/g, "''")}'`);
  } finally {
    db.close();
  }
  for (const suffix of ["-wal", "-shm"]) {
    const sidecar = `${targetPath}${suffix}`;
    if (fs.existsSync(sidecar)) fs.unlinkSync(sidecar);
  }
  process.env.OLY_APP_SQLITE_PATH = targetPath;
  return targetPath;
}

export function setAllTeamsAi(save: PersistedSaveGame, persistence: PersistenceService) {
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
        notes: "s1_s2_transfer",
        strategyLock: null,
      } satisfies TeamControlSettings,
    ]),
  );
  return persistence.saveSingleplayerState(save.saveId, {
    ...save.gameState,
    teams: save.gameState.teams.map((team) => ({ ...team, humanControlled: false })),
    seasonState: {
      ...save.gameState.seasonState,
      teamControlSettings: settings,
    },
  });
}

export async function runEmergencyRepairIfNeeded(input: {
  saveId: string;
  seasonId: string;
  persistence: PersistenceService;
  outputDir: string;
}) {
  let save = input.persistence.getSaveById(input.saveId);
  if (!save) return 0;

  const collectTeamIds = () => {
    const needing = getTeamsNeedingConvergence(save!.gameState).map((entry) => entry.teamId);
    const belowMin = save!.gameState.teams
      .filter((team) => {
        const roster = save!.gameState.rosters.filter((entry) => entry.teamId === team.teamId).length;
        return roster < getTeamHardMinRequired(save!.gameState, team.teamId);
      })
      .map((team) => team.teamId);
    return [...new Set([...needing, ...belowMin])];
  };

  let teamIds = collectTeamIds();
  if (teamIds.length === 0) return 0;

  await runCompareRescueBeforeEmergencyRepair({
    saveId: input.saveId,
    seasonId: input.seasonId,
    teamIds,
    persistence: input.persistence,
  });
  save = input.persistence.getSaveById(input.saveId)!;
  teamIds = collectTeamIds();
  if (teamIds.length === 0) return 0;

  runEmergencyRosterRepairForTeams({
    saveId: input.saveId,
    seasonId: input.seasonId,
    teamIds,
    persistence: input.persistence,
    outputDir: input.outputDir,
  });
  return teamIds.length;
}

export type RunTransferPipelineInput = {
  label: string;
  save: PersistedSaveGame;
  persistence: PersistenceService;
  outputDir: string;
  sqlitePath: string;
  startedAt: number;
  bootstrapOpts?: BootstrapOptions;
  draftMeta?: TransferRunResult["draft"];
  logTag?: string;
};

function filterPreseasonHardBlockers(blockers: string[], finalRows: TeamRow[]): string[] {
  const atMinTeams = new Set(finalRows.filter((row) => row.atMin).map((row) => row.teamCode));
  return blockers.filter((blocker) => {
    if (!blocker.includes("insufficient_cash") && !blocker.includes("preview_execute_drift")) {
      return true;
    }
    const teamMatch = blocker.match(/preseason_batch_team:([^:]+):/);
    if (teamMatch && atMinTeams.has(teamMatch[1])) {
      return false;
    }
    if (blocker === "insufficient_cash" || blocker === "preview_execute_drift_blocked") {
      return false;
    }
    return true;
  });
}

export async function runTransferPipeline(input: RunTransferPipelineInput): Promise<TransferRunResult> {
  process.env.OLY_TRANSFER_PIPELINE_FAST = "1";
  const tag = input.logTag ?? "s1-s2-transfer";
  let save = input.save;
  const persistence = input.persistence;

  log(`${input.label}: season-end stack (sponsor apply + prize benchmark)…`, tag);
  const seasonEndStack = await applyQuickSimSeasonEndStack(save, persistence, input.bootstrapOpts ?? {});
  save = seasonEndStack.save;
  log(
    `${input.label}: sponsor gross=${seasonEndStack.sponsorGrossCashDelta} net=${seasonEndStack.sponsorNetCashDelta} applied=${seasonEndStack.sponsorApplied}`,
    tag,
  );

  const rosterBeforeSell = collectTeamRows(save.gameState);
  const draftRows = input.draftMeta ? null : collectTeamRows(save.gameState);
  const draftResult = input.draftMeta ?? {
    picks: countDraftBuys(save.gameState),
    teamsAtMin: draftRows!.filter((row) => row.atMin).length,
    teamsAtOpt: draftRows!.filter((row) => row.atOpt).length,
    avgCash: round(draftRows!.reduce((sum, row) => sum + row.cash, 0) / Math.max(1, draftRows!.length)),
    blockers: [],
  };

  log(`${input.label}: S1 season_end sell…`, tag);
  const allowSeasonEndBuys = isTransferActionAllowed("season-1", "season_end_market_buy");
  const seasonEndSession = await runTransferWindowSession({
    saveId: save.saveId,
    seasonId: "season-1",
    persistence,
    phase: "season_end",
    dryRun: false,
    confirmToken: AI_MARKET_APPLY_CONFIRM_TOKEN,
    transferPhase: "manual_transfer_window",
    teamScope: "all",
    maxTeamCycles: getLongRunPlannerMaxTeamCycles(),
    maxLeagueRounds: getLongRunPlannerMaxLeagueRounds(),
    allowBuys: allowSeasonEndBuys,
    skipIfExistingMarketTransfers: false,
    progressLog: true,
  });

  save = persistence.getSaveById(save.saveId)!;
  const afterSellRows = collectTeamRows(save.gameState);
  const sellHistory = save.gameState.transferHistory.filter(
    (entry) =>
      entry.seasonId === "season-1" &&
      entry.transferType === "sell" &&
      (entry.source === "ai_preseason_market_sell" || entry.source === "manual_transfer_window"),
  );
  const teamsWithSell = new Set(sellHistory.map((entry) => entry.fromTeamId)).size;
  const zeroRosterTeams = afterSellRows.filter((row) => row.roster === 0).map((row) => row.teamCode);
  const seasonEndAudit = runPhaseAuditDe(save, "season_end");

  log(`${input.label}: transition S1 → S2…`, tag);
  const setup = buildPreSeasonNextSeasonSetupToken(save);
  const next = applyPreSeasonNextSeasonSetupLightweight(save, setup.confirmToken, persistence);
  if (!next.applied) {
    throw new Error(`${input.label}: S2 transition blocked: ${next.blockingReasons.join(" | ")}`);
  }
  save = persistence.getSaveById(save.saveId)!;
  if (save.gameState.season.id !== "season-2") {
    throw new Error(`${input.label}: expected season-2, got ${save.gameState.season.id}`);
  }

  log(`${input.label}: S2 preseason cash recovery…`, tag);
  await runPreseasonProactiveCashRecovery({ saveId: save.saveId, seasonId: "season-2", persistence });

  log(`${input.label}: S2 preseason buy…`, tag);
  const preseasonSession = await runTransferWindowSession({
    saveId: save.saveId,
    seasonId: "season-2",
    persistence,
    phase: "preseason",
    dryRun: false,
    confirmToken: AI_MARKET_APPLY_CONFIRM_TOKEN,
    transferPhase: "manual_transfer_window",
    teamScope: "all",
    maxTeamCycles: getLongRunPlannerMaxTeamCycles(),
    maxLeagueRounds: getLongRunPlannerMaxLeagueRounds(),
    allowBuys: true,
    skipIfExistingMarketTransfers: false,
    progressLog: true,
  });

  const emergencyRepairTeams = await runEmergencyRepairIfNeeded({
    saveId: save.saveId,
    seasonId: "season-2",
    persistence,
    outputDir: input.outputDir,
  });

  save = persistence.getSaveById(save.saveId)!;
  const finalRows = collectTeamRows(save.gameState);
  const preseasonAudit = runPhaseAuditDe(save, "preseason");
  const economyRows = buildEconomyRows(save.gameState, seasonEndStack.prizePreview);
  const economySummary = summarizeEconomy(economyRows, save.gameState);

  const belowHardMin = finalRows.filter((row) => row.roster < row.hardMin).map((row) => `${row.teamCode}:${row.roster}/${row.hardMin}`);
  const negativeCash = save.gameState.teams.filter((team) => (team.cash ?? 0) < 0).map((team) => team.shortCode);

  const hardFails: string[] = [];
  if (belowHardMin.length > 0) hardFails.push(`below_hard_min:${belowHardMin.join(",")}`);
  if (zeroRosterTeams.length > 0 && finalRows.some((row) => row.roster === 0)) {
    hardFails.push(`zero_roster_after_pipeline:${finalRows.filter((row) => row.roster === 0).map((row) => row.teamCode).join(",")}`);
  }
  if (negativeCash.length > 0) hardFails.push(`negative_cash:${negativeCash.join(",")}`);
  if (seasonEndSession.blockingReasons.length > 0) {
    hardFails.push(`season_end_blockers:${seasonEndSession.blockingReasons.slice(0, 5).join("|")}`);
  }
  const preseasonHardBlockers = filterPreseasonHardBlockers(preseasonSession.blockingReasons, finalRows);
  if (preseasonHardBlockers.length > 0) {
    hardFails.push(`preseason_blockers:${preseasonHardBlockers.slice(0, 5).join("|")}`);
  }

  const result: TransferRunResult = {
    label: input.label,
    saveId: save.saveId,
    sqlitePath: input.sqlitePath,
    outputDir: input.outputDir,
    durationMs: Date.now() - input.startedAt,
    draft: draftResult,
    afterSell: {
      totalSells: seasonEndSession.appliedSells,
      teamsWithSell,
      zeroRosterTeams,
      teamRows: afterSellRows,
      blockingReasons: seasonEndSession.blockingReasons,
    },
    afterPreseason: {
      totalBuys: preseasonSession.appliedBuys,
      totalSells: preseasonSession.appliedSells,
      teamsAtMin: finalRows.filter((row) => row.atMin).length,
      teamsAtOpt: finalRows.filter((row) => row.atOpt).length,
      avgCash: round(finalRows.reduce((sum, row) => sum + row.cash, 0) / Math.max(1, finalRows.length)),
      belowHardMin,
      negativeCash,
      engineSummary: summarizeEngines(preseasonSession.perTeam),
      blockingReasons: preseasonSession.blockingReasons,
      warnings: preseasonSession.warnings.slice(0, 20),
      emergencyRepairTeams,
    },
    economy: economySummary,
    audits: { seasonEnd: seasonEndAudit, preseason: preseasonAudit },
    hardFails,
  };

  writeRunArtifacts(result, finalRows, rosterBeforeSell, economyRows);
  log(
    `${input.label}: sell=${seasonEndSession.appliedSells} buy=${preseasonSession.appliedBuys} gap=${economySummary.sellBuyCountGap} excessBuf=${economySummary.leagueExcessOverBuffer} min=${result.afterPreseason.teamsAtMin}/32 opt=${result.afterPreseason.teamsAtOpt}/32 (${Math.round(result.durationMs / 1000)}s)`,
    tag,
  );
  return result;
}

function writeRunArtifacts(result: TransferRunResult, finalRows: TeamRow[], rosterBeforeSell: TeamRow[], economyRows: EconomyRow[]) {
  fs.writeFileSync(path.join(result.outputDir, "run-result.json"), JSON.stringify(result, null, 2));
  fs.writeFileSync(path.join(result.outputDir, "team-rows-after-preseason.json"), JSON.stringify(finalRows, null, 2));
  fs.writeFileSync(path.join(result.outputDir, "roster-before-sell.json"), JSON.stringify(rosterBeforeSell, null, 2));
  fs.writeFileSync(path.join(result.outputDir, "economy-rows.json"), JSON.stringify(economyRows, null, 2));
  fs.writeFileSync(
    path.join(result.outputDir, "economy-rows.csv"),
    [
      "teamCode,sellFeesS1,buyFeesS2,prizeBenchmark,sponsorDelta,salaryTotal,cashEnd,mwEnd,buffer10,excessOverBuffer,guvEstimate",
      ...economyRows.map((row) =>
        [
          row.teamCode,
          row.sellFeesS1,
          row.buyFeesS2,
          row.prizeBenchmark,
          row.sponsorDelta,
          row.salaryTotal,
          row.cashEnd,
          row.mwEnd,
          row.buffer10,
          row.excessOverBuffer,
          row.guvEstimate,
        ].join(","),
      ),
    ].join("\n"),
  );
}

function buildTeamTableMarkdown(rows: TeamRow[], title: string) {
  const lines = [
    `### ${title}`,
    "",
    "| Team | Spieler | HardMin | Opt | Cash | MW | Status |",
    "| --- | ---: | ---: | ---: | ---: | ---: | --- |",
  ];
  for (const row of rows.sort((left, right) => left.teamCode.localeCompare(right.teamCode))) {
    const highlight = SPECIAL_TEAMS.includes(row.teamCode as (typeof SPECIAL_TEAMS)[number]);
    const prefix = highlight ? "**" : "";
    const suffix = highlight ? "**" : "";
    lines.push(
      `| ${prefix}${row.teamCode}${suffix} | ${row.roster} | ${row.hardMin} | ${row.playerOpt} | ${row.cash} | ${row.sumMw} | ${row.status} |`,
    );
  }
  return lines;
}

function buildEconomyTableMarkdown(rows: EconomyRow[]) {
  const lines = [
    "### Economy (S2-Ende)",
    "",
    `Puffer-Ziel: ${PLANNER_LIQUIDITY_BUFFER_MW_RATIO * 100}% MW (soft)`,
    "",
    "| Team | Sell S1 | Buy S2 | Prize | Sponsor | Salary | Cash | MW | Buffer10 | Excess | GuV~ |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];
  for (const row of rows.sort((left, right) => right.excessOverBuffer - left.excessOverBuffer)) {
    lines.push(
      `| ${row.teamCode} | ${row.sellFeesS1} | ${row.buyFeesS2} | ${row.prizeBenchmark} | ${row.sponsorDelta} | ${row.salaryTotal} | ${row.cashEnd} | ${row.mwEnd} | ${row.buffer10} | ${row.excessOverBuffer} | ${row.guvEstimate} |`,
    );
  }
  return lines;
}

export function buildTransferReport(results: TransferRunResult[], title: string, intro: string) {
  const lines = [
    `# ${title}`,
    "",
    intro,
    "",
    "## Zusammenfassung",
    "",
    "| Run | Draft | S1 Sells | S2 Buys | Sell/Buy Gap | Min | Opt | Ø Cash | Excess>10%MW | Hard |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
  ];

  for (const row of results) {
    lines.push(
      `| ${row.label} | ${row.draft.picks} | ${row.afterSell.totalSells} | ${row.afterPreseason.totalBuys} | ${row.economy.sellBuyCountGap} | ${row.afterPreseason.teamsAtMin}/32 | ${row.afterPreseason.teamsAtOpt}/32 (${pct(row.afterPreseason.teamsAtOpt, 32)}%) | ${row.afterPreseason.avgCash} | ${row.economy.leagueExcessOverBuffer} | ${row.hardFails.length === 0 ? "grün" : "rot"} |`,
    );
  }

  for (const row of results) {
    lines.push(
      "",
      `## ${row.label}`,
      "",
      `- Save: \`${row.saveId}\``,
      `- Dauer: ${Math.round(row.durationMs / 1000)}s`,
      `- S1 Sell-Fees: ${row.economy.leagueSellFees} · S2 Buy-Fees: ${row.economy.leagueBuyFeesS2}`,
      `- Preisgeld-Benchmark: ${row.economy.leaguePrizeBenchmark} · Liga-Salary: ${row.economy.leagueSalaryTotal}`,
      `- Draft: ${row.draft.picks} Picks, Min ${row.draft.teamsAtMin}/32, Opt ${row.draft.teamsAtOpt}/32`,
      `- S1-Ende: ${row.afterSell.totalSells} Sells, Zero-Roster: ${row.afterSell.zeroRosterTeams.join(", ") || "keine"}`,
      `- S2-Preseason: ${row.afterPreseason.totalBuys} Buys, Repair-Teams: ${row.afterPreseason.emergencyRepairTeams}`,
      `- Engine: ${Object.entries(row.afterPreseason.engineSummary).map(([k, v]) => `${k}=${v}`).join(", ") || "—"}`,
    );
    if (row.hardFails.length > 0) {
      lines.push("", "**Hard-Fails:**");
      for (const fail of row.hardFails) lines.push(`- ${fail}`);
    }
    lines.push(
      "",
      formatPhaseAuditSummaryDe(row.audits.seasonEnd),
      "",
      formatPhaseAuditSummaryDe(row.audits.preseason),
    );
    const teamRowsPath = path.join(row.outputDir, "team-rows-after-preseason.json");
    if (fs.existsSync(teamRowsPath)) {
      const parsed = JSON.parse(fs.readFileSync(teamRowsPath, "utf8")) as TeamRow[];
      lines.push("", ...buildTeamTableMarkdown(parsed, `${row.label} — Teams nach S2-Preseason`));
    }
    const economyPath = path.join(row.outputDir, "economy-rows.json");
    if (fs.existsSync(economyPath)) {
      const parsed = JSON.parse(fs.readFileSync(economyPath, "utf8")) as EconomyRow[];
      lines.push("", ...buildEconomyTableMarkdown(parsed));
    }
  }

  const last = results.at(-1);
  if (last) {
    lines.push("", "## Output", "", `- Report-Ordner: \`${path.dirname(last.outputDir)}\``);
    lines.push(
      "",
      "## Fazit",
      "",
      last.hardFails.length === 0
        ? "Hard-KPIs grün. Sell/Buy-Ratio und Cash-Excess über 10%-MW-Puffer im Economy-Block prüfen."
        : "Hard-KPIs rot — Transfer-Convergence / Cash-Policy nachziehen.",
    );
  }

  return lines.join("\n");
}

export type RunKpiSnapshot = {
  label: string;
  saveId: string;
  seasonId: string;
  gamePhase: string;
  teamRows: TeamRow[];
  economy: ReturnType<typeof summarizeEconomy>;
  teamsAtMin: number;
  teamsAtOpt: number;
  avgCash: number;
  s1SellCount: number;
  s2BuyCount: number;
  hardFails: string[];
};

export function validatePostS2PreseasonCheckpoint(gameState: GameState): string[] {
  const fails: string[] = [];
  if (gameState.season.id !== "season-2") fails.push(`expected season-2, got ${gameState.season.id}`);
  if ((gameState.gamePhase ?? "") !== "season_active") fails.push(`expected season_active, got ${gameState.gamePhase ?? "missing"}`);
  const rows = collectTeamRows(gameState);
  if (rows.some((row) => row.roster < row.hardMin)) {
    fails.push(`teams below hard-min: ${rows.filter((row) => row.roster < row.hardMin).map((row) => row.teamCode).join(", ")}`);
  }
  if (rows.some((row) => row.cash < 0)) {
    fails.push(`negative cash: ${rows.filter((row) => row.cash < 0).map((row) => row.teamCode).join(", ")}`);
  }
  return fails;
}

export function buildRunKpiSnapshot(
  label: string,
  save: PersistedSaveGame,
  prizePreview?: CashPrizeApplyResult | null,
): RunKpiSnapshot {
  const economyRows = buildEconomyRows(save.gameState, prizePreview ?? null);
  const economy = summarizeEconomy(economyRows, save.gameState);
  const teamRows = collectTeamRows(save.gameState);
  return {
    label,
    saveId: save.saveId,
    seasonId: save.gameState.season.id,
    gamePhase: save.gameState.gamePhase ?? "unknown",
    teamRows,
    economy,
    teamsAtMin: teamRows.filter((row) => row.atMin).length,
    teamsAtOpt: teamRows.filter((row) => row.atOpt).length,
    avgCash: round(teamRows.reduce((sum, row) => sum + row.cash, 0) / Math.max(1, teamRows.length)),
    s1SellCount: save.gameState.transferHistory.filter((e) => e.seasonId === "season-1" && e.transferType === "sell").length,
    s2BuyCount: save.gameState.transferHistory.filter((e) => e.seasonId === "season-2" && e.transferType === "buy").length,
    hardFails: validatePostS2PreseasonCheckpoint(save.gameState),
  };
}

export function loadBenchmarkSnapshotFromOutput(benchmarkPath: string): RunKpiSnapshot | null {
  const resolved = path.isAbsolute(benchmarkPath) ? benchmarkPath : path.join(PROJECT_ROOT, benchmarkPath);
  const summaryPath = fs.statSync(resolved).isDirectory()
    ? path.join(resolved, "transfer-summary.json")
    : resolved;
  if (!fs.existsSync(summaryPath)) return null;
  const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8")) as {
    runs?: Array<{
      label?: string;
      saveId?: string;
      economy?: ReturnType<typeof summarizeEconomy>;
      afterPreseason?: { teamsAtMin?: number; teamsAtOpt?: number; avgCash?: number; totalBuys?: number };
      hardFails?: string[];
    }>;
  };
  const run = summary.runs?.[0];
  if (!run) return null;
  const runDir = path.dirname(summaryPath);
  const teamRowsPath = fs
    .readdirSync(runDir)
    .filter((name) => name.startsWith("run1-"))
    .map((name) => path.join(runDir, name, "team-rows-after-preseason.json"))
    .find((candidate) => fs.existsSync(candidate));
  const teamRows = teamRowsPath
    ? (JSON.parse(fs.readFileSync(teamRowsPath, "utf8")) as TeamRow[])
    : [];
  const s2BuyCount = run.afterPreseason?.totalBuys ?? 0;
  const sellBuyGap = run.economy?.sellBuyCountGap ?? 0;
  return {
    label: "Fast-Smoke Benchmark",
    saveId: run.saveId ?? "benchmark",
    seasonId: "season-2",
    gamePhase: "season_active",
    teamRows,
    economy: run.economy ?? {
      rows: [],
      leagueSellFees: 0,
      leagueBuyFeesS2: 0,
      leaguePrizeBenchmark: 0,
      leagueSalaryTotal: 0,
      leagueExcessOverBuffer: 0,
      sellBuyCountGap: 0,
    },
    teamsAtMin: run.afterPreseason?.teamsAtMin ?? 0,
    teamsAtOpt: run.afterPreseason?.teamsAtOpt ?? 0,
    avgCash: run.afterPreseason?.avgCash ?? 0,
    s1SellCount: s2BuyCount + sellBuyGap,
    s2BuyCount,
    hardFails: run.hardFails ?? [],
  };
}

export function buildBenchmarkComparisonMarkdown(benchmark: RunKpiSnapshot, real: RunKpiSnapshot) {
  const lines = [
    "# S1→S2 Benchmark-Vergleich",
    "",
    "Checkpoint: **S2 nach Preseason** (vor Spieltag 1).",
    "",
    "## Liga-KPIs",
    "",
    "| KPI | Benchmark | Real Run | Delta |",
    "| --- | ---: | ---: | ---: |",
    `| S1 Sell-Count | ${benchmark.s1SellCount} | ${real.s1SellCount} | ${real.s1SellCount - benchmark.s1SellCount} |`,
    `| S2 Buy-Count | ${benchmark.s2BuyCount} | ${real.s2BuyCount} | ${real.s2BuyCount - benchmark.s2BuyCount} |`,
    `| Sell/Buy Gap | ${benchmark.economy.sellBuyCountGap} | ${real.economy.sellBuyCountGap} | ${real.economy.sellBuyCountGap - benchmark.economy.sellBuyCountGap} |`,
    `| Teams ≥ Min | ${benchmark.teamsAtMin}/32 | ${real.teamsAtMin}/32 | ${real.teamsAtMin - benchmark.teamsAtMin} |`,
    `| Teams ≥ Opt | ${benchmark.teamsAtOpt}/32 (${pct(benchmark.teamsAtOpt, 32)}) | ${real.teamsAtOpt}/32 (${pct(real.teamsAtOpt, 32)}) | ${real.teamsAtOpt - benchmark.teamsAtOpt} |`,
    `| Ø Cash | ${benchmark.avgCash} | ${real.avgCash} | ${round(real.avgCash - benchmark.avgCash)} |`,
    `| Liga Excess >10% MW | ${benchmark.economy.leagueExcessOverBuffer} | ${real.economy.leagueExcessOverBuffer} | ${round(real.economy.leagueExcessOverBuffer - benchmark.economy.leagueExcessOverBuffer)} |`,
    `| Liga Preisgeld (S1) | ${benchmark.economy.leaguePrizeBenchmark} | ${real.economy.leaguePrizeBenchmark} | ${round(real.economy.leaguePrizeBenchmark - benchmark.economy.leaguePrizeBenchmark)} |`,
    "",
    "## Teams (Real Run)",
    "",
    "| Team | Spieler | Opt | Cash | MW | Status |",
    "| --- | ---: | ---: | ---: | ---: | --- |",
    ...real.teamRows.map(
      (row) =>
        `| ${SPECIAL_TEAMS.includes(row.teamCode as (typeof SPECIAL_TEAMS)[number]) ? `**${row.teamCode}**` : row.teamCode} | ${row.roster} | ${row.playerOpt} | ${row.cash} | ${row.sumMw} | ${row.status} |`,
    ),
  ];
  if (benchmark.teamRows.length > 0) {
    lines.push("", "## Teams (Benchmark)", "", "| Team | Spieler | Opt | Cash | MW | Status |", "| --- | ---: | ---: | ---: | ---: | --- |");
    lines.push(
      ...benchmark.teamRows.map(
        (row) => `| ${row.teamCode} | ${row.roster} | ${row.playerOpt} | ${row.cash} | ${row.sumMw} | ${row.status} |`,
      ),
    );
  }
  return lines.join("\n");
}

export function resolvePersistenceFromEnv() {
  return createPersistenceService();
}
