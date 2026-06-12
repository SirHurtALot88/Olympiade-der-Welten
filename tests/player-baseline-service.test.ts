import { describe, expect, it } from "vitest";

import { createFreshSeasonOneGameState } from "@/lib/game-state/singleplayer-state";
import {
  buildPlayerBaselineAudit,
  createNewGameFromPlayerBaseline,
  ensurePlayerBaselines,
  resetSavePlayersToBaseline,
} from "@/lib/players/player-baseline-service";

describe("player baseline service", () => {
  it("creates a baseline for every imported player", () => {
    const gameState = createFreshSeasonOneGameState();
    const audit = buildPlayerBaselineAudit(gameState);

    expect(audit.summary.playerCount).toBeGreaterThan(0);
    expect(audit.summary.baselineCount).toBe(audit.summary.playerCount);
    expect(audit.summary.missingBaselineCount).toBe(0);
    expect(audit.summary.baselineVersions).toEqual(["player-baseline-v1"]);
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
