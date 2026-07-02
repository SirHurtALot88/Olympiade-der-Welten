import type { GameState, Player, RosterEntry, Team } from "@/lib/data/olyDataTypes";

export type TeamFatigueInjuryMetrics = {
  injuries: number;
  injuredNow: number;
  recoveringNow: number;
  fatigueAvg: number;
  fatigueMax: number;
  fatigueP90: number;
  fatigue70Plus: number;
  fatigue85Plus: number;
  injuryEventsSeason: number;
};

function round(value: number, digits = 1) {
  return Number(value.toFixed(digits));
}

function percentile(values: number[], pct: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((pct / 100) * sorted.length) - 1));
  return sorted[index] ?? 0;
}

export function buildPlayerAvailabilityByPlayerId(gameState: GameState) {
  const map = new Map<
    string,
    { fatigue?: number; injuryStatus?: string; teamId?: string }
  >();
  for (const entry of gameState.seasonState.playerAvailabilityState ?? []) {
    if (!entry?.playerId) continue;
    map.set(entry.playerId, {
      fatigue: entry.fatigue,
      injuryStatus: entry.injuryStatus,
      teamId: entry.teamId,
    });
  }
  return map;
}

export function countSeasonInjuryEvents(gameState: GameState, seasonId: string) {
  return (gameState.seasonState.injuryEvents ?? []).filter(
    (entry) => entry.seasonId === seasonId && entry.result === "injured",
  ).length;
}

export function collectTeamFatigueInjuryMetrics(input: {
  gameState: GameState;
  team: Team;
  roster: RosterEntry[];
  playerById: Map<string, Player>;
  seasonId: string;
  availabilityByPlayerId?: Map<string, { fatigue?: number; injuryStatus?: string; teamId?: string }>;
}): TeamFatigueInjuryMetrics {
  const availabilityByPlayerId = input.availabilityByPlayerId ?? buildPlayerAvailabilityByPlayerId(input.gameState);
  const fatigueValues = input.roster.map((entry) => {
    const player = input.playerById.get(entry.playerId);
    return player?.fatigue ?? availabilityByPlayerId.get(entry.playerId)?.fatigue ?? 0;
  });
  const injuredNow = input.roster.filter(
    (entry) => availabilityByPlayerId.get(entry.playerId)?.injuryStatus === "injured",
  ).length;
  const recoveringNow = input.roster.filter(
    (entry) => availabilityByPlayerId.get(entry.playerId)?.injuryStatus === "recovering",
  ).length;
  const teamInjuryEvents = (input.gameState.seasonState.injuryEvents ?? []).filter(
    (entry) =>
      entry.seasonId === input.seasonId &&
      entry.result === "injured" &&
      entry.teamId === input.team.teamId,
  ).length;

  return {
    injuries: injuredNow + recoveringNow,
    injuredNow,
    recoveringNow,
    fatigueAvg: fatigueValues.length ? round(fatigueValues.reduce((sum, value) => sum + value, 0) / fatigueValues.length) : 0,
    fatigueMax: fatigueValues.length ? round(Math.max(...fatigueValues)) : 0,
    fatigueP90: fatigueValues.length ? round(percentile(fatigueValues, 90)) : 0,
    fatigue70Plus: fatigueValues.filter((value) => value >= 70).length,
    fatigue85Plus: fatigueValues.filter((value) => value >= 85).length,
    injuryEventsSeason: teamInjuryEvents,
  };
}

export function listNonRosterAvailabilityEntries(gameState: GameState) {
  const rosterPlayerIds = new Set(gameState.rosters.map((entry) => entry.playerId));
  return (gameState.seasonState.playerAvailabilityState ?? []).filter(
    (entry) => entry.playerId && !rosterPlayerIds.has(entry.playerId),
  );
}
