/**
 * IDENTITAET KOMMT VOM SERVER, NICHT AUS DEM BODY — Stufe 0.2 + 0.3
 * (docs/MULTIPLAYER_VOLLAUSBAU_PLAN.md, Befund B1 + B2).
 *
 * BEFUND B2: `authorizeLocalSingleplayerTeamWrite` (server-authoritative-write-guard.ts) prueft
 * `getTeamOwner(settings) === activeOwnerId` — und `activeOwnerId` kam bis eben aus dem
 * Request-Body. Der Client schickte dort aber nicht die eigene Identitaet, sondern die Owner-ID
 * des ZIELTEAMS (`use-foundation-shell-router-body-scope.tsx:1352-1368`). Der Vergleich war damit
 * fuer jedes `manual`-Team immer wahr: Chris konnte Frankys Teams bespielen und umgekehrt.
 *
 * BEFUND B1 (die stille Degradierung): faellt ein Raum aus der In-Memory-Map (Neustart kurz vor
 * dem Rehydrieren, echter Verlust), fiel der Schreib-Waechter bislang OHNE jede Pruefung auf den
 * Einzelspieler-Pfad zurueck — ein raumgebundener Save wurde faktisch wie Solo behandelt.
 *
 * Diese Suite haelt vier EIGENSCHAFTEN fest, nicht die Umsetzung. Vorlage:
 * `tests/coop-write-routes-zwei-sitzungen.test.ts` — echte Raeume, zwei echte Sitzungen, KEIN
 * Guard-Mock.
 */
import { beforeAll, describe, expect, it } from "vitest";

import { DEFAULT_ACTIVE_OWNER_ID, FRANKY_OWNER_ID, createChrisFrankyTeamControlSetting } from "@/lib/foundation/team-control-settings";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { resetDatabaseForTests } from "@/lib/persistence/sqlite";
import { createRoom, joinRoom, resetRuntimeRoomsForTests } from "@/lib/room/room-store";
import { erstelleCoopRaum, schreibKontext, type CoopRaum } from "@/tests/_helpers/coop-room-harness";

const AUFBAU_ZEITGRENZE_MS = 120_000;

function anfrage(pfad: string, koerper: Record<string, unknown>) {
  return new Request(`http://localhost/api/${pfad}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(koerper),
  });
}

/**
 * Baut einen SOLO-Save (kein Raum) mit einem Team, das explizit FRANKY gehoert, und einem, das
 * dem lokalen Standard-Owner (Chris) gehoert — die Konstellation, die Eigenschaft 1 + 4 braucht.
 */
function baueSoloSaveMitFrankyTeam(name: string) {
  const persistence = createPersistenceService();
  const angelegt = persistence.createFreshSeasonOneSave({ name });
  const teams = angelegt.gameState.teams;
  if (teams.length < 2) {
    throw new Error("Frischer Season-1-Save hat weniger als zwei Teams — Aufbau unbrauchbar.");
  }
  const frankyTeam = teams[0]!;
  const chrisTeam = teams[1]!;

  const nextControlSettings = {
    ...angelegt.gameState.seasonState.teamControlSettings,
    [frankyTeam.teamId]: createChrisFrankyTeamControlSetting(frankyTeam, "franky"),
    [chrisTeam.teamId]: createChrisFrankyTeamControlSetting(chrisTeam, "chris"),
  };

  const gespeichert = persistence.saveSingleplayerState(angelegt.saveId, {
    ...angelegt.gameState,
    seasonState: { ...angelegt.gameState.seasonState, teamControlSettings: nextControlSettings },
  });

  return { saveId: gespeichert.saveId, frankyTeamId: frankyTeam.teamId, chrisTeamId: chrisTeam.teamId };
}

describe("Identitaet kommt vom Server", () => {
  let raum: CoopRaum;

  beforeAll(() => {
    resetDatabaseForTests();
    const saveId = createPersistenceService().createFreshSeasonOneSave({ name: "Identitaet-Probe-Raum" }).saveId;
    raum = erstelleCoopRaum(saveId);
  }, AUFBAU_ZEITGRENZE_MS);

  it(
    "Eigenschaft 1: eine erfundene activeOwnerId im Body verschafft keinen Zugriff auf ein fremdes Team (solo, kein Raum, kein Login)",
    async () => {
      const { saveId, frankyTeamId } = baueSoloSaveMitFrankyTeam("Identitaet-Probe-Solo-Fremd");
      const { POST } = await import("@/app/api/team-settings/control/route");

      // DER KERN DES ALTEN LOCHS: activeOwnerId behauptet, Franky zu sein — genau das Muster aus
      // `withRoomBody` vor dem Fix (die Owner-ID des ZIELTEAMS statt der eigenen). Ohne Login ist
      // die tatsaechliche Identitaet aber immer der lokale Standard-Owner (Chris) — die Anfrage
      // muss also abgelehnt werden, ganz gleich, was im Body behauptet wird.
      const antwort = await POST(
        anfrage("team-settings/control", {
          saveId,
          teamId: frankyTeamId,
          control: { notes: "uebernommen?" },
          activeOwnerId: FRANKY_OWNER_ID,
        }),
      );

      expect(antwort.status, "eine erfundene activeOwnerId im Body durfte kein fremdes Team freischalten").toBe(403);
    },
    AUFBAU_ZEITGRENZE_MS,
  );

  it(
    "Eigenschaft 2: im Raum entscheidet das Sitz-Token — mit Frankys Token ist Chris' Team gesperrt und umgekehrt",
    async () => {
      const { POST } = await import("@/app/api/contracts/dissolution/route");

      // Franky schreibt mit SEINEM Sitz-Token auf Chris' Team, behauptet aber per activeOwnerId,
      // Chris zu sein — im Raum wird dieses Feld nie gelesen (das Sitz-Token ist der Ausweis).
      const frankyAufChris = await POST(
        anfrage("contracts/dissolution", {
          saveId: raum.saveId,
          seasonId: "season-1",
          teamId: raum.chrisTeam,
          playerId: "spieler-existiert-nicht",
          decision: "declined",
          ...schreibKontext(raum, raum.franky),
          activeOwnerId: DEFAULT_ACTIVE_OWNER_ID,
        }),
      );
      expect(frankyAufChris.status, "Frankys Sitz-Token + eine erfundene activeOwnerId=Chris duerfen Chris' Team nicht freischalten").toBe(403);

      // Umgekehrt: Chris' Sitz-Token auf Frankys Team, mit activeOwnerId=Franky behauptet.
      const chrisAufFranky = await POST(
        anfrage("contracts/dissolution", {
          saveId: raum.saveId,
          seasonId: "season-1",
          teamId: raum.frankysTeam,
          playerId: "spieler-existiert-nicht",
          decision: "declined",
          ...schreibKontext(raum, raum.chris),
          activeOwnerId: FRANKY_OWNER_ID,
        }),
      );
      expect(chrisAufFranky.status, "Chris' Sitz-Token + eine erfundene activeOwnerId=Franky duerfen Frankys Team nicht freischalten").toBe(403);

      // Gegenprobe: das jeweils EIGENE Team bleibt bedienbar — der Guard blockt nicht pauschal.
      const chrisAufEigenes = await POST(
        anfrage("contracts/dissolution", {
          saveId: raum.saveId,
          seasonId: "season-1",
          teamId: raum.chrisTeam,
          playerId: "spieler-existiert-nicht",
          decision: "declined",
          ...schreibKontext(raum, raum.chris),
        }),
      );
      expect(chrisAufEigenes.status, "der Guard wies den rechtmaessigen Besitzer ab").not.toBe(403);
    },
    AUFBAU_ZEITGRENZE_MS,
  );

  it(
    "Eigenschaft 3: ein raumgebundener Spielstand laesst sich ohne Raumkontext nicht beschreiben, auch wenn der Raum nicht auffindbar ist",
    async () => {
      // Eigener, isolierter Raum fuer diesen Test: `resetRuntimeRoomsForTests()` wirft GLEICH
      // ALLE Raeume aus dem Speicher (Neustart-Simulation) — mit dem geteilten `raum` aus
      // `beforeAll` wuerde das die anderen Faelle in dieser Datei durcheinanderbringen. Deshalb
      // dieser Fall zuletzt UND mit eigenem Save/Raum.
      const eigenerSaveId = createPersistenceService().createFreshSeasonOneSave({
        name: "Identitaet-Probe-Raum-Weg",
      }).saveId;
      const erstellt = createRoom("socket-raum-weg-a", { displayName: "Chris", saveId: eigenerSaveId });
      const beigetreten = joinRoom(erstellt.room.roomCode, "socket-raum-weg-b", { displayName: "Franky" });
      expect(beigetreten.ok, "Aufbau: Franky musste dem Raum beitreten").toBe(true);

      // Neustart simulieren: die Prozess-Map ist leer, wie nach einem echten Container-Neustart
      // VOR dem Rehydrieren (server.ts ruft rehydrateRuntimeRoomsFromPersistence() sonst zuerst
      // auf) — die Ablage (SQLite `rooms`) traegt die Bindung an den Save weiterhin.
      resetRuntimeRoomsForTests();

      const { POST } = await import("@/app/api/contracts/dissolution/route");
      const antwort = await POST(
        anfrage("contracts/dissolution", {
          saveId: eigenerSaveId,
          seasonId: "season-1",
          teamId: "irgendein-team",
          playerId: "irgendein-spieler",
          decision: "declined",
          // BEWUSST kein roomCode/participantId/seatToken — genau der Fall, den ein Client
          // schickt, der (noch) nicht weiss, dass der Raum im Speicher verloren ging.
        }),
      );

      expect(
        antwort.status,
        "ein raumgebundener Save durfte trotz nicht auffindbarem Raum nicht auf den Solo-Pfad durchrutschen",
      ).toBe(409);
      const body = await antwort.json();
      expect(body.error).toBe("admin_write_blocked_room_bound_save:server_room_write_fallback");
    },
    AUFBAU_ZEITGRENZE_MS,
  );

  it(
    "Eigenschaft 4 (Regression): Solo ohne Login laeuft unveraendert — das eigene Team bleibt bedienbar",
    async () => {
      const { saveId, chrisTeamId } = baueSoloSaveMitFrankyTeam("Identitaet-Probe-Solo-Eigenes");
      const { POST } = await import("@/app/api/team-settings/control/route");

      const antwort = await POST(
        anfrage("team-settings/control", {
          saveId,
          teamId: chrisTeamId,
          control: { notes: "eigene Notiz" },
        }),
      );

      expect(antwort.status, "Solo ohne Login durfte das eigene Team nicht sperren").toBe(200);
      const body = await antwort.json();
      expect(body.success).toBe(true);
    },
    AUFBAU_ZEITGRENZE_MS,
  );
});
