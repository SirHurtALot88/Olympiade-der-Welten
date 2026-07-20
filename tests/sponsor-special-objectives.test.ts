import { describe, expect, it } from "vitest";

import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import { buildSponsorOffersForTeam } from "@/lib/sponsor/sponsor-offer-service";
import {
  buildBonusObjectiveComponent,
  buildChallengeSpecialComponent,
  buildGoldenObjectiveComponent,
  computeTransferWindowNet,
  getAvailableBonusObjectiveKeys,
  getTeamAxisRank,
  isTransferTraderAvailableForSeason,
  parseAxisTargetValue,
  pickGoldenObjective,
  resolveChallengeSlotIndex,
  resolveRealisticAxisTargetRank,
  SPONSOR_BONUS_OBJECTIVE_ARCHETYPE,
  SPONSOR_GOLDEN_OBJECTIVE_ARCHETYPE,
  type SponsorGoldenObjectiveKey,
} from "@/lib/sponsor/sponsor-special-objectives";
import { buildTeamSeasonOverviewRows } from "@/lib/foundation/team-management-overview";
import { getTeamStrategyProfile } from "@/lib/foundation/team-strategy-profiles";
import {
  computeLeagueSpotlightDeltas,
  type TeamSpotlightSignals,
} from "@/lib/economy/team-beliebtheit";
import { computeTeamExpectation } from "@/lib/board/team-season-objectives-service";
import {
  evaluateSpecialComponentForObjective,
  evaluateSpecialComponentStage,
} from "@/lib/sponsor/sponsor-objective-evaluator";
import type { GameState } from "@/lib/data/olyDataTypes";

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
    const menRank = getTeamAxisRank(rows, team.teamId, "men", gameState);

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

  it("offers exactly one challenge sponsor among five choices", () => {
    const gameState = createSingleplayerGameState();
    const teamId = gameState.teams.find((entry) => entry.shortCode === "R-R")?.teamId ?? gameState.teams[0]!.teamId;
    const offers = buildSponsorOffersForTeam({ gameState, teamId });
    const challengeOffers = offers.filter((offer) => offer.isChallengeOffer === true);
    expect(offers).toHaveLength(5);
    expect(challengeOffers).toHaveLength(1);
    expect(resolveChallengeSlotIndex(gameState.season.id, teamId, offers.length)).toBeGreaterThanOrEqual(0);
    expect(resolveChallengeSlotIndex(gameState.season.id, teamId, offers.length)).toBeLessThanOrEqual(4);
  }, 180000);

  it("evaluates axis rank special against league axis ranks", () => {
    const gameState = createSingleplayerGameState();
    const team = gameState.teams.find((entry) => entry.shortCode === "M-M")!;
    const rows = buildTeamSeasonOverviewRows({ gameState });
    const powRank = getTeamAxisRank(rows, team.teamId, "pow", gameState).rank ?? 99;
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

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// TEIL B — Sponsor-Bonusziele (staged / spotlightBonus-Framework)
// ─────────────────────────────────────────────────────────────────────────────────────────────────

function setRank(gs: GameState, teamId: string, rank: number) {
  gs.seasonState.standings = {
    ...(gs.seasonState.standings ?? {}),
    [teamId]: { ...((gs.seasonState.standings ?? {})[teamId] ?? {}), rank, startplatz: rank, points: 100 - rank },
  } as GameState["seasonState"]["standings"];
}

function bonusInput(gs: GameState, teamId: string, overrides: Record<string, unknown> = {}) {
  const team = gs.teams.find((entry) => entry.teamId === teamId)!;
  return {
    gameState: gs,
    team,
    identity: gs.teamIdentities.find((entry) => entry.teamId === teamId) ?? null,
    profile: null,
    rewardCash: 5,
    starTier: 3 as const,
    seasonId: gs.season.id,
    ...overrides,
  };
}

describe("sponsor bonus objectives (Teil B)", () => {
  it("evaluates the underdog-story ladder as achieved stage fraction", () => {
    const gs = structuredClone(createSingleplayerGameState());
    const teamId = gs.teams[0]!.teamId;
    const rows = buildTeamSeasonOverviewRows({ gameState: gs });
    const rowsByTeamId = new Map(rows.map((r) => [r.teamId, r] as const));
    const expected = computeTeamExpectation({ row: rowsByTeamId.get(teamId)!, rowsByTeamId, identity: null }).expectedRank;
    setRank(gs, teamId, Math.max(1, expected - 6));
    const comp = buildBonusObjectiveComponent("underdog_story", bonusInput(gs, teamId) as never);
    const res = evaluateSpecialComponentStage(gs, teamId, comp);
    expect(res.metric).toBe(expected - Math.max(1, expected - 6));
    expect(res.fraction).toBeCloseTo(0.7, 5); // +6 → mittlere Stufe
  }, 60000);

  it("windows transfer-trader net to the season and excludes it in season 1", () => {
    const gs = structuredClone(createSingleplayerGameState());
    const teamId = gs.teams[0]!.teamId;
    const seasonId = gs.season.id;
    gs.transferHistory = [
      { id: "s1", playerId: "p1", seasonId, transferType: "sell", fromTeamId: teamId, toTeamId: null, fee: 30, netCashImpact: 25 },
      { id: "b1", playerId: "p2", seasonId, transferType: "buy", fromTeamId: null, toTeamId: teamId, fee: 10, netCashImpact: 10 },
      { id: "x", playerId: "p3", seasonId: "season-99", transferType: "sell", fromTeamId: teamId, toTeamId: null, fee: 999 },
    ] as never;
    expect(computeTransferWindowNet(gs, teamId, seasonId)).toBe(15);
    expect(isTransferTraderAvailableForSeason("season-1")).toBe(false);
    expect(isTransferTraderAvailableForSeason("season-2")).toBe(true);
    expect(getAvailableBonusObjectiveKeys("security", "season-1")).not.toContain("transfer_trader");
    expect(getAvailableBonusObjectiveKeys("security", "season-2")).toContain("transfer_trader");
  }, 60000);

  it("keeps the objective spotlight league-centered (Σ ≈ 0)", () => {
    const teamCount = 12;
    const signals: TeamSpotlightSignals[] = Array.from({ length: teamCount }, (_, index) => ({
      teamId: `T${index}`,
      rosterSize: 8,
      finalRank: index + 1,
      expectedRank: index + 1,
      bracketHeroShare: 0,
      upsetRate: 0,
      historicalAvgRank: null,
      disciplineTop3Share: 0,
      fanFavoriteTerm: 0,
      objectiveSpotlight: index % 3 === 0 ? 1 : index % 3 === 1 ? 0.5 : 0,
    }));
    const deltas = computeLeagueSpotlightDeltas(signals);
    let sumObjective = 0;
    for (const result of deltas.values()) sumObjective += result.components.objective ?? 0;
    // Zentrierung exakt 0 vor Rundung; nur Rundungsdrift (≤ teamCount × 0.5e-4) bleibt.
    expect(Math.abs(sumObjective)).toBeLessThan(teamCount * 0.5e-4 + 1e-9);
  });

  it("separates golden objectives from the standard pool and picks them archetype-consistently", () => {
    const goldenKeys = Object.keys(SPONSOR_GOLDEN_OBJECTIVE_ARCHETYPE) as SponsorGoldenObjectiveKey[];
    const stdKeys = Object.keys(SPONSOR_BONUS_OBJECTIVE_ARCHETYPE);
    expect(goldenKeys.some((k) => stdKeys.includes(k))).toBe(false);
    for (const archetype of ["performance", "identity", "security"] as const) {
      const pick = pickGoldenObjective("season-4", "T-1", archetype);
      expect(SPONSOR_GOLDEN_OBJECTIVE_ARCHETYPE[pick]).toBe(archetype);
      expect(pickGoldenObjective("season-4", "T-1", archetype)).toBe(pick); // deterministisch
      expect(getAvailableBonusObjectiveKeys(archetype, "season-4")).not.toContain(pick as never);
    }
  });

  it("gates golden title-shock to weak teams only", () => {
    const gs = structuredClone(createSingleplayerGameState());
    const teamId = gs.teams[0]!.teamId;
    setRank(gs, teamId, 1);
    const weak = evaluateSpecialComponentStage(
      gs,
      teamId,
      buildGoldenObjectiveComponent("golden_title_shock", bonusInput(gs, teamId, { teamQualityRank: 30 }) as never),
    );
    const strong = evaluateSpecialComponentStage(
      gs,
      teamId,
      buildGoldenObjectiveComponent("golden_title_shock", bonusInput(gs, teamId, { teamQualityRank: 3 }) as never),
    );
    expect(weak.fraction).toBeCloseTo(1, 5); // schwaches Team, Meister
    expect(strong.fraction).toBe(0); // starkes Team nicht eignungsberechtigt
  }, 60000);
});
