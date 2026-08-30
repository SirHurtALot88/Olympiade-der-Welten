/**
 * B4/A4: DER MEHRSPIELER-WEG IN DEN BATTLE-MODUS.
 *
 * Chris' Vorgabe war „battle mode muss in allen modi verfügbar sein also solo und multiplayer".
 * Erreichbar war er in KEINEM: `createRoom` kannte keinen `playMode`, `createRoomCoopSave` auch
 * nicht — dort stand `presetId: "online_4v4"` fest verdrahtet, ohne Spielart. Ein Raum konnte
 * folglich nie einen Battle-Spielstand erzeugen.
 *
 * DAZU DER ZWEITE, SCHWERERE FEHLER (A4): die Lobby verteilte ihre Teams aus `ONLINE_ROOM_TEAM_IDS`
 * — der 32er-Liga, fest verdrahtet. Im 1v1-Preset bekommt der Host genau
 * `FOUR_PLUS_FOUR_HOST_TEAM_IDS.slice(0, 1)` = `P-S`, und `P-S` ist kein Battle-Team. Der Host
 * stand danach mit NULL Teams da und lief in „Weise zuerst dir mindestens ein Team zu."
 */
import fs from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { applyRoomTeamSelection, createRoom, joinRoom, setParticipantReadyState, startRoom } from "@/lib/room/room-store";
import { ONLINE_ROOM_TEAM_IDS, resolveRoomTeamPool } from "@/lib/room/online-room-model";
import { BATTLE_MODE_SPIELTAG_ANZAHL, BATTLE_MODE_TEAM_ANZAHL } from "@/lib/season/battle-mode-spielplan";
import type { GameState } from "@/lib/data/olyDataTypes";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";

/** Wie in tests/room-store.test.ts: nur die Methoden, die startRoom/createRoomCoopSave anfassen. */
function createFakePersistence() {
  const saves = new Map<string, PersistedSaveGame>();
  const service = {
    getSaveById: (saveId: string) => saves.get(saveId) ?? null,
    createFreshSeasonOneSave: (input?: { saveId?: string; name?: string; status?: string }) => {
      const save = { saveId: input?.saveId ?? `fake-${saves.size}`, name: input?.name ?? "Fake" } as unknown as PersistedSaveGame;
      saves.set(save.saveId, save);
      return save;
    },
    saveSingleplayerState: (saveId: string, gameState: unknown) => {
      const save = { ...(saves.get(saveId) ?? {}), saveId, gameState } as unknown as PersistedSaveGame;
      saves.set(saveId, save);
      return save;
    },
  };
  return { service: service as unknown as PersistenceService, saves };
}

/** Der einzige gebundene Koop-Save, den `startRoom` angelegt hat. */
function gebundenerSave(saves: Map<string, PersistedSaveGame>): GameState {
  const mitZustand = [...saves.values()].filter((save) => (save as { gameState?: GameState }).gameState);
  expect(mitZustand).toHaveLength(1);
  return (mitZustand[0] as unknown as { gameState: GameState }).gameState;
}

describe("Raum anlegen mit playMode", () => {
  it("ohne Angabe bleibt der Raum Management — das Feld fehlt ganz, wie vor dem Battle-Modus", () => {
    const { room } = createRoom("socket-mgmt", { displayName: "Chris" });
    expect(room.state.multiplayerRoom.playMode).toBeUndefined();
    expect(room.state.teamOwnership).toHaveLength(32);
  });

  it("mit playMode:battle verteilt schon die Erst-Zuteilung aus dem 16er-Pool", () => {
    const { room } = createRoom("socket-battle", { displayName: "Chris", playMode: "battle" });
    expect(room.state.multiplayerRoom.playMode).toBe("battle");
    expect(room.state.teamOwnership).toHaveLength(BATTLE_MODE_TEAM_ANZAHL);
    const pool = resolveRoomTeamPool("battle");
    for (const eintrag of room.state.teamOwnership) {
      expect(pool).toContain(eintrag.teamId);
    }
    // "1 Team, Rest KI" ist die Erst-Zuteilung aus `createInitialRoomState`.
    expect(room.state.teamOwnership.filter((eintrag) => eintrag.controllerType === "human")).toHaveLength(1);
  });

  it("1v1 im Battle-Raum: der Host bekommt ein ECHTES Team statt des nicht existierenden P-S", () => {
    const { room, seat } = createRoom("socket-1v1", {
      displayName: "Chris",
      preset: "chris_1_franky_1_rest_ai",
      playMode: "battle",
    });
    const host = room.state.teamOwnership.filter((eintrag) => eintrag.participantId === seat.participantId);
    expect(host).toHaveLength(1);
    expect(host[0]!.teamId).not.toBe("P-S");
    expect(resolveRoomTeamPool("battle")).toContain(host[0]!.teamId);
  });
});

describe("Raum starten: der frische Koop-Save erbt die Spielart des Raums", () => {
  it("battle-Raum -> Battle-Spielstand mit 16 Teams und 20 Spieltagen", () => {
    const persistence = createFakePersistence();
    const created = createRoom("socket-start-battle", {
      displayName: "Chris",
      preset: "chris_1_franky_1_rest_ai",
      playMode: "battle",
    });
    const joined = joinRoom(created.room.roomCode, "socket-start-battle-2", { displayName: "Franky" });
    expect(joined.ok).toBe(true);
    if (!joined.ok) return;

    expect(setParticipantReadyState(created.room.roomCode, created.seat.seatToken, true).ok).toBe(true);
    expect(setParticipantReadyState(created.room.roomCode, joined.seat.seatToken, true).ok).toBe(true);

    const started = startRoom(created.room.roomCode, created.seat.seatToken, { persistence: persistence.service });
    // HIER waere der Raum gescheitert: mit `P-S` als einzigem Host-Team haette `startRoom` an
    // "Weise zuerst dir mindestens ein Team zu." abgebrochen. Der Fehler war LATENT — ohne
    // `playMode` am Raum kam nie ein Battle-Pool in die Lobby, dieser Weg war also gar nicht
    // erreichbar. Er waere mit dem ersten Battle-Raum aufgeschlagen.
    expect(started.ok).toBe(true);

    const zustand = gebundenerSave(persistence.saves);
    expect(zustand.playMode).toBe("battle");
    expect(zustand.teams).toHaveLength(BATTLE_MODE_TEAM_ANZAHL);
    expect(zustand.season.matchdayIds).toHaveLength(BATTLE_MODE_SPIELTAG_ANZAHL);
    expect(zustand.seasonState.schedule ?? []).toHaveLength(160);
  }, 120_000);

  it("Management-Raum bleibt unveraendert — 32 Teams, 10 Spieltage, kein playMode im Save", () => {
    const persistence = createFakePersistence();
    const created = createRoom("socket-start-mgmt", { displayName: "Chris", preset: "chris_1_franky_1_rest_ai" });
    const joined = joinRoom(created.room.roomCode, "socket-start-mgmt-2", { displayName: "Franky" });
    expect(joined.ok).toBe(true);
    if (!joined.ok) return;

    expect(setParticipantReadyState(created.room.roomCode, created.seat.seatToken, true).ok).toBe(true);
    expect(setParticipantReadyState(created.room.roomCode, joined.seat.seatToken, true).ok).toBe(true);
    expect(startRoom(created.room.roomCode, created.seat.seatToken, { persistence: persistence.service }).ok).toBe(true);

    const zustand = gebundenerSave(persistence.saves);
    expect(zustand.playMode).toBeUndefined();
    expect(zustand.teams).toHaveLength(32);
    expect(zustand.season.matchdayIds).toHaveLength(10);
  }, 120_000);
});

/**
 * F1: DER TEAM-WAEHLER IN DER LOBBY — er darf nur anbieten, was der Server auch annimmt.
 *
 * GEMESSENER FEHLER: `app/room/[roomCode]/RoomPageClient.tsx` baute seine Team-Tabelle an DREI
 * Stellen aus `ONLINE_ROOM_TEAM_IDS`, der 32er-Liga, fest verdrahtet — die Spielart des Raums kam
 * dort ueberhaupt nicht vor. Solange kein Raum je `playMode: "battle"` tragen konnte, war das
 * harmlos. Seit die Startseite Battle-Raeume anlegt, bot der Waehler in einem Battle-Raum 32
 * Karten an; ein Klick auf eines der 16 Teams, die es dort NICHT gibt, ging ueber
 * `setTeamSelection` -> `applyRoomTeamSelection` -> `applyExplicitTeamOwnershipToState` in
 * `unknown_team_id` und kam als „Unbekanntes Team: <id>." zurueck. Die Bedienung bot also selbst
 * an, was sie danach ablehnte.
 *
 * Die zwei Tests unten messen die BEIDEN Haelften der Zusage: was der Waehler anbietet, wird
 * angenommen — und was er (jetzt) weglaesst, wird tatsaechlich abgelehnt. Der zweite ist der
 * Beweis, dass der erste nicht bloss zufaellig gruen ist.
 */
describe("F1 — der Lobby-Waehler bietet nur Teams an, die der Raum auch annimmt", () => {
  it("Battle-Raum: JEDES Team aus dem Waehler-Pool laesst sich zuweisen", () => {
    const { room, seat } = createRoom("socket-waehler-battle", { displayName: "Chris", playMode: "battle" });
    // GENAU DER AUSDRUCK, MIT DEM DIE SEITE IHRE TABELLE BAUT (`roomTeamIds` in RoomPageClient).
    const waehlerPool = resolveRoomTeamPool(room.state.multiplayerRoom.playMode);
    expect(waehlerPool).toHaveLength(BATTLE_MODE_TEAM_ANZAHL);

    for (const teamId of waehlerPool) {
      const ergebnis = applyRoomTeamSelection(room.roomCode, seat.seatToken, { chrisTeamIds: [teamId], frankyTeamIds: [] });
      expect(ergebnis.ok, `${teamId} wurde angeboten, aber abgelehnt`).toBe(true);
    }
  });

  it("Battle-Raum: die 16 Teams AUSSERHALB des Pools werden abgelehnt — sie duerfen gar nicht erst dastehen", () => {
    const { room, seat } = createRoom("socket-waehler-battle-ausserhalb", { displayName: "Chris", playMode: "battle" });
    const waehlerPool = resolveRoomTeamPool(room.state.multiplayerRoom.playMode);
    const ausserhalb = ONLINE_ROOM_TEAM_IDS.filter((teamId) => !waehlerPool.includes(teamId));
    expect(ausserhalb.length).toBeGreaterThan(0);

    for (const teamId of ausserhalb) {
      const ergebnis = applyRoomTeamSelection(room.roomCode, seat.seatToken, { chrisTeamIds: [teamId], frankyTeamIds: [] });
      expect(ergebnis.ok, `${teamId} gibt es im Battle-Raum nicht und wurde trotzdem angenommen`).toBe(false);
      if (!ergebnis.ok) {
        expect(ergebnis.error).toContain("Unbekanntes Team");
      }
    }
  });

  it("Management-Raum: der Waehler zeigt weiterhin ALLE 32 — dort aendert sich nichts", () => {
    const { room, seat } = createRoom("socket-waehler-mgmt", { displayName: "Chris" });
    const waehlerPool = resolveRoomTeamPool(room.state.multiplayerRoom.playMode);
    expect(waehlerPool).toBe(ONLINE_ROOM_TEAM_IDS);
    expect(waehlerPool).toHaveLength(32);

    for (const teamId of waehlerPool) {
      const ergebnis = applyRoomTeamSelection(room.roomCode, seat.seatToken, { chrisTeamIds: [teamId], frankyTeamIds: [] });
      expect(ergebnis.ok, `${teamId} wurde angeboten, aber abgelehnt`).toBe(true);
    }
  });

  /**
   * Die Tabelle selbst ist React und wird hier nicht gerendert — diese Zusicherung haelt deshalb
   * fest, dass die Seite ueberhaupt am pool-bewussten Weg haengt. Dieselbe Bauart wie
   * `tests/multiplayer-room-ui-contract.test.ts`.
   */
  it("RoomPageClient nimmt seinen Pool aus `resolveRoomTeamPool(playMode)` statt aus der 32er-Liste", async () => {
    const quelltext = await fs.readFile(path.join(process.cwd(), "app/room/[roomCode]/RoomPageClient.tsx"), "utf8");

    expect(quelltext).toContain("resolveRoomTeamPool(state?.multiplayerRoom.playMode)");
    expect(quelltext).toContain("roomTeamIds.map((teamId)");
    expect(quelltext).toContain("roomTeamIds.filter((teamId) => teamAssignment[teamId] === \"chris\")");
    expect(quelltext).toContain("roomTeamIds.filter((teamId) => teamAssignment[teamId] === \"franky\")");
    // Der harte Nachweis: die fest verdrahtete 32er-Liste kommt im CODE nicht mehr vor. Kommentare
    // sind ausgenommen — der Befund-Kommentar an `roomTeamIds` nennt sie absichtlich beim Namen,
    // und ein Test, der das Erklaeren verbietet, waere der falsche Test.
    const ohneKommentare = quelltext.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(ohneKommentare).not.toContain("ONLINE_ROOM_TEAM_IDS");
  });
});
