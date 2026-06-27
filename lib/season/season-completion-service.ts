import type { CashPrizeApplyResult } from "@/lib/season/cash-prize-apply-service";
import {
  previewCashPrizeApply,
} from "@/lib/season/cash-prize-apply-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { runWithSaveRecovery } from "@/lib/persistence/atomic-save-write";
import type { PersistenceService } from "@/lib/persistence/types";
import { upsertTeamRelationshipEvents, type TeamRelationshipEventApplyResult } from "@/lib/rivalries/team-relationship-dynamics";
import { buildSeasonAiLineupAudit, type SeasonAiLineupAudit } from "@/lib/season/season-ai-lineup-audit-service";
import {
  applyTeamSeasonObjectiveRewards,
} from "@/lib/board/team-season-objectives-service";
import { applySponsorSettlement, previewSponsorSettlement } from "@/lib/sponsor/sponsor-settlement-service";
import { buildSeasonReview, type SeasonReview } from "@/lib/season/season-review-service";
import {
  createSeasonSnapshot,
  SEASON_SNAPSHOT_CONFIRM_TOKEN,
  type CreateSeasonSnapshotResult,
} from "@/lib/season/season-snapshot-service";
import {
  buildSeasonTransitionPreview,
  isSeasonComplete,
  startSeasonTransition,
  type SeasonTransitionPreview,
} from "@/lib/season/season-transition-service";

export const SEASON_COMPLETION_CONFIRM_TOKEN = "COMPLETE_LOCAL_SEASON_PIPELINE";

export type SeasonCompletionStepStatus = "planned" | "applied" | "already_done" | "blocked" | "skipped";

export type SeasonCompletionStep = {
  key: "season_check" | "season_review" | "objective_rewards" | "cash_apply" | "sponsor_settlement" | "relationships" | "snapshot" | "transition" | "ai_audit";
  label: string;
  status: SeasonCompletionStepStatus;
  warnings: string[];
  blockingReasons: string[];
  auditId: string | null;
};

export type SeasonCompletionResult = {
  ok: boolean;
  dryRun: boolean;
  applied: boolean;
  status: "ready" | "applied" | "blocked";
  scope: {
    saveId: string;
    seasonId: string;
    matchdayId: string;
  };
  steps: SeasonCompletionStep[];
  seasonReview: SeasonReview;
  cashApply: CashPrizeApplyResult;
  snapshot: CreateSeasonSnapshotResult;
  relationships: TeamRelationshipEventApplyResult;
  transition: SeasonTransitionPreview;
  aiSeasonAudit: SeasonAiLineupAudit;
  warnings: string[];
  blockingReasons: string[];
};

function resolveLocalSave(persistence: PersistenceService, saveId: string) {
  const bootstrapped = persistence.bootstrapSingleplayerSave();
  const save = persistence.getSaveById(saveId) ?? persistence.getActiveSave() ?? bootstrapped.save;

  if (!save) {
    throw new Error(`Local save ${saveId} could not be loaded for season completion.`);
  }

  return save;
}

function addStep(
  steps: SeasonCompletionStep[],
  step: SeasonCompletionStep,
  warnings: Set<string>,
  blockingReasons: Set<string>,
) {
  steps.push(step);
  step.warnings.forEach((warning) => warnings.add(warning));
  step.blockingReasons.forEach((reason) => blockingReasons.add(reason));
}

function asReviewStateRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {};
}

function countByReason(events: TeamRelationshipEventApplyResult["generatedEvents"]) {
  return events.reduce<Record<string, number>>((summary, event) => {
    summary[event.reason] = (summary[event.reason] ?? 0) + 1;
    return summary;
  }, {});
}

function buildSeasonConsequencesReviewState(input: {
  previousState: unknown;
  seasonId: string;
  seasonReview: SeasonReview;
  cashApply: CashPrizeApplyResult;
  relationships: TeamRelationshipEventApplyResult;
  aiSeasonAudit: SeasonAiLineupAudit;
  warnings: string[];
}) {
  const previous = asReviewStateRecord(input.previousState);
  const previousConsequences =
    previous.seasonConsequences && typeof previous.seasonConsequences === "object" && !Array.isArray(previous.seasonConsequences)
      ? { ...(previous.seasonConsequences as Record<string, unknown>) }
      : {};
  const totalPrizeMoney = input.cashApply.plannedChanges.reduce((sum, change) => sum + (change.prizeMoney ?? 0), 0);
  const rankChangePrize = input.cashApply.plannedChanges.reduce((sum, change) => sum + (change.rankChangePrize ?? 0), 0);

  return {
    ...previous,
    seasonConsequences: {
      ...previousConsequences,
      [input.seasonId]: {
        seasonId: input.seasonId,
        generatedAt: new Date().toISOString(),
        objectiveSettlement: input.seasonReview.objectiveSettlement,
        cashPrize: {
          applied: input.cashApply.applied || input.cashApply.duplicateDetected,
          auditLogId: input.cashApply.auditLogId,
          appliedTeams: input.cashApply.plannedChanges.filter((change) => change.newCash != null).length,
          totalPrizeMoney: Number(totalPrizeMoney.toFixed(2)),
          rankChangePrize: Number(rankChangePrize.toFixed(2)),
          warnings: input.cashApply.warnings,
        },
        relationships: {
          generatedEvents: input.relationships.generatedEvents.length,
          insertedEvents: input.relationships.insertedEvents,
          replacedPreviewEvents: input.relationships.replacedPreviewEvents,
          reasonCounts: countByReason(input.relationships.generatedEvents),
          warnings: input.relationships.warnings,
        },
        aiSeasonAudit: input.aiSeasonAudit,
        warnings: input.warnings,
      },
    },
  };
}

async function runLocalSeasonCompletionUnsafe(
  params: {
    saveId: string;
    seasonId?: string;
    source?: "sqlite" | "prisma";
    dryRun?: boolean;
    execute?: boolean;
    confirmToken?: string;
  },
  persistence: PersistenceService = createPersistenceService(),
): Promise<SeasonCompletionResult> {
  const source = params.source === "prisma" ? "prisma" : "sqlite";
  const dryRun = params.execute ? false : params.dryRun ?? true;
  const initialSave = resolveLocalSave(persistence, params.saveId);
  const seasonId = params.seasonId?.trim() || initialSave.gameState.season.id;
  const matchdayId = initialSave.gameState.matchdayState.matchdayId;
  const steps: SeasonCompletionStep[] = [];
  const warnings = new Set<string>();
  const blockingReasons = new Set<string>();
  const completed = isSeasonComplete(initialSave.gameState);
  const seasonReview = buildSeasonReview(initialSave.gameState);
  const aiSeasonAudit = buildSeasonAiLineupAudit(initialSave.gameState, seasonId);

  if (source === "prisma") {
    blockingReasons.add("Prisma/Supabase mode is read-only in this build.");
  }
  if (!completed) {
    blockingReasons.add("season_not_completed");
  }
  if (!dryRun && params.confirmToken !== SEASON_COMPLETION_CONFIRM_TOKEN) {
    blockingReasons.add("missing_season_completion_confirm_token");
  }

  addStep(
    steps,
    {
      key: "season_check",
      label: "Season Check",
      status: completed ? "applied" : "blocked",
      warnings: [],
      blockingReasons: completed ? [] : ["season_not_completed"],
      auditId: null,
    },
    warnings,
    blockingReasons,
  );
  addStep(
    steps,
    {
      key: "season_review",
      label: "Season Review",
      status: completed ? "applied" : "skipped",
      warnings: seasonReview.warnings,
      blockingReasons: [],
      auditId: null,
    },
    warnings,
    blockingReasons,
  );

  const existingCashLog =
    (initialSave.gameState.seasonState.cashPrizeApplyLogs ?? []).find((log) => log.seasonId === seasonId) ?? null;
  const cashApply = await previewCashPrizeApply(
    {
      saveId: initialSave.saveId,
      seasonId,
      matchdayId,
      source,
      phase: "season_end",
      dryRun: true,
      execute: false,
    },
    persistence,
  );
  if (existingCashLog) {
    warnings.add("legacy_cash_prize_apply_log_present_benchmark_only_mode");
  }
  addStep(
    steps,
    {
      key: "cash_apply",
      label: "Preisgeld-Benchmark",
      status: existingCashLog ? "already_done" : cashApply.canApply ? "planned" : "skipped",
      warnings: [...cashApply.warnings, ...(existingCashLog ? ["legacy_cash_prize_apply_log_present"] : [])],
      blockingReasons: [],
      auditId: existingCashLog?.id ?? null,
    },
    warnings,
    blockingReasons,
  );

  const afterCashSave = resolveLocalSave(persistence, initialSave.saveId);
  const sponsorSettlementPreview = previewSponsorSettlement(afterCashSave.gameState, "season_end");
  const existingSponsorEndPayout =
    (afterCashSave.gameState.seasonState.sponsorPayoutLogs ?? []).some(
      (log) => log.seasonId === seasonId && log.phase === "season_end",
    ) ?? false;
  const shouldApplySponsorSettlement =
    !dryRun && blockingReasons.size === 0 && !existingSponsorEndPayout;
  const sponsorSettlementApply = shouldApplySponsorSettlement
    ? applySponsorSettlement({
        gameState: afterCashSave.gameState,
        saveId: afterCashSave.saveId,
        phase: "season_end",
        execute: true,
        deductSalary: true,
      })
    : { gameState: afterCashSave.gameState, preview: sponsorSettlementPreview, applied: false };
  if (shouldApplySponsorSettlement && !sponsorSettlementApply.applied && sponsorSettlementPreview.canApply) {
    sponsorSettlementPreview.blockingReasons.forEach((reason) => blockingReasons.add(`sponsor_settlement:${reason}`));
  }
  if (shouldApplySponsorSettlement && sponsorSettlementApply.applied) {
    persistence.saveSingleplayerState(afterCashSave.saveId, sponsorSettlementApply.gameState);
  }
  addStep(
    steps,
    {
      key: "sponsor_settlement",
      label: "Sponsor-Abrechnung",
      status: existingSponsorEndPayout
        ? "already_done"
        : sponsorSettlementApply.applied
          ? "applied"
          : sponsorSettlementPreview.canApply
            ? "planned"
            : "skipped",
      warnings: sponsorSettlementPreview.warnings,
      blockingReasons: sponsorSettlementPreview.blockingReasons,
      auditId: null,
    },
    warnings,
    blockingReasons,
  );

  const afterSponsorSave = sponsorSettlementApply.applied
    ? resolveLocalSave(persistence, initialSave.saveId)
    : afterCashSave;
  const objectiveRewardPreview = applyTeamSeasonObjectiveRewards(afterSponsorSave.gameState, {
    saveId: afterCashSave.saveId,
    seasonId,
    execute: false,
  });
  const existingObjectiveRewardLog =
    (afterSponsorSave.gameState.seasonState.objectiveRewardApplyLogs ?? []).find((log) => log.seasonId === seasonId) ?? null;
  const shouldApplyObjectiveRewards = !dryRun && blockingReasons.size === 0 && !existingObjectiveRewardLog;
  const objectiveRewardApply = shouldApplyObjectiveRewards
    ? applyTeamSeasonObjectiveRewards(afterSponsorSave.gameState, {
        saveId: afterSponsorSave.saveId,
        seasonId,
        execute: true,
      })
    : objectiveRewardPreview;
  if (shouldApplyObjectiveRewards && objectiveRewardApply.applied) {
    persistence.saveSingleplayerState(afterSponsorSave.saveId, objectiveRewardApply.gameState);
  }
  addStep(
    steps,
    {
      key: "objective_rewards",
      label: "Board Objectives",
      status: existingObjectiveRewardLog
        ? "already_done"
        : objectiveRewardApply.applied
          ? "applied"
          : completed
            ? "planned"
            : "skipped",
      warnings: objectiveRewardPreview.warnings,
      blockingReasons: [],
      auditId: existingObjectiveRewardLog?.id ?? objectiveRewardApply.auditLogId,
    },
    warnings,
    blockingReasons,
  );

  const afterObjectiveSave = objectiveRewardApply.applied ? resolveLocalSave(persistence, initialSave.saveId) : afterSponsorSave;
  const relationshipApply = upsertTeamRelationshipEvents(afterObjectiveSave.gameState);
  const existingRelationshipEvents = afterCashSave.gameState.seasonState.teamRelationshipEvents ?? [];
  const existingRelationshipIds = new Set(existingRelationshipEvents.map((event) => event.eventId));
  const newRelationshipEventCount = relationshipApply.generatedEvents.filter((event) => !existingRelationshipIds.has(event.eventId)).length;
  const shouldApplyRelationships =
    !dryRun && blockingReasons.size === 0 && (newRelationshipEventCount > 0 || relationshipApply.replacedPreviewEvents > 0);
  if (shouldApplyRelationships) {
    persistence.saveSingleplayerState(afterCashSave.saveId, relationshipApply.gameState);
  }
  addStep(
    steps,
    {
      key: "relationships",
      label: "Ally/Rival Updates",
      status:
        relationshipApply.generatedEvents.length === 0
          ? "skipped"
          : shouldApplyRelationships
            ? "applied"
            : newRelationshipEventCount === 0 && relationshipApply.replacedPreviewEvents === 0
              ? "already_done"
              : "planned",
      warnings: relationshipApply.warnings,
      blockingReasons: [],
      auditId: relationshipApply.generatedEvents.length > 0 ? `relationships:${seasonId}:${relationshipApply.generatedEvents.length}` : null,
    },
    warnings,
    blockingReasons,
  );

  const afterRelationshipsSave = shouldApplyRelationships ? resolveLocalSave(persistence, initialSave.saveId) : afterObjectiveSave;
  const existingSnapshot =
    (afterRelationshipsSave.gameState.seasonState.seasonSnapshots ?? []).find((snapshot) => snapshot.seasonId === seasonId) ?? null;
  const snapshot =
    !dryRun && blockingReasons.size === 0 && !existingSnapshot
      ? createSeasonSnapshot(
          {
            saveId: afterRelationshipsSave.saveId,
            seasonId,
            source,
            execute: true,
            dryRun: false,
            confirm: SEASON_SNAPSHOT_CONFIRM_TOKEN,
          },
          persistence,
        )
      : createSeasonSnapshot(
          {
            saveId: afterRelationshipsSave.saveId,
            seasonId,
            source,
            dryRun: true,
            execute: false,
          },
          persistence,
        );
  if (!existingSnapshot && (!snapshot.ok || (!dryRun && !snapshot.applied))) {
    snapshot.blockingReasons.forEach((reason) => blockingReasons.add(reason));
  }
  addStep(
    steps,
    {
      key: "snapshot",
      label: "Season Snapshot",
      status: existingSnapshot ? "already_done" : snapshot.applied ? "applied" : snapshot.canCreate ? "planned" : "blocked",
      warnings: snapshot.warnings,
      blockingReasons: existingSnapshot ? [] : snapshot.blockingReasons,
      auditId: snapshot.snapshot.snapshotId ?? null,
    },
    warnings,
    blockingReasons,
  );

  const afterSnapshotSave = resolveLocalSave(persistence, initialSave.saveId);
  const transition =
    !dryRun && blockingReasons.size === 0 && afterSnapshotSave.gameState.gamePhase !== "season_review"
      ? startSeasonTransition(afterSnapshotSave, persistence)
      : buildSeasonTransitionPreview(afterSnapshotSave);
  if (!transition.ok) {
    transition.blockingReasons.forEach((reason) => blockingReasons.add(reason));
  }
  addStep(
    steps,
    {
      key: "transition",
      label: "Season Review öffnen",
      status: "applied" in transition && transition.applied ? "applied" : transition.ok ? "planned" : "blocked",
      warnings: transition.warnings,
      blockingReasons: transition.blockingReasons,
      auditId: transition.transition.transitionId,
    },
    warnings,
    blockingReasons,
  );
  addStep(
    steps,
    {
      key: "ai_audit",
      label: "AI Saison-Audit",
      status: aiSeasonAudit.warnings.length > 0 ? "planned" : "applied",
      warnings: aiSeasonAudit.warnings,
      blockingReasons: [],
      auditId: null,
    },
    warnings,
    blockingReasons,
  );

  const blockingList = Array.from(blockingReasons);
  const warningList = Array.from(warnings);
  const applied = !dryRun && blockingList.length === 0;
  if (applied) {
    const latestSave = resolveLocalSave(persistence, initialSave.saveId);
    persistence.saveSingleplayerState(latestSave.saveId, {
      ...latestSave.gameState,
      seasonReviewState: buildSeasonConsequencesReviewState({
        previousState: latestSave.gameState.seasonReviewState,
        seasonId,
        seasonReview,
        cashApply,
        relationships: relationshipApply,
        aiSeasonAudit,
        warnings: warningList,
      }),
    });
  }

  return {
    ok: blockingList.length === 0,
    dryRun,
    applied,
    status: blockingList.length > 0 ? "blocked" : applied ? "applied" : "ready",
    scope: {
      saveId: initialSave.saveId,
      seasonId,
      matchdayId,
    },
    steps,
    seasonReview,
    cashApply,
    snapshot,
    relationships: relationshipApply,
    transition,
    aiSeasonAudit,
    warnings: warningList,
    blockingReasons: blockingList,
  };
}

export async function runLocalSeasonCompletion(
  params: {
    saveId: string;
    seasonId?: string;
    source?: "sqlite" | "prisma";
    dryRun?: boolean;
    execute?: boolean;
    confirmToken?: string;
  },
  persistence: PersistenceService = createPersistenceService(),
): Promise<SeasonCompletionResult> {
  const dryRun = params.execute ? false : params.dryRun ?? true;
  if (dryRun) {
    return runLocalSeasonCompletionUnsafe(params, persistence);
  }

  const beforeSave = resolveLocalSave(persistence, params.saveId);
  return runWithSaveRecovery({
    label: "season_completion",
    saveId: beforeSave.saveId,
    status: beforeSave.status,
    beforeGameState: beforeSave.gameState,
    persistence,
    run: () => runLocalSeasonCompletionUnsafe(params, persistence),
  });
}
