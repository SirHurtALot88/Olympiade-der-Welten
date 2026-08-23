import { describe, expect, it } from "vitest";

import {
  advanceRoomArenaStep,
  setRoomArenaDisciplinePhaseState,
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
    /**
     * GEDREHT: hier stand `not.toBe("d1")`, und der Kommentar daneben sagte "verlaesst sie
     * danach" — beides beschrieb einen Fehler als Absicht. Der lokale Quick-Sim-Knopf schliesst
     * die GERADE GEZEIGTE Disziplin ab und wechselt nirgendwohin; der Raum tat es doch, weil
     * `quickSimRoomArenaReveal` die Grenze erst am Schleifenanfang prueft und damit einen Schritt
     * zu weit lief (gemessen mit d1 = 3: `phase=d2 slot=0`). Der Gast folgt
     * `activeDisciplinePhase` und wurde damit in Disziplin 2 gezogen, waehrend der Host noch den
     * Endstand der ersten anschaut.
     */
    expect(quickSimmed.room.state.arenaSyncState.activeDisciplinePhase).toBe("d1");
    expect(quickSimmed.room.state.arenaSyncState.revealedSlotCountByDiscipline.d2).toBe(0);

    const guestView = getRoom(joined.room.roomCode);
    expect(guestView?.state.arenaSyncState.version).toBe(quickSimmed.room.state.arenaSyncState.version);
    expect(guestView?.state.arenaSyncState.revealedSlotCountByDiscipline.d1).toBe(limits.d1);
  });

  it("Befund A3: ein Reset waehrend \"total\" (beide Diszis fertig) trifft d2, nicht d1 — ueber den vollen Raum-Store-Pfad", () => {
    const { created } = setupCoopRoom("arena-steuerung-a3-total");
    const limits = { d1: 3, d2: 3 };

    /**
     * DER WEG NACH "total" IST EIN ANDERER GEWORDEN, die geprüfte Eigenschaft nicht.
     *
     * Vorher genuegten zwei Quick-Sims: der erste lief ueber die d1-Grenze hinaus auf d2, der
     * zweite ueber die d2-Grenze hinaus auf "total". Genau dieses Ueberlaufen war der Fehler
     * (siehe der Test darueber) — ein Quick-Sim haelt jetzt auf seiner Seite.
     *
     * Der Wechsel auf d2 ist inzwischen eine eigene Raum-Aktion (`setRoomArenaDisciplinePhaseState`),
     * und "total" erreicht der Raum ueber die Phasenkette, die `advanceRoomArenaStep` weiterschiebt,
     * sobald die Etappen einer Seite ausgeschoepft sind. Der Aufbau bildet also den echten Weg
     * nach, statt sich auf einen Ueberlauf zu stuetzen.
     */
    const afterD1 = quickSimRoomArenaRevealState(created.room.roomCode, created.seat.seatToken, { maxSlotRevealCountByDiscipline: limits });
    expect(afterD1.ok).toBe(true);
    if (!afterD1.ok) return;
    expect(afterD1.room.state.arenaSyncState.activeDisciplinePhase).toBe("d1");
    expect(afterD1.room.state.arenaSyncState.completedDisciplinePhases.d1).toBe(true);

    const gewechselt = setRoomArenaDisciplinePhaseState(created.room.roomCode, created.seat.seatToken, {
      phase: "d2",
      maxSlotRevealCountByDiscipline: limits,
    });
    expect(gewechselt.ok).toBe(true);
    if (!gewechselt.ok) return;
    expect(gewechselt.room.state.arenaSyncState.activeDisciplinePhase).toBe("d2");

    const afterD2 = quickSimRoomArenaRevealState(created.room.roomCode, created.seat.seatToken, { maxSlotRevealCountByDiscipline: limits });
    expect(afterD2.ok).toBe(true);
    if (!afterD2.ok) return;
    expect(afterD2.room.state.arenaSyncState.activeDisciplinePhase).toBe("d2");

    // Ab hier schiebt jeder weitere Schritt die Phasenkette, bis sie auf "total" kippt.
    for (let i = 0; i < 12; i += 1) {
      if (created.room.state.arenaSyncState.activeDisciplinePhase === "total") break;
      const weiter = advanceRoomArenaStep(created.room.roomCode, created.seat.seatToken, {
        maxSlotRevealCountByDiscipline: limits,
        force: true,
      });
      expect(weiter.ok).toBe(true);
      if (!weiter.ok) return;
    }
    expect(created.room.state.arenaSyncState.activeDisciplinePhase).toBe("total");
    expect(created.room.state.arenaSyncState.completedDisciplinePhases).toEqual({ d1: true, d2: true });

    const reset = resetRoomArenaRevealState(created.room.roomCode, created.seat.seatToken);
    expect(reset.ok).toBe(true);
    if (!reset.ok) return;

    // Die sichtbare Buehne des Gasts zeigt zu diesem Zeitpunkt d2 (DisciplineStageArena.tsx wechselt
    // die lokale disciplineId bei "total" bewusst NICHT) -- der Reset muss also d2 treffen, nicht d1
    // wieder aufleben lassen.
    expect(reset.room.state.arenaSyncState.activeDisciplinePhase).toBe("d2");
    expect(reset.room.state.arenaSyncState.revealedSlotCountByDiscipline.d2).toBe(0);
    expect(reset.room.state.arenaSyncState.completedDisciplinePhases.d2).toBe(false);
    // d1 bleibt unangetastet abgeschlossen.
    expect(reset.room.state.arenaSyncState.completedDisciplinePhases.d1).toBe(true);
    expect(reset.room.state.arenaSyncState.revealedSlotCountByDiscipline.d1).toBe(limits.d1);

    const guestView = getRoom(created.room.roomCode);
    expect(guestView?.state.arenaSyncState.activeDisciplinePhase).toBe("d2");
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
