import type { GameState, PlayerAvailabilityStateRecord, RosterEntry } from "@/lib/data/olyDataTypes";
import { INJURY_UNAVAILABLE_MATCHDAYS } from "@/lib/fatigue/fatigue-injury-service";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";

// Mirrors the LEGACY_MATCHDAY_MINIMUM_PLAYERS floor used by lib/lineups/legacy-matchday-readiness.ts
// and lib/resolve/legacy-matchday-resolve-engine.ts (a team below this many available players cannot
// field a lineup for ANY discipline at all, not even the "partial lineup" allowance). Kept as its own
// copy here to match the existing convention in this codebase rather than reaching across module
// boundaries for a constant — see MD8-stall root cause writeup: this is a completeness/readiness
// floor, not a balance number, and this file must never change its value.
const LEGACY_MATCHDAY_MINIMUM_PLAYERS = 7;

export type MatchdayEmergencyRosterReinforcement = {
  teamId: string;
  teamName: string;
  activePlayersBefore: number;
  signedPlayerIds: string[];
};

export type MatchdayEmergencyRosterResult = {
  gameState: GameState;
  reinforcements: MatchdayEmergencyRosterReinforcement[];
};

// Same "is this player unavailable for this matchday" rule as
// lib/fatigue/fatigue-injury-service.ts#getPlayerAvailabilityView, reimplemented against precomputed
// O(1) lookups instead of that function's per-call gameState.players.find /
// gameState.rosters.find scans. This runs once per team per matchday-auto-run, over every roster
// entry in the league (up to ~32 teams x roster size) — with the original find()-based helper that
// turned into a quadratic-ish scan large enough to blow whole-season simulation timeouts. Counting
// active players only needs the boolean outcome, not the full view object, so it is safe (and
// required for performance) to inline just that rule here rather than reuse the exported helper.
function isPlayerUnavailableForMatchday(
  stored: PlayerAvailabilityStateRecord | undefined,
  currentMatchdayIndex: number,
  matchdayIndexById: Map<string, number>,
): boolean {
  if (!stored || stored.injuryStatus !== "injured" || currentMatchdayIndex < 0) {
    return false;
  }
  const injuredAtIndex = stored.injuredAtMatchdayId ? matchdayIndexById.get(stored.injuredAtMatchdayId) ?? -1 : -1;
  const explicitUntilIndex = stored.injuryUntilMatchday ? matchdayIndexById.get(stored.injuryUntilMatchday) ?? -1 : -1;
  const unavailableUntilIndex =
    explicitUntilIndex >= 0
      ? explicitUntilIndex
      : injuredAtIndex >= 0
        ? injuredAtIndex + INJURY_UNAVAILABLE_MATCHDAYS
        : -1;
  return (
    injuredAtIndex >= 0 &&
    unavailableUntilIndex >= 0 &&
    currentMatchdayIndex > injuredAtIndex &&
    currentMatchdayIndex <= unavailableUntilIndex
  );
}

/**
 * Self-heals a team that would otherwise be permanently unable to field ANY valid lineup for the
 * given matchday.
 *
 * Root cause (2026-07-26, fresh-season-1 MD8/MD9 stall): a player who is selected into a lineup
 * never recovers fatigue that matchday (only benched/unused players do — see
 * applyFatigueAndInjuryAfterMatchday), so on any matchday where a team's roster size is at or near
 * its combined discipline requirement (no bench slack to rotate), every rostered player is forced
 * to play and accumulates fatigue every single week. Over a season this can push several players
 * of the SAME team into "injured" simultaneously after one heavy matchday, dropping that team's
 * available roster for the FOLLOWING matchday below LEGACY_MATCHDAY_MINIMUM_PLAYERS. Once that
 * happens, `isPartialLineupAllowed` (legacy-matchday-resolve-engine.ts) can never return true for
 * that team — no lineup, however constructed, resolves — and the season stalls forever with
 * `resolve_status:incomplete_lineups`.
 *
 * This does not touch the fatigue/injury/roster-size BALANCE numbers (that's a tuning decision for
 * the owner's balancing pass, not this fix) and does not loosen the readiness check itself. Instead
 * it makes the underlying roster valid: teams that would fall below the floor for THIS matchday get
 * just enough free agents signed (contractLength 1, "bench" role, no cash cost — this is an
 * emergency call-up safety net, not a normal transfer) to reach the floor, so the existing
 * AI-lineup auto-fill + partial-lineup allowance can do its job normally. Teams that already meet
 * the floor (the overwhelming majority, every matchday) are completely untouched.
 */
export function ensureMinimumActiveRosterForMatchday(
  gameState: GameState,
  scope: { saveId: string; seasonId: string; matchdayId: string },
): MatchdayEmergencyRosterResult {
  const playerIds = new Set(gameState.players.map((player) => player.id));
  const availabilityByKey = new Map(
    (gameState.seasonState.playerAvailabilityState ?? []).map(
      (entry) => [`${entry.teamId}::${entry.playerId}`, entry] as const,
    ),
  );
  const matchdayIndexById = new Map((gameState.season.matchdayIds ?? []).map((id, index) => [id, index] as const));
  const currentMatchdayIndex = matchdayIndexById.get(scope.matchdayId) ?? -1;

  const rosterEntriesByTeamId = new Map<string, RosterEntry[]>();
  for (const roster of gameState.rosters) {
    const existing = rosterEntriesByTeamId.get(roster.teamId);
    if (existing) {
      existing.push(roster);
    } else {
      rosterEntriesByTeamId.set(roster.teamId, [roster]);
    }
  }

  const usedPlayerIds = new Set(gameState.rosters.map((entry) => entry.playerId));
  const freeAgentQueue = gameState.players.filter((player) => !usedPlayerIds.has(player.id));

  let nextRosters = gameState.rosters;
  let rosterCounter = gameState.rosters.length;
  const reinforcements: MatchdayEmergencyRosterReinforcement[] = [];

  for (const team of gameState.teams) {
    const teamRosterEntries = rosterEntriesByTeamId.get(team.teamId) ?? [];
    let activePlayersBefore = 0;
    for (const entry of teamRosterEntries) {
      if (!playerIds.has(entry.playerId)) {
        continue;
      }
      const stored = availabilityByKey.get(`${team.teamId}::${entry.playerId}`);
      if (!isPlayerUnavailableForMatchday(stored, currentMatchdayIndex, matchdayIndexById)) {
        activePlayersBefore += 1;
      }
    }

    const shortfall = LEGACY_MATCHDAY_MINIMUM_PLAYERS - activePlayersBefore;
    if (shortfall <= 0) {
      continue;
    }

    const signedPlayerIds: string[] = [];
    for (let index = 0; index < shortfall && freeAgentQueue.length > 0; index += 1) {
      const player = freeAgentQueue.shift();
      if (!player) break;
      const economy = resolvePlayerEconomyContract({ player });
      const salary = economy.salary ?? player.displaySalary ?? player.salaryDemand ?? 0;
      const marketValue =
        economy.purchasePrice ?? economy.marketValue ?? player.displayMarketValue ?? player.marketValue ?? 0;
      const entry: RosterEntry = {
        id: `emergency-callup-${scope.matchdayId}-${rosterCounter}`,
        teamId: team.teamId,
        playerId: player.id,
        contractLength: 1,
        salary: Math.round(salary),
        upkeep: Math.round(salary),
        purchasePrice: Math.round(marketValue),
        currentValue: Math.round(marketValue),
        roleTag: "bench",
        joinedSeasonId: scope.seasonId,
      };
      nextRosters = nextRosters === gameState.rosters ? [...gameState.rosters, entry] : [...nextRosters, entry];
      rosterCounter += 1;
      signedPlayerIds.push(player.id);
    }

    if (signedPlayerIds.length > 0) {
      reinforcements.push({
        teamId: team.teamId,
        teamName: team.name,
        activePlayersBefore,
        signedPlayerIds,
      });
    }
  }

  if (reinforcements.length === 0) {
    return { gameState, reinforcements };
  }

  return {
    gameState: { ...gameState, rosters: nextRosters },
    reinforcements,
  };
}
