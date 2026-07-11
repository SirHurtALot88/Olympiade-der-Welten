import { describe, expect, it } from "vitest";

import type { GameState, Player, PlayerMoraleState } from "@/lib/data/olyDataTypes";
import {
  assessFreeAgentDispositionTowardTeam,
  MORALE_FORMER_TEAM_HOSTILE,
  MORALE_FORMER_TEAM_LOYAL_RETURN,
  MORALE_REFUSES_FORMER_TEAM,
} from "@/lib/morale/player-morale-service";

function createPlayer(id: string, partial?: Partial<Player>): Player {
  return {
    id,
    name: partial?.name ?? id,
    rating: partial?.rating ?? 72,
    marketValue: partial?.marketValue ?? 42,
    salaryDemand: partial?.salaryDemand ?? 7,
    displayMarketValue: partial?.displayMarketValue ?? 42,
    displaySalary: partial?.displaySalary ?? 7,
    className: partial?.className ?? "Hero",
    race: partial?.race ?? "Human",
    alignment: partial?.alignment ?? "N",
    gender: partial?.gender ?? "m",
    referenceClass: null,
    imageSource: null,
    bracketLabel: null,
    subclasses: [],
    traitsPositive: partial?.traitsPositive ?? [],
    traitsNegative: partial?.traitsNegative ?? [],
    coreStats: { pow: 70, spe: 50, men: 45, soc: 40 },
    preferredDisciplineIds: [],
    disciplineRatings: { climb: 75 },
    disciplineTierCounts: { above20: 1, above40: 1, above60: 1, above80: 0 },
    flavorEn: "",
    flavorDe: "",
    fatigue: 0,
    form: 0,
    potential: 0,
    portraitPath: null,
    portraitUrl: null,
  };
}

function createMoraleState(partial: Partial<PlayerMoraleState> & Pick<PlayerMoraleState, "playerId" | "teamId" | "morale">): PlayerMoraleState {
  return {
    visibleMood: partial.morale >= 60 ? "happy" : partial.morale >= 40 ? "neutral" : "unhappy",
    lastUpdatedSeasonId: partial.lastUpdatedSeasonId ?? "season-2",
    inactiveSeasons: partial.inactiveSeasons ?? 1,
    reasons: partial.reasons ?? [],
    contractIntent: partial.contractIntent ?? "short_term_only",
    ...partial,
  };
}

function createGameState(partial: Partial<GameState>): GameState {
  return {
    season: { id: "season-3", name: "Season 3", currentMatchday: 0 },
    gamePhase: "preseason",
    teams: [
      {
        teamId: "W-L",
        shortCode: "W-L",
        name: "Wild Legion",
        budget: 160,
        cash: 120,
        identityId: "W-L",
        humanControlled: false,
        rosterLimit: 12,
        logoPath: null,
      },
    ],
    teamIdentities: [],
    players: [createPlayer("p1")],
    rosters: [],
    transferHistory: [],
    playerMoraleState: [],
    seasonState: {},
    ...partial,
  } as GameState;
}

describe("assessFreeAgentDispositionTowardTeam", () => {
  it("blocks hostile former-team free agents", () => {
    const gameState = createGameState({
      playerMoraleState: [
        createMoraleState({
          playerId: "p1",
          teamId: "W-L",
          morale: 18,
          contractIntent: "refuses_extension",
        }),
      ],
    });

    const disposition = assessFreeAgentDispositionTowardTeam({
      gameState,
      playerId: "p1",
      teamId: "W-L",
    });

    expect(disposition.applies).toBe(true);
    expect(disposition.blockingReason).toBe(MORALE_REFUSES_FORMER_TEAM);
  });

  it("applies premium salary for unhappy former team", () => {
    const gameState = createGameState({
      playerMoraleState: [
        createMoraleState({
          playerId: "p1",
          teamId: "W-L",
          morale: 30,
          contractIntent: "considering_exit",
        }),
      ],
    });

    const disposition = assessFreeAgentDispositionTowardTeam({
      gameState,
      playerId: "p1",
      teamId: "W-L",
    });

    expect(disposition.salaryMultiplier).toBe(1.18);
    expect(disposition.warnings).toContain(MORALE_FORMER_TEAM_HOSTILE);
  });

  it("applies discount for loyal former team", () => {
    const gameState = createGameState({
      playerMoraleState: [
        createMoraleState({
          playerId: "p1",
          teamId: "W-L",
          morale: 82,
          contractIntent: "willing_to_extend",
        }),
      ],
    });

    const disposition = assessFreeAgentDispositionTowardTeam({
      gameState,
      playerId: "p1",
      teamId: "W-L",
    });

    expect(disposition.salaryMultiplier).toBe(0.94);
    expect(disposition.warnings).toContain(MORALE_FORMER_TEAM_LOYAL_RETURN);
  });

  it("is neutral for other teams", () => {
    const gameState = createGameState({
      playerMoraleState: [
        createMoraleState({
          playerId: "p1",
          teamId: "M-M",
          morale: 15,
          contractIntent: "refuses_extension",
        }),
      ],
    });

    const disposition = assessFreeAgentDispositionTowardTeam({
      gameState,
      playerId: "p1",
      teamId: "W-L",
    });

    expect(disposition.applies).toBe(false);
    expect(disposition.blockingReason).toBeNull();
  });
});
