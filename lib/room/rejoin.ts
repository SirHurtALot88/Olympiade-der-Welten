import type { CoachRole } from "@/types/game";
import type { RuntimeRoom } from "@/types/room";

export function findSeatByToken(room: RuntimeRoom, seatToken: string): CoachRole | null {
  const roles: CoachRole[] = ["A", "B"];
  for (const role of roles) {
    const seat = room.seats[role];
    if (seat?.seatToken === seatToken) {
      return role;
    }
  }

  return null;
}
