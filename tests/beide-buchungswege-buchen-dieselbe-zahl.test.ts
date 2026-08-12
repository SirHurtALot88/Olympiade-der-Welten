import { describe, expect, it } from "vitest";

import { createFreshSeasonOneGameState } from "@/lib/game-state/singleplayer-state";
import { applyAiLegacyLineupBatchLocally } from "@/lib/ai/ai-legacy-lineup-batch-apply-service";
import { ensureMatchdayResolveSnapshot, readMatchdayResolveSnapshot } from "@/lib/foundation/matchday-resolve-snapshot";
import { loadLocalLegacyLineupContext } from "@/lib/lineups/legacy-lineup-local-service";
import {
  APPLY_CONFIRM_TOKEN,
  LegacyMatchdayResultApplyService,
  prepareLegacyMatchdayResultApply,
} from "@/lib/resolve/legacy-matchday-result-apply-service";
import { MATCHDAY_AUTO_RUN_CONFIRM_TOKEN, runLocalMatchdayAutoRun } from "@/lib/season/matchday-auto-run-service";
import type { GameState } from "@/lib/data/olyDataTypes";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";

/**
 * ZWEI RECHENSTELLEN FUER DENSELBEN SPIELTAG.
 *
 * Wer ueber die Arena bucht, bekam die vorberechnete Zahl (`matchday-auto-run-service` gibt
 * den Snapshot als `preloadedPreview` weiter). Wer ueber das Cockpit bucht
 * (`/api/resolve/legacy-matchday-apply` -> `prepareLegacyMatchdayResultApply`), bekam eine
 * zweite, frisch gerechnete. Beide Wege stehen dem Spieler offen.
 *
 * GEMESSEN am Live-Abbild vom 12.08.2026 — beide Wege auf demselben Ausgangszustand gebucht,
 * nachdem zwischen "Aufstellung gespeichert" und "gebucht" eine gewoehnliche Trainingswoche
 * lag (Spielerwerte bewegen sich, die Aufstellungen nicht):
 *
 *   Spielstand `new-game-1784747079649-n90y4m`, Spieltag 1:
 *     60 von 64 Disziplin-Zeilen verschieden, max 5,10 Score, 21 vertauschte Raenge,
 *     125 von 160 Spielerzeilen verschieden (max 3,20).
 *   Spielstand `new-game-1785823388048-1hf25q`, Saison 2, Spieltag 9:
 *     63 von 64 Zeilen verschieden, max 6,70 Score, 22 vertauschte Raenge,
 *     172 von 224 Spielerzeilen verschieden (max 2,70).
 *
 *   Nach der Zusammenlegung beide Male: 0 von 64 Zeilen, 0 vertauschte Raenge,
 *   0 von 160 bzw. 0 von 224 Spielerzeilen.
 *
 * Ein vertauschter Rang ist keine Kosmetik: aus ihm fallen die Tagespunkte, und aus denen
 * der Saisonstand. Der Spieler haette je nach Knopf ein anderes Ergebnis bekommen.
 *
 * Diese Suite prueft WERTE: dieselbe Ausgangslage, beide Buchungswege, gleiche Zahlen.
 */

function createInMemoryPersistence(gameState: GameState): PersistenceService {
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
      return { save: structuredClone(save), createdFromSeed: false };
    },
    getActiveSave() {
      return structuredClone(save);
    },
    getSaveById(saveId) {
      return save.saveId === saveId ? structuredClone(save) : null;
    },
    saveSingleplayerState(saveId, nextGameState) {
      if (save.saveId !== saveId) throw new Error(`Unknown save ${saveId}`);
      save = { ...save, updatedAt: "2026-06-06T00:00:01.000Z", gameState: structuredClone(nextGameState) };
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
      return save.saveId === saveId ? structuredClone(save) : null;
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
      if (!player) throw new Error("Not enough free players to top up lineup test rosters.");
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

/**
 * Eine gewoehnliche Woche zwischen "Aufstellung gespeichert" und "gebucht": die Spielerwerte
 * bewegen sich (Training, ungleich verteilt), und an den Vertraegen wurde gearbeitet
 * (Gehalt). Aufstellungen und Verfuegbarkeit bleiben unberuehrt — die Vorberechnung bleibt
 * damit gueltig, das frisch gerechnete Ergebnis waere aber ein anderes.
 *
 * Das Gehalt muss mitwandern, weil `legacy-lineup-local-service` seinen Kontext-Zwischen-
 * speicher ueber eine Kader-Signatur schluesselt, in der die Spielerwerte NICHT vorkommen —
 * ohne eine Kaderbewegung wuerde die Trainingswoche innerhalb desselben Prozesses gar nicht
 * ankommen (siehe `buildSharedLineupContextBaseCacheKey`).
 */
function applyTrainingWeek(gameState: GameState): GameState {
  const zuwachs = (playerId: string, disciplineId: string) => {
    const key = `${playerId}|${disciplineId}`;
    let hash = 0;
    for (let index = 0; index < key.length; index += 1) hash = (hash * 31 + key.charCodeAt(index)) >>> 0;
    return (hash % 4) - 1;
  };
  return {
    ...gameState,
    rosters: gameState.rosters.map((entry) => ({ ...entry, salary: entry.salary + 1 })),
    players: gameState.players.map((player) => {
      const ratings = player.disciplineRatings;
      if (!ratings) return player;
      const next: Record<string, number> = {};
      for (const [disciplineId, value] of Object.entries(ratings)) {
        next[disciplineId] = Math.max(1, Math.min(100, (value ?? 0) + zuwachs(player.id, disciplineId)));
      }
      return { ...player, disciplineRatings: next };
    }),
  };
}

type BookedRow = { rank: number; totalScore: number };

function bookedRows(persistence: PersistenceService, matchdayId: string) {
  const seasonState = persistence.getSaveById("test-save")!.gameState.seasonState;
  const resultIds = new Set(
    (seasonState.matchdayResults ?? []).filter((entry) => entry.matchdayId === matchdayId).map((entry) => entry.id),
  );
  const rows = new Map<string, BookedRow>();
  for (const row of seasonState.disciplineResults ?? []) {
    if (!resultIds.has(row.matchdayResultId)) continue;
    rows.set(`${row.disciplineSide}:${row.disciplineId}:${row.teamId}`, {
      rank: row.rank,
      totalScore: row.totalScore,
    });
  }
  return rows;
}

function bookedPlayerRows(persistence: PersistenceService, matchdayId: string) {
  const seasonState = persistence.getSaveById("test-save")!.gameState.seasonState;
  const resultIds = new Set(
    (seasonState.matchdayResults ?? []).filter((entry) => entry.matchdayId === matchdayId).map((entry) => entry.id),
  );
  const rows = new Map<string, number>();
  for (const row of seasonState.playerDisciplinePerformances ?? []) {
    if (!resultIds.has(row.matchdayResultId)) continue;
    rows.set(`${row.disciplineId}:${row.teamId}:${row.playerId}`, row.finalPlayerScore);
  }
  return rows;
}

describe("beide Buchungswege buchen dieselbe Zahl", () => {
  it("Arena und Cockpit schreiben auf demselben Ausgangszustand identische Scores, Raenge und Spielerzeilen", async () => {
    const baseState = makeAllAiGameState();
    const scope = {
      saveId: "test-save",
      seasonId: baseState.season.id,
      matchdayId: baseState.matchdayState.matchdayId,
    };

    // Der Weg zur Arena: Aufstellungen stehen, der Spieltag wird EINMAL vorberechnet.
    const vorbereitung = createInMemoryPersistence(baseState);
    applyAiLegacyLineupBatchLocally(
      { ...scope, dryRun: false, includeWarningTeams: true, overwriteExisting: false },
      vorbereitung,
    );
    expect(ensureMatchdayResolveSnapshot(scope, vorbereitung)).not.toBeNull();

    // Danach vergeht Zeit: eine Trainingswoche bewegt die Spielerwerte.
    const ausgangszustand = applyTrainingWeek(vorbereitung.getSaveById("test-save")!.gameState);

    // Die Vorberechnung bleibt gueltig — die Aufstellungen haben sich ja nicht bewegt.
    expect(readMatchdayResolveSnapshot(ausgangszustand, scope)).not.toBeNull();

    // Und sie unterscheidet sich jetzt vom frisch gerechneten Ergebnis. Ohne diesen Nachweis
    // koennte der Gleichheitsbeweis unten trivial gruen sein.
    const gegenprobePersistence = createInMemoryPersistence(ausgangszustand);
    const ohneSnapshot = structuredClone(ausgangszustand);
    ohneSnapshot.seasonState.matchdayResolveSnapshots = [];
    gegenprobePersistence.saveSingleplayerState("test-save", ohneSnapshot);
    const frisch = await prepareLegacyMatchdayResultApply(
      { ...scope, source: "sqlite" },
      { persistence: gegenprobePersistence },
    );
    expect(frisch.previewSource).toBe("live");
    const vorberechnet = readMatchdayResolveSnapshot(ausgangszustand, scope)!.payload.preview;
    const frischeZeilen = new Map(
      frisch.preview.disciplinePreviews.flatMap((discipline) =>
        discipline.teamResults.map((team) => [`${discipline.disciplineId}:${team.teamId}`, team.score] as const),
      ),
    );
    const bewegteZeilen = vorberechnet.disciplinePreviews
      .flatMap((discipline) => discipline.teamResults.map((team) => [`${discipline.disciplineId}:${team.teamId}`, team.score] as const))
      .filter(([key, score]) => Math.abs((frischeZeilen.get(key) ?? score) - score) >= 0.005);
    expect(bewegteZeilen.length).toBeGreaterThan(0);

    // WEG 1 — Arena: pro Disziplin buchen.
    const arenaPersistence = createInMemoryPersistence(ausgangszustand);
    for (const commitThroughSide of ["d1", "d2"] as const) {
      const lauf = await runLocalMatchdayAutoRun(
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
            commitThroughSide,
          },
        },
        arenaPersistence,
      );
      expect(lauf.summary.resultApplyAllowed).toBe(true);
    }

    // WEG 2 — Cockpit: /api/resolve/legacy-matchday-apply, ohne Buehne davor.
    const cockpitPersistence = createInMemoryPersistence(ausgangszustand);
    const cockpit = await new LegacyMatchdayResultApplyService(undefined, undefined, cockpitPersistence)
      .applyLegacyMatchdayResult({
        ...scope,
        source: "sqlite",
        execute: true,
        dryRun: false,
        confirm: APPLY_CONFIRM_TOKEN,
      });
    expect(cockpit.ok).toBe(true);

    const arenaRows = bookedRows(arenaPersistence, scope.matchdayId);
    const cockpitRows = bookedRows(cockpitPersistence, scope.matchdayId);
    expect(arenaRows.size).toBeGreaterThan(0);
    expect(cockpitRows.size).toBe(arenaRows.size);
    for (const [key, arenaRow] of arenaRows) {
      expect(cockpitRows.get(key), `Disziplin-Zeile ${key}`).toEqual(arenaRow);
    }

    const arenaPlayers = bookedPlayerRows(arenaPersistence, scope.matchdayId);
    const cockpitPlayers = bookedPlayerRows(cockpitPersistence, scope.matchdayId);
    expect(arenaPlayers.size).toBeGreaterThan(0);
    expect(cockpitPlayers.size).toBe(arenaPlayers.size);
    for (const [key, score] of arenaPlayers) {
      expect(cockpitPlayers.get(key), `Spielerzeile ${key}`).toBe(score);
    }
  }, 300_000);
});
