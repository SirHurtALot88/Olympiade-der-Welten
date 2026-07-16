import type { GameState, TransferHistoryEntry } from "@/lib/data/olyDataTypes";

export type MultiseasonRebuyPair = {
  teamId: string;
  teamCode: string;
  playerId: string;
  playerName: string;
  buySeasons: string[];
  buyCount: number;
  crossSeasonRebuy: boolean;
  sameSeasonRebuy: boolean;
};

export type MultiseasonRebuyReport = {
  saveId: string;
  currentSeasonId: string;
  totalBuyEvents: number;
  uniqueTeamPlayerPairs: number;
  pairsWithMultipleBuys: number;
  teamsWithRebuys: number;
  crossSeasonRebuyPairs: number;
  sameSeasonRebuyPairs: number;
  topPairs: MultiseasonRebuyPair[];
  byTeam: Array<{ teamId: string; teamCode: string; rebuyPairCount: number; totalRebuyEvents: number }>;
};

function parseSeasonNumber(seasonId: string) {
  const match = seasonId.match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

export function buildMultiseasonRebuyReport(input: {
  gameState: GameState;
  saveId: string;
  topLimit?: number;
}): MultiseasonRebuyReport {
  const { gameState, saveId } = input;
  const topLimit = input.topLimit ?? 25;
  const teamById = new Map(gameState.teams.map((team) => [team.teamId, team]));
  const playerById = new Map(gameState.players.map((player) => [player.id, player]));

  const buys = gameState.transferHistory.filter(
    (entry): entry is TransferHistoryEntry & { toTeamId: string } =>
      entry.transferType === "buy" && entry.toTeamId != null,
  );

  const pairMap = new Map<string, { teamId: string; playerId: string; seasons: string[] }>();
  for (const entry of buys) {
    const key = `${entry.toTeamId}:${entry.playerId}`;
    const existing = pairMap.get(key) ?? { teamId: entry.toTeamId, playerId: entry.playerId, seasons: [] };
    existing.seasons.push(entry.seasonId);
    pairMap.set(key, existing);
  }

  const pairs: MultiseasonRebuyPair[] = [];
  for (const row of pairMap.values()) {
    const uniqueSeasons = [...new Set(row.seasons)].sort((left, right) => parseSeasonNumber(left) - parseSeasonNumber(right));
    if (uniqueSeasons.length <= 1 && row.seasons.length <= 1) continue;

    const seasonCounts = new Map<string, number>();
    for (const seasonId of row.seasons) {
      seasonCounts.set(seasonId, (seasonCounts.get(seasonId) ?? 0) + 1);
    }
    const sameSeasonRebuy = [...seasonCounts.values()].some((count) => count > 1);
    const crossSeasonRebuy = uniqueSeasons.length > 1;

    const team = teamById.get(row.teamId);
    const player = playerById.get(row.playerId);
    pairs.push({
      teamId: row.teamId,
      teamCode: team?.shortCode ?? row.teamId,
      playerId: row.playerId,
      playerName: player?.name ?? entryPlayerName(gameState, row.playerId),
      buySeasons: uniqueSeasons,
      buyCount: row.seasons.length,
      crossSeasonRebuy,
      sameSeasonRebuy,
    });
  }

  pairs.sort((left, right) => right.buyCount - left.buyCount || left.teamCode.localeCompare(right.teamCode));

  const teamStats = new Map<string, { rebuyPairCount: number; totalRebuyEvents: number }>();
  for (const pair of pairs) {
    const stats = teamStats.get(pair.teamId) ?? { rebuyPairCount: 0, totalRebuyEvents: 0 };
    stats.rebuyPairCount += 1;
    stats.totalRebuyEvents += pair.buyCount;
    teamStats.set(pair.teamId, stats);
  }

  const byTeam = [...teamStats.entries()]
    .map(([teamId, stats]) => ({
      teamId,
      teamCode: teamById.get(teamId)?.shortCode ?? teamId,
      rebuyPairCount: stats.rebuyPairCount,
      totalRebuyEvents: stats.totalRebuyEvents,
    }))
    .sort((left, right) => right.totalRebuyEvents - left.totalRebuyEvents);

  return {
    saveId,
    currentSeasonId: gameState.season.id,
    totalBuyEvents: buys.length,
    uniqueTeamPlayerPairs: pairMap.size,
    pairsWithMultipleBuys: pairs.length,
    teamsWithRebuys: byTeam.length,
    crossSeasonRebuyPairs: pairs.filter((pair) => pair.crossSeasonRebuy).length,
    sameSeasonRebuyPairs: pairs.filter((pair) => pair.sameSeasonRebuy).length,
    topPairs: pairs.slice(0, topLimit),
    byTeam,
  };
}

function entryPlayerName(gameState: GameState, playerId: string) {
  const fromHistory = gameState.transferHistory.find((entry) => entry.playerId === playerId && entry.playerName)?.playerName;
  return fromHistory ?? playerId;
}
