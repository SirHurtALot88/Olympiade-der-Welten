import { createFreshSeasonOneGameState } from "@/lib/game-state/singleplayer-state";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { SEASON_START_RESET_CONFIRM_TOKEN } from "@/lib/persistence/season-start-reset-contract";
import { loadTeamStartCashReference } from "@/lib/season/team-start-cash";

type SaveContext = {
  source: "sqlite";
  requestedSaveId: string | null;
  resolvedSaveId: string | null;
  requestedSeasonId: string | null;
  resolvedSeasonId: string | null;
  saveName: string | null;
  saveStatus: string | null;
  scopeWarning: string | null;
};

type TeamResetRow = {
  teamId: string;
  teamCode: string;
  teamName: string;
  currentCash: number | null;
  resetCash: number | null;
  currentRosterCount: number;
  resetRosterCount: number;
  currentTransferCount: number;
  warnings: string[];
};

export type SeasonStartResetResponse = {
  source: "sqlite";
  readOnly: false;
  dryRun: boolean;
  executed: boolean;
  status: "ready" | "warning" | "blocked" | "applied";
  saveContext: SaveContext;
  summary: {
    currentTransfers: number;
    resetTransfers: number;
    currentRosterEntries: number;
    resetRosterEntries: number;
    currentMatchdayResults: number;
    resetMatchdayResults: number;
    currentStoredLineups: number;
    resetStoredLineups: number;
    teamsAffected: number;
    startCashSource: "reference" | "fresh_seed_fallback";
    startCashRowsApplied: number;
  };
  teams: TeamResetRow[];
  warnings: string[];
  blockingReasons: string[];
};

type RunSeasonStartResetParams = {
  source?: "sqlite" | "prisma";
  saveId: string;
  seasonId: string;
  dryRun?: boolean;
  confirmToken?: string | null;
};

function countStoredLineups(gameState: ReturnType<typeof createFreshSeasonOneGameState>) {
  const stored = gameState.seasonState.lineupDrafts;
  if (!stored) {
    return 0;
  }
  return stored.length;
}

function resolveSaveContext(input: { saveId: string; seasonId: string }) {
  const persistence = createPersistenceService();
  const save = persistence.getSaveById(input.saveId);
  if (!save) {
    return {
      persistence,
      save: null,
      saveContext: {
        source: "sqlite" as const,
        requestedSaveId: input.saveId,
        resolvedSaveId: null,
        requestedSeasonId: input.seasonId,
        resolvedSeasonId: null,
        saveName: null,
        saveStatus: null,
        scopeWarning: `Requested save ${input.saveId} could not be resolved for season start reset.`,
      },
    };
  }

  if (save.gameState.season.id !== input.seasonId) {
    return {
      persistence,
      save: null,
      saveContext: {
        source: "sqlite" as const,
        requestedSaveId: input.saveId,
        resolvedSaveId: save.saveId,
        requestedSeasonId: input.seasonId,
        resolvedSeasonId: save.gameState.season.id,
        saveName: save.name ?? null,
        saveStatus: save.status ?? null,
        scopeWarning: `Requested season ${input.seasonId} is not available in save ${save.saveId}.`,
      },
    };
  }

  return {
    persistence,
    save,
    saveContext: {
      source: "sqlite" as const,
      requestedSaveId: input.saveId,
      resolvedSaveId: save.saveId,
      requestedSeasonId: input.seasonId,
      resolvedSeasonId: save.gameState.season.id,
      saveName: save.name ?? null,
      saveStatus: save.status ?? null,
      scopeWarning: null,
    },
  };
}

async function buildResetGameState() {
  const freshGameState = createFreshSeasonOneGameState();
  freshGameState.rosters = [];
  freshGameState.contracts = [];
  freshGameState.transferHistory = [];
  freshGameState.transferListings = [];
  const reference = await loadTeamStartCashReference();
  const warnings = [...reference.warnings, ...reference.errors];
  let startCashSource: "reference" | "fresh_seed_fallback" = "fresh_seed_fallback";
  let startCashRowsApplied = 0;

  if (reference.status === "ok" && reference.rows.length > 0) {
    const rowsByCode = new Map(
      reference.rows
        .filter((row) => row.startCash != null)
        .map((row) => [row.teamCode.trim().toUpperCase(), row.startCash as number]),
    );

    freshGameState.teams = freshGameState.teams.map((team) => {
      const rowValue = rowsByCode.get(team.shortCode.trim().toUpperCase()) ?? rowsByCode.get(team.teamId.trim().toUpperCase());
      if (rowValue == null) {
        warnings.push(`start_cash_missing:${team.shortCode}`);
        return team;
      }
      startCashRowsApplied += 1;
      return {
        ...team,
        cash: rowValue,
      };
    });

    startCashSource = "reference";
  } else {
    warnings.push("team_start_cash_reference_missing");
  }

  return {
    resetGameState: freshGameState,
    startCashSource,
    startCashRowsApplied,
    warnings,
  };
}

function buildTeamRows(
  currentGameState: ReturnType<typeof createFreshSeasonOneGameState>,
  resetGameState: ReturnType<typeof createFreshSeasonOneGameState>,
) {
  return currentGameState.teams
    .map((team) => {
      const resetTeam = resetGameState.teams.find((entry) => entry.teamId === team.teamId) ?? null;
      const currentRosterCount = currentGameState.rosters.filter((entry) => entry.teamId === team.teamId).length;
      const resetRosterCount = resetGameState.rosters.filter((entry) => entry.teamId === team.teamId).length;
      const currentTransferCount = currentGameState.transferHistory.filter(
        (entry) => entry.toTeamId === team.teamId || entry.fromTeamId === team.teamId,
      ).length;
      const warnings: string[] = [];
      if (!resetTeam) {
        warnings.push("team_missing_in_reset_state");
      }

      return {
        teamId: team.teamId,
        teamCode: team.shortCode,
        teamName: team.name,
        currentCash: team.cash ?? null,
        resetCash: resetTeam?.cash ?? null,
        currentRosterCount,
        resetRosterCount,
        currentTransferCount,
        warnings,
      } satisfies TeamResetRow;
    })
    .sort((left, right) => left.teamCode.localeCompare(right.teamCode, "de"));
}

export async function runSeasonStartReset(
  input: RunSeasonStartResetParams,
): Promise<SeasonStartResetResponse> {
  if ((input.source ?? "sqlite") === "prisma") {
    return {
      source: "sqlite",
      readOnly: false,
      dryRun: true,
      executed: false,
      status: "blocked",
      saveContext: {
        source: "sqlite",
        requestedSaveId: input.saveId,
        resolvedSaveId: null,
        requestedSeasonId: input.seasonId,
        resolvedSeasonId: null,
        saveName: null,
        saveStatus: null,
        scopeWarning: "Prisma/Supabase mode is read-only in this build.",
      },
      summary: {
        currentTransfers: 0,
        resetTransfers: 0,
        currentRosterEntries: 0,
        resetRosterEntries: 0,
        currentMatchdayResults: 0,
        resetMatchdayResults: 0,
        currentStoredLineups: 0,
        resetStoredLineups: 0,
        teamsAffected: 0,
        startCashSource: "fresh_seed_fallback",
        startCashRowsApplied: 0,
      },
      teams: [],
      warnings: [],
      blockingReasons: ["read_only_source"],
    };
  }

  const dryRun = input.dryRun ?? true;
  const { persistence, save, saveContext } = resolveSaveContext({
    saveId: input.saveId,
    seasonId: input.seasonId,
  });

  if (!save) {
    return {
      source: "sqlite",
      readOnly: false,
      dryRun,
      executed: false,
      status: "blocked",
      saveContext,
      summary: {
        currentTransfers: 0,
        resetTransfers: 0,
        currentRosterEntries: 0,
        resetRosterEntries: 0,
        currentMatchdayResults: 0,
        resetMatchdayResults: 0,
        currentStoredLineups: 0,
        resetStoredLineups: 0,
        teamsAffected: 0,
        startCashSource: "fresh_seed_fallback",
        startCashRowsApplied: 0,
      },
      teams: [],
      warnings: [],
      blockingReasons: ["save_not_found"],
    };
  }

  if (!dryRun && input.confirmToken !== SEASON_START_RESET_CONFIRM_TOKEN) {
    return {
      source: "sqlite",
      readOnly: false,
      dryRun,
      executed: false,
      status: "blocked",
      saveContext,
      summary: {
        currentTransfers: save.gameState.transferHistory.length,
        resetTransfers: 0,
        currentRosterEntries: save.gameState.rosters.length,
        resetRosterEntries: 0,
        currentMatchdayResults: save.gameState.seasonState.matchdayResults?.length ?? 0,
        resetMatchdayResults: 0,
        currentStoredLineups: countStoredLineups(save.gameState),
        resetStoredLineups: 0,
        teamsAffected: save.gameState.teams.length,
        startCashSource: "fresh_seed_fallback",
        startCashRowsApplied: 0,
      },
      teams: [],
      warnings: [],
      blockingReasons: ["confirm_token_required"],
    };
  }

  const { resetGameState, startCashSource, startCashRowsApplied, warnings } = await buildResetGameState();
  const teams = buildTeamRows(save.gameState, resetGameState);

  const response: SeasonStartResetResponse = {
    source: "sqlite",
    readOnly: false,
    dryRun,
    executed: false,
    status: warnings.length > 0 ? "warning" : "ready",
    saveContext,
    summary: {
      currentTransfers: save.gameState.transferHistory.length,
      resetTransfers: resetGameState.transferHistory.length,
      currentRosterEntries: save.gameState.rosters.length,
      resetRosterEntries: resetGameState.rosters.length,
      currentMatchdayResults: save.gameState.seasonState.matchdayResults?.length ?? 0,
      resetMatchdayResults: resetGameState.seasonState.matchdayResults?.length ?? 0,
      currentStoredLineups: countStoredLineups(save.gameState),
      resetStoredLineups: countStoredLineups(resetGameState),
      teamsAffected: save.gameState.teams.length,
      startCashSource,
      startCashRowsApplied,
    },
    teams,
    warnings,
    blockingReasons: [],
  };

  if (dryRun) {
    return response;
  }

  persistence.saveSingleplayerState(save.saveId, resetGameState);
  return {
    ...response,
    executed: true,
    dryRun: false,
    status: "applied",
  };
}
