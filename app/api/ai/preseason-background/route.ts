export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { AI_MARKET_APPLY_CONFIRM_TOKEN } from "@/lib/ai/ai-market-plan-apply-contract";
import { applyAiMarketPlanLocally } from "@/lib/ai/ai-market-plan-apply-service";
import { applyAiManagerPlan } from "@/lib/ai/ai-manager-apply-service";
import { AI_PICKS_RUN_CONFIRM_TOKEN } from "@/lib/ai/ai-picks-run-contract";
import { runAiPicksExecutePreview } from "@/lib/ai/ai-picks-run-service";
import type { AiPreseasonAutomationRunRecord, GameState } from "@/lib/data/olyDataTypes";
import {
  allowsAiPreseasonManualTeamOverride,
  getProtectedHumanTeamIds,
  protectManualPlayerTeams,
} from "@/lib/ai/ai-preseason-manual-team-guard";
import { buildTeamControlSettingsMap } from "@/lib/foundation/team-control-settings";
import { LOCAL_TRANSFER_WINDOW_PHASE } from "@/lib/market/transfer-window-policy";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import type { PersistenceService } from "@/lib/persistence/types";
import { parseRoomWriteContextFromRequest } from "@/lib/room/parse-room-write-context";
import { authorizeServerRoomWrite } from "@/lib/room/server-authoritative-write-guard";

const inFlightRunKeys = new Set<string>();

function nowIso() {
  return new Date().toISOString();
}

function buildRunKey(saveId: string, seasonId: string) {
  return `${saveId}:${seasonId}`;
}

function getAiTeamIds(gameState: GameState) {
  const control = buildTeamControlSettingsMap(gameState.teams, gameState.seasonState.teamControlSettings);
  const protectedHumanTeamIds = getProtectedHumanTeamIds(gameState);
  return gameState.teams
    .filter((team) => control[team.teamId]?.controlMode === "ai" && !protectedHumanTeamIds.has(team.teamId))
    .map((team) => team.teamId);
}

function isStaleRunningRun(run: AiPreseasonAutomationRunRecord | null) {
  if (run?.status !== "running") return false;
  const started = Date.parse(run.startedAt);
  if (!Number.isFinite(started)) return true;
  return Date.now() - started > 120_000;
}

function getSetupRosterTarget(gameState: GameState, teamId: string) {
  const identity = gameState.teamIdentities.find((entry) => entry.teamId === teamId);
  const team = gameState.teams.find((entry) => entry.teamId === teamId);
  return Math.max(1, identity?.playerMin ?? identity?.playerOpt ?? team?.rosterLimit ?? 12);
}

function shouldRunSetupDraft(gameState: GameState, teamIds: string[]) {
  if (gameState.season.id !== "season-1") return false;
  if (gameState.gamePhase && gameState.gamePhase !== "preseason_management") return false;
  if (gameState.seasonState.newGameFlow?.active === false) return false;

  return teamIds.some((teamId) => {
    const rosterCount = gameState.rosters.filter((entry) => entry.teamId === teamId).length;
    return rosterCount < getSetupRosterTarget(gameState, teamId);
  });
}

function writeRunRecord(saveId: string, record: AiPreseasonAutomationRunRecord) {
  const persistence = createPersistenceService();
  const latest = persistence.getSaveById(saveId);
  if (!latest) return null;
  const nextGameState: GameState = {
    ...latest.gameState,
    seasonState: {
      ...latest.gameState.seasonState,
      aiPreseasonAutomationRuns: {
        ...(latest.gameState.seasonState.aiPreseasonAutomationRuns ?? {}),
        [record.seasonId]: record,
      },
    },
  };
  return persistence.saveSingleplayerState(saveId, nextGameState, { status: latest.status });
}

async function executeAiPreseasonBackgroundWork(input: {
  saveId: string;
  seasonId: string;
  baseRecord: AiPreseasonAutomationRunRecord;
  aiTeamIds: string[];
  setupDraftMode: boolean;
  protectedSave: NonNullable<ReturnType<PersistenceService["getSaveById"]>>;
}) {
  const { saveId, seasonId, baseRecord, aiTeamIds, setupDraftMode, protectedSave } = input;
  const persistence = createPersistenceService();

  try {
    const latestBeforeManager = persistence.getSaveById(saveId) ?? protectedSave;
    const managerResult = applyAiManagerPlan({
      save: latestBeforeManager,
      dryRun: false,
      teamIds: aiTeamIds,
      actionTypes: [
        "reserve_transfer_budget",
        "reserve_salary_budget",
        "reserve_maintenance_budget",
        "maintain_building",
        "upgrade_building",
        "buy_building",
        "set_training_focus",
        "set_training_intensity",
        "set_player_training_modes",
        "mark_contract_strategy",
        "mark_sell_strategy",
      ],
      persistence,
    });

    if (setupDraftMode) {
      let completedTeams = 0;
      let transferBuysApplied = 0;
      const warnings = [...managerResult.warnings];
      const blockingReasons = [...managerResult.blockers];

      for (const teamId of aiTeamIds) {
        const picksRun = await runAiPicksExecutePreview(
          {
            source: "sqlite",
            saveId,
            seasonId,
            dryRun: false,
            confirmToken: AI_PICKS_RUN_CONFIRM_TOKEN,
            teamScope: "ai",
            teamIds: [teamId],
            stepsPerTeam: 12,
            runMode: "season1_optimum_execute",
            draftSeed: `${saveId}:${seasonId}:preseason:${teamId}`,
          },
          persistence,
        );
        const teamCompleted = picksRun.teams.some((team) => {
          if (team.teamId !== teamId || team.blockingReasons.length > 0) {
            return false;
          }
          const rosterAfter = team.rosterAfter ?? team.previewSummary.plannedRosterCount ?? 0;
          return team.targetRosterMin == null || rosterAfter >= team.targetRosterMin;
        });
        const appliedPickCount = picksRun.globalExecution.appliedPickCount;
        if (teamCompleted) completedTeams += 1;
        transferBuysApplied += appliedPickCount;
        warnings.push(...picksRun.warnings);
        blockingReasons.push(...picksRun.blockingReasons);
        writeRunRecord(saveId, {
          ...baseRecord,
          status: "running",
          completedAt: null,
          aiTeamsCompleted: completedTeams,
          managerActionsApplied: managerResult.actions.filter((action) => action.applied).length,
          transferBuysApplied,
          transferSellsApplied: 0,
          warnings: Array.from(new Set(warnings)),
          blockingReasons: Array.from(new Set(blockingReasons)),
        });
      }

      const finalRecord: AiPreseasonAutomationRunRecord = {
        ...baseRecord,
        status: completedTeams >= aiTeamIds.length ? "completed" : "failed",
        completedAt: nowIso(),
        aiTeamsCompleted: completedTeams,
        managerActionsApplied: managerResult.actions.filter((action) => action.applied).length,
        transferBuysApplied,
        transferSellsApplied: 0,
        warnings: Array.from(new Set(warnings)),
        blockingReasons: Array.from(new Set(blockingReasons)),
      };
      writeRunRecord(saveId, finalRecord);
      return;
    }

    const market = await applyAiMarketPlanLocally({
      source: "sqlite",
      saveId,
      seasonId,
      teamScope: "ai",
      dryRun: false,
      includeWarningTeams: false,
      confirmToken: AI_MARKET_APPLY_CONFIRM_TOKEN,
      transferPhase: LOCAL_TRANSFER_WINDOW_PHASE,
      options: {
        includeWarningTeams: false,
        stopOnTeamFailure: false,
      },
    });
    const completedTeams = market.results.filter(
      (team) => team.result !== "blocked" && team.result !== "failed_buy" && team.result !== "failed_sell",
    ).length;
    const finalRecord: AiPreseasonAutomationRunRecord = {
      ...baseRecord,
      status: market.status === "blocked" ? "failed" : "completed",
      completedAt: nowIso(),
      aiTeamsCompleted: completedTeams,
      managerActionsApplied: managerResult.actions.filter((action) => action.applied).length,
      transferBuysApplied: market.summary.appliedBuys,
      transferSellsApplied: market.summary.appliedSells,
      warnings: [...managerResult.warnings, ...market.warnings],
      blockingReasons: [...managerResult.blockers, ...market.blockingReasons],
    };
    writeRunRecord(saveId, finalRecord);
  } catch (error) {
    const failedRecord: AiPreseasonAutomationRunRecord = {
      ...baseRecord,
      status: "failed",
      completedAt: nowIso(),
      warnings: [],
      blockingReasons: [error instanceof Error ? error.message : "ai_preseason_background_failed"],
    };
    writeRunRecord(saveId, failedRecord);
    console.error("AI preseason background failed.", error);
  } finally {
    inFlightRunKeys.delete(buildRunKey(saveId, seasonId));
  }
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const saveId = searchParams.get("saveId")?.trim() ?? "";
  const seasonId = searchParams.get("seasonId")?.trim() ?? "";
  const source = searchParams.get("source")?.trim() === "prisma" ? "prisma" : "sqlite";

  if (!saveId || !seasonId) {
    return NextResponse.json({ error: "saveId and seasonId are required." }, { status: 400 });
  }

  if (source === "prisma") {
    return NextResponse.json({ error: "Prisma/Supabase mode is read-only in this build." }, { status: 409 });
  }

  const persistence = createPersistenceService();
  const save = persistence.getSaveById(saveId);
  if (!save) {
    return NextResponse.json({ error: `Save ${saveId} not found.` }, { status: 404 });
  }
  if (save.gameState.season.id !== seasonId) {
    return NextResponse.json({ error: `Season ${seasonId} is not active in save ${saveId}.` }, { status: 409 });
  }

  const writeAuth = authorizeServerRoomWrite({
    ...parseRoomWriteContextFromRequest(request),
    saveId,
    action: "ai_preseason_background",
    source: "sqlite",
    dryRun: false,
  });
  if (!writeAuth.allowed) {
    return NextResponse.json({ error: writeAuth.reason, warnings: writeAuth.warnings }, { status: writeAuth.status });
  }

  const runKey = buildRunKey(saveId, seasonId);
  const existingRun = save.gameState.seasonState.aiPreseasonAutomationRuns?.[seasonId] ?? null;
  if (
    existingRun?.status === "completed" ||
    inFlightRunKeys.has(runKey) ||
    (existingRun?.status === "running" && !isStaleRunningRun(existingRun))
  ) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason:
        existingRun?.status === "running" || inFlightRunKeys.has(runKey)
          ? "ai_preseason_already_running"
          : "ai_preseason_already_completed",
      run: existingRun,
    });
  }

  const skipManualProtection = allowsAiPreseasonManualTeamOverride({
    saveId,
    gameState: save.gameState,
  });
  const protectedGameState = skipManualProtection ? save.gameState : protectManualPlayerTeams(save.gameState);
  const protectedSave =
    protectedGameState === save.gameState
      ? save
      : persistence.saveSingleplayerState(save.saveId, protectedGameState, { status: save.status });
  const aiTeamIds = getAiTeamIds(protectedSave.gameState);
  const startedAt = nowIso();
  const setupDraftMode = shouldRunSetupDraft(protectedSave.gameState, aiTeamIds);
  const baseRecord: AiPreseasonAutomationRunRecord = {
    runId: `ai-preseason-${saveId}-${seasonId}-${Date.now()}`,
    seasonId,
    status: aiTeamIds.length === 0 ? "skipped" : "running",
    mode: aiTeamIds.length === 0 ? "none" : setupDraftMode ? "setup_draft" : "season_market",
    startedAt,
    completedAt: null,
    aiTeamsTotal: aiTeamIds.length,
    aiTeamsCompleted: 0,
    managerActionsApplied: 0,
    transferBuysApplied: 0,
    transferSellsApplied: 0,
    warnings: [],
    blockingReasons: [],
  };

  if (aiTeamIds.length === 0) {
    const skippedRecord: AiPreseasonAutomationRunRecord = { ...baseRecord, completedAt: nowIso() };
    writeRunRecord(saveId, skippedRecord);
    return NextResponse.json({ ok: true, skipped: true, reason: "no_ai_teams", run: skippedRecord });
  }

  writeRunRecord(saveId, baseRecord);
  inFlightRunKeys.add(runKey);
  void executeAiPreseasonBackgroundWork({
    saveId,
    seasonId,
    baseRecord,
    aiTeamIds,
    setupDraftMode,
    protectedSave,
  });

  return NextResponse.json(
    {
      ok: true,
      skipped: false,
      accepted: true,
      run: baseRecord,
    },
    { status: 202 },
  );
}
