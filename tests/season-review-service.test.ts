import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { buildSeasonReview } from "@/lib/season/season-review-service";

function gameState(input?: { withResults?: boolean; withTransfers?: boolean }): GameState {
  const withResults = input?.withResults ?? true;
  const withTransfers = input?.withTransfers ?? true;
  return {
    season: { id: "season-1", name: "Season 1", year: 1, currentMatchday: 1, matchdayIds: ["md-1"] },
    seasonState: {
      seasonId: "season-1",
      schedule: [],
      standings: {
        "team-1": { points: 42, rank: 1 },
        "team-2": { points: 25, rank: 2 },
      },
      matchdayResults: withResults
        ? [{ id: "result-1", saveId: "save-1", seasonId: "season-1", matchdayId: "md-1", status: "preview_applied", sourceVersion: "test", teamsTotal: 2, teamsReady: 2, teamsUnderfilled: 0, teamsMissingLineup: 0, teamsInvalidLineup: 0, teamsMissingScoreCoverage: 0, warningsCount: 0, createdAt: "2026-06-11T00:00:00.000Z", updatedAt: "2026-06-11T00:00:00.000Z" }]
        : [],
      disciplineResults: withResults
        ? [
            { id: "dr-1", matchdayResultId: "result-1", teamId: "team-1", disciplineId: "fencing", disciplineSide: "d1", rank: 1, baseScore: 90, totalScore: 120, readinessStatus: "ready", warnings: [], createdAt: "2026-06-11T00:00:00.000Z" },
            { id: "dr-2", matchdayResultId: "result-1", teamId: "team-2", disciplineId: "fencing", disciplineSide: "d1", rank: 2, baseScore: 80, totalScore: 83, readinessStatus: "ready", warnings: [], createdAt: "2026-06-11T00:00:00.000Z" },
          ]
        : [],
      playerDisciplinePerformances: withResults
        ? [
            { id: "perf-1", matchdayResultId: "result-1", teamId: "team-1", playerId: "player-1", activePlayerId: null, disciplineId: "fencing", disciplineSide: "d1", slotIndex: 0, baseValue: 80, finalPlayerScore: 95, scoreContribution: 18, rankInTeam: 1, rankInDiscipline: 1, isTop10: true, isMvpCandidate: true, storyWeight: 2, createdAt: "2026-06-11T00:00:00.000Z" },
            { id: "perf-2", matchdayResultId: "result-1", teamId: "team-2", playerId: "player-2", activePlayerId: null, disciplineId: "fencing", disciplineSide: "d1", slotIndex: 0, baseValue: 70, finalPlayerScore: 75, scoreContribution: 8, rankInTeam: 1, rankInDiscipline: 2, isTop10: true, isMvpCandidate: false, storyWeight: 1, createdAt: "2026-06-11T00:00:00.000Z" },
          ]
        : [],
    },
    matchdayState: { matchdayId: "md-1", status: "resolved", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [
      { teamId: "team-1", shortCode: "T-1", name: "Team One", budget: 100, cash: 60, identityId: "i-1", humanControlled: true, rosterLimit: 12 },
      { teamId: "team-2", shortCode: "T-2", name: "Team Two", budget: 100, cash: 40, identityId: "i-2", humanControlled: false, rosterLimit: 12 },
    ],
    teamIdentities: [],
    players: [
      { id: "player-1", name: "Alpha Ace", rating: 90, marketValue: 20, salaryDemand: 2, className: "Hero", race: "Human", alignment: "good", gender: "x", subclasses: [], traitsPositive: [], traitsNegative: [], coreStats: { pow: 90, spe: 60, men: 60, soc: 60 }, preferredDisciplineIds: ["fencing"], disciplineRatings: { fencing: 95 }, disciplineTierCounts: { above20: 1, above40: 1, above60: 1, above80: 1 }, flavorEn: "", flavorDe: "", fatigue: 0, form: 0, potential: 80 },
      { id: "player-2", name: "Beta Bolt", rating: 70, marketValue: 12, salaryDemand: 1, className: "Sprinter", race: "Human", alignment: "good", gender: "x", subclasses: [], traitsPositive: [], traitsNegative: [], coreStats: { pow: 40, spe: 90, men: 40, soc: 40 }, preferredDisciplineIds: ["fencing"], disciplineRatings: { fencing: 80 }, disciplineTierCounts: { above20: 1, above40: 1, above60: 1, above80: 1 }, flavorEn: "", flavorDe: "", fatigue: 0, form: 0, potential: 70 },
    ],
    disciplines: [{ id: "fencing", name: "Fechten", category: "power", weight: 1 }],
    rosters: [
      { id: "r-1", teamId: "team-1", playerId: "player-1", salary: 2, upkeep: 2, purchasePrice: 10, currentValue: 20, contractLength: 1, roleTag: "starter", joinedSeasonId: "season-1" },
      { id: "r-2", teamId: "team-2", playerId: "player-2", salary: 1, upkeep: 1, purchasePrice: 8, currentValue: 12, contractLength: 1, roleTag: "starter", joinedSeasonId: "season-1" },
    ],
    contracts: [],
    transferListings: [],
    transferHistory: withTransfers
      ? [{ id: "transfer-1", playerId: "player-1", seasonId: "season-1", seasonLabel: "Season 1", transferType: "buy", fromTeamId: null, toTeamId: "team-1", fee: 10, salary: 2, marketValue: 20, remainingContractLength: 1, happenedAt: "2026-06-11T00:00:00.000Z", source: "test" }]
      : [],
    logs: [],
    mappingReport: { mappingSource: "test", teamSource: "test", generatedAt: "2026-06-11T00:00:00.000Z", processedMappingRows: 0, importedPlayerCount: 0, matchedRosterCount: 0, teamCount: 2, unmappedPlayers: [], teamsWithoutPlayers: [], mappingRowsWithoutPlayerMatch: [], duplicateMappedPlayers: [], unknownTeamCodes: [], duplicateTeamCodes: [], warnings: [] },
  };
}

describe("season review service", () => {
  it("reads the champion from final standings and sorts top players from real PPs/MVS sources", () => {
    const review = buildSeasonReview(gameState());

    expect(review.championTeam?.name).toBe("Team One");
    expect(review.topPlayers[0]?.name).toBe("Alpha Ace");
    expect(review.awards.map((award) => award.awardId)).toEqual(
      expect.arrayContaining(["champion", "player_of_the_season", "mvs_king", "pps_king", "discipline_monster"]),
    );
  });

  it("does not invent performance awards when result sources are missing", () => {
    const review = buildSeasonReview(gameState({ withResults: false, withTransfers: false }));

    expect(review.awards.some((award) => award.awardId === "champion")).toBe(true);
    expect(review.awards.some((award) => award.awardId === "player_of_the_season")).toBe(false);
    expect(review.awards.some((award) => award.awardId === "discipline_monster")).toBe(false);
    expect(review.transferHighlights).toEqual([]);
    expect(review.warnings).toContain("matchday_results_source_missing");
  });

  it("builds transfer and discipline highlights from stored history and result rows", () => {
    const review = buildSeasonReview(gameState());

    expect(review.transferHighlights[0]?.label).toBe("teuerster Kauf");
    expect(review.topDisciplinePerformances[0]?.name).toBe("Alpha Ace");
    expect(review.teamHighlights.some((entry) => entry.source === "seasonState.disciplineResults")).toBe(true);
  });
});
