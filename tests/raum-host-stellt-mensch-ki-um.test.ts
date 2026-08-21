/**
 * CHRIS' ENTSCHEIDUNG zu `17xs83` (20.08.2026): „es muss eine möglichkeit geben das sauber
 * umzustellen, also wenn ich eine einstellung habe wo ich konkret meine teams auswähle! und DAS
 * gilt dann auch überall" — Zuständigkeit im Raum: **nur der Host**, wie bei Draft und Simulation.
 *
 * DER ZUSTAND VORHER: im Solo eine Einstellung, im laufenden Raum eine Fehlermeldung
 * („Spielmodus-/Team-Zuordnung … können in einem laufenden Online-Room aktuell nicht gespeichert
 * werden"). Das war die letzte Stelle, an der die EINE Umschaltung nicht galt.
 *
 * Geprüft wird der Weg, nicht die Absicht: derselbe Aufruf einmal als Host und einmal als
 * Teilnehmer, plus die Riegel, die verhindern, dass der Host sich selbst aussperrt.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { createRoom, joinRoom } from "@/lib/room/room-store";

const getSaveById = vi.fn();
const saveSingleplayerState = vi.fn();

vi.mock("@/lib/persistence/persistence-service", () => ({
  createPersistenceService: () => ({
    getSaveById,
    saveSingleplayerState,
  }),
}));

vi.mock("@/lib/room/room-gameplay-write-notifier", () => ({
  notifyRoomGameplayWrite: vi.fn(),
}));

function createGameState(): GameState {
  return {
    scenarioMeta: { saveMode: "online_1v1", newGamePresetId: "online_1v1", humanControlledTeamCount: 2 },
    season: { id: "season-2", name: "Season 2", year: 2, currentMatchday: 1, matchdayIds: ["md-1"] },
    seasonState: {
      seasonId: "season-2",
      schedule: [],
      standings: {},
      teamIdentityOverrides: {},
      teamControlSettings: {},
      newGameFlow: { selectedTeamId: "P-S" },
    },
    matchdayState: { matchdayId: "md-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [
      { teamId: "P-S", name: "Chris Team", shortCode: "P-S", cash: 50, rosterLimit: 14, humanControlled: true },
      { teamId: "M-S", name: "Franky Team", shortCode: "M-S", cash: 50, rosterLimit: 14, humanControlled: true },
      { teamId: "A-I", name: "KI Team", shortCode: "A-I", cash: 50, rosterLimit: 14, humanControlled: false },
    ],
    teamIdentities: [],
    players: [],
    rosters: [],
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
    mappingReport: {
      mappingSource: "test",
      teamSource: "test",
      generatedAt: "2026-08-20T00:00:00.000Z",
      processedMappingRows: 0,
      importedPlayerCount: 0,
      matchedRosterCount: 0,
      teamCount: 3,
      unmappedPlayers: [],
    },
    disciplines: [],
  } as unknown as GameState;
}

function setUpRoom(suffix: string) {
  const saveId = `ownership-save-${suffix}`;
  const created = createRoom(`ownership-host-${suffix}`, {
    displayName: "Chris",
    saveId,
    preset: "chris_4_franky_4_rest_ai",
  });
  const joined = joinRoom(created.room.roomCode, `ownership-gast-${suffix}`, { displayName: "Franky" });
  if (!joined.ok) {
    throw new Error("expected franky to join room");
  }
  const chris = joined.room.state.roomParticipants.find((participant) => participant.displayName === "Chris");
  const franky = joined.room.state.roomParticipants.find((participant) => participant.displayName === "Franky");
  if (!chris || !franky) {
    throw new Error("expected both participants");
  }
  return {
    saveId,
    roomCode: created.room.roomCode,
    chris: { ...chris, seatToken: created.seat.seatToken },
    franky: { ...franky, seatToken: joined.seat.seatToken },
  };
}

async function stelleUm(input: {
  saveId: string;
  roomCode?: string;
  teilnehmer?: { participantId: string; userId?: string; seatToken: string };
  chrisTeamIds: string[];
  frankyTeamIds: string[];
}) {
  const { POST } = await import("@/app/api/team-settings/ownership/route");
  const response = await POST(
    new Request("http://localhost/api/team-settings/ownership", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        saveId: input.saveId,
        chrisTeamIds: input.chrisTeamIds,
        frankyTeamIds: input.frankyTeamIds,
        ...(input.roomCode ? { roomCode: input.roomCode } : {}),
        ...(input.teilnehmer
          ? {
              participantId: input.teilnehmer.participantId,
              userId: input.teilnehmer.userId,
              seatToken: input.teilnehmer.seatToken,
            }
          : {}),
      }),
    }),
  );
  return { response, body: await response.json() };
}

describe("Mensch/KI umstellen gilt auch im Raum — aber nur für den Host", () => {
  beforeEach(() => {
    getSaveById.mockReset();
    saveSingleplayerState.mockReset();
    getSaveById.mockReturnValue({ gameState: createGameState() });
    saveSingleplayerState.mockImplementation((saveId: string, gameState: GameState) => ({
      saveId,
      name: "Ownership Guard Save",
      status: "active",
      createdAt: "2026-08-20T00:00:00.000Z",
      updatedAt: "2026-08-20T00:00:00.000Z",
      gameState,
    }));
  });

  it("der Host darf ein KI-Team auf Mensch heben", () => {
    const { saveId, roomCode, chris } = setUpRoom("host");
    return stelleUm({
      saveId,
      roomCode,
      teilnehmer: chris,
      chrisTeamIds: ["A-I"],
      frankyTeamIds: ["M-S"],
    }).then(({ response, body }) => {
      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(saveSingleplayerState).toHaveBeenCalledTimes(1);
      const geschrieben = saveSingleplayerState.mock.calls[0]![1] as GameState;
      // Die Umstellung geht durch dieselbe Funktion wie im Solo — erkennbar daran, dass beide
      // abgeleiteten Felder mitwandern und nicht nur die Einstellungskarte.
      expect(geschrieben.seasonState.teamControlSettings?.["A-I"]?.controlMode).toBe("manual");
      expect(geschrieben.teams.find((team) => team.teamId === "A-I")?.humanControlled).toBe(true);
      // Und die Gegenrichtung im selben Schreibvorgang: P-S ist nicht mehr dabei, faellt also auf
      // KI zurueck. Eine Umstellung, die nur hebt und nie senkt, waere keine.
      expect(geschrieben.seasonState.teamControlSettings?.["P-S"]?.controlMode).not.toBe("manual");
      expect(geschrieben.teams.find((team) => team.teamId === "P-S")?.humanControlled).toBe(false);
    });
  });

  it("ein Teilnehmer darf es NICHT — und der Spielstand bleibt unberührt", () => {
    const { saveId, roomCode, franky } = setUpRoom("gast");
    return stelleUm({
      saveId,
      roomCode,
      teilnehmer: franky,
      chrisTeamIds: ["P-S", "A-I"],
      frankyTeamIds: ["M-S"],
    }).then(({ response, body }) => {
      expect(response.status).toBe(403);
      expect(body.error).toBe("host_only_action");
      expect(saveSingleplayerState).not.toHaveBeenCalled();
    });
  });

  it("ohne Raum (Solo) schreibt der Weg ohne Rollenprüfung", () => {
    return stelleUm({
      saveId: "ownership-save-solo",
      chrisTeamIds: ["A-I"],
      frankyTeamIds: ["M-S"],
    }).then(({ response, body }) => {
      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
    });
  });

  it("weist eine Zuordnung zurück, die kein menschliches Team übrig lässt", () => {
    // Ohne diesen Riegel könnte der Host die ganze Liga auf KI stellen und säße in einem
    // Spielstand, den niemand mehr führt.
    const { saveId, roomCode, chris } = setUpRoom("leer");
    return stelleUm({ saveId, roomCode, teilnehmer: chris, chrisTeamIds: [], frankyTeamIds: [] }).then(
      ({ response, body }) => {
        expect(response.status).toBe(400);
        expect(body.error).toBe("at_least_one_human_team_required");
        expect(saveSingleplayerState).not.toHaveBeenCalled();
      },
    );
  });

  it("weist ein Team zurück, das beiden Eignern zugeordnet ist", () => {
    const { saveId, roomCode, chris } = setUpRoom("doppelt");
    return stelleUm({
      saveId,
      roomCode,
      teilnehmer: chris,
      chrisTeamIds: ["P-S"],
      frankyTeamIds: ["P-S"],
    }).then(({ response, body }) => {
      expect(response.status).toBe(400);
      expect(body.error).toBe("team_owned_twice");
      expect(saveSingleplayerState).not.toHaveBeenCalled();
    });
  });

  it("weist eine unbekannte Team-ID zurück, statt sie stillschweigend zu schlucken", () => {
    const { saveId, roomCode, chris } = setUpRoom("unbekannt");
    return stelleUm({
      saveId,
      roomCode,
      teilnehmer: chris,
      chrisTeamIds: ["GIBTS-NICHT"],
      frankyTeamIds: ["M-S"],
    }).then(({ response, body }) => {
      expect(response.status).toBe(400);
      expect(body.error).toBe("unknown_team_id");
      expect(saveSingleplayerState).not.toHaveBeenCalled();
    });
  });
});

describe("Die Bedienung im Raum lehnt die Umstellung nicht mehr pauschal ab", () => {
  it("schickt die Zuordnung an den eigenen Weg statt eine Fehlermeldung zu setzen", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const quelle = readFileSync(
      join(process.cwd(), "lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx"),
      "utf8",
    );
    expect(quelle).toContain('fetch("/api/team-settings/ownership"');
    // Die alte Pauschal-Ablehnung nannte Zuordnung und Strategy-Profile in einem Atemzug; die
    // Zuordnung ist da raus, die Profile bleiben (die sind weiter Setup-Zeit).
    expect(quelle).not.toContain("Spielmodus-/Team-Zuordnung und Strategy-Profile können");
  });
});
