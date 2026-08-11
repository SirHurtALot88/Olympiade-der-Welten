import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { buildPpAreaFormBonusByTeamId } from "@/lib/foundation/pp-area-form-bonus";
import { buildFormCardSeasonUsageAudit } from "@/lib/lineups/legacy-lineup-modifiers";
import {
  compactFoundationInitialGameState,
  rehydrateGameStateAfterCompactPut,
} from "@/lib/persistence/foundation-initial-compact-state";

/**
 * DER GANZE PUNKT DIESER DATEI: die Zahlen zweimal rechnen — einmal auf dem vollen Spielstand,
 * einmal auf genau dem Payload, den der Browser wirklich bekommt — und verlangen, dass dasselbe
 * herauskommt. Geprueft werden WERTE, kein Quelltext.
 *
 * Der Payload laeuft dabei durch `JSON.parse(JSON.stringify(...))`, also durch dieselbe Enge wie
 * ueber die Leitung: was nicht serialisierbar mitfaehrt (Maps, Sets, `undefined`), kommt hier
 * nicht an — genauso wenig wie im Browser.
 */

const SEASON = "season-1";
const MATCHDAYS = ["md-1", "md-2", "md-3"] as const;

type DisziplinErgebnis = {
  id: string;
  matchdayResultId: string;
  teamId: string;
  disciplineId: string;
  formModifier: number;
};

function disziplinErgebnisse(): DisziplinErgebnis[] {
  const rows: DisziplinErgebnis[] = [];
  // Spieltag 1 und 2 liegen in der Vergangenheit, Spieltag 3 ist der aktive. Genau so sieht der
  // gemeldete Fall aus: der Browser kennt nur den aktiven, die Saisonsumme braucht alle drei.
  const plan: Array<[string, string, string, number]> = [
    ["md-1", "A-A", "pow1", 30],
    ["md-1", "A-A", "spe1", 12.5],
    ["md-1", "B-B", "men1", -20],
    ["md-2", "A-A", "pow1", 8],
    ["md-2", "B-B", "men1", 40],
    ["md-2", "B-B", "soc1", 5],
    ["md-3", "A-A", "spe1", 4],
    ["md-3", "B-B", "men1", 1.5],
  ];
  for (const [matchdayId, teamId, disciplineId, formModifier] of plan) {
    rows.push({
      id: `disc-${matchdayId}-${teamId}-${disciplineId}`,
      matchdayResultId: `result-${matchdayId}`,
      teamId,
      disciplineId,
      formModifier,
    });
  }
  return rows;
}

/**
 * Karten: je Team zwei positive und zwei negative. Gespielt sind die beiden negativen von A-A
 * (auf md-1 und md-2, also auf Spieltagen, die der Browser NICHT mehr sieht) und eine positive
 * auf dem aktiven Spieltag.
 */
function formCards() {
  return [
    { id: "card-A-neg-1", seasonId: SEASON, teamId: "A-A", playerId: "p-1", cardValue: -8 },
    { id: "card-A-neg-2", seasonId: SEASON, teamId: "A-A", playerId: "p-2", cardValue: -4 },
    { id: "card-A-pos-1", seasonId: SEASON, teamId: "A-A", playerId: "p-1", cardValue: 8 },
    { id: "card-A-pos-2", seasonId: SEASON, teamId: "A-A", playerId: "p-2", cardValue: 4 },
    { id: "card-A-null", seasonId: SEASON, teamId: "A-A", playerId: "p-3", cardValue: 0 },
    { id: "card-B-neg-1", seasonId: SEASON, teamId: "B-B", playerId: "p-9", cardValue: -6 },
    { id: "card-B-pos-1", seasonId: SEASON, teamId: "B-B", playerId: "p-9", cardValue: 6 },
  ];
}

function lineupDrafts() {
  return [
    {
      lineupId: "lineup-md-1-A",
      saveId: "save-1",
      seasonId: SEASON,
      matchdayId: "md-1",
      teamId: "A-A",
      modifiers: { d1: { primaryFormCardId: "card-A-neg-1" }, d2: {} },
    },
    {
      lineupId: "lineup-md-2-A",
      saveId: "save-1",
      seasonId: SEASON,
      matchdayId: "md-2",
      teamId: "A-A",
      modifiers: { d1: { primaryFormCardId: "card-A-neg-2" }, d2: {} },
    },
    {
      lineupId: "lineup-md-3-A",
      saveId: "save-1",
      seasonId: SEASON,
      matchdayId: "md-3",
      teamId: "A-A",
      modifiers: { d1: { primaryFormCardId: "card-A-pos-1" }, d2: {} },
    },
    {
      lineupId: "lineup-md-1-B",
      saveId: "save-1",
      seasonId: SEASON,
      matchdayId: "md-1",
      teamId: "B-B",
      modifiers: { d1: { primaryFormCardId: "card-B-neg-1" }, d2: {} },
    },
  ];
}

function vollerSpielstand(): GameState {
  return {
    saveVersion: 1,
    season: { id: SEASON, name: "Saison 1", year: 1, currentMatchday: 3, matchdayIds: [...MATCHDAYS] },
    gamePhase: "season_running",
    matchdayState: { matchdayId: "md-3", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [
      { teamId: "A-A", name: "Alpha", shortCode: "A-A", budget: 100, cash: 100, humanControlled: true },
      { teamId: "B-B", name: "Beta", shortCode: "B-B", budget: 100, cash: 100 },
    ],
    teamIdentities: [],
    players: [],
    rosters: [],
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
    disciplines: [
      { id: "pow1", name: "TDM", category: "power", weight: 1 },
      { id: "spe1", name: "Staffel", category: "speed", weight: 1 },
      { id: "men1", name: "Schach", category: "mental", weight: 1 },
      { id: "soc1", name: "Basketball", category: "social", weight: 1 },
    ],
    seasonState: {
      seasonId: SEASON,
      schedule: [],
      standings: {},
      seasonSnapshots: [],
      matchdayResults: MATCHDAYS.map((matchdayId) => ({
        id: `result-${matchdayId}`,
        seasonId: SEASON,
        matchdayId,
        status: "preview_applied",
        createdAt: "2026-06-06T12:00:00.000Z",
      })),
      disciplineResults: disziplinErgebnisse(),
      lineupDrafts: lineupDrafts(),
      formCards: formCards(),
      teamControlSettings: {
        "A-A": { teamId: "A-A", controlMode: "manual" },
        "B-B": { teamId: "B-B", controlMode: "ai" },
      },
    },
    mappingReport: {
      mappingSource: "test",
      teamSource: "test",
      generatedAt: "2026-06-06T00:00:00.000Z",
      processedMappingRows: 0,
      importedPlayerCount: 0,
      matchedRosterCount: 0,
      teamCount: 2,
      unmappedPlayers: [],
    },
  } as unknown as GameState;
}

/** Genau der Weg zum Browser: beschneiden und ueber die Leitung serialisieren. */
function alsBrowserPayload(gameState: GameState): GameState {
  return JSON.parse(JSON.stringify(compactFoundationInitialGameState(gameState))) as GameState;
}

describe("Formkarten im kompakten Browser-Payload", () => {
  it("PP-Formbonus: der Browser kommt auf dieselben Werte wie der volle Spielstand", () => {
    const voll = vollerSpielstand();
    const browser = alsBrowserPayload(voll);

    // Vorbedingung, damit der Test ueberhaupt etwas misst: der Browser bekommt ALLE
    // Disziplin-Ergebnisse, also auch die der zurueckliegenden Spieltage 1 und 2.
    //
    // FRUEHER STAND HIER `toBe(2)` — der Payload war auf den aktiven Spieltag beschnitten,
    // und genau daraus entstand der gemeldete Fehler (am Live-Save: nur 14 von 32 Teams mit
    // Bilanz, Wicked Wizards 181,8 -> 69,6). Die Beschneidung ist entfallen; der Test misst
    // jetzt, dass der Browser AUS EIGENER KRAFT auf die Serverwerte kommt.
    expect(voll.seasonState.disciplineResults?.length).toBe(8);
    expect(browser.seasonState.disciplineResults?.length).toBe(8);
    expect(new Set((browser.seasonState.disciplineResults ?? []).map((r) => r.matchdayResultId)).size).toBe(3);

    const erwartet = {
      "A-A": { total: 54.5, pow: 38, spe: 16.5, men: 0, soc: 0 },
      "B-B": { total: 26.5, pow: 0, spe: 0, men: 21.5, soc: 5 },
    };

    expect(buildPpAreaFormBonusByTeamId(voll, SEASON)).toEqual(erwartet);
    expect(buildPpAreaFormBonusByTeamId(browser, SEASON)).toEqual(erwartet);
  });

  it("PP-Formbonus: ein waehrend der Sitzung gespielter Spieltag schlaegt die Projektion", () => {
    // Die Projektion stammt vom Laden. Wer den naechsten Spieltag spielt, kennt dessen Wirkung
    // nur lokal — sie darf nicht von der aelteren Projektion verdeckt werden.
    const voll = vollerSpielstand();
    const browser = alsBrowserPayload(voll);

    browser.season.matchdayIds = [...MATCHDAYS, "md-4"];
    browser.seasonState.matchdayResults = [
      ...(browser.seasonState.matchdayResults ?? []),
      {
        id: "result-md-4",
        seasonId: SEASON,
        matchdayId: "md-4",
        status: "preview_applied",
        createdAt: "2026-06-06T12:00:00.000Z",
      } as never,
    ];
    browser.seasonState.disciplineResults = [
      ...(browser.seasonState.disciplineResults ?? []),
      {
        id: "disc-md-4-A-A-pow1",
        matchdayResultId: "result-md-4",
        teamId: "A-A",
        disciplineId: "pow1",
        formModifier: 10,
      } as never,
    ];

    expect(buildPpAreaFormBonusByTeamId(browser, SEASON)["A-A"]).toEqual({
      total: 64.5,
      pow: 48,
      spe: 16.5,
      men: 0,
      soc: 0,
    });
  });

  it("PP-Formbonus: die Projektion einer anderen Saison springt nicht ein", () => {
    const browser = alsBrowserPayload(vollerSpielstand());
    browser.seasonState.foundationPpAreaFormBonus = {
      seasonId: "season-99",
      matchdays: [{ matchdayId: "md-1", bonusByTeamId: { "A-A": { pow: 999 } } }],
    };

    // Die Fremdsaison darf nicht einspringen — der Browser rechnet aus seinen eigenen,
    // jetzt vollstaendigen Daten und kommt auf denselben Wert wie der volle Spielstand.
    //
    // FRUEHER STAND HIER `{ total: 4, pow: 0, spe: 4, ... }`: der beschnittene Payload gab
    // nur den aktiven Spieltag her, also war der „Rest ohne Projektion" ein Bruchteil der
    // Wahrheit. Dass 999 aus `season-99` nicht durchschlaegt, ist unveraendert die Aussage
    // dieses Falls — nur die richtige Zahl daneben ist jetzt die volle.
    expect(buildPpAreaFormBonusByTeamId(browser, SEASON)["A-A"]).toEqual({
      total: 54.5,
      pow: 38,
      spe: 16.5,
      men: 0,
      soc: 0,
    });
  });

  it("Formkarten-Nutzung: der Browser findet keine offenen negativen Karten, die es nicht gibt", () => {
    const voll = vollerSpielstand();
    const browser = alsBrowserPayload(voll);

    // Vorbedingung: der Browser bekommt ALLE Aufstellungen, also auch die der Spieltage 1
    // und 2, auf denen A-A seine beiden negativen Karten gelegt hat.
    //
    // FRUEHER STAND HIER `toBe(1)`: nur der aktive Spieltag fuhr mit, A-A wirkte deshalb
    // mit zwei ungespielten negativen Karten dazustehen — daher der Formkarten-Alarm der
    // Inbox mit 605 gemeldeten Strafpunkten, die es in Wahrheit nicht gab.
    expect(voll.seasonState.lineupDrafts?.length).toBe(4);
    expect(browser.seasonState.lineupDrafts?.length).toBe(4);

    const vollZeile = buildFormCardSeasonUsageAudit(voll, SEASON).rows.find((row) => row.teamId === "A-A")!;
    const browserZeile = buildFormCardSeasonUsageAudit(browser, SEASON).rows.find((row) => row.teamId === "A-A")!;

    // A-A hat BEIDE negativen Karten gespielt — es darf keine Strafpunkt-Warnung geben.
    expect(vollZeile).toMatchObject({ totalCards: 4, usedCards: 3, unusedNegativeCards: 0, negativePenaltyPoints: 0 });
    expect(browserZeile).toEqual(vollZeile);
  });

  it("Formkarten-Nutzung: eine waehrend der Sitzung gelegte Karte zaehlt sofort als gespielt", () => {
    const browser = alsBrowserPayload(vollerSpielstand());
    const vorher = buildFormCardSeasonUsageAudit(browser, SEASON).rows.find((row) => row.teamId === "B-B")!;
    expect(vorher).toMatchObject({ usedCards: 1, unusedCards: 1, unusedPositiveCards: 1 });

    // B-B legt jetzt seine offene positive Karte auf den aktiven Spieltag.
    browser.seasonState.lineupDrafts = [
      ...(browser.seasonState.lineupDrafts ?? []),
      {
        lineupId: "lineup-md-3-B",
        saveId: "save-1",
        seasonId: SEASON,
        matchdayId: "md-3",
        teamId: "B-B",
        modifiers: { d1: { primaryFormCardId: "card-B-pos-1" }, d2: {} },
      } as never,
    ];

    expect(buildFormCardSeasonUsageAudit(browser, SEASON).rows.find((row) => row.teamId === "B-B")).toMatchObject({
      usedCards: 2,
      unusedCards: 0,
      unusedPositiveCards: 0,
    });
  });

  it("Formkarten-Nutzung: die Nullwert-Karte bleibt ungespielt und ohne Strafe", () => {
    // Sie faehrt bewusst nicht in `unusedCardIds` mit — der Leser darf sie deshalb trotzdem
    // nicht als gespielt fuehren.
    const browser = alsBrowserPayload(vollerSpielstand());
    const projektion = browser.seasonState.foundationFormCardBonus;
    expect(projektion?.unusedCardIds).not.toContain("card-A-null");
    // 4 Karten je Team-Zeile heisst: die Nullwert-Karte zaehlt nirgends mit (sie wird vorher
    // gefiltert), und die drei gespielten plus die eine offene ergeben die Bilanz.
    expect(buildFormCardSeasonUsageAudit(browser, SEASON).rows.find((row) => row.teamId === "A-A")).toMatchObject({
      totalCards: 4,
      usedCards: 3,
      unusedCards: 1,
      unusedPositiveCards: 1,
      unusedNegativeCards: 0,
    });
  });

  it("beide Projektionen sind reine Anzeigefracht und fahren nie in den Spielstand zurueck", () => {
    const voll = vollerSpielstand();
    const browser = alsBrowserPayload(voll);
    expect(browser.seasonState.foundationPpAreaFormBonus?.seasonId).toBe(SEASON);
    expect(browser.seasonState.foundationFormCardBonus?.unusedCardIds?.length).toBeGreaterThan(0);

    const zurueck = rehydrateGameStateAfterCompactPut(voll, browser);
    expect(zurueck.seasonState.foundationPpAreaFormBonus).toBeUndefined();
    expect(zurueck.seasonState.foundationFormCardBonus).toBeUndefined();
  });
});
