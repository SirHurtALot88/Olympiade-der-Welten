import { describe, expect, it } from "vitest";

import {
  buildMatchdayReadinessTeamsFromState,
  canJumpToArenaAfterLineupSave,
  evaluateMatchdayHumanReadiness,
  type MatchdayReadinessTeam,
} from "@/lib/foundation/matchday-human-readiness";

function team(id: string, controlMode: string, currentMatchdayReady: boolean): MatchdayReadinessTeam {
  return { id, controlMode, currentMatchdayReady };
}

describe("matchday human readiness", () => {
  it("waits for every human team, not just the active one", () => {
    // Chris fertig, Franky noch nicht → im Online-Spiel kein Sprung in die Arena.
    const teams = [
      team("C-C", "manual", true),
      team("M-M", "manual", false),
      team("D-P", "ai", false),
    ];

    const readiness = evaluateMatchdayHumanReadiness(teams);
    expect(readiness.allHumanTeamsReady).toBe(false);
    expect(readiness.pendingTeamIds).toEqual(["M-M"]);
    expect(canJumpToArenaAfterLineupSave({ isOnlineGame: true, activeTeamReady: true, teams })).toBe(false);
  });

  it("lets the jump through once all human teams are ready", () => {
    const teams = [team("C-C", "manual", true), team("M-M", "manual", true), team("D-P", "ai", false)];
    expect(canJumpToArenaAfterLineupSave({ isOnlineGame: true, activeTeamReady: true, teams })).toBe(true);
  });

  it("never blocks on AI or passive teams", () => {
    const teams = [team("C-C", "manual", true), team("D-P", "ai", false), team("R-R", "passive", false)];
    expect(evaluateMatchdayHumanReadiness(teams).allHumanTeamsReady).toBe(true);
    expect(canJumpToArenaAfterLineupSave({ isOnlineGame: true, activeTeamReady: true, teams })).toBe(true);
  });

  it("keeps solo behaviour unchanged — the own team is enough", () => {
    // Solo darf ein zweites manuelles Team (z. B. Multi-Team-Solo) nicht bremsen.
    const teams = [team("C-C", "manual", true), team("M-M", "manual", false)];
    expect(canJumpToArenaAfterLineupSave({ isOnlineGame: false, activeTeamReady: true, teams })).toBe(true);
  });

  it("never jumps while the active team itself is unfinished", () => {
    const teams = [team("C-C", "manual", false), team("M-M", "manual", true)];
    for (const isOnlineGame of [true, false]) {
      expect(canJumpToArenaAfterLineupSave({ isOnlineGame, activeTeamReady: false, teams })).toBe(false);
    }
  });

  it("treats a save without human teams as unblocked", () => {
    expect(evaluateMatchdayHumanReadiness([team("D-P", "ai", false)]).allHumanTeamsReady).toBe(true);
    expect(evaluateMatchdayHumanReadiness([]).humanTeamCount).toBe(0);
    expect(evaluateMatchdayHumanReadiness(null).allHumanTeamsReady).toBe(true);
  });
});

describe("readiness derived from the game state", () => {
  const base = {
    teams: [{ teamId: "C-C" }, { teamId: "M-M" }, { teamId: "D-P" }],
    controlModeByTeamId: {
      "C-C": { controlMode: "manual" },
      "M-M": { controlMode: "manual" },
      "D-P": { controlMode: "ai" },
    },
    seasonId: "season-1",
    matchdayId: "matchday-1",
  };

  function draft(teamId: string, sides: Array<"d1" | "d2">, matchdayId = "matchday-1") {
    return {
      teamId,
      seasonId: "season-1",
      matchdayId,
      entries: sides.map((disciplineSide) => ({ disciplineId: `disc-${disciplineSide}`, disciplineSide })),
    };
  }

  it("counts a team ready only with both discipline sides set", () => {
    const teams = buildMatchdayReadinessTeamsFromState({
      ...base,
      lineupDrafts: [draft("C-C", ["d1", "d2"]), draft("M-M", ["d1"])],
    });

    expect(teams.find((team) => team.id === "C-C")?.currentMatchdayReady).toBe(true);
    // Nur d1 gesetzt → noch nicht fertig (dieselbe Schwelle wie im Arena-Base-Service).
    expect(teams.find((team) => team.id === "M-M")?.currentMatchdayReady).toBe(false);
    expect(evaluateMatchdayHumanReadiness(teams).pendingTeamIds).toEqual(["M-M"]);
  });

  it("ignores drafts from another matchday", () => {
    const teams = buildMatchdayReadinessTeamsFromState({
      ...base,
      lineupDrafts: [draft("C-C", ["d1", "d2"], "matchday-2")],
    });
    expect(teams.find((team) => team.id === "C-C")?.currentMatchdayReady).toBe(false);
  });

  it("blocks the online jump while the co-player is missing, but not solo", () => {
    const teams = buildMatchdayReadinessTeamsFromState({
      ...base,
      lineupDrafts: [draft("C-C", ["d1", "d2"])],
    });

    expect(canJumpToArenaAfterLineupSave({ isOnlineGame: true, activeTeamReady: true, teams })).toBe(false);
    expect(canJumpToArenaAfterLineupSave({ isOnlineGame: false, activeTeamReady: true, teams })).toBe(true);
  });

  it("releases the online jump once both human teams are set", () => {
    const teams = buildMatchdayReadinessTeamsFromState({
      ...base,
      lineupDrafts: [draft("C-C", ["d1", "d2"]), draft("M-M", ["d1", "d2"])],
    });
    expect(canJumpToArenaAfterLineupSave({ isOnlineGame: true, activeTeamReady: true, teams })).toBe(true);
  });
});

describe("wiring", () => {
  it("is actually applied at the lineup-to-arena jump", async () => {
    // Die Regel lag zuerst ungenutzt im Code — das Verhalten war unveraendert.
    // Dieser Test haelt fest, dass die Sprungstelle sie wirklich aufruft.
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const source = await fs.readFile(
      path.join(process.cwd(), "lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx"),
      "utf8",
    );
    const jump = source.slice(source.indexOf('activeView === "lineup" &&'));
    expect(jump).toContain("canJumpToArenaAfterLineupSave({");
    expect(jump).toContain("buildMatchdayReadinessTeamsFromState({");
    expect(jump).toContain('isOnlineGame: activeSaveGameMode === "online_4v4"');
  });
});
