/**
 * DIE TOP-SPIELER UNTER DER SPIELTAGS-WERTUNG GEHÖREN DEM GANZEN SPIELTAG — UND DEM GEBUCHTEN.
 *
 * GEMELDET VON CHRIS: „die top players in der arena ganz unten zeigen immer noch 1 diszi und nicht
 * beide! dort sollen alle aus beiden diszis drin sein damit man den besten des spieltags sehen
 * kann!"
 *
 * DIESE DATEI PRÜFT WERTE. Die Vorgängerfassung prüfte Quelltext-Strings (`expect(MEMO).toContain(
 * "const proSpieler = new Map…")`) — sie wäre grün geblieben, während die Liste die falschen Namen
 * zeigte, und rot geworden, sobald jemand eine Variable umbenennt. Genau davon liegen in diesem
 * Repo zu viele herum.
 *
 * WAS NACHGEMESSEN WAR (Live-Abbild, Save `new-game-1785823388048-1hf25q`, Saison 2, Spieltag 10,
 * beide Seiten gebucht): die Liste hing an der Resolve-Vorschau. Für einen fertig gebuchten
 * Spieltag wird die NEU gerechnet (der Snapshot gilt dann bewusst nicht mehr) — 285 von 286
 * Spieler-Scores und 227 von 286 Player-Points wichen vom Gebuchten ab, und 4 der 12 gezeigten
 * Namen standen dort zu Unrecht (schon Platz 2 kippte: gebucht Umbra, angezeigt Kryntheron).
 */
import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { buildSeasonPointsLedger } from "@/lib/foundation/season-points-ledger";
import {
  spieltagsTopSpielerAusBuchung,
  spieltagsTopSpielerAusVorschau,
  summiereSpieltagsTopSpieler,
  waehleSpieltagsTopSpielerZeilen,
  type SpieltagsTopSpielerZeile,
} from "@/lib/foundation/discipline-stage/discipline-stage-matchday-top-players";
import type { DisciplineResolvePreview } from "@/lib/resolve/legacy-matchday-resolve-types";

const D1 = "spurt";
const D2 = "i-spy";

function zeile(input: Partial<SpieltagsTopSpielerZeile> & { playerId: string; disciplineId: string }): SpieltagsTopSpielerZeile {
  return {
    playerName: input.playerId,
    teamId: "A-A",
    finalPlayerScore: 10,
    pointsAwarded: 1,
    mutatorPpsBonus: null,
    isMvpCandidate: false,
    ...input,
  };
}

describe("Die Summierung — eine Rechenstelle für beide Disziplinen", () => {
  it("ein Spieler, der in BEIDEN antrat, steht genau EINMAL da — mit der Summe", () => {
    const summe = summiereSpieltagsTopSpieler(
      [
        zeile({ playerId: "doppel", disciplineId: D1, finalPlayerScore: 40.5, pointsAwarded: 2.5 }),
        zeile({ playerId: "doppel", disciplineId: D2, finalPlayerScore: 30.25, pointsAwarded: 1.25 }),
        zeile({ playerId: "einzel", disciplineId: D1, finalPlayerScore: 60, pointsAwarded: 3 }),
      ],
      new Set([D1, D2]),
    );

    const doppel = summe.filter((eintrag) => eintrag.playerId === "doppel");
    expect(doppel).toHaveLength(1);
    expect(doppel[0].score).toBe(70.75);
    expect(doppel[0].points).toBe(3.75);
    expect(doppel[0].disciplineIds).toEqual([D1, D2]);
  });

  it("der Mutator-Aufschlag steckt in den Punkten UND wird getrennt ausgewiesen", () => {
    const [eintrag] = summiereSpieltagsTopSpieler(
      [
        zeile({ playerId: "m", disciplineId: D1, pointsAwarded: 2, mutatorPpsBonus: 0.3 }),
        zeile({ playerId: "m", disciplineId: D2, pointsAwarded: 1, mutatorPpsBonus: 0.3 }),
      ],
      new Set([D1, D2]),
    );
    expect(eintrag.points).toBe(3.6);
    expect(eintrag.mutatorPoints).toBe(0.6);
  });

  it("sortiert nach Player-Points, Score als Tiebreak", () => {
    const summe = summiereSpieltagsTopSpieler(
      [
        zeile({ playerId: "gleich-klein", disciplineId: D1, pointsAwarded: 2, finalPlayerScore: 10 }),
        zeile({ playerId: "gleich-gross", disciplineId: D1, pointsAwarded: 2, finalPlayerScore: 99 }),
        zeile({ playerId: "bester", disciplineId: D1, pointsAwarded: 5, finalPlayerScore: 1 }),
      ],
      new Set([D1]),
    );
    expect(summe.map((eintrag) => eintrag.playerId)).toEqual(["bester", "gleich-gross", "gleich-klein"]);
  });

  it("summiert in Ledger-Genauigkeit (4 Stellen) — eine Rundung auf 1 Stelle würde die Reihenfolge kippen", () => {
    const summe = summiereSpieltagsTopSpieler(
      [
        zeile({ playerId: "knapp-vorn", disciplineId: D1, pointsAwarded: 1.7124 }),
        zeile({ playerId: "knapp-hinten", disciplineId: D1, pointsAwarded: 1.7119 }),
      ],
      new Set([D1]),
    );
    expect(summe.map((eintrag) => eintrag.playerId)).toEqual(["knapp-vorn", "knapp-hinten"]);
    expect(summe[0].points).toBe(1.7124);
  });
});

describe("Die Spoiler-Regel gehört zur Rechnung", () => {
  it("solange erst D1 aufgedeckt ist, steht KEIN D2-Spieler da", () => {
    const summe = summiereSpieltagsTopSpieler(
      [
        zeile({ playerId: "d1-mann", disciplineId: D1, pointsAwarded: 1 }),
        zeile({ playerId: "d2-mann", disciplineId: D2, pointsAwarded: 9 }),
      ],
      new Set([D1]),
    );
    expect(summe.map((eintrag) => eintrag.playerId)).toEqual(["d1-mann"]);
  });

  it("und der Doppelstarter zählt dann nur mit seiner D1-Hälfte", () => {
    const [eintrag] = summiereSpieltagsTopSpieler(
      [
        zeile({ playerId: "doppel", disciplineId: D1, finalPlayerScore: 40, pointsAwarded: 2 }),
        zeile({ playerId: "doppel", disciplineId: D2, finalPlayerScore: 30, pointsAwarded: 1 }),
      ],
      new Set([D1]),
    );
    expect(eintrag.score).toBe(40);
    expect(eintrag.points).toBe(2);
    expect(eintrag.disciplineIds).toEqual([D1]);
  });

  it("ohne eine einzige aufgedeckte Seite gibt es keine Zeile", () => {
    expect(summiereSpieltagsTopSpieler([zeile({ playerId: "x", disciplineId: D1 })], new Set())).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
// Ein Spieltag, wie er im Spielstand liegt: zwei Teams, zwei Disziplinen, beide gebucht.
// ---------------------------------------------------------------------------------------------

const SEASON = "season-1";
const MATCHDAY = "matchday-1";
const RESULT_ID = "res-1";

function leistung(input: {
  teamId: string;
  playerId: string;
  disciplineId: string;
  side: "d1" | "d2";
  slotIndex: number;
  score: number;
  mutator?: number;
}) {
  return {
    id: `perf__${input.teamId}__${input.disciplineId}__${input.playerId}`,
    matchdayResultId: RESULT_ID,
    teamId: input.teamId,
    playerId: input.playerId,
    activePlayerId: `roster-${input.playerId}`,
    disciplineId: input.disciplineId,
    disciplineSide: input.side,
    slotIndex: input.slotIndex,
    baseValue: input.score,
    finalPlayerScore: input.score,
    mutatorScoreBonus: 0,
    mutatorPpsBonus: input.mutator ?? 0,
    scoreContribution: input.score,
    rankInTeam: input.slotIndex + 1,
    rankInDiscipline: 1,
    isTop10: true,
    isMvpCandidate: input.slotIndex === 0,
    storyWeight: 0.5,
    createdAt: "2026-08-01T00:00:00.000Z",
  };
}

function disziplinErgebnis(input: { teamId: string; disciplineId: string; side: "d1" | "d2"; rank: number; total: number }) {
  return {
    id: `dr__${input.teamId}__${input.disciplineId}`,
    matchdayResultId: RESULT_ID,
    teamId: input.teamId,
    disciplineId: input.disciplineId,
    disciplineSide: input.side,
    rank: input.rank,
    baseScore: input.total,
    totalScore: input.total,
    formModifier: 0,
    readinessStatus: "ready",
    warnings: [],
    createdAt: "2026-08-01T00:00:00.000Z",
  };
}

/**
 * `bookedSides` steuert, was schon gewertet ist — damit lässt sich der halbe Spieltag
 * (D1 gebucht, D2 läuft) genauso prüfen wie der fertige.
 */
function buildGameState(bookedSides: Array<"d1" | "d2"> = ["d1", "d2"]): GameState {
  const alleLeistungen = [
    leistung({ teamId: "A-A", playerId: "p-anna", disciplineId: D1, side: "d1", slotIndex: 0, score: 60 }),
    leistung({ teamId: "A-A", playerId: "p-bert", disciplineId: D1, side: "d1", slotIndex: 1, score: 40 }),
    leistung({ teamId: "B-B", playerId: "p-cara", disciplineId: D1, side: "d1", slotIndex: 0, score: 30, mutator: 0.3 }),
    leistung({ teamId: "B-B", playerId: "p-dirk", disciplineId: D1, side: "d1", slotIndex: 1, score: 20 }),
    leistung({ teamId: "A-A", playerId: "p-anna", disciplineId: D2, side: "d2", slotIndex: 0, score: 10 }),
    leistung({ teamId: "A-A", playerId: "p-emil", disciplineId: D2, side: "d2", slotIndex: 1, score: 10 }),
    leistung({ teamId: "B-B", playerId: "p-cara", disciplineId: D2, side: "d2", slotIndex: 0, score: 55 }),
    leistung({ teamId: "B-B", playerId: "p-dirk", disciplineId: D2, side: "d2", slotIndex: 1, score: 45 }),
  ];
  const alleErgebnisse = [
    disziplinErgebnis({ teamId: "A-A", disciplineId: D1, side: "d1", rank: 1, total: 100 }),
    disziplinErgebnis({ teamId: "B-B", disciplineId: D1, side: "d1", rank: 2, total: 50 }),
    disziplinErgebnis({ teamId: "B-B", disciplineId: D2, side: "d2", rank: 1, total: 100 }),
    disziplinErgebnis({ teamId: "A-A", disciplineId: D2, side: "d2", rank: 2, total: 20 }),
  ];
  const gebucht = new Set(bookedSides);

  return {
    season: { id: SEASON, name: "S1", year: 1, matchdayIds: [MATCHDAY] },
    matchdayState: { matchdayId: MATCHDAY, status: "resolved", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [
      { teamId: "A-A", name: "Alpha", shortCode: "A-A" },
      { teamId: "B-B", name: "Beta", shortCode: "B-B" },
    ],
    rosters: [],
    players: [
      { id: "p-anna", name: "Anna" },
      { id: "p-bert", name: "Bert" },
      { id: "p-cara", name: "Cara" },
      { id: "p-dirk", name: "Dirk" },
      { id: "p-emil", name: "Emil" },
    ],
    disciplines: [
      { id: D1, name: "Spurt", category: "speed", playerCount: 2 },
      { id: D2, name: "I Spy", category: "mind", playerCount: 2 },
    ],
    seasonState: {
      matchdayResults: [
        { id: RESULT_ID, saveId: "save-1", seasonId: SEASON, matchdayId: MATCHDAY, status: "preview_applied" },
      ],
      disciplineResults: alleErgebnisse.filter((eintrag) => gebucht.has(eintrag.disciplineSide as "d1" | "d2")),
      playerDisciplinePerformances: alleLeistungen.filter((eintrag) => gebucht.has(eintrag.disciplineSide as "d1" | "d2")),
      injuryEvents: [],
      lineupDrafts: [],
    },
  } as unknown as GameState;
}

/** Die Vorschau desselben Spieltags — bewusst mit ANDEREN Zahlen als das Gebuchte. */
function buildVorschau(): DisciplineResolvePreview[] {
  const spieler = (playerId: string, playerName: string, teamId: string, score: number, punkte: number) => ({
    matchdayId: MATCHDAY,
    disciplineId: "",
    disciplineSide: "d1" as const,
    teamId,
    playerId,
    playerName,
    slotIndex: 0,
    baseValue: score,
    finalPlayerScore: score,
    scoreContribution: score,
    pointsAwarded: punkte,
    pointSource: "test",
    rankInTeam: 1,
    rankInDiscipline: 1,
    isTop10: true,
    isMvpCandidate: false,
  });
  return [
    {
      disciplineId: D1,
      disciplineName: "Spurt",
      disciplineSide: "d1",
      teamResults: [],
      highlightCandidates: [],
      // Die Vorschau setzt Bert an die Spitze — gebucht ist er es NICHT.
      topPlayers: [
        spieler("p-bert", "Bert", "A-A", 99, 9),
        spieler("p-anna", "Anna", "A-A", 1, 0.1),
        spieler("p-cara", "Cara", "B-B", 1, 0.1),
        spieler("p-dirk", "Dirk", "B-B", 1, 0.1),
      ],
    },
    {
      disciplineId: D2,
      disciplineName: "I Spy",
      disciplineSide: "d2",
      teamResults: [],
      highlightCandidates: [],
      topPlayers: [
        spieler("p-cara", "Cara", "B-B", 55, 2),
        spieler("p-dirk", "Dirk", "B-B", 45, 1.5),
        spieler("p-anna", "Anna", "A-A", 10, 0.5),
        spieler("p-emil", "Emil", "A-A", 10, 0.5),
      ],
    },
  ] as unknown as DisciplineResolvePreview[];
}

describe("Die gebuchte Quelle — sie kommt ohne Vorschau aus", () => {
  it("liefert beide Disziplinen aus dem Spielstand, ganz ohne Vorschau", () => {
    const gameState = buildGameState();
    const zeilen = spieltagsTopSpielerAusBuchung({ gameState, seasonId: SEASON, matchdayId: MATCHDAY });
    expect(new Set(zeilen.map((eintrag) => eintrag.disciplineId))).toEqual(new Set([D1, D2]));
    expect(zeilen).toHaveLength(8);
    // Namen kommen aus dem Spielstand, nicht aus der Vorschau.
    expect(zeilen.find((eintrag) => eintrag.playerId === "p-anna")?.playerName).toBe("Anna");
  });

  it("die Summe ist Zahl für Zahl die des Saison-Ledgers", () => {
    const gameState = buildGameState();
    const ledger = buildSeasonPointsLedger(gameState, SEASON);

    const ausLedger = new Map<string, number>();
    for (const eintrag of ledger.pointEntries) {
      if (eintrag.matchdayId !== MATCHDAY) continue;
      ausLedger.set(eintrag.playerId, Number(((ausLedger.get(eintrag.playerId) ?? 0) + eintrag.points).toFixed(4)));
    }
    expect(ausLedger.size).toBeGreaterThan(0);

    const summe = summiereSpieltagsTopSpieler(
      spieltagsTopSpielerAusBuchung({ gameState, seasonId: SEASON, matchdayId: MATCHDAY, ledger }),
      new Set([D1, D2]),
      99,
    );
    for (const eintrag of summe) {
      expect(eintrag.points).toBe(ausLedger.get(eintrag.playerId));
    }
    // Und Anna, die in beiden lief, steht genau einmal da.
    expect(summe.filter((eintrag) => eintrag.playerId === "p-anna")).toHaveLength(1);
  });

  it("ohne gebuchtes Ergebnis gibt es keine gebuchten Zeilen (nicht etwa Nullen)", () => {
    const gameState = buildGameState([]);
    expect(spieltagsTopSpielerAusBuchung({ gameState, seasonId: SEASON, matchdayId: MATCHDAY })).toEqual([]);
  });
});

describe("Welche Quelle gilt — je Disziplin entschieden", () => {
  it("ist die Disziplin gebucht, gewinnt das Gebuchte gegen die abweichende Vorschau", () => {
    const gameState = buildGameState();
    const gewaehlt = waehleSpieltagsTopSpielerZeilen({
      vorschauZeilen: spieltagsTopSpielerAusVorschau(buildVorschau()),
      buchungsZeilen: spieltagsTopSpielerAusBuchung({ gameState, seasonId: SEASON, matchdayId: MATCHDAY }),
    });
    expect(gewaehlt.quelleJeDisziplin.get(D1)).toBe("booked");
    expect(gewaehlt.quelleJeDisziplin.get(D2)).toBe("booked");

    const summe = summiereSpieltagsTopSpieler(gewaehlt.zeilen, new Set([D1, D2]), 99);
    const bert = summe.find((eintrag) => eintrag.playerId === "p-bert");
    // Die Vorschau behauptete 99 Score / 9 PP für Bert — gebucht sind 40 Score.
    expect(bert?.score).toBe(40);
    expect(bert?.points).not.toBe(9);
    // Und die Spitze ist die gebuchte, nicht die vorhergesagte.
    expect(summe[0].playerId).not.toBe("p-bert");
  });

  it("der halbe Spieltag mischt: gebuchte D1, laufende D2 aus der Vorschau", () => {
    const gameState = buildGameState(["d1"]);
    const gewaehlt = waehleSpieltagsTopSpielerZeilen({
      vorschauZeilen: spieltagsTopSpielerAusVorschau(buildVorschau()),
      buchungsZeilen: spieltagsTopSpielerAusBuchung({ gameState, seasonId: SEASON, matchdayId: MATCHDAY }),
    });
    expect(gewaehlt.quelleJeDisziplin.get(D1)).toBe("booked");
    expect(gewaehlt.quelleJeDisziplin.get(D2)).toBe("preview");

    // Solange nur D1 aufgedeckt ist, bleibt D2 trotzdem draußen — die Spoiler-Regel steht über
    // der Quellenwahl.
    const nurD1 = summiereSpieltagsTopSpieler(gewaehlt.zeilen, new Set([D1]), 99);
    expect(nurD1.some((eintrag) => eintrag.playerId === "p-emil")).toBe(false);
    // Emil lief NUR in D2 — mit aufgedeckter D2 ist er da.
    const beide = summiereSpieltagsTopSpieler(gewaehlt.zeilen, new Set([D1, D2]), 99);
    expect(beide.some((eintrag) => eintrag.playerId === "p-emil")).toBe(true);
  });

  it("fällt die Vorschau ganz aus, trägt die Buchung die Liste allein — beide Disziplinen", () => {
    const gameState = buildGameState();
    const gewaehlt = waehleSpieltagsTopSpielerZeilen({
      vorschauZeilen: spieltagsTopSpielerAusVorschau(null),
      buchungsZeilen: spieltagsTopSpielerAusBuchung({ gameState, seasonId: SEASON, matchdayId: MATCHDAY }),
    });
    const summe = summiereSpieltagsTopSpieler(gewaehlt.zeilen, new Set([D1, D2]), 99);
    const disziplinen = new Set(summe.flatMap((eintrag) => eintrag.disciplineIds));
    expect(disziplinen).toEqual(new Set([D1, D2]));
    expect(summe.some((eintrag) => eintrag.teamId === "A-A")).toBe(true);
    expect(summe.some((eintrag) => eintrag.teamId === "B-B")).toBe(true);
  });
});
