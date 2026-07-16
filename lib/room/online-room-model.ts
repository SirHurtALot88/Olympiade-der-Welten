import type { RoomOwnershipPreset } from "@/types/events";
import type {
  MultiplayerRoomMeta,
  RoomRealtimeEvent,
  RoomRealtimeEventType,
  MultiplayerTurnState,
  OlyRoomState,
  RoomParticipant,
  ServerAuthoritativeWritePolicy,
  TeamControllerType,
  TeamOwnershipRecord,
} from "@/types/game";
import { buildRoomFlowState } from "@/lib/room/room-flow-controller";

export const ONLINE_ROOM_TEAM_IDS = [
  "A-A",
  "B-B",
  "B-P",
  "C-C",
  "C-S",
  "D-L",
  "D-P",
  "G-G",
  "H-R",
  "L-K",
  "L-R",
  "M-M",
  "M-S",
  "N-N",
  "N-W",
  "P-C",
  "P-S",
  "R-C",
  "R-L",
  "R-R",
  "S-C",
  "S-S",
  "T-C",
  "T-G",
  "T-T",
  "U-A",
  "V-D",
  "V-V",
  "V-W",
  "W-L",
  "W-W",
  "Z-H",
];

const FOUR_PLUS_FOUR_HOST_TEAM_IDS = ["P-S", "D-P", "M-M", "V-W"];
const FOUR_PLUS_FOUR_FRANKY_TEAM_IDS = ["M-S", "P-C", "C-S", "G-G"];

export const SERVER_AUTHORITATIVE_WRITE_POLICY: ServerAuthoritativeWritePolicy = {
  clientMayWriteDirectly: false,
  serverValidatesRoomMembership: true,
  serverValidatesTeamOwnership: true,
  serverValidatesSaveAndStep: true,
  serverValidatesConfirmToken: true,
  localSandboxForbidsPrismaWrites: true,
};

export function createMultiplayerRoomMeta(input: {
  roomCode: string;
  saveId?: string | null;
  createdByUserId: string;
  now?: string;
}): MultiplayerRoomMeta {
  const now = input.now ?? new Date().toISOString();
  return {
    roomId: `room-${input.roomCode.toLowerCase()}`,
    roomCode: input.roomCode,
    saveId: input.saveId ?? "local-sandbox-active-save",
    hostUserId: input.createdByUserId,
    status: "lobby",
    createdByUserId: input.createdByUserId,
    activeSeasonId: "season-1",
    activeMatchday: 1,
    createdAt: now,
    updatedAt: now,
  };
}

export function buildParticipant(input: {
  participantId: string;
  userId: string;
  displayName: string;
  role: RoomParticipant["role"];
  connectionStatus?: RoomParticipant["connectionStatus"];
  readyState?: RoomParticipant["readyState"];
  controlledTeamIds?: string[];
  now?: string;
}): RoomParticipant {
  return {
    participantId: input.participantId,
    userId: input.userId,
    displayName: input.displayName,
    connectionStatus: input.connectionStatus ?? "online",
    role: input.role,
    controlledTeamIds: input.controlledTeamIds ?? [],
    readyState: input.readyState ?? "not_ready",
    lastSeenAt: input.now ?? new Date().toISOString(),
  };
}

export function canParticipantControlTeam(state: Pick<OlyRoomState, "roomParticipants" | "teamOwnership">, participantId: string, teamId: string) {
  const participant = state.roomParticipants.find((entry) => entry.participantId === participantId);
  const ownership = state.teamOwnership.find((entry) => entry.teamId === teamId);
  return Boolean(
    participant &&
      participant.connectionStatus !== "offline" &&
      ownership?.controllerType === "human" &&
      ownership.participantId === participant.participantId,
  );
}

export type TeamWriteAction =
  | "buy"
  | "sell"
  | "lineup_save"
  | "facility_apply"
  | "xp_spend"
  | "contract_renewal"
  | "training_update"
  | "formcards"
  | "formcards_season_regenerate"
  | "lineup_ai_batch_apply"
  | "ai_preseason_background"
  | "ai_picks_run_execute"
  | "ai_market_plan_apply"
  | "ai_roster_fill_execute"
  | "ai_xp_spend_apply"
  | "matchday_resolve"
  | "season_transition"
  | "season_completion"
  | "cash_prize_apply"
  | "standings_apply"
  | "sponsor_choice"
  | "credit_borrow"
  | "credit_early_payoff"
  | "player_generator_commit"
  | "team_identity_update"
  | "team_control_update";

export type TeamWriteAuthorizationReason =
  | "ok"
  | "participant_missing"
  | "participant_offline"
  | "participant_has_no_team_ownership"
  | "team_ownership_missing"
  | "team_not_human_controlled"
  | "active_manager_team_is_ui_only"
  | "control_mode_is_not_permission";

export type TeamWriteAuthorizationResult = {
  allowed: boolean;
  reason: TeamWriteAuthorizationReason;
};

export function authorizeTeamWrite(input: {
  state: Pick<OlyRoomState, "roomParticipants" | "teamOwnership">;
  participantId?: string | null;
  teamId: string;
  action: TeamWriteAction;
  activeManagerTeamId?: string | null;
  controlMode?: TeamControllerType | "manual" | null;
}): TeamWriteAuthorizationResult {
  const participant = input.participantId
    ? input.state.roomParticipants.find((entry) => entry.participantId === input.participantId)
    : null;
  if (!participant) {
    return { allowed: false, reason: "participant_missing" };
  }
  if (participant.connectionStatus === "offline") {
    return { allowed: false, reason: "participant_offline" };
  }

  const ownership = input.state.teamOwnership.find((entry) => entry.teamId === input.teamId);
  if (!ownership) {
    return input.activeManagerTeamId === input.teamId
      ? { allowed: false, reason: "active_manager_team_is_ui_only" }
      : { allowed: false, reason: "team_ownership_missing" };
  }

  if (ownership.controllerType !== "human") {
    return input.controlMode
      ? { allowed: false, reason: "control_mode_is_not_permission" }
      : { allowed: false, reason: "team_not_human_controlled" };
  }

  if (ownership.participantId !== participant.participantId) {
    if (input.activeManagerTeamId === input.teamId) {
      return { allowed: false, reason: "active_manager_team_is_ui_only" };
    }
    return participant.controlledTeamIds.length === 0
      ? { allowed: false, reason: "participant_has_no_team_ownership" }
      : { allowed: false, reason: "team_ownership_missing" };
  }

  return { allowed: true, reason: "ok" };
}

export function buildOwnershipForPreset(
  participants: RoomParticipant[],
  preset: RoomOwnershipPreset,
  teamIds = ONLINE_ROOM_TEAM_IDS,
): TeamOwnershipRecord[] {
  const host = participants.find((entry) => entry.role === "host") ?? participants[0] ?? null;
  const franky = participants.find((entry) => /franky/i.test(entry.displayName)) ?? participants.find((entry) => entry.role === "player") ?? null;
  const hostCount = preset === "chris_1_rest_ai" ? 1 : preset === "chris_2_rest_ai" ? 2 : 4;
  const frankyCount = preset === "chris_4_franky_4_rest_ai" && franky ? 4 : 0;
  const hostTeamIds = host
    ? preset === "chris_4_franky_4_rest_ai"
      ? FOUR_PLUS_FOUR_HOST_TEAM_IDS.filter((teamId) => teamIds.includes(teamId))
      : teamIds.slice(0, hostCount)
    : [];
  const frankyTeamIds = franky
    ? preset === "chris_4_franky_4_rest_ai"
      ? FOUR_PLUS_FOUR_FRANKY_TEAM_IDS.filter((teamId) => teamIds.includes(teamId))
      : teamIds.slice(hostCount, hostCount + frankyCount)
    : [];
  const humanTeamIds = new Set([...hostTeamIds, ...frankyTeamIds]);

  return teamIds.map((teamId) => {
    if (host && hostTeamIds.includes(teamId)) {
      return {
        teamId,
        controllerType: "human",
        participantId: host.participantId,
        userId: host.userId,
        ownerDisplayName: host.displayName,
      };
    }

    if (franky && frankyTeamIds.includes(teamId)) {
      return {
        teamId,
        controllerType: "human",
        participantId: franky.participantId,
        userId: franky.userId,
        ownerDisplayName: franky.displayName,
      };
    }

    return {
      teamId,
      controllerType: humanTeamIds.has(teamId) ? "passive" : "ai",
      ownerDisplayName: humanTeamIds.has(teamId) ? "waiting_for_participant" : "AI",
    };
  });
}

export function syncParticipantControlledTeams(
  participants: RoomParticipant[],
  ownership: TeamOwnershipRecord[],
): RoomParticipant[] {
  return participants.map((participant) => ({
    ...participant,
    controlledTeamIds: ownership
      .filter((entry) => entry.controllerType === "human" && entry.participantId === participant.participantId)
      .map((entry) => entry.teamId),
  }));
}

export function buildTurnState(input: {
  roomStatus: MultiplayerRoomMeta["status"];
  currentStep?: string;
  participants: RoomParticipant[];
  ownership: TeamOwnershipRecord[];
}): MultiplayerTurnState {
  const requiredParticipants = input.participants
    .filter((participant) => participant.role !== "spectator" && participant.controlledTeamIds.length > 0)
    .map((participant) => participant.participantId);
  const readyParticipants = input.participants
    .filter((participant) => requiredParticipants.includes(participant.participantId) && participant.readyState === "ready")
    .map((participant) => participant.participantId);
  const blockingTeams = input.ownership
    .filter(
      (entry) =>
        entry.controllerType === "human" &&
        entry.participantId != null &&
        !readyParticipants.includes(entry.participantId),
    )
    .map((entry) => entry.teamId);

  return {
    currentPhase: input.roomStatus,
    currentStep: input.currentStep ?? "lobby_ready",
    requiredParticipants,
    readyParticipants,
    blockingTeams,
    canAdvance: requiredParticipants.length > 0 && requiredParticipants.every((participantId) => readyParticipants.includes(participantId)),
  };
}

export function applyOwnershipPresetToState(state: OlyRoomState, preset: RoomOwnershipPreset): OlyRoomState {
  const ownership = buildOwnershipForPreset(state.roomParticipants, preset);
  const participants = syncParticipantControlledTeams(state.roomParticipants, ownership);
  const multiplayerRoom = {
    ...state.multiplayerRoom,
    updatedAt: new Date().toISOString(),
  };

  return {
    ...state,
    multiplayerRoom,
    roomParticipants: participants,
    teamOwnership: ownership,
    systemControlledTeamIds: ownership.filter((entry) => entry.controllerType === "ai").map((entry) => entry.teamId),
    turnState: buildTurnState({
      roomStatus: multiplayerRoom.status,
      participants,
      ownership,
    }),
    roomFlowState: buildRoomFlowState({
      state: {
        multiplayerRoom,
        roomParticipants: participants,
        teamOwnership: ownership,
        systemControlledTeamIds: ownership.filter((entry) => entry.controllerType === "ai").map((entry) => entry.teamId),
        turnState: buildTurnState({
          roomStatus: multiplayerRoom.status,
          participants,
          ownership,
        }),
      },
    }),
    serverWritePolicy: SERVER_AUTHORITATIVE_WRITE_POLICY,
  };
}

export function createRoomEvent(input: {
  type: RoomRealtimeEventType;
  roomId: string;
  saveId: string;
  payload?: Record<string, unknown>;
  now?: string;
}): RoomRealtimeEvent {
  return {
    eventId: `room-event-${crypto.randomUUID()}`,
    type: input.type,
    roomId: input.roomId,
    saveId: input.saveId,
    timestamp: input.now ?? new Date().toISOString(),
    payload: input.payload,
  };
}

export function appendRoomEvent(
  state: OlyRoomState,
  type: RoomRealtimeEventType,
  payload?: Record<string, unknown>,
): OlyRoomState {
  return {
    ...state,
    roomEvents: [
      ...state.roomEvents,
      createRoomEvent({
        type,
        roomId: state.multiplayerRoom.roomId,
        saveId: state.multiplayerRoom.saveId,
        payload,
      }),
    ],
  };
}
