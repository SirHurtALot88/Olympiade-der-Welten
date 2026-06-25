import type { GameState, Player, PlayerScoutIntelRecord, ScoutIntelSource } from "@/lib/data/olyDataTypes";
import { getFacilityLevel, getTeamFacilityState } from "@/lib/facilities/facility-effects";
import { getScoutingWatchlistForTeam } from "@/lib/scouting/scouting-watchlist-service";

export type ScoutPipelineConfig = {
  maxSlots: number;
  tickGain: number;
  passiveSlots: number;
};

const SCOUTING_LEVEL_CONFIG: Record<number, ScoutPipelineConfig> = {
  0: { maxSlots: 0, tickGain: 0, passiveSlots: 0 },
  1: { maxSlots: 2, tickGain: 8, passiveSlots: 0 },
  2: { maxSlots: 3, tickGain: 10, passiveSlots: 1 },
  3: { maxSlots: 5, tickGain: 12, passiveSlots: 2 },
  4: { maxSlots: 6, tickGain: 15, passiveSlots: 3 },
  5: { maxSlots: 8, tickGain: 18, passiveSlots: 4 },
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getStableUnitHash(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

export function getScoutPipelineConfig(gameState: GameState, teamId: string): ScoutPipelineConfig {
  const teamFacilities = getTeamFacilityState(gameState, teamId);
  const level = getFacilityLevel(teamFacilities, "scouting_office");
  return SCOUTING_LEVEL_CONFIG[level] ?? SCOUTING_LEVEL_CONFIG[0]!;
}

export function getTeamScoutIntelRecords(gameState: GameState, teamId: string) {
  const seasonId = gameState.season.id;
  return (gameState.seasonState.scoutIntelByTeamId?.[teamId] ?? []).filter((entry) => entry.seasonId === seasonId);
}

export function getPlayerScoutCertainty(gameState: GameState, teamId: string, playerId: string) {
  const rosterEntry = gameState.rosters.some((entry) => entry.teamId === teamId && entry.playerId === playerId);
  if (rosterEntry) {
    return 100;
  }
  const record = getTeamScoutIntelRecords(gameState, teamId).find((entry) => entry.playerId === playerId) ?? null;
  return record?.certainty ?? 0;
}

export function getEffectiveScoutingLevel(gameState: GameState, teamId: string, playerId: string) {
  const teamFacilities = getTeamFacilityState(gameState, teamId);
  const facilityLevel = getFacilityLevel(teamFacilities, "scouting_office");
  const certainty = getPlayerScoutCertainty(gameState, teamId, playerId);
  return clamp(facilityLevel + Math.floor(certainty / 25), 0, 5);
}

function tickGainForSource(config: ScoutPipelineConfig, source: ScoutIntelSource) {
  if (source === "wishlist_mirror") {
    return Math.max(1, config.tickGain - 2);
  }
  if (source === "passive_need") {
    return Math.max(1, config.tickGain - 1);
  }
  return config.tickGain;
}

function buildPassiveCandidates(gameState: GameState, teamId: string, count: number) {
  if (count <= 0) {
    return [];
  }
  const rosterPlayerIds = new Set(
    gameState.rosters.filter((entry) => entry.teamId === teamId).map((entry) => entry.playerId),
  );
  const occupied = new Set(getTeamScoutIntelRecords(gameState, teamId).map((entry) => entry.playerId));
  const candidates = gameState.players
    .filter((player) => !rosterPlayerIds.has(player.id) && !occupied.has(player.id))
    .map((player) => ({
      player,
      score:
        (player.marketValue ?? 0) +
        Object.values(player.coreStats ?? {}).reduce((sum, value) => sum + (value ?? 0), 0) / 4,
    }))
    .sort((left, right) => {
      const seedLeft = getStableUnitHash(`${gameState.season.id}:${teamId}:${left.player.id}:passive-scout`);
      const seedRight = getStableUnitHash(`${gameState.season.id}:${teamId}:${right.player.id}:passive-scout`);
      if (right.score !== left.score) return right.score - left.score;
      return seedRight - seedLeft;
    })
    .slice(0, count)
    .map((entry) => entry.player.id);
  return candidates;
}

function upsertIntelRecord(input: {
  records: PlayerScoutIntelRecord[];
  playerId: string;
  teamId: string;
  seasonId: string;
  source: ScoutIntelSource;
}) {
  const existing = input.records.find((entry) => entry.playerId === input.playerId) ?? null;
  if (existing) {
    return input.records;
  }
  return [
    ...input.records,
    {
      playerId: input.playerId,
      teamId: input.teamId,
      seasonId: input.seasonId,
      source: input.source,
      certainty: 0,
      startedAt: new Date().toISOString(),
      lastTickAt: null,
      ticksCompleted: 0,
    },
  ];
}

export function refreshScoutPipeline(gameState: GameState, teamId: string): GameState {
  const config = getScoutPipelineConfig(gameState, teamId);
  const seasonId = gameState.season.id;
  let records = [...getTeamScoutIntelRecords(gameState, teamId)];

  const watchlist = getScoutingWatchlistForTeam(gameState, teamId);
  for (const entry of watchlist) {
    records = upsertIntelRecord({
      records,
      playerId: entry.playerId,
      teamId,
      seasonId,
      source: entry.source === "transfer_wishlist_mirror" ? "wishlist_mirror" : "watchlist",
    });
  }

  const wishlistIds =
    config.maxSlots > 0
      ? (gameState.seasonState.transferWishlist ?? [])
          .filter((entry) => entry.teamId === teamId)
          .map((entry) => entry.playerId)
      : [];
  for (const playerId of wishlistIds) {
    if (!records.some((entry) => entry.playerId === playerId)) {
      records = upsertIntelRecord({ records, playerId, teamId, seasonId, source: "wishlist_mirror" });
    }
  }

  const passiveCandidates = buildPassiveCandidates(gameState, teamId, config.passiveSlots);
  for (const playerId of passiveCandidates) {
    if (records.length >= config.maxSlots) {
      break;
    }
    if (!records.some((entry) => entry.playerId === playerId)) {
      records = upsertIntelRecord({ records, playerId, teamId, seasonId, source: "passive_need" });
    }
  }

  if (records.length > config.maxSlots) {
    const priority: Record<ScoutIntelSource, number> = {
      watchlist: 4,
      wishlist_mirror: 3,
      passive_need: 2,
      roster: 1,
    };
    records = [...records]
      .sort((left, right) => priority[right.source] - priority[left.source] || right.certainty - left.certainty)
      .slice(0, config.maxSlots);
  }

  return {
    ...gameState,
    seasonState: {
      ...gameState.seasonState,
      scoutIntelByTeamId: {
        ...(gameState.seasonState.scoutIntelByTeamId ?? {}),
        [teamId]: records,
      },
    },
  };
}

export function refreshScoutPipelineForAllTeams(gameState: GameState): GameState {
  let next = gameState;
  for (const team of gameState.teams) {
    next = refreshScoutPipeline(next, team.teamId);
  }
  return next;
}

export function advanceScoutIntelTick(input: {
  gameState: GameState;
  teamId?: string;
  phase?: "matchday" | "preseason";
}): GameState {
  const teamIds = input.teamId ? [input.teamId] : input.gameState.teams.map((team) => team.teamId);
  let next = refreshScoutPipelineForAllTeams(input.gameState);
  const now = new Date().toISOString();

  for (const teamId of teamIds) {
    const config = getScoutPipelineConfig(next, teamId);
    if (config.maxSlots === 0) {
      continue;
    }
    const records = getTeamScoutIntelRecords(next, teamId).map((record) => {
      const gain = tickGainForSource(config, record.source);
      const certainty = clamp(record.certainty + gain, 0, 100);
      return {
        ...record,
        certainty,
        lastTickAt: now,
        ticksCompleted: record.ticksCompleted + 1,
      };
    });
    next = {
      ...next,
      seasonState: {
        ...next.seasonState,
        scoutIntelByTeamId: {
          ...(next.seasonState.scoutIntelByTeamId ?? {}),
          [teamId]: records,
        },
      },
    };
  }

  return next;
}

export function buildScoutPipelineSummary(gameState: GameState, teamId: string) {
  const config = getScoutPipelineConfig(gameState, teamId);
  const records = getTeamScoutIntelRecords(gameState, teamId);
  return {
    config,
    records,
    occupiedSlots: records.length,
    passiveActive: records.filter((entry) => entry.source === "passive_need").length,
  };
}

export function findPlayerById(gameState: GameState, playerId: string): Player | null {
  return gameState.players.find((player) => player.id === playerId) ?? null;
}
