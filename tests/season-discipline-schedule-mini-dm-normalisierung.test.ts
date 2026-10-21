/**
 * MINI-DM-KADERGROESSE: NORMALISIERUNG ALTER SLOTS (PR 1, 21.10., Chris' Ruecknahme der
 * 14.09.-Fixierung "mini dm sind immer 4 teams mit je 1 spieler die antreten").
 *
 * Ein bereits PERSISTIERTER Spielplan-Slot kann noch aus der Zeit der Fixierung stammen:
 * `playerCount: 1`, mit `legacyScorePlayerCount` (2..6), der den eigentlich gezogenen Wert
 * weiterhin trug (s. `SeasonDisciplineScheduleSlot.legacyScorePlayerCount` in
 * lib/data/olyDataTypes.ts). `getSeasonDisciplineSchedule()` gleicht das beim Lesen automatisch
 * an: fuer einen noch NICHT gespielten Spieltag (`matchdayIndex >= currentMatchday`) wird
 * `playerCount := legacyScorePlayerCount`, fuer einen bereits gespielten bleibt der Slot
 * unveraendert (historische Korrektheit -- sein Ergebnis wurde mit `playerCount: 1` gebucht).
 *
 * Diese Suite deckt die Normalisierungs-Logik direkt ab, unabhaengig von
 * `tests/season-discipline-schedule-battle-repeat.test.ts` (die den FRISCH GEZOGENEN Spielplan
 * prueft, der die Normalisierung gar nicht mehr braucht, weil `playerCount ===
 * legacyScorePlayerCount` von Anfang an gilt).
 */
import { describe, expect, it } from "vitest";

import type { GameState, SeasonDisciplineScheduleEntry } from "@/lib/data/olyDataTypes";
import { getSeasonDisciplineSchedule } from "@/lib/season/season-discipline-schedule";

// Vier Disziplinen -> `getRequiredSeasonDisciplineMatchdayCount()` = 2 -- fuer die Tests mit ZWEI
// manuell gebauten Spieltagen (Spieltag 1 gespielt, Spieltag 2 offen).
const DISCIPLINES = [
  { id: "mini-dm", name: "Mini DM", category: "power" as const, weight: 1, playerCount: 2 },
  { id: "tdm", name: "TDM", category: "power" as const, weight: 1, playerCount: 3 },
  { id: "hockey", name: "Hockey", category: "power" as const, weight: 1, playerCount: 5 },
  { id: "breaking", name: "Breaking", category: "power" as const, weight: 1, playerCount: 4 },
];

// Zwei Disziplinen -> `getRequiredSeasonDisciplineMatchdayCount()` = 1 -- fuer die Tests mit nur
// EINEM manuell gebauten Spieltag.
const TWO_DISCIPLINES = [
  { id: "mini-dm", name: "Mini DM", category: "power" as const, weight: 1, playerCount: 2 },
  { id: "tdm", name: "TDM", category: "power" as const, weight: 1, playerCount: 3 },
];

function buildEntry(input: {
  matchdayIndex: number;
  miniDmPlayerCount: number | null;
  miniDmLegacyScorePlayerCount?: number | null;
  otherDisciplineId?: string;
}): SeasonDisciplineScheduleEntry {
  return {
    seasonId: "season-normalisierung",
    matchdayId: `matchday-${input.matchdayIndex}`,
    matchdayIndex: input.matchdayIndex,
    matchdayLabel: `Spieltag ${input.matchdayIndex}`,
    discipline1: {
      disciplineId: "mini-dm",
      displayName: "Mini DM",
      order: 1,
      category: "power",
      playerCount: input.miniDmPlayerCount,
      ...(input.miniDmLegacyScorePlayerCount !== undefined
        ? { legacyScorePlayerCount: input.miniDmLegacyScorePlayerCount }
        : {}),
    },
    discipline2: {
      disciplineId: input.otherDisciplineId ?? "tdm",
      displayName: input.otherDisciplineId ?? "TDM",
      order: 2,
      category: "power",
      playerCount: 3,
      legacyScorePlayerCount: 3,
    },
    sourceStatus: "season_seed",
    sourceNote: null,
  };
}

function buildGameState(input: {
  currentMatchday: number;
  entries: SeasonDisciplineScheduleEntry[];
  disciplines?: typeof DISCIPLINES | typeof TWO_DISCIPLINES;
}): GameState {
  return {
    season: {
      id: "season-normalisierung",
      name: "Season Normalisierung",
      year: 1,
      currentMatchday: input.currentMatchday,
      matchdayIds: input.entries.map((entry) => entry.matchdayId),
    },
    seasonState: {
      seasonId: "season-normalisierung",
      schedule: [],
      disciplineSchedule: input.entries,
      standings: {},
    },
    matchdayState: {
      matchdayId: input.entries[0]?.matchdayId,
      status: "planning",
      pendingTeamIds: [],
      resolvedFixtureIds: [],
    },
    // Anzahl Disziplinen bestimmt `getRequiredSeasonDisciplineMatchdayCount()` -- muss zur Anzahl
    // der manuell gebauten Spieltage passen, sonst haelt `hasCompleteSeasonDisciplineSchedule()`
    // den Spielplan fuer unvollstaendig und baut ihn (unter Ignorieren der Test-Fixtures) neu.
    disciplines: input.disciplines ?? DISCIPLINES,
    teams: [],
  } as unknown as GameState;
}

describe("getSeasonDisciplineSchedule · Normalisierung alter Mini-DM-Slots", () => {
  it("setzt playerCount fuer einen NOCH NICHT gespielten Mini-DM-Slot auf legacyScorePlayerCount zurueck", () => {
    const entries = [
      buildEntry({ matchdayIndex: 1, miniDmPlayerCount: 1, miniDmLegacyScorePlayerCount: 5 }),
      buildEntry({ matchdayIndex: 2, miniDmPlayerCount: 1, miniDmLegacyScorePlayerCount: 3 }),
    ];
    // currentMatchday 1: BEIDE Spieltage sind noch nicht gespielt (>= currentMatchday).
    const gameState = buildGameState({ currentMatchday: 1, entries });

    const schedule = getSeasonDisciplineSchedule(gameState);
    expect(schedule).toHaveLength(2);
    expect(schedule[0]!.discipline1!.playerCount).toBe(5);
    expect(schedule[0]!.discipline1!.legacyScorePlayerCount).toBe(5);
    expect(schedule[1]!.discipline1!.playerCount).toBe(3);
    expect(schedule[1]!.discipline1!.legacyScorePlayerCount).toBe(3);
  });

  it("laesst einen BEREITS GESPIELTEN Mini-DM-Slot unveraendert bei playerCount: 1 (historische Korrektheit)", () => {
    const entries = [
      buildEntry({ matchdayIndex: 1, miniDmPlayerCount: 1, miniDmLegacyScorePlayerCount: 5 }),
      buildEntry({ matchdayIndex: 2, miniDmPlayerCount: 1, miniDmLegacyScorePlayerCount: 3 }),
    ];
    // currentMatchday 2: Spieltag 1 ist bereits gespielt (< currentMatchday), Spieltag 2 ist offen.
    const gameState = buildGameState({ currentMatchday: 2, entries });

    const schedule = getSeasonDisciplineSchedule(gameState);
    // Gespielt: unveraendert bei 1.
    expect(schedule[0]!.discipline1!.playerCount).toBe(1);
    expect(schedule[0]!.discipline1!.legacyScorePlayerCount).toBe(5);
    // Offen: zurueckgesetzt auf den gezogenen Wert.
    expect(schedule[1]!.discipline1!.playerCount).toBe(3);
  });

  it("laesst einen Mini-DM-Slot OHNE legacyScorePlayerCount unveraendert (keine Daten zum Wiederherstellen)", () => {
    const entries = [buildEntry({ matchdayIndex: 1, miniDmPlayerCount: 1, miniDmLegacyScorePlayerCount: null })];
    const gameState = buildGameState({ currentMatchday: 1, entries, disciplines: TWO_DISCIPLINES });

    const schedule = getSeasonDisciplineSchedule(gameState);
    expect(schedule[0]!.discipline1!.playerCount).toBe(1);
  });

  it("ist ein No-Op fuer einen frisch gezogenen Slot (playerCount === legacyScorePlayerCount von Anfang an)", () => {
    const entries = [buildEntry({ matchdayIndex: 1, miniDmPlayerCount: 4, miniDmLegacyScorePlayerCount: 4 })];
    const gameState = buildGameState({ currentMatchday: 1, entries, disciplines: TWO_DISCIPLINES });

    const schedule = getSeasonDisciplineSchedule(gameState);
    expect(schedule[0]!.discipline1!.playerCount).toBe(4);
  });

  it("fasst eine Nicht-Mini-DM-Disziplin nie an, auch nicht bei playerCount: 1", () => {
    // Ein hypothetischer (heute nicht produktiver) Fall: eine andere Disziplin mit playerCount 1
    // -- die Normalisierung ist explizit an `disciplineId === "mini-dm"` gebunden und darf eine
    // andere Disziplin nie anfassen, selbst wenn ihr Muster zufaellig passt.
    const entry: SeasonDisciplineScheduleEntry = {
      seasonId: "season-normalisierung",
      matchdayId: "matchday-1",
      matchdayIndex: 1,
      matchdayLabel: "Spieltag 1",
      discipline1: {
        disciplineId: "tdm",
        displayName: "TDM",
        order: 1,
        category: "power",
        playerCount: 1,
        legacyScorePlayerCount: 4,
      },
      discipline2: null,
      sourceStatus: "season_seed",
      sourceNote: null,
    };
    const gameState = buildGameState({ currentMatchday: 1, entries: [entry], disciplines: TWO_DISCIPLINES });

    const schedule = getSeasonDisciplineSchedule(gameState);
    expect(schedule[0]!.discipline1!.playerCount).toBe(1);
  });

  it("normalisiert discipline2 genauso wie discipline1, wenn Mini-DM auf der zweiten Seite steht", () => {
    const entry: SeasonDisciplineScheduleEntry = {
      seasonId: "season-normalisierung",
      matchdayId: "matchday-1",
      matchdayIndex: 1,
      matchdayLabel: "Spieltag 1",
      discipline1: {
        disciplineId: "tdm",
        displayName: "TDM",
        order: 1,
        category: "power",
        playerCount: 3,
        legacyScorePlayerCount: 3,
      },
      discipline2: {
        disciplineId: "mini-dm",
        displayName: "Mini DM",
        order: 2,
        category: "power",
        playerCount: 1,
        legacyScorePlayerCount: 6,
      },
      sourceStatus: "season_seed",
      sourceNote: null,
    };
    const gameState = buildGameState({ currentMatchday: 1, entries: [entry], disciplines: TWO_DISCIPLINES });

    const schedule = getSeasonDisciplineSchedule(gameState);
    expect(schedule[0]!.discipline2!.playerCount).toBe(6);
    expect(schedule[0]!.discipline1!.playerCount).toBe(3);
  });
});
