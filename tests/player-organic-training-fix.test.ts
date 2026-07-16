import { describe, expect, it } from "vitest";

import { buildPlayerAttributeHistoryRows } from "@/lib/foundation/player-attribute-history";
import { buildPlayerTrainingHistoryRows } from "@/lib/foundation/player-training-history";
import { getAttributeHeadroom } from "@/lib/scouting/player-attribute-ceiling-service";
import {
  reconcilePlayerPotentialRecordToCurrentAbility,
  resolveEffectiveAxisPoStars,
} from "@/lib/scouting/player-potential-ceiling-service";
import { derivePlayerPotentialCeilingProfileFromAttributeCeilings } from "@/lib/scouting/player-attribute-ceiling-service";
import { buildOrganicSeasonProgression } from "@/lib/training/organic-season-progression";
import type { GameState, Player, PlayerPotentialRecord } from "@/lib/data/olyDataTypes";

function player(overrides: Partial<Player> = {}): Player {
  return {
    id: "player-test",
    name: "Test",
    className: "Bard",
    trainingClass: "Bard",
    trainingMode: "mittel",
    rating: 76,
    marketValue: 51,
    attributeSheetStats: {
      power: 41,
      health: 31,
      stamina: 65,
      intelligence: 69,
      awareness: 71,
      determination: 61,
      speed: 66,
      dexterity: 83,
      charisma: 70,
      will: 55,
      spirit: 60,
      torment: 50,
    },
    coreStats: { pow: 3.8, spe: 3.8, men: 4, soc: 4.5 },
    subclasses: [],
    traitsPositive: [],
    traitsNegative: [],
    ...overrides,
  } as Player;
}

function stalePotentialRecord(playerId: string): PlayerPotentialRecord {
  return {
    playerId,
    potentialBand: "medium",
    hiddenPotentialScore: 72,
    hiddenPotentialOverallStars: 3,
    hiddenPotentialCeilingByAxis: { pow: 2.5, spe: 2.5, men: 3, soc: 3 },
    hiddenAttributeCeiling: {
      power: 40,
      charisma: 68,
      intelligence: 68,
    },
    confidence: 0,
    source: "generated",
  };
}

function gameState(target: Player, record: PlayerPotentialRecord): GameState {
  return {
    season: { id: "season-3", name: "Season 3" },
    seasonState: { adminBalancingConfig: undefined },
    players: [target],
    rosters: [{ playerId: target.id, teamId: "team-1" }],
    teams: [{ teamId: "team-1", name: "Cold Steel", shortCode: "CS" }],
    teamIdentities: [],
    disciplines: [],
    playerPotential: [record],
  } as GameState;
}

describe("player training history", () => {
  it("drops legacy xp spend events completely", () => {
    const rows = buildPlayerTrainingHistoryRows({
      progressionEvents: [
        {
          eventId: "legacy",
          seasonId: "season-2",
          teamId: "team-1",
          playerId: "player-1",
          upgrades: [{ playerId: "player-1", attribute: "intelligence", fromValue: 65, toValue: 66, cost: 260, source: "manual_xp_spend_preview" }],
          xpSpent: 260,
          timestamp: "2026-01-02T00:00:00.000Z",
          source: "manual_season_end_xp_spend",
        },
        {
          eventId: "organic",
          seasonId: "season-3",
          teamId: "team-1",
          playerId: "player-1",
          upgrades: [{ playerId: "player-1", attribute: "power", fromValue: 42, toValue: 41.4, cost: 0, source: "organic_season_progression" }],
          xpSpent: 0,
          timestamp: "2026-01-03T00:00:00.000Z",
          source: "organic_season_progression",
        },
      ],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.source).toBe("organic");
  });
});

describe("attribute history", () => {
  it("tracks STR/power across seasons from organic events only", () => {
    const rows = buildPlayerAttributeHistoryRows({
      seasonAnchors: [
        { seasonId: "season-1", seasonName: "Season 1", isActiveSeason: false },
        { seasonId: "season-2", seasonName: "Season 2", isActiveSeason: false },
        { seasonId: "season-3", seasonName: "Season 3", isActiveSeason: true },
      ],
      baselineAttributes: { power: 42 },
      currentAttributes: { power: 41 },
      progressionEvents: [
        {
          seasonId: "season-2",
          timestamp: "2026-01-02T00:00:00.000Z",
          upgrades: [{ attribute: "power", fromValue: 42, toValue: 41.4 }],
        },
        {
          seasonId: "season-3",
          timestamp: "2026-01-03T00:00:00.000Z",
          upgrades: [{ attribute: "power", fromValue: 41.4, toValue: 41 }],
        },
      ],
    });

    expect(rows.map((row) => row.attributes.power)).toEqual([42, 41.4, 41]);
  });

  it("prepends a Start row when baseline differs from first season end", () => {
    const rows = buildPlayerAttributeHistoryRows({
      seasonAnchors: [
        { seasonId: "season-1", seasonName: "Season 1", isActiveSeason: false },
        { seasonId: "season-2", seasonName: "Season 2", isActiveSeason: true },
      ],
      baselineAttributes: { power: 42 },
      currentAttributes: { power: 40.8 },
      progressionEvents: [
        {
          seasonId: "season-1",
          timestamp: "2026-01-02T00:00:00.000Z",
          upgrades: [{ attribute: "power", fromValue: 42, toValue: 41.4 }],
        },
        {
          seasonId: "season-2",
          timestamp: "2026-01-03T00:00:00.000Z",
          upgrades: [{ attribute: "power", fromValue: 41.4, toValue: 40.8 }],
        },
      ],
    });

    expect(rows.map((row) => [row.seasonName, row.attributes.power])).toEqual([
      ["Start", 42],
      ["Season 1", 41.4],
      ["Season 2", 40.8],
    ]);
  });
});

describe("potential vs current ability", () => {
  it("never resolves axis PO below current CA stars", () => {
    const resolved = resolveEffectiveAxisPoStars(
      { pow: 3.8, spe: 3.8, men: 4, soc: 4.5, overall: 4 },
      { pow: 2.5, spe: 2.5, men: 3, soc: 3 },
    );
    expect(resolved.pow).toBeGreaterThanOrEqual(3.8);
    expect(resolved.soc).toBeGreaterThanOrEqual(4.5);
  });

  it("reconciles stored potential records when CA overtook PO", () => {
    const target = player();
    const record = stalePotentialRecord(target.id);
    const currentStars = { pow: 3.8, spe: 3.8, men: 4, soc: 4.5, overall: 4 };
    const reconciled = reconcilePlayerPotentialRecordToCurrentAbility({
      player: target,
      record,
      currentStars,
    });

    expect(reconciled.hiddenPotentialCeilingByAxis?.pow).toBeGreaterThanOrEqual(3.8);
    expect(reconciled.hiddenPotentialCeilingByAxis?.soc).toBeGreaterThanOrEqual(4.5);
    expect(reconciled.hiddenAttributeCeiling?.power).toBeGreaterThanOrEqual(43);
    const expectedAxis = derivePlayerPotentialCeilingProfileFromAttributeCeilings({
      attributeCeilings: reconciled.hiddenAttributeCeiling ?? {},
      currentStars,
    });
    expect(reconciled.hiddenPotentialCeilingByAxis?.pow).toBe(expectedAxis.pow);
    expect(reconciled.hiddenPotentialCeilingByAxis?.soc).toBe(expectedAxis.soc);
  });

  it("restores attribute headroom for bard charisma when per-attribute potential lagged behind CA", () => {
    const target = player();
    const record = stalePotentialRecord(target.id);
    const currentStars = { pow: 3.8, spe: 3.8, men: 4, soc: 4.5, overall: 4 };
    const reconciled = reconcilePlayerPotentialRecordToCurrentAbility({ player: target, record, currentStars });
    const fixedHeadroom = getAttributeHeadroom({ player: target, attribute: "charisma", record: reconciled });

    expect(record.hiddenAttributeCeiling?.charisma).toBeLessThan(target.attributeSheetStats!.charisma!);
    expect(reconciled.hiddenAttributeCeiling?.charisma).toBeGreaterThan(target.attributeSheetStats!.charisma!);
    expect(fixedHeadroom.state).toBe("open");
    expect(fixedHeadroom.headroom).toBeGreaterThan(5);
  });
});

describe("organic progression examples", () => {
  it("alladin-like bard with stale PO still allocates training setpoints to class attributes", () => {
    const target = player({ id: "alladin-like" });
    const result = buildOrganicSeasonProgression({
      gameState: gameState(target, stalePotentialRecord(target.id)),
      player: target,
    });

    expect(result.trainingSetpoints).toBeGreaterThan(0);
    const charisma = result.attributeBreakdown.find((entry) => entry.attribute === "charisma");
    expect(charisma?.training).toBeGreaterThan(0);
  });

  it("youth sprinter with healthy PO keeps open training route", () => {
    const target = player({
      id: "youth-sprinter",
      className: "Sprinter",
      trainingClass: "Sprinter",
      rating: 58,
      coreStats: { pow: 2.5, spe: 3.2, men: 2.8, soc: 2.4 },
      attributeSheetStats: {
        ...player().attributeSheetStats,
        speed: 72,
        power: 55,
      },
    });
    const record: PlayerPotentialRecord = {
      playerId: target.id,
      potentialBand: "high",
      hiddenPotentialScore: 84,
      hiddenPotentialOverallStars: 4,
      hiddenPotentialCeilingByAxis: { pow: 3.5, spe: 4.5, men: 3.5, soc: 3 },
      confidence: 0,
      source: "generated",
    };
    const result = buildOrganicSeasonProgression({ gameState: gameState(target, record), player: target });
    const speed = result.attributeBreakdown.find((entry) => entry.attribute === "speed");
    expect(speed?.training).toBeGreaterThan(0);
  });

  it("veteran tank with high MW still receives class training on power", () => {
    const target = player({
      id: "veteran-tank",
      className: "Tank",
      trainingClass: "Tank",
      rating: 82,
      marketValue: 95,
      coreStats: { pow: 4.2, spe: 2.8, men: 3.4, soc: 2.6 },
    });
    const record: PlayerPotentialRecord = {
      playerId: target.id,
      potentialBand: "medium",
      hiddenPotentialScore: 80,
      hiddenPotentialOverallStars: 3.5,
      hiddenPotentialCeilingByAxis: { pow: 4.5, spe: 3, men: 3.5, soc: 3 },
      confidence: 0,
      source: "generated",
    };
    const result = buildOrganicSeasonProgression({ gameState: gameState(target, record), player: target });
    const power = result.attributeBreakdown.find((entry) => entry.attribute === "power");
    expect(power?.training).toBeGreaterThan(0);
  });
});
