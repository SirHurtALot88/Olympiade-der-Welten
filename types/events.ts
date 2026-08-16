import type { CoachRole, OlyRoomState, RoomRealtimeEvent } from "@/types/game";
import type { TeamWriteAction } from "@/lib/room/online-room-model";

export type RoomOwnershipPreset =
  | "chris_1_rest_ai"
  | "chris_2_rest_ai"
  | "chris_4_rest_ai"
  | "chris_4_franky_4_rest_ai";

export type CreateRoomRequest = {
  displayName?: string;
  saveId?: string;
  preset?: RoomOwnershipPreset;
};

export type JoinRoomRequest = {
  roomCode: string;
  displayName?: string;
};

export type RejoinRoomRequest = {
  roomCode: string;
  seatToken: string;
};

export type RoomJoinedPayload = {
  roomCode: string;
  role: CoachRole;
  participantId: string;
  userId: string;
  seatToken: string;
  state: OlyRoomState;
};

export type ApplyRoomPresetRequest = {
  roomCode: string;
  seatToken: string;
  preset: RoomOwnershipPreset;
};

export type SetTeamSelectionRequest = {
  roomCode: string;
  seatToken: string;
  chrisTeamIds: string[];
  frankyTeamIds: string[];
};

export type SetReadyStateRequest = {
  roomCode: string;
  seatToken: string;
  ready: boolean;
};

export type StartRoomRequest = {
  roomCode: string;
  seatToken: string;
};

export type RunRoomAiAutoStepRequest = {
  roomCode: string;
  seatToken: string;
};

export type AdvanceRoomFlowRequest = {
  roomCode: string;
  seatToken: string;
};

export type StartRoomArenaRequest = {
  roomCode: string;
  seatToken: string;
  seasonId?: string | null;
  matchdayId?: string | null;
  disciplineSide?: "d1" | "d2" | "overall" | null;
  maxSlotRevealIndex?: number | null;
  maxSlotRevealCountByDiscipline?: { d1: number; d2: number } | null;
};

export type SetRoomArenaReadyRequest = {
  roomCode: string;
  seatToken: string;
  ready: boolean;
};

export type AdvanceRoomArenaStepRequest = {
  roomCode: string;
  seatToken: string;
  maxSlotRevealIndex?: number | null;
  maxSlotRevealCountByDiscipline?: { d1: number; d2: number } | null;
  force?: boolean | null;
};

// Stufe 3.6 (docs/MULTIPLAYER_VOLLAUSBAU_PLAN.md): letzte Meile fuer die drei Host-Aktionen, die
// `lib/room/arena-sync-state.ts` bereits fertig und getestet bereitstellt
// (`setRoomArenaPaused`/`resetRoomArenaReveal`/`quickSimRoomArenaReveal`) — bislang gab es keinen
// Weg vom Browser dorthin.
export type SetRoomArenaPausedRequest = {
  roomCode: string;
  seatToken: string;
  paused: boolean;
};

export type ResetRoomArenaRevealRequest = {
  roomCode: string;
  seatToken: string;
};

export type QuickSimRoomArenaRevealRequest = {
  roomCode: string;
  seatToken: string;
  maxSlotRevealCountByDiscipline?: { d1: number; d2: number } | null;
};

export type RoomErrorPayload = {
  roomCode?: string;
  message: string;
};

export type AuthorizeRoomWriteRequest = {
  roomCode: string;
  participantId?: string | null;
  seatToken?: string | null;
  userId?: string | null;
  saveId: string;
  teamId?: string | null;
  writeAction: TeamWriteAction;
  dryRun?: boolean;
  confirmToken?: string | null;
  expectedConfirmToken?: string | null;
};

export type AuthorizeRoomWriteResponse = {
  success: boolean;
  authorization:
    | {
        allowed: true;
        participantId: string | null;
        teamId: string | null;
        warnings: string[];
      }
    | {
        allowed: false;
        code: "forbidden_team_control" | "not_room_participant" | "wrong_phase" | "stale_save_version";
        reason: string;
        status: number;
        warnings: string[];
      };
};

export type ClientToServerEvents = {
  createRoom: (payload: CreateRoomRequest) => void;
  joinRoom: (payload: JoinRoomRequest) => void;
  rejoinRoom: (payload: RejoinRoomRequest) => void;
  applyRoomPreset: (payload: ApplyRoomPresetRequest) => void;
  setTeamSelection: (payload: SetTeamSelectionRequest) => void;
  setReadyState: (payload: SetReadyStateRequest) => void;
  startRoom: (payload: StartRoomRequest) => void;
  runRoomAiAutoStep: (payload: RunRoomAiAutoStepRequest) => void;
  advanceRoomFlow: (payload: AdvanceRoomFlowRequest) => void;
  startRoomArena: (payload: StartRoomArenaRequest) => void;
  setRoomArenaReady: (payload: SetRoomArenaReadyRequest) => void;
  advanceRoomArenaStep: (payload: AdvanceRoomArenaStepRequest) => void;
  setRoomArenaPaused: (payload: SetRoomArenaPausedRequest) => void;
  resetRoomArenaReveal: (payload: ResetRoomArenaRevealRequest) => void;
  quickSimRoomArenaReveal: (payload: QuickSimRoomArenaRevealRequest) => void;
  authorizeRoomWrite: (payload: AuthorizeRoomWriteRequest, callback: (response: AuthorizeRoomWriteResponse) => void) => void;
};

export type ServerToClientEvents = {
  roomJoined: (payload: RoomJoinedPayload) => void;
  roomState: (payload: OlyRoomState) => void;
  roomGameplayEvent: (payload: RoomRealtimeEvent) => void;
  roomError: (payload: RoomErrorPayload) => void;
};
