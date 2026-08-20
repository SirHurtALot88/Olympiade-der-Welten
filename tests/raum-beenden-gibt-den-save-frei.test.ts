import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  closeRoom,
  createRoom,
  getActiveRoomBySaveId,
  getRoom,
  joinRoom,
  markDisconnected,
} from "@/lib/room/room-store";

/**
 * EIN RAUM HIELT SEINEN SPIELSTAND FEST, AUCH WENN NIEMAND MEHR DRIN WAR.
 *
 * `closeRoom` gab es seit Stufe 0.4 vollstaendig — aber ohne einen einzigen Aufrufer ausserhalb
 * der eigenen Datei. Kein Socket-Ereignis, kein Knopf: das Ende eines Raums war nicht vorgesehen.
 * Der einzige automatische Ausgang war der Sieben-Tage-Verfall (`ROOM_EXPIRY_MS`); bis dahin blieb
 * der Save raumgebunden und die Admin-Werkzeuge darauf gesperrt.
 *
 * Am Live-Abbild dieses Containers nachgezaehlt: 44 gespeicherte Raeume, einer davon auf dem
 * AKTIVEN Solo-Save, angelegt am Vortag — er liess das Koop-Audit an zwei Stellen (C1, C3)
 * scheitern, ohne dass am Code etwas kaputt war.
 */
describe("Der Host kann den Raum beenden — und gibt damit den Spielstand frei", () => {
  it("beide getrennt reicht NICHT: der Save bleibt gesperrt, solange der Raum steht", () => {
    const saveId = "save-beenden-a";
    const erstellt = createRoom("socket-beenden-a1", { displayName: "Chris", saveId });
    const beigetreten = joinRoom(erstellt.room.roomCode, "socket-beenden-a2", { displayName: "Franky" });
    expect(beigetreten.ok).toBe(true);
    expect(getActiveRoomBySaveId(saveId)).not.toBeNull();

    markDisconnected("socket-beenden-a1");
    markDisconnected("socket-beenden-a2");

    const room = getRoom(erstellt.room.roomCode);
    expect(room).not.toBeNull();
    if (!room) return;
    // Nachgemessen: `markDisconnected` setzt NUR `connectionStatus`. Sitze bleiben, der Status
    // bleibt — "paused" (der Zustand, den `getActiveRoomBySaveId` ausnehmen wuerde) wird nie
    // erreicht.
    expect(room.state.roomParticipants.every((teilnehmer) => teilnehmer.connectionStatus === "offline")).toBe(true);
    expect(room.state.multiplayerRoom.status).not.toBe("paused");
    expect(getActiveRoomBySaveId(saveId)).not.toBeNull();
  });

  it("der Host beendet den Raum — danach ist der Save wieder frei", () => {
    const saveId = "save-beenden-b";
    const erstellt = createRoom("socket-beenden-b1", { displayName: "Chris", saveId });
    expect(joinRoom(erstellt.room.roomCode, "socket-beenden-b2", { displayName: "Franky" }).ok).toBe(true);
    expect(getActiveRoomBySaveId(saveId)).not.toBeNull();

    const beendet = closeRoom(erstellt.room.roomCode, erstellt.seat.seatToken);
    expect(beendet.ok).toBe(true);
    if (!beendet.ok) return;
    expect(beendet.room.state.multiplayerRoom.status).toBe("completed");
    expect(getActiveRoomBySaveId(saveId)).toBeNull();
  });

  it("nur der Host darf beenden — ein Gast kann den Raum nicht unter dem Host wegziehen", () => {
    const saveId = "save-beenden-c";
    const erstellt = createRoom("socket-beenden-c1", { displayName: "Chris", saveId });
    const beigetreten = joinRoom(erstellt.room.roomCode, "socket-beenden-c2", { displayName: "Franky" });
    expect(beigetreten.ok).toBe(true);
    if (!beigetreten.ok) return;

    const vomGast = closeRoom(erstellt.room.roomCode, beigetreten.seat.seatToken);
    expect(vomGast.ok).toBe(false);
    if (!vomGast.ok) expect(vomGast.error).toContain("Host");
    // Und die Ablehnung hat nichts angefasst.
    expect(getActiveRoomBySaveId(saveId)).not.toBeNull();
  });

  /**
   * DIE EIGENTLICHE LUECKE WAR DIE VERKABELUNG, nicht die Funktion — deshalb wird sie hier
   * festgehalten. Ohne diese Pruefung koennte `closeRoom` beim naechsten Umbau wieder still
   * abgehaengt werden, und alle Pruefungen darueber blieben gruen.
   */
  it("VERKABELUNG: es gibt einen Weg vom Browser bis zu closeRoom", () => {
    const socketServer = readFileSync(join(process.cwd(), "lib/socket/server.ts"), "utf8");
    expect(socketServer).toContain('socket.on("closeRoom"');
    expect(socketServer).toContain("const result = closeRoom(roomCode, seatToken);");

    const raumSeite = readFileSync(join(process.cwd(), "app/room/[roomCode]/RoomPageClient.tsx"), "utf8");
    expect(raumSeite).toContain('socket.emit("closeRoom"');
    // Rueckfrage davor: der Klick gilt fuer BEIDE und ist nicht zurueckzunehmen.
    expect(raumSeite).toContain("window.confirm");
  });
});
