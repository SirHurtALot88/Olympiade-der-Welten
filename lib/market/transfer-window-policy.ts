import type { GamePhase, GameState } from "@/lib/data/olyDataTypes";

export const LOCAL_TRANSFER_WINDOW_PHASE = "manual_transfer_window";

export type LocalTransferWindowPhase = typeof LOCAL_TRANSFER_WINDOW_PHASE;

const TRANSFER_SELL_PHASES = new Set<GamePhase>([
  "preseason_management",
  "transfer_sell_phase",
]);

const TRANSFER_BUY_PHASES = new Set<GamePhase>([
  "preseason_management",
  "transfer_buy_phase",
]);

export function isExplicitLocalTransferWindowPhase(value: string | null | undefined): value is LocalTransferWindowPhase {
  return value === LOCAL_TRANSFER_WINDOW_PHASE;
}

function hasCurrentMatchdayResult(gameState: GameState) {
  return (gameState.seasonState.matchdayResults ?? []).some(
    (result) => result.seasonId === gameState.season.id && result.matchdayId === gameState.matchdayState.matchdayId,
  );
}

function isEarlySeasonTransferSetup(gameState: GameState) {
  const phase = gameState.gamePhase ?? "season_active";
  const currentMatchday = gameState.season.currentMatchday ?? 1;
  const matchdayStillOpen = gameState.matchdayState.status !== "resolved";
  return phase === "season_active" && currentMatchday <= 1 && matchdayStillOpen && !hasCurrentMatchdayResult(gameState);
}

export function isTransferMarketPhaseOpen(gameState: GameState) {
  const phase = gameState.gamePhase ?? "season_active";
  return TRANSFER_SELL_PHASES.has(phase) || TRANSFER_BUY_PHASES.has(phase) || isEarlySeasonTransferSetup(gameState);
}

export function isTransferSellPhaseOpen(gameState: GameState) {
  const phase = gameState.gamePhase ?? "season_active";
  return TRANSFER_SELL_PHASES.has(phase) || isEarlySeasonTransferSetup(gameState);
}

export function isTransferBuyPhaseOpen(gameState: GameState) {
  const phase = gameState.gamePhase ?? "season_active";
  return TRANSFER_BUY_PHASES.has(phase) || isEarlySeasonTransferSetup(gameState);
}

export function getTransferWindowStatus(gameState: GameState) {
  const phase = gameState.gamePhase ?? "season_active";
  const canSell = isTransferSellPhaseOpen(gameState);
  const canBuy = isTransferBuyPhaseOpen(gameState);
  const open = canSell || canBuy;
  const label = open
    ? phase === "transfer_sell_phase"
      ? "Verkaufsfenster"
      : phase === "transfer_buy_phase"
        ? "Kaufphase"
        : isEarlySeasonTransferSetup(gameState)
          ? "Saisonstart-Setup"
          : "Transferfenster offen"
    : "Transferfenster geschlossen";

  return {
    open,
    phase,
    label,
    canSell,
    canBuy,
    explicitWindowPhase: LOCAL_TRANSFER_WINDOW_PHASE,
    reason: open ? null : `phase_blocked:${phase}`,
  };
}
