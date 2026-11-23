import { describe, expect, it } from "vitest";

import playerStats from "@/data/generated/oly-player-stats.json";
import gmAussehenDaten from "@/data/gm-aussehen.json";
import type { Team, TeamGeneralManagerAssignment, TeamIdentity } from "@/lib/data/olyDataTypes";
import {
  buildTeamGeneralManagerAssignments,
  TEAM_GENERAL_MANAGER_PROFILES,
} from "@/lib/foundation/team-general-managers";

function team(index: number, humanControlled = false): Team {
  return {
    teamId: `team-${index}`,
    name: `Team ${index}`,
    shortCode: `T${index}`,
    cash: 100,
    humanControlled,
    rosterLimit: 12,
    rosterMinTarget: 10,
    rosterOptTarget: 12,
  } as Team;
}

function identity(teamId: string): TeamIdentity {
  return {
    teamId, pow: 5, spe: 5, men: 5, soc: 5, ambition: 5, finances: 5, boardConfidence: 5, harmony: 5,
    manners: 5, popularity: 5, cooperation: 5, playerMin: 10, playerOpt: 12,
  };
}

function alleGmIds(assignments: Record<string, TeamGeneralManagerAssignment>) {
  return Object.values(assignments).map((a) => a.gmId);
}

describe("GM-Einzigartigkeit (Chris 22.11.)", () => {
  it("alle 100 GM-Namen und Vornamen sind eindeutig, ohne Archetyp-Suffix", () => {
    expect(TEAM_GENERAL_MANAGER_PROFILES).toHaveLength(100);
    const namen = TEAM_GENERAL_MANAGER_PROFILES.map((p) => p.name);
    expect(new Set(namen).size).toBe(100);
    expect(new Set(namen.map((n) => n.split(" ")[0])).size).toBe(100);
    for (const p of TEAM_GENERAL_MANAGER_PROFILES) {
      expect(p.name.toLowerCase().includes(p.archetype.replace("_", " ")), p.name).toBe(false);
    }
  });

  it("nutzt die Rassennamen des Spiels, keine Übersetzungen", () => {
    const spielRassen = new Set<string>();
    const sammle = (o: unknown) => {
      if (Array.isArray(o)) o.forEach(sammle);
      else if (o && typeof o === "object") {
        for (const [k, v] of Object.entries(o)) {
          if (k === "race" && typeof v === "string") spielRassen.add(v);
          else sammle(v);
        }
      }
    };
    sammle(playerStats);
    for (const a of Object.values(gmAussehenDaten.gms)) {
      expect(spielRassen.has(a.rasse), a.rasse).toBe(true);
      expect(a).not.toHaveProperty("rasseDe");
    }
  });

  it("vergibt über viele Saaten und 32 bis 40 Teams nie denselben GM zweimal", () => {
    for (const anzahl of [32, 40]) {
      for (let saat = 0; saat < 40; saat += 1) {
        const teams = Array.from({ length: anzahl }, (_, i) => team(i, i === 0 || i === 1));
        const identities = teams.map((t) => identity(t.teamId));
        const assignments = buildTeamGeneralManagerAssignments(
          teams, `season-${saat}`, null, identities, null, null, `salt-${saat}`,
          { "team-0": { ownerId: "user_local" }, "team-1": { ownerId: "franky_local" } } as never,
        );
        const ids = alleGmIds(assignments);
        expect(ids).toHaveLength(anzahl);
        expect(new Set(ids).size).toBe(anzahl);
      }
    }
  });

  it("bleibt über Saisonwechsel und Board-Ersetzungen eindeutig", () => {
    const teams = Array.from({ length: 32 }, (_, i) => team(i));
    const identities = teams.map((t) => identity(t.teamId));
    let bestehend: Record<string, TeamGeneralManagerAssignment> | null = null;
    const board = Object.fromEntries(
      teams.map((t) => [t.teamId, { teamId: t.teamId, confidence: 1, pressure: 9 }]),
    ) as never;
    for (let saison = 1; saison <= 8; saison += 1) {
      bestehend = buildTeamGeneralManagerAssignments(teams, `season-${saison}`, bestehend, identities, board, null, "s");
      const ids = alleGmIds(bestehend);
      expect(new Set(ids).size, `Saison ${saison}`).toBe(32);
    }
  });

  it("löst eine doppelte Zuweisung im Altstand deterministisch auf, bevorzugt gleicher Archetyp", () => {
    const teams = Array.from({ length: 6 }, (_, i) => team(i));
    const identities = teams.map((t) => identity(t.teamId));
    const bestehend: Record<string, TeamGeneralManagerAssignment> = Object.fromEntries(
      teams.map((t) => [
        t.teamId,
        { teamId: t.teamId, gmId: "gm-rivalry-hawk-03", assignedSeasonId: "season-1", influencePct: 30, source: "auto_generated" as const },
      ]),
    );
    const a = buildTeamGeneralManagerAssignments(teams, "season-1", bestehend, identities);
    const b = buildTeamGeneralManagerAssignments(teams, "season-1", bestehend, identities);
    expect(a).toEqual(b);
    const ids = alleGmIds(a);
    expect(new Set(ids).size).toBe(6);
    expect(a["team-0"].gmId).toBe("gm-rivalry-hawk-03");
    for (const t of teams.slice(1)) {
      expect(a[t.teamId].gmId).toMatch(/^gm-rivalry-hawk-/);
      expect(a[t.teamId].previousGmId).toBe("gm-rivalry-hawk-03");
    }
  });
});
