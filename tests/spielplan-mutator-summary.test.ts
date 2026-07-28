import { describe, expect, it } from "vitest";

import type { GameState, Player } from "@/lib/data/olyDataTypes";
import { buildSpielplanMutatorSummaries } from "@/lib/foundation/spielplan-mutator-summary";
import { rollMatchdayMutatorTraitsForSide } from "@/lib/lineups/legacy-lineup-modifiers";

const SAVE_ID = "test-save";
const SEASON_ID = "season-1";

function createPlayer(id: string, partial?: Partial<Player>): Player {
  return {
    id,
    name: partial?.name ?? id,
    rating: 70,
    marketValue: 60,
    salaryDemand: 10,
    displayMarketValue: 60,
    displaySalary: 10,
    className: "Hero",
    race: "Human",
    alignment: "N",
    gender: "f",
    referenceClass: null,
    imageSource: null,
    bracketLabel: null,
    subclasses: [],
    traitsPositive: partial?.traitsPositive ?? [],
    traitsNegative: partial?.traitsNegative ?? [],
    coreStats: { pow: 40, spe: 40, men: 40, soc: 40 },
    preferredDisciplineIds: [],
    disciplineRatings: {},
    disciplineTierCounts: { above20: 0, above40: 0, above60: 0, above80: 0 },
    flavorEn: "",
    flavorDe: "",
    fatigue: 0,
    form: 0,
    potential: 0,
    portraitPath: null,
    portraitUrl: null,
  };
}

function createGameState(input: {
  players: Player[];
  matchdayResults?: GameState["seasonState"]["matchdayResults"];
  playerDisciplinePerformances?: GameState["seasonState"]["playerDisciplinePerformances"];
}): GameState {
  return {
    gamePhase: "season_active",
    season: {
      id: SEASON_ID,
      name: "Season 1",
      year: 2026,
      currentMatchday: 1,
      matchdayIds: ["matchday-1", "matchday-2"],
    },
    seasonState: {
      seasonId: SEASON_ID,
      schedule: [],
      standings: {},
      playerDisciplinePerformances: input.playerDisciplinePerformances ?? [],
      seasonSnapshots: [],
      matchdayResults: input.matchdayResults ?? [],
    },
    matchdayState: {
      matchdayId: "matchday-1",
      status: "planning",
      pendingTeamIds: [],
      resolvedFixtureIds: [],
    },
    teams: [
      {
        teamId: "A-A",
        shortCode: "A-A",
        name: "Armageddon Aftermath",
        budget: 175,
        cash: 175,
        identityId: "A-A",
        humanControlled: true,
        rosterLimit: 12,
        logoPath: null,
      },
    ],
    teamIdentities: [],
    players: input.players,
    disciplines: [],
    rosters: [],
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
    mappingReport: {
      mappingSource: "test",
      teamSource: "test",
      generatedAt: "2026-01-01T00:00:00.000Z",
      processedMappingRows: 0,
      importedPlayerCount: 0,
      matchedRosterCount: 0,
      teamCount: 1,
      unmappedPlayers: [],
      teamsWithoutPlayers: [],
      mappingRowsWithoutPlayerMatch: [],
      duplicateMappedPlayers: [],
      unknownTeamCodes: [],
      duplicateTeamCodes: [],
      warnings: [],
    },
  };
}

function rollTraits(matchdayId: string, side: "d1" | "d2", disciplineId: string): [string, string] {
  return rollMatchdayMutatorTraitsForSide({
    saveId: SAVE_ID,
    seasonId: SEASON_ID,
    matchdayId,
    disciplineSide: side,
    disciplineId,
  });
}

describe("buildSpielplanMutatorSummaries", () => {
  it("shows the deterministically rolled matchday traits even before the matchday is resolved", () => {
    const gameState = createGameState({ players: [] });
    const summaries = buildSpielplanMutatorSummaries({
      gameState,
      saveId: SAVE_ID,
      scheduleRows: [
        { matchdayId: "matchday-1", discipline1: { disciplineId: "mini-dm" }, discipline2: { disciplineId: "fechten" } },
      ],
    });

    const [expected1, expected2] = rollTraits("matchday-1", "d1", "mini-dm");
    const miniDm = summaries.get("mini-dm");
    expect(miniDm).toBeTruthy();
    expect(miniDm!.resolved).toBe(false);
    expect(miniDm!.slots[0].label).toBe(expected1);
    expect(miniDm!.slots[1].label).toBe(expected2);
    expect(expected1).not.toBe(expected2);
    expect(miniDm!.slots[0].hitCount).toBe(0);
    expect(miniDm!.slots[1].hitCount).toBe(0);

    const fechten = summaries.get("fechten");
    expect(fechten).toBeTruthy();
    expect(fechten!.disciplineSide).toBe("d2");
    // Anderer Seed (Seite/Disziplin) → eigener Roll.
    const [fechten1] = rollTraits("matchday-1", "d2", "fechten");
    expect(fechten!.slots[0].label).toBe(fechten1);
  });

  it("counts stored mutator hits per trait and lists the affected players for hover", () => {
    const [trait1, trait2] = rollTraits("matchday-1", "d1", "mini-dm");
    const players = [
      // p1 trifft nur Mutator 1, p2 trifft beide, p3 hat einen Bonus, aber
      // keinen der Spieltag-Traits (Team hat eigene Traits gewertet).
      createPlayer("p1", { traitsPositive: [trait1] }),
      createPlayer("p2", { traitsPositive: [trait1], traitsNegative: [trait2] }),
      createPlayer("p3", { traitsPositive: ["Etwas völlig anderes"] }),
    ];
    const gameState = createGameState({
      players,
      matchdayResults: [
        {
          id: "result-1",
          saveId: SAVE_ID,
          seasonId: SEASON_ID,
          matchdayId: "matchday-1",
          status: "preview_applied",
          sourceVersion: "v1",
          teamsTotal: 1,
          teamsReady: 1,
          teamsUnderfilled: 0,
          teamsMissingLineup: 0,
          teamsInvalidLineup: 0,
          teamsMissingScoreCoverage: 0,
          warningsCount: 0,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      playerDisciplinePerformances: [
        // +6 je Treffer (calculateMutatorModifierForSide): p1 = 1 Treffer, p2 = 2, p3 = 1.
        makePerformance("perf-1", "p1", 6),
        makePerformance("perf-2", "p2", 12),
        makePerformance("perf-3", "p3", 6),
        // Ohne Bonus → zählt nicht als Treffer.
        makePerformance("perf-4", "p1", null, "fechten"),
      ],
    });

    function makePerformance(
      id: string,
      playerId: string,
      mutatorScoreBonus: number | null,
      disciplineId = "mini-dm",
    ) {
      return {
        id,
        matchdayResultId: "result-1",
        teamId: "A-A",
        playerId,
        activePlayerId: null,
        disciplineId,
        disciplineSide: "d1" as const,
        slotIndex: 0,
        baseValue: 50,
        finalPlayerScore: 50,
        mutatorScoreBonus,
        mutatorPpsBonus: mutatorScoreBonus != null ? 0.3 : null,
        scoreContribution: 50,
        rankInTeam: 1,
        rankInDiscipline: 1,
        isTop10: false,
        isMvpCandidate: false,
        storyWeight: null,
        createdAt: "2026-01-01T00:00:00.000Z",
      };
    }

    const summaries = buildSpielplanMutatorSummaries({
      gameState,
      saveId: SAVE_ID,
      scheduleRows: [
        { matchdayId: "matchday-1", discipline1: { disciplineId: "mini-dm" }, discipline2: { disciplineId: "fechten" } },
      ],
    });

    const miniDm = summaries.get("mini-dm");
    expect(miniDm).toBeTruthy();
    expect(miniDm!.resolved).toBe(true);
    // Mutator 1: p1 + p2; Mutator 2: nur p2.
    expect(miniDm!.slots[0].hitCount).toBe(2);
    expect(miniDm!.slots[0].hitPlayers.map((entry) => entry.playerId).sort()).toEqual(["p1", "p2"]);
    expect(miniDm!.slots[1].hitCount).toBe(1);
    expect(miniDm!.slots[1].hitPlayers.map((entry) => entry.playerId)).toEqual(["p2"]);
    expect(miniDm!.slots[0].hitPlayers[0]!.teamCode).toBe("A-A");
    // p3 hat einen gespeicherten Bonus, passt aber zu keinem Spieltag-Trait → unattributed.
    expect(miniDm!.unattributedHitCount).toBe(1);

    // fechten hatte nur eine Zeile OHNE Bonus → keine Treffer.
    const fechten = summaries.get("fechten");
    expect(fechten!.resolved).toBe(true);
    expect(fechten!.slots[0].hitCount).toBe(0);
  });

  it("ignores superseded results and other seasons", () => {
    const [trait1] = rollTraits("matchday-1", "d1", "mini-dm");
    const gameState = createGameState({
      players: [createPlayer("p1", { traitsPositive: [trait1] })],
      matchdayResults: [
        {
          id: "result-old",
          saveId: SAVE_ID,
          seasonId: SEASON_ID,
          matchdayId: "matchday-1",
          status: "superseded",
          sourceVersion: "v1",
          teamsTotal: 1,
          teamsReady: 1,
          teamsUnderfilled: 0,
          teamsMissingLineup: 0,
          teamsInvalidLineup: 0,
          teamsMissingScoreCoverage: 0,
          warningsCount: 0,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      playerDisciplinePerformances: [
        {
          id: "perf-1",
          matchdayResultId: "result-old",
          teamId: "A-A",
          playerId: "p1",
          activePlayerId: null,
          disciplineId: "mini-dm",
          disciplineSide: "d1",
          slotIndex: 0,
          baseValue: 50,
          finalPlayerScore: 56,
          mutatorScoreBonus: 6,
          mutatorPpsBonus: 0.3,
          scoreContribution: 56,
          rankInTeam: 1,
          rankInDiscipline: 1,
          isTop10: false,
          isMvpCandidate: false,
          storyWeight: null,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });

    const summaries = buildSpielplanMutatorSummaries({
      gameState,
      saveId: SAVE_ID,
      scheduleRows: [{ matchdayId: "matchday-1", discipline1: { disciplineId: "mini-dm" }, discipline2: null }],
    });

    const miniDm = summaries.get("mini-dm");
    expect(miniDm!.resolved).toBe(false);
    expect(miniDm!.slots[0].hitCount).toBe(0);
  });
});
