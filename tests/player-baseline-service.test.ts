import { describe, expect, it } from "vitest";

import { createFreshSeasonOneGameState } from "@/lib/game-state/singleplayer-state";
import {
  buildPlayerBaselineAudit,
  calculatePlayerBaselineChecksum,
  createNewGameFromPlayerBaseline,
  ensurePlayerBaselines,
  guardPlayerBaselineWrite,
  resetSavePlayersToBaseline,
} from "@/lib/players/player-baseline-service";

describe("player baseline service", () => {
  it("creates a baseline for every imported player", () => {
    const gameState = createFreshSeasonOneGameState();
    const audit = buildPlayerBaselineAudit(gameState);

    expect(audit.summary.playerCount).toBeGreaterThan(0);
    expect(audit.summary.baselineCount).toBe(audit.summary.playerCount);
    expect(audit.summary.missingBaselineCount).toBe(0);
    expect(audit.summary.baselineVersions).toEqual(["player-baseline-v2"]);
    expect(audit.summary.invalidChecksumCount).toBe(0);
    expect(gameState.playerBaselines?.[0]?.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(gameState.playerBaselines?.[0]?.sourceHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("resets mutable player state back to baseline values without deleting baseline", () => {
    const gameState = createFreshSeasonOneGameState();
    const player = gameState.players.find((entry) => typeof entry.attributeSheetStats?.power === "number") ?? gameState.players[0]!;
    const baselinePower = gameState.playerBaselines?.find((entry) => entry.playerId === player.id)?.attributes.power;
    const mutated = {
      ...gameState,
      players: gameState.players.map((entry) =>
        entry.id === player.id
          ? {
              ...entry,
              attributeSheetStats: { ...(entry.attributeSheetStats ?? {}), power: 99 },
              currentXP: 42,
              spentXP: 7,
              disciplineDelta: { tdm: 2 },
            }
          : entry,
      ),
      playerProgressionEvents: [
        {
          eventId: "event-1",
          seasonId: gameState.season.id,
          teamId: "A-A",
          playerId: player.id,
          upgrades: [],
          xpSpent: 7,
          timestamp: "2026-06-12T00:00:00.000Z",
          source: "manual_season_end_xp_spend" as const,
        },
      ],
    };

    const reset = resetSavePlayersToBaseline(mutated);
    const resetPlayer = reset.gameState.players.find((entry) => entry.id === player.id)!;

    expect(reset.ok).toBe(true);
    expect(baselinePower).not.toBeUndefined();
    expect(resetPlayer.attributeSheetStats?.power).toBe(baselinePower);
    expect(resetPlayer.currentXP).toBe(0);
    expect(resetPlayer.spentXP).toBe(0);
    expect(resetPlayer.lifetimeXP).toBeNull();
    expect(resetPlayer.fatigue).toBe(0);
    expect(resetPlayer.currentDisciplineValues).toEqual(
      gameState.playerBaselines?.find((entry) => entry.playerId === player.id)?.disciplineRatings,
    );
    expect(resetPlayer.disciplineDelta).toBeUndefined();
    expect(reset.gameState.playerProgressionEvents).toHaveLength(0);
    expect(reset.gameState.playerBaselines?.find((entry) => entry.playerId === player.id)?.attributes.power).toBe(baselinePower);
  });

  it("blocks reset if a baseline is missing", () => {
    const gameState = createFreshSeasonOneGameState();
    const missingPlayerId = gameState.players[0]!.id;
    const reset = resetSavePlayersToBaseline({
      ...gameState,
      playerBaselines: gameState.playerBaselines?.filter((baseline) => baseline.playerId !== missingPlayerId),
    });

    expect(reset.ok).toBe(false);
    expect(reset.blockers).toContain(`player_baseline_missing:${missingPlayerId}`);
  });

  it("creates a new game player state from baseline and clears progression events", () => {
    const gameState = createFreshSeasonOneGameState();
    const next = createNewGameFromPlayerBaseline({
      gameState: {
        ...gameState,
        transferHistory: [{ ...(gameState.transferHistory[0] ?? {}), id: "transfer-test" }] as never,
        playerProgressionEvents: [
          {
            eventId: "event-1",
            seasonId: gameState.season.id,
            teamId: "A-A",
            playerId: gameState.players[0]!.id,
            upgrades: [],
            xpSpent: 1,
            timestamp: "2026-06-12T00:00:00.000Z",
            source: "manual_season_end_xp_spend",
          },
        ],
      },
    });

    expect(next.ok).toBe(true);
    expect(next.gameState.transferHistory).toHaveLength(0);
    expect(next.gameState.playerProgressionEvents).toHaveLength(0);
    expect(next.gameState.players[0]?.currentXP).toBe(0);
    expect(next.gameState.players[0]?.spentXP).toBe(0);
  });

  it("keeps baseline checksum stable after mutable training state changes", () => {
    const gameState = createFreshSeasonOneGameState();
    const before = gameState.playerBaselines?.[0];
    const ensured = ensurePlayerBaselines({
      ...gameState,
      players: gameState.players.map((player, index) =>
        index === 0 ? { ...player, trainingMode: "hart", fatigue: 42 } : player,
      ),
    });
    const after = ensured.gameState.playerBaselines?.[0];

    expect(before?.checksum).toBe(after?.checksum);
    expect(after ? calculatePlayerBaselineChecksum(after) : null).toBe(before?.checksum);
  });

  it("blocks attempts to overwrite an existing baseline payload", () => {
    const gameState = createFreshSeasonOneGameState();
    const previous = gameState.playerBaselines ?? [];
    const target = previous[0]!;
    const attempted = previous.map((baseline, index) =>
      index === 0
        ? {
            ...baseline,
            attributes: { ...baseline.attributes, power: (baseline.attributes.power ?? 0) + 1 },
          }
        : baseline,
    );

    const guarded = guardPlayerBaselineWrite({
      previous,
      next: attempted,
      attemptedSource: "test",
      timestamp: "2026-06-13T00:00:00.000Z",
    });

    expect(guarded.events).toHaveLength(1);
    expect(guarded.events[0]?.reason).toBe("player_baseline_write_blocked");
    expect(guarded.baselines.find((baseline) => baseline.playerId === target.playerId)?.checksum).toBe(target.checksum);
    expect(guarded.baselines.find((baseline) => baseline.playerId === target.playerId)?.attributes.power).toBe(
      target.attributes.power,
    );
  });

  it("marks unavoidable fallback baselines as reconstructed from mutated state", () => {
    const gameState = createFreshSeasonOneGameState();
    const customPlayer = {
      ...gameState.players[0]!,
      id: "custom-generated-player",
      name: "Generated Player",
    };
    const ensured = ensurePlayerBaselines(
      {
        ...gameState,
        players: [customPlayer],
        playerBaselines: [],
      },
      { sourcePlayers: [] },
    );

    expect(ensured.warnings).toContain("baseline_reconstructed_from_mutated_state:custom-generated-player");
    expect(ensured.gameState.playerBaselines?.[0]?.reconstructionWarning).toBe("baseline_reconstructed_from_mutated_state");
  });
});
