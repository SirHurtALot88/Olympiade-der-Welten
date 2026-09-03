import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import type { LegacyLineupLoadedContext } from "@/lib/lineups/legacy-lineup-types";
import { buildLegacyMatchdayResolvePreview } from "@/lib/resolve/legacy-matchday-resolve-engine";
import { ARENA_TEAM_POINTS } from "@/lib/resolve/battle-mode-arena-team-points";

/**
 * Einhaengen des Arena-Team-Punkte-Adapters in `buildLegacyMatchdayResolvePreview()` (PR 7 von 9,
 * docs/design/battle-mode-spielmodus-plan.md, Abschnitt 3.3c/5.1). Testet NUR die synchrone
 * Override-Logik im Resolve-Engine — kein Playwright/Chromium noetig (die Overrides kommen hier
 * immer schon fertig gerechnet rein, wie es `arena-matchday-resolve-service.ts` im echten Betrieb
 * auch tut).
 *
 * Sicherheitsrahmen, den diese Datei vor allem absichert: eine mitgelieferte Arena-Punkte-Map
 * darf NUR fuer `disciplineId === "basketball"` in einem `isBattleModeSave()`-Save greifen — jede
 * andere Kombination (Manager Mode, jede andere Disziplin, fehlender gameState) bleibt exakt beim
 * bisherigen PPS-Pfad, selbst wenn die Map gesetzt ist.
 */

function createContext(input: {
  teamId: string;
  teamName: string;
  d1DisciplineId?: string;
  d1Scores: number[];
  d2Scores: number[];
  gameState?: GameState;
}): LegacyLineupLoadedContext {
  const d1DisciplineId = input.d1DisciplineId ?? "basketball";
  const entries = [
    ...input.d1Scores.map((score, index) => ({
      disciplineId: d1DisciplineId,
      disciplineSide: "d1" as const,
      slotIndex: index,
      playerId: `${input.teamId}-d1-${index}`,
      activePlayerId: `active-${input.teamId}-d1-${index}`,
    })),
    ...input.d2Scores.map((score, index) => ({
      disciplineId: "fechten",
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
      [d1DisciplineId]: input.d1Scores.length,
      fechten: input.d2Scores.length,
    },
    activePlayers: entries.map((entry) => ({
      id: entry.activePlayerId ?? `missing-${entry.playerId}`,
      saveId: "save-1",
      seasonId: "season-1",
      teamId: input.teamId,
      playerId: entry.playerId,
    })),
    disciplineScores: [
      ...input.d1Scores.map((score, index) => ({
        playerId: `${input.teamId}-d1-${index}`,
        disciplineId: d1DisciplineId,
        score,
      })),
      ...input.d2Scores.map((score, index) => ({
        playerId: `${input.teamId}-d2-${index}`,
        disciplineId: "fechten",
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
      { id: d1DisciplineId, name: "Basketball", category: "tactics" },
      { id: "fechten", name: "Fechten", category: "speed" },
    ],
    disciplineWeights: [],
    seasonDisciplineConfigs: [
      { disciplineId: d1DisciplineId, originalOrder: 1, displayOrder: 1, playerCount: input.d1Scores.length, mutator1: null, mutator2: null },
      { disciplineId: "fechten", originalOrder: 2, displayOrder: 2, playerCount: input.d2Scores.length, mutator1: null, mutator2: null },
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
      d1DisciplineId,
      d2DisciplineId: "fechten",
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

function buildManagerModeGameState(): GameState {
  return {
    scenarioMeta: { gameMode: "manager" },
    rosters: [],
    players: [],
    teams: [],
    seasonState: {},
  } as unknown as GameState;
}

describe("battle mode arena team points in buildLegacyMatchdayResolvePreview", () => {
  it("wendet das 2/1/0-Modell fuer Basketball in einem Battle-Mode-Save an, NICHT die Rang-Formel", () => {
    const gameState = buildBattleModeGameState();
    const arenaTeamPointsByTeamId = new Map([
      ["A-A", { teamPoints: ARENA_TEAM_POINTS.win, arenaMatchSeed: "save-1:season-1:matchday-1:arena:A-A:B-B" }],
      ["B-B", { teamPoints: ARENA_TEAM_POINTS.loss, arenaMatchSeed: "save-1:season-1:matchday-1:arena:A-A:B-B" }],
    ]);

    const preview = buildLegacyMatchdayResolvePreview(
      [
        createContext({ teamId: "A-A", teamName: "Alpha", d1Scores: [10, 5], d2Scores: [40], gameState }),
        createContext({ teamId: "B-B", teamName: "Beta", d1Scores: [50, 40], d2Scores: [35], gameState }),
      ],
      { arenaTeamPointsByTeamId },
    );

    const basketball = preview.disciplinePreviews.find((discipline) => discipline.disciplineId === "basketball");
    const alpha = basketball?.teamResults.find((team) => team.teamId === "A-A");
    const beta = basketball?.teamResults.find((team) => team.teamId === "B-B");

    // Alpha hat den NIEDRIGEREN PPS-Basiswert, gewinnt aber das Arena-Duell -- waere hier die
    // Rang-Formel noch aktiv, haette Beta (hoeherer Score) die Team-Punkte, nicht Alpha. Genau
    // dieser Umkehr-Fall beweist, dass wirklich die Arena entscheidet, nicht der PPS-Score.
    expect(alpha?.resolutionSource).toBe("arena");
    expect(alpha?.teamPoints).toBe(ARENA_TEAM_POINTS.win);
    expect(alpha?.arenaMatchSeed).toBe("save-1:season-1:matchday-1:arena:A-A:B-B");
    expect(beta?.resolutionSource).toBe("arena");
    expect(beta?.teamPoints).toBe(ARENA_TEAM_POINTS.loss);

    // Fechten (D2, keine Arena-Disziplin) bleibt exakt beim bestehenden PPS-Pfad im selben Preview.
    const fechten = preview.disciplinePreviews.find((discipline) => discipline.disciplineId === "fechten");
    for (const team of fechten?.teamResults ?? []) {
      expect(team.resolutionSource).toBe("pps");
      expect(team.arenaMatchSeed ?? null).toBeNull();
    }
  });

  it("individuelle Spieler-PPs (entries[].pointsAwarded) bleiben unveraendert -- nur die TEAM-Punkte wechseln", () => {
    const gameState = buildBattleModeGameState();
    const contexts = [
      createContext({ teamId: "A-A", teamName: "Alpha", d1Scores: [10, 5], d2Scores: [40], gameState }),
      createContext({ teamId: "B-B", teamName: "Beta", d1Scores: [50, 40], d2Scores: [35], gameState }),
    ];

    const withoutArena = buildLegacyMatchdayResolvePreview(contexts);
    const withArena = buildLegacyMatchdayResolvePreview(contexts, {
      arenaTeamPointsByTeamId: new Map([
        ["A-A", { teamPoints: ARENA_TEAM_POINTS.win, arenaMatchSeed: "seed-a-b" }],
        ["B-B", { teamPoints: ARENA_TEAM_POINTS.loss, arenaMatchSeed: "seed-a-b" }],
      ]),
    });

    const basketballWithout = withoutArena.disciplinePreviews.find((discipline) => discipline.disciplineId === "basketball");
    const basketballWith = withArena.disciplinePreviews.find((discipline) => discipline.disciplineId === "basketball");

    const alphaWithout = basketballWithout?.teamResults.find((team) => team.teamId === "A-A");
    const alphaWith = basketballWith?.teamResults.find((team) => team.teamId === "A-A");

    // Team-Punkte unterscheiden sich (2 statt der Rang-Formel) ...
    expect(alphaWith?.teamPoints).not.toBe(alphaWithout?.teamPoints);
    expect(alphaWith?.teamPoints).toBe(ARENA_TEAM_POINTS.win);
    // ... aber jeder einzelne Spieler bekommt exakt dieselben individuellen Punkte wie ohne Arena
    // (Plan Abschnitt 5.1, Zusatzentscheidung: PPs bleiben vorerst auf dem alten Pfad).
    expect(alphaWith?.entries.map((entry) => entry.pointsAwarded)).toEqual(
      alphaWithout?.entries.map((entry) => entry.pointsAwarded),
    );
  });

  /**
   * BOXSCORE-AN-PPS (docs/design/boxscore-an-pps.md): sobald `arenaIndividualBoxscorePpsByPlayerId`
   * einen Eintrag fuer einen Spieler traegt, kommen seine individuellen PPs jetzt tatsaechlich aus
   * dem Arena-Boxscore-Impact -- nicht mehr aus der alten PPS-Rang-Formel. Der Beweis ist eine
   * ABSICHTLICH UMGEKEHRTE Reihenfolge: der PPS-staerkere Spieler bekommt eine NIEDRIGERE
   * Boxscore-PPs-Zahl als sein PPS-schwaecherer Teamkollege.
   */
  it("Basketball: individuelle PPs kommen aus arenaIndividualBoxscorePpsByPlayerId, sobald ein Eintrag vorliegt", () => {
    const gameState = buildBattleModeGameState();
    const contexts = [
      createContext({ teamId: "A-A", teamName: "Alpha", d1Scores: [10, 5], d2Scores: [40], gameState }),
      createContext({ teamId: "B-B", teamName: "Beta", d1Scores: [50, 40], d2Scores: [35], gameState }),
    ];

    const withoutArena = buildLegacyMatchdayResolvePreview(contexts);
    const withArenaBoxscore = buildLegacyMatchdayResolvePreview(contexts, {
      arenaTeamPointsByTeamId: new Map([
        ["A-A", { teamPoints: ARENA_TEAM_POINTS.win, arenaMatchSeed: "seed-a-b" }],
        ["B-B", { teamPoints: ARENA_TEAM_POINTS.loss, arenaMatchSeed: "seed-a-b" }],
      ]),
      // A-A-d1-0 hatte den HOEHEREN PPS-Score (10 vs. 5) -- hier ABSICHTLICH die NIEDRIGERE
      // Boxscore-PPs-Zahl, damit ein Effekt eindeutig auf den Boxscore zurueckzufuehren ist.
      arenaIndividualBoxscorePpsByPlayerId: new Map([
        ["A-A-d1-0", 0.5],
        ["A-A-d1-1", 5.9],
      ]),
    });

    const alphaWithout = withoutArena.disciplinePreviews
      .find((discipline) => discipline.disciplineId === "basketball")
      ?.teamResults.find((team) => team.teamId === "A-A");
    const alphaWith = withArenaBoxscore.disciplinePreviews
      .find((discipline) => discipline.disciplineId === "basketball")
      ?.teamResults.find((team) => team.teamId === "A-A");

    const entryWithout = (playerId: string) => alphaWithout?.entries.find((entry) => entry.playerId === playerId);
    const entryWith = (playerId: string) => alphaWith?.entries.find((entry) => entry.playerId === playerId);

    // ALTE FORMEL (ohne Arena-Boxscore): der PPS-staerkere Spieler (Score 10) bekommt MEHR Punkte.
    expect(entryWithout("A-A-d1-0")!.pointsAwarded!).toBeGreaterThan(entryWithout("A-A-d1-1")!.pointsAwarded!);

    // NEUE FORMEL: GENAU UMGEKEHRT -- d1-1 hat die hoehere Boxscore-PPs-Zahl (5,9 statt 0,5) und
    // bekommt jetzt MEHR Punkte, exakt den gelieferten Wert, obwohl er den niedrigeren PPS-Score
    // hatte. Nur der Boxscore erklaert diese Umkehr, kein Zufall bei gleicher Reihenfolge.
    expect(entryWith("A-A-d1-0")!.pointsAwarded).toBe(0.5);
    expect(entryWith("A-A-d1-1")!.pointsAwarded).toBe(5.9);

    // Die Markierung bestaetigt explizit, woran es lag.
    expect(entryWith("A-A-d1-0")!.arenaBoxscoreImpactApplied).toBe(true);
    expect(entryWith("A-A-d1-1")!.arenaBoxscoreImpactApplied).toBe(true);
    expect(entryWithout("A-A-d1-0")!.arenaBoxscoreImpactApplied ?? false).toBe(false);

    // Team-Punkte (2/0) bleiben unveraendert vom 2/1/0-Modell -- der Boxscore setzt nur die
    // INDIVIDUELLEN PPs, nicht das Team-Ergebnis.
    expect(alphaWith?.teamPoints).toBe(ARENA_TEAM_POINTS.win);
  });

  it("Basketball: ein Spieler OHNE eigenen Eintrag in arenaIndividualBoxscorePpsByPlayerId faellt fuer SICH ALLEIN auf PPS zurueck", () => {
    const gameState = buildBattleModeGameState();
    const contexts = [
      createContext({ teamId: "A-A", teamName: "Alpha", d1Scores: [10, 5], d2Scores: [40], gameState }),
      createContext({ teamId: "B-B", teamName: "Beta", d1Scores: [50, 40], d2Scores: [35], gameState }),
    ];

    const withoutArena = buildLegacyMatchdayResolvePreview(contexts);
    const withPartialImpact = buildLegacyMatchdayResolvePreview(contexts, {
      arenaTeamPointsByTeamId: new Map([
        ["A-A", { teamPoints: ARENA_TEAM_POINTS.win, arenaMatchSeed: "seed-a-b" }],
        ["B-B", { teamPoints: ARENA_TEAM_POINTS.loss, arenaMatchSeed: "seed-a-b" }],
      ]),
      // NUR A-A-d1-0 hat einen Boxscore-Eintrag -- A-A-d1-1 fehlt (z.B. Namens-Kollision im
      // Boxscore desselben Duells). Anders als bei den Team-Punkten ist das hier PRO SPIELER
      // unabhaengig: d1-1 faellt fuer SICH ALLEIN auf den PPS-Pfad zurueck, d1-0 bekommt trotzdem
      // seine echte Boxscore-Zahl.
      arenaIndividualBoxscorePpsByPlayerId: new Map([["A-A-d1-0", 3.3]]),
    });

    const alphaWithout = withoutArena.disciplinePreviews
      .find((discipline) => discipline.disciplineId === "basketball")
      ?.teamResults.find((team) => team.teamId === "A-A");
    const alphaWith = withPartialImpact.disciplinePreviews
      .find((discipline) => discipline.disciplineId === "basketball")
      ?.teamResults.find((team) => team.teamId === "A-A");

    const entryWithout = (playerId: string) => alphaWithout?.entries.find((entry) => entry.playerId === playerId);
    const entryWith = (playerId: string) => alphaWith?.entries.find((entry) => entry.playerId === playerId);

    expect(entryWith("A-A-d1-0")!.pointsAwarded).toBe(3.3);
    expect(entryWith("A-A-d1-0")!.arenaBoxscoreImpactApplied).toBe(true);
    // d1-1 (kein eigener Eintrag) bleibt EXAKT beim alten PPS-Wert -- unbeeinflusst davon, dass
    // sein Teamkollege jetzt aus dem Boxscore bedient wird.
    expect(entryWith("A-A-d1-1")!.pointsAwarded).toBe(entryWithout("A-A-d1-1")!.pointsAwarded);
    expect(entryWith("A-A-d1-1")!.arenaBoxscoreImpactApplied ?? false).toBe(false);
    // Das TEAM-Ergebnis (2/1/0) bleibt in jedem Fall beim Arena-Ausgang.
    expect(alphaWith?.teamPoints).toBe(ARENA_TEAM_POINTS.win);
  });

  /**
   * REGRESSIONSTEST (Auftrag Punkt 4): fuer JEDE Disziplin ausser Basketball darf sich an der
   * PP-Vergabe NICHTS aendern -- selbst wenn `arenaIndividualBoxscorePpsByPlayerId` fuer denselben
   * SPIELER (unter seiner D2-playerId) ebenfalls einen Eintrag traegt; die Sperre
   * `ARENA_RESOLVED_DISCIPLINE_IDS.has(disciplineId)` muss sie fuer jede andere Disziplin trotzdem
   * vollstaendig ignorieren, s. Kommentar an `isBattleModeArenaEligible`/
   * `arenaIndividualPpsForThisDiscipline`.
   */
  it("Fechten (D2) bleibt byte-identisch, selbst wenn arenaIndividualBoxscorePpsByPlayerId einen Eintrag fuer dieselbe playerId traegt", () => {
    const gameState = buildBattleModeGameState();
    const contexts = [
      createContext({ teamId: "A-A", teamName: "Alpha", d1Scores: [10, 5], d2Scores: [40, 30] }),
      createContext({ teamId: "B-B", teamName: "Beta", d1Scores: [50, 40], d2Scores: [35, 20] }),
    ].map((context) => ({ ...context, gameState }));

    const arenaTeamPointsByTeamId = new Map([
      ["A-A", { teamPoints: ARENA_TEAM_POINTS.win, arenaMatchSeed: "seed-a-b" }],
      ["B-B", { teamPoints: ARENA_TEAM_POINTS.loss, arenaMatchSeed: "seed-a-b" }],
    ]);
    // "A-A-d2-0" existiert nur auf der Fechten-Seite (D2) -- traegt hier trotzdem probeweise einen
    // Boxscore-Eintrag, um zu beweisen, dass die Disziplin-Sperre wirklich greift, nicht nur die
    // ID zufaellig nirgends vorkommt.
    const arenaIndividualBoxscorePpsByPlayerId = new Map([
      ["A-A-d1-0", 0.5],
      ["A-A-d1-1", 5.9],
      ["A-A-d2-0", 6.6],
    ]);

    const withoutArena = buildLegacyMatchdayResolvePreview(contexts);
    const withArena = buildLegacyMatchdayResolvePreview(contexts, {
      arenaTeamPointsByTeamId,
      arenaIndividualBoxscorePpsByPlayerId,
    });

    const fechtenWithout = withoutArena.disciplinePreviews.find((discipline) => discipline.disciplineId === "fechten");
    const fechtenWith = withArena.disciplinePreviews.find((discipline) => discipline.disciplineId === "fechten");

    expect(fechtenWith).toEqual(fechtenWithout);
  });

  it("ignoriert die Arena-Punkte-Map vollstaendig in einem Manager-Mode-Save (Sicherheitsrahmen)", () => {
    const gameState = buildManagerModeGameState();
    const arenaTeamPointsByTeamId = new Map([
      ["A-A", { teamPoints: ARENA_TEAM_POINTS.win, arenaMatchSeed: "should-not-apply" }],
      ["B-B", { teamPoints: ARENA_TEAM_POINTS.loss, arenaMatchSeed: "should-not-apply" }],
    ]);

    const preview = buildLegacyMatchdayResolvePreview(
      [
        createContext({ teamId: "A-A", teamName: "Alpha", d1Scores: [10, 5], d2Scores: [40], gameState }),
        createContext({ teamId: "B-B", teamName: "Beta", d1Scores: [50, 40], d2Scores: [35], gameState }),
      ],
      { arenaTeamPointsByTeamId },
    );

    const basketball = preview.disciplinePreviews.find((discipline) => discipline.disciplineId === "basketball");
    for (const team of basketball?.teamResults ?? []) {
      expect(team.resolutionSource).toBe("pps");
      expect(team.arenaMatchSeed ?? null).toBeNull();
    }
    // Beta hat den hoeheren PPS-Score -> gewinnt regulaer den besseren Rang/mehr Punkte, exakt wie
    // ohne jede Arena-Map (die Arena-Map wollte Alpha als Gewinner setzen -- genau das darf in
    // Manager Mode nicht durchschlagen). Die uebergebene Map aendert daran nichts.
    const alpha = basketball?.teamResults.find((team) => team.teamId === "A-A");
    const beta = basketball?.teamResults.find((team) => team.teamId === "B-B");
    expect((beta?.teamPoints ?? 0) > (alpha?.teamPoints ?? 0)).toBe(true);
  });

  it("ignoriert die Arena-Punkte-Map fuer eine Nicht-Basketball-Disziplin, auch in einem Battle-Mode-Save", () => {
    const gameState = buildBattleModeGameState();
    const preview = buildLegacyMatchdayResolvePreview(
      [
        createContext({ teamId: "A-A", teamName: "Alpha", d1DisciplineId: "mini-dm", d1Scores: [10, 5], d2Scores: [40], gameState }),
        createContext({ teamId: "B-B", teamName: "Beta", d1DisciplineId: "mini-dm", d1Scores: [50, 40], d2Scores: [35], gameState }),
      ],
      {
        arenaTeamPointsByTeamId: new Map([
          ["A-A", { teamPoints: ARENA_TEAM_POINTS.win, arenaMatchSeed: "should-not-apply" }],
        ]),
      },
    );

    const miniDm = preview.disciplinePreviews.find((discipline) => discipline.disciplineId === "mini-dm");
    for (const team of miniDm?.teamResults ?? []) {
      expect(team.resolutionSource).toBe("pps");
    }
  });

  it("ignoriert die Arena-Punkte-Map defensiv, wenn kein gameState am Context haengt", () => {
    const preview = buildLegacyMatchdayResolvePreview(
      [
        createContext({ teamId: "A-A", teamName: "Alpha", d1Scores: [10, 5], d2Scores: [40] }),
        createContext({ teamId: "B-B", teamName: "Beta", d1Scores: [50, 40], d2Scores: [35] }),
      ],
      {
        arenaTeamPointsByTeamId: new Map([["A-A", { teamPoints: ARENA_TEAM_POINTS.win, arenaMatchSeed: "x" }]]),
      },
    );

    const basketball = preview.disciplinePreviews.find((discipline) => discipline.disciplineId === "basketball");
    for (const team of basketball?.teamResults ?? []) {
      expect(team.resolutionSource).toBe("pps");
    }
  });
});
