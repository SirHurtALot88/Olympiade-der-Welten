export type CoachRole = "A" | "B";

export type RoomStatus = "waiting" | "active";
export type MultiplayerRoomStatus = "lobby" | "draft_setup" | "season_active" | "paused" | "completed";
export type RoomConnectionStatus = "online" | "offline" | "reconnecting";
export type RoomParticipantRole = "host" | "player" | "spectator";
export type RoomReadyState = "not_ready" | "ready" | "waiting";
export type TeamControllerType = "human" | "ai" | "passive";

export type MultiplayerRoomMeta = {
  roomId: string;
  roomCode: string;
  saveId: string;
  status: MultiplayerRoomStatus;
  createdByUserId: string;
  activeSeasonId: string;
  activeMatchday: number;
  createdAt: string;
  updatedAt: string;
};

// A room participant is a real connected browser/user session in an online room.
// It is not the same as the local Foundation UI focus.
export type RoomParticipant = {
  participantId: string;
  userId: string;
  displayName: string;
  connectionStatus: RoomConnectionStatus;
  role: RoomParticipantRole;
  controlledTeamIds: string[];
  readyState: RoomReadyState;
  lastSeenAt: string;
};

// Server-authoritative multiplayer ownership. This is the layer that decides
// whether a participant may write for a team in an online room.
// Do not infer write permissions from activeManagerTeamId or teamControlSettings.
export type TeamOwnershipRecord = {
  teamId: string;
  controllerType: TeamControllerType;
  participantId?: string;
  userId?: string;
  ownerDisplayName?: string;
};

export type MultiplayerTurnState = {
  currentPhase: MultiplayerRoomStatus | string;
  currentStep: string;
  requiredParticipants: string[];
  readyParticipants: string[];
  blockingTeams: string[];
  canAdvance: boolean;
};

export type RoomFlowStepId =
  | "lobby_ready"
  | "sell_players"
  | "buy_players"
  | "facilities"
  | "xp_spend"
  | "training"
  | "lineup"
  | "formcards"
  | "arena"
  | "result"
  | "standings"
  | "season_review";

export type RoomFlowButtonStatus =
  | "ready"
  | "blocked"
  | "waiting_for_player"
  | "applying"
  | "host_only"
  | "sandbox_override_available";

export type RoomFlowState = {
  roomId: string;
  saveId: string;
  activeSeasonId: string;
  activeMatchday: number;
  phase: MultiplayerRoomStatus | string;
  step: RoomFlowStepId | string;
  requiredParticipantIds: string[];
  completedParticipantIds: string[];
  blockingTeamIds: string[];
  aiAutoCompletedTeamIds: string[];
  canHostAdvance: boolean;
  warnings: string[];
};

export type ServerAuthoritativeWritePolicy = {
  clientMayWriteDirectly: false;
  serverValidatesRoomMembership: true;
  serverValidatesTeamOwnership: true;
  serverValidatesSaveAndStep: true;
  serverValidatesConfirmToken: true;
  localSandboxForbidsPrismaWrites: true;
};

export type ActionType = "room_created" | "player_joined" | "moveToken" | "endTurn" | "player_rejoined";

export type AthleteToken = {
  id: string;
  ownerRole: CoachRole;
  position: number;
  label: string;
};

export type ActionLogEntry = {
  id: string;
  turnNumber: number;
  actorRole: CoachRole | "system";
  type: ActionType;
  tokenId?: string;
  from?: number;
  to?: number;
  message: string;
  createdAt: string;
};

export type BoardDefinition = {
  laneLength: number;
  laneLabel: string;
};

export type RoomPlayerState = {
  role: CoachRole;
  connected: boolean;
  joinedAt: string;
};

export type OlyRoomState = {
  roomCode: string;
  status: RoomStatus;
  multiplayerRoom: MultiplayerRoomMeta;
  roomParticipants: RoomParticipant[];
  teamOwnership: TeamOwnershipRecord[];
  systemControlledTeamIds: string[];
  turnState: MultiplayerTurnState;
  roomFlowState: RoomFlowState;
  serverWritePolicy: ServerAuthoritativeWritePolicy;
  activeRole: CoachRole;
  turnNumber: number;
  tokens: AthleteToken[];
  actionLog: ActionLogEntry[];
  players: Partial<Record<CoachRole, RoomPlayerState>>;
  moveCommittedThisTurn: boolean;
  board: BoardDefinition;
  version: number;
};
