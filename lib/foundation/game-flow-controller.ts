import type { GameState } from "@/lib/data/olyDataTypes";
import { GAME_LANGUAGE } from "@/lib/ui/game-language";
import {
  activeTeamHasFormCardPool,
  activeTeamHasFormCardSelections,
} from "@/lib/foundation/form-card-flow";
import {
  getTeamMatchdayLineupDraft,
  isTeamMatchdayLineupComplete,
  isTeamMatchdayLineupSubmitted,
} from "@/lib/foundation/matchday-lineup-readiness";

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
  return isTeamMatchdayLineupComplete(gameState, lineup.teamId, lineup);
}

function activeTeamHasFormCards(gameState: GameState, activeTeamId: string | null) {
  return activeTeamHasFormCardSelections(gameState, activeTeamId);
}

function activeTeamTrainingComplete(gameState: GameState, activeTeamId: string | null) {
  const rosterPlayerIds = getActiveTeamRosterPlayerIds(gameState, activeTeamId);
  if (rosterPlayerIds.length === 0) return false;
  const playersById = new Map(gameState.players.map((player) => [player.id, player] as const));
  return rosterPlayerIds.every((playerId) => playersById.get(playerId)?.trainingMode != null);
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
    }),
    step({
      stepId: "facilities",
      label: "Facilities prüfen",
      cta: "Weiter: Facilities prüfen",
      status: "optional",
      targetView: "trainingV2",
      targetPanel: "facilities",
      teamId: activeTeamId,
    }),
    step({
      stepId: "player_development",
      label: "Spieler entwickeln",
      cta: "Weiter: Spielerentwicklung",
      status: !hasSeasonHistory && isFirstSeason ? "completed" : completedTransitionSteps.has("player_development") ? "completed" : "ready",
      targetView: "trainingCompact",
      targetPanel: "season-end-development",
      teamId: activeTeamId,
    }),
    step({
      stepId: "sell_players",
      label: "Spieler verkaufen",
      cta: "Weiter: Spieler verkaufen",
      status: !hasActiveTeam ? "blocked" : activeRosterCount === 0 ? "completed" : "ready",
      targetView: "teams",
      targetPanel: "roster",
      teamId: activeTeamId,
      blockers: hasActiveTeam ? [] : ["no_active_team"],
    }),
    step({
      stepId: "buy_players",
      label: "Spieler kaufen",
      cta: "Weiter: Spieler kaufen",
      status: hasActiveTeam ? "ready" : "blocked",
      targetView: "market",
      teamId: activeTeamId,
      blockers: hasActiveTeam ? [] : ["no_active_team"],
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
      status: gamePhase === "next_season_ready" ? "completed" : "ready",
      targetView: "cockpit",
      teamId: activeTeamId,
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

function buildMatchdaySteps(gameState: GameState, activeTeamId: string | null): GameFlowStep[] {
  const hasActiveTeam = activeTeamId != null && gameState.teams.some((team) => team.teamId === activeTeamId);
  const activeRosterCount = getActiveTeamRosterPlayerIds(gameState, activeTeamId).length;
  const activeLineup = getActiveTeamLineup(gameState, activeTeamId);
  const hasLineup = isCurrentMatchdayLineupComplete(gameState, activeLineup);
  const lineupConfirmed = isTeamMatchdayLineupSubmitted(activeLineup);
  const hasFormCards = activeTeamHasFormCards(gameState, activeTeamId);
  const hasFormCardPool = activeTeamHasFormCardPool(gameState, activeTeamId);
  const hasResults = hasCurrentMatchdayResult(gameState) || gameState.matchdayState.status === "resolved";
  const formCardsRequired = hasLineup && !hasResults;
  const matchdayArenaReady = hasLineup && (!formCardsRequired || hasFormCards);
  const openArenaBlockers = matchdayArenaReady
    ? []
    : !hasLineup
      ? ["missing_lineup"]
      : formCardsRequired && !hasFormCards
        ? ["missing_formcard_selections"]
        : ["missing_lineup"];
  const trainingComplete = activeTeamTrainingComplete(gameState, activeTeamId);
  const storedNewGameFlow = gameState.seasonState.newGameFlow ?? null;
  const seasonIntroStep = storedNewGameFlow?.steps?.find((entry) => entry.stepId === "season_intro");
  const trainingFacilitiesStep = storedNewGameFlow?.steps?.find((entry) => entry.stepId === "training_facilities");
  const seasonIntroHandled = seasonIntroStep?.status === "completed" || seasonIntroStep?.status === "skipped";
  const seasonIntroOpen = Boolean(storedNewGameFlow?.active && !storedNewGameFlow.dismissed && !seasonIntroHandled);
  const trainingFacilitiesHandled = trainingFacilitiesStep?.status === "completed" || trainingFacilitiesStep?.status === "skipped";

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
      label: "Scouting & Gebäude prüfen",
      cta: "Weiter: Gebäude prüfen",
      status: !hasActiveTeam ? "blocked" : activeRosterCount === 0 && !trainingFacilitiesHandled ? "ready" : "completed",
      targetView: "trainingV2",
      targetPanel: "facilities",
      teamId: activeTeamId,
      blockers: hasActiveTeam ? [] : ["no_active_team"],
    }),
    step({
      stepId: "buy_players",
      label: "Kader aufbauen",
      cta: "Weiter: Transfermarkt",
      status: !hasActiveTeam ? "blocked" : activeRosterCount === 0 ? "ready" : "completed",
      targetView: "market",
      teamId: activeTeamId,
      blockers: hasActiveTeam ? [] : ["no_active_team"],
      warnings: activeRosterCount === 0 ? ["empty_roster"] : [],
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
      targetView: "trainingV2",
      targetPanel: "training-plan",
      teamId: activeTeamId,
      blockers: !hasActiveTeam ? ["no_active_team"] : activeRosterCount === 0 ? ["empty_roster"] : [],
    }),
    step({
      stepId: "set_lineup",
      label: GAME_LANGUAGE.flow.setLineupLabel,
      cta: GAME_LANGUAGE.flow.setLineupCta,
      status: !hasActiveTeam
        ? "blocked"
        : activeRosterCount === 0
          ? "blocked"
          : !trainingComplete
            ? "blocked"
            : hasLineup
              ? "completed"
              : "ready",
      targetView: "lineup",
      teamId: activeTeamId,
      blockers: !hasActiveTeam
        ? ["no_active_team"]
        : activeRosterCount === 0
          ? ["empty_roster"]
          : !trainingComplete
            ? ["training_missing"]
            : [],
    }),
    step({
      stepId: "assign_formcards",
      label: "Formkarten zuweisen",
      cta: "Weiter: Formkarten prüfen",
      status: !hasActiveTeam
        ? "blocked"
        : !formCardsRequired
          ? "completed"
          : hasFormCards
            ? "completed"
            : !hasFormCardPool
              ? "blocked"
              : hasLineup
                ? "ready"
                : "warning",
      targetView: "lineup",
      teamId: activeTeamId,
      blockers: !hasActiveTeam
        ? ["no_active_team"]
        : formCardsRequired && !hasFormCardPool
          ? ["missing_formcard_pool"]
          : formCardsRequired && hasLineup && !hasFormCards
            ? ["missing_formcard_selections"]
            : [],
      warnings: formCardsRequired && hasLineup && !hasFormCards && hasFormCardPool ? ["missing_formcards"] : [],
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
      warnings: matchdayArenaReady && !lineupConfirmed ? ["lineup_not_submitted"] : [],
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
      stepId: "advance_to_next_matchday",
      label: "Zum nächsten Spieltag",
      cta: "Weiter: Matchday fortsetzen",
      status: hasResults ? "ready" : "blocked",
      targetView: "cockpit",
      teamId: activeTeamId,
      blockers: hasResults ? [] : ["missing_results"],
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

export function buildGameFlowState(input: { gameState: GameState; activeTeamId?: string | null }): GameFlowState {
  const activeTeamId = input.activeTeamId ?? null;
  const phase = derivePhase(input.gameState, activeTeamId);
  const steps =
    phase === "preseason" || phase === "season_review" || phase === "season_end" || phase === "season_transition"
      ? buildPreseasonSteps(input.gameState, activeTeamId)
      : buildMatchdaySteps(input.gameState, activeTeamId);
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
