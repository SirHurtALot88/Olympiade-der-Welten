import {
  advanceFoundationArenaReveal,
  getFoundationArenaActiveSide,
  getFoundationArenaDisplayPhase,
  mapFoundationPhaseToRoomDisciplineSide,
  mapRoomDisciplineSideToFoundationPhase,
  type FoundationArenaRevealState,
} from "@/lib/foundation/matchday-arena-reveal-sync";
import { ARENA_STEP_DURATION_MS } from "@/lib/foundation/discipline-stage/arena-timeline";
import type { OlyRoomState, RoomArenaDisciplineSide, RoomArenaPhaseId, RoomArenaState } from "@/types/game";

export const ROOM_ARENA_PHASES: RoomArenaPhaseId[] = [
  "slots",
  "push",
  "form",
  "mutator",
  "captain",
  "final",
  "result",
];

export function getRoomArenaRequiredParticipantIds(state: Pick<OlyRoomState, "roomParticipants" | "teamOwnership">) {
  return state.roomParticipants
    .filter((participant) => participant.role !== "spectator" && participant.controlledTeamIds.length > 0)
    .map((participant) => participant.participantId);
}

function defaultMaxSlotRevealCounts(maxSlotRevealIndex = 0) {
  const normalized = Math.max(0, maxSlotRevealIndex);
  return { d1: normalized, d2: normalized } as const;
}

export function normalizeRoomArenaState(state: RoomArenaState): RoomArenaState {
  const maxCounts = state.maxSlotRevealCountByDiscipline ?? defaultMaxSlotRevealCounts(state.maxSlotRevealIndex);
  const activeDisciplinePhase =
    state.activeDisciplinePhase ?? mapRoomDisciplineSideToFoundationPhase(state.disciplineSide);
  const activeSide = activeDisciplinePhase === "d2" ? "d2" : "d1";
  const revealedSlotCountByDiscipline = state.revealedSlotCountByDiscipline ?? {
    d1:
      activeDisciplinePhase === "d1" || activeDisciplinePhase === "total"
        ? Math.min(state.slotRevealIndex, maxCounts.d1)
        : maxCounts.d1,
    d2:
      activeDisciplinePhase === "d2" || activeDisciplinePhase === "total"
        ? Math.min(state.slotRevealIndex, maxCounts.d2)
        : 0,
  };
  const completedDisciplinePhases = state.completedDisciplinePhases ?? {
    d1: activeDisciplinePhase === "total" || (activeDisciplinePhase === "d2" && revealedSlotCountByDiscipline.d1 >= maxCounts.d1),
    d2: activeDisciplinePhase === "total",
  };

  return {
    ...state,
    activeDisciplinePhase,
    revealedSlotCountByDiscipline,
    completedDisciplinePhases,
    maxSlotRevealCountByDiscipline: maxCounts,
    phaseIndex: state.phaseIndex < 0 ? 0 : state.phaseIndex,
    phaseId: state.phaseId ?? getFoundationArenaDisplayPhase(state.phaseIndex < 0 ? 0 : state.phaseIndex),
    slotRevealIndex: revealedSlotCountByDiscipline[activeSide],
    maxSlotRevealIndex: Math.max(maxCounts.d1, maxCounts.d2),
    // Rueckfall fuer Alt-States vor Stufe 3.3 (kein `stepStartedAt`/`stepDurationMs` gespeichert):
    // `updatedAt` ist die naechstbeste bekannte Server-Zeit, `ARENA_STEP_DURATION_MS` der bereits
    // produktiv genutzte Wert (`TRACK_ROUND_MS`) — keine neu erfundene Zahl.
    stepStartedAt: state.stepStartedAt ?? state.updatedAt,
    stepDurationMs: state.stepDurationMs ?? ARENA_STEP_DURATION_MS,
    paused: state.paused ?? false,
    pausedBy: state.pausedBy ?? null,
  };
}

/**
 * Gehört dieser Sync-State zu der Arena, die gerade angezeigt wird?
 *
 * Der Arena-Sync-State eines Raums überlebt den Spieltagswechsel: `room-store.ts` setzt ihn beim
 * Anwenden eines Spieltags auf `result_applied` und NIE zurück auf `idle`, und sein `matchdayId`
 * zeigt weiter auf den alten Spieltag. Ohne diese Prüfung steuert dieser fremde, längst
 * abgeschlossene State ab dem zweiten Spieltag die Arena — der Host-Start-Guard sieht "nicht idle"
 * und sendet nie wieder `startRoomArena`, sodass der Guest dauerhaft ohne Reveal dasteht.
 *
 * Ein leeres `seasonId`/`matchdayId` im State gilt bewusst als "passt zu allem" (Alt-States vor
 * Einführung der Felder), ein abweichendes dagegen als Fremd-Scope.
 */
export function matchesArenaScope(
  arenaSync: Pick<RoomArenaState, "saveId" | "seasonId" | "matchdayId">,
  scope: { saveId: string | null | undefined; seasonId: string | null | undefined; matchdayId: string | null | undefined },
) {
  if (arenaSync.saveId !== scope.saveId) {
    return false;
  }
  if (arenaSync.seasonId && arenaSync.seasonId !== scope.seasonId) {
    return false;
  }
  if (arenaSync.matchdayId && arenaSync.matchdayId !== scope.matchdayId) {
    return false;
  }
  return true;
}

export function createRoomArenaState(input: {
  saveId: string;
  seasonId?: string | null;
  matchdayId?: string | null;
  requiredParticipantIds?: string[];
  now?: string;
}): RoomArenaState {
  const now = input.now ?? new Date().toISOString();
  return normalizeRoomArenaState({
    status: "idle",
    version: 0,
    saveId: input.saveId,
    seasonId: input.seasonId ?? null,
    matchdayId: input.matchdayId ?? null,
    disciplineSide: "d1",
    activeDisciplinePhase: "d1",
    phaseId: null,
    phaseIndex: 0,
    slotRevealIndex: 0,
    maxSlotRevealIndex: 0,
    revealedSlotCountByDiscipline: { d1: 0, d2: 0 },
    completedDisciplinePhases: { d1: false, d2: false },
    maxSlotRevealCountByDiscipline: { d1: 0, d2: 0 },
    stepIndex: 0,
    stepStartedAt: now,
    stepDurationMs: ARENA_STEP_DURATION_MS,
    paused: false,
    pausedBy: null,
    requiredParticipantIds: input.requiredParticipantIds ?? [],
    readyParticipantIds: [],
    autoReadyControllerTypes: ["ai", "passive"],
    resultStatus: "preview",
    lastActionByParticipantId: null,
    updatedAt: now,
    callout: null,
  });
}

export function syncRoomArenaParticipants(state: OlyRoomState): RoomArenaState {
  const requiredParticipantIds = getRoomArenaRequiredParticipantIds(state);
  const requiredSet = new Set(requiredParticipantIds);
  return normalizeRoomArenaState({
    ...(state.arenaSyncState ?? createRoomArenaState({ saveId: state.multiplayerRoom.saveId })),
    saveId: state.multiplayerRoom.saveId,
    seasonId: state.arenaSyncState?.seasonId ?? state.multiplayerRoom.activeSeasonId,
    matchdayId: state.arenaSyncState?.matchdayId ?? String(state.multiplayerRoom.activeMatchday),
    requiredParticipantIds,
    readyParticipantIds: (state.arenaSyncState?.readyParticipantIds ?? []).filter((participantId) =>
      requiredSet.has(participantId),
    ),
  });
}

export function isRoomArenaReady(arenaState: RoomArenaState) {
  const readySet = new Set(arenaState.readyParticipantIds);
  return arenaState.requiredParticipantIds.every((participantId) => readySet.has(participantId));
}

export function setRoomArenaParticipantReady(input: {
  arenaState: RoomArenaState;
  participantId: string;
  ready: boolean;
  now?: string;
}) {
  const arenaState = normalizeRoomArenaState(input.arenaState);
  const readySet = new Set(arenaState.readyParticipantIds);
  if (input.ready) {
    readySet.add(input.participantId);
  } else {
    readySet.delete(input.participantId);
  }
  const nextReadyIds = arenaState.requiredParticipantIds.filter((participantId) => readySet.has(participantId));
  return {
    ...arenaState,
    status: isRoomArenaReady({ ...arenaState, readyParticipantIds: nextReadyIds }) ? "revealing" : "ready_check",
    readyParticipantIds: nextReadyIds,
    version: arenaState.version + 1,
    lastActionByParticipantId: input.participantId,
    updatedAt: input.now ?? new Date().toISOString(),
  } satisfies RoomArenaState;
}

export function startRoomArena(input: {
  state: OlyRoomState;
  participantId: string;
  seasonId?: string | null;
  matchdayId?: string | null;
  disciplineSide?: "d1" | "d2" | "overall" | null;
  maxSlotRevealIndex?: number | null;
  maxSlotRevealCountByDiscipline?: { d1: number; d2: number } | null;
  now?: string;
}) {
  const now = input.now ?? new Date().toISOString();
  const requiredParticipantIds = getRoomArenaRequiredParticipantIds(input.state);
  const maxCounts = input.maxSlotRevealCountByDiscipline ?? defaultMaxSlotRevealCounts(input.maxSlotRevealIndex ?? 0);

  return normalizeRoomArenaState({
    status: "ready_check",
    version: (input.state.arenaSyncState?.version ?? 0) + 1,
    saveId: input.state.multiplayerRoom.saveId,
    seasonId: input.seasonId ?? input.state.multiplayerRoom.activeSeasonId,
    // Format muss exakt `matchdayState.matchdayId` treffen ("matchday-1", siehe
    // lib/data/dataAdapter.ts), NICHT die nackte Spieltagsnummer - `matchesArenaScope()`
    // vergleicht beide Strings exakt. Ein Aufruf ohne explizites matchdayId (Fallback hier)
    // erzeugte bisher "1" statt "matchday-1": der Sync lief serverseitig korrekt, aber JEDER
    // echte Client (DisciplineStageArena.tsx scoped auf gameState.matchdayState.matchdayId)
    // verwarf ihn lautlos als "falscher Spieltag" - das Ready-Gate blieb unsichtbar, obwohl der
    // Reveal serverseitig laengst lief. Gefunden beim Reparieren von
    // scripts/smoke-multiplayer-e2e.ts (dem einzigen Aufrufer, der bisher ohne matchdayId rief).
    matchdayId: input.matchdayId ?? `matchday-${input.state.multiplayerRoom.activeMatchday}`,
    disciplineSide: input.disciplineSide ?? "d1",
    activeDisciplinePhase: mapRoomDisciplineSideToFoundationPhase(input.disciplineSide ?? "d1"),
    phaseId: "slots",
    phaseIndex: 0,
    slotRevealIndex: 0,
    maxSlotRevealIndex: Math.max(maxCounts.d1, maxCounts.d2),
    revealedSlotCountByDiscipline: { d1: 0, d2: 0 },
    completedDisciplinePhases: { d1: false, d2: false },
    maxSlotRevealCountByDiscipline: maxCounts,
    stepIndex: 0,
    // Start ist der Nullpunkt der gemeinsamen Zeitbasis (Stufe 3.3): ab hier zaehlen beide Seiten
    // dieselbe Server-Zeit als Schrittbeginn.
    stepStartedAt: now,
    stepDurationMs: ARENA_STEP_DURATION_MS,
    paused: false,
    pausedBy: null,
    requiredParticipantIds,
    readyParticipantIds: [],
    autoReadyControllerTypes: ["ai", "passive"],
    resultStatus: "preview",
    lastActionByParticipantId: input.participantId,
    updatedAt: now,
    callout: "arena_started",
  });
}

export function roomArenaStateToFoundationReveal(state: RoomArenaState): FoundationArenaRevealState {
  const normalized = normalizeRoomArenaState(state);
  return {
    activeDisciplinePhase: normalized.activeDisciplinePhase,
    phaseIndex: normalized.phaseIndex,
    revealedSlotCountByDiscipline: { ...normalized.revealedSlotCountByDiscipline },
    completedDisciplinePhases: { ...normalized.completedDisciplinePhases },
  };
}

export function advanceRoomArenaReveal(input: {
  arenaState: RoomArenaState;
  participantId: string;
  maxSlotRevealIndex?: number | null;
  maxSlotRevealCountByDiscipline?: { d1: number; d2: number } | null;
  now?: string;
}) {
  const arenaState = normalizeRoomArenaState(input.arenaState);
  const maxCounts = input.maxSlotRevealCountByDiscipline ?? arenaState.maxSlotRevealCountByDiscipline;
  const limits = {
    maxD1SlotRevealCount: Math.max(0, maxCounts.d1),
    maxD2SlotRevealCount: Math.max(0, maxCounts.d2),
  };
  if (input.maxSlotRevealCountByDiscipline) {
    limits.maxD1SlotRevealCount = Math.max(0, input.maxSlotRevealCountByDiscipline.d1);
    limits.maxD2SlotRevealCount = Math.max(0, input.maxSlotRevealCountByDiscipline.d2);
  }

  const nextFoundationState = advanceFoundationArenaReveal(roomArenaStateToFoundationReveal(arenaState), limits);
  if (!nextFoundationState) {
    return arenaState;
  }

  const phaseId = getFoundationArenaDisplayPhase(nextFoundationState.phaseIndex);
  const activeSide = getFoundationArenaActiveSide(nextFoundationState);

  return normalizeRoomArenaState({
    ...arenaState,
    status:
      phaseId === "result" && nextFoundationState.activeDisciplinePhase === "total" ? "result" : "revealing",
    activeDisciplinePhase: nextFoundationState.activeDisciplinePhase,
    disciplineSide: mapFoundationPhaseToRoomDisciplineSide(nextFoundationState.activeDisciplinePhase),
    phaseIndex: nextFoundationState.phaseIndex,
    phaseId,
    slotRevealIndex: nextFoundationState.revealedSlotCountByDiscipline[activeSide],
    revealedSlotCountByDiscipline: nextFoundationState.revealedSlotCountByDiscipline,
    completedDisciplinePhases: nextFoundationState.completedDisciplinePhases,
    maxSlotRevealCountByDiscipline: {
      d1: limits.maxD1SlotRevealCount,
      d2: limits.maxD2SlotRevealCount,
    },
    maxSlotRevealIndex: Math.max(limits.maxD1SlotRevealCount, limits.maxD2SlotRevealCount),
    stepIndex: arenaState.stepIndex + 1,
    // Jedes Weiterschalten oeffnet einen NEUEN Schritt-Zeitraum (Stufe 3.3): der Zeitpunkt hier
    // ist der Nullpunkt, ab dem BEIDE Seiten "verstrichene Zeit" fuer diesen Schritt messen.
    stepStartedAt: input.now ?? new Date().toISOString(),
    stepDurationMs: arenaState.stepDurationMs,
    readyParticipantIds: phaseId === "result" ? arenaState.readyParticipantIds : [],
    version: arenaState.version + 1,
    lastActionByParticipantId: input.participantId,
    updatedAt: input.now ?? new Date().toISOString(),
    callout: null,
  });
}

export function applyFoundationRevealToRoomArenaState(
  arenaState: RoomArenaState,
  reveal: FoundationArenaRevealState,
  limits: { maxD1SlotRevealCount: number; maxD2SlotRevealCount: number },
): RoomArenaState {
  const phaseId = getFoundationArenaDisplayPhase(reveal.phaseIndex);
  const activeSide = getFoundationArenaActiveSide(reveal);

  return normalizeRoomArenaState({
    ...arenaState,
    activeDisciplinePhase: reveal.activeDisciplinePhase,
    disciplineSide: mapFoundationPhaseToRoomDisciplineSide(reveal.activeDisciplinePhase),
    phaseIndex: reveal.phaseIndex,
    phaseId,
    slotRevealIndex: reveal.revealedSlotCountByDiscipline[activeSide],
    revealedSlotCountByDiscipline: reveal.revealedSlotCountByDiscipline,
    completedDisciplinePhases: reveal.completedDisciplinePhases,
    maxSlotRevealCountByDiscipline: {
      d1: limits.maxD1SlotRevealCount,
      d2: limits.maxD2SlotRevealCount,
    },
    maxSlotRevealIndex: Math.max(limits.maxD1SlotRevealCount, limits.maxD2SlotRevealCount),
  });
}

/**
 * PAUSE/WEITER ALS RAUM-ZUSTAND (Stufe 3.6): bislang war das rein lokal (`pauseRef`/
 * `manualPauseRef` in `DisciplineStageNativeArena.tsx`) — der Gast bemerkte eine Host-Pause nur
 * indirekt daran, dass keine neuen Schritte mehr eintrafen, nie explizit als eigenen Zustand.
 * Diese Funktion macht "der Host hat pausiert" zu einem Feld, das der Gast direkt lesen kann
 * (`RoomArenaState.paused`), statt es aus dem Ausbleiben von Updates zu erschliessen.
 *
 * Kein Versions-Sprung bei unveraendertem Wert (z.B. doppeltes Event) — sonst wuerde jeder
 * No-op-Toggle einen Broadcast ohne inhaltliche Aenderung ausloesen.
 */
export function setRoomArenaPaused(input: {
  arenaState: RoomArenaState;
  participantId: string;
  paused: boolean;
  now?: string;
}): RoomArenaState {
  const arenaState = normalizeRoomArenaState(input.arenaState);
  if (arenaState.paused === input.paused) {
    return arenaState;
  }
  const now = input.now ?? new Date().toISOString();
  return normalizeRoomArenaState({
    ...arenaState,
    paused: input.paused,
    pausedBy: input.paused ? input.participantId : null,
    version: arenaState.version + 1,
    lastActionByParticipantId: input.participantId,
    updatedAt: now,
  });
}

/**
 * "↻ NEU" ALS RAUM-AKTION (Stufe 3.6): der Reset-Knopf in `DisciplineStageNativeArena.tsx` wirkte
 * bisher nur auf die lokale Kaskade des Kliekenden — ein Gast, der die Etappe schon weiter
 * gesehen hatte, stand danach auf einer Etappe, die es fuer den Host nicht mehr gibt (Befund-Punkt
 * 4: "Kein Rueckwaerts").
 *
 * Setzt NUR die AKTIVE Seite zurueck (d1 ODER d2, je nachdem, welche Seite gerade laeuft) — genau
 * wie der lokale Reset in der Komponente nur die dort gerade gezeigte Disziplin zuruecksetzt, nicht
 * eine laengst gewertete andere Seite. `stepIndex` waechst dabei WEITER (monoton, Stufe 3.2) — ein
 * Reset ist selbst ein Schritt wie jeder andere, nur mit einem "rueckwaerts" zeigenden Ziel; die
 * Monotonie von `stepIndex` beschreibt Reihenfolge/Frische der Uebertragung (wie `version`), nicht
 * die Richtung der ANGEZEIGTEN Etappe.
 */
export function resetRoomArenaReveal(input: {
  arenaState: RoomArenaState;
  participantId: string;
  now?: string;
}): RoomArenaState {
  const arenaState = normalizeRoomArenaState(input.arenaState);
  const now = input.now ?? new Date().toISOString();
  const side: RoomArenaDisciplineSide = arenaState.activeDisciplinePhase === "d2" ? "d2" : "d1";

  return normalizeRoomArenaState({
    ...arenaState,
    status: "revealing",
    phaseId: "slots",
    phaseIndex: 0,
    revealedSlotCountByDiscipline: { ...arenaState.revealedSlotCountByDiscipline, [side]: 0 },
    completedDisciplinePhases: { ...arenaState.completedDisciplinePhases, [side]: false },
    slotRevealIndex: 0,
    stepIndex: arenaState.stepIndex + 1,
    stepStartedAt: now,
    stepDurationMs: ARENA_STEP_DURATION_MS,
    paused: false,
    pausedBy: null,
    version: arenaState.version + 1,
    lastActionByParticipantId: input.participantId,
    updatedAt: now,
    callout: null,
  });
}

/**
 * QUICK-SIM ALS RAUM-AKTION (Stufe 3.6): der "⏩"-Knopf in `DisciplineStageNativeArena.tsx`
 * springt lokal sofort auf den Endstand DER GERADE GEZEIGTEN Disziplinseite — dieselbe Grenze gilt
 * hier: die Schleife haelt an, sobald `activeDisciplinePhase` die Seite verlaesst, auf der sie
 * begann (die naechste Seite/das Gesamtergebnis ist NICHT Teil dieses Quick-Sims, genau wie lokal).
 *
 * Iteriert ueber das bereits vorhandene `advanceRoomArenaReveal` (keine zweite Rechenstelle fuer
 * "wie geht ein Schritt weiter") statt den Zielzustand selbst zu konstruieren. Der Deckel gegen
 * Endlosschleifen ist keine erfundene Zahl, sondern die Summe der real vorhandenen Obergrenzen
 * (Etappen beider Seiten + Laenge der Phasenkette).
 */
export function quickSimRoomArenaReveal(input: {
  arenaState: RoomArenaState;
  participantId: string;
  maxSlotRevealCountByDiscipline?: { d1: number; d2: number } | null;
  now?: string;
}): RoomArenaState {
  const now = input.now ?? new Date().toISOString();
  let state = normalizeRoomArenaState(input.arenaState);
  const startSide = state.activeDisciplinePhase === "d2" ? "d2" : "d1";
  const maxCounts = input.maxSlotRevealCountByDiscipline ?? state.maxSlotRevealCountByDiscipline;
  const guardLimit = Math.max(1, maxCounts.d1) + Math.max(1, maxCounts.d2) + ROOM_ARENA_PHASES.length + 2;

  for (let i = 0; i < guardLimit; i += 1) {
    if (state.activeDisciplinePhase !== startSide) {
      break;
    }
    const next = advanceRoomArenaReveal({
      arenaState: state,
      participantId: input.participantId,
      maxSlotRevealCountByDiscipline: maxCounts,
      now,
    });
    if (next.version === state.version) {
      break; // kein Fortschritt mehr moeglich (Endzustand dieser Seite erreicht)
    }
    state = next;
  }
  return state;
}
