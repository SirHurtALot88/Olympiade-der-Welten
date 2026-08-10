/**
 * JEDE SAISON BEKOMMT IHRE EIGENEN APRON-LINIEN.
 *
 * Chris: „apron linien neu berechnen und jede season neu berechnen lassen!"
 *
 * Der Timing-Fix (#467) rechnet neu, solange die laufende Saison keinen abgerechneten Spieltag hat.
 * Dieser Test hält die SAISONÜBERGREIFENDE Folge fest, die dort nicht explizit geprüft war: ein
 * Snapshot der VORSAISON überlebt den Saisonübergang im `seasonState` — er darf für die neue Saison
 * trotzdem nie gelten. Zwei aufeinanderfolgende Saisons mit deutlich verschiedenen Gehaltsniveaus:
 * die Linien der zweiten müssen aus deren EIGENEN Kadern kommen, nicht aus denen der ersten.
 *
 * Außerdem festgehalten: der Herkunftsvermerk. Jeder von `ensureSeasonApronLinesFrozen` geschriebene
 * Snapshot trägt `frozenAtEvent: "buy_window_close"` — ohne den Vermerk war ein von einem Alt-Build
 * zu früh eingefrorener Stand (Chris' Save: Median 45,0 gegen real 69,8) von außen nicht von einem
 * gültigen zu unterscheiden.
 */
import { describe, expect, it } from "vitest";

import type { ApronLinesSnapshot, GameState } from "@/lib/data/olyDataTypes";
import { resolveSeasonApronLines } from "@/lib/season/apron-service";
import { ensureSeasonApronLinesFrozen } from "@/lib/season/apron-settlement-service";

/** Minimaler Spielstand — dieselbe Bauweise wie tests/apron-linien-nach-kaderbau.test.ts. */
function baueSpielstand(optionen: {
  seasonId: string;
  gehaelterProTeam: number[];
  /** Saisons, die ein gewertetes Ergebnis tragen (Zeuge für `hasSeasonBeenPlayed`). */
  gespielteSaisons?: string[];
  snapshot?: ApronLinesSnapshot;
}): GameState {
  const { seasonId, gehaelterProTeam } = optionen;
  const teams = gehaelterProTeam.map((_, index) => ({
    teamId: `team-${index + 1}`,
    name: `Team ${index + 1}`,
    shortCode: `T${index + 1}`,
    cash: 50,
  }));
  const players = gehaelterProTeam.map((_, index) => ({
    id: `player-${index + 1}`,
    name: `Spieler ${index + 1}`,
    teamId: `team-${index + 1}`,
  }));
  const rosters = gehaelterProTeam.map((gehalt, index) => ({
    teamId: `team-${index + 1}`,
    playerId: `player-${index + 1}`,
    salary: gehalt,
    contractLength: 3,
  }));

  return {
    season: { id: seasonId, name: seasonId, matchdayIds: [`${seasonId}-matchday-1`], currentMatchday: 1 },
    gamePhase: "season_active",
    matchdayState: { matchdayId: `${seasonId}-matchday-1`, status: "pending" },
    teams,
    players,
    rosters,
    disciplines: [],
    seasonState: {
      schedule: [],
      standings: [],
      matchdayResults: (optionen.gespielteSaisons ?? []).map((gespielteSaison) => ({
        id: `${gespielteSaison}-result-1`,
        seasonId: gespielteSaison,
        matchdayId: `${gespielteSaison}-matchday-1`,
      })),
      standingsApplyLogs: [],
      apronLinesSnapshot: optionen.snapshot,
    },
  } as unknown as GameState;
}

/** Season 1 spielt mit Median 40 — deren eingefrorene Linien: 44,0 / 50,0. */
const SAISON_1_SNAPSHOT: ApronLinesSnapshot = {
  seasonId: "season-1",
  frozenAtMatchdayId: "season-1-matchday-1",
  createdAt: "2026-08-01T10:00:00.000Z",
  frozenAtEvent: "buy_window_close",
  medianSalary: 40,
  line1: 44,
  line2: 50,
  usedReferenceSalary: false,
};

/** Season 2 rüstet deutlich auf: Median 80 statt 40. */
const SAISON_2_GEHAELTER = Array.from({ length: 32 }, () => 80);

describe("Jede Saison bekommt ihre eigenen Apron-Linien", () => {
  it("nach dem Saisonübergang gelten nicht die Linien der Vorsaison", () => {
    // Season 2 ist aktiv, der Season-1-Snapshot lebt noch im seasonState, Season 1 wurde gespielt,
    // Season 2 noch nicht — exakt der Zustand direkt nach dem Übergang.
    const state = baueSpielstand({
      seasonId: "season-2",
      gehaelterProTeam: SAISON_2_GEHAELTER,
      gespielteSaisons: ["season-1"],
      snapshot: SAISON_1_SNAPSHOT,
    });

    const linien = resolveSeasonApronLines(state);

    // Aus den EIGENEN Kadern der Season 2 (Median 80 → 88 / 100), nicht aus Season 1 (50).
    expect(linien.medianSalary).toBeCloseTo(80, 1);
    expect(linien.line2).toBeCloseTo(100, 1);
    expect(linien.line2).not.toBeCloseTo(SAISON_1_SNAPSHOT.line2, 1);
  });

  it("das Einfrieren der neuen Saison ersetzt den Vorsaison-Snapshot und vermerkt die Herkunft", () => {
    const state = baueSpielstand({
      seasonId: "season-2",
      gehaelterProTeam: SAISON_2_GEHAELTER,
      gespielteSaisons: ["season-1"],
      snapshot: SAISON_1_SNAPSHOT,
    });

    const eingefroren = ensureSeasonApronLinesFrozen(state);
    const snapshot = eingefroren.seasonState.apronLinesSnapshot;

    expect(snapshot?.seasonId).toBe("season-2");
    expect(snapshot?.medianSalary).toBeCloseTo(80, 1);
    expect(snapshot?.line2).toBeCloseTo(100, 1);
    // Der Herkunftsvermerk: ohne ihn wäre ein Alt-Build-Snapshot nicht von einem gültigen zu
    // unterscheiden (genau so saß Chris' veralteter Stand fest).
    expect(snapshot?.frozenAtEvent).toBe("buy_window_close");
  });

  it("sobald die neue Saison gespielt ist, hält ihr eigener Snapshot — nicht der der Vorsaison", () => {
    const state = baueSpielstand({
      seasonId: "season-2",
      gehaelterProTeam: SAISON_2_GEHAELTER,
      gespielteSaisons: ["season-1"],
      snapshot: SAISON_1_SNAPSHOT,
    });
    const eingefroren = ensureSeasonApronLinesFrozen(state);

    // Erster Spieltag der Season 2 wird gewertet; danach steigen die Gehälter weiter.
    const gespielt = {
      ...eingefroren,
      rosters: (eingefroren.rosters as Array<{ salary: number }>).map((entry) => ({ ...entry, salary: 120 })),
      seasonState: {
        ...eingefroren.seasonState,
        matchdayResults: [
          ...(eingefroren.seasonState.matchdayResults ?? []),
          { id: "season-2-result-1", seasonId: "season-2", matchdayId: "season-2-matchday-1" },
        ],
      },
    } as GameState;

    const linien = resolveSeasonApronLines(gespielt);
    // Eingerastet auf dem Season-2-Stand (Median 80), nicht auf 120 nachgezogen und nicht Season 1.
    expect(linien.medianSalary).toBeCloseTo(80, 1);
    expect(ensureSeasonApronLinesFrozen(gespielt)).toBe(gespielt);
  });
});
