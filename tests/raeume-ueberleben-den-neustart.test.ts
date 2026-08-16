import { describe, expect, it } from "vitest";

import {
  advanceRoomArenaStep,
  applyRoomTeamSelection,
  closeRoom,
  createRoom,
  getRoom,
  joinRoom,
  rehydrateRuntimeRoomsFromPersistence,
  rejoinRoom,
  resetRuntimeRoomsForTests,
  setRoomArenaReadyState,
  startRoomArenaSync,
} from "@/lib/room/room-store";
import { ROOM_EXPIRY_MS, setPersistedRoomUpdatedAtForTests } from "@/lib/room/room-persistence";
import { assertSaveNotRoomBound } from "@/lib/room/assert-save-not-room-bound";

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

  /**
   * STUFE 4.3 (docs/MULTIPLAYER_VOLLAUSBAU_PLAN.md): die Tests oben decken einen Raum in der
   * LOBBY ab (Team-Zuordnung, noch kein laufender Spieltag). Chris' Auftrag zielt aber genau auf
   * den Fall "Raum LAEUFT" — mitten in der gemeinsamen Arena, mit Ready-Haekchen und einem bereits
   * fortgeschrittenen Reveal-Schritt. `arenaSyncState` ist Teil von `OlyRoomState` und liegt damit
   * VOLLSTAENDIG im selben `payload_json` wie der Rest (siehe room-persistence.ts) — dieser Test
   * pinnt, dass ein Neustart mitten im Reveal nicht nur "irgendeinen" Zustand zurueckbringt,
   * sondern GENAU den Stand, auf dem beide Coaches gerade standen: Status, Etappe, Ready-Liste,
   * Versionszaehler. Ohne diese Zusicherung waere B1 (Stufe 0.1) nur fuer die Lobby bewiesen, nicht
   * fuer das Spiel selbst, das Chris tatsaechlich pausiert und fortsetzt.
   *
   * KEIN echter Server-Neustart (kein `child_process`/Port-Zyklus) — dieselbe Begruendung wie bei
   * den Nachbartests oben: `resetRuntimeRoomsForTests()` + `rehydrateRuntimeRoomsFromPersistence()`
   * IST der Code-Pfad, den `server.ts` beim echten Hochfahren aufruft (siehe dessen Kommentar
   * "Room-Rehydrierung: ..."); ein echter Prozessneustart in der Testsuite wuerde nur denselben
   * Pfad ueber einen viel teureren Umweg (neuer Node-Prozess, neuer Socket-Server, echte Ports)
   * pruefen, ohne eine zusaetzliche Garantie zu gewinnen. Der Zwei-Browser-E2E
   * (`scripts/smoke-multiplayer-e2e.ts`) deckt den echten Prozess/Socket-Teil separat ab.
   */
  it("bringt einen laufenden Reveal (Ready-Haekchen + fortgeschrittener Schritt) unveraendert durch den Neustart", () => {
    const created = createRoom("socket-restart-arena-a", { displayName: "Chris", preset: "chris_4_rest_ai" });
    const joined = joinRoom(created.room.roomCode, "socket-restart-arena-b", { displayName: "Franky" });
    expect(joined.ok).toBe(true);
    if (!joined.ok) return;
    const roomCode = created.room.roomCode;

    const started = startRoomArenaSync(roomCode, created.seat.seatToken, {
      seasonId: "season-1",
      matchdayId: "matchday-1",
      disciplineSide: "d1",
      maxSlotRevealCountByDiscipline: { d1: 6, d2: 6 },
    });
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    // Beide bereit -> Reveal darf laufen; der Host schaltet einen echten Schritt weiter, damit
    // NICHT nur der Startzustand (slotRevealIndex 0) geprueft wird, sondern ein Stand, der sich
    // vom "gerade erst gestartet"-Fall unterscheidet.
    expect(setRoomArenaReadyState(roomCode, created.seat.seatToken, true).ok).toBe(true);
    expect(setRoomArenaReadyState(roomCode, joined.seat.seatToken, true).ok).toBe(true);
    const advanced = advanceRoomArenaStep(roomCode, created.seat.seatToken, {
      maxSlotRevealCountByDiscipline: { d1: 6, d2: 6 },
    });
    expect(advanced.ok).toBe(true);
    if (!advanced.ok) return;

    const vorherArena = advanced.room.state.arenaSyncState;
    expect(vorherArena.status).toBe("revealing");
    expect(vorherArena.slotRevealIndex).toBeGreaterThan(0);

    resetRuntimeRoomsForTests();
    expect(getRoom(roomCode)).toBeNull();

    const { restored } = rehydrateRuntimeRoomsFromPersistence();
    expect(restored).toBeGreaterThanOrEqual(1);

    const rehydrated = getRoom(roomCode);
    expect(rehydrated).toBeTruthy();
    if (!rehydrated) return;
    const nachherArena = rehydrated.state.arenaSyncState;

    // WAS "UNVERAENDERT" HIER HEISST — und was NICHT (Befund F8, Aufgabe #45).
    //
    // Diese Pruefung verlangte urspruenglich auch `version` und die Zeitbasis unveraendert. Das war
    // genau die falsche Zusicherung: sie schrieb fest, dass eine laufende Enthuellung mit einer
    // MINUTENALTEN `stepStartedAt` zurueckkommt — einer Vergangenheit, die kein Client miterlebt
    // hat. Die gemeinsame Uhr haette danach sofort losgerechnet.
    //
    // Unveraendert bleibt, was die POSITION beschreibt: Etappe, Phase, Spieltag, Saison und wer
    // bereit ist. Neu angesetzt wird die ZEIT, und angehalten wird sichtbar — Begruendung samt
    // Messwerten steht an `resumeRoomArenaAfterRestart` (lib/room/arena-sync-state.ts), die
    // Eigenschaften selbst in tests/arena-ueberlebt-den-neustart.test.ts.
    expect(nachherArena.status).toBe(vorherArena.status);
    expect(nachherArena.version, "genau ein Schritt fuer das Neuansetzen, kein stiller Sprung").toBe(
      vorherArena.version + 1,
    );
    expect(nachherArena.paused, "beim Wiederanlauf steht nachweislich niemand am Bildschirm").toBe(true);
    expect(nachherArena.pausedBy, "eine Pause ohne Urheber bindet auch den Host").toBeNull();
    expect(nachherArena.matchdayId).toBe(vorherArena.matchdayId);
    expect(nachherArena.seasonId).toBe(vorherArena.seasonId);
    expect(nachherArena.phaseIndex).toBe(vorherArena.phaseIndex);
    expect(nachherArena.slotRevealIndex).toBe(vorherArena.slotRevealIndex);
    expect(nachherArena.stepIndex).toBe(vorherArena.stepIndex);
    expect([...nachherArena.readyParticipantIds].sort()).toEqual([...vorherArena.readyParticipantIds].sort());
    expect([...nachherArena.requiredParticipantIds].sort()).toEqual([...vorherArena.requiredParticipantIds].sort());

    // Und der Raum bleibt fuer beide bedienbar: der Host darf nach dem Neustart weiter
    // vorruecken (Sitzplatz-Pruefung findet den Sitz wieder, siehe naechster Test).
    const nachNeustartAdvance = advanceRoomArenaStep(roomCode, created.seat.seatToken, {
      maxSlotRevealCountByDiscipline: { d1: 6, d2: 6 },
      force: true,
    });
    expect(nachNeustartAdvance.ok).toBe(true);
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

  it("gibt einen verwaisten, raumgebundenen Save nach Ablauf der Frist wieder fuer Nicht-Raum-Schreibvorgaenge frei (Befund B2)", () => {
    // Befund B2 (docs/MULTIPLAYER_VOLLAUSBAU_PLAN.md): `closeRoom` wird nur aus Tests gerufen, und
    // der Sieben-Tage-Verfall griff bislang NUR beim Prozessstart (siehe Test oben,
    // "laesst einen abgelaufenen Raum verfallen ..." -- der laeuft ueber
    // `rehydrateRuntimeRoomsFromPersistence()`). Ein Raum, der lange im Speicher bleibt, weil der
    // Server einfach nicht neu startet, sperrte seinen gebundenen Save damit fuer IMMER gegen jeden
    // Nicht-Raum-Schreibvorgang -- ein abgebrochenes Koop-Spiel machte seinen Spielstand
    // unbenutzbar. Dieser Test prueft den Ausgang OHNE jede Neustart-Simulation: genau der
    // Alltagsfall, in dem der Server einfach lange durchlaeuft.
    const created = createRoom("socket-orphan-a", { displayName: "Chris", saveId: "verwaister-save" });
    const roomCode = created.room.roomCode;

    // Kontrollmessung: aktuell noch gebunden, ein Nicht-Raum-Schreibvorgang MUSS abgelehnt werden.
    const nochAktiv = assertSaveNotRoomBound("verwaister-save", "kontrollmessung");
    expect(nochAktiv.blocked).toBe(true);

    // "Lange niemand angefasst" OHNE Prozess-Neustart simulieren: direkte Zustandsmutation am
    // IN-MEMORY-Raum (gleiches Testmuster wie in tests/raum-hosten-und-teams-zuteilen.test.ts) --
    // genau das Feld, das `evictRoomIfExpired` (room-store.ts, `getActiveRoomBySaveId`) prueft.
    const room = getRoom(roomCode);
    expect(room).toBeTruthy();
    if (!room) return;
    const laengstVergangen = new Date(Date.now() - ROOM_EXPIRY_MS - 24 * 60 * 60 * 1000).toISOString();
    room.state = { ...room.state, multiplayerRoom: { ...room.state.multiplayerRoom, updatedAt: laengstVergangen } };

    const nachVerfall = assertSaveNotRoomBound("verwaister-save", "kontrollmessung");
    expect(nachVerfall.blocked, "ein verwaister Raum darf seinen Save nicht fuer immer sperren").toBe(false);

    // Der Ausgang ist ECHT, nicht nur uebersehen: der Raum ist wirklich weg, der Code wieder frei --
    // derselbe Zustand, den `closeRoom` hinterlassen wuerde.
    expect(getRoom(roomCode)).toBeNull();
  });

  it("gibt einen verwaisten Save auch ueber die Ablage-Quelle frei, wenn die Prozess-Map ihn (noch) nicht kennt", () => {
    // Zweite Quelle von `assertSaveNotRoomBound` (`findPersistedRoomBySaveId`) -- greift genau
    // dann, wenn die In-Memory-Map den Raum nicht (mehr) findet, z. B. kurz nach einem
    // Prozess-Neustart vor dem Rehydrieren. Auch dieser Pfad darf einen verwaisten Raum nicht
    // ewig als Riegel weiterreichen.
    const created = createRoom("socket-orphan-b", { displayName: "Chris", saveId: "verwaister-save-2" });
    const roomCode = created.room.roomCode;

    const laengstVergangen = new Date(Date.now() - ROOM_EXPIRY_MS - 24 * 60 * 60 * 1000).toISOString();
    setPersistedRoomUpdatedAtForTests(roomCode, laengstVergangen);

    // Map leeren, OHNE zu rehydrieren -- der Zustand direkt nach einem Neustart, bevor
    // `rehydrateRuntimeRoomsFromPersistence()` gelaufen ist.
    resetRuntimeRoomsForTests();

    const geprueft = assertSaveNotRoomBound("verwaister-save-2", "kontrollmessung");
    expect(geprueft.blocked, "ein verwaister Raum darf auch ueber die Ablage-Quelle nicht fuer immer sperren").toBe(false);
  });
});
