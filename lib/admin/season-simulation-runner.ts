import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { AI_MARKET_APPLY_CONFIRM_TOKEN } from "@/lib/ai/ai-market-plan-apply-contract";
import { applyAiMarketPlanLocally } from "@/lib/ai/ai-market-plan-apply-service";
import { buildAiTeamManagementPreview } from "@/lib/ai/ai-team-management-preview-service";
import { applySeasonEndContractTick, previewSeasonEndContracts } from "@/lib/contracts/contract-renewal-service";
import type {
  AiManagerTrainingSettingRecord,
  FacilityEventRecord,
  GamePhase,
  GameState,
  PlayerMoraleState,
  PlayerRelationshipEventRecord,
  RosterEntry,
  TeamControlSettings,
  TransferHistoryEntry,
} from "@/lib/data/olyDataTypes";
import { FACILITY_CATALOG_BY_ID, type FacilityId } from "@/lib/facilities/facility-catalog";
import { FACILITY_CONDITION_FULL } from "@/lib/facilities/facility-condition";
import { getTeamFacilityState } from "@/lib/facilities/facility-effects";
import { previewFacilityMaintenance } from "@/lib/facilities/facility-maintenance-service";
import { buildTeamObjectiveOverview } from "@/lib/board/team-season-objectives-service";
import { buildTeamControlSettingsMap, isAiLineupBatchApplyEnabled } from "@/lib/foundation/team-control-settings";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { deriveRosterTargets } from "@/lib/foundation/roster-limits";
import { getTeamStrategyProfile } from "@/lib/foundation/team-strategy-profiles";
import { ensureLocalFormCardsForSeason } from "@/lib/lineups/legacy-lineup-modifiers";
import { LOCAL_TRANSFER_WINDOW_PHASE } from "@/lib/market/transfer-window-policy";
import { buildTransfermarktSaleFactorBreakdown, normalizeVisibleRosterMoney } from "@/lib/market/transfermarkt-sale-factor";
import {
  createLocalTransfermarktRunContext,
  executeLocalTransfermarktBuy,
  executeLocalTransfermarktSell,
  flushLocalTransfermarktRunContext,
  listLocalTransfermarktFreeAgents,
  previewLocalTransfermarktSell,
  type LocalTransfermarktRunContext,
} from "@/lib/market/transfermarkt-local-service";
import { assessPlayerMorale } from "@/lib/morale/player-morale-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { assertOlyProjectRoot } from "@/lib/persistence/project-root-guard";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";
import { previewAiSeasonEndXpSpend } from "@/lib/progression/ai-xp-spend-planner";
import { applySeasonEndXpSpend, previewSeasonEndXpSpend } from "@/lib/progression/season-end-xp-apply-service";
import { CASH_PRIZE_APPLY_CONFIRM_TOKEN, executeCashPrizeApply } from "@/lib/season/cash-prize-apply-service";
import { MATCHDAY_AUTO_RUN_CONFIRM_TOKEN, runLocalMatchdayAutoRun } from "@/lib/season/matchday-auto-run-service";
import { ADVANCE_MATCHDAY_CONFIRM_TOKEN, executeMatchdayAdvance } from "@/lib/season/matchday-progress-service";
import {
  applyPreSeasonNextSeasonSetupLightweight,
  buildPreSeasonNextSeasonSetupToken,
} from "@/lib/season/preseason-workflow-service";
import { getCanonicalSeasonLabel } from "@/lib/season/season-label";
import { previewTeamTrainingSettings } from "@/lib/training/training-settings-service";

export type AdminSeasonSimulationAction = "start" | "status" | "tick" | "pause" | "resume" | "cancel";
export type AdminSeasonSimulationMode = "dry_run" | "apply";
export type AdminSeasonSimulationStatus =
  | "idle"
  | "running"
  | "paused"
  | "completed"
  | "blocked"
  | "cancelled";
export type AdminSeasonSimulationIssueLevel = "red" | "yellow" | "info";

export type AdminSeasonSimulationStartInput = {
  saveId: string;
  seasonCount: 1 | 2 | 5;
  mode: AdminSeasonSimulationMode;
  fullChurnStress: boolean;
  injuriesTestMode: boolean;
};

export type AdminSeasonSimulationLog = {
  at: string;
  level: AdminSeasonSimulationIssueLevel;
  phase: AdminSeasonSimulationPhaseId | "control";
  message: string;
};

export type AdminSeasonSimulationIssue = AdminSeasonSimulationLog & {
  code: string;
};

export type AdminSeasonSimulationPhaseId =
  | "market_pre_check"
  | "sell_contract_exits"
  | "buy_draft"
  | "form_cards"
  | "matchday_run"
  | "matchday_advance"
  | "season_end_cash"
  | "xp_development"
  | "facilities"
  | "contracts"
  | "snapshot_archive"
  | "transition";

export type AdminSeasonSimulationRunState = {
  runId: string;
  saveId: string;
  requestedSeasons: 1 | 2 | 5;
  mode: AdminSeasonSimulationMode;
  fullChurnStress: boolean;
  injuriesTestMode: boolean;
  status: AdminSeasonSimulationStatus;
  activePhase: AdminSeasonSimulationPhaseId | "idle" | "done";
  activeSeasonId: string | null;
  activeMatchdayId: string | null;
  activeTeamId: string | null;
  currentOperation: string;
  startedAt: string;
  updatedAt: string;
  heartbeatAt: string;
  completedAt: string | null;
  durationMs: number;
  progressPct: number;
  completedUnits: number;
  estimatedTotalUnits: number;
  cursor: {
    seasonIndex: number;
    phaseIndex: number;
    matchdayIndex: number;
  };
  reports: {
    directory: string;
    jsonl: string;
    summary: string;
    dryRunSave?: string;
  };
  logs: AdminSeasonSimulationLog[];
  issues: AdminSeasonSimulationIssue[];
};

export type AdminSeasonSimulationResponse = {
  ok: boolean;
  run: AdminSeasonSimulationRunState | null;
  error?: string;
};

const PHASES: AdminSeasonSimulationPhaseId[] = [
  "market_pre_check",
  "sell_contract_exits",
  "buy_draft",
  "form_cards",
  "matchday_run",
  "matchday_advance",
  "season_end_cash",
  "xp_development",
  "facilities",
  "contracts",
  "snapshot_archive",
  "transition",
];

const PHASE_LABELS: Record<AdminSeasonSimulationPhaseId, string> = {
  market_pre_check: "Market Pre-Check",
  sell_contract_exits: "Sell/Contract Exits",
  buy_draft: "Buy/Draft",
  form_cards: "Formkarten",
  matchday_run: "Lineups/Resolve/Standings",
  matchday_advance: "Matchday Advance",
  season_end_cash: "Season-End Cash",
  xp_development: "XP/Development",
  facilities: "Facilities",
  contracts: "Contracts",
  snapshot_archive: "Snapshot/Archive",
  transition: "Transition",
};

const RUN_DIR = path.join(process.cwd(), "outputs", "admin-season-simulation", "runs");
const MAX_PHASE_MS = 180_000;

type MatchdayPerformanceRow = {
  seasonId: string;
  matchdayId: string;
  matchdayIndex: number;
  phase: string;
  durationMs: number;
  itemCount: number;
  source: string;
};

function nowIso() {
  return new Date().toISOString();
}

function ensureRunDir() {
  assertOlyProjectRoot();
  fs.mkdirSync(RUN_DIR, { recursive: true });
}

function runPath(runId: string) {
  return path.join(RUN_DIR, `${runId}.json`);
}

function reportPath(runId: string, suffix: string) {
  return path.join(RUN_DIR, `${runId}.${suffix}`);
}

function dryRunSavePath(runId: string) {
  return reportPath(runId, "dryrun-save.json");
}

function writeRun(run: AdminSeasonSimulationRunState) {
  ensureRunDir();
  const updated = {
    ...run,
    updatedAt: nowIso(),
    durationMs: Date.now() - Date.parse(run.startedAt),
  };
  fs.writeFileSync(runPath(run.runId), `${JSON.stringify(updated, null, 2)}\n`, "utf8");
  return updated;
}

function readRun(runId: string): AdminSeasonSimulationRunState | null {
  ensureRunDir();
  const file = runPath(runId);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8")) as AdminSeasonSimulationRunState;
}

function appendReport(run: AdminSeasonSimulationRunState, payload: Record<string, unknown>) {
  fs.appendFileSync(run.reports.jsonl, `${JSON.stringify({ at: nowIso(), runId: run.runId, ...payload })}\n`, "utf8");
}

function elapsedSince(startedAt: number) {
  return Math.max(0, Math.round(performance.now() - startedAt));
}

function roundValue(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function appendMatchdayPerformanceRows(run: AdminSeasonSimulationRunState, rows: MatchdayPerformanceRow[]) {
  for (const row of rows) {
    appendReport(run, { type: "matchday_performance_breakdown", ...row });
  }
}

function log(
  run: AdminSeasonSimulationRunState,
  level: AdminSeasonSimulationIssueLevel,
  phase: AdminSeasonSimulationLog["phase"],
  message: string,
  code?: string,
) {
  const entry: AdminSeasonSimulationLog = { at: nowIso(), level, phase, message };
  run.logs = [...run.logs, entry].slice(-20);
  if (code) {
    run.issues = [...run.issues, { ...entry, code }].slice(-200);
  }
  appendReport(run, { type: "log", level, phase, message, code: code ?? null });
}

function markBlocked(run: AdminSeasonSimulationRunState, phase: AdminSeasonSimulationPhaseId, message: string, code: string) {
  run.status = "blocked";
  run.activePhase = phase;
  run.currentOperation = message;
  log(run, "red", phase, message, code);
}

function resolveSave(persistence: PersistenceService, saveId: string) {
  const save = persistence.getSaveById(saveId);
  if (!save) {
    throw new Error(`Save ${saveId} wurde nicht gefunden.`);
  }
  return save;
}

function phaseTimeout<T>(phase: AdminSeasonSimulationPhaseId, operation: Promise<T>) {
  return Promise.race([
    operation,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`phase_timeout:${phase}`)), MAX_PHASE_MS);
    }),
  ]);
}

function setSavePhase(save: PersistedSaveGame, phase: GamePhase, persistence: PersistenceService) {
  if ((save.gameState.gamePhase ?? "season_active") === phase) return save;
  return persistence.saveSingleplayerState(save.saveId, {
    ...save.gameState,
    gamePhase: phase,
  });
}

function getCurrentMatchdayIndex(gameState: GameState) {
  return Math.max(0, gameState.season.matchdayIds.findIndex((entry) => entry === gameState.matchdayState.matchdayId));
}

function estimateTotalUnits(save: PersistedSaveGame, requestedSeasons: number) {
  const matchdays = Math.max(1, save.gameState.season.matchdayIds.length || 10);
  const unitsPerSeason = 4 + matchdays * 2 + 6;
  return Math.max(1, requestedSeasons * unitsPerSeason);
}

function advanceUnit(run: AdminSeasonSimulationRunState, count = 1) {
  run.completedUnits += count;
  run.progressPct = Math.min(100, Math.round((run.completedUnits / Math.max(1, run.estimatedTotalUnits)) * 100));
}

function withAiLineupApplyEnabledForAiTeams(gameState: GameState, options?: { forceAllTeamsAi?: boolean }) {
  const settingsMap = buildTeamControlSettingsMap(gameState.teams, gameState.seasonState.teamControlSettings);
  let changed = false;
  const nextSettings: Record<string, TeamControlSettings> = {};
  const teams = options?.forceAllTeamsAi
    ? gameState.teams.map((team) => (team.humanControlled === false ? team : { ...team, humanControlled: false }))
    : gameState.teams;

  for (const team of teams) {
    const current = settingsMap[team.teamId]!;
    if (options?.forceAllTeamsAi && current.controlMode !== "ai") {
      changed = true;
      nextSettings[team.teamId] = {
        ...current,
        controlMode: "ai",
        ownerId: "ai",
        ownerSlot: "ai",
        aiLineupPreviewEnabled: true,
        aiLineupApplyEnabled: true,
        aiLineupAutoApplyEnabled: true,
        aiTransferPreviewEnabled: true,
        aiTransferAutoApplyEnabled: true,
        aiSellPreviewEnabled: true,
        aiSellAutoApplyEnabled: true,
      };
      continue;
    }
    if (current.controlMode === "ai" && !isAiLineupBatchApplyEnabled(current)) {
      changed = true;
      nextSettings[team.teamId] = {
        ...current,
        aiLineupPreviewEnabled: true,
        aiLineupApplyEnabled: true,
        aiLineupAutoApplyEnabled: true,
      };
      continue;
    }
    nextSettings[team.teamId] = current;
  }
  if (!changed) return { gameState, changed: false, enabledTeams: 0 };
  return {
    gameState: {
      ...gameState,
      teams,
      seasonState: {
        ...gameState.seasonState,
        teamControlSettings: nextSettings,
      },
    },
    changed: true,
    enabledTeams: Object.values(nextSettings).filter((settings) => settings.controlMode === "ai" && isAiLineupBatchApplyEnabled(settings)).length,
  };
}

function createSingleSavePersistenceHarness(initialSave: PersistedSaveGame) {
  let currentSave = structuredClone(initialSave);
  const getCurrentSave = () => currentSave;
  const persistence: PersistenceService = {
    bootstrapSingleplayerSave() {
      return { save: currentSave, createdFromSeed: false };
    },
    getActiveSave() {
      return currentSave;
    },
    getSaveById(saveId) {
      return currentSave.saveId === saveId ? currentSave : null;
    },
    getSaveVersionMetadata(saveId) {
      if (currentSave.saveId !== saveId) {
        return null;
      }
      return {
        saveId: currentSave.saveId,
        updatedAt: currentSave.updatedAt,
        seasonId: currentSave.gameState.season.id,
        matchdayId: currentSave.gameState.matchdayState.matchdayId,
        matchdayResults: currentSave.gameState.seasonState.matchdayResults ?? [],
        standingsApplyLogs: currentSave.gameState.seasonState.standingsApplyLogs ?? [],
        seasonSnapshots: currentSave.gameState.seasonState.seasonSnapshots ?? [],
        disciplineResults: currentSave.gameState.seasonState.disciplineResults ?? [],
        lineupDraftCount: 0,
        transferHistoryCount: 0,
      };
    },
    saveSingleplayerState(saveId, gameState) {
      if (currentSave.saveId !== saveId) {
        throw new Error(`Admin simulation dry-run save ${saveId} wurde nicht gefunden.`);
      }
      currentSave = {
        ...currentSave,
        updatedAt: nowIso(),
        gameState,
      };
      return currentSave;
    },
    createSave() {
      throw new Error("Admin simulation dry-run creates no saves.");
    },
    createFreshSeasonOneSave() {
      throw new Error("Admin simulation dry-run creates no fresh saves.");
    },
    cloneSave() {
      throw new Error("Admin simulation dry-run clones no saves.");
    },
    createScenarioSnapshot() {
      throw new Error("Admin simulation dry-run creates no scenario snapshots.");
    },
    activateSave(saveId) {
      return currentSave.saveId === saveId ? currentSave : null;
    },
    listSaves() {
      const summary = {
        saveId: currentSave.saveId,
        name: currentSave.name,
        status: currentSave.status,
        createdAt: currentSave.createdAt,
        updatedAt: currentSave.updatedAt,
      };
      return currentSave.gameState.scenarioMeta ? [{ ...summary, scenarioMeta: currentSave.gameState.scenarioMeta }] : [summary];
    },
  };
  return {
    persistence,
    getCurrentSave,
  };
}

function readDryRunSave(run: AdminSeasonSimulationRunState) {
  const file = run.reports.dryRunSave ?? dryRunSavePath(run.runId);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8")) as PersistedSaveGame;
}

function writeDryRunSave(run: AdminSeasonSimulationRunState, save: PersistedSaveGame) {
  const file = run.reports.dryRunSave ?? dryRunSavePath(run.runId);
  fs.writeFileSync(file, `${JSON.stringify(save, null, 2)}\n`, "utf8");
}

function buildCurrentMoraleState(gameState: GameState): PlayerMoraleState[] {
  const rosteredPlayerIds = new Set(gameState.rosters.map((roster) => roster.playerId));
  const activeRows = gameState.rosters.flatMap((roster) => {
    const morale = assessPlayerMorale({ gameState, playerId: roster.playerId, teamId: roster.teamId });
    if (!morale) return [];
    return [
      {
        playerId: roster.playerId,
        teamId: roster.teamId,
        morale: morale.morale,
        visibleMood: morale.visibleMood,
        lastUpdatedSeasonId: gameState.season.id,
        inactiveSeasons: 0,
        reasons: morale.reasons,
        contractIntent: morale.contractIntent,
      },
    ];
  });
  const inactiveRows = (gameState.playerMoraleState ?? []).filter((entry) => !rosteredPlayerIds.has(entry.playerId));
  return [...activeRows, ...inactiveRows];
}

function ensureMoraleStatePersisted(
  run: AdminSeasonSimulationRunState,
  save: PersistedSaveGame,
  persistence: PersistenceService,
  phase: AdminSeasonSimulationPhaseId,
) {
  const moraleState = buildCurrentMoraleState(save.gameState);
  const previousCount = save.gameState.playerMoraleState?.length ?? 0;
  const alreadyCurrent =
    previousCount === moraleState.length &&
    (save.gameState.playerMoraleState ?? []).every((entry) => entry.lastUpdatedSeasonId === save.gameState.season.id);
  if (moraleState.length === 0 || alreadyCurrent) {
    return save;
  }
  const updatedSave = persistence.saveSingleplayerState(save.saveId, {
    ...save.gameState,
    playerMoraleState: moraleState,
  });
  log(run, "info", phase, `Morale-State aktualisiert: ${previousCount} -> ${moraleState.length}.`);
  return updatedSave;
}

function createExecutionContext(run: AdminSeasonSimulationRunState) {
  const persistence = createPersistenceService();
  if (run.mode === "apply") {
    return {
      persistence,
      save: resolveSave(persistence, run.saveId),
      flush: () => undefined,
    };
  }

  const persistedDryRunSave = readDryRunSave(run);
  const realSave = resolveSave(persistence, run.saveId);
  const baseSave = persistedDryRunSave ?? realSave;
  const lineupReadySavePatch = withAiLineupApplyEnabledForAiTeams(baseSave.gameState, { forceAllTeamsAi: true });
  const dryRunSave: PersistedSaveGame = {
    ...baseSave,
    saveId: run.saveId,
    status: "active",
    gameState: lineupReadySavePatch.gameState,
  };
  const harness = createSingleSavePersistenceHarness(dryRunSave);
  if (!persistedDryRunSave && lineupReadySavePatch.changed) {
    log(
      run,
      "yellow",
      "market_pre_check",
      `Dry Run nutzt eine Kopie mit AI-Lineup-Apply fuer ${lineupReadySavePatch.enabledTeams} AI-Teams.`,
      "dry_run_ai_lineup_apply_overlay",
    );
  }
  return {
    persistence: harness.persistence,
    save: resolveSave(harness.persistence, run.saveId),
    flush: () => writeDryRunSave(run, harness.getCurrentSave()),
  };
}

function runMarketPreCheck(run: AdminSeasonSimulationRunState, save: PersistedSaveGame, persistence: PersistenceService) {
  const recovery = runPreseasonCashRecovery(run, save, persistence, "market_pre_check");
  if (recovery.blockingReasons.length > 0) {
    markBlocked(run, "market_pre_check", recovery.blockingReasons[0]!, "preseason_cash_recovery_blocked");
    return;
  }
  const checkedSave = ensureMoraleStatePersisted(run, recovery.save, persistence, "market_pre_check");
  const rosterCount = checkedSave.gameState.rosters.length;
  const teamsBelowSeven = checkedSave.gameState.teams
    .filter((team) => checkedSave.gameState.rosters.filter((entry) => entry.teamId === team.teamId).length < 7)
    .map((team) => team.shortCode);
  run.activeSeasonId = checkedSave.gameState.season.id;
  run.activeMatchdayId = checkedSave.gameState.matchdayState.matchdayId;
  if (rosterCount === 0 || teamsBelowSeven.length > 0) {
    markBlocked(
      run,
      "market_pre_check",
      `Roster nicht season-ready: ${teamsBelowSeven.join(", ") || "keine Spieler"}`,
      "roster_below_minimum",
    );
    return;
  }
  const lineupReadySavePatch = withAiLineupApplyEnabledForAiTeams(checkedSave.gameState, { forceAllTeamsAi: true });
  if (lineupReadySavePatch.changed) {
    persistence.saveSingleplayerState(checkedSave.saveId, lineupReadySavePatch.gameState);
    log(
      run,
      "yellow",
      "market_pre_check",
      `AI-Lineup-Apply fuer ${lineupReadySavePatch.enabledTeams} AI-Teams initialisiert.`,
      "ai_lineup_apply_initialized",
    );
  }
  log(run, "info", "market_pre_check", `Save geprüft: ${rosterCount} Kader-Einträge, Season ${checkedSave.gameState.season.id}.`);
  advanceUnit(run);
  run.cursor.phaseIndex += 1;
}

function isPreseasonBeforeFirstMatchday(save: PersistedSaveGame) {
  return (save.gameState.seasonState.matchdayResults ?? []).filter((result) => result.seasonId === save.gameState.season.id).length === 0;
}

function getTeamRosterCount(gameState: GameState, teamId: string) {
  return gameState.rosters.filter((entry) => entry.teamId === teamId).length;
}

function getTeamCash(gameState: GameState, teamId: string) {
  return gameState.teams.find((team) => team.teamId === teamId)?.cash ?? 0;
}

function applyPreseasonEmergencyBoardFunding(input: {
  run: AdminSeasonSimulationRunState;
  save: PersistedSaveGame;
  persistence: PersistenceService;
  phase: AdminSeasonSimulationPhaseId;
}) {
  let grants = 0;
  let total = 0;
  const teams = input.save.gameState.teams.map((team) => {
    const identity = input.save.gameState.teamIdentities.find((entry) => entry.teamId === team.teamId) ?? null;
    const { playerMin } = deriveRosterTargets(team, identity);
    const roster = getTeamRosterCount(input.save.gameState, team.teamId);
    if (team.cash >= 0 || team.cash < -10 || roster < playerMin) {
      return team;
    }

    const grant = roundValue(Math.abs(team.cash) + 0.5);
    grants += 1;
    total += grant;
    log(
      input.run,
      "yellow",
      input.phase,
      `${team.shortCode}: Board-Notfinanzierung ${grant.toFixed(1)} bei Mindestkader ${roster}/${playerMin}.`,
      "preseason_board_emergency_funding",
    );
    return {
      ...team,
      cash: roundValue(team.cash + grant),
    };
  });

  if (grants === 0) return input.save;
  const updated = input.persistence.saveSingleplayerState(input.save.saveId, {
    ...input.save.gameState,
    teams,
  });
  log(
    input.run,
    "yellow",
    input.phase,
    `Board-Notfinanzierung: ${grants} Teams, total ${roundValue(total, 1).toFixed(1)} Cash.`,
    "preseason_board_emergency_funding_summary",
  );
  return updated;
}

function getTeamSalaryTotal(gameState: GameState, teamId: string) {
  return gameState.rosters
    .filter((entry) => entry.teamId === teamId)
    .reduce((sum, entry) => sum + (entry.salary ?? 0), 0);
}

function getTeamRecentFinancePressure(input: {
  gameState: GameState;
  teamId: string;
  currentCash: number;
  currentSalaryTotal: number;
  boardPressure: number | null;
}) {
  const profile = getTeamStrategyProfile(input.gameState, input.teamId);
  const bias = profile?.bias ?? null;
  const cashPriority = bias?.cashPriority ?? 5;
  const wageSensitivity = bias?.wageSensitivity ?? 5;
  const longContractPreference = bias?.longContractPreference ?? (profile?.longContractsBias === "high" ? 8 : profile?.longContractsBias === "low" ? 3 : 5);
  const riskTolerance = bias?.riskTolerance ?? (profile?.riskToleranceLevel === "high" ? 8 : profile?.riskToleranceLevel === "low" ? 3 : 5);
  const starPriority = bias?.starPriority ?? 5;
  const profitSellAggression = bias?.sellForProfitAggression ?? 5;
  const rows = [...(input.gameState.seasonState.seasonSnapshots ?? [])]
    .sort((left, right) => right.seasonId.localeCompare(left.seasonId, "de", { numeric: true }))
    .map((snapshot) => {
      const teamSnapshot =
        (snapshot.teamSnapshots ?? snapshot.finalStandings ?? []).find((entry) => entry.teamId === input.teamId) ??
        null;
      if (!teamSnapshot) return null;
      return {
        seasonId: snapshot.seasonId,
        guv: teamSnapshot.guv ?? null,
        salaryTotal: teamSnapshot.salaryTotalEnd ?? teamSnapshot.salaryEnd ?? null,
        sponsorTotal: teamSnapshot.sponsorTotal ?? null,
        transferCount: (teamSnapshot.transferBuyCount ?? 0) + (teamSnapshot.transferSellCount ?? 0),
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  const latest = rows[0] ?? null;
  const previous = rows[1] ?? null;
  const latestGuv = latest?.guv ?? null;
  const previousGuv = previous?.guv ?? null;
  let targetSales = 0;
  const reasons: string[] = [];

  if (latestGuv != null && latestGuv <= -30) {
    targetSales += 2;
    reasons.push(`letzte GuV ${latestGuv.toFixed(1)}`);
  } else if (latestGuv != null && latestGuv <= -20) {
    targetSales += 1;
    reasons.push(`letzte GuV ${latestGuv.toFixed(1)}`);
  }

  if (latestGuv != null && previousGuv != null && latestGuv <= -18 && previousGuv <= -18) {
    targetSales += 2;
    reasons.push(`zweimal negative GuV (${previousGuv.toFixed(1)} / ${latestGuv.toFixed(1)})`);
  }

  const salaryReference = latest?.sponsorTotal ?? null;
  if (
    salaryReference != null &&
    salaryReference > 0 &&
    input.currentSalaryTotal > salaryReference * 1.08
  ) {
    targetSales += 1;
    reasons.push("Gehalt ueber Einnahme-Niveau");
  }

  if (latestGuv != null && latestGuv <= -20 && (latest?.transferCount ?? 0) <= 2) {
    targetSales += 1;
    reasons.push("kaum Transferreaktion");
  }

  if (input.currentCash < 8 && latestGuv != null && latestGuv < 0) {
    targetSales += 1;
    reasons.push("zu kleiner Cash-Puffer");
  }

  if (longContractPreference >= 8 && input.currentCash < input.currentSalaryTotal * 0.22) {
    targetSales += 1;
    reasons.push("Long-Contract-Team braucht Puffer");
  }

  if (wageSensitivity >= 8 && latestGuv != null && latestGuv < 0) {
    targetSales += 1;
    reasons.push("hohe Lohnsensibilitaet");
  }

  if (profitSellAggression >= 8 && latestGuv != null && latestGuv < 5) {
    targetSales += 1;
    reasons.push("Profit-Sell-DNA");
  }

  if ((input.boardPressure ?? 0) >= 8) {
    targetSales += 1;
    reasons.push(`Boarddruck ${(input.boardPressure ?? 0).toFixed(1)}`);
  }

  if (riskTolerance <= 3 && latestGuv != null && latestGuv < 0) {
    targetSales += 1;
    reasons.push("konservative Risiko-DNA");
  }

  const severeFinancePressure = input.currentCash < 0 || (latestGuv ?? 0) <= -20 || ((latestGuv ?? 0) < 0 && (previousGuv ?? 0) < 0);
  if (starPriority >= 8 && !severeFinancePressure) {
    targetSales = Math.max(0, targetSales - 1);
    reasons.push("Star-DNA schuetzt Core ohne harten Finanzdruck");
  }

  targetSales = Math.min(5, targetSales);
  const strategyReserve =
    input.currentSalaryTotal * 0.1 +
    longContractPreference * 0.8 +
    cashPriority * 0.55 +
    wageSensitivity * 0.45 +
    Math.max(0, 6 - riskTolerance) * 0.75 +
    (input.boardPressure ?? 0) * 0.55;
  const minCashAfter = targetSales > 0 ? Math.max(5, strategyReserve) : 0.1;
  return {
    active: targetSales > 0,
    latestGuv,
    previousGuv,
    minCashAfter,
    targetSales,
    reason: reasons.join(", "),
  };
}

function getCashRecoverySellCandidates(runContext: LocalTransfermarktRunContext, teamId: string) {
  return runContext.save.gameState.rosters
    .filter((entry) => entry.teamId === teamId)
    .map((entry) => {
      const preview = previewLocalTransfermarktSell({
        saveId: runContext.save.saveId,
        seasonId: runContext.save.gameState.season.id,
        teamId,
        activePlayerId: entry.id,
        transferSource: "admin_preseason_cash_recovery_sell",
        localRunContext: runContext,
      });
      return { entry, preview };
    })
    .filter((candidate) => candidate.preview.canSell && (candidate.preview.salePrice ?? 0) > 0)
    .sort(
      (left, right) =>
        ((right.preview.salePrice ?? 0) + (right.preview.salaryReduction ?? 0) * 2) -
          ((left.preview.salePrice ?? 0) + (left.preview.salaryReduction ?? 0) * 2) ||
        (right.preview.salaryReduction ?? 0) - (left.preview.salaryReduction ?? 0),
    );
}

function buyCheapestReplacementAfterRecoverySale(input: {
  runContext: LocalTransfermarktRunContext;
  teamId: string;
  minCashAfterBuy: number;
}) {
  const freeAgents = listLocalTransfermarktFreeAgents({
    saveId: input.runContext.save.saveId,
    seasonId: input.runContext.save.gameState.season.id,
    teamId: input.teamId,
    mode: "ai_preview",
    limit: 10_000,
    localRunContext: input.runContext,
  }).items
    .filter((candidate) => candidate.marketValue != null && candidate.marketValue >= 0)
    .sort(
      (left, right) =>
        (left.marketValue ?? Number.POSITIVE_INFINITY) - (right.marketValue ?? Number.POSITIVE_INFINITY) ||
        (left.salary ?? Number.POSITIVE_INFINITY) - (right.salary ?? Number.POSITIVE_INFINITY),
    );

  for (const candidate of freeAgents) {
    const teamCash = getTeamCash(input.runContext.save.gameState, input.teamId);
    const price = candidate.marketValue ?? Number.POSITIVE_INFINITY;
    if (teamCash - price < input.minCashAfterBuy) continue;
    const result = executeLocalTransfermarktBuy({
      saveId: input.runContext.save.saveId,
      seasonId: input.runContext.save.gameState.season.id,
      teamId: input.teamId,
      playerId: candidate.playerId,
      contractLength: 1,
      promisedRole: "prospect",
      transferSource: "admin_preseason_cash_recovery_replacement_buy",
      localRunContext: input.runContext,
      deferPersist: true,
    });
    if (result.canBuy && result.transferCreated) return true;
  }

  return false;
}

function buyCheapestRecoveryReplacements(input: {
  runContext: LocalTransfermarktRunContext;
  teamId: string;
  count: number;
  maxTotalSpend: number;
}) {
  const freeAgents = listLocalTransfermarktFreeAgents({
    saveId: input.runContext.save.saveId,
    seasonId: input.runContext.save.gameState.season.id,
    teamId: input.teamId,
    mode: "ai_preview",
    limit: 10_000,
    localRunContext: input.runContext,
  }).items
    .filter((candidate) => candidate.marketValue != null && candidate.marketValue >= 0)
    .sort(
      (left, right) =>
        (left.marketValue ?? Number.POSITIVE_INFINITY) - (right.marketValue ?? Number.POSITIVE_INFINITY) ||
        (left.salary ?? Number.POSITIVE_INFINITY) - (right.salary ?? Number.POSITIVE_INFINITY),
    );

  const selected = freeAgents.slice(0, input.count);
  const totalSpend = selected.reduce((sum, candidate) => sum + (candidate.marketValue ?? 0), 0);
  if (selected.length < input.count || totalSpend > input.maxTotalSpend) return false;

  for (const candidate of selected) {
    const result = executeLocalTransfermarktBuy({
      saveId: input.runContext.save.saveId,
      seasonId: input.runContext.save.gameState.season.id,
      teamId: input.teamId,
      playerId: candidate.playerId,
      contractLength: 1,
      promisedRole: "prospect",
      transferSource: "admin_preseason_cash_recovery_replacement_buy",
      localRunContext: input.runContext,
      deferPersist: true,
    });
    if (!result.canBuy || !result.transferCreated) return false;
  }

  return true;
}

function getFastFreeAgentCandidates(gameState: GameState) {
  const rosterPlayerIds = new Set(gameState.rosters.map((entry) => entry.playerId));
  return gameState.players
    .filter((player) => !rosterPlayerIds.has(player.id))
    .map((player) => {
      const economy = resolvePlayerEconomyContract({ player });
      return {
        player,
        marketValue: normalizeVisibleRosterMoney(player.displayMarketValue, economy.marketValue) ?? 0,
        salary: normalizeVisibleRosterMoney(player.displaySalary, economy.salary) ?? 0,
      };
    })
    .filter((entry) => entry.marketValue >= 0 && entry.salary >= 0)
    .sort(
      (left, right) =>
        left.marketValue - right.marketValue ||
        left.salary - right.salary ||
        left.player.name.localeCompare(right.player.name, "de", { numeric: true, sensitivity: "base" }),
    );
}

function applyFastLocalBuy(input: {
  runContext: LocalTransfermarktRunContext;
  teamId: string;
  playerId: string;
  transferSource: string;
  contractLength?: number;
  purchasePriceOverride?: number;
}) {
  const gameState = input.runContext.save.gameState;
  const player = gameState.players.find((entry) => entry.id === input.playerId) ?? null;
  const team = gameState.teams.find((entry) => entry.teamId === input.teamId) ?? null;
  if (!player || !team || gameState.rosters.some((entry) => entry.playerId === player.id)) return false;
  const economy = resolvePlayerEconomyContract({ player });
  const marketValue = normalizeVisibleRosterMoney(player.displayMarketValue, economy.marketValue) ?? 0;
  const purchasePrice = input.purchasePriceOverride != null ? roundValue(Math.max(0, input.purchasePriceOverride)) : marketValue;
  const salary = normalizeVisibleRosterMoney(player.displaySalary, economy.salary) ?? 0;
  if (purchasePrice < 0 || salary < 0 || team.cash - purchasePrice < 0) return false;
  const transferHistory: TransferHistoryEntry = {
    id: `history-${randomUUID()}`,
    playerId: player.id,
    seasonId: gameState.season.id,
    matchdayId: gameState.matchdayState.matchdayId ?? null,
    phase: LOCAL_TRANSFER_WINDOW_PHASE,
    source: input.transferSource,
    seasonLabel: getCanonicalSeasonLabel({
      seasonId: gameState.season.id,
      seasonName: gameState.season.name,
    }),
    transferType: "buy",
    fromTeamId: null,
    toTeamId: input.teamId,
    fee: purchasePrice,
    salary,
    marketValue,
    remainingContractLength: input.contractLength ?? 1,
    happenedAt: nowIso(),
  };
  input.runContext.save = {
    ...input.runContext.save,
    gameState: {
      ...gameState,
      teams: gameState.teams.map((entry) =>
        entry.teamId === input.teamId
          ? {
              ...entry,
              cash: roundValue(entry.cash - purchasePrice),
            }
          : entry,
      ),
      rosters: [
        ...gameState.rosters,
        {
          id: `roster-${randomUUID()}`,
          teamId: input.teamId,
          playerId: player.id,
          contractLength: input.contractLength ?? 1,
          salary,
          upkeep: salary,
          purchasePrice,
          currentValue: marketValue,
          roleTag: "prospect",
          promisedRole: "prospect",
          joinedSeasonId: gameState.season.id,
        },
      ],
      transferHistory: [transferHistory, ...gameState.transferHistory],
    },
  };
  input.runContext.deferredWrites += 1;
  return true;
}

function applyFastLocalSell(input: {
  runContext: LocalTransfermarktRunContext;
  teamId: string;
  rosterEntry: RosterEntry;
  transferSource: string;
}) {
  const gameState = input.runContext.save.gameState;
  const player = gameState.players.find((entry) => entry.id === input.rosterEntry.playerId) ?? null;
  const team = gameState.teams.find((entry) => entry.teamId === input.teamId) ?? null;
  if (!player || !team || input.rosterEntry.teamId !== input.teamId) return false;
  const economy = resolvePlayerEconomyContract({ player, rosterEntry: input.rosterEntry });
  const saleFactorBreakdown = buildTransfermarktSaleFactorBreakdown(gameState, player, input.rosterEntry);
  const salePrice = normalizeVisibleRosterMoney(saleFactorBreakdown.salePrice, economy.marketValue) ?? 0;
  const marketValueReference = normalizeVisibleRosterMoney(saleFactorBreakdown.baseMarketValue, economy.marketValue) ?? salePrice;
  const salaryReduction = normalizeVisibleRosterMoney(input.rosterEntry.salary, economy.salary) ?? 0;
  if (salePrice <= 0) return false;
  const transferHistory: TransferHistoryEntry = {
    id: `history-${randomUUID()}`,
    playerId: player.id,
    seasonId: gameState.season.id,
    matchdayId: gameState.matchdayState.matchdayId ?? null,
    phase: LOCAL_TRANSFER_WINDOW_PHASE,
    source: input.transferSource,
    seasonLabel: getCanonicalSeasonLabel({
      seasonId: gameState.season.id,
      seasonName: gameState.season.name,
    }),
    transferType: "sell",
    fromTeamId: input.teamId,
    toTeamId: null,
    fee: salePrice,
    salary: salaryReduction,
    marketValue: marketValueReference,
    remainingContractLength: input.rosterEntry.contractLength,
    happenedAt: nowIso(),
  };
  input.runContext.save = {
    ...input.runContext.save,
    gameState: {
      ...gameState,
      teams: gameState.teams.map((entry) =>
        entry.teamId === input.teamId
          ? {
              ...entry,
              cash: roundValue(entry.cash + salePrice),
            }
          : entry,
      ),
      rosters: gameState.rosters.filter((entry) => entry.id !== input.rosterEntry.id),
      transferHistory: [transferHistory, ...gameState.transferHistory],
    },
  };
  input.runContext.deferredWrites += 1;
  return true;
}

function getFastCashRecoverySellCandidate(gameState: GameState, teamId: string) {
  const playersById = new Map(gameState.players.map((player) => [player.id, player] as const));
  return gameState.rosters
    .filter((entry) => entry.teamId === teamId)
    .map((entry) => {
      const player = playersById.get(entry.playerId) ?? null;
      const economy = resolvePlayerEconomyContract({ player, rosterEntry: entry });
      const salePrice =
        normalizeVisibleRosterMoney(entry.currentValue, economy.marketValue) ??
        0;
      const salaryReduction = normalizeVisibleRosterMoney(entry.salary, economy.salary) ?? 0;
      const contractRisk = Math.max(0, entry.contractLength ?? 0) * salaryReduction * 0.25;
      return {
        entry,
        salePrice,
        salaryReduction,
        saleScore: salePrice + salaryReduction * 2 + contractRisk,
      };
    })
    .filter((candidate) => candidate.salePrice > 0)
    .sort(
      (left, right) =>
        right.saleScore - left.saleScore ||
        right.salaryReduction - left.salaryReduction ||
        right.salePrice - left.salePrice,
    )[0] ?? null;
}

function refillTeamsToMinimum(input: {
  run: AdminSeasonSimulationRunState;
  runContext: LocalTransfermarktRunContext;
  phase: AdminSeasonSimulationPhaseId;
  minCashAfterBuy: number;
  transferSource: string;
}) {
  let bought = 0;
  const unresolved: string[] = [];

  for (const team of input.runContext.save.gameState.teams) {
    const identity = input.runContext.save.gameState.teamIdentities.find((entry) => entry.teamId === team.teamId) ?? null;
    const { playerMin } = deriveRosterTargets(team, identity);
    let guard = 0;
    let freeAgents = getFastFreeAgentCandidates(input.runContext.save.gameState);
    const takeAffordableFreeAgent = () => {
      const rosteredPlayerIds = new Set(input.runContext.save.gameState.rosters.map((entry) => entry.playerId));
      const teamCash = getTeamCash(input.runContext.save.gameState, team.teamId);
      return freeAgents.find(
        (candidate) => !rosteredPlayerIds.has(candidate.player.id) && teamCash - candidate.marketValue >= input.minCashAfterBuy,
      ) ?? null;
    };

    while (getTeamRosterCount(input.runContext.save.gameState, team.teamId) < playerMin) {
      guard += 1;
      if (guard > playerMin + 4) break;

      let didBuy = false;
      const candidate = takeAffordableFreeAgent();
      if (candidate) {
        const result = applyFastLocalBuy({
          runContext: input.runContext,
          teamId: team.teamId,
          playerId: candidate.player.id,
          contractLength: 1,
          transferSource: input.transferSource,
        });
        if (result) {
          bought += 1;
          didBuy = true;
        }
      }

      if (!didBuy) {
        const rosteredPlayerIds = new Set(input.runContext.save.gameState.rosters.map((entry) => entry.playerId));
        const emergencyCandidate =
          freeAgents.find((entry) => !rosteredPlayerIds.has(entry.player.id) && entry.marketValue > 0) ?? null;
        const emergencyCash = getTeamCash(input.runContext.save.gameState, team.teamId);
        if (emergencyCandidate && emergencyCash >= input.minCashAfterBuy) {
          const emergencyPrice = Math.min(
            emergencyCandidate.marketValue,
            Math.max(0, emergencyCash - input.minCashAfterBuy),
          );
          const result = applyFastLocalBuy({
            runContext: input.runContext,
            teamId: team.teamId,
            playerId: emergencyCandidate.player.id,
            contractLength: 1,
            purchasePriceOverride: emergencyPrice,
            transferSource: `${input.transferSource}_emergency_depth_signing`,
          });
          if (result) {
            bought += 1;
            didBuy = true;
            log(
              input.run,
              "yellow",
              input.phase,
              `${team.shortCode}: Notfall-Free-Agent-Signing fuer Mindestkader (${emergencyPrice.toFixed(2)} statt ${emergencyCandidate.marketValue.toFixed(2)}).`,
              "minimum_roster_emergency_depth_signing",
            );
          }
        }
      }

      if (!didBuy) {
        const neededBeforeSale = Math.max(1, playerMin - getTeamRosterCount(input.runContext.save.gameState, team.teamId));
        const playersById = new Map(input.runContext.save.gameState.players.map((player) => [player.id, player] as const));
        const candidates = input.runContext.save.gameState.rosters
          .filter((entry) => entry.teamId === team.teamId)
          .map((entry) => {
            const player = playersById.get(entry.playerId) ?? null;
            const economy = resolvePlayerEconomyContract({ player, rosterEntry: entry });
            return {
              entry,
              saleScore:
                (normalizeVisibleRosterMoney(entry.currentValue, economy.marketValue) ?? 0) +
                (normalizeVisibleRosterMoney(entry.salary, economy.salary) ?? 0) * 2,
            };
          })
          .sort((left, right) => right.saleScore - left.saleScore)
          .slice(0, 5);
        const saleCandidate = candidates[0] ?? null;
        if (saleCandidate) {
          const beforeFundingSave = structuredClone(input.runContext.save);
          const beforeFundingWrites = input.runContext.deferredWrites;
          const sale = applyFastLocalSell({
            runContext: input.runContext,
            teamId: team.teamId,
            rosterEntry: saleCandidate.entry,
            transferSource: `${input.transferSource}_funding_sell`,
          });
          if (!sale) break;
          let replacementBuys = 0;
          for (let index = 0; index < neededBeforeSale + 1; index += 1) {
            const nextCandidate = takeAffordableFreeAgent();
            if (!nextCandidate) break;
            if (
              applyFastLocalBuy({
                runContext: input.runContext,
                teamId: team.teamId,
                playerId: nextCandidate.player.id,
                contractLength: 1,
                transferSource: input.transferSource,
              })
            ) {
              replacementBuys += 1;
            }
          }
          if (replacementBuys >= neededBeforeSale + 1 && getTeamCash(input.runContext.save.gameState, team.teamId) >= input.minCashAfterBuy) {
            bought += replacementBuys;
            didBuy = true;
            log(
              input.run,
              "yellow",
              input.phase,
              `${team.shortCode}: Mindestkader durch 1 Verkauf + ${replacementBuys} Refill-Kaeufe finanziert.`,
              "minimum_roster_refill_funding_sell",
            );
          }
          if (replacementBuys > 0 && !didBuy) {
            bought += replacementBuys;
            didBuy = true;
            log(
              input.run,
              "yellow",
              input.phase,
              `${team.shortCode}: Notfall-Refill mit 1 Verkauf + ${replacementBuys} Kaeufen, Kader ${getTeamRosterCount(input.runContext.save.gameState, team.teamId)}/${playerMin}.`,
              "minimum_roster_refill_partial_funding_sell",
            );
          }
          if (!didBuy && replacementBuys === 0) {
            input.runContext.save = beforeFundingSave;
            input.runContext.deferredWrites = beforeFundingWrites;
          }
        }
      }

      if (!didBuy) break;
    }

    const rosterAfter = getTeamRosterCount(input.runContext.save.gameState, team.teamId);
    if (rosterAfter < playerMin) {
      unresolved.push(`${team.shortCode}: ${rosterAfter}/${playerMin}`);
    }
  }

  if (bought > 0) {
    log(input.run, "yellow", input.phase, `Mindestkader-Refill: ${bought} guenstige Free-Agent-Kaeufe.`, "minimum_roster_refill_buy");
  }
  return { bought, unresolved };
}

function sellBatchWithCheapReplacements(input: {
  runContext: LocalTransfermarktRunContext;
  teamId: string;
  minCashAfterBuys: number;
}) {
  const cashBefore = getTeamCash(input.runContext.save.gameState, input.teamId);
  const candidates = getCashRecoverySellCandidates(input.runContext, input.teamId);
  const freeAgents = listLocalTransfermarktFreeAgents({
    saveId: input.runContext.save.saveId,
    seasonId: input.runContext.save.gameState.season.id,
    teamId: input.teamId,
    mode: "ai_preview",
    limit: 10_000,
    localRunContext: input.runContext,
  }).items
    .filter((candidate) => candidate.marketValue != null && candidate.marketValue >= 0)
    .sort(
      (left, right) =>
        (left.marketValue ?? Number.POSITIVE_INFINITY) - (right.marketValue ?? Number.POSITIVE_INFINITY) ||
        (left.salary ?? Number.POSITIVE_INFINITY) - (right.salary ?? Number.POSITIVE_INFINITY),
    );

  const maxBatch = Math.min(5, candidates.length, freeAgents.length);
  for (let count = 1; count <= maxBatch; count += 1) {
    const saleTotal = candidates.slice(0, count).reduce((sum, candidate) => sum + (candidate.preview.salePrice ?? 0), 0);
    const buyTotal = freeAgents.slice(0, count).reduce((sum, candidate) => sum + (candidate.marketValue ?? 0), 0);
    if (cashBefore + saleTotal - buyTotal < input.minCashAfterBuys) continue;

    const beforeBatchSave = structuredClone(input.runContext.save);
    const beforeDeferredWrites = input.runContext.deferredWrites;
    let ok = true;
    for (const candidate of candidates.slice(0, count)) {
      const result = executeLocalTransfermarktSell({
        saveId: input.runContext.save.saveId,
        seasonId: input.runContext.save.gameState.season.id,
        teamId: input.teamId,
        activePlayerId: candidate.entry.id,
        transferSource: "admin_preseason_cash_recovery_sell",
        localRunContext: input.runContext,
        deferPersist: true,
      });
      ok = ok && result.canSell && result.transferCreated;
      if (!ok) break;
    }
    if (ok) {
      ok = buyCheapestRecoveryReplacements({
        runContext: input.runContext,
        teamId: input.teamId,
        count,
        maxTotalSpend: Number.POSITIVE_INFINITY,
      });
    }
    if (ok && getTeamCash(input.runContext.save.gameState, input.teamId) >= input.minCashAfterBuys) {
      return count;
    }
    input.runContext.save = beforeBatchSave;
    input.runContext.deferredWrites = beforeDeferredWrites;
  }

  return 0;
}

function runPreseasonCashRecovery(
  run: AdminSeasonSimulationRunState,
  save: PersistedSaveGame,
  persistence: PersistenceService,
  phase: AdminSeasonSimulationPhaseId,
) {
  if (!isPreseasonBeforeFirstMatchday(save)) {
    return { save, sold: 0, recoveredTeams: 0, blockingReasons: [] as string[] };
  }

  let currentSave = save;
  let sold = 0;
  let pressureSold = 0;
  let pressureTeams = 0;
  let recoveredTeams = 0;
  const blockingReasons: string[] = [];
  const runContext = createLocalTransfermarktRunContext({ save: currentSave, persistence });
  log(run, "info", phase, "Preseason Cash-Recovery gestartet.");
  writeRun(run);
  const objectiveOverview = buildTeamObjectiveOverview(currentSave.gameState);
  log(run, "info", phase, "Boarddruck fuer Finance-Precheck berechnet.");
  writeRun(run);

  const teamsByCash = [...currentSave.gameState.teams].sort((left, right) => left.cash - right.cash);
  let globalPressureSales = 0;
  for (const team of teamsByCash) {
    const identity = currentSave.gameState.teamIdentities.find((entry) => entry.teamId === team.teamId) ?? null;
    const { playerMin } = deriveRosterTargets(team, identity);
    const cashBeforeTeam = getTeamCash(runContext.save.gameState, team.teamId);
    const rosterBeforeTeam = getTeamRosterCount(runContext.save.gameState, team.teamId);
    const pressure = getTeamRecentFinancePressure({
      gameState: runContext.save.gameState,
      teamId: team.teamId,
      currentCash: cashBeforeTeam,
      currentSalaryTotal: getTeamSalaryTotal(runContext.save.gameState, team.teamId),
      boardPressure: objectiveOverview.boardConfidence[team.teamId]?.pressure ?? null,
    });
    if (cashBeforeTeam >= 0 && !pressure.active) continue;
    if (cashBeforeTeam >= 0 && rosterBeforeTeam <= playerMin) continue;
    const pressureSellTarget =
      cashBeforeTeam < 0 || globalPressureSales >= 8 || rosterBeforeTeam <= playerMin + 1
        ? 0
        : Math.min(2, pressure.targetSales);

    let guard = 0;
    let teamPressureSold = 0;
    while (getTeamCash(runContext.save.gameState, team.teamId) < 0 || (pressure.active && teamPressureSold < pressureSellTarget)) {
      guard += 1;
      if (guard > 16) break;
      const rosterBeforeSell = getTeamRosterCount(runContext.save.gameState, team.teamId);
      if (rosterBeforeSell <= playerMin) break;
      const next = getFastCashRecoverySellCandidate(runContext.save.gameState, team.teamId);
      if (!next) break;
      const result = applyFastLocalSell({
        runContext,
        teamId: team.teamId,
        rosterEntry: next.entry,
        transferSource: "admin_preseason_cash_recovery_sell",
      });
      if (!result) break;
      sold += 1;
      teamPressureSold += pressure.active ? 1 : 0;
      globalPressureSales += pressure.active ? 1 : 0;
    }

    const cashAfterTeam = getTeamCash(runContext.save.gameState, team.teamId);
    if (cashAfterTeam >= 0 && cashBeforeTeam < 0) {
      recoveredTeams += 1;
    }
    if (teamPressureSold > 0) {
      pressureTeams += 1;
      pressureSold += teamPressureSold;
      log(
        run,
        "yellow",
        phase,
        `${team.shortCode}: GuV-/Payroll-Reaktion mit ${teamPressureSold} Verkäufen (${pressure.reason || "Finanzdruck"}), Cash ${cashBeforeTeam.toFixed(1)} -> ${cashAfterTeam.toFixed(1)}.`,
        "preseason_finance_pressure_sell",
      );
    }
  }

  const refill = refillTeamsToMinimum({
    run,
    runContext,
    phase,
    minCashAfterBuy: 0.1,
    transferSource: "admin_preseason_minimum_roster_refill_buy",
  });
  log(run, "info", phase, `Mindestkader-Refill abgeschlossen: ${refill.bought} Kaeufe, offen ${refill.unresolved.length}.`);
  writeRun(run);

  if (runContext.deferredWrites > 0) {
    currentSave = flushLocalTransfermarktRunContext(runContext);
  } else {
    currentSave = runContext.save;
  }

  currentSave = applyPreseasonEmergencyBoardFunding({
    run,
    save: currentSave,
    persistence,
    phase,
  });

  const unresolved = currentSave.gameState.teams
    .map((team) => {
      const identity = currentSave.gameState.teamIdentities.find((entry) => entry.teamId === team.teamId) ?? null;
      const { playerMin } = deriveRosterTargets(team, identity);
      return {
        team,
        playerMin,
        roster: getTeamRosterCount(currentSave.gameState, team.teamId),
        cash: getTeamCash(currentSave.gameState, team.teamId),
      };
    })
    .filter((entry) => entry.cash < 0 || entry.roster < entry.playerMin);

  if (sold > 0) {
    log(run, "yellow", phase, `Preseason Cash-Recovery: ${sold} echte Verkäufe, ${recoveredTeams} Teams wieder positiv.`, "preseason_cash_recovery_sell");
  }
  if (pressureSold > 0) {
    log(run, "yellow", phase, `Preseason Finanzdruck: ${pressureSold} Verkäufe bei ${pressureTeams} Teams wegen negativer GuV/zu wenig Puffer.`, "preseason_finance_pressure_summary");
  }
  if (refill.unresolved.length > 0) {
    log(run, "red", phase, `Mindestkader nach Refill weiter offen: ${refill.unresolved.slice(0, 10).join(", ")}`, "minimum_roster_refill_unresolved");
  }
  unresolved.slice(0, 10).forEach((entry) => {
    const message = `${entry.team.shortCode}: Cash ${entry.cash.toFixed(1)}, Kader ${entry.roster}/${entry.playerMin}; positiver Cash und Mindestkader mit verfuegbarem Markt nicht erreichbar.`;
    log(run, "red", phase, message, "preseason_cash_recovery_unresolved");
    blockingReasons.push(message);
  });

  return { save: currentSave, sold, recoveredTeams, blockingReasons };
}

async function runMarketPhase(
  run: AdminSeasonSimulationRunState,
  save: PersistedSaveGame,
  persistence: PersistenceService,
  phase: "sell_contract_exits" | "buy_draft",
) {
  const playedResultsInSeason = (save.gameState.seasonState.matchdayResults ?? []).filter(
    (result) => result.seasonId === save.gameState.season.id,
  ).length;
  const isPreseasonWindow = playedResultsInSeason === 0;
  const shouldRunFullChurn = run.fullChurnStress && isPreseasonWindow;
  const shouldRunRealisticFollowUpMarket = false;
  if (!shouldRunFullChurn && !shouldRunRealisticFollowUpMarket) {
    log(
      run,
      "info",
      phase,
      `${PHASE_LABELS[phase]} uebersprungen: V1 laeuft auf bereits bewusst gewaehlt/gepicktem Save.`,
    );
    advanceUnit(run);
    run.cursor.phaseIndex += 1;
    return;
  }

  const performanceBudgetMs = shouldRunFullChurn ? 45_000 : 60_000;
  const result = await phaseTimeout(
    phase,
    applyAiMarketPlanLocally({
      source: "sqlite",
      saveId: save.saveId,
      seasonId: save.gameState.season.id,
      teamScope: "ai",
      dryRun: run.mode !== "apply",
      includeWarningTeams: true,
      confirmToken: run.mode === "apply" ? AI_MARKET_APPLY_CONFIRM_TOKEN : null,
      transferPhase: run.mode === "apply" ? LOCAL_TRANSFER_WINDOW_PHASE : null,
      options: {
        applySellSteps: phase === "sell_contract_exits",
        applyBuySteps: phase === "buy_draft",
        stopOnTeamFailure: false,
        performanceBudgetMs,
      },
    }),
  );

  if (result.status === "blocked") {
    markBlocked(run, phase, result.blockingReasons[0] ?? `${PHASE_LABELS[phase]} blockiert.`, `${phase}_blocked`);
    return;
  }
  result.warnings.slice(0, 12).forEach((warning) => log(run, "yellow", phase, warning, `${phase}_warning`));
  const marketMode = shouldRunFullChurn ? "Full-Churn" : "Realistic Follow-up";
  log(
    run,
    "info",
    phase,
    `${PHASE_LABELS[phase]} (${marketMode}): ${result.summary.appliedSells} Verkäufe, ${result.summary.appliedBuys} Käufe.`,
  );
  const recoverySave = resolveSave(persistence, save.saveId);
  const recovery = runPreseasonCashRecovery(run, recoverySave, persistence, phase);
  if (recovery.blockingReasons.length > 0) {
    markBlocked(run, phase, recovery.blockingReasons[0]!, "preseason_cash_recovery_blocked");
    return;
  }
  advanceUnit(run);
  run.cursor.phaseIndex += 1;
}

function runFormCards(run: AdminSeasonSimulationRunState, save: PersistedSaveGame, persistence: PersistenceService) {
  const before = (save.gameState.seasonState.formCards ?? []).filter((card) => card.seasonId === save.gameState.season.id).length;
  const nextGameState = ensureLocalFormCardsForSeason(save.gameState, save.saveId, save.gameState.season.id);
  const after = (nextGameState.seasonState.formCards ?? []).filter((card) => card.seasonId === save.gameState.season.id).length;
  if (after === 0) {
    markBlocked(run, "form_cards", "Keine Formkarten generierbar.", "form_cards_missing");
    return;
  }
  let trainingSettingsApplied = 0;
  const rosterPlayerIdsByTeamId = new Map<string, Set<string>>();
  for (const roster of nextGameState.rosters) {
    const current = rosterPlayerIdsByTeamId.get(roster.teamId) ?? new Set<string>();
    current.add(roster.playerId);
    rosterPlayerIdsByTeamId.set(roster.teamId, current);
  }
  const trainingSettings: Record<string, AiManagerTrainingSettingRecord> = {
    ...(nextGameState.seasonState.aiManagerTrainingSettings ?? {}),
  };
  const trainingModeByPlayerId = new Map<string, GameState["players"][number]["trainingMode"]>();
  const previewSave: PersistedSaveGame = {
    ...save,
    status: "active",
    gameState: nextGameState,
  };
  for (const team of nextGameState.teams) {
    if (team.humanControlled !== false) continue;
    const preview = buildAiTeamManagementPreview(nextGameState, team.teamId);
    if (!preview) continue;
    const trainingPreview = previewTeamTrainingSettings({
      save: previewSave,
      teamId: team.teamId,
      trainingFocus: preview.trainingPlan.selectedTrainingFocus,
      trainingIntensity: preview.trainingPlan.selectedTrainingIntensity,
    });
    if (!trainingPreview.ok || !trainingPreview.confirmToken) {
      trainingPreview.blockingReasons
        .slice(0, 2)
        .forEach((reason) => log(run, "yellow", "form_cards", `${team.shortCode}: ${reason}`, "training_settings_warning"));
      continue;
    }
    trainingSettings[team.teamId] = {
      teamId: team.teamId,
      seasonId: nextGameState.season.id,
      sourcePlanId: "admin_season_simulation_training_plan",
      trainingFocus: trainingPreview.trainingFocus,
      trainingIntensity: trainingPreview.trainingIntensity,
      playerTrainingMode: trainingPreview.playerTrainingMode,
      expectedXpEffect: trainingPreview.expectedXpEffect,
      expectedRecoveryEffect: trainingPreview.expectedRecoveryEffect,
      expectedInjuryRiskEffect: trainingPreview.expectedInjuryRiskEffect,
      updatedAt: nowIso(),
    };
    for (const playerId of rosterPlayerIdsByTeamId.get(team.teamId) ?? []) {
      trainingModeByPlayerId.set(playerId, trainingPreview.playerTrainingMode);
    }
    trainingSettingsApplied += 1;
  }
  if (after !== before || trainingSettingsApplied > 0) {
    persistence.saveSingleplayerState(save.saveId, {
      ...nextGameState,
      players: trainingModeByPlayerId.size
        ? nextGameState.players.map((player) =>
            trainingModeByPlayerId.has(player.id) ? { ...player, trainingMode: trainingModeByPlayerId.get(player.id) } : player,
          )
        : nextGameState.players,
      seasonState: {
        ...nextGameState.seasonState,
        aiManagerTrainingSettings: trainingSettings,
      },
    });
  }
  log(
    run,
    before === after ? "info" : "yellow",
    "form_cards",
    `${before === after ? `${after} Formkarten vorhanden.` : `${after} Formkarten generiert.`} TrainingSettings=${trainingSettingsApplied}.`,
  );
  advanceUnit(run);
  run.cursor.phaseIndex += 1;
}

async function runMatchday(run: AdminSeasonSimulationRunState, save: PersistedSaveGame, persistence: PersistenceService) {
  const matchdayId = save.gameState.matchdayState.matchdayId;
  const matchdayIndex = getCurrentMatchdayIndex(save.gameState) + 1;
  run.activeSeasonId = save.gameState.season.id;
  run.activeMatchdayId = matchdayId;
  run.currentOperation = `Spieltag ${matchdayIndex}: Lineups, Resolve, Standings`;
  const totalStartedAt = performance.now();
  const result = await phaseTimeout(
    "matchday_run",
    runLocalMatchdayAutoRun(
      {
        saveId: save.saveId,
        seasonId: save.gameState.season.id,
        matchdayId,
        source: "sqlite",
        execute: true,
        dryRun: false,
        confirmToken: MATCHDAY_AUTO_RUN_CONFIRM_TOKEN,
        options: {
          includeWarningLineups: true,
          overwriteExistingLineups: true,
          stopOnTie: false,
          advanceAfterCashApply: false,
        },
      },
      persistence,
    ),
  );
  const perfRowsBase = {
    seasonId: save.gameState.season.id,
    matchdayId,
    matchdayIndex,
  };
  const aiStep = result.steps.find((step) => step.key === "ai_lineups");
  const resultApplyStep = result.steps.find((step) => step.key === "result_apply");
  const standingsStep = result.steps.find((step) => step.key === "standings_apply");
  const metricNumber = (step: (typeof result.steps)[number] | undefined, key: string) => {
    const value = step?.metrics?.[key];
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
  };
  appendMatchdayPerformanceRows(run, [
    { ...perfRowsBase, phase: "ai_lineup_generation", durationMs: metricNumber(aiStep, "aiBatchTotalMs"), itemCount: result.appliedAudits.aiLineupTeamsSaved, source: "matchday_auto_run" },
    { ...perfRowsBase, phase: "resolve_preview_apply", durationMs: metricNumber(resultApplyStep, "resultApplyTotalMs"), itemCount: result.appliedAudits.resultApply ? 1 : 0, source: "matchday_auto_run" },
    { ...perfRowsBase, phase: "standings_apply", durationMs: metricNumber(standingsStep, "durationMs"), itemCount: result.appliedAudits.standingsApply ? 1 : 0, source: "matchday_auto_run" },
    { ...perfRowsBase, phase: result.ok ? "matchday_total" : "matchday_total_before_block", durationMs: elapsedSince(totalStartedAt), itemCount: 1, source: "admin_runner" },
  ]);
  result.steps.forEach((step) => {
    if (step.status === "blocked") log(run, "red", "matchday_run", `${step.label}: ${step.blockingReasons.join(" · ")}`, "matchday_step_blocked");
    else if (step.status === "warning") log(run, "yellow", "matchday_run", `${step.label}: ${step.warnings.slice(0, 3).join(" · ")}`, "matchday_step_warning");
    else log(run, "info", "matchday_run", `${step.label}: ${step.status}`);
  });
  if (!result.ok) {
    markBlocked(run, "matchday_run", result.blockingReasons[0] ?? "Matchday Auto-Run blockiert.", "matchday_auto_run_blocked");
    return;
  }
  advanceUnit(run);
  run.cursor.phaseIndex += 1;
}

async function runMatchdayAdvance(run: AdminSeasonSimulationRunState, save: PersistedSaveGame, persistence: PersistenceService) {
  const result = await phaseTimeout(
    "matchday_advance",
    executeMatchdayAdvance(
      {
        saveId: save.saveId,
        seasonId: save.gameState.season.id,
        source: "sqlite",
        execute: true,
        dryRun: false,
        confirm: ADVANCE_MATCHDAY_CONFIRM_TOKEN,
      },
      persistence,
    ),
  );
  if (!result.ok || !result.applied) {
    if (result.duplicateDetected && result.blockingReasons.includes("duplicate_matchday_advance_for_current_scope")) {
      log(
        run,
        "info",
        "matchday_advance",
        result.scope.nextMatchdayId
          ? `Advance bereits protokolliert. Weiter zu ${result.scope.nextMatchdayId}.`
          : "Letzter Spieltag war bereits als abgeschlossen protokolliert.",
      );
      advanceUnit(run);
      if (result.scope.nextMatchdayId) {
        run.cursor.phaseIndex = PHASES.indexOf("matchday_run");
        run.cursor.matchdayIndex += 1;
      } else {
        run.cursor.phaseIndex += 1;
      }
      return;
    }
    markBlocked(run, "matchday_advance", result.blockingReasons[0] ?? "Matchday Advance blockiert.", "matchday_advance_blocked");
    return;
  }
  log(run, "info", "matchday_advance", result.scope.nextMatchdayId ? `Weiter zu ${result.scope.nextMatchdayId}.` : "Letzter Spieltag abgeschlossen.");
  advanceUnit(run);
  if (result.scope.nextMatchdayId) {
    run.cursor.phaseIndex = PHASES.indexOf("matchday_run");
    run.cursor.matchdayIndex += 1;
  } else {
    run.cursor.phaseIndex += 1;
  }
}

async function runSeasonEndCash(run: AdminSeasonSimulationRunState, save: PersistedSaveGame, persistence: PersistenceService) {
  const result = await phaseTimeout(
    "season_end_cash",
    executeCashPrizeApply(
      {
        saveId: save.saveId,
        seasonId: save.gameState.season.id,
        matchdayId: save.gameState.matchdayState.matchdayId,
        source: "sqlite",
        phase: "season_end",
        execute: true,
        dryRun: false,
        confirm: CASH_PRIZE_APPLY_CONFIRM_TOKEN,
      },
      persistence,
    ),
  );
  if (!result.ok || !result.applied) {
    if (result.duplicateDetected && result.blockingReasons.includes("duplicate_apply_for_save_season_block")) {
      log(run, "info", "season_end_cash", "Cash Apply war bereits fuer diese Season protokolliert.");
      advanceUnit(run);
      run.cursor.phaseIndex += 1;
      return;
    }
    markBlocked(run, "season_end_cash", result.blockingReasons[0] ?? "Season-End Cash blockiert.", "season_end_cash_blocked");
    return;
  }
  log(run, "info", "season_end_cash", `Preisgeld-Benchmark: ${result.plannedChanges.length} Teams (kein Cash-Payout).`);
  advanceUnit(run);
  run.cursor.phaseIndex += 1;
}

function runXpDevelopment(run: AdminSeasonSimulationRunState, save: PersistedSaveGame, persistence: PersistenceService) {
  const developmentSave = setSavePhase(save, "player_development", persistence);
  let appliedPlayers = 0;
  let appliedUpgrades = 0;
  const teamIds = developmentSave.gameState.teams.map((team) => team.teamId);
  for (const [teamIndex, teamId] of teamIds.entries()) {
    run.activeTeamId = teamId;
    run.currentOperation = `XP/Development ${teamIndex + 1}/${teamIds.length}`;
    if (teamIndex === 0 || teamIndex % 4 === 0) {
      log(run, "info", "xp_development", `XP-Block ${teamIndex + 1}/${teamIds.length} gestartet.`);
      writeRun(run);
    }
    const currentSave = resolveSave(persistence, developmentSave.saveId);
    const xpPreviewSave: PersistedSaveGame = {
      ...currentSave,
      status: "active",
    };
    const team = xpPreviewSave.gameState.teams.find((entry) => entry.teamId === teamId) ?? null;
    const aiPlan = team?.humanControlled === false ? previewAiSeasonEndXpSpend(xpPreviewSave, teamId) : null;
    if (aiPlan?.confirmToken && aiPlan.blockers.length === 0) {
      const applied = applySeasonEndXpSpend(xpPreviewSave, teamId, aiPlan.plannedUpgrades, aiPlan.confirmToken, persistence, { allowAiTeams: true });
      if (applied.applied) {
        appliedPlayers += applied.players.length;
        appliedUpgrades += applied.plannedUpgrades.length;
      } else {
        applied.blockingReasons.forEach((reason) => log(run, "yellow", "xp_development", `${teamId}: ${reason}`, "xp_apply_warning"));
      }
      continue;
    }

    const preview = previewSeasonEndXpSpend(xpPreviewSave, teamId, []);
    if (preview.confirmToken) {
      const applied = applySeasonEndXpSpend(xpPreviewSave, teamId, [], preview.confirmToken, persistence, { allowAiTeams: true });
      if (applied.applied) appliedPlayers += applied.players.length;
      else applied.blockingReasons.forEach((reason) => log(run, "yellow", "xp_development", `${teamId}: ${reason}`, "xp_apply_warning"));
    } else if ((aiPlan?.blockers.length ?? 0) > 0 || preview.blockingReasons.length > 0) {
      (aiPlan?.blockers ?? [])
        .slice(0, 3)
        .forEach((reason) => log(run, "yellow", "xp_development", `${teamId}: ${reason}`, "ai_xp_preview_warning"));
      preview.blockingReasons
        .slice(0, 3)
        .forEach((reason) => log(run, "yellow", "xp_development", `${teamId}: ${reason}`, "xp_preview_warning"));
    }
  }
  run.activeTeamId = null;
  log(run, "info", "xp_development", `XP materialisiert fuer ${appliedPlayers} Spieler, Upgrades ${appliedUpgrades}.`);
  advanceUnit(run);
  run.cursor.phaseIndex += 1;
}

function buildPromisedRoleRelationshipEvents(
  gameState: GameState,
  moraleState: NonNullable<GameState["playerMoraleState"]>,
): PlayerRelationshipEventRecord[] {
  const promisedRoleByPlayerId = new Map(
    gameState.rosters
      .filter((roster) => Boolean(roster.promisedRole))
      .map((roster) => [roster.playerId, roster.promisedRole] as const),
  );
  const timestamp = nowIso();
  const events: PlayerRelationshipEventRecord[] = [];

  for (const morale of moraleState) {
    const promisedRole = promisedRoleByPlayerId.get(morale.playerId);
    if (!promisedRole) continue;
    const playtimeReason = morale.reasons.find((reason) =>
      ["good_playtime", "relative_role_fulfilled", "low_playtime", "star_not_used"].includes(reason.reasonId),
    );
    if (!playtimeReason) continue;

    const reason =
      playtimeReason.reasonId === "star_not_used" || playtimeReason.reasonId === "low_playtime"
        ? "promised_role_broken"
        : playtimeReason.valueDelta >= 5
          ? "promised_role_exceeded"
          : "promised_role_fulfilled";
    const severity = playtimeReason.valueDelta < 0 ? "negative" : playtimeReason.valueDelta > 0 ? "positive" : "neutral";
    events.push({
      eventId: `relationship__${gameState.season.id}__${morale.teamId}__${morale.playerId}__${reason}`,
      seasonId: gameState.season.id,
      teamId: morale.teamId,
      playerId: morale.playerId,
      reason: `${reason}:${promisedRole}`,
      delta: playtimeReason.valueDelta,
      severity,
      createdAt: timestamp,
      source: "promised_role_morale",
    });
  }

  return events;
}

function runFacilities(run: AdminSeasonSimulationRunState, save: PersistedSaveGame, persistence: PersistenceService) {
  let applied = 0;
  const facilityIds = Object.keys(FACILITY_CATALOG_BY_ID) as FacilityId[];
  let workingGameState = save.gameState;
  const events: FacilityEventRecord[] = [];
  const timestamp = nowIso();

  for (const [teamIndex, team] of save.gameState.teams.entries()) {
    run.activeTeamId = team.teamId;
    run.currentOperation = `Facilities ${teamIndex + 1}/${save.gameState.teams.length}`;
    if (teamIndex === 0 || teamIndex % 8 === 0) {
      writeRun(run);
    }
    for (const facilityId of facilityIds) {
      const currentSave: PersistedSaveGame = { ...save, gameState: workingGameState };
      const preview = previewFacilityMaintenance(currentSave, team.teamId, facilityId);
      if (!preview.ok || !preview.confirmToken) continue;
      if (run.mode === "apply" || run.mode === "dry_run") {
        const teamFacilities = getTeamFacilityState(workingGameState, team.teamId);
        const previous = teamFacilities.facilities[facilityId];
        const event: FacilityEventRecord = {
          eventId: `facility-event-${randomUUID()}`,
          seasonId: workingGameState.season.id,
          teamId: team.teamId,
          facilityId,
          previousLevel: preview.level,
          nextLevel: preview.level,
          cost: preview.maintenanceCost,
          timestamp,
          source: "manual_facility_maintenance",
          previousConditionPct: preview.conditionPct,
          nextConditionPct: FACILITY_CONDITION_FULL,
        };
        events.push(event);
        workingGameState = {
          ...workingGameState,
          teams: workingGameState.teams.map((entry) =>
            entry.teamId === team.teamId
              ? {
                  ...entry,
                  cash: roundValue(entry.cash - preview.maintenanceCost),
                }
              : entry,
          ),
          seasonState: {
            ...workingGameState.seasonState,
            teamFacilities: {
              ...(workingGameState.seasonState.teamFacilities ?? {}),
              [team.teamId]: {
                facilities: {
                  ...teamFacilities.facilities,
                  [facilityId]: {
                    ...previous,
                    conditionPct: FACILITY_CONDITION_FULL,
                    enabled: true,
                    disabledReason: undefined,
                  },
                },
              },
            },
          },
        };
        applied += 1;
      }
    }
  }
  run.activeTeamId = null;
  if (applied > 0) {
    persistence.saveSingleplayerState(save.saveId, {
      ...workingGameState,
      seasonState: {
        ...workingGameState.seasonState,
        facilityEvents: [...events, ...(workingGameState.seasonState.facilityEvents ?? [])],
      },
    });
  }
  log(run, "info", "facilities", applied > 0 ? `${applied} Facility-Wartungen angewendet.` : "Keine Facility-Wartung offen.");
  advanceUnit(run);
  run.cursor.phaseIndex += 1;
}

function runContracts(run: AdminSeasonSimulationRunState, save: PersistedSaveGame, persistence: PersistenceService) {
  const transitionSave = setSavePhase(save, "preseason_management", persistence);
  const moraleState = buildCurrentMoraleState(transitionSave.gameState);
  const relationshipEvents = buildPromisedRoleRelationshipEvents(transitionSave.gameState, moraleState);
  const relationshipEventIds = new Set(relationshipEvents.map((event) => event.eventId));
  const moraleSave =
    moraleState.length > 0
      ? persistence.saveSingleplayerState(transitionSave.saveId, {
          ...transitionSave.gameState,
          playerMoraleState: moraleState,
          playerRelationshipEvents: [
            ...relationshipEvents,
            ...(transitionSave.gameState.playerRelationshipEvents ?? []).filter(
              (event) => !relationshipEventIds.has(event.eventId),
            ),
          ],
        })
      : transitionSave;
  const preview = previewSeasonEndContracts(moraleSave);
  if (!preview.ok) {
    preview.blockingReasons.slice(0, 10).forEach((reason) => log(run, "yellow", "contracts", reason, "contract_warning"));
  }
  if (run.mode === "apply") {
    const result = applySeasonEndContractTick(moraleSave, preview.confirmToken, persistence);
    if (!result.applied) {
      markBlocked(run, "contracts", result.blockingReasons[0] ?? "Contracts blockiert.", "contracts_blocked");
      return;
    }
    const afterContractsSave = resolveSave(persistence, save.saveId);
    const refillContext = createLocalTransfermarktRunContext({ save: afterContractsSave, persistence });
    const refill = refillTeamsToMinimum({
      run,
      runContext: refillContext,
      phase: "contracts",
      minCashAfterBuy: 0.1,
      transferSource: "admin_contract_minimum_roster_refill_buy",
    });
    if (refillContext.deferredWrites > 0) {
      flushLocalTransfermarktRunContext(refillContext);
    }
    if (refill.unresolved.length > 0) {
      markBlocked(
        run,
        "contracts",
        `Mindestkader nach Contracts nicht erreichbar: ${refill.unresolved.slice(0, 10).join(", ")}`,
        "contracts_minimum_roster_unresolved",
      );
      return;
    }
    log(
      run,
      "info",
      "contracts",
      `${result.renewedPlayers} verlaengert, ${result.releasedPlayers} ausgelaufen/freigegeben, ${refill.bought} Refill-Kaeufe.`,
    );
  } else {
    log(run, "info", "contracts", `${preview.expiringCount} auslaufende Verträge im Dry Run. MoraleStates=${moraleState.length}.`);
  }
  advanceUnit(run);
  run.cursor.phaseIndex += 1;
}

async function runTransition(run: AdminSeasonSimulationRunState, save: PersistedSaveGame, persistence: PersistenceService) {
  const token = buildPreSeasonNextSeasonSetupToken(save);
  const result = applyPreSeasonNextSeasonSetupLightweight(save, token.confirmToken, persistence);
  if (!result.applied) {
    markBlocked(run, "transition", result.blockingReasons[0] ?? "Season Transition blockiert.", "transition_blocked");
    return;
  }
  log(run, "yellow", "transition", `Lightweight-Transition genutzt. Neue Season aktiv: ${result.saveContext.seasonId}.`, "transition_lightweight");

  advanceUnit(run);
  run.cursor.seasonIndex += 1;
  run.cursor.matchdayIndex = 0;
  run.cursor.phaseIndex = 0;
  if (run.cursor.seasonIndex >= run.requestedSeasons) {
    run.status = "completed";
    run.activePhase = "done";
    run.completedAt = nowIso();
    run.currentOperation = "Simulation abgeschlossen";
    run.progressPct = 100;
  }
}

async function executeCurrentPhase(run: AdminSeasonSimulationRunState) {
  const execution = createExecutionContext(run);
  const { persistence, save } = execution;
  const phase = PHASES[run.cursor.phaseIndex] ?? "transition";
  run.activePhase = phase;
  run.activeSeasonId = save.gameState.season.id;
  run.activeMatchdayId = save.gameState.matchdayState.matchdayId;
  run.activeTeamId = null;
  run.currentOperation = PHASE_LABELS[phase];
  run.heartbeatAt = nowIso();
  appendReport(run, { type: "phase_start", phase, seasonId: save.gameState.season.id, matchdayId: save.gameState.matchdayState.matchdayId });

  switch (phase) {
    case "market_pre_check":
      runMarketPreCheck(run, save, persistence);
      break;
    case "sell_contract_exits":
    case "buy_draft":
      await runMarketPhase(run, save, persistence, phase);
      break;
    case "form_cards":
      runFormCards(run, save, persistence);
      break;
    case "matchday_run":
      await runMatchday(run, save, persistence);
      break;
    case "matchday_advance":
      await runMatchdayAdvance(run, save, persistence);
      break;
    case "season_end_cash":
      await runSeasonEndCash(run, save, persistence);
      break;
    case "xp_development":
      runXpDevelopment(run, save, persistence);
      break;
    case "facilities":
      runFacilities(run, save, persistence);
      break;
    case "contracts":
      runContracts(run, save, persistence);
      break;
    case "snapshot_archive":
      log(run, "info", "snapshot_archive", "Snapshot wird durch Transition/Next-Season-Setup idempotent gespeichert.");
      advanceUnit(run);
      run.cursor.phaseIndex += 1;
      break;
    case "transition":
      await runTransition(run, save, persistence);
      break;
  }

  appendReport(run, { type: "phase_end", phase, status: run.status, progressPct: run.progressPct });
  execution.flush();
}

export function startAdminSeasonSimulation(input: AdminSeasonSimulationStartInput): AdminSeasonSimulationRunState {
  ensureRunDir();
  const persistence = createPersistenceService();
  const save = resolveSave(persistence, input.saveId);
  const runId = `admin-season-sim-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const jsonl = reportPath(runId, "jsonl");
  const summary = reportPath(runId, "summary.json");
  const reports =
    input.mode === "dry_run"
      ? { directory: RUN_DIR, jsonl, summary, dryRunSave: dryRunSavePath(runId) }
      : { directory: RUN_DIR, jsonl, summary };
  const run: AdminSeasonSimulationRunState = {
    runId,
    saveId: save.saveId,
    requestedSeasons: input.seasonCount,
    mode: input.mode,
    fullChurnStress: input.fullChurnStress,
    injuriesTestMode: input.injuriesTestMode,
    status: "running",
    activePhase: "idle",
    activeSeasonId: save.gameState.season.id,
    activeMatchdayId: save.gameState.matchdayState.matchdayId,
    activeTeamId: null,
    currentOperation: "bereit",
    startedAt: nowIso(),
    updatedAt: nowIso(),
    heartbeatAt: nowIso(),
    completedAt: null,
    durationMs: 0,
    progressPct: 0,
    completedUnits: 0,
    estimatedTotalUnits: estimateTotalUnits(save, input.seasonCount),
    cursor: {
      seasonIndex: 0,
      phaseIndex: 0,
      matchdayIndex: getCurrentMatchdayIndex(save.gameState),
    },
    reports,
    logs: [],
    issues: [],
  };
  log(run, "info", "control", `Simulation gestartet: ${input.seasonCount} Season(s), ${input.mode}.`);
  if (input.injuriesTestMode) {
    log(run, "yellow", "control", "Injury-Testmode ist sichtbar geschaltet; V1 veraendert keine globalen Injury-Rates.", "injury_testmode_not_global");
  }
  return writeRun(run);
}

export async function tickAdminSeasonSimulation(runId: string): Promise<AdminSeasonSimulationRunState | null> {
  const run = readRun(runId);
  if (!run) return null;
  if (run.status !== "running") return run;
  try {
    await executeCurrentPhase(run);
  } catch (error) {
    const phase = run.activePhase === "idle" || run.activePhase === "done" ? "market_pre_check" : run.activePhase;
    markBlocked(run, phase, error instanceof Error ? error.message : "Simulation tick failed.", "simulation_tick_failed");
  }
  const updated = writeRun(run);
  fs.writeFileSync(updated.reports.summary, `${JSON.stringify(updated, null, 2)}\n`, "utf8");
  return updated;
}

export function readAdminSeasonSimulation(runId: string): AdminSeasonSimulationRunState | null {
  return readRun(runId);
}

export function setAdminSeasonSimulationStatus(runId: string, status: "paused" | "running" | "cancelled") {
  const run = readRun(runId);
  if (!run) return null;
  if (run.status === "completed" || run.status === "blocked") return run;
  run.status = status;
  run.heartbeatAt = nowIso();
  if (status === "cancelled") run.completedAt = nowIso();
  log(run, status === "cancelled" ? "yellow" : "info", "control", `Status: ${status}.`);
  return writeRun(run);
}
