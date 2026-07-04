export type TransferSeasonAction =
  | "season1_draft"
  | "preseason_roster_repair"
  | "season_end_market_buy"
  | "season_end_market_sell"
  | "preseason_market_buy";

/** Paid draft picks in season 1 — labeled separately from later transfer-market purchases
 * purely for reporting (draft-vs-market split in audits/recaps), NOT because market buys are
 * forbidden in S1. Design principle (2026-07-04 course correction): S1 buys are NOT forbidden —
 * the draft is just the first ordinary application of the same acquisition engine to empty
 * rosters with starting budget. A team that sells down (or organically drops) below hardMin/Opt
 * in S1 must be able to (re)buy in the very same season, exactly like any later season. */
export const SEASON_ONE_DRAFT_BUY_SOURCES = [
  "season1_autoprep_topup",
  "ai_roster_fill",
  "full_churn_redraft_buy",
] as const;

/** @deprecated No S1 buy source is forbidden anymore (see course correction above). Kept as an
 * empty tuple for backward-compatible imports; `isSeasonOneForbiddenBuySource` always returns
 * false and `resolveSeasonOneMarketBuyBlocker` always returns null. */
export const S1_FORBIDDEN_BUY_SOURCES = [] as const;

export const SEASON_ONE_MARKET_BUY_BLOCKER = "season_market_buy_forbidden";

export function isSeasonOne(seasonId: string): boolean {
  return seasonId === "season-1";
}

/** All transfer actions are allowed in every season, including season 1. Kept as a function
 * (rather than inlining `true`) so callers keep an explicit policy seam if a real S1-specific
 * restriction is ever reintroduced. */
export function isTransferActionAllowed(_seasonId: string, _action: TransferSeasonAction): boolean {
  return true;
}

/** @deprecated Always false — no S1 buy source is forbidden anymore. */
export function isSeasonOneForbiddenBuySource(_source: string | null | undefined): boolean {
  return false;
}

export function isSeasonOneDraftBuySource(source: string | null | undefined): boolean {
  return (SEASON_ONE_DRAFT_BUY_SOURCES as readonly string[]).includes(source ?? "");
}

/** @deprecated Always returns null — S1 market buys are permitted (see course correction above).
 * Kept so call sites don't need to change shape; they simply never see a blocker anymore. */
export function resolveSeasonOneMarketBuyBlocker(
  _seasonId: string,
  _transferSource: string | null | undefined,
): string | null {
  return null;
}

/** Transfer-market purchase (excludes paid S1 draft picks). */
export function isMarketBuyTransferEntry(entry: {
  transferType?: string | null;
  source?: string | null;
}): boolean {
  return entry.transferType === "buy" && !isSeasonOneDraftBuySource(entry.source);
}

export function countSeasonBuyTransfers(
  transfers: Array<{ seasonId?: string | null; transferType?: string | null; source?: string | null }>,
  seasonId: string,
) {
  const buyEntries = transfers.filter((entry) => entry.seasonId === seasonId && entry.transferType === "buy");
  const draftBuyCount = buyEntries.filter((entry) => isSeasonOneDraftBuySource(entry.source)).length;
  const marketBuyCount = buyEntries.length - draftBuyCount;
  return { draftBuyCount, marketBuyCount, totalBuyCount: buyEntries.length };
}

/** @deprecated Always returns [] — no S1 buy source is forbidden anymore (see course correction
 * above). Kept for backward-compatible imports/call sites. */
export function findSeasonOneForbiddenBuySources(
  _transfers: Array<{ seasonId?: string | null; transferType?: string | null; source?: string | null }>,
): string[] {
  return [];
}

export type SeasonTransferCountsLabelStyle = "audit" | "recap";

/** Human-readable transfer counts; S1 separates paid draft picks from market buys. */
export function formatSeasonTransferCountsLabel(
  seasonId: string,
  counts: Pick<ReturnType<typeof countSeasonBuyTransfers>, "draftBuyCount" | "marketBuyCount">,
  options?: {
    sellCount?: number;
    exitCount?: number;
    style?: SeasonTransferCountsLabelStyle;
  },
): string {
  const sellCount = options?.sellCount ?? 0;
  const exitCount = options?.exitCount ?? 0;
  const style = options?.style ?? "recap";
  if (isSeasonOne(seasonId)) {
    if (style === "audit") {
      return `${counts.draftBuyCount}Draft/${counts.marketBuyCount}Markt/${sellCount}V/${exitCount}X`;
    }
    return `${counts.draftBuyCount} Draft · ${counts.marketBuyCount} Markt · ${sellCount} V`;
  }
  if (style === "audit") {
    return `${counts.marketBuyCount}K/${sellCount}V/${exitCount}X`;
  }
  return `${counts.marketBuyCount} Markt-K · ${sellCount} V`;
}
