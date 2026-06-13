import { describe, expect, it } from "vitest";

import {
  buildNewGameStateFromBaseline,
  previewNewGameSetup,
} from "@/lib/game/new-game-setup-service";

describe("new-game-setup-service", () => {
  it("creates a Solo 1 preview with one Chris team and AI rest", () => {
    const preview = previewNewGameSetup({ presetId: "solo_1", now: "2026-06-13T10:00:00.000Z" });

    expect(preview.blockers).toEqual([]);
    expect(preview.counts.chris).toBe(1);
    expect(preview.counts.franky).toBe(0);
    expect(preview.counts.ai).toBe(31);
    expect(preview.chrisTeamIds).toEqual(["M-M"]);
    expect(preview.room.enabled).toBe(false);
  });

  it("creates a Solo 4 preview with four local human teams", () => {
    const preview = previewNewGameSetup({ presetId: "solo_4", now: "2026-06-13T10:00:00.000Z" });

    expect(preview.counts.chris).toBe(4);
    expect(preview.chrisTeamIds).toEqual(["P-S", "D-P", "M-M", "V-W"]);
    expect(preview.frankyTeamIds).toEqual([]);
  });

  it("creates Online 4v4 with Chris, Franky and AI ownership metadata", () => {
    const { gameState, preview } = buildNewGameStateFromBaseline({
      presetId: "online_4v4",
      now: "2026-06-13T10:00:00.000Z",
      saveId: "save-new-game-test",
    });

    expect(preview.counts).toMatchObject({ chris: 4, franky: 4, ai: 24, passive: 0, total: 32 });
    expect(preview.chrisTeamIds).toEqual(["P-S", "D-P", "M-M", "V-W"]);
    expect(preview.frankyTeamIds).toEqual(["M-S", "P-C", "C-S", "G-G"]);
    expect(gameState.scenarioMeta?.roomCode).toMatch(/^NEW-/);
    expect(gameState.scenarioMeta?.roomParticipants?.map((participant) => participant.displayName)).toEqual(["Chris", "Franky"]);
    expect(gameState.scenarioMeta?.teamOwnership?.filter((entry) => entry.controllerType === "human")).toHaveLength(8);
    expect(gameState.seasonState.teamControlSettings?.["M-M"]?.ownerId).toBe("user_local");
    expect(gameState.seasonState.teamControlSettings?.["M-S"]?.ownerId).toBe("franky_remote_placeholder");
    expect(gameState.seasonState.teamControlSettings?.["A-A"]?.controlMode).toBe("ai");
  });

  it("uses immutable baseline state and clears mutable season history for a new game", () => {
    const { gameState, preview } = buildNewGameStateFromBaseline({
      presetId: "solo_1",
      now: "2026-06-13T10:00:00.000Z",
    });

    expect(preview.baseline.baselineCount).toBe(preview.baseline.playerCount);
    expect(preview.baseline.resetPlayers).toBe(preview.baseline.playerCount);
    expect(gameState.players.every((player) => (player.currentXP ?? 0) === 0)).toBe(true);
    expect(gameState.players.every((player) => (player.spentXP ?? 0) === 0)).toBe(true);
    expect(gameState.players.every((player) => player.lifetimeXP == null)).toBe(true);
    expect(gameState.players.every((player) => (player.fatigue ?? 0) === 0)).toBe(true);
    const proofPlayer = gameState.players.find((player) => player.attributeSheetStats?.power != null)!;
    const proofBaseline = gameState.playerBaselines?.find((baseline) => baseline.playerId === proofPlayer.id)!;
    expect(proofPlayer.attributeSheetStats?.power).toBe(proofBaseline.attributes.power);
    expect(proofPlayer.currentDisciplineValues).toEqual(proofBaseline.disciplineRatings);
    expect(proofPlayer.marketValue).toBe(proofBaseline.marketValue);
    expect(proofPlayer.salaryDemand).toBe(proofBaseline.salary);
    expect(gameState.transferHistory).toEqual([]);
    expect(gameState.rosters).toEqual([]);
    expect(gameState.contracts).toEqual([]);
    expect(gameState.playerProgressionEvents).toEqual([]);
    expect(gameState.seasonState.formCards).toEqual([]);
    expect(gameState.seasonState.lineupDrafts).toEqual([]);
    expect(gameState.seasonState.matchdayResults).toEqual([]);
    expect(gameState.seasonState.seasonSnapshots).toEqual([]);
  });

  it("sets Season 1 setup and start ranks from real start budgets", () => {
    const { gameState, preview } = buildNewGameStateFromBaseline({
      presetId: "solo_1",
      now: "2026-06-13T10:00:00.000Z",
    });

    expect(gameState.gamePhase).toBe("preseason_management");
    expect(gameState.season.id).toBe("season-1");
    expect(gameState.season.currentMatchday).toBe(1);
    expect(gameState.matchdayState.status).toBe("planning");
    expect(gameState.seasonState.standings["M-M"]?.startplatz).toBe(1);
    expect(gameState.seasonState.standings["M-M"]?.rank).toBe(1);
    expect(gameState.seasonState.standings["R-R"]?.startplatz).toBe(32);
    expect(preview.teams.find((team) => team.teamId === "M-M")?.budget).toBe(325);
    expect(preview.teams.find((team) => team.teamId === "R-R")?.budget).toBe(170);
  });
});
