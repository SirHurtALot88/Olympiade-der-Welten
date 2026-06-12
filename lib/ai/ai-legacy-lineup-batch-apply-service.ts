import { buildAiLegacyLineupPreview } from "@/lib/ai/ai-legacy-lineup-engine";
import type { AiLegacyLineupPreviewStatus } from "@/lib/ai/ai-needs-types";
import { buildTeamControlSettingsMap, isAiLineupBatchApplyEnabled } from "@/lib/foundation/team-control-settings";
import type { LegacyLineupKeyParams } from "@/lib/lineups/legacy-lineup-types";
import {
  calculateLocalLegacyLineupPreview,
  getLocalLegacyLineupDraft,
  loadLocalLegacyLineupContext,
  saveLocalLegacyLineupDraft,
} from "@/lib/lineups/legacy-lineup-local-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import type { PersistenceService } from "@/lib/persistence/types";

export type AiBatchApplyTeamStatus =
  | "saved"
  | "skipped_warning"
  | "skipped_blocked"
  | "skipped_existing"
  | "skipped_manual"
  | "skipped_passive"
  | "skipped_disabled"
  | "failed_validation";

export type AiBatchApplyTeamResult = {
  teamId: string;
  teamCode: string;
  teamName: string;
  controlMode: "manual" | "ai" | "passive";
  aiEligible: boolean;
  previewStatus: AiLegacyLineupPreviewStatus | "validation_failed";
  captainSlotsUsed: number | null;
  captainSlotsRemaining: number | null;
  d1CaptainSelectionStatus: string | null;
  d2CaptainSelectionStatus: string | null;
  result: AiBatchApplyTeamStatus;
  overwriteExisting: boolean;
  warnings: string[];
  blockingReasons: string[];
  saved: boolean;
};

export type AiBatchApplySummary = {
  totalTeams: number;
  aiEligibleTeams: number;
  skippedManual: number;
  skippedPassive: number;
  skippedDisabled: number;
  readyToSave: number;
  readyTeams: number;
  warningTeams: number;
  blockedTeams: number;
  wouldSave: number;
  savedTeams: number;
  skippedWarning: number;
  skippedBlocked: number;
  skippedExisting: number;
  existingLineups: number;
  wouldOverwrite: number;
  overwrittenExisting: number;
  plannedLineups: number;
  warnings: string[];
  blockingReasons: string[];
};

export type AiBatchApplyResult = {
  source: "sqlite";
  readOnly: false;
  dryRun: boolean;
  includeWarningTeams: boolean;
  totalTeams: number;
  results: AiBatchApplyTeamResult[];
  summary: AiBatchApplySummary;
};

type AiBatchApplyInput = {
  saveId: string;
  seasonId: string;
  matchdayId: string;
  includeWarningTeams?: boolean;
  overwriteExisting?: boolean;
  dryRun?: boolean;
};

function resolveLocalScope(input: AiBatchApplyInput, persistence: PersistenceService) {
  const bootstrapped = persistence.bootstrapSingleplayerSave();
  const save =
    persistence.getSaveById(input.saveId) ??
    persistence.getActiveSave() ??
    bootstrapped.save;

  if (!save) {
    throw new Error("No local save available for AI batch apply.");
  }

  return {
    saveId: save.saveId,
    seasonId: input.seasonId || save.gameState.season.id,
    matchdayId: input.matchdayId || save.gameState.matchdayState.matchdayId,
    teams: (() => {
      const settingsMap = buildTeamControlSettingsMap(
        save.gameState.teams,
        save.gameState.seasonState?.teamControlSettings,
      );

      return save.gameState.teams.map((team) => {
        const settings = settingsMap[team.teamId];
        const controlMode = settings?.controlMode ?? "manual";
        const aiEligible = controlMode === "ai" && isAiLineupBatchApplyEnabled(settings);

        return {
          teamId: team.teamId,
          teamCode: team.shortCode ?? team.teamId,
          teamName: team.name,
          controlMode,
          aiEligible,
        };
      });
    })(),
  };
}

function classifyPreviewStatus(status: AiLegacyLineupPreviewStatus) {
  if (status === "blocked") {
    return "blocked";
  }
  if (status === "ready") {
    return "ready";
  }
  return "warning";
}

function buildCaptainPreviewMeta(
  preview: Partial<{
    captainSlotsUsed: number;
    captainSlotsRemaining: number;
    d1: { captainSelectionStatus?: string | null } | null;
    d2: { captainSelectionStatus?: string | null } | null;
  }>,
) {
  return {
    captainSlotsUsed: preview.captainSlotsUsed ?? null,
    captainSlotsRemaining: preview.captainSlotsRemaining ?? null,
    d1CaptainSelectionStatus: preview.d1?.captainSelectionStatus ?? null,
    d2CaptainSelectionStatus: preview.d2?.captainSelectionStatus ?? null,
  };
}

export function applyAiLegacyLineupBatchLocally(
  input: AiBatchApplyInput,
  persistence: PersistenceService = createPersistenceService(),
): AiBatchApplyResult {
  const includeWarningTeams = input.includeWarningTeams ?? false;
  const overwriteExisting = input.overwriteExisting ?? false;
  const dryRun = input.dryRun ?? true;
  const scope = resolveLocalScope(input, persistence);
  const results: AiBatchApplyTeamResult[] = [];

  for (const team of scope.teams) {
    if (team.controlMode === "manual") {
      results.push({
        teamId: team.teamId,
        teamCode: team.teamCode,
        teamName: team.teamName,
        controlMode: team.controlMode,
        aiEligible: false,
        previewStatus: "blocked",
        captainSlotsUsed: null,
        captainSlotsRemaining: null,
        d1CaptainSelectionStatus: null,
        d2CaptainSelectionStatus: null,
        result: "skipped_manual",
        overwriteExisting: false,
        warnings: [],
        blockingReasons: ["team_control_mode_manual"],
        saved: false,
      });
      continue;
    }

    if (team.controlMode === "passive") {
      results.push({
        teamId: team.teamId,
        teamCode: team.teamCode,
        teamName: team.teamName,
        controlMode: team.controlMode,
        aiEligible: false,
        previewStatus: "blocked",
        captainSlotsUsed: null,
        captainSlotsRemaining: null,
        d1CaptainSelectionStatus: null,
        d2CaptainSelectionStatus: null,
        result: "skipped_passive",
        overwriteExisting: false,
        warnings: [],
        blockingReasons: ["team_control_mode_passive"],
        saved: false,
      });
      continue;
    }

    if (!team.aiEligible) {
      results.push({
        teamId: team.teamId,
        teamCode: team.teamCode,
        teamName: team.teamName,
        controlMode: team.controlMode,
        aiEligible: false,
        previewStatus: "blocked",
        captainSlotsUsed: null,
        captainSlotsRemaining: null,
        d1CaptainSelectionStatus: null,
        d2CaptainSelectionStatus: null,
        result: "skipped_disabled",
        overwriteExisting: false,
        warnings: [],
        blockingReasons: ["ai_lineup_apply_disabled"],
        saved: false,
      });
      continue;
    }

    const params: LegacyLineupKeyParams = {
      saveId: scope.saveId,
      seasonId: scope.seasonId,
      matchdayId: scope.matchdayId,
      teamId: team.teamId,
    };
    const contextResult = loadLocalLegacyLineupContext(params, persistence);

    if (!contextResult.ok) {
      results.push({
        teamId: team.teamId,
        teamCode: team.teamCode,
        teamName: team.teamName,
        controlMode: team.controlMode,
        aiEligible: team.aiEligible,
        previewStatus: "blocked",
        captainSlotsUsed: null,
        captainSlotsRemaining: null,
        d1CaptainSelectionStatus: null,
        d2CaptainSelectionStatus: null,
        result: "skipped_blocked",
        overwriteExisting: false,
        warnings: contextResult.warnings,
        blockingReasons: contextResult.errors,
        saved: false,
      });
      continue;
    }

    const preview = buildAiLegacyLineupPreview(contextResult.context, "sqlite");
    const validationPreview = calculateLocalLegacyLineupPreview(params, preview.entries, undefined, persistence);
    const existingDraft = getLocalLegacyLineupDraft(params, persistence);
    const hasExistingDraft = Boolean(existingDraft?.entries?.length);
    const statusKind = classifyPreviewStatus(preview.status);
    const baseWarnings = Array.from(new Set([...(preview.warnings ?? []), ...(validationPreview.ok ? validationPreview.validation.warnings : validationPreview.warnings)]));

    if (!validationPreview.ok || !validationPreview.validation.isValid) {
      const captainMeta = buildCaptainPreviewMeta(preview);
      results.push({
        teamId: preview.teamId,
        teamCode: preview.teamCode,
        teamName: preview.teamName,
        controlMode: team.controlMode,
        aiEligible: team.aiEligible,
        previewStatus: "validation_failed",
        ...captainMeta,
        result: "failed_validation",
        overwriteExisting: hasExistingDraft,
        warnings: baseWarnings,
        blockingReasons: validationPreview.ok ? validationPreview.validation.errors : validationPreview.errors,
        saved: false,
      });
      continue;
    }

    if (statusKind === "blocked") {
      const captainMeta = buildCaptainPreviewMeta(preview);
      results.push({
        teamId: preview.teamId,
        teamCode: preview.teamCode,
        teamName: preview.teamName,
        controlMode: team.controlMode,
        aiEligible: team.aiEligible,
        previewStatus: preview.status,
        ...captainMeta,
        result: "skipped_blocked",
        overwriteExisting: hasExistingDraft,
        warnings: baseWarnings,
        blockingReasons: preview.warnings,
        saved: false,
      });
      continue;
    }

    if (statusKind === "warning" && !includeWarningTeams) {
      const captainMeta = buildCaptainPreviewMeta(preview);
      results.push({
        teamId: preview.teamId,
        teamCode: preview.teamCode,
        teamName: preview.teamName,
        controlMode: team.controlMode,
        aiEligible: team.aiEligible,
        previewStatus: preview.status,
        ...captainMeta,
        result: "skipped_warning",
        overwriteExisting: hasExistingDraft,
        warnings: baseWarnings,
        blockingReasons: [],
        saved: false,
      });
      continue;
    }

    if (hasExistingDraft && !overwriteExisting) {
      const captainMeta = buildCaptainPreviewMeta(preview);
      results.push({
        teamId: preview.teamId,
        teamCode: preview.teamCode,
        teamName: preview.teamName,
        controlMode: team.controlMode,
        aiEligible: team.aiEligible,
        previewStatus: preview.status,
        ...captainMeta,
        result: "skipped_existing",
        overwriteExisting: true,
        warnings: baseWarnings,
        blockingReasons: ["existing_lineup_requires_overwrite_confirm"],
        saved: false,
      });
      continue;
    }

    if (dryRun) {
      const captainMeta = buildCaptainPreviewMeta(preview);
      results.push({
        teamId: preview.teamId,
        teamCode: preview.teamCode,
        teamName: preview.teamName,
        controlMode: team.controlMode,
        aiEligible: team.aiEligible,
        previewStatus: preview.status,
        ...captainMeta,
        result: "saved",
        overwriteExisting: hasExistingDraft,
        warnings: baseWarnings,
        blockingReasons: [],
        saved: false,
      });
      continue;
    }

      const saveResult = saveLocalLegacyLineupDraft(params, preview.entries, undefined, persistence);
    if (!saveResult.ok) {
      const captainMeta = buildCaptainPreviewMeta(preview);
      results.push({
        teamId: preview.teamId,
        teamCode: preview.teamCode,
        teamName: preview.teamName,
        controlMode: team.controlMode,
        aiEligible: team.aiEligible,
        previewStatus: preview.status,
        ...captainMeta,
        result: "failed_validation",
        overwriteExisting: hasExistingDraft,
        warnings: [...baseWarnings, ...saveResult.warnings],
        blockingReasons: saveResult.errors,
        saved: false,
      });
      continue;
    }

    const captainMeta = buildCaptainPreviewMeta(preview);
    results.push({
      teamId: preview.teamId,
      teamCode: preview.teamCode,
      teamName: preview.teamName,
      controlMode: team.controlMode,
      aiEligible: team.aiEligible,
      previewStatus: preview.status,
      ...captainMeta,
      result: "saved",
      overwriteExisting: hasExistingDraft,
      warnings: [...baseWarnings, ...saveResult.warnings],
      blockingReasons: [],
      saved: true,
    });
  }

  const summary: AiBatchApplySummary = {
    totalTeams: results.length,
    aiEligibleTeams: results.filter((entry) => entry.aiEligible).length,
    skippedManual: results.filter((entry) => entry.result === "skipped_manual").length,
    skippedPassive: results.filter((entry) => entry.result === "skipped_passive").length,
    skippedDisabled: results.filter((entry) => entry.result === "skipped_disabled").length,
    readyToSave: results.filter((entry) => entry.aiEligible && entry.previewStatus === "ready").length,
    readyTeams: results.filter((entry) => entry.previewStatus === "ready").length,
    warningTeams: results.filter((entry) => entry.previewStatus === "incomplete_roster" || entry.previewStatus === "missing_scores").length,
    blockedTeams: results.filter((entry) => entry.result === "skipped_blocked" || entry.result === "failed_validation").length,
    wouldSave: results.filter((entry) => dryRun && entry.result === "saved").length,
    savedTeams: results.filter((entry) => !dryRun && entry.saved).length,
    skippedWarning: results.filter((entry) => entry.result === "skipped_warning").length,
    skippedBlocked: results.filter((entry) => entry.result === "skipped_blocked" || entry.result === "failed_validation").length,
    skippedExisting: results.filter((entry) => entry.result === "skipped_existing").length,
    existingLineups: results.filter((entry) => entry.overwriteExisting).length,
    wouldOverwrite: results.filter((entry) => entry.overwriteExisting && entry.result === "saved").length,
    overwrittenExisting: results.filter((entry) => entry.overwriteExisting && (dryRun ? entry.result === "saved" : entry.saved)).length,
    plannedLineups: results.filter((entry) => dryRun ? entry.result === "saved" : entry.saved).length,
    warnings: Array.from(new Set(results.flatMap((entry) => entry.warnings))),
    blockingReasons: Array.from(new Set(results.flatMap((entry) => entry.blockingReasons))),
  };

  return {
    source: "sqlite",
    readOnly: false,
    dryRun,
    includeWarningTeams,
    totalTeams: results.length,
    results,
    summary,
  };
}
