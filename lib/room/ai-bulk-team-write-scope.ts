import type { GameState } from "@/lib/data/olyDataTypes";
import { canOwnerManageTeam, DEFAULT_ACTIVE_OWNER_ID, getTeamControlSettings } from "@/lib/foundation/team-control-settings";
import type { RoomParticipant } from "@/types/game";
import type { RuntimeRoom } from "@/types/room";

export type AiBulkTeamWriteScopeInput = {
  gameState: GameState;
  room: RuntimeRoom | null;
  participant: RoomParticipant | null;
  activeOwnerId?: string | null;
};

export type AiBulkTeamWriteScope = {
  /** Every team id in `gameState.teams` the caller may have an AI bulk write path touch. */
  writableTeamIds: Set<string>;
  /** Same rule as `writableTeamIds`, exposed per-team for callers that filter incrementally. */
  isTeamWritable: (teamId: string) => boolean;
};

/**
 * Determines, for the AI bulk/mass write paths (AI picks run, AI market-plan apply, AI roster
 * fill, AI batch lineup apply, AI preseason background), which teams the calling participant is
 * allowed to have mutated.
 *
 * These routes authorize host-level via `authorizeServerRoomWrite` (any host may trigger a bulk AI
 * run) — that check alone does not restrict which teams get written. This restricts the mutated set
 * to AI/passive-controlled teams (fair game for any caller) plus the caller's own team(s); a
 * different human participant's team is never writable here, even by the host.
 *
 * Ownership is read from authoritative server-side state only, never from a client-supplied claim:
 * `room.state.teamOwnership` when an online room is active for this save — that record is what
 * actually assigns Chris vs. Franky vs. AI and is authoritative over `teamControlSettings`, which can
 * lag it — falling back to `gameState.seasonState.teamControlSettings` for local (non-room) saves.
 */
export function resolveAiBulkTeamWriteScope(input: AiBulkTeamWriteScopeInput): AiBulkTeamWriteScope {
  const { gameState, room, participant, activeOwnerId } = input;

  const isTeamWritable = (teamId: string): boolean => {
    if (room) {
      const ownership = room.state.teamOwnership.find((entry) => entry.teamId === teamId);
      if (!ownership || ownership.controllerType !== "human") {
        return true;
      }
      return Boolean(participant && ownership.participantId === participant.participantId);
    }

    const settings = getTeamControlSettings(gameState, teamId);
    if (!settings || settings.controlMode !== "manual") {
      return true;
    }
    return canOwnerManageTeam(settings, activeOwnerId?.trim() || DEFAULT_ACTIVE_OWNER_ID);
  };

  const writableTeamIds = new Set(gameState.teams.map((team) => team.teamId).filter((teamId) => isTeamWritable(teamId)));

  return { writableTeamIds, isTeamWritable };
}
