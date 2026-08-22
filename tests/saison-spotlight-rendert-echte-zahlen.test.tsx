/**
 * DAS SPOTLIGHT MUSS SICH AUFBAUEN LASSEN — UND DIE ZAHLEN MÜSSEN IM MARKUP STEHEN.
 *
 * Die Ableitung ist in `tests/saison-spotlight-zeigt-nur-belegte-zahlen.test.ts` festgenagelt.
 * Hier geht es um die Karte selbst: dass sie rendert (das war der Befund aus #586 — eine neue
 * Karte, die erst beim RENDERN warf, kam ins Spiel, weil kein Test sie aufbaute), und dass die
 * gemessenen Zahlen aus `swnjlk` wirklich sichtbar werden statt in einem „—" zu verschwinden.
 *
 * Durch `renderToStaticMarkup` sammelt der Render-Wächter (`scripts/fahre-render-waechter.ts`)
 * diese Datei von selbst ein; sie läuft also im Pflicht-Job mit.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import SaisonSpotlightCard from "@/app/foundation/training-compact/SaisonSpotlightCard";
import type { SaisonSpotlightModel } from "@/lib/foundation/saison-spotlight";

/** Der gemessene Stand aus `swnjlk`, Team V-W, Saison 1 -> 2. */
function modell(ueberschreiben: Partial<SaisonSpotlightModel> = {}): SaisonSpotlightModel {
  return {
    teamId: "V-W",
    teamName: "Vigilante Wranglers",
    seasonIdFrom: "season-1",
    seasonLabelFrom: "Season 1",
    seasonIdTo: "season-2",
    seasonLabelTo: "Season 2",
    rank: 25,
    teamCount: 32,
    startRank: 30,
    rankDelta: 5,
    netSetpointsTotal: 4.7,
    classChangeCount: 1,
    marketValueGain: 0.64,
    rows: [
      {
        playerId: "lulu",
        playerName: "Lulu",
        netSetpoints: 1.6,
        bestAttribute: { attribute: "power", label: "STR", fromValue: 2, toValue: 3.2, delta: 1.2 },
        marketValueFrom: 9.84,
        marketValueTo: 9.91,
        appearances: 8,
        trainingMode: "leicht",
        classChange: { from: "Tactician", to: "Bard" },
      },
      {
        playerId: "xelara",
        playerName: "Xelara",
        netSetpoints: 0.6,
        bestAttribute: null,
        marketValueFrom: null,
        marketValueTo: null,
        appearances: null,
        trainingMode: null,
        classChange: null,
      },
    ],
    moreRowCount: 0,
    newcomers: [{ playerId: "draco", playerName: "Draco", className: "Warlord", marketValue: 32.06 }],
    leagueBestTrainer: { playerName: "Broxingar", teamName: "Pirate Crew", netSetpoints: 10.5 },
    leagueClassChangeCount: 121,
    ...ueberschreiben,
  };
}

describe("Saison-Spotlight-Karte", () => {
  it("baut sich auf, ohne zu werfen", () => {
    expect(() => renderToStaticMarkup(<SaisonSpotlightCard model={modell()} />)).not.toThrow();
  });

  it("rendert gar nichts, wenn es kein Modell gibt", () => {
    expect(renderToStaticMarkup(<SaisonSpotlightCard model={null} />)).toBe("");
  });

  it("zeigt die drei Kacheln mit den gemessenen Zahlen", () => {
    const markup = renderToStaticMarkup(<SaisonSpotlightCard model={modell()} />);
    expect(markup).toContain("+4,7");
    expect(markup).toContain("SP netto im Team");
    expect(markup).toContain("Klassenwechsel");
    // Die Kachel heisst bewusst NICHT „durch Training" — der Marktwert-Zuwachs ist im Save
    // nicht nach Herkunft zerlegt.
    expect(markup).toContain("Marktwert-Zuwachs");
    expect(markup).not.toContain("durch Training");
  });

  it("zeigt Platz, Startplatz und die gutgemachten Plaetze", () => {
    const markup = renderToStaticMarkup(<SaisonSpotlightCard model={modell()} />);
    expect(markup).toContain("Platz 25 von 32");
    expect(markup).toContain("Start als Nr. 30");
    expect(markup).toContain("5 Plätze gutgemacht");
  });

  it("schreibt den Klassenwechsel an den Namen und den Marktwert-Verlauf in die Zeile", () => {
    const markup = renderToStaticMarkup(<SaisonSpotlightCard model={modell()} />);
    expect(markup).toContain("Lulu");
    expect(markup).toContain("Bard");
    expect(markup).toContain("9,84");
    expect(markup).toContain("9,91");
    expect(markup).toContain("STR");
  });

  it("haelt eine Zeile ohne Daten aus, ohne zu werfen oder Zahlen zu erfinden", () => {
    const markup = renderToStaticMarkup(<SaisonSpotlightCard model={modell()} />);
    expect(markup).toContain("Xelara");
    expect(markup).toContain("—");
  });

  it("nennt Neuzugaenge und den Liga-Vergleich", () => {
    const markup = renderToStaticMarkup(<SaisonSpotlightCard model={modell()} />);
    expect(markup).toContain("Neu im Team (1)");
    expect(markup).toContain("Draco");
    expect(markup).toContain("Broxingar");
    expect(markup).toContain("121");
  });

  it("zaehlt die nicht gezeigten Zeilen, statt sie zu verschweigen", () => {
    const markup = renderToStaticMarkup(<SaisonSpotlightCard model={modell({ moreRowCount: 7 })} />);
    expect(markup).toContain("+ 7 weitere");
  });

  it("sagt es, wenn kein heutiger Spieler die Vorsaison hier trainiert hat", () => {
    const markup = renderToStaticMarkup(<SaisonSpotlightCard model={modell({ rows: [], moreRowCount: 0 })} />);
    expect(markup).toContain("Kein Spieler aus deinem heutigen Kader");
  });

  it("laesst die Marktwert-Kachel leer statt sie mit einer Null zu fuellen", () => {
    const markup = renderToStaticMarkup(<SaisonSpotlightCard model={modell({ marketValueGain: null })} />);
    expect(markup).toContain("Marktwert-Zuwachs");
    expect(markup).not.toContain("+0,0");
  });
});
