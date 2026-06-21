import { describe, expect, it } from "vitest";

import {
  buildMatchdayArenaScoreboardView,
  getMatchdayArenaPhaseDelta,
  getMatchdayArenaPhaseScore,
} from "@/lib/season/matchday-arena-presenter";
import type { MatchdayMvpScoreboardRow } from "@/lib/season/matchday-mvp-scoring-service";

const rows: MatchdayMvpScoreboardRow[] = [
  {
    teamId: "A-A",
    teamName: "Alpha",
    baseScore: 100,
    formCardStatus: "ready",
    formCardLabel: "Form",
    formCardModifier: 3,
    mutatorMode: "legacy_selected_traits",
    mutator1Label: "Mut 1",
    mutator1Modifier: 6,
    mutator2Label: "Mut 2",
    mutator2Modifier: 6,
    captainStatus: "mapped",
    captainModifier: 2,
    intensity: "push",
    intensityModifier: 6,
    fatigueStatus: "mapped",
    fatigueModifier: -4,
    teamPpsStatus: "ready",
    teamPpsModifier: 0.3,
    score: 113,
    rank: 2,
    points: 4.4,
    status: "ready",
    autoLineupSource: false,
    warnings: [],
  },
  {
    teamId: "B-B",
    teamName: "Beta",
    baseScore: 96,
    formCardStatus: "missing_source",
    formCardLabel: null,
    formCardModifier: null,
    mutatorMode: "legacy_selected_traits",
    mutator1Label: null,
    mutator1Modifier: null,
    mutator2Label: null,
    mutator2Modifier: null,
    captainStatus: "missing_source",
    captainModifier: null,
    intensity: "conserve",
    intensityModifier: -4,
    fatigueStatus: "mapped",
    fatigueModifier: -2,
    teamPpsStatus: "missing_source",
    teamPpsModifier: null,
    score: 94,
    rank: 1,
    points: 5.0,
    status: "warning",
    autoLineupSource: true,
    warnings: ["source_missing"],
  },
];

describe("matchday arena presenter", () => {
  it("builds phase-aware scoreboard rows with base ranks and deltas", () => {
    const result = buildMatchdayArenaScoreboardView(rows);
    const alpha = result.find((entry) => entry.teamId === "A-A");
    const beta = result.find((entry) => entry.teamId === "B-B");

    expect(alpha?.baseRank).toBe(1);
    expect(alpha?.rankDelta).toBe(-1);
    expect(alpha?.currentScore).toBe(106);
    expect(alpha?.pushScore).toBe(6);
    expect(alpha?.formScore).toBe(3);
    expect(alpha?.totalMutatorScore).toBe(12);
    expect(beta?.baseRank).toBe(2);
    expect(beta?.rankDelta).toBe(1);
  });

  it("computes reveal phase scores from existing score components without fake extras", () => {
    const [alpha, beta] = buildMatchdayArenaScoreboardView(rows);

    expect(getMatchdayArenaPhaseScore(alpha, "slots")).toBe(100);
    expect(getMatchdayArenaPhaseScore(alpha, "push")).toBe(106);
    expect(getMatchdayArenaPhaseDelta(alpha, "push")).toBe(6);
    expect(getMatchdayArenaPhaseScore(alpha, "form")).toBe(109);
    expect(getMatchdayArenaPhaseScore(alpha, "mutator")).toBe(121);
    expect(getMatchdayArenaPhaseScore(alpha, "captain")).toBe(123);
    expect(getMatchdayArenaPhaseScore(alpha, "final")).toBe(113);

    expect(getMatchdayArenaPhaseScore(beta, "form")).toBe(92);
    expect(getMatchdayArenaPhaseDelta(beta, "form")).toBeNull();
    expect(getMatchdayArenaPhaseDelta(beta, "mutator")).toBeNull();
    expect(getMatchdayArenaPhaseDelta(beta, "captain")).toBeNull();
  });
});
