import { describe, expect, it } from "vitest";

import type { Team, TeamBoardConfidenceRecord, TeamGeneralManagerAssignment, TeamIdentity } from "@/lib/data/olyDataTypes";
import {
  buildTeamGeneralManagerAssignments,
  getTeamGeneralManagerProfile,
} from "@/lib/foundation/team-general-managers";

function createTeam(overrides?: Partial<Team>): Team {
  return {
    teamId: "team-test",
    name: "Test Team",
    shortCode: "TST",
    cash: 100,
    humanControlled: false,
    rosterLimit: 12,
    rosterMinTarget: 10,
    rosterOptTarget: 12,
    ...overrides,
  } as Team;
}

function createIdentity(teamId: string): TeamIdentity {
  return {
    teamId,
    pow: 5,
    spe: 5,
    men: 5,
    soc: 5,
    ambition: 8,
    finances: 5,
    boardConfidence: 5,
    harmony: 5,
    manners: 5,
    popularity: 5,
    cooperation: 5,
    playerMin: 10,
    playerOpt: 12,
  };
}

describe("team general managers board replacement", () => {
  it("assigns a different manager archetype after a board replacement", () => {
    const team = createTeam();
    const identity = createIdentity(team.teamId);
    const previousGmId = "gm-rivalry-hawk-01";
    const previousProfile = getTeamGeneralManagerProfile(previousGmId);
    expect(previousProfile?.archetype).toBe("rivalry_hawk");

    const existing: Record<string, TeamGeneralManagerAssignment> = {
      [team.teamId]: {
        teamId: team.teamId,
        gmId: previousGmId,
        assignedSeasonId: "season-1",
        influencePct: 30,
        source: "auto_generated",
      },
    };
    const boardConfidenceByTeamId: Record<string, TeamBoardConfidenceRecord> = {
      [team.teamId]: {
        teamId: team.teamId,
        value: 1.5,
        pressure: 5,
        label: "critical",
        updatedAt: "2026-06-27T00:00:00.000Z",
      },
    };

    const assignments = buildTeamGeneralManagerAssignments(
      [team],
      "season-2",
      existing,
      [identity],
      boardConfidenceByTeamId,
    );

    const next = assignments[team.teamId];
    expect(next?.source).toBe("board_replacement");
    expect(next?.previousGmId).toBe(previousGmId);

    const nextProfile = getTeamGeneralManagerProfile(next?.gmId);
    expect(nextProfile).not.toBeNull();
    expect(nextProfile?.archetype).not.toBe(previousProfile?.archetype);
  });
});

describe("board replacement dismissal reason matches the actual firing driver", () => {
  function fireAndGetReason(board: TeamBoardConfidenceRecord) {
    const team = createTeam();
    const identity = createIdentity(team.teamId);
    const previousGmId = "gm-rivalry-hawk-01";
    const existing: Record<string, TeamGeneralManagerAssignment> = {
      [team.teamId]: {
        teamId: team.teamId,
        gmId: previousGmId,
        assignedSeasonId: "season-1",
        influencePct: 30,
        source: "auto_generated",
      },
    };
    const assignments = buildTeamGeneralManagerAssignments(
      [team],
      "season-2",
      existing,
      [identity],
      { [team.teamId]: board },
    );
    const next = assignments[team.teamId];
    // Hard-Floor-Werte (unten) erzwingen prob=1.0 → GM wird deterministisch gefeuert.
    expect(next?.source).toBe("board_replacement");
    return next?.dismissalReason ?? null;
  }

  it("derives the reason from perceivedPressure, not raw pressure (high perceived pressure → high_board_pressure)", () => {
    // Roher pressure ist niedrig (3), aber die Wahrnehmungs-Ebene ist im Hard-Floor (>= 9.5).
    // Die Firing-Entscheidung feuert wegen perceivedPressure — der Grund muss dazu passen.
    // Mit der alten roh-pressure-Logik hätte dieser Rauswurf KEINEN Grund geliefert (Mismatch).
    const reason = fireAndGetReason({
      teamId: "team-test",
      value: 5.0,
      pressure: 3,
      perceivedPressure: 9.6,
      label: "critical",
      updatedAt: "2026-06-27T00:00:00.000Z",
    });
    expect(reason).toBe("high_board_pressure");
  });

  it("labels a low-confidence firing as low_board_confidence", () => {
    const reason = fireAndGetReason({
      teamId: "team-test",
      value: 1.8,
      pressure: 3,
      perceivedPressure: 3,
      label: "critical",
      updatedAt: "2026-06-27T00:00:00.000Z",
    });
    expect(reason).toBe("low_board_confidence");
  });
});
