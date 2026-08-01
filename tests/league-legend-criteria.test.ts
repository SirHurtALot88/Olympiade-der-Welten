/**
 * GEWUENSCHT: „Legendäre spieler definieren."
 *
 * Vorher hiess „legendaer" schlicht: steht in den Top 25 der Karriere-PPs. Das ist eine
 * SORTIERUNG, keine Definition — in einer Liste der besten 25 sind immer 25 Spieler, auch am
 * ersten Spieltag der ersten Saison. Ein Status, den man weder verfehlen noch verlieren kann,
 * ist keiner.
 *
 * Legende ist jetzt ein verliehener Status: Dauer (>= 3 Saisons) ist PFLICHT, dazu mindestens
 * zwei von vier weiteren. Am echten Spielstand (Saison 1) ist die Folge messbar:
 *
 *   Legenden: 0   Anwaerter: 10
 *   Gronn     4/5   erfuellt: Volumen, Dominanz, Auszeichnung, Einzigartigkeit — es fehlt: Dauer
 *   Grok'Na   3/5   erfuellt: Dominanz, Auszeichnung, Einzigartigkeit
 *
 * Genau so soll es sein: in Saison 1 gibt es keine Legenden, aber man sieht, wer auf dem Weg
 * ist — und woran es noch fehlt.
 */
import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import type { PlayerCareerLeaderRow } from "@/lib/foundation/league-records-hall-of-fame";
import {
  LEGEND_MIN_SEASONS,
  LEGEND_RULE,
  buildLeagueLegends,
} from "@/lib/foundation/league-legend-criteria";

function karriere(overrides: Partial<PlayerCareerLeaderRow> & { playerId: string }): PlayerCareerLeaderRow {
  return {
    playerName: `Spieler ${overrides.playerId}`,
    teamName: "Team A",
    teams: ["Team A"],
    appearances: 10,
    totalPps: 10,
    seasonsPlayed: 1,
    mvpTotal: 0,
    ...overrides,
  };
}

/** Minimalzustand: der Legenden-Resolver liest daraus nur die Saisonnummer und die Awards. */
function spielstand(seasonId = "season-1"): GameState {
  return {
    season: { id: seasonId, name: seasonId, year: 1, currentMatchday: 1, matchdayIds: [] },
    teams: [],
    players: [],
    rosters: [],
    disciplines: [],
    matchdayState: { matchdayId: "md-1", status: "resolved" },
    seasonState: {
      seasonId,
      schedule: [],
      standings: {},
      seasonSnapshots: [],
      matchdayResults: [],
      disciplineResults: [],
      playerDisciplinePerformances: [],
      lineupDrafts: [],
    },
    transferHistory: [],
  } as never;
}

describe("Legende ist ein verliehener Status, keine Sortierung", () => {
  it("in Saison 1 gibt es KEINE Legenden — Dauer ist Pflicht", () => {
    // Der Kern der Definition. Ohne die Pflicht waere jeder Saison-1-Leader sofort Legende.
    const ergebnis = buildLeagueLegends(spielstand(), [
      karriere({ playerId: "star", totalPps: 999, mvpTotal: 9, seasonsPlayed: 1 }),
    ]);
    expect(ergebnis.legends).toHaveLength(0);
    expect(ergebnis.anwaerter.length).toBeGreaterThan(0);
  });

  it("der Reiter bleibt trotzdem nicht leer — er zeigt Anwaerter mit Fortschritt", () => {
    const ergebnis = buildLeagueLegends(spielstand(), [karriere({ playerId: "a", totalPps: 30 })]);
    const anwaerter = ergebnis.anwaerter[0];
    expect(anwaerter).toBeTruthy();
    expect(anwaerter.criteria).toHaveLength(5);
    // Jedes Kriterium sagt, WO man steht — auch das unerfuellte.
    for (const kriterium of anwaerter.criteria) {
      expect(kriterium.stand.length, `${kriterium.id} ohne Stand`).toBeGreaterThan(0);
      expect(kriterium.erklaerung.length, `${kriterium.id} ohne Erklaerung`).toBeGreaterThan(10);
    }
  });

  it("nennt die Dauer als das, was fehlt", () => {
    const ergebnis = buildLeagueLegends(spielstand(), [karriere({ playerId: "a", seasonsPlayed: 1 })]);
    const dauer = ergebnis.anwaerter[0]?.criteria.find((kriterium) => kriterium.id === "dauer");
    expect(dauer?.erfuellt).toBe(false);
    expect(dauer?.stand).toBe(`1 von ${LEGEND_MIN_SEASONS} Saisons`);
  });

  it("Dauer ALLEIN reicht nicht — sonst waere jeder Dauerlaeufer Legende", () => {
    const ergebnis = buildLeagueLegends(spielstand("season-4"), [
      // Lange dabei, aber ohne Punkte, ohne Award, ohne MVP.
      karriere({ playerId: "grau", seasonsPlayed: 5, totalPps: 0, mvpTotal: 0 }),
      karriere({ playerId: "star", seasonsPlayed: 5, totalPps: 500, mvpTotal: 3 }),
    ]);
    expect(ergebnis.legends.some((legende) => legende.playerId === "grau")).toBe(false);
  });

  it("Dauer PLUS zwei weitere macht die Legende", () => {
    // "star" fuehrt die Karriereliste an (Dominanz), liegt im besten Prozent (Volumen) und ist
    // lange dabei — drei Kriterien, zwei davon zusaetzlich.
    const ergebnis = buildLeagueLegends(spielstand("season-4"), [
      karriere({ playerId: "star", seasonsPlayed: 4, totalPps: 500, mvpTotal: 3 }),
      ...Array.from({ length: 40 }, (_, index) =>
        karriere({ playerId: `mit${index}`, seasonsPlayed: 4, totalPps: 5 }),
      ),
    ]);
    const star = ergebnis.legends.find((legende) => legende.playerId === "star");
    expect(star).toBeTruthy();
    expect(star!.criteria.filter((kriterium) => kriterium.erfuellt && kriterium.id !== "dauer").length).toBeGreaterThanOrEqual(
      LEGEND_RULE.zusaetzlichMindestens,
    );
  });

  it("die Volumen-Schwelle ist RELATIV — sie wandert mit der Liga", () => {
    // Derselbe Punktwert ist in einer schwachen Liga Spitze und in einer starken Mittelmass.
    // Ein Festwert waere beim naechsten Balancing falsch.
    // Bewusst kleine Ligen: die Anwaerter-Liste zeigt nur die besten zehn, ein Spieler auf
    // Platz 101 waere im Ergebnis gar nicht mehr zu finden — der Test pruefte dann nichts.
    const schwacheLiga = buildLeagueLegends(spielstand("season-4"), [
      karriere({ playerId: "a", totalPps: 50, seasonsPlayed: 4 }),
      ...Array.from({ length: 8 }, (_, index) => karriere({ playerId: `x${index}`, totalPps: 1, seasonsPlayed: 4 })),
    ]);
    const starkeLiga = buildLeagueLegends(spielstand("season-4"), [
      ...Array.from({ length: 8 }, (_, index) => karriere({ playerId: `y${index}`, totalPps: 500, seasonsPlayed: 4 })),
      karriere({ playerId: "a", totalPps: 50, seasonsPlayed: 4 }),
    ]);

    const volumenVon = (ergebnis: ReturnType<typeof buildLeagueLegends>) =>
      [...ergebnis.legends, ...ergebnis.anwaerter]
        .find((kandidat) => kandidat.playerId === "a")
        ?.criteria.find((kriterium) => kriterium.id === "volumen")?.erfuellt;

    expect(volumenVon(schwacheLiga)).toBe(true);
    expect(volumenVon(starkeLiga)).toBe(false);
  });

  it("sortiert Anwaerter nach NAEHE zum Status, nicht nach Punkten", () => {
    // Die Frage des Reiters ist „wer ist auf dem Weg", nicht „wer hat am meisten".
    const ergebnis = buildLeagueLegends(spielstand(), [
      karriere({ playerId: "punkte", totalPps: 100, seasonsPlayed: 1, mvpTotal: 0 }),
      karriere({ playerId: "nah", totalPps: 20, seasonsPlayed: 2, mvpTotal: 5 }),
    ]);
    const naechster = ergebnis.anwaerter[0];
    expect(naechster.erfuellteAnzahl).toBeGreaterThanOrEqual(ergebnis.anwaerter[1]?.erfuellteAnzahl ?? 0);
  });

  it("sagt, ab wann der Status ueberhaupt erreichbar ist", () => {
    const ergebnis = buildLeagueLegends(spielstand("season-2"), [karriere({ playerId: "a" })]);
    expect(ergebnis.moeglichAbSaison).toBe(LEGEND_MIN_SEASONS);
    expect(ergebnis.aktuelleSaison).toBe(2);
  });
});
