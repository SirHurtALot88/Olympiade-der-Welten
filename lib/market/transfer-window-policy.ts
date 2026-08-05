import type { GamePhase, GameState } from "@/lib/data/olyDataTypes";

export const LOCAL_TRANSFER_WINDOW_PHASE = "manual_transfer_window";

export type LocalTransferWindowPhase = typeof LOCAL_TRANSFER_WINDOW_PHASE;

/**
 * Am Saisonende darf VERKAUFT und VERLAENGERT werden. `preseason_management` ist die erste
 * Station, auf die die Saisonende-Kette schaltet — sie oeffnet genau dieses Fenster.
 */
const TRANSFER_SELL_PHASES = new Set<GamePhase>([
  "preseason_management",
  "transfer_sell_phase",
]);

/**
 * KAUFEN gehoert NICHT ans Saisonende.
 *
 * GEMELDET: „bei Transferfenster öffnen wäre eher Verkäufe / Verträge öffnen. Man soll noch NICHT
 * kaufen. Kaufen findet in S2 vor MD1 statt! Das muss sauber getrennt sein"
 *
 * Genau so war es NICHT. `preseason_management` stand in beiden Mengen — die Phase, auf die der
 * Knopf „Transferfenster öffnen" im Saisonabschluss schaltet, machte damit Verkaufen UND Kaufen in
 * einem Zug auf. Der Saisonabschluss sagte das sogar laut („verkaufen und kaufen sind
 * freigeschaltet"), also war die Anzeige ehrlich und die Regel falsch.
 *
 * Kaufen bleibt an zwei Stellen offen, beide NACH dem Verkaufsfenster:
 *   - `transfer_buy_phase` — die eigene Kaufstation der Kette (nur ueber den Cockpit-Assistenten
 *     erreichbar; die Checkliste haelt bei `preseason_management` an),
 *   - `isEarlySeasonTransferSetup` — die neue Saison vor ihrem ersten Spieltag. Das ist der Weg,
 *     den die Checkliste selbst geht: verkaufen/verlaengern → „Neue Saison starten" → kaufen.
 */
const TRANSFER_BUY_PHASES = new Set<GamePhase>([
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

export type TransferWindowAction = "buy_players" | "sell_players";

/**
 * Typed, serializable rejection for a buy/sell attempted outside the transfer window. Shaped to
 * carry the exact reason string the routes (`app/api/transfermarkt/buy`,
 * `app/api/transfermarkt/sell`) already compute via `evaluateGamePhaseAction` and return today
 * (`phase_blocked:<action>:<phase>`, HTTP 409) — so a route mapping this error keeps the same
 * status/message the UI has always seen, whether the route's own pre-check or this service-level
 * check is what actually caught it (S7: defense in depth at the point of mutation).
 */
export class TransferWindowClosedError extends Error {
  readonly httpStatus = 409 as const;
  readonly action: TransferWindowAction;
  readonly phase: GamePhase;
  /** Matches `GamePhaseActionGate.reason` for the same action/gameState, e.g.
   *  "phase_blocked:buy_players:season_active". */
  readonly reason: string;

  constructor(action: TransferWindowAction, gameState: GameState) {
    const phase = gameState.gamePhase ?? "season_active";
    const reason = `phase_blocked:${action}:${phase}`;
    super(reason);
    this.name = "TransferWindowClosedError";
    this.action = action;
    this.phase = phase;
    this.reason = reason;
  }
}

export function getTransferWindowStatus(gameState: GameState) {
  const phase = gameState.gamePhase ?? "season_active";
  const canSell = isTransferSellPhaseOpen(gameState);
  const canBuy = isTransferBuyPhaseOpen(gameState);
  const open = canSell || canBuy;
  // Beschriftung aus canSell/canBuy abgeleitet statt aus der Phase aufgezaehlt: sonst heisst
  // `preseason_management` weiter „Transferfenster offen", obwohl dort nur noch verkauft werden
  // darf — genau die Vermischung, die gemeldet wurde.
  const label = !open
    ? "Transferfenster geschlossen"
    : isEarlySeasonTransferSetup(gameState)
      ? "Saisonstart-Setup"
      : canSell && !canBuy
        ? "Verkaufsfenster"
        : canBuy && !canSell
          ? "Kaufphase"
          : "Transferfenster offen";

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
