import type {
  DisciplineHighlightRecord,
  DisciplineResultRecord,
  MatchdayResultRecord,
  PlayerDisciplinePerformanceRecord,
  ResultAuditLogRecord,
} from "@/lib/data/olyDataTypes";
import { loadLocalLegacyLineupContext, loadLocalLegacyLineupContextFromGameState } from "@/lib/lineups/legacy-lineup-local-service";
import { loadLegacyLineupContext, LegacyLineupContextLoader } from "@/lib/lineups/legacy-lineup-context-loader";
import type { LegacyLineupContextLoadResult, LegacyLineupLoadedContext } from "@/lib/lineups/legacy-lineup-types";
import { buildLegacyMatchdayReadiness } from "@/lib/resolve/legacy-matchday-readiness";
import { buildLegacyMatchdayResolvePreview } from "@/lib/resolve/legacy-matchday-resolve-engine";
import {
  mapLegacyMatchdayResolvePreviewToResultPayload,
  type DisciplineHighlightWritePayload,
  type DisciplineResultWritePayload,
  type LegacyMatchdayResultWriteBundle,
  type PlayerDisciplinePerformanceWritePayload,
} from "@/lib/resolve/legacy-matchday-result-mapper";
import type { ResolvePreviewStatus } from "@/lib/resolve/legacy-matchday-resolve-types";
import type { LegacyResolvePreviewOptions } from "@/lib/lineups/legacy-lineup-types";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import type { PersistenceService } from "@/lib/persistence/types";
import { db } from "@/src/server/db";
import { applyFatigueAndInjuryAfterMatchday } from "@/lib/fatigue/fatigue-injury-service";
import { refreshTeamObjectiveState } from "@/lib/board/team-season-objectives-service";

type DbClient = typeof db;

export type LegacyMatchdayApplySource = "sqlite" | "prisma";

export type LegacyMatchdayScopeParams = {
  saveId: string;
  seasonId: string;
  matchdayId: string;
};

export type ApplyLegacyMatchdayResultParams = LegacyMatchdayScopeParams & {
  source?: LegacyMatchdayApplySource;
  dryRun?: boolean;
  execute?: boolean;
  confirm?: string;
  forceReplace?: boolean;
  allowIncompleteOverride?: boolean;
  resolveOptions?: LegacyResolvePreviewOptions;
};

export type PrepareLegacyMatchdayResultApplyResult = {
  source: LegacyMatchdayApplySource;
  preview: ReturnType<typeof buildLegacyMatchdayResolvePreview>;
  readinessByTeamId: Record<
    string,
    {
      readinessStatus: "ready" | "underfilled_roster" | "missing_lineup" | "invalid_lineup" | "missing_score_coverage" | "unknown";
      reasonCodes: string[];
      shortReason: string;
    }
  >;
  writePayload: LegacyMatchdayResultWriteBundle;
  existingResultId: string | null;
  canApply: boolean;
  blockingReasons: string[];
};

type ApplyCounts = {
  matchdayResults: number;
  disciplineResults: number;
  playerPerformances: number;
  highlights: number;
  auditLogs: number;
};

export type ApplyLegacyMatchdayResultSuccess = {
  ok: true;
  source: LegacyMatchdayApplySource;
  dryRun: boolean;
  applied: boolean;
  previewStatus: ResolvePreviewStatus;
  canApply: boolean;
  blockingReasons: string[];
  matchdayResultId: string;
  teamsTotal: number;
  resultsWritten: number;
  playerPerformancesWritten: number;
  highlightsWritten: number;
  warningsCount: number;
  replacedExisting: boolean;
  counts: ApplyCounts;
  dryRunSummary: {
    saveId: string;
    seasonId: string;
    matchdayId: string;
    teams: Array<{
      teamId: string;
      teamName: string;
      status: ResolvePreviewStatus;
      d1Score: number;
      d2Score: number;
      totalScore: number;
    }>;
    warnings: string[];
  };
};

export type ApplyLegacyMatchdayResultFailure = {
  ok: false;
  source: LegacyMatchdayApplySource;
  error: string;
  previewStatus?: ResolvePreviewStatus;
  canApply?: boolean;
  blockingReasons?: string[];
};

export type ApplyLegacyMatchdayResultResult =
  | ApplyLegacyMatchdayResultSuccess
  | ApplyLegacyMatchdayResultFailure;

type ContextLoaderLike = Pick<LegacyLineupContextLoader, "loadLegacyLineupContext">;
type LocalContextLoaderLike = (params: LegacyMatchdayScopeParams & { teamId: string }) => LegacyLineupContextLoadResult;

const APPLY_CONFIRM_TOKEN = "APPLY_MATCHDAY_RESULT";
const FATIGUE_INJURY_ENABLED = process.env.OLY_ENABLE_INJURIES === "1";

function buildResultId(saveId: string, seasonId: string, matchdayId: string) {
  return `matchday-result__${saveId}__${seasonId}__${matchdayId}`;
}

function buildAuditLogId(
  saveId: string,
  seasonId: string,
  matchdayId: string,
  action: string,
) {
  return `result-audit__${saveId}__${seasonId}__${matchdayId}__${action}__${Date.now()}`;
}

function normalizeSource(source?: string): LegacyMatchdayApplySource {
  return source === "prisma" ? "prisma" : "sqlite";
}

function resolveLocalSave(persistence: PersistenceService, saveId: string) {
  const save = persistence.getSaveById(saveId);
  if (!save) {
    throw new Error(`Requested local save ${saveId} could not be loaded.`);
  }

  return save;
}

async function loadAllContextsForPrisma(
  client: DbClient,
  params: LegacyMatchdayScopeParams,
  loader: ContextLoaderLike,
): Promise<LegacyLineupLoadedContext[]> {
  const states = await client.teamSeasonState.findMany({
    where: {
      saveId: params.saveId,
      seasonId: params.seasonId,
    },
    include: {
      team: true,
    },
    orderBy: [{ teamId: "asc" }],
  });

  const contexts: LegacyLineupLoadedContext[] = [];

  for (const state of states) {
    const result = await loader.loadLegacyLineupContext({
      saveId: params.saveId,
      seasonId: params.seasonId,
      matchdayId: params.matchdayId,
      teamId: state.teamId,
    });

    if (!result.ok) {
      throw new Error(
        `Failed to load legacy lineup context for team ${state.teamId}: ${result.errors.join(" | ")}`,
      );
    }

    contexts.push(result.context);
  }

  return contexts;
}

function loadAllContextsForSqlite(
  params: LegacyMatchdayScopeParams,
  persistence: PersistenceService,
  localLoader: LocalContextLoaderLike,
): LegacyLineupLoadedContext[] {
  const save = resolveLocalSave(persistence, params.saveId);
  const contexts: LegacyLineupLoadedContext[] = [];

  for (const team of [...save.gameState.teams].sort((left, right) => left.teamId.localeCompare(right.teamId))) {
    const result =
      localLoader === loadLocalLegacyLineupContext
        ? loadLocalLegacyLineupContextFromGameState(save.gameState, {
            saveId: save.saveId,
            seasonId: params.seasonId,
            matchdayId: params.matchdayId,
            teamId: team.teamId,
          })
        : localLoader({
            saveId: save.saveId,
            seasonId: params.seasonId,
            matchdayId: params.matchdayId,
            teamId: team.teamId,
          });

    if (!result.ok) {
      throw new Error(
        `Failed to load local legacy lineup context for team ${team.teamId}: ${result.errors.join(" | ")}`,
      );
    }

    contexts.push(result.context);
  }

  return contexts;
}

function buildBlockingReasons(input: {
  previewStatus: ResolvePreviewStatus;
  hasExistingResult: boolean;
  forceReplace: boolean;
  allowIncompleteOverride: boolean;
  source: LegacyMatchdayApplySource;
}) {
  const reasons: string[] = [];

  if (input.source === "prisma") {
    reasons.push("Prisma/Supabase mode is read-only. Result Apply is only allowed in the local SQLite test save.");
    return reasons;
  }

  if (input.hasExistingResult && !input.forceReplace) {
    reasons.push("A result for this save, season and matchday already exists. Use forceReplace for a controlled replace.");
  }

  switch (input.previewStatus) {
    case "ready":
      return reasons;
    case "incomplete_lineups":
      if (!input.allowIncompleteOverride) {
        reasons.push("Preview is incomplete. Fix the missing lineup slots first or use the explicit incomplete override.");
      }
      return reasons;
    case "missing_lineups":
      reasons.push("Preview has missing lineups. Result Apply is blocked.");
      return reasons;
    case "missing_scores":
      reasons.push("Preview has missing score coverage. Result Apply is blocked.");
      return reasons;
    case "missing_sources":
      reasons.push("Preview still has missing sources. Result Apply is blocked until the preview is fully sourced.");
      return reasons;
    case "blocked":
      reasons.push("Preview is blocked and cannot be applied.");
      return reasons;
    default:
      reasons.push("Preview state is unknown and cannot be applied safely.");
      return reasons;
  }
}

function mapMatchdayResultRecord(
  payload: LegacyMatchdayResultWriteBundle["matchdayResultPayload"],
  now: string,
  existing?: MatchdayResultRecord | null,
): MatchdayResultRecord {
  return {
    ...payload,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

function mapDisciplineResultRecord(payload: DisciplineResultWritePayload, now: string): DisciplineResultRecord {
  return {
    ...payload,
    createdAt: now,
  };
}

function mapPlayerPerformanceRecord(
  payload: PlayerDisciplinePerformanceWritePayload,
  now: string,
): PlayerDisciplinePerformanceRecord {
  return {
    ...payload,
    createdAt: now,
  };
}

function mapHighlightRecord(payload: DisciplineHighlightWritePayload, now: string): DisciplineHighlightRecord {
  return {
    ...payload,
    createdAt: now,
  };
}

function mapAuditRecord(
  payload: LegacyMatchdayResultWriteBundle["auditPayload"],
  now: string,
  params: LegacyMatchdayScopeParams & { action: string; forceReplace: boolean; replacedExistingResultId: string | null },
): ResultAuditLogRecord {
  return {
    ...payload,
    id: buildAuditLogId(params.saveId, params.seasonId, params.matchdayId, params.action),
    action: params.action,
    payload: {
      ...payload.payload,
      forceReplace: params.forceReplace,
      replacedExistingResultId: params.replacedExistingResultId,
    },
    createdAt: now,
  };
}

export async function prepareLegacyMatchdayResultApply(
  params: LegacyMatchdayScopeParams & {
    source?: LegacyMatchdayApplySource;
    forceReplace?: boolean;
    allowIncompleteOverride?: boolean;
  },
  options?: {
    client?: DbClient;
    loader?: ContextLoaderLike;
    localLoader?: LocalContextLoaderLike;
    sourceVersion?: string;
    persistence?: PersistenceService;
    resolveOptions?: LegacyResolvePreviewOptions;
  },
): Promise<PrepareLegacyMatchdayResultApplyResult> {
  const source = normalizeSource(params.source);
  const client = options?.client ?? db;
  const loader =
    options?.loader ??
    ({
      loadLegacyLineupContext,
    } satisfies ContextLoaderLike);
  const localLoader = options?.localLoader ?? loadLocalLegacyLineupContext;
  const persistence = options?.persistence ?? createPersistenceService();

  const contexts =
    source === "prisma"
      ? await loadAllContextsForPrisma(client, params, loader)
      : loadAllContextsForSqlite(params, persistence, localLoader);
  const preview = buildLegacyMatchdayResolvePreview(contexts, options?.resolveOptions);

  const readinessEntries = contexts.map((context) => {
    const readiness = buildLegacyMatchdayReadiness(context);
    return [context.team.id, readiness] as const;
  });

  const readinessByTeamId = Object.fromEntries(
    readinessEntries.map(([teamId, readiness]) => [
      teamId,
      {
        readinessStatus: readiness.readinessStatus,
        reasonCodes: readiness.reasonCodes,
        shortReason: readiness.shortReason,
      },
    ]),
  );

  const writePayload = mapLegacyMatchdayResolvePreviewToResultPayload({
    preview,
    sourceVersion: options?.sourceVersion ?? "legacy-resolve-preview-v1",
    readinessByTeamId,
  });

  const existingResultId =
    source === "sqlite"
      ? (
          resolveLocalSave(persistence, params.saveId).gameState.seasonState.matchdayResults ?? []
        ).find(
          (result) =>
            result.saveId === params.saveId &&
            result.seasonId === params.seasonId &&
            result.matchdayId === params.matchdayId,
        )?.id ?? null
      : (
          await client.matchdayResult.findUnique({
            where: {
              saveId_seasonId_matchdayId: {
                saveId: params.saveId,
                seasonId: params.seasonId,
                matchdayId: params.matchdayId,
              },
            },
            select: { id: true },
          })
        )?.id ?? null;

  const blockingReasons = buildBlockingReasons({
    previewStatus: preview.status,
    hasExistingResult: Boolean(existingResultId),
    forceReplace: Boolean(params.forceReplace),
    allowIncompleteOverride: Boolean(params.allowIncompleteOverride),
    source,
  });

  return {
    source,
    preview,
    readinessByTeamId,
    writePayload,
    existingResultId,
    canApply: blockingReasons.length === 0,
    blockingReasons,
  };
}

export class LegacyMatchdayResultApplyService {
  constructor(
    private readonly client: DbClient = db,
    private readonly loader: ContextLoaderLike = new LegacyLineupContextLoader(),
    private readonly persistence: PersistenceService = createPersistenceService(),
    private readonly localLoader: LocalContextLoaderLike = loadLocalLegacyLineupContext,
  ) {}

  async applyLegacyMatchdayResult(
    params: ApplyLegacyMatchdayResultParams,
  ): Promise<ApplyLegacyMatchdayResultResult> {
    const source = normalizeSource(params.source);
    const dryRun = params.execute ? false : params.dryRun ?? true;

    if (source === "prisma") {
      return {
        ok: false,
        source,
        error: "Prisma/Supabase mode is read-only. Result Apply is only allowed in the local SQLite test save.",
        canApply: false,
        blockingReasons: ["Prisma/Supabase mode is read-only. Result Apply is only allowed in the local SQLite test save."],
      };
    }

    const prepared = await prepareLegacyMatchdayResultApply(
      {
        saveId: params.saveId,
        seasonId: params.seasonId,
        matchdayId: params.matchdayId,
        source,
        forceReplace: params.forceReplace,
        allowIncompleteOverride: params.allowIncompleteOverride,
      },
      {
        client: this.client,
        loader: this.loader,
        persistence: this.persistence,
        localLoader: this.localLoader,
        resolveOptions: params.resolveOptions,
      },
    );

    if (prepared.blockingReasons.length > 0) {
      return {
        ok: false,
        source,
        error: prepared.blockingReasons[0] ?? "Result Apply is blocked.",
        previewStatus: prepared.preview.status,
        canApply: false,
        blockingReasons: prepared.blockingReasons,
      };
    }

    if (!dryRun && params.confirm !== APPLY_CONFIRM_TOKEN) {
      return {
        ok: false,
        source,
        error: "Result Apply execute requires explicit confirmation.",
        previewStatus: prepared.preview.status,
        canApply: false,
        blockingReasons: ["Missing explicit confirm token for execute."],
      };
    }

    const targetResultId = buildResultId(params.saveId, params.seasonId, params.matchdayId);
    const counts: ApplyCounts = {
      matchdayResults: 1,
      disciplineResults: prepared.writePayload.disciplineResultPayloads.length,
      playerPerformances: prepared.writePayload.playerPerformancePayloads.length,
      highlights: prepared.writePayload.highlightPayloads.length,
      auditLogs: 1,
    };
    const dryRunSummary = {
      saveId: params.saveId,
      seasonId: params.seasonId,
      matchdayId: params.matchdayId,
      teams: prepared.preview.teamResults.map((team) => ({
        teamId: team.teamId,
        teamName: team.teamName,
        status: team.status,
        d1Score: team.d1Score,
        d2Score: team.d2Score,
        totalScore: team.totalScore,
      })),
      warnings: prepared.preview.warnings,
    };

    if (dryRun) {
      return {
        ok: true,
        source,
        dryRun: true,
        applied: false,
        previewStatus: prepared.preview.status,
        canApply: true,
        blockingReasons: [],
        matchdayResultId: prepared.existingResultId ?? targetResultId,
        teamsTotal: prepared.writePayload.matchdayResultPayload.teamsTotal,
        resultsWritten: counts.disciplineResults,
        playerPerformancesWritten: counts.playerPerformances,
        highlightsWritten: counts.highlights,
        warningsCount: prepared.writePayload.matchdayResultPayload.warningsCount,
        replacedExisting: Boolean(prepared.existingResultId),
        counts,
        dryRunSummary,
      };
    }

    const save = resolveLocalSave(this.persistence, params.saveId);
    const now = new Date().toISOString();
    const existingResult =
      (save.gameState.seasonState.matchdayResults ?? []).find(
        (result) =>
          result.saveId === params.saveId &&
          result.seasonId === params.seasonId &&
          result.matchdayId === params.matchdayId,
      ) ?? null;
    const matchdayResultId = existingResult?.id ?? targetResultId;
    const action = existingResult ? "replace_apply" : "apply";

    const nextMatchdayResult = mapMatchdayResultRecord(
      {
        ...prepared.writePayload.matchdayResultPayload,
        id: matchdayResultId,
      },
      now,
      existingResult,
    );

    const nextDisciplineResults = prepared.writePayload.disciplineResultPayloads.map((payload) =>
      mapDisciplineResultRecord(
        {
          ...payload,
          matchdayResultId,
        },
        now,
      ),
    );
    const nextPlayerPerformances = prepared.writePayload.playerPerformancePayloads.map((payload) =>
      mapPlayerPerformanceRecord(
        {
          ...payload,
          matchdayResultId,
        },
        now,
      ),
    );
    const nextHighlights = prepared.writePayload.highlightPayloads.map((payload) =>
      mapHighlightRecord(
        {
          ...payload,
          matchdayResultId,
        },
        now,
      ),
    );
    const nextAuditLog = mapAuditRecord(
      {
        ...prepared.writePayload.auditPayload,
        matchdayResultId,
      },
      now,
      {
        saveId: params.saveId,
        seasonId: params.seasonId,
        matchdayId: params.matchdayId,
        action,
        forceReplace: Boolean(params.forceReplace),
        replacedExistingResultId: existingResult?.id ?? null,
      },
    );

    const seasonState = save.gameState.seasonState;
    const nextGameState = {
      ...save.gameState,
      seasonState: {
        ...seasonState,
        matchdayResults: [
          ...(seasonState.matchdayResults ?? []).filter((result) => result.id !== matchdayResultId),
          nextMatchdayResult,
        ],
        disciplineResults: [
          ...(seasonState.disciplineResults ?? []).filter(
            (result) => result.matchdayResultId !== matchdayResultId,
          ),
          ...nextDisciplineResults,
        ],
        playerDisciplinePerformances: [
          ...(seasonState.playerDisciplinePerformances ?? []).filter(
            (result) => result.matchdayResultId !== matchdayResultId,
          ),
          ...nextPlayerPerformances,
        ],
        disciplineHighlights: [
          ...(seasonState.disciplineHighlights ?? []).filter(
            (result) => result.matchdayResultId !== matchdayResultId,
          ),
          ...nextHighlights,
        ],
        resultAuditLogs: [...(seasonState.resultAuditLogs ?? []), nextAuditLog],
      },
    };

    const injuryResult = FATIGUE_INJURY_ENABLED
      ? applyFatigueAndInjuryAfterMatchday({
          gameState: nextGameState,
          saveId: params.saveId,
          seasonId: params.seasonId,
          matchdayId: params.matchdayId,
          matchdayResultId,
          timestamp: now,
        })
      : { gameState: nextGameState, injuryEvents: [] };

    this.persistence.saveSingleplayerState(save.saveId, refreshTeamObjectiveState(injuryResult.gameState));

    return {
      ok: true,
      source,
      dryRun: false,
      applied: true,
      previewStatus: prepared.preview.status,
      canApply: true,
      blockingReasons: [],
      matchdayResultId,
      teamsTotal: prepared.writePayload.matchdayResultPayload.teamsTotal,
      resultsWritten: counts.disciplineResults,
      playerPerformancesWritten: counts.playerPerformances,
      highlightsWritten: counts.highlights,
      warningsCount: prepared.writePayload.matchdayResultPayload.warningsCount + injuryResult.injuryEvents.filter((event) => event.result === "injured").length,
      replacedExisting: Boolean(existingResult),
      counts,
      dryRunSummary,
    };
  }
}

export { APPLY_CONFIRM_TOKEN };
