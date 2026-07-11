import type { GameState, Player, PlayerScoutIntelRecord, ScoutIntelSource } from "@/lib/data/olyDataTypes";
import { getFacilityLevel, getTeamFacilityState } from "@/lib/facilities/facility-effects";
import { getActiveScoutingWishlistEntries, getScoutingPipelineSlotLimit } from "@/lib/scouting/scouting-wishlist-slots";
import { getScoutingWatchlistForTeam } from "@/lib/scouting/scouting-watchlist-service";

/**
 * Flat certainty gain per matchday for the team's #1 scouting-focus-queue
 * player (the top-ranked wishlist entry). Chosen so that, combined with the
 * existing `facilityLevel + floor(certainty/25)` reveal formula, a fully
 * upgraded focus target takes 5/4/3/2/instant matchdays at Scouting Office
 * level 1/2/3/4/5 — "not a thousand years" while still rewarding facility
 * investment. See docs/foundation-monolith-split-plan.md (Scouting Tab Rework).
 */
export const SCOUT_FOCUS_TICK_GAIN = 20;

export type ScoutPipelineConfig = {
  maxSlots: number;
  tickGain: number;
  passiveSlots: number;
};

const SCOUTING_LEVEL_CONFIG: Record<number, ScoutPipelineConfig> = {
  0: { maxSlots: 4, tickGain: 0, passiveSlots: 0 },
  1: { maxSlots: 7, tickGain: 8, passiveSlots: 0 },
  2: { maxSlots: 10, tickGain: 10, passiveSlots: 1 },
  3: { maxSlots: 13, tickGain: 12, passiveSlots: 2 },
  4: { maxSlots: 16, tickGain: 15, passiveSlots: 3 },
  5: { maxSlots: 19, tickGain: 18, passiveSlots: 4 },
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
  const base = SCOUTING_LEVEL_CONFIG[level] ?? SCOUTING_LEVEL_CONFIG[0]!;
  return {
    ...base,
    maxSlots: getScoutingPipelineSlotLimit(gameState, teamId),
  };
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

/**
 * Minimum certainty needed for a player to reach effective scouting level 5
 * ("fully scouted": exact attributes/disciplines, POW/SPE/MEN/SOC and all
 * traits visible) given the team's current Scouting Office level.
 */
export function getFullRevealCertaintyThreshold(facilityLevel: number) {
  return clamp((5 - Math.max(0, facilityLevel)) * 25, 0, 100);
}

export function isPlayerFullyScouted(gameState: GameState, teamId: string, playerId: string) {
  return getEffectiveScoutingLevel(gameState, teamId, playerId) >= 5;
}

/**
 * The team's current scouting-focus-queue target: the highest-priority
 * (rank 0) wishlist entry that isn't fully scouted yet. Once it crosses the
 * full-reveal threshold, the next entry in priority order automatically
 * becomes the new focus target on the following tick.
 */
export function getFocusScoutTarget(gameState: GameState, teamId: string): { playerId: string } | null {
  const facilityLevel = getFacilityLevel(getTeamFacilityState(gameState, teamId), "scouting_office");
  if (facilityLevel <= 0) {
    // No Scouting Office yet — intel never ticks, so there is no active focus target.
    return null;
  }
  const threshold = getFullRevealCertaintyThreshold(facilityLevel);
  for (const entry of getActiveScoutingWishlistEntries(gameState, teamId)) {
    const certainty = getPlayerScoutCertainty(gameState, teamId, entry.playerId);
    if (certainty < threshold) {
      return { playerId: entry.playerId };
    }
  }
  return null;
}

export type ScoutFocusSummary = {
  playerId: string;
  certainty: number;
  neededCertainty: number;
  etaMatchdays: number;
};

/** UI-facing summary of the current focus target's progress and ETA. */
export function getScoutFocusSummary(gameState: GameState, teamId: string): ScoutFocusSummary | null {
  const focus = getFocusScoutTarget(gameState, teamId);
  if (!focus) {
    return null;
  }
  const facilityLevel = getFacilityLevel(getTeamFacilityState(gameState, teamId), "scouting_office");
  const neededCertainty = getFullRevealCertaintyThreshold(facilityLevel);
  const certainty = getPlayerScoutCertainty(gameState, teamId, focus.playerId);
  const remaining = Math.max(0, neededCertainty - certainty);
  const etaMatchdays = facilityLevel <= 0 ? Infinity : Math.ceil(remaining / SCOUT_FOCUS_TICK_GAIN);
  return { playerId: focus.playerId, certainty, neededCertainty, etaMatchdays };
}

export function tickGainForSource(config: ScoutPipelineConfig, source: ScoutIntelSource, facilityLevel: number) {
  if (facilityLevel <= 0) {
    return 0;
  }
  if (source === "wishlist_mirror") {
    return Math.max(1, config.tickGain + 3);
  }
  if (source === "passive_need") {
    return Math.max(1, config.tickGain - 2);
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

export function refreshScoutPipeline(gameState: GameState, teamId: string): GameState {
  const config = getScoutPipelineConfig(gameState, teamId);
  const seasonId = gameState.season.id;
  const existingByPlayerId = new Map(
    getTeamScoutIntelRecords(gameState, teamId).map((entry) => [entry.playerId, entry] as const),
  );

  type SlotAssignment = { playerId: string; source: ScoutIntelSource };
  const assignments: SlotAssignment[] = [];
  const assigned = new Set<string>();

  const addAssignment = (playerId: string, source: ScoutIntelSource) => {
    if (config.maxSlots <= 0 || assignments.length >= config.maxSlots || assigned.has(playerId)) {
      return;
    }
    assignments.push({ playerId, source });
    assigned.add(playerId);
  };

  for (const entry of getActiveScoutingWishlistEntries(gameState, teamId)) {
    addAssignment(entry.playerId, "wishlist_mirror");
  }

  for (const entry of getScoutingWatchlistForTeam(gameState, teamId)) {
    if (entry.source === "transfer_wishlist_mirror") {
      continue;
    }
    addAssignment(entry.playerId, "watchlist");
  }

  for (const playerId of buildPassiveCandidates(gameState, teamId, config.passiveSlots)) {
    addAssignment(playerId, "passive_need");
  }

  const records: PlayerScoutIntelRecord[] = assignments.map(({ playerId, source }) => {
    const existing = existingByPlayerId.get(playerId);
    if (existing) {
      return {
        ...existing,
        source,
      };
    }
    return {
      playerId,
      teamId,
      seasonId,
      source,
      certainty: 0,
      startedAt: new Date().toISOString(),
      lastTickAt: null,
      ticksCompleted: 0,
    };
  });

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
    const facilityLevel = getFacilityLevel(getTeamFacilityState(next, teamId), "scouting_office");
    if (config.maxSlots === 0 || facilityLevel <= 0) {
      continue;
    }
    const focusPlayerId = getFocusScoutTarget(next, teamId)?.playerId ?? null;
    const records = getTeamScoutIntelRecords(next, teamId).map((record) => {
      const isFocusTarget = focusPlayerId != null && record.playerId === focusPlayerId && record.source === "wishlist_mirror";
      const gain = isFocusTarget ? SCOUT_FOCUS_TICK_GAIN : tickGainForSource(config, record.source, facilityLevel);
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
  const facilityLevel = getFacilityLevel(getTeamFacilityState(gameState, teamId), "scouting_office");
  const records = getTeamScoutIntelRecords(gameState, teamId);
  return {
    config,
    facilityLevel,
    records,
    occupiedSlots: records.length,
    passiveActive: records.filter((entry) => entry.source === "passive_need").length,
    wishlistActive: records.filter((entry) => entry.source === "wishlist_mirror").length,
    focusTickGain: SCOUT_FOCUS_TICK_GAIN,
    wishlistTickGain: tickGainForSource(config, "wishlist_mirror", facilityLevel),
    passiveTickGain: tickGainForSource(config, "passive_need", facilityLevel),
  };
}

export function findPlayerById(gameState: GameState, playerId: string): Player | null {
  return gameState.players.find((player) => player.id === playerId) ?? null;
}
