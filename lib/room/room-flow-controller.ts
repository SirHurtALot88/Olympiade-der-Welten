import type {
  MultiplayerRoomStatus,
  OlyRoomState,
  RoomFlowButtonStatus,
  RoomFlowState,
  RoomFlowStepId,
  RoomParticipant,
  TeamOwnershipRecord,
} from "@/types/game";

export type RoomFlowView =
  | "teams"
  | "market"
  | "training"
  | "lineup"
  | "matchdayArena"
  | "matchdayResult"
  | "season"
  | "cockpit";

export type RoomFlowStepDefinition = {
  stepId: RoomFlowStepId;
  label: string;
  cta: string;
  targetView: RoomFlowView;
  aiAutoStep: boolean;
};

export const ROOM_FLOW_STEPS: RoomFlowStepDefinition[] = [
  { stepId: "lobby_ready", label: "Room bereit machen", cta: "Room starten", targetView: "cockpit", aiAutoStep: false },
  { stepId: "sell_players", label: "Verkäufe entscheiden", cta: "Weiter: Team/Kader", targetView: "teams", aiAutoStep: true },
  { stepId: "buy_players", label: "Käufe entscheiden", cta: "Weiter: Transfermarkt", targetView: "market", aiAutoStep: true },
  { stepId: "facilities", label: "Facilities entscheiden", cta: "Weiter: Training & Gebäude", targetView: "training", aiAutoStep: true },
  { stepId: "xp_spend", label: "XP verteilen", cta: "Weiter: Entwicklung", targetView: "training", aiAutoStep: true },
  { stepId: "training", label: "Training prüfen", cta: "Weiter: Training prüfen", targetView: "training", aiAutoStep: true },
  { stepId: "lineup", label: "Einsatzliste setzen", cta: "Weiter: Einsatzliste", targetView: "lineup", aiAutoStep: true },
  { stepId: "formcards", label: "Formkarten setzen", cta: "Weiter: Formkarten", targetView: "lineup", aiAutoStep: true },
  { stepId: "arena", label: "Arena starten", cta: "Arena starten", targetView: "matchdayArena", aiAutoStep: false },
  { stepId: "result", label: "Spieltagsergebnis ansehen", cta: "Spieltagsergebnis ansehen", targetView: "matchdayResult", aiAutoStep: false },
  { stepId: "standings", label: "Saisonstand ansehen", cta: "Saisonstand ansehen", targetView: "season", aiAutoStep: false },
  { stepId: "season_review", label: "Season Review", cta: "Season Review", targetView: "cockpit", aiAutoStep: false },
];

export type RoomFlowButtonModel = {
  label: string;
  status: RoomFlowButtonStatus;
  targetView: RoomFlowView;
  activeTeamId: string | null;
  canClick: boolean;
  isHostAction: boolean;
  warnings: string[];
};

function uniq(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => typeof value === "string" && value.trim().length > 0)));
}

export function getRoomFlowStep(stepId: string): RoomFlowStepDefinition {
  return ROOM_FLOW_STEPS.find((entry) => entry.stepId === stepId) ?? ROOM_FLOW_STEPS[0]!;
}

export function getNextRoomFlowStepId(stepId: string): RoomFlowStepId {
  const index = ROOM_FLOW_STEPS.findIndex((entry) => entry.stepId === stepId);
  return ROOM_FLOW_STEPS[Math.min(index + 1, ROOM_FLOW_STEPS.length - 1)]?.stepId ?? "season_review";
}

export function isSandboxRoomSave(saveId: string) {
  return /sandbox|test|local/i.test(saveId);
}

function getRequiredParticipants(participants: RoomParticipant[], ownership: TeamOwnershipRecord[]) {
  const participantIdsWithTeams = new Set(
    ownership.filter((entry) => entry.controllerType === "human" && entry.participantId).map((entry) => entry.participantId!),
  );
  return participants
    .filter((participant) => participant.role !== "spectator" && participant.connectionStatus !== "offline")
    .filter((participant) => participantIdsWithTeams.has(participant.participantId))
    .map((participant) => participant.participantId);
}

export function buildRoomFlowState(input: {
  state: Pick<OlyRoomState, "multiplayerRoom" | "roomParticipants" | "teamOwnership" | "systemControlledTeamIds" | "turnState">;
  currentStep?: string | null;
  aiAutoCompletedTeamIds?: string[];
}): RoomFlowState {
  const stepId = (input.currentStep ?? input.state.turnState.currentStep ?? "lobby_ready") as RoomFlowStepId;
  const stepDefinition = getRoomFlowStep(stepId);
  const requiredParticipantIds = getRequiredParticipants(input.state.roomParticipants, input.state.teamOwnership);
  const completedParticipantIds = input.state.roomParticipants
    .filter((participant) => requiredParticipantIds.includes(participant.participantId) && participant.readyState === "ready")
    .map((participant) => participant.participantId);
  const blockingTeamIds = input.state.teamOwnership
    .filter(
      (entry) =>
        entry.controllerType === "human" &&
        entry.participantId != null &&
        requiredParticipantIds.includes(entry.participantId) &&
        !completedParticipantIds.includes(entry.participantId),
    )
    .map((entry) => entry.teamId);
  const aiTeamIds = input.state.teamOwnership.filter((entry) => entry.controllerType === "ai").map((entry) => entry.teamId);
  const aiAutoCompletedTeamIds =
    input.state.multiplayerRoom.status === "lobby" || !stepDefinition.aiAutoStep
      ? aiTeamIds
      : uniq(input.aiAutoCompletedTeamIds ?? []).filter((teamId) => aiTeamIds.includes(teamId));
  const aiPendingTeamIds = aiTeamIds.filter((teamId) => !aiAutoCompletedTeamIds.includes(teamId));
  const humanReady = requiredParticipantIds.length > 0 && requiredParticipantIds.every((participantId) => completedParticipantIds.includes(participantId));
  const aiReady = !stepDefinition.aiAutoStep || aiPendingTeamIds.length === 0;

  return {
    roomId: input.state.multiplayerRoom.roomId,
    saveId: input.state.multiplayerRoom.saveId,
    activeSeasonId: input.state.multiplayerRoom.activeSeasonId,
    activeMatchday: input.state.multiplayerRoom.activeMatchday,
    phase: input.state.multiplayerRoom.status,
    step: stepDefinition.stepId,
    requiredParticipantIds,
    completedParticipantIds,
    blockingTeamIds,
    aiAutoCompletedTeamIds,
    canHostAdvance: humanReady && aiReady,
    warnings: [
      ...(!humanReady ? ["waiting_for_human_ready"] : []),
      ...(stepDefinition.aiAutoStep && aiPendingTeamIds.length > 0 ? ["ai_auto_step_pending"] : []),
      ...(isSandboxRoomSave(input.state.multiplayerRoom.saveId) ? ["sandbox_override_available"] : []),
    ],
  };
}

export function describeRoomFlowButton(input: {
  state: OlyRoomState;
  participantId: string | null;
}): RoomFlowButtonModel {
  const participant = input.participantId
    ? input.state.roomParticipants.find((entry) => entry.participantId === input.participantId) ?? null
    : null;
  const isHost = participant?.role === "host";
  const flow = input.state.roomFlowState;
  const stepDefinition = getRoomFlowStep(flow.step);
  const ownedTeamId = participant?.controlledTeamIds[0] ?? null;
  const missingParticipant = input.state.roomParticipants.find(
    (entry) => flow.requiredParticipantIds.includes(entry.participantId) && !flow.completedParticipantIds.includes(entry.participantId),
  );
  const aiTeamCount = input.state.teamOwnership.filter((entry) => entry.controllerType === "ai").length;
  const aiReadyCount = flow.aiAutoCompletedTeamIds.length;
  const aiPending = stepDefinition.aiAutoStep && aiReadyCount < aiTeamCount;

  if (!participant) {
    return {
      label: "Room lädt",
      status: "blocked",
      targetView: stepDefinition.targetView,
      activeTeamId: null,
      canClick: false,
      isHostAction: false,
      warnings: ["participant_missing"],
    };
  }

  if (!isHost && participant.readyState !== "ready") {
    return {
      label: `Ready: ${stepDefinition.label}`,
      status: "ready",
      targetView: stepDefinition.targetView,
      activeTeamId: ownedTeamId,
      canClick: true,
      isHostAction: false,
      warnings: [],
    };
  }

  if (aiPending && isHost) {
    return {
      label: "AI Teams vorbereiten",
      status: "ready",
      targetView: stepDefinition.targetView,
      activeTeamId: ownedTeamId,
      canClick: true,
      isHostAction: true,
      warnings: ["ai_auto_step_pending"],
    };
  }

  if (!flow.canHostAdvance) {
    const name = missingParticipant?.displayName ?? "Mitspieler";
    return {
      label: isHost ? `Warten auf ${name}` : "Warten auf Host",
      status: "waiting_for_player",
      targetView: stepDefinition.targetView,
      activeTeamId: ownedTeamId,
      canClick: false,
      isHostAction: isHost,
      warnings: flow.warnings,
    };
  }

  if (!isHost) {
    return {
      label: "Host darf weiter",
      status: "host_only",
      targetView: stepDefinition.targetView,
      activeTeamId: ownedTeamId,
      canClick: false,
      isHostAction: false,
      warnings: ["host_only"],
    };
  }

  return {
    label: stepDefinition.cta,
    status: "ready",
    targetView: stepDefinition.targetView,
    activeTeamId: ownedTeamId,
    canClick: true,
    isHostAction: true,
    warnings: flow.warnings,
  };
}
