import { describe, expect, it } from "vitest";

import type { GameState, Player, Team } from "@/lib/data/olyDataTypes";
import { buildGameFlowState } from "@/lib/foundation/game-flow-controller";

function team(partial?: Partial<Team>): Team {
  return {
    teamId: partial?.teamId ?? "M-M",
    shortCode: partial?.shortCode ?? "M-M",
    name: partial?.name ?? "Mayhem Mavericks",
    budget: partial?.budget ?? 500,
    cash: partial?.cash ?? 300,
    identityId: partial?.identityId ?? "M-M",
    humanControlled: partial?.humanControlled ?? true,
    rosterLimit: partial?.rosterLimit ?? 12,
    logoPath: partial?.logoPath ?? null,
  };
}

function player(id: string, trainingMode?: Player["trainingMode"]): Player {
  return {
    id,
    name: id,
    rating: 50,
    marketValue: 10,
    salaryDemand: 2,
    pps: null,
    ovr: null,
    className: "Runner",
    race: "Human",
    alignment: "neutral",
    gender: "n/a",
    subclasses: [],
    traitsPositive: [],
    traitsNegative: [],
    coreStats: { pow: 40, spe: 40, men: 40, soc: 40 },
    preferredDisciplineIds: [],
    disciplineRatings: {},
    disciplineTierCounts: { above20: 0, above40: 0, above60: 0, above80: 0 },
    flavorEn: "",
    flavorDe: "",
    fatigue: 0,
    form: 0,
    potential: 0,
    trainingMode,
  };
}

function gameState(partial?: Partial<GameState>): GameState {
  const teams = partial?.teams ?? [team()];
  const players = partial?.players ?? [player("p-1")];
  return {
    gamePhase: "season_active",
    season: { id: "season-2", name: "Season 2", year: 2027, currentMatchday: 1, matchdayIds: ["season-2-md-1"] },
    seasonState: {
      seasonId: "season-2",
      schedule: [],
      standings: {},
      ...(partial?.seasonState ?? {}),
    },
    matchdayState: {
      matchdayId: "season-2-md-1",
      status: "planning",
      pendingTeamIds: [],
      resolvedFixtureIds: [],
      ...(partial?.matchdayState ?? {}),
    },
    teams,
    teamIdentities: [],
    players,
    disciplines: [],
    rosters: partial?.rosters ?? [{ id: "r-1", teamId: "M-M", playerId: "p-1", contractLength: 1, salary: 2, upkeep: 2, purchasePrice: 10, currentValue: 10, roleTag: "starter", joinedSeasonId: "season-2" }],
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
    mappingReport: {
      mappingSource: "",
      teamSource: "",
      generatedAt: "",
      processedMappingRows: 0,
      importedPlayerCount: 0,
      matchedRosterCount: 0,
      teamCount: teams.length,
      unmappedPlayers: [],
      teamsWithoutPlayers: [],
      mappingRowsWithoutPlayerMatch: [],
      duplicateMappedPlayers: [],
      unknownTeamCodes: [],
      duplicateTeamCodes: [],
      warnings: [],
    },
    ...partial,
  };
}

describe("game flow controller", () => {
  it("opens training first when active roster players have no training mode", () => {
    const flow = buildGameFlowState({ gameState: gameState(), activeTeamId: "M-M" });
    expect(flow.currentStepId).toBe("check_training");
    expect(flow.currentStep.targetView).toBe("training");
    expect(flow.currentStep.cta).toContain("Training");
  });

  it("opens lineup after training is set", () => {
    const flow = buildGameFlowState({
      gameState: gameState({ players: [player("p-1", "mittel")] }),
      activeTeamId: "M-M",
    });
    expect(flow.currentStepId).toBe("set_lineup");
    expect(flow.currentStep.targetView).toBe("lineup");
  });

  it("opens arena once a lineup exists", () => {
    const flow = buildGameFlowState({
      gameState: gameState({
        players: [player("p-1", "mittel")],
        seasonState: {
          seasonId: "season-2",
          schedule: [],
          standings: {},
          formCards: [{ id: "card-1", saveId: "save-1", seasonId: "season-2", teamId: "M-M", playerId: "p-1", playerName: "p-1", cardColor: "red", cardValue: 1, createdAt: "2026-06-12T00:00:00.000Z" }],
          lineupDrafts: [{ lineupId: "lineup-1", saveId: "save-1", seasonId: "season-2", matchdayId: "season-2-md-1", teamId: "M-M", status: "submitted", entries: [{ disciplineId: "d1", disciplineSide: "d1", slotIndex: 0, playerId: "p-1", activePlayerId: "r-1" }], createdAt: "2026-06-12T00:00:00.000Z", updatedAt: "2026-06-12T00:00:00.000Z" }],
        },
      }),
      activeTeamId: "M-M",
    });
    expect(flow.currentStepId).toBe("open_arena");
    expect(flow.currentStep.targetView).toBe("matchdayArena");
  });

  it("opens matchday result once stored results exist", () => {
    const flow = buildGameFlowState({
      gameState: gameState({
        players: [player("p-1", "mittel")],
        matchdayState: { matchdayId: "season-2-md-1", status: "resolved", pendingTeamIds: [], resolvedFixtureIds: [] },
        seasonState: {
          seasonId: "season-2",
          schedule: [],
          standings: {},
          formCards: [{ id: "card-1", saveId: "save-1", seasonId: "season-2", teamId: "M-M", playerId: "p-1", playerName: "p-1", cardColor: "red", cardValue: 1, createdAt: "2026-06-12T00:00:00.000Z" }],
          lineupDrafts: [{ lineupId: "lineup-1", saveId: "save-1", seasonId: "season-2", matchdayId: "season-2-md-1", teamId: "M-M", status: "resolved", entries: [{ disciplineId: "d1", disciplineSide: "d1", slotIndex: 0, playerId: "p-1", activePlayerId: "r-1" }], createdAt: "2026-06-12T00:00:00.000Z", updatedAt: "2026-06-12T00:00:00.000Z" }],
          matchdayResults: [{ id: "result-1", saveId: "save-1", seasonId: "season-2", matchdayId: "season-2-md-1", status: "preview_applied", sourceVersion: "test", teamsTotal: 1, teamsReady: 1, teamsUnderfilled: 0, teamsMissingLineup: 0, teamsInvalidLineup: 0, teamsMissingScoreCoverage: 0, warningsCount: 0, createdAt: "2026-06-12T00:00:00.000Z", updatedAt: "2026-06-12T00:00:00.000Z" }],
        },
      }),
      activeTeamId: "M-M",
    });
    expect(flow.currentStepId).toBe("review_matchday_results");
    expect(flow.currentStep.targetView).toBe("matchdayArena");
    expect(flow.currentStep.targetPanel).toBe("arena-result-summary");
  });

  it("uses transfermarkt for preseason buy step", () => {
    const flow = buildGameFlowState({
      gameState: gameState({ gamePhase: "transfer_buy_phase" }),
      activeTeamId: "M-M",
    });
    expect(flow.steps.find((step) => step.stepId === "buy_players")?.targetView).toBe("market");
    expect(flow.steps.find((step) => step.stepId === "buy_players")?.cta).toContain("Spieler kaufen");
  });

  it("surfaces blockers when no active team exists", () => {
    const flow = buildGameFlowState({ gameState: gameState(), activeTeamId: null });
    expect(flow.currentStep.status).toBe("blocked");
    expect(flow.currentStep.blockers).toContain("no_active_team");
  });
});
