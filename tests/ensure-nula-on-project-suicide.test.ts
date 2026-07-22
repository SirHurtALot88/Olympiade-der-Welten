import { describe, expect, it } from "vitest";

import { ensureNulaOnProjectSuicide } from "@/lib/foundation/ensure-nula-on-project-suicide";

const base = () =>
  ({
    teams: [
      { teamId: "P-S", cash: 100 },
      { teamId: "A-A", cash: 50 },
    ],
    players: [{ id: "player-2311-nula", marketValue: 10, salaryDemand: 2 }],
    rosters: [] as any[],
    season: { id: "season-1" },
  }) as any;

const nulaEntry = (gs: any) => gs.rosters.filter((r: any) => r.playerId === "player-2311-nula");
const cashOf = (gs: any, teamId: string) => gs.teams.find((t: any) => t.teamId === teamId).cash;

describe("ensureNulaOnProjectSuicide", () => {
  it("buys Nula onto P-S with the maximum contract when she is a free agent (P-S pays the price)", () => {
    const gs = ensureNulaOnProjectSuicide(base());
    const entries = nulaEntry(gs);
    expect(entries).toHaveLength(1);
    expect(entries[0].teamId).toBe("P-S");
    expect(entries[0].contractLength).toBe(5);
    expect(entries[0].purchasePrice).toBe(10);
    expect(entries[0].salary).toBe(2);
    // P-S paid her market value; a free-agent buy leaves the system, so no team is credited.
    expect(cashOf(gs, "P-S")).toBe(90);
    expect(cashOf(gs, "A-A")).toBe(50);
  });

  it("transfers Nula from another team onto P-S (P-S pays, selling team is credited)", () => {
    const g = base();
    g.rosters = [
      { id: "r1", teamId: "A-A", playerId: "player-2311-nula", contractLength: 2, salary: 2, upkeep: 0, roleTag: "starter", joinedSeasonId: "season-1" },
    ];
    const gs = ensureNulaOnProjectSuicide(g);
    const entries = nulaEntry(gs);
    expect(entries).toHaveLength(1);
    expect(entries[0].teamId).toBe("P-S");
    expect(entries[0].contractLength).toBe(5);
    // Team-to-team transfer is balance-neutral: P-S −10, A-A +10.
    expect(cashOf(gs, "P-S")).toBe(90);
    expect(cashOf(gs, "A-A")).toBe(60);
  });

  it("tops up an existing P-S contract to max without charging again, then is a no-op (idempotent)", () => {
    const g = base();
    g.rosters = [
      { id: "r1", teamId: "P-S", playerId: "player-2311-nula", contractLength: 2, salary: 2, upkeep: 0, roleTag: "bench", joinedSeasonId: "season-1" },
    ];
    const gs1 = ensureNulaOnProjectSuicide(g);
    expect(nulaEntry(gs1)[0].contractLength).toBe(5);
    // Pure contract renewal — she is already owned, so no purchase is charged.
    expect(cashOf(gs1, "P-S")).toBe(100);
    const gs2 = ensureNulaOnProjectSuicide(gs1);
    expect(gs2).toBe(gs1); // already correct → unchanged reference
  });

  it("is a no-op when P-S or Nula is absent", () => {
    const noTeam = base();
    noTeam.teams = [{ teamId: "A-A", cash: 50 }];
    expect(ensureNulaOnProjectSuicide(noTeam).rosters).toHaveLength(0);

    const noNula = base();
    noNula.players = [];
    expect(ensureNulaOnProjectSuicide(noNula).rosters).toHaveLength(0);
  });
});
