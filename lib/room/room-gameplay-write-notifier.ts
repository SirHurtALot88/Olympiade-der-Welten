import { recordRoomGameplayWrite } from "@/lib/room/room-store";
import type { ServerRoomWriteAuthorization } from "@/lib/room/server-authoritative-write-guard";
import { broadcastRoomGameplayUpdate } from "@/lib/socket/room-gameplay-broadcast";
import type { RoomRealtimeEventType } from "@/types/game";

export function notifyRoomGameplayWrite(
  authorization: ServerRoomWriteAuthorization,
  input: {
    saveId: string;
    teamId?: string | null;
    action: string;
    eventType: RoomRealtimeEventType;
    affectedViews: string[];
    dryRun: boolean;
    success: boolean;
  },
) {
  if (!authorization.allowed || !authorization.room || input.dryRun || !input.success) {
    return;
  }

  const recorded = recordRoomGameplayWrite({
    roomCode: authorization.room.roomCode,
    saveId: input.saveId,
    teamId: input.teamId ?? null,
    participantId: authorization.participant?.participantId ?? null,
    action: input.action,
    eventType: input.eventType,
    affectedViews: input.affectedViews,
  });

  if (recorded.ok) {
    broadcastRoomGameplayUpdate(recorded.room);
  }
}
