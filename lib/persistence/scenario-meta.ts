import type { GamePhase, GameState, ScenarioMeta, ScenarioType } from "@/lib/data/olyDataTypes";

const scenarioLabels: Record<ScenarioType, string> = {
  fresh_start: "Fresh Start",
  new_game: "New Game",
  ai_redraft_test: "AI Redraft Test",
  season1_simulation: "Season 1 Simulation",
  season1_completed: "Season 1 Completed",
  season_transition_test: "Season Transition Test",
  season2_start: "Season 2 Start",
  live_feature_test: "Live Feature Test",
  sandbox_multiseason_test: "Oly Sandbox Multi-Season Test",
  manager_multiplayer_test: "Manager Multiplayer Test",
  sandbox_snapshot: "Sandbox Snapshot",
};

export function hasFinalStandings(gameState: GameState) {
  const standings = gameState.seasonState.standings ?? {};
  const teamsWithPoints = Object.values(standings).filter((row) => (row.points ?? 0) > 0).length;
  const matchdayIds = gameState.season.matchdayIds ?? [];
  const lastMatchdayId = matchdayIds[matchdayIds.length - 1] ?? null;
  const hasLastResult = Boolean(
    lastMatchdayId &&
      (gameState.seasonState.matchdayResults ?? []).some(
        (result) => result.seasonId === gameState.season.id && result.matchdayId === lastMatchdayId,
      ),
  );

  return teamsWithPoints > 0 && hasLastResult;
}

export function hasSeasonHistory(gameState: GameState) {
  return (
    (gameState.seasonState.seasonSnapshots?.length ?? 0) > 0 ||
    (gameState.seasonState.matchdayResults?.length ?? 0) > 0 ||
    (gameState.seasonState.playerDisciplinePerformances?.length ?? 0) > 0 ||
    Boolean(gameState.seasonReviewState)
  );
}

export function inferScenarioType(gameState: GameState): ScenarioType {
  if (gameState.scenarioMeta?.scenarioType) {
    return gameState.scenarioMeta.scenarioType;
  }
  if (gameState.season.id === "season-2" && gameState.matchdayState.matchdayId === "matchday-1") {
    return "season2_start";
  }
  if ((gameState.gamePhase as GamePhase | undefined) === "season_completed" && hasFinalStandings(gameState)) {
    return "season1_completed";
  }
  if (gameState.transferHistory.some((entry) => entry.source === "ai_clean_redraft" || entry.source === "ai_pick_execute")) {
    return "ai_redraft_test";
  }
  return "fresh_start";
}

export function buildScenarioMeta(input: {
  gameState: GameState;
  scenarioType?: ScenarioType;
  label?: string;
  description?: string;
  sourceSaveId?: string;
  isStableTestPoint?: boolean;
  allowTestWrites?: boolean;
  containsFinalStandings?: boolean;
  containsSeasonHistory?: boolean;
  createdAt?: string;
}): ScenarioMeta {
  const scenarioType = input.scenarioType ?? inferScenarioType(input.gameState);
  const preserveDeclaredHistory =
    scenarioType === "sandbox_multiseason_test" || scenarioType === "sandbox_snapshot";
  const activeMatchday = Number.isFinite(input.gameState.season.currentMatchday)
    ? input.gameState.season.currentMatchday
    : Number.parseInt(input.gameState.matchdayState.matchdayId.replace(/\D+/g, ""), 10) || undefined;

  return {
    scenarioType,
    label: input.label ?? input.gameState.scenarioMeta?.label ?? scenarioLabels[scenarioType],
    ...(input.description ?? input.gameState.scenarioMeta?.description
      ? { description: input.description ?? input.gameState.scenarioMeta?.description }
      : {}),
    createdAt: input.createdAt ?? input.gameState.scenarioMeta?.createdAt ?? new Date().toISOString(),
    ...(input.sourceSaveId ?? input.gameState.scenarioMeta?.sourceSaveId
      ? { sourceSaveId: input.sourceSaveId ?? input.gameState.scenarioMeta?.sourceSaveId }
      : {}),
    isStableTestPoint: input.isStableTestPoint ?? input.gameState.scenarioMeta?.isStableTestPoint ?? false,
    allowTestWrites: input.allowTestWrites ?? input.gameState.scenarioMeta?.allowTestWrites ?? false,
    containsFinalStandings:
      input.containsFinalStandings ??
      (preserveDeclaredHistory ? input.gameState.scenarioMeta?.containsFinalStandings : undefined) ??
      hasFinalStandings(input.gameState),
    containsSeasonHistory:
      input.containsSeasonHistory ??
      (preserveDeclaredHistory ? input.gameState.scenarioMeta?.containsSeasonHistory : undefined) ??
      hasSeasonHistory(input.gameState),
    activeSeasonId: input.gameState.season.id,
    activeMatchday,
    gamePhase: input.gameState.gamePhase ?? "season_active",
  };
}

export function withScenarioMeta(gameState: GameState, meta: Partial<ScenarioMeta> & { scenarioType?: ScenarioType; label?: string }) {
  const scenarioMeta = {
    ...buildScenarioMeta({
      gameState,
      scenarioType: meta.scenarioType,
      label: meta.label,
      description: meta.description,
      sourceSaveId: meta.sourceSaveId,
      isStableTestPoint: meta.isStableTestPoint,
      allowTestWrites: meta.allowTestWrites,
      containsFinalStandings: meta.containsFinalStandings,
      containsSeasonHistory: meta.containsSeasonHistory,
      createdAt: meta.createdAt,
    }),
    ...meta,
  };
  return {
    ...gameState,
    scenarioMeta,
  };
}
