/**
 * DIE RAUM-ABLAGE HAELT STAND (Befunde F15a, F15b, F16).
 *
 * Alle drei Pruefungen hier pinnen EIGENSCHAFTEN, nicht Implementierungen: es wird nirgends
 * geprueft, ob `database.transaction(...)` aufgerufen wurde oder ob ein `slice` vorkommt —
 * gemessen wird, was am Ende in der Ablage steht und was der Aufrufer zu spueren bekommt. Genau
 * das ueberlebt einen Umbau, der die Mechanik austauscht.
 *
 * WARUM DAS WICHTIG IST, in einem Satz je Befund:
 *  - F15a: ein Raum OHNE Sitze in der Ablage macht den Koop-Spielstand UNERREICHBAR (der Raum
 *    bleibt als Riegel stehen, aber kein Sitz laesst sich zurueckholen).
 *  - F15b: ein voruebergehender Sperrfehler der Datenbank darf keine laufende Spielhandlung
 *    beider Coaches abbrechen.
 *  - F16: die Chronik wuchs unbegrenzt und wurde bei JEDEM Ereignis komplett neu serialisiert.
 */
import { beforeEach, describe, expect, it } from "vitest";

import {
  CHRONIK_KUERZUNG_QUELLE,
  PERSISTED_ACTION_LOG_LIMIT,
  PERSISTED_ROOM_EVENT_LIMIT,
  getRoomPersistenceFailures,
  persistRuntimeRoom,
  resetRoomPersistenceFailuresForTests,
} from "@/lib/room/room-persistence";
import { createRoom, joinRoom, resetRuntimeRoomsForTests } from "@/lib/room/room-store";
import { getDatabase, resetDatabaseForTests } from "@/lib/persistence/sqlite";
import type { RoomRealtimeEvent } from "@/types/game";

function baueRaumMitZweiSitzen(suffix: string) {
  const created = createRoom(`ablage-a-${suffix}`, {
    displayName: "Chris",
    saveId: `ablage-save-${suffix}`,
    preset: "chris_4_franky_4_rest_ai",
  });
  const joined = joinRoom(created.room.roomCode, `ablage-b-${suffix}`, { displayName: "Franky" });
  if (!joined.ok) {
    throw new Error("Franky konnte dem Raum nicht beitreten");
  }
  return joined.room;
}

function zaehleZeilen(roomCode: string) {
  const database = getDatabase();
  const raeume = database.prepare(`SELECT COUNT(*) AS anzahl FROM rooms WHERE room_code = ?`).get(roomCode) as {
    anzahl: number;
  };
  const sitze = database.prepare(`SELECT COUNT(*) AS anzahl FROM room_seats WHERE room_code = ?`).get(roomCode) as {
    anzahl: number;
  };
  return { raeume: raeume.anzahl, sitze: sitze.anzahl };
}

describe("Die Raum-Ablage haelt stand", () => {
  beforeEach(() => {
    resetDatabaseForTests();
    resetRuntimeRoomsForTests();
    resetRoomPersistenceFailuresForTests();
  });

  it("F15a: ein Raum steht NIE ohne seine Sitzplaetze in der Ablage", () => {
    const room = baueRaumMitZweiSitzen("alles-oder-nichts");
    persistRuntimeRoom(room);

    const { raeume, sitze } = zaehleZeilen(room.roomCode);
    expect(raeume, "Der Raum muss in der Ablage stehen").toBe(1);
    expect(sitze, "Beide Sitzplaetze muessen mit ihm zusammen dort stehen").toBe(2);
  });

  it("F15a-Kern: schlaegt das Schreiben der SITZE fehl, bleibt auch der Raum draussen", () => {
    const room = baueRaumMitZweiSitzen("rollback");

    // ABLAGE ZUERST LEEREN, sonst misst dieser Fall nichts: `joinRoom` ruft `syncPlayers` und damit
    // `persistRuntimeRoom` bereits selbst auf — Raum und Sitze stehen also schon erfolgreich in der
    // Ablage, bevor der Test ueberhaupt anfaengt. Ohne dieses Leeren zaehlte die Pruefung unten die
    // Zeilen jenes frueheren, geglueckten Schreibvorgangs und waere gruen, egal was die Transaktion
    // tut.
    const datenbank = getDatabase();
    datenbank.prepare(`DELETE FROM room_seats WHERE room_code = ?`).run(room.roomCode);
    datenbank.prepare(`DELETE FROM rooms WHERE room_code = ?`).run(room.roomCode);
    expect(zaehleZeilen(room.roomCode)).toEqual({ raeume: 0, sitze: 0 });

    // Der einzige Weg, den Abbruch MITTEN in der Folge nachzustellen, ohne die Ablage umzubauen:
    // ein Sitz mit einem Wert, den die Sitz-Tabelle nicht annimmt. Die Raum-Zeile wird VOR den
    // Sitzen geschrieben — ohne Transaktion bliebe sie also stehen, und genau das ist der Zustand,
    // der den Spielstand unerreichbar macht.
    const kaputterSitz = room.seats.B!;
    // @ts-expect-error absichtlich ein unzulaessiger Wert: better-sqlite3 lehnt Objekte als
    // Spaltenwert ab und wirft — dieselbe Wirkung wie ein Prozessabbruch zwischen den Anweisungen.
    kaputterSitz.seatToken = { kaputt: true };

    persistRuntimeRoom(room);

    const { raeume, sitze } = zaehleZeilen(room.roomCode);
    expect(sitze, "Kein Sitz darf geschrieben worden sein").toBe(0);
    expect(raeume, "Und dann darf auch die Raum-Zeile nicht stehenbleiben — sonst ist der Save verriegelt").toBe(0);
  });

  it("F15b: ein gescheitertes Schreiben wirft NICHT nach oben, wird aber gezaehlt und benannt", () => {
    const room = baueRaumMitZweiSitzen("kein-wurf");
    // @ts-expect-error siehe oben — erzwingt einen Schreibfehler.
    room.seats.B!.seatToken = { kaputt: true };

    // Der Aufrufer ist `syncPlayers()` mitten im Socket-Handler: fliegt hier eine Ausnahme, reisst
    // sie die laufende Aktion BEIDER Coaches mit.
    expect(() => persistRuntimeRoom(room)).not.toThrow();

    const fehler = getRoomPersistenceFailures();
    expect(fehler.count, "Still geschluckt wird nichts — der Fehlschlag muss zaehlbar sein").toBe(1);
    expect(fehler.last?.roomCode).toBe(room.roomCode);
    expect(fehler.last?.message, "Der Grund muss mitgefuehrt werden, nicht nur die Tatsache").toBeTruthy();
  });

  it("F16: die Chronik in der Ablage ist begrenzt, und was wegfaellt, wird beziffert", () => {
    const room = baueRaumMitZweiSitzen("wachstum");
    const ueberGrenze = PERSISTED_ROOM_EVENT_LIMIT + 50;

    const vorhandene = room.state.roomEvents.length;
    for (let i = vorhandene; i < ueberGrenze; i += 1) {
      room.state.roomEvents.push({
        eventId: `kunst-ereignis-${i}`,
        type: "room_state_updated",
        roomId: room.state.multiplayerRoom.roomId,
        saveId: room.state.multiplayerRoom.saveId,
        timestamp: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString(),
        payload: { source: "test" },
      } as RoomRealtimeEvent);
    }
    const laengeImSpeicherVorher = room.state.roomEvents.length;

    persistRuntimeRoom(room);

    const database = getDatabase();
    const zeile = database.prepare(`SELECT payload_json FROM rooms WHERE room_code = ?`).get(room.roomCode) as {
      payload_json: string;
    };
    const abgelegt = JSON.parse(zeile.payload_json) as {
      roomEvents: RoomRealtimeEvent[];
      actionLog: unknown[];
    };

    expect(
      abgelegt.roomEvents.length,
      `Hoechstens ${PERSISTED_ROOM_EVENT_LIMIT} Ereignisse plus den Vermerk ueber das Gekuerzte`,
    ).toBeLessThanOrEqual(PERSISTED_ROOM_EVENT_LIMIT + 1);
    expect(abgelegt.actionLog.length).toBeLessThanOrEqual(PERSISTED_ACTION_LOG_LIMIT + 1);

    // "Bei 0 wird erklaert, nicht versteckt" — hier: was fehlt, steht als eigener Eintrag drin.
    const vermerk = abgelegt.roomEvents[0];
    expect(vermerk?.payload?.source, "Der Vermerk ueber die Kuerzung gehoert nach VORNE").toBe(CHRONIK_KUERZUNG_QUELLE);
    expect(
      vermerk?.payload?.verworfeneRaumEreignisse,
      "Die Zahl der verworfenen Eintraege muss gezaehlt sein, nicht geschaetzt",
    ).toBe(laengeImSpeicherVorher - PERSISTED_ROOM_EVENT_LIMIT);

    // Der einzige Leser des Broadcasts nimmt `roomEvents.at(-1)` — das juengste Ereignis MUSS
    // deshalb erhalten bleiben, sonst kuerzt die Ablage genau das weg, was gebraucht wird.
    expect(abgelegt.roomEvents.at(-1)?.eventId).toBe(room.state.roomEvents.at(-1)?.eventId);

    // Und die laufende Sitzung bleibt unangetastet: diese Datei schreibt nur, sie mutiert nie.
    expect(room.state.roomEvents.length, "Der Raum im Speicher darf nicht gekuerzt worden sein").toBe(
      laengeImSpeicherVorher,
    );
  });

  it("F16-Gegenprobe: eine kurze Chronik wird NICHT angefasst und bekommt keinen Vermerk", () => {
    const room = baueRaumMitZweiSitzen("kurze-chronik");
    persistRuntimeRoom(room);

    const database = getDatabase();
    const zeile = database.prepare(`SELECT payload_json FROM rooms WHERE room_code = ?`).get(room.roomCode) as {
      payload_json: string;
    };
    const abgelegt = JSON.parse(zeile.payload_json) as { roomEvents: RoomRealtimeEvent[] };

    expect(abgelegt.roomEvents.length).toBe(room.state.roomEvents.length);
    expect(
      abgelegt.roomEvents.some((eintrag) => eintrag.payload?.source === CHRONIK_KUERZUNG_QUELLE),
      "Ein frischer Raum darf keinen Kuerzungs-Vermerk tragen",
    ).toBe(false);
  });
});
