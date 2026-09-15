import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import type { LegacyLineupLoadedContext } from "@/lib/lineups/legacy-lineup-types";
import { buildLegacyMatchdayResolvePreview } from "@/lib/resolve/legacy-matchday-resolve-engine";
import { ARENA_RESOLVED_DISCIPLINE_IDS, ARENA_TEAM_POINTS } from "@/lib/resolve/battle-mode-arena-team-points";

/**
 * DIE ARENA-PUNKTE EINES SPIELTAGS GEHOEREN GENAU EINER DISZIPLIN -- nicht "jeder Disziplin, die
 * arena-aufgeloest sein koennte".
 *
 * Fund des N-Team-Infrastruktur-Audits (docs/design/n-team-disziplinen-infrastruktur-audit-13-09.md,
 * Fund B2). `runBattleModeArenaMatchday()` laeuft je Aufruf fuer GENAU EINE Disziplin und liefert
 * EINE `overridesByTeamId`-Map, die NUR deren Duellausgang traegt. Der Einhaenge-Punkt im Resolve-
 * Engine fragte VOR dem B2-Fix nur, ob die GERADE GEWERTETE Disziplin ueberhaupt in
 * `ARENA_RESOLVED_DISCIPLINE_IDS` steht (Mengen-Zugehoerigkeit), NICHT, ob sie die Disziplin ist,
 * fuer die eine bestimmte Map gerechnet wurde (Identitaet). Sind D1 UND D2 desselben Spieltags
 * beide arena-aufgeloest, haette das denselben Duellausgang in BEIDE Disziplinen gebucht -- ein
 * Team kassierte den Sieg eines EINZIGEN gelaufenen Duells ZWEIMAL in die Saisontabelle.
 *
 * DER B2-FIX (dieselbe PR) ergaenzte zunaechst ein separates `arenaDisciplineId`-Guard-Feld
 * (Identitaetsvergleich statt Mengen-Zugehoerigkeit) an einer weiterhin FLACHEN teamId-Map --
 * ausreichend, solange `kickoffArenaMatchdayApply()` (lib/season/arena-matchday-resolve-service.ts)
 * bei zwei Arena-Disziplinen an einem Spieltag komplett ausstieg (`mehrdeutig`). Diese Ferndeckung
 * war genau die Sorte Invariante, die beim naechsten Umbau still bricht -- 13 der 20 Disziplinen
 * sind arena-aufgeloest, der Fall "beide Seiten Arena" trifft gemessen 41 % aller Spieltage (Audit
 * Abschnitt 3).
 *
 * WEG B (Audit Abschnitt 8, Chris' Entscheidung 15.09.) ist genau dieser naechste Umbau: der
 * Arena-Lauf bedient jetzt BEIDE Disziplinen unabhaengig. Das guard-Feld `arenaDisciplineId` reicht
 * dafuer nicht mehr (es kann nur EINE Disziplin auf einmal benennen) -- die flache teamId-Map ist
 * durch eine disziplin-geschluesselte Map ersetzt (`arenaTeamPointsByDisciplineId`,
 * `disciplineId -> teamId -> Override`), lib/lineups/legacy-lineup-types.ts. Identitaet ist damit
 * STRUKTURELL: `buildLegacyMatchdayResolvePreview()` liest fuer eine Disziplin nur `.get(disciplineId)`
 * -- es gibt keine flache Map mehr, die versehentlich fuer die falsche Disziplin gelesen werden
 * koennte. Diese Datei testet jetzt beide Seiten: dass eine fehlende Disziplin in der Map beim
 * PPS-Pfad bleibt (die alte B2-Garantie), UND dass D1 UND D2 gleichzeitig je einen EIGENEN Eintrag
 * tragen koennen, ohne sich zu ueberschreiben (der eigentliche Weg-B-Fall).
 */

const D1_ARENA = "basketball";
/** Zweite, EBENFALLS arena-aufgeloeste Disziplin -- genau der Fall, um den es hier geht. */
const D2_AUCH_ARENA = "hockey";

describe("Vorbedingung", () => {
  it("beide Testdisziplinen sind arena-aufgeloest -- sonst prueft dieser Test nichts", () => {
    expect(ARENA_RESOLVED_DISCIPLINE_IDS.has(D1_ARENA)).toBe(true);
    expect(ARENA_RESOLVED_DISCIPLINE_IDS.has(D2_AUCH_ARENA)).toBe(true);
  });
});

function createContext(input: {
  teamId: string;
  teamName: string;
  d1Scores: number[];
  d2Scores: number[];
  gameState: GameState;
}): LegacyLineupLoadedContext {
  const entries = [
    ...input.d1Scores.map((_score, index) => ({
      disciplineId: D1_ARENA,
      disciplineSide: "d1" as const,
      slotIndex: index,
      playerId: `${input.teamId}-d1-${index}`,
      activePlayerId: `active-${input.teamId}-d1-${index}`,
    })),
    ...input.d2Scores.map((_score, index) => ({
      disciplineId: D2_AUCH_ARENA,
      disciplineSide: "d2" as const,
      slotIndex: index,
      playerId: `${input.teamId}-d2-${index}`,
      activePlayerId: `active-${input.teamId}-d2-${index}`,
    })),
  ];

  return {
    saveId: "save-1",
    seasonId: "season-1",
    matchdayId: "matchday-1",
    teamId: input.teamId,
    gameState: input.gameState,
    entries,
    disciplinePlayerCounts: {
      [D1_ARENA]: input.d1Scores.length,
      [D2_AUCH_ARENA]: input.d2Scores.length,
    },
    activePlayers: entries.map((entry) => ({
      id: entry.activePlayerId,
      saveId: "save-1",
      seasonId: "season-1",
      teamId: input.teamId,
      playerId: entry.playerId,
    })),
    disciplineScores: [
      ...input.d1Scores.map((score, index) => ({
        playerId: `${input.teamId}-d1-${index}`,
        disciplineId: D1_ARENA,
        score,
      })),
      ...input.d2Scores.map((score, index) => ({
        playerId: `${input.teamId}-d2-${index}`,
        disciplineId: D2_AUCH_ARENA,
        score,
      })),
    ],
    save: { id: "save-1", name: "Save 1", status: "active" },
    season: { id: "season-1", saveId: "save-1", name: "Season 1", year: 1, currentMatchday: 1, status: "active" },
    matchday: { id: "matchday-1", seasonId: "season-1", index: 1, label: "Spieltag 1", status: "planning" },
    team: { id: input.teamId, shortCode: input.teamId, name: input.teamName },
    teamSeasonState: {
      id: `tss-${input.teamId}`,
      saveId: "save-1",
      seasonId: "season-1",
      teamId: input.teamId,
      cash: 100,
      budget: 100,
      rosterLimit: 10,
      playerOpt: 10,
    },
    teamIdentity: { pow: 10, spe: 10, men: 10, soc: 10 },
    rosterPlayers: entries.map((entry) => ({
      id: entry.playerId,
      name: entry.playerId,
      coreStats: { pow: 1, spe: 1, men: 1, soc: 1 },
    })),
    disciplines: [
      { id: D1_ARENA, name: "Basketball", category: "tactics" },
      { id: D2_AUCH_ARENA, name: "Hockey", category: "power" },
    ],
    disciplineWeights: [],
    seasonDisciplineConfigs: [
      { disciplineId: D1_ARENA, originalOrder: 1, displayOrder: 1, playerCount: input.d1Scores.length, mutator1: null, mutator2: null },
      { disciplineId: D2_AUCH_ARENA, originalOrder: 2, displayOrder: 2, playerCount: input.d2Scores.length, mutator1: null, mutator2: null },
    ],
    existingDraft: {
      lineupId: `lineup-${input.teamId}`,
      saveId: "save-1",
      seasonId: "season-1",
      matchdayId: "matchday-1",
      teamId: input.teamId,
      status: "draft",
      entries,
      modifiers: {
        d1: { primaryFormCardId: null, secondaryFormCardId: null, mutatorTrait1: null, mutatorTrait2: null },
        d2: { primaryFormCardId: null, secondaryFormCardId: null, mutatorTrait1: null, mutatorTrait2: null },
      },
      createdAt: "2026-06-03T00:00:00.000Z",
      updatedAt: "2026-06-03T00:00:00.000Z",
    },
    contextMeta: {
      saveId: "save-1",
      seasonId: "season-1",
      matchdayId: "matchday-1",
      teamId: input.teamId,
      d1DisciplineId: D1_ARENA,
      d2DisciplineId: D2_AUCH_ARENA,
    },
    fatigueByPlayerId: null,
    fatigueSourceStatus: "missing_source",
    injuryByPlayerId: null,
    injurySourceStatus: "not_applied",
    contextLoadMode: "sqlite_local",
    formCardSource: { selectionStatus: "ready", effectStatus: "ready", sourceLabel: "test", warnings: [] },
    mutatorSource: { selectionStatus: "ready", effectStatus: "ready", sourceLabel: "test", warnings: [] },
    teamPowerSource: { selectionStatus: "ready", effectStatus: "ready", sourceLabel: "test", warnings: [] },
    formCards: [],
  } as unknown as LegacyLineupLoadedContext;
}

function buildBattleModeGameState(): GameState {
  return {
    scenarioMeta: { gameMode: "battle" },
    rosters: [],
    players: [],
    teams: [],
    seasonState: {},
  } as unknown as GameState;
}

function baueContexts(gameState: GameState) {
  return [
    // Alpha ist in BEIDEN Disziplinen der PPS-schwaechere Kader -- gewinnt es trotzdem in D2, kann
    // das nur aus einer faelschlich mitgebuchten Arena-Uebersteuerung stammen.
    createContext({ teamId: "A-A", teamName: "Alpha", d1Scores: [10, 5], d2Scores: [10, 5], gameState }),
    createContext({ teamId: "B-B", teamName: "Beta", d1Scores: [50, 40], d2Scores: [50, 40], gameState }),
  ];
}

/** Die Map, die `runBattleModeArenaMatchday()` fuer GENAU EIN gelaufenes Basketball-Duell liefert. */
function basketballOverrides() {
  return new Map([
    ["A-A", { teamPoints: ARENA_TEAM_POINTS.win, arenaMatchSeed: "save-1:season-1:matchday-1:arena:basketball:A-A:B-B" }],
    ["B-B", { teamPoints: ARENA_TEAM_POINTS.loss, arenaMatchSeed: "save-1:season-1:matchday-1:arena:basketball:A-A:B-B" }],
  ]);
}

/** Die Map, die `runBattleModeArenaMatchday()` fuer GENAU EIN gelaufenes Hockey-Duell liefert -- ABSICHTLICH gegenlaeufig zu Basketball. */
function hockeyOverrides() {
  return new Map([
    ["A-A", { teamPoints: ARENA_TEAM_POINTS.loss, arenaMatchSeed: "save-1:season-1:matchday-1:arena:hockey:A-A:B-B" }],
    ["B-B", { teamPoints: ARENA_TEAM_POINTS.win, arenaMatchSeed: "save-1:season-1:matchday-1:arena:hockey:A-A:B-B" }],
  ]);
}

describe("Arena-Uebersteuerung greift nur fuer die Disziplin, fuer die sie gelaufen ist", () => {
  it("mit `arenaTeamPointsByDisciplineId` bekommt NUR D1 die Duellpunkte -- D2 bleibt beim PPS-Pfad", () => {
    const gameState = buildBattleModeGameState();
    const preview = buildLegacyMatchdayResolvePreview(baueContexts(gameState), {
      arenaTeamPointsByDisciplineId: new Map([[D1_ARENA, basketballOverrides()]]),
    });

    const d1 = preview.disciplinePreviews.find((discipline) => discipline.disciplineId === D1_ARENA);
    const d2 = preview.disciplinePreviews.find((discipline) => discipline.disciplineId === D2_AUCH_ARENA);

    // D1: das gelaufene Duell entscheidet -- Alpha gewinnt trotz schwaecherem PPS-Score.
    expect(d1?.teamResults.find((team) => team.teamId === "A-A")?.resolutionSource).toBe("arena");
    expect(d1?.teamResults.find((team) => team.teamId === "A-A")?.teamPoints).toBe(ARENA_TEAM_POINTS.win);

    // D2: KEIN Eintrag fuer D2 in der Map -> kein Arena-Ergebnis, obwohl D2 selbst arena-faehig
    // waere. Vor WEG B stand hier "arena" und Alpha kassierte denselben einen Sieg ein zweites Mal
    // (Fund B2); mit der disziplin-geschluesselten Map gibt es dafuer strukturell keine Moeglichkeit
    // mehr -- ein `.get("hockey")` auf einer Map, die nur "basketball" traegt, liefert `undefined`.
    for (const team of d2?.teamResults ?? []) {
      expect(team.resolutionSource).toBe("pps");
      expect(team.arenaMatchSeed ?? null).toBeNull();
    }
  });

  it("die Saisonpunkte des Spieltags zaehlen den EINEN Sieg genau EINMAL", () => {
    const gameState = buildBattleModeGameState();
    const preview = buildLegacyMatchdayResolvePreview(baueContexts(gameState), {
      arenaTeamPointsByDisciplineId: new Map([[D1_ARENA, basketballOverrides()]]),
    });

    const arenaSeiten = preview.disciplinePreviews.flatMap((discipline) =>
      discipline.teamResults.filter((team) => team.resolutionSource === "arena"),
    );
    // Zwei Teams x EINE Disziplin = 2 arena-gewertete Team-Zeilen. Vor dem B2-Fix waren es 4.
    expect(arenaSeiten).toHaveLength(2);
  });

  /**
   * DER EIGENTLICHE WEG-B-FALL (Audit Abschnitt 8): D1 UND D2 sind BEIDE arena-aufgeloest UND
   * BEIDE haben tatsaechlich einen eigenen Arena-Lauf bekommen (das ist genau das, was
   * `fuehreArenaMatchdayApplyAus()` in arena-matchday-resolve-service.ts seit WEG B tut). Die
   * beiden Overrides sind ABSICHTLICH gegenlaeufig (Alpha gewinnt Basketball, verliert Hockey) --
   * nur beweisbar, wenn die beiden Eintraege der Map wirklich unabhaengig gelesen werden.
   */
  it("WEG B: D1 UND D2 tragen gleichzeitig je einen EIGENEN Arena-Override, ohne sich zu ueberschreiben", () => {
    const gameState = buildBattleModeGameState();
    const preview = buildLegacyMatchdayResolvePreview(baueContexts(gameState), {
      arenaTeamPointsByDisciplineId: new Map([
        [D1_ARENA, basketballOverrides()],
        [D2_AUCH_ARENA, hockeyOverrides()],
      ]),
    });

    const d1 = preview.disciplinePreviews.find((discipline) => discipline.disciplineId === D1_ARENA);
    const d2 = preview.disciplinePreviews.find((discipline) => discipline.disciplineId === D2_AUCH_ARENA);

    // Beide Disziplinen sind jetzt "arena" -- vor WEG B war das strukturell unmoeglich (entweder
    // gar keine der beiden lief, weil `kickoffArenaMatchdayApply()` bei `mehrdeutig` ausstieg, oder
    // -- am B2-Fehler -- beide haetten denselben EINEN Duellausgang gezeigt).
    expect(d1?.teamResults.every((team) => team.resolutionSource === "arena")).toBe(true);
    expect(d2?.teamResults.every((team) => team.resolutionSource === "arena")).toBe(true);

    // Und sie sind wirklich UNABHAENGIG: Alpha gewinnt D1, verliert D2 -- kein Vermengen der
    // beiden Ergebnisse.
    expect(d1?.teamResults.find((team) => team.teamId === "A-A")?.teamPoints).toBe(ARENA_TEAM_POINTS.win);
    expect(d2?.teamResults.find((team) => team.teamId === "A-A")?.teamPoints).toBe(ARENA_TEAM_POINTS.loss);
    expect(d1?.teamResults.find((team) => team.teamId === "B-B")?.teamPoints).toBe(ARENA_TEAM_POINTS.loss);
    expect(d2?.teamResults.find((team) => team.teamId === "B-B")?.teamPoints).toBe(ARENA_TEAM_POINTS.win);

    // Zwei Teams x ZWEI Disziplinen = 4 arena-gewertete Zeilen -- diesmal zu Recht (zwei ECHTE,
    // unabhaengige Duelle), nicht wie beim B2-Fehler derselbe eine Duellausgang zweimal gebucht.
    const arenaZeilen = preview.disciplinePreviews.flatMap((discipline) =>
      discipline.teamResults.filter((team) => team.resolutionSource === "arena"),
    );
    expect(arenaZeilen).toHaveLength(4);
  });

  it("eine Disziplin ohne Eintrag in der Map bleibt beim PPS-Pfad, auch wenn eine ANDERE Disziplin desselben Spieltags einen Arena-Eintrag traegt", () => {
    // Die neue, strukturelle Garantie in derselben Form wie fruehers "OHNE arenaDisciplineId"-Test,
    // aber jetzt am eigentlichen Mechanismus: eine leere/fehlende Disziplin in der geschachtelten
    // Map ist der Normalfall (nur eine Seite arena-faehig), kein Rueckfall-Sonderpfad mehr.
    const gameState = buildBattleModeGameState();
    const preview = buildLegacyMatchdayResolvePreview(baueContexts(gameState), {
      arenaTeamPointsByDisciplineId: new Map([[D1_ARENA, basketballOverrides()]]),
    });

    const d2 = preview.disciplinePreviews.find((discipline) => discipline.disciplineId === D2_AUCH_ARENA);
    expect(d2?.teamResults.every((team) => team.resolutionSource === "pps")).toBe(true);
  });
});
