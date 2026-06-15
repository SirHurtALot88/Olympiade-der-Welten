import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

import { loadEnvConfig } from "@next/env";

import { AI_MARKET_APPLY_CONFIRM_TOKEN } from "@/lib/ai/ai-market-plan-apply-contract";
import { applyAiMarketPlanLocally } from "@/lib/ai/ai-market-plan-apply-service";
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
import { buildPlayerMoraleAudit } from "@/lib/morale/player-morale-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { SEASON_START_RESET_CONFIRM_TOKEN } from "@/lib/persistence/season-start-reset-contract";
import { runSeasonStartReset } from "@/lib/persistence/season-start-reset-service";
import { withScenarioMeta } from "@/lib/persistence/scenario-meta";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";
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

function prepSeasonLineups(saveId: string, seasonId: string) {
  console.error(`[long-run] autoprep ${seasonId}`);
  execFileSync("npm", ["exec", "--", "tsx", "scripts/season1-autoprep.ts", "--write"], {
    cwd: PROJECT_ROOT,
    stdio: "pipe",
    env: {
      ...process.env,
      OLY_TARGET_SAVE_ID: saveId,
      OLY_TARGET_SEASON_ID: seasonId,
      OLY_EXPORT_PREFIX: `long-run-${seasonId}`,
    },
  });
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
  const xpAuditNote = "ai_xp_apply_skipped_performance_block";
  const rosteredPlayerIds = new Set(save.gameState.rosters.map((entry) => entry.playerId));
  const rosteredPlayers = save.gameState.players.filter((player) => rosteredPlayerIds.has(player.id));
  xpPositive = rosteredPlayers.filter((player) => Number((player as { currentXP?: number; xp?: number }).currentXP ?? (player as { currentXP?: number; xp?: number }).xp ?? 0) > 0).length;
  xpStagnant = rosteredPlayers.length - xpPositive;
  recordPhase(performanceRows, {
    seasonId,
    phase: "season end training/development",
    startedAt,
    itemCount: rosteredPlayers.length,
    status: "skipped",
    note: xpAuditNote,
  });

  save = persistence.getSaveById(saveId);
  if (!save) throw new Error("Long-run save disappeared before contracts.");
  console.error(`[long-run] season-end ${seasonId}: contracts`);
  startedAt = Date.now();
  const contractPreview = previewSeasonEndContracts(save);
  let contractApply = null as ReturnType<typeof applySeasonEndContractTick> | null;
  if (contractPreview.blockingReasons.length === 0) {
    contractApply = applySeasonEndContractTick(save, contractPreview.confirmToken, persistence);
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
      applySellSteps: false,
      applyBuySteps: true,
      maxBuysPerTeam: null,
      maxSellsPerTeam: 0,
      previewBuyLimit: 48,
      previewSellLimit: 0,
      performanceBudgetMs: 8_000,
      stopOnTeamFailure: false,
    },
  });
  if (market.status === "blocked") blockers.push(...market.blockingReasons.map((entry) => `ai_market:${entry}`));
  recordPhase(performanceRows, {
    seasonId,
    phase: "season end ai market",
    startedAt,
    itemCount: market.summary.appliedBuys + market.summary.appliedSells,
    status: market.status === "blocked" ? "blocked" : "ok",
    note: [...market.blockingReasons, ...market.warnings].join("|"),
  });

  rows.push({
    seasonId,
    totalPrizeMoney: round(totalPrizeMoney),
    facilityAppliedTeams,
    xpAppliedPlayers,
    xpPositive,
    xpStagnant,
    xpNegative,
    xpAuditNote,
    contractReleasedPlayers: contractApply?.releasedPlayers ?? 0,
    contractRenewedPlayers: contractApply?.renewedPlayers ?? 0,
    contractEventsWritten: contractApply?.contractEventsWritten ?? 0,
    aiMarketStatus: market.status,
    aiMarketExecutedSells: market.summary.appliedSells,
    aiMarketExecutedBuys: market.summary.appliedBuys,
    aiMarketBlockedTeams: market.summary.blockedTeams,
    aiMarketWarnings: market.warnings.join("|"),
    blockers: blockers.join("|"),
  });

  return { rows, performanceRows, blockers, totalPrizeMoney, aiMarketStatus: market.status };
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
      xpSpent: entry.xpSpent,
      upgradeCount: entry.upgrades?.length ?? 0,
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
    const topUp = topUpSeasonOneToTargets(save.saveId, persistence);
    if (topUp.blockers.length > 0) {
      throw new Error(`S1 top-up blocked: ${topUp.blockers.join(" | ")}`);
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

  for (let seasonNumber = 1; seasonNumber <= TARGET_FINAL_SEASON; seasonNumber += 1) {
    save = persistence.getSaveById(save.saveId) ?? save;
    const seasonId = save.gameState.season.id;
    if (parseSeasonNumber(seasonId) !== seasonNumber) {
      throw new Error(`Expected season-${seasonNumber}, got ${seasonId}.`);
    }
    console.error(`[long-run] season ${seasonId} start`);
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

  const seasonHistory = finalSave.gameState.seasonState.seasonSnapshots ?? [];
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
      historyHasS1ToFinal: seasonHistory.map((entry) => entry.seasonId),
      medals: medalRows.length,
    },
    technicalBugsFixed,
    openTechnicalBugs,
    balanceIssues: Array.from(new Set(balanceIssues)),
    recommendations: [
      allSeasonSummaries.some((entry) => entry.lineupBlockers > 0)
        ? "Roster-Max 14/15 weiter testen, weil Lineup-Druck auftrat."
        : "Roster-Max 12 wirkt im Long-Run technisch spielbar; Rotation trotzdem mit Balance-Audit vergleichen.",
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
  writeCsv("performance-longrun-s1-s6.csv", performanceRows);
  writeOutput(
    "balance-issues-report.md",
    [`# Balance Issues`, "", ...(summary.balanceIssues.length ? summary.balanceIssues.map((entry) => `- ${entry}`) : ["- Keine Balance-Flags."])].join("\n"),
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
