import type { GamePhase, GameState, NewGameFlowStepId, NewGameFlowStepStatus } from "@/lib/data/olyDataTypes";
import { evaluateGamePhaseAction } from "@/lib/foundation/game-phase-action-policy";
import { getTransferWindowStatus } from "@/lib/market/transfer-window-policy";
import { GAME_LANGUAGE } from "@/lib/ui/game-language";
import {
  activeTeamHasFormCardPool,
  activeTeamTransfersFinalized,
  getFormCardFlowStatus,
} from "@/lib/foundation/form-card-flow";
import {
  getTeamMatchdayLineupDraft,
  isTeamMatchdayLineupComplete,
  isTeamMatchdayLineupOperationallyReady,
  isTeamMatchdayLineupSubmitted,
} from "@/lib/foundation/matchday-lineup-readiness";
import { getTeamBoardFlowSignals } from "@/lib/board/team-season-objectives-service";
import { FACILITY_CATALOG } from "@/lib/facilities/facility-catalog";
import { getTeamFacilityState } from "@/lib/facilities/facility-effects";
import { getTeamSponsorContract } from "@/lib/sponsor/sponsor-offer-read";
import { hasPersistedTeamCaptain } from "@/lib/morale/team-captain-service";
import { isTeamTrainingComplete } from "@/lib/foundation/team-training-status";

export type GameFlowPhase =
  | "preseason"
  | "season_active"
  | "matchday_prep"
  | "matchday_ready"
  | "matchday_reveal"
  | "matchday_result"
  | "season_review"
  | "season_end"
  | "season_transition";

export type GameFlowStepStatus = "ready" | "blocked" | "optional" | "completed" | "applying" | "warning";

export type GameFlowView =
  | "home"
  | "hq"
  | "season"
  | "cockpit"
  | "lineup"
  | "matchdayArena"
  | "teams"
  | "training"
  | "trainingCompact"
  | "trainingV2"
  | "prize"
  | "market"
  | "scoutingCenterV2"
  | "admin";

export type GameFlowStep = {
  stepId: string;
  label: string;
  cta: string;
  status: GameFlowStepStatus;
  targetView: GameFlowView;
  targetPanel?: string | null;
  teamId?: string | null;
  blockers: string[];
  warnings: string[];
  optional?: boolean;
};

export type GameFlowState = {
  phase: GameFlowPhase;
  activeTeamId: string | null;
  activeSeasonId: string;
  activeMatchday: number | null;
  currentStepId: string;
  nextStepId: string | null;
  completedSteps: string[];
  blockedSteps: string[];
  warnings: string[];
  steps: GameFlowStep[];
  currentStep: GameFlowStep;
  nextStep: GameFlowStep | null;
};

function uniq(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => typeof value === "string" && value.trim().length > 0)));
}

function step(input: Omit<GameFlowStep, "blockers" | "warnings"> & { blockers?: string[]; warnings?: string[] }): GameFlowStep {
  return {
    ...input,
    targetPanel: input.targetPanel ?? null,
    blockers: uniq(input.blockers ?? []),
    warnings: uniq(input.warnings ?? []),
  };
}

function derivePreseasonPhase(gameState: GameState): GameFlowPhase | null {
  const gamePhase = gameState.gamePhase ?? "season_active";
  if (gamePhase === "season_completed" || gamePhase === "season_review") return "season_review";
  if (gamePhase === "season_rewards" || gamePhase === "player_development") return "season_end";
  if (
    gamePhase === "preseason_management" ||
    gamePhase === "transfer_sell_phase" ||
    gamePhase === "transfer_buy_phase" ||
    gamePhase === "lineup_setup" ||
    gamePhase === "next_season_ready"
  ) {
    return "preseason";
  }
  return null;
}

function hasCurrentMatchdayResult(gameState: GameState) {
  return (gameState.seasonState.matchdayResults ?? []).some(
    (result) => result.seasonId === gameState.season.id && result.matchdayId === gameState.matchdayState.matchdayId,
  );
}

function getActiveTeamRosterPlayerIds(gameState: GameState, activeTeamId: string | null) {
  if (!activeTeamId) return [];
  return gameState.rosters.filter((entry) => entry.teamId === activeTeamId).map((entry) => entry.playerId);
}

function getActiveTeamLineup(gameState: GameState, activeTeamId: string | null) {
  if (!activeTeamId) return null;
  return getTeamMatchdayLineupDraft(gameState, activeTeamId);
}

function isCurrentMatchdayLineupComplete(gameState: GameState, lineup: ReturnType<typeof getActiveTeamLineup>) {
  if (!lineup) return false;
  return isTeamMatchdayLineupOperationallyReady(gameState, lineup.teamId, lineup);
}


function activeTeamTrainingComplete(gameState: GameState, activeTeamId: string | null) {
  // Einheitliche Quelle der Wahrheit (siehe team-training-status).
  return isTeamTrainingComplete(gameState, activeTeamId);
}

function buildPreseasonSteps(gameState: GameState, activeTeamId: string | null): GameFlowStep[] {
  const seasonId = gameState.season.id;
  const gamePhase = gameState.gamePhase ?? "season_active";
  const cashApplied = (gameState.seasonState.cashPrizeApplyLogs ?? []).some((log) => log.seasonId === seasonId);
  const completedTransitionSteps = new Set(gameState.seasonTransition?.completedSteps ?? []);
  const hasSeasonHistory = (gameState.seasonState.seasonSnapshots ?? []).length > 0;
  const hasActiveTeam = activeTeamId != null && gameState.teams.some((team) => team.teamId === activeTeamId);
  const activeRosterCount = getActiveTeamRosterPlayerIds(gameState, activeTeamId).length;
  const storedNewGameFlow = gameState.seasonState.newGameFlow ?? null;
  const seasonIntroStep = storedNewGameFlow?.steps?.find((entry) => entry.stepId === "season_intro");
  const hasStoredNewGameFlow = Boolean(storedNewGameFlow);
  const seasonIntroOpen =
    Boolean(storedNewGameFlow?.active && !storedNewGameFlow.dismissed) &&
    seasonIntroStep?.status !== "completed" &&
    seasonIntroStep?.status !== "skipped";
  const isFirstSeason = /season[-_\s]*1\b/i.test(`${gameState.season.id} ${gameState.season.name}`);
  const isSeasonReviewPhase = gamePhase === "season_completed" || gamePhase === "season_review";
  const boardSignals = getTeamBoardFlowSignals(gameState, activeTeamId);
  const boardFlowWarnings = uniq([...boardSignals.blockers, ...boardSignals.warnings]);
  const playerDevelopmentDone = completedTransitionSteps.has("player_development");
  const preseasonManagementReady =
    gamePhase === "next_season_ready" ||
    (hasSeasonHistory && cashApplied && playerDevelopmentDone && gamePhase === "lineup_setup");

  return [
    step({
      stepId: "season_intro",
      label: "Season-Briefing lesen",
      cta: "Weiter: Season-Briefing",
      status: !isSeasonReviewPhase && (seasonIntroOpen || (!hasStoredNewGameFlow && isFirstSeason)) ? "ready" : "completed",
      targetView: "home",
      targetPanel: "season-briefing",
      teamId: activeTeamId,
    }),
    step({
      stepId: "review_previous_season",
      label: "Saisonrückblick prüfen",
      cta: "Weiter: Saisonrückblick",
      status: gamePhase === "season_completed" || gamePhase === "season_review" || hasSeasonHistory ? "ready" : "completed",
      targetView: "cockpit",
      teamId: activeTeamId,
      warnings: hasSeasonHistory ? [] : ["season_source_missing"],
    }),
    step({
      stepId: "apply_rewards",
      label: "Preisgeld & Finanzen",
      cta: "Weiter: Preisgeld & Finanzen",
      status: !hasSeasonHistory && isFirstSeason ? "completed" : cashApplied ? "completed" : "ready",
      targetView: "prize",
      teamId: activeTeamId,
      warnings: !cashApplied && hasSeasonHistory ? ["prize_money_not_applied"] : [],
    }),
    step({
      stepId: "facilities",
      label: "Facilities prüfen",
      cta: "Weiter: Facilities prüfen",
      status: !hasActiveTeam
        ? "blocked"
        : teamHasAffordableFacilityUpgrade(gameState, activeTeamId)
          ? "optional"
          : "completed",
      targetView: "trainingV2",
      targetPanel: "facilities",
      teamId: activeTeamId,
      optional: teamHasAffordableFacilityUpgrade(gameState, activeTeamId),
    }),
    step({
      stepId: "player_development",
      label: "Spieler entwickeln",
      cta: "Weiter: Spielerentwicklung",
      status: !hasSeasonHistory && isFirstSeason ? "completed" : playerDevelopmentDone ? "completed" : "ready",
      targetView: "trainingCompact",
      targetPanel: "season-end-development",
      teamId: activeTeamId,
      warnings: hasSeasonHistory && !playerDevelopmentDone ? ["player_development_pending"] : [],
    }),
    step({
      stepId: "sell_players",
      label: "Spieler verkaufen",
      cta: "Weiter: Spieler verkaufen",
      status: !hasActiveTeam
        ? "blocked"
        : activeRosterCount === 0
          ? "completed"
          : buildTransferStepGate(gameState, "sell_players").allowed
            ? "ready"
            : "blocked",
      targetView: "teams",
      targetPanel: "roster",
      teamId: activeTeamId,
      blockers: !hasActiveTeam
        ? ["no_active_team"]
        : buildTransferStepGate(gameState, "sell_players").blockers,
      warnings: buildTransferStepGate(gameState, "sell_players").warnings,
    }),
    step({
      stepId: "buy_players",
      label: "Spieler kaufen",
      cta: "Weiter: Spieler kaufen",
      status: !hasActiveTeam ? "blocked" : buildTransferStepGate(gameState, "buy_players").allowed ? "ready" : "blocked",
      targetView: "market",
      teamId: activeTeamId,
      blockers: !hasActiveTeam
        ? ["no_active_team"]
        : buildTransferStepGate(gameState, "buy_players").blockers,
      warnings: buildTransferStepGate(gameState, "buy_players").warnings,
    }),
    step({
      stepId: "set_training",
      label: "Training setzen",
      cta: "Weiter: Training prüfen",
      status: activeTeamTrainingComplete(gameState, activeTeamId) ? "completed" : "ready",
      targetView: "trainingCompact",
      targetPanel: "training-plan",
      teamId: activeTeamId,
    }),
    step({
      stepId: "prepare_season",
      label: "Season vorbereiten",
      cta: "Weiter: Season Setup",
      status: gamePhase === "next_season_ready" || gamePhase === "season_active" ? "completed" : preseasonManagementReady ? "warning" : "ready",
      targetView: "cockpit",
      teamId: activeTeamId,
      warnings: uniq([
        ...boardFlowWarnings,
        hasSeasonHistory && !cashApplied ? "prize_money_not_applied" : null,
        hasSeasonHistory && !playerDevelopmentDone ? "player_development_pending" : null,
      ]),
    }),
    step({
      stepId: "start_matchday_1",
      label: "Matchday 1 starten",
      cta: "Weiter: Einsatzliste vorbereiten",
      status: gamePhase === "season_active" ? "completed" : "ready",
      targetView: "lineup",
      teamId: activeTeamId,
    }),
  ];
}

function getOnboardingTargetRosterCount(gameState: GameState, activeTeamId: string | null) {
  const team = activeTeamId ? gameState.teams.find((entry) => entry.teamId === activeTeamId) : null;
  return Math.max(10, Math.min(12, team?.rosterLimit ?? 12));
}

function teamHasSeasonTransferActivity(gameState: GameState, teamId: string | null, seasonId: string) {
  if (!teamId) {
    return false;
  }
  return gameState.transferHistory.some(
    (transfer) =>
      transfer.seasonId === seasonId && (transfer.toTeamId === teamId || transfer.fromTeamId === teamId),
  );
}

function resolveOnboardingStepStatus(
  flow: NonNullable<GameState["seasonState"]["newGameFlow"]> | null | undefined,
  stepId: NewGameFlowStepId,
  gameState: GameState,
  activeTeamId: string | null,
): GameFlowStepStatus {
  const entry = flow?.steps?.find((step) => step.stepId === stepId);
  if (!flow?.active || flow.dismissed || !entry) {
    return "completed";
  }
  if (entry.status === "completed" || entry.status === "skipped") {
    return "completed";
  }

  const rosterCount = getActiveTeamRosterPlayerIds(gameState, activeTeamId).length;
  const targetRosterCount = getOnboardingTargetRosterCount(gameState, activeTeamId);
  const hasTransfers = teamHasSeasonTransferActivity(gameState, activeTeamId, gameState.season.id);

  if (stepId === "team_confirm") {
    return activeTeamId ? "completed" : "ready";
  }
  if (stepId === "roster_review") {
    return rosterCount > 0 ? "completed" : "ready";
  }
  if (stepId === "appoint_captain") {
    if (!activeTeamId) {
      return "ready";
    }
    const team = gameState.teams.find((entry) => entry.teamId === activeTeamId);
    if (!team?.humanControlled) {
      return "completed";
    }
    return hasPersistedTeamCaptain(gameState, activeTeamId) ? "completed" : "ready";
  }
  if (stepId === "first_transfers") {
    return hasTransfers ? "completed" : "ready";
  }
  if (stepId === "fill_roster") {
    return rosterCount >= targetRosterCount ? "completed" : "ready";
  }
  if (stepId === "training_facilities") {
    return activeTeamTrainingComplete(gameState, activeTeamId) ? "completed" : "ready";
  }
  if (stepId === "choose_sponsor") {
    return activeTeamId && getTeamSponsorContract(gameState, activeTeamId) ? "completed" : "ready";
  }
  if (stepId === "set_lineup") {
    const lineup = getActiveTeamLineup(gameState, activeTeamId);
    return isCurrentMatchdayLineupComplete(gameState, lineup) ? "completed" : "ready";
  }

  return "ready";
}

function buildTransferStepGate(gameState: GameState, action: "buy_players" | "sell_players") {
  const gate = evaluateGamePhaseAction(gameState, action);
  return {
    allowed: gate.allowed,
    blockers: gate.allowed || !gate.reason ? [] : [gate.reason],
    warnings: gate.warnings,
  };
}

function teamHasAffordableFacilityUpgrade(gameState: GameState, teamId: string | null) {
  if (!teamId) {
    return false;
  }
  const team = gameState.teams.find((entry) => entry.teamId === teamId);
  if (!team) {
    return false;
  }
  const facilities = getTeamFacilityState(gameState, teamId);
  return FACILITY_CATALOG.some((facility) => {
    const current = facilities.facilities[facility.facilityId]?.level ?? 0;
    const next = facility.levels.find((level) => level.level === current + 1);
    return next != null && team.cash >= next.upgradeCost;
  });
}

function buildOnboardingFlowSteps(gameState: GameState, activeTeamId: string | null): GameFlowStep[] {
  const flow = gameState.seasonState.newGameFlow;
  if (!flow?.active || flow.dismissed) {
    return [];
  }

  const teamId = activeTeamId ?? flow.selectedTeamId ?? null;
  return [
    step({
      stepId: "team_confirm",
      label: "Team bestätigen",
      cta: "Weiter: Team bestätigen",
      status: resolveOnboardingStepStatus(flow, "team_confirm", gameState, teamId),
      targetView: "home",
      teamId,
    }),
    step({
      stepId: "roster_review",
      label: "Kader prüfen",
      cta: "Weiter: Kader prüfen",
      status: resolveOnboardingStepStatus(flow, "roster_review", gameState, teamId),
      targetView: "teams",
      targetPanel: "roster",
      teamId,
    }),
    step({
      stepId: "first_transfers",
      label: "Erste Transfers",
      cta: "Weiter: Transfermarkt",
      status: resolveOnboardingStepStatus(flow, "first_transfers", gameState, teamId),
      targetView: "market",
      teamId,
      ...(() => {
        const gate = buildTransferStepGate(gameState, "buy_players");
        return {
          blockers: gate.allowed ? [] : gate.blockers,
          warnings: gate.warnings,
        };
      })(),
    }),
    step({
      stepId: "fill_roster",
      label: "Kader auffüllen",
      cta: "Weiter: Transfermarkt",
      status: resolveOnboardingStepStatus(flow, "fill_roster", gameState, teamId),
      targetView: "market",
      teamId,
      ...(() => {
        const gate = buildTransferStepGate(gameState, "buy_players");
        return {
          blockers: gate.allowed ? [] : gate.blockers,
          warnings: gate.warnings,
        };
      })(),
    }),
    step({
      // CTA muss dorthin führen, wo die Abschlussbedingung (Trainingsmodus je Spieler)
      // erfüllt wird — also in die Trainingsansicht, nicht ins Scouting-Center.
      stepId: "training_facilities",
      label: "Training setzen",
      cta: "Weiter: Training setzen",
      status: resolveOnboardingStepStatus(flow, "training_facilities", gameState, teamId),
      targetView: "trainingV2",
      teamId,
    }),
    // Kapitän erst NACH dem finalen Kader (Käufe) + Training ernennen.
    step({
      stepId: "appoint_captain",
      label: "Kapitän ernennen",
      cta: "Weiter: Kapitän wählen",
      status: resolveOnboardingStepStatus(flow, "appoint_captain", gameState, teamId),
      targetView: "home",
      targetPanel: "captain-picker",
      teamId,
      blockers: teamId ? [] : ["no_active_team"],
    }),
    step({
      // Sponsor ist unabhängig vom Training (wie im Folge-Season-Pfad) — kein künstlicher
      // "blocked"-Zustand ohne Begründung mehr, nur die Reihenfolge im Flow leitet.
      stepId: "choose_sponsor",
      label: "Sponsor wählen",
      cta: "Weiter: Sponsor wählen",
      status:
        !teamId
          ? "blocked"
          : getTeamSponsorContract(gameState, teamId)
            ? "completed"
            : resolveOnboardingStepStatus(flow, "choose_sponsor", gameState, teamId),
      targetView: "prize",
      targetPanel: "sponsor-choice",
      teamId,
      blockers: teamId ? [] : ["no_active_team"],
    }),
  ];
}

function mergeOnboardingFlowSteps(steps: GameFlowStep[], gameState: GameState, activeTeamId: string | null) {
  const onboardingSteps = buildOnboardingFlowSteps(gameState, activeTeamId);
  if (onboardingSteps.length === 0) {
    return steps;
  }
  const onboardingIds = new Set(onboardingSteps.map((entry) => entry.stepId));
  return [...onboardingSteps, ...steps.filter((entry) => !onboardingIds.has(entry.stepId))];
}

function buildMatchdaySteps(gameState: GameState, activeTeamId: string | null): GameFlowStep[] {
  const hasActiveTeam = activeTeamId != null && gameState.teams.some((team) => team.teamId === activeTeamId);
  const activeRosterCount = getActiveTeamRosterPlayerIds(gameState, activeTeamId).length;
  const activeLineup = getActiveTeamLineup(gameState, activeTeamId);
  const hasLineup = isCurrentMatchdayLineupComplete(gameState, activeLineup);
  const lineupConfirmed = isTeamMatchdayLineupSubmitted(activeLineup);
  const formCardFlow = getFormCardFlowStatus(gameState, activeTeamId);
  const hasFormCardSelections = formCardFlow.hasSelections;
  const hasFormCardPool = activeTeamHasFormCardPool(gameState, activeTeamId);
  // "Transfers finalisieren": explicit confirm gate that fires the fixed
  // form-card pool distribution before the active team may field a lineup.
  // Reuses hasFormCardPool as the completion signal (see form-card-flow.ts).
  const transfersFinalized = activeTeamTransfersFinalized(gameState, activeTeamId);
  const hasResults = hasCurrentMatchdayResult(gameState) || gameState.matchdayState.status === "resolved";
  const formCardsRequired = hasLineup && !hasResults;
  const arenaPreparationReady = hasLineup;
  const matchdayArenaReady = arenaPreparationReady && lineupConfirmed;
  const openArenaBlockers = matchdayArenaReady
    ? []
    : !hasLineup
      ? activeLineup?.entries?.length
        ? ["incomplete_lineup"]
        : ["missing_lineup"]
      : !lineupConfirmed
        ? ["lineup_not_submitted"]
        : ["missing_lineup"];
  const trainingComplete = activeTeamTrainingComplete(gameState, activeTeamId);
  // Am letzten Spieltag beendet "advance" die Saison (gamePhase → season_completed),
  // führt also nicht zu einem nächsten Spieltag — Label/CTA müssen das signalisieren.
  const totalMatchdays = gameState.season.matchdayIds?.length ?? 0;
  const currentMatchdayNo = gameState.season.currentMatchday ?? 1;
  const isFinalMatchday = totalMatchdays > 0 && currentMatchdayNo >= totalMatchdays;
  // Weicher Kapitän-Reminder vor der ersten Disziplin für menschliche Teams:
  // die Onboarding-Ernennung ist die eigentliche Pflicht, aber falls der Kapitän
  // mitten in der Saison wegfällt, erinnert die Arena-Stufe hier (blockiert nicht).
  const activeTeam = activeTeamId ? gameState.teams.find((team) => team.teamId === activeTeamId) ?? null : null;
  const humanTeamMissingCaptain =
    activeTeamId != null && Boolean(activeTeam?.humanControlled) && !hasPersistedTeamCaptain(gameState, activeTeamId);
  const storedNewGameFlow = gameState.seasonState.newGameFlow ?? null;
  const seasonIntroStep = storedNewGameFlow?.steps?.find((entry) => entry.stepId === "season_intro");
  const trainingFacilitiesStep = storedNewGameFlow?.steps?.find((entry) => entry.stepId === "training_facilities");
  const seasonIntroHandled = seasonIntroStep?.status === "completed" || seasonIntroStep?.status === "skipped";
  const seasonIntroOpen = Boolean(storedNewGameFlow?.active && !storedNewGameFlow.dismissed && !seasonIntroHandled);
  const trainingFacilitiesHandled = trainingFacilitiesStep?.status === "completed" || trainingFacilitiesStep?.status === "skipped";
  const hasSponsorContract = activeTeamId ? getTeamSponsorContract(gameState, activeTeamId) != null : true;
  const boardSignals = getTeamBoardFlowSignals(gameState, activeTeamId);
  const boardFlowWarnings = uniq([...boardSignals.blockers, ...boardSignals.warnings]);

  return [
    step({
      stepId: "season_intro",
      label: "Season-Briefing lesen",
      cta: "Weiter: Season-Briefing",
      status: seasonIntroOpen ? "ready" : "completed",
      targetView: "home",
      targetPanel: "season-briefing",
      teamId: activeTeamId,
      warnings: activeRosterCount === 0 ? ["empty_roster"] : [],
    }),
    step({
      stepId: "scouting_facilities",
      label: "Scouting prüfen",
      cta: "Weiter: Scouting Hub",
      status: !hasActiveTeam ? "blocked" : activeRosterCount === 0 && !trainingFacilitiesHandled ? "ready" : "completed",
      targetView: "scoutingCenterV2",
      teamId: activeTeamId,
      blockers: hasActiveTeam ? [] : ["no_active_team"],
    }),
    step({
      stepId: "buy_players",
      label: "Kader aufbauen",
      cta: "Weiter: Transfermarkt",
      status: !hasActiveTeam
        ? "blocked"
        : activeRosterCount === 0
          ? buildTransferStepGate(gameState, "buy_players").allowed
            ? "ready"
            : "blocked"
          : "completed",
      targetView: "market",
      teamId: activeTeamId,
      blockers: !hasActiveTeam
        ? ["no_active_team"]
        : activeRosterCount === 0
          ? buildTransferStepGate(gameState, "buy_players").blockers
          : [],
      warnings:
        activeRosterCount === 0
          ? ["empty_roster", ...buildTransferStepGate(gameState, "buy_players").warnings]
          : buildTransferStepGate(gameState, "buy_players").warnings.filter((warning) => warning === "transfer_window_closed"),
    }),
    step({
      stepId: "choose_sponsor",
      label: "Sponsor wählen",
      cta: "Weiter: Sponsor wählen",
      status: !hasActiveTeam ? "blocked" : hasSponsorContract ? "completed" : "optional",
      targetView: "prize",
      targetPanel: "sponsor-choice",
      teamId: activeTeamId,
      optional: !hasSponsorContract,
      blockers: hasActiveTeam ? [] : ["no_active_team"],
    }),
    step({
      stepId: "review_last_matchday",
      label: "Letzten Spieltag prüfen",
      cta: "Weiter: Saisonstand prüfen",
      status: "optional",
      targetView: "season",
      teamId: activeTeamId,
    }),
    step({
      stepId: "check_training",
      label: "Training prüfen",
      cta: "Weiter: Training prüfen",
      status: !hasActiveTeam ? "blocked" : activeRosterCount === 0 ? "blocked" : trainingComplete ? "completed" : "ready",
      targetView: "trainingCompact",
      teamId: activeTeamId,
      blockers: !hasActiveTeam ? ["no_active_team"] : activeRosterCount === 0 ? ["empty_roster"] : [],
      warnings: boardFlowWarnings,
    }),
    step({
      stepId: "finalize_transfers",
      label: GAME_LANGUAGE.flow.finalizeTransfersLabel,
      cta: GAME_LANGUAGE.flow.finalizeTransfersCta,
      status: !hasActiveTeam
        ? "blocked"
        : activeRosterCount === 0
          ? "blocked"
          : transfersFinalized
            ? "completed"
            : "ready",
      targetView: "home",
      targetPanel: "finalize-transfers",
      teamId: activeTeamId,
      blockers: !hasActiveTeam
        ? ["no_active_team"]
        : activeRosterCount === 0
          ? ["empty_roster"]
          : [],
      warnings: hasActiveTeam && activeRosterCount > 0 && !transfersFinalized ? ["transfers_finalize_pending"] : [],
    }),
    step({
      stepId: "set_lineup",
      label: GAME_LANGUAGE.flow.setLineupLabel,
      cta: GAME_LANGUAGE.flow.setLineupCta,
      status: !hasActiveTeam
        ? "blocked"
        : activeRosterCount === 0
          ? "blocked"
          : hasLineup
            ? "completed"
            : !transfersFinalized
              ? "blocked"
              : trainingComplete
                ? "ready"
                : "warning",
      targetView: "lineup",
      teamId: activeTeamId,
      blockers: !hasActiveTeam
        ? ["no_active_team"]
        : activeRosterCount === 0
          ? ["empty_roster"]
          : !hasLineup && !transfersFinalized
            ? ["transfers_not_finalized"]
            : [],
      warnings: uniq([
        ...(!trainingComplete && !hasLineup ? ["training_missing"] : []),
        ...boardFlowWarnings,
      ]),
    }),
    step({
      stepId: "assign_formcards",
      label: GAME_LANGUAGE.flow.formCardPoolLabel,
      cta: GAME_LANGUAGE.flow.formCardPoolCta,
      status: !hasActiveTeam
        ? "blocked"
        : !formCardsRequired
          ? "completed"
          : !hasFormCardPool
            ? "blocked"
            : hasFormCardSelections
              ? "completed"
              : lineupConfirmed
                ? "completed"
                : hasLineup
                  ? "optional"
                  : "warning",
      targetView: "lineup",
      targetPanel: "form-board",
      teamId: activeTeamId,
      optional: formCardsRequired && hasFormCardPool && !hasFormCardSelections,
      blockers: !hasActiveTeam
        ? ["no_active_team"]
        : formCardsRequired && !hasFormCardPool
          ? ["missing_formcard_pool"]
          : [],
      warnings:
        formCardsRequired && hasFormCardPool && !hasFormCardSelections && hasLineup && !lineupConfirmed
          ? ["formcards_assignment_optional"]
          : [],
    }),
    step({
      stepId: "confirm_lineup",
      label: GAME_LANGUAGE.flow.confirmLineupLabel,
      cta: GAME_LANGUAGE.flow.confirmLineupCta,
      status: !hasActiveTeam ? "blocked" : lineupConfirmed ? "completed" : hasLineup ? "ready" : "blocked",
      targetView: "lineup",
      teamId: activeTeamId,
      blockers: !hasActiveTeam ? ["no_active_team"] : hasLineup ? [] : ["missing_lineup"],
    }),
    step({
      stepId: "open_arena",
      label: "Arena starten",
      cta: "Weiter: Arena starten",
      status: hasResults ? "completed" : matchdayArenaReady ? "ready" : "blocked",
      targetView: "matchdayArena",
      teamId: activeTeamId,
      blockers: openArenaBlockers,
      warnings: humanTeamMissingCaptain && !hasResults ? [...boardFlowWarnings, "captain_recommended"] : boardFlowWarnings,
    }),
    step({
      stepId: "run_reveal",
      label: "Reveal laufen lassen",
      cta: "Weiter: Reveal prüfen",
      status: hasResults ? "completed" : matchdayArenaReady ? "ready" : "blocked",
      targetView: "matchdayArena",
      teamId: activeTeamId,
      blockers: openArenaBlockers,
    }),
    step({
      stepId: "review_matchday_results",
      label: "Spieltagsergebnis anschauen",
      cta: "Weiter: Ergebnis anschauen",
      status: hasResults ? "ready" : "blocked",
      targetView: "matchdayArena",
      targetPanel: "arena-result-summary",
      teamId: activeTeamId,
      blockers: hasResults ? [] : ["missing_results"],
    }),
    step({
      stepId: "open_season_standings",
      label: "Saisonstand prüfen",
      cta: "Weiter: Saisonstand prüfen",
      status: hasResults ? "ready" : "optional",
      targetView: "season",
      teamId: activeTeamId,
    }),
    step({
      stepId: "matchday_facilities",
      label: "Gebäude prüfen (optional)",
      cta: "Optional: Gebäude prüfen",
      status: !hasActiveTeam
        ? "blocked"
        : !hasResults
          ? "blocked"
          : teamHasAffordableFacilityUpgrade(gameState, activeTeamId)
            ? "optional"
            : "completed",
      targetView: "trainingV2",
      targetPanel: "facilities",
      teamId: activeTeamId,
      optional: hasResults && teamHasAffordableFacilityUpgrade(gameState, activeTeamId),
      warnings: teamHasAffordableFacilityUpgrade(gameState, activeTeamId) ? ["facility_upgrade_optional"] : [],
    }),
    step({
      stepId: "advance_to_next_matchday",
      label: isFinalMatchday ? "Saison abschließen" : "Zum nächsten Spieltag",
      cta: isFinalMatchday ? "Weiter: Zur Saison-Auswertung" : "Weiter: Matchday fortsetzen",
      status: hasResults ? (boardSignals.blockers.length > 0 ? "warning" : "ready") : "blocked",
      targetView: "cockpit",
      teamId: activeTeamId,
      blockers: hasResults ? [] : ["missing_results"],
      warnings: boardFlowWarnings,
    }),
  ];
}

function chooseCurrentStep(steps: GameFlowStep[]) {
  return (
    steps.find((entry) => entry.status === "ready" || entry.status === "warning" || entry.status === "blocked") ??
    steps.find((entry) => entry.status === "optional") ??
    steps[steps.length - 1]!
  );
}

function derivePhase(gameState: GameState, activeTeamId: string | null): GameFlowPhase {
  const preseasonPhase = derivePreseasonPhase(gameState);
  if (preseasonPhase) return preseasonPhase;
  if (hasCurrentMatchdayResult(gameState) || gameState.matchdayState.status === "resolved") return "matchday_result";
  const activeLineup = getActiveTeamLineup(gameState, activeTeamId);
  if (isTeamMatchdayLineupSubmitted(activeLineup)) {
    return "matchday_ready";
  }
  if (activeLineup && activeLineup.entries.length > 0) return "matchday_prep";
  return "season_active";
}

export function isActiveMatchdayPreparation(gameState: GameState) {
  if (derivePreseasonPhase(gameState)) {
    return false;
  }
  if (hasCurrentMatchdayResult(gameState) || gameState.matchdayState.status === "resolved") {
    return false;
  }
  return (gameState.gamePhase ?? "season_active") === "season_active";
}

const SEASON_BRIEFING_END_GAME_PHASES = new Set<GamePhase>([
  "season_completed",
  "season_review",
  "season_rewards",
  "player_development",
]);

const SEASON_BRIEFING_PRESEASON_GAME_PHASES = new Set<GamePhase>([
  "preseason_management",
  "transfer_sell_phase",
  "transfer_buy_phase",
  "lineup_setup",
  "next_season_ready",
]);

export function shouldAutoOpenSeasonBriefing(
  gameState: GameState,
  seasonIntroStepStatus: NewGameFlowStepStatus | null | undefined,
): boolean {
  if (seasonIntroStepStatus !== "open") {
    return false;
  }

  if (gameState.season.isCompleted === true) {
    return false;
  }

  const gamePhase = gameState.gamePhase ?? "season_active";
  if (SEASON_BRIEFING_END_GAME_PHASES.has(gamePhase)) {
    return false;
  }

  if (SEASON_BRIEFING_PRESEASON_GAME_PHASES.has(gamePhase)) {
    return true;
  }

  if (gamePhase !== "season_active") {
    return false;
  }

  const seasonId = gameState.season.id;
  const currentMatchday = gameState.season.currentMatchday ?? 1;
  const totalMatchdays = gameState.season.totalMatchdays ?? 10;
  if (currentMatchday > 1) {
    return false;
  }

  if (currentMatchday >= totalMatchdays && gameState.matchdayState.status === "resolved") {
    return false;
  }

  const hasResolvedSeasonResults = (gameState.seasonState.matchdayResults ?? []).some(
    (result) => result.seasonId === seasonId,
  );
  if (hasResolvedSeasonResults) {
    return false;
  }

  const standingsHavePoints = Object.values(gameState.seasonState.standings ?? {}).some(
    (entry) => (entry.points ?? 0) > 0,
  );
  if (standingsHavePoints) {
    return false;
  }

  return true;
}

export function getGameFlowTransferWindowHint(gameState: GameState) {
  return getTransferWindowStatus(gameState);
}

export function buildGameFlowState(input: { gameState: GameState; activeTeamId?: string | null }): GameFlowState {
  const activeTeamId = input.activeTeamId ?? null;
  const phase = derivePhase(input.gameState, activeTeamId);
  const rawSteps =
    phase === "preseason" || phase === "season_review" || phase === "season_end" || phase === "season_transition"
      ? buildPreseasonSteps(input.gameState, activeTeamId)
      : buildMatchdaySteps(input.gameState, activeTeamId);
  const steps =
    phase === "preseason" || phase === "season_review" || phase === "season_end" || phase === "season_transition"
      ? rawSteps
      : mergeOnboardingFlowSteps(rawSteps, input.gameState, activeTeamId);
  const currentStep = chooseCurrentStep(steps);
  const currentStepIndex = Math.max(0, steps.findIndex((entry) => entry.stepId === currentStep.stepId));
  const nextStep =
    steps.slice(currentStepIndex + 1).find((entry) => entry.status === "ready" || entry.status === "warning" || entry.status === "optional") ??
    null;

  return {
    phase,
    activeTeamId,
    activeSeasonId: input.gameState.season.id,
    activeMatchday: input.gameState.season.currentMatchday ?? null,
    currentStepId: currentStep.stepId,
    nextStepId: nextStep?.stepId ?? null,
    completedSteps: steps.filter((entry) => entry.status === "completed").map((entry) => entry.stepId),
    blockedSteps: steps.filter((entry) => entry.status === "blocked").map((entry) => entry.stepId),
    warnings: uniq(steps.flatMap((entry) => entry.warnings)),
    steps,
    currentStep,
    nextStep,
  };
}
