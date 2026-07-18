import { buildAiLegacyLineupPreview } from "@/lib/ai/ai-legacy-lineup-engine";
import { applyAiLegacyLineupBatchLocally, buildAiLegacyLineupModifiers } from "@/lib/ai/ai-legacy-lineup-batch-apply-service";
import { type GameState, type LineupDraftModifiers, type TeamControlMode } from "@/lib/data/olyDataTypes";
import { buildTeamControlSettingsMap, isAiLineupBatchApplyEnabled } from "@/lib/foundation/team-control-settings";
import { buildLegacyMatchdayReadiness } from "@/lib/lineups/legacy-matchday-readiness";
import { attachMatchdayInjuryPerformanceToContexts, buildMatchdayInjuryRollMap } from "@/lib/fatigue/fatigue-injury-service";
import { createLineupDraftId } from "@/lib/lineups/lineup-discipline-contract";
import { loadLocalLegacyLineupContext, loadLocalLegacyLineupContextFromGameState } from "@/lib/lineups/legacy-lineup-local-service";
import type { LegacyLineupEntryInput, LegacyLineupKeyParams, LegacyLineupLoadedContext } from "@/lib/lineups/legacy-lineup-types";
import { ensureLocalFormCardsForSeason, normalizeLineupDraftModifiers } from "@/lib/lineups/legacy-lineup-modifiers";
import { prepareGameStateForMatchdayResolve } from "@/lib/lineups/matchday-lineup-auto-prep";
import { validateLegacyLineupContext } from "@/lib/lineups/legacy-lineup-validator";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import type { PersistenceService } from "@/lib/persistence/types";
import {
  APPLY_CONFIRM_TOKEN,
  LegacyMatchdayResultApplyService,
} from "@/lib/resolve/legacy-matchday-result-apply-service";
import { buildResolveLabSummary } from "@/lib/resolve/legacy-resolve-lab";
import { buildLegacyMatchdayResolvePreview } from "@/lib/resolve/legacy-matchday-resolve-engine";
import { type ResolvePreviewStatus } from "@/lib/resolve/legacy-matchday-resolve-types";
import { buildStandingsPreview } from "@/lib/standings/standings-preview-engine";
import { executeStandingsApply, STANDINGS_APPLY_CONFIRM_TOKEN } from "@/lib/standings/standings-apply-service";
import { ADVANCE_MATCHDAY_CONFIRM_TOKEN, executeMatchdayAdvance } from "@/lib/season/matchday-progress-service";

export const MATCHDAY_AUTO_RUN_CONFIRM_TOKEN = "RUN_LOCAL_MATCHDAY_AUTO";

export type MatchdayAutoRunStepKey =
  | "ai_lineups"
  | "resolve_preview"
  | "result_apply"
  | "standings_preview"
  | "standings_apply"
  | "prize_preview"
  | "cash_apply"
  | "matchday_advance";

export type MatchdayAutoRunStepStatus =
  | "ready"
  | "warning"
  | "blocked"
  | "planned"
  | "applied"
  | "skipped";

export type MatchdayAutoRunStep = {
  key: MatchdayAutoRunStepKey;
  label: string;
  status: MatchdayAutoRunStepStatus;
  dryRun: boolean;
  canContinue: boolean;
  warnings: string[];
  blockingReasons: string[];
  metrics: Record<string, number | string | boolean | null>;
  plannedWrites: number;
  appliedWrites: number;
  auditId: string | null;
};

export type MatchdayAutoRunParams = {
  source?: "sqlite" | "prisma";
  saveId: string;
  seasonId: string;
  matchdayId: string;
  dryRun?: boolean;
  execute?: boolean;
  confirmToken?: string;
  options?: {
    includeWarningLineups?: boolean;
    overwriteExistingLineups?: boolean;
    stopOnTie?: boolean;
    advanceAfterCashApply?: boolean;
  };
};

export type MatchdayAutoRunResult = {
  ok: boolean;
  source: "sqlite" | "prisma";
  dryRun: boolean;
  executed: boolean;
  status: "ready" | "warning" | "blocked" | "applied";
  scope: {
    saveId: string;
    seasonId: string;
    matchdayId: string;
  };
  summary: {
    lineupsReady: number;
    aiReady: number;
    manualReady: number;
    missingManualTeams: number;
    manualMissing: number;
    passiveReady: number;
    passiveMissing: number;
    warningTeams: number;
    resolveReady: boolean;
    resultApplyAllowed: boolean;
    standingsApplyAllowed: boolean;
    tieBlockers: number;
    cashApplyAllowed: boolean;
    advanceAllowed: boolean;
    plannedWrites: number;
  };
  steps: MatchdayAutoRunStep[];
  warnings: string[];
  blockingReasons: string[];
  plannedWrites: Array<{
    step: MatchdayAutoRunStepKey;
    count: number;
    label: string;
  }>;
  appliedAudits: {
    resultApply: string | null;
    standingsApply: string | null;
    cashApply: string | null;
    matchdayAdvance: string | null;
    aiLineupTeamsSaved: number;
  };
};

type ResolvePreviewEnvelope = {
  preview: ReturnType<typeof buildLegacyMatchdayResolvePreview>;
  summary: ReturnType<typeof buildResolveLabSummary>;
  readinessByTeamId: Map<string, ReturnType<typeof buildLegacyMatchdayReadiness>>;
  warnings: string[];
};

type HypotheticalAiLineupState = {
  gameState: GameState;
  readyTeamsAfterSimulation: Set<string>;
};

function normalizeSource(source?: string): "sqlite" | "prisma" {
  return source === "prisma" ? "prisma" : "sqlite";
}

function resolveLocalSave(persistence: PersistenceService, saveId: string) {
  const bootstrapped = persistence.bootstrapSingleplayerSave();
  const save =
    persistence.getSaveById(saveId) ??
    persistence.getActiveSave() ??
    bootstrapped.save;

  if (!save) {
    throw new Error(`Local save ${saveId} could not be loaded for matchday auto-run.`);
  }

  return save;
}

function getStatusFromBooleans(input: {
  blockingReasons: string[];
  warnings: string[];
  applied?: boolean;
  plannedWrites?: number;
}): MatchdayAutoRunStepStatus {
  if (input.applied) return "applied";
  if (input.blockingReasons.length > 0) return "blocked";
  if (input.warnings.length > 0) return "warning";
  if ((input.plannedWrites ?? 0) > 0) return "planned";
  return "ready";
}

// Same-day injury multipliers must be baked into the auto-run resolve preview.
// The result-apply path uses this preview as `preloadedPreview`, so if injuries
// are not attached before the preview is built an injured-this-matchday player
// would be persisted at 1.0x through auto-run while scoring 0.75x through the
// manual/sim path. Attaching here mirrors prepareLegacyMatchdayResultApply, which
// attaches the same roll map to the contexts before it scores.
function attachAutoRunInjuriesToContexts(
  contexts: LegacyLineupLoadedContext[],
  gameState: GameState,
  scope: { saveId: string; seasonId: string; matchdayId: string },
): void {
  const injuryRollMap = buildMatchdayInjuryRollMap({
    gameState,
    saveId: scope.saveId,
    seasonId: scope.seasonId,
    matchdayId: scope.matchdayId,
  });
  attachMatchdayInjuryPerformanceToContexts(contexts, injuryRollMap);
}

function buildResolvePreviewEnvelopeFromContexts(contexts: LegacyLineupLoadedContext[]): ResolvePreviewEnvelope {
  const preview = buildLegacyMatchdayResolvePreview(contexts);
  const readinessRows = contexts.map((context) => buildLegacyMatchdayReadiness(context));
  const readinessByTeamId = new Map(readinessRows.map((row) => [row.teamId, row]));
  const summary = buildResolveLabSummary(preview, contexts, readinessByTeamId);
  return {
    preview,
    summary,
    readinessByTeamId,
    warnings: Array.from(new Set([...preview.warnings, ...readinessRows.flatMap((row) => row.validationWarnings)])),
  };
}

function upsertDraftInGameState(
  gameState: GameState,
  params: LegacyLineupKeyParams,
  entries: LegacyLineupEntryInput[],
  modifiers?: LineupDraftModifiers,
): GameState {
  const now = new Date().toISOString();
  const lineupId = createLineupDraftId(params);
  const existingDrafts = gameState.seasonState.lineupDrafts ?? [];
  const existing = existingDrafts.find((draft) => draft.lineupId === lineupId) ?? null;

  return {
    ...gameState,
    seasonState: {
      ...gameState.seasonState,
      lineupDrafts: [
        ...existingDrafts.filter((draft) => draft.lineupId !== lineupId),
        {
          lineupId,
          saveId: params.saveId,
          seasonId: params.seasonId,
          matchdayId: params.matchdayId,
          teamId: params.teamId,
          status: "draft",
          entries: entries.map((entry) => ({ ...entry })),
          modifiers: normalizeLineupDraftModifiers(modifiers),
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        },
      ],
    },
  };
}

function simulateAiLineupState(
  save: ReturnType<typeof resolveLocalSave>,
  scope: { saveId: string; seasonId: string; matchdayId: string },
  options: {
    includeWarningLineups: boolean;
    overwriteExistingLineups: boolean;
  },
): HypotheticalAiLineupState {
  const controlSettingsMap = buildTeamControlSettingsMap(
    save.gameState.teams,
    save.gameState.seasonState.teamControlSettings,
  );
  let nextGameState = structuredClone(save.gameState);
  nextGameState = ensureLocalFormCardsForSeason(nextGameState, scope.saveId, scope.seasonId);
  const readyTeamsAfterSimulation = new Set<string>();

  for (const team of save.gameState.teams) {
    const settings = controlSettingsMap[team.teamId];
    const controlMode: TeamControlMode = settings?.controlMode ?? "manual";
    if (controlMode !== "ai" || !isAiLineupBatchApplyEnabled(settings)) {
      continue;
    }

    const params: LegacyLineupKeyParams = {
      saveId: scope.saveId,
      seasonId: scope.seasonId,
      matchdayId: scope.matchdayId,
      teamId: team.teamId,
    };
    const contextResult = loadLocalLegacyLineupContextFromGameState(nextGameState, params);
    if (!contextResult.ok) {
      continue;
    }

    const preview = buildAiLegacyLineupPreview(contextResult.context, "sqlite");
    const modifiers = buildAiLegacyLineupModifiers(contextResult.context, preview.entries);
    const hasExistingDraft = Boolean(contextResult.context.existingDraft?.entries?.length);
    if (preview.status === "blocked") {
      continue;
    }
    if (preview.status !== "ready" && !options.includeWarningLineups) {
      continue;
    }
    if (hasExistingDraft && !options.overwriteExistingLineups) {
      continue;
    }

    const validation = validateLegacyLineupContext(
      {
        ...contextResult.context,
        entries: preview.entries,
      },
      {
        enforceCompleteness: preview.status === "ready",
      },
    );

    if (!validation.isValid) {
      continue;
    }

    nextGameState = upsertDraftInGameState(nextGameState, params, preview.entries, modifiers);
    if (preview.status === "ready") {
      readyTeamsAfterSimulation.add(team.teamId);
    }
  }

  return {
    gameState: nextGameState,
    readyTeamsAfterSimulation,
  };
}

function buildDryRunLineupSummary(input: {
  gameState: GameState;
  resolve: ResolvePreviewEnvelope;
}) {
  const controlSettingsMap = buildTeamControlSettingsMap(
    input.gameState.teams,
    input.gameState.seasonState.teamControlSettings,
  );
  const savedLineupTeamIds = new Set(
    (input.gameState.seasonState.lineupDrafts ?? [])
      .filter(
        (draft) =>
          draft.seasonId === input.gameState.season.id &&
          draft.matchdayId === input.gameState.matchdayState.matchdayId,
      )
      .map((draft) => draft.teamId),
  );
  let aiReady = 0;
  let manualReady = 0;
  let manualMissing = 0;
  let passiveReady = 0;
  let passiveMissing = 0;

  for (const team of input.gameState.teams) {
    const controlMode = controlSettingsMap[team.teamId]?.controlMode ?? "manual";
    const readiness = input.resolve.readinessByTeamId.get(team.teamId);
    const readinessStatus = readiness?.readinessStatus ?? "unknown";
    const isReady = readinessStatus === "ready";
    const isMissingLineup = !savedLineupTeamIds.has(team.teamId) || readinessStatus === "missing_lineup";

    if (controlMode === "ai") {
      if (isReady) {
        aiReady += 1;
      }
      continue;
    }

    if (controlMode === "manual") {
      if (isReady) {
        manualReady += 1;
      } else if (isMissingLineup) {
        manualMissing += 1;
      }
      continue;
    }

    if (isReady) {
      passiveReady += 1;
    } else if (isMissingLineup) {
      passiveMissing += 1;
    }
  }

  return {
    lineupsReady: input.resolve.summary.teamsReady,
    aiReady,
    manualReady,
    missingManualTeams: manualMissing,
    manualMissing,
    passiveReady,
    passiveMissing,
    warningTeams:
      input.resolve.summary.teamsUnderfilled +
      input.resolve.summary.teamsMissingScoreCoverage +
      input.resolve.summary.teamsInvalidLineup,
    resolveReady: input.resolve.preview.status === "ready",
    resolveStatus: input.resolve.preview.status,
  };
}

function createBaseResult(
  input: Pick<MatchdayAutoRunParams, "saveId" | "seasonId" | "matchdayId"> & {
    source: "sqlite" | "prisma";
    dryRun: boolean;
  },
): MatchdayAutoRunResult {
  return {
    ok: true,
    source: input.source,
    dryRun: input.dryRun,
    executed: !input.dryRun,
    status: input.dryRun ? "ready" : "applied",
    scope: {
      saveId: input.saveId,
      seasonId: input.seasonId,
      matchdayId: input.matchdayId,
    },
    summary: {
      lineupsReady: 0,
      aiReady: 0,
      manualReady: 0,
      missingManualTeams: 0,
      manualMissing: 0,
      passiveReady: 0,
      passiveMissing: 0,
      warningTeams: 0,
      resolveReady: false,
      resultApplyAllowed: false,
      standingsApplyAllowed: false,
      tieBlockers: 0,
      cashApplyAllowed: false,
      advanceAllowed: false,
      plannedWrites: 0,
    },
    steps: [],
    warnings: [],
    blockingReasons: [],
    plannedWrites: [],
    appliedAudits: {
      resultApply: null,
      standingsApply: null,
      cashApply: null,
      matchdayAdvance: null,
      aiLineupTeamsSaved: 0,
    },
  };
}

function addStep(result: MatchdayAutoRunResult, step: MatchdayAutoRunStep) {
  result.steps.push(step);
  if (step.warnings.length > 0) {
    result.warnings.push(...step.warnings);
  }
  if (step.blockingReasons.length > 0) {
    if (!step.canContinue) {
      result.blockingReasons.push(...step.blockingReasons);
      result.ok = false;
      result.status = "blocked";
    } else {
      // canContinue=true with blocking reasons means non-fatal issues (e.g. skipped_disabled teams)
      result.warnings.push(...step.blockingReasons);
    }
  }
  if (step.plannedWrites > 0) {
    result.plannedWrites.push({
      step: step.key,
      count: step.plannedWrites,
      label: step.label,
    });
  }
}

export async function runLocalMatchdayAutoRun(
  params: MatchdayAutoRunParams,
  persistence: PersistenceService = createPersistenceService(),
): Promise<MatchdayAutoRunResult> {
  const source = normalizeSource(params.source);
  const dryRun = params.execute ? false : params.dryRun ?? true;
  const includeWarningLineups = params.options?.includeWarningLineups ?? false;
  const overwriteExistingLineups = params.options?.overwriteExistingLineups ?? false;
  const stopOnTie = params.options?.stopOnTie ?? true;
  const advanceAfterCashApply = params.options?.advanceAfterCashApply ?? true;
  const result = createBaseResult({
    source,
    dryRun,
    saveId: params.saveId,
    seasonId: params.seasonId,
    matchdayId: params.matchdayId,
  });

  if (source === "prisma") {
    result.ok = false;
    result.status = "blocked";
    result.blockingReasons.push("Prisma/Supabase mode is read-only. Matchday Auto-Run is only allowed in the local SQLite test save.");
    return result;
  }

  if (!dryRun && params.confirmToken !== MATCHDAY_AUTO_RUN_CONFIRM_TOKEN) {
    result.ok = false;
    result.status = "blocked";
    result.blockingReasons.push("Missing explicit confirm token for Matchday Auto-Run execute.");
    return result;
  }

  const save = resolveLocalSave(persistence, params.saveId);
  const scope = {
    saveId: save.saveId,
    seasonId: params.seasonId,
    matchdayId: params.matchdayId,
  };
  const prepared = prepareGameStateForMatchdayResolve(save.gameState, scope);
  if (prepared.warnings.length > 0 && !dryRun) {
    persistence.saveSingleplayerState(scope.saveId, prepared.gameState);
  }
  const workingSave = {
    ...save,
    gameState: prepared.gameState,
  };
  const existingMatchdayResult =
    (workingSave.gameState.seasonState.matchdayResults ?? []).find(
      (entry) => entry.saveId === scope.saveId && entry.seasonId === scope.seasonId && entry.matchdayId === scope.matchdayId,
    ) ?? null;

  if (existingMatchdayResult) {
    addStep(result, {
      key: "ai_lineups",
      label: "AI Lineups",
      status: "skipped",
      dryRun,
      canContinue: true,
      warnings: ["existing_matchday_result_resume_skips_lineup_write"],
      blockingReasons: [],
      metrics: {
        existingResult: true,
      },
      plannedWrites: 0,
      appliedWrites: 0,
      auditId: null,
    });
    addStep(result, {
      key: "resolve_preview",
      label: "Resolve Preview",
      status: "skipped",
      dryRun,
      canContinue: true,
      warnings: ["existing_matchday_result_resume_skips_resolve_preview"],
      blockingReasons: [],
      metrics: {
        existingResult: true,
      },
      plannedWrites: 0,
      appliedWrites: 0,
      auditId: null,
    });
    addStep(result, {
      key: "result_apply",
      label: "Result Apply",
      status: "applied",
      dryRun,
      canContinue: true,
      warnings: ["existing_matchday_result_reused_for_resume"],
      blockingReasons: [],
      metrics: {
        resultsWritten: 0,
      },
      plannedWrites: 0,
      appliedWrites: 0,
      auditId: existingMatchdayResult.id,
    });
    result.summary.resultApplyAllowed = true;
    result.appliedAudits.resultApply = existingMatchdayResult.id;

    if (dryRun) {
      result.summary.standingsApplyAllowed = true;
      result.summary.plannedWrites = result.plannedWrites.reduce((sum, item) => sum + item.count, 0);
      result.warnings = Array.from(new Set(result.warnings));
      result.blockingReasons = Array.from(new Set(result.blockingReasons));
      result.status = result.warnings.length > 0 ? "warning" : "ready";
      return result;
    }

    const standingsPreview = await buildStandingsPreview({ ...scope, source }, undefined, persistence);
    const standingsPreviewBlockers =
      stopOnTie && (standingsPreview.tieGroups?.length ?? 0) > 0
        ? [...standingsPreview.blockedRules, "tie_groups_require_confirmed_policy"]
        : standingsPreview.blockedRules.filter((rule) => rule !== "global_score_tie_breaker_missing");
    addStep(result, {
      key: "standings_preview",
      label: "Standings Preview",
      status: getStatusFromBooleans({
        blockingReasons: standingsPreviewBlockers,
        warnings: standingsPreview.items.flatMap((item) => item.warnings),
      }),
      dryRun: false,
      canContinue: standingsPreviewBlockers.length === 0,
      warnings: standingsPreview.items.flatMap((item) => item.warnings),
      blockingReasons: standingsPreviewBlockers,
      metrics: {
        readyTeams: standingsPreview.summary.readyTeams,
        blockedTeams: standingsPreview.summary.blockedTeamCount,
        tieGroups: standingsPreview.tieGroups.length,
      },
      plannedWrites: 0,
      appliedWrites: 0,
      auditId: null,
    });
    result.summary.tieBlockers = standingsPreview.tieGroups.length;
    if (standingsPreviewBlockers.length > 0) {
      result.summary.standingsApplyAllowed = false;
      result.summary.plannedWrites = result.plannedWrites.reduce((sum, item) => sum + item.count, 0);
      result.warnings = Array.from(new Set(result.warnings));
      result.blockingReasons = Array.from(new Set(result.blockingReasons));
      return result;
    }

    const standingsApply = await executeStandingsApply(
      {
        ...scope,
        source,
        execute: true,
        dryRun: false,
        confirm: STANDINGS_APPLY_CONFIRM_TOKEN,
        forceReplace: !stopOnTie,
      },
      persistence,
    );
    addStep(result, {
      key: "standings_apply",
      label: "Standings Apply",
      status: standingsApply.ok && standingsApply.applied ? "applied" : "blocked",
      dryRun: false,
      canContinue: standingsApply.ok && standingsApply.applied,
      warnings: standingsApply.warnings,
      blockingReasons: standingsApply.ok ? [] : standingsApply.blockingReasons,
      metrics: {
        duplicateDetected: standingsApply.duplicateDetected,
        plannedChanges: standingsApply.plannedChanges.length,
      },
      plannedWrites: 0,
      appliedWrites: standingsApply.applied ? standingsApply.plannedChanges.length : 0,
      auditId: standingsApply.auditLogId,
    });
    result.summary.standingsApplyAllowed = standingsApply.ok && standingsApply.applied;
    if (!standingsApply.ok || !standingsApply.applied) {
      result.summary.plannedWrites = result.plannedWrites.reduce((sum, item) => sum + item.count, 0);
      result.warnings = Array.from(new Set(result.warnings));
      result.blockingReasons = Array.from(new Set(result.blockingReasons));
      return result;
    }
    result.appliedAudits.standingsApply = standingsApply.auditLogId;
    result.summary.cashApplyAllowed = false;
    if (advanceAfterCashApply) {
      const matchdayAdvance = await executeMatchdayAdvance(
        {
          saveId: scope.saveId,
          seasonId: scope.seasonId,
          source,
          execute: true,
          dryRun: false,
          confirm: ADVANCE_MATCHDAY_CONFIRM_TOKEN,
        },
        persistence,
      );
      addStep(result, {
        key: "matchday_advance",
        label: "Matchday Advance",
        status: matchdayAdvance.ok && matchdayAdvance.applied ? "applied" : "blocked",
        dryRun: false,
        canContinue: matchdayAdvance.ok && matchdayAdvance.applied,
        warnings: matchdayAdvance.warnings,
        blockingReasons: matchdayAdvance.ok ? [] : matchdayAdvance.blockingReasons,
        metrics: {
          currentMatchday: matchdayAdvance.summary.currentMatchdayLabel,
          nextMatchday: matchdayAdvance.summary.nextMatchdayLabel ?? "season_review",
          resultApplied: matchdayAdvance.summary.resultApplied,
          standingsApplied: matchdayAdvance.summary.standingsApplied,
          seasonEnd: matchdayAdvance.scope.nextMatchdayId == null,
        },
        plannedWrites: 0,
        appliedWrites: matchdayAdvance.applied ? 1 : 0,
        auditId: matchdayAdvance.auditLogId,
      });
      result.summary.advanceAllowed = matchdayAdvance.ok && matchdayAdvance.applied;
      result.appliedAudits.matchdayAdvance = matchdayAdvance.auditLogId;
    } else {
      result.summary.advanceAllowed = false;
    }
    result.summary.plannedWrites = result.plannedWrites.reduce((sum, item) => sum + item.count, 0);
    result.warnings = Array.from(new Set(result.warnings));
    result.blockingReasons = Array.from(new Set(result.blockingReasons));
    result.ok = result.blockingReasons.length === 0;
    result.status = result.ok ? "applied" : "blocked";
    return result;
  }

  const aiBatchResult = applyAiLegacyLineupBatchLocally({
    ...scope,
    dryRun: !params.execute,
    includeWarningTeams: includeWarningLineups,
    overwriteExisting: overwriteExistingLineups,
  }, persistence);
  addStep(result, {
    key: "ai_lineups",
    label: "AI Lineups",
    status: getStatusFromBooleans({
      blockingReasons: aiBatchResult.summary.blockingReasons,
      warnings: aiBatchResult.summary.warnings,
      plannedWrites: dryRun ? aiBatchResult.summary.plannedLineups : aiBatchResult.summary.savedTeams,
    }),
    dryRun,
    canContinue: aiBatchResult.summary.skippedBlocked === 0,
    warnings: aiBatchResult.summary.warnings,
    blockingReasons: aiBatchResult.summary.blockingReasons,
    metrics: {
      totalTeams: aiBatchResult.summary.totalTeams,
      aiEligibleTeams: aiBatchResult.summary.aiEligibleTeams,
      skippedManual: aiBatchResult.summary.skippedManual,
      skippedPassive: aiBatchResult.summary.skippedPassive,
      skippedDisabled: aiBatchResult.summary.skippedDisabled,
      warningTeams: aiBatchResult.summary.warningTeams,
      existingLineups: aiBatchResult.summary.existingLineups,
      formCardsSelected: aiBatchResult.summary.formCardsSelected,
      negativeFormCardsSelected: aiBatchResult.summary.negativeFormCardsSelected,
      formCardPlanningMs: aiBatchResult.summary.performanceBreakdown?.formCardPlanningMs ?? null,
      aiLineupGenerationMs: aiBatchResult.summary.performanceBreakdown?.aiLineupGenerationMs ?? null,
      lineupValidationMs: aiBatchResult.summary.performanceBreakdown?.lineupValidationMs ?? null,
      mutatorPlanningMs: aiBatchResult.summary.performanceBreakdown?.mutatorPlanningMs ?? null,
      aiContextLoadMs: aiBatchResult.summary.performanceBreakdown?.contextLoadMs ?? null,
      aiSaveWriteMs: aiBatchResult.summary.performanceBreakdown?.saveWriteMs ?? null,
      aiBatchTotalMs: aiBatchResult.summary.performanceBreakdown?.totalMs ?? null,
    },
    plannedWrites: dryRun ? aiBatchResult.summary.plannedLineups : 0,
    appliedWrites: dryRun ? 0 : aiBatchResult.summary.savedTeams,
    auditId: null,
  });
  result.appliedAudits.aiLineupTeamsSaved = dryRun ? 0 : aiBatchResult.summary.savedTeams;

  const postAiSave = resolveLocalSave(persistence, scope.saveId);
  const currentContexts = postAiSave.gameState.teams.map((team) => {
    const contextResult = loadLocalLegacyLineupContextFromGameState(postAiSave.gameState, {
      ...scope,
      teamId: team.teamId,
    });
    if (!contextResult.ok) {
      throw new Error(`Resolve Preview failed for ${team.teamId}: ${contextResult.errors.join(" | ")}`);
    }
    return contextResult.context;
  });
  attachAutoRunInjuriesToContexts(currentContexts, postAiSave.gameState, scope);
  const currentResolve = buildResolvePreviewEnvelopeFromContexts(currentContexts);
  let activeResolve = currentResolve;
  let lineupSummary = buildDryRunLineupSummary({
    gameState: postAiSave.gameState,
    resolve: currentResolve,
  });

  if (dryRun) {
    const hypotheticalState = simulateAiLineupState(save, scope, {
      includeWarningLineups,
      overwriteExistingLineups,
    });
    const hypotheticalContexts = hypotheticalState.gameState.teams.map((team) => {
      const contextResult = loadLocalLegacyLineupContextFromGameState(hypotheticalState.gameState, {
        ...scope,
        teamId: team.teamId,
      });
      if (!contextResult.ok) {
        throw new Error(`Hypothetical resolve preview failed for ${team.teamId}: ${contextResult.errors.join(" | ")}`);
      }
      return contextResult.context;
    });
    attachAutoRunInjuriesToContexts(hypotheticalContexts, hypotheticalState.gameState, scope);
    const hypotheticalResolve = buildResolvePreviewEnvelopeFromContexts(hypotheticalContexts);
    activeResolve = hypotheticalResolve;
    lineupSummary = buildDryRunLineupSummary({
      gameState: hypotheticalState.gameState,
      resolve: hypotheticalResolve,
    });
  }

  result.summary.lineupsReady = lineupSummary.lineupsReady;
  result.summary.aiReady = lineupSummary.aiReady;
  result.summary.manualReady = lineupSummary.manualReady;
  result.summary.missingManualTeams = lineupSummary.missingManualTeams;
  result.summary.manualMissing = lineupSummary.manualMissing;
  result.summary.passiveReady = lineupSummary.passiveReady;
  result.summary.passiveMissing = lineupSummary.passiveMissing;
  result.summary.warningTeams = lineupSummary.warningTeams;
  result.summary.resolveReady = lineupSummary.resolveReady;

  const resolveBlockingReasons = [
    ...(lineupSummary.manualMissing > 0 ? ["missing_manual_lineup"] : []),
    ...(lineupSummary.passiveMissing > 0 ? ["passive_missing_lineup"] : []),
    ...(activeResolve.preview.status === "ready" ? [] : [`resolve_status:${activeResolve.preview.status}`]),
  ];
  addStep(result, {
    key: "resolve_preview",
    label: "Resolve Preview",
    status: getStatusFromBooleans({
      blockingReasons: resolveBlockingReasons,
      warnings: activeResolve.warnings,
      plannedWrites: 0,
    }),
    dryRun,
    canContinue: resolveBlockingReasons.length === 0,
    warnings: activeResolve.warnings,
    blockingReasons: resolveBlockingReasons,
    metrics: {
      previewStatus: activeResolve.preview.status,
      aiReady: lineupSummary.aiReady,
      manualReady: lineupSummary.manualReady,
      manualMissing: lineupSummary.manualMissing,
      passiveReady: lineupSummary.passiveReady,
      passiveMissing: lineupSummary.passiveMissing,
      teamsReady: activeResolve.summary.teamsReady,
      teamsMissingLineup: activeResolve.summary.teamsMissingLineup,
      teamsUnderfilled: activeResolve.summary.teamsUnderfilled,
      teamsMissingScoreCoverage: activeResolve.summary.teamsMissingScoreCoverage,
      usedHypotheticalAiLineups: dryRun,
      currentResolveStatus: currentResolve.preview.status,
      activeResolveStatus: activeResolve.preview.status,
    },
    plannedWrites: 0,
    appliedWrites: 0,
    auditId: null,
  });

  if (dryRun) {
    result.summary.resultApplyAllowed = activeResolve.preview.status === "ready";
    result.summary.standingsApplyAllowed = false;
    result.summary.tieBlockers = 0;
    result.summary.cashApplyAllowed = false;
    result.summary.advanceAllowed = false;
    result.summary.plannedWrites = result.plannedWrites.reduce((sum, item) => sum + item.count, 0);
    result.warnings = Array.from(new Set(result.warnings));
    result.blockingReasons = Array.from(new Set(result.blockingReasons));
    if (result.blockingReasons.length > 0) {
      result.ok = false;
      result.status = "blocked";
    } else if (result.warnings.length > 0) {
      result.status = "warning";
    }
    return result;
  }

  if (activeResolve.preview.status !== "ready") {
    result.summary.plannedWrites = result.plannedWrites.reduce((sum, item) => sum + item.count, 0);
    result.warnings = Array.from(new Set(result.warnings));
    result.blockingReasons = Array.from(new Set(result.blockingReasons));
    return result;
  }

  const resultApplyService = new LegacyMatchdayResultApplyService(undefined, undefined, persistence);
  const resultApply = await resultApplyService.applyLegacyMatchdayResult({
    ...scope,
    source,
    execute: true,
    dryRun: false,
    confirm: APPLY_CONFIRM_TOKEN,
    preloadedContexts: currentContexts,
    preloadedPreview: activeResolve.preview,
  });
  addStep(result, {
    key: "result_apply",
    label: "Result Apply",
    status: resultApply.ok && resultApply.applied ? "applied" : "blocked",
    dryRun: false,
    canContinue: resultApply.ok && resultApply.applied,
    warnings: resultApply.ok ? resultApply.blockingReasons : resultApply.blockingReasons ?? [],
    blockingReasons: resultApply.ok ? [] : resultApply.blockingReasons ?? [resultApply.error],
    metrics: {
      previewStatus: resultApply.previewStatus ?? "—",
      teamsTotal: resultApply.ok ? resultApply.teamsTotal : null,
      resultsWritten: resultApply.ok ? resultApply.resultsWritten : null,
      contextLoadMs: resultApply.ok ? resultApply.performanceBreakdown?.contextLoadMs ?? null : null,
      resolvePreviewMs: resultApply.ok ? resultApply.performanceBreakdown?.resolvePreviewMs ?? null : null,
      lineupValidationMs: resultApply.ok ? resultApply.performanceBreakdown?.lineupValidationMs ?? null : null,
      playerPerformanceAggregationMs: resultApply.ok ? resultApply.performanceBreakdown?.playerPerformanceAggregationMs ?? null : null,
      existingLookupMs: resultApply.ok ? resultApply.performanceBreakdown?.existingLookupMs ?? null : null,
      recordMapMs: resultApply.ok ? resultApply.performanceBreakdown?.recordMapMs ?? null : null,
      standingsObjectiveRefreshMs: resultApply.ok ? resultApply.performanceBreakdown?.standingsObjectiveRefreshMs ?? null : null,
      resultApplyTotalMs: resultApply.ok ? resultApply.performanceBreakdown?.totalMs ?? null : null,
      saveWriteMs: resultApply.ok ? resultApply.performanceBreakdown?.saveWriteMs ?? null : null,
    },
    plannedWrites: 0,
    appliedWrites: resultApply.ok ? resultApply.resultsWritten : 0,
    auditId: resultApply.ok ? resultApply.matchdayResultId : null,
  });
  result.summary.resultApplyAllowed = resultApply.ok && resultApply.applied;
  if (!resultApply.ok || !resultApply.applied) {
    result.summary.plannedWrites = result.plannedWrites.reduce((sum, item) => sum + item.count, 0);
    result.warnings = Array.from(new Set(result.warnings));
    result.blockingReasons = Array.from(new Set(result.blockingReasons));
    return result;
  }
  result.appliedAudits.resultApply = resultApply.matchdayResultId;

  const standingsPreview = await buildStandingsPreview({ ...scope, source }, undefined, persistence);
  const standingsPreviewBlockers =
    stopOnTie && (standingsPreview.tieGroups?.length ?? 0) > 0
      ? [...standingsPreview.blockedRules, "tie_groups_require_confirmed_policy"]
      : standingsPreview.blockedRules.filter((rule) => rule !== "global_score_tie_breaker_missing");
  addStep(result, {
    key: "standings_preview",
    label: "Standings Preview",
    status: getStatusFromBooleans({
      blockingReasons: standingsPreviewBlockers,
      warnings: standingsPreview.items.flatMap((item) => item.warnings),
    }),
    dryRun: false,
    canContinue: standingsPreviewBlockers.length === 0,
    warnings: standingsPreview.items.flatMap((item) => item.warnings),
    blockingReasons: standingsPreviewBlockers,
    metrics: {
      readyTeams: standingsPreview.summary.readyTeams,
      blockedTeams: standingsPreview.summary.blockedTeamCount,
      tieGroups: standingsPreview.tieGroups.length,
    },
    plannedWrites: 0,
    appliedWrites: 0,
    auditId: null,
  });
  result.summary.tieBlockers = standingsPreview.tieGroups.length;
  if (standingsPreviewBlockers.length > 0) {
    result.summary.standingsApplyAllowed = false;
    result.summary.plannedWrites = result.plannedWrites.reduce((sum, item) => sum + item.count, 0);
    result.warnings = Array.from(new Set(result.warnings));
    result.blockingReasons = Array.from(new Set(result.blockingReasons));
    return result;
  }

  const standingsApplyStartedAt = performance.now();
  const standingsApply = await executeStandingsApply(
    {
      ...scope,
      source,
      execute: true,
      dryRun: false,
      confirm: STANDINGS_APPLY_CONFIRM_TOKEN,
      forceReplace: !stopOnTie,
    },
    persistence,
  );
  const standingsApplyDurationMs = Math.round(performance.now() - standingsApplyStartedAt);
  addStep(result, {
    key: "standings_apply",
    label: "Standings Apply",
    status: standingsApply.ok && standingsApply.applied ? "applied" : "blocked",
    dryRun: false,
    canContinue: standingsApply.ok && standingsApply.applied,
    warnings: standingsApply.warnings,
    blockingReasons: standingsApply.ok ? [] : standingsApply.blockingReasons,
    metrics: {
      duplicateDetected: standingsApply.duplicateDetected,
      plannedChanges: standingsApply.plannedChanges.length,
      durationMs: standingsApplyDurationMs,
    },
    plannedWrites: 0,
    appliedWrites: standingsApply.applied ? standingsApply.plannedChanges.length : 0,
    auditId: standingsApply.auditLogId,
  });
  result.summary.standingsApplyAllowed = standingsApply.ok && standingsApply.applied;
  if (!standingsApply.ok || !standingsApply.applied) {
    result.summary.plannedWrites = result.plannedWrites.reduce((sum, item) => sum + item.count, 0);
    result.warnings = Array.from(new Set(result.warnings));
    result.blockingReasons = Array.from(new Set(result.blockingReasons));
    return result;
  }
  result.appliedAudits.standingsApply = standingsApply.auditLogId;
  result.summary.cashApplyAllowed = false;
  if (advanceAfterCashApply) {
    const matchdayAdvance = await executeMatchdayAdvance(
      {
        saveId: scope.saveId,
        seasonId: scope.seasonId,
        source,
        execute: true,
        dryRun: false,
        confirm: ADVANCE_MATCHDAY_CONFIRM_TOKEN,
      },
      persistence,
    );
    addStep(result, {
      key: "matchday_advance",
      label: "Matchday Advance",
      status: matchdayAdvance.ok && matchdayAdvance.applied ? "applied" : "blocked",
      dryRun: false,
      canContinue: matchdayAdvance.ok && matchdayAdvance.applied,
      warnings: matchdayAdvance.warnings,
      blockingReasons: matchdayAdvance.ok ? [] : matchdayAdvance.blockingReasons,
      metrics: {
        currentMatchday: matchdayAdvance.summary.currentMatchdayLabel,
        nextMatchday: matchdayAdvance.summary.nextMatchdayLabel ?? "season_review",
        resultApplied: matchdayAdvance.summary.resultApplied,
        standingsApplied: matchdayAdvance.summary.standingsApplied,
        seasonEnd: matchdayAdvance.scope.nextMatchdayId == null,
      },
      plannedWrites: 0,
      appliedWrites: matchdayAdvance.applied ? 1 : 0,
      auditId: matchdayAdvance.auditLogId,
    });
    result.summary.advanceAllowed = matchdayAdvance.ok && matchdayAdvance.applied;
    result.appliedAudits.matchdayAdvance = matchdayAdvance.auditLogId;
  } else {
    result.summary.advanceAllowed = false;
  }

  result.summary.plannedWrites = result.plannedWrites.reduce((sum, item) => sum + item.count, 0);
  result.warnings = Array.from(new Set(result.warnings));
  result.blockingReasons = Array.from(new Set(result.blockingReasons));
  result.ok = result.blockingReasons.length === 0;
  result.status = result.ok ? "applied" : "blocked";
  return result;
}
