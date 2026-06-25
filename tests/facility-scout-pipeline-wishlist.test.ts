import { describe, expect, it } from "vitest";

import { refreshScoutPipeline } from "@/lib/scouting/facility-scout-pipeline-service";
import type { GameState } from "@/lib/data/olyDataTypes";

function baseGameState(): GameState {
  return {
    gamePhase: "season_active",
    season: { id: "s1", name: "S1", currentMatchday: 1, totalMatchdays: 10, isCompleted: false },
    seasonState: {
      seasonId: "s1",
      schedule: [],
      standings: {},
      matchdayResults: [],
      playerDisciplinePerformances: [],
      disciplineHighlights: [],
      transferWishlist: [{ id: "w1", saveId: "save", seasonId: "s1", teamId: "T-T", playerId: "p1", playerName: "P1", className: "Hero", race: "Human", marketValue: 10, salary: 2, createdAt: new Date().toISOString() }],
      teamFacilities: {
        "T-T": {
          teamId: "T-T",
          seasonId: "s1",
          facilities: {
            scouting_office: { level: 0, condition: 100, disabledReason: null },
          },
        },
      },
    },
    teams: [{ teamId: "T-T", shortCode: "T-T", name: "Teachers", budget: 100, cash: 100, identityId: "i", humanControlled: true, rosterLimit: 20 }],
    players: [{ id: "p1", name: "P1", rating: 60, marketValue: 10, salaryDemand: 2, className: "Hero", race: "Human", alignment: "N", gender: "x", subclasses: [], traitsPositive: [], traitsNegative: [], coreStats: { pow: 50, spe: 50, men: 50, soc: 50 }, preferredDisciplineIds: [], disciplineRatings: {}, disciplineTierCounts: { above20: 0, above40: 0, above60: 0, above80: 0 }, flavorEn: "", flavorDe: "", fatigue: 0, form: 0, potential: 70, trainingMode: "mittel", trainingClass: null }],
    rosters: [],
    disciplines: [],
    teamIdentities: [],
  } as GameState;
}

describe("facility scout pipeline wishlist mirror", () => {
  it("does not mirror transfer wishlist when scouting office is L0", () => {
    const next = refreshScoutPipeline(baseGameState(), "T-T");
    expect(next.seasonState.scoutIntelByTeamId?.["T-T"] ?? []).toHaveLength(0);
  });
});
