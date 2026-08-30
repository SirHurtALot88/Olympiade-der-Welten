// EINZIGER Import in dieser Datei, und bewusst nur ein Typ-Import: `PlayMode` gehoert zum
// Spielstand (lib/data/olyDataTypes.ts) und wird hier nur MITGEFUEHRT (siehe
// `MultiplayerRoomMeta.playMode`). Eine zweite Definition waere die zweite Quelle, aus der die zwei
// Welten spaeter auseinanderlaufen. Kein Ring: `olyDataTypes.ts` importiert nichts aus types/game.ts.
import type { PlayMode } from "@/lib/data/olyDataTypes";

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

/**
 * Die sechs Modi, mit denen ein Raum angelegt werden kann.
 *
 * PAKET 2 (docs/MULTIPLAYER_MODI_1V1_2V2_PLAN.md): frueher standen hier nur vier Werte -- fuer zu
 * zweit gab es ausschliesslich `chris_4_franky_4_rest_ai`. `chris_1_franky_1_rest_ai` und
 * `chris_2_franky_2_rest_ai` sind dazugekommen, weil Chris ausdruecklich auch 1+1 und 2+2 wollte
 * (docs/MULTIPLAYER_MODI_1V1_2V2_PLAN.md, Kopfzeile). Ihre Team-IDs sind KEINE neue Liste (E5): sie
 * sind die ersten n aus `FOUR_PLUS_FOUR_HOST_TEAM_IDS`/`..._FRANKY_TEAM_IDS`
 * (lib/room/online-room-model.ts), siehe `PRESET_OWNERSHIP_TABLE` dort.
 *
 * STEHT HIER UND NICHT IN types/events.ts, obwohl er dort erklaert wurde: `MultiplayerRoomMeta`
 * (unten) fuehrt ihn seit Aufgabe #49 mit, und `types/events.ts` importiert bereits aus dieser
 * Datei — die Gegenrichtung waere ein Ring. `events.ts` reicht ihn unveraendert weiter, damit alle
 * bestehenden Importe gelten und es weiterhin genau EINE Definition gibt.
 */
export type RoomOwnershipPreset =
  | "chris_1_rest_ai"
  | "chris_2_rest_ai"
  | "chris_4_rest_ai"
  | "chris_4_franky_4_rest_ai"
  | "chris_1_franky_1_rest_ai"
  | "chris_2_franky_2_rest_ai";

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
  /**
   * Mit welchem Modus wurde dieser Raum ANGELEGT (`createRoom(..., { preset })`)?
   *
   * WOZU, und warum es nicht ohne geht (Aufgabe #49): der Beitritt ist die EINZIGE Stelle, an der
   * der zweite Sitz ueberhaupt Teams bekommt — beim Anlegen ist er noch nicht da, und
   * `buildExplicitTeamOwnership` laesst die Teams eines abwesenden Teilnehmers bewusst offen. Beim
   * Beitritt muss deshalb noch einmal verteilt werden, und dafuer braucht es die Wahl des Hosts
   * von vorhin. Ohne dieses Feld war sie zu dem Zeitpunkt verloren, und es blieb nur ein fest
   * verdrahteter 4+4-Vorschlag.
   *
   * ABGRENZUNG ZU `ownershipAssignedByHost`: jenes Flag heisst "der Host hat IM RAUM aktiv
   * zugeteilt" und friert die Zuordnung ein. Ein Preset beim Anlegen darf das NICHT tun — sonst
   * ueberspringt `joinRoom` die Verteilung, und der Gast bekommt nie Teams (nachgemessen, siehe
   * den Kommentar an `joinRoom`). Es ist eine gemerkte Absicht, keine erledigte Zuteilung.
   *
   * `null` fuer Raeume, die ohne Preset angelegt wurden — und fuer alle Raeume, die vor diesem
   * Feld entstanden sind und aus der Ablage zurueckkommen.
   */
  createdWithPreset?: RoomOwnershipPreset | null;
  /**
   * SPIELART des Spielstands, an dem dieser Raum haengt — "management" (Vorgabe, wenn das Feld
   * fehlt) oder "battle". NICHT ZU VERWECHSELN MIT `createdWithPreset`: jenes sagt, WER wie viele
   * Teams fuehrt, dieses sagt, WELCHE Teams es ueberhaupt gibt (32 gegen 16). Beides steht
   * senkrecht zueinander — ein Battle-Raum kann 1v1 wie 4v4 sein.
   *
   * WOZU IM RAUM UND NICHT ERST IM SPIELSTAND: die Team-Zuteilung passiert in der LOBBY, lange
   * bevor `startRoom` den Koop-Save anlegt. Ohne diese Angabe verteilt die Lobby aus den 32
   * Management-Teams, und der Host bekaeme im 1v1-Battle-Raum `P-S` zugewiesen — ein Team, das im
   * spaeter entstehenden Battle-Save gar nicht existiert.
   *
   * Optional/`undefined` fuer Rueckwaertskompatibilitaet: jeder vor diesem Feld angelegte Raum aus
   * der Ablage verhaelt sich unveraendert wie ein Management-Raum.
   */
  playMode?: PlayMode | null;
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
  | "season_review"
  | "season_transition";

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
  /**
   * Bereit-pflichtige Teilnehmer, die weder bereit noch verbunden sind.
   *
   * Sie halten `canHostAdvance` auf (Entscheidung von Chris: ein Getrennter faellt nicht aus der
   * Pflicht) — und sie sind die EINZIGEN, die der Host mit dem Notausgang uebergehen darf. Als
   * eigenes Feld und nicht als abgeleitete Rechnung im Client, damit Knopf und Server-Pruefung
   * dieselbe Liste lesen.
   */
  offlineBlockingParticipantIds: string[];
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
  /**
   * Gemeinsame Zeitbasis (Befund B4, Stufe 3.3): Server-Zeitpunkt (ISO), zu dem der AKTUELLE
   * Schritt (`stepIndex`) begann — gesetzt bei jedem Weiterschalten/Start/Reset. Ohne dieses Feld
   * kannte `RoomArenaState` nur `updatedAt` ("wann kam die letzte Aenderung an"), nicht "wann
   * begann dieser Schritt fuer alle gleichermassen" — zwei Clients mit unterschiedlicher
   * Systemuhr rechneten deshalb ab ihrem eigenen Empfangszeitpunkt statt ab einem gemeinsamen
   * Nullpunkt. Siehe `lib/foundation/discipline-stage/arena-timeline.ts` (`resolveArenaDisplayState`).
   */
  stepStartedAt: string;
  /**
   * Geplante Dauer des aktuellen Schritts in ms — zusammen mit `stepStartedAt` die Grundlage fuer
   * "verstrichene Zeit seit Schrittbeginn" auf JEDEM Client gleich (Stufe 3.3/3.4).
   */
  stepDurationMs: number;
  /**
   * Pause/Weiter als geteilter Zustand (Stufe 3.6): pausiert der Host, gilt das fuer beide Seiten
   * (vorher rein lokal in `manualPauseRef`/`pauseRef` der Komponente — der Gast bemerkte eine
   * Host-Pause nur indirekt daran, dass keine neuen Schritte mehr kamen, nie explizit als Zustand).
   */
  paused: boolean;
  /** Wer zuletzt pausiert/fortgesetzt hat (`null`, solange nicht pausiert). */
  pausedBy: string | null;
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
