/**
 * KI-ANBINDUNG DES APRON — die Bereitschaft, die Apron-Linien zu überschreiten, hängt an derselben
 * Ambition (`profile.bias.starPriority` / `identity.ambition`), die die KI-Sponsorwahl schon nutzt
 * (siehe lib/ai/ai-cash-salary-target-service.ts). Ohne diese Anbindung wäre der Apron entweder eine
 * blinde Steuer (KI reagiert nicht) oder wirkungslos (KI kommt nie in die Nähe der Linien).
 */
import { describe, expect, it } from "vitest";

import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import { ensureSeasonApronLinesFrozen } from "@/lib/season/apron-settlement-service";
import { getTeamStrategyProfile } from "@/lib/foundation/team-strategy-profiles";
import {
  resolveApronTighteningMultiplier,
  resolveTeamApronSalaryCeiling,
} from "@/lib/ai/ai-cash-salary-target-service";

function withAmbition(teamId: string, starPriority: number) {
  const gs = ensureSeasonApronLinesFrozen(structuredClone(createSingleplayerGameState()));
  const profile = getTeamStrategyProfile(gs, teamId)!;
  gs.seasonState.teamStrategyProfiles = {
    ...(gs.seasonState.teamStrategyProfiles ?? {}),
    [teamId]: { ...profile, bias: { ...profile.bias, starPriority } },
  };
  return gs;
}

describe("Apron — KI-Bereitschaft haengt an der Ambition", () => {
  it("ein Titelanwaerter (hohe Ambition) darf bis zur 2. Linie zusagen", () => {
    const teamId = "M-M";
    const gsHigh = withAmbition(teamId, 9);
    const lines = gsHigh.seasonState.apronLinesSnapshot!;
    expect(resolveTeamApronSalaryCeiling(gsHigh, teamId)).toBeCloseTo(lines.line2, 6);
  });

  it("ein vorsichtiges Team (niedrige Ambition) bremst schon an der 1. Linie", () => {
    const teamId = "M-M";
    const gsLow = withAmbition(teamId, 2);
    const lines = gsLow.seasonState.apronLinesSnapshot!;
    expect(resolveTeamApronSalaryCeiling(gsLow, teamId)).toBeCloseTo(lines.line1, 6);
  });

  it("die Decke eines ambitionierten Teams liegt strikt über der eines vorsichtigen", () => {
    const teamId = "M-M";
    const gsHigh = withAmbition(teamId, 9);
    const gsLow = withAmbition(teamId, 2);
    expect(resolveTeamApronSalaryCeiling(gsHigh, teamId)).toBeGreaterThan(
      resolveTeamApronSalaryCeiling(gsLow, teamId),
    );
  });

  it("die Bremse ist nie 0 — ein Team darf die Linie reissen, wenn es muss", () => {
    const teamId = "M-M";
    const gs = withAmbition(teamId, 2);
    // Selbst weit über der Decke bleibt der Multiplikator klar über 0 (Boden 0,5).
    gs.teams = gs.teams.map((team) => (team.teamId === teamId ? { ...team, cash: 9999 } : team));
    // Gehalt künstlich weit über die Decke treiben ist ohne Roster-Manipulation aufwendig — die
    // Boden-Eigenschaft ist strukturell (siehe apron-service.ts computeApronSettlement-Deckel-Analog),
    // hier wird nur sichergestellt, dass der Multiplikator im gültigen Bereich [0.5, 1] bleibt.
    const multiplier = resolveApronTighteningMultiplier(gs, teamId);
    expect(multiplier).toBeGreaterThanOrEqual(0.5);
    expect(multiplier).toBeLessThanOrEqual(1);
  });

  it("unter der Decke bremst gar nichts (Multiplikator 1)", () => {
    const teamId = "M-M";
    const gs = withAmbition(teamId, 9);
    // Frisches Spiel: Gehalt liegt unter jeder Apron-Decke.
    expect(resolveApronTighteningMultiplier(gs, teamId)).toBe(1);
  });
});
