import type { GameState } from "@/lib/data/olyDataTypes";
import { evaluateGamePhaseAction } from "@/lib/foundation/game-phase-action-policy";
import type { FoundationViewId } from "@/lib/foundation/foundation-view-routing";
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
  | "trainingV2"
  | "lineup"
  | "matchdayArena"
  | "season"
  | "cockpit";

/**
 * Welches Socket-Event der Host-/Weiter-Knopf auslösen muss.
 *
 * Frueher entschied `RoomPageClient` das per String-Vergleich auf `label` (z.B.
 * `roomFlowButton.label === "AI Teams vorbereiten"`) — brach lautlos, sobald jemand nur die
 * Beschriftung aenderte. Die Aktion ist jetzt ein eigenes, von `label` unabhaengiges Feld:
 * `describeRoomFlowButton` setzt es explizit in jedem Rueckgabe-Zweig, Aufrufer schalten nur
 * noch darauf.
 */
export type RoomFlowButtonAction = "set_ready" | "run_ai_auto_step" | "start_room" | "advance_flow" | "none";

/**
 * `RoomFlowView` (Room-Flow-Domäne) und `FoundationViewId` (Shell-Routing) sind zwei
 * unabhaengige Typen, die zufaellig teilweise gleich benannte Werte haben. Diese Map macht die
 * Entsprechung explizit und typsicher: `Record<RoomFlowView, FoundationViewId>` erzwingt einen
 * Eintrag pro `RoomFlowView`-Variante — ein neuer, nicht gemappter Wert bricht den Build statt
 * zur Laufzeit still auf `undefined`/eine falsche View zu verpuffen.
 *
 * Die Ziele folgen bewusst `normalizeFoundationViewParam` (Legacy-View-Aliasing): "market" →
 * "marketV2", "season" → "seasonV2", "training" → "trainingCompact" — exakt das Ziel, das ein
 * `?view=`-Query-Param mit demselben Rohwert heute schon aufloest (siehe `buildFoundationHref`
 * in `RoomPageClient.tsx`), damit Auto-Navigation und manueller Deep-Link nie auseinanderlaufen.
 */
const ROOM_FLOW_VIEW_TO_FOUNDATION_VIEW: Record<RoomFlowView, FoundationViewId> = {
  teams: "teams",
  market: "marketV2",
  training: "trainingCompact",
  trainingV2: "trainingV2",
  lineup: "lineup",
  matchdayArena: "matchdayArena",
  season: "seasonV2",
  cockpit: "cockpit",
};

export function mapRoomFlowViewToFoundationViewId(view: RoomFlowView): FoundationViewId {
  return ROOM_FLOW_VIEW_TO_FOUNDATION_VIEW[view];
}

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
  { stepId: "facilities", label: "Facilities entscheiden", cta: "Weiter: Training & Gebäude", targetView: "trainingV2", aiAutoStep: true },
  // XP-System abgeschafft: Room-Flow-Step "xp_spend" ("XP verteilen") entfernt.
  // Die Entwicklung läuft organisch am Saison-Ende; der Flow geht von Facilities
  // direkt zu "training". Der Step-Literal-Typ (online-room-model TeamWriteAction /
  // RoomFlowStepId) bleibt für Alt-Reads bestehen, wird aber nicht mehr erzeugt.
  { stepId: "training", label: "Training prüfen", cta: "Weiter: Training prüfen", targetView: "trainingV2", aiAutoStep: true },
  { stepId: "finalize_transfers", label: "Transfers finalisieren", cta: "Transfers finalisieren", targetView: "cockpit", aiAutoStep: true },
  { stepId: "lineup", label: "Einsatzliste setzen", cta: "Weiter: Einsatzliste", targetView: "lineup", aiAutoStep: true },
  { stepId: "formcards", label: "Formkarten setzen", cta: "Weiter: Formkarten", targetView: "lineup", aiAutoStep: true },
  { stepId: "arena", label: "Arena starten", cta: "Arena starten", targetView: "matchdayArena", aiAutoStep: false },
  { stepId: "result", label: "Spieltagsergebnis ansehen", cta: "Spieltagsergebnis ansehen", targetView: "matchdayArena", aiAutoStep: false },
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
  /** Welches Socket-Event ein Klick sendet — siehe Kommentar bei `RoomFlowButtonAction`. */
  action: RoomFlowButtonAction;
};

function uniq(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => typeof value === "string" && value.trim().length > 0)));
}

export function getRoomFlowStep(stepId: string): RoomFlowStepDefinition {
  return ROOM_FLOW_STEPS.find((entry) => entry.stepId === stepId) ?? ROOM_FLOW_STEPS[0]!;
}

/**
 * Erster Schritt des Spieltag-Zyklus.
 *
 * Alles DAVOR laeuft genau einmal pro Saison, und das ist keine Designwahl an dieser Stelle,
 * sondern folgt den Gates, die das Spiel ohnehin durchsetzt:
 * `sell_players`/`buy_players`/`facilities` sind in `evaluateGamePhaseAction` an die
 * Vorsaison-Phasen gebunden — die Routen antworten ab Spieltag 2 mit 409. Und
 * `finalize_transfers` erzeugt den Formkarten-Pool, den es pro Saison nur einmal gibt
 * (`activeTeamTransfersFinalized` ist buchstaeblich `activeTeamHasFormCardPool`).
 *
 * Wiederholbar sind damit genau: Einsatzliste, Formkarten (der PLAN ist pro Spieltag,
 * s. `activeTeamHasFormCardPlanSelections`), Arena, Ergebnis, Saisonstand.
 */
export const ROOM_FLOW_MATCHDAY_CYCLE_START = "lineup" satisfies RoomFlowStepId;

/** Letzter Schritt des Zyklus — von hier geht es zurueck an den Anfang oder ins Season Review. */
export const ROOM_FLOW_MATCHDAY_CYCLE_END = "standings" satisfies RoomFlowStepId;

/**
 * Steht in dieser Saison noch ein Spieltag aus?
 *
 * Bewusst KEINE eigene Spieltagsrechnung (`currentMatchday < totalMatchdays`), sondern
 * dieselbe Regel, die das Spiel ohnehin durchsetzt: `resolve_matchday` ist erlaubt, solange
 * die Saison laeuft. `advanceMatchday` setzt `gamePhase` nach dem letzten Spieltag auf
 * "season_completed" (`lib/season/matchday-progress-service.ts`), womit dieser Gate zumacht.
 * Eine eigene Formel muesste bei jeder Aenderung der Phasenlogik nachgezogen werden — und
 * wuerde es beim ersten Mal nicht.
 */
export function roomFlowSeasonContinues(gameState: GameState): boolean {
  return evaluateGamePhaseAction(gameState, "resolve_matchday").allowed;
}

/**
 * Der naechste Schritt im Room-Flow.
 *
 * `seasonContinues` ist optional, weil die Kette ausserhalb des Zyklus-Endes gar nicht davon
 * abhaengt. FEHLT es am Zyklus-Ende, bleibt es beim alten linearen Verhalten (Sackgasse im
 * Season Review) — das ist der sichere Rueckfall fuer einen Aufrufer, der den Spielstand
 * nicht aufloesen kann, und ausdruecklich nicht die Normalannahme.
 */
export function getNextRoomFlowStepId(stepId: string, input?: { seasonContinues: boolean }): RoomFlowStepId {
  if (stepId === ROOM_FLOW_MATCHDAY_CYCLE_END) {
    return input?.seasonContinues ? ROOM_FLOW_MATCHDAY_CYCLE_START : "season_review";
  }
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
  /** Aus dem Spielstand; `undefined`, wenn der Aufrufer ihn nicht aufloesen konnte. */
  seasonContinues?: boolean | null;
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
    seasonContinues: input.seasonContinues ?? null,
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
      action: "none",
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
      action: "set_ready",
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
      action: "run_ai_auto_step",
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
      action: "none",
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
      action: "none",
    };
  }

  return {
    label: describeAdvanceCta(stepDefinition, flow),
    status: "ready",
    targetView: stepDefinition.targetView,
    activeTeamId: ownedTeamId,
    canClick: true,
    isHostAction: true,
    warnings: flow.warnings,
    // Im Lobby-Status bindet/erzeugt der Weiter-Knopf noch den Save (`startRoom`); danach ist
    // es der normale Flow-Vorschub (`advanceRoomFlow`). Diese Fallunterscheidung gehoert hier in
    // den Controller, der `multiplayerRoom.status` ohnehin schon kennt — nicht mehr an den
    // Aufrufer, der dafuer frueher denselben Status ein zweites Mal auswerten musste.
    action: input.state.multiplayerRoom.status === "lobby" ? "start_room" : "advance_flow",
  };
}

/**
 * Die Beschriftung des Weiter-Knopfes benennt, WOHIN es geht — so sind alle CTAs gebaut
 * ("Weiter: Transfermarkt" auf dem Verkaufs-Schritt). Am Zyklus-Ende gibt es dafuer zwei
 * Ziele, und "Saisonstand ansehen" waere in beiden Faellen falsch: es beschreibt den Schritt,
 * auf dem man schon steht.
 *
 * Ist unbekannt, ob die Saison weiterlaeuft (`seasonContinues == null`, Spielstand nicht
 * lesbar), bleibt der alte Text stehen statt eines geratenen Ziels.
 */
function describeAdvanceCta(stepDefinition: RoomFlowStepDefinition, flow: RoomFlowState): string {
  if (stepDefinition.stepId !== ROOM_FLOW_MATCHDAY_CYCLE_END || flow.seasonContinues == null) {
    return stepDefinition.cta;
  }
  return flow.seasonContinues
    ? `Weiter: Spieltag ${Math.max(1, flow.activeMatchday)}`
    : "Weiter: Season Review";
}
