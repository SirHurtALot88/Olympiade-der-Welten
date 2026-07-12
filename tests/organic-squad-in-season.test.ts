import { describe, expect, it } from "vitest";

import { planOrganicSellsForTeam } from "@/lib/ai/organic-squad/draft-adapter";
import { ROSTER_MIN } from "@/lib/ai/organic-squad/types";
import type { GameState, Player, Team, TeamIdentity } from "@/lib/data/olyDataTypes";

// A pow-heavy identity with a low OPT (8) so a roster of 9+ is already "over OPT". Finances low so the
// value-tilt (wThrift) is meaningful — an attractive sale value reads as sellable.
const IDENTITY = {
  ambition: 55,
  finances: 45,
  boardConfidence: 55,
  harmony: 50,
  playerOpt: ROSTER_MIN, // 8
  pow: 70,
  spe: 12,
  men: 12,
  soc: 12,
} as unknown as TeamIdentity;

const DISCIPLINES = [
  { id: "tdm", category: "power" },
  { id: "staffel", category: "speed" },
  { id: "tennis", category: "mental" },
  { id: "showcase", category: "social" },
];

function makeGameState(): GameState {
  // Minimal shape the pure planner reads: disciplines + a seasonState (for the optional GM lookup).
  // teamId "team-test" is not a themed team, so the theme runtime context resolves to null (no roster
  // scan needed) — keeping this fixture free of theme wiring.
  return {
    disciplines: DISCIPLINES,
    seasonState: {},
  } as unknown as GameState;
}

const TEAM = {
  teamId: "team-test",
  name: "Test FC",
  cash: 100,
  rosterLimit: 14,
} as unknown as Team;

function player(
  id: string,
  disciplineId: string,
  opts: { pow?: number; spe?: number; rating: number; mv: number; salary?: number },
): Player {
  return {
    id,
    coreStats: { pow: opts.pow ?? 75, spe: opts.spe ?? 50, men: 50, soc: 50 },
    disciplineRatings: { [disciplineId]: opts.rating },
    marketValue: opts.mv,
    salaryDemand: opts.salary ?? 8,
    potential: 0,
  } as unknown as Player;
}

function planSells(roster: Player[]) {
  return planOrganicSellsForTeam({
    gameState: makeGameState(),
    team: TEAM,
    identity: IDENTITY,
    roster,
  });
}

describe("planOrganicSellsForTeam — organic in-season sells", () => {
  it("over-OPT team sells a surplus player from an already-covered discipline", () => {
    // 9 solide bodies stacked in the SAME power discipline (tdm) — deeply covered — plus one clearly
    // surplus body with the most attractive sale value. Roster (10) is above OPT (8).
    const roster: Player[] = [];
    for (let i = 0; i < 9; i += 1) {
      roster.push(player(`tdm-${i}`, "tdm", { pow: 78, rating: 82, mv: 24 }));
    }
    const surplus = player("surplus", "tdm", { pow: 76, rating: 82, mv: 60 });
    roster.push(surplus);

    const result = planSells(roster);

    expect(result.decisions.length).toBeGreaterThan(0);
    // The high-sale-value body in the saturated discipline is the first (best) sell.
    expect(result.decisions[0]?.playerId).toBe("surplus");
    expect(result.decisions.map((d) => d.playerId)).toContain("surplus");
    // The hard floor is respected.
    expect(result.finalRosterSize).toBeGreaterThanOrEqual(ROSTER_MIN);
  });

  it("a team already at ROSTER_MIN sells nothing (min is a hard floor)", () => {
    const roster: Player[] = [];
    for (let i = 0; i < ROSTER_MIN; i += 1) {
      roster.push(player(`tdm-${i}`, "tdm", { pow: 78, rating: 82, mv: 40 }));
    }
    expect(roster.length).toBe(ROSTER_MIN);

    const result = planSells(roster);

    expect(result.decisions).toHaveLength(0);
    expect(result.finalRosterSize).toBe(ROSTER_MIN);
  });

  it("a key starter (high strength loss, uncovered need) is kept, not sold", () => {
    // 11 interchangeable bodies stacked in a saturated power discipline (cheap to shed) + one elite
    // all-rounder who is the SOLE cover of a needed discipline (staffel) and carries a low sale value.
    // The greedy loop sheds the fillers down to OPT/min and never touches the key player.
    const roster: Player[] = [];
    for (let i = 0; i < 11; i += 1) {
      roster.push(player(`tdm-${i}`, "tdm", { pow: 75, rating: 82, mv: 30 }));
    }
    const key = player("key", "staffel", { pow: 95, spe: 95, rating: 95, mv: 5 });
    roster.push(key);

    const result = planSells(roster);

    expect(result.decisions.length).toBeGreaterThan(0);
    expect(result.decisions.map((d) => d.playerId)).not.toContain("key");
    expect(result.finalRosterSize).toBeGreaterThanOrEqual(ROSTER_MIN);
  });
});
