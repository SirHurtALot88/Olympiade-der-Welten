import type { CashPrizeApplyLogRecord, GameState } from "@/lib/data/olyDataTypes";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import type { PersistenceService } from "@/lib/persistence/types";
import { buildPrizeMoneyPreview, type PrizeMoneyPreviewResult } from "@/lib/season/prize-money-preview";
import type { StandingsPreviewSource } from "@/lib/standings/standings-preview-engine";

export const CASH_PRIZE_APPLY_CONFIRM_TOKEN = "APPLY_LOCAL_CASH_PRIZE";

/**
 * T-032: `executeCashPrizeApply`/`previewCashPrizeApply` sind ein Debug-/Benchmark-Endpoint für die
 * Preisgeld-Berechnung — solange dieses Flag `true` ist, wird ausschließlich der Preisgeld/Sponsor-
 * Benchmark (inkl. Audit-Log `cashPrizeApplyLogs`) persistiert; Team-Cash bleibt unverändert (kein
 * echter Payout). `lib/season/economy-audit-report.ts` liest dieses Flag deshalb explizit, um einen
 * ausgeführten Benchmark-Apply NICHT als `cash_prize_apply_executed`-Verstoß zu werten. Wird dieser
 * Pfad je auf echten Cash-Payout umgestellt, muss dieses Flag auf `false` gesetzt UND der Audit-Report
 * um eine echte Payout-Prüfung erweitert werden.
 */
export const CASH_PRIZE_BENCHMARK_ONLY = true;

export type CashPrizeApplyParams = {
  saveId: string;
  seasonId: string;
  matchdayId?: string;
  source?: StandingsPreviewSource;
  phase?: "season_end" | "matchday";
  dryRun?: boolean;
  execute?: boolean;
  confirm?: string;
};

export type CashPrizeApplyPlannedChange = {
  teamId: string;
  teamCode: string;
  teamName: string;
  rank: number | null;
  points: number | null;
  oldCash: number | null;
  prizeMoney: number | null;
  rankChangePrize: number | null;
  startRank: number | null;
  rankDelta: number | null;
  newCash: number | null;
  status: string;
  warnings: string[];
};

export type CashPrizeApplyResult = {
  ok: boolean;
  source: StandingsPreviewSource;
  dryRun: boolean;
  applied: boolean;
  canApply: boolean;
  blockingReasons: string[];
  warnings: string[];
  plannedChanges: CashPrizeApplyPlannedChange[];
  scope: {
    saveId: string;
    seasonId: string;
    matchdayId: string;
  };
  idempotencyKey: string;
  duplicateDetected: boolean;
  auditLogId: string | null;
};

type PrepareCashPrizeApplyResult = {
  source: StandingsPreviewSource;
  dryRun: boolean;
  preview: PrizeMoneyPreviewResult;
  scope: {
    saveId: string;
    seasonId: string;
    matchdayId: string;
  };
  idempotencyKey: string;
  duplicateDetected: boolean;
  existingAuditLog: CashPrizeApplyLogRecord | null;
  plannedChanges: CashPrizeApplyPlannedChange[];
  blockingReasons: string[];
  warnings: string[];
};

function normalizeSource(source?: string): StandingsPreviewSource {
  return source === "prisma" ? "prisma" : "sqlite";
}

function buildIdempotencyKey(scope: { saveId: string; seasonId: string; matchdayId: string }) {
  return `cash-prize-apply:${scope.saveId}:${scope.seasonId}:${scope.matchdayId}`;
}

function buildAuditLogId(scope: { saveId: string; seasonId: string; matchdayId: string }) {
  return `cash-prize-apply-audit__${scope.saveId}__${scope.seasonId}__${scope.matchdayId}`;
}

function resolveLocalSave(persistence: PersistenceService, saveId: string) {
  const bootstrapped = persistence.bootstrapSingleplayerSave();
  const save = persistence.getSaveById(saveId) ?? persistence.getActiveSave() ?? bootstrapped.save;

  if (!save) {
    throw new Error(`Local save ${saveId} could not be loaded for cash prize apply.`);
  }

  return save;
}

function toPlannedChanges(items: PrizeMoneyPreviewResult["items"]): CashPrizeApplyPlannedChange[] {
  return items.map((item) => ({
    teamId: item.teamId,
    teamCode: item.teamCode,
    teamName: item.teamName,
    rank: item.rank,
    points: item.points,
    oldCash: item.currentCash,
    prizeMoney: item.prizeMoney,
    rankChangePrize: item.rankChangePrize?.bonusMalus ?? null,
    startRank: item.rankChangePrize?.startRank ?? null,
    rankDelta: item.rankChangePrize?.rankDelta ?? null,
    newCash: item.projectedCash,
    status: item.status,
    warnings: item.warnings,
  }));
}

function buildBlockingReasons(
  preview: PrizeMoneyPreviewResult,
  duplicateDetected: boolean,
  phase: "season_end" | "matchday",
) {
  const reasons = new Set<string>();

  if (duplicateDetected) {
    reasons.add("duplicate_apply_for_save_season_block");
  }

  if (phase === "matchday") {
    reasons.add("blockedRule:season_end_only");
  }

  for (const rule of preview.blockedRules) {
    reasons.add(`blockedRule:${rule}`);
  }

  for (const item of preview.items) {
    if (item.status !== "ready") {
      reasons.add(`${item.status}:${item.teamId}`);
    }
    if (item.projectedCash == null) {
      reasons.add(`missing_projected_cash:${item.teamId}`);
    }
  }

  return Array.from(reasons);
}

function buildWarnings(
  preview: PrizeMoneyPreviewResult,
  duplicateDetected: boolean,
  phase: "season_end" | "matchday",
) {
  const warnings = new Set<string>();

  if (duplicateDetected) {
    warnings.add("duplicate_apply_detected");
  }

  if (phase === "matchday") {
    warnings.add("season_end_only");
  }

  for (const globalWarning of preview.globalWarnings) {
    warnings.add(globalWarning);
  }

  for (const item of preview.items) {
    for (const warning of item.warnings) {
      warnings.add(`${item.teamId}:${warning}`);
    }
  }

  return Array.from(warnings);
}

async function prepareCashPrizeApply(
  params: CashPrizeApplyParams,
  persistence: PersistenceService,
): Promise<PrepareCashPrizeApplyResult> {
  const source = normalizeSource(params.source);
  const dryRun = params.execute ? false : params.dryRun ?? true;
  const phase = params.phase === "matchday" ? "matchday" : "season_end";
  const scope = {
    saveId: params.saveId,
    seasonId: params.seasonId,
    matchdayId: params.matchdayId ?? resolveLocalSave(persistence, params.saveId).gameState.matchdayState.matchdayId,
  };
  const idempotencyKey = buildIdempotencyKey(scope);

  const preview = await buildPrizeMoneyPreview(
    {
      saveId: scope.saveId,
      seasonId: scope.seasonId,
      source,
      phase: params.phase,
    },
    persistence,
  );
  const existingAuditLog =
    source === "sqlite"
      ? (resolveLocalSave(persistence, scope.saveId).gameState.seasonState.cashPrizeApplyLogs ?? []).find(
          (log) =>
            log.saveId === scope.saveId &&
            log.seasonId === scope.seasonId &&
            log.matchdayId === scope.matchdayId &&
            log.payload.idempotencyKey === idempotencyKey,
        ) ?? null
      : null;
  const duplicateDetected = existingAuditLog != null;
  const plannedChanges = toPlannedChanges(preview.items);
  const blockingReasons =
    source === "prisma"
      ? ["Prisma/Supabase mode is read-only. Cash Apply is only allowed in the local SQLite test save."]
      : buildBlockingReasons(preview, duplicateDetected, phase);
  const warnings = buildWarnings(preview, duplicateDetected, phase);

  return {
    source,
    dryRun,
    preview,
    scope,
    idempotencyKey,
    duplicateDetected,
    existingAuditLog,
    plannedChanges,
    blockingReasons,
    warnings,
  };
}

function buildResult(
  prepared: PrepareCashPrizeApplyResult,
  input: { applied: boolean; auditLogId?: string | null },
): CashPrizeApplyResult {
  return {
    ok: prepared.blockingReasons.length === 0 || input.applied,
    source: prepared.source,
    dryRun: prepared.dryRun,
    applied: input.applied,
    canApply: prepared.blockingReasons.length === 0,
    blockingReasons: prepared.blockingReasons,
    warnings: prepared.warnings,
    plannedChanges: prepared.plannedChanges,
    scope: prepared.scope,
    idempotencyKey: prepared.idempotencyKey,
    duplicateDetected: prepared.duplicateDetected,
    auditLogId: input.auditLogId ?? null,
  };
}

function writeLocalCashPrizeApply(input: {
  persistence: PersistenceService;
  saveId: string;
      preview: PrizeMoneyPreviewResult;
      idempotencyKey: string;
      matchdayId: string;
}) {
  const save = resolveLocalSave(input.persistence, input.saveId);
  const now = new Date().toISOString();
  const previewByTeamId = new Map(input.preview.items.map((item) => [item.teamId, item] as const));
  const nextTeams = save.gameState.teams;
  const nextStandings = Object.fromEntries(
    Object.entries(save.gameState.seasonState.standings ?? {}).map(([teamId, standing]) => {
      const row = previewByTeamId.get(teamId) ?? null;
      if (!row) return [teamId, standing] as const;
      const sponsorBasis = row.basisCash;
      const sponsorRank = row.rankChangePrize.bonusMalus;
      const sponsorSeason =
        row.prizeMoney != null && sponsorBasis != null ? Number((row.prizeMoney - sponsorBasis).toFixed(2)) : null;
      const sponsorTotal =
        row.prizeMoney != null ? Number((row.prizeMoney + (sponsorRank ?? 0)).toFixed(2)) : null;
      const cashFc =
        row.currentCash != null && row.salaryTotal != null ? Number((row.currentCash - row.salaryTotal).toFixed(2)) : null;
      const guv =
        sponsorTotal != null && row.salaryTotal != null ? Number((sponsorTotal - row.salaryTotal).toFixed(2)) : null;
      return [
        teamId,
        {
          ...standing,
          cashFc,
          startplatz: row.rankChangePrize.startRank,
          rankDiff: row.rankChangePrize.rankDelta,
          sponsorBasis,
          sponsorRank,
          sponsorSeason,
          sponsorTotal,
          guv,
          cashTotal: row.projectedCash,
        },
      ] as const;
    }),
  );

  const totalPrizeMoney = input.preview.items.reduce((sum, item) => sum + (item.prizeMoney ?? 0), 0);
  const auditLog: CashPrizeApplyLogRecord = {
    id: buildAuditLogId({
      saveId: input.preview.scope?.saveId ?? input.saveId,
      seasonId: input.preview.scope?.seasonId ?? "season-1",
      matchdayId: input.matchdayId,
    }),
    saveId: input.preview.scope?.saveId ?? input.saveId,
    seasonId: input.preview.scope?.seasonId ?? "season-1",
    matchdayId: input.matchdayId,
    action: "apply",
    payload: {
      idempotencyKey: input.idempotencyKey,
      totalTeams: input.preview.items.length,
      appliedTeams: input.preview.items.filter((item) => item.projectedCash != null).length,
      totalPrizeMoney: Number(totalPrizeMoney.toFixed(2)),
      benchmarkOnly: CASH_PRIZE_BENCHMARK_ONLY,
      cashPayoutApplied: !CASH_PRIZE_BENCHMARK_ONLY,
    },
    createdAt: now,
  };

  const nextGameState: GameState = {
    ...save.gameState,
    teams: nextTeams,
    seasonState: {
      ...save.gameState.seasonState,
      standings: nextStandings,
      cashPrizeApplyLogs: [...(save.gameState.seasonState.cashPrizeApplyLogs ?? []), auditLog],
    },
  };

  input.persistence.saveSingleplayerState(save.saveId, nextGameState);
  return auditLog;
}

export async function previewCashPrizeApply(
  params: CashPrizeApplyParams,
  persistence: PersistenceService = createPersistenceService(),
): Promise<CashPrizeApplyResult> {
  const prepared = await prepareCashPrizeApply(params, persistence);
  return buildResult(prepared, { applied: false, auditLogId: prepared.existingAuditLog?.id ?? null });
}

export async function executeCashPrizeApply(
  params: CashPrizeApplyParams,
  persistence: PersistenceService = createPersistenceService(),
): Promise<CashPrizeApplyResult> {
  const prepared = await prepareCashPrizeApply(
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

  if (params.confirm !== CASH_PRIZE_APPLY_CONFIRM_TOKEN) {
    return {
      ...buildResult(prepared, { applied: false, auditLogId: null }),
      ok: false,
      canApply: false,
      blockingReasons: ["Missing explicit confirm token for execute."],
    };
  }

  const auditLog = writeLocalCashPrizeApply({
    persistence,
    saveId: params.saveId,
    preview: prepared.preview,
    idempotencyKey: prepared.idempotencyKey,
    matchdayId: params.matchdayId ?? resolveLocalSave(persistence, params.saveId).gameState.matchdayState.matchdayId,
  });

  return {
    ...buildResult(prepared, { applied: true, auditLogId: auditLog.id }),
    ok: true,
    dryRun: false,
    canApply: true,
    blockingReasons: [],
  };
}
