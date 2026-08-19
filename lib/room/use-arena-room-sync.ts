"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { FoundationRoomContext } from "@/lib/room/foundation-room-context-client";
import { getRoomArenaOfflineBlockerIds, matchesArenaScope, normalizeRoomArenaState } from "@/lib/room/arena-sync-state";
import { computeArenaClockOffsetMs, systemArenaClock, type ArenaClockSource } from "@/lib/foundation/discipline-stage/arena-timeline";
import { getClientSocket } from "@/lib/socket/client";
import type { RoomJoinedPayload } from "@/types/events";
import type { CoachRole, OlyRoomState, RoomArenaState, RoomParticipant } from "@/types/game";

/**
 * Shared co-op arena room-sync logic — used by BOTH the classic
 * `MatchdayArenaV2Client` and the New-Look `MatchdayArenaNewLook`, so the two
 * arenas can never drift on the "both ready" gate / host-driven lockstep
 * reveal semantics.
 *
 * The hook owns:
 * - subscribing to `roomJoined`/`roomState` and force-applying the host's
 *   reveal step (via `onApplyRevealSync`) whenever a new, matching,
 *   non-idle `RoomArenaState` version arrives;
 * - deriving co-op/ready-gate/host-control booleans from that state;
 * - the socket emits (`setRoomArenaReady`, `advanceRoomArenaStep`,
 *   `startRoomArena`).
 *
 * It does NOT own any reveal-rendering state — each arena keeps its own
 * local reveal state shape (classic: per-discipline slot counts + phase
 * index; New Look: a single `boardSide` + `phaseIndex`) and maps the
 * normalized `RoomArenaState` onto it inside `onApplyRevealSync`.
 *
 * Solo / no-room safety: every derived flag here is `false`/inert when
 * `roomContext` is null, and `isRoomArenaCoop` requires more than one
 * required participant — a room with only the host present never gates.
 */
export type UseArenaRoomSyncInput = {
  roomContext: FoundationRoomContext | null | undefined;
  /** Currently displayed arena scope — used to ignore stale/foreign syncs. */
  saveId: string | null | undefined;
  seasonId: string | null | undefined;
  matchdayId: string | null | undefined;
  /**
   * Called with the normalized, force-applied `RoomArenaState` whenever the
   * host advances (or a fresh join delivers an in-progress sync). Map it
   * onto whatever local reveal state the consumer renders.
   */
  onApplyRevealSync: (normalized: RoomArenaState) => void;
  /**
   * Zeitquelle fuer den Uhren-Versatz (Stufe 3.3) — gekapselt statt `Date.now()` direkt zu rufen,
   * damit ein Test eine eigene Uhr einsetzen kann (siehe `arena-timeline.ts`). Default: die echte
   * Systemuhr.
   */
  now?: ArenaClockSource;
};

export type UseArenaRoomSyncResult = {
  roomSyncRole: CoachRole | null;
  /** Nur der Sync-State der aktuell gezeigten Arena (Save/Season/Matchday); sonst `null`. */
  roomArenaSyncState: RoomArenaState | null;
  roomSyncParticipants: RoomParticipant[];
  isRoomHost: boolean;
  /** True whenever this arena instance is mounted inside a Room (solo-in-room included). */
  isRoomRevealSyncActive: boolean;
  arenaRequiredParticipantIds: string[];
  arenaReadyParticipantIds: string[];
  /** True only for a REAL co-op room (>1 human participant controlling teams). */
  isRoomArenaCoop: boolean;
  /** True while co-op is waiting on the "both ready" gate. */
  arenaCoopReadyGateActive: boolean;
  /** Namen der Bereit-pflichtigen, die weder bereit noch verbunden sind. Fuer Hinweis UND Knopf. */
  arenaOfflineBlockerNames: string[];
  /** Nur wahr, wenn AUSSCHLIESSLICH Getrennte blockieren — sonst lehnt der Server ohnehin ab. */
  canSkipDisconnectedInArena: boolean;
  emitHostRoomArenaAdvanceSkippingDisconnected: (maxSlotRevealCountByDiscipline: { d1: number; d2: number }) => void;
  selfArenaParticipantId: string | null;
  isSelfArenaReady: boolean;
  arenaCoopGateParticipants: RoomParticipant[];
  arenaCoopWaitingNames: string[];
  /** Reveal controls should be enabled/rendered-interactive only when this is true. */
  canControlArenaReveal: boolean;
  /** Reiner UI-Hinweis: Guest, und der Host hat den Reveal für diese Arena noch nicht gestartet. */
  roomRevealWaitingForHost: boolean;
  /**
   * Steuerflag: dieser Client advanced den Reveal nie selbst, sondern folgt den Host-Schritten.
   * Gilt für JEDEN Guest im Room, unabhängig vom Sync-Status — im Gegensatz zu
   * `roomRevealWaitingForHost`, das nur bis zum Host-Start true ist.
   */
  roomRevealFollowsHost: boolean;
  /**
   * Gemeinsame Zeitbasis (Stufe 3.3) — Ausschnitt aus dem gescopten `RoomArenaState`, roh
   * durchgereicht, damit Konsumenten (z.B. `DisciplineStageNativeArena`) sie an
   * `resolveArenaDisplayState`/`resolveArenaCatchUpMode` (`arena-timeline.ts`) uebergeben koennen,
   * ohne den Raum-State selbst zu kennen. `null`, solange kein Sync fuer DIESE Arena laeuft.
   */
  roomArenaStepIndex: number | null;
  roomArenaStepStartedAtMs: number | null;
  roomArenaStepDurationMs: number | null;
  roomArenaPaused: boolean;
  /**
   * WER die Raum-Pause ausgeloest hat (`RoomArenaState.pausedBy`) — `null` heisst "pausiert, aber
   * von keinem Menschen". Genau dieser Fall entsteht nach einem Server-Neustart mitten in der
   * Enthuellung (`resumeRoomArenaAfterRestart`, `lib/room/arena-sync-state.ts`), und nur an ihm
   * kann `resolveArenaEffectivePause` erkennen, dass die Pause auch fuer den HOST gilt — sonst
   * liefe der Host weiter und der Gast bliebe stehen (Befund F8).
   */
  roomArenaPausedBy: string | null;
  /**
   * Server-Zeit minus eigene Client-Zeit (`computeArenaClockOffsetMs`), aus dem juengsten
   * `updatedAt` jeder empfangenen Raum-Aktualisierung geschaetzt — kein eigener Ping-Zyklus
   * noetig. 0, solange noch kein Raum-Zustand eingetroffen ist (dann gilt "eigene Uhr = Server-Uhr").
   */
  roomArenaClockOffsetMs: number;
  emitHostRoomArenaAdvance: (maxSlotRevealCountByDiscipline: { d1: number; d2: number }) => void;
  emitArenaCoopReadyToggle: () => void;
  emitStartRoomArena: (input: {
    seasonId?: string | null;
    matchdayId?: string | null;
    disciplineSide?: "d1" | "d2" | "overall" | null;
    maxSlotRevealCountByDiscipline?: { d1: number; d2: number } | null;
  }) => void;
  /**
   * Stufe 3.6 — letzte Meile fuer die drei Host-Aktionen aus `arena-sync-state.ts`. Toggelt
   * gegen den zuletzt EMPFANGENEN Raum-Zustand (wie `emitArenaCoopReadyToggle` gegen
   * `isSelfArenaReady`), nicht gegen einen rein lokalen Zustand — der Host meldet damit immer,
   * was der Raum als naechstes sehen soll.
   */
  emitHostRoomArenaPauseToggle: () => void;
  emitHostRoomArenaReset: () => void;
  emitHostRoomArenaQuickSim: (maxSlotRevealCountByDiscipline: { d1: number; d2: number }) => void;
  /**
   * Welche Disziplinseite der Raum GERADE zeigt (`RoomArenaState.activeDisciplinePhase`) — `null`,
   * solange kein Sync fuer DIESE Arena laeuft. Der Host vergleicht sie mit seiner lokal gewaehlten
   * Disziplin, um einen Wechsel genau einmal zu melden; ohne diesen Vergleich gaebe es keinen Weg,
   * ein erneutes Melden desselben Wechsels zu erkennen.
   */
  roomArenaActiveDisciplinePhase: "d1" | "d2" | "total" | null;
  emitHostRoomArenaDisciplinePhase: (
    phase: "d1" | "d2",
    maxSlotRevealCountByDiscipline: { d1: number; d2: number },
  ) => void;
};

export function useArenaRoomSync(input: UseArenaRoomSyncInput): UseArenaRoomSyncResult {
  const { roomContext, saveId, seasonId, matchdayId } = input;

  const [roomSyncRole, setRoomSyncRole] = useState<CoachRole | null>(null);
  const [roomArenaSyncState, setRoomArenaSyncState] = useState<RoomArenaState | null>(null);
  const [roomSyncParticipants, setRoomSyncParticipants] = useState<RoomParticipant[]>([]);
  const [roomArenaClockOffsetMs, setRoomArenaClockOffsetMs] = useState(0);
  const lastAppliedRoomArenaVersionRef = useRef<number | null>(null);
  const nowRef = useRef<ArenaClockSource>(input.now ?? systemArenaClock);
  nowRef.current = input.now ?? systemArenaClock;

  // Uhren-Versatz (Stufe 3.3): JEDE eintreffende Raum-Aktualisierung traegt in `updatedAt` einen
  // frischen Server-Zeitstempel — kein eigener Ping-Zyklus noetig. Bewusst NICHT an
  // `applyRoomArenaSync` gekoppelt (das ueberspringt idle/fremde/veraltete States): der Versatz
  // soll aus JEDER Probe verbessert werden, auch wenn deren Inhalt fuer DIESE Arena nicht gilt.
  const noteServerTime = useCallback((serverTimeIso: string | undefined | null) => {
    if (!serverTimeIso) return;
    setRoomArenaClockOffsetMs(computeArenaClockOffsetMs(serverTimeIso, nowRef.current()));
  }, []);

  // Keep the latest callback without forcing the subscription effect below to
  // re-run (and re-subscribe sockets) whenever the consumer re-renders with a
  // fresh inline function.
  const onApplyRevealSyncRef = useRef(input.onApplyRevealSync);
  onApplyRevealSyncRef.current = input.onApplyRevealSync;

  const scopeRef = useRef({ saveId, seasonId, matchdayId });
  scopeRef.current = { saveId, seasonId, matchdayId };

  function applyRoomArenaSync(arenaSync: RoomArenaState | null | undefined) {
    if (!arenaSync || arenaSync.status === "idle") {
      return;
    }
    if (!matchesArenaScope(arenaSync, scopeRef.current)) {
      return;
    }
    if (lastAppliedRoomArenaVersionRef.current === arenaSync.version) {
      return;
    }

    lastAppliedRoomArenaVersionRef.current = arenaSync.version;
    onApplyRevealSyncRef.current(normalizeRoomArenaState(arenaSync));
  }

  useEffect(() => {
    if (!roomContext) {
      setRoomSyncRole(null);
      setRoomArenaSyncState(null);
      setRoomSyncParticipants([]);
      lastAppliedRoomArenaVersionRef.current = null;
      return undefined;
    }

    const socket = getClientSocket();

    function handleRoomJoined(payload: RoomJoinedPayload) {
      if (!roomContext) {
        return;
      }
      if (payload.roomCode !== roomContext.roomCode.toUpperCase()) {
        return;
      }
      if (payload.participantId !== roomContext.participantId) {
        return;
      }
      setRoomSyncRole(payload.role);
      setRoomArenaSyncState(payload.state.arenaSyncState ?? null);
      setRoomSyncParticipants(payload.state.roomParticipants ?? []);
      noteServerTime(payload.state.arenaSyncState?.updatedAt);
      applyRoomArenaSync(payload.state.arenaSyncState);
    }

    function handleRoomState(nextState: OlyRoomState) {
      if (!roomContext) {
        return;
      }
      if (nextState.roomCode !== roomContext.roomCode.toUpperCase()) {
        return;
      }
      setRoomArenaSyncState(nextState.arenaSyncState ?? null);
      setRoomSyncParticipants(nextState.roomParticipants ?? []);
      noteServerTime(nextState.arenaSyncState?.updatedAt);
      applyRoomArenaSync(nextState.arenaSyncState);
    }

    socket.emit("rejoinRoom", {
      roomCode: roomContext.roomCode,
      seatToken: roomContext.seatToken,
    });
    socket.on("roomJoined", handleRoomJoined);
    socket.on("roomState", handleRoomState);

    return () => {
      socket.off("roomJoined", handleRoomJoined);
      socket.off("roomState", handleRoomState);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomContext, saveId, seasonId, matchdayId]);

  const isRoomHost = roomSyncRole === "A";
  const isRoomRevealSyncActive = Boolean(roomContext);
  // Für die hier gezeigte Arena zählt nur ein Sync-State DIESES Spieltags. Ein State aus einem
  // anderen Save/Spieltag bedeutet: für diese Arena läuft noch gar kein Sync — also exakt wie
  // `null`/"idle". Ohne diese Sperre blieb der Guest ab dem zweiten Spieltag hängen: der
  // Host-Start-Effekt springt nur bei Status "idle" an, der Raum-State stand nach dem ersten
  // Spieltag aber dauerhaft auf "result_applied", sodass `startRoomArena` nie wieder gesendet wurde.
  const scopedRoomArenaSyncState =
    roomArenaSyncState && matchesArenaScope(roomArenaSyncState, { saveId, seasonId, matchdayId })
      ? roomArenaSyncState
      : null;
  // Co-op means the arena sync currently requires more than one connected human
  // participant (host + guest both control at least one team). A room where only the
  // host is present (solo-in-room) must keep behaving exactly like solo: no ready
  // gate, the reveal auto-starts. Only true co-op gets the "both ready" gate.
  // `requiredParticipantIds` beschreibt die Raum-Besetzung (wird von `syncRoomArenaParticipants`
  // spieltagsunabhängig gepflegt) und bleibt deshalb ungefiltert — sonst würde eine echte Co-op-Runde
  // im Fenster vor dem ersten Sync des neuen Spieltags kurz als Solo gelten und das Ready-Gate
  // umgehen. Der Ready-Zustand selbst gehört dagegen zur einzelnen Arena-Sitzung: alte Ready-Häkchen
  // vom Vorspieltag dürfen das Gate des neuen Spieltags nicht vorab erfüllen.
  const arenaRequiredParticipantIds = roomArenaSyncState?.requiredParticipantIds ?? [];
  const arenaReadyParticipantIds = scopedRoomArenaSyncState?.readyParticipantIds ?? [];
  const isRoomArenaCoop = isRoomRevealSyncActive && arenaRequiredParticipantIds.length > 1;
  const arenaCoopReadyGateActive = isRoomArenaCoop && (scopedRoomArenaSyncState?.status ?? "idle") === "ready_check";
  const selfArenaParticipantId = roomContext?.participantId ?? null;
  const isSelfArenaReady = Boolean(
    selfArenaParticipantId && arenaReadyParticipantIds.includes(selfArenaParticipantId),
  );
  const arenaCoopGateParticipants = arenaRequiredParticipantIds
    .map((participantId) => roomSyncParticipants.find((participant) => participant.participantId === participantId) ?? null)
    .filter((participant): participant is RoomParticipant => Boolean(participant));
  const arenaCoopWaitingNames = arenaCoopGateParticipants
    .filter(
      (participant) =>
        participant.participantId !== selfArenaParticipantId &&
        !arenaReadyParticipantIds.includes(participant.participantId),
    )
    .map((participant) => participant.displayName);
  /**
   * WER HAELT DAS TOR AUF, OHNE NOCH DA ZU SEIN — aus derselben Quelle wie die Server-Pruefung
   * (`getRoomArenaOfflineBlockerIds`). Waere das hier nachgerechnet, koennte der Knopf etwas
   * versprechen, das der Server gleich wieder ablehnt.
   */
  const arenaOfflineBlockerNames = getRoomArenaOfflineBlockerIds(
    { roomParticipants: roomSyncParticipants },
    {
      requiredParticipantIds: arenaRequiredParticipantIds,
      readyParticipantIds: arenaReadyParticipantIds,
    },
  )
    .map(
      (participantId) =>
        roomSyncParticipants.find((participant) => participant.participantId === participantId)?.displayName ??
        participantId,
    );
  /**
   * Der Notausgang ist NUR dann anzubieten, wenn wirklich ausschliesslich Getrennte blockieren.
   * Steht auch nur ein anwesender Mitspieler offen, lehnt der Server ab — dann waere der Knopf ein
   * leeres Versprechen, und der Host suchte den Fehler bei sich.
   */
  const arenaOffeneOhneSelbst = arenaRequiredParticipantIds.filter(
    (participantId) => !arenaReadyParticipantIds.includes(participantId),
  );
  const canSkipDisconnectedInArena =
    isRoomHost &&
    arenaCoopReadyGateActive &&
    arenaOfflineBlockerNames.length > 0 &&
    arenaOffeneOhneSelbst.length === arenaOfflineBlockerNames.length;

  const canControlArenaReveal = (!isRoomRevealSyncActive || isRoomHost) && !arenaCoopReadyGateActive;
  const roomRevealWaitingForHost =
    isRoomRevealSyncActive && !isRoomHost && (scopedRoomArenaSyncState?.status ?? "idle") === "idle";
  const roomRevealFollowsHost = isRoomRevealSyncActive && !isRoomHost;

  // Stable identities (via useCallback) so consumers can safely list these in
  // effect dependency arrays without re-firing on every render.
  const emitHostRoomArenaAdvance = useCallback(
    (maxSlotRevealCountByDiscipline: { d1: number; d2: number }) => {
      if (!roomContext) {
        return;
      }
      const socket = getClientSocket();
      socket.emit("advanceRoomArenaStep", {
        roomCode: roomContext.roomCode,
        seatToken: roomContext.seatToken,
        maxSlotRevealCountByDiscipline,
        // Real co-op (>1 human participant) must respect the server's both-ready gate,
        // so the default advance no longer force-bypasses it. A room with only the host
        // present (solo-in-room) keeps the previous unconditional force:true behavior —
        // there is nobody else to wait for and the ready gate never engages for it.
        force: !isRoomArenaCoop,
      });
    },
    [roomContext, isRoomArenaCoop],
  );

  /**
   * Derselbe Vorschub, aber mit ausdruecklichem "die Getrennten uebergehe ich jetzt". Bewusst ein
   * EIGENER Aufruf und nicht ein Zusatzhaken am normalen Weiter-Knopf: den normalen darf man aus
   * Versehen druecken, diesen nicht.
   */
  const emitHostRoomArenaAdvanceSkippingDisconnected = useCallback(
    (maxSlotRevealCountByDiscipline: { d1: number; d2: number }) => {
      if (!roomContext) {
        return;
      }
      const socket = getClientSocket();
      socket.emit("advanceRoomArenaStep", {
        roomCode: roomContext.roomCode,
        seatToken: roomContext.seatToken,
        maxSlotRevealCountByDiscipline,
        getrennteUeberspringen: true,
      });
    },
    [roomContext],
  );

  const emitArenaCoopReadyToggle = useCallback(() => {
    if (!roomContext) {
      return;
    }
    const socket = getClientSocket();
    socket.emit("setRoomArenaReady", {
      roomCode: roomContext.roomCode,
      seatToken: roomContext.seatToken,
      ready: !isSelfArenaReady,
    });
  }, [roomContext, isSelfArenaReady]);

  const emitStartRoomArena = useCallback(
    (startInput: {
      seasonId?: string | null;
      matchdayId?: string | null;
      disciplineSide?: "d1" | "d2" | "overall" | null;
      maxSlotRevealCountByDiscipline?: { d1: number; d2: number } | null;
    }) => {
      if (!roomContext) {
        return;
      }
      const socket = getClientSocket();
      socket.emit("startRoomArena", {
        roomCode: roomContext.roomCode,
        seatToken: roomContext.seatToken,
        seasonId: startInput.seasonId,
        matchdayId: startInput.matchdayId,
        disciplineSide: startInput.disciplineSide ?? "d1",
        maxSlotRevealCountByDiscipline: startInput.maxSlotRevealCountByDiscipline,
      });
    },
    [roomContext],
  );

  // Stufe 3.6: toggelt gegen den zuletzt bekannten Raum-Pausenstand (analog
  // `emitArenaCoopReadyToggle` gegen `isSelfArenaReady`) — der Aufrufer (Space-Handler in
  // `DisciplineStageNativeArena.tsx`) hat selbst keinen Ziel-Wert zur Hand, nur "umschalten".
  const emitHostRoomArenaPauseToggle = useCallback(() => {
    if (!roomContext) {
      return;
    }
    const socket = getClientSocket();
    socket.emit("setRoomArenaPaused", {
      roomCode: roomContext.roomCode,
      seatToken: roomContext.seatToken,
      paused: !(scopedRoomArenaSyncState?.paused ?? false),
    });
  }, [roomContext, scopedRoomArenaSyncState?.paused]);

  const emitHostRoomArenaReset = useCallback(() => {
    if (!roomContext) {
      return;
    }
    const socket = getClientSocket();
    socket.emit("resetRoomArenaReveal", {
      roomCode: roomContext.roomCode,
      seatToken: roomContext.seatToken,
    });
  }, [roomContext]);

  const emitHostRoomArenaQuickSim = useCallback(
    (maxSlotRevealCountByDiscipline: { d1: number; d2: number }) => {
      if (!roomContext) {
        return;
      }
      const socket = getClientSocket();
      socket.emit("quickSimRoomArenaReveal", {
        roomCode: roomContext.roomCode,
        seatToken: roomContext.seatToken,
        maxSlotRevealCountByDiscipline,
      });
    },
    [roomContext],
  );

  const emitHostRoomArenaDisciplinePhase = useCallback(
    (phase: "d1" | "d2", maxSlotRevealCountByDiscipline: { d1: number; d2: number }) => {
      if (!roomContext) {
        return;
      }
      const socket = getClientSocket();
      socket.emit("setRoomArenaDisciplinePhase", {
        roomCode: roomContext.roomCode,
        seatToken: roomContext.seatToken,
        phase,
        maxSlotRevealCountByDiscipline,
      });
    },
    [roomContext],
  );

  return {
    roomSyncRole,
    // Bewusst der scope-gefilterte State: Konsumenten fragen ihn ab, um zu entscheiden, ob für DIESE
    // Arena schon ein Sync läuft (Host-Start-Guard). Der ungefilterte Raum-State würde dort ab dem
    // zweiten Spieltag dauerhaft "result_applied" melden und den Start blockieren.
    roomArenaSyncState: scopedRoomArenaSyncState,
    roomSyncParticipants,
    isRoomHost,
    isRoomRevealSyncActive,
    arenaRequiredParticipantIds,
    arenaReadyParticipantIds,
    isRoomArenaCoop,
    arenaCoopReadyGateActive,
    arenaOfflineBlockerNames,
    canSkipDisconnectedInArena,
    emitHostRoomArenaAdvanceSkippingDisconnected,
    selfArenaParticipantId,
    isSelfArenaReady,
    arenaCoopGateParticipants,
    arenaCoopWaitingNames,
    canControlArenaReveal,
    roomRevealWaitingForHost,
    roomRevealFollowsHost,
    roomArenaStepIndex: scopedRoomArenaSyncState?.stepIndex ?? null,
    roomArenaStepStartedAtMs: scopedRoomArenaSyncState ? Date.parse(scopedRoomArenaSyncState.stepStartedAt) : null,
    roomArenaStepDurationMs: scopedRoomArenaSyncState?.stepDurationMs ?? null,
    roomArenaPaused: scopedRoomArenaSyncState?.paused ?? false,
    // Ohne Sync fuer DIESE Arena gibt es keine Pause -- dann ist auch `roomArenaPaused` false und
    // die Urheber-Regel greift ohnehin nicht (sie verlangt beides).
    roomArenaPausedBy: scopedRoomArenaSyncState?.pausedBy ?? null,
    roomArenaClockOffsetMs,
    emitHostRoomArenaAdvance,
    emitArenaCoopReadyToggle,
    emitStartRoomArena,
    emitHostRoomArenaPauseToggle,
    emitHostRoomArenaReset,
    emitHostRoomArenaQuickSim,
    roomArenaActiveDisciplinePhase: scopedRoomArenaSyncState?.activeDisciplinePhase ?? null,
    emitHostRoomArenaDisciplinePhase,
  };
}
