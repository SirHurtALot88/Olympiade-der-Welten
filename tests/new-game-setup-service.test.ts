import { describe, expect, it } from "vitest";

import {
  buildNewGameStateFromBaseline,
  previewNewGameSetup,
} from "@/lib/game/new-game-setup-service";
import { resolveFoundationSaveMode } from "@/lib/persistence/foundation-save-mode";
import { getTeamSponsorContract, getTeamSponsorOffers } from "@/lib/sponsor/sponsor-offer-service";

describe("new-game-setup-service", () => {
  it("creates a Solo 1 preview with one Chris team and AI rest", () => {
    const preview = previewNewGameSetup({ presetId: "solo_1", now: "2026-06-13T10:00:00.000Z" });

    expect(preview.blockers).toEqual([]);
    expect(preview.counts.chris).toBe(1);
    expect(preview.counts.franky).toBe(0);
    expect(preview.counts.ai).toBe(31);
    expect(preview.chrisTeamIds).toEqual(["M-M"]);
    expect(preview.room.enabled).toBe(false);
  }, 120_000);

  it("creates a Solo 4 preview with four local human teams", () => {
    const { gameState, preview } = buildNewGameStateFromBaseline({ presetId: "solo_4", now: "2026-06-13T10:00:00.000Z" });

    expect(preview.counts.chris).toBe(4);
    expect(preview.chrisTeamIds).toEqual(["P-S", "D-P", "M-M", "V-W"]);
    expect(preview.frankyTeamIds).toEqual([]);
    expect(gameState.scenarioMeta?.saveMode).toBe("solo_4");
    expect(gameState.scenarioMeta?.humanControlledTeamCount).toBe(4);
    expect(resolveFoundationSaveMode({ gameState })).toBe("solo_4");
  }, 120_000);

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
    expect(gameState.scenarioMeta?.saveMode).toBe("online_4v4");
    expect(gameState.scenarioMeta?.roomParticipants?.map((participant) => participant.displayName)).toEqual(["Chris", "Franky"]);
    expect(gameState.scenarioMeta?.teamOwnership?.filter((entry) => entry.controllerType === "human")).toHaveLength(8);
    expect(gameState.seasonState.teamControlSettings?.["M-M"]?.ownerId).toBe("user_local");
    expect(gameState.seasonState.teamControlSettings?.["M-S"]?.ownerId).toBe("franky_remote_placeholder");
    expect(gameState.seasonState.teamControlSettings?.["A-A"]?.controlMode).toBe("ai");
    expect(resolveFoundationSaveMode({ gameState })).toBe("online_4v4");
  }, 120_000);

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
  }, 120_000);

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
  }, 120_000);

  it("seeds sponsor offers for the human team so the choose_sponsor step has real cards to show", () => {
    const { gameState } = buildNewGameStateFromBaseline({
      presetId: "solo_1",
      now: "2026-06-13T10:00:00.000Z",
    });

    const chooseSponsorStep = gameState.seasonState.newGameFlow?.steps?.find(
      (step) => step.stepId === "choose_sponsor",
    );
    expect(chooseSponsorStep?.status).toBe("open");
    expect(getTeamSponsorContract(gameState, "M-M")).toBeNull();

    const offers = getTeamSponsorOffers(gameState, "M-M");
    expect(offers).toHaveLength(3);
    expect(new Set(offers.map((offer) => offer.archetype)).size).toBe(3);
    expect(offers.every((offer) => offer.seasonId === gameState.season.id)).toBe(true);

    // Deterministic: rebuilding from the same baseline input yields identical offer ids, not a
    // reshuffled set — this is what makes it safe to (re)generate on load without persisting.
    const second = buildNewGameStateFromBaseline({
      presetId: "solo_1",
      now: "2026-06-13T10:00:00.000Z",
    });
    const offersAgain = getTeamSponsorOffers(second.gameState, "M-M");
    expect(offersAgain.map((offer) => offer.offerId)).toEqual(offers.map((offer) => offer.offerId));
  }, 120_000);
});
