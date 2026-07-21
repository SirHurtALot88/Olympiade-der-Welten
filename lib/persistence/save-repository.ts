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
  SponsorOffer,
  Team,
  TeamIdentity,
  TransferHistoryEntry,
  TransferListing,
} from "@/lib/data/olyDataTypes";
import { mapArchetypeToCurveShape, mapStarTierToRarity } from "@/lib/sponsor/sponsor-curve-shapes";
import { createGameStateFromSeed, loadSeedData } from "@/lib/data/dataAdapter";
import { hydrateGameStateMedia } from "@/lib/data/mediaAssets";
import { getDatabase } from "@/lib/persistence/sqlite";
import { deriveRosterTargets, getTeamPlayerMax } from "@/lib/foundation/roster-limits";
import { withNormalizedTeamIdentityOverrides } from "@/lib/foundation/team-identity-settings";
import { withNormalizedTeamGeneralManagers } from "@/lib/foundation/team-general-managers";
import { buildScenarioMeta, withScenarioMeta } from "@/lib/persistence/scenario-meta";
import { resolveFoundationSaveMode } from "@/lib/persistence/foundation-save-mode";
import { buildSaveContentSignature } from "@/lib/persistence/save-content-signature";
import { invalidateSeasonDerivationsCache } from "@/lib/foundation/season-derivations-cache";
import {
  deleteSeasonDerivationsSidecar,
  writeSeasonDerivationsSidecar,
} from "@/lib/persistence/season-derivations-sidecar";
import type { PersistedSeasonDerivationsRecord } from "@/lib/foundation/materialize-season-derivations";
import { invalidateStandingsOverviewCache } from "@/lib/season/standings-overview-cache";
import { invalidateLegacyLineupLabContextCache } from "@/lib/lineups/legacy-lineup-lab-context-cache";
import { invalidateStandingsPreviewCache } from "@/lib/standings/standings-preview-cache";
import { invalidateArenaPreviewCache } from "@/lib/foundation/arena-preview-cache";
import {
  buildSaveSessionCacheSignature,
  invalidateSaveSessionCache,
  readSaveSessionCache,
  writeSaveSessionCache,
} from "@/lib/persistence/save-session-cache";
import { ensurePlayerBaselines, guardPlayerBaselineWrite } from "@/lib/players/player-baseline-service";
import { ensurePlayerInjuryHistoryForGameState } from "@/lib/foundation/player-injury-history";
import {
  buildPlayerPotentialRecordsForSave,
  isPlayerPotentialModelCurrent,
  migratePlayerPotentialRecordsToCurrentModel,
} from "@/lib/progression/player-potential-service";
import { reconcilePlayerPotentialRecordsForGameState } from "@/lib/scouting/player-potential-ceiling-service";
import { withNormalizedSeasonDisciplineSchedule } from "@/lib/season/season-discipline-schedule";
import type {
  PersistedSaveGame,
  SaveRepository,
  SaveStatus,
  SaveSummary,
  SaveVersionMetadata,
} from "@/lib/persistence/types";

import { enforceRollingSaveRetention } from "@/lib/persistence/save-retention";

export { enforceRollingSaveRetention };

/**
 * Every sqlite table that is keyed by `save_id` and must be purged when a save is deleted.
 * `player_catalog` / `player_baseline_catalog` are intentionally excluded — they are global
 * catalogs shared across saves, not per-save data (see sqlite.ts schema).
 *
 * All of these tables already declare `FOREIGN KEY (save_id) REFERENCES saves(save_id) ON
 * DELETE CASCADE` and the database runs with `PRAGMA foreign_keys = ON`, so deleting from
 * `saves` alone would cascade correctly. We still delete explicitly (belt-and-suspenders) in
 * case the pragma is ever off for a given connection — this list is the single source of truth
 * shared by `deleteSaves` below and `scripts/cleanup-test-saves.ts`, so keep it in sync with the
 * schema in `lib/persistence/sqlite.ts`.
 */
export const SAVE_CHILD_TABLES = [
  "seasons",
  "season_states",
  "matchday_states",
  "game_metadata",
  "teams",
  "team_identities",
  "players",
  "player_baselines",
  "disciplines",
  "rosters",
  "contracts",
  "transfer_listings",
  "transfer_history",
  "game_logs",
  "mapping_reports",
] as const;

type SaveRow = {
  save_id: string;
  name: string;
  status: SaveStatus;
  created_at: string;
  updated_at: string;
  content_signature?: string;
  save_version?: number;
  season_id?: string;
  matchday_id?: string;
  lineup_draft_count?: number;
  transfer_history_count?: number;
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
  playerPotential?: GameState["playerPotential"];
  playerMoraleState?: GameState["playerMoraleState"];
  playerRelationshipEvents?: GameState["playerRelationshipEvents"];
  // #1: Der zugewiesene Saison-Kapitän (manuell/AI) muss dauerhaft überleben, sonst geht er
  // beim Kaltladen aus der DB verloren (bisher nur im flüchtigen Session-Cache gehalten).
  teamCaptains?: GameState["teamCaptains"];
  // #8: Nutzer-Entscheidungen (erledigt/verworfen) auf Inbox-Items müssen den Reload überleben.
  gameInboxItems?: GameState["gameInboxItems"];
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
  const teamByTeamId = new Map(gameState.teams.map((team) => [team.teamId, team]));

  // Kader-Minimum ist fix 8 für alle Teams: Identity-playerMin auf den abgeleiteten
  // (geklammerten) Fixwert ziehen, damit jeder Consumer der identity.playerMin liest 8 sieht.
  let identitiesChanged = false;
  const teamIdentities = gameState.teamIdentities.map((identity) => {
    const team = teamByTeamId.get(identity.teamId);
    const targets = deriveRosterTargets(team, identity);
    if (identity.playerMin === targets.playerMin) {
      return identity;
    }
    identitiesChanged = true;
    return { ...identity, playerMin: targets.playerMin };
  });

  const identityByTeamId = new Map(teamIdentities.map((identity) => [identity.teamId, identity]));
  let teamsChanged = false;
  const teams = gameState.teams.map((team) => {
    const identity = identityByTeamId.get(team.teamId);
    const targets = deriveRosterTargets(team, identity);
    const playerOpt = Number.isFinite(identity?.playerOpt) ? Math.round(identity!.playerOpt) : null;
    const rosterLimit = targets.playerMax;
    const rosterMinTarget = targets.playerMin;
    const rosterOptTarget = playerOpt;
    if (
      rosterLimit === team.rosterLimit &&
      team.rosterMinTarget === rosterMinTarget &&
      team.rosterOptTarget === rosterOptTarget
    ) {
      return team;
    }
    teamsChanged = true;
    return {
      ...team,
      rosterLimit,
      rosterMinTarget,
      rosterOptTarget,
    };
  });

  if (!identitiesChanged && !teamsChanged) {
    return gameState;
  }
  return {
    ...gameState,
    ...(teamsChanged ? { teams } : {}),
    ...(identitiesChanged ? { teamIdentities } : {}),
  };
}

/**
 * Legacy-save field: pre-rarity save blobs still carry a raw numeric `starTier` (1..5) on their sponsor
 * offers/contracts. The current `SponsorOffer`/`TeamSponsorContract` types no longer declare that field (the
 * star-tier system itself is gone), so this reads it defensively off the raw persisted record without
 * requiring it on the type.
 */
function readLegacyStarTier(record: unknown): number | undefined {
  const raw = (record as { starTier?: unknown } | null | undefined)?.starTier;
  return typeof raw === "number" ? raw : undefined;
}

/**
 * Back-compat: old saves carry sponsor offers/contracts with a legacy `starTier`/`archetype` but no
 * `rarity`/`curveShape`. Backfill the new fields deterministically (star→rarity, archetype→curve shape) on
 * load so every consumer sees them. Signed contracts keep their frozen `lockedRankPayoutLadder`, so payouts
 * are unaffected; this only labels them for the new UI/roller. Idempotent (skips already-migrated entries).
 */
function normalizeLegacySponsors(gameState: GameState): GameState {
  const seasonState = gameState.seasonState;
  if (!seasonState) return gameState;
  let changed = false;
  const migrateOffer = (offer: SponsorOffer): SponsorOffer => {
    if (offer.rarity != null && offer.curveShape != null) return offer;
    changed = true;
    return {
      ...offer,
      rarity: offer.rarity ?? mapStarTierToRarity(readLegacyStarTier(offer)),
      curveShape: offer.curveShape ?? mapArchetypeToCurveShape(offer.archetype),
    };
  };
  const nextOffers = seasonState.sponsorOffersByTeamId
    ? Object.fromEntries(
        Object.entries(seasonState.sponsorOffersByTeamId).map(([teamId, list]) => [teamId, list.map(migrateOffer)]),
      )
    : seasonState.sponsorOffersByTeamId;
  const nextContracts = seasonState.sponsorContractsByTeamId
    ? Object.fromEntries(
        Object.entries(seasonState.sponsorContractsByTeamId).map(([teamId, contract]) => {
          if (contract.rarity != null && contract.curveShape != null) return [teamId, contract];
          changed = true;
          return [
            teamId,
            {
              ...contract,
              rarity: contract.rarity ?? mapStarTierToRarity(readLegacyStarTier(contract)),
              curveShape: contract.curveShape ?? mapArchetypeToCurveShape(contract.archetype),
            },
          ];
        }),
      )
    : seasonState.sponsorContractsByTeamId;
  if (!changed) return gameState;
  return {
    ...gameState,
    seasonState: { ...seasonState, sponsorOffersByTeamId: nextOffers, sponsorContractsByTeamId: nextContracts },
  };
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

/**
 * Perf: this used to unconditionally DELETE every row for the save and re-INSERT the entire
 * collection on every single incremental save. For collections like rosters/teams that barely
 * change between two consecutive saves (typically 1-2 entries touched by a single transfer), that
 * turned a cheap operation into O(collection size) disk writes every time, compounding badly over
 * a long multi-season run. Diff against what's already persisted and only touch changed/removed rows.
 */
function replaceCollection<T>(
  tableName: string,
  keyColumn: string,
  saveId: string,
  items: T[],
  keySelector: (item: T) => string,
) {
  const database = getDatabase();
  const existingRows = database
    .prepare(`SELECT ${keyColumn} AS key_value, payload_json FROM ${tableName} WHERE save_id = ?`)
    .all(saveId) as Array<{ key_value: string; payload_json: string }>;
  const existingPayloadByKey = new Map(existingRows.map((row) => [row.key_value, row.payload_json]));

  const upsertStatement = database.prepare(
    `INSERT INTO ${tableName} (save_id, ${keyColumn}, payload_json) VALUES (?, ?, ?)
     ON CONFLICT(save_id, ${keyColumn}) DO UPDATE SET payload_json = excluded.payload_json`,
  );
  const deleteStatement = database.prepare(`DELETE FROM ${tableName} WHERE save_id = ? AND ${keyColumn} = ?`);

  const seenKeys = new Set<string>();
  for (const item of items) {
    const key = keySelector(item);
    seenKeys.add(key);
    const serialized = JSON.stringify(item);
    if (existingPayloadByKey.get(key) !== serialized) {
      upsertStatement.run(saveId, key, serialized);
    }
  }

  for (const existingKey of existingPayloadByKey.keys()) {
    if (!seenKeys.has(existingKey)) {
      deleteStatement.run(saveId, existingKey);
    }
  }
}

/**
 * Perf: for strictly append-only history collections (transfer_history, game_logs), entries are
 * never mutated or removed once written — every write path only prepends new entries. Doing a full
 * DELETE + re-INSERT of the whole table (like replaceCollection) on every single incremental save
 * turns per-save cost into O(total history so far), which compounds into multi-second saves once a
 * run has accumulated hundreds/thousands of entries. Instead, only insert keys not already persisted.
 * Falls back to a full replace if the incoming list is shorter than what's stored (explicit reset).
 */
function appendOnlyCollection<T>(
  tableName: string,
  keyColumn: string,
  saveId: string,
  items: T[],
  keySelector: (item: T) => string,
) {
  const database = getDatabase();
  const existingKeys = new Set(
    (
      database.prepare(`SELECT ${keyColumn} AS key_value FROM ${tableName} WHERE save_id = ?`).all(saveId) as Array<{
        key_value: string;
      }>
    ).map((row) => row.key_value),
  );

  if (items.length < existingKeys.size) {
    replaceCollection(tableName, keyColumn, saveId, items, keySelector);
    return;
  }

  const insertStatement = database.prepare(
    `INSERT OR IGNORE INTO ${tableName} (save_id, ${keyColumn}, payload_json) VALUES (?, ?, ?)`,
  );
  for (const item of items) {
    const key = keySelector(item);
    if (existingKeys.has(key)) {
      continue;
    }
    insertStatement.run(saveId, key, JSON.stringify(item));
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
    .prepare(
      "SELECT save_id, name, status, created_at, updated_at, content_signature, save_version, season_id, matchday_id, lineup_draft_count, transfer_history_count FROM saves WHERE save_id = ?",
    )
    .get(saveId) as SaveRow | undefined;
}

function buildVersionMetadataFromGameState(input: {
  saveId: string;
  updatedAt: string;
  gameState: GameState;
  transferHistoryCount: number;
}) {
  const seasonState = input.gameState.seasonState;
  const saveVersion = input.gameState.saveVersion ?? 0;
  const lineupDraftCount = seasonState.lineupDrafts?.length ?? 0;
  const contentSignature = buildSaveContentSignature({
    seasonId: input.gameState.season.id,
    matchdayId: input.gameState.matchdayState.matchdayId,
    saveVersion,
    lineupDraftCount,
    transferHistoryCount: input.transferHistoryCount,
    matchdayResults: seasonState.matchdayResults ?? [],
    standingsApplyLogs: seasonState.standingsApplyLogs ?? [],
    seasonSnapshots: seasonState.seasonSnapshots ?? [],
    disciplineResults: seasonState.disciplineResults ?? [],
  });

  return {
    saveId: input.saveId,
    updatedAt: input.updatedAt,
    seasonId: input.gameState.season.id,
    matchdayId: input.gameState.matchdayState.matchdayId,
    contentSignature,
    saveVersion,
    lineupDraftCount,
    transferHistoryCount: input.transferHistoryCount,
    matchdayResults: seasonState.matchdayResults ?? [],
    standingsApplyLogs: seasonState.standingsApplyLogs ?? [],
    seasonSnapshots: seasonState.seasonSnapshots ?? [],
    disciplineResults: seasonState.disciplineResults ?? [],
  } satisfies SaveVersionMetadata;
}

function loadSaveVersionMetadata(saveId: string): SaveVersionMetadata | null {
  const row = loadSaveRow(saveId);
  if (!row) {
    return null;
  }

  if (row.content_signature) {
    return {
      saveId: row.save_id,
      updatedAt: row.updated_at,
      seasonId: row.season_id ?? "",
      matchdayId: row.matchday_id ?? "",
      contentSignature: row.content_signature,
      saveVersion: row.save_version ?? 0,
      lineupDraftCount: row.lineup_draft_count ?? 0,
      transferHistoryCount: row.transfer_history_count ?? 0,
      matchdayResults: [],
      standingsApplyLogs: [],
      seasonSnapshots: [],
      disciplineResults: [],
    };
  }

  const season = loadSingleton<Season>("seasons", saveId);
  const seasonState = loadSingleton<SeasonState>("season_states", saveId);
  const matchdayState = loadSingleton<MatchdayState>("matchday_states", saveId);
  const gameMetadata = loadSingleton<GameMetadata>("game_metadata", saveId);
  if (!season || !seasonState || !matchdayState) {
    return null;
  }

  const database = getDatabase();
  const transferHistoryRow = database
    .prepare("SELECT COUNT(*) AS count FROM transfer_history WHERE save_id = ?")
    .get(saveId) as { count: number };

  const metadata = buildVersionMetadataFromGameState({
    saveId: row.save_id,
    updatedAt: row.updated_at,
    gameState: {
      season,
      seasonState,
      matchdayState,
      saveVersion: Number.isFinite(gameMetadata?.saveVersion) ? gameMetadata!.saveVersion : 0,
    } as GameState,
    transferHistoryCount: transferHistoryRow.count,
  });

  database
    .prepare(
      `UPDATE saves
       SET content_signature = @contentSignature,
           save_version = @saveVersion,
           season_id = @seasonId,
           matchday_id = @matchdayId,
           lineup_draft_count = @lineupDraftCount,
           transfer_history_count = @transferHistoryCount
       WHERE save_id = @saveId`,
    )
    .run({
      saveId: metadata.saveId,
      contentSignature: metadata.contentSignature,
      saveVersion: metadata.saveVersion ?? 0,
      seasonId: metadata.seasonId,
      matchdayId: metadata.matchdayId,
      lineupDraftCount: metadata.lineupDraftCount,
      transferHistoryCount: metadata.transferHistoryCount,
    });

  return metadata;
}

let baselineSourcePlayersCache: Player[] | null = null;

export function invalidateBaselineSourcePlayersCache() {
  baselineSourcePlayersCache = null;
}

function loadBaselineSourcePlayers(database = getDatabase()) {
  baselineSourcePlayersCache ??= [...loadPlayerCatalog(database).values()];
  return baselineSourcePlayersCache;
}

function invalidateCatalogDerivedRuntimeCaches() {
  invalidateBaselineSourcePlayersCache();
  invalidateSaveSessionCache();
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

export function upsertPlayerCatalogEntries(players: Player[], updatedAt = new Date().toISOString()) {
  const database = getDatabase();
  const statement = database.prepare(
    `INSERT INTO player_catalog (player_id, payload_json, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(player_id) DO UPDATE SET
       payload_json = excluded.payload_json,
       updated_at = excluded.updated_at`,
  );

  for (const player of players) {
    statement.run(player.id, JSON.stringify(player), updatedAt);
  }

  invalidateCatalogDerivedRuntimeCaches();
}

export function patchPlayerCatalogFlavorEntries(
  flavorPatches: Map<string, { flavorDe: string; flavorEn: string }>,
  updatedAt = new Date().toISOString(),
) {
  if (flavorPatches.size === 0) return;

  const database = getDatabase();
  const selectStatement = database.prepare(
    "SELECT payload_json FROM player_catalog WHERE player_id = ?",
  );
  const updateStatement = database.prepare(
    `UPDATE player_catalog SET payload_json = ?, updated_at = ? WHERE player_id = ?`,
  );

  for (const [playerId, patch] of flavorPatches) {
    const row = selectStatement.get(playerId) as { payload_json: string } | undefined;
    if (!row) continue;

    const payload = parseJsonColumn<Player>(row.payload_json);
    if (!payload || typeof payload !== "object") continue;

    updateStatement.run(
      JSON.stringify({
        ...payload,
        flavorDe: patch.flavorDe,
        flavorEn: patch.flavorEn,
      }),
      updatedAt,
      playerId,
    );
  }

  invalidateCatalogDerivedRuntimeCaches();
}

export function upsertPlayerBaselineCatalogEntries(
  baselines: PlayerBaselineRecord[],
  updatedAt = new Date().toISOString(),
) {
  const database = getDatabase();
  const statement = database.prepare(
    `INSERT INTO player_baseline_catalog (player_id, payload_json, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(player_id) DO UPDATE SET
       payload_json = excluded.payload_json,
       updated_at = excluded.updated_at`,
  );

  for (const baseline of baselines) {
    statement.run(baseline.playerId, JSON.stringify(baseline), updatedAt);
  }

  invalidateCatalogDerivedRuntimeCaches();
}

export function clearPlayerSavePatches(playerId: string) {
  const database = getDatabase();
  database.prepare("DELETE FROM players WHERE player_id = ?").run(playerId);
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

function replacePlayersForSave(
  saveId: string,
  players: Player[],
  catalogSourcePlayers: Player[],
  updatedAt: string,
  options?: { touchPlayerIds?: Set<string> },
) {
  const database = getDatabase();
  ensurePlayerCatalog(database, catalogSourcePlayers, updatedAt);
  const catalog = loadPlayerCatalog(database);

  const existingRows = database.prepare("SELECT player_id, payload_json FROM players WHERE save_id = ?").all(saveId) as Array<{
    player_id: string;
    payload_json: string;
  }>;
  const existingPayloadByPlayerId = new Map(existingRows.map((row) => [row.player_id, row.payload_json]));

  const upsertStatement = database.prepare(
    `INSERT INTO players (save_id, player_id, payload_json) VALUES (?, ?, ?)
     ON CONFLICT(save_id, player_id) DO UPDATE SET payload_json = excluded.payload_json`,
  );
  const deleteStatement = database.prepare("DELETE FROM players WHERE save_id = ? AND player_id = ?");

  const touchPlayerIds = options?.touchPlayerIds;
  const playersToWrite = touchPlayerIds ? players.filter((player) => touchPlayerIds.has(player.id)) : players;
  const seenPlayerIds = new Set<string>();
  for (const player of playersToWrite) {
    seenPlayerIds.add(player.id);
    const basePlayer = catalog.get(player.id);
    const payload: PlayerSavePayload | null = basePlayer
      ? (() => {
          const patch = buildPlayerDelta(basePlayer, player);
          return Object.keys(patch).length ? { storage: "delta", patch } : null;
        })()
      : { storage: "full", player };

    if (!payload) {
      if (existingPayloadByPlayerId.has(player.id)) {
        deleteStatement.run(saveId, player.id);
      }
      continue;
    }

    const serialized = JSON.stringify(payload);
    if (existingPayloadByPlayerId.get(player.id) !== serialized) {
      upsertStatement.run(saveId, player.id, serialized);
    }
  }

  if (!touchPlayerIds) {
    for (const existingPlayerId of existingPayloadByPlayerId.keys()) {
      if (!seenPlayerIds.has(existingPlayerId)) {
        deleteStatement.run(saveId, existingPlayerId);
      }
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

function ensurePlayerPotentialForGameState(saveId: string, gameState: GameState): GameState {
  const hasRecords = (gameState.playerPotential?.length ?? 0) > 0;
  let withRecords: GameState;
  if (!hasRecords) {
    withRecords = {
      ...gameState,
      playerPotential: buildPlayerPotentialRecordsForSave({
        saveId,
        players: gameState.players,
        gameState,
      }),
    };
  } else if (!isPlayerPotentialModelCurrent(gameState.playerPotential)) {
    // Einmalige Migration bestehender Saves auf das aktuelle Potenzial-Modell
    // (Star-Uniform). Deterministisch aus dem Seed; kein neues Spiel nötig. Der
    // gestempelte modelVersion persistiert beim nächsten Speichern → läuft danach
    // nicht erneut.
    withRecords = {
      ...gameState,
      playerPotential: migratePlayerPotentialRecordsToCurrentModel({ saveId, gameState }),
    };
  } else {
    withRecords = gameState;
  }
  return {
    ...withRecords,
    playerPotential: reconcilePlayerPotentialRecordsForGameState({ gameState: withRecords }),
  };
}

function materializePersistedSave(row: SaveRow): PersistedSaveGame | null {
  const PERF_DEBUG = process.env.OLY_DEBUG_MATERIALIZE_TIMING === "1";
  const mark = (label: string) => {
    if (PERF_DEBUG) console.timeLog("materializePersistedSave", label);
  };
  if (PERF_DEBUG) console.time("materializePersistedSave");
  const saveId = row.save_id;
  const season = loadSingleton<Season>("seasons", saveId);
  const seasonState = loadSingleton<SeasonState>("season_states", saveId);
  const matchdayState = loadSingleton<MatchdayState>("matchday_states", saveId);
  const gameMetadata = loadSingleton<GameMetadata>("game_metadata", saveId);
  const mappingReport = loadSingleton<MappingReport>("mapping_reports", saveId);
  mark("singletons loaded");

  if (!season || !seasonState || !matchdayState || !mappingReport) {
    return null;
  }

  const playerBaselines = loadPlayerBaselinesForSave(
    saveId,
    (gameMetadata as GameMetadata & { playerBaselines?: PlayerBaselineRecord[] } | null)?.playerBaselines,
  );
  mark("playerBaselines loaded");
  const gamePhase = inferCompletedGamePhase({ metadata: gameMetadata, season, seasonState, matchdayState });
  const loadedPlayers = loadPlayersForSave(saveId);
  mark("players loaded");
  const loadedTeams = loadCollection<Team>("teams", "team_id", saveId);
  const loadedRosters = loadCollection<RosterEntry>("rosters", "roster_id", saveId);
  const loadedContracts = loadCollection<Contract>("contracts", "contract_id", saveId);
  const loadedTransferListings = loadCollection<TransferListing>("transfer_listings", "listing_id", saveId);
  const loadedTransferHistory = loadCollection<TransferHistoryEntry>("transfer_history", "history_id", saveId);
  const loadedLogs = loadCollection<GameLogEntry>("game_logs", "log_id", saveId);
  mark("collections loaded");
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
    ...(gameMetadata?.playerPotential ? { playerPotential: gameMetadata.playerPotential } : {}),
    ...(gameMetadata?.playerMoraleState
      ? { playerMoraleState: gameMetadata.playerMoraleState }
      : {}),
    ...(gameMetadata?.playerRelationshipEvents
      ? { playerRelationshipEvents: gameMetadata.playerRelationshipEvents }
      : {}),
    // #1: Zugewiesenen Saison-Kapitän aus dem Kalt-Load wiederherstellen (Back-Compat:
    // fehlt das Feld in älteren Saves, bleibt das bisherige Auto-Select-Verhalten).
    ...(gameMetadata?.teamCaptains ? { teamCaptains: gameMetadata.teamCaptains } : {}),
    // #8: Persistierte Inbox-Status-Overrides (erledigt/verworfen) wiederherstellen.
    ...(gameMetadata?.gameInboxItems ? { gameInboxItems: gameMetadata.gameInboxItems } : {}),
    season,
    seasonState,
    matchdayState,
    teams: loadedTeams,
    teamIdentities: loadCollection<TeamIdentity>("team_identities", "team_id", saveId),
    players: loadedPlayers,
    disciplines: loadCollection<Discipline>("disciplines", "discipline_id", saveId),
    rosters: loadedRosters,
    contracts: loadedContracts,
    transferListings: loadedTransferListings,
    transferHistory: loadedTransferHistory,
    logs: loadedLogs,
    mappingReport,
  });
  mark("hydrateGameStateMedia done");
  const gameStateWithoutBaseline = withNormalizedSeasonDisciplineSchedule(
    normalizeLegacySponsors(
    normalizeLegacyRosterTargets(
      normalizeLegacyFinanceScale(
        withNormalizedTeamGeneralManagers(withNormalizedTeamIdentityOverrides(normalizeLegacyCashCreatorsColdSteelCodes(hydrated)), {
          saveId,
        }),
      ),
    ),
    ),
    saveId,
  );
  mark("legacy normalization done");
  const baselineResult = ensurePlayerBaselines(gameStateWithoutBaseline, {
    sourcePlayers: loadBaselineSourcePlayers(),
    createdAt: row.created_at,
  });
  mark("ensurePlayerBaselines done");
  const withInjuryHistory = ensurePlayerInjuryHistoryForGameState(baselineResult.gameState);
  mark("ensurePlayerInjuryHistoryForGameState done");
  const gameState = ensurePlayerPotentialForGameState(saveId, withInjuryHistory);
  mark("ensurePlayerPotentialForGameState done");
  const gameStateWithScenarioMeta = gameState.scenarioMeta
    ? gameState
    : {
        ...gameState,
        scenarioMeta: buildScenarioMeta({ gameState }),
      };
  mark("scenarioMeta done");
  if (PERF_DEBUG) console.timeEnd("materializePersistedSave");

  return {
    saveId,
    name: row.name,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    gameState: gameStateWithScenarioMeta,
  };
}

/** Load teams/players/rosters + season head without baselines, potential, or session cache. */
export function readSliceGameStateForSave(saveId: string): GameState | null {
  const season = loadSingleton<Season>("seasons", saveId);
  const seasonState = loadSingleton<SeasonState>("season_states", saveId);
  const matchdayState = loadSingleton<MatchdayState>("matchday_states", saveId);
  const mappingReport = loadSingleton<MappingReport>("mapping_reports", saveId);
  const gameMetadata = loadSingleton<GameMetadata>("game_metadata", saveId);

  if (!season || !seasonState || !matchdayState || !mappingReport) {
    return null;
  }

  const gamePhase = inferCompletedGamePhase({ metadata: gameMetadata, season, seasonState, matchdayState });
  const hydrated = hydrateGameStateMedia({
    ...(gamePhase ? { gamePhase } : {}),
    ...(gameMetadata?.scenarioMeta ? { scenarioMeta: gameMetadata.scenarioMeta } : {}),
    ...(Number.isFinite(gameMetadata?.saveVersion) ? { saveVersion: gameMetadata?.saveVersion } : {}),
    season,
    seasonState,
    matchdayState,
    teams: loadCollection<Team>("teams", "team_id", saveId),
    teamIdentities: loadCollection<TeamIdentity>("team_identities", "team_id", saveId),
    players: loadPlayersForSave(saveId),
    disciplines: loadCollection<Discipline>("disciplines", "discipline_id", saveId),
    rosters: loadCollection<RosterEntry>("rosters", "roster_id", saveId),
    contracts: [],
    transferListings: [],
    transferHistory: loadCollection<TransferHistoryEntry>("transfer_history", "history_id", saveId),
    logs: [],
    mappingReport,
  });

  return normalizeLegacyRosterTargets(
    normalizeLegacyFinanceScale(
      withNormalizedTeamGeneralManagers(withNormalizedTeamIdentityOverrides(hydrated), { saveId }),
    ),
  );
}

function persistSeasonDerivationsSidecarFromGameState(saveId: string, gameState: GameState) {
  const record = gameState.seasonState.persistedSeasonDerivations as
    | PersistedSeasonDerivationsRecord
    | null
    | undefined;
  if (record && record.seasonId === gameState.season.id) {
    writeSeasonDerivationsSidecar(saveId, record);
    return;
  }
  deleteSeasonDerivationsSidecar(saveId);
}

function materializePersistedSaveCached(row: SaveRow): PersistedSaveGame | null {
  const contentSignature = buildSaveSessionCacheSignature(row);
  const cached = readSaveSessionCache(row.save_id, row.updated_at, contentSignature);
  const perfStats = getPersistPerfStats();
  if (cached) {
    if (perfStats) perfStats.readHit += 1;
    return cached;
  }

  const perfStartedAt = perfStats ? Date.now() : 0;
  const save = materializePersistedSave(row);
  if (save) {
    writeSaveSessionCache(save, contentSignature);
  }
  if (perfStats) {
    perfStats.readMiss += 1;
    perfStats.readMissMs += Date.now() - perfStartedAt;
  }

  return save;
}

type PersistPerfStats = {
  writes: number;
  writeMs: number;
  readMiss: number;
  readMissMs: number;
  readHit: number;
};

function getPersistPerfStats(): PersistPerfStats | null {
  if (process.env.OLY_DEBUG_SAVE_TIMING !== "1") return null;
  const globalScope = globalThis as typeof globalThis & { __olyPersistPerf?: PersistPerfStats };
  globalScope.__olyPersistPerf ??= { writes: 0, writeMs: 0, readMiss: 0, readMissMs: 0, readHit: 0 };
  return globalScope.__olyPersistPerf;
}

export function readPersistPerfStats(): PersistPerfStats | null {
  const globalScope = globalThis as typeof globalThis & { __olyPersistPerf?: PersistPerfStats };
  return globalScope.__olyPersistPerf ?? null;
}

function createPersistedSaveRecord(input: {
  saveId: string;
  name: string;
  status: SaveStatus;
  createdAt?: string;
  updatedAt?: string;
  gameState: GameState;
}) {
  const perfStats = getPersistPerfStats();
  const perfStartedAt = perfStats ? Date.now() : 0;
  const database = getDatabase();
  const now = new Date().toISOString();
  const createdAt = input.createdAt ?? now;
  const updatedAt = input.updatedAt ?? now;
  const normalizedWithoutBaselines = withNormalizedSeasonDisciplineSchedule(
    normalizeLegacyRosterTargets(
      normalizeLegacyFinanceScale(
        withNormalizedTeamGeneralManagers(withNormalizedTeamIdentityOverrides(normalizeLegacyCashCreatorsColdSteelCodes(input.gameState)), {
          saveId: input.saveId,
        }),
      ),
    ),
    input.saveId,
  );
  const baselinePlayerIds = new Set([
    ...normalizedWithoutBaselines.rosters.map((entry) => entry.playerId),
    ...(normalizedWithoutBaselines.playerBaselines ?? []).map((entry) => entry.playerId),
  ]);
  const normalizedGameState = ensurePlayerBaselines(normalizedWithoutBaselines, {
    sourcePlayers: loadBaselineSourcePlayers(),
    createdAt,
    playerIds: baselinePlayerIds,
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
    INSERT INTO saves (
      save_id,
      name,
      status,
      created_at,
      updated_at,
      content_signature,
      save_version,
      season_id,
      matchday_id,
      lineup_draft_count,
      transfer_history_count
    )
    VALUES (
      @saveId,
      @name,
      @status,
      @createdAt,
      @updatedAt,
      @contentSignature,
      @saveVersion,
      @seasonId,
      @matchdayId,
      @lineupDraftCount,
      @transferHistoryCount
    )
    ON CONFLICT(save_id) DO UPDATE SET
      name = excluded.name,
      status = excluded.status,
      updated_at = excluded.updated_at,
      content_signature = excluded.content_signature,
      save_version = excluded.save_version,
      season_id = excluded.season_id,
      matchday_id = excluded.matchday_id,
      lineup_draft_count = excluded.lineup_draft_count,
      transfer_history_count = excluded.transfer_history_count
  `);

  const transferHistoryCount = guardedGameState.transferHistory.length;
  const versionMetadata = buildVersionMetadataFromGameState({
    saveId: input.saveId,
    updatedAt,
    gameState: guardedGameState,
    transferHistoryCount,
  });

  const transaction = database.transaction(() => {
    upsertSave.run({
      saveId: input.saveId,
      name: input.name,
      status: input.status,
      createdAt,
      updatedAt,
      contentSignature: versionMetadata.contentSignature,
      saveVersion: versionMetadata.saveVersion ?? 0,
      seasonId: versionMetadata.seasonId,
      matchdayId: versionMetadata.matchdayId,
      lineupDraftCount: versionMetadata.lineupDraftCount,
      transferHistoryCount: versionMetadata.transferHistoryCount,
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
      playerPotential: guardedGameState.playerPotential,
      playerMoraleState: guardedGameState.playerMoraleState,
      playerRelationshipEvents: guardedGameState.playerRelationshipEvents,
      // #1: Zugewiesenen Saison-Kapitän dauerhaft schreiben (nicht nur im Session-Cache).
      teamCaptains: guardedGameState.teamCaptains,
      // #8: Inbox-Status-Overrides (erledigt/verworfen) dauerhaft schreiben.
      gameInboxItems: guardedGameState.gameInboxItems,
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
    appendOnlyCollection("transfer_history", "history_id", input.saveId, guardedGameState.transferHistory, (entry) => entry.id);
    appendOnlyCollection("game_logs", "log_id", input.saveId, guardedGameState.logs, (log) => log.id);
    enforceRollingSaveRetention(database, [input.saveId]);
  });

  transaction();
  invalidateStandingsOverviewCache(input.saveId);
  invalidateSeasonDerivationsCache(input.saveId);
  invalidateLegacyLineupLabContextCache(input.saveId);
  invalidateStandingsPreviewCache(input.saveId);
  invalidateArenaPreviewCache(input.saveId);

  const gameStateWithScenarioMeta = guardedGameState.scenarioMeta
    ? guardedGameState
    : {
        ...guardedGameState,
        scenarioMeta: buildScenarioMeta({ gameState: guardedGameState }),
      };

  const persistedSave = {
    saveId: input.saveId,
    name: input.name,
    status: input.status,
    createdAt,
    updatedAt,
    gameState: gameStateWithScenarioMeta,
  };

  writeSaveSessionCache(persistedSave, versionMetadata.contentSignature);
  persistSeasonDerivationsSidecarFromGameState(input.saveId, guardedGameState);

  if (perfStats) {
    perfStats.writes += 1;
    perfStats.writeMs += Date.now() - perfStartedAt;
    if (perfStats.writes % 20 === 0) {
      console.error(
        `[persist-perf] writes=${perfStats.writes} writeMs=${perfStats.writeMs} (avg ${Math.round(perfStats.writeMs / perfStats.writes)}ms) | readMiss=${perfStats.readMiss} readMissMs=${perfStats.readMissMs} (avg ${perfStats.readMiss ? Math.round(perfStats.readMissMs / perfStats.readMiss) : 0}ms) | readHit=${perfStats.readHit}`,
      );
    }
  }

  return persistedSave;
}

export function createSaveRepository(): SaveRepository {
  return {
    getActiveSave(ownerId?: string | null) {
      const database = getDatabase();

      // Per-owner pointer: when an ownerId is supplied AND that owner has an active_saves
      // pointer AND the pointed-to save still exists, return THAT save. Otherwise fall through
      // to the global (status='active', most recent) behavior. So: no ownerId (auth off) is
      // byte-for-byte the original behavior, and an owner without a pointer yet degrades
      // gracefully to the global active save.
      if (ownerId) {
        const pointer = database
          .prepare("SELECT save_id FROM active_saves WHERE owner_id = ?")
          .get(ownerId) as { save_id: string } | undefined;
        if (pointer) {
          const pointedRow = loadSaveRow(pointer.save_id);
          if (pointedRow) {
            return materializePersistedSaveCached(pointedRow);
          }
        }
      }

      const row = database
        .prepare("SELECT save_id, name, status, created_at, updated_at FROM saves WHERE status = 'active' ORDER BY updated_at DESC LIMIT 1")
        .get() as SaveRow | undefined;
      if (!row) {
        return null;
      }

      const fullRow = loadSaveRow(row.save_id);
      return fullRow ? materializePersistedSaveCached(fullRow) : null;
    },
    getSaveById(saveId: string) {
      const row = loadSaveRow(saveId);
      return row ? materializePersistedSaveCached(row) : null;
    },
    getSaveVersionMetadata(saveId: string) {
      if (saveId === "active" || saveId === "current") {
        const database = getDatabase();
        const row = database
          .prepare("SELECT save_id, name, status, created_at, updated_at FROM saves WHERE status = 'active' ORDER BY updated_at DESC LIMIT 1")
          .get() as SaveRow | undefined;
        return row ? loadSaveVersionMetadata(row.save_id) : null;
      }
      return loadSaveVersionMetadata(saveId);
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
    setActiveSave(saveId: string, ownerId?: string | null) {
      const existing = this.getSaveById(saveId);
      if (!existing) {
        return null;
      }

      const database = getDatabase();
      const transaction = database.transaction(() => {
        const now = new Date().toISOString();
        if (ownerId) {
          // Per-owner activate: move ONLY this owner's pointer to the save and mark it active for
          // compatibility. Crucially we do NOT run the blanket archive — archiving every other
          // active save is exactly what would steal the other player's active save.
          database
            .prepare(
              "INSERT INTO active_saves (owner_id, save_id, updated_at) VALUES (?, ?, ?) " +
                "ON CONFLICT(owner_id) DO UPDATE SET save_id = excluded.save_id, updated_at = excluded.updated_at",
            )
            .run(ownerId, saveId, now);
          database.prepare("UPDATE saves SET status = 'active', updated_at = ? WHERE save_id = ?").run(now, saveId);
        } else {
          // Global (auth-off / solo) behavior — unchanged: blanket-archive every other active
          // save, then mark this one active.
          database.prepare("UPDATE saves SET status = 'archived' WHERE status = 'active' AND save_id != ?").run(saveId);
          database.prepare("UPDATE saves SET status = 'active', updated_at = ? WHERE save_id = ?").run(now, saveId);
        }
        enforceRollingSaveRetention(database, [saveId]);
      });
      transaction();

      return this.getSaveById(saveId);
    },
    createSaveFromSeed({ saveId, name, status, seedData }) {
      // scheduleSeedId ties the initial season discipline schedule to this save's unique
      // saveId so every new save/season gets its own pairing + player-count rolls instead of
      // reusing the default "local-game-state" seed for every save (see season-discipline-schedule.ts).
      const gameState = createGameStateFromSeed(seedData, { scheduleSeedId: saveId });
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
    deleteSaves(saveIds: string[]) {
      const requestedIds = [...new Set(saveIds.filter((saveId) => Boolean(saveId)))];
      if (requestedIds.length === 0) {
        return [];
      }

      const database = getDatabase();
      const activeRow = database.prepare("SELECT save_id FROM saves WHERE status = 'active'").get() as
        | { save_id: string }
        | undefined;
      const activeSaveId = activeRow?.save_id ?? null;

      const existsStatement = database.prepare("SELECT 1 FROM saves WHERE save_id = ?");
      const deleteSaveStatement = database.prepare("DELETE FROM saves WHERE save_id = ?");
      const childStatements = SAVE_CHILD_TABLES.map((table) => database.prepare(`DELETE FROM ${table} WHERE save_id = ?`));

      const deletedSaveIds: string[] = [];
      const transaction = database.transaction(() => {
        for (const saveId of requestedIds) {
          // Never delete the currently active save — the UI is expected to prevent this
          // selection up front, but this is the last line of defense against a broken app state.
          if (saveId === activeSaveId) {
            continue;
          }
          if (!existsStatement.get(saveId)) {
            continue;
          }
          for (const statement of childStatements) {
            statement.run(saveId);
          }
          deleteSaveStatement.run(saveId);
          deletedSaveIds.push(saveId);
        }
      });
      transaction();

      for (const saveId of deletedSaveIds) {
        invalidateSaveSessionCache(saveId);
        invalidateStandingsOverviewCache(saveId);
        invalidateSeasonDerivationsCache(saveId);
        invalidateLegacyLineupLabContextCache(saveId);
        invalidateStandingsPreviewCache(saveId);
        invalidateArenaPreviewCache(saveId);
        deleteSeasonDerivationsSidecar(saveId);
      }

      return deletedSaveIds;
    },
    deleteSave(saveId: string) {
      return this.deleteSaves([saveId]).includes(saveId);
    },
  };
}
