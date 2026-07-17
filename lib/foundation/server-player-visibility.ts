/**
 * Server-side Fog-of-War-Maskierung für API-Routen, die einzelne Spieler-
 * oder Spieler-Karten-Daten außerhalb des Player-Detail-Drawers ausliefern
 * (player-sheet, ratings-slice, player-directory-slice).
 *
 * Nutzt bewusst dieselbe Visibility-Auflösung wie `player-detail-drawer.ts`
 * (`resolveAttributeVisibility`), damit sich der Debug-Schalter
 * `DEBUG_FORCE_PLAYER_VISIBILITY` weiterhin zentral auf ALLE Lese-Pfade
 * auswirkt: Debug an (Default während der Bauphase) → immer "exact" wie
 * bisher; Debug aus → echte Scouting-/Team-basierte Maskierung.
 *
 * Siehe docs/VERBESSERUNGS-BACKLOG-2026-07.md, T-020/T-021/T-022.
 */
import type { GameState } from "@/lib/data/olyDataTypes";
import { getEffectiveScoutingLevel } from "@/lib/scouting/facility-scout-pipeline-service";
import {
  resolveAttributeVisibility,
  resolveRosterEntry,
  resolveTeam,
  type AttributeVisibility,
} from "@/lib/foundation/player-detail-drawer";

export type { AttributeVisibility };

/**
 * Löst die Attribut-Sichtbarkeit für einen einzelnen Spieler aus Sicht des
 * anfragenden Teams auf. `requestingTeamId` kommt vom Client als expliziter
 * `teamId`-Query-Parameter (gleiches Muster wie z. B.
 * `/api/transfermarkt/free-agents`) — es gibt in diesem lokalen
 * Singleplayer-Kontext keine Server-Session, aus der sich das "aktive Team"
 * ableiten ließe.
 */
export function resolvePlayerAttributeVisibility(input: {
  gameState: GameState;
  playerId: string;
  requestingTeamId?: string | null;
}): AttributeVisibility {
  const requestingTeamId = input.requestingTeamId?.trim() || null;
  const manageableTeamIds = requestingTeamId ? [requestingTeamId] : null;
  const rosterEntry = resolveRosterEntry(input.gameState.rosters, input.playerId, null);
  const team = resolveTeam(input.gameState.teams, rosterEntry);
  const scoutingLevel = requestingTeamId
    ? getEffectiveScoutingLevel(input.gameState, requestingTeamId, input.playerId)
    : 0;

  return resolveAttributeVisibility({
    teamId: rosterEntry?.teamId ?? team?.teamId ?? null,
    teamHumanControlled: team ? team.humanControlled !== false : null,
    manageableTeamIds,
    scoutingLevel,
    isOnViewingTeamRoster: Boolean(rosterEntry && team?.teamId && rosterEntry.teamId === team.teamId),
  });
}

/**
 * Baut für einen ganzen Save eine Lookup-Funktion `playerId -> Visibility`,
 * damit Slice-Routen (ratings-slice, player-directory-slice) nicht pro
 * Spieler den vollen Roster-Scan wiederholen müssen.
 */
export function buildPlayerAttributeVisibilityResolver(input: {
  gameState: GameState;
  requestingTeamId?: string | null;
}): (playerId: string) => AttributeVisibility {
  const requestingTeamId = input.requestingTeamId?.trim() || null;
  const rosterByPlayerId = new Map(input.gameState.rosters.map((entry) => [entry.playerId, entry] as const));
  const teamById = new Map(input.gameState.teams.map((team) => [team.teamId, team] as const));
  const manageableTeamIds = requestingTeamId ? [requestingTeamId] : null;

  return (playerId: string): AttributeVisibility => {
    const rosterEntry = rosterByPlayerId.get(playerId) ?? null;
    const team = rosterEntry ? teamById.get(rosterEntry.teamId) ?? null : null;
    const scoutingLevel = requestingTeamId
      ? getEffectiveScoutingLevel(input.gameState, requestingTeamId, playerId)
      : 0;

    return resolveAttributeVisibility({
      teamId: rosterEntry?.teamId ?? team?.teamId ?? null,
      teamHumanControlled: team ? team.humanControlled !== false : null,
      manageableTeamIds,
      scoutingLevel,
      isOnViewingTeamRoster: Boolean(rosterEntry && team?.teamId && rosterEntry.teamId === team.teamId),
    });
  };
}
