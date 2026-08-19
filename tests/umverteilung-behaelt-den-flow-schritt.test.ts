import { describe, expect, it } from "vitest";

import { applyExplicitTeamOwnershipToState, applyOwnershipPresetToState } from "@/lib/room/online-room-model";
import { createRoom, getRoom, joinRoom } from "@/lib/room/room-store";

/**
 * EINE TEAM-UMVERTEILUNG WARF DEN RAUM AUF "lobby_ready" ZURUECK.
 *
 * `buildTurnState` hat die Vorgabe `currentStep ?? "lobby_ready"`, und `buildRoomFlowState` liest
 * den Schritt aus genau diesem `turnState`. Beide Umverteilungs-Wege bauten den `turnState` neu
 * OHNE `currentStep` weiterzureichen — der Raum verlor damit seine Stelle im Spieltagszyklus.
 *
 * Nachgemessen an einem Raum bei "standings", vor der Behebung:
 *
 *   vorher:       turn=standings    flow=standings
 *   nach Preset:  turn=lobby_ready  flow=lobby_ready
 *   nach Auswahl: turn=lobby_ready  flow=lobby_ready
 *
 * `syncPlayers` (room-store.ts) reicht `currentStep` laengst weiter — es lief hier aber NACH der
 * Umverteilung und uebernahm damit brav den schon zerstoerten Wert.
 *
 * Das ist kein rein kosmetischer Zaehler: die Umverteilung ist ausdruecklich zwischen zwei
 * Spieltagen erlaubt (`isRoomMatchdayInProgress` sperrt nur den laufenden), also genau dort, wo
 * der Raum bei "standings" oder in der Transferphase steht — und wo ein Ruecksprung auf
 * "lobby_ready" den Zyklus abwirft.
 */
function raumBeiSchritt(schritt: string, socketPrefix: string) {
  const erstellt = createRoom(`${socketPrefix}-a`, { displayName: "Chris", preset: "chris_4_franky_4_rest_ai" });
  const beigetreten = joinRoom(erstellt.room.roomCode, `${socketPrefix}-b`, { displayName: "Franky" });
  expect(beigetreten.ok).toBe(true);
  const room = getRoom(erstellt.room.roomCode);
  expect(room).not.toBeNull();
  if (!room) throw new Error("Raum fehlt");
  room.state = {
    ...room.state,
    turnState: { ...room.state.turnState, currentStep: schritt },
    roomFlowState: { ...room.state.roomFlowState, step: schritt as never },
  };
  return room;
}

describe("Eine Team-Umverteilung behaelt den Flow-Schritt", () => {
  it("der Preset-Knopf laesst den Raum stehen, wo er steht", () => {
    const room = raumBeiSchritt("standings", "socket-umv-preset");
    const nachher = applyOwnershipPresetToState(room.state, "chris_4_franky_4_rest_ai");
    expect(nachher.turnState.currentStep).toBe("standings");
    expect(nachher.roomFlowState.step).toBe("standings");
  });

  it("die ausdrueckliche Teamwahl ebenso", () => {
    const room = raumBeiSchritt("buy_players", "socket-umv-auswahl");
    const ergebnis = applyExplicitTeamOwnershipToState(room.state, {
      chrisTeamIds: ["P-S", "D-P"],
      frankyTeamIds: ["M-S", "P-C"],
    });
    expect(ergebnis.ok).toBe(true);
    if (!ergebnis.ok) return;
    expect(ergebnis.state.turnState.currentStep).toBe("buy_players");
    expect(ergebnis.state.roomFlowState.step).toBe("buy_players");
    // Und die Umverteilung selbst hat trotzdem stattgefunden — der Schritt bleibt, die Zuordnung
    // aendert sich. Sonst haette man den Fehler nur gegen einen anderen getauscht.
    const chrisTeams = ergebnis.state.teamOwnership
      .filter((eintrag) => eintrag.controllerType === "human" && eintrag.participantId === room.state.roomParticipants[0]?.participantId)
      .map((eintrag) => eintrag.teamId);
    // Reihenfolge nach Liga, nicht nach Eingabe — deshalb sortiert verglichen.
    expect([...chrisTeams].sort()).toEqual(["D-P", "P-S"]);
  });

  it("in der Lobby bleibt es bei lobby_ready — dort ist das der richtige Schritt", () => {
    const room = raumBeiSchritt("lobby_ready", "socket-umv-lobby");
    const nachher = applyOwnershipPresetToState(room.state, "chris_4_franky_4_rest_ai");
    expect(nachher.turnState.currentStep).toBe("lobby_ready");
    expect(nachher.roomFlowState.step).toBe("lobby_ready");
  });
});
