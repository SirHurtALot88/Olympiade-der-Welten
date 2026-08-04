import path from "node:path";
import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  advanceRoomFlow,
  createRoom,
  joinRoom,
  runRoomAiAutoStep,
  setParticipantReadyState,
  startRoom,
} from "@/lib/room/room-store";
import { describeRoomFlowButton } from "@/lib/room/room-flow-controller";
import type { OlyRoomState } from "@/types/game";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";

const roomPagePath = path.join(process.cwd(), "app/room/[roomCode]/RoomPageClient.tsx");

// Minimal in-memory persistence so startRoom's co-op save creation never touches sqlite here.
function fakePersistence(): PersistenceService {
  const saves = new Map<string, PersistedSaveGame>();
  return {
    getSaveById: (saveId: string) => saves.get(saveId) ?? null,
    createFreshSeasonOneSave: (input?: { saveId?: string; name?: string; status?: "active" | "archived" | "template" }) => {
      const save = { saveId: input?.saveId ?? `fake-${saves.size}`, name: input?.name ?? "Fake", status: input?.status ?? "active" } as unknown as PersistedSaveGame;
      saves.set(save.saveId, save);
      return save;
    },
    saveSingleplayerState: (saveId: string, gameState: unknown) => {
      const save = { saveId, name: "Fake", status: "archived", gameState } as unknown as PersistedSaveGame;
      saves.set(saveId, save);
      return save;
    },
  } as unknown as PersistenceService;
}

describe("room flow button action ist unabhaengig vom Label", () => {
  // Frueher entschied `RoomPageClient` per String-Vergleich auf `roomFlowButton.label`
  // (`=== "AI Teams vorbereiten"`), welches Socket-Event ein Klick sendet. Das brach
  // lautlos, sobald jemand nur die Beschriftung aenderte. `action` ersetzt diesen
  // Vergleich durch ein typisiertes Feld, das unabhaengig vom Text gesetzt wird — dieser
  // Test haelt genau das fest.
  it("liefert 'run_ai_auto_step' fuer den KI-Vorbereiten-Knopf, unabhaengig davon, ob sein Label sich aendert", () => {
    const created = createRoom("socket-room-action-a", { displayName: "Chris", preset: "chris_4_rest_ai" });
    const joined = joinRoom(created.room.roomCode, "socket-room-action-b", { displayName: "Franky" });
    expect(joined.ok).toBe(true);
    if (!joined.ok) return;

    const chris = joined.room.state.roomParticipants.find((participant) => participant.displayName === "Chris");
    const franky = joined.room.state.roomParticipants.find((participant) => participant.displayName === "Franky");
    if (!chris || !franky) return;

    expect(setParticipantReadyState(joined.room.roomCode, created.seat.seatToken, true).ok).toBe(true);
    expect(setParticipantReadyState(joined.room.roomCode, joined.seat.seatToken, true).ok).toBe(true);
    const started = startRoom(joined.room.roomCode, created.seat.seatToken, { persistence: fakePersistence() });
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    const aiPendingButton = describeRoomFlowButton({ state: started.room.state, participantId: chris.participantId });
    // Das Label ist reiner Anzeigetext ("AI Teams vorbereiten") — die Verdrahtung haengt
    // NICHT mehr davon ab. Ob der Text morgen "KI vorbereiten" oder "Bots aufstellen"
    // heisst: die Aktion bleibt "run_ai_auto_step".
    expect(aiPendingButton.label).toBe("AI Teams vorbereiten");
    expect(aiPendingButton.action).toBe("run_ai_auto_step");

    const aiPrepared = runRoomAiAutoStep(started.room.roomCode, created.seat.seatToken);
    expect(aiPrepared.ok).toBe(true);
    if (!aiPrepared.ok) return;

    expect(setParticipantReadyState(aiPrepared.room.roomCode, created.seat.seatToken, true).ok).toBe(true);
    expect(setParticipantReadyState(aiPrepared.room.roomCode, joined.seat.seatToken, true).ok).toBe(true);

    // Am Host-Weiter-Knopf: zwei Schritte mit UNTERSCHIEDLICHEM Label ("Weiter: Training
    // prüfen" vs. das naechste CTA), aber DERSELBEN Aktion "advance_flow" — der Beweis,
    // dass Aktion und Label voneinander entkoppelt sind.
    const trainingAdvanceButton = describeRoomFlowButton({ state: aiPrepared.room.state, participantId: chris.participantId });
    expect(trainingAdvanceButton.label).toBe("Weiter: Training prüfen");
    expect(trainingAdvanceButton.action).toBe("advance_flow");

    const advanced = advanceRoomFlow(aiPrepared.room.roomCode, created.seat.seatToken);
    expect(advanced.ok).toBe(true);
    if (!advanced.ok) return;
    expect(advanced.room.state.roomFlowState.step).toBe("finalize_transfers");
  }, 120_000);

  it("liefert 'start_room' nur im Lobby-Status, sonst 'advance_flow' — unabhaengig vom Aufrufer", () => {
    const created = createRoom("socket-room-action-c", { displayName: "Chris", preset: "chris_4_rest_ai" });
    const joined = joinRoom(created.room.roomCode, "socket-room-action-d", { displayName: "Franky" });
    expect(joined.ok).toBe(true);
    if (!joined.ok) return;

    const chris = joined.room.state.roomParticipants.find((participant) => participant.displayName === "Chris");
    if (!chris) return;

    expect(setParticipantReadyState(joined.room.roomCode, created.seat.seatToken, true).ok).toBe(true);
    expect(setParticipantReadyState(joined.room.roomCode, joined.seat.seatToken, true).ok).toBe(true);
    expect(joined.room.state.multiplayerRoom.status).toBe("lobby");

    const lobbyButton = describeRoomFlowButton({ state: joined.room.state, participantId: chris.participantId });
    expect(lobbyButton.action).toBe("start_room");

    const started = startRoom(joined.room.roomCode, created.seat.seatToken, { persistence: fakePersistence() });
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(started.room.state.multiplayerRoom.status).not.toBe("lobby");
  }, 120_000);

  it("setzt 'set_ready' fuer den Ready-Knopf des Gasts, 'none' fuer nicht klickbare Zwischenstaende", () => {
    const created = createRoom("socket-room-action-e", { displayName: "Chris", preset: "chris_4_rest_ai" });
    const joined = joinRoom(created.room.roomCode, "socket-room-action-f", { displayName: "Franky" });
    expect(joined.ok).toBe(true);
    if (!joined.ok) return;

    const franky = joined.room.state.roomParticipants.find((participant) => participant.displayName === "Franky");
    if (!franky) return;

    const frankyButton = describeRoomFlowButton({ state: joined.room.state, participantId: franky.participantId });
    expect(frankyButton.action).toBe("set_ready");
    expect(frankyButton.canClick).toBe(true);

    // Kein Teilnehmer bekannt -> nichts klickbar, Aktion "none".
    const noParticipantButton = describeRoomFlowButton({ state: joined.room.state, participantId: null });
    expect(noParticipantButton.action).toBe("none");
    expect(noParticipantButton.canClick).toBe(false);
  });

  it("RoomPageClient verdrahtet den Knopf ueber `roomFlowButton.action`, nicht mehr per Label-Vergleich", async () => {
    const roomText = await fs.readFile(roomPagePath, "utf8");

    expect(roomText).toContain("roomFlowButton.action");
    expect(roomText).toContain("emitRoomFlowButtonAction");
    // Der fruehere fragile Vergleich darf nicht wiederkehren.
    expect(roomText).not.toContain('roomFlowButton.label === "AI Teams vorbereiten"');
  });
});

/**
 * Regression aus dem Koop-Audit (scripts/audit-koop-spielbarkeit.ts, B6/B7): der Bereit-Zweig
 * hing an `!isHost`. Ein Host mit eigenen Teams bekam dadurch NIE einen Bereit-Knopf, fiel bis
 * "Warten auf <sich selbst>" durch (`canClick: false`) — und der Gast sah gleichzeitig "Warten
 * auf Host". In der Foundation-Shell, die genau diesen einen Knopf spiegelt, konnte damit
 * niemand weiterklicken. Auf der Room-Seite blieb es unsichtbar, weil die einen zweiten,
 * eigenstaendigen Bereit-Knopf hat.
 */
describe("Bereit-Pflicht haengt am Teambesitz, nicht an der Rolle", () => {
  const zustand = (input: { rolle: "host" | "guest"; bereit: boolean; pflichtig: boolean }) =>
    ({
      multiplayerRoom: { status: "season_active" },
      roomParticipants: [
        {
          participantId: "p-chris",
          displayName: "Chris",
          role: input.rolle,
          readyState: input.bereit ? "ready" : "not_ready",
          connectionStatus: "online",
          controlledTeamIds: ["P-S"],
        },
      ],
      teamOwnership: [],
      roomFlowState: {
        roomId: "r",
        saveId: "s",
        activeSeasonId: "season-1",
        activeMatchday: 3,
        phase: "active",
        step: "lineup",
        requiredParticipantIds: input.pflichtig ? ["p-chris"] : [],
        completedParticipantIds: input.bereit ? ["p-chris"] : [],
        blockingTeamIds: [],
        aiAutoCompletedTeamIds: [],
        canHostAdvance: false,
        warnings: [],
      },
    }) as unknown as OlyRoomState;

  it("gibt auch dem HOST einen klickbaren Bereit-Knopf, solange er noch nicht bereit ist", () => {
    const knopf = describeRoomFlowButton({
      state: zustand({ rolle: "host", bereit: false, pflichtig: true }),
      participantId: "p-chris",
    });
    expect(knopf.action).toBe("set_ready");
    expect(knopf.canClick).toBe(true);
    // Genau das war der Deadlock: vorher "Warten auf Chris" mit canClick=false.
    expect(knopf.label).not.toContain("Warten auf");
  });

  it("meldet Bereitmelden nicht als privilegierte Host-Aktion", () => {
    // Sonst ueberschriebe `RoomPageClient` die Beschriftung in der Lobby zu "Spiel starten",
    // waehrend der Knopf nur "bereit" sendet.
    const knopf = describeRoomFlowButton({
      state: zustand({ rolle: "host", bereit: false, pflichtig: true }),
      participantId: "p-chris",
    });
    expect(knopf.isHostAction).toBe(false);
  });

  it("ueberspringt den Bereit-Schritt fuer einen Host ohne eigene Bereit-Pflicht", () => {
    const knopf = describeRoomFlowButton({
      state: zustand({ rolle: "host", bereit: false, pflichtig: false }),
      participantId: "p-chris",
    });
    expect(knopf.action).not.toBe("set_ready");
  });

  it("laesst den Gast-Weg unveraendert", () => {
    const knopf = describeRoomFlowButton({
      state: zustand({ rolle: "guest", bereit: false, pflichtig: true }),
      participantId: "p-chris",
    });
    expect(knopf.action).toBe("set_ready");
    expect(knopf.canClick).toBe(true);
  });
});
