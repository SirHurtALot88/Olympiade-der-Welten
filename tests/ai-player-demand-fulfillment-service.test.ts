import { describe, expect, it } from "vitest";

import { applyAiTeamPlayerDemandFulfillment } from "@/lib/ai/ai-player-demand-fulfillment-service";
import type { GameState, Player, RosterEntry } from "@/lib/data/olyDataTypes";

function player(partial: Partial<Player> & { id: string }): Player {
  return {
    name: partial.name ?? partial.id,
    rating: 70,
    marketValue: 20,
    salaryDemand: 5,
    className: "Hero",
    race: "Human",
    alignment: "N",
    gender: "x",
    subclasses: [],
    traitsPositive: ["Ambitious"],
    traitsNegative: [],
    coreStats: { pow: 50, spe: 50, men: 50, soc: 50 },
    preferredDisciplineIds: [],
    disciplineRatings: {},
    disciplineTierCounts: { above20: 0, above40: 0, above60: 0, above80: 0 },
    flavorEn: "",
    flavorDe: "",
    fatigue: 20,
    form: 0,
    potential: 75,
    trainingMode: "mittel",
    trainingClass: null,
    ...partial,
  };
}

function rosterEntry(playerId: string, teamId = "T-1"): RosterEntry {
  return {
    id: `${teamId}:${playerId}`,
    teamId,
    playerId,
    salary: 5,
    upkeep: 5,
    contractLength: 2,
    contractStatus: "active",
    roleTag: "starter",
    currentValue: 20,
    purchasePrice: 15,
  };
}

function gameState(players: Player[], teamId = "T-1"): GameState {
  return {
    season: { id: "season-1", name: "Season 1", matchdayIds: ["md-1"] },
    matchdayState: { matchdayId: "md-1", resolvedFixtureIds: [] },
    seasonState: {
      disciplineSchedule: [{ matchdayId: "md-1", matchdayIndex: 4, discipline1: null, discipline2: null }],
      teamControlSettings: { [teamId]: { controlMode: "ai" } },
    },
    teams: [{ teamId, name: "Test Team", shortCode: "TST", cash: 100, humanControlled: false }],
    teamIdentities: [{ teamId, playerMin: 7, playerOpt: 10, ambition: 50, finances: 50 }],
    rosters: players.map((entry) => rosterEntry(entry.id, teamId)),
    players,
    disciplines: [],
  } as unknown as GameState;
}

describe("ai-player-demand-fulfillment-service", () => {
  it("occasionally sets preferred training mode for AI teams", () => {
    const fillerPlayers = Array.from({ length: 7 }, (_, index) =>
      player({
        id: `bench-${index}`,
        name: `Bench ${index}`,
        rating: 88 - index,
        ovr: 88 - index,
        disciplineRatings: { climb: 80, chess: 75 },
      }),
    );
    const testPlayer = player({
      id: "p-hard-demand",
      name: "Hard Trainer",
      rating: 42,
      ovr: 42,
      traitsPositive: ["Ambitious", "Motivated", "Diligent"],
      trainingMode: "leicht",
      disciplineRatings: { climb: 40, chess: 38 },
    });
    const state = gameState([...fillerPlayers, testPlayer]);
    const result = applyAiTeamPlayerDemandFulfillment({
      gameState: state,
      teamId: "T-1",
      probabilityPct: 100,
    });
    const updated = result.gameState.players.find((entry) => entry.id === testPlayer.id);
    expect(updated?.trainingMode).toBe("hart");
    expect(result.fulfilledDemandIds.length).toBeGreaterThan(0);
  });
});
