import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import {
  buildPlayerDisciplineLaufbahn,
  buildSeasonInjuryDisciplineCounts,
  computeLaufbahnCountersForPerformances,
  finalizeLaufbahnCounters,
  foldLaufbahnEntry,
  initLaufbahnAccumulator,
  mergeLaufbahnCounters,
} from "@/lib/season/player-discipline-laufbahn";

/**
 * DISZIPLIN-LAUFBAHN (Q2, docs/design/disziplin-laufbahn-q2-15-10.md).
 *
 * Der wichtigste Einzelbefund hier ist "idempotent je Reihenfolge" (letzter Test): ein neu
 * gebuchter ÄLTERER Spieltag darf die gefalteten Zähler eines bereits gebuchten NEUEREN nie
 * verändern — genau der O7-Fehler aus dem Achtzehnten Nachtrag (s. Kommentar an
 * `buildPlayerDisciplineLaufbahn`).
 */

function perf(overrides: Partial<{ rankInDiscipline: number; finalPlayerScore: number; isMvpCandidate: boolean }>) {
  return {
    rankInDiscipline: 5,
    finalPlayerScore: 10,
    isMvpCandidate: false,
    ...overrides,
  };
}

describe("Laufbahn-Akkumulator (fold/finalize)", () => {
  it("zählt Siege, Podien, Rang-Summe, besten Rang und beste Wertung korrekt", () => {
    const performances = [
      perf({ rankInDiscipline: 1, finalPlayerScore: 90, isMvpCandidate: true }),
      perf({ rankInDiscipline: 3, finalPlayerScore: 70 }),
      perf({ rankInDiscipline: 7, finalPlayerScore: 40 }),
    ];
    const counters = computeLaufbahnCountersForPerformances(performances);
    expect(counters).toEqual({
      starts: 3,
      siege: 1,
      podien: 2,
      rangSumme: 11,
      bestRang: 1,
      bestWertung: 90,
      spielerDesSpieltags: 1,
    });
  });

  it("liefert undefined für eine leere Liste (kein Einsatz, keine Zeile)", () => {
    expect(computeLaufbahnCountersForPerformances([])).toBeUndefined();
  });

  it("lässt spielerDesSpieltags und verletzungen weg, wenn sie 0 sind — nie als erfundene '0'", () => {
    const counters = computeLaufbahnCountersForPerformances([perf({ rankInDiscipline: 5 })], 0);
    expect(counters).not.toHaveProperty("spielerDesSpieltags");
    expect(counters).not.toHaveProperty("verletzungen");
  });

  it("schreibt verletzungen nur, wenn mindestens eine zählt", () => {
    const counters = computeLaufbahnCountersForPerformances([perf({ rankInDiscipline: 5 })], 2);
    expect(counters?.verletzungen).toBe(2);
  });

  it("ignoriert fehlende Ränge/Wertungen, statt mit NaN zu rechnen", () => {
    const acc = foldLaufbahnEntry(initLaufbahnAccumulator(), {
      rankInDiscipline: Number.NaN,
      finalPlayerScore: Number.NaN,
      isMvpCandidate: false,
    });
    const counters = finalizeLaufbahnCounters(acc);
    expect(counters?.starts).toBe(1);
    expect(counters).not.toHaveProperty("bestRang");
    expect(counters).not.toHaveProperty("bestWertung");
  });
});

describe("mergeLaufbahnCounters", () => {
  it("summiert die meisten Zähler, nimmt bestRang als Minimum und bestWertung als Maximum", () => {
    const seasonA = { starts: 10, siege: 2, podien: 4, rangSumme: 30, bestRang: 1, bestWertung: 88 };
    const seasonB = { starts: 8, siege: 0, podien: 1, rangSumme: 40, bestRang: 3, bestWertung: 95 };
    expect(mergeLaufbahnCounters(seasonA, seasonB)).toEqual({
      starts: 18,
      siege: 2,
      podien: 5,
      rangSumme: 70,
      bestRang: 1,
      bestWertung: 95,
    });
  });

  it("gibt die vorhandene Seite unverändert zurück, wenn die andere fehlt", () => {
    const only = { starts: 5, siege: 1, podien: 2, rangSumme: 9, bestRang: 2, bestWertung: 50 };
    expect(mergeLaufbahnCounters(only, undefined)).toBe(only);
    expect(mergeLaufbahnCounters(undefined, only)).toBe(only);
  });
});

/** Minimaler GameState für `buildPlayerDisciplineLaufbahn` — bewusst `as unknown as GameState`
 *  wie in `tests/player-injury-matchday-disciplines.test.ts`, nur die gelesenen Felder gesetzt. */
function makeGameState(input: {
  currentSeasonId?: string;
  matchdayResults?: Array<{ id: string; seasonId: string; status: string }>;
  performances?: Array<{
    id: string;
    matchdayResultId: string;
    playerId: string;
    disciplineId: string;
    rankInDiscipline: number;
    finalPlayerScore: number;
    isMvpCandidate: boolean;
  }>;
  seasonSnapshots?: Array<{
    seasonId: string;
    seasonName: string;
    playerPerformances: Array<{
      playerId: string;
      disciplineBreakdown: Array<{ disciplineId: string; appearances: number; laufbahn?: Record<string, number> }>;
    }>;
  }>;
  injuryEvents?: Array<{ eventId: string; seasonId: string; teamId: string; playerId: string; matchdayId: string; result: string }>;
  lineupDrafts?: Array<{ teamId: string; matchdayId: string; entries: Array<{ playerId: string; disciplineId: string }> }>;
}): GameState {
  return {
    season: { id: input.currentSeasonId ?? "season-2", name: "Season 2", year: 2027, currentMatchday: 1, matchdayIds: [] },
    disciplines: [{ id: "staffel", name: "Staffel", category: "speed", weight: 1, playerCount: 6 }],
    seasonState: {
      matchdayResults: input.matchdayResults ?? [],
      playerDisciplinePerformances: input.performances ?? [],
      seasonSnapshots: input.seasonSnapshots ?? [],
      injuryEvents: input.injuryEvents ?? [],
      lineupDrafts: (input.lineupDrafts ?? []).map((draft, index) => ({
        lineupId: `lineup-${index}`,
        saveId: "save-1",
        seasonId: input.currentSeasonId ?? "season-2",
        matchdayId: draft.matchdayId,
        teamId: draft.teamId,
        status: "resolved",
        entries: draft.entries.map((entry, slotIndex) => ({
          disciplineId: entry.disciplineId,
          disciplineSide: "d1",
          slotIndex,
          playerId: entry.playerId,
          activePlayerId: null,
        })),
        createdAt: "",
        updatedAt: "",
      })),
    },
  } as unknown as GameState;
}

describe("buildSeasonInjuryDisciplineCounts", () => {
  it("zählt eine Verletzung bei beiden Disziplinen, wenn der Spieltag beide trug", () => {
    const gameState = makeGameState({
      currentSeasonId: "season-2",
      injuryEvents: [
        { eventId: "e1", seasonId: "season-2", teamId: "T1", playerId: "p1", matchdayId: "md-1", result: "injured" },
      ],
      lineupDrafts: [
        {
          teamId: "T1",
          matchdayId: "md-1",
          entries: [
            { playerId: "p1", disciplineId: "staffel" },
            { playerId: "p1", disciplineId: "schach" },
          ],
        },
      ],
    });
    const counts = buildSeasonInjuryDisciplineCounts(gameState, "season-2");
    expect(counts.get("p1")?.get("staffel")).toBe(1);
    expect(counts.get("p1")?.get("schach")).toBe(1);
  });
});

describe("buildPlayerDisciplineLaufbahn: laufende Saison + Schnappschüsse", () => {
  it("kombiniert die laufende Saison (live) mit früheren Saisons (Schnappschuss), neueste zuerst", () => {
    const gameState = makeGameState({
      currentSeasonId: "season-2",
      matchdayResults: [{ id: "result-1", seasonId: "season-2", status: "preview_applied" }],
      performances: [
        {
          id: "perf-1",
          matchdayResultId: "result-1",
          playerId: "p1",
          disciplineId: "staffel",
          rankInDiscipline: 1,
          finalPlayerScore: 95,
          isMvpCandidate: true,
        },
      ],
      seasonSnapshots: [
        {
          seasonId: "season-1",
          seasonName: "Season 1",
          playerPerformances: [
            {
              playerId: "p1",
              disciplineBreakdown: [
                { disciplineId: "staffel", appearances: 4, laufbahn: { starts: 4, siege: 0, podien: 1, rangSumme: 18, bestRang: 2 } },
              ],
            },
          ],
        },
      ],
    });

    const laufbahn = buildPlayerDisciplineLaufbahn(gameState, "p1").get("staffel");
    expect(laufbahn).toBeDefined();
    expect(laufbahn?.careerAppearances).toBe(5); // 1 laufend + 4 Vorsaison
    expect(laufbahn?.career).toEqual({ starts: 5, siege: 1, podien: 2, rangSumme: 19, bestRang: 1, bestWertung: 95, spielerDesSpieltags: 1 });
    expect(laufbahn?.seasons.map((season) => season.seasonId)).toEqual(["season-2", "season-1"]);
    expect(laufbahn?.seasons[0]?.isActiveSeason).toBe(true);
  });

  it("gibt eine leere Map zurück, wenn der Spieler nirgends Zähler hat", () => {
    const gameState = makeGameState({});
    expect(buildPlayerDisciplineLaufbahn(gameState, "p-unbekannt").size).toBe(0);
  });

  it("überspringt Schnappschuss-Disziplinen ohne `laufbahn` (Bestandsspielstand vor dieser Änderung)", () => {
    const gameState = makeGameState({
      seasonSnapshots: [
        {
          seasonId: "season-1",
          seasonName: "Season 1",
          playerPerformances: [{ playerId: "p1", disciplineBreakdown: [{ disciplineId: "staffel", appearances: 3 }] }],
        },
      ],
    });
    expect(buildPlayerDisciplineLaufbahn(gameState, "p1").size).toBe(0);
  });
});

describe("Idempotenz je Spieltag-Reihenfolge (O7-Lehre, Achtzehnter Nachtrag Befund 2)", () => {
  type BookedRow = { matchdayResultId: string; rankInDiscipline: number; finalPlayerScore: number; isMvpCandidate: boolean };

  /**
   * Nachstellung des Result-Apply-Musters: jede Buchung ersetzt NUR die Zeilen ihres eigenen
   * `matchdayResultId` (`[...bestand.filter(r => r.matchdayResultId !== id), ...neue]`) — exakt
   * wie `legacy-matchday-result-apply-service.ts` es mit `playerDisciplinePerformances` tut.
   */
  function applyMatchday(
    bestand: readonly BookedRow[],
    matchdayResultId: string,
    neue: ReadonlyArray<Omit<BookedRow, "matchdayResultId">>,
  ): BookedRow[] {
    const alt = bestand.filter((row) => row.matchdayResultId !== matchdayResultId);
    return [...alt, ...neue.map((row) => ({ ...row, matchdayResultId }))];
  }

  it("liefert dieselben Laufbahn-Zähler, egal ob Spieltag 1 oder 2 zuletzt (neu) gebucht wurde", () => {
    const md1Rows = [{ rankInDiscipline: 1, finalPlayerScore: 90, isMvpCandidate: true }];
    const md2Rows = [{ rankInDiscipline: 4, finalPlayerScore: 60, isMvpCandidate: false }];

    // Reihenfolge A: MD1 zuerst gebucht, dann MD2.
    let stateA: BookedRow[] = [];
    stateA = applyMatchday(stateA, "md-1", md1Rows);
    stateA = applyMatchday(stateA, "md-2", md2Rows);

    // Reihenfolge B: MD2 zuerst, dann MD1 neu/erneut gebucht (z. B. eine Korrektur eines älteren
    // Spieltags, nachdem der neuere schon stand — genau der Fall aus dem O7-Befund).
    let stateB: BookedRow[] = [];
    stateB = applyMatchday(stateB, "md-2", md2Rows);
    stateB = applyMatchday(stateB, "md-1", md1Rows);

    // Beide Endzustände sind inhaltlich gleich (Reihenfolge der Spieltage in der Liste ist dabei
    // irrelevant, weil hier je Spieltag nach `matchdayResultId` ersetzt, nie inkrementiert wird).
    const sortById = (rows: typeof stateA) => [...rows].sort((a, b) => a.matchdayResultId.localeCompare(b.matchdayResultId));
    expect(sortById(stateA)).toEqual(sortById(stateB));

    const countersA = computeLaufbahnCountersForPerformances(stateA);
    const countersB = computeLaufbahnCountersForPerformances(stateB);
    expect(countersA).toEqual(countersB);
    expect(countersA).toEqual({
      starts: 2,
      siege: 1,
      podien: 1,
      rangSumme: 5,
      bestRang: 1,
      bestWertung: 90,
      spielerDesSpieltags: 1,
    });
  });

  it("verändert ein erneutes (identisches) Buchen desselben Spieltags die Zähler nicht", () => {
    const rows = [{ rankInDiscipline: 2, finalPlayerScore: 70, isMvpCandidate: false }];
    let state: BookedRow[] = [];
    state = applyMatchday(state, "md-1", rows);
    const firstBooking = computeLaufbahnCountersForPerformances(state);

    // Re-Apply desselben Spieltags (z. B. forceReplace) — ersetzt, addiert nicht.
    state = applyMatchday(state, "md-1", rows);
    const secondBooking = computeLaufbahnCountersForPerformances(state);

    expect(state).toHaveLength(1);
    expect(secondBooking).toEqual(firstBooking);
  });
});
