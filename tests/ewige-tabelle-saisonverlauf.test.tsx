/**
 * CHRIS (wörtlich, `lcmgxx`, „Team · Ewige Tabelle"):
 *
 *   „In der ewigen Tabelle soll die Entwicklung gezeigt werden von Season zu season mit Marktwert
 *    und Cash in der Tabelle, nicht nur der beste und der aktuelle Wert
 *
 *    und darunter soll eine Grafik für ALLE teams in einem sein wo man so die changes sehen kann
 *    und ein team hervorgehoben wird wenn man es anklickt - und mein eigenes standardmäßig das
 *    hervorgehobene ist!"
 *
 * Drei Zusagen, drei Prüfblöcke:
 *   1. Spalten je Saison (MW und Cash) statt nur „bester" und „aktueller" Wert.
 *   2. EINE Grafik über alle Teams — nicht 32 einzelne Kärtchen.
 *   3. Genau eine Linie ist hervorgehoben, und ohne Klick ist es das eigene Team.
 *
 * Geprüft wird gerendert (`renderToStaticMarkup`), nicht am Quelltext: ein Zeichenketten-Test
 * bliebe grün, wenn jemand die Linien anders verschachtelt, und rot bei einer Kommentaränderung.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import AllTimeLeagueChart from "@/app/foundation/all-time-table-v2/AllTimeLeagueChart";
import type { AllTimeTableRow } from "@/lib/foundation/all-time-table";
import { baueSaisonSpalten, getSaisonWert, parseSaisonSpalte } from "@/lib/foundation/all-time-season-columns";

function saison(
  seasonId: string,
  label: string,
  werte: { rank?: number | null; points?: number | null; marketValue?: number | null; cash?: number | null },
) {
  return {
    seasonId,
    seasonLabel: label,
    isLive: false,
    rank: werte.rank ?? null,
    points: werte.points ?? null,
    marketValue: werte.marketValue ?? null,
    cash: werte.cash ?? null,
  };
}

function zeile(teamId: string, teamCode: string, seasons: AllTimeTableRow["seasons"]): AllTimeTableRow {
  return {
    allTimeRank: 1,
    teamId,
    teamCode,
    teamName: `${teamCode} Team`,
    seasons,
    cumulativePoints: 0,
    avgPoints: null,
    bestRank: null,
    avgRank: null,
    medals: { gold: 0, silver: 0, bronze: 0 },
    mwFirst: null,
    mwNow: null,
    mwPeak: null,
    mwGrowthPct: null,
    cashNow: null,
    cashPeak: null,
  } as unknown as AllTimeTableRow;
}

/**
 * Drei Teams über drei Saisons. Die Werte sind bewusst so gewählt, dass sich MW und Cash
 * unterscheiden und ein Team eine Saison AUSLÄSST — daran hängt die Zusage „fehlt heißt fehlt",
 * nicht „ist null".
 */
const ZEILEN: AllTimeTableRow[] = [
  zeile("A", "A-A", [
    saison("season-1", "Season 1", { rank: 3, points: 40, marketValue: 100, cash: 10 }),
    saison("season-2", "Season 2", { rank: 1, points: 60, marketValue: 140, cash: 25 }),
    saison("season-3", "Season 3", { rank: 2, points: 55, marketValue: 130, cash: 18 }),
  ]),
  zeile("B", "B-B", [
    saison("season-1", "Season 1", { rank: 1, points: 70, marketValue: 160, cash: 40 }),
    saison("season-2", "Season 2", { rank: 4, points: 30, marketValue: 90, cash: 5 }),
    saison("season-3", "Season 3", { rank: 3, points: 45, marketValue: 110, cash: 12 }),
  ]),
  // C hat Saison 2 nicht gespielt.
  zeile("C", "C-C", [
    saison("season-1", "Season 1", { rank: 2, points: 50, marketValue: 120, cash: 20 }),
    saison("season-3", "Season 3", { rank: 1, points: 65, marketValue: 150, cash: 30 }),
  ]),
];

describe("Zusage 1: die Tabelle bekommt Spalten je Saison, nicht nur Bestwert und Jetztwert", () => {
  it("baut je Saison eine MW- und eine Cash-Spalte, in Saison-Reihenfolge", () => {
    const spalten = baueSaisonSpalten(ZEILEN);
    expect(spalten.map((spalte) => spalte.label)).toEqual([
      "Season 1 MW",
      "Season 1 Cash",
      "Season 2 MW",
      "Season 2 Cash",
      "Season 3 MW",
      "Season 3 Cash",
    ]);
  });

  it("die Achse ist die VEREINIGUNG aller Teams — die ausgelassene Saison fehlt niemandem", () => {
    // Würde die Achse vom ERSTEN Team genommen, ginge das gut; nimmt man sie von C, fiele
    // Saison 2 für alle weg. Deshalb hier bewusst mit C an erster Stelle geprüft.
    const spalten = baueSaisonSpalten([ZEILEN[2], ZEILEN[0], ZEILEN[1]]);
    expect(spalten).toHaveLength(6);
    expect(spalten.some((spalte) => spalte.label === "Season 2 MW")).toBe(true);
  });

  it("der Schlüssel trägt Saison und Größe — Sortierung und Zelle meinen dieselbe Spalte", () => {
    const spalten = baueSaisonSpalten(ZEILEN);
    const zerlegt = spalten.map((spalte) => parseSaisonSpalte(spalte.key));
    expect(zerlegt[0]).toEqual({ seasonId: "season-1", metrik: "mw" });
    expect(zerlegt[1]).toEqual({ seasonId: "season-1", metrik: "cash" });
    // Eine Saison-ID mit Doppelpunkt darf den Schlüssel nicht zerreißen — getrennt wird von rechts.
    expect(parseSaisonSpalte("saison:liga:2026:cash")).toEqual({ seasonId: "liga:2026", metrik: "cash" });
    // Und alles, was keine Saisonspalte ist, bleibt es auch.
    expect(parseSaisonSpalte("cumulativePoints")).toBeNull();
    expect(parseSaisonSpalte("saison:season-1:gold")).toBeNull();
  });

  it("liest je Saison den richtigen Wert — und „nicht dabei\" ist kein Kontostand von null", () => {
    expect(getSaisonWert(ZEILEN[0], "season-2", "mw")).toBe(140);
    expect(getSaisonWert(ZEILEN[0], "season-2", "cash")).toBe(25);
    // C hat Saison 2 ausgelassen: null, nicht 0. Die Zelle zeigt dafür „—".
    expect(getSaisonWert(ZEILEN[2], "season-2", "mw")).toBeNull();
    expect(getSaisonWert(ZEILEN[2], "season-2", "cash")).toBeNull();
  });
});

describe("Zusage 2 und 3: eine Grafik über alle Teams, genau eine Linie hervorgehoben", () => {
  const markup = (highlightedTeamId: string | null) =>
    renderToStaticMarkup(
      <AllTimeLeagueChart rows={ZEILEN} metric="mw" highlightedTeamId={highlightedTeamId} onHighlight={() => {}} />,
    );

  it("zeichnet ALLE Teams in EIN Bild — drei Linien in einem svg", () => {
    const html = markup("A");
    expect(html.match(/<svg/g) ?? []).toHaveLength(1);
    expect(html.match(/<polyline/g) ?? []).toHaveLength(3);
  });

  it("genau eine Linie ist hervorgehoben, und sie wird ZULETZT gezeichnet", () => {
    const html = markup("B");
    expect(html.match(/is-hervorgehoben"[^>]*points=/g) ?? []).toHaveLength(1);
    // „Zuletzt" ist hier kein Stilfrage, sondern der einzige Grund, warum die Linie über dem Feld
    // liegt: SVG kennt kein z-index, die Reihenfolge im Markup IST die Stapelung.
    const letzteBlasse = html.lastIndexOf('class="nl-alltime-liga-linie"');
    const hervorgehobene = html.indexOf("nl-alltime-liga-linie is-hervorgehoben");
    expect(hervorgehobene).toBeGreaterThan(letzteBlasse);
  });

  it("ohne Klick ist das übergebene eigene Team hervorgehoben", () => {
    // Die Vorgabe setzt die Tabelle (`hervorgehobenesTeam ?? selectedTeamId`); hier wird geprüft,
    // dass die Grafik genau diese Vorgabe umsetzt und nicht selbst eine zweite Meinung hat.
    expect(markup("C")).toContain("Liga-Verlauf, hervorgehoben: C-C Team");
    expect(markup("A")).toContain("Liga-Verlauf, hervorgehoben: A-A Team");
  });

  it("jedes Team bekommt einen Knopf, und nur der hervorgehobene ist gedrückt", () => {
    const html = markup("B");
    expect(html.match(/aria-pressed="true"/g) ?? []).toHaveLength(1);
    expect(html.match(/aria-pressed="false"/g) ?? []).toHaveLength(2);
  });

  it("beim Rang zeigt der bessere Platz nach OBEN — sonst läse sich ein Aufstieg als Absturz", () => {
    const html = renderToStaticMarkup(
      <AllTimeLeagueChart rows={ZEILEN} metric="rank" highlightedTeamId="A" onHighlight={() => {}} />,
    );
    // A steht in Saison 1 auf Rang 3 und in Saison 2 auf Rang 1 — der zweite Punkt muss eine
    // KLEINERE y-Koordinate haben (in SVG ist oben klein).
    const punkte = /nl-alltime-liga-linie is-hervorgehoben" points="([^"]+)"/.exec(html)?.[1] ?? "";
    const y = punkte.split(" ").map((paar) => Number(paar.split(",")[1]));
    expect(y).toHaveLength(3);
    expect(y[1]).toBeLessThan(y[0]);
    expect(html).toContain("kleiner ist besser");
  });

  it("eine einzelne Saison ist kein Verlauf — statt eines leeren Bildes steht der Grund da", () => {
    // An vier der fünf Live-Abbilder ist genau das der Zustand (nur `1hf25q` trägt zwei Saisons).
    // Eine `polyline` mit einem Punkt zeichnet nichts; das sähe aus wie ein Fehler.
    const eineSaison = ZEILEN.map((row) => ({ ...row, seasons: row.seasons.slice(0, 1) }));
    const html = renderToStaticMarkup(
      <AllTimeLeagueChart rows={eineSaison} metric="mw" highlightedTeamId="A" onHighlight={() => {}} />,
    );
    expect(html).toContain("nl-alltime-liga-zu-kurz");
    expect(html).toContain("mindestens zwei Saisons");
    expect(html).not.toContain("<svg");
  });

  it("ohne jeden Wert für die Kennzahl bleibt ein Hinweis statt einer erfundenen Linie", () => {
    const ohneCash = ZEILEN.map((row) => ({
      ...row,
      seasons: row.seasons.map((season) => ({ ...season, cash: null })),
    }));
    const html = renderToStaticMarkup(
      <AllTimeLeagueChart rows={ohneCash} metric="cash" highlightedTeamId="A" onHighlight={() => {}} />,
    );
    expect(html).toContain("noch kein Verlauf");
    expect(html).not.toContain("<svg");
  });
});

describe("Die neuen CSS-Klassen existieren wirklich", () => {
  it("jede Klasse der Grafik steht in globals.css", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
    for (const klasse of [
      "nl-alltime-liga",
      "nl-alltime-liga-spanne",
      "nl-alltime-liga-svg",
      "nl-alltime-liga-linie",
      "nl-alltime-liga-punkt",
      "nl-alltime-liga-achse",
      "nl-alltime-liga-legende",
      "nl-alltime-liga-chip",
      "nl-alltime-liga-hinweis",
    ]) {
      expect(css).toMatch(new RegExp(`\\.${klasse}[\\s.,:{[>)]`));
    }
  });
});
