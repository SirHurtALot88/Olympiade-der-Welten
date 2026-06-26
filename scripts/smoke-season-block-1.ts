import { buildGameFlowState } from "@/lib/foundation/game-flow-controller";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { loadLocalLegacyLineupContext } from "@/lib/lineups/legacy-lineup-local-service";
import { listLocalTransfermarktFreeAgents } from "@/lib/market/transfermarkt-local-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import {
  runLocalMatchdayAutoRun,
  MATCHDAY_AUTO_RUN_CONFIRM_TOKEN,
} from "@/lib/season/matchday-auto-run-service";
import { ADVANCE_MATCHDAY_CONFIRM_TOKEN, executeMatchdayAdvance } from "@/lib/season/matchday-progress-service";
import {
  runLocalSeasonCompletion,
  SEASON_COMPLETION_CONFIRM_TOKEN,
} from "@/lib/season/season-completion-service";
import {
  applyPreSeasonNextSeasonSetupLightweight,
  buildPreSeasonNextSeasonSetupToken,
} from "@/lib/season/preseason-workflow-service";

function requireValue<T>(value: T | null | undefined, message: string): T {
  if (value == null) throw new Error(message);
  return value;
}

function resolveMaxRequiredSeasonRosterSize(saveId: string, seasonId: string) {
  const persistence = createPersistenceService();
  const save = requireValue(persistence.getSaveById(saveId), `Save ${saveId} missing.`);
  let maxRequiredUniquePlayers = 0;

  for (const matchdayId of save.gameState.season.matchdayIds) {
    const contextResult = loadLocalLegacyLineupContext({
      saveId,
      seasonId,
      matchdayId,
      teamId: save.gameState.teams[0]!.teamId,
    });
    if (!contextResult.ok) {
      throw new Error(`Lineup context failed for ${matchdayId}: ${contextResult.errors.join(" | ")}`);
    }
    maxRequiredUniquePlayers = Math.max(
      maxRequiredUniquePlayers,
      (contextResult.context.matchdayContract?.discipline1?.requiredPlayers ?? 0) +
        (contextResult.context.matchdayContract?.discipline2?.requiredPlayers ?? 0),
    );
  }

  return maxRequiredUniquePlayers;
}

function topUpRostersForLineups(saveId: string, seasonId: string) {
  const persistence = createPersistenceService();
  const save = requireValue(persistence.getSaveById(saveId), `Save ${saveId} missing.`);
  const requiredUniquePlayers = resolveMaxRequiredSeasonRosterSize(saveId, seasonId);
  const usedPlayerIds = new Set(save.gameState.rosters.map((entry) => entry.playerId));
  const freePlayers = save.gameState.players.filter((player) => !usedPlayerIds.has(player.id));
  let poolIndex = 0;
  let rosterCounter = save.gameState.rosters.length;
  let changed = false;

  for (const team of save.gameState.teams) {
    const teamRoster = save.gameState.rosters.filter((entry) => entry.teamId === team.teamId);
    const shortfall = Math.max(0, requiredUniquePlayers - teamRoster.length);
    for (let index = 0; index < shortfall; index += 1) {
      const player = freePlayers[poolIndex];
      if (!player) throw new Error("Not enough free players to top up rosters for Block 1 smoke.");
      const economy = resolvePlayerEconomyContract({ player });
      const salary = economy.salary ?? player.displaySalary ?? player.salaryDemand;
      const marketValue = economy.purchasePrice ?? economy.marketValue ?? player.displayMarketValue ?? player.marketValue;
      poolIndex += 1;
      save.gameState.rosters.push({
        id: `block-1-auto-roster-${rosterCounter}`,
        teamId: team.teamId,
        playerId: player.id,
        contractLength: 3,
        salary: Math.round(salary),
        upkeep: Math.round(salary),
        purchasePrice: Math.round(marketValue),
        currentValue: Math.round(marketValue),
        roleTag: "bench",
        joinedSeasonId: seasonId,
      });
      rosterCounter += 1;
      changed = true;
    }
  }

  if (changed) persistence.saveSingleplayerState(save.saveId, save.gameState);
}

function countLineupSystemUsage(saveId: string, seasonId: string) {
  const persistence = createPersistenceService();
  const save = requireValue(persistence.getSaveById(saveId), `Save ${saveId} missing.`);
  const drafts = (save.gameState.seasonState.lineupDrafts ?? []).filter((draft) => draft.seasonId === seasonId);
  const modifierSides = drafts.flatMap((draft) => [draft.modifiers?.d1, draft.modifiers?.d2]);
  return {
    drafts: drafts.length,
    submittedDrafts: drafts.filter((draft) => draft.status === "submitted" || draft.status === "locked" || draft.status === "resolved").length,
    entries: drafts.reduce((sum, draft) => sum + draft.entries.length, 0),
    captainSlots: drafts.reduce((sum, draft) => sum + draft.entries.filter((entry) => entry.isCaptain).length, 0),
    primaryFormCards: modifierSides.filter((side) => side?.primaryFormCardId).length,
    secondaryFormCards: modifierSides.filter((side) => side?.secondaryFormCardId).length,
    teamPowers: modifierSides.filter((side) => side?.teamPowerId).length,
    mutatorTraits: modifierSides.reduce((sum, side) => sum + (side?.mutatorTrait1 ? 1 : 0) + (side?.mutatorTrait2 ? 1 : 0), 0),
    pushSides: modifierSides.filter((side) => side?.intensity === "push").length,
    normalSides: modifierSides.filter((side) => !side?.intensity || side.intensity === "normal").length,
    conserveSides: modifierSides.filter((side) => side?.intensity === "conserve").length,
  };
}

function logProgress(message: string) {
  console.error(`[block-1-smoke] ${message}`);
}

function metricNumber(metrics: Record<string, unknown> | undefined, key: string) {
  const value = metrics?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function sumNumbers(values: Array<number | null>) {
  return values.reduce((sum, value) => sum + (value ?? 0), 0);
}

function averageNumbers(values: Array<number | null>) {
  const usable = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (usable.length === 0) return null;
  return Math.round(sumNumbers(usable) / usable.length);
}

async function main() {
  const persistence = createPersistenceService();
  const previousActiveSave = persistence.getActiveSave();
  const createdSave = persistence.createFreshSeasonOneSave({
    name: `Block 1 Full Season Smoke ${new Date().toISOString()}`,
  });
  const saveId = createdSave.saveId;
  const seasonId = createdSave.gameState.season.id;

  try {
    topUpRostersForLineups(saveId, seasonId);
    const setupSave = requireValue(persistence.getSaveById(saveId), "Smoke save missing after roster setup.");
    setupSave.gameState.seasonState.teamControlSettings = Object.fromEntries(
      setupSave.gameState.teams.map((team) => [
        team.teamId,
        {
          teamId: team.teamId,
          controlMode: "ai",
          aiLineupPreviewEnabled: true,
          aiLineupApplyEnabled: true,
          aiLineupAutoApplyEnabled: false,
          aiTransferPreviewEnabled: false,
          aiTransferAutoApplyEnabled: false,
          aiSellPreviewEnabled: false,
          aiSellAutoApplyEnabled: false,
          notes: null,
          strategyLock: null,
        },
      ]),
    );
    persistence.saveSingleplayerState(saveId, setupSave.gameState);

    const matchdaySummaries: Array<{
      matchdayId: string;
      status: string;
      aiLineups: number;
      resultApply: string | null;
      standingsApply: string | null;
      advanced: boolean;
      elapsedMs: number;
      aiBatchTotalMs: number | null;
      aiContextLoadMs: number | null;
      aiLineupGenerationMs: number | null;
      aiSaveWriteMs: number | null;
      resultApplyTotalMs: number | null;
      resultResolvePreviewMs: number | null;
      resultSaveWriteMs: number | null;
      standingsObjectiveRefreshMs: number | null;
    }> = [];

    for (let index = 0; index < setupSave.gameState.season.matchdayIds.length; index += 1) {
      const currentSave = requireValue(persistence.getSaveById(saveId), "Smoke save missing during matchday loop.");
      const matchdayId = currentSave.gameState.matchdayState.matchdayId;
      const startedAt = Date.now();
      logProgress(`Spieltag ${index + 1}/${setupSave.gameState.season.matchdayIds.length} startet (${matchdayId}).`);
      const autoRun = await runLocalMatchdayAutoRun(
        {
          saveId,
          seasonId,
          matchdayId,
          source: "sqlite",
          execute: true,
          dryRun: false,
          confirmToken: MATCHDAY_AUTO_RUN_CONFIRM_TOKEN,
          options: {
            includeWarningLineups: true,
            overwriteExistingLineups: true,
            stopOnTie: false,
            advanceAfterCashApply: false,
          },
        },
        persistence,
      );
      if (!autoRun.ok) {
        throw new Error(`Matchday ${matchdayId} blocked: ${autoRun.blockingReasons.join(" | ")}`);
      }

      const advance = await executeMatchdayAdvance(
        {
          saveId,
          seasonId,
          source: "sqlite",
          execute: true,
          confirm: ADVANCE_MATCHDAY_CONFIRM_TOKEN,
        },
        persistence,
      );
      if (!advance.ok || !advance.applied) {
        throw new Error(`Advance after ${matchdayId} blocked: ${advance.blockingReasons.join(" | ")}`);
      }

      const aiStep = autoRun.steps.find((step) => step.key === "ai_lineups");
      const resultStep = autoRun.steps.find((step) => step.key === "result_apply");
      const elapsedMs = Date.now() - startedAt;
      matchdaySummaries.push({
        matchdayId,
        status: autoRun.status,
        aiLineups: autoRun.appliedAudits.aiLineupTeamsSaved,
        resultApply: autoRun.appliedAudits.resultApply,
        standingsApply: autoRun.appliedAudits.standingsApply,
        advanced: true,
        elapsedMs,
        aiBatchTotalMs: metricNumber(aiStep?.metrics, "aiBatchTotalMs"),
        aiContextLoadMs: metricNumber(aiStep?.metrics, "aiContextLoadMs"),
        aiLineupGenerationMs: metricNumber(aiStep?.metrics, "aiLineupGenerationMs"),
        aiSaveWriteMs: metricNumber(aiStep?.metrics, "aiSaveWriteMs"),
        resultApplyTotalMs: metricNumber(resultStep?.metrics, "resultApplyTotalMs"),
        resultResolvePreviewMs: metricNumber(resultStep?.metrics, "resolvePreviewMs"),
        resultSaveWriteMs: metricNumber(resultStep?.metrics, "saveWriteMs"),
        standingsObjectiveRefreshMs: metricNumber(resultStep?.metrics, "standingsObjectiveRefreshMs"),
      });
      logProgress(
        `Spieltag ${index + 1} fertig: status=${autoRun.status}, lineups=${autoRun.appliedAudits.aiLineupTeamsSaved}, advanced=true, ${elapsedMs}ms.`,
      );
    }

    const beforeCompletion = requireValue(persistence.getSaveById(saveId), "Smoke save missing before completion.");
    const lineupUsage = countLineupSystemUsage(saveId, seasonId);
    logProgress("Season Completion startet.");
    const completion = await runLocalSeasonCompletion(
      {
        saveId,
        seasonId,
        source: "sqlite",
        execute: true,
        dryRun: false,
        confirmToken: SEASON_COMPLETION_CONFIRM_TOKEN,
      },
      persistence,
    );
    if (!completion.ok || !completion.applied) {
      throw new Error(`Season completion blocked: ${completion.blockingReasons.join(" | ")}`);
    }

    const reviewSave = requireValue(persistence.getSaveById(saveId), "Smoke save missing after completion.");
    logProgress("Next Season Setup startet.");
    const nextSeasonToken = buildPreSeasonNextSeasonSetupToken(reviewSave).confirmToken;
    const nextSeason = applyPreSeasonNextSeasonSetupLightweight(reviewSave, nextSeasonToken, persistence);
    if (!nextSeason.applied) {
      throw new Error(`Next season setup blocked: ${nextSeason.blockingReasons.join(" | ")}`);
    }

    const finalSave = requireValue(persistence.getSaveById(saveId), "Smoke save missing after next season setup.");
    const activeTeamId = finalSave.gameState.teams[0]?.teamId ?? null;
    const flow = buildGameFlowState({ gameState: finalSave.gameState, activeTeamId });
    const freeAgents = activeTeamId
      ? listLocalTransfermarktFreeAgents({
          saveId,
          seasonId: finalSave.gameState.season.id,
          teamId: activeTeamId,
          limit: 10,
        })
      : { total: 0 };
    const nextSeasonState = finalSave.gameState.seasonState;
    const previousSeasonSnapshot = nextSeasonState.seasonSnapshots?.find((snapshot) => snapshot.seasonId === seasonId) ?? null;
    const relationshipEvents = nextSeasonState.teamRelationshipEvents?.filter((event) => event.seasonId === seasonId) ?? [];
    const progressionEvents = finalSave.gameState.playerProgressionEvents?.filter((event) => event.seasonId === seasonId) ?? [];

    const blockers = [
      matchdaySummaries.length !== beforeCompletion.gameState.season.matchdayIds.length ? "not_all_matchdays_played" : null,
      lineupUsage.drafts < beforeCompletion.gameState.teams.length * beforeCompletion.gameState.season.matchdayIds.length ? "lineup_drafts_missing" : null,
      lineupUsage.primaryFormCards <= 0 ? "form_cards_not_used" : null,
      lineupUsage.captainSlots <= 0 ? "captains_not_used" : null,
      lineupUsage.teamPowers <= 0 ? "team_powers_not_used" : null,
      lineupUsage.mutatorTraits <= 0 ? "mutators_not_used" : null,
      previousSeasonSnapshot == null ? "season_snapshot_missing" : null,
      relationshipEvents.length <= 0 ? "team_relationship_events_missing" : null,
      progressionEvents.length <= 0 ? "player_progression_events_missing" : null,
      finalSave.gameState.season.id === seasonId ? "season_did_not_advance" : null,
      finalSave.gameState.gamePhase !== "season_active" ? "next_season_not_active" : null,
      finalSave.gameState.matchdayState.status !== "planning" ? "next_matchday_not_planning" : null,
      nextSeasonState.lineupDrafts?.length ? "lineups_not_reset" : null,
      nextSeasonState.matchdayResults?.length ? "results_not_reset" : null,
      nextSeasonState.formCards?.some((card) => card.seasonId !== finalSave.gameState.season.id) ? "form_cards_wrong_season" : null,
      nextSeasonState.newGameFlow?.active !== true || nextSeasonState.newGameFlow.dismissed === true ? "season_briefing_not_open" : null,
      !["season_intro", "team_confirm"].includes(flow.currentStepId ?? "")
        ? `flow_not_at_season_intro:${flow.currentStepId}`
        : null,
      freeAgents.total <= 0 ? "transfermarkt_empty" : null,
    ].filter((entry): entry is string => Boolean(entry));

    if (blockers.length > 0) {
      throw new Error(`Block 1 smoke failed: ${blockers.join(" | ")}`);
    }

    const slowestMatchdays = [...matchdaySummaries]
      .sort((left, right) => right.elapsedMs - left.elapsedMs)
      .slice(0, 3)
      .map((summary) => ({
        matchdayId: summary.matchdayId,
        elapsedMs: summary.elapsedMs,
        aiBatchTotalMs: summary.aiBatchTotalMs,
        resultApplyTotalMs: summary.resultApplyTotalMs,
        resultResolvePreviewMs: summary.resultResolvePreviewMs,
        resultSaveWriteMs: summary.resultSaveWriteMs,
        standingsObjectiveRefreshMs: summary.standingsObjectiveRefreshMs,
      }));

    console.log(
      JSON.stringify(
        {
          saveId,
          fromSeasonId: seasonId,
          toSeasonId: finalSave.gameState.season.id,
          matchdaysPlayed: matchdaySummaries.length,
          performance: {
            totalMatchdayMs: sumNumbers(matchdaySummaries.map((summary) => summary.elapsedMs)),
            averageMatchdayMs: averageNumbers(matchdaySummaries.map((summary) => summary.elapsedMs)),
            averageAiBatchMs: averageNumbers(matchdaySummaries.map((summary) => summary.aiBatchTotalMs)),
            averageResultApplyMs: averageNumbers(matchdaySummaries.map((summary) => summary.resultApplyTotalMs)),
            averageResultResolvePreviewMs: averageNumbers(matchdaySummaries.map((summary) => summary.resultResolvePreviewMs)),
            averageResultSaveWriteMs: averageNumbers(matchdaySummaries.map((summary) => summary.resultSaveWriteMs)),
            slowestMatchdays,
          },
          lineupUsage,
          completion: {
            status: completion.status,
            steps: Object.fromEntries(completion.steps.map((step) => [step.key, step.status])),
            objectiveRows: completion.seasonReview.objectiveSettlement.rows.length,
            cashStatus: completion.cashApply.applied ? "applied" : "preview",
            relationships: completion.relationships.generatedEvents.length,
            snapshot: completion.snapshot.applied,
            aiDrafts: completion.aiSeasonAudit.totals.aiDrafts,
          },
          nextSeason: {
            appliedStep: nextSeason.appliedStepId,
            gamePhase: finalSave.gameState.gamePhase,
            matchdayId: finalSave.gameState.matchdayState.matchdayId,
            matchdayStatus: finalSave.gameState.matchdayState.status,
            formCards: nextSeasonState.formCards?.length ?? 0,
            transfermarktCandidates: freeAgents.total,
            flowCurrentStep: flow.currentStepId,
            flowCurrentTarget: flow.currentStep.targetView,
            briefingOpen: nextSeasonState.newGameFlow?.active === true && nextSeasonState.newGameFlow.dismissed !== true,
          },
          persistedSystems: {
            snapshots: nextSeasonState.seasonSnapshots?.length ?? 0,
            relationshipEvents: relationshipEvents.length,
            progressionEvents: progressionEvents.length,
            preseasonLogs: nextSeasonState.preSeasonWorkflowLogs?.length ?? 0,
          },
          testStatus: "passed",
        },
        null,
        2,
      ),
    );
  } finally {
    if (previousActiveSave?.saveId && previousActiveSave.saveId !== saveId) {
      persistence.activateSave(previousActiveSave.saveId);
    }
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
