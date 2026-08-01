// Hält Chris' ausdrücklich benannte Invariante fest: „Standardsortierung ist nach Punkten absteigend
// und Team mit den meisten Punkten = Rang 1." Anlass waren die Meldungen xqz47b und 9zyqg6
// (Tagesrang 1 mit 22 Punkten, aber Rang 14 im Saisonstand). Die Ursache lag nicht in der Rangbildung
// (behoben in #297, ausgelassener Standings-Apply), sondern die Rangbildung selbst war schon korrekt —
// dieser Test hält sie fest, damit sie es bleibt.
//
// Geprüfte Stellen:
// - standings-tiebreaker-policy.ts: sortForProjectedPoints (über resolveProjectedRankWithTiePolicy),
//   die Stelle, an der die Sortierrichtung tatsächlich entsteht.
// - standings-preview-engine.ts: buildCurrentRankMap (über buildStandingsPreview), die zweite Stelle,
//   die dieselbe Regel für den Saisonstand-Rang anwendet.
import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildStandingsPreview } from "@/lib/standings/standings-preview-engine";
import {
  resolveProjectedRankWithTiePolicy,
  type StandingsTieBreakItem,
} from "@/lib/standings/standings-tiebreaker-policy";

function buildTieBreakItem(
  overrides: Partial<StandingsTieBreakItem> & Pick<StandingsTieBreakItem, "teamId" | "teamName">,
): StandingsTieBreakItem {
  return {
    totalScore: null,
    projectedPoints: null,
    currentRank: null,
    currentPoints: null,
    matchdayRank: null,
    cash: null,
    ...overrides,
  };
}

function buildTeam(teamId: string, name: string) {
  return {
    teamId,
    shortCode: teamId,
    name,
    budget: 100,
    cash: 100,
    identityId: teamId,
    humanControlled: false,
    rosterLimit: 12,
  };
}

const rankInvariantSave = {
  saveId: "save-rank-invariant",
  name: "Rank Invariant Save",
  status: "active" as const,
  createdAt: "2026-06-04T00:00:00.000Z",
  updatedAt: "2026-06-04T00:00:00.000Z",
  gameState: {
    season: { id: "season-1", name: "Season 1", year: 1, currentMatchday: 1, matchdayIds: ["matchday-1"] },
    seasonState: {
      seasonId: "season-1",
      schedule: [],
      // Fünf Teams, gestaffelte Punkte plus ein echter Gleichstand (TIE-A/TIE-B) — deckt sowohl die
      // Monotonie als auch den Stichentscheid-Fall für den Saisonstand-Rang ab.
      standings: {
        TOP: { points: 50 },
        MID: { points: 35 },
        "TIE-A": { points: 20 },
        "TIE-B": { points: 20 },
        BOTTOM: { points: 5 },
      },
      disciplineSchedule: [],
      lineupDrafts: [],
      matchdayResults: [],
      disciplineResults: [],
      playerDisciplinePerformances: [],
      disciplineHighlights: [],
      resultAuditLogs: [],
    },
    matchdayState: {
      matchdayId: "matchday-1",
      status: "planning" as const,
      pendingTeamIds: [],
      resolvedFixtureIds: [],
    },
    teams: [
      buildTeam("TOP", "Spitzenreiter"),
      buildTeam("MID", "Mittelfeld"),
      buildTeam("TIE-A", "Adler"),
      buildTeam("TIE-B", "Bären"),
      buildTeam("BOTTOM", "Schlusslicht"),
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
      teamCount: 5,
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
    headers: [],
    sampleRows: [],
    mappedRows: [],
    expectedExportPaths: [],
    detectedTabKind: "rank_to_points",
  })),
  mapSeasonStandingsRowsToTeams: vi.fn((rows) => ({
    mappedTeamsCount: rows.length,
    missingInSheet: [],
    missingInDb: [],
    duplicateSheetTeams: [],
    ambiguousMappings: [],
    mappingWarnings: [],
    rows,
  })),
}));

vi.mock("@/lib/persistence/persistence-service", () => ({
  createPersistenceService: vi.fn(() => ({
    bootstrapSingleplayerSave: () => ({ save: rankInvariantSave, createdFromSeed: false }),
    getActiveSave: () => rankInvariantSave,
    getSaveById: (saveId: string) => (saveId === rankInvariantSave.saveId ? rankInvariantSave : null),
    saveSingleplayerState: vi.fn(),
    createSave: vi.fn(),
    createFreshSeasonOneSave: vi.fn(),
    cloneSave: vi.fn(),
    activateSave: vi.fn(),
    listSaves: vi.fn(() => []),
  })),
}));

describe("Rang-Invariante: meiste Punkte = Rang 1 (standings-tiebreaker-policy)", () => {
  it("ordnet Teams streng nach Punkten absteigend — das punktbeste Team wird Rang 1, nicht Rang N", () => {
    const items = [
      buildTieBreakItem({ teamId: "T-1", teamName: "Team Eins", projectedPoints: 40 }),
      buildTieBreakItem({ teamId: "T-2", teamName: "Team Zwei", projectedPoints: 22 }),
      buildTieBreakItem({ teamId: "T-3", teamName: "Team Drei", projectedPoints: 31 }),
      buildTieBreakItem({ teamId: "T-4", teamName: "Team Vier", projectedPoints: 5 }),
    ];

    const ranks = resolveProjectedRankWithTiePolicy(items, "deterministic_sort");

    // Kernaussage der Invariante: das punktbeste Team (40 Punkte) bekommt Rang 1.
    expect(ranks.get("T-1")).toBe(1);
    // Gegenrichtung ausdrücklich benannt: nicht den letzten Platz, wie es eine aufsteigende
    // Sortierung (der gemeldete Fehlerverdacht in xqz47b/9zyqg6) liefern würde.
    expect(ranks.get("T-1")).not.toBe(items.length);

    // Monotonie: mehr Punkte => kleinerer (besserer) Rang, für jedes benachbarte Paar in der Reihung.
    expect(ranks.get("T-1")!).toBeLessThan(ranks.get("T-3")!);
    expect(ranks.get("T-3")!).toBeLessThan(ranks.get("T-2")!);
    expect(ranks.get("T-2")!).toBeLessThan(ranks.get("T-4")!);

    // Das schwächste Team steht am Tabellenende, nicht an der Spitze.
    expect(ranks.get("T-4")).toBe(items.length);
  });

  it("Gegenprobe: eine aufsteigende Sortierung (der gemeldete Fehlerverdacht) verletzt die Invariante", () => {
    // Baut das gemeldete Fehlerbild nach, ohne Produktivcode zu ändern: Diese Hilfssortierung ist
    // absichtlich falsch (aufsteigend) und dient nur als Beleg, dass die obige Prüfung diesen Fehler
    // erkennen würde, wenn er in resolveProjectedRankWithTiePolicy einträte.
    const items = [
      buildTieBreakItem({ teamId: "T-1", teamName: "Team Eins", projectedPoints: 40 }),
      buildTieBreakItem({ teamId: "T-2", teamName: "Team Zwei", projectedPoints: 22 }),
      buildTieBreakItem({ teamId: "T-3", teamName: "Team Drei", projectedPoints: 31 }),
      buildTieBreakItem({ teamId: "T-4", teamName: "Team Vier", projectedPoints: 5 }),
    ];

    const ascendingRanks = new Map(
      [...items]
        .sort((left, right) => (left.projectedPoints ?? 0) - (right.projectedPoints ?? 0))
        .map((item, index) => [item.teamId, index + 1] as const),
    );

    // Bei aufsteigender Sortierung landet das punktbeste Team (40 Punkte) auf dem letzten Platz —
    // genau der Widerspruch aus xqz47b ("Rang 1 mit 22 Punkten, aber Rang 14"). Die echte Funktion tut
    // das laut Test oben nicht; diese lokale Fehlsortierung dient nur als Gegenbeleg.
    expect(ascendingRanks.get("T-1")).toBe(items.length);
    expect(ascendingRanks.get("T-1")).not.toBe(1);
  });

  it("Gleichstand: Stichentscheid bestimmt die Reihenfolge, aber beide bleiben vor allen punktschwächeren Teams", () => {
    const items = [
      buildTieBreakItem({ teamId: "TOP", teamName: "Spitzenreiter", projectedPoints: 50, totalScore: 10, matchdayRank: 1 }),
      buildTieBreakItem({ teamId: "TIE-A", teamName: "Adler", projectedPoints: 30, totalScore: 8, matchdayRank: 2 }),
      buildTieBreakItem({ teamId: "TIE-B", teamName: "Bären", projectedPoints: 30, totalScore: 8, matchdayRank: 2 }),
      buildTieBreakItem({ teamId: "BOTTOM", teamName: "Schlusslicht", projectedPoints: 10, totalScore: 3, matchdayRank: 4 }),
    ];

    const ranks = resolveProjectedRankWithTiePolicy(items, "deterministic_sort");

    const topRank = ranks.get("TOP")!;
    const bottomRank = ranks.get("BOTTOM")!;
    const tiedRanks = [ranks.get("TIE-A")!, ranks.get("TIE-B")!];

    // Absichtlich KEINE Aussage darüber, welches der beiden gleichauf liegenden Teams vorne landet —
    // nur, dass beide zusammen die Plätze 2 und 3 belegen, also zwischen Spitzenreiter und Schlusslicht.
    expect(new Set(tiedRanks)).toEqual(new Set([2, 3]));
    expect(Math.max(...tiedRanks)).toBeLessThan(bottomRank);
    expect(Math.min(...tiedRanks)).toBeGreaterThan(topRank);
    expect(topRank).toBe(1);
    expect(bottomRank).toBe(items.length);
  });
});

describe("Rang-Invariante: meiste Punkte = Rang 1 (standings-preview-engine, buildCurrentRankMap)", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = process.env.DATABASE_URL || "postgres://test";
  });

  it("currentRank folgt derselben Regel: meiste Punkte = Rang 1, Gleichstand bleibt vor den Schwächeren", async () => {
    const result = await buildStandingsPreview({
      saveId: "save-rank-invariant",
      seasonId: "season-1",
      matchdayId: "matchday-1",
      source: "sqlite",
    });

    const rankOf = (teamId: string) => result.items.find((item) => item.teamId === teamId)?.currentRank ?? null;

    expect(rankOf("TOP")).toBe(1);
    // Gegenrichtung: das punktbeste Team darf nicht den letzten Platz bekommen (der gemeldete Verdacht).
    expect(rankOf("TOP")).not.toBe(result.items.length);
    expect(rankOf("MID")).toBe(2);
    expect(rankOf("BOTTOM")).toBe(result.items.length);

    // Gleichstand TIE-A/TIE-B: nicht festgelegt, welches der beiden vorne landet — nur, dass beide
    // zusammen die Plätze 3 und 4 belegen, also zwischen MID und BOTTOM.
    const tiedRanks = [rankOf("TIE-A")!, rankOf("TIE-B")!];
    expect(new Set(tiedRanks)).toEqual(new Set([3, 4]));
  });
});
