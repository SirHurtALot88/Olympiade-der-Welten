import type { GameState, TransferHistoryEntry } from "@/lib/data/olyDataTypes";
import { resolveTransferDoctrine } from "@/lib/ai/ai-transfer-doctrine-layer";

export type TransferFinanceTeamSeasonRow = {
  seasonId: string;
  teamId: string;
  teamName: string;
  cashStart: number | null;
  cashEnd: number | null;
  buyFeesPaid: number;
  sellProceeds: number;
  netTransferCash: number;
  sponsorCashIn: number;
  salaryPaidOut: number;
  netSponsorCash: number;
  buyCount: number;
  sellCount: number;
  cashReconciliationDelta: number | null;
};

export type TransferFinanceAuditResult = {
  rows: TransferFinanceTeamSeasonRow[];
  violations: string[];
  doctrineStats: Array<{
    seasonId: string;
    teamId: string;
    persona: string;
    buys: number;
    sells: number;
    replacementSellCount: number;
    replacementBuyCount: number;
  }>;
};

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function seasonsFromHistory(gameState: GameState) {
  const ids = new Set<string>();
  for (const entry of gameState.transferHistory) ids.add(entry.seasonId);
  for (const snapshot of gameState.seasonState.seasonSnapshots ?? []) ids.add(snapshot.seasonId);
  ids.add(gameState.season.id);
  return [...ids].sort((left, right) => left.localeCompare(right, "de", { numeric: true }));
}

function getSnapshotCashByTeam(gameState: GameState, seasonId: string) {
  const snapshot = gameState.seasonState.seasonSnapshots?.find((entry) => entry.seasonId === seasonId);
  const map = new Map<string, number>();
  for (const row of snapshot?.finalStandings ?? []) {
    map.set(row.teamId, row.cashEnd ?? row.cashTotal ?? 0);
  }
  return map;
}

function getTeamName(gameState: GameState, teamId: string) {
  return gameState.teams.find((team) => team.teamId === teamId)?.name ?? teamId;
}

export function buildBuyEconomics(gameState: GameState) {
  const playerById = new Map(gameState.players.map((player) => [player.id, player]));
  return gameState.transferHistory
    .filter((entry): entry is TransferHistoryEntry => entry.transferType === "buy")
    .map((entry) => {
      const player = playerById.get(entry.playerId);
      const price = entry.fee ?? 0;
      const salary = entry.salary ?? player?.salaryDemand ?? 0;
      return {
        seasonId: entry.seasonId,
        playerId: entry.playerId,
        playerName: entry.playerName ?? player?.name ?? entry.playerId,
        toTeamId: entry.toTeamId,
        fee: round(price),
        annualSalary: round(salary),
        totalFirstYearCost: round(price + salary),
        source: entry.source ?? "",
      };
    });
}

export function buildTransferFinanceAudit(gameState: GameState): TransferFinanceAuditResult {
  const seasons = seasonsFromHistory(gameState);
  const rows: TransferFinanceTeamSeasonRow[] = [];
  const violations: string[] = [];
  const teamIds = new Set(gameState.teams.map((team) => team.teamId));

  for (let index = 0; index < seasons.length; index += 1) {
    const seasonId = seasons[index]!;
    const previousSeasonId = index > 0 ? seasons[index - 1]! : null;
    const cashStartByTeam = previousSeasonId ? getSnapshotCashByTeam(gameState, previousSeasonId) : new Map<string, number>();
    const cashEndByTeam = getSnapshotCashByTeam(gameState, seasonId);
    const transfers = gameState.transferHistory.filter((entry) => entry.seasonId === seasonId);
    const sponsorLogs = (gameState.seasonState.sponsorPayoutLogs ?? []).filter((log) => log.seasonId === seasonId);

    for (const teamId of teamIds) {
      const buys = transfers.filter((entry) => entry.transferType === "buy" && entry.toTeamId === teamId);
      const sells = transfers.filter((entry) => entry.transferType === "sell" && entry.fromTeamId === teamId);
      const contractExits = transfers.filter((entry) => entry.transferType === "contract_exit" && entry.fromTeamId === teamId);
      const buyFeesPaid = round(buys.reduce((sum, entry) => sum + (entry.fee ?? 0), 0));
      const sellProceeds = round(
        sells.reduce((sum, entry) => sum + (entry.fee ?? 0), 0) +
          contractExits.reduce((sum, entry) => sum + (entry.fee ?? 0), 0),
      );
      const netTransferCash = round(sellProceeds - buyFeesPaid);
      const teamSponsorLogs = sponsorLogs.filter((log) => log.teamId === teamId);
      const sponsorCashIn = round(teamSponsorLogs.filter((log) => log.cashDelta > 0).reduce((sum, log) => sum + log.cashDelta, 0));
      const salaryPaidOut = round(Math.abs(teamSponsorLogs.filter((log) => log.cashDelta < 0).reduce((sum, log) => sum + log.cashDelta, 0)));
      const netSponsorCash = round(teamSponsorLogs.reduce((sum, log) => sum + log.cashDelta, 0));
      const cashStart = cashStartByTeam.get(teamId) ?? null;
      const cashEnd =
        cashEndByTeam.get(teamId) ??
        (seasonId === gameState.season.id ? gameState.teams.find((team) => team.teamId === teamId)?.cash ?? null : null);
      const cashReconciliationDelta =
        cashStart != null && cashEnd != null ? round(cashEnd - cashStart - netTransferCash - netSponsorCash) : null;

      rows.push({
        seasonId,
        teamId,
        teamName: getTeamName(gameState, teamId),
        cashStart,
        cashEnd,
        buyFeesPaid,
        sellProceeds,
        netTransferCash,
        sponsorCashIn,
        salaryPaidOut,
        netSponsorCash,
        buyCount: buys.length,
        sellCount: sells.length,
        cashReconciliationDelta,
      });

      if (cashEnd != null && cashEnd < -0.01) {
        violations.push(`negative_cash_end:${seasonId}:${teamId}:${cashEnd}`);
      }
      if (cashReconciliationDelta != null && Math.abs(cashReconciliationDelta) > 1 && cashStart != null) {
        violations.push(`cash_reconciliation_delta:${seasonId}:${teamId}:${cashReconciliationDelta}`);
      }
      for (const buy of buys) {
        if ((buy.fee ?? 0) <= 0 && buy.source !== "preseason_roster_repair_buy") {
          violations.push(`zero_fee_buy:${seasonId}:${teamId}:${buy.playerId}:${buy.source ?? "unknown"}`);
        }
      }
    }
  }

  return {
    rows,
    violations: [...new Set(violations)],
    doctrineStats: buildDoctrineTransferStats(gameState),
  };
}

function buildDoctrineTransferStats(gameState: GameState) {
  const seasons = seasonsFromHistory(gameState);
  const stats: TransferFinanceAuditResult["doctrineStats"] = [];
  for (const seasonId of seasons) {
    for (const team of gameState.teams) {
      const doctrine = resolveTransferDoctrine(gameState, team.teamId);
      const transfers = gameState.transferHistory.filter((entry) => entry.seasonId === seasonId);
      const buys = transfers.filter((entry) => entry.transferType === "buy" && entry.toTeamId === team.teamId);
      const sells = transfers.filter((entry) => entry.transferType === "sell" && entry.fromTeamId === team.teamId);
      const replacementSells = sells.filter((entry) => (entry.fee ?? 0) >= 20 || (entry.marketValue ?? 0) >= 20);
      const replacementBuys = buys.filter((entry) => {
        const priorSell = gameState.transferHistory.find(
          (prior) =>
            prior.seasonId === seasonId &&
            prior.transferType === "sell" &&
            prior.fromTeamId === team.teamId &&
            prior.playerId !== entry.playerId &&
            (prior.fee ?? 0) > 0,
        );
        return Boolean(priorSell) && (entry.fee ?? 0) <= (priorSell?.fee ?? 0) * 1.1;
      });
      stats.push({
        seasonId,
        teamId: team.teamId,
        persona: doctrine.persona,
        buys: buys.length,
        sells: sells.length,
        replacementSellCount: replacementSells.length,
        replacementBuyCount: replacementBuys.length,
      });
    }
  }
  return stats;
}
