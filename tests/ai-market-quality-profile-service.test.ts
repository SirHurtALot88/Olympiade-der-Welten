import { describe, expect, it } from "vitest";

import {
  buildQualityAwareSlotPlan,
  laneFallbackChain,
  resolveMarketQualityProfile,
  scoreCandidateForLane,
  teamSatisfiesPremiumOpt,
} from "@/lib/ai/ai-market-quality-profile-service";
import { teamNeedsPostOptUpgradeDeploy } from "@/lib/ai/ai-budget-deploy-service";
import { teamNeedsMarketConvergence } from "@/lib/ai/ai-market-plan-convergence-service";
import { buildLeagueMarketAnchors } from "@/lib/ai/ai-market-slot-plan-service";
import type { GameState, TransferHistoryEntry } from "@/lib/data/olyDataTypes";
import { withNormalizedTeamStrategyProfiles } from "@/lib/foundation/team-strategy-profiles";

const anchors = buildLeagueMarketAnchors([12, 18, 26, 35, 48, 62, 78, 95, 120]);

function buildState(shortCode: "G-G" | "C-S", rosterCount: number, cash: number, transfers: TransferHistoryEntry[] = []): GameState {
  const teamId = shortCode;
  return withNormalizedTeamStrategyProfiles({
    season: { id: "season-3", name: "S3", year: 2028, currentMatchday: 1, matchdayIds: ["md-1"] },
    seasonState: {
      seasonId: "season-3",
      schedule: [],
      standings: {},
      teamControlSettings: {},
      disciplineSchedule: [{ seasonId: "season-3", discipline1: { playerCount: 4 }, discipline2: { playerCount: 4 } }],
    },
    matchdayState: { matchdayId: "md-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [{ teamId, name: shortCode, shortCode, cash, humanControlled: false }],
    teamIdentities: [{ teamId, identityId: teamId, playerMin: 8, playerMax: 14, playerOpt: 12 }],
    rosters: Array.from({ length: rosterCount }, (_, index) => ({
      id: `r-${index}`,
      teamId,
      playerId: `p-${index}`,
      slot: index,
    })),
    players: [],
    transferHistory: transfers,
  } as GameState);
}

describe("ai-market-quality-profile-service", () => {
  it("detects star chasers and premium flex metadata", () => {
    const profile = resolveMarketQualityProfile({
      gameState: buildState("G-G", 10, 120),
      teamId: "G-G",
      rosterCount: 10,
      spendable: anchors.q85Price + 10,
      anchors,
    });
    expect(profile.starChaser).toBe(true);
    expect(profile.pickPhase).toBe("fill_to_opt");
    expect(profile.optFlexSlots).toBeGreaterThan(0);
    expect(profile.qualityFloorMw).toBe(12);
  });

  it("prefers premium lanes first for star chasers in fill phase", () => {
    const profile = resolveMarketQualityProfile({
      gameState: buildState("C-S", 11, 140),
      teamId: "C-S",
      rosterCount: 11,
      spendable: anchors.q85Price + 20,
      anchors,
    });
    const plan = buildQualityAwareSlotPlan({
      profile,
      spendable: anchors.q85Price + 20,
      rosterCount: 11,
      steps: 2,
      missingToMin: 0,
      rosterGap: 1,
      anchors,
    });
    expect(plan[0] === "star" || plan[0] === "superstar" || plan[0] === "core").toBe(true);
  });

  it("allows depth picks in fill phase scoring", () => {
    const depthScore = scoreCandidateForLane({
      price: anchors.q50Price,
      score: 60,
      lane: "depth",
      anchors,
      qualityFloorMw: anchors.q25Price,
      disableCheapLanes: false,
      pickPhase: "fill_to_opt",
    });
    const blockedUpgrade = scoreCandidateForLane({
      price: anchors.q25Price,
      score: 60,
      lane: "depth",
      anchors,
      qualityFloorMw: anchors.q65Price,
      disableCheapLanes: true,
      pickPhase: "post_opt_upgrade",
    });
    expect(depthScore).toBeGreaterThan(50);
    expect(blockedUpgrade).toBeLessThan(depthScore);
  });

  it("accepts premium opt flex after star or two core buys", () => {
    const transfers: TransferHistoryEntry[] = [
      {
        id: "h1",
        playerId: "buy-1",
        seasonId: "season-3",
        source: "ai_preseason_market_buy",
        transferType: "buy",
        toTeamId: "G-G",
        fee: anchors.q85Price + 5,
      } as TransferHistoryEntry,
    ];
    const gameState = buildState("G-G", 11, 80, transfers);
    const profile = resolveMarketQualityProfile({
      gameState,
      teamId: "G-G",
      rosterCount: 11,
      spendable: anchors.q85Price,
      anchors,
    });
    expect(teamSatisfiesPremiumOpt({ gameState, teamId: "G-G", profile, anchors })).toBe(true);
  });

  it("accepts premium opt flex after two core-tier buys", () => {
    const transfers: TransferHistoryEntry[] = [
      {
        id: "h1",
        playerId: "buy-1",
        seasonId: "season-3",
        source: "ai_preseason_market_buy",
        transferType: "buy",
        toTeamId: "C-S",
        fee: anchors.q65Price + 2,
      } as TransferHistoryEntry,
      {
        id: "h2",
        playerId: "buy-2",
        seasonId: "season-3",
        source: "ai_preseason_market_buy",
        transferType: "buy",
        toTeamId: "C-S",
        fee: anchors.q65Price + 4,
      } as TransferHistoryEntry,
    ];
    const gameState = buildState("C-S", 11, 80, transfers);
    const profile = resolveMarketQualityProfile({
      gameState,
      teamId: "C-S",
      rosterCount: 11,
      spendable: anchors.q85Price,
      anchors,
    });
    expect(teamSatisfiesPremiumOpt({ gameState, teamId: "C-S", profile, anchors })).toBe(true);
  });

  it("lowers effective opt target for star chasers with flex slots", () => {
    const gameState = buildState("G-G", 10, 120);
    const profile = resolveMarketQualityProfile({
      gameState,
      teamId: "G-G",
      rosterCount: 10,
      spendable: anchors.q85Price + 10,
      anchors,
    });
    expect(profile.effectiveOptTarget).toBeLessThan(12);
    expect(profile.comfortTarget).toBeLessThanOrEqual(profile.effectiveOptTarget);
  });

  it("limits upgrade lane fallback to star/core only", () => {
    expect(laneFallbackChain({ primaryLane: "star", pickPhase: "post_opt_upgrade", starChaser: true, upgradeOnly: true })).toEqual([
      "star",
      "core",
    ]);
  });

  it("does not keep convergence active solely for missing premium buys at identity opt", () => {
    const gameState = buildState("G-G", 12, 150);
    expect(teamNeedsPostOptUpgradeDeploy(gameState, "G-G", "season-3")).toBe(false);
    expect(teamNeedsMarketConvergence(gameState, "G-G")).toBe(false);
  });
});
