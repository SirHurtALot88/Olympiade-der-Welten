export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { AI_MARKET_APPLY_CONFIRM_TOKEN } from "@/lib/ai/ai-market-plan-apply-contract";
import { applyAiMarketPlanLocally } from "@/lib/ai/ai-market-plan-apply-service";
import { applyAiManagerPlan, type AiManagerAction, type AiManagerActionType } from "@/lib/ai/ai-manager-apply-service";
import { buildAiActionBreakdown } from "@/lib/ai/ai-action-breakdown";
import { AI_PRESEASON_RUN_STALE_MS } from "@/lib/ai/ai-preseason-run-timing";
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
import { parseRoomWriteContextFromRequestAndBody } from "@/lib/room/parse-room-write-context";
import { authorizeServerRoomWrite } from "@/lib/room/server-authoritative-write-guard";

// Roster-abhängige Manager-Aktionen: Training/Einsatzlisten-Setup braucht Spieler im Kader. Im Setup-Draft
// (Season 1, frische Teams) sind die Kader zu Beginn LEER — laufen diese Aktionen vor dem Draft, werden sie
// alle mit `team_roster_empty` blockiert (das vom Owner beobachtete „120 blockiert"). Daher werden sie
// bewusst NACH dem Draft ausgeführt.
const ROSTER_DEPENDENT_MANAGER_ACTIONS: AiManagerActionType[] = [
  "set_training_focus",
  "set_training_intensity",
  "set_player_training_modes",
  "set_player_training_classes",
];

// Vor-Draft-Aktionen: Budget-Reservierung, Gebäude, Strategie-Marker — hängen NICHT vom Kader ab und dürfen
// (bzw. sollen, damit der Draft das reservierte Budget nutzt) vor dem Draft laufen.
const PRE_DRAFT_MANAGER_ACTIONS: AiManagerActionType[] = [
  "reserve_transfer_budget",
  "reserve_salary_budget",
  "reserve_maintenance_budget",
  "maintain_building",
  "upgrade_building",
  "buy_building",
  "mark_contract_strategy",
  "mark_sell_strategy",
];

// Season-Market-Modus (Kader existieren bereits): eine Runde mit allen Aktionen.
const ALL_PRESEASON_MANAGER_ACTIONS: AiManagerActionType[] = [
  ...PRE_DRAFT_MANAGER_ACTIONS,
  ...ROSTER_DEPENDENT_MANAGER_ACTIONS,
];

const inFlightRunKeys = new Set<string>();

function claimPreseasonRunKey(runKey: string) {
  if (inFlightRunKeys.has(runKey)) {
    return false;
  }
  inFlightRunKeys.add(runKey);
  return true;
}

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
  // Schwelle über der realen ~131 s-Laufzeit (siehe AI_PRESEASON_RUN_STALE_MS), damit ein echt laufender
  // 31-Team-Draft nicht fälschlich als stale gilt und der Server keinen Duplikat-Lauf startet.
  return Date.now() - started > AI_PRESEASON_RUN_STALE_MS;
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
}): Promise<AiPreseasonAutomationRunRecord> {
  const { saveId, seasonId, baseRecord, aiTeamIds, setupDraftMode, protectedSave } = input;
  const persistence = createPersistenceService();

  try {
    const latestBeforeManager = persistence.getSaveById(saveId) ?? protectedSave;

    if (setupDraftMode) {
      // REIHENFOLGE-FIX: Im Setup-Draft (frische Teams, leere Kader) MUSS erst der Draft die Kader füllen,
      // bevor Training/Einsatzlisten-Setup läuft — sonst blockiert jede dieser Aktionen mit
      // `team_roster_empty` (das vom Owner beobachtete „120 blockiert"). Ablauf:
      //   1) Vor-Draft-Manageraktionen (Budget/Gebäude/Strategie, kader-unabhängig)
      //   2) Draft pro Team (füllt die Kader)
      //   3) roster-abhängiges Training/Setup ERST DANACH, gegen den frischen Save mit gefüllten Kadern
      const preDraftManager = applyAiManagerPlan({
        save: latestBeforeManager,
        dryRun: false,
        teamIds: aiTeamIds,
        actionTypes: PRE_DRAFT_MANAGER_ACTIONS,
        persistence,
      });

      let completedTeams = 0;
      let transferBuysApplied = 0;
      let managerActionsApplied = preDraftManager.actions.filter((action) => action.applied).length;
      const warnings = [...preDraftManager.warnings];
      const blockingReasons = [...preDraftManager.blockers];
      // Kategorie-Aufstellung (angewandt/blockiert) über alle Manager-Runden hinweg sammeln,
      // damit das Diagnose-UI angewandt vs. blockiert je Kategorie ohne Neu-Ableitung zeigen kann.
      let managerActions: AiManagerAction[] = [...preDraftManager.actions];

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
          managerActionsApplied,
          transferBuysApplied,
          transferSellsApplied: 0,
          warnings: Array.from(new Set(warnings)),
          blockingReasons: Array.from(new Set(blockingReasons)),
        });
      }

      // 3) Training/Einsatzlisten-Setup ERST, wenn ALLE AI-Teams einen gefüllten Kader haben (Owner-Wunsch).
      //    Ist der Draft unvollständig (Bug/Kadertiefe), wird das Training NICHT gefeuert — es würde nur mit
      //    `team_roster_empty` blockieren. Stattdessen bleibt es aufgeschoben: der Owner kann nachpicken und
      //    den Preseason-Lauf erneut anstoßen, dann greift Schritt 3 sauber.
      if (completedTeams >= aiTeamIds.length) {
        const latestAfterPicks = persistence.getSaveById(saveId) ?? latestBeforeManager;
        const trainingManager = applyAiManagerPlan({
          save: latestAfterPicks,
          dryRun: false,
          teamIds: aiTeamIds,
          actionTypes: ROSTER_DEPENDENT_MANAGER_ACTIONS,
          persistence,
        });
        managerActionsApplied += trainingManager.actions.filter((action) => action.applied).length;
        managerActions = [...managerActions, ...trainingManager.actions];
        warnings.push(...trainingManager.warnings);
        blockingReasons.push(...trainingManager.blockers);
      } else {
        // Aufgeschoben, damit die 120 „team_roster_empty"-Blocker nicht mehr entstehen; klare Meldung fürs UI.
        warnings.push("setup_draft_training_deferred_until_rosters_complete");
      }

      const finalRecord: AiPreseasonAutomationRunRecord = {
        ...baseRecord,
        status: completedTeams >= aiTeamIds.length ? "completed" : "failed",
        completedAt: nowIso(),
        aiTeamsCompleted: completedTeams,
        managerActionsApplied,
        transferBuysApplied,
        transferSellsApplied: 0,
        warnings: Array.from(new Set(warnings)),
        blockingReasons: Array.from(new Set(blockingReasons)),
        actionBreakdown: buildAiActionBreakdown(managerActions),
      };
      writeRunRecord(saveId, finalRecord);
      return finalRecord;
    }

    // Season-Market-Modus: Kader existieren bereits → alle Manager-Aktionen in einer Runde, dann Markt.
    const managerResult = applyAiManagerPlan({
      save: latestBeforeManager,
      dryRun: false,
      teamIds: aiTeamIds,
      actionTypes: ALL_PRESEASON_MANAGER_ACTIONS,
      persistence,
    });

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
      actionBreakdown: buildAiActionBreakdown(managerResult.actions),
    };
    writeRunRecord(saveId, finalRecord);
    return finalRecord;
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
    return failedRecord;
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

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const writeAuth = authorizeServerRoomWrite({
    ...parseRoomWriteContextFromRequestAndBody(request, body),
    saveId,
    action: "ai_preseason_background",
    source: "sqlite",
    dryRun: false,
  });
  if (!writeAuth.allowed) {
    return NextResponse.json({ error: writeAuth.reason, warnings: writeAuth.warnings }, { status: writeAuth.status });
  }

  const runKey = buildRunKey(saveId, seasonId);
  if (!claimPreseasonRunKey(runKey)) {
    const latestRun = persistence.getSaveById(saveId)?.gameState.seasonState.aiPreseasonAutomationRuns?.[seasonId] ?? null;
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "ai_preseason_already_running",
      run: latestRun,
    });
  }

  let handedToExecute = false;

  try {
    const freshSave = persistence.getSaveById(saveId);
    if (!freshSave) {
      return NextResponse.json({ error: `Save ${saveId} not found.` }, { status: 404 });
    }

    const existingRun = freshSave.gameState.seasonState.aiPreseasonAutomationRuns?.[seasonId] ?? null;
    if (
      existingRun?.status === "completed" ||
      (existingRun?.status === "running" && !isStaleRunningRun(existingRun))
    ) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: existingRun?.status === "running" ? "ai_preseason_already_running" : "ai_preseason_already_completed",
        run: existingRun,
      });
    }

    const skipManualProtection = allowsAiPreseasonManualTeamOverride({
      saveId,
      gameState: freshSave.gameState,
    });
    const protectedGameState = skipManualProtection ? freshSave.gameState : protectManualPlayerTeams(freshSave.gameState);
    const protectedSave =
      protectedGameState === freshSave.gameState
        ? freshSave
        : persistence.saveSingleplayerState(freshSave.saveId, protectedGameState, { status: freshSave.status });
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

    const latestBeforeStart = persistence.getSaveById(saveId);
    const runningRecord = latestBeforeStart?.gameState.seasonState.aiPreseasonAutomationRuns?.[seasonId] ?? null;
    if (runningRecord?.status === "running" && !isStaleRunningRun(runningRecord)) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "ai_preseason_already_running",
        run: runningRecord,
      });
    }

    writeRunRecord(saveId, baseRecord);
    handedToExecute = true;
    const finalRun = await executeAiPreseasonBackgroundWork({
      saveId,
      seasonId,
      baseRecord,
      aiTeamIds,
      setupDraftMode,
      protectedSave,
    });

    const succeeded = finalRun.status === "completed";
    return NextResponse.json(
      {
        ok: succeeded,
        skipped: false,
        run: finalRun,
      },
      { status: succeeded ? 200 : 500 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "AI preseason background failed.",
      },
      { status: 500 },
    );
  } finally {
    if (!handedToExecute) {
      inFlightRunKeys.delete(runKey);
    }
  }
}
