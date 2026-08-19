import { describe, expect, it } from "vitest";

import {
  advanceRoomArenaReveal,
  createRoomArenaState,
  matchesArenaScope,
  quickSimRoomArenaReveal,
  roomMatchdayScopeId,
  setRoomArenaParticipantReady,
} from "@/lib/room/arena-sync-state";
import { isRoomMatchdayInProgress } from "@/lib/room/online-room-model";
import {
  advanceRoomArenaStep,
  createRoom,
  getRoom,
  joinRoom,
  setRoomArenaReadyState,
  startRoomArenaSync,
} from "@/lib/room/room-store";

const MAX = { d1: 4, d2: 4 } as const;

function koopRaum(prefix: string) {
  const erstellt = createRoom(`${prefix}-a`, { displayName: "Chris", preset: "chris_4_franky_4_rest_ai" });
  const beigetreten = joinRoom(erstellt.room.roomCode, `${prefix}-b`, { displayName: "Franky" });
  expect(beigetreten.ok).toBe(true);
  if (!beigetreten.ok) throw new Error("Beitritt fehlgeschlagen");
  const room = getRoom(erstellt.room.roomCode);
  if (!room) throw new Error("Raum fehlt");
  return { erstellt, beigetreten, room };
}

describe("Ein Bereit-Klick haelt die laufende Enthuellung nicht mehr an", () => {
  /**
   * NACHGEMESSEN, zwei Menschen, 4 Etappen — so sah es vorher aus:
   *
   *   beide bereit:          status=revealing   ready=2
   *   nach 1 Etappe:         status=revealing   ready=0
   *   Gast klickt "Bereit":  status=ready_check ready=1/2
   *     Warteliste:          ["Chris"]
   *     Host will weiter:    abgelehnt — "Die Arena wartet noch auf: Chris (anwesend, noch nicht bereit)."
   *
   * Der Host wurde aufgefordert, auf SICH SELBST zu warten. Ursache: jeder Etappenschritt leert
   * `readyParticipantIds` (und bleibt zu Recht auf "revealing"); der Bereit-Klick rechnete den
   * Status aus dieser regulaer leeren Menge neu und stufte zurueck.
   */
  it("der Host wird nach einem spaeten Klick des Gasts nicht auf sich selbst verwiesen", () => {
    const { erstellt, beigetreten, room } = koopRaum("socket-tor-a");
    startRoomArenaSync(erstellt.room.roomCode, erstellt.seat.seatToken, {
      seasonId: "season-1",
      matchdayId: "matchday-1",
      maxSlotRevealCountByDiscipline: MAX,
    });
    setRoomArenaReadyState(erstellt.room.roomCode, erstellt.seat.seatToken, true);
    setRoomArenaReadyState(erstellt.room.roomCode, beigetreten.seat.seatToken, true);
    expect(room.state.arenaSyncState.status).toBe("revealing");

    expect(advanceRoomArenaStep(erstellt.room.roomCode, erstellt.seat.seatToken, { maxSlotRevealCountByDiscipline: MAX }).ok).toBe(true);
    // Der Etappenschritt leert die Bereit-Menge — das ist so gewollt und bleibt so.
    expect(room.state.arenaSyncState.readyParticipantIds).toEqual([]);
    expect(room.state.arenaSyncState.status).toBe("revealing");

    // Jetzt der spaete Klick.
    setRoomArenaReadyState(erstellt.room.roomCode, beigetreten.seat.seatToken, true);
    expect(room.state.arenaSyncState.status).toBe("revealing");

    const weiter = advanceRoomArenaStep(erstellt.room.roomCode, erstellt.seat.seatToken, { maxSlotRevealCountByDiscipline: MAX });
    expect(weiter.ok).toBe(true);
  });

  it("GEGENPROBE: vor dem ersten Schritt haelt das Tor unveraendert", () => {
    const { erstellt, beigetreten, room } = koopRaum("socket-tor-b");
    startRoomArenaSync(erstellt.room.roomCode, erstellt.seat.seatToken, {
      seasonId: "season-1",
      matchdayId: "matchday-1",
      maxSlotRevealCountByDiscipline: MAX,
    });
    expect(room.state.arenaSyncState.status).toBe("ready_check");

    setRoomArenaReadyState(erstellt.room.roomCode, erstellt.seat.seatToken, true);
    expect(room.state.arenaSyncState.status).toBe("ready_check");
    const zuFrueh = advanceRoomArenaStep(erstellt.room.roomCode, erstellt.seat.seatToken, { maxSlotRevealCountByDiscipline: MAX });
    expect(zuFrueh.ok).toBe(false);
    if (!zuFrueh.ok) expect(zuFrueh.error).toContain("Franky");

    setRoomArenaReadyState(erstellt.room.roomCode, beigetreten.seat.seatToken, true);
    expect(room.state.arenaSyncState.status).toBe("revealing");
  });

  it("das Tor geht nur AUF, nie zu — auch ein Abmelden mitten im Lauf haelt nichts an", () => {
    const arena = { ...createRoomArenaState({ saveId: "s" }), status: "revealing" as const, requiredParticipantIds: ["a", "b"] };
    const nachAbmeldung = setRoomArenaParticipantReady({ arenaState: arena, participantId: "a", ready: false });
    expect(nachAbmeldung.status).toBe("revealing");
  });
});

describe("Quick-Sim bleibt auf seiner Disziplin", () => {
  it("spult die aktive Seite ans Ende und wechselt sie NICHT", () => {
    const start = createRoomArenaState({ saveId: "save-quick", seasonId: "s2", matchdayId: "matchday-1" });
    const fertig = quickSimRoomArenaReveal({
      arenaState: start,
      participantId: "host",
      maxSlotRevealCountByDiscipline: { d1: 3, d2: 3 },
    });
    expect(fertig.activeDisciplinePhase).toBe("d1");
    expect(fertig.revealedSlotCountByDiscipline.d1).toBe(3);
    // Der "diese Seite ist durch"-Vermerk haengt frueher am Schritt, der die Seite VERLAESST —
    // er wird deshalb ausdruecklich gesetzt, sonst waeren alle Etappen enthuellt und die Seite
    // trotzdem offen.
    expect(fertig.completedDisciplinePhases.d1).toBe(true);
    // Und die andere Seite bleibt unberuehrt.
    expect(fertig.revealedSlotCountByDiscipline.d2).toBe(0);
    expect(fertig.completedDisciplinePhases.d2).toBe(false);
  });

  it("ein zweiter Quick-Sim auf derselben Seite tut nichts mehr, statt weiterzurutschen", () => {
    const start = createRoomArenaState({ saveId: "save-quick-2" });
    const einmal = quickSimRoomArenaReveal({ arenaState: start, participantId: "host", maxSlotRevealCountByDiscipline: { d1: 2, d2: 2 } });
    const zweimal = quickSimRoomArenaReveal({ arenaState: einmal, participantId: "host", maxSlotRevealCountByDiscipline: { d1: 2, d2: 2 } });
    expect(zweimal.activeDisciplinePhase).toBe("d1");
    expect(zweimal.revealedSlotCountByDiscipline.d2).toBe(0);
  });
});

describe("Der Arena-Start setzt einen Schritt, der die naechste Zeile ueberlebt", () => {
  it("roomFlowState.step steht danach auf arena — und turnState.currentStep ebenso", () => {
    const { erstellt, room } = koopRaum("socket-start");
    expect(room.state.roomFlowState.step).toBe("lobby_ready");

    startRoomArenaSync(erstellt.room.roomCode, erstellt.seat.seatToken, {
      seasonId: "season-1",
      matchdayId: "matchday-1",
      maxSlotRevealCountByDiscipline: MAX,
    });

    // Vorher blieb BEIDES auf "lobby_ready": `syncPlayers` baut `roomFlowState` neu und liest den
    // Schritt aus `turnState.currentStep`, der nicht mitgezogen wurde.
    expect(room.state.turnState.currentStep).toBe("arena");
    expect(room.state.roomFlowState.step).toBe("arena");
  });
});

describe("Der Spieltag des Raums heisst ueberall gleich", () => {
  it("die Kennung traegt das Praefix, das der Browser vergleicht", () => {
    expect(roomMatchdayScopeId(1)).toBe("matchday-1");
    expect(roomMatchdayScopeId("3")).toBe("matchday-3");
    // Schon fertige Kennungen bleiben, wie sie sind — sonst entstuende "matchday-matchday-1".
    expect(roomMatchdayScopeId("matchday-7")).toBe("matchday-7");
  });

  it("der Scope-Vergleich trifft jetzt zu, statt immer danebenzuliegen", () => {
    const { erstellt, room } = koopRaum("socket-scope");
    startRoomArenaSync(erstellt.room.roomCode, erstellt.seat.seatToken, {
      seasonId: "season-1",
      maxSlotRevealCountByDiscipline: MAX,
    });
    const arena = room.state.arenaSyncState;
    // Vorher: arenaSyncState.matchdayId = "matchday-1" gegen String(activeMatchday) = "1" -> false.
    expect(
      matchesArenaScope(arena, {
        saveId: room.state.multiplayerRoom.saveId,
        seasonId: room.state.multiplayerRoom.activeSeasonId,
        matchdayId: roomMatchdayScopeId(room.state.multiplayerRoom.activeMatchday),
      }),
    ).toBe(true);
  });

  it("eine laufende Enthuellung sperrt die Team-Umverteilung auch ausserhalb der Spieltags-Schritte", () => {
    const { erstellt, room } = koopRaum("socket-sperre");
    startRoomArenaSync(erstellt.room.roomCode, erstellt.seat.seatToken, {
      seasonId: "season-1",
      maxSlotRevealCountByDiscipline: MAX,
    });
    // Flow-Schritt bewusst AUSSERHALB der Spieltags-Menge: nur so haengt die Antwort am
    // Arena-Zustand — und genau dieser Zweig war durch den Formatunterschied tot.
    room.state = { ...room.state, roomFlowState: { ...room.state.roomFlowState, step: "standings" as never } };
    expect(isRoomMatchdayInProgress(room.state)).toBe(true);
  });

  it("GEGENPROBE: ein Sync-State eines ANDEREN Spieltags sperrt nicht", () => {
    const { erstellt, room } = koopRaum("socket-sperre-alt");
    startRoomArenaSync(erstellt.room.roomCode, erstellt.seat.seatToken, {
      seasonId: "season-1",
      matchdayId: "matchday-9",
      maxSlotRevealCountByDiscipline: MAX,
    });
    room.state = { ...room.state, roomFlowState: { ...room.state.roomFlowState, step: "standings" as never } };
    expect(room.state.multiplayerRoom.activeMatchday).not.toBe(9);
    expect(isRoomMatchdayInProgress(room.state)).toBe(false);
  });
});

describe("Der Etappenschritt bleibt unveraendert", () => {
  it("die Bereit-Menge wird bei jedem Schritt geleert — daran aendert die Tor-Regel nichts", () => {
    const arena = { ...createRoomArenaState({ saveId: "s" }), status: "revealing" as const };
    const nachher = advanceRoomArenaReveal({ arenaState: arena, participantId: "host", maxSlotRevealCountByDiscipline: MAX });
    expect(nachher.readyParticipantIds).toEqual([]);
  });
});
