import type {
  GamePhase,
  GameState,
  ServerActionConflictCode,
  ServerActionRequest,
  ServerGameSaveRecord,
  ServerGameStatePayload,
} from "@/lib/data/olyDataTypes";
import type { PersistedSaveGame } from "@/lib/persistence/types";

export type ServerGameSaveSchemaVersion = "server-game-save-v1";

export type ServerGameSaveValidationIssue = {
  code: string;
  severity: "blocker" | "warning";
  message: string;
  count?: number;
  refs?: string[];
};

export type ServerGameSaveValidation = {
  ok: boolean;
  blockers: ServerGameSaveValidationIssue[];
  warnings: ServerGameSaveValidationIssue[];
  counts: {
    players: number;
    playerBaselines: number;
    teams: number;
    activeRosterEntries: number;
    contracts: number;
    transferHistory: number;
    seasonSnapshots: number;
    matchdayResults: number;
    lineups: number;
    formCards: number;
  };
};

export type ServerGameSaveExportPayload = {
  schemaVersion: ServerGameSaveSchemaVersion;
  exportedAt: string;
  source: {
    sourceType: "local_sqlite_sandbox";
    saveId: string;
    saveName: string;
    scenarioType: string | null;
  };
  serverGameSave: ServerGameSaveRecord;
  serverGameState: ServerGameStatePayload;
  validation: ServerGameSaveValidation;
  migrationNotes: string[];
};

export type ServerImportDryRunResult = {
  ok: boolean;
  dryRun: true;
  productiveWrites: false;
  validation: ServerGameSaveValidation;
  importReady: boolean;
};

export type ServerWritePathClassification = {
  localOkay: string[];
  serverRequired: string[];
  forbidden: string[];
};

export type ServerPersistenceReadinessAudit = {
  generatedAt: string;
  save: {
    saveId: string;
    name: string;
    activeSeasonId: string;
    activeMatchday: string | number | null;
    gamePhase: GamePhase;
    scenarioType: string | null;
    saveVersion: number;
  };
  dataInventory: Array<{
    area: string;
    currentSource: "local_sqlite_save" | "data_source" | "generated_seed" | "prisma_read_projection" | "runtime_ui_state";
    mode: "mutable_local" | "immutable_read_only" | "read_only_projection" | "preview_only";
    laterServerPersistence: "required" | "optional" | "not_required";
    notes: string;
  }>;
  writePaths: ServerWritePathClassification;
  serverModel: {
    saveRecordFields: string[];
    stateBuckets: string[];
    baselinePolicy: string;
  };
  concurrency: {
    versionField: "saveVersion";
    idempotencyField: "lastAppliedEventId/appliedEventIds";
    conflictCodes: ServerActionConflictCode[];
  };
  deploymentReadiness: {
    envVars: string[];
    infrastructure: string[];
    openItems: string[];
  };
  validation: ServerGameSaveValidation;
};

export function getServerWritePathClassification(): ServerWritePathClassification {
  return {
    localOkay: ["Sandbox Runner", "Test Snapshots", "local smoke writes"],
    serverRequired: [
      "Buy",
      "Sell",
      "Facility Upgrade",
      "XP Apply",
      "Training Mode",
      "Lineup Save",
      "Formkarten",
      "Matchday Resolve",
      "Season Transition",
      "Room/Ownership Changes",
    ],
    forbidden: ["Prisma Write ausserhalb erlaubter Services", "Direktinsert ohne Service", "Client-only Write"],
  };
}

function resolveGamePhase(gameState: GameState): GamePhase {
  return gameState.gamePhase ?? "season_active";
}

function resolveActiveMatchday(gameState: GameState) {
  return gameState.matchdayState.matchdayId || gameState.season.currentMatchday || null;
}

function resolveSaveVersion(save: PersistedSaveGame) {
  return Number.isFinite(save.gameState.saveVersion) ? Math.max(1, Math.trunc(save.gameState.saveVersion ?? 1)) : 1;
}

function pushIssue(
  target: ServerGameSaveValidationIssue[],
  code: string,
  severity: ServerGameSaveValidationIssue["severity"],
  message: string,
  refs?: string[],
) {
  target.push({
    code,
    severity,
    message,
    count: refs?.length,
    refs: refs?.slice(0, 20),
  });
}

export function buildServerGameStatePayload(gameState: GameState): ServerGameStatePayload {
  const lineupModifiers = (gameState.seasonState.lineupDrafts ?? []).map((lineup) => ({
    lineupId: lineup.lineupId,
    seasonId: lineup.seasonId,
    matchdayId: lineup.matchdayId,
    teamId: lineup.teamId,
    modifiers: lineup.modifiers ?? null,
  }));

  return {
    players: gameState.players,
    playerBaselines: gameState.playerBaselines ?? [],
    teams: gameState.teams,
    teamIdentities: gameState.teamIdentities,
    rosters: gameState.rosters,
    contracts: gameState.contracts,
    transferListings: gameState.transferListings,
    transferHistory: gameState.transferHistory,
    facilities: gameState.seasonState.teamFacilities ?? {},
    facilityEvents: gameState.seasonState.facilityEvents ?? [],
    progressionEvents: gameState.playerProgressionEvents ?? [],
    lineups: gameState.seasonState.lineupDrafts ?? [],
    formCards: gameState.seasonState.formCards ?? [],
    mutators: {
      source: lineupModifiers.some((entry) => entry.modifiers) ? "lineup_modifiers" : "missing_source",
      lineupModifiers,
    },
    matchdayResults: gameState.seasonState.matchdayResults ?? [],
    disciplineResults: gameState.seasonState.disciplineResults ?? [],
    playerDisciplinePerformances: gameState.seasonState.playerDisciplinePerformances ?? [],
    standings: gameState.seasonState.standings,
    seasonHistory: gameState.seasonState.seasonSnapshots ?? [],
    workflowLogs: gameState.seasonState.preSeasonWorkflowLogs ?? [],
    roomParticipants: gameState.seasonState.teamControlSettings ?? {},
    teamOwnership: gameState.seasonState.teamControlSettings ?? {},
    scenarioMeta: gameState.scenarioMeta,
  };
}

export function validateServerGameSave(payload: ServerGameSaveExportPayload): ServerGameSaveValidation {
  const state = payload.serverGameState;
  const blockers: ServerGameSaveValidationIssue[] = [];
  const warnings: ServerGameSaveValidationIssue[] = [];
  const playerIds = new Set(state.players.map((player) => player.id));
  const baselineIds = new Set(state.playerBaselines.map((baseline) => baseline.playerId));
  const teamIds = new Set(state.teams.map((team) => team.teamId));
  const inactiveContractStatuses = new Set(["released", "out_of_contract", "free_agent"]);
  const activeRosterEntries = state.rosters.filter(
    (roster) => !inactiveContractStatuses.has(roster.contractStatus ?? "active"),
  );

  const missingBaselines = state.players.filter((player) => !baselineIds.has(player.id)).map((player) => player.id);
  if (missingBaselines.length) {
    pushIssue(
      blockers,
      "player_baseline_required_before_server_save",
      "blocker",
      "Mindestens ein Spieler hat keine immutable Baseline.",
      missingBaselines,
    );
  }

  const danglingRosterPlayers = activeRosterEntries
    .filter((roster) => !playerIds.has(roster.playerId))
    .map((roster) => roster.id);
  if (danglingRosterPlayers.length) {
    pushIssue(blockers, "dangling_roster_player_ref", "blocker", "Kader verweist auf fehlende Spieler.", danglingRosterPlayers);
  }

  const danglingRosterTeams = activeRosterEntries
    .filter((roster) => !teamIds.has(roster.teamId))
    .map((roster) => roster.id);
  if (danglingRosterTeams.length) {
    pushIssue(blockers, "dangling_roster_team_ref", "blocker", "Kader verweist auf fehlende Teams.", danglingRosterTeams);
  }

  const rosterByPlayer = new Map<string, string[]>();
  for (const roster of activeRosterEntries) {
    rosterByPlayer.set(roster.playerId, [...(rosterByPlayer.get(roster.playerId) ?? []), roster.teamId]);
  }
  const duplicateRosterPlayers = [...rosterByPlayer.entries()]
    .filter(([, teams]) => teams.length > 1)
    .map(([playerId, teams]) => `${playerId}:${teams.join(",")}`);
  if (duplicateRosterPlayers.length) {
    pushIssue(blockers, "duplicate_active_roster_player", "blocker", "Aktive Kader enthalten Spieler mehrfach.", duplicateRosterPlayers);
  }

  const danglingTransfers = state.transferHistory
    .filter(
      (entry) =>
        !playerIds.has(entry.playerId) ||
        (entry.fromTeamId !== null && entry.fromTeamId !== undefined && !teamIds.has(entry.fromTeamId)) ||
        (entry.toTeamId !== null && entry.toTeamId !== undefined && !teamIds.has(entry.toTeamId)),
    )
    .map((entry) => entry.id);
  if (danglingTransfers.length) {
    pushIssue(blockers, "dangling_transfer_ref", "blocker", "Transferhistorie verweist auf fehlende Spieler oder Teams.", danglingTransfers);
  }

  const negativeCashTeams = state.teams.filter((team) => Number(team.cash) < 0).map((team) => team.teamId);
  if (negativeCashTeams.length) {
    pushIssue(warnings, "negative_cash_detected", "warning", "Mindestens ein Team hat negatives Cash.", negativeCashTeams);
  }

  if (!Number.isFinite(payload.serverGameSave.version) || payload.serverGameSave.version < 1) {
    pushIssue(blockers, "save_version_missing", "blocker", "Server-Save-Version fehlt oder ist ungueltig.");
  }

  if (state.seasonHistory.length === 0 && payload.serverGameSave.gamePhase !== "season_active") {
    pushIssue(warnings, "season_history_missing", "warning", "Save ist nicht aktiv-frisch, aber hat keine Season-History-Snapshots.");
  }

  if (state.mutators.source === "missing_source") {
    pushIssue(warnings, "mutator_source_missing", "warning", "Mutatoren sind noch nicht als eigener Server-State modelliert.");
  }

  return {
    ok: blockers.length === 0,
    blockers,
    warnings,
    counts: {
      players: state.players.length,
      playerBaselines: state.playerBaselines.length,
      teams: state.teams.length,
      activeRosterEntries: activeRosterEntries.length,
      contracts: state.contracts.length,
      transferHistory: state.transferHistory.length,
      seasonSnapshots: state.seasonHistory.length,
      matchdayResults: state.matchdayResults.length,
      lineups: state.lineups.length,
      formCards: state.formCards.length,
    },
  };
}

export function exportLocalSandboxSaveForServer(save: PersistedSaveGame): ServerGameSaveExportPayload {
  const gameState = save.gameState;
  const payload: Omit<ServerGameSaveExportPayload, "validation"> = {
    schemaVersion: "server-game-save-v1",
    exportedAt: new Date().toISOString(),
    source: {
      sourceType: "local_sqlite_sandbox",
      saveId: save.saveId,
      saveName: save.name,
      scenarioType: gameState.scenarioMeta?.scenarioType ?? null,
    },
    serverGameSave: {
      saveId: save.saveId,
      roomId: gameState.scenarioMeta?.roomId ?? null,
      ownerUserId: null,
      activeSeasonId: gameState.season.id,
      activeMatchday: resolveActiveMatchday(gameState),
      gamePhase: resolveGamePhase(gameState),
      scenarioMeta: gameState.scenarioMeta,
      version: resolveSaveVersion(save),
      createdAt: save.createdAt,
      updatedAt: save.updatedAt,
    },
    serverGameState: buildServerGameStatePayload(gameState),
    migrationNotes: [
      "V1 ist ein lokaler Export-/Validierungsvertrag; importServerGameSave schreibt bewusst noch nichts.",
      "Player Baseline bleibt getrennt von mutable Save Player State.",
      "Prisma/Remote-Writes bleiben in diesem Block verboten.",
    ],
  };

  const fullPayload: ServerGameSaveExportPayload = {
    ...payload,
    validation: {
      ok: true,
      blockers: [],
      warnings: [],
      counts: {
        players: 0,
        playerBaselines: 0,
        teams: 0,
        activeRosterEntries: 0,
        contracts: 0,
        transferHistory: 0,
        seasonSnapshots: 0,
        matchdayResults: 0,
        lineups: 0,
        formCards: 0,
      },
    },
  };
  fullPayload.validation = validateServerGameSave(fullPayload);
  return fullPayload;
}

export function importServerGameSave(payload: ServerGameSaveExportPayload): ServerImportDryRunResult {
  const validation = validateServerGameSave(payload);
  return {
    ok: validation.ok,
    dryRun: true,
    productiveWrites: false,
    validation,
    importReady: validation.ok,
  };
}

export function validateServerActionConcurrency(input: {
  request: ServerActionRequest;
  currentSaveVersion: number;
  lastAppliedEventId?: string | null;
  appliedEventIds?: string[];
  expectedConfirmToken?: string | null;
}) {
  if (input.request.expectedSaveVersion !== input.currentSaveVersion) {
    return {
      ok: false as const,
      conflictCode: "save_version_conflict" as const,
      message: `Expected saveVersion ${input.request.expectedSaveVersion}, current is ${input.currentSaveVersion}.`,
    };
  }

  const idempotencyKey = input.request.idempotencyKey ?? null;
  if (
    idempotencyKey &&
    (input.lastAppliedEventId === idempotencyKey || (input.appliedEventIds ?? []).includes(idempotencyKey))
  ) {
    return {
      ok: false as const,
      conflictCode: "action_already_applied" as const,
      message: "This idempotency key was already applied.",
    };
  }

  if (
    input.expectedConfirmToken !== undefined &&
    input.expectedConfirmToken !== null &&
    input.request.confirmToken !== input.expectedConfirmToken
  ) {
    return {
      ok: false as const,
      conflictCode: "confirm_token_stale" as const,
      message: "Confirm token is missing or stale.",
    };
  }

  return {
    ok: true as const,
    conflictCode: null,
    message: "server_action_request_ready",
  };
}

export function buildServerPersistenceReadinessAudit(save: PersistedSaveGame): ServerPersistenceReadinessAudit {
  const exportPayload = exportLocalSandboxSaveForServer(save);
  return {
    generatedAt: exportPayload.exportedAt,
    save: {
      saveId: save.saveId,
      name: save.name,
      activeSeasonId: save.gameState.season.id,
      activeMatchday: resolveActiveMatchday(save.gameState),
      gamePhase: resolveGamePhase(save.gameState),
      scenarioType: save.gameState.scenarioMeta?.scenarioType ?? null,
      saveVersion: exportPayload.serverGameSave.version,
    },
    dataInventory: [
      {
        area: "players baseline",
        currentSource: "local_sqlite_save",
        mode: "immutable_read_only",
        laterServerPersistence: "required",
        notes: "Immutable Ursprungskopie; darf von Sandbox-Mutationen nicht ueberschrieben werden.",
      },
      {
        area: "save player state",
        currentSource: "local_sqlite_save",
        mode: "mutable_local",
        laterServerPersistence: "required",
        notes: "Attribute, XP, Progression und Vertragszustand sind save-spezifisch.",
      },
      {
        area: "team rosters",
        currentSource: "local_sqlite_save",
        mode: "mutable_local",
        laterServerPersistence: "required",
        notes: "Aktive Kader und Free-Agent-Status muessen serverseitig autoritativ werden.",
      },
      {
        area: "team cash",
        currentSource: "local_sqlite_save",
        mode: "mutable_local",
        laterServerPersistence: "required",
        notes: "Cash wird durch Transfers, Facilities und Season-End veraendert.",
      },
      {
        area: "transfer history",
        currentSource: "local_sqlite_save",
        mode: "mutable_local",
        laterServerPersistence: "required",
        notes: "Historie ist Audit-Quelle und darf nicht beim Season-Reset verloren gehen.",
      },
      {
        area: "facilities",
        currentSource: "local_sqlite_save",
        mode: "mutable_local",
        laterServerPersistence: "required",
        notes: "Facility-Level, Upkeep und Events sind Save-State.",
      },
      {
        area: "progression events",
        currentSource: "local_sqlite_save",
        mode: "mutable_local",
        laterServerPersistence: "required",
        notes: "XP-Spend-Events sind Audit-Trail fuer Attributveraenderungen.",
      },
      {
        area: "lineups / form cards / mutators",
        currentSource: "local_sqlite_save",
        mode: "mutable_local",
        laterServerPersistence: "required",
        notes: "Lineups und Formkarten sind vorhanden; Mutatoren brauchen noch eigenen State-Bucket.",
      },
      {
        area: "matchday results / standings / season history",
        currentSource: "local_sqlite_save",
        mode: "mutable_local",
        laterServerPersistence: "required",
        notes: "Resultate und Snapshots sind Grundlage fuer Multiplayer-Reconnect und Historie.",
      },
      {
        area: "team identities / fit matrix / seed data",
        currentSource: "data_source",
        mode: "immutable_read_only",
        laterServerPersistence: "optional",
        notes: "Aus data/source bzw. generierten Seeds; Server braucht Versionierung, aber keine Matchday-Writes.",
      },
      {
        area: "Prisma/Legacy projection",
        currentSource: "prisma_read_projection",
        mode: "read_only_projection",
        laterServerPersistence: "not_required",
        notes: "Aktuell fuer Reads/Legacy-Vergleich; keine autoritativen Writes in Sandbox.",
      },
      {
        area: "activeManagerTeamId / table layouts",
        currentSource: "runtime_ui_state",
        mode: "preview_only",
        laterServerPersistence: "optional",
        notes: "UI-Praeferenz, keine Rechtequelle.",
      },
    ],
    writePaths: getServerWritePathClassification(),
    serverModel: {
      saveRecordFields: Object.keys(exportPayload.serverGameSave),
      stateBuckets: Object.keys(exportPayload.serverGameState),
      baselinePolicy: "Player Baseline immutable, Save Player State mutable, neues Spiel wird aus Baseline/Seed erzeugt.",
    },
    concurrency: {
      versionField: "saveVersion",
      idempotencyField: "lastAppliedEventId/appliedEventIds",
      conflictCodes: ["save_version_conflict", "action_already_applied", "confirm_token_stale"],
    },
    deploymentReadiness: {
      envVars: [
        "DATABASE_URL",
        "AUTH_SECRET",
        "NEXT_PUBLIC_APP_URL",
        "WEBSOCKET_URL oder SOCKET_IO_PATH",
        "ASSET_STORAGE_BUCKET optional",
        "BACKUP_STORAGE_PATH optional",
        "AI_WORKER_TOKEN optional",
      ],
      infrastructure: [
        "Postgres/Supabase oder eigener Server-DB-Adapter",
        "Auth Provider fuer echte UserIds",
        "Socket.IO/WebSocket fuer Room-Events",
        "Snapshot/Backup Job",
        "Background Job fuer AI optional",
      ],
      openItems: [
        "Server-DB-Schema aus V1-Kontrakt ableiten",
        "Echten Auth Provider auswaehlen",
        "Mutator-State als eigenen Server-Bucket modellieren",
        "Server Actions/API-Routes mit Write-Guard verbinden",
        "Local-Sandbox zu Server-Save Import erst nach expliziter Freigabe produktiv machen",
      ],
    },
    validation: exportPayload.validation,
  };
}
