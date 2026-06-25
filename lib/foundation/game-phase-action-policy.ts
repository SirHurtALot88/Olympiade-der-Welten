import type { GamePhase, GameState } from "@/lib/data/olyDataTypes";
import {
  getTransferWindowStatus,
  isTransferBuyPhaseOpen,
  isTransferMarketPhaseOpen,
  isTransferSellPhaseOpen,
} from "@/lib/market/transfer-window-policy";

export type GamePhaseAction =
  | "buy_players"
  | "sell_players"
  | "renew_contract"
  | "set_training"
  | "facility_apply"
  | "set_lineup"
  | "resolve_matchday"
  | "complete_season"
  | "apply_progression";

export type GamePhaseActionGate = {
  action: GamePhaseAction;
  phase: GamePhase;
  allowed: boolean;
  reason: string | null;
  warnings: string[];
};

const PRESEASON_MANAGEMENT_PHASES = new Set<GamePhase>([
  "preseason_management",
  "transfer_sell_phase",
  "transfer_buy_phase",
  "lineup_setup",
  "next_season_ready",
]);

const PROGRESSION_PHASES = new Set<GamePhase>([
  "season_completed",
  "season_review",
  "season_rewards",
  "player_development",
  "preseason_management",
  "transfer_sell_phase",
  "transfer_buy_phase",
  "lineup_setup",
  "next_season_ready",
]);

function hasCurrentMatchdayResult(gameState: GameState) {
  return (gameState.seasonState.matchdayResults ?? []).some(
    (result) => result.seasonId === gameState.season.id && result.matchdayId === gameState.matchdayState.matchdayId,
  );
}

function isEarlySeasonSetup(gameState: GameState) {
  const phase = gameState.gamePhase ?? "season_active";
  const currentMatchday = gameState.season.currentMatchday ?? 1;
  const matchdayStillOpen = gameState.matchdayState.status !== "resolved";
  return phase === "season_active" && currentMatchday <= 1 && matchdayStillOpen && !hasCurrentMatchdayResult(gameState);
}

function isPreseasonManagementOpen(gameState: GameState) {
  return isTransferMarketPhaseOpen(gameState);
}

function isSeasonComplete(gameState: GameState) {
  const lastMatchdayId = gameState.season.matchdayIds[gameState.season.matchdayIds.length - 1] ?? null;
  if (!lastMatchdayId) return false;
  return (gameState.seasonState.matchdayResults ?? []).some(
    (result) => result.seasonId === gameState.season.id && result.matchdayId === lastMatchdayId,
  );
}

export function evaluateGamePhaseAction(gameState: GameState, action: GamePhaseAction): GamePhaseActionGate {
  const phase = gameState.gamePhase ?? "season_active";
  const warnings: string[] = [];
  let allowed = false;
  let reason: string | null = null;

  if (action === "buy_players") {
    allowed = isTransferBuyPhaseOpen(gameState);
    reason = allowed ? null : `phase_blocked:${action}:${phase}`;
  } else if (action === "sell_players") {
    allowed = isTransferSellPhaseOpen(gameState);
    reason = allowed ? null : `phase_blocked:${action}:${phase}`;
  } else if (
    action === "renew_contract" ||
    action === "set_training" ||
    action === "facility_apply"
  ) {
    allowed = isPreseasonManagementOpen(gameState);
    reason = allowed ? null : `phase_blocked:${action}:${phase}`;
  } else if (action === "set_lineup") {
    allowed = phase === "season_active" || phase === "lineup_setup" || phase === "next_season_ready";
    reason = allowed ? null : `phase_blocked:set_lineup:${phase}`;
  } else if (action === "resolve_matchday") {
    allowed = phase === "season_active" || phase === "lineup_setup";
    reason = allowed ? null : `phase_blocked:resolve_matchday:${phase}`;
  } else if (action === "complete_season") {
    allowed = phase === "season_completed" || phase === "season_review" || isSeasonComplete(gameState);
    reason = allowed ? null : `phase_blocked:complete_season:${phase}`;
  } else if (action === "apply_progression") {
    allowed = PROGRESSION_PHASES.has(phase);
    reason = allowed ? null : `phase_blocked:apply_progression:${phase}`;
  }

  if (
    isEarlySeasonSetup(gameState) &&
    ["buy_players", "sell_players", "renew_contract", "set_training", "facility_apply"].includes(action)
  ) {
    warnings.push("early_season_setup_allowed_before_first_result");
  }

  if ((action === "buy_players" || action === "sell_players") && !allowed) {
    warnings.push(getTransferWindowStatus(gameState).reason ?? "transfer_window_closed");
  }

  return {
    action,
    phase,
    allowed,
    reason,
    warnings,
  };
}
