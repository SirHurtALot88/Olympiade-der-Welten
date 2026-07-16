import { describe, expect, it } from "vitest";

import {
  computeDraftThemePickScoreContribution,
  mapDraftPickPhaseToThemePhase,
  teamNeedsThemeReserve,
} from "@/lib/ai/team-theme-composition-service";
import { auditDraftThemeComposition } from "@/lib/season/draft-theme-gate-service";
import type { GameState } from "@/lib/data/olyDataTypes";

describe("draft theme tuning helpers", () => {
  it("maps identity_reserve to core optimum theme phase", () => {
    expect(mapDraftPickPhaseToThemePhase("identity_reserve")).toBe("phase_b_core_optimum");
  });

  it("boosts themed picks during identity_reserve", () => {
    const boost = computeDraftThemePickScoreContribution({
      themeScore: {
        teamId: "C-S",
        playerId: "p-1",
        playerThemeTags: ["Knight"],
        directPrimaryThemeMatch: 24,
        secondaryThemeMatch: 0,
        softPreferredMatch: 0,
        currentRosterBelowMinimumBonus: 18,
        currentRosterBelowTargetBonus: 0,
        outsiderPenalty: 0,
        avoidTagPenalty: 0,
        qualityOverrideBonus: 0,
        scarcityAdjustment: 0,
        themeCompositionScore: 42,
        themeTier: "core_theme",
        exceptionAllowed: true,
        reason: "primary_match",
        identityQuotaRole: "none",
        identityFloorAdjustment: 0.6,
      },
      strictness: "strong",
      pickPhase: "identity_reserve",
    });
    expect(boost).toBeGreaterThan(15);
  });

  it("detects when a hard/strong team still needs theme reserve", () => {
    expect(
      teamNeedsThemeReserve({
        target: {
          teamId: "C-S",
          primaryThemeTags: ["Knight"],
          secondaryThemeTags: [],
          softPreferredTags: [],
          allowedOutsiderTags: [],
          avoidTags: [],
          targetShare: 0.75,
          minimumShare: 0.55,
          strictness: "strong",
          exceptionPolicy: "audit_required",
          qualityOverrideThreshold: 14,
          notes: "",
        },
        rosterShare: {
          rosterPlayers: [],
          primaryCount: 1,
          secondaryCount: 0,
          softCount: 0,
          primaryShare: 0.2,
          combinedShare: 0.2,
        },
        themedPoolCount: 40,
      }),
    ).toBe(true);
  });
});

describe("draft theme gate service", () => {
  it("flags hard teams below theme minimum on reconstructed draft rosters", () => {
    const gameState = {
      teams: [{ teamId: "H-R", name: "Hell Raisers", shortCode: "H-R", cash: 100, rosterLimit: 14 }],
      teamIdentities: [{ teamId: "H-R", playerMin: 8, playerOpt: 12, pow: 50, spe: 50, men: 50, soc: 50 }],
      players: [
        {
          id: "p-off",
          name: "Off Theme",
          className: "Charger",
          race: "Human",
          rating: 60,
          marketValue: 20,
          gender: "m",
          alignment: "neutral",
          subclasses: [],
          traitsPositive: [],
          traitsNegative: [],
          coreStats: { pow: 50, spe: 50, men: 50, soc: 50 },
          preferredDisciplineIds: [],
          disciplineRatings: {},
          disciplineTierCounts: { above20: 0, above40: 0, above60: 0, above80: 0 },
          flavorEn: "",
          flavorDe: "",
          fatigue: 0,
          form: 0,
          potential: 0,
        },
      ],
      rosters: [],
      transferHistory: [
        {
          id: "h1",
          playerId: "p-off",
          seasonId: "season-1",
          transferType: "buy",
          source: "ai_roster_fill",
          toTeamId: "H-R",
          fee: 20,
          salary: 5,
          marketValue: 20,
        },
      ],
    } as unknown as GameState;

    const audit = auditDraftThemeComposition(gameState);
    expect(audit.pass).toBe(false);
    expect(audit.failures.some((entry) => entry.startsWith("hard_theme_red:"))).toBe(true);
    expect(audit.hardRedTeams.some((row) => row.code === "H-R")).toBe(true);
    expect(Object.keys(audit.statusCounts).length).toBeGreaterThan(0);
  });

  it("passes when only strong teams are below theme minimum (warn-only)", () => {
    const gameState = {
      teams: [{ teamId: "W-W", name: "Wild Wolves", shortCode: "W-W", cash: 100, rosterLimit: 14 }],
      teamIdentities: [{ teamId: "W-W", playerMin: 8, playerOpt: 12, pow: 50, spe: 50, men: 50, soc: 50 }],
      players: [
        {
          id: "p-off",
          name: "Off Theme",
          className: "Berserker",
          race: "Human",
          rating: 60,
          marketValue: 20,
          gender: "m",
          alignment: "neutral",
          subclasses: [],
          traitsPositive: [],
          traitsNegative: [],
          coreStats: { pow: 50, spe: 50, men: 50, soc: 50 },
          preferredDisciplineIds: [],
          disciplineRatings: {},
          disciplineTierCounts: { above20: 0, above40: 0, above60: 0, above80: 0 },
          flavorEn: "",
          flavorDe: "",
          fatigue: 0,
          form: 0,
          potential: 0,
        },
      ],
      rosters: [],
      transferHistory: [
        {
          id: "h1",
          playerId: "p-off",
          seasonId: "season-1",
          transferType: "buy",
          source: "ai_roster_fill",
          toTeamId: "W-W",
          fee: 20,
          salary: 5,
          marketValue: 20,
        },
      ],
    } as unknown as GameState;

    const audit = auditDraftThemeComposition(gameState);
    expect(audit.pass).toBe(true);
    expect(audit.strongWarnTeams.some((row) => row.code === "W-W")).toBe(true);
    expect(audit.failures).toHaveLength(0);
  });
});
