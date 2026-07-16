import type { RuntimeRoom } from "@/types/room";
import type { ClientToServerEvents, ServerToClientEvents } from "@/types/events";
import type { Server } from "socket.io";

declare global {
  var __olyIo: Server<ClientToServerEvents, ServerToClientEvents> | undefined;
}

export function broadcastRoomGameplayUpdate(room: RuntimeRoom | null | undefined) {
  if (!room || !global.__olyIo) return;
  const latestEvent = room.state.roomEvents[room.state.roomEvents.length - 1] ?? null;
  if (latestEvent) {
    global.__olyIo.to(room.roomCode).emit("roomGameplayEvent", latestEvent);
  }
  global.__olyIo.to(room.roomCode).emit("roomState", room.state);
}
