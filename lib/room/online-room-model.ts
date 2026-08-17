import type { RoomOwnershipPreset } from "@/types/events";
import type {
  MultiplayerRoomMeta,
  RoomRealtimeEvent,
  RoomRealtimeEventType,
  MultiplayerTurnState,
  OlyRoomState,
  RoomParticipant,
  RoomParticipantRole,
  ServerAuthoritativeWritePolicy,
  TeamControllerType,
  TeamOwnershipRecord,
} from "@/types/game";
import { buildRoomFlowState } from "@/lib/room/room-flow-controller";
import { matchesArenaScope } from "@/lib/room/arena-sync-state";
import { DEFAULT_ACTIVE_OWNER_ID, FRANKY_OWNER_ID } from "@/lib/foundation/team-control-settings";

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

/**
 * Findet den zweiten menschlichen Teilnehmer ("Franky") strukturell ueber die Sitzrolle, NICHT
 * ueber den frei editierbaren Anzeigenamen.
 *
 * VORHER stand hier an vier Stellen `/franky\/i.test(participant.displayName)` als
 * Haupterkennung (Nebenbefund, docs/MULTIPLAYER_VOLLAUSBAU_PLAN.md). Das griff daneben, sobald
 * jemand nicht "Franky" hiess — und schlimmer: der Host selbst haette "Franky" heissen und die
 * Regex damit sich SELBST statt den Gast treffen koennen, denn sie durchsucht ALLE Teilnehmer.
 * `role` dagegen ist die echte Identitaet: server-vergeben in `buildParticipant`
 * (`role: "host"`/`role: "player"`, siehe `room-store.ts` `createRoom`/`joinRoom`) und niemals
 * vom Client editierbar — genau wie `participant.userId` (die eigentliche `ownerId`), die an
 * derselben Stelle gesetzt wird. Damit ist die Erkennung von der Text-Eingabe entkoppelt.
 *
 * Rueckgabe `null`, wenn (noch) kein zweiter Teilnehmer im Raum ist — ein klar benannter
 * Rueckfall statt eines geratenen Treffers.
 */
export function resolveFrankyParticipant(participants: RoomParticipant[]): RoomParticipant | null {
  return participants.find((entry) => entry.role === "player") ?? null;
}

/**
 * Findet den eigenen Sitz im zuletzt bekannten Raum-Snapshot ueber `participantId`.
 *
 * FUND (Paket B, docs/MULTIPLAYER_SAISONWECHSEL_PLAN.md): dieselbe Suche stand vorher an zwei
 * Stellen einzeln direkt im JSX/Hook — fuer den Room-Chip
 * (app/foundation/FoundationShellRouterBody.tsx) und fuer den Host-Vorbehalt am Saisonwechsel-
 * Gate (lib/foundation/tabs/use-foundation-cross-tab-season-briefing.ts). Eine Quelle statt zwei
 * Kopien, die beim naechsten Umbau des Teilnehmer-Modells sonst auseinanderlaufen wuerden.
 *
 * `null`, wenn (noch) kein Snapshot geladen ist oder der eigene Sitz darin (noch) nicht auftaucht
 * (z. B. kurz nach dem Verbindungsaufbau) — ein klar benannter Rueckfall statt eines geratenen
 * Treffers. NUR ANZEIGE, NIE BERECHTIGUNG (siehe Kommentar an `resolveRoomParticipantActiveOwnerId`
 * unten): die eigentliche Autoritaet fuer Host-Aktionen bleibt ausschliesslich
 * `server-authoritative-write-guard.ts` (`HOST_LEVEL_ACTIONS`, `participant.role === "host"`).
 */
export function findOwnRoomParticipant(
  roomLiveState: Pick<OlyRoomState, "roomParticipants"> | null,
  participantId: string | null | undefined,
): RoomParticipant | null {
  if (!roomLiveState || !participantId) {
    return null;
  }
  return roomLiveState.roomParticipants.find((participant) => participant.participantId === participantId) ?? null;
}

/**
 * Ordnet die Sitzrolle im Raum der Owner-ID zu, die der Foundation-Client fuer Sichtbarkeit/
 * Verwaltbarkeit braucht (`teamControlSettings[teamId].ownerId`, siehe
 * lib/foundation/team-control-settings.ts) — NICHT dieselbe Groesse wie `participant.userId`.
 *
 * WARUM NICHT EINFACH `participant.userId`: ohne aktiven Login (Standard, siehe CLAUDE.md/
 * docs/MULTIPLAYER_VOLLAUSBAU_PLAN.md „Entscheidungen") ist `userId` ein zufaelliger
 * `user-<uuid>`-String je Teilnehmer (`buildParticipant`-Aufrufe in `createRoom`/`joinRoom`,
 * room-store.ts) — er stimmt mit KEINEM `ownerId`-Wert im Spielstand ueberein. Beim Spielstart
 * legt `applyChrisFrankyOwnershipToTeamControlSettings` die Teams aber IMMER auf die zwei festen
 * Platzhalter `DEFAULT_ACTIVE_OWNER_ID` (Host-Sitz) bzw. `FRANKY_OWNER_ID` (zweiter Sitz) — genau
 * die Zuordnung, die diese Funktion hier aus der Rolle ableitet.
 *
 * `role` ist serverseitig vergeben und nie vom Client frei waehlbar (siehe Kommentar an
 * `resolveFrankyParticipant` oben) — die Ableitung ist also so ehrlich wie eine Anzeige ohne
 * zusaetzliche Server-Rundreise sein kann. Sie ist trotzdem NUR eine Anzeige-Hilfe: wer sie
 * konsumiert (z. B. `activeOwnerId` im Foundation-Client), muss dokumentieren, dass sie niemals
 * als Berechtigung dient — die einzige Autoritaet bleibt das Sitz-Token
 * (`authorizeServerRoomWrite`/`authorizeTeamWrite`).
 *
 * `null` fuer Zuschauer (`"spectator"`) — die haben keine feste Owner-Spalte.
 */
export function resolveRoomParticipantActiveOwnerId(role: RoomParticipantRole): string | null {
  if (role === "host") {
    return DEFAULT_ACTIVE_OWNER_ID;
  }
  if (role === "player") {
    return FRANKY_OWNER_ID;
  }
  return null;
}

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
    // Siehe Kommentar am Feld (types/game.ts): erst eine explizite Lobby-Aktion setzt das auf
    // true, nicht diese Erst-Anlage.
    ownershipAssignedByHost: false,
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
  | "team_control_update"
  | "team_captain_assign"
  | "new_game_flow_step"
  | "contract_negotiation_outcome"
  /**
   * Vertragsaufloesung annehmen/ablehnen. Eigene Aktion statt
   * `contract_negotiation_outcome`: eine Aufloesung beendet einen Vertrag und kostet eine
   * Abfindung, eine Verhandlung verlaengert ihn — im Raum-Protokoll dieselbe Marke zu
   * verwenden hiesse, dem Mitspieler das Falsche zu melden.
   *
   * Team-Ebene, NICHT host-level: die Entscheidung gehoert dem Team, dessen Spieler geht.
   */
  | "contract_dissolution";

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
  const franky = resolveFrankyParticipant(participants);
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

export const MAX_TEAMS_PER_HUMAN_PARTICIPANT = 4;

export type ExplicitTeamSelectionInput = {
  chrisTeamIds: string[];
  frankyTeamIds: string[];
};

export type ExplicitTeamOwnershipValidationReason =
  | "unknown_team_id"
  | "team_assigned_twice"
  | "too_many_teams_for_participant";

export type ExplicitTeamOwnershipValidationResult =
  | { ok: true; ownership: TeamOwnershipRecord[] }
  | { ok: false; reason: ExplicitTeamOwnershipValidationReason; message: string };

/**
 * Builds an explicit team-ownership map from host-chosen team-id lists, mirroring
 * buildOwnershipForPreset's output shape (host = Chris, second joined participant = Franky,
 * everything else stays AI). Unlike the preset builder this does not pick teams for the
 * host - the host names the exact team ids he and Franky want to play.
 */
export function buildExplicitTeamOwnership(
  participants: RoomParticipant[],
  selection: ExplicitTeamSelectionInput,
  teamIds = ONLINE_ROOM_TEAM_IDS,
): ExplicitTeamOwnershipValidationResult {
  const host = participants.find((entry) => entry.role === "host") ?? participants[0] ?? null;
  const franky = resolveFrankyParticipant(participants);

  const chrisTeamIds = Array.from(new Set(selection.chrisTeamIds ?? []));
  // Without a joined second human participant there is nobody to own Franky's teams yet -
  // they simply stay AI-controlled until Franky joins and the host re-assigns.
  const frankyTeamIds = franky ? Array.from(new Set(selection.frankyTeamIds ?? [])) : [];

  const teamIdSet = new Set(teamIds);
  const unknownTeamId = [...chrisTeamIds, ...frankyTeamIds].find((teamId) => !teamIdSet.has(teamId));
  if (unknownTeamId) {
    return { ok: false, reason: "unknown_team_id", message: `Unbekanntes Team: ${unknownTeamId}.` };
  }

  const overlap = chrisTeamIds.find((teamId) => frankyTeamIds.includes(teamId));
  if (overlap) {
    return {
      ok: false,
      reason: "team_assigned_twice",
      message: `Team ${overlap} kann nicht gleichzeitig zwei Mitspielern zugewiesen werden.`,
    };
  }

  if (chrisTeamIds.length > MAX_TEAMS_PER_HUMAN_PARTICIPANT) {
    return {
      ok: false,
      reason: "too_many_teams_for_participant",
      message: `${host?.displayName ?? "Chris"} kann maximal ${MAX_TEAMS_PER_HUMAN_PARTICIPANT} Teams uebernehmen.`,
    };
  }
  if (frankyTeamIds.length > MAX_TEAMS_PER_HUMAN_PARTICIPANT) {
    return {
      ok: false,
      reason: "too_many_teams_for_participant",
      message: `${franky?.displayName ?? "Franky"} kann maximal ${MAX_TEAMS_PER_HUMAN_PARTICIPANT} Teams uebernehmen.`,
    };
  }

  const humanTeamIds = new Set([...chrisTeamIds, ...frankyTeamIds]);

  const ownership: TeamOwnershipRecord[] = teamIds.map((teamId) => {
    if (host && chrisTeamIds.includes(teamId)) {
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

  return { ok: true, ownership };
}

export function applyExplicitTeamOwnershipToState(
  state: OlyRoomState,
  selection: ExplicitTeamSelectionInput,
): { ok: true; state: OlyRoomState } | { ok: false; reason: ExplicitTeamOwnershipValidationReason; message: string } {
  const validated = buildExplicitTeamOwnership(state.roomParticipants, selection);
  if (!validated.ok) {
    return validated;
  }

  const ownership = validated.ownership;
  const participants = syncParticipantControlledTeams(state.roomParticipants, ownership);
  const multiplayerRoom = {
    ...state.multiplayerRoom,
    updatedAt: new Date().toISOString(),
  };

  const nextState: OlyRoomState = {
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

  return { ok: true, state: nextState };
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

/**
 * Steps im Spieltag-Zyklus, in denen gerade eine Einsatzliste/Formkarte gebaut wird oder eine
 * Enthuellung laeuft. Team-Zuordnung waehrenddessen umzuhaengen wuerde eine halb gespeicherte
 * Aufstellung verwaisen lassen — genau das Risiko, das die Entscheidung in
 * docs/MULTIPLAYER_VOLLAUSBAU_PLAN.md ("Team-Zuordnung mitten in der Saison aendern?") benennt.
 *
 * "standings" gehoert bewusst NICHT dazu: der Spieltag ist zu dem Zeitpunkt bereits aufgeloest
 * (das Ergebnis steht), es ist reine Rueckschau vor dem naechsten Zyklus — also schon "zwischen
 * zwei Spieltagen". Die Vorsaison-Schritte (`sell_players` .. `finalize_transfers`) laufen genau
 * einmal VOR dem ersten Spieltag (siehe Kommentar an `ROOM_FLOW_MATCHDAY_CYCLE_START` in
 * room-flow-controller.ts) und zaehlen aus demselben Grund nicht als "laufender Spieltag".
 */
const ROOM_FLOW_STEPS_WITH_ACTIVE_MATCHDAY = new Set<string>(["lineup", "formcards", "formcards_season_regenerate", "arena", "result"]);

/**
 * Laeuft im Raum gerade ein Spieltag (Aufstellung/Formkarten/Arena/Ergebnis) oder eine
 * Enthuellung? Massgeblich fuer die Sperre "Team-Zuordnung nur zwischen Spieltagen" (Stufe 1.3,
 * docs/MULTIPLAYER_VOLLAUSBAU_PLAN.md).
 *
 * Zwei unabhaengige Signale, beide gepflegt in room-store.ts (`syncPlayers`/`advanceRoomArenaStep`
 * etc.):
 *   - `roomFlowState.step`: welcher Schritt des 12-Stufen-Flows gerade aktiv ist.
 *   - `arenaSyncState.status`: ob die Arena-Enthuellung fuer den AKTUELLEN Spieltag laeuft oder
 *     ihr Ergebnis noch nicht zurueckgesetzt ist ("idle" ist der einzige sichere Zustand).
 * Beide muessen geprueft werden: der Flow-Schritt kann schon auf "result" stehen, waehrend die
 * Arena technisch noch "revealing" ist (der Host hat den letzten Schritt gesendet, der Broadcast
 * mit dem neuen `roomFlowState.step` ist aber noch unterwegs) — ein Schreibvorgang, der nur eines
 * der beiden Felder prueft, haette in genau diesem schmalen Fenster ein falsches "frei".
 *
 * BEFUND B1 (docs/MULTIPLAYER_VOLLAUSBAU_PLAN.md): `arenaSyncState.status` wird beim Anwenden
 * eines Spieltags auf `result_applied` gesetzt und NIE wieder auf `idle` zurueckgesetzt (Kommentar
 * an `matchesArenaScope`, arena-sync-state.ts) — ein `status !== "idle"`-Vergleich allein waere
 * damit ab dem ERSTEN Spieltag fuer den Rest des Raums permanent wahr, und die in Stufe 1.3 gebaute
 * "zwischen zwei Spieltagen erlaubt"-Umverteilung koennte nie mehr greifen. Der Fix: `status !==
 * "idle"` zaehlt nur noch, wenn der Sync-State auch zum AKTUELLEN Spieltag gehoert
 * (`matchesArenaScope`, dieselbe Pruefung, die den Host-Arena-Start-Guard schon vor demselben
 * Fehler bewahrt) — ein laengst abgeschlossener State eines VORIGEN Spieltags (anderes
 * `matchdayId`, `advanceRoomFlow` in room-store.ts erhoeht `activeMatchday` beim Weiterziehen)
 * gehoert nicht mehr zum aktuellen Spieltag und sperrt die Umverteilung folglich nicht mehr.
 */
export function isRoomMatchdayInProgress(
  state: Pick<OlyRoomState, "roomFlowState" | "arenaSyncState" | "multiplayerRoom">,
): boolean {
  if (ROOM_FLOW_STEPS_WITH_ACTIVE_MATCHDAY.has(state.roomFlowState.step)) {
    return true;
  }
  if (state.arenaSyncState.status === "idle") {
    return false;
  }
  return matchesArenaScope(state.arenaSyncState, {
    saveId: state.multiplayerRoom.saveId,
    seasonId: state.multiplayerRoom.activeSeasonId,
    matchdayId: String(state.multiplayerRoom.activeMatchday),
  });
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
