import { describe, expect, it, vi } from "vitest";

import { kickoffArenaMatchdayApply } from "@/lib/season/arena-matchday-resolve-service";
import { ARENA_RESOLVED_DISCIPLINE_IDS } from "@/lib/resolve/battle-mode-arena-team-points";
import type { ArenaFixtureInput, ArenaFixtureResult } from "@/lib/battle/arena-headless-runner";
import type { GameState } from "@/lib/data/olyDataTypes";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";

/**
 * WEG B (N-Team-Infrastruktur-Audit 13.09., Abschnitt 8 — Chris' ausdrueckliche Entscheidung
 * 15.09.): stellt Fund B1 (Abschnitt 3) direkt nach, am selben Einhaengepunkt, an dem er lebte —
 * `kickoffArenaMatchdayApply()` (lib/season/arena-matchday-resolve-service.ts). VORHER: sind D1
 * UND D2 eines Spieltags BEIDE arena-aufgeloest, galt das als `mehrdeutig` und der GESAMTE
 * Spieltag fiel auf den PPS-Pfad zurueck (`{ applicable: false }`) — gemessen 41,0-41,8 % aller
 * Battle-Mode-Spieltage (Audit Abschnitt 3.1). NACHHER: `kickoffArenaMatchdayApply()` ist
 * anwendbar UND der Hintergrundlauf faehrt fuer JEDE der beiden Disziplinen einen EIGENEN,
 * unabhaengigen Arena-Lauf (kein Ueberschreiben, keine Doppelbuchung — Fund B2 bleibt behoben).
 *
 * Absichtlich MINIMAL gehalten (kein voller `createFreshSeasonOneGameState()`/`buildNewGameStateFromBaseline()`-
 * Aufbau): `kickoffArenaMatchdayApply()`s Entscheidung (`determineArenaDisciplineContexts()`)
 * haengt nur an `contextMeta.d1DisciplineId`/`d2DisciplineId`, die schon aus Season/Matchday/Team/
 * TeamIdentity plus dem Spielplan-Eintrag hervorgehen — OHNE eine vollstaendige, aufgestellte
 * Einsatzliste zu brauchen (s. `buildContextFromGameState()`, lib/lineups/legacy-lineup-local-
 * service.ts: `ok:false` nur bei fehlender Season/Spieltag/Team/TeamIdentity, nicht bei
 * fehlendem/unvollstaendigem Lineup-Entwurf). Der nachgelagerte Buchungsschritt
 * (`LegacyMatchdayResultApplyService.applyLegacyMatchdayResult`) kann an dieser unvollstaendigen
 * Einsatzliste scheitern (`arenaMatchdayResolveStatus: "failed"`) — das ist fuer DIESEN Test
 * unerheblich: er misst die Kickoff-Entscheidung und die Arena-Orchestrierung, nicht die volle
 * Buchungskette (die hat eigene, bestehende Abdeckung, s. tests/arena-preview-booked-as-shown.test.ts).
 */

function createInMemoryPersistence(gameState: GameState): PersistenceService {
  let save: PersistedSaveGame = {
    saveId: "test-save",
    name: "Test Save",
    status: "active",
    createdAt: "2026-09-15T00:00:00.000Z",
    updatedAt: "2026-09-15T00:00:00.000Z",
    gameState: structuredClone(gameState),
  };

  return {
    bootstrapSingleplayerSave() {
      return { save, createdFromSeed: false };
    },
    getActiveSave() {
      return save;
    },
    getSaveById(saveId: string) {
      if (save.saveId !== saveId) return null;
      return save;
    },
    saveSingleplayerState(saveId: string, nextGameState: GameState) {
      if (save.saveId !== saveId) throw new Error(`Unknown save ${saveId}`);
      save = { ...save, updatedAt: new Date().toISOString(), gameState: structuredClone(nextGameState) };
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
    activateSave(saveId: string) {
      if (save.saveId !== saveId) return null;
      return save;
    },
    listSaves() {
      return [{ saveId: save.saveId, name: save.name, status: save.status, createdAt: save.createdAt, updatedAt: save.updatedAt }];
    },
  } as unknown as PersistenceService;
}

/** D1 = basketball, D2 = gewichtheben — BEIDE arena-aufgeloest, absichtlich die Weg-B-Konstellation. */
const D1_ARENA = "basketball";
const D2_ARENA = "gewichtheben";
/** Kontroll-Fixture (Abschnitt "eine arena-faehige Disziplin bleibt unveraendert"): D2 nicht arena-faehig. */
const D2_NICHT_ARENA = "football";

function buildMinimalBattleModeGameState(input: { d1: string; d2: string }): GameState {
  return {
    scenarioMeta: { gameMode: "battle" },
    gamePhase: "season_active",
    season: { id: "season-1", matchdayIds: ["matchday-1"] },
    matchdayState: { matchdayId: "matchday-1", status: "planning" },
    teams: [
      { teamId: "A-A", shortCode: "AA", name: "Alpha" },
      { teamId: "B-B", shortCode: "BB", name: "Beta" },
    ],
    teamIdentities: [
      { teamId: "A-A", pow: 10, spe: 10, men: 10, soc: 10, ambition: 10, finances: 10, boardConfidence: 10, harmony: 10 },
      { teamId: "B-B", pow: 10, spe: 10, men: 10, soc: 10, ambition: 10, finances: 10, boardConfidence: 10, harmony: 10 },
    ],
    players: [],
    rosters: [],
    disciplines: [
      { id: input.d1, name: input.d1, category: "tactics", playerCount: 2 },
      { id: input.d2, name: input.d2, category: "power", playerCount: 2 },
    ],
    seasonState: {
      leagueByTeamId: { "A-A": "liga1", "B-B": "liga1" },
      schedule: [{ id: "f1", homeTeamId: "A-A", awayTeamId: "B-B", matchdayId: "matchday-1", leagueTier: "liga1", status: "scheduled" }],
      disciplineSchedule: [
        {
          seasonId: "season-1",
          matchdayId: "matchday-1",
          matchdayIndex: 1,
          matchdayLabel: "Spieltag 1",
          discipline1: { disciplineId: input.d1, displayName: input.d1, order: 1, playerCount: 2, category: "tactics" },
          discipline2: { disciplineId: input.d2, displayName: input.d2, order: 2, playerCount: 2, category: "power" },
          sourceStatus: "season_seed",
          sourceNote: null,
        },
      ],
      lineupDrafts: [],
    },
  } as unknown as GameState;
}

async function warteAufArenaMatchdayResolveStatus(persistence: PersistenceService, saveId: string): Promise<string | undefined> {
  for (let versuch = 0; versuch < 300; versuch += 1) {
    const status = persistence.getSaveById(saveId)?.gameState.seasonState.arenaMatchdayResolveStatus as string | undefined;
    if (status === "ready" || status === "failed") return status;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("arenaMatchdayResolveStatus wurde nicht innerhalb des Timeouts final (ready/failed).");
}

function buildMockRunner(seitenByDiscipline: Record<string, [number, number]>) {
  const aufrufeJeDisziplin: Record<string, number> = {};
  const seedsJeDisziplin: Record<string, string[]> = {};
  const runArenaFixturesImpl = vi.fn(async (_gameState: GameState, fixtures: ArenaFixtureInput[], disziplin: string): Promise<ArenaFixtureResult[]> => {
    aufrufeJeDisziplin[disziplin] = (aufrufeJeDisziplin[disziplin] ?? 0) + 1;
    seedsJeDisziplin[disziplin] = fixtures.map((fixture) => String(fixture.seed));
    const seiten = seitenByDiscipline[disziplin] ?? [1, 0];
    return fixtures.map((fixture) => ({
      homeTeamId: fixture.homeTeamId,
      awayTeamId: fixture.awayTeamId,
      seiten,
      boxscore: [],
    }));
  });
  return { runArenaFixturesImpl, aufrufeJeDisziplin, seedsJeDisziplin };
}

describe("Vorbedingung", () => {
  it("D1 und D2 dieses Tests sind beide arena-aufgeloest, die Kontrolldisziplin nicht", () => {
    expect(ARENA_RESOLVED_DISCIPLINE_IDS.has(D1_ARENA)).toBe(true);
    expect(ARENA_RESOLVED_DISCIPLINE_IDS.has(D2_ARENA)).toBe(true);
    expect(ARENA_RESOLVED_DISCIPLINE_IDS.has(D2_NICHT_ARENA)).toBe(false);
  });
});

describe("WEG B: ein Spieltag mit ZWEI arena-faehigen Disziplinen (Fund B1)", () => {
  it("kickoffArenaMatchdayApply() ist jetzt anwendbar statt `mehrdeutig` -> { applicable: false }", async () => {
    const gameState = buildMinimalBattleModeGameState({ d1: D1_ARENA, d2: D2_ARENA });
    const persistence = createInMemoryPersistence(gameState);
    const { runArenaFixturesImpl } = buildMockRunner({ [D1_ARENA]: [80, 70], [D2_ARENA]: [60, 90] });

    const kickoff = kickoffArenaMatchdayApply({
      persistence,
      saveId: "test-save",
      seasonId: "season-1",
      matchdayId: "matchday-1",
      logPrefix: "[test-weg-b]",
      runArenaFixturesImpl: runArenaFixturesImpl as never,
    });

    // VOR WEG B waere das hier `{ applicable: false }` gewesen (die `mehrdeutig`-Wache). Das ist
    // der Kern von Fund B1: der gesamte Spieltag fiel auf PPS zurueck, obwohl beide Disziplinen
    // arena-faehig sind.
    expect(kickoff.applicable).toBe(true);
    if (kickoff.applicable) {
      expect(kickoff.save.gameState.seasonState.arenaMatchdayResolveStatus).toBe("in_progress");
    }

    await warteAufArenaMatchdayResolveStatus(persistence, "test-save");
  });

  it("laesst BEIDE Disziplinen unabhaengig als echtes Arena-Duell laufen -- nicht nur eine, nicht vermengt", async () => {
    const gameState = buildMinimalBattleModeGameState({ d1: D1_ARENA, d2: D2_ARENA });
    const persistence = createInMemoryPersistence(gameState);
    // Absichtlich GEGENLAEUFIGE Sieger je Disziplin: A-A gewinnt Basketball (80:70), verliert
    // Gewichtheben (60:90) -- nur beweisbar, wenn beide Laeufe wirklich unabhaengig sind.
    const { runArenaFixturesImpl, aufrufeJeDisziplin, seedsJeDisziplin } = buildMockRunner({
      [D1_ARENA]: [80, 70],
      [D2_ARENA]: [60, 90],
    });

    const kickoff = kickoffArenaMatchdayApply({
      persistence,
      saveId: "test-save",
      seasonId: "season-1",
      matchdayId: "matchday-1",
      logPrefix: "[test-weg-b]",
      runArenaFixturesImpl: runArenaFixturesImpl as never,
    });
    expect(kickoff.applicable).toBe(true);
    await warteAufArenaMatchdayResolveStatus(persistence, "test-save");

    // DER KERN VON WEG B: genau EIN Arena-Lauf JE Disziplin, nicht nur einer insgesamt (vorher:
    // ueberhaupt keiner, wegen `mehrdeutig`) und nicht derselbe Lauf fuer beide (das waere Fund B2).
    expect(runArenaFixturesImpl).toHaveBeenCalledTimes(2);
    expect(aufrufeJeDisziplin[D1_ARENA]).toBe(1);
    expect(aufrufeJeDisziplin[D2_ARENA]).toBe(1);

    // SEED-UNABHAENGIGKEIT (in dieser PR gefundene, vorher unerreichbare Invariante, s.
    // buildArenaMatchSeed()-Kommentar): dieselbe Team-Paarung (A-A vs B-B) am selben Spieltag
    // bekommt fuer D1 und D2 VERSCHIEDENE Seeds -- ohne `disciplineId` im Seed waeren es
    // identische Text-Seeds fuer zwei komplett verschiedene Arena-Motoren gewesen.
    const seedD1 = seedsJeDisziplin[D1_ARENA]?.[0];
    const seedD2 = seedsJeDisziplin[D2_ARENA]?.[0];
    expect(seedD1).toBeDefined();
    expect(seedD2).toBeDefined();
    expect(seedD1).not.toBe(seedD2);
    expect(seedD1).toContain(D1_ARENA);
    expect(seedD2).toContain(D2_ARENA);
  });
});

describe("Unveraendert: ein Spieltag mit NUR EINER arena-faehigen Disziplin", () => {
  it("laeuft weiterhin fuer genau die eine arena-faehige Disziplin -- die andere bleibt PPS, kein Verhaltenswechsel", async () => {
    const gameState = buildMinimalBattleModeGameState({ d1: D1_ARENA, d2: D2_NICHT_ARENA });
    const persistence = createInMemoryPersistence(gameState);
    const { runArenaFixturesImpl, aufrufeJeDisziplin } = buildMockRunner({ [D1_ARENA]: [80, 70] });

    const kickoff = kickoffArenaMatchdayApply({
      persistence,
      saveId: "test-save",
      seasonId: "season-1",
      matchdayId: "matchday-1",
      logPrefix: "[test-weg-b]",
      runArenaFixturesImpl: runArenaFixturesImpl as never,
    });
    expect(kickoff.applicable).toBe(true);
    await warteAufArenaMatchdayResolveStatus(persistence, "test-save");

    // Genau EIN Arena-Lauf (D1) -- die Kontrolldisziplin (D2, nicht arena-faehig) loest KEINEN
    // zweiten Lauf aus. Bit-identisches Verhalten zu vor WEG B fuer diesen Fall.
    expect(runArenaFixturesImpl).toHaveBeenCalledTimes(1);
    expect(aufrufeJeDisziplin[D1_ARENA]).toBe(1);
    expect(aufrufeJeDisziplin[D2_NICHT_ARENA]).toBeUndefined();
  });
});

describe("Unveraendert: kein arena-aufgeloester Spieltag", () => {
  it("bleibt applicable:false, wenn weder D1 noch D2 arena-faehig sind", () => {
    const gameState = buildMinimalBattleModeGameState({ d1: "football", d2: "mini-dm" });
    const persistence = createInMemoryPersistence(gameState);
    const { runArenaFixturesImpl } = buildMockRunner({});

    const kickoff = kickoffArenaMatchdayApply({
      persistence,
      saveId: "test-save",
      seasonId: "season-1",
      matchdayId: "matchday-1",
      logPrefix: "[test-weg-b]",
      runArenaFixturesImpl: runArenaFixturesImpl as never,
    });

    expect(kickoff.applicable).toBe(false);
    expect(runArenaFixturesImpl).not.toHaveBeenCalled();
  });
});
