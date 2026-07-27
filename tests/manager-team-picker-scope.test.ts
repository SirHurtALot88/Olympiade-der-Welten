import path from "node:path";
import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

import type { Team } from "@/lib/data/olyDataTypes";
import { buildTeamControlSettingsMap, filterTeamsByControlScope } from "@/lib/foundation/team-control-settings";

function makeTeam(teamId: string, humanControlled: boolean): Team {
  return {
    teamId,
    shortCode: teamId,
    name: `${teamId} Team`,
    budget: 100,
    cash: 100,
    identityId: teamId,
    humanControlled,
    rosterLimit: 12,
    logoPath: null,
  };
}

/**
 * Der Team-Picker (`managerTeamOptions`) muss ALLE Ligateams anbieten, damit man
 * sich auch die Einsatzliste fremder Teams ansehen kann.
 *
 * Regression: dort lief `filterTeamsByControlScope(..., teamContextFilter, ...)`.
 * Der Filter steht per Default auf "my_teams" und wird bei jedem Load erneut
 * persistiert — eine Bedienung zum Umschalten gibt es aber nicht mehr
 * (`teamContextFilter`/`setTeamContextFilter` sind in FoundationShellRouterBody
 * nur noch ungenutzte Props). Damit war das aktive Team dauerhaft auf die eigenen
 * Teams eingesperrt.
 */
describe("manager team picker scope", () => {
  it("no longer narrows the picker with the (unreachable) control-scope filter", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "lib/foundation/tabs/use-foundation-cross-tab-team-control.ts"),
      "utf8",
    );
    const rawBlock = source.slice(
      source.indexOf("const managerTeamOptions = useMemo("),
      source.indexOf("const localUserManualTeams = useMemo("),
    );
    // Kommentarzeilen raus — der Block ERKLAERT die entfernte Filterung und
    // nennt sie dabei namentlich; geprueft wird der ausgefuehrte Code.
    const pickerBlock = rawBlock
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n");

    expect(pickerBlock.length).toBeGreaterThan(0);
    // Der Picker darf weder den Scope-Filter noch den (toten) Filterwert benutzen.
    expect(pickerBlock).not.toContain("filterTeamsByControlScope");
    expect(pickerBlock).not.toContain("teamContextFilter");
    // Basis sind die Teams des Spielstands.
    expect(pickerBlock).toContain("input.gameState.teams");
  });

  it("keeps the owner-scope filter available for the places that really are owner-scoped", async () => {
    // Der Filter selbst bleibt korrekt und wird weiterhin für Owner-Listen genutzt —
    // entfernt wurde nur seine Anwendung auf den Picker.
    const teams = [makeTeam("C-C", true), makeTeam("M-M", false), makeTeam("D-P", false)];
    const settings = buildTeamControlSettingsMap(teams, {});

    expect(filterTeamsByControlScope(teams, settings, "all").map((team) => team.teamId)).toEqual([
      "C-C",
      "M-M",
      "D-P",
    ]);
    expect(filterTeamsByControlScope(teams, settings, "human").length).toBeLessThanOrEqual(teams.length);
  });

  it("still gates write access per team, independent of picker visibility", async () => {
    // Sichtbarkeit im Picker != Verwaltungsrecht. Das haengt weiter an
    // canOwnerManageTeam/canManageTeamId, nicht an der Liste.
    const source = await fs.readFile(
      path.join(process.cwd(), "lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx"),
      "utf8",
    );
    expect(source).toContain("selectedTeamCanManage");
    expect(source).toContain("canOwnerManageTeam");
    expect(source).toContain("function canManageTeamId");
  });
});
