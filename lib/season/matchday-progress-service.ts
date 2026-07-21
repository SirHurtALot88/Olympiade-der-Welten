import type { Fixture, GameLogEntry, GameState, LineupDraft, MatchdayAdvanceLogRecord, PlayerMoraleState } from "@/lib/data/olyDataTypes";
import { assessPlayerMorale, buildMoraleLookupIndex } from "@/lib/morale/player-morale-service";
import type { PersistenceService } from "@/lib/persistence/types";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { advanceScoutIntelTick } from "@/lib/scouting/facility-scout-pipeline-service";
import { advancePlayerPotentialRevealTick } from "@/lib/progression/player-potential-service";
import { maybeGenerateSponsorEvents } from "@/lib/sponsor/sponsor-event-service";
import { buildFrozenValuationSnapshot } from "@/lib/season/frozen-valuation-snapshot";

export const ADVANCE_MATCHDAY_CONFIRM_TOKEN = "ADVANCE_LOCAL_MATCHDAY";

export type MatchdayProgressParams = {
  saveId: string;
  seasonId: string;
  source?: "sqlite" | "prisma";
  dryRun?: boolean;
  execute?: boolean;
  confirm?: string;
};

export type MatchdayProgressResult = {
  ok: boolean;
  source: "sqlite" | "prisma";
  dryRun: boolean;
  applied: boolean;
  canApply: boolean;
  blockingReasons: string[];
  warnings: string[];
  scope: {
    saveId: string;
    seasonId: string;
    currentMatchdayId: string;
    nextMatchdayId: string | null;
  };
  summary: {
    currentMatchdayIndex: number;
    nextMatchdayIndex: number | null;
    currentMatchdayLabel: string;
    nextMatchdayLabel: string | null;
    lockedLineups: number;
    resolvedFixtures: number;
    resultApplied: boolean;
    standingsApplied: boolean;
    cashApplied: boolean;
  };
  duplicateDetected: boolean;
  auditLogId: string | null;
};

type PreparedMatchdayProgress = {
  source: "sqlite" | "prisma";
  dryRun: boolean;
  saveId: string;
  seasonId: string;
  currentMatchdayId: string;
  currentMatchdayIndex: number;
  currentMatchdayLabel: string;
  nextMatchdayId: string | null;
  nextMatchdayIndex: number | null;
  nextMatchdayLabel: string | null;
  lockedLineups: LineupDraft[];
  resolvedFixtures: Fixture[];
  blockingReasons: string[];
  warnings: string[];
  duplicateDetected: boolean;
  existingAuditLog: MatchdayAdvanceLogRecord | null;
  resultApplied: boolean;
  standingsApplied: boolean;
  cashApplied: boolean;
};

function normalizeSource(source?: string) {
  return source === "prisma" ? "prisma" : "sqlite";
}

function resolveLocalSave(persistence: PersistenceService, saveId: string) {
  const bootstrapped = persistence.bootstrapSingleplayerSave();
  const save = persistence.getSaveById(saveId) ?? persistence.getActiveSave() ?? bootstrapped.save;

  if (!save) {
    throw new Error(`Local save ${saveId} could not be loaded for matchday progress.`);
  }

  return save;
}

function buildIdempotencyKey(scope: { saveId: string; seasonId: string; currentMatchdayId: string; nextMatchdayId: string | null }) {
  return `matchday-advance:${scope.saveId}:${scope.seasonId}:${scope.currentMatchdayId}:${scope.nextMatchdayId ?? "season-end"}`;
}

function buildAuditLogId(scope: { saveId: string; seasonId: string; currentMatchdayId: string; nextMatchdayId: string | null }) {
  return `matchday-advance-audit__${scope.saveId}__${scope.seasonId}__${scope.currentMatchdayId}__${scope.nextMatchdayId ?? "season-end"}`;
}

function createSeasonLog(message: string): GameLogEntry {
  return {
    id: `season-log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: "season",
    message,
    createdAt: new Date().toISOString(),
  };
}

function buildCurrentMoraleState(gameState: GameState): PlayerMoraleState[] {
  // Ligaweite Neuberechnung ueber ~320 Kader-Eintraege: den Lookup-Index EINMAL
  // bauen statt pro Spieler linear ueber players/rosters/teams/moraleState zu
  // scannen (players allein ~3000 Eintraege → vorher ~1 Mio Vergleiche/Matchday).
  const index = buildMoraleLookupIndex(gameState);
  const rosteredPlayerIds = new Set(gameState.rosters.map((roster) => roster.playerId));
  const activeRows = gameState.rosters
    .map((roster) => assessPlayerMorale({ gameState, playerId: roster.playerId, teamId: roster.teamId, index }))
    .filter((entry): entry is NonNullable<ReturnType<typeof assessPlayerMorale>> => Boolean(entry))
    .map((assessment) => ({
      playerId: assessment.playerId,
      teamId: assessment.teamId,
      morale: assessment.morale,
      visibleMood: assessment.visibleMood,
      lastUpdatedSeasonId: assessment.lastUpdatedSeasonId,
      inactiveSeasons: 0,
      reasons: assessment.reasons,
      contractIntent: assessment.contractIntent,
    }));

  const inactiveRows = (gameState.playerMoraleState ?? []).filter((entry) => !rosteredPlayerIds.has(entry.playerId));
  return [...activeRows, ...inactiveRows];
}

async function prepareMatchdayProgress(
  params: MatchdayProgressParams,
  persistence: PersistenceService,
): Promise<PreparedMatchdayProgress> {
  const source = normalizeSource(params.source);
  const dryRun = params.execute ? false : params.dryRun ?? true;

  if (source === "prisma") {
    return {
      source,
      dryRun,
      saveId: params.saveId,
      seasonId: params.seasonId,
      currentMatchdayId: "",
      currentMatchdayIndex: 0,
      currentMatchdayLabel: "—",
      nextMatchdayId: null,
      nextMatchdayIndex: null,
      nextMatchdayLabel: null,
      lockedLineups: [],
      resolvedFixtures: [],
      blockingReasons: ["Prisma/Supabase mode is read-only. Matchday progress is only allowed in the local SQLite test save."],
      warnings: [],
      duplicateDetected: false,
      existingAuditLog: null,
      resultApplied: false,
      standingsApplied: false,
      cashApplied: false,
    };
  }

  const save = resolveLocalSave(persistence, params.saveId);
  const { gameState } = save;
  const season = gameState.season;
  const currentMatchdayId = gameState.matchdayState.matchdayId;
  const currentMatchdayIndex = season.matchdayIds.findIndex((matchdayId) => matchdayId === currentMatchdayId);
  if (currentMatchdayIndex < 0) {
    throw new Error(`Current matchday ${currentMatchdayId} is not part of season ${season.id}.`);
  }

  const currentMatchdayOrdinal = currentMatchdayIndex + 1;
  const nextMatchdayId = season.matchdayIds[currentMatchdayIndex + 1] ?? null;
  const nextMatchdayIndex = nextMatchdayId ? currentMatchdayOrdinal + 1 : null;
  const currentMatchdayLabel = `Spieltag ${currentMatchdayOrdinal}`;
  const nextMatchdayLabel = nextMatchdayIndex ? `Spieltag ${nextMatchdayIndex}` : null;
  const idempotencyKey = buildIdempotencyKey({ saveId: save.saveId, seasonId: params.seasonId, currentMatchdayId, nextMatchdayId });
  const existingAuditLog =
    (gameState.seasonState.matchdayAdvanceLogs ?? []).find((entry) => entry.payload.idempotencyKey === idempotencyKey) ?? null;
  const duplicateDetected = existingAuditLog != null;

  const resultApplied = (gameState.seasonState.matchdayResults ?? []).some(
    (entry) => entry.seasonId === params.seasonId && entry.matchdayId === currentMatchdayId,
  );
  const standingsApplied = (gameState.seasonState.standingsApplyLogs ?? []).some(
    (entry) => entry.seasonId === params.seasonId && entry.matchdayId === currentMatchdayId,
  );
  const cashApplied = (gameState.seasonState.cashPrizeApplyLogs ?? []).some(
    (entry) => entry.seasonId === params.seasonId && entry.matchdayId === currentMatchdayId,
  );

  const lockedLineups = (gameState.seasonState.lineupDrafts ?? []).filter(
    (entry) => entry.seasonId === params.seasonId && entry.matchdayId === currentMatchdayId,
  );
  const resolvedFixtures = (gameState.seasonState.schedule ?? []).filter((fixture) => fixture.matchdayId === currentMatchdayId);

  const blockingReasons: string[] = [];
  if (!resultApplied) blockingReasons.push("result_apply_missing_for_current_matchday");
  if (!standingsApplied) blockingReasons.push("standings_apply_missing_for_current_matchday");
  if (duplicateDetected) blockingReasons.push("duplicate_matchday_advance_for_current_scope");
  // A missing next matchday is the normal season-end path. The writer below
  // already resolves the current matchday and leaves the save on season end.

  return {
    source,
    dryRun,
    saveId: save.saveId,
    seasonId: params.seasonId,
    currentMatchdayId,
    currentMatchdayIndex: currentMatchdayOrdinal,
    currentMatchdayLabel,
    nextMatchdayId,
    nextMatchdayIndex,
    nextMatchdayLabel,
    lockedLineups,
    resolvedFixtures,
    blockingReasons,
    warnings: [],
    duplicateDetected,
    existingAuditLog,
    resultApplied,
    standingsApplied,
    cashApplied,
  };
}

function buildResult(prepared: PreparedMatchdayProgress, input: { applied: boolean; auditLogId?: string | null }): MatchdayProgressResult {
  return {
    ok: prepared.blockingReasons.length === 0 || input.applied,
    source: prepared.source,
    dryRun: prepared.dryRun,
    applied: input.applied,
    canApply: prepared.blockingReasons.length === 0,
    blockingReasons: prepared.blockingReasons,
    warnings: prepared.warnings,
    scope: {
      saveId: prepared.saveId,
      seasonId: prepared.seasonId,
      currentMatchdayId: prepared.currentMatchdayId,
      nextMatchdayId: prepared.nextMatchdayId,
    },
    summary: {
      currentMatchdayIndex: prepared.currentMatchdayIndex,
      nextMatchdayIndex: prepared.nextMatchdayIndex,
      currentMatchdayLabel: prepared.currentMatchdayLabel,
      nextMatchdayLabel: prepared.nextMatchdayLabel,
      lockedLineups: prepared.lockedLineups.length,
      resolvedFixtures: prepared.resolvedFixtures.length,
      resultApplied: prepared.resultApplied,
      standingsApplied: prepared.standingsApplied,
      cashApplied: prepared.cashApplied,
    },
    duplicateDetected: prepared.duplicateDetected,
    auditLogId: input.auditLogId ?? null,
  };
}

function writeLocalMatchdayAdvance(prepared: PreparedMatchdayProgress, persistence: PersistenceService) {
  const save = resolveLocalSave(persistence, prepared.saveId);
  const now = new Date().toISOString();
  const nextSeasonState = {
    ...save.gameState.seasonState,
    schedule: save.gameState.seasonState.schedule.map((fixture) =>
      fixture.matchdayId === prepared.currentMatchdayId ? { ...fixture, status: "resolved" as const } : fixture,
    ),
    lineupDrafts: (save.gameState.seasonState.lineupDrafts ?? []).map((draft) =>
      draft.seasonId === prepared.seasonId && draft.matchdayId === prepared.currentMatchdayId
        ? { ...draft, status: "resolved" as const, updatedAt: now }
        : draft,
    ),
    matchdayAdvanceLogs: [
      ...(save.gameState.seasonState.matchdayAdvanceLogs ?? []),
      {
        id: buildAuditLogId({
          saveId: prepared.saveId,
          seasonId: prepared.seasonId,
          currentMatchdayId: prepared.currentMatchdayId,
          nextMatchdayId: prepared.nextMatchdayId,
        }),
        saveId: prepared.saveId,
        seasonId: prepared.seasonId,
        fromMatchdayId: prepared.currentMatchdayId,
        toMatchdayId: prepared.nextMatchdayId,
        action: "advance",
        payload: {
          idempotencyKey: buildIdempotencyKey({
            saveId: prepared.saveId,
            seasonId: prepared.seasonId,
            currentMatchdayId: prepared.currentMatchdayId,
            nextMatchdayId: prepared.nextMatchdayId,
          }),
          lockedLineups: prepared.lockedLineups.length,
          resolvedFixtures: prepared.resolvedFixtures.length,
          resultApplied: prepared.resultApplied,
          standingsApplied: prepared.standingsApplied,
          cashApplied: prepared.cashApplied,
        },
        createdAt: now,
      } satisfies MatchdayAdvanceLogRecord,
    ],
  };

  const nextGameState: GameState = maybeGenerateSponsorEvents(
    advancePlayerPotentialRevealTick(advanceScoutIntelTick({
      gameState: {
        ...save.gameState,
        gamePhase: prepared.nextMatchdayId ? "season_active" : "season_completed",
        season: {
          ...save.gameState.season,
          currentMatchday: prepared.nextMatchdayIndex ?? save.gameState.season.currentMatchday,
        },
        seasonState: nextSeasonState,
        playerMoraleState: buildCurrentMoraleState(save.gameState),
        matchdayState: {
          matchdayId: prepared.nextMatchdayId ?? prepared.currentMatchdayId,
          status: prepared.nextMatchdayId ? "planning" : "resolved",
          pendingTeamIds: prepared.nextMatchdayId ? save.gameState.teams.map((team) => team.teamId) : [],
          resolvedFixtureIds: [],
        },
        logs: [
          ...save.gameState.logs,
          createSeasonLog(
            prepared.nextMatchdayId
              ? `${prepared.currentMatchdayLabel} abgeschlossen. Weiter zu ${prepared.nextMatchdayLabel}.`
              : `${prepared.currentMatchdayLabel} abgeschlossen. Kein weiterer Matchday konfiguriert.`,
          ),
        ],
      },
      phase: "matchday",
    })),
    prepared.saveId,
  );

  // Season-End (kein weiterer Matchday = MD10 abgeschlossen): OVR/MVS/PPs/MW + Sale-Factor-Bracket
  // über den vollen MD10-Kader-Pool EINFRIEREN. Der Snapshot wird auf dem eben gebauten
  // season_completed-State berechnet (noch OHNE frozenValuationSnapshot → Gates rechnen live) und
  // sorgt dafür, dass spätere Verkäufe/Roster-Änderungen die Werte der übrigen Spieler nicht mehr
  // verschieben.
  const finalGameState: GameState = prepared.nextMatchdayId
    ? nextGameState
    : {
        ...nextGameState,
        seasonState: {
          ...nextGameState.seasonState,
          frozenValuationSnapshot: buildFrozenValuationSnapshot(nextGameState),
        },
      };

  persistence.saveSingleplayerState(save.saveId, finalGameState);
  return finalGameState.seasonState.matchdayAdvanceLogs?.[(finalGameState.seasonState.matchdayAdvanceLogs?.length ?? 0) - 1] ?? null;
}

export async function previewMatchdayAdvance(
  params: MatchdayProgressParams,
  persistence: PersistenceService = createPersistenceService(),
): Promise<MatchdayProgressResult> {
  const prepared = await prepareMatchdayProgress(params, persistence);
  return buildResult(prepared, { applied: false, auditLogId: prepared.existingAuditLog?.id ?? null });
}

export async function executeMatchdayAdvance(
  params: MatchdayProgressParams,
  persistence: PersistenceService = createPersistenceService(),
): Promise<MatchdayProgressResult> {
  const prepared = await prepareMatchdayProgress(
    {
      ...params,
      execute: true,
      dryRun: false,
    },
    persistence,
  );

  if (prepared.source === "prisma") {
    return buildResult(prepared, { applied: false, auditLogId: null });
  }

  if (prepared.blockingReasons.length > 0) {
    return buildResult(prepared, { applied: false, auditLogId: prepared.existingAuditLog?.id ?? null });
  }

  if (params.confirm !== ADVANCE_MATCHDAY_CONFIRM_TOKEN) {
    return {
      ...buildResult(prepared, { applied: false, auditLogId: null }),
      ok: false,
      canApply: false,
      blockingReasons: ["Missing explicit confirm token for execute."],
    };
  }

  const auditLog = writeLocalMatchdayAdvance(prepared, persistence);

  return {
    ...buildResult(prepared, { applied: true, auditLogId: auditLog?.id ?? null }),
    ok: true,
    dryRun: false,
    canApply: true,
    blockingReasons: [],
  };
}
