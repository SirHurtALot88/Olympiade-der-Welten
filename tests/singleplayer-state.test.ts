import { beforeEach, describe, expect, it } from "vitest";

import {
  applyAiTurn,
  createFreshSeasonOneGameState,
  createSingleplayerGameState,
} from "@/lib/game-state/singleplayer-state";
import { deriveTeamIdentityAxisBias } from "@/lib/foundation/team-identity-settings";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { allowsSandboxTestWrites, getSandboxLocalWritePolicy } from "@/lib/persistence/sandbox-write-permissions";
import { getDatabase, getDatabasePath, resetDatabaseForTests } from "@/lib/persistence/sqlite";

beforeEach(() => {
  resetDatabaseForTests();
});

describe("singleplayer game state", () => {
  it("creates base state with season and logs", () => {
    const gameState = createSingleplayerGameState();

    expect(gameState.season.id).toBe("season-1");
    expect(gameState.logs.length).toBeGreaterThan(0);
    expect(gameState.teams[0]?.logoPath).toBeTruthy();
    expect(gameState.players[0]?.portraitPath).toBeTruthy();
    expect(gameState.teams.find((team) => team.teamId === "A-A")?.budget).toBe(175);
    expect(gameState.teams.find((team) => team.teamId === "B-P")?.budget).toBe(275);
    expect(gameState.teams.find((team) => team.teamId === "A-A")?.cash).toBe(175);
    expect(gameState.teams.find((team) => team.teamId === "B-P")?.cash).toBe(275);
  });

  it("appends logs after ai turn", () => {
    const gameState = createSingleplayerGameState();
    const nextState = applyAiTurn(gameState, "B-B");

    expect(nextState.logs.length).toBeGreaterThan(gameState.logs.length);
  });

  it("bootstraps a sqlite save and reloads persisted changes", () => {
    const persistence = createPersistenceService();
    const first = persistence.bootstrapSingleplayerSave();

    expect(first.createdFromSeed).toBe(true);

    const gameState = createSingleplayerGameState();
    const firstTeamId = gameState.teams[0]!.teamId;
    gameState.teams[0]!.cash += 123;
    persistence.saveSingleplayerState(first.save.saveId, gameState);

    const second = persistence.getActiveSave();
    expect(second?.gameState.teams.find((team) => team.teamId === firstTeamId)?.cash).toBe(
      gameState.teams[0]!.cash,
    );
    expect(second?.gameState.teams[0]?.logoPath).toBeTruthy();
    expect(second?.gameState.players[0]?.portraitPath).toBeTruthy();
    expect(persistence.listSaves().length).toBeGreaterThan(0);
    expect(getDatabasePath()).toContain("oly-app");
  });

  it("normalizes legacy 10-player roster limits from season management targets", () => {
    const persistence = createPersistenceService();
    const first = persistence.bootstrapSingleplayerSave();
    const gameState = createFreshSeasonOneGameState();

    const cashCreatorsIdentity = gameState.teamIdentities.find((identity) => identity.teamId === "C-C");
    expect(cashCreatorsIdentity?.playerMin).toBe(11);
    expect(cashCreatorsIdentity?.playerOpt).toBe(12);

    gameState.teams = gameState.teams.map((team) =>
      team.teamId === "C-C"
        ? {
            ...team,
            rosterLimit: 10,
            rosterMinTarget: undefined,
            rosterOptTarget: undefined,
          }
        : team,
    );

    persistence.saveSingleplayerState(first.save.saveId, gameState);

    const reloaded = persistence.getSaveById(first.save.saveId);
    const cashCreators = reloaded?.gameState.teams.find((team) => team.teamId === "C-C");
    expect(cashCreators?.rosterLimit).toBe(12);
    expect(cashCreators?.rosterMinTarget).toBe(11);
    expect(cashCreators?.rosterOptTarget).toBe(12);
  });

  it("persists top-level season transition metadata across sqlite reloads", () => {
    const persistence = createPersistenceService();
    const first = persistence.bootstrapSingleplayerSave();
    const nextState = {
      ...first.save.gameState,
      gamePhase: "season_review" as const,
      seasonTransition: {
        transitionId: "transition-test",
        fromSeasonId: "season-1",
        toSeasonId: "season-2",
        currentStep: "season_review",
        status: "preview" as const,
        completedSteps: ["season_check"],
        warnings: ["test_warning"],
        errors: [],
        createdAt: "2026-06-11T00:00:00.000Z",
      },
      seasonReviewState: { selectedAwardId: "champion" },
      preSeasonWorkflowState: { currentStep: "finances" },
    };

    persistence.saveSingleplayerState(first.save.saveId, nextState);
    const reloaded = persistence.getSaveById(first.save.saveId);
    const metadata = getDatabase()
      .prepare("SELECT payload_json FROM game_metadata WHERE save_id = ?")
      .get(first.save.saveId) as { payload_json: string } | undefined;

    expect(reloaded?.gameState.gamePhase).toBe("season_review");
    expect(reloaded?.gameState.seasonTransition?.currentStep).toBe("season_review");
    expect(reloaded?.gameState.seasonTransition?.completedSteps).toEqual(["season_check"]);
    expect(reloaded?.gameState.seasonReviewState).toEqual({ selectedAwardId: "champion" });
    expect(reloaded?.gameState.preSeasonWorkflowState).toEqual({ currentStep: "finances" });
    expect(metadata ? JSON.parse(metadata.payload_json) : null).toMatchObject({
      transitionStatus: "preview",
      currentStep: "season_review",
      completedSteps: ["season_check"],
    });
  });

  it("persists scenario meta and exposes it in save summaries", () => {
    const persistence = createPersistenceService();
    const first = persistence.bootstrapSingleplayerSave();
    persistence.saveSingleplayerState(first.save.saveId, {
      ...first.save.gameState,
      gamePhase: "season_completed",
      scenarioMeta: {
        scenarioType: "season1_completed",
        label: "Season 1 Sim Complete",
        description: "Test snapshot",
        createdAt: "2026-06-12T00:00:00.000Z",
        sourceSaveId: "source-save",
        isStableTestPoint: true,
        containsFinalStandings: true,
        containsSeasonHistory: true,
        activeSeasonId: "season-1",
        activeMatchday: 10,
        gamePhase: "season_completed",
      },
    });

    const reloaded = persistence.getSaveById(first.save.saveId);
    const summary = persistence.listSaves().find((save) => save.saveId === first.save.saveId);

    expect(reloaded?.gameState.scenarioMeta?.scenarioType).toBe("season1_completed");
    expect(reloaded?.gameState.scenarioMeta?.label).toBe("Season 1 Sim Complete");
    expect(summary?.scenarioMeta?.scenarioType).toBe("season1_completed");
    expect(summary?.scenarioMeta?.isStableTestPoint).toBe(true);
  });

  it("persists player baselines and restores missing legacy baselines from seed source on reload", () => {
    const persistence = createPersistenceService();
    const first = persistence.bootstrapSingleplayerSave();
    const player =
      first.save.gameState.players.find((entry) => typeof entry.attributeSheetStats?.power === "number") ??
      first.save.gameState.players[0]!;
    const baselinePower = player.attributeSheetStats?.power;

    persistence.saveSingleplayerState(first.save.saveId, {
      ...first.save.gameState,
      playerBaselines: undefined,
      players: first.save.gameState.players.map((entry) =>
        entry.id === player.id
          ? {
              ...entry,
              attributeSheetStats: { ...(entry.attributeSheetStats ?? {}), power: 99 },
            }
          : entry,
      ),
    });

    const reloaded = persistence.getSaveById(first.save.saveId);
    const baseline = reloaded?.gameState.playerBaselines?.find((entry) => entry.playerId === player.id);

    expect(reloaded?.gameState.playerBaselines).toHaveLength(reloaded?.gameState.players.length ?? 0);
    expect(baseline?.attributes.power).toBe(baselinePower);
    expect(baseline?.reconstructionWarning).toBeUndefined();
  });

  it("persists sandbox scenario meta and exposes local write permission without changing safety rules", () => {
    const persistence = createPersistenceService();
    const first = persistence.bootstrapSingleplayerSave();
    persistence.saveSingleplayerState(first.save.saveId, {
      ...first.save.gameState,
      scenarioMeta: {
        scenarioType: "sandbox_multiseason_test",
        label: "Oly Sandbox Multi-Season Test",
        description: "Persistent local sandbox",
        createdAt: "2026-06-12T00:00:00.000Z",
        isStableTestPoint: true,
        allowTestWrites: true,
        containsFinalStandings: false,
        containsSeasonHistory: true,
        activeSeasonId: "season-1",
        activeMatchday: 1,
        gamePhase: "season_active",
      },
    });

    const reloaded = persistence.getSaveById(first.save.saveId);
    const summary = persistence.listSaves().find((save) => save.saveId === first.save.saveId);
    const policy = getSandboxLocalWritePolicy(reloaded);

    expect(reloaded?.gameState.scenarioMeta?.scenarioType).toBe("sandbox_multiseason_test");
    expect(reloaded?.gameState.scenarioMeta?.allowTestWrites).toBe(true);
    expect(summary?.scenarioMeta?.allowTestWrites).toBe(true);
    expect(allowsSandboxTestWrites(reloaded)).toBe(true);
    expect(policy.allowLocalServiceWrites).toBe(true);
    expect(policy.forbidPrismaWrites).toBe(true);
    expect(policy.forbidRemoteWrites).toBe(true);
    expect(policy.forbidDirectInserts).toBe(true);
  });

  it("creates an active scenario snapshot without overwriting the source save", () => {
    const persistence = createPersistenceService();
    const first = persistence.bootstrapSingleplayerSave();
    const snapshot = persistence.createScenarioSnapshot({
      sourceSaveId: first.save.saveId,
      name: "Season 2 Start",
      scenarioMeta: {
        scenarioType: "season2_start",
        label: "Season 2 Start",
        createdAt: "2026-06-12T00:00:00.000Z",
        sourceSaveId: first.save.saveId,
        isStableTestPoint: true,
        containsFinalStandings: false,
        containsSeasonHistory: false,
        activeSeasonId: "season-1",
        activeMatchday: 1,
        gamePhase: "season_active",
      },
    });

    expect(snapshot.saveId).not.toBe(first.save.saveId);
    expect(snapshot.name).toBe("Season 2 Start");
    expect(snapshot.gameState.scenarioMeta?.scenarioType).toBe("season2_start");
    expect(persistence.getActiveSave()?.saveId).toBe(snapshot.saveId);
    expect(persistence.getSaveById(first.save.saveId)?.saveId).toBe(first.save.saveId);
  });

  it("can create an archived sandbox snapshot without switching the active save", () => {
    const persistence = createPersistenceService();
    const first = persistence.bootstrapSingleplayerSave();
    const snapshot = persistence.createScenarioSnapshot({
      sourceSaveId: first.save.saveId,
      name: "Oly Sandbox Before Multi-Season Run",
      status: "archived",
      scenarioMeta: {
        scenarioType: "sandbox_snapshot",
        label: "Oly Sandbox Before Multi-Season Run",
        createdAt: "2026-06-12T00:00:00.000Z",
        sourceSaveId: first.save.saveId,
        isStableTestPoint: true,
        allowTestWrites: false,
        containsFinalStandings: false,
        containsSeasonHistory: false,
        activeSeasonId: "season-1",
        activeMatchday: 1,
        gamePhase: "season_active",
      },
    });

    expect(snapshot.saveId).not.toBe(first.save.saveId);
    expect(snapshot.status).toBe("archived");
    expect(snapshot.gameState.scenarioMeta?.scenarioType).toBe("sandbox_snapshot");
    expect(snapshot.gameState.scenarioMeta?.allowTestWrites).toBe(false);
    expect(persistence.getActiveSave()?.saveId).toBe(first.save.saveId);
  });

  it("infers season_completed for legacy sqlite saves with final result and standings logs", () => {
    const persistence = createPersistenceService();
    const first = persistence.bootstrapSingleplayerSave();
    const finalMatchdayId = first.save.gameState.season.matchdayIds.at(-1) ?? "matchday-10";
    persistence.saveSingleplayerState(first.save.saveId, {
      ...first.save.gameState,
      gamePhase: undefined,
      season: {
        ...first.save.gameState.season,
        currentMatchday: first.save.gameState.season.matchdayIds.length,
      },
      matchdayState: {
        matchdayId: finalMatchdayId,
        status: "resolved",
        pendingTeamIds: [],
        resolvedFixtureIds: [],
      },
      seasonState: {
        ...first.save.gameState.seasonState,
        matchdayResults: [
          {
            id: "legacy-final-result",
            seasonId: first.save.gameState.season.id,
            matchdayId: finalMatchdayId,
            disciplineResults: [],
            teamResults: [],
            createdAt: "2026-06-11T00:00:00.000Z",
          },
        ] as never,
        standingsApplyLogs: [
          {
            id: "legacy-final-standings",
            saveId: first.save.saveId,
            seasonId: first.save.gameState.season.id,
            matchdayId: finalMatchdayId,
            action: "apply",
            payload: {
              idempotencyKey: "legacy-final-standings",
              totalTeams: 32,
              appliedTeams: 32,
              tieGroupsCount: 0,
              previewWarningsCount: 0,
            },
            createdAt: "2026-06-11T00:00:00.000Z",
          },
        ],
      },
    });

    getDatabase().prepare("DELETE FROM game_metadata WHERE save_id = ?").run(first.save.saveId);
    const reloaded = persistence.getSaveById(first.save.saveId);

    expect(reloaded?.gameState.gamePhase).toBe("season_completed");
  });

  it("creates and activates multiple saves", () => {
    const persistence = createPersistenceService();
    const first = persistence.bootstrapSingleplayerSave();
    const second = persistence.createSave("Test Save 2");

    expect(second.saveId).not.toBe(first.save.saveId);
    expect(persistence.listSaves().length).toBe(2);
    expect(persistence.getActiveSave()?.saveId).toBe(second.saveId);

    const activated = persistence.activateSave(first.save.saveId);
    expect(activated?.saveId).toBe(first.save.saveId);
    expect(persistence.getActiveSave()?.saveId).toBe(first.save.saveId);
  });

  it("creates a fresh local season one save without overwriting existing saves", () => {
    const persistence = createPersistenceService();
    const first = persistence.bootstrapSingleplayerSave();
    const fresh = persistence.createFreshSeasonOneSave({ name: "Fresh Season 1 Test" });

    expect(fresh.saveId).toMatch(/^fresh-season-1-/);
    expect(fresh.saveId).not.toBe(first.save.saveId);
    expect(persistence.listSaves().length).toBe(2);
    expect(persistence.getSaveById(first.save.saveId)?.saveId).toBe(first.save.saveId);
    expect(persistence.getActiveSave()?.saveId).toBe(fresh.saveId);
    expect(fresh.gameState.transferHistory).toHaveLength(0);
    expect(fresh.gameState.teams).toHaveLength(32);
    expect(fresh.gameState.season.matchdayIds).toHaveLength(10);
    expect(fresh.gameState.teams.every((team) => team.cash === team.budget)).toBe(true);
    expect(
      Object.values(fresh.gameState.seasonState.standings).every((standing) => (standing.points ?? 0) === 0),
    ).toBe(true);
    expect(fresh.gameState.seasonState.disciplineSchedule).toHaveLength(10);
    expect(fresh.gameState.seasonState.disciplineSchedule?.every((entry) => entry.sourceStatus === "legacy_seed")).toBe(
      true,
    );
    expect(fresh.gameState.seasonState.teamControlSettings).toBeTruthy();
    expect(fresh.gameState.seasonState.teamStrategyProfiles).toBeTruthy();
    for (const team of fresh.gameState.teams) {
      expect(fresh.gameState.seasonState.teamControlSettings?.[team.teamId]?.controlMode).toBe(
        team.humanControlled ? "manual" : "ai",
      );
      expect(fresh.gameState.seasonState.teamStrategyProfiles?.[team.teamId]?.teamId).toBe(team.teamId);
      expect(fresh.gameState.seasonState.teamStrategyProfiles?.[team.teamId]?.teamCode).toBe(team.shortCode);
      expect(fresh.gameState.seasonState.teamStrategyProfiles?.[team.teamId]?.teamName).toBe(team.name);
      expect(fresh.gameState.seasonState.teamStrategyProfiles?.[team.teamId]?.strategyVersion).toBe("v1-local");
      expect(fresh.gameState.seasonState.teamStrategyProfiles?.[team.teamId]?.rosterMinTarget).toBeGreaterThan(0);
      expect(
        (fresh.gameState.seasonState.teamStrategyProfiles?.[team.teamId]?.rosterOptTarget ?? 0) >=
          (fresh.gameState.seasonState.teamStrategyProfiles?.[team.teamId]?.rosterMinTarget ?? 0),
      ).toBe(true);
    }
  });

  it("preloads all 32 local strategy profiles with lore-driven defaults for key teams", () => {
    const fresh = createFreshSeasonOneGameState();
    const profiles = fresh.seasonState.teamStrategyProfiles ?? {};

    expect(Object.keys(profiles)).toHaveLength(32);

    for (const team of fresh.teams) {
      const profile = profiles[team.teamId];
      expect(profile).toBeTruthy();
      expect(profile?.teamId).toBe(team.teamId);
      expect(profile?.teamCode).toBe(team.shortCode);
      expect(profile?.teamName).toBe(team.name);
      expect(profile?.strategySummary.length).toBeGreaterThan(20);
      expect(profile?.buyStyle.length).toBeGreaterThan(10);
      expect(profile?.sellStyle.length).toBeGreaterThan(10);
      expect(profile?.contractStyle.length).toBeGreaterThan(10);
      expect(profile?.rosterStyle.length).toBeGreaterThan(10);
      expect(profile?.bias.cashPriority).toBeGreaterThanOrEqual(1);
      expect(profile?.bias.cashPriority).toBeLessThanOrEqual(10);
      expect(profile?.bias.rosterDepthPreference).toBeGreaterThanOrEqual(1);
      expect(profile?.bias.rosterDepthPreference).toBeLessThanOrEqual(10);
    }

    expect(profiles["C-C"]?.strategySummary).toContain("Bank der Olympiade");
    expect(profiles["C-C"]?.bias.cashPriority).toBe(10);

    expect(profiles["W-W"]?.strategySummary).toContain("Magier");
    expect(profiles["W-W"]?.preferredArchetypes).toContain("mage");

    expect(profiles["D-L"]?.strategySummary).toContain("Human-only");
    expect(profiles["D-L"]?.preferredRaces).toContain("human");

    expect(profiles["Z-H"]?.strategySummary).toContain("Underground");
    expect(profiles["Z-H"]?.bias.riskTolerance).toBe(10);

    expect(profiles["M-M"]?.strategySummary).toContain("Multi-Champion-Topteam");
    expect(profiles["M-M"]?.bias.starPriority).toBe(10);

    expect(profiles["W-L"]?.strategySummary).toContain("Soeldner");
    expect(profiles["W-L"]?.preferredArchetypes).toContain("mercenary");
    expect(profiles["A-A"]?.powBias).toBe(0);
    expect(profiles["A-A"]?.speBias).toBe(90);
    expect(profiles["A-A"]?.menBias).toBe(10);
    expect(profiles["A-A"]?.socBias).toBe(0);
  });

  it("preloads all 32 local team identity ratings from the season management sheet defaults", () => {
    const fresh = createFreshSeasonOneGameState();

    expect(fresh.teamIdentities).toHaveLength(32);

    const armageddon = fresh.teamIdentities.find((entry) => entry.teamId === "A-A");
    const wickedWizards = fresh.teamIdentities.find((entry) => entry.teamId === "W-W");
    const cashCreators = fresh.teamIdentities.find((entry) => entry.teamId === "C-C");
    const zeroHeroes = fresh.teamIdentities.find((entry) => entry.teamId === "Z-H");
    const direLegion = fresh.teamIdentities.find((entry) => entry.teamId === "D-L");
    const wreckingLegionnaires = fresh.teamIdentities.find((entry) => entry.teamId === "W-L");

    expect(armageddon).toMatchObject({
      playerType: "F",
      pow: 0,
      spe: 18,
      men: 2,
      soc: 0,
      sourceNote: "season-management-sheet",
    });
    expect(wickedWizards).toMatchObject({
      playerType: "F",
      pow: 0,
      spe: 0,
      men: 18,
      soc: 2,
      sourceNote: "season-management-sheet",
    });
    expect(cashCreators).toMatchObject({
      playerType: "C",
      finances: 10,
      playerMin: 11,
      playerOpt: 12,
    });
    expect(zeroHeroes?.ambition).toBe(10);
    expect(direLegion).toMatchObject({
      pow: 10,
      spe: 0,
      men: 0,
      soc: 10,
    });
    expect(wreckingLegionnaires).toMatchObject({
      pow: 8,
      spe: 2,
      men: 7,
      soc: 3,
    });
  });

  it("derives strong axis bias percentages from raw team identities", () => {
    const fresh = createFreshSeasonOneGameState();

    const armageddon = deriveTeamIdentityAxisBias(fresh.teamIdentities.find((entry) => entry.teamId === "A-A"));
    const wickedWizards = deriveTeamIdentityAxisBias(fresh.teamIdentities.find((entry) => entry.teamId === "W-W"));
    const socialTeam = deriveTeamIdentityAxisBias(fresh.teamIdentities.find((entry) => entry.teamId === "M-S"));
    const giants = deriveTeamIdentityAxisBias(fresh.teamIdentities.find((entry) => entry.teamId === "T-G"));

    expect(armageddon).toMatchObject({ pow: 0, spe: 90, men: 10, soc: 0, warning: null });
    expect(wickedWizards).toMatchObject({ pow: 0, spe: 0, men: 90, soc: 10, warning: null });
    expect(socialTeam).toMatchObject({ pow: 0, spe: 0, men: 0, soc: 100, warning: null });
    expect(giants).toMatchObject({ pow: 80, spe: 10, men: 10, soc: 0, warning: null });
  });

  it("clones an existing save into a separate active slot", () => {
    const persistence = createPersistenceService();
    const first = persistence.bootstrapSingleplayerSave();
    const nextState = createSingleplayerGameState();
    nextState.teams[0]!.cash += 456;
    persistence.saveSingleplayerState(first.save.saveId, nextState);

    const clone = persistence.cloneSave(first.save.saveId, "Clone Save");
    expect(clone.saveId).not.toBe(first.save.saveId);
    expect(clone.gameState.teams[0]!.cash).toBe(nextState.teams[0]!.cash);
    expect(persistence.getActiveSave()?.saveId).toBe(clone.saveId);
  });

  it("creates a fresh season one game state with clean transfer history", () => {
    const gameState = createFreshSeasonOneGameState();

    expect(gameState.teams).toHaveLength(32);
    expect(gameState.transferHistory).toHaveLength(0);
    expect(gameState.season.matchdayIds).toHaveLength(10);
    expect(gameState.seasonState.disciplineSchedule).toHaveLength(10);
    expect(gameState.teams.every((team) => team.cash === team.budget)).toBe(true);
    expect(gameState.seasonState.playerGeneratorDrafts).toEqual([]);
  });

  it("normalizes older local saves back to the full 10-matchday legacy seed schedule on reload", () => {
    const persistence = createPersistenceService();
    const fresh = persistence.createFreshSeasonOneSave({ name: "Legacy Schedule Normalize Test" });
    const mutated = structuredClone(fresh.gameState);

    mutated.season.matchdayIds = ["matchday-1", "matchday-2"];
    mutated.season.currentMatchday = 2;
    mutated.matchdayState.matchdayId = "matchday-2";
    mutated.seasonState.disciplineSchedule = (mutated.seasonState.disciplineSchedule ?? []).slice(0, 2);

    persistence.saveSingleplayerState(fresh.saveId, mutated);

    const reloaded = persistence.getSaveById(fresh.saveId);
    expect(reloaded).toBeTruthy();
    expect(reloaded?.gameState.season.matchdayIds).toHaveLength(10);
    expect(reloaded?.gameState.season.matchdayIds[9]).toBe("matchday-10");
    expect(reloaded?.gameState.seasonState.disciplineSchedule).toHaveLength(10);
    expect(reloaded?.gameState.seasonState.disciplineSchedule?.[9]?.discipline1?.disciplineId).toBe("football");
    expect(reloaded?.gameState.seasonState.disciplineSchedule?.[9]?.discipline2?.disciplineId).toBe("spurt");
  });

  it("persists local player generator drafts inside the sqlite save", () => {
    const persistence = createPersistenceService();
    const first = persistence.bootstrapSingleplayerSave();
    const gameState = createFreshSeasonOneGameState();

    gameState.seasonState.playerGeneratorDrafts = [
      {
        draftId: "player-draft-1",
        input: {
          name: "Draft Hero",
          roleIntent: "allround",
          strengthTier: "strong",
          axisIntent: { pow: 4, spe: 3, men: 4, soc: 2 },
          randomness: "medium",
          preferredArchetype: "warrior",
          raceHint: null,
          classHint: null,
          traitHint: null,
          seed: "draft-seed-1",
        },
        generated: {
          name: "Draft Hero",
          race: "Human",
          className: "Warrior",
          classSuggestion: {
            className: "Warrior",
            fitScore: 74.5,
            reasons: ["Hohe POW-Achse passt zu frontlastigen oder physischen Klassen."],
            warnings: [],
          },
          subclasses: ["Captain"],
          traitsPositive: ["Clutch"],
          traitsNegative: ["Stur"],
          attributes: {
            power: 78,
            health: 72,
            stamina: 69,
            intelligence: 54,
            awareness: 58,
            determination: 70,
            speed: 61,
            dexterity: 60,
            charisma: 49,
            will: 57,
            spirit: 51,
            torment: 63,
          },
          axes: {
            pow: 73,
            spe: 59.7,
            men: 59.8,
            soc: 54.3,
          },
          disciplineRatings: {
            tdm: 71.2,
          },
          ovr: 61.7,
          pps: 71.2,
          potential: null,
          marketValue: null,
          salary: null,
          marketValueStatus: "missing_market_value_engine",
          salaryStatus: "missing_market_value_input",
          formulaStatus: {
            attributeSalaryModifiersStatus: "ready",
            traitSalaryFactorsStatus: "ready",
            rankMarketValueStatus: "missing_source",
            classFactorsStatus: "missing_source",
            marketValueEngineStatus: "blocked_missing_rank_to_mw_source",
            salaryEngineStatus: "ready_if_market_value_input_present",
            classEngineStatus: "heuristic",
            warnings: [
              "rank_to_discipline_market_value_source_missing",
              "class_factors_source_missing",
            ],
          },
          diagnostics: {
            archetypeMatch: "ok",
            roleMatch: "ok",
            statSilhouette: "ok",
            engineStatus: {
              marketValueEngine: "blocked",
              salaryEngine: "missing_market_value_input",
              classEngine: "heuristic",
              potentialEngine: "missing_progression_source",
            },
            draftStatus: {
              ovr: "draft_preview",
              pps: "draft_preview",
            },
            saveStatus: {
              save: "draft_only",
              commit: "disabled",
              commitReasons: ["market_value_engine_blocked", "salary_engine_waits_for_market_value", "commit_path_not_ready"],
            },
            qualityWarnings: [],
            statSpread: 29,
            flatAttributeCount: 3,
            resolvedAxisIntent: {
              pow: 4,
              spe: 3,
              men: 4,
              soc: 2,
            },
            axisIntentSources: {
              pow: "user",
              spe: "user",
              men: "user",
              soc: "user",
            },
            peakAttributes: ["power", "health", "stamina"],
            weakAttributes: ["charisma", "spirit", "will"],
            archetypeSummary: ["Archetyp Warrior: Human / Warrior / Warrior, Guardian"],
            roleSummary: ["Defensive Kernwerte muessen deutlich ueber dem Rest liegen."],
          },
        },
        warnings: ["rank_to_discipline_market_value_source_missing", "class_factors_source_missing", "salary_engine_waits_for_market_value_input"],
        validationStatus: "ready_for_review",
        createdAt: "2026-06-06T12:00:00.000Z",
        updatedAt: "2026-06-06T12:00:00.000Z",
      },
    ];

    persistence.saveSingleplayerState(first.save.saveId, gameState);

    const reloaded = persistence.getSaveById(first.save.saveId);
    expect(reloaded?.gameState.seasonState.playerGeneratorDrafts).toHaveLength(1);
    expect(reloaded?.gameState.seasonState.playerGeneratorDrafts?.[0]?.generated.className).toBe("Warrior");
  });

  it("persists local result snapshots inside the sqlite save", () => {
    const persistence = createPersistenceService();
    const first = persistence.bootstrapSingleplayerSave();
    const gameState = createFreshSeasonOneGameState();

    gameState.seasonState.matchdayResults = [
      {
        id: "result-1",
        saveId: first.save.saveId,
        seasonId: gameState.season.id,
        matchdayId: gameState.matchdayState.matchdayId,
        status: "preview_applied",
        sourceVersion: "test",
        teamsTotal: 32,
        teamsReady: 32,
        teamsUnderfilled: 0,
        teamsMissingLineup: 0,
        teamsInvalidLineup: 0,
        teamsMissingScoreCoverage: 0,
        warningsCount: 0,
        createdAt: "2026-06-04T00:00:00.000Z",
        updatedAt: "2026-06-04T00:00:00.000Z",
      },
    ];
    gameState.seasonState.disciplineResults = [];
    gameState.seasonState.playerDisciplinePerformances = [];
    gameState.seasonState.disciplineHighlights = [];
    gameState.seasonState.resultAuditLogs = [];

    persistence.saveSingleplayerState(first.save.saveId, gameState);

    const reloaded = persistence.getSaveById(first.save.saveId);
    expect(reloaded?.gameState.seasonState.matchdayResults).toHaveLength(1);
    expect(reloaded?.gameState.seasonState.matchdayResults?.[0]?.id).toBe("result-1");
  });

  it("persists local team admin settings inside the sqlite save", () => {
    const persistence = createPersistenceService();
    const first = persistence.bootstrapSingleplayerSave();
    const gameState = createFreshSeasonOneGameState();

    gameState.seasonState.teamControlSettings = {
      ...(gameState.seasonState.teamControlSettings ?? {}),
      "B-B": {
        ...(gameState.seasonState.teamControlSettings?.["B-B"] ?? {
          teamId: "B-B",
          controlMode: "manual",
          aiLineupPreviewEnabled: false,
          aiLineupAutoApplyEnabled: false,
          aiTransferPreviewEnabled: false,
          aiTransferAutoApplyEnabled: false,
          aiSellPreviewEnabled: false,
          aiSellAutoApplyEnabled: false,
        }),
        controlMode: "ai",
        aiLineupPreviewEnabled: true,
        aiTransferPreviewEnabled: true,
        notes: "Batch-Kandidat",
      },
    };

    persistence.saveSingleplayerState(first.save.saveId, gameState);

    const reloaded = persistence.getSaveById(first.save.saveId);
    expect(reloaded?.gameState.seasonState.teamControlSettings?.["B-B"]?.controlMode).toBe("ai");
    expect(reloaded?.gameState.seasonState.teamControlSettings?.["B-B"]?.aiLineupPreviewEnabled).toBe(true);
    expect(reloaded?.gameState.seasonState.teamControlSettings?.["B-B"]?.notes).toBe("Batch-Kandidat");
  }, 20000);

  it("persists local team identity overrides inside the sqlite save without touching the defaults", () => {
    const persistence = createPersistenceService();
    const first = persistence.bootstrapSingleplayerSave();
    const gameState = createFreshSeasonOneGameState();

    gameState.seasonState.teamIdentityOverrides = {
      ...(gameState.seasonState.teamIdentityOverrides ?? {}),
      "C-C": {
        finances: 9,
        playerMin: 10,
        playerOpt: 12,
      },
    };
    gameState.teamIdentities = gameState.teamIdentities.map((entry) =>
      entry.teamId === "C-C"
        ? {
            ...entry,
            finances: 9,
            playerMin: 10,
            playerOpt: 12,
          }
        : entry,
    );

    persistence.saveSingleplayerState(first.save.saveId, gameState);

    const reloaded = persistence.getSaveById(first.save.saveId);
    expect(reloaded?.gameState.seasonState.teamIdentityOverrides?.["C-C"]).toEqual({
      finances: 9,
      playerMin: 10,
      playerOpt: 12,
    });
    expect(reloaded?.gameState.teamIdentities.find((entry) => entry.teamId === "C-C")?.finances).toBe(9);
    expect(createFreshSeasonOneGameState().teamIdentities.find((entry) => entry.teamId === "C-C")?.finances).toBe(10);
  });

  it("persists local strategy profiles inside the sqlite save", () => {
    const persistence = createPersistenceService();
    const first = persistence.bootstrapSingleplayerSave();
    const gameState = createFreshSeasonOneGameState();

    gameState.seasonState.teamStrategyProfiles = {
      ...(gameState.seasonState.teamStrategyProfiles ?? {}),
      "Z-H": {
        ...(gameState.seasonState.teamStrategyProfiles?.["Z-H"] ?? {
          teamId: "Z-H",
          strategySummary: "",
          buyStyle: "",
          sellStyle: "",
          contractStyle: "",
          rosterStyle: "",
          preferredArchetypes: [],
          avoidedArchetypes: [],
          preferredRaces: [],
          avoidedRaces: [],
          preferredClasses: [],
          avoidedClasses: [],
          hardNoGos: [],
          notes: null,
          bias: {
            cashPriority: 5,
            valuePriority: 5,
            starPriority: 5,
            riskTolerance: 5,
            wageSensitivity: 5,
            sellForProfitAggression: 5,
            shortContractPreference: 5,
            longContractPreference: 5,
            loyaltyBias: 5,
            harmonyStrictness: 5,
            rosterDepthPreference: 5,
            eliteSmallRosterPreference: 5,
          },
        }),
        strategySummary: "Underground title chase",
        fantasyTheme: "Rebellische Underdogs",
        loreTheme: "Kaempft aus dem Schatten gegen die Elite.",
        prefersDepth: "high",
        lockedNoGos: ["comfortable loser mindset", "luxury bench passengers"],
        powBias: 30,
        hardNoGos: ["comfortable loser mindset"],
        bias: {
          ...(gameState.seasonState.teamStrategyProfiles?.["Z-H"]?.bias ?? {
            cashPriority: 5,
            valuePriority: 5,
            starPriority: 5,
            riskTolerance: 5,
            wageSensitivity: 5,
            sellForProfitAggression: 5,
            shortContractPreference: 5,
            longContractPreference: 5,
            loyaltyBias: 5,
            harmonyStrictness: 5,
            rosterDepthPreference: 5,
            eliteSmallRosterPreference: 5,
          }),
          riskTolerance: 10,
        },
      },
    };

    persistence.saveSingleplayerState(first.save.saveId, gameState);

    const reloaded = persistence.getSaveById(first.save.saveId);
    expect(reloaded?.gameState.seasonState.teamStrategyProfiles?.["Z-H"]?.strategySummary).toBe("Underground title chase");
    expect(reloaded?.gameState.seasonState.teamStrategyProfiles?.["Z-H"]?.fantasyTheme).toBe("Rebellische Underdogs");
    expect(reloaded?.gameState.seasonState.teamStrategyProfiles?.["Z-H"]?.loreTheme).toBe(
      "Kaempft aus dem Schatten gegen die Elite.",
    );
    expect(reloaded?.gameState.seasonState.teamStrategyProfiles?.["Z-H"]?.prefersDepth).toBe("high");
    expect(reloaded?.gameState.seasonState.teamStrategyProfiles?.["Z-H"]?.lockedNoGos).toContain(
      "luxury bench passengers",
    );
    expect(reloaded?.gameState.seasonState.teamStrategyProfiles?.["Z-H"]?.hardNoGos).toContain("comfortable loser mindset");
    expect(reloaded?.gameState.seasonState.teamStrategyProfiles?.["Z-H"]?.powBias).toBe(30);
    expect(reloaded?.gameState.seasonState.teamStrategyProfiles?.["Z-H"]?.bias.riskTolerance).toBe(10);
  });
});
