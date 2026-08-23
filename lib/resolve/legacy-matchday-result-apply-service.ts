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
import {
  buildLegacyMatchdayResolvePreview,
  getResolveStatusForSides,
} from "@/lib/resolve/legacy-matchday-resolve-engine";
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
import { applyFatigueAndInjuryAfterMatchday, attachMatchdayInjuryPerformanceToContexts, buildMatchdayInjuryRollMap } from "@/lib/fatigue/fatigue-injury-service";
import { accumulateMatchdayTrainingProgress } from "@/lib/training/matchday-training-accumulator";
import { refreshTeamObjectiveState } from "@/lib/board/team-season-objectives-service";
import { persistGameStateWithMaterializedDerivations } from "@/lib/foundation/materialize-season-derivations";
import {
  markMatchdayResolveSnapshotAsBooked,
  resolveMatchdayPreviewToBook,
} from "@/lib/foundation/matchday-resolve-snapshot";
import { ensureSeasonApronLinesFrozen } from "@/lib/season/apron-settlement-service";

type DbClient = typeof db;

export type LegacyMatchdayApplySource = "sqlite" | "prisma";

export type LegacyMatchdayScopeParams = {
  saveId: string;
  seasonId: string;
  matchdayId: string;
};

/**
 * Bis zu welcher Disziplin-Seite das Ergebnis geschrieben wird. Die Arena bucht pro
 * Disziplin: nach D1 steht `"d1"` (nur die D1-Zeilen landen im Save, der Saisonstand
 * zeigt einen halben Spieltag), nach D2 steht `"d2"` und der Spieltag ist vollstaendig.
 * `"d2"` ist der Vollumfang und damit das Verhalten aller Aufrufer von vorher.
 */
export type LegacyMatchdayCommitThroughSide = "d1" | "d2";

const COMMIT_SIDE_ORDER: Record<LegacyMatchdayCommitThroughSide, number> = { d1: 0, d2: 1 };

function isSideIncluded(side: "d1" | "d2", commitThroughSide: LegacyMatchdayCommitThroughSide) {
  return COMMIT_SIDE_ORDER[side] <= COMMIT_SIDE_ORDER[commitThroughSide];
}

export type ApplyLegacyMatchdayResultParams = LegacyMatchdayScopeParams & {
  source?: LegacyMatchdayApplySource;
  dryRun?: boolean;
  execute?: boolean;
  confirm?: string;
  forceReplace?: boolean;
  allowIncompleteOverride?: boolean;
  commitThroughSide?: LegacyMatchdayCommitThroughSide;
  resolveOptions?: LegacyResolvePreviewOptions;
  preloadedContexts?: LegacyLineupLoadedContext[];
  preloadedPreview?: ReturnType<typeof buildLegacyMatchdayResolvePreview>;
};

export type PrepareLegacyMatchdayResultApplyResult = {
  source: LegacyMatchdayApplySource;
  preview: ReturnType<typeof buildLegacyMatchdayResolvePreview>;
  /**
   * Woher die gebuchten Zahlen stammen: `snapshot` = die Vorberechnung, die auch die Arena
   * bucht; `live` = frisch gerechnet, weil keine gueltige Vorberechnung vorlag. Beide
   * Buchungswege gehen durch dieselbe Auswahl (`resolveMatchdayPreviewToBook`).
   */
  previewSource: "snapshot" | "live";
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
  performanceBreakdown?: {
    contextLoadMs: number;
    resolvePreviewMs: number;
    lineupValidationMs: number;
    playerPerformanceAggregationMs: number;
    existingLookupMs: number;
    totalMs: number;
  };
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
  performanceBreakdown?: {
    contextLoadMs: number;
    resolvePreviewMs: number;
    lineupValidationMs: number;
    playerPerformanceAggregationMs: number;
    existingLookupMs: number;
    recordMapMs: number;
    standingsObjectiveRefreshMs: number;
    saveWriteMs: number;
    totalMs: number;
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

function elapsedSince(startedAt: number) {
  return Math.max(0, Math.round(performance.now() - startedAt));
}

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

/**
 * DER RIEGEL GEGEN DEN LEEREN SPIELTAG — als reine Funktion, damit er ohne den kompletten
 * Apply-Aufbau geprueft werden kann.
 *
 * `writtenDisciplineRows` ist die Zahl der Zeilen, die DIESER Aufruf wirklich schreibt: die
 * nicht eingefrorenen Seiten. Bei der gestaffelten Buchung (D1 liegt, D2 kommt) sind das genau
 * die D2-Zeilen — die bereits gebuchte D1 zaehlt bewusst nicht mit, sonst koennte ein leerer
 * D2-Commit sich hinter den D1-Zeilen verstecken.
 */
export function buildEmptyDisciplineRowBlocker(input: {
  matchdayId: string;
  writtenDisciplineRows: number;
  isStagedContinuation: boolean;
}): string | null {
  if (input.writtenDisciplineRows > 0) {
    return null;
  }
  return input.isStagedContinuation
    ? `Keine wertbare Disziplin-Zeile fuer die offene Seite von ${input.matchdayId}. Der Spieltag wird nicht als gebucht vermerkt.`
    : `Keine wertbare Disziplin-Zeile fuer ${input.matchdayId}. Der Spieltag wird nicht als gebucht vermerkt.`;
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
    preloadedContexts?: LegacyLineupLoadedContext[];
    preloadedPreview?: ReturnType<typeof buildLegacyMatchdayResolvePreview>;
  },
): Promise<PrepareLegacyMatchdayResultApplyResult> {
  const totalStartedAt = performance.now();
  const source = normalizeSource(params.source);
  const client = options?.client ?? db;
  const loader =
    options?.loader ??
    ({
      loadLegacyLineupContext,
    } satisfies ContextLoaderLike);
  const localLoader = options?.localLoader ?? loadLocalLegacyLineupContext;
  const persistence = options?.persistence ?? createPersistenceService();

  const contextStartedAt = performance.now();
  const contexts =
    options?.preloadedContexts ??
    (source === "prisma"
      ? await loadAllContextsForPrisma(client, params, loader)
      : loadAllContextsForSqlite(params, persistence, localLoader));
  const contextLoadMs = elapsedSince(contextStartedAt);
  const localSave = source === "sqlite" ? resolveLocalSave(persistence, params.saveId) : null;
  if (localSave) {
    // Idempotenz unter forceReplace: existiert bereits ein Ergebnis, trägt der Save die
    // NACH-Spieltags-Fatigue -> Roll-Map muss den Vor-Spieltags-Stand rekonstruieren, damit
    // die Injury-Performance-Multiplikatoren (und damit die Vorschau-Scores) beim Re-Apply
    // identisch zum ersten Apply bleiben.
    const hasExistingResultForReplay = (localSave.gameState.seasonState.matchdayResults ?? []).some(
      (result) =>
        result.saveId === params.saveId &&
        result.seasonId === params.seasonId &&
        result.matchdayId === params.matchdayId,
    );
    const injuryRollMap = buildMatchdayInjuryRollMap({
      gameState: localSave.gameState,
      saveId: params.saveId,
      seasonId: params.seasonId,
      matchdayId: params.matchdayId,
      isMatchdayReplay: hasExistingResultForReplay,
    });
    attachMatchdayInjuryPerformanceToContexts(contexts, injuryRollMap);
  }
  const resolveStartedAt = performance.now();
  /**
   * EINE RECHENSTELLE FUER DEN SPIELTAG — die der Arena.
   *
   * Bis hierher rechnete dieser Pfad (Cockpit, `/api/resolve/legacy-matchday-apply`) beim
   * Buchen frisch, waehrend der Arena-Weg (`matchday-auto-run-service`) die Vorberechnung
   * buchte. Beide Wege stehen dem Spieler offen und lieferten fuer denselben Spieltag
   * verschiedene Zahlen — gemessen am Live-Abbild bis 52,5 Punkte Score und 33 vertauschte
   * Raenge auf 64 Zeilen (Belege in `resolveMatchdayPreviewToBook`).
   *
   * Jetzt fragen beide dieselbe Stelle. Gibt es keine gueltige Vorberechnung, faellt sie fuer
   * beide gleichermassen auf das frisch gerechnete Ergebnis zurueck. Eine mitgelieferte
   * `preloadedPreview` (Arena/Auto-Run, der die Auswahl schon getroffen hat) sticht wie bisher.
   */
  const livePreview = options?.preloadedPreview ?? buildLegacyMatchdayResolvePreview(contexts, options?.resolveOptions);
  const previewToBook =
    options?.preloadedPreview || !localSave
      ? { preview: livePreview, source: "live" as const }
      : resolveMatchdayPreviewToBook({
          gameState: localSave.gameState,
          scope: { saveId: params.saveId, seasonId: params.seasonId, matchdayId: params.matchdayId },
          livePreview,
        });
  const preview = previewToBook.preview;
  const resolvePreviewMs = elapsedSince(resolveStartedAt);

  const readinessStartedAt = performance.now();
  const readinessEntries = contexts.map((context) => {
    const readiness = buildLegacyMatchdayReadiness(context);
    return [context.team.id, readiness] as const;
  });
  const lineupValidationMs = elapsedSince(readinessStartedAt);

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

  const payloadStartedAt = performance.now();
  const writePayload = mapLegacyMatchdayResolvePreviewToResultPayload({
    preview,
    sourceVersion: options?.sourceVersion ?? "legacy-resolve-preview-v1",
    readinessByTeamId,
  });
  const playerPerformanceAggregationMs = elapsedSince(payloadStartedAt);

  const existingStartedAt = performance.now();
  const existingResultId =
    localSave
      ? (
          localSave.gameState.seasonState.matchdayResults ?? []
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
  const existingLookupMs = elapsedSince(existingStartedAt);

  // Bereits gebuchte Seiten werden beim Schreiben eingefroren (`frozenSides` weiter unten) — ihr
  // neu gerechnetes Ergebnis landet nie im Spielstand. Sie duerfen die noch offene Seite deshalb
  // auch nicht blockieren: Chris' Spieltag 4 kippte an der verworfenen D1-Rechnung auf
  // `missing_scores`, und D2 war damit unbuchbar. Nur die Seiten, die dieser Lauf wirklich
  // schreibt, entscheiden ueber die Freigabe.
  //
  // Eng gefuehrt, und zwar dreifach: nur im lokalen Pfad (nur dort gibt es das Einfrieren),
  // nur wenn ueberhaupt schon eine Seite gebucht ist, und nur solange eine Seite offen ist.
  // Ein voller Re-Apply (beide Seiten liegen vor) prueft weiterhin alles.
  const committedSides = new Set<"d1" | "d2">(
    localSave && existingResultId
      ? (localSave.gameState.seasonState.disciplineResults ?? [])
          .filter((entry) => entry.matchdayResultId === existingResultId)
          .map((entry) => entry.disciplineSide)
      : [],
  );
  const openSides = new Set<"d1" | "d2">((["d1", "d2"] as const).filter((side) => !committedSides.has(side)));
  const gatingPreviewStatus =
    committedSides.size > 0 && openSides.size > 0 ? getResolveStatusForSides(preview, openSides) : preview.status;

  const blockingReasons = buildBlockingReasons({
    previewStatus: gatingPreviewStatus,
    hasExistingResult: Boolean(existingResultId),
    forceReplace: Boolean(params.forceReplace),
    allowIncompleteOverride: Boolean(params.allowIncompleteOverride),
    source,
  });

  return {
    source,
    preview,
    previewSource: previewToBook.source,
    readinessByTeamId,
    writePayload,
    existingResultId,
    canApply: blockingReasons.length === 0,
    blockingReasons,
    performanceBreakdown: {
      contextLoadMs,
      resolvePreviewMs,
      lineupValidationMs,
      playerPerformanceAggregationMs,
      existingLookupMs,
      totalMs: elapsedSince(totalStartedAt),
    },
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
    const totalStartedAt = performance.now();
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
        preloadedContexts: params.preloadedContexts,
        preloadedPreview: params.preloadedPreview,
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

    // Teil-Buchung der Arena: Nach D1 duerfen NUR die D1-Zeilen in den Save. Der
    // Standings-Preview leitet die Punkte aus genau diesen Zeilen ab, ein halber
    // Spieltag ergibt damit von selbst einen halben Punktestand — und D2 bleibt
    // ungespoilert. Der D2-Commit schreibt spaeter beide Seiten (replace_apply).
    const commitThroughSide: LegacyMatchdayCommitThroughSide = params.commitThroughSide ?? "d2";
    const isPartialCommit = commitThroughSide !== "d2";
    const committedDisciplineIds = new Set(
      prepared.writePayload.disciplineResultPayloads
        .filter((payload) => isSideIncluded(payload.disciplineSide, commitThroughSide))
        .map((payload) => payload.disciplineId),
    );
    const writePayload = isPartialCommit
      ? {
          ...prepared.writePayload,
          disciplineResultPayloads: prepared.writePayload.disciplineResultPayloads.filter((payload) =>
            isSideIncluded(payload.disciplineSide, commitThroughSide),
          ),
          playerPerformancePayloads: prepared.writePayload.playerPerformancePayloads.filter((payload) =>
            isSideIncluded(payload.disciplineSide, commitThroughSide),
          ),
          // Highlights ohne Disziplin-Bezug (z. B. spieltagsweite Storylines) sind erst
          // mit dem vollstaendigen Spieltag aussagekraeftig und warten auf den D2-Commit.
          highlightPayloads: prepared.writePayload.highlightPayloads.filter((payload) =>
            payload.disciplineId ? committedDisciplineIds.has(payload.disciplineId) : false,
          ),
        }
      : prepared.writePayload;

    const counts: ApplyCounts = {
      matchdayResults: 1,
      disciplineResults: writePayload.disciplineResultPayloads.length,
      playerPerformances: writePayload.playerPerformancePayloads.length,
      highlights: writePayload.highlightPayloads.length,
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
        performanceBreakdown: {
          contextLoadMs: prepared.performanceBreakdown?.contextLoadMs ?? 0,
          resolvePreviewMs: prepared.performanceBreakdown?.resolvePreviewMs ?? 0,
          lineupValidationMs: prepared.performanceBreakdown?.lineupValidationMs ?? 0,
          playerPerformanceAggregationMs: prepared.performanceBreakdown?.playerPerformanceAggregationMs ?? 0,
          existingLookupMs: prepared.performanceBreakdown?.existingLookupMs ?? 0,
          recordMapMs: 0,
          standingsObjectiveRefreshMs: 0,
          saveWriteMs: 0,
          totalMs: elapsedSince(totalStartedAt),
        },
      };
    }

    const recordMapStartedAt = performance.now();
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

    // Sicherheitsnetz fuer den Fall OHNE vorberechneten Spieltag: Bereits gebuchte
    // Disziplin-Seiten sind eingefroren. Der Resolve ist ueber zwei Laeufe NICHT
    // bitgleich — der erste Apply schreibt die Nach-Spieltags-Fatigue, und deren
    // Rekonstruktion beim Replay trifft den Vor-Spieltags-Stand nicht exakt; ohne das
    // Einfrieren verschoebe der D2-Commit die D1-Raenge nachtraeglich.
    // Im Normalfall greift das nicht mehr: Liegt der Snapshot vor, lesen beide Commits
    // ohnehin aus derselben Rechnung, und es gibt nichts zu korrigieren. Verifiziert —
    // die Gleichheit von Buehne und Buchung haelt auch mit abgeschaltetem Einfrieren.
    // Nur die gestaffelte Buchung friert ein: Ein normaler Voll-Re-Apply (alle Seiten
    // liegen bereits vor) soll wie bisher alles neu rechnen.
    const existingSides = new Set(
      (save.gameState.seasonState.disciplineResults ?? [])
        .filter((entry) => entry.matchdayResultId === matchdayResultId)
        .map((entry) => entry.disciplineSide),
    );
    const incomingSides = new Set(writePayload.disciplineResultPayloads.map((payload) => payload.disciplineSide));
    const isStagedContinuation =
      existingSides.size > 0 && [...incomingSides].some((side) => !existingSides.has(side));
    const frozenSides = isStagedContinuation ? existingSides : new Set<"d1" | "d2">();

    /**
     * EIN SPIELTAG OHNE EINE EINZIGE GEWERTETE ZEILE IST KEIN GEBUCHTER SPIELTAG.
     *
     * Bis hierher entschied allein der Vorschau-Status (`buildBlockingReasons` oben), ob gebucht
     * werden darf — WIE VIELE Zeilen dabei entstehen, ging in keine Bedingung ein. Ein Apply,
     * der null Disziplin-Zeilen schreibt, meldete deshalb `ok: true, applied: true`, und die
     * Oberflaeche sagte „im Saisonstand", waehrend im Save nichts stand.
     *
     * Aufgefallen ist das am Trockenlauf der Saison-Simulation: dort kam je Spieltag
     * `resolvedTeams: 32, blockers: []` zurueck, bei `disciplineRows: 0`. Das Skript hat seither
     * eine eigene Zusicherung — aber sie half nur dem Skript. Jeder andere Aufrufer, auch der
     * Spieltagslauf im Spiel, bekam weiterhin ein `applied: true` fuer nichts.
     *
     * GEZAEHLT WIRD, WAS DIESER AUFRUF WIRKLICH SCHREIBT: die nicht eingefrorenen Seiten. Bei
     * der gestaffelten Buchung (D1 liegt, D2 kommt) sind das genau die D2-Zeilen — die bereits
     * gebuchte D1 zaehlt bewusst NICHT mit, sonst koennte ein leerer D2-Commit sich hinter den
     * D1-Zeilen verstecken.
     */
    const neueDisziplinZeilen = writePayload.disciplineResultPayloads.filter(
      (payload) => !frozenSides.has(payload.disciplineSide),
    ).length;
    const leerlaufGrund = buildEmptyDisciplineRowBlocker({
      matchdayId: params.matchdayId,
      writtenDisciplineRows: neueDisziplinZeilen,
      isStagedContinuation,
    });
    if (leerlaufGrund) {
      const grund = leerlaufGrund;
      return {
        ok: false,
        source,
        error: grund,
        previewStatus: prepared.preview.status,
        canApply: false,
        blockingReasons: [grund],
      };
    }

    const frozenDisciplineResults = isStagedContinuation
      ? (save.gameState.seasonState.disciplineResults ?? []).filter(
          (entry) => entry.matchdayResultId === matchdayResultId && frozenSides.has(entry.disciplineSide),
        )
      : [];
    const nextDisciplineResults = [
      ...frozenDisciplineResults,
      ...writePayload.disciplineResultPayloads
        .filter((payload) => !frozenSides.has(payload.disciplineSide))
        .map((payload) =>
          mapDisciplineResultRecord(
            {
              ...payload,
              matchdayResultId,
            },
            now,
          ),
        ),
    ];
    const nextPlayerPerformances = [
      ...(isStagedContinuation
        ? (save.gameState.seasonState.playerDisciplinePerformances ?? []).filter(
            (entry) => entry.matchdayResultId === matchdayResultId && frozenSides.has(entry.disciplineSide),
          )
        : []),
      ...writePayload.playerPerformancePayloads
        .filter((payload) => !frozenSides.has(payload.disciplineSide))
        .map((payload) =>
          mapPlayerPerformanceRecord(
            {
              ...payload,
              matchdayResultId,
            },
            now,
          ),
        ),
    ];
    // Highlights haengen an der Disziplin, nicht an der Seite — die eingefrorenen
    // Disziplinen kommen aus den eingefrorenen Ergebniszeilen.
    const frozenDisciplineIds = new Set(frozenDisciplineResults.map((entry) => entry.disciplineId));
    const nextHighlights = [
      ...(isStagedContinuation
        ? (save.gameState.seasonState.disciplineHighlights ?? []).filter(
            (entry) =>
              entry.matchdayResultId === matchdayResultId &&
              entry.disciplineId != null &&
              frozenDisciplineIds.has(entry.disciplineId),
          )
        : []),
      ...writePayload.highlightPayloads
        .filter((payload) => !(payload.disciplineId != null && frozenDisciplineIds.has(payload.disciplineId)))
        .map((payload) =>
          mapHighlightRecord(
            {
              ...payload,
              matchdayResultId,
            },
            now,
          ),
        ),
    ];
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

    /**
     * HIER RASTEN DIE APRON-LINIEN EIN. Bis zu diesem Punkt wandern sie mit dem Median mit (siehe
     * `resolveSeasonApronLines`), denn bis hier lief nur der Kaderbau: KI-Vorsaisonkäufe,
     * Spieler-Picks, organische Nachkäufe. Sobald der erste Spieltag abgerechnet ist, steht die
     * Grenze fest — ab dann soll niemand mehr die Linie durch eigene Käufe verschieben können.
     *
     * Der Aufruf steht bewusst VOR dem Schreiben des Ergebnisses: `ensureSeasonApronLinesFrozen`
     * führt nur nach, solange `hasSeasonBeenPlayed` falsch ist. Eine Zeile später wäre das erste
     * Ergebnis schon da und der veraltete Stand für immer festgeschrieben.
     */
    const gameStateMitLinien = ensureSeasonApronLinesFrozen(save.gameState);
    const seasonState = gameStateMitLinien.seasonState;
    const nextGameState = {
      ...gameStateMitLinien,
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
    /**
     * DIE GEBUCHTE RECHNUNG WIRD GESTEMPELT — damit die Buehne danach SIE zeigt und nicht neu
     * rechnet.
     *
     * GEMELDET VON CHRIS: Sekunden nach dem Buchen standen in der Arena andere Zahlen und
     * getauschte Plaetze (Malagor 98,8 → 92,1, S-S 14,9 → 14,2, C-S 14,4 → 14,9). Ursache: ein
     * durchgebuchter Spieltag machte die Vorberechnung ungueltig, die Arena fiel auf den
     * Live-Pfad und rechnete gegen den Zustand NACH der Buchung — mit der Nach-Spieltags-Fatigue,
     * die ein paar Zeilen weiter unten (`applyFatigueAndInjuryAfterMatchday`) genau hier
     * geschrieben wird.
     *
     * Der Stempel steht bewusst VOR dem Fatigue-Apply in derselben Kette: er haengt an dem, was
     * gebucht WURDE, nicht an dem, was danach gilt. Und er traegt `prepared.preview` — also
     * dieselbe Rechnung, aus der `nextDisciplineResults` entstanden sind, egal ob sie aus der
     * Vorberechnung kam oder live gerechnet wurde.
     */
    const nextGameStateMitBeleg = markMatchdayResolveSnapshotAsBooked({
      gameState: nextGameState,
      scope: { saveId: params.saveId, seasonId: params.seasonId, matchdayId: params.matchdayId },
      preview: prepared.preview,
      matchdayResultId,
      bookedAt: now,
    });
    const recordMapMs = elapsedSince(recordMapStartedAt);

    // Idempotenz unter forceReplace: Existiert bereits ein Ergebnis für diesen Spieltag, so
    // trägt `playerAvailabilityState` bereits die NACH-Spieltags-Fatigue aus dem ersten Apply.
    // Das Flag lässt Roll-Map und Fatigue-Apply den Vor-Spieltags-Stand rekonstruieren, damit
    // ein Re-Apply denselben Stand erzeugt (kein F + 2*Load). `existingResult` wurde aus dem
    // ORIGINAL-Save (vor dem Einfügen von `nextMatchdayResult`) ermittelt.
    const isMatchdayReplay = Boolean(existingResult);
    const injuryRollMap = buildMatchdayInjuryRollMap({
      gameState: nextGameStateMitBeleg,
      saveId: params.saveId,
      seasonId: params.seasonId,
      matchdayId: params.matchdayId,
      isMatchdayReplay,
    });
    const injuryResult = applyFatigueAndInjuryAfterMatchday({
          gameState: nextGameStateMitBeleg,
          saveId: params.saveId,
          seasonId: params.seasonId,
          matchdayId: params.matchdayId,
          matchdayResultId,
          timestamp: now,
          precomputedInjuryRolls: injuryRollMap,
          isMatchdayReplay,
          // Die Ermuedung folgt der Wertung: Nach D1 traegt nur, wer in D1 gelaufen ist.
          // Vorher stand nach dem halben Spieltag bereits die Last des ganzen im Kader.
          commitThroughSide,
        });

    // Anti-cheese Teil B (B.4): record this matchday's per-player training mode and advance the
    // per-matchday training-fatigue share AFTER the injury roll (never inside `fatigueBeforeRoll`).
    const accumulatedGameState = accumulateMatchdayTrainingProgress({
      gameState: injuryResult.gameState,
      seasonId: params.seasonId,
      matchdayId: params.matchdayId,
      // Wen die Teil-Buchung ausgelassen hat, den laesst auch die Trainings-Akkumulation aus:
      // seine `player.fatigue` steht noch auf dem Vor-Spieltags-Wert, nicht auf reiner
      // Match-Fatigue. Sonst schlaegt die Trainingsschicht bei ihm zweimal auf.
      deferredPlayerIds: injuryResult.deferredPlayerIds,
    });

    const objectiveStartedAt = performance.now();
    const refreshedGameState = refreshTeamObjectiveState(accumulatedGameState);
    const standingsObjectiveRefreshMs = elapsedSince(objectiveStartedAt);
    const saveStartedAt = performance.now();
    persistGameStateWithMaterializedDerivations(this.persistence, save.saveId, refreshedGameState);
    const saveWriteMs = elapsedSince(saveStartedAt);

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
      performanceBreakdown: {
        contextLoadMs: prepared.performanceBreakdown?.contextLoadMs ?? 0,
        resolvePreviewMs: prepared.performanceBreakdown?.resolvePreviewMs ?? 0,
        lineupValidationMs: prepared.performanceBreakdown?.lineupValidationMs ?? 0,
        playerPerformanceAggregationMs: prepared.performanceBreakdown?.playerPerformanceAggregationMs ?? 0,
        existingLookupMs: prepared.performanceBreakdown?.existingLookupMs ?? 0,
        recordMapMs,
        standingsObjectiveRefreshMs,
        saveWriteMs,
        totalMs: elapsedSince(totalStartedAt),
      },
    };
  }
}

export { APPLY_CONFIRM_TOKEN };
