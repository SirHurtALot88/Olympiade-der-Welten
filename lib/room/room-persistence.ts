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
import type { CoachRole, OlyRoomState, RoomRealtimeEvent } from "@/types/game";
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

/**
 * BEFUND F16 — die Chronik wuchs unbegrenzt UND wurde bei JEDEM Ereignis komplett neu serialisiert.
 *
 * GEMESSEN ueber `persistRuntimeRoom` selbst (Median aus 21 Laeufen je Zeile, better-sqlite3 mit
 * WAL, derselbe Rechner fuer vorher und nachher):
 *   VORHER (ungekuerzt)
 *   |  Ereignisse | payload_json | ein Schreibvorgang | ganze Sitzung (Schreiben nach JEDEM Ereignis)
 *   |         50  |    23,5 KiB  |            0,18 ms |      9 ms (0,181 ms je Ereignis)
 *   |        500  |   196,2 KiB  |            1,40 ms |    503 ms (1,006 ms je Ereignis)
 *   |       5000  |  1940,9 KiB  |           12,82 ms | 53 674 ms (10,735 ms je Ereignis)
 *   NACHHER (gekuerzt auf die neuesten 200/200)
 *   |         50  |    23,5 KiB  |            0,17 ms |     10 ms (0,196 ms je Ereignis)
 *   |        500  |    81,8 KiB  |            0,39 ms |    307 ms (0,614 ms je Ereignis)
 *   |       5000  |    82,6 KiB  |            0,38 ms |  3 327 ms (0,665 ms je Ereignis)
 *
 * Vorher wuchs der Aufwand JE EREIGNIS mit der Laenge der Sitzung — in Summe quadratisch: 5000
 * Ereignisse kosteten fast eine MINUTE reine Schreibarbeit, und die blockiert (better-sqlite3 ist
 * synchron) den Ereignis-Zyklus des Servers. Nachher ist er konstant; nachgemessen bis weit
 * darueber hinaus: 1000 / 5000 / 20 000 Ereignisse kosten 0,654 / 0,633 / 0,731 ms je Ereignis.
 *
 * WIE VIELE EREIGNISSE ENTSTEHEN WIRKLICH? Ebenfalls gemessen, ueber echte room-store-Aufrufe:
 * Raum erstellen + Beitritt = 3 Ereignisse, ein vollstaendiger Arena-Durchlauf (26 Reveal-Schritte)
 * = 30 weitere. Ein Spieltag kostet also rund 30 Ereignisse; 200 tragen damit gut sechs Spieltage.
 *
 * WAS AUFGEHOBEN WIRD UND WAS NICHT: aufgehoben werden die NEUESTEN 200 Raum-Ereignisse und die
 * neuesten 200 Aktions-Eintraege. Aeltere fallen aus der ABLAGE — nicht aus der laufenden Sitzung:
 * `room.state` im Prozess bleibt unangetastet (diese Datei schreibt nur, sie mutiert den Raum nie),
 * ein laufendes Spiel sieht also weiterhin seine komplette Chronik. Spuerbar wird die Kuerzung erst
 * nach einem Neustart — und dort stand vor Stufe 0.1 ueberhaupt nichts.
 *
 * Das Neueste zu behalten und nicht das Aelteste ist keine Geschmacksfrage: der Broadcast liest
 * ausschliesslich das JUENGSTE Ereignis (`roomEvents.at(-1)` in lib/socket/server.ts und
 * lib/socket/room-gameplay-broadcast.ts). Ein Kuerzen vom neuen Ende her wuerde also genau das
 * wegwerfen, was der einzige Leser tatsaechlich braucht.
 *
 * Und es passiert nicht stillschweigend: was wegfaellt, wird zu Beginn der gekuerzten Liste als
 * eigenes Ereignis vermerkt (`CHRONIK_KUERZUNG_QUELLE`, mit der exakten Zahl der verworfenen
 * Eintraege — gezaehlt, nicht geschaetzt). Der Vermerk steht VORNE, damit `at(-1)` weiterhin das
 * echte juengste Ereignis liefert.
 */
export const PERSISTED_ROOM_EVENT_LIMIT = 200;
export const PERSISTED_ACTION_LOG_LIMIT = 200;

/** Kennzeichen im `payload.source` des Vermerk-Ereignisses (siehe oben). */
export const CHRONIK_KUERZUNG_QUELLE = "room_persistence_chronicle_trim";

/**
 * Fester Bezeichner statt einer neuen UUID je Schreibvorgang: es gibt hoechstens EINEN solchen
 * Vermerk je Raum, und ein stabiler Bezeichner haelt die Ablage ueber wiederholte Schreibvorgaenge
 * hinweg unveraendert (sonst wechselte `payload_json` bei jedem Speichern, auch wenn sich am Raum
 * nichts geaendert hat).
 */
const CHRONIK_KUERZUNG_EVENT_ID = "room-event-chronik-gekuerzt";

function alsZahl(wert: unknown): number {
  return typeof wert === "number" && Number.isFinite(wert) ? wert : 0;
}

/**
 * Liefert eine gekuerzte KOPIE des Raumzustands fuer die Ablage. Mutiert `state` NICHT — der
 * laufende Raum gehoert room-store.ts, diese Datei liest ihn nur.
 *
 * Ein frueherer Vermerk (aus einem Zustand, der schon einmal gekuerzt aus der Ablage kam) wird
 * mitgezaehlt und ERSETZT, statt daneben gestellt zu werden. Sonst stapelten sich ueber mehrere
 * Neustarts hinweg Vermerke, und die Zahl der verworfenen Eintraege waere nach dem zweiten Neustart
 * falsch (sie zaehlte nur noch ab dem letzten Rehydrieren).
 *
 * KEIN Durchlaufen der ganzen Liste (kein `filter`, kein `find`): das waere wieder ein Aufwand, der
 * mit der Sitzungslaenge waechst — genau der Fehler, den F16 beanstandet. Ein Vermerk kann nur an
 * Position 0 stehen (diese Funktion ist die einzige Stelle, die einen erzeugt, und sie setzt ihn
 * nach vorn; alles Spaetere wird hinten angehaengt), also reicht ein Blick auf Position 0. Alles
 * Weitere ist `slice` auf die letzten N — der Aufwand haengt damit nur noch an N, nicht mehr an der
 * Laenge der Chronik. GEMESSEN (5000 Ereignisse, Schreiben nach jedem Ereignis): 3684 ms mit einem
 * `filter` ueber die ganze Liste, 3327 ms mit diesem Blick auf Position 0.
 */
function kuerzeChronikFuerAblage(state: OlyRoomState): OlyRoomState {
  const vorhandenerVermerk =
    state.roomEvents[0]?.payload?.source === CHRONIK_KUERZUNG_QUELLE ? state.roomEvents[0] : null;

  const echteEreignisAnzahl = state.roomEvents.length - (vorhandenerVermerk ? 1 : 0);
  const zuVerwerfendeEreignisse = Math.max(0, echteEreignisAnzahl - PERSISTED_ROOM_EVENT_LIMIT);
  const zuVerwerfendeAktionen = Math.max(0, state.actionLog.length - PERSISTED_ACTION_LOG_LIMIT);

  if (zuVerwerfendeEreignisse === 0 && zuVerwerfendeAktionen === 0) {
    // Nichts NEU zu kuerzen: kurze Chroniken bleiben Zeichen fuer Zeichen, wie sie sind (und ohne
    // Vermerk-Ereignis, das sonst in jedem frischen Raum stuende). Ein bereits vorhandener Vermerk
    // bleibt dabei unveraendert stehen — seine Zahl gilt weiter.
    return state;
  }

  const verworfeneEreignisse =
    alsZahl(vorhandenerVermerk?.payload?.verworfeneRaumEreignisse) + zuVerwerfendeEreignisse;
  const verworfeneAktionen =
    alsZahl(vorhandenerVermerk?.payload?.verworfeneAktionsEintraege) + zuVerwerfendeAktionen;

  // Bei gekuerzten Ereignissen sind die letzten N garantiert echte Ereignisse (der Vermerk steht
  // vorne und faellt damit heraus). Wird NUR das Aktionsprotokoll gekuerzt, bleibt die
  // Ereignisliste wie sie ist — dann muss der alte Vermerk aber weichen, sonst staenden zwei
  // nebeneinander. Beide Zweige sind in ihrer Laenge begrenzt (hoechstens N + 1 Eintraege).
  const behalteneEreignisse =
    zuVerwerfendeEreignisse > 0
      ? state.roomEvents.slice(-PERSISTED_ROOM_EVENT_LIMIT)
      : state.roomEvents.slice(vorhandenerVermerk ? 1 : 0);

  // Der Zeitpunkt, BIS zu dem gekuerzt wurde — abgelesen am letzten weggefallenen Eintrag, nicht
  // geschaetzt. Faellt nur aus dem Aktionsprotokoll etwas weg, zaehlt dessen Grenze.
  const grenzZeitpunkt =
    (zuVerwerfendeEreignisse > 0
      ? state.roomEvents[state.roomEvents.length - PERSISTED_ROOM_EVENT_LIMIT - 1]?.timestamp
      : state.actionLog[zuVerwerfendeAktionen - 1]?.createdAt) ?? state.multiplayerRoom.updatedAt;

  const vermerk: RoomRealtimeEvent = {
    eventId: CHRONIK_KUERZUNG_EVENT_ID,
    type: "room_state_updated",
    roomId: state.multiplayerRoom.roomId,
    saveId: state.multiplayerRoom.saveId,
    timestamp: grenzZeitpunkt,
    payload: {
      source: CHRONIK_KUERZUNG_QUELLE,
      verworfeneRaumEreignisse: verworfeneEreignisse,
      verworfeneAktionsEintraege: verworfeneAktionen,
      hinweis: `Aeltere Raum-Ereignisse und Aktions-Eintraege bis ${grenzZeitpunkt} sind nicht dauerhaft gespeichert; erhalten bleiben die neuesten ${PERSISTED_ROOM_EVENT_LIMIT} Ereignisse und ${PERSISTED_ACTION_LOG_LIMIT} Aktions-Eintraege.`,
    },
  };

  return {
    ...state,
    roomEvents: [vermerk, ...behalteneEreignisse],
    actionLog: state.actionLog.slice(-PERSISTED_ACTION_LOG_LIMIT),
  };
}

/**
 * BEFUND F15b — Fehlerbehandlung. Diese Zaehlung ist der Grund, warum ein Ablage-Fehler die
 * laufende Partie nicht mitreisst UND trotzdem nicht still verschwindet (siehe die ausfuehrliche
 * Begruendung an `persistRuntimeRoom`). Sichtbar von aussen ueber `getRoomPersistenceFailures()`.
 */
type RoomPersistenceFailure = {
  roomCode: string;
  message: string;
  at: string;
};

let ablageFehlerZahl = 0;
let letzterAblageFehler: RoomPersistenceFailure | null = null;

function vermerkeAblageFehler(roomCode: string, error: unknown): void {
  ablageFehlerZahl += 1;
  letzterAblageFehler = {
    roomCode,
    message: error instanceof Error ? error.message : String(error),
    at: new Date().toISOString(),
  };
  // Laut, nicht still: ohne diese Zeile waere ein dauerhaft scheiterndes Schreiben (volle Platte,
  // kaputte Datei) im Serverlog unsichtbar, und der naechste Neustart faende einen viel zu alten
  // Raum vor, ohne dass jemand je einen Hinweis gesehen haette.
  console.error(`[room-persistence] Raum ${roomCode} konnte nicht gespeichert werden: ${letzterAblageFehler.message}`);
}

/** Wie oft ist das Speichern eines Raums gescheitert, und woran zuletzt? Fuer Diagnose und Tests. */
export function getRoomPersistenceFailures(): { count: number; last: RoomPersistenceFailure | null } {
  return { count: ablageFehlerZahl, last: letzterAblageFehler };
}

/** TEST-ONLY: setzt die Fehlerzaehlung zurueck — gleiches Schutzmuster wie `resetDatabaseForTests()`. */
export function resetRoomPersistenceFailuresForTests(): void {
  if (process.env.NODE_ENV !== "test" && process.env.VITEST !== "true") {
    throw new Error("resetRoomPersistenceFailuresForTests darf nur in Tests laufen.");
  }
  ablageFehlerZahl = 0;
  letzterAblageFehler = null;
}

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
 *
 * BEFUND F15a — ALLES ODER NICHTS. Die Vorfassung setzte hier drei bis fuenf einzelne Anweisungen
 * ab (Raum-Zeile, dann Sitz A, dann Sitz B) OHNE Transaktion — als einzige mehrteilige Schreibstelle
 * des Projekts; das Nachbarmodul `lib/persistence/save-repository.ts` umschliesst jede solche Folge
 * seit jeher mit `database.transaction(...)`. Bricht der Prozess zwischen den Anweisungen ab (Deploy,
 * OOM-Kill, Absturz), liegt danach ein Raum OHNE Sitzplaetze in der Ablage. Das ist der schlimmste
 * denkbare Ausgang: `rejoinRoom` findet kein Sitzplatz-Token mehr, Sitz A ist nicht wiederherstellbar
 * — und weil ein Koop-Save immer an einen Raum gebunden sein MUSS, bleibt der Raum als Riegel vor dem
 * Spielstand stehen (`findPersistedRoomBySaveId` unten meldet ihn weiter als gebunden). Der
 * Spielstand waere unerreichbar. Die Transaktion macht daraus ein Alles-oder-nichts: entweder steht
 * der Raum MIT seinen Sitzen in der Ablage, oder der vorherige (in sich stimmige) Stand bleibt.
 *
 * BEFUND F15b — WARUM DIESE FUNKTION NICHT MEHR NACH OBEN WIRFT. Der einzige Aufrufer ist
 * `syncPlayers()`, und der laeuft mitten in jeder Raum-Aktion (Beitritt, Ready, Flow-Schritt,
 * Arena-Etappe) im Socket-Handler. Eine geworfene Ausnahme — z. B. ein `SQLITE_BUSY`, wenn parallel
 * ein Backup oder `pull-repaired-save.sh` die Datei haelt — riss damit die laufende Aktion beider
 * Coaches mit; ein voruebergehender Sperrfehler kostete also eine echte Spielhandlung.
 *
 * Die Abwaegung faellt eindeutig aus, WEIL diese Funktion den KOMPLETTEN Raumzustand schreibt (ein
 * voller UPSERT, kein Delta): ein ausgefallener Schreibvorgang wird von der naechsten Raum-Mutation
 * restlos nachgeholt. Der Schaden eines uebersprungenen Schreibvorgangs ist also hoechstens der
 * Verlust der letzten Aenderung, und auch nur dann, wenn der Prozess vor der naechsten Mutation
 * stirbt. Der Schaden einer geworfenen Ausnahme ist dagegen sicher und sofort: die Raum-Aktion
 * scheitert, obwohl der Raum im Speicher voellig in Ordnung ist.
 *
 * STILL geschluckt wird trotzdem nichts: jeder Fehlschlag wird gezaehlt, mit Raumcode und Grund
 * gemerkt (`getRoomPersistenceFailures()`) und ins Serverlog geschrieben. Die Ablage ist der Sinn
 * dieses Moduls — ein dauerhaft scheiterndes Schreiben muss sichtbar sein, es darf nur nicht die
 * Partie beenden.
 *
 * BEWUSST KEINE eigene Wiederholschleife fuer Sperrfehler: `lib/persistence/sqlite.ts` setzt
 * `busy_timeout = 5000`, better-sqlite3 wartet also bereits bis zu fuenf Sekunden auf die Sperre.
 * Eine zweite Wartemechanik hier waere eine zweite Quelle fuer dieselbe Groesse ("wie lange warten
 * wir auf die Datenbank") — und sie wuerde den synchronen Socket-Handler nach den ersten fuenf
 * Sekunden noch einmal blockieren, ausgerechnet in dem Moment, in dem die Partie ohnehin haengt.
 */
export function persistRuntimeRoom(room: RuntimeRoom): void {
  try {
    const database = getRoomDatabase();
    const state = room.state;

    const upsertRoom = database.prepare(
      `INSERT INTO rooms (room_code, save_id, status, created_at, updated_at, payload_json)
       VALUES (@room_code, @save_id, @status, @created_at, @updated_at, @payload_json)
       ON CONFLICT(room_code) DO UPDATE SET
         save_id = excluded.save_id,
         status = excluded.status,
         updated_at = excluded.updated_at,
         payload_json = excluded.payload_json`,
    );
    const upsertSeat = database.prepare(
      `INSERT INTO room_seats (room_code, role, participant_id, seat_token, connected, joined_at)
       VALUES (@room_code, @role, @participant_id, @seat_token, @connected, @joined_at)
       ON CONFLICT(room_code, role) DO UPDATE SET
         participant_id = excluded.participant_id,
         seat_token = excluded.seat_token,
         connected = excluded.connected,
         joined_at = excluded.joined_at`,
    );

    const schreibeRaumUndSitze = database.transaction(() => {
      upsertRoom.run({
        room_code: room.roomCode,
        save_id: state.multiplayerRoom.saveId,
        status: state.multiplayerRoom.status,
        created_at: state.multiplayerRoom.createdAt,
        updated_at: state.multiplayerRoom.updatedAt,
        payload_json: JSON.stringify(kuerzeChronikFuerAblage(state)),
      });

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
    });

    schreibeRaumUndSitze();
  } catch (error) {
    vermerkeAblageFehler(room.roomCode, error);
  }
}

/**
 * Entfernt einen Raum vollstaendig aus der Ablage — fuer Stufe 0.4 (`closeRoom` in room-store.ts)
 * und fuer den Verfall abgelaufener Raeume (`sweepExpiredPersistedRooms` unten).
 */
export function deletePersistedRoom(roomCode: string): void {
  const database = getRoomDatabase();
  const loescheRaumUndSitze = database.transaction(() => {
    database.prepare(`DELETE FROM rooms WHERE room_code = ?`).run(roomCode);
    // `room_seats` raeumt sich ueber `ON DELETE CASCADE` eigentlich von selbst mit auf (foreign_keys
    // steht in sqlite.ts global auf ON) — der explizite zweite DELETE ist trotzdem billig und macht
    // das Aufraeumen unabhaengig davon, ob diese Garantie je fuer eine einzelne Verbindung wegfaellt.
    database.prepare(`DELETE FROM room_seats WHERE room_code = ?`).run(roomCode);
  });
  // F15a gilt auch hier: bricht der Prozess zwischen den beiden DELETEs ab, bleiben Sitz-Zeilen
  // ohne Raum liegen. Die faenden sich beim naechsten Raum mit demselben (kurzen, wiederverwendbaren)
  // Raumcode als dessen Sitze wieder — mit Tokens, die einem laengst geschlossenen Raum gehoeren.
  // Anders als beim Schreiben wird hier NICHT geschluckt: scheitert das Loeschen, muss der Aufrufer
  // (closeRoom) das erfahren, sonst haelt er den Raum fuer beendet, waehrend er als Riegel vor dem
  // Spielstand stehen bleibt.
  loescheRaumUndSitze();
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
 * Prueft, OHNE die Prozess-Map `runtimeRooms` anzufassen, ob `saveId` einen (noch nicht
 * abgeschlossenen) Raum in der ABLAGE hat — Stufe 0.2, Befund B1/B2.
 *
 * WARUM DIESE ZWEITE, VON `getActiveRoomBySaveId` UNABHAENGIGE QUELLE NOETIG IST:
 * `getActiveRoomBySaveId` (room-store.ts) durchsucht nur die In-Memory-Map. Direkt nach einem
 * Prozess-Neustart — bevor `rehydrateRuntimeRoomsFromPersistence()` in `server.ts` durchgelaufen
 * ist — oder wenn ein Raum aus einem anderen Grund kurzzeitig aus der Map verschwunden ist, liefert
 * sie `null`, OBWOHL der Raum in der Ablage weiterhin existiert. `assertSaveNotRoomBound`
 * (`lib/room/assert-save-not-room-bound.ts`) haengt genau von dieser Unterscheidung ab: „Raum nicht
 * auffindbar" darf NICHT dasselbe bedeuten wie „Save war nie an einen Raum gebunden" — sonst faellt
 * der Schreib-Waechter still auf den Einzelspieler-Pfad zurueck (server-authoritative-write-guard.ts),
 * genau das Loch, das B1 beschreibt.
 *
 * Bewusst ALLE Nicht-`completed`-Status (auch `paused`) — anders als `getActiveRoomBySaveId`, die
 * `paused` fuer Routing/Broadcast-Zwecke ausschliesst. Fuer die Frage „ist dieser Save noch an
 * einen Raum gebunden" zaehlt ein pausierter Raum weiterhin: er ist nicht beendet, nur gerade ohne
 * verbundene Sitzplaetze.
 *
 * BEFUND B2 (docs/MULTIPLAYER_VOLLAUSBAU_PLAN.md): ein `updated_at` aelter als `ROOM_EXPIRY_MS`
 * zaehlt hier bewusst NICHT mehr als "gebunden" — derselbe Ausgang wie `evictRoomIfExpired`
 * (room-store.ts) fuer die In-Memory-Seite, hier fuer die ABLAGE, DAMIT dieser zweite
 * Pfad — der genau dann greift, wenn die In-Memory-Map den Raum (noch) nicht kennt — einen
 * verwaisten Raum nicht auf ewig als Riegel weiterreicht. `now` ist injizierbar fuer Tests
 * (siehe `setPersistedRoomUpdatedAtForTests`), damit der Verfall nicht ueber echtes Warten
 * geprueft werden muss.
 */
export function findPersistedRoomBySaveId(saveId: string, now: Date = new Date()): { roomCode: string } | null {
  const database = getRoomDatabase();
  const cutoffIso = new Date(now.getTime() - ROOM_EXPIRY_MS).toISOString();
  const row = database
    .prepare(
      `SELECT room_code FROM rooms WHERE save_id = ? AND status != 'completed' AND updated_at >= ? ORDER BY updated_at DESC LIMIT 1`,
    )
    .get(saveId, cutoffIso) as { room_code: string } | undefined;
  return row ? { roomCode: row.room_code } : null;
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
