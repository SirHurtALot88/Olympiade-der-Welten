import type { GameState, TransferHistoryEntry } from "@/lib/data/olyDataTypes";

export const SEASON_END_MARKET_SELL_SOURCES = ["ai_preseason_market_sell"] as const;
export const PRESEASON_MARKET_BUY_SOURCES = ["preseason_roster_repair_buy", "ai_preseason_market_buy"] as const;
export const DRAFT_BUY_SOURCES = ["season1_autoprep_topup"] as const;

export type StandingsTransferBalance = {
  transferCount: number;
  transferBuyCount: number;
  transferSellCount: number;
  transferBuyTotal: number;
  transferSellTotal: number;
  transferNet: number;
};

function roundValue(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function transferFee(entry: TransferHistoryEntry) {
  return typeof entry.fee === "number" && Number.isFinite(entry.fee) ? entry.fee : 0;
}

export function parseSeasonNumber(seasonId: string): number {
  const match = seasonId.match(/season-(\d+)/i);
  return match ? Number(match[1]) : 1;
}

export function previousSeasonId(seasonId: string): string | null {
  const seasonNumber = parseSeasonNumber(seasonId);
  return seasonNumber <= 1 ? null : `season-${seasonNumber - 1}`;
}

export function isDraftBuySource(source: string | null | undefined): boolean {
  return (DRAFT_BUY_SOURCES as readonly string[]).includes(source ?? "");
}

export function isSeasonEndMarketSell(entry: TransferHistoryEntry): boolean {
  return (
    entry.transferType === "sell" &&
    (SEASON_END_MARKET_SELL_SOURCES as readonly string[]).includes(entry.source ?? "")
  );
}

export function isPreseasonMarketBuy(entry: TransferHistoryEntry): boolean {
  return entry.transferType === "buy" && (PRESEASON_MARKET_BUY_SOURCES as readonly string[]).includes(entry.source ?? "");
}

/**
 * Saisonstand-Transferbilanz:
 * - S1: nur Markt-Verkäufe am S1-Ende (Draft-Käufe zählen nicht).
 * - S2+: Verkäufe am Ende der Vorsaison minus Käufe zu Beginn der aktuellen Saison.
 */
export function buildStandingsTransferBalanceForTeam(
  gameState: GameState,
  seasonId: string,
  teamId: string,
): StandingsTransferBalance {
  const history = gameState.transferHistory ?? [];
  const seasonNumber = parseSeasonNumber(seasonId);
  let transferBuyTotal = 0;
  let transferSellTotal = 0;
  let transferBuyCount = 0;
  let transferSellCount = 0;

  if (seasonNumber === 1) {
    for (const entry of history) {
      if (entry.seasonId !== seasonId || entry.fromTeamId !== teamId || !isSeasonEndMarketSell(entry)) {
        continue;
      }
      transferSellCount += 1;
      transferSellTotal = roundValue(transferSellTotal + transferFee(entry));
    }
  } else {
    const priorSeasonId = previousSeasonId(seasonId);
    if (priorSeasonId) {
      for (const entry of history) {
        if (entry.seasonId !== priorSeasonId || entry.fromTeamId !== teamId || !isSeasonEndMarketSell(entry)) {
          continue;
        }
        transferSellCount += 1;
        transferSellTotal = roundValue(transferSellTotal + transferFee(entry));
      }
    }
    for (const entry of history) {
      if (entry.seasonId !== seasonId || entry.toTeamId !== teamId || !isPreseasonMarketBuy(entry)) {
        continue;
      }
      transferBuyCount += 1;
      transferBuyTotal = roundValue(transferBuyTotal + transferFee(entry));
    }
  }

  return {
    transferCount: transferBuyCount + transferSellCount,
    transferBuyCount,
    transferSellCount,
    transferBuyTotal,
    transferSellTotal,
    transferNet: roundValue(transferSellTotal - transferBuyTotal),
  };
}

export function buildStandingsTransferBalanceByTeamId(gameState: GameState, seasonId: string) {
  return Object.fromEntries(
    gameState.teams.map((team) => [team.teamId, buildStandingsTransferBalanceForTeam(gameState, seasonId, team.teamId)] as const),
  );
}
