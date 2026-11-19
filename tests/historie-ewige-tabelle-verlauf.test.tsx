/**
 * FIX-NACHWEIS `lcmgxx` („Ewige Tabelle: Entwicklung von Season zu Season, Grafik fuer ALLE Teams, eigenes Team
 * hervorgehoben"), uebernommen auf die neue Historie (18.11.). Der alte Test (`ewige-tabelle-saisonverlauf`) pruefte
 * `AllTimeLeagueChart`; die Grafik ist in `HistorieLinien` (Karte „Entwicklung") und die Verlaufskacheln je Saison
 * aufgegangen. Gerendert, nicht am Quelltext gelesen.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import HistorieLinien from "@/components/foundation/historie/HistorieLinien";
import { baueEwigZeilen } from "@/components/foundation/historie/HistorieEwigeTabelle";
import type { AllTimeTableModel, AllTimeTableRow } from "@/lib/foundation/all-time-table";

function zeile(teamId: string, ranks: Array<number | null>, tier = "liga1"): AllTimeTableRow {
  return {
    teamId,
    teamCode: teamId,
    teamName: teamId,
    seasons: ranks.map((rank, i) => ({
      seasonId: `season-${i + 1}`,
      seasonLabel: `Season ${i + 1}`,
      isLive: false,
      rank,
      leagueTier: tier,
      points: rank == null ? null : 100 - rank,
      marketValue: rank == null ? null : 200 + i,
      cash: null,
    })),
    cumulativePoints: 0,
    avgRank: null,
    bestRank: null,
    titles: 0,
    titlesLiga2: 0,
    promotions: 0,
    relegations: 0,
    medals: { gold: 0, silver: 0, bronze: 0, top5: 0, top10: 0 },
    mwNow: null,
    mwPeak: null,
    mwFirst: null,
    mwGrowthAbs: null,
    mwGrowthPct: null,
    cashPeak: null,
    cashNow: null,
    allTimeRank: 1,
  };
}

describe("Historie · Entwicklung je Saison (Fix-Nachweis lcmgxx)", () => {
  const labels = ["S1", "S2", "S3"];

  it("die Grafik zeichnet eine Linie je Team, die hervorgehobene (erste) liegt zuletzt im Markup", () => {
    const html = renderToStaticMarkup(
      <HistorieLinien
        saisonLabels={labels}
        serien={[
          { id: "eigen", farbe: "#f0c35a", dick: true, werte: [3, 2, 1] },
          { id: "a", farbe: "#45B0C9", werte: [5, 6, 7] },
          { id: "b", farbe: "#c9a7ff", werte: [9, 8, 7] },
        ]}
      />,
    );
    expect(html.match(/<path /g)).toHaveLength(3);
    expect(html.lastIndexOf("#f0c35a")).toBeGreaterThan(html.lastIndexOf("#45B0C9"));
  });

  it("beim Platz zeigt der bessere Platz nach OBEN (Achse gedreht gegenueber Werten)", () => {
    const yVon = (html: string) => Number(/M[\d.]+ ([\d.]+)L/.exec(html)![1]);
    const platz = renderToStaticMarkup(<HistorieLinien saisonLabels={["S1", "S2"]} platz serien={[{ id: "x", farbe: "#fff", werte: [1, 1] }]} />);
    const punkte = renderToStaticMarkup(<HistorieLinien saisonLabels={["S1", "S2"]} serien={[{ id: "x", farbe: "#fff", werte: [10, 20] }]} />);
    // Platz 1 steht ganz oben (kleines y); beim Wert 10 von 10..20 steht er unten (grosses y).
    expect(yVon(platz)).toBeLessThan(40);
    expect(yVon(punkte)).toBeGreaterThan(100);
  });

  it("eine nicht gespielte Saison ist eine Luecke, keine Null", () => {
    const html = renderToStaticMarkup(
      <HistorieLinien saisonLabels={labels} serien={[{ id: "x", farbe: "#fff", dick: true, werte: [10, null, 12] }]} />,
    );
    expect(html.match(/<circle /g)).toHaveLength(2);
  });

  it("die Verlaufswerte je Saison der Ewigen Tabelle kommen je Team als Folge, fehlende Saisons als null", () => {
    const model = {
      rows: [zeile("A", [1, null, 3]), zeile("B", [20, 2, 3], "liga2")],
    } as unknown as AllTimeTableModel;
    const [a, b] = baueEwigZeilen(model);
    expect(a!.saisons).toBe(3);
    expect(a!.row.seasons.map((s) => s.rank)).toEqual([1, null, 3]);
    expect(b!.liga).toBe(2);
    expect(b!.best).toBeNull(); // Modell traegt bestRank aus dem Aufbau, nicht aus dem Test-Datensatz
  });
});
