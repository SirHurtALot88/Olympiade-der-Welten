import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { StandingRecord } from "@/lib/data/olyDataTypes";
import {
  buildStandingsMatchdayRankDelta,
  buildStandingsMatchdayRankPair,
} from "@/lib/foundation/season-standings-matchday-rank-delta";

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

/**
 * Gemeldet von Chris (Saisonstand, Saison 1, Spieltag 4/5): "im Saisonstand
 * immer noch keine Rang-Änderung zur letzten Wertung, nur der aktuelle Rang" —
 * und dazu ein Team, das mit Tagesplatz 2 und 20,8 Punkten angeblich von 15 auf
 * 15 stehen blieb.
 *
 * Ursache: die Rang-Spalte liest `fieldRaceRankDelta` aus dem Feld-Rennen-Ledger.
 * Auf dem Saisonstand ist der aber leer — `useSeasonDerivations` läuft dort nicht
 * (`shouldLoadSeasonDerivations` deckt nur die Teams-Ansicht ab) und liefert
 * `EMPTY_DERIVATIONS`; und selbst ein Nachbau fände nichts, weil der kompakte
 * Foundation-Payload `matchdayResults` auf den AKTIVEN Spieltag beschneidet
 * (`compactFoundationInitialGameState`). Die Rückfallebene `rankDiff` wird erst
 * beim Saisonabschluss geschrieben. Also: die ganze Saison über eine leere Zelle.
 *
 * `seasonState.standings` überlebt den kompakten Payload dagegen vollständig und
 * trägt in `matchdayBaselinePoints` den Punktestand VOR der letzten Wertung.
 * Genau daraus wird hier die Bewegung gerechnet.
 */
describe("Saisonstand: Rang-Bewegung aus dem Punktestand vor der letzten Wertung", () => {
  const teams = [
    { teamId: "A", teamName: "Alpha" },
    { teamId: "B", teamName: "Beta" },
    { teamId: "C", teamName: "Gamma" },
  ];

  const standing = (points: number, baselinePoints: number | null): StandingRecord =>
    ({
      points,
      ...(baselinePoints == null
        ? {}
        : { matchdayBaselinePoints: baselinePoints, matchdayBaselineId: "matchday-4" }),
    }) as StandingRecord;

  it("rechnet Auf- und Absteiger des letzten Spieltags aus der Baseline", () => {
    // Vor Spieltag 4: Alpha 100 (1.), Beta 90 (2.), Gamma 80 (3.).
    // Spieltag 4: Gamma holt 30 Punkte und zieht an beiden vorbei.
    const deltas = buildStandingsMatchdayRankDelta(teams, {
      A: standing(100, 100),
      B: standing(90, 90),
      C: standing(110, 80),
    });

    expect(deltas.get("C")).toBe(2); // 3. → 1., zwei Plätze gutgemacht
    expect(deltas.get("A")).toBe(-1); // 1. → 2.
    expect(deltas.get("B")).toBe(-1); // 2. → 3.
  });

  it("zeigt 0 statt null, wenn ein Team trotz Punkten den Platz hält", () => {
    // Genau der gemeldete Fall: ein Team punktet stark, bleibt aber auf seinem
    // Platz. "Keine Bewegung" muss als Zahl herauskommen — die Anzeige macht
    // daraus ein sichtbares "±0". Käme hier null, sähe der Spieler wieder eine
    // leere Zelle und könnte nicht unterscheiden, ob sich nichts bewegt hat oder
    // ob schlicht keine Daten da sind.
    const deltas = buildStandingsMatchdayRankDelta(teams, {
      A: standing(120, 100),
      B: standing(100, 90),
      C: standing(80, 80),
    });

    expect(deltas.get("A")).toBe(0);
    expect(deltas.get("B")).toBe(0);
    expect(deltas.get("C")).toBe(0);
  });

  it("erfindet keine Bewegung, solange noch nichts gewertet wurde", () => {
    // Ohne Baseline gibt es keinen "Stand davor". Ein ±0 wäre hier eine Behauptung
    // über einen Spieltag, den es noch gar nicht gab.
    const deltas = buildStandingsMatchdayRankDelta(teams, {
      A: standing(0, null),
      B: standing(0, null),
      C: standing(0, null),
    });

    expect(deltas.get("A")).toBeNull();
    expect(deltas.get("B")).toBeNull();
    expect(deltas.get("C")).toBeNull();
  });

  it("löst Gleichstände vorher wie nachher gleich auf", () => {
    // Vorher-Rang und Nachher-Rang entstehen nach derselben Regel (Punkte, dann
    // Name). Sonst erzeugte allein ein anders aufgelöster Gleichstand eine
    // Bewegung, die nie stattgefunden hat.
    const deltas = buildStandingsMatchdayRankDelta(teams, {
      A: standing(50, 50),
      B: standing(50, 50),
      C: standing(50, 50),
    });

    expect([...deltas.values()]).toEqual([0, 0, 0]);
  });

  it("behandelt ein nachträglich dazugekommenes Team als unbewegt", () => {
    // Ohne eigene Baseline zählt der aktuelle Stand auch als Stand davor — sonst
    // stünde beim ersten Auftauchen ein Sprung, den das Team nie gemacht hat.
    const deltas = buildStandingsMatchdayRankDelta(teams, {
      A: standing(100, 100),
      B: standing(90, 90),
      C: standing(80, null),
    });

    expect(deltas.get("C")).toBe(0);
  });
});

/**
 * GEMELDET VON CHRIS (Spieltag 4, Spieltags-Wertung): nach der Buchung stand in
 * der S-Rang-Spalte bei allen 32 Teams „7 → 7", „22 → 22" — der Vorher-Wert kam
 * aus derselben Quelle wie der Nachher-Wert (`standings.rank` trägt nach der
 * Buchung bereits den NEUEN Stand). Der echte Ausgangsrang entsteht aus der
 * Baseline; die Spieltags-Wertung braucht dafür neben dem Δ auch die beiden
 * Ränge selbst. `buildStandingsMatchdayRankPair` liefert sie aus DERSELBEN
 * Rechnung wie das Δ des Saisonstands — eine Quelle pro Größe, sonst
 * widersprechen sich die beiden Seiten wieder.
 */
describe("Spieltags-Wertung: Vorher-/Nachher-Rang aus derselben Baseline-Rechnung", () => {
  const teams = [
    { teamId: "A", teamName: "Alpha" },
    { teamId: "B", teamName: "Beta" },
    { teamId: "C", teamName: "Gamma" },
  ];

  const standing = (points: number, baselinePoints: number | null): StandingRecord =>
    ({
      points,
      ...(baselinePoints == null
        ? {}
        : { matchdayBaselinePoints: baselinePoints, matchdayBaselineId: "matchday-4" }),
    }) as StandingRecord;

  it("liefert Ausgangs- und Zielrang, nicht nur die Bewegung", () => {
    // Vor Spieltag 4: Alpha 100 (1.), Beta 90 (2.), Gamma 80 (3.).
    // Spieltag 4: Gamma zieht mit 110 an beiden vorbei.
    const pairs = buildStandingsMatchdayRankPair(teams, {
      A: standing(100, 100),
      B: standing(90, 90),
      C: standing(110, 80),
    });

    expect(pairs.get("C")).toEqual({ previousRank: 3, currentRank: 1, delta: 2 });
    expect(pairs.get("A")).toEqual({ previousRank: 1, currentRank: 2, delta: -1 });
    expect(pairs.get("B")).toEqual({ previousRank: 2, currentRank: 3, delta: -1 });
  });

  it("degeneriert NICHT zu vorher == nachher, obwohl `points` schon den neuen Stand trägt", () => {
    // Genau der gemeldete Fall: Buchung durch, `points` inkrementiert. Der
    // Vorher-Rang MUSS aus der Baseline kommen — sonst steht überall „X → X".
    const pairs = buildStandingsMatchdayRankPair(teams, {
      A: standing(100, 100),
      B: standing(90, 90),
      C: standing(110, 80),
    });
    const bewegte = [...pairs.values()].filter((pair) => pair != null && pair.delta !== 0);
    expect(bewegte.length).toBeGreaterThan(0);
    // Ränge sind ein Nullsummenspiel.
    expect([...pairs.values()].reduce((summe, pair) => summe + (pair?.delta ?? 0), 0)).toBe(0);
  });

  it("Δ-Funktion und Paar-Funktion sind dieselbe Rechnung", () => {
    const standings = {
      A: standing(100, 100),
      B: standing(90, 90),
      C: standing(110, 80),
    };
    const deltas = buildStandingsMatchdayRankDelta(teams, standings);
    const pairs = buildStandingsMatchdayRankPair(teams, standings);
    for (const team of teams) {
      expect(deltas.get(team.teamId)).toBe(pairs.get(team.teamId)?.delta ?? null);
    }
  });

  it("liefert null ohne jede Baseline — kein erfundener Ausgangsrang", () => {
    const pairs = buildStandingsMatchdayRankPair(teams, {
      A: standing(0, null),
      B: standing(0, null),
      C: standing(0, null),
    });
    expect([...pairs.values()]).toEqual([null, null, null]);
  });
});

/**
 * Die Verdrahtung: die Saisonstand-Zeilen müssen die Baseline-Bewegung wirklich
 * benutzen. Der Ledger bleibt vorne (er kennt den ganzen Saisonverlauf), die
 * Standings-Quelle ist die Rückfallebene — vorher fiel die Zelle direkt auf
 * `null` durch.
 */
describe("Saisonstand-Zeilen: Rückfallebene ist verdrahtet", () => {
  const scope = read("lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx");

  it("füllt fieldRaceRankDelta über den gemeinsamen Auflöser", () => {
    expect(scope).toContain("buildStandingsMatchdayRankDelta");
    expect(scope).toContain("const resolveMatchdayRankDelta =");
    expect(scope).toContain("fieldRaceRankDelta: isViewingArchivedSeason ? null : resolveMatchdayRankDelta(row.teamId)");
  });

  it("fragt den Ledger vor der Standings-Baseline", () => {
    const resolver = scope.slice(
      scope.indexOf("const resolveMatchdayRankDelta ="),
      scope.indexOf("const homeFieldRaceRankMovement"),
    );
    expect(resolver.indexOf("fieldRaceRankDeltaByTeamId")).toBeLessThan(
      resolver.indexOf("standingsMatchdayRankDeltaByTeamId"),
    );
  });
});
