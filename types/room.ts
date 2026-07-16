import type { CoachRole, OlyRoomState } from "@/types/game";

// Internal runtime session binding for the socket transport. The legacy "seat"
// name is retained for token/rejoin compatibility; it is not team ownership and
// must not be used as the final multiplayer authorization layer.
export type RoomSeat = {
  role: CoachRole;
  participantId: string;
  seatToken: string;
  socketId: string | null;
  connected: boolean;
  joinedAt: string;
};

export type RuntimeRoom = {
  roomCode: string;
  state: OlyRoomState;
  seats: Partial<Record<CoachRole, RoomSeat>>;
};
