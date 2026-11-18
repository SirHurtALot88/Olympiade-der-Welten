import { describe, expect, it } from "vitest";

import { getMatchdayMedalObjective, getSportTarget, getSportTargetV2 } from "@/lib/board/team-season-objectives-service";
import type { GameState, Team } from "@/lib/data/olyDataTypes";
import type { TeamManagementSnapshotRow } from "@/lib/foundation/team-management-overview";
import { rangAnzahlAnteilig, rangRaumDesTeams, rangSchwelleOben, rangSchwelleUnten } from "@/lib/season/rang-schwelle";

describe("rang-schwelle: Hilfsfunktionen", () => {
  it("bei 32 Teams bit-identisch", () => {
    for (let n = 1; n <= 32; n++) {
      expect(rangSchwelleOben(n, 32)).toBe(n);
      expect(rangSchwelleUnten(n, 32)).toBe(n);
      expect(rangAnzahlAnteilig(n, 32)).toBe(n);
    }
  });
  it("bei 16 Teams anteilig", () => {
    expect([29, 25, 21, 17, 13, 22, 24, 28].map((n) => rangSchwelleUnten(n, 16))).toEqual([15, 13, 11, 9, 7, 11, 12, 14]);
    expect([3, 5, 6, 8, 10, 12, 20, 24].map((n) => rangSchwelleOben(n, 16))).toEqual([2, 3, 3, 4, 5, 6, 10, 12]);
  });
  it("Rangraum: Liga-Teamzahl mit Split, sonst 32", () => {
    const state = (leagueByTeamId?: Record<string, string>) => ({ seasonState: { leagueByTeamId } }) as unknown as GameState;
    expect(rangRaumDesTeams(state(), "A")).toBe(32);
    expect(rangRaumDesTeams(null, "A")).toBe(32);
    expect(rangRaumDesTeams(state({ A: "liga1", B: "liga1", C: "liga2" }), "A")).toBe(2);
  });
});

function makeTeams(count: number): Team[] {
  return Array.from({ length: count }, (_, i) => ({
    teamId: `T${String(i + 1).padStart(2, "0")}`,
    shortCode: `X${i}`,
    name: `Team ${i + 1}`,
    budget: 100,
    cash: 100,
    identityId: `T${i + 1}`,
    humanControlled: false,
    rosterLimit: 12,
  }));
}

function makeRows(teams: Team[], rankOf: (index: number) => number, strengthOf: (index: number) => number) {
  return new Map(
    teams.map((t, i) => [
      t.teamId,
      {
        teamId: t.teamId,
        rank: rankOf(i),
        rosterCount: 10,
        playerMin: 7,
        playerOpt: 10,
        ppsTotal: strengthOf(i),
        marketValueTotal: strengthOf(i) * 3,
      } as unknown as TeamManagementSnapshotRow,
    ]),
  );
}

function stateFor(teams: Team[], split: boolean) {
  return {
    season: { id: "s", matchdayIds: ["m1", "m2"] },
    seasonState: {
      ...(split ? { leagueByTeamId: Object.fromEntries(teams.map((t, i) => [t.teamId, i < 16 ? "liga1" : "liga2"])) } : {}),
    },
    teams,
  } as unknown as GameState;
}

describe("Vorstandsziele: Sportziel nach Ligagroesse", () => {
  const teams = makeTeams(32);
  const sport = (split: boolean, index: number, rank: number) => {
    const rows = makeRows(teams, (i) => (i === index ? rank : 8), (i) => 200 - i);
    return getSportTarget({
      team: teams[index],
      identity: null,
      profile: null,
      row: rows.get(teams[index].teamId)!,
      rowsByTeamId: rows,
      gameState: stateFor(teams, split),
    });
  };

  it("letzter Platz einer 16er-Liga bekommt das Survival-Ziel (vorher nie)", () => {
    const liga = sport(true, 15, 16);
    expect(liga.label).toBe("Survival: nicht Bottom 3");
    expect(liga.rank).toBe(14);
    expect(sport(false, 15, 16).label).not.toContain("Survival");
  });

  it("32er-Modus unveraendert: Rang 30 -> Survival Top 27", () => {
    expect(sport(false, 29, 30)).toEqual({ rank: 27, label: "Survival: nicht Bottom 5" });
  });

  it("V2: Daempfung unten greift in der 16er-Liga ab Erwartungsrang 11", () => {
    const rows = makeRows(teams, () => 8, (i) => 200 - i);
    const ziel = (split: boolean, index: number) =>
      getSportTargetV2({ identity: null, teamId: teams[index].teamId, rowsByTeamId: rows, ambition01: 1, gameState: stateFor(teams, split) });
    expect(ziel(true, 11).rank).toBe(12 - Math.round(6 * 0.4));
    expect(ziel(true, 7).rank).toBe(8 - 6);
    expect(ziel(false, 11).rank).toBe(12 - 6);
  });

  it("Medaillenziel: Spitzenteam der Liga 2 kommt ins Gate", () => {
    const rows = makeRows(teams, () => 8, (i) => 200 - i);
    const objective = (split: boolean) =>
      getMatchdayMedalObjective({
        gameState: stateFor(teams, split),
        team: teams[16],
        identity: { ambition: 8 } as never,
        profile: null,
        rowsByTeamId: rows,
      });
    expect(objective(true)).not.toBeNull();
    expect(objective(false)).toBeNull();
  });
});
