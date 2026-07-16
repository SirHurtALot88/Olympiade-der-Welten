import { describe, expect, it } from "vitest";

import {
  buildArenaPlayerRankLookup,
  buildArenaTeamRankMap,
  buildMatchdayArenaScoreboardView,
  buildArenaScoreTrackSegments,
  countArenaMutatorHitsByTeam,
  formatArenaMutatorSelectionLabel,
  formatArenaRankDelta,
  getArenaStepRankDelta,
  getMatchdayArenaPhaseDelta,
  getMatchdayArenaPhaseBreakdown,
  getMatchdayArenaPhaseScore,
  getPreviousArenaRevealStep,
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
    teamPowerStatus: "ready",
    teamPowerLabel: "Rally Cry (+8%)",
    teamPowerModifier: 8.5,
    teamPowerImpact: 8,
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
    teamPowerStatus: "missing_source",
    teamPowerLabel: null,
    teamPowerModifier: null,
    teamPowerImpact: null,
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
    expect(getMatchdayArenaPhaseScore(alpha, "power")).toBe(131.5);
    expect(getMatchdayArenaPhaseScore(alpha, "final")).toBe(113);

    expect(getMatchdayArenaPhaseScore(beta, "form")).toBe(92);
    expect(getMatchdayArenaPhaseDelta(beta, "form")).toBeNull();
    expect(getMatchdayArenaPhaseDelta(beta, "mutator")).toBeNull();
    expect(getMatchdayArenaPhaseDelta(beta, "captain")).toBeNull();
  });

  it("computes step rank deltas and player rank snapshots for reveal steps", () => {
    const [alpha, beta] = buildMatchdayArenaScoreboardView(rows);
    const slotScoresAtCount = (count: number) =>
      count <= 1
        ? new Map([
            ["A-A", 40],
            ["B-B", 50],
          ])
        : new Map([
            ["A-A", 100],
            ["B-B", 96],
          ]);

    const slotOneRanks = buildArenaTeamRankMap(
      [alpha, beta],
      { phaseId: "slots", revealedSlotCount: 1 },
      slotScoresAtCount,
    );
    const slotFullRanks = buildArenaTeamRankMap(
      [alpha, beta],
      { phaseId: "slots", revealedSlotCount: 4 },
      slotScoresAtCount,
    );

    expect(slotOneRanks.get("B-B")).toBe(1);
    expect(slotFullRanks.get("A-A")).toBe(1);
    expect(getArenaStepRankDelta(slotFullRanks.get("A-A"), slotOneRanks.get("A-A"))).toBe(1);
    expect(formatArenaRankDelta(2)).toBe("+2");
    expect(getPreviousArenaRevealStep({ phaseId: "push", revealedSlotCount: 4 }, 4)).toEqual({
      phaseId: "slots",
      revealedSlotCount: 4,
    });

    const lookup = buildArenaPlayerRankLookup({
      candidates: [
        { playerId: "p1", teamId: "A-A", slotIndex: 0, baseScore: 40, mutatorBonus: 4 },
        { playerId: "p2", teamId: "B-B", slotIndex: 0, baseScore: 36, mutatorBonus: 0 },
        { playerId: "p3", teamId: "A-A", slotIndex: 1, baseScore: 30, mutatorBonus: 2 },
      ],
      formModifierByTeamId: new Map([
        ["A-A", 3],
        ["B-B", 0],
      ]),
      includeFormBonus: true,
      includeMutatorBonus: true,
    });

    expect(lookup.get("p1::0")).toEqual({
      rankInSlotBase: 1,
      rankTotalBase: 1,
      rankInSlotBoosted: 1,
      rankTotalBoosted: 1,
    });
    expect(lookup.get("p2::0")?.rankInSlotBase).toBe(2);
    expect(lookup.get("p3::1")?.rankInSlotBase).toBe(1);
  });

  it("formats mutator selection labels and builds score track segments by reveal phase", () => {
    const [alpha, beta] = buildMatchdayArenaScoreboardView(rows);

    expect(formatArenaMutatorSelectionLabel(alpha)).toBe("Mut 1 · Mut 2");
    expect(formatArenaMutatorSelectionLabel(beta)).toBeNull();

    expect(buildArenaScoreTrackSegments(alpha, "slots", { slotsScore: 42 })).toEqual([
      expect.objectContaining({ id: "slots", value: 42, tone: "positive" }),
    ]);

    const mutatorSegments = buildArenaScoreTrackSegments(alpha, "mutator", { slotsScore: 100 });
    expect(mutatorSegments.map((segment) => segment.id)).toEqual(["slots", "push", "form", "mutator"]);
    expect(mutatorSegments.find((segment) => segment.id === "mutator")?.value).toBe(12);

    const powerSegments = buildArenaScoreTrackSegments(alpha, "power", { slotsScore: 100 });
    expect(powerSegments.map((segment) => segment.id)).toEqual(["slots", "push", "form", "mutator", "captain", "power"]);
    expect(powerSegments.find((segment) => segment.id === "power")?.value).toBe(8.5);

    const breakdown = getMatchdayArenaPhaseBreakdown(alpha, "mutator", { mutatorHitCount: 3 });
    expect(breakdown.find((item) => item.id === "mutator")?.valueLabel).toContain("Mut 1 · Mut 2");
    expect(breakdown.find((item) => item.id === "mutator")?.valueLabel).toContain("3 Treffer");
    expect(getMatchdayArenaPhaseBreakdown(alpha, "power")[5]?.id).toBe("power");
  });

  it("counts mutator hits per team for the active discipline side", () => {
    const hits = countArenaMutatorHitsByTeam(
      [
        {
          teamId: "A-A",
          entries: [
            { disciplineSide: "d1", slotIndex: 0, mutatorBonus: 4 },
            { disciplineSide: "d1", slotIndex: 1, mutatorBonus: 0 },
            { disciplineSide: "d2", slotIndex: 0, mutatorBonus: 8 },
          ],
        },
        {
          teamId: "B-B",
          entries: [
            { disciplineSide: "d1", slotIndex: 0, mutatorBonus: 0 },
            { disciplineSide: "d1", slotIndex: 1, mutatorBonus: 2 },
          ],
        },
      ],
      "d1",
      2,
    );

    expect(hits.get("A-A")).toEqual({ hits: 1, players: 2 });
    expect(hits.get("B-B")).toEqual({ hits: 1, players: 2 });
  });
});
