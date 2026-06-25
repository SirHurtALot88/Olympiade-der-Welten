import {
  advanceFoundationArenaReveal,
  getFoundationArenaActiveSide,
  getFoundationArenaDisplayPhase,
  mapFoundationPhaseToRoomDisciplineSide,
  mapRoomDisciplineSideToFoundationPhase,
  type FoundationArenaRevealState,
} from "@/lib/foundation/matchday-arena-reveal-sync";
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

function defaultMaxSlotRevealCounts(maxSlotRevealIndex = 0) {
  const normalized = Math.max(0, maxSlotRevealIndex);
  return { d1: normalized, d2: normalized } as const;
}

export function normalizeRoomArenaState(state: RoomArenaState): RoomArenaState {
  const maxCounts = state.maxSlotRevealCountByDiscipline ?? defaultMaxSlotRevealCounts(state.maxSlotRevealIndex);
  const activeDisciplinePhase =
    state.activeDisciplinePhase ?? mapRoomDisciplineSideToFoundationPhase(state.disciplineSide);
  const activeSide = activeDisciplinePhase === "d2" ? "d2" : "d1";
  const revealedSlotCountByDiscipline = state.revealedSlotCountByDiscipline ?? {
    d1:
      activeDisciplinePhase === "d1" || activeDisciplinePhase === "total"
        ? Math.min(state.slotRevealIndex, maxCounts.d1)
        : maxCounts.d1,
    d2:
      activeDisciplinePhase === "d2" || activeDisciplinePhase === "total"
        ? Math.min(state.slotRevealIndex, maxCounts.d2)
        : 0,
  };
  const completedDisciplinePhases = state.completedDisciplinePhases ?? {
    d1: activeDisciplinePhase === "total" || (activeDisciplinePhase === "d2" && revealedSlotCountByDiscipline.d1 >= maxCounts.d1),
    d2: activeDisciplinePhase === "total",
  };

  return {
    ...state,
    activeDisciplinePhase,
    revealedSlotCountByDiscipline,
    completedDisciplinePhases,
    maxSlotRevealCountByDiscipline: maxCounts,
    phaseIndex: state.phaseIndex < 0 ? 0 : state.phaseIndex,
    phaseId: state.phaseId ?? getFoundationArenaDisplayPhase(state.phaseIndex < 0 ? 0 : state.phaseIndex),
    slotRevealIndex: revealedSlotCountByDiscipline[activeSide],
    maxSlotRevealIndex: Math.max(maxCounts.d1, maxCounts.d2),
  };
}

export function createRoomArenaState(input: {
  saveId: string;
  seasonId?: string | null;
  matchdayId?: string | null;
  requiredParticipantIds?: string[];
  now?: string;
}): RoomArenaState {
  const now = input.now ?? new Date().toISOString();
  return normalizeRoomArenaState({
    status: "idle",
    version: 0,
    saveId: input.saveId,
    seasonId: input.seasonId ?? null,
    matchdayId: input.matchdayId ?? null,
    disciplineSide: "d1",
    activeDisciplinePhase: "d1",
    phaseId: null,
    phaseIndex: 0,
    slotRevealIndex: 0,
    maxSlotRevealIndex: 0,
    revealedSlotCountByDiscipline: { d1: 0, d2: 0 },
    completedDisciplinePhases: { d1: false, d2: false },
    maxSlotRevealCountByDiscipline: { d1: 0, d2: 0 },
    stepIndex: 0,
    requiredParticipantIds: input.requiredParticipantIds ?? [],
    readyParticipantIds: [],
    autoReadyControllerTypes: ["ai", "passive"],
    resultStatus: "preview",
    lastActionByParticipantId: null,
    updatedAt: now,
    callout: null,
  });
}

export function syncRoomArenaParticipants(state: OlyRoomState): RoomArenaState {
  const requiredParticipantIds = getRoomArenaRequiredParticipantIds(state);
  const requiredSet = new Set(requiredParticipantIds);
  return normalizeRoomArenaState({
    ...(state.arenaSyncState ?? createRoomArenaState({ saveId: state.multiplayerRoom.saveId })),
    saveId: state.multiplayerRoom.saveId,
    seasonId: state.arenaSyncState?.seasonId ?? state.multiplayerRoom.activeSeasonId,
    matchdayId: state.arenaSyncState?.matchdayId ?? String(state.multiplayerRoom.activeMatchday),
    requiredParticipantIds,
    readyParticipantIds: (state.arenaSyncState?.readyParticipantIds ?? []).filter((participantId) =>
      requiredSet.has(participantId),
    ),
  });
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
  const arenaState = normalizeRoomArenaState(input.arenaState);
  const readySet = new Set(arenaState.readyParticipantIds);
  if (input.ready) {
    readySet.add(input.participantId);
  } else {
    readySet.delete(input.participantId);
  }
  const nextReadyIds = arenaState.requiredParticipantIds.filter((participantId) => readySet.has(participantId));
  return {
    ...arenaState,
    status: isRoomArenaReady({ ...arenaState, readyParticipantIds: nextReadyIds }) ? "revealing" : "ready_check",
    readyParticipantIds: nextReadyIds,
    version: arenaState.version + 1,
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
  maxSlotRevealCountByDiscipline?: { d1: number; d2: number } | null;
  now?: string;
}) {
  const now = input.now ?? new Date().toISOString();
  const requiredParticipantIds = getRoomArenaRequiredParticipantIds(input.state);
  const maxCounts = input.maxSlotRevealCountByDiscipline ?? defaultMaxSlotRevealCounts(input.maxSlotRevealIndex ?? 0);

  return normalizeRoomArenaState({
    status: "ready_check",
    version: (input.state.arenaSyncState?.version ?? 0) + 1,
    saveId: input.state.multiplayerRoom.saveId,
    seasonId: input.seasonId ?? input.state.multiplayerRoom.activeSeasonId,
    matchdayId: input.matchdayId ?? String(input.state.multiplayerRoom.activeMatchday),
    disciplineSide: input.disciplineSide ?? "d1",
    activeDisciplinePhase: mapRoomDisciplineSideToFoundationPhase(input.disciplineSide ?? "d1"),
    phaseId: "slots",
    phaseIndex: 0,
    slotRevealIndex: 0,
    maxSlotRevealIndex: Math.max(maxCounts.d1, maxCounts.d2),
    revealedSlotCountByDiscipline: { d1: 0, d2: 0 },
    completedDisciplinePhases: { d1: false, d2: false },
    maxSlotRevealCountByDiscipline: maxCounts,
    stepIndex: 0,
    requiredParticipantIds,
    readyParticipantIds: [],
    autoReadyControllerTypes: ["ai", "passive"],
    resultStatus: "preview",
    lastActionByParticipantId: input.participantId,
    updatedAt: now,
    callout: "arena_started",
  });
}

export function roomArenaStateToFoundationReveal(state: RoomArenaState): FoundationArenaRevealState {
  const normalized = normalizeRoomArenaState(state);
  return {
    activeDisciplinePhase: normalized.activeDisciplinePhase,
    phaseIndex: normalized.phaseIndex,
    revealedSlotCountByDiscipline: { ...normalized.revealedSlotCountByDiscipline },
    completedDisciplinePhases: { ...normalized.completedDisciplinePhases },
  };
}

export function advanceRoomArenaReveal(input: {
  arenaState: RoomArenaState;
  participantId: string;
  maxSlotRevealIndex?: number | null;
  maxSlotRevealCountByDiscipline?: { d1: number; d2: number } | null;
  now?: string;
}) {
  const arenaState = normalizeRoomArenaState(input.arenaState);
  const maxCounts = input.maxSlotRevealCountByDiscipline ?? arenaState.maxSlotRevealCountByDiscipline;
  const limits = {
    maxD1SlotRevealCount: Math.max(0, maxCounts.d1),
    maxD2SlotRevealCount: Math.max(0, maxCounts.d2),
  };
  if (input.maxSlotRevealCountByDiscipline) {
    limits.maxD1SlotRevealCount = Math.max(0, input.maxSlotRevealCountByDiscipline.d1);
    limits.maxD2SlotRevealCount = Math.max(0, input.maxSlotRevealCountByDiscipline.d2);
  }

  const nextFoundationState = advanceFoundationArenaReveal(roomArenaStateToFoundationReveal(arenaState), limits);
  if (!nextFoundationState) {
    return arenaState;
  }

  const phaseId = getFoundationArenaDisplayPhase(nextFoundationState.phaseIndex);
  const activeSide = getFoundationArenaActiveSide(nextFoundationState);

  return normalizeRoomArenaState({
    ...arenaState,
    status:
      phaseId === "result" && nextFoundationState.activeDisciplinePhase === "total" ? "result" : "revealing",
    activeDisciplinePhase: nextFoundationState.activeDisciplinePhase,
    disciplineSide: mapFoundationPhaseToRoomDisciplineSide(nextFoundationState.activeDisciplinePhase),
    phaseIndex: nextFoundationState.phaseIndex,
    phaseId,
    slotRevealIndex: nextFoundationState.revealedSlotCountByDiscipline[activeSide],
    revealedSlotCountByDiscipline: nextFoundationState.revealedSlotCountByDiscipline,
    completedDisciplinePhases: nextFoundationState.completedDisciplinePhases,
    maxSlotRevealCountByDiscipline: {
      d1: limits.maxD1SlotRevealCount,
      d2: limits.maxD2SlotRevealCount,
    },
    maxSlotRevealIndex: Math.max(limits.maxD1SlotRevealCount, limits.maxD2SlotRevealCount),
    stepIndex: arenaState.stepIndex + 1,
    readyParticipantIds: phaseId === "result" ? arenaState.readyParticipantIds : [],
    version: arenaState.version + 1,
    lastActionByParticipantId: input.participantId,
    updatedAt: input.now ?? new Date().toISOString(),
    callout: null,
  });
}

export function applyFoundationRevealToRoomArenaState(
  arenaState: RoomArenaState,
  reveal: FoundationArenaRevealState,
  limits: { maxD1SlotRevealCount: number; maxD2SlotRevealCount: number },
): RoomArenaState {
  const phaseId = getFoundationArenaDisplayPhase(reveal.phaseIndex);
  const activeSide = getFoundationArenaActiveSide(reveal);

  return normalizeRoomArenaState({
    ...arenaState,
    activeDisciplinePhase: reveal.activeDisciplinePhase,
    disciplineSide: mapFoundationPhaseToRoomDisciplineSide(reveal.activeDisciplinePhase),
    phaseIndex: reveal.phaseIndex,
    phaseId,
    slotRevealIndex: reveal.revealedSlotCountByDiscipline[activeSide],
    revealedSlotCountByDiscipline: reveal.revealedSlotCountByDiscipline,
    completedDisciplinePhases: reveal.completedDisciplinePhases,
    maxSlotRevealCountByDiscipline: {
      d1: limits.maxD1SlotRevealCount,
      d2: limits.maxD2SlotRevealCount,
    },
    maxSlotRevealIndex: Math.max(limits.maxD1SlotRevealCount, limits.maxD2SlotRevealCount),
  });
}
