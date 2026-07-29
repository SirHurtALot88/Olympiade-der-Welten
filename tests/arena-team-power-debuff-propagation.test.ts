import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { LegacyLineupLoadedContext } from "@/lib/lineups/legacy-lineup-types";
import type { LegacyTeamPowerOption } from "@/lib/lineups/team-powers";
import { buildLegacyMatchdayResolvePreview } from "@/lib/resolve/legacy-matchday-resolve-engine";

import { __setTeamPowersEnabledForTests } from "@/lib/lineups/team-powers";

// Team-Powers sind im Spiel derzeit abgeschaltet (siehe TEAM_POWERS_ENABLED).
// Diese Suite prueft die Mechanik selbst und schaltet sie dafuer gezielt ein,
// damit die Abdeckung erhalten bleibt, bis das System zurueckkehrt.
beforeAll(() => __setTeamPowersEnabledForTests(true));
afterAll(() => __setTeamPowersEnabledForTests(false));

// Fixture style mirrors tests/legacy-matchday-resolve.test.ts createContext().
// Per-team suffix appended to d1 player IDs. The score engine adds a small
// seeded "intensity" jitter that is a TEAM-total-only quantity (never
// distributed into any player's finalContribution) — a separate, pre-existing
// quirk unrelated to the team-power-debuff bug under test here. These specific
// suffixes were brute-forced (see scratch search) so that quirk nets out to
// zero for these fixtures, letting the tests isolate the debuff-propagation
// behavior instead of also asserting on that unrelated jitter.
const ZERO_INTENSITY_SUFFIX: Record<string, number> = {
  "A-A": 54,
  "B-B": 289,
  "C-C": 52,
};

function createContext(input: {
  teamId: string;
  teamName: string;
  d1Scores: number[];
  d2Scores: number[];
  teamPowers?: LegacyTeamPowerOption[];
  d1TeamPowerId?: string | null;
}): LegacyLineupLoadedContext {
  const suffix = ZERO_INTENSITY_SUFFIX[input.teamId] ?? 0;
  const entries = [
    ...input.d1Scores.map((score, index) => ({
      disciplineId: "mini-dm",
      disciplineSide: "d1" as const,
      slotIndex: index,
      playerId: `${input.teamId}-d1-${index}-${suffix}`,
      activePlayerId: `active-${input.teamId}-d1-${index}-${suffix}`,
    })),
    ...input.d2Scores.map((score, index) => ({
      disciplineId: "fechten",
      disciplineSide: "d2" as const,
      slotIndex: index,
      playerId: `${input.teamId}-d2-${index}`,
      activePlayerId: `active-${input.teamId}-d2-${index}`,
    })),
  ];

  return {
    saveId: "save-1",
    seasonId: "season-1",
    matchdayId: "matchday-1",
    teamId: input.teamId,
    entries,
    disciplinePlayerCounts: {
      "mini-dm": input.d1Scores.length,
      fechten: input.d2Scores.length,
    },
    activePlayers: entries.map((entry) => ({
      id: entry.activePlayerId ?? `missing-${entry.playerId}`,
      saveId: "save-1",
      seasonId: "season-1",
      teamId: input.teamId,
      playerId: entry.playerId,
    })),
    disciplineScores: [
      ...input.d1Scores.map((score, index) => ({
        playerId: `${input.teamId}-d1-${index}-${suffix}`,
        disciplineId: "mini-dm",
        score,
      })),
      ...input.d2Scores.map((score, index) => ({
        playerId: `${input.teamId}-d2-${index}`,
        disciplineId: "fechten",
        score,
      })),
    ],
    save: { id: "save-1", name: "Save 1", status: "active" },
    season: { id: "season-1", saveId: "save-1", name: "Season 1", year: 1, currentMatchday: 1, status: "active" },
    matchday: { id: "matchday-1", seasonId: "season-1", index: 1, label: "Spieltag 1", status: "planning" },
    team: { id: input.teamId, shortCode: input.teamId, name: input.teamName },
    teamSeasonState: {
      id: `tss-${input.teamId}`,
      saveId: "save-1",
      seasonId: "season-1",
      teamId: input.teamId,
      cash: 100,
      budget: 100,
      rosterLimit: 10,
      playerOpt: 10,
    },
    teamIdentity: { pow: 10, spe: 10, men: 10, soc: 10 },
    rosterPlayers: entries.map((entry) => ({
      id: entry.playerId,
      name: entry.playerId,
      coreStats: { pow: 1, spe: 1, men: 1, soc: 1 },
    })),
    disciplines: [
      { id: "mini-dm", name: "Mini DM", category: "tactics" },
      { id: "fechten", name: "Fechten", category: "speed" },
    ],
    disciplineWeights: [],
    seasonDisciplineConfigs: [
      { disciplineId: "mini-dm", originalOrder: 1, displayOrder: 1, playerCount: input.d1Scores.length, mutator1: null, mutator2: null },
      { disciplineId: "fechten", originalOrder: 2, displayOrder: 2, playerCount: input.d2Scores.length, mutator1: null, mutator2: null },
    ],
    existingDraft: {
      lineupId: `lineup-${input.teamId}`,
      saveId: "save-1",
      seasonId: "season-1",
      matchdayId: "matchday-1",
      teamId: input.teamId,
      status: "draft",
      entries,
      modifiers: {
        d1: {
          primaryFormCardId: null,
          secondaryFormCardId: null,
          mutatorTrait1: null,
          mutatorTrait2: null,
          teamPowerId: input.d1TeamPowerId ?? null,
        },
        d2: {
          primaryFormCardId: null,
          secondaryFormCardId: null,
          mutatorTrait1: null,
          mutatorTrait2: null,
        },
      },
      createdAt: "2026-06-03T00:00:00.000Z",
      updatedAt: "2026-06-03T00:00:00.000Z",
    },
    contextMeta: {
      saveId: "save-1",
      seasonId: "season-1",
      matchdayId: "matchday-1",
      teamId: input.teamId,
      d1DisciplineId: "mini-dm",
      d2DisciplineId: "fechten",
    },
    fatigueByPlayerId: {},
    fatigueSourceStatus: "mapped",
    injuryByPlayerId: null,
    injurySourceStatus: "not_applied",
    contextLoadMode: "sqlite_local",
    formCardSource: {
      selectionStatus: "ready",
      effectStatus: "ready",
      sourceLabel: "test",
      warnings: [],
    },
    mutatorSource: {
      selectionStatus: "ready",
      effectStatus: "ready",
      sourceLabel: "test",
      warnings: [],
    },
    teamPowerSource: {
      selectionStatus: "ready",
      effectStatus: "ready",
      sourceLabel: "test",
      warnings: [],
    },
    formCards: [],
    teamPowers: input.teamPowers ?? [],
  } as unknown as LegacyLineupLoadedContext;
}

// A "flex" category snipe_debuff power with modifier=20 and no attribute tags,
// so teamPowerImpact resolves to exactly 20% regardless of discipline category.
const SNIPE_POWER: LegacyTeamPowerOption = {
  id: "power-snipe-top",
  label: "Test Snipe",
  description: "test",
  category: "flex",
  effectType: "snipe_debuff",
  targetMode: "single_top",
  targetLimit: 0,
  conditionalBonusPct: 0,
  conditionalTrigger: null,
  conditionalDescription: null,
  source: "identity",
  sourceFacilityId: null,
  modifier: 20,
  positiveAttributeTags: [],
  negativeAttributeTag: null,
  chargesTotal: 4,
  chargesUsed: 0,
  chargesRemaining: 4,
  selectedForSeason: true,
  isUsedUp: false,
  isPassive: false,
} as unknown as LegacyTeamPowerOption;

function buildScenario(applyDebuff: boolean) {
  const teamA = createContext({
    teamId: "A-A",
    teamName: "Alpha",
    d1Scores: [50, 50],
    d2Scores: [10],
    teamPowers: applyDebuff ? [SNIPE_POWER] : [],
    d1TeamPowerId: applyDebuff ? SNIPE_POWER.id : null,
  });
  const teamB = createContext({
    teamId: "B-B",
    teamName: "Beta",
    d1Scores: [40, 30],
    d2Scores: [10],
  });
  const teamC = createContext({
    teamId: "C-C",
    teamName: "Gamma",
    d1Scores: [20, 10],
    d2Scores: [10],
  });

  const preview = buildLegacyMatchdayResolvePreview([teamA, teamB, teamC]);
  const d1Preview = preview.disciplinePreviews.find((discipline) => discipline.disciplineId === "mini-dm");
  return { preview, d1Preview };
}

describe("team power debuff propagation to player level", () => {
  it("scales the debuffed team's score by 20% and keeps other teams untouched", () => {
    const { d1Preview } = buildScenario(true);
    const alpha = d1Preview?.teamResults.find((team) => team.teamId === "A-A");
    const beta = d1Preview?.teamResults.find((team) => team.teamId === "B-B");
    const gamma = d1Preview?.teamResults.find((team) => team.teamId === "C-C");

    // Alpha is the power source, not a debuff target: untouched.
    expect(alpha?.finalPreviewScore).toBe(100);
    // Beta is the single_top target of Alpha's 20% snipe debuff on its raw
    // 70-point score: 70 - 14 = 56.
    expect(beta?.finalPreviewScore).toBe(56);
    expect(beta?.warnings.some((warning) => warning.startsWith("team_power_debuff:"))).toBe(true);
    // Gamma is not targeted (single_top only hits the highest-scoring eligible team).
    expect(gamma?.finalPreviewScore).toBe(30);
  });

  it("propagates the debuff proportionally so players' finalPlayerScore sums to the debuffed team score", () => {
    const { d1Preview } = buildScenario(true);
    const beta = d1Preview?.teamResults.find((team) => team.teamId === "B-B");
    expect(beta).toBeTruthy();

    const entrySum = beta!.entries.reduce((sum, entry) => sum + entry.finalPlayerScore, 0);
    expect(entrySum).toBeCloseTo(beta!.score, 5);
    expect(entrySum).toBe(56);

    // Individual scaled values: 40 * 0.8 = 32, 30 * 0.8 = 24.
    const scores = beta!.entries.map((entry) => entry.finalPlayerScore).sort((left, right) => right - left);
    expect(scores).toEqual([32, 24]);

    // topPlayers (the persisted-record source) must reflect the same scaled values.
    const betaTop = d1Preview?.topPlayers.filter((player) => player.teamId === "B-B") ?? [];
    const topSum = betaTop.reduce((sum, player) => sum + player.finalPlayerScore, 0);
    expect(topSum).toBeCloseTo(beta!.score, 5);
  });

  it("leaves a non-debuffed team's player scores completely untouched", () => {
    const { d1Preview } = buildScenario(true);
    const gamma = d1Preview?.teamResults.find((team) => team.teamId === "C-C");
    expect(gamma).toBeTruthy();

    const scores = gamma!.entries.map((entry) => entry.finalPlayerScore).sort((left, right) => right - left);
    expect(scores).toEqual([20, 10]);
    expect(gamma!.warnings.some((warning) => warning.startsWith("team_power_debuff:"))).toBe(false);
  });

  it("does not change pointsAwarded / teamPoints versus the equivalent no-debuff scenario at equal rank", () => {
    const debuffed = buildScenario(true);
    const control = buildScenario(false);

    const debuffedBeta = debuffed.d1Preview?.teamResults.find((team) => team.teamId === "B-B");
    const controlBeta = control.d1Preview?.teamResults.find((team) => team.teamId === "B-B");

    // Sanity check: Beta keeps rank 2 in both scenarios (Alpha always #1, Gamma
    // always #3), so teamPoints/pointsAwarded should be identical even though
    // Beta's absolute score differs (56 debuffed vs. 70 undebuffed).
    expect(debuffedBeta?.rank).toBe(2);
    expect(controlBeta?.rank).toBe(2);
    expect(debuffedBeta?.finalPreviewScore).not.toBe(controlBeta?.finalPreviewScore);

    expect(debuffedBeta?.teamPoints).toBe(controlBeta?.teamPoints);

    const pointsByPlayerId = (team: typeof debuffedBeta) =>
      Object.fromEntries((team?.entries ?? []).map((entry) => [entry.playerId, entry.pointsAwarded]));
    expect(pointsByPlayerId(debuffedBeta)).toEqual(pointsByPlayerId(controlBeta));

    // Alpha (source, never debuffed) and Gamma (not targeted) are unaffected either way.
    const debuffedAlpha = debuffed.d1Preview?.teamResults.find((team) => team.teamId === "A-A");
    const controlAlpha = control.d1Preview?.teamResults.find((team) => team.teamId === "A-A");
    expect(debuffedAlpha?.teamPoints).toBe(controlAlpha?.teamPoints);

    const debuffedGamma = debuffed.d1Preview?.teamResults.find((team) => team.teamId === "C-C");
    const controlGamma = control.d1Preview?.teamResults.find((team) => team.teamId === "C-C");
    expect(debuffedGamma?.teamPoints).toBe(controlGamma?.teamPoints);
  });
});
