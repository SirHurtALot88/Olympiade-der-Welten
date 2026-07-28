import { describe, expect, it } from "vitest";

import {
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
