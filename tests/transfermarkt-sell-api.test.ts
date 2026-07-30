import { beforeEach, describe, expect, it, vi } from "vitest";

const previewLocalTransfermarktSell = vi.fn();
const executeLocalTransfermarktSell = vi.fn();
const persistenceMocks = vi.hoisted(() => ({
  getSaveById: vi.fn(),
}));

vi.mock("@/lib/market/transfermarkt-local-service", () => ({
  previewLocalTransfermarktSell,
  executeLocalTransfermarktSell,
}));

vi.mock("@/lib/persistence/persistence-service", () => ({
  createPersistenceService: () => ({
    getSaveById: persistenceMocks.getSaveById,
  }),
}));

function phaseSave(gamePhase = "transfer_sell_phase") {
  return {
    saveId: "save-singleplayer-dev",
    status: "active",
    gameState: {
      gamePhase,
      season: { id: "season-1", name: "Season 1", year: 2026, currentMatchday: 1, matchdayIds: ["md-1"] },
      seasonState: { seasonId: "season-1", schedule: [], standings: {} },
      matchdayState: { matchdayId: "md-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
      teams: [{ teamId: "M-M", shortCode: "M-M", name: "Mayhem Mavericks", budget: 500, cash: 300, identityId: "M-M", humanControlled: true, rosterLimit: 12 }],
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

describe("transfermarkt sell api", () => {
  beforeEach(() => {
    previewLocalTransfermarktSell.mockReset();
    executeLocalTransfermarktSell.mockReset();
    persistenceMocks.getSaveById.mockReset();
    persistenceMocks.getSaveById.mockReturnValue(phaseSave());
  });

  // Der erste `await import(...route)` zieht den kompletten Route-Abhängigkeitsgraph
  // (Socket-/Room-/Market-/Persistence-Module) nach und braucht in einem frischen
  // Vitest-Worker ~5,5s — knapp über dem 5000ms-Default. Kein Logik-Hänger, nur der
  // einmalige Import-Aufwand des ersten Tests; Timeout entsprechend anheben.
  it("uses the local sqlite dry-run path by default", async () => {
    previewLocalTransfermarktSell.mockReturnValue({
      canSell: true,
      blockingReasons: [],
      warnings: [],
      player: { id: "player-1", name: "Selene Dusk", className: "Overseer", race: "Human" },
      team: { id: "A-A", name: "Armageddon Aftermath", shortCode: "A-A" },
      activePlayer: {
        id: "active-1",
        playerId: "player-1",
        status: "active",
        roleTag: "bench",
        contractLength: 1,
        salary: 4000,
        purchasePrice: 50000,
        currentValue: 52000,
        joinedSeasonId: "season-1",
      },
      cashBefore: 200000,
      cashAfter: 252000,
      rosterBefore: 8,
      rosterAfter: 7,
      teamSalaryBefore: 32000,
      teamSalaryAfter: 28000,
      salePrice: 52000,
      salaryReduction: 4000,
      projectedReadinessAfterSell: "ready",
    });

    const { POST } = await import("@/app/api/transfermarkt/sell/route");
    const response = await POST(
      new Request("http://localhost/api/transfermarkt/sell", {
        method: "POST",
        body: JSON.stringify({
          saveId: "save-singleplayer-dev",
          seasonId: "season-1",
          teamId: "M-M",
          activePlayerId: "active-1",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(previewLocalTransfermarktSell).toHaveBeenCalledTimes(1);
    expect(executeLocalTransfermarktSell).not.toHaveBeenCalled();
    expect(body.success).toBe(true);
  }, 30000);

  it("writes through the local sqlite execute path when dryRun is false", async () => {
    executeLocalTransfermarktSell.mockReturnValue({
      canSell: true,
      blockingReasons: [],
      warnings: [],
      player: { id: "player-1", name: "Selene Dusk", className: "Overseer", race: "Human" },
      team: { id: "A-A", name: "Armageddon Aftermath", shortCode: "A-A" },
      activePlayer: {
        id: "active-1",
        playerId: "player-1",
        status: "active",
        roleTag: "bench",
        contractLength: 1,
        salary: 4000,
        purchasePrice: 50000,
        currentValue: 52000,
        joinedSeasonId: "season-1",
      },
      cashBefore: 200000,
      cashAfter: 252000,
      rosterBefore: 8,
      rosterAfter: 7,
      teamSalaryBefore: 32000,
      teamSalaryAfter: 28000,
      salePrice: 52000,
      salaryReduction: 4000,
      projectedReadinessAfterSell: "ready",
      activePlayerRemoved: true,
      transferCreated: true,
      teamSeasonStateUpdated: true,
      transferId: "local-transfer:save-singleplayer-dev:player-1",
    });

    const { POST } = await import("@/app/api/transfermarkt/sell/route");
    const response = await POST(
      new Request("http://localhost/api/transfermarkt/sell", {
        method: "POST",
        body: JSON.stringify({
          saveId: "save-singleplayer-dev",
          seasonId: "season-1",
          teamId: "M-M",
          activePlayerId: "active-1",
          dryRun: false,
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(executeLocalTransfermarktSell).toHaveBeenCalledTimes(1);
    expect(previewLocalTransfermarktSell).not.toHaveBeenCalled();
    expect(body.summary.activePlayerRemoved).toBe(true);
  });

  it("blocks sells in prisma read-only mode", async () => {
    const { POST } = await import("@/app/api/transfermarkt/sell/route");
    const response = await POST(
      new Request("http://localhost/api/transfermarkt/sell", {
        method: "POST",
        body: JSON.stringify({
          saveId: "save-initial",
          seasonId: "season-1",
          teamId: "A-A",
          activePlayerId: "active-1",
          source: "prisma",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.success).toBe(false);
    expect(body.error).toContain("read-only");
    expect(previewLocalTransfermarktSell).not.toHaveBeenCalled();
    expect(executeLocalTransfermarktSell).not.toHaveBeenCalled();
  });

  it("validates required parameters", async () => {
    const { POST } = await import("@/app/api/transfermarkt/sell/route");
    const response = await POST(
      new Request("http://localhost/api/transfermarkt/sell", {
        method: "POST",
        body: JSON.stringify({
          saveId: "save-singleplayer-dev",
          source: "sqlite",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
  });

  it("blocks sells outside the transfer/setup phase", async () => {
    persistenceMocks.getSaveById.mockReturnValue(phaseSave("season_completed"));

    const { POST } = await import("@/app/api/transfermarkt/sell/route");
    const response = await POST(
      new Request("http://localhost/api/transfermarkt/sell", {
        method: "POST",
        body: JSON.stringify({
          saveId: "save-singleplayer-dev",
          seasonId: "season-1",
          teamId: "M-M",
          activePlayerId: "active-1",
          // Der AUSFUEHRENDE Pfad — nur der laeuft in die Phasensperre.
          dryRun: false,
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe("phase_blocked:sell_players:season_completed");
    expect(executeLocalTransfermarktSell).not.toHaveBeenCalled();
  });

  /**
   * Vertragsaenderung, bewusst: die Phasensperre gilt fuer den VERKAUF, nicht
   * fuer das Nachschlagen. Vorher lief auch die reine Vorschau dagegen und
   * antwortete mit 409 und `summary: null` — der Spieler sah ausserhalb des
   * Fensters statt Preis, Erloes und GuV nur Striche, genau wenn er entscheiden
   * will, wen er am Saisonende abgibt.
   *
   * Gefahrlos ist das, weil die Vorschau den Verkauf nicht ermoeglicht: sie
   * traegt den Sachverhalt selbst als `blockingReasons` mit `canSell: false`.
   * Am echten Spielstand in `season_completed` nachgemessen.
   */
  it("liefert die Vorschau auch ausserhalb des Verkaufsfensters — samt Blockgrund", async () => {
    persistenceMocks.getSaveById.mockReturnValue(phaseSave("season_completed"));
    previewLocalTransfermarktSell.mockReturnValue({
      canSell: false,
      blockingReasons: ["sell_only_at_season_end"],
      warnings: [],
      salePrice: 28.37,
      netProceeds: 23.13,
    });

    const { POST } = await import("@/app/api/transfermarkt/sell/route");
    const response = await POST(
      new Request("http://localhost/api/transfermarkt/sell", {
        method: "POST",
        body: JSON.stringify({
          saveId: "save-singleplayer-dev",
          seasonId: "season-1",
          teamId: "M-M",
          activePlayerId: "active-1",
        }),
      }),
    );
    const body = await response.json();

    expect(previewLocalTransfermarktSell).toHaveBeenCalled();
    // Die Zahlen sind da …
    expect(body.summary.salePrice).toBe(28.37);
    expect(body.summary.netProceeds).toBe(23.13);
    // … und die Sperre auch.
    expect(body.summary.canSell).toBe(false);
    expect(body.summary.blockingReasons).toContain("sell_only_at_season_end");
    // Kein `error`: das ist ein regulaerer Zustand, kein Fehlschlag. Sonst zeigte
    // das Modal denselben Sachverhalt zweimal.
    expect(body.error).toBeUndefined();
    // Und verkauft wurde ganz sicher nichts.
    expect(executeLocalTransfermarktSell).not.toHaveBeenCalled();
  });
});
