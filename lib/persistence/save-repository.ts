import type {
  Contract,
  Discipline,
  GamePhase,
  GameLogEntry,
  GameState,
  MappingReport,
  MatchdayState,
  Player,
  PlayerBaselineRecord,
  PlayerBaselineWriteGuardEvent,
  RosterEntry,
  Season,
  SeasonState,
  SeasonTransitionState,
  ScenarioMeta,
  Team,
  TeamIdentity,
  TransferHistoryEntry,
  TransferListing,
} from "@/lib/data/olyDataTypes";
import { createGameStateFromSeed, loadSeedData } from "@/lib/data/dataAdapter";
import { hydrateGameStateMedia } from "@/lib/data/mediaAssets";
import { getDatabase } from "@/lib/persistence/sqlite";
import { getTeamPlayerMax } from "@/lib/foundation/roster-limits";
import { buildScenarioMeta, withScenarioMeta } from "@/lib/persistence/scenario-meta";
import { ensurePlayerBaselines, guardPlayerBaselineWrite } from "@/lib/players/player-baseline-service";
import { withNormalizedSeasonDisciplineSchedule } from "@/lib/season/season-discipline-schedule";
import type { PersistedSaveGame, SaveRepository, SaveStatus, SaveSummary } from "@/lib/persistence/types";

type SaveRow = {
  save_id: string;
  name: string;
  status: SaveStatus;
  created_at: string;
  updated_at: string;
};

type GameMetadata = {
  gamePhase?: GamePhase;
  seasonTransition?: SeasonTransitionState;
  scenarioMeta?: ScenarioMeta;
  saveVersion?: number;
  lastAppliedEventId?: string | null;
  appliedEventIds?: string[];
  transitionStatus?: SeasonTransitionState["status"];
  currentStep?: string;
  completedSteps?: string[];
  seasonReviewState?: unknown;
  preSeasonWorkflowState?: unknown;
  playerBaselines?: PlayerBaselineRecord[];
  baselineWriteGuardEvents?: PlayerBaselineWriteGuardEvent[];
  playerProgressionEvents?: GameState["playerProgressionEvents"];
};

function parseJsonColumn<T>(value: string): T {
  return JSON.parse(value) as T;
}

function normalizeLegacyCashCreatorsColdSteelCodes(gameState: GameState): GameState {
  const hasLegacySwappedCodes = gameState.teams.some(
    (team) =>
      (team.name === "Cash Creators" && team.teamId === "C-S") ||
      (team.name === "Cold Steel" && team.teamId === "C-C"),
  );

  if (!hasLegacySwappedCodes) {
    return gameState;
  }

  const normalized = JSON.parse(
    JSON.stringify(gameState)
      .replace(/"C-C"/g, '"__TEAM_CODE_CC__"')
      .replace(/"C-S"/g, '"C-C"')
      .replace(/"__TEAM_CODE_CC__"/g, '"C-S"'),
  ) as GameState;

  return normalized;
}

function normalizeLegacyRosterTargets(gameState: GameState): GameState {
  const identityByTeamId = new Map(gameState.teamIdentities.map((identity) => [identity.teamId, identity]));
  let changed = false;
  const teams = gameState.teams.map((team) => {
    const identity = identityByTeamId.get(team.teamId);
    const playerMin = Number.isFinite(identity?.playerMin) ? Math.round(identity!.playerMin) : null;
    const playerOpt = Number.isFinite(identity?.playerOpt) ? Math.round(identity!.playerOpt) : null;
    const rosterLimit = getTeamPlayerMax(team, identity);
    const rosterMinTarget = team.rosterMinTarget ?? playerMin;
    const rosterOptTarget = team.rosterOptTarget ?? playerOpt;
    if (
      rosterLimit === team.rosterLimit &&
      team.rosterMinTarget === rosterMinTarget &&
      team.rosterOptTarget === rosterOptTarget
    ) {
      return team;
    }
    changed = true;
    return {
      ...team,
      rosterLimit,
      rosterMinTarget,
      rosterOptTarget,
    };
  });

  return changed ? { ...gameState, teams } : gameState;
}

function loadCollection<T>(tableName: string, keyColumn: string, saveId: string) {
  const database = getDatabase();
  const statement = database.prepare(
    `SELECT payload_json FROM ${tableName} WHERE save_id = ? ORDER BY ${keyColumn} ASC`,
  );

  return (statement.all(saveId) as Array<{ payload_json: string }>).map((row) => parseJsonColumn<T>(row.payload_json));
}

function replaceCollection<T>(
  tableName: string,
  keyColumn: string,
  saveId: string,
  items: T[],
  keySelector: (item: T) => string,
) {
  const database = getDatabase();
  const deleteStatement = database.prepare(`DELETE FROM ${tableName} WHERE save_id = ?`);
  const insertStatement = database.prepare(
    `INSERT INTO ${tableName} (save_id, ${keyColumn}, payload_json) VALUES (?, ?, ?)`,
  );

  deleteStatement.run(saveId);
  for (const item of items) {
    insertStatement.run(saveId, keySelector(item), JSON.stringify(item));
  }
}

function replaceSingleton(tableName: string, saveId: string, payload: unknown) {
  const database = getDatabase();
  const statement = database.prepare(
    `INSERT INTO ${tableName} (save_id, payload_json) VALUES (?, ?)
     ON CONFLICT(save_id) DO UPDATE SET payload_json = excluded.payload_json`,
  );
  statement.run(saveId, JSON.stringify(payload));
}

function loadSingleton<T>(tableName: string, saveId: string) {
  const database = getDatabase();
  const row = database.prepare(`SELECT payload_json FROM ${tableName} WHERE save_id = ?`).get(saveId) as
    | { payload_json: string }
    | undefined;
  return row ? parseJsonColumn<T>(row.payload_json) : null;
}

function inferCompletedGamePhase(input: {
  metadata: GameMetadata | null;
  season: Season;
  seasonState: SeasonState;
  matchdayState: MatchdayState;
}): GamePhase | undefined {
  if (input.metadata?.gamePhase) {
    return input.metadata.gamePhase;
  }

  const matchdayIds = input.season.matchdayIds ?? [];
  const lastMatchdayId = matchdayIds[matchdayIds.length - 1];
  if (!lastMatchdayId) {
    return undefined;
  }

  const hasLastMatchdayResult = (input.seasonState.matchdayResults ?? []).some(
    (result) => result.seasonId === input.season.id && result.matchdayId === lastMatchdayId,
  );
  const hasLastStandingsApply = (input.seasonState.standingsApplyLogs ?? []).some(
    (log) => log.seasonId === input.season.id && log.matchdayId === lastMatchdayId,
  );
  const activeLastMatchdayResolved =
    input.matchdayState.matchdayId === lastMatchdayId && input.matchdayState.status === "resolved";

  return hasLastMatchdayResult && hasLastStandingsApply && activeLastMatchdayResolved ? "season_completed" : undefined;
}

function loadScenarioMetaForSummary(saveId: string, createdAt: string) {
  const metadata = loadSingleton<GameMetadata>("game_metadata", saveId);
  if (metadata?.scenarioMeta) {
    return metadata.scenarioMeta;
  }

  const season = loadSingleton<Season>("seasons", saveId);
  const matchdayState = loadSingleton<MatchdayState>("matchday_states", saveId);
  if (!season || !matchdayState) {
    return undefined;
  }

  const activeMatchday =
    Number.isFinite(season.currentMatchday)
      ? season.currentMatchday
      : Number.parseInt(matchdayState.matchdayId.replace(/\D+/g, ""), 10) || undefined;

  return {
    scenarioType: "fresh_start" as const,
    label: "Unmarkierter Save",
    createdAt,
    isStableTestPoint: false,
    containsFinalStandings: false,
    containsSeasonHistory: false,
    activeSeasonId: season.id,
    activeMatchday,
    gamePhase: metadata?.gamePhase ?? "season_active",
  };
}

function loadSaveRow(saveId: string) {
  const database = getDatabase();
  return database
    .prepare("SELECT save_id, name, status, created_at, updated_at FROM saves WHERE save_id = ?")
    .get(saveId) as SaveRow | undefined;
}

function loadBaselineSourcePlayers() {
  return createGameStateFromSeed(loadSeedData()).players;
}

function materializePersistedSave(row: SaveRow): PersistedSaveGame | null {
  const saveId = row.save_id;
  const season = loadSingleton<Season>("seasons", saveId);
  const seasonState = loadSingleton<SeasonState>("season_states", saveId);
  const matchdayState = loadSingleton<MatchdayState>("matchday_states", saveId);
  const gameMetadata = loadSingleton<GameMetadata>("game_metadata", saveId);
  const mappingReport = loadSingleton<MappingReport>("mapping_reports", saveId);

  if (!season || !seasonState || !matchdayState || !mappingReport) {
    return null;
  }

  const gamePhase = inferCompletedGamePhase({ metadata: gameMetadata, season, seasonState, matchdayState });
  const hydrated = hydrateGameStateMedia({
    ...(gamePhase ? { gamePhase } : {}),
    ...(gameMetadata?.seasonTransition ? { seasonTransition: gameMetadata.seasonTransition } : {}),
    ...(gameMetadata?.scenarioMeta ? { scenarioMeta: gameMetadata.scenarioMeta } : {}),
    ...(Number.isFinite(gameMetadata?.saveVersion) ? { saveVersion: gameMetadata?.saveVersion } : {}),
    ...(gameMetadata?.lastAppliedEventId !== undefined
      ? { lastAppliedEventId: gameMetadata.lastAppliedEventId }
      : {}),
    ...(gameMetadata?.appliedEventIds ? { appliedEventIds: gameMetadata.appliedEventIds } : {}),
    ...(gameMetadata?.seasonReviewState !== undefined ? { seasonReviewState: gameMetadata.seasonReviewState } : {}),
    ...(gameMetadata?.preSeasonWorkflowState !== undefined
      ? { preSeasonWorkflowState: gameMetadata.preSeasonWorkflowState }
      : {}),
    ...(gameMetadata?.playerBaselines ? { playerBaselines: gameMetadata.playerBaselines } : {}),
    ...(gameMetadata?.baselineWriteGuardEvents
      ? { baselineWriteGuardEvents: gameMetadata.baselineWriteGuardEvents }
      : {}),
    ...(gameMetadata?.playerProgressionEvents
      ? { playerProgressionEvents: gameMetadata.playerProgressionEvents }
      : {}),
    season,
    seasonState,
    matchdayState,
    teams: loadCollection<Team>("teams", "team_id", saveId),
    teamIdentities: loadCollection<TeamIdentity>("team_identities", "team_id", saveId),
    players: loadCollection<Player>("players", "player_id", saveId),
    disciplines: loadCollection<Discipline>("disciplines", "discipline_id", saveId),
    rosters: loadCollection<RosterEntry>("rosters", "roster_id", saveId),
    contracts: loadCollection<Contract>("contracts", "contract_id", saveId),
    transferListings: loadCollection<TransferListing>("transfer_listings", "listing_id", saveId),
    transferHistory: loadCollection<TransferHistoryEntry>("transfer_history", "history_id", saveId),
    logs: loadCollection<GameLogEntry>("game_logs", "log_id", saveId),
    mappingReport,
  });
  const gameStateWithoutBaseline = withNormalizedSeasonDisciplineSchedule(
    normalizeLegacyRosterTargets(normalizeLegacyCashCreatorsColdSteelCodes(hydrated)),
  );
  const gameState = ensurePlayerBaselines(gameStateWithoutBaseline, {
    sourcePlayers: loadBaselineSourcePlayers(),
    createdAt: row.created_at,
  }).gameState;
  const gameStateWithScenarioMeta = gameState.scenarioMeta
    ? gameState
    : {
        ...gameState,
        scenarioMeta: buildScenarioMeta({ gameState }),
      };

  return {
    saveId,
    name: row.name,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    gameState: gameStateWithScenarioMeta,
  };
}

function createPersistedSaveRecord(input: {
  saveId: string;
  name: string;
  status: SaveStatus;
  createdAt?: string;
  updatedAt?: string;
  gameState: GameState;
}) {
  const database = getDatabase();
  const now = new Date().toISOString();
  const createdAt = input.createdAt ?? now;
  const updatedAt = input.updatedAt ?? now;
  const normalizedWithoutBaselines = withNormalizedSeasonDisciplineSchedule(
    normalizeLegacyRosterTargets(normalizeLegacyCashCreatorsColdSteelCodes(input.gameState)),
  );
  const normalizedGameState = ensurePlayerBaselines(normalizedWithoutBaselines, {
    sourcePlayers: loadBaselineSourcePlayers(),
    createdAt,
  }).gameState;
  const existingMetadata = loadSingleton<GameMetadata>("game_metadata", input.saveId);
  const guardedBaselineWrite = guardPlayerBaselineWrite({
    previous: existingMetadata?.playerBaselines,
    next: normalizedGameState.playerBaselines,
    attemptedSource: "save_repository",
    timestamp: updatedAt,
  });
  const baselineWriteGuardEvents = [
    ...(existingMetadata?.baselineWriteGuardEvents ?? []),
    ...(normalizedGameState.baselineWriteGuardEvents ?? []),
    ...guardedBaselineWrite.events,
  ];
  const guardedGameState: GameState = {
    ...normalizedGameState,
    playerBaselines: guardedBaselineWrite.baselines,
    baselineWriteGuardEvents,
  };

  const upsertSave = database.prepare(`
    INSERT INTO saves (save_id, name, status, created_at, updated_at)
    VALUES (@saveId, @name, @status, @createdAt, @updatedAt)
    ON CONFLICT(save_id) DO UPDATE SET
      name = excluded.name,
      status = excluded.status,
      updated_at = excluded.updated_at
  `);

  const transaction = database.transaction(() => {
    upsertSave.run({
      saveId: input.saveId,
      name: input.name,
      status: input.status,
      createdAt,
      updatedAt,
    });

    replaceSingleton("seasons", input.saveId, guardedGameState.season);
    replaceSingleton("season_states", input.saveId, guardedGameState.seasonState);
    replaceSingleton("matchday_states", input.saveId, guardedGameState.matchdayState);
    const transition = guardedGameState.seasonTransition;
    replaceSingleton("game_metadata", input.saveId, {
      gamePhase: guardedGameState.gamePhase,
      seasonTransition: transition,
      scenarioMeta: buildScenarioMeta({ gameState: guardedGameState }),
      saveVersion: guardedGameState.saveVersion,
      lastAppliedEventId: guardedGameState.lastAppliedEventId,
      appliedEventIds: guardedGameState.appliedEventIds,
      transitionStatus: transition?.status,
      currentStep: transition?.currentStep,
      completedSteps: transition?.completedSteps,
      seasonReviewState: guardedGameState.seasonReviewState,
      preSeasonWorkflowState: guardedGameState.preSeasonWorkflowState,
      playerBaselines: guardedGameState.playerBaselines,
      baselineWriteGuardEvents: guardedGameState.baselineWriteGuardEvents,
      playerProgressionEvents: guardedGameState.playerProgressionEvents,
    } satisfies GameMetadata);
    replaceSingleton("mapping_reports", input.saveId, guardedGameState.mappingReport);

    replaceCollection("teams", "team_id", input.saveId, guardedGameState.teams, (team) => team.teamId);
    replaceCollection("team_identities", "team_id", input.saveId, guardedGameState.teamIdentities, (identity) => identity.teamId);
    replaceCollection("players", "player_id", input.saveId, guardedGameState.players, (player) => player.id);
    replaceCollection("disciplines", "discipline_id", input.saveId, guardedGameState.disciplines, (discipline) => discipline.id);
    replaceCollection("rosters", "roster_id", input.saveId, guardedGameState.rosters, (roster) => roster.id);
    replaceCollection("contracts", "contract_id", input.saveId, guardedGameState.contracts, (contract) => contract.id);
    replaceCollection("transfer_listings", "listing_id", input.saveId, guardedGameState.transferListings, (listing) => listing.id);
    replaceCollection("transfer_history", "history_id", input.saveId, guardedGameState.transferHistory, (entry) => entry.id);
    replaceCollection("game_logs", "log_id", input.saveId, guardedGameState.logs, (log) => log.id);
  });

  transaction();

  const gameStateWithScenarioMeta = guardedGameState.scenarioMeta
    ? guardedGameState
    : {
        ...guardedGameState,
        scenarioMeta: buildScenarioMeta({ gameState: guardedGameState }),
      };

  return {
    saveId: input.saveId,
    name: input.name,
    status: input.status,
    createdAt,
    updatedAt,
    gameState: gameStateWithScenarioMeta,
  };
}

export function createSaveRepository(): SaveRepository {
  return {
    getActiveSave() {
      const database = getDatabase();
      const row = database
        .prepare("SELECT save_id, name, status, created_at, updated_at FROM saves WHERE status = 'active' ORDER BY updated_at DESC LIMIT 1")
        .get() as SaveRow | undefined;
      return row ? materializePersistedSave(row) : null;
    },
    getSaveById(saveId: string) {
      const row = loadSaveRow(saveId);
      return row ? materializePersistedSave(row) : null;
    },
    listSaves() {
      const database = getDatabase();
      const rows = database
        .prepare("SELECT save_id, name, status, created_at, updated_at FROM saves ORDER BY updated_at DESC")
        .all() as SaveRow[];

      return rows.map<SaveSummary>((row) => ({
          saveId: row.save_id,
          name: row.name,
          status: row.status,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          scenarioMeta: loadScenarioMetaForSummary(row.save_id, row.created_at),
      }));
    },
    setActiveSave(saveId: string) {
      const existing = this.getSaveById(saveId);
      if (!existing) {
        return null;
      }

      const database = getDatabase();
      const transaction = database.transaction(() => {
        database.prepare("UPDATE saves SET status = 'archived' WHERE status = 'active' AND save_id != ?").run(saveId);
        database.prepare("UPDATE saves SET status = 'active', updated_at = ? WHERE save_id = ?").run(new Date().toISOString(), saveId);
      });
      transaction();

      return this.getSaveById(saveId);
    },
    createSaveFromSeed({ saveId, name, status, seedData }) {
      const gameState = createGameStateFromSeed(seedData);
      const persisted = createPersistedSaveRecord({
        saveId,
        name,
        status,
        gameState,
      });

      if (!persisted) {
        throw new Error(`Persisted save ${saveId} could not be created from seed.`);
      }

      return persisted;
    },
    cloneSave({ sourceSaveId, saveId, name, status }) {
      const source = this.getSaveById(sourceSaveId);
      if (!source) {
        throw new Error(`Source save ${sourceSaveId} could not be found.`);
      }

      const persisted = createPersistedSaveRecord({
        saveId,
        name,
        status,
        gameState: source.gameState,
      });

      if (!persisted) {
        throw new Error(`Persisted save ${saveId} could not be cloned.`);
      }

      if (status === "active") {
        return this.setActiveSave(saveId) ?? persisted;
      }

      return persisted;
    },
    createScenarioSnapshot({ sourceSaveId, saveId, name, status, scenarioMeta }) {
      const source = this.getSaveById(sourceSaveId);
      if (!source) {
        throw new Error(`Source save ${sourceSaveId} could not be found.`);
      }

      const persisted = createPersistedSaveRecord({
        saveId,
        name,
        status,
        gameState: withScenarioMeta(source.gameState, scenarioMeta),
      });

      if (!persisted) {
        throw new Error(`Scenario save ${saveId} could not be created.`);
      }

      if (status === "active") {
        return this.setActiveSave(saveId) ?? persisted;
      }

      return persisted;
    },
    saveGameState({ saveId, name, status, gameState }) {
      const existing = loadSaveRow(saveId);
      const persisted = createPersistedSaveRecord({
        saveId,
        name: name ?? existing?.name ?? "Oly Save",
        status: status ?? existing?.status ?? "active",
        createdAt: existing?.created_at,
        gameState,
      });

      if (!persisted) {
        throw new Error(`Persisted save ${saveId} could not be updated.`);
      }

      return persisted;
    },
  };
}
