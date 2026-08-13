import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `POST /api/sponsor/uebernahme` — der Weg vom Menschen zu `nimmUebernahmeAn`/`lehneUebernahmeAb`
 * (Rechenschicht in `lib/sponsor/sponsor-leih-lifecycle.ts`, hier nur verdrahtet).
 *
 * Orientiert an `tests/transfermarkt-buy-api.test.ts`: `createPersistenceService` gemockt,
 * `getSaveById` liefert einen minimalen Spielstand mit offenem Uebernahmeangebot.
 */

const persistenceMocks = vi.hoisted(() => ({
  getSaveById: vi.fn(),
  saveSingleplayerState: vi.fn(),
}));

vi.mock("@/lib/persistence/persistence-service", () => ({
  createPersistenceService: () => ({
    getSaveById: persistenceMocks.getSaveById,
    saveSingleplayerState: persistenceMocks.saveSingleplayerState,
  }),
}));

const ANGEBOT = {
  teamId: "M-M",
  seasonId: "season-2",
  facilityId: "recovery_center",
  stufe: 3,
  zustandPct: 70,
  preis: 12.5,
  offerId: "angebot-1",
};

function baseSave() {
  return {
    saveId: "save-singleplayer-dev",
    status: "active",
    gameState: {
      gamePhase: "season_completed",
      season: { id: "season-2", name: "Season 2", year: 2027, currentMatchday: 1, matchdayIds: ["md-1"] },
      seasonState: {
        seasonId: "season-2",
        schedule: [],
        standings: {},
        teamFacilities: {},
        sponsorUebernahmeAngeboteByTeamId: { "M-M": [ANGEBOT] },
      },
      matchdayState: { matchdayId: "md-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
      teams: [{ teamId: "M-M", shortCode: "M-M", name: "Mayhem Mavericks", budget: 500, cash: 60, identityId: "M-M", humanControlled: true, rosterLimit: 12 }],
      rosters: [],
      players: [],
      disciplines: [],
      teamIdentities: [],
      contracts: [],
      transferListings: [],
      transferHistory: [],
      logs: [],
      mappingReport: { mappingSource: "", teamSource: "", generatedAt: "", processedMappingRows: 0, importedPlayerCount: 0, matchedRosterCount: 0, teamCount: 1, unmappedPlayers: [], teamsWithoutPlayers: [], mappingRowsWithoutPlayerMatch: [], duplicateMappedPlayers: [], unknownTeamCodes: [], duplicateTeamCodes: [], warnings: [] },
    },
  };
}

describe("sponsor uebernahme api", () => {
  beforeEach(() => {
    persistenceMocks.getSaveById.mockReset();
    persistenceMocks.saveSingleplayerState.mockReset();
    persistenceMocks.getSaveById.mockReturnValue(baseSave());
  });

  it("annehmen bucht den Preis von der Kasse ab und schreibt das Gebaeude in teamFacilities", async () => {
    const { POST } = await import("@/app/api/sponsor/uebernahme/route");
    const response = await POST(
      new Request("http://localhost/api/sponsor/uebernahme", {
        method: "POST",
        body: JSON.stringify({
          saveId: "save-singleplayer-dev",
          teamId: "M-M",
          facilityId: "recovery_center",
          action: "annehmen",
          dryRun: false,
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.summary.applied).toBe(true);
    expect(body.summary.angebot.facilityId).toBe("recovery_center");
    // Nicht mehr offen, nachdem es angenommen wurde.
    expect(body.summary.offeneAngebote).toHaveLength(0);

    expect(persistenceMocks.saveSingleplayerState).toHaveBeenCalledTimes(1);
    const [, persistedState] = persistenceMocks.saveSingleplayerState.mock.calls[0]!;
    expect(persistedState.teams.find((team: { teamId: string }) => team.teamId === "M-M").cash).toBeCloseTo(60 - 12.5, 5);
    expect(persistedState.seasonState.teamFacilities["M-M"].facilities.recovery_center).toMatchObject({
      level: 3,
      enabled: true,
      conditionPct: 70,
    });
    expect(persistedState.seasonState.sponsorUebernahmeAngeboteByTeamId).toBeUndefined();
  });

  it("ablehnen laesst Kasse und Bestand unberuehrt, entfernt aber das Angebot", async () => {
    const { POST } = await import("@/app/api/sponsor/uebernahme/route");
    const response = await POST(
      new Request("http://localhost/api/sponsor/uebernahme", {
        method: "POST",
        body: JSON.stringify({
          saveId: "save-singleplayer-dev",
          teamId: "M-M",
          facilityId: "recovery_center",
          action: "ablehnen",
          dryRun: false,
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.summary.offeneAngebote).toHaveLength(0);

    expect(persistenceMocks.saveSingleplayerState).toHaveBeenCalledTimes(1);
    const [, persistedState] = persistenceMocks.saveSingleplayerState.mock.calls[0]!;
    expect(persistedState.teams.find((team: { teamId: string }) => team.teamId === "M-M").cash).toBe(60);
    expect(persistedState.seasonState.teamFacilities["M-M"]).toBeUndefined();
  });

  it("gibt fuer ein unbekanntes Gebaeude den Fehler zurueck statt zu werfen", async () => {
    const { POST } = await import("@/app/api/sponsor/uebernahme/route");
    const response = await POST(
      new Request("http://localhost/api/sponsor/uebernahme", {
        method: "POST",
        body: JSON.stringify({
          saveId: "save-singleplayer-dev",
          teamId: "M-M",
          facilityId: "arena",
          action: "annehmen",
          dryRun: false,
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toBe("uebernahme_angebot_nicht_gefunden");
    expect(persistenceMocks.saveSingleplayerState).not.toHaveBeenCalled();
  });

  it("das gilt genauso fuer ablehnen eines unbekannten Gebaeudes", async () => {
    const { POST } = await import("@/app/api/sponsor/uebernahme/route");
    const response = await POST(
      new Request("http://localhost/api/sponsor/uebernahme", {
        method: "POST",
        body: JSON.stringify({
          saveId: "save-singleplayer-dev",
          teamId: "M-M",
          facilityId: "arena",
          action: "ablehnen",
          dryRun: false,
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("uebernahme_angebot_nicht_gefunden");
    expect(persistenceMocks.saveSingleplayerState).not.toHaveBeenCalled();
  });

  it("dryRun (Default) rechnet, schreibt aber nicht", async () => {
    const { POST } = await import("@/app/api/sponsor/uebernahme/route");
    const response = await POST(
      new Request("http://localhost/api/sponsor/uebernahme", {
        method: "POST",
        body: JSON.stringify({
          saveId: "save-singleplayer-dev",
          teamId: "M-M",
          facilityId: "recovery_center",
          action: "annehmen",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.summary.applied).toBe(false);
    expect(persistenceMocks.saveSingleplayerState).not.toHaveBeenCalled();
  });

  it("validiert Pflichtfelder", async () => {
    const { POST } = await import("@/app/api/sponsor/uebernahme/route");
    const response = await POST(
      new Request("http://localhost/api/sponsor/uebernahme", {
        method: "POST",
        body: JSON.stringify({ saveId: "save-singleplayer-dev" }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
  });

  it("meldet einen fehlenden Spielstand als 404, nicht als 500", async () => {
    persistenceMocks.getSaveById.mockReturnValue(null);
    const { POST } = await import("@/app/api/sponsor/uebernahme/route");
    const response = await POST(
      new Request("http://localhost/api/sponsor/uebernahme", {
        method: "POST",
        body: JSON.stringify({
          saveId: "save-does-not-exist",
          teamId: "M-M",
          facilityId: "recovery_center",
          action: "annehmen",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("save_not_found");
  });

  it("blockiert im Prisma-Read-only-Modus", async () => {
    const { POST } = await import("@/app/api/sponsor/uebernahme/route");
    const response = await POST(
      new Request("http://localhost/api/sponsor/uebernahme", {
        method: "POST",
        body: JSON.stringify({
          saveId: "save-singleplayer-dev",
          teamId: "M-M",
          facilityId: "recovery_center",
          action: "annehmen",
          source: "prisma",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toContain("read-only");
    expect(persistenceMocks.getSaveById).not.toHaveBeenCalled();
  });
});
