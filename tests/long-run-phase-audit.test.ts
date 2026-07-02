import { describe, expect, it } from "vitest";

import {
  assertPhaseAuditNoRed,
  classifyTeamDraftQuality,
  runPhaseAuditDe,
} from "@/lib/season/long-run-phase-audit";
import { getAllTeamsBelowMinIds } from "@/lib/season/long-run-canonical";
import type { GameState } from "@/lib/data/olyDataTypes";
import type { PersistedSaveGame } from "@/lib/persistence/types";

function minimalSave(gameState: GameState): PersistedSaveGame {
  return {
    saveId: "test-save",
    name: "Test",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    gameState,
  };
}

describe("long-run phase audit", () => {
  it("classifies under-min roster as RED draft quality", () => {
    const quality = classifyTeamDraftQuality(
      { budget: 200, rosterLimit: 32 },
      { playerMin: 10, playerOpt: 12 },
      50,
      7,
    );
    expect(quality).toBe("RED");
  });

  it("flags free-seeded S1 roster as draft_paid RED", () => {
    const team = { teamId: "t1", shortCode: "A-A", name: "A", budget: 200, cash: 50, rosterLimit: 32, humanControlled: false };
    const player = { id: "p1", name: "P", gender: "male", race: "human", rating: 50, potential: 60, trainingMode: "mittel" as const };
    const save = minimalSave({
      season: { id: "season-1", name: "S1", currentMatchday: 1, matchdayIds: ["md1"] },
      teams: [team],
      teamIdentities: [{ teamId: "t1", playerMin: 10, playerOpt: 12 }],
      players: [player],
      rosters: [{ id: "r1", teamId: "t1", playerId: "p1", contractLength: 2, salary: 10, upkeep: 0, roleTag: "starter", joinedSeasonId: "season-1" }],
      transferHistory: [],
      contracts: [],
      transferListings: [],
      seasonState: {},
      matchdayState: { matchdayId: "md1" },
    } as unknown as GameState);
    const audit = runPhaseAuditDe(save, "draft");
    expect(audit.checks.find((entry) => entry.id === "draft_paid")?.status).toBe("RED");
    expect(() => assertPhaseAuditNoRed(audit)).toThrow(/draft_paid/);
  });

  it("lists teams below roster minimum for preseason audit", () => {
    const save = minimalSave({
      season: { id: "season-1", name: "S1", currentMatchday: 1, matchdayIds: ["md1"] },
      teams: [{ teamId: "t1", shortCode: "A-A", name: "A", budget: 200, cash: 50, rosterLimit: 32, humanControlled: false }],
      teamIdentities: [{ teamId: "t1", playerMin: 10, playerOpt: 12 }],
      players: [{ id: "p1", name: "P", gender: "male", race: "human", rating: 50, potential: 60, trainingMode: "mittel" }],
      rosters: [{ id: "r1", teamId: "t1", playerId: "p1", contractLength: 2, salary: 10, upkeep: 0, roleTag: "starter", joinedSeasonId: "season-1" }],
      transferHistory: [],
      contracts: [],
      transferListings: [],
      seasonState: {},
      matchdayState: { matchdayId: "md1" },
    } as unknown as GameState);
    expect(getAllTeamsBelowMinIds(save.gameState)).toEqual(["t1"]);
    expect(runPhaseAuditDe(save, "preseason").checks.find((entry) => entry.id === "roster_min_before_md1")?.status).toBe("RED");
  });

  it("flags manual_xp_spend_preview upgrades at season end", () => {
    const save = minimalSave({
      season: { id: "season-1", name: "S1", currentMatchday: 10, matchdayIds: Array.from({ length: 10 }, (_, i) => `md${i + 1}`) },
      gamePhase: "season_completed",
      teams: [{ teamId: "t1", shortCode: "A-A", name: "A", budget: 200, cash: 50, rosterLimit: 32, humanControlled: false }],
      teamIdentities: [{ teamId: "t1", playerMin: 8, playerOpt: 12 }],
      players: [{ id: "p1", name: "P", gender: "male", race: "human", rating: 50, potential: 60, trainingMode: "mittel", fatigue: 40 }],
      rosters: [{ id: "r1", teamId: "t1", playerId: "p1", contractLength: 2, salary: 10, upkeep: 0, roleTag: "starter", joinedSeasonId: "season-1" }],
      transferHistory: [],
      contracts: [],
      transferListings: [],
      playerProgressionEvents: [
        {
          eventId: "bad",
          seasonId: "season-1",
          teamId: "t1",
          playerId: "p1",
          upgrades: [{ playerId: "p1", attribute: "power", fromValue: 50, toValue: 51, cost: 70, source: "manual_xp_spend_preview" }],
          xpSpent: 70,
          timestamp: "2026-06-11T00:00:00.000Z",
          source: "manual_season_end_xp_spend",
        },
      ],
      seasonState: {
        standings: { t1: { rank: 1, points: 30, teamId: "t1" } },
        matchdayResults: Array.from({ length: 10 }, (_, i) => ({ seasonId: "season-1", matchdayId: `md${i + 1}` })),
        injuryEvents: [{ seasonId: "season-1", playerId: "p1", teamId: "t1" }],
      },
      matchdayState: { matchdayId: "md10" },
    } as unknown as GameState);

    const audit = runPhaseAuditDe(save, "season_end");
    expect(audit.checks.find((entry) => entry.id === "season_end_organic_only")?.status).toBe("RED");
    expect(audit.checks.find((entry) => entry.id === "season_end_manual_spend_events")?.status).toBe("WARN");
  });

  it("flags organic peak corridor RED when top improvers are too low", () => {
    const players = Array.from({ length: 12 }, (_, index) => ({
      id: `p${index + 1}`,
      name: `P${index + 1}`,
      gender: "male",
      race: "human",
      rating: 50,
      potential: 60,
      trainingMode: "hart" as const,
      fatigue: 40,
      trainingClass: "Berserker",
    }));
    const save = minimalSave({
      season: { id: "season-1", name: "S1", currentMatchday: 10, matchdayIds: Array.from({ length: 10 }, (_, i) => `md${i + 1}`) },
      gamePhase: "season_completed",
      teams: [{ teamId: "t1", shortCode: "A-A", name: "A", budget: 200, cash: 50, rosterLimit: 32, humanControlled: false }],
      teamIdentities: [{ teamId: "t1", playerMin: 8, playerOpt: 12 }],
      players,
      rosters: players.map((player, index) => ({
        id: `r${index + 1}`,
        teamId: "t1",
        playerId: player.id,
        contractLength: 2,
        salary: 10,
        upkeep: 0,
        roleTag: "starter",
        joinedSeasonId: "season-1",
      })),
      transferHistory: [],
      contracts: [],
      transferListings: [],
      playerProgressionEvents: players.map((player, index) => ({
        eventId: `org-${index}`,
        seasonId: "season-1",
        teamId: "t1",
        playerId: player.id,
        source: "organic_season_progression",
        organicMeta: { netSetpoints: 2 + index * 0.1 },
        upgrades: [{ playerId: player.id, attribute: "power", fromValue: 50, toValue: 52, cost: 0, source: "organic_season_progression" }],
        xpSpent: 0,
        timestamp: "2026-06-11T00:00:00.000Z",
      })),
      seasonState: {
        standings: { t1: { rank: 1, points: 30, teamId: "t1" } },
        matchdayResults: Array.from({ length: 10 }, (_, i) => ({ seasonId: "season-1", matchdayId: `md${i + 1}` })),
        injuryEvents: [{ seasonId: "season-1", playerId: "p1", teamId: "t1", result: "injured" }],
      },
      matchdayState: { matchdayId: "md10" },
    } as unknown as GameState);

    const audit = runPhaseAuditDe(save, "season_end");
    expect(audit.checks.find((entry) => entry.id === "organic_peak_net_corridor")?.status).toBe("RED");
    expect(audit.checks.find((entry) => entry.id === "training_classes_set")?.status).toBe("PASS");
  });

  it("reports S1 draft picks separately from market buys in transfer_activity_sane", () => {
    const save = minimalSave({
      season: { id: "season-1", name: "S1", currentMatchday: 10, matchdayIds: Array.from({ length: 10 }, (_, i) => `md${i + 1}`) },
      gamePhase: "season_completed",
      teams: [{ teamId: "t1", shortCode: "A-A", name: "A", budget: 200, cash: 50, rosterLimit: 32, humanControlled: false }],
      teamIdentities: [{ teamId: "t1", playerMin: 8, playerOpt: 12 }],
      players: [{ id: "p1", name: "P", gender: "male", race: "human", rating: 50, potential: 60, trainingMode: "mittel", fatigue: 40 }],
      rosters: [{ id: "r1", teamId: "t1", playerId: "p1", contractLength: 2, salary: 10, upkeep: 0, roleTag: "starter", joinedSeasonId: "season-1" }],
      transferHistory: [
        {
          id: "h1",
          playerId: "p1",
          seasonId: "season-1",
          matchdayId: "matchday-1",
          transferType: "buy",
          toTeamId: "t1",
          source: "ai_roster_fill",
          fee: 20,
        },
        {
          id: "h2",
          playerId: "p2",
          seasonId: "season-1",
          matchdayId: "matchday-10",
          transferType: "buy",
          toTeamId: "t1",
          source: "season1_autoprep_topup",
          fee: 15,
        },
        {
          id: "h3",
          playerId: "p1",
          seasonId: "season-1",
          matchdayId: "matchday-10",
          transferType: "sell",
          fromTeamId: "t1",
          source: "ai_preseason_market_sell",
          fee: 10,
        },
      ],
      contracts: [],
      transferListings: [],
      seasonState: {
        standings: { t1: { rank: 1, points: 30, teamId: "t1" } },
        matchdayResults: Array.from({ length: 10 }, (_, i) => ({ seasonId: "season-1", matchdayId: `md${i + 1}` })),
        injuryEvents: [{ seasonId: "season-1", playerId: "p1", teamId: "t1", result: "injured" }],
      },
      matchdayState: { matchdayId: "md10" },
    } as unknown as GameState);

    const audit = runPhaseAuditDe(save, "season_end");
    const transferCheck = audit.checks.find((entry) => entry.id === "transfer_activity_sane");
    expect(transferCheck?.status).toBe("PASS");
    expect(transferCheck?.detail).toBe("season-1: 2Draft/0Markt/1V/0X");
  });

  it("flags forbidden S1 market buys in transfer_activity_sane", () => {
    const save = minimalSave({
      season: { id: "season-1", name: "S1", currentMatchday: 10, matchdayIds: Array.from({ length: 10 }, (_, i) => `md${i + 1}`) },
      gamePhase: "season_completed",
      teams: [{ teamId: "t1", shortCode: "A-A", name: "A", budget: 200, cash: 50, rosterLimit: 32, humanControlled: false }],
      teamIdentities: [{ teamId: "t1", playerMin: 8, playerOpt: 12 }],
      players: [{ id: "p1", name: "P", gender: "male", race: "human", rating: 50, potential: 60, trainingMode: "mittel", fatigue: 40 }],
      rosters: [{ id: "r1", teamId: "t1", playerId: "p1", contractLength: 2, salary: 10, upkeep: 0, roleTag: "starter", joinedSeasonId: "season-1" }],
      transferHistory: [
        {
          id: "h1",
          playerId: "p1",
          seasonId: "season-1",
          matchdayId: "matchday-1",
          transferType: "buy",
          toTeamId: "t1",
          source: "ai_preseason_market_buy",
          fee: 20,
        },
      ],
      contracts: [],
      transferListings: [],
      seasonState: {
        standings: { t1: { rank: 1, points: 30, teamId: "t1" } },
        matchdayResults: Array.from({ length: 10 }, (_, i) => ({ seasonId: "season-1", matchdayId: `md${i + 1}` })),
        injuryEvents: [{ seasonId: "season-1", playerId: "p1", teamId: "t1", result: "injured" }],
      },
      matchdayState: { matchdayId: "md10" },
    } as unknown as GameState);

    const audit = runPhaseAuditDe(save, "season_end");
    expect(audit.checks.find((entry) => entry.id === "transfer_activity_sane")?.status).toBe("RED");
  });
});
