import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createSaveGameState, loadFreshSeasonOneSeedData } from "@/lib/data/dataAdapter";
import type { GameState } from "@/lib/data/olyDataTypes";
import {
  CHUNKED_REDRAFT_TOPUP_CONFIRM_TOKEN,
  computePreferredAxisFit,
  computeRedraftScoreVariance,
  getPlayerAxisValue,
  runChunkedRedraftTopup,
} from "@/lib/ai/chunked-redraft-topup-service";
import { calculateThemeCompositionScore, derivePlayerThemeTags, getTeamThemeCompositionTarget } from "@/lib/ai/team-theme-composition-service";
import type { PersistedSaveGame, PersistenceBootstrapResult, PersistenceService, SaveSummary } from "@/lib/persistence/types";
import { describe, expect, it } from "vitest";

function createInMemoryPersistence(initialSave: PersistedSaveGame): PersistenceService {
  let currentSave = structuredClone(initialSave);
  return {
    bootstrapSingleplayerSave(): PersistenceBootstrapResult {
      return { save: currentSave, createdFromSeed: false };
    },
    getActiveSave() {
      return currentSave;
    },
    getSaveById(saveId: string) {
      return saveId === currentSave.saveId ? currentSave : null;
    },
    saveSingleplayerState(saveId: string, gameState: GameState) {
      if (saveId !== currentSave.saveId) {
        throw new Error(`Unknown save ${saveId}`);
      }
      currentSave = {
        ...currentSave,
        updatedAt: new Date().toISOString(),
        gameState: structuredClone(gameState),
      };
      return currentSave;
    },
    createSave() {
      throw new Error("Test persistence does not create saves.");
    },
    createFreshSeasonOneSave() {
      throw new Error("Test persistence does not create fresh saves.");
    },
    cloneSave() {
      throw new Error("Test persistence does not clone saves.");
    },
    createScenarioSnapshot() {
      throw new Error("Test persistence does not create snapshots.");
    },
    activateSave() {
      return currentSave;
    },
    listSaves(): SaveSummary[] {
      return [
        {
          saveId: currentSave.saveId,
          name: currentSave.name,
          status: currentSave.status,
          createdAt: currentSave.createdAt,
          updatedAt: currentSave.updatedAt,
          scenarioMeta: currentSave.gameState.scenarioMeta,
        },
      ];
    },
  };
}

function createSmallEmptySeasonOneSave(): PersistedSaveGame {
  const seed = loadFreshSeasonOneSeedData();
  const teamIds = seed.teams.slice(0, 2).map((team) => team.teamId);
  const smallSeed = {
    ...seed,
    teams: seed.teams
      .filter((team) => teamIds.includes(team.teamId))
      .map((team) => ({
        ...team,
        cash: 250,
        rosterLimit: 4,
      })),
    teamIdentities: seed.teamIdentities
      .filter((identity) => teamIds.includes(identity.teamId))
      .map((identity) => ({
        ...identity,
        playerMin: 2,
        playerOpt: 2,
      })),
    players: seed.players.slice(0, 12).map((player) => ({
      ...player,
      marketValue: Math.min(player.marketValue ?? 20, 40),
      salaryDemand: Math.min(player.salaryDemand ?? 5, 8),
    })),
    rosters: [],
    contracts: [],
    transferHistory: [],
  };
  return {
    ...createSaveGameState("chunked-topup-test-save", smallSeed),
    name: "Chunked Topup Test",
    status: "active",
  };
}

function duplicatePlayerIds(save: PersistedSaveGame) {
  const counts = new Map<string, number>();
  for (const roster of save.gameState.rosters) {
    counts.set(roster.playerId, (counts.get(roster.playerId) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, count]) => count > 1);
}

describe("chunked redraft topup service", () => {
  it("uses player coreStats for draft axes instead of treating OVR as every axis", () => {
    const seed = loadFreshSeasonOneSeedData();
    const zaza = seed.players.find((player) => player.id === "player-2818-zaza-stardust");
    const mayhemIdentity = seed.teamIdentities.find((identity) => identity.teamId === "M-M");

    expect(zaza).toBeDefined();
    expect(mayhemIdentity).toBeDefined();
    expect(getPlayerAxisValue(zaza!, "pow")).toBe(52.39);
    expect(getPlayerAxisValue(zaza!, "spe")).toBe(61.36);
    expect(getPlayerAxisValue(zaza!, "men")).toBe(71.03);
    expect(getPlayerAxisValue(zaza!, "soc")).toBe(87.57);
    const zazaAxes = {
      quality: 100,
      pow: getPlayerAxisValue(zaza!, "pow"),
      spe: getPlayerAxisValue(zaza!, "spe"),
      men: getPlayerAxisValue(zaza!, "men"),
      soc: getPlayerAxisValue(zaza!, "soc"),
    };
    expect(
      computePreferredAxisFit(zazaAxes, mayhemIdentity),
    ).toBe(57.44);
  });

  it("does not treat Zaza Stardust as an M-M premium identity fit", () => {
    const seed = loadFreshSeasonOneSeedData();
    const zaza = seed.players.find((player) => player.id === "player-2818-zaza-stardust");
    const mayhem = seed.teams.find((team) => team.teamId === "M-M");
    const target = getTeamThemeCompositionTarget("M-M");

    expect(zaza).toBeDefined();
    expect(mayhem).toBeDefined();
    expect(target?.avoidTags).toEqual(expect.arrayContaining(["Bard", "Social", "Royal"]));

    const tags = derivePlayerThemeTags(zaza!);
    expect(tags.playerThemeTags).toEqual(expect.arrayContaining(["Bard", "Social"]));

    const gameState = createSaveGameState("theme-test", seed).gameState;
    const themeScore = calculateThemeCompositionScore({
      gameState: { ...gameState, rosters: [] },
      team: mayhem!,
      player: zaza!,
      candidateQuality: 57.44,
      candidateRoleFit: 0,
      phase: "phase_b_core_optimum",
    });
    expect(themeScore.themeTier).toBe("avoid");
  });

  it("does not use OVR, MVS or market value as draft attractiveness score", () => {
    const serviceText = fs.readFileSync(path.join(process.cwd(), "lib/ai/chunked-redraft-topup-service.ts"), "utf8");

    expect(serviceText).not.toContain("premiumSignal");
    expect(serviceText).not.toContain("candidate.quality *");
    expect(serviceText).not.toContain("input.candidate.quality *");
    expect(serviceText).not.toContain("marketValue *");
    expect(serviceText).not.toContain("right.quality");
    expect(serviceText).not.toContain("left.marketValue");
    expect(serviceText).not.toContain("candidateQuality: input.candidate.quality");
    expect(serviceText).not.toContain("return roundValue(candidate.quality");
  });

  it("keeps draft score variance stable per save but different between fresh redraft saves", () => {
    const first = computeRedraftScoreVariance({
      draftSalt: "fresh-save-a:full_clean_redraft",
      teamId: "W-W",
      playerId: "player-1519-lord-belqua",
      phase: "phase_b_core_optimum",
    });
    const same = computeRedraftScoreVariance({
      draftSalt: "fresh-save-a:full_clean_redraft",
      teamId: "W-W",
      playerId: "player-1519-lord-belqua",
      phase: "phase_b_core_optimum",
    });
    const nextSave = computeRedraftScoreVariance({
      draftSalt: "fresh-save-b:full_clean_redraft",
      teamId: "W-W",
      playerId: "player-1519-lord-belqua",
      phase: "phase_b_core_optimum",
    });

    expect(first).toBe(same);
    expect(nextSave).not.toBe(first);
    expect(Math.abs(first)).toBeLessThanOrEqual(11);
    expect(Math.abs(nextSave)).toBeLessThanOrEqual(11);
  });

  it("fills empty S1 rosters through the local buy path without duplicate players", () => {
    const save = createSmallEmptySeasonOneSave();
    const persistence = createInMemoryPersistence(save);
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "chunked-topup-test-"));

    const result = runChunkedRedraftTopup({
      persistence,
      saveId: save.saveId,
      seasonId: "season-1",
      dryRun: false,
      confirmToken: CHUNKED_REDRAFT_TOPUP_CONFIRM_TOKEN,
      mode: "season1_initial_topup",
      target: "playerMin",
      roundLimit: 3,
      outputDir,
    });

    const finalSave = persistence.getSaveById(save.saveId);
    expect(finalSave).not.toBeNull();
    expect(result.summary.startWasEmpty).toBe(true);
    expect(result.summary.teamsBelowMin).toEqual([]);
    expect(result.summary.duplicatePlayers).toEqual([]);
    expect(result.summary.negativeCashTeams).toEqual([]);
    expect(finalSave?.gameState.rosters).toHaveLength(result.picks.length);
    expect(finalSave?.gameState.transferHistory).toHaveLength(result.picks.length);
    expect(duplicatePlayerIds(finalSave!)).toEqual([]);
    expect(fs.existsSync(path.join(outputDir, "chunked-redraft-summary.json"))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, "topup-memory-audit.md"))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, "redraft-progress-log.csv"))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, "redraft-candidate-counters.csv"))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, "redraft-first-pick-debug.md"))).toBe(true);
  });

  it("writes progress logs and candidate counters during a dry first-pick proof", () => {
    const save = createSmallEmptySeasonOneSave();
    const persistence = createInMemoryPersistence(save);
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "chunked-first-pick-proof-"));

    const result = runChunkedRedraftTopup({
      persistence,
      saveId: save.saveId,
      seasonId: "season-1",
      dryRun: true,
      mode: "full_clean_redraft",
      target: "playerMin",
      roundLimit: 1,
      maxTeams: 1,
      outputDir,
    });

    const progressLog = fs.readFileSync(path.join(outputDir, "redraft-progress-log.csv"), "utf8");
    const counters = JSON.parse(`[${fs.readFileSync(path.join(outputDir, "redraft-candidate-counters.csv"), "utf8").trim().split("\n").slice(1).join("\n")}]`);
    expect(result.picks.length).toBeGreaterThan(0);
    expect(progressLog).toContain("runner_start");
    expect(progressLog).toContain("candidate_stage0_start");
    expect(progressLog).toContain("pick_selected");
    expect(fs.existsSync(path.join(outputDir, "redraft-first-team-trace.json"))).toBe(true);
    expect(counters.length).toBeGreaterThan(0);
  });

  it("aborts with a blocker report when the watchdog threshold is exceeded", () => {
    const save = createSmallEmptySeasonOneSave();
    const persistence = createInMemoryPersistence(save);
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "chunked-watchdog-test-"));

    expect(() =>
      runChunkedRedraftTopup({
        persistence,
        saveId: save.saveId,
        seasonId: "season-1",
        dryRun: true,
        mode: "full_clean_redraft",
        target: "playerMin",
        roundLimit: 1,
        maxTeams: 1,
        watchdogMs: 0,
        outputDir,
      }),
    ).toThrow("phase_watchdog_timeout");
    expect(fs.existsSync(path.join(outputDir, "redraft-first-pick-blocker.md"))).toBe(true);
  });

  it("runs one round with at least one and at most one pick per team", () => {
    const save = createSmallEmptySeasonOneSave();
    const persistence = createInMemoryPersistence(save);
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "chunked-one-round-proof-"));

    const result = runChunkedRedraftTopup({
      persistence,
      saveId: save.saveId,
      seasonId: "season-1",
      dryRun: false,
      confirmToken: CHUNKED_REDRAFT_TOPUP_CONFIRM_TOKEN,
      mode: "season1_initial_topup",
      target: "playerOpt",
      roundLimit: 1,
      outputDir,
    });

    expect(result.picks.length).toBeGreaterThan(0);
    expect(result.picks.length).toBeLessThanOrEqual(save.gameState.teams.length);
    expect(result.summary.duplicatePlayers).toEqual([]);
  });

  it("keeps theme scoring bounded for a single-team first-pick proof", () => {
    const save = createSmallEmptySeasonOneSave();
    const persistence = createInMemoryPersistence(save);
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "chunked-theme-counter-test-"));

    runChunkedRedraftTopup({
      persistence,
      saveId: save.saveId,
      seasonId: "season-1",
      dryRun: true,
      mode: "full_clean_redraft",
      target: "playerMin",
      roundLimit: 1,
      maxTeams: 1,
      outputDir,
    });

    const countersCsv = fs.readFileSync(path.join(outputDir, "redraft-candidate-counters.csv"), "utf8");
    const [headerLine, valueLine] = countersCsv.trim().split("\n");
    const headers = headerLine.split(",");
    const values = valueLine.split(",");
    const row = Object.fromEntries(headers.map((header, index) => [header, Number(values[index])]));
    expect(row.themeScoreCalls).toBeGreaterThan(0);
    expect(row.themeScoreCalls).toBeLessThanOrEqual(row.freeAgentsStart);
    expect(row.buyPreviewCalls).toBeLessThanOrEqual(24);
  });

  it("resumes from a completed round without duplicating previous picks", () => {
    const save = createSmallEmptySeasonOneSave();
    const persistence = createInMemoryPersistence(save);
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "chunked-topup-resume-test-"));

    const firstRun = runChunkedRedraftTopup({
      persistence,
      saveId: save.saveId,
      seasonId: "season-1",
      dryRun: false,
      confirmToken: CHUNKED_REDRAFT_TOPUP_CONFIRM_TOKEN,
      mode: "season1_initial_topup",
      target: "playerMin",
      roundLimit: 1,
      outputDir,
    });

    const secondRun = runChunkedRedraftTopup({
      persistence,
      saveId: save.saveId,
      seasonId: "season-1",
      dryRun: false,
      confirmToken: CHUNKED_REDRAFT_TOPUP_CONFIRM_TOKEN,
      mode: "season1_initial_topup",
      resume: true,
      target: "playerMin",
      roundLimit: 3,
      outputDir,
    });

    const finalSave = persistence.getSaveById(save.saveId);
    expect(firstRun.picks.length).toBeGreaterThan(0);
    expect(secondRun.summary.resumeTested).toBe(true);
    expect(secondRun.summary.duplicatePlayers).toEqual([]);
    expect(duplicatePlayerIds(finalSave!)).toEqual([]);
    expect(finalSave?.gameState.transferHistory.map((entry) => entry.playerId).sort()).toEqual(
      finalSave?.gameState.rosters.map((entry) => entry.playerId).sort(),
    );
  });

  it("plans playerOpt by default and enters phase B after playerMin", () => {
    const save = createSmallEmptySeasonOneSave();
    save.gameState.teamIdentities = save.gameState.teamIdentities.map((identity) => ({
      ...identity,
      playerMin: 1,
      playerOpt: 2,
    }));
    const persistence = createInMemoryPersistence(save);
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "chunked-topup-phase-b-test-"));

    const result = runChunkedRedraftTopup({
      persistence,
      saveId: save.saveId,
      seasonId: "season-1",
      dryRun: false,
      confirmToken: CHUNKED_REDRAFT_TOPUP_CONFIRM_TOKEN,
      mode: "season1_initial_topup",
      target: "playerOpt",
      roundLimit: 3,
      outputDir,
    });

    const targetPlan = JSON.parse(fs.readFileSync(path.join(outputDir, "roster-target-plan.json"), "utf8")) as Array<{
      desiredRosterTarget: number;
      playerOpt: number;
      targetMode: string;
    }>;
    expect(targetPlan.every((row) => row.desiredRosterTarget === row.playerOpt)).toBe(true);
    expect(targetPlan.every((row) => row.targetMode.length > 0)).toBe(true);
    expect(result.picks.some((pick) => pick.phase === "phase_b_core_optimum")).toBe(true);
    expect(fs.existsSync(path.join(outputDir, "underopt-stop-audit.csv"))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, "team-readiness-score.csv"))).toBe(true);
  });

  it("exports distinct manager AI plans for key identity teams", () => {
    const seed = loadFreshSeasonOneSeedData();
    const save: PersistedSaveGame = {
      ...createSaveGameState("chunked-manager-ai-test-save", {
        ...seed,
        rosters: [],
        contracts: [],
        transferHistory: [],
      }),
      name: "Chunked Manager AI Test",
      status: "active",
    };
    const persistence = createInMemoryPersistence(save);
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "chunked-manager-ai-test-"));

    const result = runChunkedRedraftTopup({
      persistence,
      saveId: save.saveId,
      seasonId: "season-1",
      dryRun: true,
      mode: "full_clean_redraft",
      target: "playerOpt",
      roundLimit: 1,
      maxTeams: 1,
      outputDir,
    });

    const profiles = JSON.parse(
      fs.readFileSync(path.join(outputDir, "chunked-redraft-summary.json"), "utf8"),
    ) as { draftValid: boolean };
    const profileCsv = fs.readFileSync(path.join(outputDir, "manager-ai-profile-preview.csv"), "utf8");
    const strategyCsv = fs.readFileSync(path.join(outputDir, "season-strategy-plan.csv"), "utf8");
    const blueprintCsv = fs.readFileSync(path.join(outputDir, "roster-blueprint-plan.csv"), "utf8");
    const managerPickAudit = fs.readFileSync(path.join(outputDir, "manager-pick-audit.csv"), "utf8");

    expect(result.picks.length).toBeGreaterThan(0);
    expect(profiles.draftValid).toBe(false);
    expect(profileCsv).toContain("M-M");
    expect(profileCsv).toContain("win_now");
    expect(profileCsv).toContain("B-P");
    expect(profileCsv).toContain("small_elite");
    expect(profileCsv).toContain("C-C");
    expect(profileCsv).toContain("value_builder");
    expect(profileCsv).toContain("W-W");
    expect(profileCsv).toContain("theme_collector");
    expect(profileCsv).toContain("Z-H");
    expect(profileCsv).toContain("chaotic_aggressive");
    expect(strategyCsv).toContain("win_now_push");
    expect(blueprintCsv).toContain("desiredRosterTarget");
    expect(managerPickAudit).toContain("marketBoardTier");
    expect(fs.existsSync(path.join(outputDir, "market-board-preview.csv"))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, "manager-stop-reasons.csv"))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, "manager-ai-redraft-summary.md"))).toBe(true);
  }, 20_000);

  it("rejects season1_autoprep_topup after season 1", () => {
    const save = createSmallEmptySeasonOneSave();
    save.gameState.season = {
      ...save.gameState.season,
      id: "season-2",
      name: "Season 2",
      year: 2,
    };
    const persistence = createInMemoryPersistence(save);

    expect(() =>
      runChunkedRedraftTopup({
        persistence,
        saveId: save.saveId,
        seasonId: "season-2",
        dryRun: false,
        confirmToken: CHUNKED_REDRAFT_TOPUP_CONFIRM_TOKEN,
        mode: "season1_initial_topup",
      }),
    ).toThrow("season1_autoprep_topup_forbidden_after_s1:season-2");
  });

  it("requires a confirm token for write mode", () => {
    const save = createSmallEmptySeasonOneSave();
    const persistence = createInMemoryPersistence(save);

    expect(() =>
      runChunkedRedraftTopup({
        persistence,
        saveId: save.saveId,
        seasonId: "season-1",
        dryRun: false,
        confirmToken: null,
        mode: "season1_initial_topup",
      }),
    ).toThrow("chunked_redraft_confirm_token_required");
  });
});
