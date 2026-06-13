import type { CoachRole, OlyRoomState } from "@/types/game";
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

export type MoveTokenRequest = {
  roomCode: string;
  seatToken: string;
  tokenId: string;
};

export type EndTurnRequest = {
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
  setReadyState: (payload: SetReadyStateRequest) => void;
  startRoom: (payload: StartRoomRequest) => void;
  runRoomAiAutoStep: (payload: RunRoomAiAutoStepRequest) => void;
  advanceRoomFlow: (payload: AdvanceRoomFlowRequest) => void;
  authorizeRoomWrite: (payload: AuthorizeRoomWriteRequest, callback: (response: AuthorizeRoomWriteResponse) => void) => void;
  moveToken: (payload: MoveTokenRequest) => void;
  endTurn: (payload: EndTurnRequest) => void;
};

export type ServerToClientEvents = {
  roomJoined: (payload: RoomJoinedPayload) => void;
  roomState: (payload: OlyRoomState) => void;
  roomError: (payload: RoomErrorPayload) => void;
};
