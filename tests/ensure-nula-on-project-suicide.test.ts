import { describe, expect, it } from "vitest";

import { ensureNulaOnProjectSuicide } from "@/lib/foundation/ensure-nula-on-project-suicide";

const base = () =>
  ({
    teams: [{ teamId: "P-S" }, { teamId: "A-A" }],
    players: [{ id: "player-2311-nula", marketValue: 10, salaryDemand: 2 }],
    rosters: [] as any[],
    season: { id: "season-1" },
  }) as any;

const nulaEntry = (gs: any) => gs.rosters.filter((r: any) => r.playerId === "player-2311-nula");

describe("ensureNulaOnProjectSuicide", () => {
  it("adds Nula to P-S with the maximum contract when she is a free agent", () => {
    const gs = ensureNulaOnProjectSuicide(base());
    const entries = nulaEntry(gs);
    expect(entries).toHaveLength(1);
    expect(entries[0].teamId).toBe("P-S");
    expect(entries[0].contractLength).toBe(5);
  });

  it("moves Nula from another team onto P-S (single entry, max contract)", () => {
    const g = base();
    g.rosters = [
      { id: "r1", teamId: "A-A", playerId: "player-2311-nula", contractLength: 2, salary: 2, upkeep: 0, roleTag: "starter", joinedSeasonId: "season-1" },
    ];
    const gs = ensureNulaOnProjectSuicide(g);
    const entries = nulaEntry(gs);
    expect(entries).toHaveLength(1);
    expect(entries[0].teamId).toBe("P-S");
    expect(entries[0].contractLength).toBe(5);
  });

  it("tops up an existing P-S contract to max, then is a no-op (idempotent)", () => {
    const g = base();
    g.rosters = [
      { id: "r1", teamId: "P-S", playerId: "player-2311-nula", contractLength: 2, salary: 2, upkeep: 0, roleTag: "bench", joinedSeasonId: "season-1" },
    ];
    const gs1 = ensureNulaOnProjectSuicide(g);
    expect(nulaEntry(gs1)[0].contractLength).toBe(5);
    const gs2 = ensureNulaOnProjectSuicide(gs1);
    expect(gs2).toBe(gs1); // already correct → unchanged reference
  });

  it("is a no-op when P-S or Nula is absent", () => {
    const noTeam = base();
    noTeam.teams = [{ teamId: "A-A" }];
    expect(ensureNulaOnProjectSuicide(noTeam).rosters).toHaveLength(0);

    const noNula = base();
    noNula.players = [];
    expect(ensureNulaOnProjectSuicide(noNula).rosters).toHaveLength(0);
  });
});
