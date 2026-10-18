import { describe, expect, it } from "vitest";

import type { DisciplineResultRecord, GameState, MatchdayResultRecord } from "@/lib/data/olyDataTypes";
import { buildArenaHostSpielquelleHinweise } from "@/lib/foundation/battle-arena/arena-host-spielquelle-hinweis";

/**
 * ARENA-HOST-HINWEIS ("gewertet per PPS-Duell, Arena nur Vorschau") — Task #159 Punkt 3.
 * Reiner Builder-Test, s. Dateikommentar in arena-host-spielquelle-hinweis.ts für die beiden
 * Fälle (nicht arena-fähig vs. arena-fähig-aber-per-Bruecke-gewertet).
 */

function zeile(
  input: Partial<DisciplineResultRecord> & {
    id: string;
    matchdayResultId: string;
    teamId: string;
    disciplineId: string;
    disciplineSide: "d1" | "d2";
  },
): DisciplineResultRecord {
  return {
    rank: 1,
    baseScore: 0,
    totalScore: 0,
    readinessStatus: "ready",
    warnings: [],
    createdAt: "2026-10-18T00:00:00.000Z",
    ...input,
  } as unknown as DisciplineResultRecord;
}

function matchdayResult(id: string, matchdayId: string): MatchdayResultRecord {
  return {
    id,
    saveId: "save-1",
    seasonId: "s1",
    matchdayId,
    status: "preview_applied",
    sourceVersion: "v1",
    teamsTotal: 2,
    teamsReady: 2,
    teamsUnderfilled: 0,
    teamsMissingLineup: 0,
    teamsInvalidLineup: 0,
    teamsMissingScoreCoverage: 0,
  } as unknown as MatchdayResultRecord;
}

// "basketball" ist bewusst NICHT in ARENA_RESOLVED_DISCIPLINE_IDS (16.10., s. dort) -- immer
// Bruecke. "fechten" IST arena-faehig -- der zweite Testfall prueft dessen Bruecken-Zeile.
const DISCIPLINE_SCHEDULE = {
  seasonId: "s1",
  matchdayId: "md1",
  matchdayIndex: 0,
  discipline1: { disciplineId: "basketball", displayName: "Basketball", order: 1, playerCount: 2, category: "tactics" },
  discipline2: { disciplineId: "fechten", displayName: "Fechten", order: 2, playerCount: 2, category: "duell" },
};

function buildGameState(disciplineResults: DisciplineResultRecord[], gameMode: "battle" | "manager" = "battle"): GameState {
  return {
    scenarioMeta: { gameMode },
    matchdayState: { matchdayId: "md1" },
    seasonState: {
      disciplineSchedule: [DISCIPLINE_SCHEDULE],
      matchdayResults: [matchdayResult("mr-md1", "md1")],
      disciplineResults,
    },
  } as unknown as GameState;
}

describe("buildArenaHostSpielquelleHinweise", () => {
  it("Manager-Save: KEINE Hinweise, auch nicht fuer eine Disziplin ausserhalb der Arena-Menge (Opus-Review zu PR #1282 -- echter Fehler, kein Stilpunkt: Manager Mode wertet ueber die Rangtabelle, es gibt dort weder Duell noch Bruecke)", () => {
    const hinweise = buildArenaHostSpielquelleHinweise(buildGameState([], "manager"), "A");
    expect(hinweise).toEqual([]);
  });

  it("ohne matchdayId/heimTeamId: keine Hinweise", () => {
    expect(buildArenaHostSpielquelleHinweise({ scenarioMeta: { gameMode: "battle" }, matchdayState: {}, seasonState: {} } as never, "A")).toEqual([]);
    expect(buildArenaHostSpielquelleHinweise(buildGameState([]), "")).toEqual([]);
  });

  it("ohne gebuchten Spieltag (kein disciplineSchedule-Eintrag fuer diesen Matchday): nur die immer-Bruecke-Disziplin", () => {
    const gs = {
      scenarioMeta: { gameMode: "battle" },
      matchdayState: { matchdayId: "md-unbekannt" },
      seasonState: { disciplineSchedule: [DISCIPLINE_SCHEDULE] },
    } as unknown as GameState;
    expect(buildArenaHostSpielquelleHinweise(gs, "A")).toEqual([]);
  });

  it("nicht-arena-faehige Disziplin: IMMER ein Hinweis, auch ohne jede Ergebniszeile", () => {
    const hinweise = buildArenaHostSpielquelleHinweise(buildGameState([]), "A");
    const basketball = hinweise.find((h) => h.disciplineId === "basketball")!;
    expect(basketball).toBeDefined();
    expect(basketball.disciplineName).toBe("Basketball");
    expect(basketball.text).toBe("wird in dieser Saison per PPS-Duell gewertet, nicht per Arena");
    // Fechten (arena-faehig) hat ohne Ergebniszeile KEINEN Hinweis -- nichts wird vermutet.
    expect(hinweise.find((h) => h.disciplineId === "fechten")).toBeUndefined();
  });

  it("arena-faehige Disziplin, aber real per PPS-Duell gewertet (kein Arena-Ausfall): Hinweis", () => {
    const gs = buildGameState([
      zeile({ id: "r1", matchdayResultId: "mr-md1", teamId: "A", disciplineId: "fechten", disciplineSide: "d2", teamPoints: 2, resolutionSource: "pps_duell" }),
    ]);
    const hinweise = buildArenaHostSpielquelleHinweise(gs, "A");
    const fechten = hinweise.find((h) => h.disciplineId === "fechten")!;
    expect(fechten.text).toBe("wurde an diesem Spieltag per PPS-Duell gewertet");
  });

  it("arena-faehige Disziplin, PPS-Duell WEIL der Arena-Lauf ausfiel: Hinweis nennt den Grund", () => {
    const gs = buildGameState([
      zeile({
        id: "r1",
        matchdayResultId: "mr-md1",
        teamId: "A",
        disciplineId: "fechten",
        disciplineSide: "d2",
        teamPoints: 2,
        resolutionSource: "pps_duell",
        arenaAusfall: { grund: "timeout", zeitpunkt: "2026-10-18T00:00:00.000Z", versuch: 1 } as never,
      }),
    ]);
    const hinweise = buildArenaHostSpielquelleHinweise(gs, "A");
    const fechten = hinweise.find((h) => h.disciplineId === "fechten")!;
    expect(fechten.text).toBe("Arena-Lauf fiel aus (Zeitüberschreitung) — an diesem Spieltag per PPS-Duell gewertet");
  });

  it("arena-faehige Disziplin ECHT per Arena gewertet: KEIN Hinweis", () => {
    const gs = buildGameState([
      zeile({ id: "r1", matchdayResultId: "mr-md1", teamId: "A", disciplineId: "fechten", disciplineSide: "d2", teamPoints: 2, resolutionSource: "arena" }),
    ]);
    const hinweise = buildArenaHostSpielquelleHinweise(gs, "A");
    expect(hinweise.find((h) => h.disciplineId === "fechten")).toBeUndefined();
  });

  it("noch nicht gewertet (teamPoints null): KEIN Hinweis fuer die arena-faehige Disziplin -- kein Raten", () => {
    const gs = buildGameState([
      zeile({ id: "r1", matchdayResultId: "mr-md1", teamId: "A", disciplineId: "fechten", disciplineSide: "d2", teamPoints: null, resolutionSource: "pps_duell" }),
    ]);
    const hinweise = buildArenaHostSpielquelleHinweise(gs, "A");
    expect(hinweise.find((h) => h.disciplineId === "fechten")).toBeUndefined();
  });
});
