import { describe, expect, it } from "vitest";

import {
  ROOM_FLOW_MATCHDAY_CYCLE_END,
  ROOM_FLOW_MATCHDAY_CYCLE_START,
  describeRoomFlowButton,
  getNextRoomFlowStepId,
  roomFlowSeasonContinues,
} from "@/lib/room/room-flow-controller";
import {
  advanceRoomFlow,
  createRoom,
  joinRoom,
  setParticipantReadyState,
} from "@/lib/room/room-store";
import type { GameState } from "@/lib/data/olyDataTypes";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";
import type { OlyRoomState } from "@/types/game";

/**
 * Der Room-Flow lief bis hierher genau EINMAL durch: `getNextRoomFlowStepId` klemmte am
 * Season Review fest, nichts setzte die Kette fuer Spieltag 2 zurueck. Eine gemeinsame Saison
 * war damit nicht spielbar — nach dem ersten Saisonstand war der Raum eine Sackgasse.
 *
 * Diese Datei nagelt den Zyklus fest, und zwar an der Regel, aus der er abgeleitet ist:
 * die Saison laeuft weiter, solange das Spiel `resolve_matchday` erlaubt.
 */

/** Minimaler Spielstand, der genau die Felder traegt, die der Phasen-Gate liest. */
function spielstand(input: { phase: GameState["gamePhase"]; currentMatchday: number }): GameState {
  return {
    gamePhase: input.phase,
    season: {
      id: "season-1",
      name: "Season 1",
      year: 1,
      currentMatchday: input.currentMatchday,
      matchdayIds: Array.from({ length: 10 }, (_, index) => `season-1-matchday-${index + 1}`),
    },
    matchdayState: {
      matchdayId: `season-1-matchday-${input.currentMatchday}`,
      status: "planning",
      pendingTeamIds: [],
      resolvedFixtureIds: [],
    },
    seasonState: { matchdayResults: [] },
  } as unknown as GameState;
}

/** Persistenz-Attrappe: liefert genau einen Spielstand unter der erwarteten saveId. */
function fakePersistence(saveId: string, gameState: GameState): PersistenceService {
  return {
    getSaveById: (id: string) => (id === saveId ? ({ saveId, name: "Fake", status: "active", gameState } as unknown as PersistedSaveGame) : null),
  } as unknown as PersistenceService;
}

describe("Room-Flow: Spieltag-Zyklus", () => {
  it("springt vom Saisonstand zurueck zur Einsatzliste, solange die Saison laeuft", () => {
    expect(getNextRoomFlowStepId(ROOM_FLOW_MATCHDAY_CYCLE_END, { seasonContinues: true })).toBe(
      ROOM_FLOW_MATCHDAY_CYCLE_START,
    );
  });

  it("geht vom Saisonstand ins Season Review, wenn die Saison durch ist", () => {
    expect(getNextRoomFlowStepId(ROOM_FLOW_MATCHDAY_CYCLE_END, { seasonContinues: false })).toBe("season_review");
  });

  it("bleibt ohne Spielstand-Information beim alten linearen Verhalten", () => {
    // Der sichere Rueckfall: lieber die alte Sackgasse als eine Endlosschleife auf einem
    // Raum, dessen Save gerade nicht lesbar ist.
    expect(getNextRoomFlowStepId(ROOM_FLOW_MATCHDAY_CYCLE_END)).toBe("season_review");
  });

  it("laesst die Kette ausserhalb des Zyklus-Endes unveraendert", () => {
    expect(getNextRoomFlowStepId("lobby_ready", { seasonContinues: true })).toBe("sell_players");
    expect(getNextRoomFlowStepId("finalize_transfers", { seasonContinues: true })).toBe("lineup");
    expect(getNextRoomFlowStepId("arena", { seasonContinues: true })).toBe("result");
    expect(getNextRoomFlowStepId("result", { seasonContinues: true })).toBe("standings");
    // Das Season Review bleibt der Endpunkt — auch mit laufender Saison kein Rueckwaertsgang.
    expect(getNextRoomFlowStepId("season_review", { seasonContinues: true })).toBe("season_review");
  });

  it("liest 'Saison laeuft weiter' aus der Spielphase, nicht aus einer eigenen Rechnung", () => {
    expect(roomFlowSeasonContinues(spielstand({ phase: "season_active", currentMatchday: 1 }))).toBe(true);
    expect(roomFlowSeasonContinues(spielstand({ phase: "season_active", currentMatchday: 10 }))).toBe(true);
    // Nach dem letzten Spieltag setzt `advanceMatchday` genau diese Phase — das ist das Signal.
    expect(roomFlowSeasonContinues(spielstand({ phase: "season_completed", currentMatchday: 10 }))).toBe(false);
    expect(roomFlowSeasonContinues(spielstand({ phase: "season_review", currentMatchday: 10 }))).toBe(false);
    expect(roomFlowSeasonContinues(spielstand({ phase: "season_end_management", currentMatchday: 1 }))).toBe(false);
  });

  it("schaltet den Raum vom Saisonstand auf die naechste Einsatzliste und zieht den Spieltag mit", () => {
    const saveId = "zyklus-save-laufend";
    const created = createRoom("socket-zyklus-a", { displayName: "Chris", preset: "chris_4_rest_ai", saveId });
    const joined = joinRoom(created.room.roomCode, "socket-zyklus-b", { displayName: "Franky" });
    expect(joined.ok).toBe(true);
    if (!joined.ok) return;

    // Direkt auf den Zyklus-Endpunkt setzen: dieser Test prueft den Uebergang, nicht den Weg dahin.
    created.room.state = {
      ...created.room.state,
      roomFlowState: { ...created.room.state.roomFlowState, step: ROOM_FLOW_MATCHDAY_CYCLE_END, canHostAdvance: true },
    };

    const advanced = advanceRoomFlow(created.room.roomCode, created.seat.seatToken, {
      persistence: fakePersistence(saveId, spielstand({ phase: "season_active", currentMatchday: 4 })),
    });

    expect(advanced.ok).toBe(true);
    if (!advanced.ok) return;
    expect(advanced.room.state.roomFlowState.step).toBe(ROOM_FLOW_MATCHDAY_CYCLE_START);
    // Stand vor dieser Aenderung fest auf 1 und wurde nie nachgezogen.
    expect(advanced.room.state.multiplayerRoom.activeMatchday).toBe(4);
    // Der neue Spieltag beginnt fuer alle wieder unbestaetigt.
    expect(advanced.room.state.roomFlowState.completedParticipantIds).toHaveLength(0);
    expect(advanced.room.state.roomParticipants.every((entry) => entry.readyState === "not_ready")).toBe(true);
  });

  it("schaltet nach dem letzten Spieltag ins Season Review statt in eine weitere Runde", () => {
    const saveId = "zyklus-save-fertig";
    const created = createRoom("socket-zyklus-c", { displayName: "Chris", preset: "chris_4_rest_ai", saveId });
    const joined = joinRoom(created.room.roomCode, "socket-zyklus-d", { displayName: "Franky" });
    expect(joined.ok).toBe(true);
    if (!joined.ok) return;

    created.room.state = {
      ...created.room.state,
      roomFlowState: { ...created.room.state.roomFlowState, step: ROOM_FLOW_MATCHDAY_CYCLE_END, canHostAdvance: true },
    };

    const advanced = advanceRoomFlow(created.room.roomCode, created.seat.seatToken, {
      persistence: fakePersistence(saveId, spielstand({ phase: "season_completed", currentMatchday: 10 })),
    });

    expect(advanced.ok).toBe(true);
    if (!advanced.ok) return;
    expect(advanced.room.state.roomFlowState.step).toBe("season_review");
  });

  it("beschriftet den Host-Knopf am Zyklus-Ende nach dem tatsaechlichen Ziel", () => {
    const basis = {
      roomId: "r",
      saveId: "s",
      activeSeasonId: "season-1",
      activeMatchday: 5,
      phase: "active",
      step: ROOM_FLOW_MATCHDAY_CYCLE_END,
      requiredParticipantIds: ["p-chris"],
      completedParticipantIds: ["p-chris"],
      blockingTeamIds: [],
      aiAutoCompletedTeamIds: [],
      canHostAdvance: true,
      warnings: [],
    };
    const chris = {
      participantId: "p-chris",
      displayName: "Chris",
      role: "host",
      readyState: "ready",
      connectionStatus: "online",
      controlledTeamIds: ["P-S"],
    };
    const zustand = (seasonContinues: boolean | null) =>
      ({
        // `describeRoomFlowButton` liest fuer die "start_room"/"advance_flow"-Weiche jetzt
        // `multiplayerRoom.status` (statt dass der Aufrufer das selbst entscheidet) — dieses
        // Minimal-Fixture braucht das Feld deshalb, sonst crasht der Zugriff.
        multiplayerRoom: { status: "season_active" },
        roomParticipants: [chris],
        teamOwnership: [],
        roomFlowState: { ...basis, seasonContinues },
      }) as unknown as OlyRoomState;

    expect(describeRoomFlowButton({ state: zustand(true), participantId: "p-chris" }).label).toBe("Weiter: Spieltag 5");
    expect(describeRoomFlowButton({ state: zustand(false), participantId: "p-chris" }).label).toBe("Weiter: Season Review");
    // Unbekannt heisst: nichts erfinden, alter Text.
    expect(describeRoomFlowButton({ state: zustand(null), participantId: "p-chris" }).label).toBe("Saisonstand ansehen");
    // Und die Aktion bleibt konsistent "advance_flow" (kein Lobby-Status hier).
    expect(describeRoomFlowButton({ state: zustand(true), participantId: "p-chris" }).action).toBe("advance_flow");
  });

  it("haelt den Host-Vorbehalt und das Ready-Gate auch im Zyklus", () => {
    const saveId = "zyklus-save-gates";
    const created = createRoom("socket-zyklus-e", { displayName: "Chris", preset: "chris_4_rest_ai", saveId });
    const joined = joinRoom(created.room.roomCode, "socket-zyklus-f", { displayName: "Franky" });
    expect(joined.ok).toBe(true);
    if (!joined.ok) return;

    created.room.state = {
      ...created.room.state,
      roomFlowState: { ...created.room.state.roomFlowState, step: ROOM_FLOW_MATCHDAY_CYCLE_END, canHostAdvance: true },
    };
    const persistence = fakePersistence(saveId, spielstand({ phase: "season_active", currentMatchday: 2 }));

    // Gast darf nicht weiterschalten, auch wenn der Flow bereit waere.
    const gast = advanceRoomFlow(created.room.roomCode, joined.seat.seatToken, { persistence });
    expect(gast.ok).toBe(false);

    // Und mit blockiertem Flow darf es auch der Host nicht.
    created.room.state = {
      ...created.room.state,
      roomFlowState: { ...created.room.state.roomFlowState, canHostAdvance: false },
    };
    const blockiert = advanceRoomFlow(created.room.roomCode, created.seat.seatToken, { persistence });
    expect(blockiert.ok).toBe(false);

    expect(setParticipantReadyState(created.room.roomCode, joined.seat.seatToken, true).ok).toBe(true);
  });
});
