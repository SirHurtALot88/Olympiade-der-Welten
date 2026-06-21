import { describe, expect, it } from "vitest";

import type { GameState, Player, Team } from "@/lib/data/olyDataTypes";
import {
  buildSeasonPlayabilityGate,
  classifySeasonPlayabilityWarning,
} from "@/lib/foundation/season-playability-gate";

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
  };
}

function player(id: string, trainingMode: Player["trainingMode"] = "mittel"): Player {
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

function gameState(): GameState {
  return {
    gamePhase: "season_active",
    season: { id: "season-2", name: "Season 2", year: 2027, currentMatchday: 1, matchdayIds: ["season-2-md-1"] },
    seasonState: {
      seasonId: "season-2",
      schedule: [],
      standings: {},
      newGameFlow: {
        active: true,
        selectedTeamId: "M-M",
        dismissed: false,
        steps: [{ stepId: "season_intro", status: "completed", completedAt: "2026-06-20T00:00:00.000Z" }],
      },
    },
    matchdayState: {
      matchdayId: "season-2-md-1",
      status: "planning",
      pendingTeamIds: [],
      resolvedFixtureIds: [],
    },
    teams: [team()],
    teamIdentities: [],
    players: [player("p-1")],
    disciplines: [],
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

describe("season playability gate", () => {
  it("makes team-power debuffs quiet audit hints", () => {
    const classification = classifySeasonPlayabilityWarning("team_power_debuff:Royal Court -12 (4%)");
    expect(classification.severity).toBe("audit_hint");
    expect(classification.quiet).toBe(true);
  });

  it("marks missing class factors as a known data gap", () => {
    const classification = classifySeasonPlayabilityWarning("class_factors_source_missing");
    expect(classification.severity).toBe("known_data_gap");
    expect(classification.label).toContain("Klassenfaktoren");
  });

  it("groups team-prefixed start-rank fallback warnings by their real key", () => {
    const classification = classifySeasonPlayabilityWarning("M-M:start_rank_derived_from_season1_start_budget");
    expect(classification.key).toBe("start_rank_derived_from_season1_start_budget");
    expect(classification.severity).toBe("audit_hint");
  });

  it("keeps missing lineup and missing result warnings as blockers", () => {
    expect(classifySeasonPlayabilityWarning("missing_lineup").severity).toBe("blocker");
    expect(classifySeasonPlayabilityWarning("matchday_results_source_missing").severity).toBe("blocker");
  });

  it("passes with only known data gaps and audit hints", () => {
    const gate = buildSeasonPlayabilityGate({
      gameState: gameState(),
      activeTeamId: "M-M",
      warnings: [
        "class_factors_source_missing",
        "team_power_debuff:Hell Raisers -8 (3%)",
        "ai_audit_team_warnings:{\"ai_captain_unused\":2}",
      ],
    });

    expect(gate.status).toBe("passed");
    expect(gate.blockers).toHaveLength(0);
    expect(gate.auditHints.map((entry) => entry.key)).toContain("team_power_debuff");
    expect(gate.knownDataGaps.map((entry) => entry.key)).toContain("class_factors_source_missing");
  });
});
