import type { OlyRoomState, RoomArenaPhaseId, RoomArenaState } from "@/types/game";

export const ROOM_ARENA_PHASES: RoomArenaPhaseId[] = [
  "slots",
  "push",
  "form",
  "mutator",
  "captain",
  "final",
  "result",
];

export function getRoomArenaRequiredParticipantIds(state: Pick<OlyRoomState, "roomParticipants" | "teamOwnership">) {
  return state.roomParticipants
    .filter((participant) => participant.role !== "spectator" && participant.controlledTeamIds.length > 0)
    .map((participant) => participant.participantId);
}

export function createRoomArenaState(input: {
  saveId: string;
  seasonId?: string | null;
  matchdayId?: string | null;
  requiredParticipantIds?: string[];
  now?: string;
}): RoomArenaState {
  const now = input.now ?? new Date().toISOString();
  return {
    status: "idle",
    version: 0,
    saveId: input.saveId,
    seasonId: input.seasonId ?? null,
    matchdayId: input.matchdayId ?? null,
    disciplineSide: "d1",
    phaseId: null,
    phaseIndex: -1,
    slotRevealIndex: 0,
    maxSlotRevealIndex: 0,
    stepIndex: 0,
    requiredParticipantIds: input.requiredParticipantIds ?? [],
    readyParticipantIds: [],
    autoReadyControllerTypes: ["ai", "passive"],
    resultStatus: "preview",
    lastActionByParticipantId: null,
    updatedAt: now,
    callout: null,
  };
}

export function syncRoomArenaParticipants(state: OlyRoomState): RoomArenaState {
  const requiredParticipantIds = getRoomArenaRequiredParticipantIds(state);
  const requiredSet = new Set(requiredParticipantIds);
  return {
    ...(state.arenaSyncState ?? createRoomArenaState({ saveId: state.multiplayerRoom.saveId })),
    saveId: state.multiplayerRoom.saveId,
    seasonId: state.arenaSyncState?.seasonId ?? state.multiplayerRoom.activeSeasonId,
    matchdayId: state.arenaSyncState?.matchdayId ?? String(state.multiplayerRoom.activeMatchday),
    requiredParticipantIds,
    readyParticipantIds: (state.arenaSyncState?.readyParticipantIds ?? []).filter((participantId) =>
      requiredSet.has(participantId),
    ),
  };
}

export function isRoomArenaReady(arenaState: RoomArenaState) {
  const readySet = new Set(arenaState.readyParticipantIds);
  return arenaState.requiredParticipantIds.every((participantId) => readySet.has(participantId));
}

export function setRoomArenaParticipantReady(input: {
  arenaState: RoomArenaState;
  participantId: string;
  ready: boolean;
  now?: string;
}) {
  const readySet = new Set(input.arenaState.readyParticipantIds);
  if (input.ready) {
    readySet.add(input.participantId);
  } else {
    readySet.delete(input.participantId);
  }
  const nextReadyIds = input.arenaState.requiredParticipantIds.filter((participantId) => readySet.has(participantId));
  return {
    ...input.arenaState,
    status: isRoomArenaReady({ ...input.arenaState, readyParticipantIds: nextReadyIds }) ? "revealing" : "ready_check",
    readyParticipantIds: nextReadyIds,
    version: input.arenaState.version + 1,
    lastActionByParticipantId: input.participantId,
    updatedAt: input.now ?? new Date().toISOString(),
  } satisfies RoomArenaState;
}

export function startRoomArena(input: {
  state: OlyRoomState;
  participantId: string;
  seasonId?: string | null;
  matchdayId?: string | null;
  disciplineSide?: "d1" | "d2" | "overall" | null;
  maxSlotRevealIndex?: number | null;
  now?: string;
}) {
  const now = input.now ?? new Date().toISOString();
  const requiredParticipantIds = getRoomArenaRequiredParticipantIds(input.state);
  return {
    status: "ready_check",
    version: (input.state.arenaSyncState?.version ?? 0) + 1,
    saveId: input.state.multiplayerRoom.saveId,
    seasonId: input.seasonId ?? input.state.multiplayerRoom.activeSeasonId,
    matchdayId: input.matchdayId ?? String(input.state.multiplayerRoom.activeMatchday),
    disciplineSide: input.disciplineSide ?? "d1",
    phaseId: null,
    phaseIndex: -1,
    slotRevealIndex: 0,
    maxSlotRevealIndex: Math.max(0, input.maxSlotRevealIndex ?? 0),
    stepIndex: 0,
    requiredParticipantIds,
    readyParticipantIds: [],
    autoReadyControllerTypes: ["ai", "passive"],
    resultStatus: "preview",
    lastActionByParticipantId: input.participantId,
    updatedAt: now,
    callout: "arena_started",
  } satisfies RoomArenaState;
}

export function advanceRoomArenaReveal(input: {
  arenaState: RoomArenaState;
  participantId: string;
  maxSlotRevealIndex?: number | null;
  now?: string;
}) {
  const maxSlotRevealIndex = Math.max(0, input.maxSlotRevealIndex ?? input.arenaState.maxSlotRevealIndex ?? 0);
  let nextPhaseIndex = input.arenaState.phaseIndex;
  let nextSlotRevealIndex = input.arenaState.slotRevealIndex;

  if (nextPhaseIndex < 0) {
    nextPhaseIndex = 0;
    nextSlotRevealIndex = 0;
  } else if (ROOM_ARENA_PHASES[nextPhaseIndex] === "slots" && nextSlotRevealIndex < maxSlotRevealIndex) {
    nextSlotRevealIndex += 1;
  } else {
    nextPhaseIndex = Math.min(nextPhaseIndex + 1, ROOM_ARENA_PHASES.length - 1);
    if (ROOM_ARENA_PHASES[nextPhaseIndex] !== "slots") {
      nextSlotRevealIndex = maxSlotRevealIndex;
    }
  }

  const phaseId = ROOM_ARENA_PHASES[nextPhaseIndex] ?? "result";
  return {
    ...input.arenaState,
    status: phaseId === "result" ? "result" : "revealing",
    phaseIndex: nextPhaseIndex,
    phaseId,
    slotRevealIndex: nextSlotRevealIndex,
    maxSlotRevealIndex,
    stepIndex: input.arenaState.stepIndex + 1,
    readyParticipantIds: phaseId === "result" ? input.arenaState.readyParticipantIds : [],
    version: input.arenaState.version + 1,
    lastActionByParticipantId: input.participantId,
    updatedAt: input.now ?? new Date().toISOString(),
    callout: null,
  } satisfies RoomArenaState;
}
