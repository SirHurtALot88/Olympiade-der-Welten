import { getActiveRoomBySaveId, getRoom } from "@/lib/room/room-store";
import { findSeatByToken } from "@/lib/room/rejoin";
import { authorizeTeamWrite, type TeamWriteAction } from "@/lib/room/online-room-model";
import { DEFAULT_ACTIVE_OWNER_ID, canLocalUserManageTeam } from "@/lib/foundation/team-control-settings";
import { canFoundationLocalUserManageTeam } from "@/lib/foundation/foundation-admin-dev-flags";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
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
  activeOwnerId?: string | null;
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
  "formcards_season_regenerate",
  "lineup_ai_batch_apply",
  "ai_preseason_background",
  "ai_picks_run_execute",
  "ai_market_plan_apply",
  "ai_roster_fill_execute",
  "ai_xp_spend_apply",
  "matchday_resolve",
  "season_transition",
  "season_completion",
  "cash_prize_apply",
  "standings_apply",
  // Player-Generator commit inserts a brand-new free agent into the shared
  // save — it isn't a team-owned write (no roster/team is touched), so it
  // has no natural `teamId` to authorize against. Treating it as host-level
  // means: unrestricted in local singleplayer (no active room), host-only
  // in a room, exactly like the other save-wide admin actions above.
  "player_generator_commit",
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

function authorizeLocalSingleplayerTeamWrite(input: ServerRoomWriteContext, warnings: string[]): ServerRoomWriteAuthorization {
  if (HOST_LEVEL_ACTIONS.has(input.action)) {
    return {
      allowed: true,
      room: null,
      participant: null,
      ownership: null,
      warnings,
    };
  }

  if (!input.teamId) {
    return { allowed: false, status: 409, reason: "team_id_required_for_team_write", warnings };
  }

  const save = createPersistenceService().getSaveById(input.saveId);
  if (!save) {
    return {
      allowed: true,
      room: null,
      participant: null,
      ownership: null,
      warnings: [...warnings, "local_team_ownership_unverified_save_not_found"],
    };
  }

  const activeOwnerId = input.activeOwnerId?.trim() || DEFAULT_ACTIVE_OWNER_ID;
  if (!canFoundationLocalUserManageTeam(canLocalUserManageTeam(save.gameState, input.teamId, activeOwnerId))) {
    return {
      allowed: false,
      status: 403,
      reason: "local_team_not_owned_or_ai_controlled",
      warnings,
    };
  }

  return {
    allowed: true,
    room: null,
    participant: null,
    ownership: null,
    warnings,
  };
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
    return authorizeLocalSingleplayerTeamWrite(input, warnings);
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
