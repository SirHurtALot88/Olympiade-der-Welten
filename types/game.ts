export type CoachRole = "A" | "B";

export type RoomStatus = "waiting" | "active";
export type MultiplayerRoomStatus = "lobby" | "setup" | "draft_setup" | "season_active" | "paused" | "completed";
export type RoomConnectionStatus = "online" | "offline" | "reconnecting";
export type RoomParticipantRole = "host" | "player" | "spectator";
export type RoomReadyState = "not_ready" | "ready" | "waiting";
export type TeamControllerType = "human" | "ai" | "passive";

// Auth-facing room user contract. V1 may be backed by local/mock auth, but
// write permissions must still be checked against RoomParticipant + TeamOwnership.
export type RoomUser = {
  userId: string;
  displayName: string;
  role: RoomParticipantRole;
};

export type MultiplayerRoomMeta = {
  roomId: string;
  roomCode: string;
  hostUserId: string;
  saveId: string;
  status: MultiplayerRoomStatus;
  // Back-compat alias for older local room state. New code should prefer hostUserId.
  createdByUserId: string;
  activeSeasonId: string;
  activeMatchday: number;
  createdAt: string;
  updatedAt: string;
  /**
   * Hat der Host die Team-Zuordnung schon einmal EXPLIZIT ueber eine Lobby-/Raum-Aktion gesetzt
   * (`applyRoomOwnershipPreset` oder `applyRoomTeamSelection` in `lib/room/room-store.ts`)?
   *
   * Nebenbefund (docs/MULTIPLAYER_VOLLAUSBAU_PLAN.md, "Beitritt loescht die Zuteilung des Hosts"):
   * `joinRoom` ueberschrieb die Zuteilung bislang bedingungslos mit einem Default-Preset, sobald
   * der Gast beitrat. Dieses Flag unterscheidet "der Host hat im Raum wirklich schon etwas
   * zugewiesen" von "es steht nur der System-Default aus `createInitialRoomState`" — NUR im
   * zweiten Fall darf `joinRoom` noch einen Default anwenden.
   *
   * Bewusst NICHT von `createRoom`s eigener `input.preset`-Anwendung gesetzt: zu dem Zeitpunkt
   * gibt es noch keinen zweiten Teilnehmer, jede "4+4"-Wahl waere fuer die zweite Haelfte ohnehin
   * wirkungslos (siehe Kommentar dort) — das Flag markiert erst die Lobby-Aktion NACH der Anlage.
   */
  ownershipAssignedByHost: boolean;
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
  | "finalize_transfers"
  | "lineup"
  | "formcards"
  | "formcards_season_regenerate"
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
  /**
   * Steht in dieser Saison noch ein Spieltag aus? Wird beim Weiterschalten aus dem gebundenen
   * Spielstand gesetzt (`roomFlowSeasonContinues`) und steuert am Zyklus-Ende sowohl den
   * naechsten Schritt als auch die Beschriftung des Host-Knopfes. `null` heisst "unbekannt"
   * (Spielstand nicht lesbar) — dann bleibt es beim linearen Verhalten.
   */
  seasonContinues?: boolean | null;
  warnings: string[];
};

export type RoomArenaPhaseId = "slots" | "push" | "form" | "mutator" | "captain" | "power" | "final" | "result";
export type RoomArenaStatus = "idle" | "ready_check" | "revealing" | "result" | "result_applied";

export type RoomArenaDisciplineSide = "d1" | "d2";
export type RoomArenaDisciplinePhase = "d1" | "d2" | "total";

export type RoomArenaState = {
  status: RoomArenaStatus;
  version: number;
  saveId: string;
  seasonId: string | null;
  matchdayId: string | null;
  disciplineSide: "d1" | "d2" | "overall";
  activeDisciplinePhase: RoomArenaDisciplinePhase;
  phaseId: RoomArenaPhaseId | null;
  phaseIndex: number;
  slotRevealIndex: number;
  maxSlotRevealIndex: number;
  revealedSlotCountByDiscipline: Record<RoomArenaDisciplineSide, number>;
  completedDisciplinePhases: Record<RoomArenaDisciplineSide, boolean>;
  maxSlotRevealCountByDiscipline: Record<RoomArenaDisciplineSide, number>;
  stepIndex: number;
  requiredParticipantIds: string[];
  readyParticipantIds: string[];
  autoReadyControllerTypes: TeamControllerType[];
  resultStatus: "preview" | "scored" | "applied";
  lastActionByParticipantId: string | null;
  updatedAt: string;
  callout: "arena_started" | "arena_step_ready" | null;
};

export type RoomRealtimeEventType =
  | "room_state_updated"
  | "participant_joined"
  | "participant_left"
  | "team_ready_changed"
  | "save_updated"
  | "roster_updated"
  | "transfer_completed"
  | "lineup_updated"
  | "facility_updated"
  | "training_updated"
  | "matchday_applied"
  | "standings_updated"
  | "season_advanced"
  | "ready_invalidated"
  | "flow_step_changed"
  | "arena_started"
  | "arena_ready_changed"
  | "arena_step_changed"
  | "arena_result_applied"
  | "matchday_resolved";

export type RoomRealtimeEvent = {
  eventId: string;
  type: RoomRealtimeEventType;
  roomId: string;
  saveId: string;
  timestamp: string;
  payload?: Record<string, unknown>;
};

export type ServerAuthoritativeWritePolicy = {
  clientMayWriteDirectly: false;
  serverValidatesRoomMembership: true;
  serverValidatesTeamOwnership: true;
  serverValidatesSaveAndStep: true;
  serverValidatesConfirmToken: true;
  localSandboxForbidsPrismaWrites: true;
};

export type ActionType = "room_created" | "player_joined" | "player_rejoined";

export type ActionLogEntry = {
  id: string;
  actorRole: CoachRole | "system";
  type: ActionType;
  message: string;
  createdAt: string;
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
  arenaSyncState: RoomArenaState;
  roomEvents: RoomRealtimeEvent[];
  serverWritePolicy: ServerAuthoritativeWritePolicy;
  actionLog: ActionLogEntry[];
  players: Partial<Record<CoachRole, RoomPlayerState>>;
  version: number;
};
