import { describe, expect, it } from "vitest";

import {
  computeNetSetpointsFromEvent,
  computeOrganicRegressionScaleFactor,
  computeOrganicTrainingScaleFactor,
  computeSeasonOrganicProgressionMetrics,
  isPeakNetOutsideCorridor,
} from "@/lib/season/long-run-organic-progression-audit";
import type { GameState } from "@/lib/data/olyDataTypes";

describe("long-run organic progression audit", () => {
  it("computes league net delta and peak p90 from organic events", () => {
    const gameState = {
      playerProgressionEvents: [
        {
          eventId: "e1",
          seasonId: "season-1",
          teamId: "t1",
          playerId: "p1",
          source: "organic_season_progression",
          organicMeta: { netSetpoints: 7.2 },
          upgrades: [{ playerId: "p1", attribute: "power", fromValue: 50, toValue: 57.2, cost: 0, source: "organic_season_progression" }],
          xpSpent: 0,
          timestamp: "2026-01-01T00:00:00.000Z",
        },
        {
          eventId: "e2",
          seasonId: "season-1",
          teamId: "t1",
          playerId: "p2",
          source: "organic_season_progression",
          organicMeta: { netSetpoints: 6.5 },
          upgrades: [{ playerId: "p2", attribute: "speed", fromValue: 40, toValue: 46.5, cost: 0, source: "organic_season_progression" }],
          xpSpent: 0,
          timestamp: "2026-01-01T00:00:00.000Z",
        },
        {
          eventId: "e3",
          seasonId: "season-1",
          teamId: "t2",
          playerId: "p3",
          source: "organic_season_progression",
          organicMeta: { netSetpoints: -2.1 },
          upgrades: [{ playerId: "p3", attribute: "power", fromValue: 70, toValue: 67.9, cost: 0, source: "organic_season_progression" }],
          xpSpent: 0,
          timestamp: "2026-01-01T00:00:00.000Z",
        },
      ],
    } as unknown as GameState;

    const metrics = computeSeasonOrganicProgressionMetrics(gameState, "season-1");
    expect(metrics.leagueNetDelta).toBe(11.6);
    expect(metrics.peakP90).toBeGreaterThanOrEqual(6.5);
    expect(isPeakNetOutsideCorridor(metrics.peakP90, metrics.playerCount)).toBe(false);
  });

  it("computes training scale factor toward peak corridor midpoint", () => {
    expect(computeOrganicTrainingScaleFactor(4.4)).toBeGreaterThan(1);
    expect(computeOrganicTrainingScaleFactor(6.25)).toBe(1);
    expect(computeOrganicTrainingScaleFactor(10)).toBeLessThan(1);
  });

  it("computes regression scale factor when league average is too high", () => {
    expect(computeOrganicRegressionScaleFactor(0.8)).toBeGreaterThan(1);
    expect(computeOrganicRegressionScaleFactor(0.8)).toBeLessThanOrEqual(1.15);
    expect(computeOrganicRegressionScaleFactor(0.35)).toBe(1);
    expect(computeOrganicRegressionScaleFactor(-0.5)).toBeLessThan(1);
  });

  it("ignores manual_xp_spend_preview in net setpoints fallback", () => {
    const net = computeNetSetpointsFromEvent({
      eventId: "bad",
      seasonId: "season-1",
      teamId: "t1",
      playerId: "p1",
      upgrades: [
        { playerId: "p1", attribute: "power", fromValue: 50, toValue: 55, cost: 70, source: "manual_xp_spend_preview" },
        { playerId: "p1", attribute: "speed", fromValue: 40, toValue: 41, cost: 0, source: "organic_season_progression" },
      ],
      xpSpent: 70,
      timestamp: "2026-01-01T00:00:00.000Z",
      source: "manual_season_end_xp_spend",
    });
    expect(net).toBe(1);
  });
});
