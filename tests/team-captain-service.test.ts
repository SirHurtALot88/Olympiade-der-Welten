import { describe, expect, it } from "vitest";

import type { GameState, Player, RosterEntry, Team } from "@/lib/data/olyDataTypes";
import {
  buildCaptainCandidateProfiles,
  getTeamCaptainEffectsTooltip,
  hasPersistedTeamCaptain,
  setTeamCaptain,
} from "@/lib/morale/team-captain-service";

function createCaptainTestGameState(): GameState {
  const team: Team = {
    teamId: "M-M",
    shortCode: "M-M",
    name: "Mayhem Mavericks",
    budget: 100,
    cash: 80,
    identityId: "M-M",
    humanControlled: true,
    rosterLimit: 12,
    logoPath: null,
  };
  const player: Player = {
    id: "p-captain",
    name: "Captain Test",
    rating: 70,
    marketValue: 20,
    salaryDemand: 5,
    displayMarketValue: 20,
    displaySalary: 5,
    className: "Hero",
    race: "Human",
    alignment: "N",
    gender: "m",
    referenceClass: null,
    imageSource: null,
    bracketLabel: null,
    subclasses: [],
    traitsPositive: ["Motivated"],
    traitsNegative: [],
    coreStats: { pow: 50, spe: 50, men: 60, soc: 55 },
    preferredDisciplineIds: [],
    disciplineRatings: { d1: 50 },
    disciplineTierCounts: { above20: 1, above40: 1, above60: 0, above80: 0 },
    flavorEn: "",
    flavorDe: "",
    fatigue: 0,
    form: 0,
    potential: 0,
    portraitPath: null,
    portraitUrl: null,
  };
  const roster: RosterEntry = {
    id: "roster:M-M:p-captain",
    teamId: "M-M",
    playerId: "p-captain",
    contractLength: 2,
    salary: 5,
    upkeep: 5,
    purchasePrice: 20,
    currentValue: 20,
    roleTag: "starter",
    joinedSeasonId: "S1",
  };

  return {
    season: { id: "S1", name: "Saison 1", currentMatchday: 1, matchdayIds: ["md-1"] },
    teams: [team],
    players: [player],
    rosters: [roster],
    disciplines: [
      { id: "d1", name: "TDM", category: "power", weight: 1 },
      { id: "d2", name: "Staffel", category: "speed", weight: 1 },
    ],
    seasonState: {
      disciplineResults: [],
      matchdayResults: [],
      seasonSnapshots: [],
    },
    matchdayState: { matchdayId: "md-1", status: "pending" },
    teamCaptains: [],
  } as unknown as GameState;
}

describe("team-captain-service", () => {
  it("builds ranked captain candidates with demand flags", () => {
    const gameState = createCaptainTestGameState();
    const candidates = buildCaptainCandidateProfiles(gameState, "M-M");
    expect(candidates.length).toBe(1);
    expect(candidates[0]?.leadershipScore).toBeGreaterThan(0);
    expect(candidates[0]?.effects.moraleBuffer).toBeGreaterThan(0);
  });

  it("exposes a transparent leadership breakdown whose points sum to the score", () => {
    const gameState = createCaptainTestGameState();
    const [candidate] = buildCaptainCandidateProfiles(gameState, "M-M");
    expect(candidate).toBeDefined();
    const breakdown = candidate!.leadershipBreakdown;
    // Alle Faktoren vorhanden, in fester Reihenfolge, mit lesbaren Labels.
    expect(breakdown.map((factor) => factor.key)).toEqual([
      "charisma",
      "will",
      "determination",
      "awareness",
      "rating",
      "traits",
    ]);
    // Der Charakter-Bonus für „Motivated" schlägt sich sichtbar nieder.
    const traits = breakdown.find((factor) => factor.key === "traits");
    expect(traits?.points).toBeGreaterThan(0);
    // Summe der Beiträge entspricht (bis auf Rundung) der Führungswertung.
    const sum = breakdown.reduce((total, factor) => total + factor.points, 0);
    expect(Math.abs(sum - candidate!.leadershipScore)).toBeLessThanOrEqual(0.6);
  });

  it("persists a manual team captain assignment", () => {
    const gameState = createCaptainTestGameState();
    expect(hasPersistedTeamCaptain(gameState, "M-M")).toBe(false);
    const next = setTeamCaptain(gameState, "M-M", "p-captain");
    expect(hasPersistedTeamCaptain(next, "M-M")).toBe(true);
    expect(next.teamCaptains?.find((entry) => entry.teamId === "M-M")?.source).toBe("manual_assignment");
  });

  it("exposes captain effects tooltip copy", () => {
    expect(getTeamCaptainEffectsTooltip()).toContain("Moral");
  });
});
