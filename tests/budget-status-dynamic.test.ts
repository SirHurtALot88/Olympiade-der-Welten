import { describe, expect, it } from "vitest";

import { getBudgetStatus, resolveBudgetReference } from "@/lib/ai/ai-transfermarkt-preview-service";
import type { Team } from "@/lib/data/olyDataTypes";

function buildTeam(overrides: Partial<Team> = {}): Team {
  return {
    teamId: "team-a",
    name: "Team A",
    shortCode: "T-A",
    cash: 40,
    budget: 200,
    humanControlled: false,
    rosterLimit: 14,
    ...overrides,
  } as Team;
}

describe("dynamic budget status", () => {
  it("ignores stale season-1 budget when most cash was spent", () => {
    const team = buildTeam({ cash: 40, budget: 200 });
    expect(getBudgetStatus(team)).toBe("healthy");
    expect(resolveBudgetReference({ team })).toBe(40);
  });

  it("flags teams when cash is low relative to salary runway", () => {
    const team = buildTeam({ cash: 10, budget: 200 });
    expect(getBudgetStatus(team, { salaryTotal: 20 })).toBe("critical");
  });
});
