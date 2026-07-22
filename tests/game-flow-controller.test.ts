import { describe, expect, it } from "vitest";

import type { GameState, Player, Team } from "@/lib/data/olyDataTypes";
import { buildGameFlowState, shouldAutoOpenSeasonBriefing } from "@/lib/foundation/game-flow-controller";

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
  it("auto-opens season briefing only at season start", () => {
    expect(
      shouldAutoOpenSeasonBriefing(
        gameState({
          gamePhase: "transfer_buy_phase",
          seasonState: {
            seasonId: "season-2",
            schedule: [],
            standings: {},
            newGameFlow: {
              active: true,
              dismissed: false,
              selectedTeamId: "M-M",
              steps: [{ stepId: "season_intro", status: "open" }],
            },
          },
        }),
        "open",
      ),
    ).toBe(true);

    expect(
      shouldAutoOpenSeasonBriefing(
        gameState({
          gamePhase: "season_completed",
          season: { id: "season-2", name: "Season 2", year: 2027, currentMatchday: 10, matchdayIds: ["season-2-md-10"], isCompleted: true },
          seasonState: {
            seasonId: "season-2",
            schedule: [],
            standings: {},
            newGameFlow: {
              active: true,
              dismissed: false,
              selectedTeamId: "M-M",
              steps: [{ stepId: "season_intro", status: "open" }],
            },
          },
        }),
        "open",
      ),
    ).toBe(false);

    expect(
      shouldAutoOpenSeasonBriefing(
        gameState({
          season: { id: "season-2", name: "Season 2", year: 2027, currentMatchday: 6, matchdayIds: ["season-2-md-6"] },
          seasonState: {
            seasonId: "season-2",
            schedule: [],
            standings: {},
            newGameFlow: {
              active: true,
              dismissed: false,
              selectedTeamId: "M-M",
              steps: [{ stepId: "season_intro", status: "open" }],
            },
          },
        }),
        "open",
      ),
    ).toBe(false);
  });

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
    expect(flow.currentStep.targetView).toBe("scoutingCenterV2");
    expect(flow.currentStep.targetPanel).toBeNull();
    expect(flow.currentStep.cta).toContain("Scouting");
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

  it("requires transfers to be finalized before lineup opens", () => {
    const flow = buildGameFlowState({
      gameState: gameState({ players: [player("p-1", "mittel")] }),
      activeTeamId: "M-M",
    });
    expect(flow.currentStepId).toBe("finalize_transfers");
    expect(flow.currentStep.cta).toBe("Transfers finalisieren");
    const lineupStep = flow.steps.find((step) => step.stepId === "set_lineup");
    expect(lineupStep?.status).toBe("blocked");
    expect(lineupStep?.blockers).toContain("transfers_not_finalized");
  });

  it("opens lineup after training is set and transfers are finalized", () => {
    const flow = buildGameFlowState({
      gameState: gameState({
        players: [player("p-1", "mittel")],
        seasonState: {
          seasonId: "season-2",
          schedule: [],
          standings: {},
          formCards: [{ id: "card-1", saveId: "save-1", seasonId: "season-2", teamId: "M-M", playerId: "p-1", playerName: "p-1", cardColor: "red", cardValue: 4, createdAt: "2026-06-12T00:00:00.000Z" }],
        },
      }),
      activeTeamId: "M-M",
    });
    expect(flow.steps.find((step) => step.stepId === "finalize_transfers")?.status).toBe("completed");
    expect(flow.currentStepId).toBe("set_lineup");
    expect(flow.currentStep.targetView).toBe("lineup");
  });

  it("treats form cards as optional when lineup is complete but not submitted", () => {
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

    expect(flow.currentStepId).toBe("confirm_lineup");
    expect(flow.steps.find((step) => step.stepId === "assign_formcards")?.status).toBe("optional");
    expect(flow.steps.find((step) => step.stepId === "confirm_lineup")?.status).toBe("ready");
    const arenaStep = flow.steps.find((step) => step.stepId === "open_arena");
    expect(arenaStep?.status).toBe("blocked");
  });

  it("opens arena when submitted lineup has form card pool but no manual card picks yet", () => {
    const flow = buildGameFlowState({
      gameState: gameState({
        players: [player("p-1", "mittel")],
        seasonState: {
          seasonId: "season-2",
          schedule: [],
          standings: {},
          disciplineSchedule: [{ seasonId: "season-2", matchdayId: "season-2-md-1", discipline1: { disciplineId: "d1", playerCount: 1 }, discipline2: null }],
          formCards: [{ id: "card-1", saveId: "save-1", seasonId: "season-2", teamId: "M-M", playerId: "p-1", playerName: "p-1", cardColor: "red", cardValue: 4, createdAt: "2026-06-12T00:00:00.000Z" }],
          lineupDrafts: [{ lineupId: "lineup-1", saveId: "save-1", seasonId: "season-2", matchdayId: "season-2-md-1", teamId: "M-M", status: "submitted", entries: [{ disciplineId: "d1", disciplineSide: "d1", slotIndex: 0, playerId: "p-1", activePlayerId: "r-1" }], createdAt: "2026-06-12T00:00:00.000Z", updatedAt: "2026-06-12T00:00:00.000Z" }],
        },
      }),
      activeTeamId: "M-M",
    });

    expect(flow.currentStepId).toBe("open_arena");
    expect(flow.steps.find((step) => step.stepId === "assign_formcards")?.status).toBe("completed");
  });

  it("blocks arena when lineup is complete but form card pool is missing", () => {
    const flow = buildGameFlowState({
      gameState: gameState({
        players: [player("p-1", "mittel")],
        seasonState: {
          seasonId: "season-2",
          schedule: [],
          standings: {},
          disciplineSchedule: [{ seasonId: "season-2", matchdayId: "season-2-md-1", discipline1: { disciplineId: "d1", playerCount: 1 }, discipline2: null }],
          lineupDrafts: [{ lineupId: "lineup-1", saveId: "save-1", seasonId: "season-2", matchdayId: "season-2-md-1", teamId: "M-M", status: "draft", entries: [{ disciplineId: "d1", disciplineSide: "d1", slotIndex: 0, playerId: "p-1", activePlayerId: "r-1" }], createdAt: "2026-06-12T00:00:00.000Z", updatedAt: "2026-06-12T00:00:00.000Z" }],
        },
      }),
      activeTeamId: "M-M",
    });

    expect(flow.currentStepId).toBe("finalize_transfers");
    expect(flow.steps.find((step) => step.stepId === "assign_formcards")?.blockers).toContain("missing_formcard_pool");
    const arenaStep = flow.steps.find((step) => step.stepId === "open_arena");
    expect(arenaStep?.status).toBe("blocked");
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

  it("orders the onboarding captain step after training + buying, before choosing the sponsor", () => {
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
            steps: [
              { stepId: "training_facilities", status: "open" },
              { stepId: "appoint_captain", status: "open" },
              { stepId: "choose_sponsor", status: "open" },
            ],
          },
        },
      }),
      activeTeamId: "M-M",
    });

    const ids = flow.steps.map((step) => step.stepId);
    const captainIdx = ids.indexOf("appoint_captain");
    const trainingIdx = ids.indexOf("training_facilities");
    const transfersIdx = ids.indexOf("fill_roster");
    const sponsorIdx = ids.indexOf("choose_sponsor");
    expect(captainIdx).toBeGreaterThan(-1);
    expect(captainIdx).toBeGreaterThan(trainingIdx);
    expect(captainIdx).toBeGreaterThan(transfersIdx);
    expect(captainIdx).toBeLessThan(sponsorIdx);
  });

  it("blocks the human onboarding captain step until a captain is appointed", () => {
    const withoutCaptain = buildGameFlowState({
      gameState: gameState({
        seasonState: {
          seasonId: "season-2",
          schedule: [],
          standings: {},
          newGameFlow: {
            active: true,
            selectedTeamId: "M-M",
            dismissed: false,
            steps: [{ stepId: "appoint_captain", status: "open" }],
          },
        },
      }),
      activeTeamId: "M-M",
    });
    expect(withoutCaptain.steps.find((step) => step.stepId === "appoint_captain")?.status).toBe("ready");

    const withCaptain = buildGameFlowState({
      gameState: gameState({
        teamCaptains: [
          {
            seasonId: "season-2",
            teamId: "M-M",
            playerId: "p-1",
            playerName: "p-1",
            leadershipScore: 40,
            style: "leader",
            effects: { moraleBuffer: 2, rivalryPressureReductionPct: 8, teamPowerModifierPct: 3, conflictSoftenChancePct: 12 },
            traitSignals: [],
            source: "manual_assignment",
          },
        ],
        seasonState: {
          seasonId: "season-2",
          schedule: [],
          standings: {},
          newGameFlow: {
            active: true,
            selectedTeamId: "M-M",
            dismissed: false,
            steps: [{ stepId: "appoint_captain", status: "open" }],
          },
        },
      }),
      activeTeamId: "M-M",
    });
    expect(withCaptain.steps.find((step) => step.stepId === "appoint_captain")?.status).toBe("completed");
  });

  it("points the training onboarding step at the training view (where it is actually completed)", () => {
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
            steps: [{ stepId: "training_facilities", status: "open" }],
          },
        },
      }),
      activeTeamId: "M-M",
    });
    const training = flow.steps.find((step) => step.stepId === "training_facilities");
    expect(training?.targetView).toBe("trainingV2");
    expect(training?.targetView).not.toBe("scoutingCenterV2");
  });

  it("does not block the onboarding sponsor step while training is still open", () => {
    const flow = buildGameFlowState({
      gameState: gameState({
        // player without a training mode → training_facilities stays incomplete
        players: [player("p-1")],
        seasonState: {
          seasonId: "season-2",
          schedule: [],
          standings: {},
          newGameFlow: {
            active: true,
            selectedTeamId: "M-M",
            dismissed: false,
            steps: [
              { stepId: "training_facilities", status: "open" },
              { stepId: "choose_sponsor", status: "open" },
            ],
          },
        },
      }),
      activeTeamId: "M-M",
    });
    const sponsor = flow.steps.find((step) => step.stepId === "choose_sponsor");
    // Früher "blocked" ohne Begründung — jetzt frei wählbar (unabhängig vom Training).
    expect(sponsor?.status).not.toBe("blocked");
  });

  it("relabels the advance step to 'Saison abschließen' on the final matchday", () => {
    const flow = buildGameFlowState({
      gameState: gameState({
        players: [player("p-1", "mittel")],
        season: { id: "season-2", name: "Season 2", year: 2027, currentMatchday: 1, matchdayIds: ["season-2-md-1"] },
        matchdayState: { matchdayId: "season-2-md-1", status: "resolved", pendingTeamIds: [], resolvedFixtureIds: [] },
        seasonState: { seasonId: "season-2", schedule: [], standings: {} },
      }),
      activeTeamId: "M-M",
    });
    const advance = flow.steps.find((step) => step.stepId === "advance_to_next_matchday");
    expect(advance?.label).toBe("Saison abschließen");
    expect(advance?.cta).toContain("Auswertung");
  });

  it("surfaces a soft captain reminder on the arena step for a human team without a captain", () => {
    const flow = buildGameFlowState({
      gameState: gameState({
        players: [player("p-1", "mittel")],
        seasonState: {
          seasonId: "season-2",
          schedule: [],
          standings: {},
          disciplineSchedule: [{ seasonId: "season-2", matchdayId: "season-2-md-1", discipline1: { disciplineId: "d1", playerCount: 1 }, discipline2: null }],
          lineupDrafts: [{ lineupId: "lineup-1", saveId: "save-1", seasonId: "season-2", matchdayId: "season-2-md-1", teamId: "M-M", status: "submitted", entries: [{ disciplineId: "d1", disciplineSide: "d1", slotIndex: 0, playerId: "p-1", activePlayerId: "r-1" }], createdAt: "2026-06-12T00:00:00.000Z", updatedAt: "2026-06-12T00:00:00.000Z" }],
        },
      }),
      activeTeamId: "M-M",
    });
    const arena = flow.steps.find((step) => step.stepId === "open_arena");
    // Weicher Hinweis (blockiert nicht): der Schritt bleibt spielbar.
    expect(arena?.warnings).toContain("captain_recommended");
    expect(arena?.status).not.toBe("blocked");
  });

  it("never makes 'Spieler verkaufen' the guided next action in the preseason", () => {
    const flow = buildGameFlowState({
      gameState: gameState({
        gamePhase: "preseason_management",
        players: [player("p-1", "mittel")],
      }),
      activeTeamId: "M-M",
    });
    const sell = flow.steps.find((step) => step.stepId === "sell_players");
    // Verkaufen ist optional und darf nie die "Weiter"-Aktion sein (Bug: nach
    // einem Kauf schlug der Flow "Spieler verkaufen" vor).
    expect(sell?.status).toBe("optional");
    expect(flow.currentStepId).not.toBe("sell_players");
    expect(flow.nextStepId).not.toBe("sell_players");
  });
});
