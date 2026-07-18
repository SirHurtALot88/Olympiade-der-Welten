import type { GameState, StandingsApplyAuditLogRecord } from "@/lib/data/olyDataTypes";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import type { PersistenceService } from "@/lib/persistence/types";
import { refreshTeamObjectiveState } from "@/lib/board/team-season-objectives-service";
import {
  buildStandingsPreview,
  type StandingsPreviewInput,
  type StandingsPreviewResult,
  type StandingsPreviewSource,
  type StandingsPreviewTieGroup,
} from "@/lib/standings/standings-preview-engine";

export const STANDINGS_APPLY_CONFIRM_TOKEN = "APPLY_LOCAL_STANDINGS";

export type StandingsApplyParams = {
  saveId: string;
  seasonId: string;
  matchdayId: string;
  source?: StandingsPreviewSource;
  dryRun?: boolean;
  execute?: boolean;
  confirm?: string;
  forceReplace?: boolean;
};

export type StandingsApplyPlannedChange = {
  teamId: string;
  teamName: string;
  oldRank: number | null;
  newRank: number | null;
  oldPoints: number | null;
  delta: number | null;
  newPoints: number | null;
  matchdayScore: number | null;
  matchdayRank: number | null;
  resultStatus: string;
  warnings: string[];
};

export type StandingsApplyResult = {
  ok: boolean;
  source: StandingsPreviewSource;
  dryRun: boolean;
  applied: boolean;
  canApply: boolean;
  blockingReasons: string[];
  warnings: string[];
  plannedChanges: StandingsApplyPlannedChange[];
  tieGroups: StandingsPreviewTieGroup[];
  scope: {
    saveId: string;
    seasonId: string;
    matchdayId: string;
  };
  idempotencyKey: string;
  duplicateDetected: boolean;
  auditLogId: string | null;
  summary: {
    totalTeams: number;
    readyTeams: number;
    blockedTeams: number;
  };
};

type PrepareStandingsApplyResult = {
  source: StandingsPreviewSource;
  dryRun: boolean;
  preview: StandingsPreviewResult;
  idempotencyKey: string;
  plannedChanges: StandingsApplyPlannedChange[];
  blockingReasons: string[];
  warnings: string[];
  duplicateDetected: boolean;
  existingAuditLog: StandingsApplyAuditLogRecord | null;
};

function normalizeSource(source?: string): StandingsPreviewSource {
  return source === "prisma" ? "prisma" : "sqlite";
}

function buildIdempotencyKey(scope: { saveId: string; seasonId: string; matchdayId: string }) {
  return `standings-apply:${scope.saveId}:${scope.seasonId}:${scope.matchdayId}`;
}

function buildAuditLogId(scope: { saveId: string; seasonId: string; matchdayId: string }) {
  return `standings-apply-audit__${scope.saveId}__${scope.seasonId}__${scope.matchdayId}`;
}

function resolveLocalSave(persistence: PersistenceService, saveId: string) {
  const save = persistence.getSaveById(saveId);
  if (!save) {
    throw new Error(`Requested local save ${saveId} could not be loaded for standings apply.`);
  }

  return save;
}

function toPlannedChanges(preview: StandingsPreviewResult): StandingsApplyPlannedChange[] {
  return preview.items.map((item) => ({
    teamId: item.teamId,
    teamName: item.teamName,
    oldRank: item.currentRank,
    newRank: item.projectedRank,
    oldPoints: item.currentPoints,
    delta: item.pointsDelta,
    newPoints: item.projectedPoints,
    matchdayScore: item.matchdayScore,
    matchdayRank: item.matchdayRank,
    resultStatus: item.resultStatus,
    warnings: item.warnings,
  }));
}

function buildBlockingReasons(preview: StandingsPreviewResult, duplicateDetected: boolean, forceReplace: boolean) {
  const reasons = new Set<string>();

  if (duplicateDetected && !forceReplace) {
    reasons.add("duplicate_apply_for_save_season_matchday");
  }

  for (const blockedRule of preview.blockedRules) {
    if (forceReplace && blockedRule === "global_score_tie_breaker_missing") {
      continue;
    }
    reasons.add(`blockedRule:${blockedRule}`);
  }

  if (preview.tieGroups.length > 0 && !forceReplace) {
    reasons.add("tie_groups_require_confirmed_policy");
  }

  for (const item of preview.items) {
    if (item.resultStatus === "missing_result") {
      reasons.add(`missing_result:${item.teamId}`);
    }
    if (item.resultStatus === "incomplete_result" && !forceReplace) {
      reasons.add(`incomplete_result:${item.teamId}`);
    }
    if (item.resultStatus === "tie_warning" && !forceReplace) {
      reasons.add(`tie_warning:${item.teamId}`);
    }
    if (
      item.currentPoints == null ||
      item.pointsDelta == null ||
      item.projectedPoints == null ||
      item.projectedRank == null
    ) {
      reasons.add(`missing_preview_value:${item.teamId}`);
    }
  }

  return Array.from(reasons);
}

function buildWarnings(preview: StandingsPreviewResult, duplicateDetected: boolean) {
  const warnings = new Set<string>();

  if (duplicateDetected) {
    warnings.add("duplicate_apply_detected");
  }

  for (const item of preview.items) {
    for (const warning of item.warnings) {
      warnings.add(`${item.teamId}:${warning}`);
    }
  }

  return Array.from(warnings);
}

async function prepareStandingsApply(
  params: StandingsApplyParams,
  persistence: PersistenceService,
): Promise<PrepareStandingsApplyResult> {
  const source = normalizeSource(params.source);
  const dryRun = params.execute ? false : params.dryRun ?? true;
  const scope = {
    saveId: params.saveId,
    seasonId: params.seasonId,
    matchdayId: params.matchdayId,
  };
  const idempotencyKey = buildIdempotencyKey(scope);

  const preview = await buildStandingsPreview(
    {
      ...scope,
      source,
    } satisfies StandingsPreviewInput,
    undefined,
    persistence,
  );

  const existingAuditLog =
    source === "sqlite"
      ? (resolveLocalSave(persistence, scope.saveId).gameState.seasonState.standingsApplyLogs ?? []).find(
          (log) =>
            log.saveId === scope.saveId &&
            log.seasonId === scope.seasonId &&
            log.matchdayId === scope.matchdayId &&
            log.payload.idempotencyKey === idempotencyKey,
        ) ?? null
      : null;

  const duplicateDetected = existingAuditLog != null;
  const plannedChanges = toPlannedChanges(preview);
  const blockingReasons =
    source === "prisma"
      ? ["Prisma/Supabase mode is read-only. Standings Apply is only allowed in the local SQLite test save."]
      : buildBlockingReasons(preview, duplicateDetected, params.forceReplace === true);
  const warnings = buildWarnings(preview, duplicateDetected);

  return {
    source,
    dryRun,
    preview,
    idempotencyKey,
    plannedChanges,
    blockingReasons,
    warnings,
    duplicateDetected,
    existingAuditLog,
  };
}

function buildResult(prepared: PrepareStandingsApplyResult, input: { applied: boolean; auditLogId?: string | null }): StandingsApplyResult {
  return {
    ok: prepared.blockingReasons.length === 0 || input.applied,
    source: prepared.source,
    dryRun: prepared.dryRun,
    applied: input.applied,
    canApply: prepared.blockingReasons.length === 0,
    blockingReasons: prepared.blockingReasons,
    warnings: prepared.warnings,
    plannedChanges: prepared.plannedChanges,
    tieGroups: prepared.preview.tieGroups,
    scope: prepared.preview.scope,
    idempotencyKey: prepared.idempotencyKey,
    duplicateDetected: prepared.duplicateDetected,
    auditLogId: input.auditLogId ?? null,
    summary: {
      totalTeams: prepared.preview.summary.totalTeams,
      readyTeams: prepared.preview.summary.readyTeams,
      blockedTeams: prepared.preview.summary.blockedTeamCount,
    },
  };
}

function writeLocalStandingsApply(input: {
  persistence: PersistenceService;
  saveId: string;
  preview: StandingsPreviewResult;
  idempotencyKey: string;
}) {
  const save = resolveLocalSave(input.persistence, input.saveId);
  const seasonState = save.gameState.seasonState;
  const nextStandings = { ...seasonState.standings };

  const matchdayId = input.preview.scope.matchdayId;
  for (const item of input.preview.items) {
    const previous = nextStandings[item.teamId] ?? { points: 0, rank: null };
    const projectedPoints = item.projectedPoints ?? previous.points ?? 0;
    // Persist the pre-matchday baseline (points before this matchday's delta) so a forceReplace
    // re-apply of the same matchday recomputes from it instead of the incremented total. The preview
    // already computed projected = baseline + delta, so baseline = projected − delta reconstructs it
    // exactly (both are rounded to 1 decimal). This keeps standings-apply idempotent per matchday.
    const baselinePoints =
      item.projectedPoints != null && item.pointsDelta != null
        ? Number((item.projectedPoints - item.pointsDelta).toFixed(1))
        : previous.matchdayBaselineId === matchdayId
          ? previous.matchdayBaselinePoints ?? previous.points ?? 0
          : previous.points ?? 0;
    nextStandings[item.teamId] = {
      ...previous,
      points: projectedPoints,
      rank: item.projectedRank,
      matchdayBaselinePoints: baselinePoints,
      matchdayBaselineId: matchdayId,
    };
  }

  const now = new Date().toISOString();
  const auditLog: StandingsApplyAuditLogRecord = {
    id: buildAuditLogId(input.preview.scope),
    saveId: input.preview.scope.saveId,
    seasonId: input.preview.scope.seasonId,
    matchdayId: input.preview.scope.matchdayId,
    action: "apply",
    payload: {
      idempotencyKey: input.idempotencyKey,
      totalTeams: input.preview.summary.totalTeams,
      appliedTeams: input.preview.items.length,
      tieGroupsCount: input.preview.tieGroups.length,
      previewWarningsCount: input.preview.items.reduce((sum, item) => sum + item.warnings.length, 0),
    },
    createdAt: now,
  };

  const nextGameState: GameState = {
    ...save.gameState,
    seasonState: {
      ...seasonState,
      standings: nextStandings,
      standingsApplyLogs: [
        ...(seasonState.standingsApplyLogs ?? []).filter(
          (log) => log.payload.idempotencyKey !== input.idempotencyKey,
        ),
        auditLog,
      ],
    },
  };

  input.persistence.saveSingleplayerState(save.saveId, refreshTeamObjectiveState(nextGameState));

  return auditLog;
}

export async function previewStandingsApply(
  params: StandingsApplyParams,
  persistence: PersistenceService = createPersistenceService(),
): Promise<StandingsApplyResult> {
  const prepared = await prepareStandingsApply(params, persistence);
  return buildResult(prepared, { applied: false, auditLogId: prepared.existingAuditLog?.id ?? null });
}

export async function executeStandingsApply(
  params: StandingsApplyParams,
  persistence: PersistenceService = createPersistenceService(),
): Promise<StandingsApplyResult> {
  const prepared = await prepareStandingsApply(
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

  if (params.confirm !== STANDINGS_APPLY_CONFIRM_TOKEN) {
    return {
      ...buildResult(prepared, { applied: false, auditLogId: null }),
      ok: false,
      canApply: false,
      blockingReasons: ["Missing explicit confirm token for execute."],
    };
  }

  const auditLog = writeLocalStandingsApply({
    persistence,
    saveId: params.saveId,
    preview: prepared.preview,
    idempotencyKey: prepared.idempotencyKey,
  });

  return {
    ...buildResult(prepared, { applied: true, auditLogId: auditLog.id }),
    ok: true,
    dryRun: false,
    canApply: true,
    blockingReasons: [],
  };
}
