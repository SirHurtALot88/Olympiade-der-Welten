import { describe, expect, it } from "vitest";

import type { GameState, Player, Team } from "@/lib/data/olyDataTypes";
import { buildGameFlowState } from "@/lib/foundation/game-flow-controller";
import { buildMatchdayArenaBlockerSummary } from "@/lib/foundation/matchday-arena-blocker-summary";
import { formatGameFlowBlocker } from "@/lib/foundation/game-flow-blocker-labels";
import { resolvePrizeMoneySponsorBasis } from "@/lib/season/prize-money-sponsor-source";
import { getTeamBoardFlowSignals } from "@/lib/board/team-season-objectives-service";

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
    season: { id: "season-2", name: "Season 2", year: 2027, currentMatchday: 2, matchdayIds: ["season-2-md-1", "season-2-md-2"] },
    seasonState: {
      seasonId: "season-2",
      schedule: [],
      standings: {},
      ...(partial?.seasonState ?? {}),
    },
    matchdayState: {
      matchdayId: "season-2-md-2",
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

describe("gameplay priorities wiring", () => {
  it("auto-completes onboarding roster steps from live milestones", () => {
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
              { stepId: "team_confirm", status: "open" },
              { stepId: "roster_review", status: "open" },
              { stepId: "first_transfers", status: "open" },
              { stepId: "fill_roster", status: "open" },
              { stepId: "training_facilities", status: "open" },
              { stepId: "choose_sponsor", status: "open" },
            ],
          },
        },
        transferHistory: [
          {
            id: "tx-1",
            seasonId: "season-2",
            playerId: "p-1",
            fromTeamId: null,
            toTeamId: "M-M",
            fee: 10,
            salary: 2,
            marketValue: 10,
            remainingContractLength: 2,
            happenedAt: "2027-01-01T00:00:00.000Z",
          },
        ],
      }),
      activeTeamId: "M-M",
    });

    expect(flow.steps.find((entry) => entry.stepId === "roster_review")?.status).toBe("completed");
    expect(flow.steps.find((entry) => entry.stepId === "first_transfers")?.status).toBe("completed");
    expect(flow.currentStepId).not.toBe("roster_review");
  });

  it("blocks transfer steps when buy window is closed mid-season", () => {
    const flow = buildGameFlowState({
      gameState: gameState({
        rosters: [],
        players: [],
      }),
      activeTeamId: "M-M",
    });

    const buyStep = flow.steps.find((entry) => entry.stepId === "buy_players");
    expect(buyStep?.status).toBe("blocked");
    expect(buyStep?.blockers.some((blocker) => blocker.startsWith("phase_blocked:buy_players"))).toBe(true);
  });

  it("routes scouting flow step to scouting center", () => {
    const flow = buildGameFlowState({
      gameState: gameState({
        rosters: [],
        players: [],
      }),
      activeTeamId: "M-M",
    });

    const scoutingStep = flow.steps.find((entry) => entry.stepId === "scouting_facilities");
    expect(scoutingStep?.targetView).toBe("scoutingCenterV2");
  });

  it("merges arena and resolve blockers into one summary", () => {
    const summary = buildMatchdayArenaBlockerSummary({
      gameState: gameState(),
      activeTeamId: "M-M",
      flowStep: {
        stepId: "open_arena",
        status: "blocked",
        blockers: ["lineup_not_submitted"],
      },
      resolvePreviewStatus: "missing_lineups",
    });

    expect(summary.primaryReason).toBe("missing_lineup");
    expect(summary.reasons).toContain("lineup_not_submitted");
    expect(summary.reasons).toContain("resolve_status:missing_lineups");
  });

  it("formats lineup_not_submitted with explicit confirm copy", () => {
    expect(formatGameFlowBlocker("lineup_not_submitted")).toContain("bestaetigt");
  });

  it("falls back to sponsor contract basis when prize sheet basis is missing", () => {
    const basis = resolvePrizeMoneySponsorBasis(
      gameState({
        seasonState: {
          seasonId: "season-2",
          schedule: [],
          standings: {},
          sponsorContractsByTeamId: {
            "M-M": {
              seasonId: "season-2",
              teamId: "M-M",
              offerId: "offer-1",
              archetype: "corporate",
              name: "Acme",
              chosenAt: "2027-01-01T00:00:00.000Z",
              startRank: 16,
              components: [{ componentId: "base", kind: "base", label: "Basis", rewardCash: 42, penaltyCash: 0 }],
              payouts: {},
            },
          },
        },
      }),
      "M-M",
      null,
    );

    expect(basis.source).toBe("sponsor_contract");
    expect(basis.basis).toBe(42);
  });

  it("surfaces board objective warnings in matchday flow without blocking arena", () => {
    const negativeCashState = gameState({
      teams: [team({ cash: -8 })],
      teamIdentities: [
        {
          teamId: "M-M",
          identityId: "M-M",
          boardConfidence: 4,
          pow: 5,
          spe: 5,
          men: 5,
          soc: 5,
          ambition: 5,
          playerMin: 8,
          playerOpt: 12,
        },
      ],
      players: [player("p-1", "mittel")],
    });
    const flow = buildGameFlowState({
      gameState: negativeCashState,
      activeTeamId: "M-M",
    });

    expect(getTeamBoardFlowSignals(negativeCashState, "M-M").blockers).toContain("board_objectives_failed");

    const trainingStep = flow.steps.find((entry) => entry.stepId === "check_training");
    const arenaStep = flow.steps.find((entry) => entry.stepId === "open_arena");
    expect(trainingStep?.warnings).toContain("board_objectives_failed");
    expect(arenaStep?.blockers).not.toContain("board_objectives_failed");
  });

  it("keeps preseason cockpit steps open until rewards and development are done", () => {
    const flow = buildGameFlowState({
      gameState: gameState({
        gamePhase: "preseason_management",
        season: { id: "season-2", name: "Season 2", year: 2027, currentMatchday: 1, matchdayIds: ["season-2-md-1"] },
        seasonState: {
          seasonId: "season-2",
          schedule: [],
          standings: {},
          seasonSnapshots: [
            {
              snapshotId: "season-snapshot__season-1",
              seasonId: "season-1",
              seasonName: "Season 1",
              archivedAt: "2027-01-01T00:00:00.000Z",
              status: "completed",
              sourceStatus: "mapped",
              finalStandings: [],
              playerPerformances: [],
              transferSnapshots: [],
            },
          ],
        },
        seasonTransition: {
          transitionId: "tr-1",
          fromSeasonId: "season-1",
          toSeasonId: "season-2",
          currentStep: "season_rewards",
          status: "preview",
          completedSteps: [],
          warnings: [],
          errors: [],
          createdAt: "2027-01-01T00:00:00.000Z",
        },
      }),
      activeTeamId: "M-M",
    });

    expect(flow.steps.find((entry) => entry.stepId === "apply_rewards")?.warnings).toContain("prize_money_not_applied");
    expect(flow.steps.find((entry) => entry.stepId === "player_development")?.warnings).toContain("player_development_pending");
    expect(flow.steps.find((entry) => entry.stepId === "prepare_season")?.warnings).toEqual(
      expect.arrayContaining(["prize_money_not_applied", "player_development_pending"]),
    );
  });

  it("keeps S2 on matchday result flow after first resolved matchday", () => {
    const flow = buildGameFlowState({
      gameState: gameState({
        season: { id: "season-2", name: "Season 2", year: 2027, currentMatchday: 1, matchdayIds: ["season-2-md-1", "season-2-md-2"] },
        matchdayState: {
          matchdayId: "season-2-md-1",
          status: "resolved",
          pendingTeamIds: [],
          resolvedFixtureIds: ["fixture-1"],
        },
        seasonState: {
          seasonId: "season-2",
          schedule: [],
          standings: {},
          matchdayResults: [
            {
              seasonId: "season-2",
              matchdayId: "season-2-md-1",
              appliedAt: "2027-02-01T00:00:00.000Z",
              source: "local_auto_run",
            },
          ],
        },
      }),
      activeTeamId: "M-M",
    });

    expect(flow.phase).toBe("matchday_result");
    expect(flow.steps.find((entry) => entry.stepId === "review_matchday_results")?.status).toBe("ready");
    expect(flow.steps.find((entry) => entry.stepId === "season_intro")?.status).toBe("completed");
    expect(flow.steps.find((entry) => entry.stepId === "advance_to_next_matchday")?.status).not.toBe("blocked");
  });
});
