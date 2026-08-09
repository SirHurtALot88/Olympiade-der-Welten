/**
 * ERFASSUNG DER TEAMSTÄRKE-RÄNGE BEI DER SPIELTAGSWERTUNG.
 *
 * GEMELDET VON CHRIS: Der Saison-Schnappschuss rechnete die Ranks-Matrix-Ränge beim
 * Saisonabschluss aus dem Live-Kader — vier Tage und 49 Verkäufe nach dem letzten Spieltag.
 * Die Erfassung muss deshalb am Zeitpunkt der Wertung sitzen (der jeweils letzte Spieltag
 * gewinnt), und der Schnappschuss muss den festgehaltenen Satz übernehmen statt neu zu rechnen.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import type { PersistedSaveGame } from "@/lib/persistence/types";
import {
  buildTeamStrengthRankCaptureRecord,
  upsertTeamStrengthRankCapture,
} from "@/lib/foundation/team-discipline-rank-engine";
import { buildSeasonSnapshot } from "@/lib/season/season-snapshot-service";
import { executeStandingsApply, STANDINGS_APPLY_CONFIRM_TOKEN } from "@/lib/standings/standings-apply-service";

const { buildStandingsPreview } = vi.hoisted(() => ({
  buildStandingsPreview: vi.fn(),
}));

vi.mock("@/lib/standings/standings-preview-engine", () => ({
  buildStandingsPreview,
}));

function createGameState(): GameState {
  return {
    season: {
      id: "season-1",
      name: "Season 1",
      year: 2026,
      currentMatchday: 1,
      matchdayIds: ["matchday-1", "matchday-2"],
    },
    seasonState: {
      seasonId: "season-1",
      schedule: [],
      standings: {
        "A-A": { points: 12, rank: 2 },
        "B-B": { points: 14, rank: 1 },
      },
      standingsApplyLogs: [],
    },
    matchdayState: {
      matchdayId: "matchday-1",
      status: "planning",
      pendingTeamIds: [],
      resolvedFixtureIds: [],
    },
    teams: [
      { teamId: "A-A", shortCode: "A-A", name: "Alpha", budget: 100, cash: 100, identityId: "id-a", humanControlled: true, rosterLimit: 12 },
      { teamId: "B-B", shortCode: "B-B", name: "Beta", budget: 100, cash: 100, identityId: "id-b", humanControlled: false, rosterLimit: 12 },
    ],
    teamIdentities: [],
    players: [
      {
        id: "p-stark",
        name: "Stark",
        rating: 80,
        marketValue: 100,
        salaryDemand: 10,
        className: "Mage",
        race: "Human",
        alignment: "N",
        gender: "f",
        subclasses: [],
        traitsPositive: [],
        traitsNegative: [],
        coreStats: { pow: 20, spe: 20, men: 20, soc: 20 },
        preferredDisciplineIds: [],
        disciplineRatings: { "pow-1": 80 },
        disciplineTierCounts: { above20: 1, above40: 1, above60: 1, above80: 1 },
        flavorEn: "",
        flavorDe: "",
        fatigue: 0,
        form: 0,
        potential: 0,
      },
      {
        id: "p-schwach",
        name: "Schwach",
        rating: 20,
        marketValue: 10,
        salaryDemand: 2,
        className: "Mage",
        race: "Human",
        alignment: "N",
        gender: "m",
        subclasses: [],
        traitsPositive: [],
        traitsNegative: [],
        coreStats: { pow: 5, spe: 5, men: 5, soc: 5 },
        preferredDisciplineIds: [],
        disciplineRatings: { "pow-1": 20 },
        disciplineTierCounts: { above20: 1, above40: 0, above60: 0, above80: 0 },
        flavorEn: "",
        flavorDe: "",
        fatigue: 0,
        form: 0,
        potential: 0,
      },
    ],
    disciplines: [{ id: "pow-1", name: "Power Test", category: "power", weight: 1, playerCount: 6 }],
    rosters: [
      {
        id: "r-stark",
        teamId: "A-A",
        playerId: "p-stark",
        contractLength: 3,
        salary: 10,
        upkeep: 10,
        purchasePrice: 95,
        currentValue: 110,
        roleTag: "starter",
        promisedRole: "starter",
        joinedSeasonId: "season-1",
      },
      {
        id: "r-schwach",
        teamId: "B-B",
        playerId: "p-schwach",
        contractLength: 1,
        salary: 2,
        upkeep: 2,
        purchasePrice: 10,
        currentValue: 10,
        roleTag: "bench",
        promisedRole: null,
        joinedSeasonId: "season-1",
      },
    ],
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
  } as GameState;
}

function createPersistenceMock(gameState: GameState = createGameState()) {
  const save: PersistedSaveGame = {
    saveId: "save-local",
    name: "Local",
    status: "active",
    createdAt: "2026-06-04T00:00:00.000Z",
    updatedAt: "2026-06-04T00:00:00.000Z",
    gameState,
  };

  const persistence = {
    bootstrapSingleplayerSave: vi.fn(() => ({ save, createdFromSeed: false })),
    getActiveSave: vi.fn(() => save),
    getSaveById: vi.fn((saveId: string) => (saveId === save.saveId ? save : null)),
    saveSingleplayerState: vi.fn((saveId: string, nextGameState: GameState) => {
      save.gameState = nextGameState;
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

function mockHealthyPreview(matchdayId: string) {
  buildStandingsPreview.mockResolvedValue({
    items: [
      {
        teamId: "A-A",
        teamName: "Alpha",
        currentRank: 2,
        projectedRank: 1,
        currentPoints: 12,
        projectedPoints: 18.6,
        pointsDelta: 6.6,
        matchdayRank: 1,
        d1Score: 55,
        d2Score: 44,
        matchdayScore: 99,
        totalScore: 99,
        cash: 100,
        readinessStatus: "ready",
        resultStatus: "ready",
        warnings: [],
        blockedRules: [],
      },
      {
        teamId: "B-B",
        teamName: "Beta",
        currentRank: 1,
        projectedRank: 2,
        currentPoints: 14,
        projectedPoints: 20.2,
        pointsDelta: 6.2,
        matchdayRank: 2,
        d1Score: 40,
        d2Score: 30,
        matchdayScore: 70,
        totalScore: 70,
        cash: 100,
        readinessStatus: "ready",
        resultStatus: "ready",
        warnings: [],
        blockedRules: [],
      },
    ],
    summary: { totalTeams: 2, matchdayResultFound: true, readyTeams: 2, blockedTeamCount: 0 },
    blockedRules: [],
    tieGroups: [],
    source: {
      mode: "sqlite",
      matchdayResult: "local_saved_result",
      currentPoints: "local_save_standings",
      standingsRules: "global_total_score_preview",
      fixtureCoverage: "not_required_local_results",
    },
    scope: { saveId: "save-local", seasonId: "season-1", matchdayId },
  });
}

describe("Teamstärke-Erfassung bei der Spieltagswertung", () => {
  beforeEach(() => {
    buildStandingsPreview.mockReset();
  });

  it("hält die Ränge beim Standings-Apply fest — mit dem Kaderstand des Spieltags", async () => {
    const { save, persistence } = createPersistenceMock();
    mockHealthyPreview("matchday-1");

    await executeStandingsApply(
      { saveId: "save-local", seasonId: "season-1", matchdayId: "matchday-1", execute: true, confirm: STANDINGS_APPLY_CONFIRM_TOKEN },
      persistence as never,
    );

    const captures = save.gameState.seasonState.teamStrengthRankCaptures ?? [];
    expect(captures).toHaveLength(1);
    expect(captures[0]?.seasonId).toBe("season-1");
    expect(captures[0]?.matchdayId).toBe("matchday-1");
    const records = captures[0]?.records ?? [];
    expect(records).toHaveLength(2);
    expect(records.find((entry) => entry.teamId === "A-A")?.totalRank).toBe(1);
    expect(records.find((entry) => entry.teamId === "B-B")?.totalRank).toBe(2);
  });

  it("der jeweils letzte gewertete Spieltag gewinnt — ein Eintrag pro Saison", async () => {
    const { save, persistence } = createPersistenceMock();

    mockHealthyPreview("matchday-1");
    await executeStandingsApply(
      { saveId: "save-local", seasonId: "season-1", matchdayId: "matchday-1", execute: true, confirm: STANDINGS_APPLY_CONFIRM_TOKEN },
      persistence as never,
    );

    mockHealthyPreview("matchday-2");
    await executeStandingsApply(
      { saveId: "save-local", seasonId: "season-1", matchdayId: "matchday-2", execute: true, confirm: STANDINGS_APPLY_CONFIRM_TOKEN },
      persistence as never,
    );

    const captures = save.gameState.seasonState.teamStrengthRankCaptures ?? [];
    expect(captures).toHaveLength(1);
    expect(captures[0]?.matchdayId).toBe("matchday-2");
  });

  it("der Saison-Schnappschuss übernimmt den festgehaltenen Satz — auch wenn der Live-Kader danach ausverkauft wurde", () => {
    const gameState = createGameState();
    // Erfassung zum letzten Spieltag: beide Teams noch voll besetzt.
    const capture = buildTeamStrengthRankCaptureRecord(
      gameState,
      { saveId: "save-local", seasonId: "season-1", matchdayId: "matchday-2" },
      "2026-06-06T00:00:00.000Z",
    );
    // Danach der Ausverkauf: A-A verliert seinen starken Spieler aus dem Live-Kader.
    const ausverkauft: GameState = {
      ...gameState,
      rosters: gameState.rosters.filter((entry) => entry.playerId !== "p-stark"),
      seasonState: {
        ...gameState.seasonState,
        teamStrengthRankCaptures: upsertTeamStrengthRankCapture(undefined, capture),
      },
    };

    const snapshot = buildSeasonSnapshot(ausverkauft, "season-1", null);

    const aa = snapshot.teamDisciplineRankSnapshots?.find((entry) => entry.teamId === "A-A");
    expect(aa?.totalRank).toBe(1);
    expect(aa?.scorePack?.total).toBe(80);
    expect(snapshot.teamDisciplineRankSnapshotMeta?.source).toBe("matchday_capture");
    expect(snapshot.teamDisciplineRankSnapshotMeta?.matchdayId).toBe("matchday-2");
    expect(snapshot.teamDisciplineRankSnapshotMeta?.capturedAt).toBe("2026-06-06T00:00:00.000Z");
  });

  it("ohne festgehaltenen Satz bleibt die Live-Rechnung als Rückfall — mit Herkunftsvermerk", () => {
    const gameState = createGameState();
    const ausverkauft: GameState = {
      ...gameState,
      rosters: gameState.rosters.filter((entry) => entry.playerId !== "p-stark"),
    };

    const snapshot = buildSeasonSnapshot(ausverkauft, "season-1", null);

    const aa = snapshot.teamDisciplineRankSnapshots?.find((entry) => entry.teamId === "A-A");
    // Live-Rechnung nach dem Verkauf: A-A ohne Spieler fällt hinter B-B.
    expect(aa?.totalRank).toBe(2);
    expect(snapshot.teamDisciplineRankSnapshotMeta?.source).toBe("season_end_live");
  });
});
