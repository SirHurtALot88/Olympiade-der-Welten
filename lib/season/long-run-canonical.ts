import type { AiManagerActionType } from "@/lib/ai/ai-manager-apply-service";
import { applyAiManagerPlan } from "@/lib/ai/ai-manager-apply-service";
import type { AiPicksRunResult } from "@/lib/ai/ai-picks-run-service";
import { runAiPicksExecutePreview } from "@/lib/ai/ai-picks-run-service";
import { AI_PICKS_RUN_CONFIRM_TOKEN } from "@/lib/ai/ai-picks-run-contract";
import {
  CHUNKED_REDRAFT_TOPUP_CONFIRM_TOKEN,
  runChunkedRedraftTopup,
} from "@/lib/ai/chunked-redraft-topup-service";
import { getTeamHardMinRequired } from "@/lib/ai/ai-market-plan-convergence-service";
import { withNormalizedTeamGeneralManagers } from "@/lib/foundation/team-general-managers";
import { deriveRosterTargets } from "@/lib/foundation/roster-limits";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";
import { isLongRunFastProfile } from "@/lib/season/long-run-profile";
import { getSeasonEconomyFactorWindow, SEASON_ECONOMY_FACTOR_WINDOW_SIZE } from "@/lib/season/season-economy-factors";
import { isSeasonOne } from "@/lib/season/transfer-season-policy";
import { ensureSeasonSponsorOffers, chooseSponsorOfferForAiTeams } from "@/lib/sponsor/sponsor-offer-service";
import {
  applyPlayerTrainingModes,
  previewPlayerTrainingModes,
} from "@/lib/training/training-settings-service";

export const PRE_DRAFT_MANAGER_ACTION_TYPES: AiManagerActionType[] = [
  "reserve_transfer_budget",
  "reserve_salary_budget",
  "reserve_maintenance_budget",
];

export const CANONICAL_MANAGER_ACTION_TYPES: AiManagerActionType[] = [
  "reserve_transfer_budget",
  "reserve_salary_budget",
  "reserve_maintenance_budget",
  "maintain_building",
  "upgrade_building",
  "buy_building",
  "set_training_focus",
  "set_training_intensity",
  "set_player_training_modes",
  "set_player_training_classes",
  "mark_contract_strategy",
  "mark_sell_strategy",
];

const PRE_DRAFT_ROSTER_EMPTY = /team_roster_empty/;

function splitPreDraftManagerBlockers(blockers: string[]) {
  const hard: string[] = [];
  const soft: string[] = [];
  for (const entry of blockers) {
    if (PRE_DRAFT_ROSTER_EMPTY.test(entry)) soft.push(entry);
    else hard.push(entry);
  }
  return { hard, soft };
}

function splitLongRunManagerBlockers(blockers: string[]) {
  const hard: string[] = [];
  const soft: string[] = [];
  for (const entry of blockers) {
    if (
      entry.includes(":maintain_building:insufficient_cash") ||
      entry.includes(":upgrade_building:insufficient_cash") ||
      entry.includes(":buy_building:insufficient_cash")
    ) {
      soft.push(entry);
      continue;
    }
    hard.push(entry);
  }
  return { hard, soft };
}

export function ensureSalaryFactorWindowSeeded(save: PersistedSaveGame, persistence: PersistenceService) {
  const seasonId = save.gameState.season.id;
  const existing = save.gameState.seasonState.seasonEconomyFactors ?? [];
  if (existing.length === SEASON_ECONOMY_FACTOR_WINDOW_SIZE) {
    return save;
  }
  const window = getSeasonEconomyFactorWindow({
    saveId: save.saveId,
    seasonId,
    seasonState: save.gameState.seasonState,
  });
  return persistence.saveSingleplayerState(save.saveId, {
    ...save.gameState,
    seasonState: {
      ...save.gameState.seasonState,
      seasonEconomyFactors: window,
    },
  });
}

export function backfillMissingPlayerTrainingClasses(save: PersistedSaveGame, persistence: PersistenceService) {
  const rosterPlayerIds = new Set(save.gameState.rosters.map((entry) => entry.playerId));
  let appliedPlayers = 0;
  const nextPlayers = save.gameState.players.map((player) => {
    if (!rosterPlayerIds.has(player.id) || player.trainingClass) return player;
    if (!player.className) return player;
    appliedPlayers += 1;
    return { ...player, trainingClass: player.className };
  });
  if (appliedPlayers === 0) return { save, appliedPlayers };
  const nextSave = persistence.saveSingleplayerState(save.saveId, {
    ...save.gameState,
    players: nextPlayers,
  });
  return { save: nextSave, appliedPlayers };
}

export function backfillMissingPlayerTrainingModes(save: PersistedSaveGame, persistence: PersistenceService) {
  let current = persistence.getSaveById(save.saveId) ?? save;
  const playerById = new Map(current.gameState.players.map((player) => [player.id, player]));
  let appliedPlayers = 0;

  for (const team of current.gameState.teams) {
    const assignments = current.gameState.rosters
      .filter((entry) => entry.teamId === team.teamId)
      .map((entry) => playerById.get(entry.playerId))
      .filter((player): player is NonNullable<typeof player> => Boolean(player && !player.trainingMode))
      .map((player) => ({ playerId: player.id, trainingMode: "mittel" as const }));
    if (assignments.length === 0) continue;

    const preview = previewPlayerTrainingModes({ save: current, teamId: team.teamId, assignments });
    if (!preview.ok || !preview.confirmToken) continue;
    const result = applyPlayerTrainingModes(current, team.teamId, assignments, preview.confirmToken, persistence);
    if (!result.applied) continue;
    appliedPlayers += assignments.length;
    current = persistence.getSaveById(current.saveId) ?? current;
    for (const player of current.gameState.players) {
      playerById.set(player.id, player);
    }
  }

  return { save: current, appliedPlayers };
}

export function applyCanonicalManagerPlan(
  save: PersistedSaveGame,
  persistence: PersistenceService,
  label: string,
  actionTypes?: AiManagerActionType[],
) {
  const latest = persistence.getSaveById(save.saveId) ?? save;
  const longRunFast = isLongRunFastProfile();
  const result = applyAiManagerPlan({
    save: latest,
    dryRun: false,
    teamIds: latest.gameState.teams.map((team) => team.teamId),
    actionTypes: actionTypes ?? CANONICAL_MANAGER_ACTION_TYPES,
    persistence,
    longRunFast,
  });
  if (result.blockers.length > 0 && !longRunFast) {
    console.error(`[long-run] manager-plan ${label} blockers: ${result.blockers.slice(0, 6).join(" | ")}`);
  }
  let currentSave = persistence.getSaveById(save.saveId) ?? latest;
  let backfillModes = { save: currentSave, appliedPlayers: 0 };
  let backfillClasses = { save: currentSave, appliedPlayers: 0 };
  if (!longRunFast) {
    backfillModes = backfillMissingPlayerTrainingModes(currentSave, persistence);
    backfillClasses = backfillMissingPlayerTrainingClasses(
      persistence.getSaveById(save.saveId) ?? backfillModes.save,
      persistence,
    );
    if (backfillModes.appliedPlayers > 0) {
      console.error(`[long-run] manager-plan ${label} training backfill: ${backfillModes.appliedPlayers} players → mittel`);
    }
    if (backfillClasses.appliedPlayers > 0) {
      console.error(
        `[long-run] manager-plan ${label} training-class backfill: ${backfillClasses.appliedPlayers} players → className`,
      );
    }
  }
  const mappedBlockers = result.blockers.map((entry) => `manager_plan_${label}:${entry}`);
  const splitBlockers = splitLongRunManagerBlockers(mappedBlockers);
  return {
    save: backfillClasses.save,
    blockers: splitBlockers.hard,
    warnings: [...(result.warnings ?? []), ...splitBlockers.soft],
    appliedActions: result.actions.filter((action) => action.applied).length,
  };
}

export function finalizeSeasonOneSponsors(save: PersistedSaveGame, persistence: PersistenceService) {
  let next = ensureSeasonSponsorOffers(save.gameState);
  next = chooseSponsorOfferForAiTeams(next);
  return persistence.saveSingleplayerState(save.saveId, next);
}

function collectDraftTargetBlockers(save: PersistedSaveGame, prefix: string, mode: "min" | "all" = "all") {
  const blockers: string[] = [];
  for (const team of save.gameState.teams) {
    const identity = save.gameState.teamIdentities.find((entry) => entry.teamId === team.teamId);
    const { playerMin, playerOpt } = deriveRosterTargets(team, identity);
    const rosterCount = save.gameState.rosters.filter((entry) => entry.teamId === team.teamId).length;
    if (rosterCount < playerMin) {
      blockers.push(`${prefix}_below_min:${team.shortCode}:${rosterCount}/${playerMin}`);
    } else if (mode === "all" && rosterCount < playerOpt) {
      blockers.push(`${prefix}_below_opt:${team.shortCode}:${rosterCount}/${playerOpt}`);
    }
  }
  return blockers;
}

export async function runSeasonOnePicksDraft(
  saveId: string,
  persistence: PersistenceService,
  options?: { teamIds?: string[]; stepsPerTeam?: number; seedSuffix?: string },
): Promise<{ blockers: string[]; purchases: Array<Record<string, unknown>>; result: AiPicksRunResult }> {
  const save = persistence.getSaveById(saveId);
  if (!save) throw new Error("Long-run save missing before S1 draft.");
  if (save.gameState.season.id !== "season-1") {
    return {
      blockers: [`season1_picks_run_forbidden_after_s1:${save.gameState.season.id}`],
      purchases: [],
      result: null as unknown as AiPicksRunResult,
    };
  }

  const seasonId = save.gameState.season.id;
  const seedSuffix = options?.seedSuffix ?? "long-run";
  console.error(`[long-run] S1 draft via picks-run season1_optimum_execute (${saveId}${options?.teamIds?.length ? ` teams=${options.teamIds.length}` : ""})`);
  const result = await runAiPicksExecutePreview(
    {
      source: "sqlite",
      saveId,
      seasonId,
      dryRun: false,
      confirmToken: AI_PICKS_RUN_CONFIRM_TOKEN,
      teamScope: "all",
      allowSetupAllTeams: true,
      teamIds: options?.teamIds,
      stepsPerTeam: options?.stepsPerTeam ?? 16,
      runMode: "season1_optimum_execute",
      draftSeed: `${saveId}:${seasonId}:${seedSuffix}`,
    },
    persistence,
  );

  const blockers: string[] = [];
  if (!result.executed) {
    blockers.push(...result.blockingReasons.map((entry) => `season1_picks_run:${entry}`));
  }
  for (const team of result.teams) {
    if (team.blockingReasons.length > 0) {
      blockers.push(`season1_picks_run_team:${team.teamCode}:${team.blockingReasons.join(",")}`);
    }
  }

  const latest = persistence.getSaveById(saveId) ?? save;
  blockers.push(...collectDraftTargetBlockers(latest, "season1_topup", "min"));

  console.error(
    `[long-run] S1 picks-run done: applied=${result.globalExecution.appliedPickCount} previewMs=${result.performance.previewMs} executeMs=${result.performance.executeMs} blockers=${blockers.length}`,
  );

  return {
    blockers,
    result,
    purchases: result.teams.flatMap((team) =>
      team.plannedPicks
        .filter((pick) => pick.status === "applied")
        .map((pick) => ({
          seasonId,
          teamId: team.teamId,
          playerId: pick.playerId,
          playerName: pick.playerName,
          fee: pick.marketValue,
          rosterAfter: pick.expectedRosterAfter,
          cashAfter: pick.expectedCashAfter,
          source: "ai_roster_fill",
        })),
    ),
  };
}

export function normalizeGeneralManagers(save: PersistedSaveGame, persistence: PersistenceService) {
  return persistence.saveSingleplayerState(save.saveId, withNormalizedTeamGeneralManagers(save.gameState));
}

export async function runCanonicalSeasonOneDraftPhase(
  save: PersistedSaveGame,
  persistence: PersistenceService,
): Promise<{ save: PersistedSaveGame; blockers: string[]; picksRun: AiPicksRunResult; purchases: Array<Record<string, unknown>> }> {
  let current = normalizeGeneralManagers(save, persistence);
  const managerPre = applyCanonicalManagerPlan(current, persistence, "pre_draft", PRE_DRAFT_MANAGER_ACTION_TYPES);
  current = managerPre.save;
  const preDraftSplit = splitPreDraftManagerBlockers(managerPre.blockers);

  const draft = await runSeasonOnePicksDraft(current.saveId, persistence);
  current = persistence.getSaveById(current.saveId) ?? current;

  const optBlockers = collectDraftTargetBlockers(current, "season1_picks_run", "all");
  if (optBlockers.length > 0) {
    console.error(`[long-run] draft below opt (audit WARN, no extra picks): ${optBlockers.join(" | ")}`);
  }

  const blockers = [...preDraftSplit.hard, ...draft.blockers];
  return {
    save: current,
    blockers,
    picksRun: draft.result,
    purchases: draft.purchases,
  };
}

export function finalizeSeasonOneDraftAuditReady(save: PersistedSaveGame, persistence: PersistenceService) {
  let current = finalizeSeasonOneSponsors(save, persistence);
  return ensureSalaryFactorWindowSeeded(current, persistence);
}

export function finalizeSeasonOneBootstrapPhase(
  save: PersistedSaveGame,
  persistence: PersistenceService,
): { save: PersistedSaveGame; blockers: string[] } {
  let current = persistence.getSaveById(save.saveId) ?? save;
  const managerPost = applyCanonicalManagerPlan(current, persistence, "post_draft");
  current = managerPost.save;
  return {
    save: current,
    blockers: managerPost.blockers,
  };
}

export async function runCanonicalSeasonOneBootstrap(
  save: PersistedSaveGame,
  persistence: PersistenceService,
): Promise<{ save: PersistedSaveGame; blockers: string[]; picksRun: AiPicksRunResult; purchases: Array<Record<string, unknown>> }> {
  const draftPhase = await runCanonicalSeasonOneDraftPhase(save, persistence);
  const auditReady = finalizeSeasonOneDraftAuditReady(draftPhase.save, persistence);
  const postPhase = finalizeSeasonOneBootstrapPhase(auditReady, persistence);
  return {
    save: postPhase.save,
    blockers: [...draftPhase.blockers, ...postPhase.blockers],
    picksRun: draftPhase.picksRun,
    purchases: draftPhase.purchases,
  };
}

export function getAllTeamsBelowMinIds(gameState: PersistedSaveGame["gameState"]) {
  const identityByTeam = new Map(gameState.teamIdentities.map((entry) => [entry.teamId, entry]));
  return gameState.teams
    .filter((team) => {
      const identity = identityByTeam.get(team.teamId);
      const { playerMin } = deriveRosterTargets(team, identity);
      const rosterCount = gameState.rosters.filter((entry) => entry.teamId === team.teamId).length;
      return rosterCount < playerMin;
    })
    .map((team) => team.teamId);
}

/** hardMin teams always; planner-delegated may include coverage-risk above hardMin. */
export function resolveEmergencyRepairTeamIds(
  gameState: PersistedSaveGame["gameState"],
  plannerDelegatedTeamIds: string[],
) {
  const belowMinIds = getAllTeamsBelowMinIds(gameState);
  const delegated = plannerDelegatedTeamIds.filter(Boolean);
  return [...new Set([...belowMinIds, ...delegated])];
}

export function repairSeasonOneEndRosterBeforeS2(
  saveId: string,
  persistence: PersistenceService,
  options?: { plannerExhaustedTeamIds?: string[]; outputDir?: string },
): { blockers: string[]; warnings: string[]; purchases: Array<Record<string, unknown>>; repaired: boolean } {
  const save = persistence.getSaveById(saveId);
  if (!save || !isSeasonOne(save.gameState.season.id)) {
    return { blockers: [], warnings: [], purchases: [], repaired: false };
  }

  // S1 end: only hard-min roster holes — never opt-fill or planner-delegated bonus picks.
  void options?.plannerExhaustedTeamIds;
  const teamIds = getAllTeamsBelowMinIds(save.gameState);
  if (teamIds.length === 0) {
    return { blockers: [], warnings: [], purchases: [], repaired: false };
  }

  console.error(`[long-run] S1-end hard-min roster repair: ${teamIds.length} teams`);
  const result = runChunkedRedraftTopup({
    persistence,
    saveId,
    seasonId: "season-1",
    dryRun: false,
    confirmToken: CHUNKED_REDRAFT_TOPUP_CONFIRM_TOKEN,
    mode: "season1_initial_topup",
    target: "playerMin",
    targetTeamIds: teamIds,
    roundLimit: 4,
    teamTimeLimitMs: 30_000,
    watchdogMs: 60_000,
    outputDir: options?.outputDir,
  });

  const purchases = result.picks.map((pick) => ({
    seasonId: "season-1",
    teamId: pick.teamId,
    playerId: pick.playerId,
    playerName: pick.playerName,
    fee: pick.marketValue,
    rosterAfter: pick.rosterAfter,
    cashAfter: pick.cashAfter,
    source: "season1_autoprep_topup",
    s1EndStabilization: true,
  }));

  const after = persistence.getSaveById(saveId);
  const blockers: string[] = [];
  if (after) {
    for (const teamId of teamIds) {
      const rosterCount = after.gameState.rosters.filter((entry) => entry.teamId === teamId).length;
      const hardMin = getTeamHardMinRequired(after.gameState, teamId);
      if (rosterCount < hardMin) {
        blockers.push(`s1_end_roster_repair_below_min:${teamId}:${rosterCount}/${hardMin}`);
      }
    }
  }

  return {
    repaired: true,
    blockers,
    warnings: [...result.warnings.slice(0, 20), "s1_end_stabilization:true"],
    purchases,
  };
}
