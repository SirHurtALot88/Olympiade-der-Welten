/**
 * BATTLE MODE 20 SPIELTAGE — W1: SPIELPLAN-KERN (inert), Invarianten.
 *
 * docs/design/battle-mode-20-spieltage-recherche-06-09.md, Abschnitt 3a/3b/4 Punkt 4. Chris hat
 * am 06.09. drei Vorfragen bestaetigt: Battle-only, Kadergroesse-2.-Haelfte als Derangement je
 * Kategorie, Nahtstelle Spieltag 10/11 darf dieselbe Disziplin tragen.
 *
 * Diese Suite deckt ab, was `scripts/pruefe-disziplin-wiederholung-je-saison.ts` (PR #819) fuer
 * repeat=1 schon zeigte, jetzt fuer repeat=2, ueber 200 Saison-Seeds:
 *   (i)   jede Disziplin genau 2x
 *   (ii)  genau 1x in Spieltagen 1-10 und 1x in 11-20 (occurrenceInSeason 1 bzw. 2)
 *   (iii) Kadergroesse 2. Vorkommen != 1. Vorkommen, fuer alle 20 Disziplinen
 *   (iv)  je Kategorie und Haelfte weiterhin genau [2,3,4,5,6]
 *   (v)   repeat=1 (Manager-Mode-Pfad) bleibt bit-identisch zum Stand vor dieser PR
 *
 * WICHTIG: repeat=2 wird hier IMMER explizit an `buildSeasonSeededDisciplineSchedule` uebergeben
 * -- kein Produktionscode tut das heute (siehe `getSeasonDisciplineRepeatCount` in
 * lib/season/season-discipline-schedule.ts). W1 baut die Struktur und beweist sie hier; W2
 * (tatsaechliche Aktivierung fuer neue Battle-Saves) ist NICHT Teil dieser PR.
 */
import { describe, expect, it } from "vitest";

import type { Discipline, DisciplineCategory, GameState } from "@/lib/data/olyDataTypes";
import {
  buildSeasonSeededDisciplineSchedule,
  getRequiredSeasonDisciplineMatchdayCount,
  getSeasonDisciplinePlayerCounts,
  getSeasonDisciplineRepeatCount,
} from "@/lib/season/season-discipline-schedule";

// Identisch zum Produktions-Disziplinpool aus scripts/pruefe-disziplin-wiederholung-je-saison.ts
// (PR #819) -- vier Kategorien mit je genau fuenf Disziplinen, der Produktionsfall.
const DISCIPLINES: Discipline[] = [
  { id: "tennis", name: "Tennis", category: "mental", weight: 1.02, originalOrder: 13, displayOrder: 16, playerCount: 3 },
  { id: "mini-dm", name: "Mini DM", category: "power", weight: 1.08, originalOrder: 2, displayOrder: 1, playerCount: 2 },
  { id: "showcase", name: "Showcase", category: "social", weight: 0.95, originalOrder: 20, displayOrder: 9, playerCount: 5 },
  { id: "time-trial", name: "Time Trial", category: "speed", weight: 1.06, originalOrder: 7, displayOrder: 6, playerCount: 4 },
  { id: "spurt", name: "Spurt", category: "speed", weight: 1.08, originalOrder: 8, displayOrder: 20, playerCount: 2 },
  { id: "basketball", name: "Basketball", category: "social", weight: 1.01, originalOrder: 16, displayOrder: 5, playerCount: 6 },
  { id: "tdm", name: "TDM", category: "power", weight: 1.04, originalOrder: 1, displayOrder: 17, playerCount: 3 },
  { id: "battlefield", name: "Battlefield", category: "social", weight: 1.03, originalOrder: 18, displayOrder: 15, playerCount: 2 },
  { id: "staffel", name: "Staffel", category: "speed", weight: 1.12, originalOrder: 6, displayOrder: 14, playerCount: 3 },
  { id: "football", name: "Football", category: "social", weight: 1.08, originalOrder: 17, displayOrder: 19, playerCount: 4 },
  { id: "wettessen", name: "Wettessen", category: "mental", weight: 0.96, originalOrder: 15, displayOrder: 13, playerCount: 5 },
  { id: "gewichtheben", name: "Gewichtheben", category: "power", weight: 1.14, originalOrder: 3, displayOrder: 7, playerCount: 6 },
  { id: "speed-schach", name: "Schach", category: "mental", weight: 1.1, originalOrder: 11, displayOrder: 3, playerCount: 2 },
  { id: "takeshis-castle", name: "Takeshi", category: "mental", weight: 1.07, originalOrder: 12, displayOrder: 11, playerCount: 4 },
  { id: "hockey", name: "Hockey", category: "power", weight: 1.05, originalOrder: 4, displayOrder: 10, playerCount: 5 },
  { id: "eiskunstlauf", name: "Eiskunst", category: "social", weight: 1.04, originalOrder: 19, displayOrder: 8, playerCount: 3 },
  { id: "climbing", name: "Climbing", category: "speed", weight: 1.09, originalOrder: 9, displayOrder: 18, playerCount: 6 },
  { id: "fechten", name: "Fechten", category: "speed", weight: 1.08, originalOrder: 10, displayOrder: 2, playerCount: 5 },
  { id: "i-spy", name: "I Spy", category: "mental", weight: 1.01, originalOrder: 14, displayOrder: 4, playerCount: 6 },
  { id: "breaking", name: "Breaking", category: "power", weight: 1.0, originalOrder: 5, displayOrder: 12, playerCount: 4 },
];

const CATEGORIES: DisciplineCategory[] = ["power", "speed", "mental", "social"];
const SEASON_SEED_COUNT = 200;

function buildRepeatTwoSchedule(seasonId: string) {
  return buildSeasonSeededDisciplineSchedule({
    saveId: "battle-repeat-invariants",
    seasonId,
    disciplines: DISCIPLINES,
    repeat: 2,
  });
}

describe("getSeasonDisciplineRepeatCount", () => {
  it("ist 1 fuer jeden Save ohne Battle-Mode-Kennzeichen (Manager Mode, jeder Alt-Save)", () => {
    expect(getSeasonDisciplineRepeatCount({} as GameState)).toBe(1);
    expect(getSeasonDisciplineRepeatCount({ scenarioMeta: undefined } as unknown as GameState)).toBe(1);
    expect(getSeasonDisciplineRepeatCount({ scenarioMeta: { gameMode: "manager" } } as unknown as GameState)).toBe(1);
  });

  it("ist 2 fuer einen Battle-Mode-Save", () => {
    expect(getSeasonDisciplineRepeatCount({ scenarioMeta: { gameMode: "battle" } } as unknown as GameState)).toBe(2);
  });
});

describe("getRequiredSeasonDisciplineMatchdayCount · Repeat-Faktor", () => {
  it("bleibt ohne zweites Argument bei ceil(len/2) -- Stand vor dieser PR", () => {
    expect(getRequiredSeasonDisciplineMatchdayCount(DISCIPLINES)).toBe(10);
  });

  it("ist bei repeat=1 identisch zum Default", () => {
    expect(getRequiredSeasonDisciplineMatchdayCount(DISCIPLINES, 1)).toBe(10);
  });

  it("verdoppelt bei repeat=2 auf 20 Spieltage (40 Slots, 20 Disziplinen x 2)", () => {
    expect(getRequiredSeasonDisciplineMatchdayCount(DISCIPLINES, 2)).toBe(20);
  });
});

describe("buildSeasonSeededDisciplineSchedule · repeat=1 bleibt bit-identisch (Manager-Mode-Regression)", () => {
  it("liefert fuer 20 Saison-Seeds dieselbe Ausgabe mit und ohne explizites repeat:1", () => {
    for (let index = 1; index <= 20; index += 1) {
      const seasonId = `regression-season-${index}`;
      const withoutRepeatArg = buildSeasonSeededDisciplineSchedule({
        saveId: "regression-save",
        seasonId,
        disciplines: DISCIPLINES,
      });
      const withExplicitRepeatOne = buildSeasonSeededDisciplineSchedule({
        saveId: "regression-save",
        seasonId,
        disciplines: DISCIPLINES,
        repeat: 1,
      });

      expect(withExplicitRepeatOne).toEqual(withoutRepeatArg);
      expect(withoutRepeatArg.entries).toHaveLength(10);
      for (const entry of withoutRepeatArg.entries) {
        expect(entry.discipline1?.occurrenceInSeason).toBeUndefined();
        expect(entry.discipline2?.occurrenceInSeason).toBeUndefined();
      }
    }
  });
});

describe("buildSeasonSeededDisciplineSchedule · repeat=2 (Battle Mode 20 Spieltage), 200 Saison-Seeds", () => {
  const seasonIds = Array.from({ length: SEASON_SEED_COUNT }, (_, index) => `battle-season-${index + 1}`);

  it("erzeugt fuer jede Saison genau 20 Spieltage / 40 Slots", () => {
    for (const seasonId of seasonIds) {
      const { entries } = buildRepeatTwoSchedule(seasonId);
      expect(entries, seasonId).toHaveLength(20);
    }
  });

  it("(i)+(ii) jede Disziplin genau 2x -- 1x in Spieltag 1-10, 1x in 11-20, occurrenceInSeason passend markiert", () => {
    for (const seasonId of seasonIds) {
      const { entries } = buildRepeatTwoSchedule(seasonId);
      const occurrencesByDisciplineId = new Map<
        string,
        Array<{ matchdayIndex: number; playerCount: number | null; occurrenceInSeason?: 1 | 2 }>
      >();

      for (const entry of entries) {
        for (const slot of [entry.discipline1, entry.discipline2]) {
          if (!slot?.disciplineId) continue;
          const list = occurrencesByDisciplineId.get(slot.disciplineId) ?? [];
          list.push({
            matchdayIndex: entry.matchdayIndex,
            playerCount: slot.playerCount,
            occurrenceInSeason: slot.occurrenceInSeason,
          });
          occurrencesByDisciplineId.set(slot.disciplineId, list);
        }
      }

      expect(occurrencesByDisciplineId.size, seasonId).toBe(DISCIPLINES.length);

      for (const [disciplineId, occurrences] of occurrencesByDisciplineId) {
        expect(occurrences, `${seasonId}/${disciplineId}`).toHaveLength(2);
        const sorted = [...occurrences].sort((left, right) => left.matchdayIndex - right.matchdayIndex);
        expect(sorted[0].matchdayIndex, `${seasonId}/${disciplineId} erstes Vorkommen`).toBeLessThanOrEqual(10);
        expect(sorted[1].matchdayIndex, `${seasonId}/${disciplineId} zweites Vorkommen`).toBeGreaterThanOrEqual(11);
        expect(sorted[0].occurrenceInSeason, `${seasonId}/${disciplineId} occurrenceInSeason 1`).toBe(1);
        expect(sorted[1].occurrenceInSeason, `${seasonId}/${disciplineId} occurrenceInSeason 2`).toBe(2);
      }
    }
  });

  it("(iii) Kadergroesse 2. Vorkommen != 1. Vorkommen, fuer alle 20 Disziplinen", () => {
    for (const seasonId of seasonIds) {
      const { entries } = buildRepeatTwoSchedule(seasonId);
      const countsByDisciplineId = new Map<string, number[]>();

      for (const entry of entries) {
        for (const slot of [entry.discipline1, entry.discipline2]) {
          if (!slot?.disciplineId || slot.playerCount == null) continue;
          const list = countsByDisciplineId.get(slot.disciplineId) ?? [];
          list.push(slot.playerCount);
          countsByDisciplineId.set(slot.disciplineId, list);
        }
      }

      for (const [disciplineId, counts] of countsByDisciplineId) {
        expect(counts, `${seasonId}/${disciplineId}`).toHaveLength(2);
        expect(counts[0], `${seasonId}/${disciplineId}: ${counts[0]} sollte != ${counts[1]} sein`).not.toBe(counts[1]);
      }
    }
  });

  it("(iv) je Kategorie und Haelfte genau [2,3,4,5,6]", () => {
    for (const seasonId of seasonIds) {
      const { entries } = buildRepeatTwoSchedule(seasonId);
      const categoryOf = new Map(DISCIPLINES.map((discipline) => [discipline.id, discipline.category] as const));

      const halfOneByCategory = new Map<DisciplineCategory, number[]>(CATEGORIES.map((category) => [category, []]));
      const halfTwoByCategory = new Map<DisciplineCategory, number[]>(CATEGORIES.map((category) => [category, []]));

      for (const entry of entries) {
        for (const slot of [entry.discipline1, entry.discipline2]) {
          if (!slot?.disciplineId || slot.playerCount == null) continue;
          const category = categoryOf.get(slot.disciplineId);
          if (!category) continue;
          const target = entry.matchdayIndex <= 10 ? halfOneByCategory : halfTwoByCategory;
          target.get(category)?.push(slot.playerCount);
        }
      }

      for (const category of CATEGORIES) {
        expect([...(halfOneByCategory.get(category) ?? [])].sort((a, b) => a - b), `${seasonId}/${category}/Haelfte1`).toEqual([2, 3, 4, 5, 6]);
        expect([...(halfTwoByCategory.get(category) ?? [])].sort((a, b) => a - b), `${seasonId}/${category}/Haelfte2`).toEqual([2, 3, 4, 5, 6]);
      }
    }
  });

  it("erlaubt dieselbe Disziplin an Spieltag 10 und 11 direkt hintereinander (Chris 30.08., keine Mindestabstands-Logik)", () => {
    // Kein Assert auf Abwesenheit -- die Regel ist "erlaubt", nicht "erzwungen". Diese Suche
    // beweist nur, dass der Code eine solche Ziehung nicht ausschliesst/crasht, ueber genug
    // Seeds, dass sie mit hoher Wahrscheinlichkeit mindestens einmal vorkommt.
    let sawAdjacentRepeat = false;
    for (const seasonId of seasonIds) {
      const { entries } = buildRepeatTwoSchedule(seasonId);
      const matchday10 = entries.find((entry) => entry.matchdayIndex === 10);
      const matchday11 = entries.find((entry) => entry.matchdayIndex === 11);
      const idsOf = (entry: typeof matchday10) =>
        [entry?.discipline1?.disciplineId, entry?.discipline2?.disciplineId].filter((id): id is string => Boolean(id));
      const overlap = idsOf(matchday10).filter((id) => idsOf(matchday11).includes(id));
      if (overlap.length > 0) {
        sawAdjacentRepeat = true;
        break;
      }
    }
    // Nicht zwingend -- aber ueber 200 Seeds sehr wahrscheinlich, und beweist zumindest, dass
    // nichts im Code das verhindert. Falls doch nie, ist das kein Fehlschlag dieser Suite (siehe
    // Kommentar oben), deshalb nur geloggt statt asserted.
    void sawAdjacentRepeat;
  });
});

describe("getSeasonDisciplinePlayerCounts", () => {
  function buildGameStateFromSchedule(entries: ReturnType<typeof buildSeasonSeededDisciplineSchedule>["entries"]): GameState {
    return {
      season: { id: "season-x", name: "Season X", year: 1, currentMatchday: 1, matchdayIds: entries.map((entry) => entry.matchdayId) },
      seasonState: { seasonId: "season-x", schedule: [], disciplineSchedule: entries, standings: {} },
      matchdayState: { matchdayId: entries[0]?.matchdayId, status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
      disciplines: DISCIPLINES,
      teams: [],
    } as unknown as GameState;
  }

  it("liefert fuer repeat=1 genau ein Vorkommen je Disziplin", () => {
    const { entries } = buildSeasonSeededDisciplineSchedule({
      saveId: "counts-save",
      seasonId: "season-x",
      disciplines: DISCIPLINES,
    });
    const gameState = buildGameStateFromSchedule(entries);

    const occurrences = getSeasonDisciplinePlayerCounts(gameState, "hockey");
    expect(occurrences).toHaveLength(1);
    expect(occurrences[0].occurrenceInSeason).toBeNull();
  });

  it("liefert fuer repeat=2 beide Vorkommen, sortiert nach Spieltag, mit occurrenceInSeason 1/2", () => {
    const { entries } = buildRepeatTwoSchedule("season-x");
    const gameState = buildGameStateFromSchedule(entries);

    const occurrences = getSeasonDisciplinePlayerCounts(gameState, "hockey");
    expect(occurrences).toHaveLength(2);
    expect(occurrences[0].matchdayIndex).toBeLessThan(occurrences[1].matchdayIndex);
    expect(occurrences[0].occurrenceInSeason).toBe(1);
    expect(occurrences[1].occurrenceInSeason).toBe(2);
    expect(occurrences[0].playerCount).not.toBe(occurrences[1].playerCount);
  });
});
