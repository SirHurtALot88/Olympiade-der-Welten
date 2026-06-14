import { getActiveRoomBySaveId, getRoom } from "@/lib/room/room-store";
import { findSeatByToken } from "@/lib/room/rejoin";
import { authorizeTeamWrite, type TeamWriteAction } from "@/lib/room/online-room-model";
import type { RoomParticipant, TeamControllerType, TeamOwnershipRecord } from "@/types/game";
import type { RuntimeRoom } from "@/types/room";

export type ServerWriteSource = "sqlite" | "prisma";

export type ServerRoomWriteContext = {
  roomCode?: string | null;
  participantId?: string | null;
  seatToken?: string | null;
  userId?: string | null;
  saveId: string;
  teamId?: string | null;
  action: TeamWriteAction;
  source?: ServerWriteSource;
  dryRun?: boolean;
  confirmToken?: string | null;
  expectedConfirmToken?: string | null;
  activeManagerTeamId?: string | null;
  controlMode?: TeamControllerType | "manual" | null;
  allowSandboxHostOverride?: boolean;
};

export type ServerRoomWriteAllowed = {
  allowed: true;
  room: RuntimeRoom | null;
  participant: RoomParticipant | null;
  ownership: TeamOwnershipRecord | null;
  warnings: string[];
};

export type ServerRoomWriteBlocked = {
  allowed: false;
  status: 401 | 403 | 404 | 409;
  reason: string;
  warnings: string[];
};

export type ServerRoomWriteAuthorization = ServerRoomWriteAllowed | ServerRoomWriteBlocked;

const HOST_LEVEL_ACTIONS = new Set<TeamWriteAction>([
  "matchday_resolve",
  "season_transition",
  "cash_prize_apply",
  "standings_apply",
]);

function resolveParticipant(room: RuntimeRoom, input: ServerRoomWriteContext): RoomParticipant | null {
  if (input.participantId) {
    return room.state.roomParticipants.find((participant) => participant.participantId === input.participantId) ?? null;
  }
  if (input.seatToken) {
    const role = findSeatByToken(room, input.seatToken);
    const participantId = role ? room.seats[role]?.participantId : null;
    return participantId
      ? room.state.roomParticipants.find((participant) => participant.participantId === participantId) ?? null
      : null;
  }
  return null;
}

function isSandboxLikeSave(saveId: string) {
  return /sandbox|manager|test|local/i.test(saveId);
}

export function isRoomWriteContextPresent(input: Pick<ServerRoomWriteContext, "roomCode" | "participantId" | "seatToken" | "userId">) {
  return Boolean(input.roomCode || input.participantId || input.seatToken || input.userId);
}

export function authorizeServerRoomWrite(input: ServerRoomWriteContext): ServerRoomWriteAuthorization {
  const warnings: string[] = [];
  const source = input.source === "prisma" ? "prisma" : "sqlite";

  if (source === "prisma") {
    return {
      allowed: false,
      status: 409,
      reason: "prisma_writes_forbidden_in_local_multiplayer",
      warnings,
    };
  }

  const activeRoomForSave = getActiveRoomBySaveId(input.saveId);

  if (!input.roomCode) {
    if (activeRoomForSave) {
      return {
        allowed: false,
        status: 401,
        reason: "room_context_required_for_room_save",
        warnings,
      };
    }
    return {
      allowed: true,
      room: null,
      participant: null,
      ownership: null,
      warnings: [],
    };
  }

  const room = getRoom(input.roomCode);
  if (!room) {
    return { allowed: false, status: 404, reason: "room_not_found", warnings };
  }

  if (activeRoomForSave && activeRoomForSave.roomCode !== room.roomCode) {
    return {
      allowed: false,
      status: 409,
      reason: "save_bound_to_different_room",
      warnings,
    };
  }

  if (room.state.multiplayerRoom.saveId !== input.saveId) {
    return {
      allowed: false,
      status: 409,
      reason: "room_save_mismatch",
      warnings,
    };
  }

  const participant = resolveParticipant(room, input);
  if (!participant) {
    return { allowed: false, status: 401, reason: "participant_missing", warnings };
  }
  if (input.userId && input.userId !== participant.userId) {
    return { allowed: false, status: 403, reason: "user_participant_mismatch", warnings };
  }
  if (participant.connectionStatus === "offline") {
    return { allowed: false, status: 403, reason: "participant_offline", warnings };
  }

  if (input.expectedConfirmToken != null && input.dryRun === false && input.confirmToken !== input.expectedConfirmToken) {
    return { allowed: false, status: 409, reason: "confirm_token_invalid_or_stale", warnings };
  }

  if (HOST_LEVEL_ACTIONS.has(input.action)) {
    if (participant.role === "host") {
      return { allowed: true, room, participant, ownership: null, warnings };
    }
    return { allowed: false, status: 403, reason: "host_only_action", warnings };
  }

  if (!input.teamId) {
    return { allowed: false, status: 409, reason: "team_id_required_for_team_write", warnings };
  }

  const ownership = room.state.teamOwnership.find((entry) => entry.teamId === input.teamId) ?? null;
  const teamAuth = authorizeTeamWrite({
    state: room.state,
    participantId: participant.participantId,
    teamId: input.teamId,
    action: input.action,
    activeManagerTeamId: input.activeManagerTeamId,
    controlMode: input.controlMode,
  });

  if (teamAuth.allowed) {
    return { allowed: true, room, participant, ownership, warnings };
  }

  if (input.allowSandboxHostOverride && participant.role === "host" && isSandboxLikeSave(input.saveId)) {
    return {
      allowed: true,
      room,
      participant,
      ownership,
      warnings: [`source:sandbox_host_override:${teamAuth.reason}`],
    };
  }

  return {
    allowed: false,
    status: teamAuth.reason === "participant_missing" ? 401 : 403,
    reason: teamAuth.reason,
    warnings,
  };
}
