import { describe, expect, it } from "vitest";

import {
  applyRoomTeamSelection,
  closeRoom,
  createRoom,
  getRoom,
  joinRoom,
  rehydrateRuntimeRoomsFromPersistence,
  rejoinRoom,
  resetRuntimeRoomsForTests,
} from "@/lib/room/room-store";
import { ROOM_EXPIRY_MS, setPersistedRoomUpdatedAtForTests } from "@/lib/room/room-persistence";

/**
 * STUFE 0.1 + 0.4 (docs/MULTIPLAYER_VOLLAUSBAU_PLAN.md, Befund B1): Raeume lebten bislang NUR in
 * `globalThis.__olyRuntimeRooms` — einer reinen Prozess-Map. Jeder Deploy baute den Container neu
 * und beendete damit jedes laufende Spiel; schlimmer noch fiel der Schreib-Waechter ohne
 * gefundenen Raum still auf den Einzelspieler-Pfad zurueck (server-authoritative-write-guard.ts).
 *
 * Diese Suite haelt die EIGENSCHAFT fest, nicht die Umsetzung: ein Raum, den
 * `resetRuntimeRoomsForTests()` (Neustart-Simulation) aus dem Speicher wirft, muss durch
 * `rehydrateRuntimeRoomsFromPersistence()` (das, was `server.ts` beim echten Start aufruft) wieder
 * vollstaendig herstellbar sein.
 */
describe("Raeume ueberleben den Neustart", () => {
  it("stellt Sitze, Teilnehmer, Team-Besitz und Flow-Schritt nach einem simulierten Neustart wieder her", () => {
    const created = createRoom("socket-restart-a", { displayName: "Chris" });
    const joined = joinRoom(created.room.roomCode, "socket-restart-b", { displayName: "Franky" });
    expect(joined.ok).toBe(true);
    if (!joined.ok) return;

    const selection = applyRoomTeamSelection(created.room.roomCode, created.seat.seatToken, {
      chrisTeamIds: ["M-M", "D-P"],
      frankyTeamIds: ["C-S"],
    });
    expect(selection.ok).toBe(true);
    if (!selection.ok) return;

    const vorherState = selection.room.state;
    const roomCode = created.room.roomCode;

    // Neustart simulieren: die Prozess-Map ist danach so leer, wie sie nach einem echten
    // Container-Neubau waere.
    resetRuntimeRoomsForTests();
    expect(getRoom(roomCode)).toBeNull();

    const { restored } = rehydrateRuntimeRoomsFromPersistence();
    expect(restored).toBeGreaterThanOrEqual(1);

    const rehydrated = getRoom(roomCode);
    expect(rehydrated).toBeTruthy();
    if (!rehydrated) return;

    // Sitze: beide Rollen wieder da, mit demselben Token wie vorher — nur die Verbindung ist weg,
    // ein Socket ueberlebt einen Prozess-Neustart nie.
    expect(rehydrated.seats.A?.seatToken).toBe(created.seat.seatToken);
    expect(rehydrated.seats.A?.connected).toBe(false);
    expect(rehydrated.seats.B?.seatToken).toBe(joined.seat.seatToken);
    expect(rehydrated.seats.B?.connected).toBe(false);

    // Teilnehmer.
    expect(rehydrated.state.roomParticipants.map((participant) => participant.displayName).sort()).toEqual(
      ["Chris", "Franky"].sort(),
    );

    // Team-Besitz.
    expect(rehydrated.state.teamOwnership.find((entry) => entry.teamId === "M-M")).toMatchObject({
      controllerType: "human",
      ownerDisplayName: "Chris",
    });
    expect(rehydrated.state.teamOwnership.find((entry) => entry.teamId === "D-P")).toMatchObject({
      controllerType: "human",
      ownerDisplayName: "Chris",
    });
    expect(rehydrated.state.teamOwnership.find((entry) => entry.teamId === "C-S")).toMatchObject({
      controllerType: "human",
      ownerDisplayName: "Franky",
    });

    // Flow-Schritt.
    expect(rehydrated.state.roomFlowState.step).toBe(vorherState.roomFlowState.step);
    expect(rehydrated.state.turnState.currentStep).toBe(vorherState.turnState.currentStep);
  });

  it("laesst ein Sitzplatz-Token nach dem Rehydrieren weiter gelten (rejoinRoom klappt)", () => {
    const created = createRoom("socket-restart-rejoin-a", { displayName: "Chris" });
    const roomCode = created.room.roomCode;
    const seatToken = created.seat.seatToken;

    resetRuntimeRoomsForTests();
    rehydrateRuntimeRoomsFromPersistence();

    const rejoined = rejoinRoom(roomCode, seatToken, "socket-restart-rejoin-c");
    expect(rejoined.ok).toBe(true);
    if (!rejoined.ok) return;
    expect(rejoined.seat.role).toBe("A");
    expect(rejoined.room.seats.A?.socketId).toBe("socket-restart-rejoin-c");
    expect(rejoined.room.seats.A?.connected).toBe(true);
    expect(
      rejoined.room.state.roomParticipants.find((participant) => participant.displayName === "Chris")
        ?.connectionStatus,
    ).toBe("online");
  });

  it("bringt einen beendeten Raum beim Rehydrieren NICHT zurueck", () => {
    const created = createRoom("socket-restart-closed-a", { displayName: "Chris" });
    const roomCode = created.room.roomCode;

    const closed = closeRoom(roomCode, created.seat.seatToken);
    expect(closed.ok).toBe(true);
    if (!closed.ok) return;
    expect(closed.room.state.multiplayerRoom.status).toBe("completed");
    // Aus der aktiven Menge sofort raus, der Code ist sofort wieder frei.
    expect(getRoom(roomCode)).toBeNull();

    resetRuntimeRoomsForTests();
    rehydrateRuntimeRoomsFromPersistence();

    expect(getRoom(roomCode)).toBeNull();
  });

  it("laesst einen abgelaufenen Raum verfallen, einen frischen aber nicht", () => {
    const stale = createRoom("socket-restart-stale-a", { displayName: "Chris" });
    const fresh = createRoom("socket-restart-fresh-a", { displayName: "Chris" });

    // "Lange niemand angefasst" simulieren, ohne echte Zeit verstreichen zu lassen: die
    // persistierte updated_at des alten Raums weit genug in die Vergangenheit setzen.
    const laengstVergangen = new Date(Date.now() - ROOM_EXPIRY_MS - 24 * 60 * 60 * 1000).toISOString();
    setPersistedRoomUpdatedAtForTests(stale.room.roomCode, laengstVergangen);

    resetRuntimeRoomsForTests();
    rehydrateRuntimeRoomsFromPersistence();

    expect(getRoom(stale.room.roomCode)).toBeNull();
    expect(getRoom(fresh.room.roomCode)).toBeTruthy();
  });
});
