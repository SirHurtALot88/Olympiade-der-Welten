export type PlayerExhaustionHistoryEntry = {
  matchday: number;
  teamId: string;
  playerName?: string;
  playerId?: string;
  activePlayerId?: string;
};

export type PlayerExhaustionEntry = {
  playerKey: string;
  count: number;
  multiplier: number;
  source: "activePlayerId" | "playerId" | "playerName";
};

export type BuildPlayerExhaustionMapParams = {
  currentMatchday: number;
  lineupHistory: PlayerExhaustionHistoryEntry[];
  teamId?: string;
};

export function resolvePlayerExhaustionKey(entry: PlayerExhaustionHistoryEntry): PlayerExhaustionEntry["source"] | null {
  if (entry.activePlayerId) {
    return "activePlayerId";
  }
  if (entry.playerId) {
    return "playerId";
  }
  if (entry.playerName) {
    return "playerName";
  }
  return null;
}

export function buildPlayerExhaustionMap(
  params: BuildPlayerExhaustionMapParams,
): Record<string, PlayerExhaustionEntry> {
  const { currentMatchday, lineupHistory, teamId } = params;

  const relevant = lineupHistory.filter((entry) => {
    if (teamId && String(entry.teamId).trim() !== String(teamId).trim()) {
      return false;
    }

    const matchday = Number(entry.matchday);
    return Number.isFinite(matchday) && matchday < currentMatchday && matchday >= currentMatchday - 4;
  });

  const byPlayer = new Map<
    string,
    {
      matchdays: Set<number>;
      source: PlayerExhaustionEntry["source"];
    }
  >();

  for (const entry of relevant) {
    const source = resolvePlayerExhaustionKey(entry);
    if (!source) {
      continue;
    }

    const playerKey = String(entry[source]).trim();
    if (!playerKey) {
      continue;
    }

    const existing = byPlayer.get(playerKey) ?? {
      matchdays: new Set<number>(),
      source,
    };
    existing.matchdays.add(Number(entry.matchday));
    byPlayer.set(playerKey, existing);
  }

  const result: Record<string, PlayerExhaustionEntry> = {};

  for (const [playerKey, value] of byPlayer.entries()) {
    const sortedMatchdays = Array.from(value.matchdays).sort((left, right) => right - left);
    let count = 0;
    let cursor = currentMatchday - 1;

    for (const matchday of sortedMatchdays) {
      if (matchday === cursor) {
        count += 1;
        cursor -= 1;
      } else if (matchday < cursor) {
        break;
      }
    }

    let multiplier = 1.0;
    if (count >= 4) multiplier = 0.8;
    else if (count >= 3) multiplier = 0.85;
    else if (count >= 2) multiplier = 0.9;
    else if (count >= 1) multiplier = 0.95;

    result[playerKey] = {
      playerKey,
      count,
      multiplier,
      source: value.source,
    };
  }

  return result;
}
