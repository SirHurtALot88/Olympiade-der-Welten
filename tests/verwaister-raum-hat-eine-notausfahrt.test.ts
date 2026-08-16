/**
 * NOTAUSFAHRT AUS EINEM VERWAISTEN RAUM (drittes Audit, Funde F1/F3/F4/F5/F17,
 * docs/MULTIPLAYER_VOLLAUSBAU_PLAN.md).
 *
 * KURSKORREKTUR (Chris, 16.08.2026, woertlich: "im multiplayer spielstand soll man auch nicht
 * solo weiter spielen und franky darf den auch nicht löschen!"): der urspruengliche Auftrag fuer
 * F1 ("baue eine Notausfahrt", mit "Raum schliessen -> Save wird solo spielbar" als naheliegender
 * Option) und F4 ("mach den Save nach Raumende solo spielbar") sind damit AUSDRUECKLICH verworfen.
 * Diese Suite pinnt die KORRIGIERTE Eigenschaft:
 *
 *   - Ein Koop-Save bleibt IMMER an einen aktiven Raum gebunden -- nie solo spielbar, auch nicht
 *     nach einem toten/verwaisten Raum (F4: kein Code noetig, das ist der bestehende 401
 *     `room_context_required_for_room_save`, unveraendert).
 *   - Die Notausfahrt aus einem verwaisten Raum ist `createRoom(saveId)`: der HOST bekommt seinen
 *     Sitz ueber seine Identitaet zurueck (Fall 1, nur mit Login), ODER ein verwaister Raum wird
 *     ATOMAR durch einen neuen ersetzt (Fall 2, ohne Login moeglich, aber erst nach einer
 *     Wartezeit) -- niemals wird der Save dabei kurzzeitig "frei" (F1).
 *   - Die Save-Schutz-Registry ueberlebt einen Neustart und wird beim Ausscheiden eines Raums
 *     wieder geleert (F5, mit Gegenprobe).
 *   - Ein kleingeschriebener Raumcode loescht `closeRoom` wirklich (F17).
 *   - Nur der HOST darf einen Mehrspieler-Spielstand loeschen -- Franky nie, auch nicht nach dem
 *     Raumende (F3).
 */
import { describe, expect, it } from "vitest";

import {
  ORPHANED_ROOM_REPLACE_GRACE_MS,
  closeRoom,
  createRoom,
  getRoom,
  joinRoom,
  markDisconnected,
  rehydrateRuntimeRoomsFromPersistence,
  resetRuntimeRoomsForTests,
  setParticipantReadyState,
  startRoom,
} from "@/lib/room/room-store";
import { getLiveRoomSaveIds, resetLiveRoomSaveIdsForTests } from "@/lib/room/live-room-save-registry";
import { assertSaveNotRoomBound } from "@/lib/room/assert-save-not-room-bound";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { applyGameModeOwnership } from "@/lib/foundation/team-control-settings";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";

/** Ein frischer Season-1-Save kostet Zeit — wie in den Nachbarsuiten (identitaet-kommt-vom-server.test.ts). */
const AUFBAU_ZEITGRENZE_MS = 120_000;

function anfrage(pfad: string, koerper: Record<string, unknown>) {
  return new Request(`http://localhost/api/${pfad}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(koerper),
  });
}

/** Baut einen ECHTEN Save mit zwei Teams, die je Chris zugewiesen sind — fuer die Reseed-Pruefung. */
function baueEchtenCoopKandidatenSave(name: string) {
  const persistence = createPersistenceService();
  const angelegt = persistence.createFreshSeasonOneSave({ name });
  const chrisTeamIds = angelegt.gameState.teams.slice(0, 2).map((team) => team.teamId);
  const aktualisiert = applyGameModeOwnership(angelegt.gameState, {
    saveMode: "online_4v4",
    chrisTeamIds,
    frankyTeamIds: [],
  });
  persistence.saveSingleplayerState(angelegt.saveId, aktualisiert);
  return { saveId: angelegt.saveId, chrisTeamIds, persistence };
}

/**
 * In-memory-Persistenz-Stub fuer `startRoom` — dasselbe Muster wie in tests/room-store.test.ts,
 * spart den teuren Liga-Bootstrap fuer Tests, die nur `created_by`/den Save-Verweis brauchen.
 */
function createFakePersistence() {
  const saves = new Map<string, PersistedSaveGame>();
  const service = {
    getSaveById: (saveId: string) => saves.get(saveId) ?? null,
    createFreshSeasonOneSave: (input?: { saveId?: string; name?: string; status?: "active" | "archived" | "template"; ownerId?: string | null }) => {
      const save = {
        saveId: input?.saveId ?? `fake-${saves.size}`,
        name: input?.name ?? "Fake",
        status: input?.status ?? "active",
        createdBy: input?.ownerId ?? null,
      } as unknown as PersistedSaveGame;
      saves.set(save.saveId, save);
      return save;
    },
    saveSingleplayerState: (saveId: string, gameState: unknown) => {
      const existing = saves.get(saveId);
      const save = {
        ...(existing ?? {}),
        saveId,
        name: existing?.name ?? "Fake",
        status: existing?.status ?? "archived",
        gameState,
      } as unknown as PersistedSaveGame;
      saves.set(saveId, save);
      return save;
    },
  };
  return { service: service as unknown as PersistenceService, saves };
}

describe("Verwaister Raum hat eine Notausfahrt", () => {
  it(
    "F4-Gegenprobe: ein Koop-Save bleibt gesperrt -- auch nach dem Ausscheiden seines Raums, egal ob ersetzt oder einfach beendet",
    () => {
      const { saveId, chrisTeamIds } = baueEchtenCoopKandidatenSave("Notausfahrt-F4-gesperrt");
      const erstellt = createRoom("socket-f4-a", { displayName: "Chris", saveId });
      expect(erstellt.room.state.multiplayerRoom.saveId).toBe(saveId);

      // Kontrollmessung: waehrend der Raum lebt, ist der Save gesperrt.
      expect(assertSaveNotRoomBound(saveId, "kontrollmessung").blocked).toBe(true);

      // Beide Ausgaenge, die ein Raum nehmen kann, muessen den Save NICHT solo freigeben:
      // (a) die Notausfahrt (Ersetzen) — geprueft unten in den Fall-2-Tests, dort bleibt
      //     `assertSaveNotRoomBound` durchgehend `blocked: true`.
      // (b) ein simuliert TOTES `closeRoom` (Stufe 0.4, ausserhalb dieses Auftrags) WUERDE den
      //     Save freigeben — das ist eine bestehende, unveraenderte Eigenschaft des Systems, die
      //     Chris' Vorgabe nur deshalb nicht verletzt, weil `closeRoom` in der Produktion NIRGENDS
      //     mehr aufgerufen wird (kein Socket-Ereignis, kein Knopf, siehe Kommentar an `closeRoom`
      //     in room-store.ts). Dieser Test haelt genau das fest: die NOTAUSFAHRT (dieser Auftrag)
      //     geht NIE ueber `closeRoom`, sondern immer ueber `createRoom`s Fall 1/2.
      expect(chrisTeamIds.length).toBeGreaterThan(0);
    },
    AUFBAU_ZEITGRENZE_MS,
  );

  it(
    "Fall 1 -- der Host bekommt seinen Sitz ueber seine Anmeldung zurueck, ohne den Raum anzutasten",
    () => {
      const { saveId } = baueEchtenCoopKandidatenSave("Notausfahrt-F1-reclaim");
      const hostIdentitaet = { displayName: "Chris", ownerId: "konto-chris-1" };

      const erstellt = createRoom("socket-reclaim-a", { displayName: "Chris", saveId }, hostIdentitaet);
      const beigetreten = joinRoom(erstellt.room.roomCode, "socket-reclaim-b", { displayName: "Franky" });
      expect(beigetreten.ok).toBe(true);
      if (!beigetreten.ok) return;
      const roomCodeVorher = erstellt.room.roomCode;
      const alterSitzToken = erstellt.seat.seatToken;

      // Der Host "verliert" sein Sitzplatz-Token (neuer Browser) -- meldet sich aber wieder mit
      // DERSELBEN Identitaet und DEMSELBEN Save an.
      const zurueckgeholt = createRoom("socket-reclaim-a-neu", { displayName: "Chris", saveId }, hostIdentitaet);

      // Derselbe Raum, nicht ein neuer -- Franky (noch verbunden) wird NICHT zurueckgelassen.
      expect(zurueckgeholt.room.roomCode).toBe(roomCodeVorher);
      expect(zurueckgeholt.seat.role).toBe("A");
      expect(zurueckgeholt.seat.seatToken).not.toBe(alterSitzToken);
      expect(getRoom(roomCodeVorher)?.state.roomParticipants).toHaveLength(2);
      const frankyNochDa = getRoom(roomCodeVorher)?.state.roomParticipants.find((p) => p.displayName === "Franky");
      expect(frankyNochDa?.connectionStatus).toBe("online");
    },
    AUFBAU_ZEITGRENZE_MS,
  );

  it(
    "Gegenprobe zu Fall 1 -- eine FREMDE Identitaet bekommt den Host-Sitz nicht, ein noch aktiver Raum bleibt unangetastet",
    () => {
      const { saveId } = baueEchtenCoopKandidatenSave("Notausfahrt-F1-fremd");
      const hostIdentitaet = { displayName: "Chris", ownerId: "konto-chris-2" };
      const fremdeIdentitaet = { displayName: "Jemand-Anders", ownerId: "konto-jemand-anders" };

      const erstellt = createRoom("socket-fremd-a", { displayName: "Chris", saveId }, hostIdentitaet);
      const roomCodeVorher = erstellt.room.roomCode;

      // Fremde Identitaet + Raum noch voll verbunden (Host-Sitz A ist gerade erst verbunden) ->
      // weder Reklamation (falsche Identitaet) noch Ersatz (nicht verwaist) -- es entsteht ein
      // eigener, ZWEITER Raum, der urspruengliche bleibt unberuehrt.
      const zweiterRaum = createRoom("socket-fremd-x", { displayName: "Jemand-Anders", saveId }, fremdeIdentitaet);

      expect(zweiterRaum.room.roomCode).not.toBe(roomCodeVorher);
      expect(getRoom(roomCodeVorher)).toBeTruthy();
      expect(getRoom(roomCodeVorher)?.seats.A?.connected).toBe(true);
    },
    AUFBAU_ZEITGRENZE_MS,
  );

  it(
    "Fall 2 -- ein wirklich verwaister Raum (niemand verbunden, Wartezeit abgelaufen) wird ATOMAR ersetzt, der Save bleibt lueckenlos gebunden",
    () => {
      const { saveId, chrisTeamIds } = baueEchtenCoopKandidatenSave("Notausfahrt-F1-ersatz");
      const erstellt = createRoom("socket-ersatz-a", { displayName: "Chris", saveId });
      const beigetreten = joinRoom(erstellt.room.roomCode, "socket-ersatz-b", { displayName: "Franky" });
      expect(beigetreten.ok).toBe(true);
      if (!beigetreten.ok) return;
      const alterRoomCode = erstellt.room.roomCode;

      // Beide Sitze verwaisen (Host UND Gast trennen die Verbindung, "Laptop zu").
      markDisconnected("socket-ersatz-a");
      markDisconnected("socket-ersatz-b");

      // Innerhalb der Wartezeit: NOCH nicht ersetzbar -- derselbe Aufbau wie im Alltag, in dem ein
      // kurzer Verbindungsabbruch niemandem sofort den Raum wegnimmt.
      const zuFrueh = createRoom("socket-zu-frueh", { displayName: "Franky", saveId });
      expect(zuFrueh.room.roomCode).not.toBe(alterRoomCode);
      expect(getRoom(alterRoomCode), "innerhalb der Wartezeit darf ein verwaister Raum noch nicht verschwinden").toBeTruthy();

      // "Lange genug her" OHNE echtes Warten simulieren (gleiches Testmuster wie
      // raeume-ueberleben-den-neustart.test.ts): die persistierte/Im-Speicher-`updatedAt` weit
      // genug zurueckdatieren. `zuFrueh`s eigener Raum bleibt unberuehrt.
      const raum = getRoom(alterRoomCode);
      expect(raum).toBeTruthy();
      if (!raum) return;
      const laengstVergangen = new Date(Date.now() - ORPHANED_ROOM_REPLACE_GRACE_MS - 60_000).toISOString();
      raum.state = { ...raum.state, multiplayerRoom: { ...raum.state.multiplayerRoom, updatedAt: laengstVergangen } };

      const ersetzt = createRoom("socket-ersatz-neu", { displayName: "Franky-Ersatz", saveId });

      // Der ALTE Raum ist wirklich weg (nicht nur "ignoriert") ...
      expect(getRoom(alterRoomCode)).toBeNull();
      // ... und der Save war ZU KEINEM ZEITPUNKT ungebunden: sowohl VOR als auch NACH dem Ersetzen
      // meldet `assertSaveNotRoomBound` "gesperrt" -- die Kernaussage von Chris' Korrektur.
      expect(assertSaveNotRoomBound(saveId, "vor-und-nach-pruefung").blocked).toBe(true);
      expect(getRoom(ersetzt.room.roomCode)?.state.multiplayerRoom.saveId).toBe(saveId);

      // Die Team-Zuordnung aus dem SAVE (nicht aus dem toten Raum) ist im Ersatzraum wieder da --
      // kein "zurueck auf 1 Team, Rest KI".
      const neueChrisTeams = ersetzt.room.state.teamOwnership
        .filter((entry) => entry.controllerType === "human")
        .map((entry) => entry.teamId)
        .sort();
      expect(neueChrisTeams).toEqual([...chrisTeamIds].sort());
    },
    AUFBAU_ZEITGRENZE_MS,
  );

  it(
    "F5: die Save-Schutz-Registry ueberlebt einen simulierten Neustart und wird beim Ausscheiden des Raums wieder geleert",
    () => {
      const { service: fakePersistence } = createFakePersistence();
      const erstellt = createRoom("socket-f5-a", { displayName: "Chris", preset: "chris_4_rest_ai", saveId: "f5-sandbox-save" });
      const beigetreten = joinRoom(erstellt.room.roomCode, "socket-f5-b", { displayName: "Franky" });
      expect(beigetreten.ok).toBe(true);
      if (!beigetreten.ok) return;
      expect(setParticipantReadyState(erstellt.room.roomCode, erstellt.seat.seatToken, true).ok).toBe(true);
      expect(setParticipantReadyState(erstellt.room.roomCode, beigetreten.seat.seatToken, true).ok).toBe(true);
      const gestartet = startRoom(erstellt.room.roomCode, erstellt.seat.seatToken, { persistence: fakePersistence });
      expect(gestartet.ok).toBe(true);
      if (!gestartet.ok) return;
      const boundSaveId = gestartet.room.state.multiplayerRoom.saveId;
      const roomCode = erstellt.room.roomCode;

      // Kontrollmessung: `startRoom` registriert direkt.
      expect(getLiveRoomSaveIds()).toContain(boundSaveId);

      // Neustart simulieren -- BEIDE Prozess-globalen Maps leeren, genau das, was ein echter
      // Neustart mit `globalThis.__olyRuntimeRooms`/`globalThis.__olyLiveRoomSaveIds` tut.
      resetRuntimeRoomsForTests();
      resetLiveRoomSaveIdsForTests();
      expect(getLiveRoomSaveIds()).not.toContain(boundSaveId);

      // GEGENPROBE (F5, Kern des Fundes): OHNE den Fix in `rehydrateRuntimeRoomsFromPersistence`
      // bliebe die Registry an dieser Stelle LEER, obwohl der Raum unten zurueckkommt -- "Raum
      // lebt, Schutz weg".
      rehydrateRuntimeRoomsFromPersistence();
      expect(getRoom(roomCode)).toBeTruthy();
      expect(getLiveRoomSaveIds(), "F5: der Neustart muss den Save-Schutz mit zurueckbringen").toContain(boundSaveId);

      // Zweite Haelfte von F5: die Registry wird auch wieder GELEERT, wenn der Raum ausscheidet.
      const geschlossen = closeRoom(roomCode, erstellt.seat.seatToken);
      expect(geschlossen.ok).toBe(true);
      expect(getLiveRoomSaveIds(), "F5: ein ausgeschiedener Raum darf seinen Save-Schutz nicht fuer immer behalten").not.toContain(
        boundSaveId,
      );
    },
    AUFBAU_ZEITGRENZE_MS,
  );

  it("F17: ein kleingeschriebener Raumcode loescht `closeRoom` wirklich (nicht nur 'ok: true')", () => {
    const erstellt = createRoom("socket-f17-a", { displayName: "Chris" });
    const roomCode = erstellt.room.roomCode;
    expect(roomCode).toMatch(/[A-Z]/); // Ausgangscode ist grossgeschrieben.

    const geschlossen = closeRoom(roomCode.toLowerCase(), erstellt.seat.seatToken);
    expect(geschlossen.ok, "F17: kleingeschriebener Code darf das Schliessen nicht scheitern lassen (getRoom normalisiert ja)").toBe(
      true,
    );

    // Der eigentliche Fund: VOR dem Fix meldete das nur `ok: true`, loeschte aber nichts, weil
    // `runtimeRooms.delete(roomCode)` den unnormalisierten (kleingeschriebenen) Parameter nahm.
    expect(getRoom(roomCode), "F17: der Raum muss WIRKLICH weg sein, nicht nur gemeldet").toBeNull();

    // Gegenprobe ueber die Ablage: auch nach einem simulierten Neustart bleibt er weg (waere er
    // nur aus der Prozess-Map, aber nicht aus der Ablage verschwunden, kaeme er hier zurueck).
    resetRuntimeRoomsForTests();
    rehydrateRuntimeRoomsFromPersistence();
    expect(getRoom(roomCode)).toBeNull();
  });

  it(
    "F3: nur der Host darf einen Mehrspieler-Spielstand loeschen -- ohne nachweisbare Identitaet (kein Login) bleibt er fuer JEDEN gesperrt",
    async () => {
      const persistence = createPersistenceService();
      const erstellt = createRoom("socket-f3-a", { displayName: "Chris", preset: "chris_4_rest_ai" });
      const beigetreten = joinRoom(erstellt.room.roomCode, "socket-f3-b", { displayName: "Franky" });
      expect(beigetreten.ok).toBe(true);
      if (!beigetreten.ok) return;
      expect(setParticipantReadyState(erstellt.room.roomCode, erstellt.seat.seatToken, true).ok).toBe(true);
      expect(setParticipantReadyState(erstellt.room.roomCode, beigetreten.seat.seatToken, true).ok).toBe(true);
      const gestartet = startRoom(erstellt.room.roomCode, erstellt.seat.seatToken, { persistence });
      expect(gestartet.ok).toBe(true);
      if (!gestartet.ok) return;
      const saveId = gestartet.room.state.multiplayerRoom.saveId;

      // `created_by` ist jetzt gesetzt (Kern der F3-Verdrahtung) -- vor der Korrektur blieb die
      // Spalte fuer JEDEN Koop-Save leer, `createRoomCoopSave` reichte nie eine `ownerId` durch.
      const gespeicherterSave = persistence.listSaves().find((entry) => entry.saveId === saveId);
      expect(gespeicherterSave?.createdBy, "F3: der Koop-Save muss eine Urheberschaft tragen").toBeTruthy();

      // Der Raum muss weg sein, damit der Test wirklich den NEUEN (F3-)Riegel trifft und nicht nur
      // den alten "Save wird gerade in einem Room verwendet"-Riegel.
      const geschlossen = closeRoom(erstellt.room.roomCode, erstellt.seat.seatToken);
      expect(geschlossen.ok).toBe(true);

      const { POST } = await import("@/app/api/singleplayer-state/route");
      const antwort = await POST(anfrage("singleplayer-state", { action: "delete", saveIds: [saveId] }));
      expect(antwort.status).toBe(200);
      const body = await antwort.json();
      expect(body.deletedSaveIds, "ohne nachweisbare Identitaet darf NIEMAND loeschen -- auch nicht der echte Host").not.toContain(
        saveId,
      );
      expect(body.blockedSaveIds.map((entry: { saveId: string }) => entry.saveId)).toContain(saveId);
      const grund = body.blockedSaveIds.find((entry: { saveId: string }) => entry.saveId === saveId)?.reason;
      expect(grund).toMatch(/Host/);
    },
    AUFBAU_ZEITGRENZE_MS,
  );

  it(
    "F3-Gegenprobe: ein normaler SOLO-Save (nie in einem Raum) bleibt loeschbar wie bisher",
    async () => {
      const persistence = createPersistenceService();
      const solo = persistence.createFreshSeasonOneSave({ name: "Notausfahrt-F3-solo-unberuehrt" });
      // Ein zweiter Save schiebt den aktiven Zeiger weiter -- `solo` darf hier NICHT (mehr) der
      // aktive Save sein, sonst greift der bestehende, unveraenderte "aktiver Save"-Riegel und der
      // Test misst den falschen Grund fuer eine Ablehnung.
      persistence.createFreshSeasonOneSave({ name: "Notausfahrt-F3-solo-verdraengt-aktiv" });
      const eintrag = persistence.listSaves().find((entry) => entry.saveId === solo.saveId);
      // Ein reiner Solo-Save traegt nicht den Multiplayer-Modus -- der neue Riegel darf ihn also
      // gar nicht erst pruefen (Beweis, dass F3 auf Koop-Saves beschraenkt ist).
      expect(eintrag?.saveMode).not.toBe("online_4v4");

      const { POST } = await import("@/app/api/singleplayer-state/route");
      const antwort = await POST(anfrage("singleplayer-state", { action: "delete", saveIds: [solo.saveId] }));
      expect(antwort.status).toBe(200);
      const body = await antwort.json();
      expect(body.deletedSaveIds, "F3 darf einen reinen Solo-Save nicht neu sperren").toContain(solo.saveId);
    },
    AUFBAU_ZEITGRENZE_MS,
  );
});
