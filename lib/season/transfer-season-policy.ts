export type TransferSeasonAction =
  | "season1_draft"
  | "preseason_roster_repair"
  | "season_end_market_buy"
  | "season_end_market_sell"
  | "preseason_market_buy";

export const S1_FORBIDDEN_BUY_SOURCES = ["preseason_roster_repair_buy", "ai_preseason_market_buy"] as const;

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

export function findSeasonOneForbiddenBuySources(
  transfers: Array<{ seasonId?: string | null; transferType?: string | null; source?: string | null }>,
): string[] {
  const violations: string[] = [];
  for (const entry of transfers) {
    if (entry.seasonId !== "season-1" || entry.transferType !== "buy") continue;
    if (isSeasonOneForbiddenBuySource(entry.source)) {
      violations.push(`${entry.source ?? "unknown"}`);
    }
  }
  return [...new Set(violations)];
}
