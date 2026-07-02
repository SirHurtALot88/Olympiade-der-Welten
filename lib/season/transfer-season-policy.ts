export type TransferSeasonAction =
  | "season1_draft"
  | "preseason_roster_repair"
  | "season_end_market_buy"
  | "season_end_market_sell"
  | "preseason_market_buy";

/** Paid draft picks in season 1 — not transfer-market purchases. */
export const SEASON_ONE_DRAFT_BUY_SOURCES = [
  "season1_autoprep_topup",
  "ai_roster_fill",
  "full_churn_redraft_buy",
] as const;

export const S1_FORBIDDEN_BUY_SOURCES = ["preseason_roster_repair_buy", "ai_preseason_market_buy"] as const;

export const SEASON_ONE_MARKET_BUY_BLOCKER = "season_market_buy_forbidden";

export function isSeasonOne(seasonId: string): boolean {
  return seasonId === "season-1";
}

export function isTransferActionAllowed(seasonId: string, action: TransferSeasonAction): boolean {
  if (isSeasonOne(seasonId)) {
    return action === "season1_draft" || action === "season_end_market_sell";
  }
  return true;
}

export function isSeasonOneForbiddenBuySource(source: string | null | undefined): boolean {
  if (!source) return false;
  return (S1_FORBIDDEN_BUY_SOURCES as readonly string[]).includes(source);
}

export function isSeasonOneDraftBuySource(source: string | null | undefined): boolean {
  return (SEASON_ONE_DRAFT_BUY_SOURCES as readonly string[]).includes(source ?? "");
}

/** Blocks any non-draft buy in season 1 at preview/apply layers. */
export function resolveSeasonOneMarketBuyBlocker(
  seasonId: string,
  transferSource: string | null | undefined,
): string | null {
  if (!isSeasonOne(seasonId)) return null;
  if (isSeasonOneDraftBuySource(transferSource)) return null;
  return SEASON_ONE_MARKET_BUY_BLOCKER;
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

export function findSeasonOneForbiddenBuySources(
  transfers: Array<{ seasonId?: string | null; transferType?: string | null; source?: string | null }>,
): string[] {
  const violations: string[] = [];
  for (const entry of transfers) {
    if (entry.seasonId !== "season-1" || entry.transferType !== "buy") continue;
    if (isSeasonOneDraftBuySource(entry.source)) continue;
    violations.push(entry.source ?? "unknown_market_buy");
  }
  return [...new Set(violations)];
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
