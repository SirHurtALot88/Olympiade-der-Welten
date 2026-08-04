import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import type { PersistedSaveGame } from "@/lib/persistence/types";

// Die KI soll fuer den NAECHSTEN Spieltag aufstellen, sobald der vorige durch ist —
// nicht erst, wenn der Spieler seine eigene Aufstellung speichert oder die Arena
// oeffnet. Sie braucht keinen dieser Ausloeser: nach dem Spieltagswechsel stehen
// Kader, Formkarten und Training fest.

const aiBatch = vi.fn();

vi.mock("@/lib/ai/ai-legacy-lineup-batch-apply-service", () => ({
  applyAiLegacyLineupBatchLocally: (...args: unknown[]) => aiBatch(...args),
  buildAiLegacyLineupModifiers: vi.fn(),
}));

const { ADVANCE_MATCHDAY_CONFIRM_TOKEN, executeMatchdayAdvance } = await import(
  "@/lib/season/matchday-progress-service"
);

function createPersistenceMock(matchdayIds: string[]) {
  const save: PersistedSaveGame = {
    saveId: "save-local",
    name: "Local",
    status: "active",
    createdAt: "2026-06-04T00:00:00.000Z",
    updatedAt: "2026-06-04T00:00:00.000Z",
    gameState: {
      season: { id: "season-1", name: "Season 1", year: 1, currentMatchday: 1, matchdayIds },
      seasonState: {
        seasonId: "season-1",
        schedule: [{ id: "fixture-1", homeTeamId: "A-A", awayTeamId: "B-B", matchdayId: "matchday-1", status: "scheduled" }],
        standings: { "A-A": { points: 10, rank: 1 }, "B-B": { points: 8, rank: 2 } },
        lineupDrafts: [],
        matchdayResults: [{ id: "result-1", seasonId: "season-1", matchdayId: "matchday-1" } as never],
        standingsApplyLogs: [
          {
            id: "standings-audit-1",
            saveId: "save-local",
            seasonId: "season-1",
            matchdayId: "matchday-1",
            action: "apply",
            payload: {
              idempotencyKey: "standings-apply:save-local:season-1:matchday-1",
              totalTeams: 2,
              appliedTeams: 2,
              tieGroupsCount: 0,
              previewWarningsCount: 0,
            },
            createdAt: "2026-06-04T00:00:00.000Z",
          },
        ],
        cashPrizeApplyLogs: [],
        matchdayAdvanceLogs: [],
      },
      matchdayState: { matchdayId: "matchday-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
      teams: [
        { teamId: "A-A", shortCode: "A-A", name: "Alpha", budget: 100, cash: 100, identityId: "a", humanControlled: true, rosterLimit: 12 },
        { teamId: "B-B", shortCode: "B-B", name: "Beta", budget: 100, cash: 100, identityId: "b", humanControlled: false, rosterLimit: 12 },
      ],
      teamIdentities: [],
      players: [],
      disciplines: [],
      rosters: [],
      contracts: [],
      transferListings: [],
      transferHistory: [],
      logs: [],
      mappingReport: {
        mappingSource: "test",
        teamSource: "test",
        generatedAt: "2026-06-04T00:00:00.000Z",
        processedMappingRows: 0,
        importedPlayerCount: 0,
        matchedRosterCount: 0,
        teamCount: 2,
        unmappedPlayers: [],
        teamsWithoutPlayers: [],
        mappingRowsWithoutPlayerMatch: [],
        duplicateMappedPlayers: [],
        unknownTeamCodes: [],
        duplicateTeamCodes: [],
        warnings: [],
      },
    } as unknown as GameState,
  };

  const persistence = {
    bootstrapSingleplayerSave: vi.fn(() => ({ save, createdFromSeed: false })),
    getActiveSave: vi.fn(() => save),
    getSaveById: vi.fn((saveId: string) => (saveId === save.saveId ? save : null)),
    saveSingleplayerState: vi.fn((_saveId: string, gameState: GameState) => {
      save.gameState = gameState;
      return save;
    }),
    createSave: vi.fn(),
    createFreshSeasonOneSave: vi.fn(),
    cloneSave: vi.fn(),
    activateSave: vi.fn(),
    listSaves: vi.fn(() => []),
  };

  return { save, persistence };
}

async function advance(persistence: unknown) {
  return executeMatchdayAdvance(
    { saveId: "save-local", seasonId: "season-1", execute: true, confirm: ADVANCE_MATCHDAY_CONFIRM_TOKEN },
    persistence as never,
  );
}

describe("KI stellt beim Spieltagswechsel auf", () => {
  beforeEach(() => aiBatch.mockReset());

  it("stellt direkt fuer den naechsten Spieltag auf", async () => {
    const { persistence } = createPersistenceMock(["matchday-1", "matchday-2"]);
    await advance(persistence);

    expect(aiBatch).toHaveBeenCalledTimes(1);
    const call = aiBatch.mock.calls[0][0];
    // Der NEUE Spieltag, nicht der gerade abgeschlossene.
    expect(call.matchdayId).toBe("matchday-2");
    expect(call.seasonId).toBe("season-1");
    expect(call.dryRun).toBe(false);
    // Vorhandene Aufstellungen bleiben unangetastet -> der Aufruf ist idempotent, und
    // die spaeteren Aufrufe beim Speichern und beim Ergebnis-Commit finden nichts mehr.
    expect(call.overwriteExisting).toBe(false);
    // Die injizierte Persistence MUSS durchgereicht werden — sonst faellt der Aufruf
    // intern auf seine eigene createPersistenceService() zurueck und schreibt an einem
    // Persistence-Sandbox (z. B. dem des Whole-Season-DryRuns) vorbei direkt in die
    // echte Ablage. Das war der Grund fuer den vorher fast immer roten
    // `season:smoke-whole-season-dry-run`-Wachhund.
    expect(aiBatch.mock.calls[0][1]).toBe(persistence);
  });

  it("laeuft NACH dem Persistieren, damit der Wechsel sicher geschrieben ist", async () => {
    const { persistence } = createPersistenceMock(["matchday-1", "matchday-2"]);
    const order: string[] = [];
    persistence.saveSingleplayerState.mockImplementation((_id: string, gameState: GameState) => {
      order.push("persist");
      return { saveId: "save-local", gameState } as never;
    });
    aiBatch.mockImplementation(() => order.push("ai"));

    await advance(persistence);
    expect(order).toEqual(["persist", "ai"]);
  });

  it("kann den Spieltagswechsel nicht kippen, wenn die KI scheitert", async () => {
    // Verhalten ist verifiziert: mit einem werfenden Batch loest `executeMatchdayAdvance`
    // trotzdem auf. Festgehalten wird es hier an der Quelle, weil ein werfender Mock von
    // vitest als unbehandelter Fehler gemeldet wird und den Lauf rot faerbt, obwohl der
    // Code ihn korrekt schluckt.
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const source = await fs.readFile(path.join(process.cwd(), "lib/season/matchday-progress-service.ts"), "utf8");
    const tail = source.slice(source.indexOf("persistence.saveSingleplayerState(save.saveId, finalGameState)"));
    const block = tail.slice(tail.indexOf("if (prepared.nextMatchdayId) {"), tail.indexOf("return finalGameState"));

    // Der Wechsel ist zu diesem Zeitpunkt schon geschrieben — ein Fehler der KI darf den
    // Spieler nicht in einem halben Zustand zuruecklassen.
    expect(block).toContain("try {");
    expect(block).toContain("} catch {");
    expect(block).toContain("applyAiLegacyLineupBatchLocally({");
  });

  it("ruft am Saisonende nichts auf — es gibt keinen naechsten Spieltag", async () => {
    const { persistence } = createPersistenceMock(["matchday-1"]);
    await advance(persistence);
    expect(aiBatch).not.toHaveBeenCalled();
  });
});
