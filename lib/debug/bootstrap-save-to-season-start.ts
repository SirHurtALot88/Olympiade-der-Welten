import type { TeamControlSettings } from "@/lib/data/olyDataTypes";
import { withScenarioMeta } from "@/lib/persistence/scenario-meta";
import type { PersistenceService } from "@/lib/persistence/types";
import type { PersistedSaveGame } from "@/lib/persistence/types";
import {
  runLocalMatchdayAutoRun,
  MATCHDAY_AUTO_RUN_CONFIRM_TOKEN,
} from "@/lib/season/matchday-auto-run-service";
import {
  MATCHDAY_MVP_SCORING_CONFIRM_TOKEN,
  runMatchdayMvpScoring,
} from "@/lib/season/matchday-mvp-scoring-service";
import { ADVANCE_MATCHDAY_CONFIRM_TOKEN, executeMatchdayAdvance } from "@/lib/season/matchday-progress-service";
import {
  applyPreSeasonNextSeasonSetupLightweight,
  buildPreSeasonNextSeasonSetupToken,
} from "@/lib/season/preseason-workflow-service";
import {
  runLocalSeasonCompletion,
  SEASON_COMPLETION_CONFIRM_TOKEN,
} from "@/lib/season/season-completion-service";
import { isSeasonComplete } from "@/lib/season/season-transition-service";

export type BootstrapSaveToSeasonStartParams = {
  saveId: string;
  targetSeasonId: string;
  persistence: PersistenceService;
  ensureAllTeamsAi?: boolean;
  progressLog?: boolean;
};

export type BootstrapSaveToSeasonStartResult = {
  ok: boolean;
  saveId: string;
  fromSeasonId: string;
  toSeasonId: string;
  seasonsAdvanced: number;
  matchdaysCompleted: number;
  blockers: string[];
  warnings: string[];
};

function parseSeasonNumber(seasonId: string): number | null {
  const match = /^season-(\d+)$/.exec(seasonId.trim());
  if (!match) return null;
  return Number(match[1]);
}

function log(progressLog: boolean, message: string) {
  if (progressLog) console.error(`[bootstrap-season-start] ${message}`);
}

function setAllTeamsAi(save: PersistedSaveGame, persistence: PersistenceService) {
  const settings = Object.fromEntries(
    save.gameState.teams.map((team) => [
      team.teamId,
      {
        teamId: team.teamId,
        controlMode: "ai",
        ownerId: "ai",
        ownerSlot: "ai",
        displayLabel: `AI · ${team.shortCode}`,
        aiLineupPreviewEnabled: true,
        aiLineupApplyEnabled: true,
        aiLineupAutoApplyEnabled: true,
        aiTransferPreviewEnabled: true,
        aiTransferAutoApplyEnabled: true,
        aiSellPreviewEnabled: true,
        aiSellAutoApplyEnabled: true,
        notes: "bootstrap_save_to_season_start",
        strategyLock: null,
      } satisfies TeamControlSettings,
    ]),
  );
  const gameState = withScenarioMeta(
    {
      ...save.gameState,
      teams: save.gameState.teams.map((team) => ({ ...team, humanControlled: false })),
      seasonState: {
        ...save.gameState.seasonState,
        teamControlSettings: settings,
      },
    },
    {
      scenarioType: save.gameState.scenarioMeta?.scenarioType ?? "sandbox_multiseason_test",
      label: save.name,
      description: save.gameState.scenarioMeta?.description ?? "Bootstrap save to target season start.",
      sourceSaveId: save.gameState.scenarioMeta?.sourceSaveId ?? save.saveId,
      isStableTestPoint: save.gameState.scenarioMeta?.isStableTestPoint ?? false,
      allowTestWrites: true,
      containsSeasonHistory: save.gameState.scenarioMeta?.containsSeasonHistory ?? false,
      containsFinalStandings: save.gameState.scenarioMeta?.containsFinalStandings ?? false,
    },
  );
  return persistence.saveSingleplayerState(save.saveId, gameState);
}

function hasMatchdayResult(save: PersistedSaveGame, seasonId: string, matchdayId: string) {
  return (save.gameState.seasonState.matchdayResults ?? []).some(
    (entry) => entry.seasonId === seasonId && entry.matchdayId === matchdayId,
  );
}

function healAllPlayersForBootstrap(save: PersistedSaveGame, persistence: PersistenceService) {
  const gameState = {
    ...save.gameState,
    players: save.gameState.players.map((player) => ({
      ...player,
      fatigue: 0,
    })),
    seasonState: {
      ...save.gameState.seasonState,
      playerAvailabilityState: (save.gameState.seasonState.playerAvailabilityState ?? []).map((entry) => ({
        ...entry,
        fatigue: 0,
        injuryStatus: "healthy" as const,
        injuryUntilMatchday: undefined,
        injuredAtSeasonId: undefined,
        injuredAtMatchdayId: undefined,
        injuryReason: undefined,
        injuryRiskLastRoll: undefined,
      })),
    },
  };
  return persistence.saveSingleplayerState(save.saveId, gameState);
}

async function runRemainingMatchdaysForSeason(
  saveId: string,
  seasonId: string,
  persistence: PersistenceService,
  progressLog: boolean,
): Promise<{ matchdaysCompleted: number; blockers: string[] }> {
  const blockers: string[] = [];
  let matchdaysCompleted = 0;
  const maxIterations = 16;

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    let save = persistence.getSaveById(saveId);
    if (!save) throw new Error(`Save ${saveId} missing during matchday loop.`);

    if (save.gameState.season.id !== seasonId) break;
    if (isSeasonComplete(save.gameState)) break;

    const matchdayId = save.gameState.matchdayState.matchdayId;
    save = healAllPlayersForBootstrap(save, persistence);

    if (hasMatchdayResult(save, seasonId, matchdayId)) {
      const advance = await executeMatchdayAdvance(
        { saveId, seasonId, source: "sqlite", execute: true, confirm: ADVANCE_MATCHDAY_CONFIRM_TOKEN },
        persistence,
      );
      if (!advance.ok || !advance.applied) {
        blockers.push(`advance_after_existing:${seasonId}:${matchdayId}:${advance.blockingReasons.join("|")}`);
        break;
      }
      continue;
    }

    log(progressLog, `resolve ${seasonId} ${matchdayId}`);
    let matchdayResolved = false;
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
    if (autoRun.ok) {
      matchdayResolved = true;
    } else if (autoRun.blockingReasons.some((reason) => reason.includes("incomplete_lineups"))) {
      log(progressLog, `auto-run incomplete lineups on ${matchdayId}, retry via MVP scoring`);
      const mvpRun = await runMatchdayMvpScoring(
        {
          saveId,
          seasonId,
          matchdayId,
          source: "sqlite",
          execute: true,
          dryRun: false,
          confirmToken: MATCHDAY_MVP_SCORING_CONFIRM_TOKEN,
          forceReplace: true,
        },
        persistence,
      );
      if (mvpRun.blockingReasons.length === 0 && mvpRun.resultApply.applied && mvpRun.standingsApply.applied) {
        matchdayResolved = true;
      } else {
        blockers.push(
          `mvp_fallback:${seasonId}:${matchdayId}:${mvpRun.blockingReasons.join("|") || "result_or_standings_not_applied"}`,
        );
        break;
      }
    } else {
      blockers.push(`auto_run:${seasonId}:${matchdayId}:${autoRun.blockingReasons.join("|")}`);
      break;
    }

    if (!matchdayResolved) {
      blockers.push(`matchday_unresolved:${seasonId}:${matchdayId}`);
      break;
    }

    const advance = await executeMatchdayAdvance(
      { saveId, seasonId, source: "sqlite", execute: true, confirm: ADVANCE_MATCHDAY_CONFIRM_TOKEN },
      persistence,
    );
    if (!advance.ok || !advance.applied) {
      blockers.push(`advance:${seasonId}:${matchdayId}:${advance.blockingReasons.join("|")}`);
      break;
    }

    matchdaysCompleted += 1;
  }

  return { matchdaysCompleted, blockers };
}

async function completeSeasonAndAdvanceToNext(
  saveId: string,
  seasonId: string,
  persistence: PersistenceService,
  progressLog: boolean,
): Promise<{ ok: boolean; blockers: string[]; warnings: string[] }> {
  const blockers: string[] = [];
  const warnings: string[] = [];

  log(progressLog, `season completion ${seasonId}`);
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
    blockers.push(`season_completion:${seasonId}:${completion.blockingReasons.join("|")}`);
    return { ok: false, blockers, warnings };
  }
  completion.warnings.forEach((warning) => warnings.push(warning));

  const afterCompletion = persistence.getSaveById(saveId);
  if (!afterCompletion) {
    blockers.push(`missing_after_completion:${seasonId}`);
    return { ok: false, blockers, warnings };
  }

  const nextSeasonToken = buildPreSeasonNextSeasonSetupToken(afterCompletion).confirmToken;
  const nextSeason = applyPreSeasonNextSeasonSetupLightweight(afterCompletion, nextSeasonToken, persistence);
  if (!nextSeason.applied) {
    blockers.push(`next_season_setup:${seasonId}:${nextSeason.blockingReasons.join("|")}`);
    return { ok: false, blockers, warnings };
  }
  nextSeason.warnings.forEach((warning) => warnings.push(warning));

  log(
    progressLog,
    `advanced ${seasonId} → ${persistence.getSaveById(saveId)?.gameState.season.id ?? "unknown"}`,
  );
  return { ok: true, blockers, warnings };
}

export async function bootstrapSaveToSeasonStart(
  params: BootstrapSaveToSeasonStartParams,
): Promise<BootstrapSaveToSeasonStartResult> {
  const progressLog = params.progressLog ?? false;
  const ensureAllTeamsAi = params.ensureAllTeamsAi ?? true;
  const targetNumber = parseSeasonNumber(params.targetSeasonId);
  if (targetNumber === null) {
    throw new Error(`Unsupported target season id: ${params.targetSeasonId}`);
  }

  let save = params.persistence.getSaveById(params.saveId);
  if (!save) throw new Error(`Save not found: ${params.saveId}`);

  const fromSeasonId = save.gameState.season.id;
  const fromNumber = parseSeasonNumber(fromSeasonId);
  if (fromNumber === null) {
    throw new Error(`Unsupported current season id: ${fromSeasonId}`);
  }

  if (fromNumber >= targetNumber) {
    log(progressLog, `already at ${fromSeasonId} (target ${params.targetSeasonId})`);
    return {
      ok: true,
      saveId: params.saveId,
      fromSeasonId,
      toSeasonId: fromSeasonId,
      seasonsAdvanced: 0,
      matchdaysCompleted: 0,
      blockers: [],
      warnings: [],
    };
  }

  if (ensureAllTeamsAi) {
    save = setAllTeamsAi(save, params.persistence);
  }

  const blockers: string[] = [];
  const warnings: string[] = [];
  let matchdaysCompleted = 0;
  let seasonsAdvanced = 0;

  while (true) {
    save = params.persistence.getSaveById(params.saveId);
    if (!save) throw new Error(`Save missing during bootstrap: ${params.saveId}`);

    const currentSeasonId = save.gameState.season.id;
    const currentNumber = parseSeasonNumber(currentSeasonId);
    if (currentNumber === null) throw new Error(`Unsupported season id during bootstrap: ${currentSeasonId}`);
    if (currentNumber >= targetNumber) break;

    const matchdayRun = await runRemainingMatchdaysForSeason(
      params.saveId,
      currentSeasonId,
      params.persistence,
      progressLog,
    );
    matchdaysCompleted += matchdayRun.matchdaysCompleted;
    blockers.push(...matchdayRun.blockers);
    if (matchdayRun.blockers.length > 0) break;

    save = params.persistence.getSaveById(params.saveId);
    if (!save) throw new Error(`Save missing after matchdays: ${params.saveId}`);
    if (!isSeasonComplete(save.gameState)) {
      blockers.push(`season_not_complete:${currentSeasonId}`);
      break;
    }

    const transition = await completeSeasonAndAdvanceToNext(
      params.saveId,
      currentSeasonId,
      params.persistence,
      progressLog,
    );
    warnings.push(...transition.warnings);
    blockers.push(...transition.blockers);
    if (!transition.ok) break;

    seasonsAdvanced += 1;
  }

  const finalSave = params.persistence.getSaveById(params.saveId);
  const toSeasonId = finalSave?.gameState.season.id ?? fromSeasonId;
  const toNumber = parseSeasonNumber(toSeasonId) ?? fromNumber;

  return {
    ok: blockers.length === 0 && toNumber >= targetNumber,
    saveId: params.saveId,
    fromSeasonId,
    toSeasonId,
    seasonsAdvanced,
    matchdaysCompleted,
    blockers,
    warnings,
  };
}
