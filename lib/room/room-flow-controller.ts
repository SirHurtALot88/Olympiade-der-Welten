import type { GameState } from "@/lib/data/olyDataTypes";
import { evaluateGamePhaseAction } from "@/lib/foundation/game-phase-action-policy";
import type { FoundationViewId } from "@/lib/foundation/foundation-view-routing";
import type {
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
  { stepId: "season_review", label: "Season Review", cta: "Weiter: Saisonwechsel", targetView: "cockpit", aiAutoStep: false },
  // Ready-Gate + Wegweiser fuer den Saisonwechsel (Paket A,
  // docs/MULTIPLAYER_SAISONWECHSEL_PLAN.md E1) -- KEIN zweiter Assistent. Die neun Stationen der
  // Saisonende-Kette (SEASON_TRANSITION_STEPS, lib/season/season-transition-steps.ts) und der
  // Pre-Season-Workflow (preseason-workflow-service.ts) laufen unveraendert im Cockpit; dieser
  // Schritt haelt den Raum nur davor an, bis alle bereit sind (aiAutoStep: false -> dasselbe
  // canHostAdvance-Gate wie jeder Spieltag-Schritt, E3), und zeigt per targetView dorthin.
  { stepId: "season_transition", label: "Saisonwechsel", cta: "Neue Saison im Cockpit starten", targetView: "cockpit", aiAutoStep: false },
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
 * Wohin der Rueckweg aus `season_transition` fuehrt, sobald die neue Saison begonnen hat (E4).
 *
 * GEMESSEN, nicht geraten: `startRoom` (room-store.ts:1284, bestaetigt durch
 * scripts/smoke-multiplayer-e2e.ts:865) setzt beim allerersten Raumstart `currentStep:
 * "training"` -- NICHT den ersten Listeneintrag `sell_players`. Der Grund liegt in den
 * Phasen-Gates: `isTransferSellPhaseOpen` (lib/market/transfer-window-policy.ts:68-74) verlangt
 * `season_end_management`/`transfer_sell_phase` und schliesst `isEarlySeasonTransferSetup`
 * ausdruecklich aus ("KEIN isEarlySeasonTransferSetup: der Saisonstart ist die Kaufphase") --
 * `sell_players` waere also am Beginn einer neuen Saison sofort mit 409 blockiert. `buy_players`
 * und `facilities` waeren technisch offen (`isEarlySeasonTransferSetup` deckt beide), aber
 * `startRoom` haelt genau EINEN Einstiegspunkt fuer "eine Saison beginnt im Raum" fest, und der
 * Rueckweg soll denselben treffen -- sonst gaebe es zwei Antworten auf dieselbe Frage.
 */
export const ROOM_FLOW_SEASON_TRANSITION_TARGET = "training" satisfies RoomFlowStepId;

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
 * Zwei Verzweigungen haengen vom Spielstand ab, nicht von der Listenposition:
 *
 * 1. Am Zyklus-Ende (`standings`): `seasonContinues` entscheidet zwischen einem weiteren
 *    Spieltag und dem Season Review.
 * 2. Am Saisonwechsel-Gate (`season_transition`): `seasonHasAdvanced` entscheidet, ob die neue
 *    Saison im Spielstand schon begonnen hat. Ist das nicht der Fall (oder unbekannt), bleibt
 *    der Raum stehen — "kein Vorspulen auf Verdacht" (Plan, Paket A, Eigenschaft 2). `season_review`
 *    selbst haengt an KEINER Bedingung: von dort geht es immer weiter zum Saisonwechsel-Gate.
 *
 * Beide Felder sind optional, weil ein Aufrufer den Spielstand nicht immer aufloesen kann. FEHLT
 * das jeweils gebrauchte Feld, bleibt es beim sicheren Rueckfall: am Zyklus-Ende die alte
 * Sackgasse im Season Review, am Saisonwechsel-Gate das Stehenbleiben dort — in beiden Faellen
 * lieber nichts geraten als eine falsche Richtung eingeschlagen.
 */
export function getNextRoomFlowStepId(
  stepId: string,
  input?: { seasonContinues?: boolean; seasonHasAdvanced?: boolean },
): RoomFlowStepId {
  if (stepId === ROOM_FLOW_MATCHDAY_CYCLE_END) {
    return input?.seasonContinues ? ROOM_FLOW_MATCHDAY_CYCLE_START : "season_review";
  }
  if (stepId === "season_review") {
    return "season_transition";
  }
  if (stepId === "season_transition") {
    return input?.seasonHasAdvanced ? ROOM_FLOW_SEASON_TRANSITION_TARGET : "season_transition";
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

  // Bereit melden muss JEDER, der eigene Teams hat — auch der Host.
  //
  // Vorher stand hier `!isHost`, und das war ein Deadlock: `canHostAdvance` verlangt, dass ALLE
  // `requiredParticipantIds` bereit sind, und `getRequiredParticipants` nimmt jeden auf, dem
  // Teams gehoeren — den Host eingeschlossen. Ein Host mit eigenen Teams fiel also durch bis zum
  // `!flow.canHostAdvance`-Zweig und bekam "Warten auf <sich selbst>" mit `canClick: false`,
  // waehrend der Gast "Warten auf Host" sah: niemand hatte einen klickbaren Knopf. Auf der
  // Room-Seite fiel das nie auf, weil die einen ZWEITEN, eigenstaendigen "Bereit melden"-Knopf
  // hat (RoomPageClient), der gar nicht ueber diese Funktion laeuft. In der Foundation-Shell, die
  // nur diesen Knopf spiegelt, stand der Flow damit still. Gefunden vom Koop-Audit
  // (scripts/audit-koop-spielbarkeit.ts, Faelle B6/B7).
  //
  // Massgeblich ist deshalb die Bereit-PFLICHT aus dem Flow-Zustand, nicht die Rolle: wer nicht
  // in `requiredParticipantIds` steht (z.B. ein Host ohne eigene Teams), ueberspringt das hier
  // weiterhin und landet direkt beim Weiter-Knopf.
  //
  // Reihenfolge: die KI-Vorbereitung oben kommt bewusst ZUERST. Sie ist eine Host-Pflicht fuer
  // den ganzen Raum, und "bereit" soll heissen "ich bin mit diesem Schritt durch" — das waere
  // gelogen, solange die KI-Teams noch offen sind. Beide Gates muessen ohnehin erfuellt sein
  // (`canHostAdvance = humanReady && aiReady`), es geht hier nur darum, in welcher der Host sie
  // angeboten bekommt.
  const mussBereitMelden =
    flow.requiredParticipantIds.includes(participant.participantId) &&
    !flow.completedParticipantIds.includes(participant.participantId);
  if (mussBereitMelden && participant.readyState !== "ready") {
    return {
      label: `Ready: ${stepDefinition.label}`,
      status: "ready",
      targetView: stepDefinition.targetView,
      activeTeamId: ownedTeamId,
      canClick: true,
      // Bewusst `false`, auch wenn der Host klickt: `isHostAction` markiert die PRIVILEGIERTE
      // Host-Aktion, und `RoomPageClient` ueberschreibt damit in der Lobby die Beschriftung zu
      // "Spiel starten". Bereitmelden ist keine Host-Aktion — mit `true` bekaeme der Host in der
      // Lobby einen Knopf, der "Spiel starten" sagt und nur "bereit" meldet.
      isHostAction: false,
      action: "set_ready",
      warnings: [],
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
