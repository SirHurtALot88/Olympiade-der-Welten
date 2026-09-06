import { describe, expect, it } from "vitest";

import type { Discipline, Fixture, GameState, Player, Team } from "@/lib/data/olyDataTypes";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";
import { createPlayerBaselineFromPlayer } from "@/lib/players/player-baseline-service";
import type { LeagueTier } from "@/lib/season/league-split";

const {
  applyPreSeasonNextSeasonSetupLightweight,
  buildPreSeasonNextSeasonSetupToken,
} = await import("@/lib/season/preseason-workflow-service");

/**
 * Regressionstest fuer die Folgekorrektur zu F3
 * (docs/design/battle-mode-20-spieltage-recherche-06-09.md Abschnitt 1.2): der Saisonuebergang
 * (`buildNextSeasonGameState` in lib/season/preseason-workflow-service.ts) baute `seasonState.schedule`
 * fuer JEDE Folgesaison ueber die alte Dummy-Paarung (`buildSeasonFixtures`, Rest-Klassen-Zuweisung
 * ohne Liga-Tier) statt ueber den Circle-Generator (`buildSeasonFixtureSchedule`,
 * lib/season/season-fixture-schedule.ts) -- obwohl `isLeagueSplitActive()` fuer Battle-Mode-Saves ab
 * Saison 1 laengst aktiv ist. Ab Saison 2 verlor ein Battle-Mode-Save damit den echten
 * Liga-Spielplan, den der Spielplan-Tab (use-foundation-cross-tab-discipline-ranks.ts) voraussetzt.
 *
 * `leagueByTeamId` wird beim Uebergang selbst NICHT neu zugeordnet (siehe Kommentar im Fix,
 * preseason-workflow-service.ts) -- es gibt noch keine Auf-/Abstiegs-Logik (RELEGATION_COUNT in
 * league-split.ts ist definiert, aber ungenutzt), das Feld traegt im Spread `...seasonState`
 * unveraendert fort. Der Test faehrt deshalb absichtlich ueber `applyPreSeasonNextSeasonSetupLightweight`
 * mit OLY_TRANSFER_PIPELINE_FAST=1 (derselbe FAST-Pfad, den Sim-/Long-Run-Uebergaenge nutzen) --
 * das ist ein ECHTER Saisonuebergang durch die Produktionspipeline, nur ohne die teuren
 * Season-End-Progression-Schritte, die fuer diesen Befund irrelevant sind.
 */

const LEAGUE1_TEAM_COUNT = 16;
const LEAGUE2_TEAM_COUNT = 16;
const MATCHDAY_COUNT = 10;

function buildLeagueTeams(): { teams: Team[]; leagueByTeamId: Record<string, LeagueTier> } {
  const teams: Team[] = [];
  const leagueByTeamId: Record<string, LeagueTier> = {};
  for (let index = 1; index <= LEAGUE1_TEAM_COUNT; index += 1) {
    const teamId = `L1-${String(index).padStart(2, "0")}`;
    teams.push({
      teamId,
      shortCode: teamId,
      name: `Liga1 Team ${index}`,
      budget: 300 - index,
      cash: 300 - index,
      identityId: `ident-${teamId}`,
      humanControlled: teamId === "L1-01",
      rosterLimit: 12,
    });
    leagueByTeamId[teamId] = "liga1";
  }
  for (let index = 1; index <= LEAGUE2_TEAM_COUNT; index += 1) {
    const teamId = `L2-${String(index).padStart(2, "0")}`;
    teams.push({
      teamId,
      shortCode: teamId,
      name: `Liga2 Team ${index}`,
      budget: 150 - index,
      cash: 150 - index,
      identityId: `ident-${teamId}`,
      humanControlled: false,
      rosterLimit: 12,
    });
    leagueByTeamId[teamId] = "liga2";
  }
  return { teams, leagueByTeamId };
}

function createPlayer(partial: Partial<Player> = {}): Player {
  return {
    id: partial.id ?? "p-human",
    name: partial.name ?? "Human Player",
    rating: partial.rating ?? 60,
    marketValue: partial.marketValue ?? 10,
    salaryDemand: partial.salaryDemand ?? 1,
    className: partial.className ?? "Berserker",
    race: partial.race ?? "Human",
    alignment: partial.alignment ?? "N",
    gender: partial.gender ?? "x",
    subclasses: partial.subclasses ?? [],
    traitsPositive: partial.traitsPositive ?? [],
    traitsNegative: partial.traitsNegative ?? [],
    coreStats: partial.coreStats ?? { pow: 50, spe: 50, men: 50, soc: 50 },
    attributeSheetStats:
      partial.attributeSheetStats ?? {
        power: 30,
        health: 30,
        stamina: 30,
        intelligence: 30,
        awareness: 30,
        determination: 30,
        speed: 30,
        dexterity: 30,
        charisma: 30,
        will: 30,
        spirit: 30,
        torment: 30,
      },
    preferredDisciplineIds: partial.preferredDisciplineIds ?? [],
    disciplineRatings: partial.disciplineRatings ?? { tdm: 30 },
    disciplineTierCounts: partial.disciplineTierCounts ?? { above20: 1, above40: 0, above60: 0, above80: 0 },
    flavorEn: partial.flavorEn ?? "",
    flavorDe: partial.flavorDe ?? "",
    fatigue: partial.fatigue ?? 0,
    form: partial.form ?? 0,
    potential: partial.potential ?? 0,
    currentXP: partial.currentXP,
    spentXP: partial.spentXP,
    lifetimeXP: partial.lifetimeXP,
    trainingMode: partial.trainingMode,
    displayMarketValue: partial.displayMarketValue,
    displaySalary: partial.displaySalary,
  };
}

const DISCIPLINES: Discipline[] = [
  { id: "tdm", name: "TDM", category: "power", weight: 1, playerCount: 2 },
  { id: "fechten", name: "Fechten", category: "speed", weight: 1, playerCount: 2 },
  { id: "schach", name: "Schach", category: "mental", weight: 1, playerCount: 2 },
  { id: "showcase", name: "Showcase", category: "social", weight: 1, playerCount: 2 },
];

/**
 * Ein bereits gespieltes Saison-1-Ende: 32 Teams, `matchdayIds` mit MATCHDAY_COUNT (10) Eintraegen
 * (damit `buildNextSeasonGameState` fuer Saison 2 wieder 10 Spieltage anlegt), genug Standings-/
 * Ergebnis-Minimaldaten, damit `buildSaveWithRequiredSeasonSnapshot` nicht blockiert
 * (`season_snapshot_final_standings_missing` / `_player_performances_missing`).
 *
 * `withLeagueSplit` steuert den einzigen Unterschied zwischen Battle-Mode- und Manager-Mode-Save:
 * `seasonState.leagueByTeamId` gesetzt oder leer -- alles andere ist identisch, damit die
 * Gegenprobe wirklich nur den einen Schalter testet, den `isLeagueSplitActive()` liest.
 */
function buildSeasonOneEndSave(options: { withLeagueSplit: boolean }): PersistedSaveGame {
  const { teams, leagueByTeamId } = buildLeagueTeams();
  const matchdayIds = Array.from({ length: MATCHDAY_COUNT }, (_, index) => `md-${index + 1}`);
  const players = [createPlayer(), createPlayer({ id: "p-ai", name: "AI Player", className: "Mage" })];
  const standings: GameState["seasonState"]["standings"] = Object.fromEntries(
    teams.map((team, index) => [team.teamId, { points: teams.length - index, rank: index + 1 }]),
  );

  const gameState: GameState = {
    gamePhase: "season_review",
    season: { id: "season-1", name: "Season 1", year: 1, currentMatchday: MATCHDAY_COUNT, matchdayIds },
    seasonState: {
      seasonId: "season-1",
      schedule: [{ id: "fixture-season-1-1", homeTeamId: "L1-01", awayTeamId: "L1-02", matchdayId: "md-1", status: "resolved" }],
      standings,
      ...(options.withLeagueSplit ? { leagueByTeamId } : {}),
      teamFacilities: {},
      formCards: [],
      lineupDrafts: [],
      // `buildSeasonSnapshotDryRun` (season-snapshot-service.ts) blockt mit
      // `season_not_completed_for_snapshot`, solange nicht JEDER Spieltag der Saison sowohl einen
      // `preview_applied`-Matchday-Result- als auch einen Standings-Apply-Log-Eintrag hat
      // (`isSeasonCoverageComplete`, season-completion-state.ts) -- deshalb hier fuer ALLE
      // MATCHDAY_COUNT Spieltage, nicht nur den ersten.
      standingsApplyLogs: matchdayIds.map((matchdayId) => ({
        id: `standings-${matchdayId}`,
        saveId: "save-1",
        seasonId: "season-1",
        matchdayId,
        action: "apply" as const,
        payload: { idempotencyKey: `s-${matchdayId}`, totalTeams: teams.length, appliedTeams: teams.length, tieGroupsCount: 0, previewWarningsCount: 0 },
        createdAt: "2026-06-11T00:00:00.000Z",
      })),
      cashPrizeApplyLogs: matchdayIds.map((matchdayId) => ({
        id: `cash-${matchdayId}`,
        saveId: "save-1",
        seasonId: "season-1",
        matchdayId,
        action: "apply" as const,
        payload: { idempotencyKey: `c-${matchdayId}`, totalTeams: teams.length, appliedTeams: teams.length, totalPrizeMoney: 10 },
        createdAt: "2026-06-11T00:00:00.000Z",
      })),
      matchdayResults: matchdayIds.map((matchdayId, index) => ({
        id: `result-${matchdayId}`,
        saveId: "save-1",
        seasonId: "season-1",
        matchdayId,
        status: "preview_applied" as const,
        sourceVersion: "test",
        teamsTotal: teams.length,
        teamsReady: teams.length,
        teamsUnderfilled: 0,
        teamsMissingLineup: 0,
        teamsInvalidLineup: 0,
        teamsMissingScoreCoverage: 0,
        warningsCount: 0,
        createdAt: "2026-06-11T00:00:00.000Z",
        updatedAt: "2026-06-11T00:00:00.000Z",
      })),
      disciplineResults: [
        { id: "discipline-1", matchdayResultId: "result-md-1", teamId: "L1-01", disciplineId: "tdm", disciplineSide: "d1", rank: 1, baseScore: 20, totalScore: 24, readinessStatus: "ready", warnings: [], createdAt: "2026-06-11T00:00:00.000Z" },
        { id: "discipline-2", matchdayResultId: "result-md-1", teamId: "L2-01", disciplineId: "tdm", disciplineSide: "d1", rank: 2, baseScore: 18, totalScore: 20, readinessStatus: "ready", warnings: [], createdAt: "2026-06-11T00:00:00.000Z" },
      ],
      playerDisciplinePerformances: [
        { id: "perf-1", matchdayResultId: "result-md-1", teamId: "L1-01", playerId: "p-human", activePlayerId: "r-human", disciplineId: "tdm", disciplineSide: "d1", slotIndex: 0, baseValue: 30, finalPlayerScore: 40, scoreContribution: 12, rankInTeam: 1, rankInDiscipline: 1, isTop10: true, isMvpCandidate: true, storyWeight: null, createdAt: "2026-06-11T00:00:00.000Z" },
        { id: "perf-2", matchdayResultId: "result-md-1", teamId: "L2-01", playerId: "p-ai", activePlayerId: "r-ai", disciplineId: "tdm", disciplineSide: "d1", slotIndex: 0, baseValue: 30, finalPlayerScore: 35, scoreContribution: 10, rankInTeam: 1, rankInDiscipline: 2, isTop10: true, isMvpCandidate: false, storyWeight: null, createdAt: "2026-06-11T00:00:00.000Z" },
      ],
    } as GameState["seasonState"],
    matchdayState: { matchdayId: matchdayIds[matchdayIds.length - 1]!, status: "resolved", pendingTeamIds: [], resolvedFixtureIds: ["fixture-season-1-1"] },
    teams,
    teamIdentities: [],
    players,
    playerBaselines: players.map((player) =>
      createPlayerBaselineFromPlayer(player, { source: "seed", createdAt: "2026-06-11T00:00:00.000Z" }),
    ),
    disciplines: DISCIPLINES,
    rosters: [
      { id: "r-human", teamId: "L1-01", playerId: "p-human", salary: 1, upkeep: 1, contractLength: 3, roleTag: "starter", joinedSeasonId: "season-1" },
      { id: "r-ai", teamId: "L2-01", playerId: "p-ai", salary: 4, upkeep: 4, contractLength: 3, roleTag: "bench", joinedSeasonId: "season-1" },
    ],
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
    mappingReport: {
      mappingSource: "test",
      teamSource: "test",
      generatedAt: "2026-06-11T00:00:00.000Z",
      processedMappingRows: 0,
      importedPlayerCount: players.length,
      matchedRosterCount: 2,
      teamCount: teams.length,
      unmappedPlayers: [],
      teamsWithoutPlayers: [],
      mappingRowsWithoutPlayerMatch: [],
      duplicateMappedPlayers: [],
      unknownTeamCodes: [],
      duplicateTeamCodes: [],
      warnings: [],
    },
  };

  return {
    saveId: "save-liga-split",
    name: "Test Save",
    status: "active",
    createdAt: "2026-06-11T00:00:00.000Z",
    updatedAt: "2026-06-11T00:00:00.000Z",
    gameState,
  };
}

describe("liga-spielplan ab saison 2 (battle mode)", () => {
  it("gives a battle-mode save with active league split the real circle fixture schedule for season 2", () => {
    const sourceSave = buildSeasonOneEndSave({ withLeagueSplit: true });
    let capturedGameState: GameState | null = null;
    const previous = process.env.OLY_TRANSFER_PIPELINE_FAST;
    process.env.OLY_TRANSFER_PIPELINE_FAST = "1";
    let nextGameState: GameState;
    try {
      const saveSingleplayerState = (saveId: string, gameState: GameState) => {
        capturedGameState = gameState;
        return { ...sourceSave, saveId, gameState };
      };
      const persistence = {
        bootstrapSingleplayerSave: () => ({ save: sourceSave, createdFromSeed: false }),
        getActiveSave: () => sourceSave,
        getSaveById: () => sourceSave,
        saveSingleplayerState,
      } as unknown as PersistenceService;
      const token = buildPreSeasonNextSeasonSetupToken(sourceSave).confirmToken;
      const result = applyPreSeasonNextSeasonSetupLightweight(sourceSave, token, persistence);
      expect(result.applied).toBe(true);
      if (!capturedGameState) throw new Error("Expected season transition to persist a game state.");
      nextGameState = capturedGameState;
    } finally {
      if (previous === undefined) {
        delete process.env.OLY_TRANSFER_PIPELINE_FAST;
      } else {
        process.env.OLY_TRANSFER_PIPELINE_FAST = previous;
      }
    }

    expect(nextGameState.season.id).toBe("season-2");
    const schedule = nextGameState.seasonState.schedule;

    // 2 Ligen * 10 Spieltage * 8 Paarungen (16 Teams/Liga) = 160 Fixtures.
    expect(schedule).toHaveLength(160);
    expect(schedule.every((fixture) => fixture.leagueTier === "liga1" || fixture.leagueTier === "liga2")).toBe(true);

    const teamTierById = new Map(
      sourceSave.gameState.seasonState.leagueByTeamId ? Object.entries(sourceSave.gameState.seasonState.leagueByTeamId) : [],
    );
    for (const fixture of schedule) {
      expect(teamTierById.get(fixture.homeTeamId)).toBe(fixture.leagueTier);
      expect(teamTierById.get(fixture.awayTeamId)).toBe(fixture.leagueTier);
    }

    for (const matchdayId of nextGameState.season.matchdayIds) {
      for (const tier of ["liga1", "liga2"] as const) {
        const pairs = schedule.filter((fixture) => fixture.matchdayId === matchdayId && fixture.leagueTier === tier);
        expect(pairs).toHaveLength(8);
        const teamsOnMatchday = pairs.flatMap((fixture) => [fixture.homeTeamId, fixture.awayTeamId]);
        expect(new Set(teamsOnMatchday).size).toBe(16);
      }
    }

    const auditLog = nextGameState.seasonState.preSeasonWorkflowLogs?.[0];
    // Der Circle-Generator kann Warnungen zurückgeben (z.B. matchday_count_exceeds_rounds), wenn
    // mehr Spieltage als moegliche Runden verlangt werden -- die muessen im Uebergang ankommen,
    // genau wie new-game-setup-service.ts es fuer Saison 1 schon tut. Mit 16 Teams/Liga und 10
    // Spieltagen (< 15 moegliche Runden) fallen hier keine an -- die Abwesenheit bestaetigt, dass
    // der Pfad ueberhaupt durchlaeuft, ohne verschluckt zu werden.
    expect(auditLog?.warnings).toBeDefined();
  });

  it("keeps the legacy dummy schedule bit-identical for a manager-mode save without an active league split", () => {
    const sourceSave = buildSeasonOneEndSave({ withLeagueSplit: false });
    expect(sourceSave.gameState.seasonState.leagueByTeamId).toBeUndefined();

    let nextGameState: GameState | null = null;
    const previous = process.env.OLY_TRANSFER_PIPELINE_FAST;
    process.env.OLY_TRANSFER_PIPELINE_FAST = "1";
    try {
      const saveSingleplayerState = (saveId: string, gameState: GameState) => {
        nextGameState = gameState;
        return { ...sourceSave, saveId, gameState };
      };
      const persistence = {
        bootstrapSingleplayerSave: () => ({ save: sourceSave, createdFromSeed: false }),
        getActiveSave: () => sourceSave,
        getSaveById: () => sourceSave,
        saveSingleplayerState,
      } as unknown as PersistenceService;
      const token = buildPreSeasonNextSeasonSetupToken(sourceSave).confirmToken;
      const result = applyPreSeasonNextSeasonSetupLightweight(sourceSave, token, persistence);
      expect(result.applied).toBe(true);
    } finally {
      if (previous === undefined) {
        delete process.env.OLY_TRANSFER_PIPELINE_FAST;
      } else {
        process.env.OLY_TRANSFER_PIPELINE_FAST = previous;
      }
    }
    if (!nextGameState) throw new Error("Expected season transition to persist a game state.");
    const finalGameState: GameState = nextGameState;

    // Bit-identisch zur alten Dummy-Paarung `buildSeasonFixtures` (preseason-workflow-service.ts):
    // ein Fixture PRO Spieltag (kein Liga-Split-Aufkommen von 8/Liga), Team-Reihenfolge exakt
    // `save.gameState.teams.map(t => t.teamId)`, `teamIds[i % n]` gegen `teamIds[(i+1) % n]`, KEIN
    // `leagueTier`-Feld auf den Fixtures.
    const teamIds = sourceSave.gameState.teams.map((team) => team.teamId);
    const expectedFixtures: Fixture[] = finalGameState.season.matchdayIds.map((matchdayId, index) => ({
      id: `fixture:${finalGameState.season.id}:${matchdayId}`,
      homeTeamId: teamIds[index % teamIds.length] ?? teamIds[0]!,
      awayTeamId: teamIds[(index + 1) % teamIds.length] ?? teamIds[1]!,
      matchdayId,
      status: "scheduled" as const,
    }));

    expect(finalGameState.seasonState.schedule).toEqual(expectedFixtures);
    expect(finalGameState.seasonState.schedule.every((fixture) => fixture.leagueTier === undefined)).toBe(true);
  });
});
