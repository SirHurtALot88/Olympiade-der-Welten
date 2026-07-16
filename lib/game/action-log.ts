import type { ActionLogEntry, ActionType, CoachRole, OlyRoomState } from "@/types/game";

function createLogId() {
  return `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createActionLogEntry(input: {
  turnNumber: number;
  actorRole: CoachRole | "system";
  type: ActionType;
  message: string;
  tokenId?: string;
  from?: number;
  to?: number;
}): ActionLogEntry {
  return {
    id: createLogId(),
    createdAt: new Date().toISOString(),
    ...input,
  };
}

export function appendActionLog(state: OlyRoomState, entry: ActionLogEntry): OlyRoomState {
  return {
    ...state,
    actionLog: [...state.actionLog, entry],
    version: state.version + 1,
  };
}
