/**
 * ARENA-FLUSS 21.11. (docs/design/arena-fluss-21-11.md), Review-Auflagen: der D1-Teil-Commit darf den
 * Trainingszuwachs nicht auf die Attribute buchen (sonst kippt die Arena-Eingabe mitten im Spieltag),
 * und „D1, dann D2" muss am Ende genau dasselbe ergeben wie ein einziger voller Commit — ueber den
 * echten Buchungsweg (`LegacyMatchdayResultApplyService`), nicht nur ueber den Akkumulator.
 */
import { describe, expect, it } from "vitest";

import { createFreshSeasonOneGameState } from "@/lib/game-state/singleplayer-state";
import { applyAiLegacyLineupBatchLocally } from "@/lib/ai/ai-legacy-lineup-batch-apply-service";
import { ensureMatchdayResolveSnapshot } from "@/lib/foundation/matchday-resolve-snapshot";
import { loadLocalLegacyLineupContext } from "@/lib/lineups/legacy-lineup-local-service";
import { APPLY_CONFIRM_TOKEN, LegacyMatchdayResultApplyService } from "@/lib/resolve/legacy-matchday-result-apply-service";
import { berechneArenaEingabeHash } from "@/lib/battle/arena-eingabe-hash";
import { getMatchdayBookedTrainingIds } from "@/lib/training/organic-season-progression";
import type { GameState, Player } from "@/lib/data/olyDataTypes";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";

function createInMemoryPersistence(gameState: GameState): PersistenceService {
  let save: PersistedSaveGame = {
    saveId: "test-save",
    name: "Test Save",
    status: "active",
    createdAt: "2026-06-06T00:00:00.000Z",
    updatedAt: "2026-06-06T00:00:00.000Z",
    gameState: structuredClone(gameState),
  };

  // Nur die Methoden, die der Buchungsweg braucht (wie in beide-buchungswege-buchen-dieselbe-zahl.test.ts).
  const service: Partial<PersistenceService> = {
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
  return service as PersistenceService;
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

/** Ausgangslage: Aufstellungen stehen, der Spieltag ist EINMAL vorberechnet (wie vor der Arena). */
function vorbereiteterStand(anpassen?: (gameState: GameState) => GameState): GameState {
  const basis = makeAllAiGameState();
  const scope = { saveId: "test-save", seasonId: basis.season.id, matchdayId: basis.matchdayState.matchdayId };
  const vorbereitung = createInMemoryPersistence(basis);
  applyAiLegacyLineupBatchLocally({ ...scope, dryRun: false, includeWarningTeams: true, overwriteExisting: false }, vorbereitung);
  expect(ensureMatchdayResolveSnapshot(scope, vorbereitung)).not.toBeNull();
  const stand = vorbereitung.getSaveById("test-save")!.gameState;
  return anpassen ? anpassen(stand) : stand;
}

async function bucheSeite(persistence: PersistenceService, gameState: GameState, seite?: "d1" | "d2", forceReplace = false) {
  const ergebnis = await new LegacyMatchdayResultApplyService(undefined, undefined, persistence).applyLegacyMatchdayResult({
    saveId: "test-save",
    seasonId: gameState.season.id,
    matchdayId: gameState.matchdayState.matchdayId,
    source: "sqlite",
    execute: true,
    dryRun: false,
    confirm: APPLY_CONFIRM_TOKEN,
    // Wie der Auto-Run: der D2-Commit ersetzt die beim D1-Commit angelegte Spieltagszeile.
    forceReplace,
    ...(seite ? { commitThroughSide: seite } : {}),
  });
  expect(ergebnis.ok, JSON.stringify(ergebnis.ok ? null : ergebnis.blockingReasons)).toBe(true);
  return persistence.getSaveById("test-save")!.gameState;
}

/** Was die Arena vom Kader liest und was das Training bucht — ohne Zeitstempel. */
function spielerBild(player: Player) {
  const akku = player.seasonTrainingAccumulator;
  return {
    attributeSheetStats: player.attributeSheetStats,
    disciplineRatings: player.disciplineRatings,
    verlauf: akku?.verlauf ?? null,
    modeByMatchday: akku?.modeByMatchday ?? null,
    matchdaysCounted: akku?.matchdaysCounted ?? null,
    accumulatedTrainingFatigue: akku?.accumulatedTrainingFatigue ?? null,
  };
}

function disziplinenDesSpieltags(gameState: GameState) {
  const eintrag = gameState.seasonState.disciplineSchedule?.find((e) => e.matchdayId === gameState.matchdayState.matchdayId);
  return { d1: eintrag?.discipline1?.disciplineId ?? null, d2: eintrag?.discipline2?.disciplineId ?? null };
}

function eingabeHash(gameState: GameState, disciplineId: string) {
  return berechneArenaEingabeHash({
    gameState,
    saveId: "test-save",
    seasonId: gameState.season.id,
    matchdayId: gameState.matchdayState.matchdayId,
    disciplineId,
    mutatoren: [],
  });
}

describe("Arena-Fluss: Trainingszuwachs ueber den echten Buchungsweg", () => {
  it("D1 aendert keine Arena-Eingabe; D1 + D2 == ein voller Commit (Attribute, Disziplinwerte, Verlauf)", async () => {
    const start = vorbereiteterStand();
    const { d2 } = disziplinenDesSpieltags(start);
    expect(d2).not.toBeNull();

    const gestaffelt = createInMemoryPersistence(start);
    const nachD1 = await bucheSeite(gestaffelt, start, "d1");
    // Kader und Disziplinwerte stehen nach D1 still — die Buehne baut nichts neu, der D2-Vorlauf bleibt gueltig.
    for (const p of start.players) {
      const q = nachD1.players.find((x) => x.id === p.id)!;
      expect(q.attributeSheetStats, p.id).toEqual(p.attributeSheetStats);
      expect(q.disciplineRatings, p.id).toEqual(p.disciplineRatings);
    }
    expect(eingabeHash(nachD1, d2!)).toBe(eingabeHash(start, d2!));
    // Festgelegt ist der Zuwachs trotzdem schon (offen, nicht gebucht).
    const offene = nachD1.players.filter((p) => p.seasonTrainingAccumulator?.verlauf?.some((e) => e.o));
    expect(offene.length).toBeGreaterThan(0);
    for (const p of offene) {
      expect(getMatchdayBookedTrainingIds(p.seasonTrainingAccumulator, nachD1.season.id).has(nachD1.matchdayState.matchdayId)).toBe(false);
    }

    const nachD2 = await bucheSeite(gestaffelt, nachD1, "d2", true);
    const voll = await bucheSeite(createInMemoryPersistence(start), start);

    // Zurueckgestellte D2-Spieler: der D1-Commit laesst sie ganz aus (kein Eintrag), erst D2 bucht sie —
    // mit unveraenderten Attributen der Mitspieler, deshalb dieselben Zahlen wie im vollen Commit.
    const matchdayId = start.matchdayState.matchdayId;
    const eintragVon = (gs: GameState, id: string) =>
      gs.players.find((x) => x.id === id)?.seasonTrainingAccumulator?.verlauf?.find((e) => e.m === matchdayId) ?? null;
    const zurueckgestellt = start.rosters
      .map((r) => r.playerId)
      .filter((id) => eintragVon(nachD1, id) == null && eintragVon(nachD2, id) != null);
    expect(zurueckgestellt.length).toBeGreaterThan(0);

    let mitZuwachs = 0;
    for (const p of voll.players) {
      const q = nachD2.players.find((x) => x.id === p.id)!;
      expect(spielerBild(q), p.id).toEqual(spielerBild(p));
      if (p.seasonTrainingAccumulator?.verlauf?.some((e) => e.z)) mitZuwachs += 1;
    }
    expect(mitZuwachs).toBeGreaterThan(0);
    expect(nachD2.players.some((p) => p.seasonTrainingAccumulator?.verlauf?.some((e) => e.o))).toBe(false);
  }, 300_000);

  it("Spieltag ohne D2 im Spielplan: der D1-Commit schliesst ab, kein Zuwachs bleibt offen", async () => {
    const start = vorbereiteterStand((gameState) => ({
      ...gameState,
      seasonState: {
        ...gameState.seasonState,
        disciplineSchedule: (gameState.seasonState.disciplineSchedule ?? []).map((e) =>
          e.matchdayId === gameState.matchdayState.matchdayId ? { ...e, discipline2: null } : e,
        ),
      },
    }));
    expect(disziplinenDesSpieltags(start).d2).toBeNull();
    const nachD1 = await bucheSeite(createInMemoryPersistence(start), start, "d1");
    const matchdayId = nachD1.matchdayState.matchdayId;
    const mitEintrag = nachD1.players.filter((p) => p.seasonTrainingAccumulator?.verlauf?.some((e) => e.m === matchdayId && e.z));
    expect(mitEintrag.length).toBeGreaterThan(0);
    for (const p of mitEintrag) {
      expect(p.seasonTrainingAccumulator!.verlauf!.some((e) => e.o)).toBe(false);
      expect(getMatchdayBookedTrainingIds(p.seasonTrainingAccumulator, nachD1.season.id).has(matchdayId)).toBe(true);
      expect(p.attributeSheetStats).not.toEqual(start.players.find((x) => x.id === p.id)!.attributeSheetStats);
    }
  }, 300_000);
});
