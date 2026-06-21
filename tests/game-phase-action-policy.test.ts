import { describe, expect, it } from "vitest";

import type { GamePhase, GameState, Player, Team } from "@/lib/data/olyDataTypes";
import { evaluateGamePhaseAction } from "@/lib/foundation/game-phase-action-policy";
import { GAME_LANGUAGE } from "@/lib/ui/game-language";

function team(): Team {
  return {
    teamId: "M-M",
    shortCode: "M-M",
    name: "Mayhem Mavericks",
    budget: 500,
    cash: 300,
    identityId: "M-M",
    humanControlled: true,
    rosterLimit: 12,
  };
}

function player(): Player {
  return {
    id: "p-1",
    name: "Player 1",
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
    trainingMode: "mittel",
  };
}

function gameState(phase: GamePhase, options?: { newGameFlowOpen?: boolean; completedSeason?: boolean }): GameState {
  const matchdayIds = ["season-1-md-1", "season-1-md-10"];
  return {
    gamePhase: phase,
    season: { id: "season-1", name: "Season 1", year: 2026, currentMatchday: 1, matchdayIds },
    seasonState: {
      seasonId: "season-1",
      schedule: [],
      standings: {},
      newGameFlow: options?.newGameFlowOpen
        ? { active: true, selectedTeamId: "M-M", dismissed: false, steps: [{ stepId: "season_intro", status: "open" }] }
        : undefined,
      matchdayResults: options?.completedSeason
        ? [{ id: "r-1", saveId: "save-1", seasonId: "season-1", matchdayId: "season-1-md-10", status: "preview_applied", sourceVersion: "test", teamsTotal: 1, teamsReady: 1, teamsUnderfilled: 0, teamsMissingLineup: 0, teamsInvalidLineup: 0, teamsMissingScoreCoverage: 0, warningsCount: 0, createdAt: "2026-06-21T00:00:00.000Z", updatedAt: "2026-06-21T00:00:00.000Z" }]
        : [],
    },
    matchdayState: {
      matchdayId: "season-1-md-1",
      status: "planning",
      pendingTeamIds: [],
      resolvedFixtureIds: [],
    },
    teams: [team()],
    teamIdentities: [],
    players: [player()],
    disciplines: [],
    rosters: [{ id: "roster-1", teamId: "M-M", playerId: "p-1", contractLength: 1, salary: 2, upkeep: 2, purchasePrice: 10, currentValue: 10, roleTag: "starter", joinedSeasonId: "season-1" }],
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

describe("game phase action policy", () => {
  it("allows early new-game transfer setup before the first matchday result", () => {
    const gate = evaluateGamePhaseAction(gameState("season_active", { newGameFlowOpen: true }), "buy_players");
    expect(gate.allowed).toBe(true);
    expect(gate.warnings).toContain("early_season_setup_allowed_before_first_result");
  });

  it("allows preseason management before the first result even when the intro flow is already dismissed", () => {
    const gate = evaluateGamePhaseAction(gameState("season_active"), "buy_players");
    expect(gate.allowed).toBe(true);
    expect(gate.warnings).toContain("early_season_setup_allowed_before_first_result");
  });

  it("blocks transfer writes once the season is completed", () => {
    const gate = evaluateGamePhaseAction(gameState("season_completed"), "buy_players");
    expect(gate.allowed).toBe(false);
    expect(gate.reason).toBe("phase_blocked:buy_players:season_completed");
  });

  it("treats facility writes like preseason management actions", () => {
    expect(evaluateGamePhaseAction(gameState("preseason_management"), "facility_apply").allowed).toBe(true);

    const gate = evaluateGamePhaseAction(gameState("season_completed"), "facility_apply");
    expect(gate.allowed).toBe(false);
    expect(gate.reason).toBe("phase_blocked:facility_apply:season_completed");
  });

  it("allows season completion from a completed season result", () => {
    const gate = evaluateGamePhaseAction(gameState("season_active", { completedSeason: true }), "complete_season");
    expect(gate.allowed).toBe(true);
  });

  it("keeps the core UI language centralized", () => {
    expect(GAME_LANGUAGE.screens.lineup).toBe("Einsatzliste");
    expect(GAME_LANGUAGE.actions.ready).toBe("Bereit");
    expect(GAME_LANGUAGE.actions.submit).toBe(GAME_LANGUAGE.actions.confirm);
  });
});
