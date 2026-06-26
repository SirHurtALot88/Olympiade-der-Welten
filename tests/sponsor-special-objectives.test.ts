import { describe, expect, it } from "vitest";

import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import { buildSponsorOffersForTeam } from "@/lib/sponsor/sponsor-offer-service";
import {
  buildChallengeSpecialComponent,
  getTeamAxisRank,
  parseAxisTargetValue,
  resolveChallengeSlotIndex,
  resolveRealisticAxisTargetRank,
} from "@/lib/sponsor/sponsor-special-objectives";
import { buildTeamSeasonOverviewRows } from "@/lib/foundation/team-management-overview";
import { getTeamStrategyProfile } from "@/lib/foundation/team-strategy-profiles";
import { evaluateSpecialComponentForObjective } from "@/lib/sponsor/sponsor-objective-evaluator";

describe("sponsor special objectives", () => {
  it("never asks weak teams for unrealistic axis top-10 targets", () => {
    expect(resolveRealisticAxisTargetRank(28, 32)).toBeGreaterThanOrEqual(14);
    expect(resolveRealisticAxisTargetRank(28, 32)).toBeLessThanOrEqual(24);
    expect(resolveRealisticAxisTargetRank(15, 32)).toBeGreaterThan(10);
    expect(resolveRealisticAxisTargetRank(32, 32)).toBeGreaterThanOrEqual(24);
  }, 60000);

  it("builds W-W challenge on MEN with reachable target", () => {
    const gameState = createSingleplayerGameState();
    const team = gameState.teams.find((entry) => entry.shortCode === "W-W")!;
    const identity = gameState.teamIdentities.find((entry) => entry.teamId === team.teamId) ?? null;
    const profile = getTeamStrategyProfile(gameState, team.teamId);
    const rows = buildTeamSeasonOverviewRows({ gameState });
    const menRank = getTeamAxisRank(rows, team.teamId, "men");

    const component = buildChallengeSpecialComponent({
      gameState,
      team,
      identity,
      profile,
      starTier: 2,
      rewardCash: 4,
      seasonId: gameState.season.id,
    });

    if (component.specialKey === "axis_rank_top") {
      const parsed = parseAxisTargetValue(component.targetValue);
      expect(parsed?.axis).toBe("men");
      expect(parsed?.topRank ?? 99).toBeGreaterThan(10);
      if (menRank.rank != null) {
        expect(parsed?.topRank ?? 99).toBeLessThan(menRank.rank);
      }
    }
  }, 60000);

  it("offers exactly one challenge sponsor among three choices", () => {
    const gameState = createSingleplayerGameState();
    const teamId = gameState.teams.find((entry) => entry.shortCode === "R-R")?.teamId ?? gameState.teams[0]!.teamId;
    const offers = buildSponsorOffersForTeam({ gameState, teamId });
    const challengeOffers = offers.filter((offer) => offer.flavor.includes("Challenge-Sponsor"));
    expect(offers).toHaveLength(3);
    expect(challengeOffers).toHaveLength(1);
    expect(resolveChallengeSlotIndex(gameState.season.id, teamId)).toBeGreaterThanOrEqual(0);
    expect(resolveChallengeSlotIndex(gameState.season.id, teamId)).toBeLessThanOrEqual(2);
  }, 180000);

  it("evaluates axis rank special against league axis ranks", () => {
    const gameState = createSingleplayerGameState();
    const team = gameState.teams.find((entry) => entry.shortCode === "M-M")!;
    const rows = buildTeamSeasonOverviewRows({ gameState });
    const powRank = getTeamAxisRank(rows, team.teamId, "pow").rank ?? 1;
    const status = evaluateSpecialComponentForObjective(gameState, team.teamId, {
      componentId: "special-axis-pow",
      kind: "special",
      label: "POW Top 3",
      targetValue: "pow:3",
      rewardCash: 4,
      specialKey: "axis_rank_top",
    });
    expect(status).toBe(powRank <= 3 ? "completed" : powRank <= 5 ? "at_risk" : "open");
  }, 60000);
});
