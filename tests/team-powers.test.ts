import { describe, expect, it } from "vitest";

import {
  calculateTeamPowerModifierForSide,
  getTeamPowerOptions,
  type LegacyTeamPowerOption,
} from "@/lib/lineups/team-powers";
import type { GameState, TeamPowerRecord, LineupDraft } from "@/lib/data/olyDataTypes";

function createPower(partial?: Partial<LegacyTeamPowerOption>): LegacyTeamPowerOption {
  return {
    id: partial?.id ?? "power-1",
    label: partial?.label ?? "Warpath Power Surge",
    description: partial?.description ?? "Test power",
    category: partial?.category ?? "flex",
    effectType: partial?.effectType ?? "self_boost",
    targetMode: partial?.targetMode ?? "self",
    targetLimit: partial?.targetLimit ?? 0,
    conditionalBonusPct: partial?.conditionalBonusPct ?? 0,
    conditionalTrigger: partial?.conditionalTrigger ?? null,
    conditionalDescription: partial?.conditionalDescription ?? null,
    source: partial?.source ?? "team_identity",
    sourceFacilityId: partial?.sourceFacilityId ?? null,
    modifier: partial?.modifier ?? 6,
    positiveAttributeTags: partial?.positiveAttributeTags ?? ["power", "torment"],
    negativeAttributeTag: partial?.negativeAttributeTag ?? "awareness",
    chargesTotal: partial?.chargesTotal ?? 4,
    chargesUsed: partial?.chargesUsed ?? 0,
    chargesRemaining: partial?.chargesRemaining ?? 4,
    selectedForSeason: partial?.selectedForSeason ?? true,
    isUsedUp: partial?.isUsedUp ?? false,
    isPassive: partial?.isPassive ?? false,
  };
}

describe("team powers", () => {
  it("adds a small attribute-fit bonus when power tags match the discipline weights", () => {
    const result = calculateTeamPowerModifierForSide({
      modifiers: { d1: { teamPowerId: "power-1" }, d2: { teamPowerId: null } },
      disciplineSide: "d1",
      disciplineId: "mini-dm",
      disciplineCategory: "power",
      teamPowers: [createPower()],
    });

    expect(result.teamPowerBasePct).toBe(6);
    expect(result.teamPowerAttributeFitPct).toBe(2);
    expect(result.teamPowerImpact).toBe(8);
    expect(result.teamPowerLabel).toContain("Power/Torment");
  });

  it("applies a small attribute-fit penalty when the friction tag dominates the discipline", () => {
    const result = calculateTeamPowerModifierForSide({
      modifiers: { d1: { teamPowerId: "power-1" }, d2: { teamPowerId: null } },
      disciplineSide: "d1",
      disciplineId: "speed-schach",
      disciplineCategory: "mental",
      teamPowers: [createPower()],
    });

    expect(result.teamPowerBasePct).toBe(6);
    expect(result.teamPowerAttributeFitPct).toBeLessThan(0);
    expect(result.teamPowerImpact).toBeLessThan(6);
  });

  it("treats an explicitly selected passive power as no active power (never double-applied)", () => {
    const result = calculateTeamPowerModifierForSide({
      modifiers: { d1: { teamPowerId: "passive-1" }, d2: { teamPowerId: null } },
      disciplineSide: "d1",
      disciplineId: "mini-dm",
      disciplineCategory: "power",
      teamPowers: [createPower({ id: "passive-1", isPassive: true })],
    });

    expect(result.teamPowerSelected).toBe(0);
    expect(result.teamPowerImpact).toBe(0);
    expect(result.teamPowerLabel).toBeNull();
  });
});

function teamPowerRecord(partial?: Partial<TeamPowerRecord>): TeamPowerRecord {
  return {
    id: partial?.id ?? "tp-1",
    saveId: "save-1",
    seasonId: "season-1",
    teamId: "team-1",
    label: partial?.label ?? "Warpath",
    description: "desc",
    category: "flex",
    effectType: "self_boost",
    targetMode: "self",
    targetLimit: 0,
    source: "team_identity",
    modifier: partial?.modifier ?? 6,
    chargesTotal: partial?.chargesTotal ?? 2,
    selectedForSeason: true,
    createdAt: "c",
    ...partial,
  };
}

function draft(partial: Pick<LineupDraft, "lineupId" | "matchdayId"> & { teamPowerId?: string | null }): LineupDraft {
  return {
    lineupId: partial.lineupId,
    saveId: "save-1",
    seasonId: "season-1",
    matchdayId: partial.matchdayId,
    teamId: "team-1",
    status: "submitted",
    entries: [],
    modifiers: { d1: { teamPowerId: partial.teamPowerId ?? null }, d2: { teamPowerId: null } },
    createdAt: "c",
    updatedAt: "u",
  };
}

function gameStateWith(drafts: LineupDraft[], matchdayId: string): GameState {
  return {
    seasonState: {
      seasonId: "season-1",
      teamPowers: [teamPowerRecord({ id: "tp-1", chargesTotal: 2 })],
      lineupDrafts: drafts,
    },
    matchdayState: { matchdayId },
  } as unknown as GameState;
}

describe("team power charges refresh per matchday", () => {
  it("does not count usage from other matchdays against the current matchday's charges", () => {
    const gameState = gameStateWith(
      [
        // Power used up on matchday-1 (2 sides worth), plus the current matchday-2 draft (unused).
        draft({ lineupId: "l-md1-a", matchdayId: "matchday-1", teamPowerId: "tp-1" }),
        draft({ lineupId: "l-md1-b", matchdayId: "matchday-1", teamPowerId: "tp-1" }),
        draft({ lineupId: "l-md2", matchdayId: "matchday-2", teamPowerId: null }),
      ],
      "matchday-2",
    );

    const options = getTeamPowerOptions({
      gameState,
      seasonId: "season-1",
      teamId: "team-1",
      lineupId: "l-md2",
    });
    const power = options.find((entry) => entry.id === "tp-1");

    expect(power?.chargesUsed).toBe(0);
    expect(power?.chargesRemaining).toBe(2);
    expect(power?.isUsedUp).toBe(false);
  });

  it("still counts usage within the same matchday", () => {
    const gameState = gameStateWith(
      [
        draft({ lineupId: "l-md1-a", matchdayId: "matchday-1", teamPowerId: "tp-1" }),
        draft({ lineupId: "l-md1-b", matchdayId: "matchday-1", teamPowerId: "tp-1" }),
      ],
      "matchday-1",
    );

    // Query from a fresh (excluded) lineup on the same matchday: the two sibling drafts consumed
    // both per-matchday charges.
    const options = getTeamPowerOptions({
      gameState,
      seasonId: "season-1",
      teamId: "team-1",
      lineupId: "l-md1-new",
    });
    const power = options.find((entry) => entry.id === "tp-1");

    expect(power?.chargesUsed).toBe(2);
    expect(power?.chargesRemaining).toBe(0);
    expect(power?.isUsedUp).toBe(true);
  });
});
