import { describe, expect, it } from "vitest";

import { createFreshSeasonOneGameState } from "@/lib/game-state/singleplayer-state";
import { MATCHDAY_AUTO_RUN_CONFIRM_TOKEN, runLocalMatchdayAutoRun } from "@/lib/season/matchday-auto-run-service";
import {
  loadLocalLegacyLineupContext,
  loadLocalLegacyLineupContextFromGameState,
} from "@/lib/lineups/legacy-lineup-local-service";
import { applyAiLegacyLineupBatchLocally } from "@/lib/ai/ai-legacy-lineup-batch-apply-service";
import { ensureMatchdayResolveSnapshot } from "@/lib/foundation/matchday-resolve-snapshot";
import { prepareGameStateForMatchdayResolve } from "@/lib/lineups/matchday-lineup-auto-prep";
import {
  attachMatchdayInjuryPerformanceToContexts,
  buildMatchdayInjuryRollMap,
} from "@/lib/fatigue/fatigue-injury-service";
import { buildLegacyMatchdayResolvePreview } from "@/lib/resolve/legacy-matchday-resolve-engine";
import type { LegacyMatchdayResolvePreview, PlayerPerformancePreview } from "@/lib/resolve/legacy-matchday-resolve-types";
import type { GameState } from "@/lib/data/olyDataTypes";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";
import { INJURY_PERFORMANCE_MULTIPLIER } from "@/lib/fatigue/fatigue-calibration";

function findPlayerPreview(
  preview: LegacyMatchdayResolvePreview,
  teamId: string,
  playerId: string,
): PlayerPerformancePreview | null {
  for (const disciplinePreview of preview.disciplinePreviews) {
    const match = disciplinePreview.topPlayers.find(
      (player) => player.teamId === teamId && player.playerId === playerId,
    );
    if (match) {
      return match;
    }
  }
  return null;
}

function findPlayerFinalScore(
  preview: LegacyMatchdayResolvePreview,
  teamId: string,
  playerId: string,
): number | null {
  return findPlayerPreview(preview, teamId, playerId)?.finalPlayerScore ?? null;
}

function createInMemoryPersistence(gameState: GameState, cloneOnRead = false): PersistenceService {
  let save: PersistedSaveGame = {
    saveId: "test-save",
    name: "Test Save",
    status: "active",
    createdAt: "2026-06-06T00:00:00.000Z",
    updatedAt: "2026-06-06T00:00:00.000Z",
    gameState: structuredClone(gameState),
  };

  return {
    bootstrapSingleplayerSave() {
      return {
        save: cloneOnRead ? structuredClone(save) : save,
        createdFromSeed: false,
      };
    },
    getActiveSave() {
      return cloneOnRead ? structuredClone(save) : save;
    },
    getSaveById(saveId) {
      if (save.saveId !== saveId) {
        return null;
      }
      return cloneOnRead ? structuredClone(save) : save;
    },
    saveSingleplayerState(saveId, nextGameState) {
      if (save.saveId !== saveId) {
        throw new Error(`Unknown save ${saveId}`);
      }
      save = {
        ...save,
        updatedAt: "2026-06-06T00:00:01.000Z",
        gameState: structuredClone(nextGameState),
      };
      return save;
    },
    createSave() {
      throw new Error("Not implemented in test persistence.");
    },
    createFreshSeasonOneSave() {
      throw new Error("Not implemented in test persistence.");
    },
    cloneSave() {
      throw new Error("Not implemented in test persistence.");
    },
    activateSave(saveId) {
      if (save.saveId !== saveId) {
        return null;
      }
      return cloneOnRead ? structuredClone(save) : save;
    },
    listSaves() {
      return [
        {
          saveId: save.saveId,
          name: save.name,
          status: save.status,
          createdAt: save.createdAt,
          updatedAt: save.updatedAt,
        },
      ];
    },
  };
}

function topUpRostersForLineupMinimum(gameState: GameState, saveId = "test-save") {
  const persistence = createInMemoryPersistence(gameState);
  const contextResult = loadLocalLegacyLineupContext({
    saveId,
    seasonId: gameState.season.id,
    matchdayId: gameState.matchdayState.matchdayId,
    teamId: gameState.teams[0]!.teamId,
  }, persistence);

  if (!contextResult.ok) {
    throw new Error(contextResult.errors.join(" | "));
  }

  const requiredUniquePlayers =
    (contextResult.context.matchdayContract?.discipline1?.requiredPlayers ?? 0) +
    (contextResult.context.matchdayContract?.discipline2?.requiredPlayers ?? 0);
  const usedPlayerIds = new Set(gameState.rosters.map((entry) => entry.playerId));
  const freePlayers = gameState.players.filter((player) => !usedPlayerIds.has(player.id));
  let poolIndex = 0;
  let rosterCounter = gameState.rosters.length;

  for (const team of gameState.teams) {
    const teamRoster = gameState.rosters.filter((entry) => entry.teamId === team.teamId);
    const shortfall = Math.max(0, requiredUniquePlayers - teamRoster.length);

    for (let index = 0; index < shortfall; index += 1) {
      const player = freePlayers[poolIndex];
      if (!player) {
        throw new Error("Not enough free players to top up lineup test rosters.");
      }
      poolIndex += 1;
      gameState.rosters.push({
        id: `test-auto-roster-${rosterCounter}`,
        teamId: team.teamId,
        playerId: player.id,
        contractLength: 3,
        salary: Math.round(player.salaryDemand),
        upkeep: Math.round(player.salaryDemand),
        purchasePrice: Math.round(player.marketValue),
        currentValue: Math.round(player.marketValue),
        roleTag: "bench",
        joinedSeasonId: gameState.season.id,
      });
      rosterCounter += 1;
    }
  }
}

describe("matchday auto-run manual-team policy", () => {
  it("blocks clearly when manual or passive teams have no saved lineup and keeps them out of AI apply", async () => {
    const gameState = createFreshSeasonOneGameState();
    const existingSettings = gameState.seasonState.teamControlSettings ?? {};

    gameState.seasonState.teamControlSettings = {
      ...existingSettings,
      "B-B": {
        ...existingSettings["B-B"],
        teamId: "B-B",
        controlMode: "manual",
        aiLineupApplyEnabled: false,
      },
      "O-S": {
        ...existingSettings["O-S"],
        teamId: "O-S",
        controlMode: "passive",
        aiLineupApplyEnabled: false,
      },
      "D-L": {
        ...existingSettings["D-L"],
        teamId: "D-L",
        controlMode: "ai",
        aiLineupApplyEnabled: true,
      },
    };

    const persistence = createInMemoryPersistence(gameState);
    const result = await runLocalMatchdayAutoRun(
      {
        saveId: "test-save",
        seasonId: gameState.season.id,
        matchdayId: gameState.matchdayState.matchdayId,
        source: "sqlite",
        dryRun: true,
        options: {
          includeWarningLineups: false,
          overwriteExistingLineups: false,
          stopOnTie: true,
          advanceAfterCashApply: true,
        },
      },
      persistence,
    );

    expect(result.ok).toBe(false);
    expect(result.status).toBe("blocked");
    expect(result.summary.manualReady).toBe(0);
    expect(result.summary.manualMissing).toBe(1);
    expect(result.summary.missingManualTeams).toBe(1);
    expect(result.summary.passiveReady).toBe(0);
    expect(result.summary.passiveMissing).toBeGreaterThanOrEqual(0);
    expect(result.blockingReasons).toContain("missing_manual_lineup");
    expect(result.blockingReasons).toContain("resolve_status:missing_lineups");

    const aiLineupStep = result.steps.find((step) => step.key === "ai_lineups");
    const resolveStep = result.steps.find((step) => step.key === "resolve_preview");

    // Ein `manual`-Team OHNE Aufstellung wird von der KI nicht mehr gefuellt. Frueher
    // galt die leere Einsatzliste als "unvollstaendig" und die KI stellte ersatzweise auf
    // (Komfort statt Blockade) — der Spieler fand seinen Spieltag damit fertig
    // aufgestellt vor. Die fehlende Aufstellung ist jetzt genau das, was sie ist: ein
    // offener Punkt, den der Resolve-Schritt als `missing_manual_lineup` meldet.
    // `passive`-Teams behalten den Autofill, sonst traeten sie mit leerem Feld an.
    expect(aiLineupStep?.metrics.skippedManual).toBe(1);
    expect(Number(aiLineupStep?.metrics.skippedPassive ?? 0)).toBeGreaterThanOrEqual(0);
    expect(resolveStep?.metrics.manualMissing).toBe(1);
    expect(Number(resolveStep?.metrics.passiveMissing ?? 0)).toBeGreaterThanOrEqual(0);
    expect(resolveStep?.blockingReasons).toContain("missing_manual_lineup");

    const directBatch = applyAiLegacyLineupBatchLocally(
      {
        saveId: "test-save",
        seasonId: gameState.season.id,
        matchdayId: gameState.matchdayState.matchdayId,
        dryRun: true,
        includeWarningTeams: false,
        overwriteExisting: false,
      },
      persistence,
    );
    const manualTeamResult = directBatch.results.find((entry) => entry.teamId === "B-B");
    expect(manualTeamResult?.result).toBe("skipped_manual");
    expect(manualTeamResult?.saved).toBe(false);
    // Fixture-schwer (voller Spieltags-Durchlauf ueber 32 Teams) — wie die uebrigen
    // Faelle dieser Suite mit eigener Frist, statt an den 5-Sekunden-Default zu stossen.
  }, 40_000);

  it("does not overwrite a manual team's existing complete draft (skipped_manual)", async () => {
    const gameState = createFreshSeasonOneGameState();
    topUpRostersForLineupMinimum(gameState);
    const scope = {
      saveId: "test-save",
      seasonId: gameState.season.id,
      matchdayId: gameState.matchdayState.matchdayId,
    };
    const persistence = createInMemoryPersistence(gameState, true);

    // First pass: every team is "ai" controlled so the batch apply generates
    // and persists a complete lineup draft for every team, including B-B.
    applyAiLegacyLineupBatchLocally(
      { ...scope, dryRun: false, includeWarningTeams: true, overwriteExisting: false },
      persistence,
    );
    const beforeDraft = persistence
      .getSaveById(scope.saveId)!
      .gameState.seasonState.lineupDrafts?.find((draft) => draft.teamId === "B-B");
    expect(beforeDraft).toBeDefined();

    // Second pass: flip B-B to manual now that it holds a complete draft, and
    // re-run with overwriteExisting so only the manual-with-draft policy (not
    // the overwrite flag) can explain the team being left untouched.
    const afterFirstPass = persistence.getSaveById(scope.saveId)!.gameState;
    const existingSettings = afterFirstPass.seasonState.teamControlSettings ?? {};
    afterFirstPass.seasonState.teamControlSettings = {
      ...existingSettings,
      "B-B": { ...existingSettings["B-B"], teamId: "B-B", controlMode: "manual", aiLineupApplyEnabled: false },
    };
    persistence.saveSingleplayerState(scope.saveId, afterFirstPass);

    const secondBatch = applyAiLegacyLineupBatchLocally(
      { ...scope, dryRun: false, includeWarningTeams: true, overwriteExisting: true },
      persistence,
    );
    const manualResult = secondBatch.results.find((entry) => entry.teamId === "B-B");
    expect(manualResult?.result).toBe("skipped_manual");
    expect(secondBatch.summary.skippedManual).toBe(1);

    const afterDraft = persistence
      .getSaveById(scope.saveId)!
      .gameState.seasonState.lineupDrafts?.find((draft) => draft.teamId === "B-B");
    expect(afterDraft).toEqual(beforeDraft);
  }, 40_000);

  it("schreibt fuer ein manuelles Team ohne Aufstellung gar keinen Draft — auch keine Formkarten", async () => {
    // Gemeldeter Fehler: "immer wenn ich einen neuen spieltag berechne sind auch die
    // Human teams schon mit spielern in der einsatzliste gefüllt". Der Batch lief nach
    // jedem Spieltagswechsel fuer den naechsten Spieltag und behandelte die LEERE
    // Einsatzliste des Spielers als "unvollstaendig" — also als Einladung, sie zu
    // fuellen, samt der von der KI-Doktrin gewaehlten Formkarten.
    const gameState = createFreshSeasonOneGameState();
    topUpRostersForLineupMinimum(gameState);
    const scope = {
      saveId: "test-save",
      seasonId: gameState.season.id,
      matchdayId: gameState.matchdayState.matchdayId,
    };
    const existingSettings = gameState.seasonState.teamControlSettings ?? {};
    gameState.seasonState.teamControlSettings = {
      ...existingSettings,
      "B-B": { ...existingSettings["B-B"], teamId: "B-B", controlMode: "manual", aiLineupApplyEnabled: false },
    };
    const persistence = createInMemoryPersistence(gameState, true);

    const batch = applyAiLegacyLineupBatchLocally(
      { ...scope, dryRun: false, includeWarningTeams: true, overwriteExisting: false },
      persistence,
    );

    expect(batch.results.find((entry) => entry.teamId === "B-B")?.result).toBe("skipped_manual");
    const drafts = persistence.getSaveById(scope.saveId)!.gameState.seasonState.lineupDrafts ?? [];
    expect(drafts.find((draft) => draft.teamId === "B-B")).toBeUndefined();
    // Gegenprobe: KI-Teams stellen weiter auf, die Sperre trifft nur das Spieler-Team.
    expect(drafts.some((draft) => draft.teamId !== "B-B" && draft.entries.length > 0)).toBe(true);
  }, 40_000);

  it("uses the persisted post-AI snapshot for execute mode so resolve preview sees saved AI lineups", async () => {
    const gameState = createFreshSeasonOneGameState();
    topUpRostersForLineupMinimum(gameState);
    const existingSettings = gameState.seasonState.teamControlSettings ?? {};

    gameState.seasonState.teamControlSettings = Object.fromEntries(
      gameState.teams.map((team) => [
        team.teamId,
        {
          ...existingSettings[team.teamId],
          teamId: team.teamId,
          controlMode: "ai",
          aiLineupPreviewEnabled: true,
          aiLineupApplyEnabled: true,
          aiLineupAutoApplyEnabled: false,
          aiTransferPreviewEnabled: false,
          aiTransferAutoApplyEnabled: false,
          aiSellPreviewEnabled: false,
          aiSellAutoApplyEnabled: false,
          notes: null,
          strategyLock: null,
        },
      ]),
    );

    const persistence = createInMemoryPersistence(gameState, true);
    const result = await runLocalMatchdayAutoRun(
      {
        saveId: "test-save",
        seasonId: gameState.season.id,
        matchdayId: gameState.matchdayState.matchdayId,
        source: "sqlite",
        execute: true,
        dryRun: false,
        confirmToken: MATCHDAY_AUTO_RUN_CONFIRM_TOKEN,
        options: {
          includeWarningLineups: true,
          overwriteExistingLineups: true,
          // Not stopOnTie: true — this test is about the post-AI snapshot execute
          // path, not tie-blocking (see tests/standings-apply-service.test.ts for
          // that). With INJURY_PERFORMANCE_MULTIPLIER changed, this fixture's
          // deterministic seed now produces an exact standings tie for one team
          // pair on this matchday, which would otherwise incidentally block
          // standings/matchday advance here and turn this into a tie-blocking test
          // by accident.
          stopOnTie: false,
          advanceAfterCashApply: true,
        },
      },
      persistence,
    );

    const resolveStep = result.steps.find((step) => step.key === "resolve_preview");
    const prizeStep = result.steps.find((step) => step.key === "prize_preview");
    const cashStep = result.steps.find((step) => step.key === "cash_apply");
    const advanceStep = result.steps.find((step) => step.key === "matchday_advance");

    expect(resolveStep?.metrics.usedHypotheticalAiLineups).toBe(false);
    expect(resolveStep?.metrics.previewStatus).not.toBe("missing_lineups");
    expect(resolveStep?.metrics.teamsMissingLineup).toBe(0);
    expect(result.summary.lineupsReady).toBe(32);
    expect(result.summary.aiReady).toBe(32);
    expect(result.summary.cashApplyAllowed).toBe(false);
    // KNOWN REGRESSION (left red intentionally, do not weaken): this currently
    // fails because lib/resolve/legacy-matchday-readiness.ts's getRequiredCounts()
    // resolves required-player counts ONLY from context.disciplinePlayerCounts
    // (the static, non-schedule-aware Discipline.playerCount, e.g. 5 for
    // "showcase" in lib/data/dataAdapter.ts), while the AI lineup engine and the
    // matchday contract itself (lib/lineups/lineup-discipline-contract.ts
    // buildMatchdayLineupContract -> `scheduleSlot?.playerCount ?? discipline.
    // requiredPlayers`) correctly use the season-schedule-rolled per-matchday
    // count (e.g. 6 for "showcase" on this save, via
    // lib/season/season-discipline-schedule.ts's seeded "balanced slot buckets").
    // Every other consumer (e.g. lib/ai/ai-legacy-lineup-engine.ts:108-109,
    // 339-340, 591-592, 914-915, 1109, 1127) prefers
    // `disciplineSidePlayerCounts` and only falls back to
    // `disciplinePlayerCounts`; buildLegacyMatchdayReadiness's getRequiredCounts()
    // (lib/resolve/legacy-matchday-readiness.ts:25-38) does not, so it flags a
    // correctly AI-built lineup as "invalid_lineup" ("Discipline showcase on d2
    // expects 5 entries, but received 6"). This cascades into standings-preview
    // marking every team's result "incomplete_result" and blocks standings_apply
    // / matchday_advance. Independently reproduced outside this test suite via
    // `npm run season:smoke-matchday-auto-run`, which currently fails with
    // "Auto-run execute blocked: incomplete_result:<every team>" for all 32
    // teams — this is a genuine production regression, not a fixture issue.
    expect(result.summary.advanceAllowed).toBe(true);
    expect(result.appliedAudits.cashApply).toBeNull();
    expect(result.appliedAudits.matchdayAdvance).toBeTruthy();
    expect(prizeStep).toBeUndefined();
    expect(cashStep).toBeUndefined();
    expect(advanceStep?.status).toBe("applied");
  }, 40_000);

  // Regression guard for BUG A: the auto-run persisted a resolve preview built
  // WITHOUT the same-day injury multiplier, so an injured-this-matchday player
  // scored 1.0x through auto-run while scoring INJURY_PERFORMANCE_MULTIPLIER
  // through the manual/sim path.
  it("persists the same-day injury malus (fatigue*INJURY_PERFORMANCE_MULTIPLIER) for an injured player through the execute path", async () => {
    const gameState = createFreshSeasonOneGameState();
    topUpRostersForLineupMinimum(gameState);
    const existingSettings = gameState.seasonState.teamControlSettings ?? {};
    gameState.seasonState.teamControlSettings = Object.fromEntries(
      gameState.teams.map((team) => [
        team.teamId,
        {
          ...existingSettings[team.teamId],
          teamId: team.teamId,
          controlMode: "ai",
          aiLineupPreviewEnabled: true,
          aiLineupApplyEnabled: true,
          aiLineupAutoApplyEnabled: false,
          aiTransferPreviewEnabled: false,
          aiTransferAutoApplyEnabled: false,
          aiSellPreviewEnabled: false,
          aiSellAutoApplyEnabled: false,
          notes: null,
          strategyLock: null,
        },
      ]),
    );
    // Max out fatigue for every rostered player so the deterministic injury roll
    // (riskPercent 40 at fatigue 100) fires for a meaningful share of used players.
    gameState.seasonState.playerAvailabilityState = gameState.rosters.map((roster) => ({
      playerId: roster.playerId,
      teamId: roster.teamId,
      fatigue: 100,
      injuryStatus: "healthy" as const,
    }));
    gameState.players = gameState.players.map((player) => ({ ...player, fatigue: 100 }));

    const scope = {
      saveId: "test-save",
      seasonId: gameState.season.id,
      matchdayId: gameState.matchdayState.matchdayId,
    };
    const persistence = createInMemoryPersistence(gameState, true);

    // Persist AI lineups and fully prepare the state up front so the auto-run's
    // own AI + prepare steps are no-ops and read back exactly this state — which
    // lets us deterministically precompute the injured player's expected score.
    applyAiLegacyLineupBatchLocally(
      { ...scope, dryRun: false, includeWarningTeams: true, overwriteExisting: true },
      persistence,
    );
    const afterAi = persistence.getSaveById(scope.saveId)!;
    const prepared = prepareGameStateForMatchdayResolve(afterAi.gameState, scope);
    persistence.saveSingleplayerState(scope.saveId, prepared.gameState);

    const preparedGameState = persistence.getSaveById(scope.saveId)!.gameState;
    const loadContexts = () =>
      preparedGameState.teams.map((team) => {
        const contextResult = loadLocalLegacyLineupContextFromGameState(preparedGameState, {
          ...scope,
          teamId: team.teamId,
        });
        if (!contextResult.ok) {
          throw new Error(contextResult.errors.join(" | "));
        }
        return contextResult.context;
      });

    const injuryRollMap = buildMatchdayInjuryRollMap({ gameState: preparedGameState, ...scope });
    let injuredTeamId: string | null = null;
    let injuredPlayerId: string | null = null;
    for (const [key, roll] of injuryRollMap) {
      if (roll.result === "injured") {
        const separator = key.indexOf("::");
        injuredTeamId = key.slice(0, separator);
        injuredPlayerId = key.slice(separator + 2);
        break;
      }
    }
    expect(injuredPlayerId).not.toBeNull();
    expect(injuredTeamId).not.toBeNull();

    // Same construction the fixed auto-run performs: attach injuries to the
    // contexts before building the resolve preview that gets persisted.
    const injuryAwareContexts = loadContexts();
    attachMatchdayInjuryPerformanceToContexts(injuryAwareContexts, injuryRollMap);
    const injuryAwarePreview = buildLegacyMatchdayResolvePreview(injuryAwareContexts);
    // Pre-fix construction: no injuries attached.
    const noInjuryPreview = buildLegacyMatchdayResolvePreview(loadContexts());

    const injuryAwarePlayer = findPlayerPreview(injuryAwarePreview, injuredTeamId!, injuredPlayerId!);
    const noInjuryPlayer = findPlayerPreview(noInjuryPreview, injuredTeamId!, injuredPlayerId!);
    expect(injuryAwarePlayer).not.toBeNull();
    expect(noInjuryPlayer).not.toBeNull();
    const injuryAwareFinal = injuryAwarePlayer!.finalPlayerScore;
    const noInjuryFinal = noInjuryPlayer!.finalPlayerScore;
    expect(injuryAwareFinal).toBeLessThan(noInjuryFinal);

    // NOTE on what this ratio actually measures: INJURY_PERFORMANCE_MULTIPLIER only
    // scales the base/fatigue-adjusted portion of the score. Downstream additive and
    // team-normalized modifiers (mutator bonus, story-weight-based point share, etc.)
    // are computed independently of the injury multiplier and are NOT reduced — by
    // design (the owner wants the malus to apply to the base score only, not to flatten
    // the whole total). That dilutes the whole-score ratio well above
    // INJURY_PERFORMANCE_MULTIPLIER, so we assert the real mechanic instead of a magic
    // ratio:
    //   1) the whole-score ratio sits strictly between INJURY_PERFORMANCE_MULTIPLIER and 1
    //      (the malus has *some* dampened effect on the total, never none, never the full cut), and
    //   2) the base/fatigue-adjusted portion (`fatigueAdjustedValue`) is identical in both
    //      previews, because it is computed BEFORE the injury multiplier is applied — proving
    //      the malus is folded in downstream of that base, exactly where getInjuryPerformanceMultiplier
    //      is wired into the score engine (see legacy-score-engine.ts), not by mutating the base itself.
    const ratio = injuryAwareFinal / noInjuryFinal;
    expect(ratio).toBeGreaterThan(INJURY_PERFORMANCE_MULTIPLIER);
    expect(ratio).toBeLessThan(1);

    const fatigueAdjustedBase = noInjuryPlayer!.fatigueAdjustedValue;
    expect(fatigueAdjustedBase).not.toBeNull();
    expect(fatigueAdjustedBase).toBe(injuryAwarePlayer!.fatigueAdjustedValue);
    // The exact base-portion reduction (fatigueAdjustedScore * INJURY_PERFORMANCE_MULTIPLIER,
    // with no dilution from downstream additive modifiers) is covered precisely by the
    // isolated unit tests in tests/legacy-matchday-resolve.test.ts, which construct a
    // single-player context and assert the reduced score exactly.

    const result = await runLocalMatchdayAutoRun(
      {
        ...scope,
        source: "sqlite",
        execute: true,
        dryRun: false,
        confirmToken: MATCHDAY_AUTO_RUN_CONFIRM_TOKEN,
        options: {
          includeWarningLineups: true,
          overwriteExistingLineups: false,
          stopOnTie: false,
          advanceAfterCashApply: false,
        },
      },
      persistence,
    );

    const resultApplyStep = result.steps.find((step) => step.key === "result_apply");
    expect(resultApplyStep?.status).toBe("applied");

    const persistedPerformances =
      persistence.getSaveById(scope.saveId)!.gameState.seasonState.playerDisciplinePerformances ?? [];
    const persistedInjured = persistedPerformances.find(
      (entry) => entry.teamId === injuredTeamId && entry.playerId === injuredPlayerId,
    );
    expect(persistedInjured).toBeDefined();
    // Post-fix: the persisted score carries the injury malus (== injury-aware
    // preview) and NOT the stale no-injury value the buggy path would have written.
    expect(persistedInjured!.finalPlayerScore).toBe(injuryAwareFinal);
    expect(persistedInjured!.finalPlayerScore).not.toBe(noInjuryFinal);
  }, 40_000);
});

describe("matchday auto-run per-discipline commit", () => {
  function makeAllAiGameState() {
    const gameState = createFreshSeasonOneGameState();
    topUpRostersForLineupMinimum(gameState);
    const existingSettings = gameState.seasonState.teamControlSettings ?? {};
    gameState.seasonState.teamControlSettings = Object.fromEntries(
      gameState.teams.map((team) => [
        team.teamId,
        {
          ...existingSettings[team.teamId],
          teamId: team.teamId,
          controlMode: "ai" as const,
          aiLineupPreviewEnabled: true,
          aiLineupApplyEnabled: true,
          aiLineupAutoApplyEnabled: false,
          aiTransferPreviewEnabled: false,
          aiTransferAutoApplyEnabled: false,
          aiSellPreviewEnabled: false,
          aiSellAutoApplyEnabled: false,
          notes: null,
          strategyLock: null,
        },
      ]),
    );
    return gameState;
  }

  function runCommit(persistence: PersistenceService, gameState: GameState, commitThroughSide: "d1" | "d2") {
    return runLocalMatchdayAutoRun(
      {
        saveId: "test-save",
        seasonId: gameState.season.id,
        matchdayId: gameState.matchdayState.matchdayId,
        source: "sqlite",
        execute: true,
        dryRun: false,
        confirmToken: MATCHDAY_AUTO_RUN_CONFIRM_TOKEN,
        options: {
          includeWarningLineups: true,
          overwriteExistingLineups: false,
          stopOnTie: false,
          advanceAfterCashApply: true,
          commitThroughSide,
        },
      },
      persistence,
    );
  }

  it("books only d1 on a half matchday and completes the matchday on the d2 commit", async () => {
    const gameState = makeAllAiGameState();
    const persistence = createInMemoryPersistence(gameState, true);
    const matchdayId = gameState.matchdayState.matchdayId;

    const d1 = await runCommit(persistence, gameState, "d1");
    expect(d1.summary.resultApplyAllowed).toBe(true);
    expect(d1.summary.standingsApplyAllowed).toBe(true);
    // Ein halber Spieltag wird NICHT weitergeschaltet.
    expect(d1.summary.advanceAllowed).toBe(false);

    const afterD1 = persistence.getSaveById("test-save")!.gameState.seasonState;
    const resultId = afterD1.matchdayResults!.find((entry) => entry.matchdayId === matchdayId)!.id;
    const sidesAfterD1 = new Set(
      (afterD1.disciplineResults ?? [])
        .filter((entry) => entry.matchdayResultId === resultId)
        .map((entry) => entry.disciplineSide),
    );
    expect([...sidesAfterD1]).toEqual(["d1"]);
    const d1RowsAfterD1 = (afterD1.disciplineResults ?? [])
      .filter((entry) => entry.matchdayResultId === resultId && entry.disciplineSide === "d1")
      .map((entry) => `${entry.teamId}:${entry.rank}:${entry.totalScore}`)
      .sort();
    expect(persistence.getSaveById("test-save")!.gameState.matchdayState.matchdayId).toBe(matchdayId);

    const pointsAfterD1 = Object.fromEntries(
      Object.entries(afterD1.standings ?? {}).map(([teamId, row]) => [teamId, row.points ?? 0]),
    );

    const d2 = await runCommit(persistence, gameState, "d2");
    expect(d2.summary.resultApplyAllowed).toBe(true);
    expect(d2.summary.standingsApplyAllowed).toBe(true);

    const afterD2 = persistence.getSaveById("test-save")!.gameState.seasonState;
    const sidesAfterD2 = new Set(
      (afterD2.disciplineResults ?? [])
        .filter((entry) => entry.matchdayResultId === resultId)
        .map((entry) => entry.disciplineSide),
    );
    expect([...sidesAfterD2].sort()).toEqual(["d1", "d2"]);

    // Eine bereits gewertete Disziplin ist eingefroren: Der D2-Commit rechnet D1 NICHT
    // neu. Ohne das Einfrieren verschob die nicht bitgleiche Replay-Rekonstruktion die
    // D1-Raenge nachtraeglich, obwohl der Spieler sie laengst als Ergebnis gesehen hatte.
    const d1RowsAfterD2 = (afterD2.disciplineResults ?? [])
      .filter((entry) => entry.matchdayResultId === resultId && entry.disciplineSide === "d1")
      .map((entry) => `${entry.teamId}:${entry.rank}:${entry.totalScore}`)
      .sort();
    expect(d1RowsAfterD2).toEqual(d1RowsAfterD1);

    // Kein Doppelzaehlen: der zweite Apply rechnet von derselben Vor-Spieltags-Basis,
    // die Gesamtpunkte sind also nicht die Summe zweier voller Spieltage.
    const pointsAfterD2 = Object.fromEntries(
      Object.entries(afterD2.standings ?? {}).map(([teamId, row]) => [teamId, row.points ?? 0]),
    );
    const baselineIds = new Set(
      Object.values(afterD2.standings ?? {}).map((row) => row.matchdayBaselineId),
    );
    expect([...baselineIds]).toEqual([matchdayId]);
    for (const [teamId, points] of Object.entries(pointsAfterD2)) {
      const baseline = afterD2.standings![teamId]!.matchdayBaselinePoints ?? 0;
      const afterD1Points = pointsAfterD1[teamId] ?? 0;
      // D1-Punkte bleiben enthalten, D2 kommt oben drauf — nie weniger als nach D1.
      expect(points).toBeGreaterThanOrEqual(Number((afterD1Points - 0.001).toFixed(3)));
      expect(points).toBeGreaterThanOrEqual(baseline);
    }
  }, 120_000);

  // Coordinator follow-up: does a D1-only save (advance blocked) leave the player a visible,
  // clickable way to actually book D2 -- or does it recreate the historical #224 dead end
  // (button removed, replacement only reachable via a spot the player never finds)? Answered
  // against a REAL post-D1-commit save, not a hand-built fixture, so this is belegt.
  it("keeps the flow pointing at the Arena (never the Cockpit) once D1 is booked and D2 is still open", async () => {
    const { buildGameFlowState } = await import("@/lib/foundation/game-flow-controller");
    const { resolveGameFlowActionStep } = await import("@/lib/foundation/resolve-game-flow-action-step");

    const gameState = makeAllAiGameState();
    const persistence = createInMemoryPersistence(gameState, true);
    const matchdayId = gameState.matchdayState.matchdayId;
    const activeTeamId = gameState.teams[0]!.teamId;

    const d1 = await runCommit(persistence, gameState, "d1");
    expect(d1.summary.resultApplyAllowed).toBe(true);

    const afterD1 = persistence.getSaveById("test-save")!.gameState;
    expect(afterD1.matchdayState.matchdayId).toBe(matchdayId); // sanity: still on the same matchday.

    const flow = buildGameFlowState({ gameState: afterD1, activeTeamId });
    const advanceStep = flow.steps.find((step) => step.stepId === "advance_to_next_matchday");
    expect(advanceStep?.status).toBe("blocked");
    expect(advanceStep?.blockers).toContain("result_incomplete_missing_d2");

    // 1) The season's own "which step is current" picker must not surface the blocked advance
    //    step as something to act on directly without a route back to the Arena.
    expect(flow.currentStep.targetView === "matchdayArena" || flow.currentStep.stepId === "advance_to_next_matchday").toBe(
      true,
    );

    // 2) Worst realistic case: every OTHER step that also points at the Arena
    //    ("review_matchday_results", "open_season_standings") has already been acknowledged by
    //    the player earlier (see use-foundation-cross-tab-game-flow.ts) and therefore drops out
    //    of `actionableSteps`. There's ALSO a pre-existing, unrelated detour once both of those
    //    are acknowledged: `resolveGameFlowActionStep` nudges towards an affordable facility
    //    upgrade first ("matchday_facilities", optional) before ever looking at the advance
    //    step -- that's intentional UX, not part of this fix, and it's dismissable exactly like
    //    any other optional step. Acknowledging it too reaches the actual worst case: nothing
    //    left recommending a next action except the blocked advance step itself, whose OWN
    //    targetView is then the entire safety net.
    const acknowledgedFlowStepIds = new Set(["review_matchday_results", "open_season_standings", "matchday_facilities"]);
    const actionableSteps = flow.steps.filter(
      (step) => step.status !== "completed" && !(step.status !== "blocked" && acknowledgedFlowStepIds.has(step.stepId)),
    );
    const fallbackStep = flow.currentStep.status === "completed" ? (flow.nextStep ?? flow.currentStep) : flow.currentStep;
    const actionStep = resolveGameFlowActionStep(actionableSteps, fallbackStep, acknowledgedFlowStepIds);

    // This is exactly what `createTriggerGlobalNext` (foundation-global-next-actions.ts) would
    // navigate to once `canAdvanceMatchdayFromStep(actionStep)` is false (status "blocked"):
    // `navigateToGameFlowStep(actionStep.targetView, ..., actionStep.targetPanel)`. Landing on
    // "cockpit" here would silently reopen the #224 dead end
    // (tests/arena-finish-matchday-reachable.test.ts) for exactly the players this fix is meant
    // to protect.
    expect(actionStep.targetView).toBe("matchdayArena");
    expect(actionStep.targetPanel).toBe("foundation-matchday-arena");

    // 3) And the concrete, always-on escape hatch regardless of which step "wins" above: the
    //    Arena itself accepts a D2 commit for this matchday right now, independent of the flow
    //    picker entirely (`onCommitDiscipline` is wired unconditionally in
    //    FoundationShellRouterBody.tsx, never gated on `hasFullMatchdayResult`). With
    //    `advanceAfterCashApply: true` (this describe block's default `runCommit` options) a
    //    full D2 commit also advances the season on its own -- the clearest possible proof that
    //    nothing is stuck: the matchday actually moves on.
    const d2 = await runCommit(persistence, gameState, "d2");
    expect(d2.summary.resultApplyAllowed).toBe(true);
    expect(d2.summary.advanceAllowed).toBe(true);
    const afterD2 = persistence.getSaveById("test-save")!.gameState;
    expect(afterD2.matchdayState.matchdayId).not.toBe(matchdayId);
  }, 120_000);
});

describe("matchday resolve snapshot equality", () => {
  function makeAllAiGameState() {
    const gameState = createFreshSeasonOneGameState();
    topUpRostersForLineupMinimum(gameState);
    const existingSettings = gameState.seasonState.teamControlSettings ?? {};
    gameState.seasonState.teamControlSettings = Object.fromEntries(
      gameState.teams.map((team) => [
        team.teamId,
        {
          ...existingSettings[team.teamId],
          teamId: team.teamId,
          controlMode: "ai" as const,
          aiLineupPreviewEnabled: true,
          aiLineupApplyEnabled: true,
          aiLineupAutoApplyEnabled: false,
          aiTransferPreviewEnabled: false,
          aiTransferAutoApplyEnabled: false,
          aiSellPreviewEnabled: false,
          aiSellAutoApplyEnabled: false,
          notes: null,
          strategyLock: null,
        },
      ]),
    );
    return gameState;
  }

  it("books exactly what the arena showed, for both disciplines", async () => {
    const gameState = makeAllAiGameState();
    const persistence = createInMemoryPersistence(gameState, true);
    const scope = {
      saveId: "test-save",
      seasonId: gameState.season.id,
      matchdayId: gameState.matchdayState.matchdayId,
    };

    // Feld herstellen (die KI-Aufstellungen entstehen sonst erst im Commit) und
    // danach genau das tun, was der Weg zur Arena tut: einmal rechnen und ablegen.
    applyAiLegacyLineupBatchLocally(
      { ...scope, dryRun: false, includeWarningTeams: true, overwriteExisting: false },
      persistence,
    );
    const snapshot = ensureMatchdayResolveSnapshot(scope, persistence);
    expect(snapshot).not.toBeNull();

    // Das ist, was die Arena-Buehne zeigt.
    const shown = new Map<string, string>();
    for (const disciplinePreview of snapshot!.payload.preview.disciplinePreviews) {
      for (const row of disciplinePreview.teamResults) {
        shown.set(
          `${disciplinePreview.disciplineSide}:${row.teamId}`,
          `${row.rank}:${row.finalPreviewScore}`,
        );
      }
    }
    expect(shown.size).toBeGreaterThan(0);

    const runCommit = (commitThroughSide: "d1" | "d2") =>
      runLocalMatchdayAutoRun(
        {
          ...scope,
          source: "sqlite",
          execute: true,
          dryRun: false,
          confirmToken: MATCHDAY_AUTO_RUN_CONFIRM_TOKEN,
          options: {
            includeWarningLineups: true,
            overwriteExistingLineups: false,
            stopOnTie: false,
            advanceAfterCashApply: true,
            commitThroughSide,
          },
        },
        persistence,
      );

    await runCommit("d1");
    await runCommit("d2");

    const seasonState = persistence.getSaveById("test-save")!.gameState.seasonState;
    const resultId = seasonState.matchdayResults!.find((entry) => entry.matchdayId === scope.matchdayId)!.id;
    const booked = new Map<string, string>();
    for (const row of (seasonState.disciplineResults ?? []).filter(
      (entry) => entry.matchdayResultId === resultId,
    )) {
      booked.set(`${row.disciplineSide}:${row.teamId}`, `${row.rank}:${row.totalScore}`);
    }

    // Kern der Umstellung: Gebucht wird exakt das Gezeigte — in BEIDEN Disziplinen,
    // ueber zwei getrennte Buchungen hinweg.
    expect(booked.size).toBe(shown.size);
    for (const [key, value] of shown) {
      expect(booked.get(key)).toBe(value);
    }
  }, 180_000);
});
describe("matchday fatigue follows the discipline commit", () => {
  function makeAllAiGameState() {
    const gameState = createFreshSeasonOneGameState();
    topUpRostersForLineupMinimum(gameState);
    const existingSettings = gameState.seasonState.teamControlSettings ?? {};
    gameState.seasonState.teamControlSettings = Object.fromEntries(
      gameState.teams.map((team) => [
        team.teamId,
        {
          ...existingSettings[team.teamId],
          teamId: team.teamId,
          controlMode: "ai" as const,
          aiLineupPreviewEnabled: true,
          aiLineupApplyEnabled: true,
          aiLineupAutoApplyEnabled: false,
          aiTransferPreviewEnabled: false,
          aiTransferAutoApplyEnabled: false,
          aiSellPreviewEnabled: false,
          aiSellAutoApplyEnabled: false,
          notes: null,
          strategyLock: null,
        },
      ]),
    );
    return gameState;
  }

  function runCommit(
    persistence: PersistenceService,
    scope: { saveId: string; seasonId: string; matchdayId: string },
    commitThroughSide: "d1" | "d2",
  ) {
    return runLocalMatchdayAutoRun(
      {
        ...scope,
        source: "sqlite",
        execute: true,
        dryRun: false,
        confirmToken: MATCHDAY_AUTO_RUN_CONFIRM_TOKEN,
        options: {
          includeWarningLineups: true,
          overwriteExistingLineups: false,
          stopOnTie: false,
          advanceAfterCashApply: true,
          commitThroughSide,
        },
      },
      persistence,
    );
  }

  function fatigueByPlayer(persistence: PersistenceService) {
    const state = persistence.getSaveById("test-save")!.gameState.seasonState;
    return new Map(
      (state.playerAvailabilityState ?? []).map((entry) => [
        `${entry.teamId}::${entry.playerId}`,
        entry.fatigue ?? 0,
      ]),
    );
  }

  it("loads only the d1 players after a half matchday, and lands on the full-matchday state after d2", async () => {
    const gameState = makeAllAiGameState();
    const scope = {
      saveId: "test-save",
      seasonId: gameState.season.id,
      matchdayId: gameState.matchdayState.matchdayId,
    };

    // Referenz: derselbe Spieltag in EINEM Rutsch gebucht.
    const referencePersistence = createInMemoryPersistence(gameState, true);
    applyAiLegacyLineupBatchLocally(
      { ...scope, dryRun: false, includeWarningTeams: true, overwriteExisting: false },
      referencePersistence,
    );
    ensureMatchdayResolveSnapshot(scope, referencePersistence);
    await runCommit(referencePersistence, scope, "d2");
    const referenceFatigue = fatigueByPlayer(referencePersistence);

    // Gestaffelt: erst D1, dann D2.
    const stagedPersistence = createInMemoryPersistence(gameState, true);
    applyAiLegacyLineupBatchLocally(
      { ...scope, dryRun: false, includeWarningTeams: true, overwriteExisting: false },
      stagedPersistence,
    );
    const snapshot = ensureMatchdayResolveSnapshot(scope, stagedPersistence);
    expect(snapshot).not.toBeNull();

    // Wer NUR in D2 antritt, darf nach dem D1-Commit noch keine Spieltagslast tragen.
    const drafts = (stagedPersistence.getSaveById("test-save")!.gameState.seasonState.lineupDrafts ?? []).filter(
      (draft) => draft.seasonId === scope.seasonId && draft.matchdayId === scope.matchdayId,
    );
    const d1Keys = new Set<string>();
    const d2OnlyKeys = new Set<string>();
    for (const draft of drafts) {
      for (const entry of draft.entries) {
        if (entry.disciplineSide === "d1") d1Keys.add(`${draft.teamId}::${entry.playerId}`);
      }
    }
    for (const draft of drafts) {
      for (const entry of draft.entries) {
        const key = `${draft.teamId}::${entry.playerId}`;
        if (entry.disciplineSide === "d2" && !d1Keys.has(key)) d2OnlyKeys.add(key);
      }
    }
    expect(d2OnlyKeys.size).toBeGreaterThan(0);

    const beforeAny = fatigueByPlayer(stagedPersistence);
    await runCommit(stagedPersistence, scope, "d1");
    const afterD1 = fatigueByPlayer(stagedPersistence);

    for (const key of d2OnlyKeys) {
      // Reine D2-Starter sind nach dem halben Spieltag unbelastet (Erholung kann sie
      // sogar frischer machen — belastet werden duerfen sie jedenfalls nicht).
      expect(afterD1.get(key) ?? 0).toBeLessThanOrEqual(beforeAny.get(key) ?? 0);
    }

    await runCommit(stagedPersistence, scope, "d2");
    const afterD2 = fatigueByPlayer(stagedPersistence);

    // Und am Ende steht exakt der Zustand, den eine Buchung in einem Rutsch erzeugt.
    expect(afterD2.size).toBe(referenceFatigue.size);
    for (const [key, value] of referenceFatigue) {
      expect(afterD2.get(key)).toBeCloseTo(value, 5);
    }
  }, 240_000);
});
