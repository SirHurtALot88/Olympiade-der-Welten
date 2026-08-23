import { createActionLogEntry } from "@/lib/game/action-log";
import { createRoomArenaState, roomMatchdayScopeId } from "@/lib/room/arena-sync-state";
import {
  SERVER_AUTHORITATIVE_WRITE_POLICY,
  buildOwnershipForPreset,
  buildParticipant,
  buildTurnState,
  createRoomEvent,
  createMultiplayerRoomMeta,
  syncParticipantControlledTeams,
} from "@/lib/room/online-room-model";
import { buildRoomFlowState } from "@/lib/room/room-flow-controller";
import type { OlyRoomState } from "@/types/game";

export function createInitialRoomState(
  roomCode: string,
  input?: {
    saveId?: string | null;
    hostParticipantId?: string;
    hostUserId?: string;
    hostDisplayName?: string;
  },
): OlyRoomState {
  const host = buildParticipant({
    participantId: input?.hostParticipantId ?? "participant-host",
    userId: input?.hostUserId ?? "user_host_local",
    displayName: input?.hostDisplayName ?? "Chris",
    role: "host",
  });
  const multiplayerRoom = createMultiplayerRoomMeta({
    roomCode,
    saveId: input?.saveId,
    createdByUserId: host.userId,
  });
  const ownership = buildOwnershipForPreset([host], "chris_1_rest_ai");
  const participants = syncParticipantControlledTeams([host], ownership);
  const turnState = buildTurnState({
    roomStatus: multiplayerRoom.status,
    participants,
    ownership,
  });
  const flowStateBase = {
    multiplayerRoom,
    roomParticipants: participants,
    teamOwnership: ownership,
    systemControlledTeamIds: ownership.filter((entry) => entry.controllerType === "ai").map((entry) => entry.teamId),
    turnState,
  };

  return {
    roomCode,
    status: "waiting",
    multiplayerRoom,
    roomParticipants: participants,
    teamOwnership: ownership,
    systemControlledTeamIds: ownership.filter((entry) => entry.controllerType === "ai").map((entry) => entry.teamId),
    turnState,
    roomFlowState: buildRoomFlowState({ state: flowStateBase }),
    arenaSyncState: createRoomArenaState({
      saveId: multiplayerRoom.saveId,
      seasonId: multiplayerRoom.activeSeasonId,
      matchdayId: roomMatchdayScopeId(multiplayerRoom.activeMatchday),
      requiredParticipantIds: participants.map((participant) => participant.participantId),
    }),
    roomEvents: [
      createRoomEvent({
        type: "room_state_updated",
        roomId: multiplayerRoom.roomId,
        saveId: multiplayerRoom.saveId,
        payload: { source: "create_initial_room_state", status: multiplayerRoom.status },
      }),
    ],
    serverWritePolicy: SERVER_AUTHORITATIVE_WRITE_POLICY,
    actionLog: [
      createActionLogEntry({
        actorRole: "system",
        type: "room_created",
        message: `Raum ${roomCode} wurde erstellt.`,
      }),
    ],
    players: {},
    version: 1,
  };
}
