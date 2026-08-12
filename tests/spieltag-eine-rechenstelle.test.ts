import { describe, expect, it } from "vitest";

import { createFreshSeasonOneGameState } from "@/lib/game-state/singleplayer-state";
import { applyDefaultTrainingFieldsToRosteredPlayers } from "@/lib/training/player-training-backfill";
import { accumulateMatchdayTrainingProgress } from "@/lib/training/matchday-training-accumulator";
import { FATIGUE_LOAD_BY_MODE } from "@/lib/training/training-mode-presentation";
import { applyAiLegacyLineupBatchLocally } from "@/lib/ai/ai-legacy-lineup-batch-apply-service";
import { loadLocalLegacyLineupContext, loadLocalLegacyLineupContextFromGameState } from "@/lib/lineups/legacy-lineup-local-service";
import { prepareGameStateForMatchdayResolve } from "@/lib/lineups/matchday-lineup-auto-prep";
import { attachMatchdayInjuryPerformanceToContexts, buildMatchdayInjuryRollMap } from "@/lib/fatigue/fatigue-injury-service";
import { buildLegacyMatchdayResolvePreview } from "@/lib/resolve/legacy-matchday-resolve-engine";
import { MATCHDAY_AUTO_RUN_CONFIRM_TOKEN, runLocalMatchdayAutoRun } from "@/lib/season/matchday-auto-run-service";
import type { GameState } from "@/lib/data/olyDataTypes";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";

/**
 * ZWEI RECHENSTELLEN, ZWEI ZAHLEN — dieser Test misst beide Stellen an WERTEN.
 *
 * 1. Der Trainingsmodus darf sich zwischen "gezeigt" und "gebucht" nicht mehr bewegen.
 *    Er zieht die Moral mit und die Moral ihren Multiplikator in den Score.
 * 2. Die Trainingsschicht (`matchday-training-accumulator`) darf je Spieltag genau einmal
 *    aufschlagen — auch dann, wenn der Spieltag in zwei Teilschritten (D1, D2) gebucht wird.
 */

function createInMemoryPersistence(gameState: GameState, cloneOnRead = false): PersistenceService {
  let save: PersistedSaveGame = {
    saveId: "test-save",
    name: "Test Save",
    status: "active",
    createdAt: "2026-06-06T00:00:00.000Z",
    updatedAt: "2026-06-06T00:00:00.000Z",
    gameState: structuredClone(gameState),
  };
  const read = () => (cloneOnRead ? structuredClone(save) : save);
  return {
    bootstrapSingleplayerSave() {
      return { save: read(), createdFromSeed: false };
    },
    getActiveSave() {
      return read();
    },
    getSaveById(saveId: string) {
      return saveId === save.saveId ? read() : null;
    },
    listSaves() {
      return [read()];
    },
    saveSingleplayerState(saveId: string, nextGameState: GameState) {
      if (saveId !== save.saveId) throw new Error(`unknown save ${saveId}`);
      save = { ...save, gameState: structuredClone(nextGameState), updatedAt: new Date().toISOString() };
      return read();
    },
  } as unknown as PersistenceService;
}

function topUpRostersForLineupMinimum(gameState: GameState, saveId = "test-save") {
  const persistence = createInMemoryPersistence(gameState);
  const contextResult = loadLocalLegacyLineupContext(
    {
      saveId,
      seasonId: gameState.season.id,
      matchdayId: gameState.matchdayState.matchdayId,
      teamId: gameState.teams[0]!.teamId,
    },
    persistence,
  );
  if (!contextResult.ok) throw new Error(contextResult.errors.join(" | "));
  const required =
    (contextResult.context.matchdayContract?.discipline1?.requiredPlayers ?? 0) +
    (contextResult.context.matchdayContract?.discipline2?.requiredPlayers ?? 0);
  const usedPlayerIds = new Set(gameState.rosters.map((entry) => entry.playerId));
  const freePlayers = gameState.players.filter((player) => !usedPlayerIds.has(player.id));
  let poolIndex = 0;
  let rosterCounter = gameState.rosters.length;
  for (const team of gameState.teams) {
    const shortfall = Math.max(0, required - gameState.rosters.filter((entry) => entry.teamId === team.teamId).length);
    for (let index = 0; index < shortfall; index += 1) {
      const player = freePlayers[poolIndex];
      if (!player) throw new Error("Not enough free players to top up test rosters.");
      poolIndex += 1;
      gameState.rosters.push({
        id: `oly-test-roster-${rosterCounter}`,
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
  // Wie im echten Spiel: ein Kaderplatz bringt einen Trainingsmodus mit.
  Object.assign(gameState, applyDefaultTrainingFieldsToRosteredPlayers(gameState));
}

function makeAllAiGameState() {
  const gameState = createFreshSeasonOneGameState();
  topUpRostersForLineupMinimum(gameState);
  const existing = gameState.seasonState.teamControlSettings ?? {};
  gameState.seasonState.teamControlSettings = Object.fromEntries(
    gameState.teams.map((team) => [
      team.teamId,
      {
        ...existing[team.teamId],
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

describe("Trainingsschicht je Spieltag genau einmal", () => {
  it("laesst den Spieler der noch offenen Disziplin aus und legt seine Schicht erst beim Commit seiner Seite auf", () => {
    const gameState = createFreshSeasonOneGameState();
    topUpRostersForLineupMinimum(gameState);
    gameState.season.totalMatchdays = 10;
    const share = FATIGUE_LOAD_BY_MODE.hart / 10;
    expect(share).toBe(2.2);

    const seasonId = gameState.season.id;
    const rosterA = gameState.rosters[0]!;
    const rosterB = gameState.rosters[1]!;

    // Ausgangslage: Spieltag m1 ist durch, beide tragen genau EINE Trainingsschicht.
    const basis: GameState = {
      ...gameState,
      players: gameState.players.map((player) => {
        if (player.id !== rosterA.playerId && player.id !== rosterB.playerId) {
          return { ...player, trainingMode: "hart" as const };
        }
        return {
          ...player,
          trainingMode: "hart" as const,
          // A: der D1-Commit von m2 hat ihn eben auf REINE Match-Fatigue gesetzt.
          // B: laeuft erst in D2, wurde vom D1-Commit gar nicht angefasst und steht deshalb
          //    noch auf seinem Vor-Spieltags-Wert — inklusive der Schicht aus m1.
          fatigue: player.id === rosterA.playerId ? 30 : 12.5,
          seasonTrainingAccumulator: {
            seasonId,
            matchdaysCounted: 1,
            modeByMatchday: { "m1": "hart" as const },
            accumulatedTrainingFatigue: share,
            updatedAt: "2026-06-06T00:00:00.000Z",
          },
        };
      }),
    };

    // --- D1-Commit von m2: B ist zurueckgestellt.
    const nachD1 = accumulateMatchdayTrainingProgress({
      gameState: basis,
      seasonId,
      matchdayId: "m2",
      deferredPlayerIds: new Set([rosterB.playerId]),
    });
    const a1 = nachD1.players.find((player) => player.id === rosterA.playerId)!;
    const b1 = nachD1.players.find((player) => player.id === rosterB.playerId)!;

    expect(a1.seasonTrainingAccumulator?.matchdaysCounted).toBe(2);
    expect(a1.seasonTrainingAccumulator?.accumulatedTrainingFatigue).toBe(4.4);
    expect(a1.fatigue).toBe(34.4);

    // B: unveraendert. Ohne die Rueckstellung stuende hier 12,5 + 4,4 = 16,9 — die Schicht
    // aus m1 steckte dann ZWEIMAL in seiner Ausdauer.
    expect(b1.seasonTrainingAccumulator?.matchdaysCounted).toBe(1);
    expect(b1.seasonTrainingAccumulator?.accumulatedTrainingFatigue).toBe(share);
    expect(b1.fatigue).toBe(12.5);

    // --- D2-Commit von m2: die Fatigue-Buchung hat beide auf reine Match-Fatigue gesetzt.
    const vorD2: GameState = {
      ...nachD1,
      players: nachD1.players.map((player) =>
        player.id === rosterA.playerId
          ? { ...player, fatigue: 30 }
          : player.id === rosterB.playerId
            ? { ...player, fatigue: 40 }
            : player,
      ),
    };
    const nachD2 = accumulateMatchdayTrainingProgress({ gameState: vorD2, seasonId, matchdayId: "m2" });
    const a2 = nachD2.players.find((player) => player.id === rosterA.playerId)!;
    const b2 = nachD2.players.find((player) => player.id === rosterB.playerId)!;

    // A wird nur neu aufgelegt (gleicher Modus, gleicher Spieltag) — kein zweites Mal gezaehlt.
    expect(a2.seasonTrainingAccumulator?.matchdaysCounted).toBe(2);
    expect(a2.seasonTrainingAccumulator?.accumulatedTrainingFatigue).toBe(4.4);
    expect(a2.fatigue).toBe(34.4);

    // B holt seine Schicht jetzt nach — genau eine, auf reiner Match-Fatigue.
    expect(b2.seasonTrainingAccumulator?.matchdaysCounted).toBe(2);
    expect(b2.seasonTrainingAccumulator?.accumulatedTrainingFatigue).toBe(4.4);
    expect(b2.fatigue).toBe(44.4);
  });
});

describe("Gebucht wird exakt das Gezeigte", () => {
  it("bewegt den Trainingsmodus nicht mehr zwischen Vorschau und Buchung", async () => {
    const gameState = makeAllAiGameState();
    // Muede Mannschaften: nur so wuerde der Fatigue-Schoner den Trainingsmodus ueberhaupt
    // umstellen wollen. Genau das darf mitten im Spieltag nicht mehr passieren.
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

    applyAiLegacyLineupBatchLocally(
      { ...scope, dryRun: false, includeWarningTeams: true, overwriteExisting: true },
      persistence,
    );
    const prepared = prepareGameStateForMatchdayResolve(persistence.getSaveById(scope.saveId)!.gameState, scope);
    persistence.saveSingleplayerState(scope.saveId, prepared.gameState);

    const gezeigterStand = persistence.getSaveById(scope.saveId)!.gameState;
    const modusVorher = new Map(gezeigterStand.players.map((player) => [player.id, player.trainingMode ?? null] as const));

    const contexts = gezeigterStand.teams.map((team) => {
      const result = loadLocalLegacyLineupContextFromGameState(gezeigterStand, { ...scope, teamId: team.teamId });
      if (!result.ok) throw new Error(result.errors.join(" | "));
      return result.context;
    });
    attachMatchdayInjuryPerformanceToContexts(contexts, buildMatchdayInjuryRollMap({ gameState: gezeigterStand, ...scope }));
    const gezeigt = buildLegacyMatchdayResolvePreview(contexts);
    const gezeigteWerte = new Map<string, number>();
    for (const disciplinePreview of gezeigt.disciplinePreviews) {
      for (const player of disciplinePreview.topPlayers) {
        gezeigteWerte.set(`${disciplinePreview.disciplineId}|${player.teamId}|${player.playerId}`, player.finalPlayerScore);
      }
    }
    expect(gezeigteWerte.size).toBeGreaterThan(100);

    const run = await runLocalMatchdayAutoRun(
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
    expect(run.steps.find((step) => step.key === "result_apply")?.status).toBe("applied");

    const nachher = persistence.getSaveById(scope.saveId)!.gameState;

    // Die URSACHE: der Auto-Run fasst `trainingMode` nicht mehr an.
    for (const player of nachher.players) {
      expect(`${player.id}:${player.trainingMode ?? null}`).toBe(`${player.id}:${modusVorher.get(player.id) ?? null}`);
    }

    // Die WIRKUNG, an Werten: jede gebuchte Spielerzeile traegt exakt die gezeigte Zahl.
    const gebucht = nachher.seasonState.playerDisciplinePerformances ?? [];
    expect(gebucht.length).toBeGreaterThan(100);
    const abweichungen: string[] = [];
    let maxDelta = 0;
    for (const zeile of gebucht) {
      const key = `${zeile.disciplineId}|${zeile.teamId}|${zeile.playerId}`;
      const erwartet = gezeigteWerte.get(key);
      if (erwartet == null) continue;
      const delta = Math.abs(zeile.finalPlayerScore - erwartet);
      maxDelta = Math.max(maxDelta, delta);
      if (delta > 0) abweichungen.push(`${key}: gezeigt ${erwartet}, gebucht ${zeile.finalPlayerScore}`);
    }
    expect(maxDelta).toBe(0);
    expect(abweichungen).toEqual([]);
  }, 120_000);
});
