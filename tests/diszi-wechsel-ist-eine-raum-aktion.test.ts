import { describe, expect, it } from "vitest";

import {
  advanceRoomArenaReveal,
  createRoomArenaState,
  switchRoomArenaDisciplinePhase,
} from "@/lib/room/arena-sync-state";
import {
  advanceRoomArenaStep,
  createRoom,
  joinRoom,
  setRoomArenaDisciplinePhaseState,
  startRoomArenaSync,
} from "@/lib/room/room-store";

const MAX = { d1: 5, d2: 5 } as const;

function frischeArena() {
  return createRoomArenaState({
    seasonId: "season-2",
    matchdayId: "matchday-1",
    disciplineSide: "d1",
    maxSlotRevealIndex: 5,
  });
}

function etappen(state: ReturnType<typeof frischeArena>, anzahl: number) {
  let s = state;
  for (let i = 0; i < anzahl; i += 1) {
    s = advanceRoomArenaReveal({ arenaState: s, participantId: "host", maxSlotRevealCountByDiscipline: MAX });
  }
  return s;
}

describe("Der Diszi-Wechsel ist eine Raum-Aktion", () => {
  /**
   * DAS GEMESSENE PROBLEM, festgehalten als Testfall — damit niemand die Meldung wieder entfernt
   * in dem Glauben, die Etappenschritte allein wuerden die Seite schon mitwechseln.
   *
   * Ohne Wechsel-Meldung schiebt der 6. Klick nicht auf d2, sondern durch die PHASENKETTE der
   * alten Disziplin (slots -> push -> form -> ...). Der Gast liest `activeDisciplinePhase` und
   * `slotRevealIndex`: beide bewegen sich nicht mehr aus Disziplin 1 heraus.
   */
  it("ohne Wechsel-Meldung fressen die Etappen von Disziplin 2 die Phasenkette von Disziplin 1", () => {
    const nachD1 = etappen(frischeArena(), 5);
    expect(nachD1.activeDisciplinePhase).toBe("d1");
    expect(nachD1.slotRevealIndex).toBe(5);

    // Der Host wechselt lokal auf Disziplin 2 und enthuellt dort seine 5 Etappen.
    const nachD2Klicks = etappen(nachD1, 5);
    expect(nachD2Klicks.activeDisciplinePhase).toBe("d1");
    expect(nachD2Klicks.slotRevealIndex).toBe(5);
    expect(nachD2Klicks.revealedSlotCountByDiscipline.d2).toBe(0);
    expect(nachD2Klicks.phaseId).toBe("power");
  });

  it("mit Wechsel-Meldung sieht der Gast Disziplin 2 von Etappe 1 an", () => {
    const nachD1 = etappen(frischeArena(), 5);
    const gewechselt = switchRoomArenaDisciplinePhase({
      arenaState: nachD1,
      participantId: "host",
      phase: "d2",
      maxSlotRevealCountByDiscipline: MAX,
    });

    expect(gewechselt.activeDisciplinePhase).toBe("d2");
    expect(gewechselt.disciplineSide).toBe("d2");
    expect(gewechselt.phaseId).toBe("slots");
    expect(gewechselt.slotRevealIndex).toBe(0);
    expect(gewechselt.revealedSlotCountByDiscipline.d2).toBe(0);
    // Disziplin 1 war durchgezaehlt fertig — das bleibt so stehen, ihr Endstand ist gewertet.
    expect(gewechselt.completedDisciplinePhases.d1).toBe(true);
    expect(gewechselt.revealedSlotCountByDiscipline.d1).toBe(5);

    // Und ab hier zaehlen die Host-Etappen wieder DIE ANGEZEIGTE Seite hoch, statt Phasen zu schieben.
    const nachD2 = etappen(gewechselt, 5);
    expect(nachD2.activeDisciplinePhase).toBe("d2");
    expect(nachD2.slotRevealIndex).toBe(5);
    expect(nachD2.phaseId).toBe("slots");
  });

  it("ein Wechsel mitten in einer laufenden Disziplin erklaert sie nicht fuer gewertet", () => {
    const mittendrin = etappen(frischeArena(), 2);
    const gewechselt = switchRoomArenaDisciplinePhase({
      arenaState: mittendrin,
      participantId: "host",
      phase: "d2",
      maxSlotRevealCountByDiscipline: MAX,
    });
    expect(gewechselt.completedDisciplinePhases.d1).toBe(false);
    // Der bisherige Stand von d1 geht dabei nicht verloren — nur die ANZEIGE wechselt.
    expect(gewechselt.revealedSlotCountByDiscipline.d1).toBe(2);
  });

  it("der Wechsel ist ein Schritt wie jeder andere, ruehrt aber das Bereit-Tor nicht an", () => {
    const vorher = { ...etappen(frischeArena(), 5), readyParticipantIds: ["host", "gast"] };
    const nachher = switchRoomArenaDisciplinePhase({
      arenaState: vorher,
      participantId: "host",
      phase: "d2",
      maxSlotRevealCountByDiscipline: MAX,
    });
    expect(nachher.stepIndex).toBe(vorher.stepIndex + 1);
    expect(nachher.version).toBe(vorher.version + 1);
    expect(nachher.lastActionByParticipantId).toBe("host");
    expect(nachher.readyParticipantIds).toEqual(["host", "gast"]);
  });

  it("nur der Host darf die gemeinsam gezeigte Disziplin wechseln", () => {
    const erstellt = createRoom("socket-diszi-a", { displayName: "Chris" });
    const beigetreten = joinRoom(erstellt.room.roomCode, "socket-diszi-b", { displayName: "Franky" });
    expect(beigetreten.ok).toBe(true);
    if (!beigetreten.ok) return;

    expect(
      startRoomArenaSync(erstellt.room.roomCode, erstellt.seat.seatToken, {
        seasonId: "season-1",
        matchdayId: "matchday-1",
        maxSlotRevealCountByDiscipline: MAX,
      }).ok,
    ).toBe(true);

    const vomGast = setRoomArenaDisciplinePhaseState(erstellt.room.roomCode, beigetreten.seat.seatToken, {
      phase: "d2",
      maxSlotRevealCountByDiscipline: MAX,
    });
    expect(vomGast.ok).toBe(false);
    if (!vomGast.ok) {
      expect(vomGast.error).toContain("Host");
    }

    const vomHost = setRoomArenaDisciplinePhaseState(erstellt.room.roomCode, erstellt.seat.seatToken, {
      phase: "d2",
      maxSlotRevealCountByDiscipline: MAX,
    });
    expect(vomHost.ok).toBe(true);
    if (!vomHost.ok) return;
    expect(vomHost.room.state.arenaSyncState.activeDisciplinePhase).toBe("d2");
    // Der Wechsel steht im Verlaufsprotokoll — sonst liesse sich hinterher nicht nachvollziehen,
    // wann die gezeigte Disziplin umgesprungen ist.
    expect(vomHost.room.state.roomEvents.at(-1)?.type).toBe("arena_step_changed");
  });

  it("der Raum-Weg vom Host-Klick bis zum Gast-Zustand haelt auch ueber beide Disziplinen", () => {
    const erstellt = createRoom("socket-diszi-c", { displayName: "Chris" });
    expect(
      startRoomArenaSync(erstellt.room.roomCode, erstellt.seat.seatToken, {
        seasonId: "season-1",
        matchdayId: "matchday-1",
        maxSlotRevealCountByDiscipline: MAX,
      }).ok,
    ).toBe(true);

    for (let i = 0; i < 5; i += 1) {
      expect(
        advanceRoomArenaStep(erstellt.room.roomCode, erstellt.seat.seatToken, {
          maxSlotRevealCountByDiscipline: MAX,
          force: true,
        }).ok,
      ).toBe(true);
    }
    expect(
      setRoomArenaDisciplinePhaseState(erstellt.room.roomCode, erstellt.seat.seatToken, {
        phase: "d2",
        maxSlotRevealCountByDiscipline: MAX,
      }).ok,
    ).toBe(true);
    for (let i = 0; i < 5; i += 1) {
      expect(
        advanceRoomArenaStep(erstellt.room.roomCode, erstellt.seat.seatToken, {
          maxSlotRevealCountByDiscipline: MAX,
          force: true,
        }).ok,
      ).toBe(true);
    }

    const arena = erstellt.room.state.arenaSyncState;
    expect(arena.activeDisciplinePhase).toBe("d2");
    expect(arena.slotRevealIndex).toBe(5);
    expect(arena.revealedSlotCountByDiscipline).toEqual({ d1: 5, d2: 5 });
  });
});
