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
import { withNormalizedTeamIdentityOverrides } from "@/lib/foundation/team-identity-settings";
import { withNormalizedTeamGeneralManagers } from "@/lib/foundation/team-general-managers";
import { buildScenarioMeta, withScenarioMeta } from "@/lib/persistence/scenario-meta";
import { resolveFoundationSaveMode } from "@/lib/persistence/foundation-save-mode";
import { enforceRollingSaveRetention } from "@/lib/persistence/save-retention";
import { ensurePlayerBaselines, guardPlayerBaselineWrite } from "@/lib/players/player-baseline-service";
import { withNormalizedSeasonDisciplineSchedule } from "@/lib/season/season-discipline-schedule";
import type { PersistedSaveGame, SaveRepository, SaveStatus, SaveSummary } from "@/lib/persistence/types";

export { enforceRollingSaveRetention } from "@/lib/persistence/save-retention";

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
  baselineWriteGuardEvents?: PlayerBaselineWriteGuardEvent[];
  playerProgressionEvents?: GameState["playerProgressionEvents"];
  playerMoraleState?: GameState["playerMoraleState"];
  playerRelationshipEvents?: GameState["playerRelationshipEvents"];
};

type PlayerSavePayload =
  | {
      storage: "delta";
      patch: Partial<Player>;
    }
  | {
      storage: "full";
      player: Player;
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
    const rosterMinTarget = playerMin;
    const rosterOptTarget = playerOpt;
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

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

function toFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeLegacyMoneyValue(input: {
  value: number | null | undefined;
  threshold: number;
  budget?: number | null | undefined;
}) {
  const numericValue = toFiniteNumber(input.value);
  if (numericValue == null) {
    return input.value ?? null;
  }

  const absoluteValue = Math.abs(numericValue);
  const budget = Math.abs(toFiniteNumber(input.budget) ?? 0);
  const lowScaleBudget = budget > 0 && budget <= 1000;
  const suspiciousByThreshold = absoluteValue > input.threshold;
  const suspiciousByBudget = lowScaleBudget && absoluteValue > budget * 8;

  if ((suspiciousByThreshold && (lowScaleBudget || input.budget == null)) || suspiciousByBudget) {
    return roundMoney(numericValue / 100);
  }

  return roundMoney(numericValue);
}

export function normalizeLegacyFinanceScale(gameState: GameState): GameState {
  const budgetByTeamId = new Map(gameState.teams.map((team) => [team.teamId, team.budget] as const));
  let changed = false;

  const teams = gameState.teams.map((team) => {
    const normalizedCash = normalizeLegacyMoneyValue({
      value: team.cash,
      threshold: 5000,
      budget: team.budget,
    });
    if (normalizedCash === team.cash) {
      return team;
    }
    changed = true;
    return {
      ...team,
      cash: normalizedCash ?? team.cash,
    };
  });

  const standingsEntries = Object.entries(gameState.seasonState.standings ?? {});
  const normalizedStandings = Object.fromEntries(
    standingsEntries.map(([teamId, standing]) => {
      const budget = budgetByTeamId.get(teamId);
      const nextStanding = {
        ...standing,
        cashFc: normalizeLegacyMoneyValue({ value: standing.cashFc, threshold: 5000, budget }),
        cashTotal: normalizeLegacyMoneyValue({ value: standing.cashTotal, threshold: 5000, budget }),
      };
      if (
        nextStanding.cashFc !== standing.cashFc ||
        nextStanding.cashTotal !== standing.cashTotal
      ) {
        changed = true;
      }
      return [teamId, nextStanding];
    }),
  );

  const transferHistory = (gameState.transferHistory ?? []).map((entry) => {
    const relatedBudget = budgetByTeamId.get(entry.fromTeamId ?? entry.toTeamId ?? "");
    const normalizedFee = normalizeLegacyMoneyValue({
      value: entry.fee,
      threshold: 5000,
      budget: relatedBudget,
    });
    const normalizedMarketValue = normalizeLegacyMoneyValue({
      value: entry.marketValue,
      threshold: 5000,
      budget: relatedBudget,
    });
    const normalizedSalary = normalizeLegacyMoneyValue({
      value: entry.salary,
      threshold: 1000,
      budget: relatedBudget,
    });
    if (
      normalizedFee === entry.fee &&
      normalizedMarketValue === entry.marketValue &&
      normalizedSalary === entry.salary
    ) {
      return entry;
    }
    changed = true;
    return {
      ...entry,
      fee: normalizedFee ?? entry.fee,
      marketValue: normalizedMarketValue ?? entry.marketValue,
      salary: normalizedSalary ?? entry.salary,
    };
  });

  const contractEvents = (gameState.seasonState.contractEvents ?? []).map((event) => {
    const budget = budgetByTeamId.get(event.teamId);
    const normalizedExitValue = normalizeLegacyMoneyValue({
      value: event.exitValue,
      threshold: 5000,
      budget,
    });
    const normalizedMarketValueAtExit = normalizeLegacyMoneyValue({
      value: event.marketValueAtExit,
      threshold: 5000,
      budget,
    });
    const normalizedPurchasePrice = normalizeLegacyMoneyValue({
      value: event.purchasePrice,
      threshold: 5000,
      budget,
    });
    const normalizedProfitLoss = normalizeLegacyMoneyValue({
      value: event.profitLoss,
      threshold: 5000,
      budget,
    });
    const normalizedOldSalary = normalizeLegacyMoneyValue({
      value: event.oldSalary,
      threshold: 1000,
      budget,
    });
    const normalizedNewSalary = normalizeLegacyMoneyValue({
      value: event.newSalary,
      threshold: 1000,
      budget,
    });
    if (
      normalizedExitValue === event.exitValue &&
      normalizedMarketValueAtExit === event.marketValueAtExit &&
      normalizedPurchasePrice === event.purchasePrice &&
      normalizedProfitLoss === event.profitLoss &&
      normalizedOldSalary === event.oldSalary &&
      normalizedNewSalary === event.newSalary
    ) {
      return event;
    }
    changed = true;
    return {
      ...event,
      exitValue: normalizedExitValue,
      marketValueAtExit: normalizedMarketValueAtExit,
      purchasePrice: normalizedPurchasePrice,
      profitLoss: normalizedProfitLoss,
      oldSalary: normalizedOldSalary,
      newSalary: normalizedNewSalary,
    };
  });

  if (!changed) {
    return gameState;
  }

  return {
    ...gameState,
    teams,
    transferHistory,
    seasonState: {
      ...gameState.seasonState,
      standings: normalizedStandings,
      contractEvents,
    },
  };
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

let baselineSourcePlayersCache: Player[] | null = null;

function loadBaselineSourcePlayers() {
  baselineSourcePlayersCache ??= createGameStateFromSeed(loadSeedData()).players;
  return baselineSourcePlayersCache;
}

function valuesEqual(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function compactBaselineWriteGuardEvents(
  events: PlayerBaselineWriteGuardEvent[],
  limit = 1000,
) {
  const byEventId = new Map<string, PlayerBaselineWriteGuardEvent>();
  for (const event of events) {
    byEventId.set(event.eventId, event);
  }
  return Array.from(byEventId.values())
    .sort((left, right) => right.timestamp.localeCompare(left.timestamp, "de"))
    .slice(0, limit)
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp, "de"));
}

function buildPlayerDelta(basePlayer: Player, player: Player) {
  const patch: Partial<Player> = {};
  for (const [key, value] of Object.entries(player) as Array<[keyof Player, Player[keyof Player]]>) {
    if (key === "id") {
      continue;
    }
    if (!valuesEqual(basePlayer[key], value)) {
      patch[key] = value as never;
    }
  }
  return patch;
}

function isPlayerSavePayload(value: unknown): value is PlayerSavePayload {
  return Boolean(
    value &&
      typeof value === "object" &&
      ((value as { storage?: unknown }).storage === "delta" || (value as { storage?: unknown }).storage === "full"),
  );
}

function loadPlayerCatalog(database = getDatabase()) {
  const rows = database
    .prepare("SELECT player_id, payload_json FROM player_catalog ORDER BY player_id ASC")
    .all() as Array<{ player_id: string; payload_json: string }>;
  return new Map(rows.map((row) => [row.player_id, parseJsonColumn<Player>(row.payload_json)]));
}

function ensurePlayerCatalog(database: ReturnType<typeof getDatabase>, players: Player[], updatedAt: string) {
  const existingCount = (database.prepare("SELECT COUNT(*) AS count FROM player_catalog").get() as { count: number })
    .count;
  if (existingCount >= players.length) {
    return;
  }

  const insertStatement = database.prepare(
    `INSERT OR IGNORE INTO player_catalog (player_id, payload_json, updated_at) VALUES (?, ?, ?)`,
  );
  for (const player of players) {
    insertStatement.run(player.id, JSON.stringify(player), updatedAt);
  }
}

function loadPlayersForSave(saveId: string) {
  const database = getDatabase();
  const catalog = loadPlayerCatalog(database);
  const playersById = new Map(catalog);
  const rows = database
    .prepare("SELECT player_id, payload_json FROM players WHERE save_id = ? ORDER BY player_id ASC")
    .all(saveId) as Array<{ player_id: string; payload_json: string }>;

  for (const row of rows) {
    const payload = parseJsonColumn<unknown>(row.payload_json);
    if (isPlayerSavePayload(payload)) {
      if (payload.storage === "full") {
        playersById.set(row.player_id, payload.player);
        continue;
      }

      const basePlayer = catalog.get(row.player_id);
      if (basePlayer) {
        playersById.set(row.player_id, { ...basePlayer, ...payload.patch });
      }
      continue;
    }

    playersById.set(row.player_id, payload as Player);
  }

  return [...playersById.values()].sort((left, right) => left.id.localeCompare(right.id));
}

function replacePlayersForSave(saveId: string, players: Player[], catalogSourcePlayers: Player[], updatedAt: string) {
  const database = getDatabase();
  ensurePlayerCatalog(database, catalogSourcePlayers, updatedAt);
  const catalog = loadPlayerCatalog(database);
  const deleteStatement = database.prepare("DELETE FROM players WHERE save_id = ?");
  const insertStatement = database.prepare(
    "INSERT INTO players (save_id, player_id, payload_json) VALUES (?, ?, ?)",
  );

  deleteStatement.run(saveId);
  for (const player of players) {
    const basePlayer = catalog.get(player.id);
    const payload: PlayerSavePayload | null = basePlayer
      ? (() => {
          const patch = buildPlayerDelta(basePlayer, player);
          return Object.keys(patch).length ? { storage: "delta", patch } : null;
        })()
      : { storage: "full", player };

    if (payload) {
      insertStatement.run(saveId, player.id, JSON.stringify(payload));
    }
  }
}

function loadPlayerBaselinesForSave(saveId: string, fallbackBaselines?: PlayerBaselineRecord[]) {
  const database = getDatabase();
  const baselineCatalogRows = database
    .prepare("SELECT player_id, payload_json FROM player_baseline_catalog ORDER BY player_id ASC")
    .all() as Array<{ player_id: string; payload_json: string }>;
  const baselinesByPlayerId = new Map(
    baselineCatalogRows.map((row) => [row.player_id, parseJsonColumn<PlayerBaselineRecord>(row.payload_json)]),
  );
  const rows = database
    .prepare("SELECT payload_json FROM player_baselines WHERE save_id = ? ORDER BY player_id ASC")
    .all(saveId) as Array<{ payload_json: string }>;
  for (const row of rows) {
    const baseline = parseJsonColumn<PlayerBaselineRecord>(row.payload_json);
    baselinesByPlayerId.set(baseline.playerId, baseline);
  }

  if (baselinesByPlayerId.size) {
    return [...baselinesByPlayerId.values()].sort((left, right) => left.playerId.localeCompare(right.playerId));
  }
  return fallbackBaselines;
}

function ensurePlayerBaselineCatalog(
  database: ReturnType<typeof getDatabase>,
  baselines: PlayerBaselineRecord[] | undefined,
  updatedAt: string,
) {
  const baselineList = baselines ?? [];
  if (!baselineList.length) {
    return;
  }

  const existingCount = (database.prepare("SELECT COUNT(*) AS count FROM player_baseline_catalog").get() as {
    count: number;
  }).count;
  if (existingCount >= baselineList.length) {
    return;
  }

  const insertStatement = database.prepare(
    `INSERT OR IGNORE INTO player_baseline_catalog (player_id, payload_json, updated_at) VALUES (?, ?, ?)`,
  );
  for (const baseline of baselineList) {
    insertStatement.run(baseline.playerId, JSON.stringify(baseline), updatedAt);
  }
}

function replacePlayerBaselinesForSave(
  saveId: string,
  baselines: PlayerBaselineRecord[] | undefined,
  updatedAt: string,
) {
  const database = getDatabase();
  ensurePlayerBaselineCatalog(database, baselines, updatedAt);
  const baselineCatalogRows = database
    .prepare("SELECT player_id, payload_json FROM player_baseline_catalog")
    .all() as Array<{ player_id: string; payload_json: string }>;
  const baselineCatalog = new Map(
    baselineCatalogRows.map((row) => [row.player_id, parseJsonColumn<PlayerBaselineRecord>(row.payload_json)]),
  );
  const deleteStatement = database.prepare("DELETE FROM player_baselines WHERE save_id = ?");
  const insertStatement = database.prepare(
    "INSERT INTO player_baselines (save_id, player_id, payload_json) VALUES (?, ?, ?)",
  );

  deleteStatement.run(saveId);
  for (const baseline of baselines ?? []) {
    const catalogBaseline = baselineCatalog.get(baseline.playerId);
    if (catalogBaseline && valuesEqual(catalogBaseline, baseline)) {
      continue;
    }
    insertStatement.run(saveId, baseline.playerId, JSON.stringify(baseline));
  }
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

  const playerBaselines = loadPlayerBaselinesForSave(
    saveId,
    (gameMetadata as GameMetadata & { playerBaselines?: PlayerBaselineRecord[] } | null)?.playerBaselines,
  );
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
    ...(playerBaselines ? { playerBaselines } : {}),
    ...(gameMetadata?.baselineWriteGuardEvents
      ? { baselineWriteGuardEvents: gameMetadata.baselineWriteGuardEvents }
      : {}),
    ...(gameMetadata?.playerProgressionEvents
      ? { playerProgressionEvents: gameMetadata.playerProgressionEvents }
      : {}),
    ...(gameMetadata?.playerMoraleState
      ? { playerMoraleState: gameMetadata.playerMoraleState }
      : {}),
    ...(gameMetadata?.playerRelationshipEvents
      ? { playerRelationshipEvents: gameMetadata.playerRelationshipEvents }
      : {}),
    season,
    seasonState,
    matchdayState,
    teams: loadCollection<Team>("teams", "team_id", saveId),
    teamIdentities: loadCollection<TeamIdentity>("team_identities", "team_id", saveId),
    players: loadPlayersForSave(saveId),
    disciplines: loadCollection<Discipline>("disciplines", "discipline_id", saveId),
    rosters: loadCollection<RosterEntry>("rosters", "roster_id", saveId),
    contracts: loadCollection<Contract>("contracts", "contract_id", saveId),
    transferListings: loadCollection<TransferListing>("transfer_listings", "listing_id", saveId),
    transferHistory: loadCollection<TransferHistoryEntry>("transfer_history", "history_id", saveId),
    logs: loadCollection<GameLogEntry>("game_logs", "log_id", saveId),
    mappingReport,
  });
  const gameStateWithoutBaseline = withNormalizedSeasonDisciplineSchedule(
    normalizeLegacyRosterTargets(
      normalizeLegacyFinanceScale(
        withNormalizedTeamGeneralManagers(withNormalizedTeamIdentityOverrides(normalizeLegacyCashCreatorsColdSteelCodes(hydrated))),
      ),
    ),
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
    normalizeLegacyRosterTargets(
      normalizeLegacyFinanceScale(
        withNormalizedTeamGeneralManagers(withNormalizedTeamIdentityOverrides(normalizeLegacyCashCreatorsColdSteelCodes(input.gameState))),
      ),
    ),
  );
  const normalizedGameState = ensurePlayerBaselines(normalizedWithoutBaselines, {
    sourcePlayers: loadBaselineSourcePlayers(),
    createdAt,
  }).gameState;
  const existingMetadata = loadSingleton<GameMetadata>("game_metadata", input.saveId);
  const existingBaselines = loadPlayerBaselinesForSave(
    input.saveId,
    (existingMetadata as GameMetadata & { playerBaselines?: PlayerBaselineRecord[] } | null)?.playerBaselines,
  );
  const guardedBaselineWrite = guardPlayerBaselineWrite({
    previous: existingBaselines,
    next: normalizedGameState.playerBaselines,
    attemptedSource: "save_repository",
    timestamp: updatedAt,
  });
  const baselineWriteGuardEvents = compactBaselineWriteGuardEvents([
    ...(existingMetadata?.baselineWriteGuardEvents ?? []),
    ...(normalizedGameState.baselineWriteGuardEvents ?? []),
    ...guardedBaselineWrite.events,
  ]);
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
      baselineWriteGuardEvents: guardedGameState.baselineWriteGuardEvents,
      playerProgressionEvents: guardedGameState.playerProgressionEvents,
      playerMoraleState: guardedGameState.playerMoraleState,
      playerRelationshipEvents: guardedGameState.playerRelationshipEvents,
    } satisfies GameMetadata);
    replaceSingleton("mapping_reports", input.saveId, guardedGameState.mappingReport);
    replacePlayerBaselinesForSave(input.saveId, guardedGameState.playerBaselines, updatedAt);

    replaceCollection("teams", "team_id", input.saveId, guardedGameState.teams, (team) => team.teamId);
    replaceCollection("team_identities", "team_id", input.saveId, guardedGameState.teamIdentities, (identity) => identity.teamId);
    replacePlayersForSave(input.saveId, guardedGameState.players, loadBaselineSourcePlayers(), updatedAt);
    replaceCollection("disciplines", "discipline_id", input.saveId, guardedGameState.disciplines, (discipline) => discipline.id);
    replaceCollection("rosters", "roster_id", input.saveId, guardedGameState.rosters, (roster) => roster.id);
    replaceCollection("contracts", "contract_id", input.saveId, guardedGameState.contracts, (contract) => contract.id);
    replaceCollection("transfer_listings", "listing_id", input.saveId, guardedGameState.transferListings, (listing) => listing.id);
    replaceCollection("transfer_history", "history_id", input.saveId, guardedGameState.transferHistory, (entry) => entry.id);
    replaceCollection("game_logs", "log_id", input.saveId, guardedGameState.logs, (log) => log.id);
    enforceRollingSaveRetention(database, [input.saveId]);
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
      })).map((summary) => ({
        ...summary,
        saveMode: resolveFoundationSaveMode(summary),
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
        enforceRollingSaveRetention(database, [saveId]);
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
