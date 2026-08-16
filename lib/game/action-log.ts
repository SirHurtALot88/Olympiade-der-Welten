import type { ActionLogEntry, ActionType, CoachRole } from "@/types/game";

function createLogId() {
  return `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createActionLogEntry(input: {
  actorRole: CoachRole | "system";
  type: ActionType;
  message: string;
}): ActionLogEntry {
  return {
    id: createLogId(),
    createdAt: new Date().toISOString(),
    ...input,
  };
}
