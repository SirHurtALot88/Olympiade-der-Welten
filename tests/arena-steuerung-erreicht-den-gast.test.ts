import { describe, expect, it } from "vitest";

import {
  advanceRoomArenaStep,
  createRoom,
  getRoom,
  joinRoom,
  quickSimRoomArenaRevealState,
  rehydrateRuntimeRoomsFromPersistence,
  resetRoomArenaRevealState,
  resetRuntimeRoomsForTests,
  setRoomArenaPausedState,
  setRoomArenaReadyState,
  startRoomArenaSync,
} from "@/lib/room/room-store";

/**
 * Stufe 3.6 (docs/MULTIPLAYER_VOLLAUSBAU_PLAN.md): das VORHERIGE Paket hinterliess drei fertige,
 * getestete Host-Aktionen in `lib/room/arena-sync-state.ts`
 * (`setRoomArenaPaused`/`resetRoomArenaReveal`/`quickSimRoomArenaReveal`, siehe
 * `arena-gemeinsame-zeitbasis.test.ts`) — aber KEINEN Weg vom Browser dorthin. Folge ohne
 * Verkabelung: pausiert der Host, laeuft es beim Gast weiter; setzt der Host zurueck, bleibt der
 * Gast auf einer Etappe stehen, die es nicht mehr gibt.
 *
 * Diese Suite haelt die EIGENSCHAFT fest, nicht die Umsetzung der Huellen: was der Host ueber
 * `room-store.ts` sendet, landet im GETEILTEN Raum-Zustand (`room.state.arenaSyncState`) — genau
 * das, was der Gast liest (ueber `roomState`/`useArenaRoomSync`, kein zweiter Lesepfad). Ein
 * eigener `getRoom()`-Aufruf fuer den Gast steht deshalb bewusst neben dem des Hosts: beide sehen
 * denselben Zustand, weil es nur EINEN Raum-Zustand gibt.
 */

function setupCoopRoom(saveId: string) {
  const created = createRoom(`socket-${saveId}-a`, { displayName: "Chris", preset: "chris_4_rest_ai", saveId });
  const joined = joinRoom(created.room.roomCode, `socket-${saveId}-b`, { displayName: "Franky" });
  if (!joined.ok) {
    throw new Error("setup: Beitritt fehlgeschlagen");
  }
  const started = startRoomArenaSync(created.room.roomCode, created.seat.seatToken, {
    seasonId: "season-2",
    matchdayId: "season-2-matchday-1",
    disciplineSide: "d1",
    maxSlotRevealCountByDiscipline: { d1: 6, d2: 6 },
  });
  if (!started.ok) {
    throw new Error("setup: Arena-Start fehlgeschlagen");
  }
  expect(setRoomArenaReadyState(created.room.roomCode, created.seat.seatToken, true).ok).toBe(true);
  expect(setRoomArenaReadyState(created.room.roomCode, joined.seat.seatToken, true).ok).toBe(true);
  return { created, joined };
}

describe("Arena-Steuerung erreicht den Gast (Stufe 3.6)", () => {
  it("Host pausiert -> `paused` steht im geteilten Raum-Zustand, der Gast liest denselben Zustand", () => {
    const { created, joined } = setupCoopRoom("arena-steuerung-pause");
    expect(getRoom(created.room.roomCode)?.state.arenaSyncState.paused).toBe(false);

    const hostParticipantId = created.room.state.roomParticipants[0]!.participantId;
    const paused = setRoomArenaPausedState(created.room.roomCode, created.seat.seatToken, true);
    expect(paused.ok).toBe(true);
    if (!paused.ok) return;
    expect(paused.room.state.arenaSyncState.paused).toBe(true);
    expect(paused.room.state.arenaSyncState.pausedBy).toBe(hostParticipantId);

    // Der Gast fragt denselben Raum unter demselben Code ab wie der Host -- kein zweiter,
    // eigener Lesepfad, der aus dem Takt geraten koennte.
    const guestView = getRoom(joined.room.roomCode);
    expect(guestView?.state.arenaSyncState.paused).toBe(true);
    expect(guestView?.state.arenaSyncState.version).toBe(paused.room.state.arenaSyncState.version);

    const resumed = setRoomArenaPausedState(created.room.roomCode, created.seat.seatToken, false);
    expect(resumed.ok).toBe(true);
    if (!resumed.ok) return;
    expect(resumed.room.state.arenaSyncState.paused).toBe(false);
    expect(resumed.room.state.arenaSyncState.pausedBy).toBeNull();
  });

  it("ein Nicht-Host wird bei allen drei Aktionen abgewiesen", () => {
    const { created, joined } = setupCoopRoom("arena-steuerung-guest-guard");

    const pauseByGuest = setRoomArenaPausedState(created.room.roomCode, joined.seat.seatToken, true);
    expect(pauseByGuest.ok).toBe(false);

    const resetByGuest = resetRoomArenaRevealState(created.room.roomCode, joined.seat.seatToken);
    expect(resetByGuest.ok).toBe(false);

    const quickSimByGuest = quickSimRoomArenaRevealState(created.room.roomCode, joined.seat.seatToken, {
      maxSlotRevealCountByDiscipline: { d1: 6, d2: 6 },
    });
    expect(quickSimByGuest.ok).toBe(false);

    // Der geteilte Raum-Zustand blieb bei allen drei abgewiesenen Versuchen unangetastet.
    expect(getRoom(created.room.roomCode)?.state.arenaSyncState.paused).toBe(false);
    expect(getRoom(created.room.roomCode)?.state.arenaSyncState.slotRevealIndex).toBe(0);
  });

  it("ein Reset des Hosts bringt den Gast ZURUECK, nicht nur vorwaerts", () => {
    const { created } = setupCoopRoom("arena-steuerung-reset");

    for (let i = 0; i < 3; i += 1) {
      const advanced = advanceRoomArenaStep(created.room.roomCode, created.seat.seatToken, {
        maxSlotRevealCountByDiscipline: { d1: 6, d2: 6 },
      });
      expect(advanced.ok).toBe(true);
    }
    const beforeReset = getRoom(created.room.roomCode);
    expect(beforeReset?.state.arenaSyncState.slotRevealIndex).toBe(3);
    const stepIndexBeforeReset = beforeReset!.state.arenaSyncState.stepIndex;

    const reset = resetRoomArenaRevealState(created.room.roomCode, created.seat.seatToken);
    expect(reset.ok).toBe(true);
    if (!reset.ok) return;

    // Angezeigte Etappe faellt ZURUECK auf 0 -- eine rein vorwaerts vergleichende Bedingung wie
    // das alte `syncedRound > round` (siehe arena-gemeinsame-zeitbasis.test.ts) haette hier
    // nichts ausgeloest, der Gast waere auf Etappe 3 stehen geblieben.
    expect(reset.room.state.arenaSyncState.slotRevealIndex).toBe(0);
    expect(reset.room.state.arenaSyncState.revealedSlotCountByDiscipline.d1).toBe(0);
    // `stepIndex` waechst trotzdem WEITER (monoton, Stufe 3.2): ein Reset ist selbst ein Schritt.
    expect(reset.room.state.arenaSyncState.stepIndex).toBeGreaterThan(stepIndexBeforeReset);
  });

  it("Quick-Sim des Hosts kommt beim Gast an: der geteilte Raum-Zustand springt ans Ende der aktiven Seite", () => {
    const { created, joined } = setupCoopRoom("arena-steuerung-quicksim");
    const limits = { d1: 5, d2: 6 };

    const quickSimmed = quickSimRoomArenaRevealState(created.room.roomCode, created.seat.seatToken, {
      maxSlotRevealCountByDiscipline: limits,
    });
    expect(quickSimmed.ok).toBe(true);
    if (!quickSimmed.ok) return;

    expect(quickSimmed.room.state.arenaSyncState.revealedSlotCountByDiscipline.d1).toBe(limits.d1);
    expect(quickSimmed.room.state.arenaSyncState.completedDisciplinePhases.d1).toBe(true);
    // Quick-Sim vollendet nur die aktive Seite (d1) -- verlaesst sie danach, wie der lokale
    // Quick-Sim-Knopf auch nur die gerade gezeigte Disziplin sofort abschliesst.
    expect(quickSimmed.room.state.arenaSyncState.activeDisciplinePhase).not.toBe("d1");

    const guestView = getRoom(joined.room.roomCode);
    expect(guestView?.state.arenaSyncState.version).toBe(quickSimmed.room.state.arenaSyncState.version);
    expect(guestView?.state.arenaSyncState.revealedSlotCountByDiscipline.d1).toBe(limits.d1);
  });

  it("Neustart-Probe (Punkt 2 der Aufgabe): der Pausenzustand ueberlebt einen simulierten Neustart", () => {
    const { created } = setupCoopRoom("arena-steuerung-restart");
    const hostParticipantId = created.room.state.roomParticipants[0]!.participantId;

    const paused = setRoomArenaPausedState(created.room.roomCode, created.seat.seatToken, true);
    expect(paused.ok).toBe(true);
    if (!paused.ok) return;

    // Neustart simulieren -- exakt wie in raeume-ueberleben-den-neustart.test.ts: die
    // Prozess-Map wird geleert und aus der Ablage (sqlite) wiederhergestellt.
    resetRuntimeRoomsForTests();
    expect(getRoom(created.room.roomCode)).toBeNull();

    const { restored } = rehydrateRuntimeRoomsFromPersistence();
    expect(restored).toBeGreaterThanOrEqual(1);

    const rehydrated = getRoom(created.room.roomCode);
    expect(rehydrated).toBeTruthy();
    expect(rehydrated?.state.arenaSyncState.paused).toBe(true);
    expect(rehydrated?.state.arenaSyncState.pausedBy).toBe(hostParticipantId);
  });
});
