import { describe, expect, it } from "vitest";

import { buildTeamPlayerTrainingClassPlans } from "@/lib/ai/ai-player-training-class-service";
import type { GameState, Player, Team, TeamIdentity } from "@/lib/data/olyDataTypes";

function buildState(players: Player[]): GameState {
  const team: Team = {
    teamId: "T-1",
    shortCode: "T1",
    name: "Test",
    budget: 100,
    cash: 100,
    identityId: "id-1",
    humanControlled: false,
    rosterLimit: 20,
    rosterMinTarget: 4,
    rosterOptTarget: 6,
  };
  const identity: TeamIdentity = {
    teamId: "T-1",
    playerType: "balanced",
    pow: 80,
    spe: 50,
    men: 50,
    soc: 50,
    ambition: 60,
    finances: 60,
    boardConfidence: 60,
    harmony: 60,
    manners: 60,
    popularity: 60,
    cooperation: 60,
    playerMin: 4,
    playerOpt: 6,
  };
  return {
    season: { id: "season-2", name: "S2", year: 2, currentMatchday: 1, matchdayIds: ["md-1"] },
    teams: [team],
    teamIdentities: [identity],
    players,
    rosters: players.map((player, index) => ({
      teamId: "T-1",
      playerId: player.id,
      roleTag: index === 0 ? "starter" : "depth",
      salary: 5,
      contractLength: 2,
    })),
    disciplines: [],
    seasonState: { seasonId: "season-2" },
    matchdayState: { matchdayId: "md-1", status: "planning", pendingTeamIds: ["T-1"] },
    gamePhase: "season_active",
    transferHistory: [],
  } as GameState;
}

describe("buildTeamPlayerTrainingClassPlans", () => {
  it("assigns POW-aligned class for young prospect under POW focus", () => {
    const players: Player[] = [
      {
        id: "p1",
        name: "Prospect",
        rating: 55,
        marketValue: 10,
        salaryDemand: 3,
        className: "Hero",
        race: "Human",
        alignment: "neutral",
        gender: "m",
        subclasses: [],
        traitsPositive: [],
        traitsNegative: [],
        coreStats: { pow: 50, spe: 50, men: 50, soc: 50 },
        preferredDisciplineIds: [],
        disciplineRatings: {},
        disciplineTierCounts: { above20: 0, above40: 0, above60: 0, above80: 0 },
        flavorEn: "",
        flavorDe: "",
        fatigue: 0,
        form: 50,
        potential: 78,
        age: 20,
      } as Player,
    ];
    const plans = buildTeamPlayerTrainingClassPlans({
      gameState: buildState(players),
      teamId: "T-1",
      trainingFocus: "POW",
    });
    expect(plans).toHaveLength(1);
    expect(["Berserker", "Warlord", "Tank", "Badass"]).toContain(plans[0]?.trainingClass);
  });

  it("keeps natural class for recovery focus", () => {
    const players: Player[] = [
      {
        id: "p1",
        name: "Vet",
        rating: 70,
        marketValue: 20,
        salaryDemand: 8,
        className: "Templar",
        race: "Human",
        alignment: "neutral",
        gender: "m",
        subclasses: [],
        traitsPositive: [],
        traitsNegative: [],
        coreStats: { pow: 60, spe: 60, men: 60, soc: 60 },
        preferredDisciplineIds: [],
        disciplineRatings: {},
        disciplineTierCounts: { above20: 0, above40: 0, above60: 0, above80: 0 },
        flavorEn: "",
        flavorDe: "",
        fatigue: 0,
        form: 50,
        potential: 60,
        age: 31,
      } as Player,
    ];
    const plans = buildTeamPlayerTrainingClassPlans({
      gameState: buildState(players),
      teamId: "T-1",
      trainingFocus: "RECOVERY",
    });
    expect(plans[0]?.trainingClass).toBe("Templar");
  });
});
