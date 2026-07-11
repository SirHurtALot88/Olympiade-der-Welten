import { LOCAL_TRANSFER_WINDOW_PHASE } from "@/lib/market/transfer-window-policy";

/**
 * Single source of truth for the in-season transfer engine's phase + transfer-source strings.
 *
 * The AI trades in exactly two window phases — `preseason` (buy) and `season_end` (sell). There is
 * NO mid-running-season trade window; "midseason" elsewhere in the codebase is tactical/doctrine
 * only, never trading.
 *
 * Design note: the VALUES of `TRANSFER_SOURCE` are the exact string literals already used across the
 * codebase (transferHistory `source`, apply-layer matching `Set`s, etc.). Introducing this enum as
 * the source of truth therefore forces NO downstream change — every existing `=== "..."` / `Set`
 * comparison keeps seeing the same string. Call sites can migrate to reference these constants later
 * (mechanical, no behaviour change). `manual_transfer_window` is anchored on the pre-existing
 * `LOCAL_TRANSFER_WINDOW_PHASE` so there is never a second competing constant for it.
 */
export const TRANSFER_WINDOW_PHASE = {
  PRESEASON: "preseason",
  SEASON_END: "season_end",
} as const;

export type TransferWindowPhase = (typeof TRANSFER_WINDOW_PHASE)[keyof typeof TRANSFER_WINDOW_PHASE];

/** Which side of the window a step is on. */
export type TransferSide = "buy" | "sell";

export const TRANSFER_SOURCE = {
  PRESEASON_MARKET_BUY: "ai_preseason_market_buy",
  PRESEASON_MARKET_SELL: "ai_preseason_market_sell",
  SEASON_END_MARKET_BUY: "season_end_market_buy",
  SEASON_END_MARKET_SELL: "season_end_market_sell",
  /** Human-facing / manual transfer-window operations. */
  MANUAL_TRANSFER_WINDOW: LOCAL_TRANSFER_WINDOW_PHASE,
} as const;

export type TransferSource = (typeof TRANSFER_SOURCE)[keyof typeof TRANSFER_SOURCE];

const AI_SOURCE_BY_PHASE_SIDE: Record<TransferWindowPhase, Record<TransferSide, TransferSource>> = {
  [TRANSFER_WINDOW_PHASE.PRESEASON]: {
    buy: TRANSFER_SOURCE.PRESEASON_MARKET_BUY,
    sell: TRANSFER_SOURCE.PRESEASON_MARKET_SELL,
  },
  [TRANSFER_WINDOW_PHASE.SEASON_END]: {
    buy: TRANSFER_SOURCE.SEASON_END_MARKET_BUY,
    sell: TRANSFER_SOURCE.SEASON_END_MARKET_SELL,
  },
};

/** Resolve the canonical AI transfer-source string for a given window phase + side. */
export function resolveTransferSource(input: { phase: TransferWindowPhase; side: TransferSide }): TransferSource {
  return AI_SOURCE_BY_PHASE_SIDE[input.phase][input.side];
}

const ALL_TRANSFER_SOURCES = new Set<string>(Object.values(TRANSFER_SOURCE));

/** Type guard: is `value` one of the known transfer-source strings? */
export function isTransferSource(value: string | null | undefined): value is TransferSource {
  return value != null && ALL_TRANSFER_SOURCES.has(value);
}

/** Type guard: is `value` one of the two tradable window phases? */
export function isTransferWindowPhase(value: string | null | undefined): value is TransferWindowPhase {
  return value === TRANSFER_WINDOW_PHASE.PRESEASON || value === TRANSFER_WINDOW_PHASE.SEASON_END;
}
