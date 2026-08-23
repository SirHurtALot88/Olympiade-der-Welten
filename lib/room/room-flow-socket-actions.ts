"use client";

import { getClientSocket } from "@/lib/socket/client";
import type { RoomFlowButtonAction } from "@/lib/room/room-flow-controller";

/**
 * Sendet genau das Socket-Event, das zu `RoomFlowButtonAction` gehoert — geteilt zwischen der
 * Room-Seite (`RoomPageClient`) und der neuen Room-Flow-Leiste in der Foundation-Shell, damit
 * beide Stellen niemals unterschiedlich verdrahten, was ein Klick auf denselben Knopf auslöst.
 *
 * `getClientSocket()` liefert das App-weite Socket.io-Singleton (siehe `lib/socket/client.ts`) —
 * ein Emit hier oeffnet KEIN zweites Socket-Abo, es nutzt nur die bereits bestehende Verbindung
 * zum Senden.
 */
export function emitRoomFlowButtonAction(input: {
  action: RoomFlowButtonAction;
  roomCode: string;
  seatToken: string;
  /** Zielwert fuer `set_ready` — meist `currentParticipant?.readyState !== "ready"`. */
  toggleReadyTo: boolean;
}) {
  const socket = getClientSocket();
  const { roomCode, seatToken } = input;

  switch (input.action) {
    case "set_ready":
      socket.emit("setReadyState", { roomCode, seatToken, ready: input.toggleReadyTo });
      return;
    case "run_ai_auto_step":
      socket.emit("runRoomAiAutoStep", { roomCode, seatToken });
      return;
    case "start_room":
      socket.emit("startRoom", { roomCode, seatToken });
      return;
    case "advance_flow":
      socket.emit("advanceRoomFlow", { roomCode, seatToken });
      return;
    case "advance_flow_skipping_disconnected":
      socket.emit("advanceRoomFlow", { roomCode, seatToken, getrennteUeberspringen: true });
      return;
    case "none":
      return;
  }
}
