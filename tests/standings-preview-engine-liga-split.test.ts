/**
 * LIGA-SPLIT: RANKING-SCOPE VON buildStandingsPreview (docs/design/liga-split-plan.md, Abschnitt
 * 2.2, PR 3). Eigene Datei statt eine Erweiterung von tests/standings-preview-engine.test.ts, weil
 * jene Datei einen einzigen, zwischen Tests mutierten `persistenceState` teilt — ein eigenstaendiges
 * Save haelt dieses Szenario unabhaengig davon.
 *
 * 4 Teams: L1A/L1B in Liga 1, L2A/L2B in Liga 2. Sowohl die Vor-Spieltags-Punkte als auch der
 * Spieltags-Score sind so gestaffelt, dass die GLOBALE Reihenfolge (ueber alle 4 Teams) eine ANDERE
 * waere als die liga-lokale: global waere L2A (30) vor L1B (10); liga-lokal muss L1B trotzdem
 * Liga-1-Rang 2 bekommen (nicht Rang 3) und L2A Liga-2-Rang 1 (nicht Rang 2).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildStandingsPreview } from "@/lib/standings/standings-preview-engine";

vi.mock("@/lib/standings/season-standings-sheet", () => ({
  inspectSeasonStandingsSheet: vi.fn(async () => ({
    sourceKind: "season_standings",
    access: "local_csv",
    status: "ok",
    reason: null,
    sheetUrl: null,
    headers: [],
    sampleRows: [],
    mappedRows: [],
    expectedExportPaths: [],
    detectedTabKind: "season_standings",
  })),
  inspectRankToPointsSheet: vi.fn(async () => ({
    sourceKind: "rank_to_points",
    access: "local_csv",
    status: "ok",
    reason: null,
    sheetUrl: null,
    headers: ["Spieleranzahl", "1.", "2."],
    sampleRows: [],
    mappedRows: [
      { raw: {}, playerCount: 2, pointsByRank: { "1.": 6.6, "2.": 6.2 } },
    ],
    expectedExportPaths: [],
    detectedTabKind: "rank_to_points",
  })),
  mapSeasonStandingsRowsToTeams: vi.fn((rows: unknown[]) => ({
    mappedTeamsCount: rows.length,
    missingInSheet: [],
    missingInDb: [],
    duplicateSheetTeams: [],
    ambiguousMappings: [],
    mappingWarnings: [],
    rows,
  })),
}));

function buildDisciplineResult(input: {
  id: string;
  teamId: string;
  disciplineId: string;
  disciplineSide: "d1" | "d2";
  rank: number;
  totalScore: number;
}) {
  return {
    id: input.id,
    matchdayResultId: "result-1",
    teamId: input.teamId,
    disciplineId: input.disciplineId,
    disciplineSide: input.disciplineSide,
    rank: input.rank,
    baseScore: input.totalScore,
    totalScore: input.totalScore,
    readinessStatus: "ready" as const,
    warnings: [],
    createdAt: "2026-06-04T00:00:00.000Z",
  };
}

function buildSave(leagueByTeamId?: Record<string, "liga1" | "liga2">) {
  return {
    saveId: "save-liga-split",
    name: "Liga Split Save",
    status: "active" as const,
    createdAt: "2026-06-04T00:00:00.000Z",
    updatedAt: "2026-06-04T00:00:00.000Z",
    gameState: {
      season: { id: "season-1", name: "Season 1", year: 1, currentMatchday: 1, matchdayIds: ["matchday-1"] },
      seasonState: {
        seasonId: "season-1",
        schedule: [],
        // Vor-Spieltags-Punkte: global waere die Reihenfolge L1A(50) > L2A(30) > L1B(10) > L2B(5).
        standings: {
          "L1A": { points: 50 },
          "L1B": { points: 10 },
          "L2A": { points: 30 },
          "L2B": { points: 5 },
        },
        disciplineSchedule: [
          {
            seasonId: "season-1",
            matchdayId: "matchday-1",
            matchdayIndex: 1,
            matchdayLabel: "Spieltag 1",
            discipline1: { disciplineId: "mini-dm", displayName: "Mini DM", order: 1, playerCount: 2, category: "mental" },
            discipline2: { disciplineId: "fechten", displayName: "Fechten", order: 2, playerCount: 2, category: "speed" },
            sourceStatus: "test",
            sourceNote: "test",
          },
        ],
        lineupDrafts: [],
        matchdayResults: [
          {
            id: "result-1",
            saveId: "save-liga-split",
            seasonId: "season-1",
            matchdayId: "matchday-1",
            status: "preview_applied" as const,
            sourceVersion: "legacy-resolve-preview-v1",
            teamsTotal: 4,
            teamsReady: 4,
            teamsUnderfilled: 0,
            teamsMissingLineup: 0,
            teamsInvalidLineup: 0,
            teamsMissingScoreCoverage: 0,
            warningsCount: 0,
            createdAt: "2026-06-04T00:00:00.000Z",
            updatedAt: "2026-06-04T00:00:00.000Z",
          },
        ],
        // Spieltags-Score: global waere die Reihenfolge wieder L1A(150) > L2A(110) > L1B(15) > L2B(5).
        // Die gespeicherten discipline-Raenge sind bereits liga-lokal (so, wie sie der Resolve-Motor
        // seit PR 3 tatsaechlich schreibt) -- Rang 1/2 je Liga statt 1..4 global.
        disciplineResults: [
          buildDisciplineResult({ id: "dr-l1a-d1", teamId: "L1A", disciplineId: "mini-dm", disciplineSide: "d1", rank: 1, totalScore: 80 }),
          buildDisciplineResult({ id: "dr-l1a-d2", teamId: "L1A", disciplineId: "fechten", disciplineSide: "d2", rank: 1, totalScore: 70 }),
          buildDisciplineResult({ id: "dr-l1b-d1", teamId: "L1B", disciplineId: "mini-dm", disciplineSide: "d1", rank: 2, totalScore: 8 }),
          buildDisciplineResult({ id: "dr-l1b-d2", teamId: "L1B", disciplineId: "fechten", disciplineSide: "d2", rank: 2, totalScore: 7 }),
          buildDisciplineResult({ id: "dr-l2a-d1", teamId: "L2A", disciplineId: "mini-dm", disciplineSide: "d1", rank: 1, totalScore: 60 }),
          buildDisciplineResult({ id: "dr-l2a-d2", teamId: "L2A", disciplineId: "fechten", disciplineSide: "d2", rank: 1, totalScore: 50 }),
          buildDisciplineResult({ id: "dr-l2b-d1", teamId: "L2B", disciplineId: "mini-dm", disciplineSide: "d1", rank: 2, totalScore: 3 }),
          buildDisciplineResult({ id: "dr-l2b-d2", teamId: "L2B", disciplineId: "fechten", disciplineSide: "d2", rank: 2, totalScore: 2 }),
        ],
        playerDisciplinePerformances: [],
        disciplineHighlights: [],
        resultAuditLogs: [],
        leagueByTeamId,
      },
      matchdayState: { matchdayId: "matchday-1", status: "planning" as const, pendingTeamIds: [], resolvedFixtureIds: [] },
      teams: [
        { teamId: "L1A", shortCode: "L1A", name: "Liga1 A", budget: 100, cash: 100, identityId: "l1a", humanControlled: true, rosterLimit: 12 },
        { teamId: "L1B", shortCode: "L1B", name: "Liga1 B", budget: 100, cash: 100, identityId: "l1b", humanControlled: false, rosterLimit: 12 },
        { teamId: "L2A", shortCode: "L2A", name: "Liga2 A", budget: 100, cash: 100, identityId: "l2a", humanControlled: false, rosterLimit: 12 },
        { teamId: "L2B", shortCode: "L2B", name: "Liga2 B", budget: 100, cash: 100, identityId: "l2b", humanControlled: false, rosterLimit: 12 },
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
        teamCount: 4,
        unmappedPlayers: [],
        teamsWithoutPlayers: [],
        mappingRowsWithoutPlayerMatch: [],
        duplicateMappedPlayers: [],
        unknownTeamCodes: [],
        duplicateTeamCodes: [],
        warnings: [],
      },
    },
  };
}

let activeSave = buildSave(undefined);

vi.mock("@/lib/persistence/persistence-service", () => ({
  createPersistenceService: vi.fn(() => ({
    bootstrapSingleplayerSave: () => ({ save: activeSave, createdFromSeed: false }),
    getActiveSave: () => activeSave,
    getSaveById: (saveId: string) => (saveId === activeSave.saveId ? activeSave : null),
    saveSingleplayerState: vi.fn(),
    createSave: vi.fn(),
    createFreshSeasonOneSave: vi.fn(),
    cloneSave: vi.fn(),
    activateSave: vi.fn(),
    listSaves: vi.fn(() => []),
  })),
}));

describe("standings preview engine — liga split", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = process.env.DATABASE_URL || "postgres://test";
  });

  it("without leagueByTeamId, ranks all 4 teams together (legacy, global race)", async () => {
    activeSave = buildSave(undefined);
    const result = await buildStandingsPreview({ saveId: "save-liga-split", seasonId: "season-1", matchdayId: "matchday-1", source: "sqlite" });
    const rankOf = (teamId: string) => result.items.find((item) => item.teamId === teamId)?.currentRank;

    expect(rankOf("L1A")).toBe(1);
    expect(rankOf("L2A")).toBe(2);
    expect(rankOf("L1B")).toBe(3);
    expect(rankOf("L2B")).toBe(4);
  });

  it("with leagueByTeamId set, ranks (current/matchday/projected) stay within each team's own league", async () => {
    activeSave = buildSave({ L1A: "liga1", L1B: "liga1", L2A: "liga2", L2B: "liga2" });
    const result = await buildStandingsPreview({ saveId: "save-liga-split", seasonId: "season-1", matchdayId: "matchday-1", source: "sqlite" });
    const itemOf = (teamId: string) => result.items.find((item) => item.teamId === teamId);

    // currentRank: global waere L2A vor L1B (30 > 10) -- liga-lokal ist L1B Liga-1-Rang 2.
    expect(itemOf("L1A")?.currentRank).toBe(1);
    expect(itemOf("L1B")?.currentRank).toBe(2);
    expect(itemOf("L2A")?.currentRank).toBe(1);
    expect(itemOf("L2B")?.currentRank).toBe(2);

    // matchdayRank: dieselbe Verschiebung, diesmal ueber den Spieltags-Score.
    expect(itemOf("L1A")?.matchdayRank).toBe(1);
    expect(itemOf("L1B")?.matchdayRank).toBe(2);
    expect(itemOf("L2A")?.matchdayRank).toBe(1);
    expect(itemOf("L2B")?.matchdayRank).toBe(2);

    // projectedRank (nach Spieltags-Punkten): L2A bekommt liga-lokal Rang-1-Punkte (6.6), obwohl
    // global nur der zweitstaerkste projizierte Punktestand im Feld.
    expect(itemOf("L1A")?.projectedRank).toBe(1);
    expect(itemOf("L1B")?.projectedRank).toBe(2);
    expect(itemOf("L2A")?.projectedRank).toBe(1);
    expect(itemOf("L2B")?.projectedRank).toBe(2);
  });
});
