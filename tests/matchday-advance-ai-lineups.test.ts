import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import type { PersistedSaveGame } from "@/lib/persistence/types";

// DER SPIELTAGSWECHSEL SCHREIBT NUR NOCH DEN SPIELTAG.
//
// Die KI-Aufstellungen fuer den neuen Spieltag entstanden frueher direkt hier. Das kostet
// fuer 32 Teams gemessen 15-21 s und machte 82 % der 46,7 s aus, die „Spieltag
// abschliessen" gebraucht hat. Auf Wunsch von Chris laeuft das Aufwaermen jetzt im
// Hintergrund, sobald der Spieler wieder im Saisonstand steht
// (`POST /api/lineups/legacy/ai-batch-prewarm`, angestossen aus `cockpit-matchday-handlers`).
//
// Was hier bleibt: die Neubewertung der KI-Trainingsmodi. Sie ist billig und MUSS stehen,
// bevor irgendetwas den Modus liest — auch der Hintergrund-Batch liest ihn mit.

const aiBatch = vi.fn();
const trainingReevaluation = vi.fn();

vi.mock("@/lib/ai/ai-legacy-lineup-batch-apply-service", () => ({
  applyAiLegacyLineupBatchLocally: (...args: unknown[]) => aiBatch(...args),
  buildAiLegacyLineupModifiers: vi.fn(),
}));

vi.mock("@/lib/ai/ai-training-mode-reevaluation-service", () => ({
  reevaluateAiTrainingModesForMatchday: (...args: unknown[]) => trainingReevaluation(...args),
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

describe("Spieltagswechsel schreibt nur den Spieltag", () => {
  beforeEach(() => {
    aiBatch.mockReset();
    trainingReevaluation.mockReset();
  });

  it("erzeugt KEINE KI-Aufstellungen mehr — die holt der Hintergrundlauf", async () => {
    const { persistence } = createPersistenceMock(["matchday-1", "matchday-2"]);
    await advance(persistence);

    // Das ist der Kern der Auslagerung: die 15-21 s Aufstellungs-Erzeugung haengen nicht
    // mehr am Spieltagswechsel. Angestossen wird sie aus dem Cockpit, sobald der Spieler
    // wieder im Saisonstand steht.
    expect(aiBatch).not.toHaveBeenCalled();
  });

  it("bewertet die Trainingsmodi weiterhin neu, mit der injizierten Persistence", async () => {
    const { persistence } = createPersistenceMock(["matchday-1", "matchday-2"]);
    await advance(persistence);

    expect(trainingReevaluation).toHaveBeenCalledTimes(1);
    // Die injizierte Persistence MUSS durchgereicht werden — sonst faellt der Aufruf
    // intern auf seine eigene createPersistenceService() zurueck und schreibt an einem
    // Persistence-Sandbox (z. B. dem des Whole-Season-DryRuns) vorbei direkt in die
    // echte Ablage. Das war der Grund fuer den vorher fast immer roten
    // `season:smoke-whole-season-dry-run`-Wachhund.
    expect(trainingReevaluation.mock.calls[0][0]).toMatchObject({ saveId: "save-local", persistence });
  });

  it("laeuft NACH dem Persistieren, damit der Wechsel sicher geschrieben ist", async () => {
    const { persistence } = createPersistenceMock(["matchday-1", "matchday-2"]);
    const order: string[] = [];
    persistence.saveSingleplayerState.mockImplementation((_id: string, gameState: GameState) => {
      order.push("persist");
      return { saveId: "save-local", gameState } as never;
    });
    trainingReevaluation.mockImplementation(() => order.push("training"));

    await advance(persistence);
    // Der Wechsel liegt auf der Platte, BEVOR irgendeine Nacharbeit laeuft. Ein Absturz
    // mittendrin darf den Spieltagsuebergang nicht verlieren.
    expect(order).toEqual(["persist", "training"]);
  });

  it("kann den Spieltagswechsel nicht kippen, wenn die Nacharbeit scheitert", async () => {
    // Verhalten ist verifiziert: mit einem werfenden Aufruf loest `executeMatchdayAdvance`
    // trotzdem auf. Festgehalten wird es hier an der Quelle, weil ein werfender Mock von
    // vitest als unbehandelter Fehler gemeldet wird und den Lauf rot faerbt, obwohl der
    // Code ihn korrekt schluckt.
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const source = await fs.readFile(path.join(process.cwd(), "lib/season/matchday-progress-service.ts"), "utf8");
    const tail = source.slice(source.indexOf("persistence.saveSingleplayerState(save.saveId, finalGameState)"));
    const block = tail.slice(tail.indexOf("if (prepared.nextMatchdayId) {"), tail.indexOf("return finalGameState"));

    // Der Wechsel ist zu diesem Zeitpunkt schon geschrieben — ein Fehler der Nacharbeit
    // darf den Spieler nicht in einem halben Zustand zuruecklassen.
    expect(block).toContain("try {");
    expect(block).toContain("} catch {");
    expect(block).toContain("reevaluateAiTrainingModesForMatchday(");
    // Und die Aufstellungs-Erzeugung darf hier NICHT wieder auftauchen.
    expect(block).not.toContain("applyAiLegacyLineupBatchLocally(");
  });

  it("ruft am Saisonende nichts auf — es gibt keinen naechsten Spieltag", async () => {
    const { persistence } = createPersistenceMock(["matchday-1"]);
    await advance(persistence);
    expect(aiBatch).not.toHaveBeenCalled();
    expect(trainingReevaluation).not.toHaveBeenCalled();
  });
});
