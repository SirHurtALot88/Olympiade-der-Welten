import type { AthleteToken, CoachRole, OlyRoomState } from "@/types/game";

export function getTokenById(state: OlyRoomState, tokenId: string): AthleteToken | undefined {
  return state.tokens.find((token) => token.id === tokenId);
}

export function isRoleActive(state: OlyRoomState, role: CoachRole) {
  return state.activeRole === role;
}

export function hasMoveCommitted(state: OlyRoomState) {
  return state.moveCommittedThisTurn;
}
