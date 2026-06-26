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
  it("starts empty new-game rosters with the season briefing before training", () => {
    const flow = buildGameFlowState({
      gameState: gameState({
        players: [],
        rosters: [],
        seasonState: {
          seasonId: "season-1",
          schedule: [],
          standings: {},
          newGameFlow: {
            active: true,
            selectedTeamId: "M-M",
            dismissed: false,
            steps: [{ stepId: "season_intro", status: "open" }],
          },
        },
        season: { id: "season-1", name: "Season 1", year: 2026, currentMatchday: 1, matchdayIds: ["season-1-md-1"] },
      }),
      activeTeamId: "M-M",
    });

    expect(flow.currentStepId).toBe("season_intro");
    expect(flow.currentStep.targetView).toBe("home");
    expect(flow.currentStep.targetPanel).toBe("season-briefing");
    expect(flow.nextStepId).toBe("scouting_facilities");
  });

  it("continues to scouting and buildings after the empty-roster season briefing is completed", () => {
    const flow = buildGameFlowState({
      gameState: gameState({
        players: [],
        rosters: [],
        seasonState: {
          seasonId: "season-1",
          schedule: [],
          standings: {},
          newGameFlow: {
            active: true,
            selectedTeamId: "M-M",
            dismissed: false,
            steps: [{ stepId: "season_intro", status: "completed", completedAt: "2026-06-20T00:00:00.000Z" }],
          },
        },
        season: { id: "season-1", name: "Season 1", year: 2026, currentMatchday: 1, matchdayIds: ["season-1-md-1"] },
      }),
      activeTeamId: "M-M",
    });

    expect(flow.currentStepId).toBe("scouting_facilities");
    expect(flow.currentStep.targetView).toBe("trainingV2");
    expect(flow.currentStep.targetPanel).toBe("facilities");
    expect(flow.currentStep.cta).toContain("Gebäude");
    expect(flow.nextStepId).toBe("buy_players");
  });

  it("keeps checked facilities completed while the empty roster still needs players", () => {
    const flow = buildGameFlowState({
      gameState: gameState({
        players: [],
        rosters: [],
        seasonState: {
          seasonId: "season-1",
          schedule: [],
          standings: {},
          newGameFlow: {
            active: true,
            selectedTeamId: "M-M",
            dismissed: false,
            steps: [
              { stepId: "season_intro", status: "completed", completedAt: "2026-06-20T00:00:00.000Z" },
              { stepId: "training_facilities", status: "completed", completedAt: "2026-06-20T00:01:00.000Z" },
            ],
          },
        },
        season: { id: "season-1", name: "Season 1", year: 2026, currentMatchday: 1, matchdayIds: ["season-1-md-1"] },
      }),
      activeTeamId: "M-M",
    });

    expect(flow.currentStepId).toBe("buy_players");
    expect(flow.steps.find((step) => step.stepId === "scouting_facilities")?.status).toBe("completed");
  });

  it("keeps a new-season briefing first even when the roster is already filled", () => {
    const flow = buildGameFlowState({
      gameState: gameState({
        players: [player("p-1", "mittel")],
        seasonState: {
          seasonId: "season-2",
          schedule: [],
          standings: {},
          newGameFlow: {
            active: true,
            selectedTeamId: "M-M",
            dismissed: false,
            steps: [{ stepId: "season_intro", status: "open" }],
          },
        },
      }),
      activeTeamId: "M-M",
    });

    expect(flow.currentStepId).toBe("season_intro");
    expect(flow.currentStep.targetPanel).toBe("season-briefing");
    expect(flow.steps.find((step) => step.stepId === "check_training")?.status).toBe("completed");
  });

  it("opens training first when active roster players have no training mode", () => {
    const flow = buildGameFlowState({ gameState: gameState(), activeTeamId: "M-M" });
    expect(flow.currentStepId).toBe("check_training");
    expect(flow.currentStep.targetView).toBe("trainingCompact");
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

  it("requires form card selections before arena when lineup is complete", () => {
    const flow = buildGameFlowState({
      gameState: gameState({
        players: [player("p-1", "mittel")],
        seasonState: {
          seasonId: "season-2",
          schedule: [],
          standings: {},
          disciplineSchedule: [{ seasonId: "season-2", matchdayId: "season-2-md-1", discipline1: { disciplineId: "d1", playerCount: 1 }, discipline2: null }],
          formCards: [{ id: "card-1", saveId: "save-1", seasonId: "season-2", teamId: "M-M", playerId: "p-1", playerName: "p-1", cardColor: "red", cardValue: 4, createdAt: "2026-06-12T00:00:00.000Z" }],
          lineupDrafts: [{ lineupId: "lineup-1", saveId: "save-1", seasonId: "season-2", matchdayId: "season-2-md-1", teamId: "M-M", status: "draft", entries: [{ disciplineId: "d1", disciplineSide: "d1", slotIndex: 0, playerId: "p-1", activePlayerId: "r-1" }], createdAt: "2026-06-12T00:00:00.000Z", updatedAt: "2026-06-12T00:00:00.000Z" }],
        },
      }),
      activeTeamId: "M-M",
    });

    expect(flow.currentStepId).toBe("assign_formcards");
    expect(flow.currentStep.blockers).toContain("missing_formcard_selections");
    expect(flow.steps.find((step) => step.stepId === "assign_formcards")?.targetPanel).toBe("form-board");
  });

  it("blocks arena when lineup is complete but form cards are missing", () => {
    const flow = buildGameFlowState({
      gameState: gameState({
        players: [player("p-1", "mittel")],
        seasonState: {
          seasonId: "season-2",
          schedule: [],
          standings: {},
          disciplineSchedule: [{ seasonId: "season-2", matchdayId: "season-2-md-1", discipline1: { disciplineId: "d1", playerCount: 1 }, discipline2: null }],
          formCards: [{ id: "card-1", saveId: "save-1", seasonId: "season-2", teamId: "M-M", playerId: "p-1", playerName: "p-1", cardColor: "red", cardValue: 4, createdAt: "2026-06-12T00:00:00.000Z" }],
          lineupDrafts: [{ lineupId: "lineup-1", saveId: "save-1", seasonId: "season-2", matchdayId: "season-2-md-1", teamId: "M-M", status: "draft", entries: [{ disciplineId: "d1", disciplineSide: "d1", slotIndex: 0, playerId: "p-1", activePlayerId: "r-1" }], createdAt: "2026-06-12T00:00:00.000Z", updatedAt: "2026-06-12T00:00:00.000Z" }],
        },
      }),
      activeTeamId: "M-M",
    });

    expect(flow.currentStepId).toBe("assign_formcards");
    const arenaStep = flow.steps.find((step) => step.stepId === "open_arena");
    expect(arenaStep?.status).toBe("blocked");
    expect(arenaStep?.blockers).toContain("missing_formcard_selections");
  });

  it("blocks arena when lineup is complete but not submitted", () => {
    const flow = buildGameFlowState({
      gameState: gameState({
        players: [player("p-1", "mittel")],
        seasonState: {
          seasonId: "season-2",
          schedule: [],
          standings: {},
          formCards: [{ id: "card-1", saveId: "save-1", seasonId: "season-2", teamId: "M-M", playerId: "p-1", playerName: "p-1", cardColor: "red", cardValue: 1, createdAt: "2026-06-12T00:00:00.000Z" }],
          lineupDrafts: [{ lineupId: "lineup-1", saveId: "save-1", seasonId: "season-2", matchdayId: "season-2-md-1", teamId: "M-M", status: "draft", entries: [{ disciplineId: "d1", disciplineSide: "d1", slotIndex: 0, playerId: "p-1", activePlayerId: "r-1" }], modifiers: { d1: { primaryFormCardId: "card-1", secondaryFormCardId: null, mutatorTrait1: null, mutatorTrait2: null, intensity: "normal", teamPowerId: null }, d2: { primaryFormCardId: null, secondaryFormCardId: null, mutatorTrait1: null, mutatorTrait2: null, intensity: "normal", teamPowerId: null } }, createdAt: "2026-06-12T00:00:00.000Z", updatedAt: "2026-06-12T00:00:00.000Z" }],
        },
      }),
      activeTeamId: "M-M",
    });

    expect(flow.currentStepId).toBe("confirm_lineup");
    const arenaStep = flow.steps.find((step) => step.stepId === "open_arena");
    expect(arenaStep?.status).toBe("blocked");
    expect(arenaStep?.blockers).toContain("lineup_not_submitted");
  });

  it("opens arena once lineup and form cards are ready", () => {
    const flow = buildGameFlowState({
      gameState: gameState({
        players: [player("p-1", "mittel")],
        seasonState: {
          seasonId: "season-2",
          schedule: [],
          standings: {},
          formCards: [{ id: "card-1", saveId: "save-1", seasonId: "season-2", teamId: "M-M", playerId: "p-1", playerName: "p-1", cardColor: "red", cardValue: 1, createdAt: "2026-06-12T00:00:00.000Z" }],
          lineupDrafts: [{ lineupId: "lineup-1", saveId: "save-1", seasonId: "season-2", matchdayId: "season-2-md-1", teamId: "M-M", status: "submitted", entries: [{ disciplineId: "d1", disciplineSide: "d1", slotIndex: 0, playerId: "p-1", activePlayerId: "r-1" }], modifiers: { d1: { primaryFormCardId: "card-1", secondaryFormCardId: null, mutatorTrait1: null, mutatorTrait2: null, intensity: "normal", teamPowerId: null }, d2: { primaryFormCardId: null, secondaryFormCardId: null, mutatorTrait1: null, mutatorTrait2: null, intensity: "normal", teamPowerId: null } }, createdAt: "2026-06-12T00:00:00.000Z", updatedAt: "2026-06-12T00:00:00.000Z" }],
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

  it("offers the next result-flow step after the current result panel instead of jumping backwards", () => {
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
    expect(flow.nextStepId).toBe("open_season_standings");
    expect(flow.nextStep?.targetView).toBe("season");
  });

  it("uses transfermarkt for preseason buy step", () => {
    const flow = buildGameFlowState({
      gameState: gameState({ gamePhase: "transfer_buy_phase" }),
      activeTeamId: "M-M",
    });
    expect(flow.steps.find((step) => step.stepId === "buy_players")?.targetView).toBe("market");
    expect(flow.steps.find((step) => step.stepId === "buy_players")?.cta).toContain("Spieler kaufen");
  });

  it("prioritizes season review after the final matchday instead of reopening the season briefing", () => {
    const flow = buildGameFlowState({
      gameState: gameState({
        gamePhase: "season_completed",
        season: { id: "season-1", name: "Season 1", year: 2026, currentMatchday: 10, matchdayIds: ["season-1-md-10"] },
        seasonState: {
          seasonId: "season-1",
          schedule: [],
          standings: {},
          newGameFlow: {
            active: true,
            selectedTeamId: "M-M",
            dismissed: false,
            steps: [{ stepId: "season_intro", status: "open" }],
          },
        },
      }),
      activeTeamId: "M-M",
    });

    expect(flow.phase).toBe("season_review");
    expect(flow.currentStepId).toBe("review_previous_season");
    expect(flow.currentStep.targetView).toBe("cockpit");
  });

  it("surfaces blockers when no active team exists", () => {
    const flow = buildGameFlowState({ gameState: gameState(), activeTeamId: null });
    expect(flow.currentStep.status).toBe("blocked");
    expect(flow.currentStep.blockers).toContain("no_active_team");
  });

  it("requires sponsor choice in season 1 onboarding after training facilities", () => {
    const flow = buildGameFlowState({
      gameState: gameState({
        season: { id: "season-1", name: "Season 1", year: 1, currentMatchday: 1, matchdayIds: ["md-1"] },
        seasonState: {
          seasonId: "season-1",
          schedule: [],
          standings: {},
          newGameFlow: {
            active: true,
            dismissed: false,
            selectedTeamId: "M-M",
            steps: [
              { stepId: "team_confirm", status: "completed" },
              { stepId: "roster_review", status: "completed" },
              { stepId: "first_transfers", status: "completed" },
              { stepId: "fill_roster", status: "completed" },
              { stepId: "training_facilities", status: "completed" },
              { stepId: "choose_sponsor", status: "open" },
              { stepId: "set_lineup", status: "open" },
            ],
          },
        },
        players: [player("p-1", "mittel")],
        rosters: [
          {
            id: "r-1",
            teamId: "M-M",
            playerId: "p-1",
            contractLength: 1,
            salary: 2,
            upkeep: 2,
            purchasePrice: 10,
            currentValue: 10,
            roleTag: "starter",
            joinedSeasonId: "season-1",
          },
        ],
      }),
      activeTeamId: "M-M",
    });

    const sponsorStep = flow.steps.find((entry) => entry.stepId === "choose_sponsor");
    expect(sponsorStep?.status).toBe("ready");
    expect(sponsorStep?.targetPanel).toBe("sponsor-choice");
    expect(flow.currentStep.stepId).toBe("choose_sponsor");
  });

  it("keeps sponsor choice optional in later seasons without onboarding", () => {
    const flow = buildGameFlowState({
      gameState: gameState({
        players: [player("p-1", "mittel")],
        rosters: [
          {
            id: "r-1",
            teamId: "M-M",
            playerId: "p-1",
            contractLength: 1,
            salary: 2,
            upkeep: 2,
            purchasePrice: 10,
            currentValue: 10,
            roleTag: "starter",
            joinedSeasonId: "season-2",
          },
        ],
      }),
      activeTeamId: "M-M",
    });

    const sponsorStep = flow.steps.find((entry) => entry.stepId === "choose_sponsor");
    expect(sponsorStep?.status).toBe("optional");
    expect(sponsorStep?.targetPanel).toBe("sponsor-choice");
  });

  it("merges active newGameFlow onboarding steps ahead of matchday flow", () => {
    const flow = buildGameFlowState({
      gameState: gameState({
        seasonState: {
          seasonId: "season-2",
          schedule: [],
          standings: {},
          newGameFlow: {
            active: true,
            selectedTeamId: "M-M",
            dismissed: false,
            steps: [{ stepId: "team_confirm", status: "open" }],
          },
        },
      }),
      activeTeamId: "M-M",
    });

    expect(flow.steps[0]?.stepId).toBe("team_confirm");
    expect(flow.steps.some((entry) => entry.stepId === "roster_review")).toBe(true);
  });
});
