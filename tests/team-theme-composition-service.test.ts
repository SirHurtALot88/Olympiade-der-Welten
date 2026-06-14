import { describe, expect, it } from "vitest";

import {
  buildTeamThemeCompositionAudit,
  calculateThemeCompositionScore,
  derivePlayerThemeTags,
  getTeamThemeCompositionTarget,
} from "@/lib/ai/team-theme-composition-service";
import type { GameState, Player } from "@/lib/data/olyDataTypes";

function player(partial: Partial<Player> & { id: string; name: string }): Player {
  return {
    id: partial.id,
    name: partial.name,
    rating: partial.rating ?? 55,
    marketValue: partial.marketValue ?? 10,
    salaryDemand: partial.salaryDemand ?? 2,
    className: partial.className ?? "Hero",
    race: partial.race ?? "Human",
    alignment: partial.alignment ?? "Neutral",
    gender: "unknown",
    subclasses: partial.subclasses ?? [],
    traitsPositive: partial.traitsPositive ?? [],
    traitsNegative: partial.traitsNegative ?? [],
    coreStats: partial.coreStats ?? { pow: 50, spe: 50, men: 50, soc: 50 },
    preferredDisciplineIds: [],
    disciplineRatings: {},
    shortCode: partial.shortCode ?? partial.id,
    ovr: partial.ovr ?? partial.rating ?? 55,
    potential: partial.potential,
  } as Player;
}

function gameState(players: Player[]): GameState {
  return {
    teams: [
      { teamId: "L-R", shortCode: "L-R", name: "Last Ride", budget: 200, cash: 200, identityId: "L-R", humanControlled: false, rosterLimit: 12 },
      { teamId: "H-R", shortCode: "H-R", name: "Hell Raisers", budget: 200, cash: 200, identityId: "H-R", humanControlled: false, rosterLimit: 12 },
      { teamId: "R-R", shortCode: "R-R", name: "Riptide Rivers", budget: 200, cash: 200, identityId: "R-R", humanControlled: false, rosterLimit: 12 },
    ],
    players,
    rosters: [
      { teamId: "L-R", playerId: "lich", role: "starter", joinedSeasonId: "s1", salary: 2, contractLength: 1 },
      { teamId: "L-R", playerId: "ghost", role: "starter", joinedSeasonId: "s1", salary: 2, contractLength: 1 },
      { teamId: "L-R", playerId: "angel", role: "starter", joinedSeasonId: "s1", salary: 2, contractLength: 1 },
    ],
    teamIdentities: [],
    disciplines: [],
    season: { id: "s1", name: "Season 1", status: "active" },
    matchdayState: { matchdayId: "md1", status: "preparation" },
    seasonState: {},
    transferHistory: [],
  } as unknown as GameState;
}

describe("team-theme-composition-service", () => {
  it("derives explicit theme tags from race, class, subclasses, traits and alignment", () => {
    const row = derivePlayerThemeTags(
      player({
        id: "p1",
        name: "Sir Skullwake",
        race: "Undead",
        className: "Necromancer",
        subclasses: ["Lich", "Grave Reaper"],
        traitsPositive: ["Mercenary"],
        alignment: "Lawful Evil",
      }),
    );

    expect(row.playerThemeTags).toEqual(expect.arrayContaining(["Undead", "Lich", "Reaper", "Death", "Mercenary", "Lawful"]));
  });

  it("rewards hard-theme candidates and penalizes avoid-tag outsiders", () => {
    const players = [
      player({ id: "lich", name: "Lich", race: "Undead", subclasses: ["Lich"], rating: 60 }),
      player({ id: "ghost", name: "Ghost", race: "Undead", subclasses: ["Ghost"], rating: 55 }),
      player({ id: "angel", name: "Angel", race: "Divine", subclasses: ["Angel"], rating: 90 }),
      player({ id: "candidate-undead", name: "New Reaper", race: "Undead", subclasses: ["Reaper"], rating: 65 }),
      player({ id: "candidate-holy", name: "Holy Outsider", race: "Divine", subclasses: ["Angel", "Holy"], rating: 65 }),
    ];
    const state = gameState(players);
    const team = state.teams[0];
    const undeadScore = calculateThemeCompositionScore({
      gameState: state,
      team,
      player: players[3],
      candidateQuality: 65,
      phase: "phase_b_core_optimum",
    });
    const holyScore = calculateThemeCompositionScore({
      gameState: state,
      team,
      player: players[4],
      candidateQuality: 65,
      phase: "phase_b_core_optimum",
    });

    expect(getTeamThemeCompositionTarget("L-R")?.strictness).toBe("hard");
    expect(undeadScore.themeCompositionScore).toBeGreaterThan(holyScore.themeCompositionScore);
    expect(holyScore.themeTier).toBe("avoid");
  });

  it("audits team theme share and marks teams below hard minimum red", () => {
    const players = [
      player({ id: "lich", name: "Lich", race: "Undead", subclasses: ["Lich"], rating: 60 }),
      player({ id: "ghost", name: "Ghost", race: "Undead", subclasses: ["Ghost"], rating: 55 }),
      player({ id: "angel", name: "Angel", race: "Divine", subclasses: ["Angel"], rating: 90 }),
    ];
    const state = gameState(players);
    const audit = buildTeamThemeCompositionAudit(state);
    const lastRide = audit.find((row) => row.teamId === "L-R");

    expect(lastRide?.primaryThemeCount).toBe(2);
    expect(lastRide?.primaryThemeShare).toBeCloseTo(0.667, 2);
    expect(lastRide?.status).toBe("red_below_minimum");
  });
});
