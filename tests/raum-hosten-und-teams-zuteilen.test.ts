import { describe, expect, it } from "vitest";

import {
  applyRoomOwnershipPreset,
  applyRoomTeamSelection,
  createRoom,
  getRoom,
  joinRoom,
  recordRoomGameplayWrite,
  setParticipantReadyState,
  startRoom,
} from "@/lib/room/room-store";
import { resolveFrankyParticipant } from "@/lib/room/online-room-model";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";

/**
 * STUFE 1 (docs/MULTIPLAYER_VOLLAUSBAU_PLAN.md) -- Hosten, Einladen, Zuordnung aendern.
 *
 * Diese Suite haelt fuenf EIGENSCHAFTEN fest, keine erfundenen Zahlen:
 *   1. Ein Beitritt darf eine bereits vom Host im Raum gesetzte Team-Zuteilung nicht ueberschreiben.
 *   2. Ohne jede Host-Aktion greift beim Beitritt weiterhin ein sinnvoller Standard.
 *   3. Der Host darf zwischen Spieltagen umverteilen, waehrend eines laufenden Spieltags nicht.
 *   4. Ein Nicht-Host darf nie umverteilen.
 *   5. Die Franky-Erkennung haengt an der Sitzrolle/`ownerId`, nicht am Anzeigenamen.
 */

/** Gleicher In-Memory-Persistence-Stub wie in tests/room-store.test.ts, hier lokal dupliziert,
 * damit diese Suite unabhaengig von dortigen internen Details bleibt. */
function createFakePersistence() {
  const saves = new Map<string, PersistedSaveGame>();
  const service = {
    getSaveById: (saveId: string) => saves.get(saveId) ?? null,
    createFreshSeasonOneSave: (input?: { saveId?: string; name?: string; status?: "active" | "archived" | "template" }) => {
      const save = {
        saveId: input?.saveId ?? `fake-${saves.size}`,
        name: input?.name ?? "Fake",
        status: input?.status ?? "active",
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

describe("Raum hosten und Teams zuteilen", () => {
  it("laesst eine vorhandene Host-Zuteilung beim Beitritt eines Gasts unangetastet", () => {
    // Befund (docs/MULTIPLAYER_VOLLAUSBAU_PLAN.md, "Beitritt loescht die Zuteilung des Hosts"):
    // GEGENPROBE fuer diesen Test steht im Abschlussbericht -- vor der Reparatur ueberschrieb
    // `joinRoom` diese Zuteilung bedingungslos mit dem 4+4-Default.
    const created = createRoom("socket-keep-a", { displayName: "Chris" });

    // Der Host weist sich VOR dem Beitritt des Gasts explizit genau ein Team zu -- ueber die
    // Raum-Aktion, die `RoomPageClient`s "Teams verteilen"-Panel auch in der Lobby sendet.
    const assigned = applyRoomTeamSelection(created.room.roomCode, created.seat.seatToken, {
      chrisTeamIds: ["M-M"],
      frankyTeamIds: [],
    });
    expect(assigned.ok).toBe(true);
    if (!assigned.ok) return;
    expect(assigned.room.state.multiplayerRoom.ownershipAssignedByHost).toBe(true);

    const joined = joinRoom(created.room.roomCode, "socket-keep-b", { displayName: "Franky" });
    expect(joined.ok).toBe(true);
    if (!joined.ok) return;

    const ownership = joined.room.state.teamOwnership;
    // Die Wahl des Hosts steht unveraendert.
    expect(ownership.find((entry) => entry.teamId === "M-M")).toMatchObject({
      controllerType: "human",
      ownerDisplayName: "Chris",
    });
    // "P-S" ist eines der vier Teams, die der alte, ungeprüfte 4+4-Default dem Host zugewiesen
    // haette -- es MUSS AI-kontrolliert bleiben, sonst hat der Beitritt die Zuteilung doch
    // ueberschrieben.
    expect(ownership.find((entry) => entry.teamId === "P-S")).toMatchObject({ controllerType: "ai" });
    expect(ownership.filter((entry) => entry.controllerType === "human")).toHaveLength(1);
  });

  it("wendet ohne jede Host-Zuteilung weiterhin den Standard beim Beitritt an", () => {
    const created = createRoom("socket-default-a", { displayName: "Chris" });
    // Bewusst KEINE Lobby-Aktion vor dem Beitritt -- reiner System-Default aus
    // `createInitialRoomState` (chris_1_rest_ai), noch keine explizite Host-Entscheidung.
    expect(created.room.state.multiplayerRoom.ownershipAssignedByHost).toBe(false);

    const joined = joinRoom(created.room.roomCode, "socket-default-b", { displayName: "Franky" });
    expect(joined.ok).toBe(true);
    if (!joined.ok) return;

    const ownership = joined.room.state.teamOwnership;
    expect(ownership.filter((entry) => entry.controllerType === "human")).toHaveLength(8);
    expect(ownership.filter((entry) => entry.ownerDisplayName === "Chris")).toHaveLength(4);
    expect(ownership.filter((entry) => entry.ownerDisplayName === "Franky")).toHaveLength(4);
  });

  it("erlaubt dem Host das Umverteilen zwischen Spieltagen, sperrt es aber waehrend eines laufenden Spieltags", () => {
    const persistence = createFakePersistence();
    const created = createRoom("socket-between-a", { displayName: "Chris" });
    const joined = joinRoom(created.room.roomCode, "socket-between-b", { displayName: "Franky" });
    expect(joined.ok).toBe(true);
    if (!joined.ok) return;

    expect(setParticipantReadyState(created.room.roomCode, created.seat.seatToken, true).ok).toBe(true);
    expect(setParticipantReadyState(created.room.roomCode, joined.seat.seatToken, true).ok).toBe(true);

    const started = startRoom(created.room.roomCode, created.seat.seatToken, { persistence: persistence.service });
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    // "training" ist ein Vorsaison-Schritt, kein laufender Spieltag -- Umverteilen muss hier gehen.
    expect(started.room.state.roomFlowState.step).toBe("training");

    const reassignedBetween = applyRoomTeamSelection(
      created.room.roomCode,
      created.seat.seatToken,
      { chrisTeamIds: ["D-L"], frankyTeamIds: ["N-N"] },
      { persistence: persistence.service },
    );
    expect(reassignedBetween.ok).toBe(true);
    if (!reassignedBetween.ok) return;
    expect(reassignedBetween.room.state.teamOwnership.find((entry) => entry.teamId === "D-L")).toMatchObject({
      controllerType: "human",
      ownerDisplayName: "Chris",
    });
    // Der gebundene (nicht-Sandbox-)Spielstand traegt dieselbe Aufteilung wie beim Start (Stufe 1.3:
    // "schreibt die Zuordnung wie beim Start ueber applyGameModeOwnership in den Spielstand").
    const boundSaveId = reassignedBetween.room.state.multiplayerRoom.saveId;
    const boundSave = persistence.saves.get(boundSaveId);
    expect(boundSave).toBeTruthy();
    const settings = (
      boundSave?.gameState as {
        seasonState: { teamControlSettings: Record<string, { controlMode: string }> };
      }
    ).seasonState.teamControlSettings;
    expect(settings["D-L"]).toMatchObject({ controlMode: "manual" });

    // Jetzt mitten in einen Spieltag versetzen (Aufstellung laeuft) -- direkte Zustandsmutation,
    // dasselbe Testmuster wie in tests/room-store.test.ts ("starts a room by creating a fresh
    // co-op save..."), um einen Flow-Schritt zu erreichen, ohne den kompletten Spieltag-Zyklus
    // real durchzuspielen.
    const room = getRoom(created.room.roomCode);
    expect(room).toBeTruthy();
    if (!room) return;
    room.state = { ...room.state, roomFlowState: { ...room.state.roomFlowState, step: "lineup" } };

    const duringMatchday = applyRoomTeamSelection(created.room.roomCode, created.seat.seatToken, {
      chrisTeamIds: ["D-L", "B-B"],
      frankyTeamIds: ["N-N"],
    });
    expect(duringMatchday.ok).toBe(false);
    if (duringMatchday.ok) return;
    expect(duringMatchday.error).toContain("Spieltag");
    // Die Zuordnung von vorhin bleibt unveraendert -- die Ablehnung hat nichts geschrieben.
    expect(getRoom(created.room.roomCode)?.state.teamOwnership.find((entry) => entry.teamId === "B-B")).toMatchObject({
      controllerType: "ai",
    });

    // Zurueck auf einen Zwischen-Spieltag-Schritt, aber mit laufender Arena-Enthuellung
    // (`arenaSyncState.status`) -- die zweite Haelfte von `isRoomMatchdayInProgress`.
    room.state = {
      ...room.state,
      roomFlowState: { ...room.state.roomFlowState, step: "standings" },
      arenaSyncState: { ...room.state.arenaSyncState, status: "revealing" },
    };
    const duringReveal = applyRoomTeamSelection(created.room.roomCode, created.seat.seatToken, {
      chrisTeamIds: ["D-L"],
      frankyTeamIds: ["N-N"],
    });
    expect(duringReveal.ok).toBe(false);

    // Zurueck auf "idle" + "standings" (zwischen zwei Spieltagen) -- geht wieder.
    room.state = { ...room.state, arenaSyncState: { ...room.state.arenaSyncState, status: "idle" } };
    const afterMatchday = applyRoomTeamSelection(created.room.roomCode, created.seat.seatToken, {
      chrisTeamIds: ["D-L"],
      frankyTeamIds: ["N-N"],
    });
    expect(afterMatchday.ok).toBe(true);
  }, 120_000);

  it(
    "erlaubt Umverteilen wieder, sobald der naechste Spieltag begonnen hat -- obwohl arenaSyncState nie auf 'idle' zurueckgesetzt wird (Befund B1)",
    () => {
      // Befund B1 (docs/MULTIPLAYER_VOLLAUSBAU_PLAN.md), selbst nachgeprueft: `recordRoomGameplayWrite`
      // setzt `arenaSyncState.status` beim Buchen eines Spieltags auf "result_applied" -- und NIE
      // wieder zurueck auf "idle" (Kommentar an `matchesArenaScope`, arena-sync-state.ts). Ein reiner
      // `status !== "idle"`-Vergleich waere damit ab dem ERSTEN gebuchten Spieltag fuer den Rest des
      // Raums dauerhaft wahr -- die Umverteilung waere fuer immer gesperrt, nicht nur waehrend des
      // laufenden Spieltags. Dieser Test bucht einen ECHTEN Spieltag ueber denselben Produktionspfad
      // (`recordRoomGameplayWrite`), zieht den Raum dann zum naechsten Spieltag weiter (wie
      // `advanceRoomFlow` es taete) und haelt fest: NOCH auf demselben Spieltag bleibt die Sperre
      // stehen, NACH dem Weiterziehen faellt sie wieder -- ohne dass irgendwer `arenaSyncState`
      // manuell zurueckgesetzt haette.
      const persistence = createFakePersistence();
      const created = createRoom("socket-b1-a", { displayName: "Chris" });
      const joined = joinRoom(created.room.roomCode, "socket-b1-b", { displayName: "Franky" });
      expect(joined.ok).toBe(true);
      if (!joined.ok) return;

      expect(setParticipantReadyState(created.room.roomCode, created.seat.seatToken, true).ok).toBe(true);
      expect(setParticipantReadyState(created.room.roomCode, joined.seat.seatToken, true).ok).toBe(true);
      const started = startRoom(created.room.roomCode, created.seat.seatToken, { persistence: persistence.service });
      expect(started.ok).toBe(true);
      if (!started.ok) return;

      const saveId = started.room.state.multiplayerRoom.saveId;
      const matchdayBeimBuchen = started.room.state.multiplayerRoom.activeMatchday;

      // Spieltag EINS real buchen -- derselbe Pfad, den ein Spieltags-Ergebnis-Apply nimmt
      // (room-store.ts, `recordRoomGameplayWrite`).
      const booked = recordRoomGameplayWrite({
        roomCode: created.room.roomCode,
        saveId,
        action: "matchday_resolve",
        eventType: "matchday_applied",
      });
      expect(booked.ok).toBe(true);
      if (!booked.ok) return;
      expect(booked.room.state.arenaSyncState.status).toBe("result_applied");
      expect(booked.room.state.arenaSyncState.matchdayId).toBe(String(matchdayBeimBuchen));

      // NOCH auf demselben Spieltag (activeMatchday unveraendert, nur der Flow-Schritt zeigt schon
      // auf die Rueckschau) -- die Sperre muss stehen bleiben.
      const room = getRoom(created.room.roomCode);
      expect(room).toBeTruthy();
      if (!room) return;
      room.state = { ...room.state, roomFlowState: { ...room.state.roomFlowState, step: "standings" } };
      const nochGleicherSpieltag = applyRoomTeamSelection(created.room.roomCode, created.seat.seatToken, {
        chrisTeamIds: ["D-L"],
        frankyTeamIds: ["N-N"],
      });
      expect(nochGleicherSpieltag.ok, "direkt nach dem Buchen, noch auf demselben Spieltag, muss die Sperre stehen bleiben").toBe(false);

      // Jetzt zum naechsten Spieltag weiterziehen -- exakt das, was `advanceRoomFlow` an
      // `multiplayerRoom.activeMatchday` tut. `arenaSyncState` bleibt UNVERAENDERT auf
      // "result_applied" fuer den ALTEN Spieltag stehen -- niemand setzt es zurueck.
      const arenaSyncStateVorher = room.state.arenaSyncState;
      room.state = {
        ...room.state,
        multiplayerRoom: { ...room.state.multiplayerRoom, activeMatchday: matchdayBeimBuchen + 1 },
      };
      expect(room.state.arenaSyncState).toBe(arenaSyncStateVorher);
      expect(room.state.arenaSyncState.status).toBe("result_applied");

      const naechsterSpieltag = applyRoomTeamSelection(created.room.roomCode, created.seat.seatToken, {
        chrisTeamIds: ["D-L"],
        frankyTeamIds: ["N-N"],
      });
      expect(
        naechsterSpieltag.ok,
        "nach dem Weiterziehen zum naechsten Spieltag muss Umverteilen wieder erlaubt sein, obwohl arenaSyncState nie auf idle zurueckgesetzt wurde",
      ).toBe(true);
    },
    120_000,
  );

  it("verweigert einem Nicht-Host jede Umverteilung, auch zwischen Spieltagen", () => {
    const persistence = createFakePersistence();
    const created = createRoom("socket-nonhost-a", { displayName: "Chris" });
    const joined = joinRoom(created.room.roomCode, "socket-nonhost-b", { displayName: "Franky" });
    expect(joined.ok).toBe(true);
    if (!joined.ok) return;

    expect(setParticipantReadyState(created.room.roomCode, created.seat.seatToken, true).ok).toBe(true);
    expect(setParticipantReadyState(created.room.roomCode, joined.seat.seatToken, true).ok).toBe(true);
    const started = startRoom(created.room.roomCode, created.seat.seatToken, { persistence: persistence.service });
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    const byGuest = applyRoomTeamSelection(created.room.roomCode, joined.seat.seatToken, {
      chrisTeamIds: [],
      frankyTeamIds: ["D-L"],
    });
    expect(byGuest.ok).toBe(false);
    if (byGuest.ok) return;
    expect(byGuest.error).toContain("Host");

    const presetByGuest = applyRoomOwnershipPreset(created.room.roomCode, joined.seat.seatToken, "chris_4_rest_ai");
    expect(presetByGuest.ok).toBe(false);
  }, 120_000);

  it("erkennt Franky ueber die Sitzrolle (ownerId), auch bei einem Anzeigenamen, der nichts mit 'Franky' zu tun hat", () => {
    const persistence = createFakePersistence();
    const created = createRoom("socket-anyname-a", { displayName: "Chris" });
    // Anzeigename enthaelt bewusst NICHT "franky" -- die alte Regex haette hier niemanden
    // gefunden bzw. bei Namensgleichheit mit dem Host sogar den Host getroffen.
    const joined = joinRoom(created.room.roomCode, "socket-anyname-b", { displayName: "Zzz Mitspieler" });
    expect(joined.ok).toBe(true);
    if (!joined.ok) return;

    // Direkter Unit-Nachweis der Erkennungsfunktion.
    const secondHuman = resolveFrankyParticipant(joined.room.state.roomParticipants);
    expect(secondHuman?.displayName).toBe("Zzz Mitspieler");
    expect(secondHuman?.role).toBe("player");

    // End-to-End: der Standard-Split beim Beitritt (kein Host-Preset vorher) muss trotzdem beide
    // Menschen mit je 4 Teams versorgen, obwohl niemand "Franky" heisst.
    const ownershipAfterJoin = joined.room.state.teamOwnership;
    expect(ownershipAfterJoin.filter((entry) => entry.ownerDisplayName === "Zzz Mitspieler")).toHaveLength(4);

    // Und beim Start landet der zweite Mensch trotzdem auf dem Franky-Platzhalter im Spielstand
    // (siehe `startRoom`s `resolveFrankyParticipant`-Aufloesung), nicht auf KI.
    expect(setParticipantReadyState(created.room.roomCode, created.seat.seatToken, true).ok).toBe(true);
    expect(setParticipantReadyState(created.room.roomCode, joined.seat.seatToken, true).ok).toBe(true);
    const started = startRoom(created.room.roomCode, created.seat.seatToken, { persistence: persistence.service });
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    const boundSave = persistence.saves.get(started.room.state.multiplayerRoom.saveId);
    expect(boundSave).toBeTruthy();
    const gameState = boundSave?.gameState as {
      seasonState: { teamControlSettings: Record<string, { controlMode: string; ownerId?: string }> };
    };
    const secondHumanTeamId = ownershipAfterJoin.find((entry) => entry.ownerDisplayName === "Zzz Mitspieler")!.teamId;
    expect(gameState.seasonState.teamControlSettings[secondHumanTeamId]).toMatchObject({
      controlMode: "manual",
      ownerId: "franky_remote_placeholder",
    });
  }, 120_000);
});
