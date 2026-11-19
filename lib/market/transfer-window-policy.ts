import type { GamePhase, GameState } from "@/lib/data/olyDataTypes";
import { istTransferfensterGemeinsam } from "@/lib/market/transferfenster-gemeinsam";

export const LOCAL_TRANSFER_WINDOW_PHASE = "manual_transfer_window";

export type LocalTransferWindowPhase = typeof LOCAL_TRANSFER_WINDOW_PHASE;

/**
 * DIE REGEL — zwei Fenster, die sich NIE ueberschneiden.
 *
 * GEMELDET: „am ENDE der saison werden verträge verlängert, leute abgelöst und verkauft — zu
 * beginn der neuen saison wird eingekauft dafür wird dort NICHT MEHR verkauft!"
 *
 *   Saisonende (alte Saison)   → verkaufen, abloesen, verlaengern.  KEIN Kaufen.
 *   Saisonstart (neue Saison)  → kaufen.                            KEIN Verkaufen.
 *
 * Vorher stimmte keine der beiden Haelften: `preseason_management` stand in BEIDEN Mengen (also
 * Kaufen schon am Saisonende), und `isEarlySeasonTransferSetup` oeffnete ebenfalls beides (also
 * Verkaufen noch im Saisonstart). Die zwei Fenster waren de facto ein einziges, das ueber den
 * Saisonwechsel hinweg durchlief.
 *
 * Beide Mengen sind darum bewusst DISJUNKT, und `isEarlySeasonTransferSetup` zaehlt nur noch fuers
 * Kaufen. Ein Test haelt die Disjunktheit fest, damit die Trennung nicht wieder verwaescht.
 *
 * NEU SEIT 18.11. — EIN GEMEINSAMES FENSTER (Chris: „ok dann mach das so!", Schalter
 * `istTransferfensterGemeinsam`, Standard AN): Kaufen UND Verkaufen sind in der neuen Saison vor
 * Spieltag 1 offen, in beliebiger Reihenfolge. Das Saisonende bleibt fuer Abrechnung, Vertragsenden und
 * Verlaengerungen (`isTransferMarketPhaseOpen` haelt dafuer die Saisonende-Stationen weiter offen), aber
 * verkauft wird dort nicht mehr. Die Regel von oben („zwei Fenster, nie ueberschneidend") gilt nur noch
 * mit `OLY_TRANSFERFENSTER_GEMEINSAM=0`.
 */
const TRANSFER_SELL_PHASES = new Set<GamePhase>([
  "season_end_management",
  "transfer_sell_phase",
]);

/**
 * Am Saisonende gibt es KEINE Kaufphase — fuer niemanden. Leer ist hier die Aussage.
 *
 * `transfer_buy_phase` stand hier und ist raus: die Station liegt in der Saisonende-Kette, also
 * VOR „Neue Saison starten" und damit noch in der alten Saison. Sie ist heute eine reine
 * BESCHRIFTUNG der Kette — hier kauft NIEMAND mehr, auch die KI nicht. (Eine aeltere Fassung
 * dieses Kommentars nannte sie „die Station der KI" — das war der Stand vor Chris' Regel
 * „verkauft wird als separater Schritt zum Saisonende, gekauft erst in der Folgesaison" und hat
 * bereits einmal in die Irre gefuehrt.) Die KI-Kaufsperre am Saisonende sitzt im Apply-Dienst
 * (`saisonendeKaufsperre`, ai-market-plan-apply-service) und in der Plan-Vorschau
 * (`kaeufeAufsKauffensterVerschoben`, ai-market-plan-preview-service).
 * Gekauft wird — Mensch wie KI — ausschliesslich in der neuen Saison vor ihrem ersten Spieltag
 * (`isEarlySeasonTransferSetup`): der Mensch ueber den Markt, die KI ueber den
 * Preseason-Hintergrundlauf, den der Client in genau diesem Fenster anstoesst.
 */
const TRANSFER_BUY_PHASES = new Set<GamePhase>([]);

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
  if (istTransferfensterGemeinsam()) {
    // EIN Fenster: verkauft wird dort, wo auch gekauft wird — in der neuen Saison vor Spieltag 1.
    // Am Saisonende NICHT mehr (dort laufen nur noch Vertragsenden und Verlaengerungen).
    return isEarlySeasonTransferSetup(gameState);
  }
  // ALTER ABLAUF (Schalter aus): KEIN `isEarlySeasonTransferSetup`, der Saisonstart ist die
  // Kaufphase. Wer verkaufen will, tut das am Ende der Saison.
  return TRANSFER_SELL_PHASES.has(phase);
}

/**
 * Die Saisonende-Stationen, in denen Vertraege verlaengert werden (und im alten Ablauf verkauft wurde).
 * Bleibt im gemeinsamen Fenster offen fuer `renew_contract`, Training, Gebaeude und Kredite.
 */
export function isSeasonEndManagementOpen(gameState: GameState) {
  const phase = gameState.gamePhase ?? "season_active";
  return TRANSFER_SELL_PHASES.has(phase);
}

/** Ist das gemeinsame Transferfenster (Kauf UND Verkauf) gerade offen? Nur mit Schalter AN. */
export function isGemeinsamesTransferfensterOffen(gameState: GameState) {
  return istTransferfensterGemeinsam() && isEarlySeasonTransferSetup(gameState);
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
  const isSeasonStartSetup = isEarlySeasonTransferSetup(gameState);
  // Beschriftung aus canSell/canBuy abgeleitet statt aus der Phase aufgezaehlt: sonst heisst
  // `preseason_management` weiter „Transferfenster offen", obwohl dort nur noch verkauft werden
  // darf — genau die Vermischung, die gemeldet wurde.
  const gemeinsam = istTransferfensterGemeinsam();
  const label = !open
    ? gemeinsam && isSeasonEndManagementOpen(gameState)
      ? "Vertragsphase"
      : "Transferfenster geschlossen"
    : gemeinsam && canSell && canBuy
      ? "Transferfenster offen"
      : isSeasonStartSetup
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
    /** Neue Saison vor ihrem ersten Spieltag — die Kaufphase. Trennt die Preisbildung
     *  (`transfermarkt-sell-pricing-policy`) von der Anzeige-Beschriftung. */
    isSeasonStartSetup,
    /** Kauf UND Verkauf im selben Fenster (Schalter `OLY_TRANSFERFENSTER_GEMEINSAM`, Standard AN). */
    gemeinsamesFenster: gemeinsam,
    explicitWindowPhase: LOCAL_TRANSFER_WINDOW_PHASE,
    reason: open ? null : `phase_blocked:${phase}`,
  };
}
