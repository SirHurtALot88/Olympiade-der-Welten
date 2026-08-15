/**
 * ABLAGE FUER RUNTIME-ROOMS — Stufe 0.1 (docs/MULTIPLAYER_VOLLAUSBAU_PLAN.md, Befund B1).
 *
 * BEFUND: `lib/room/room-store.ts:53` hielt (und haelt weiterhin fuer den laufenden Prozess) alle
 * Raeume NUR in `globalThis.__olyRuntimeRooms`, einer reinen Arbeitsspeicher-Map. Kein Prisma-
 * Modell, keine Tabelle, kein Rehydrieren beim Start (`lib/room/live-room-save-registry.ts:9-11`
 * sagt es selbst). Der Auto-Deploy baut bei JEDEM Push auf main einen neuen Container
 * (`deploy/hetzner/auto-deploy.sh`) — jedes laufende Spiel brach damit ab. Schlimmer als "Raum
 * weg": ohne gefundenen Raum faellt der Schreib-Waechter still auf den Einzelspieler-Pfad zurueck
 * (`server-authoritative-write-guard.ts:149-161`) — beide Browser schreiben unbemerkt weiter in
 * denselben Spielstand, die Staende laufen auseinander, ohne dass irgendwer es merkt.
 *
 * DIESES MODUL gibt `RuntimeRoom` eine Ablage — in DERSELBEN SQLite-Datenbank, die das Projekt
 * schon fuer Spielstaende benutzt (`lib/persistence/sqlite.ts`'s `getDatabase()`). Kein Prisma,
 * kein zweiter DB-Kanal, keine zweite Verbindung: better-sqlite3 direkt, exakt das Muster, das
 * `lib/persistence/sqlite.ts` und `lib/persistence/save-repository.ts` schon fahren (payload_json
 * als serialisierter Zustand plus eigene Spalten fuer das, wonach tatsaechlich gesucht wird).
 *
 * DAS ZUSTANDSMODELL BLEIBT UNVERAENDERT (Auftrag): `types/room.ts` (`RuntimeRoom`, `RoomSeat`)
 * und `types/game.ts` (`OlyRoomState`) werden hier nur GELESEN/GESCHRIEBEN, nie umgebaut.
 *
 * SCHNITT — zwei Tabellen, keine drei:
 *   - `rooms`      : eine Zeile pro Raum. `payload_json` traegt das KOMPLETTE `OlyRoomState`
 *                    (inkl. `roomParticipants`, `teamOwnership`, `roomFlowState`, `arenaSyncState`,
 *                    ...) — der "einfachste tragfaehige Schnitt" aus der Aufgabenstellung, analog
 *                    zu `season_states`/`matchday_states` in sqlite.ts. Dazu die Spalten, nach
 *                    denen tatsaechlich gesucht/gefiltert wird (`room_code` als PK, `save_id`,
 *                    `status`, `updated_at`) — exakt das Muster der `saves`-Tabelle dort.
 *   - `room_seats` : eine Zeile je belegtem Sitzplatz (A/B). Sitz-Daten (seatToken, socketId,
 *                    connected) sind NICHT Teil von `OlyRoomState` — `RuntimeRoom.seats` ist ein
 *                    Geschwisterfeld von `state` (siehe `types/room.ts`) — und brauchen deshalb
 *                    eine eigene Tabelle, um Sitzplatz-Tokens ueber einen Neustart hinweg zu
 *                    erhalten (damit `rejoinRoom` danach weiterhin funktioniert).
 *
 *   BEWUSST KEINE dritte Tabelle fuer "Teilnehmer": `RoomParticipant[]` liegt vollstaendig in
 *   `state.roomParticipants` und ist damit schon Teil von `payload_json`. Eine zusaetzliche
 *   Teilnehmer-Tabelle waere eine ZWEITE QUELLE fuer dieselbe Groesse — das verbietet die
 *   Projekt-Hausregel ("keine zweite Quelle fuer eine Groesse, die es schon gibt"), und genau
 *   dieses Muster (zwei Staende derselben Sache, die auseinanderlaufen) ist die Sorte Fehler, die
 *   B1 selbst beschreibt.
 */
import type Database from "better-sqlite3";

import { getDatabase } from "@/lib/persistence/sqlite";
import type { CoachRole, OlyRoomState } from "@/types/game";
import type { RoomSeat, RuntimeRoom } from "@/types/room";

/**
 * Verfallsfrist fuer Raeume, die lange niemand angefasst hat (Stufe 0.4). Grosszuegig gewaehlt:
 * SIEBEN TAGE. Ein Spiel, das ueber ein normales Wochenende pausiert (Freitagabend bis zum
 * naechsten gemeinsamen Termin, typischerweise 2-3 Tage), darf dabei NIE wegfallen — sieben Tage
 * lassen selbst einer laengeren Pause (Krankheit, Urlaubswoche) noch spuerbar Luft, ohne die
 * Tabelle unbegrenzt wachsen zu lassen. Keine erfundene Praezision: die Zahl ist eine bewusste,
 * grosszuegige Wahl, keine Messung.
 */
export const ROOM_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

type PersistedRoomRow = {
  room_code: string;
  status: string;
  payload_json: string;
};

type PersistedSeatRow = {
  room_code: string;
  role: string;
  participant_id: string;
  seat_token: string;
  connected: number;
  joined_at: string;
};

// Getrennt vom Singleton-Zustand in sqlite.ts: `getDatabase()` liefert bei einem Test-Reset
// (`resetDatabaseForTests()`) ein NEUES `Database`-Objekt zurueck (der alte Singleton wird auf
// `null` gesetzt, die Datei geloescht). Ein einfaches Boolean-Flag wuerde nach so einem Reset
// faelschlich "schon migriert" behaupten, obwohl die neue Datei die Tabellen noch nicht hat. Ein
// WeakSet je Datenbank-OBJEKT (nicht je Datei/Pfad) macht die Migration korrekt erneut faellig,
// sobald `getDatabase()` eine neue Instanz zurueckgibt — genau wie `runMigrations()` in sqlite.ts
// selbst bei jedem neuen Singleton erneut laeuft.
const migratedDatabases = new WeakSet<Database.Database>();

function ensureRoomPersistenceSchema(database: Database.Database) {
  if (migratedDatabases.has(database)) {
    return;
  }

  database.exec(`
    CREATE TABLE IF NOT EXISTS rooms (
      room_code TEXT PRIMARY KEY,
      save_id TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      payload_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS room_seats (
      room_code TEXT NOT NULL,
      role TEXT NOT NULL,
      participant_id TEXT NOT NULL,
      seat_token TEXT NOT NULL,
      connected INTEGER NOT NULL,
      joined_at TEXT NOT NULL,
      PRIMARY KEY (room_code, role),
      FOREIGN KEY (room_code) REFERENCES rooms(room_code) ON DELETE CASCADE
    );
  `);

  migratedDatabases.add(database);
}

function getRoomDatabase(): Database.Database {
  const database = getDatabase();
  ensureRoomPersistenceSchema(database);
  return database;
}

/**
 * Schreibt den kompletten Raum (Zustand + Sitzplaetze) in die Ablage. Ein UPSERT — sowohl fuer
 * einen neuen Raum als auch fuer jede Aenderung eines bestehenden. Aufrufer: `syncPlayers()` in
 * room-store.ts, die EINZIGE Stelle, an der jede Raum-Mutation vorbeikommt (siehe Kommentar dort).
 */
export function persistRuntimeRoom(room: RuntimeRoom): void {
  const database = getRoomDatabase();
  const state = room.state;

  database
    .prepare(
      `INSERT INTO rooms (room_code, save_id, status, created_at, updated_at, payload_json)
       VALUES (@room_code, @save_id, @status, @created_at, @updated_at, @payload_json)
       ON CONFLICT(room_code) DO UPDATE SET
         save_id = excluded.save_id,
         status = excluded.status,
         updated_at = excluded.updated_at,
         payload_json = excluded.payload_json`,
    )
    .run({
      room_code: room.roomCode,
      save_id: state.multiplayerRoom.saveId,
      status: state.multiplayerRoom.status,
      created_at: state.multiplayerRoom.createdAt,
      updated_at: state.multiplayerRoom.updatedAt,
      payload_json: JSON.stringify(state),
    });

  const upsertSeat = database.prepare(
    `INSERT INTO room_seats (room_code, role, participant_id, seat_token, connected, joined_at)
     VALUES (@room_code, @role, @participant_id, @seat_token, @connected, @joined_at)
     ON CONFLICT(room_code, role) DO UPDATE SET
       participant_id = excluded.participant_id,
       seat_token = excluded.seat_token,
       connected = excluded.connected,
       joined_at = excluded.joined_at`,
  );
  for (const role of ["A", "B"] as const) {
    const seat = room.seats[role];
    if (!seat) continue;
    upsertSeat.run({
      room_code: room.roomCode,
      role,
      participant_id: seat.participantId,
      seat_token: seat.seatToken,
      connected: seat.connected ? 1 : 0,
      joined_at: seat.joinedAt,
    });
  }
}

/**
 * Entfernt einen Raum vollstaendig aus der Ablage — fuer Stufe 0.4 (`closeRoom` in room-store.ts)
 * und fuer den Verfall abgelaufener Raeume (`sweepExpiredPersistedRooms` unten).
 */
export function deletePersistedRoom(roomCode: string): void {
  const database = getRoomDatabase();
  database.prepare(`DELETE FROM rooms WHERE room_code = ?`).run(roomCode);
  // `room_seats` raeumt sich ueber `ON DELETE CASCADE` eigentlich von selbst mit auf (foreign_keys
  // steht in sqlite.ts global auf ON) — der explizite zweite DELETE ist trotzdem billig und macht
  // das Aufraeumen unabhaengig davon, ob diese Garantie je fuer eine einzelne Verbindung wegfaellt.
  database.prepare(`DELETE FROM room_seats WHERE room_code = ?`).run(roomCode);
}

/**
 * Loescht alle Raeume aus der Ablage, deren letzte Aenderung laenger als `ROOM_EXPIRY_MS`
 * zurueckliegt. Gibt die geloeschten Raumcodes zurueck (fuer Logging/Tests). `now` ist injizierbar,
 * damit Tests den Ablauf nicht ueber echtes Warten pruefen muessen.
 */
export function sweepExpiredPersistedRooms(now: Date = new Date()): string[] {
  const database = getRoomDatabase();
  const cutoffIso = new Date(now.getTime() - ROOM_EXPIRY_MS).toISOString();
  const expiredRows = database.prepare(`SELECT room_code FROM rooms WHERE updated_at < ?`).all(cutoffIso) as Array<{
    room_code: string;
  }>;
  for (const row of expiredRows) {
    deletePersistedRoom(row.room_code);
  }
  return expiredRows.map((row) => row.room_code);
}

/**
 * Laedt alle noch gueltigen Raeume aus der Ablage — aufgerufen beim Serverstart (`server.ts`),
 * BEVOR neue Verbindungen angenommen werden. Fegt zuerst abgelaufene Raeume weg (Stufe 0.4) und
 * liefert dann den Rest, mit `status: 'completed'` defensiv nochmal ausgefiltert (der eigentliche
 * Ausschluss passiert schon beim Schliessen ueber `deletePersistedRoom` — dieser zweite Filter
 * schuetzt nur gegen einen kuenftigen Abschlussweg, der eine Zeile stehen laesst, statt sie zu
 * loeschen).
 *
 * Sitzplatz-Tokens gelten unveraendert weiter (siehe `types/room.ts` `RoomSeat.seatToken`) — nur
 * `connected`/`socketId` werden zurueckgesetzt: ein Socket ueberlebt einen Prozess-Neustart nie,
 * die gespeicherte `socketId` zeigt auf eine Verbindung, die es nicht mehr gibt.
 * `rejoinRoom()` (room-store.ts) setzt beide beim naechsten echten Reconnect korrekt.
 */
export function loadPersistedRuntimeRooms(now: Date = new Date()): RuntimeRoom[] {
  const database = getRoomDatabase();
  sweepExpiredPersistedRooms(now);

  const roomRows = database
    .prepare(`SELECT room_code, status, payload_json FROM rooms WHERE status != 'completed'`)
    .all() as PersistedRoomRow[];
  const seatRows = database
    .prepare(`SELECT room_code, role, participant_id, seat_token, connected, joined_at FROM room_seats`)
    .all() as PersistedSeatRow[];

  const seatsByRoomCode = new Map<string, Partial<Record<CoachRole, RoomSeat>>>();
  for (const seatRow of seatRows) {
    const role = seatRow.role as CoachRole;
    const seat: RoomSeat = {
      role,
      participantId: seatRow.participant_id,
      seatToken: seatRow.seat_token,
      socketId: null,
      connected: false,
      joinedAt: seatRow.joined_at,
    };
    const bucket = seatsByRoomCode.get(seatRow.room_code) ?? {};
    bucket[role] = seat;
    seatsByRoomCode.set(seatRow.room_code, bucket);
  }

  return roomRows.map((row) => ({
    roomCode: row.room_code,
    state: JSON.parse(row.payload_json) as OlyRoomState,
    seats: seatsByRoomCode.get(row.room_code) ?? {},
  }));
}

/**
 * TEST-ONLY: setzt `updated_at` eines persistierten Raums direkt, um den Verfall (Stufe 0.4) ohne
 * echtes Warten zu pruefen. Gleiches Schutzmuster wie `resetDatabaseForTests()` in
 * `lib/persistence/sqlite.ts` — verweigert ausserhalb von Tests den Dienst.
 */
export function setPersistedRoomUpdatedAtForTests(roomCode: string, isoTimestamp: string): void {
  if (process.env.NODE_ENV !== "test" && process.env.VITEST !== "true") {
    throw new Error("setPersistedRoomUpdatedAtForTests darf nur in Tests laufen.");
  }
  const database = getRoomDatabase();
  database.prepare(`UPDATE rooms SET updated_at = ? WHERE room_code = ?`).run(isoTimestamp, roomCode);
}
