/**
 * GEMELDET: „bitte noch anpassen dass es im modernen velo design kommt das sieht noch so
 * altbacken aus mit vertragsauflösung."
 *
 * Die Karte war ein `panel` mit `<h3>` und drei Textspalten — dieselbe Optik wie vor dem Neuen
 * Look, mitten zwischen lauter NlCards. Jetzt trägt sie die Hülle der übrigen Ansicht und zeigt
 * die neue Regel als Bild statt als zwei Zahlen nebeneinander.
 *
 * Der Test hält vor allem das fest, was beim Umbau still verlorengeht: dass die Klassen, auf die
 * das CSS zielt, auch wirklich existieren. Genau daran ist der erste Anlauf gescheitert —
 * `nl-chip` gibt es nicht, die Angaben klebten als blanker Text aneinander, und niemand hätte es
 * an einem grünen Test gemerkt.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), "utf8");

const PANEL = quelle("app/foundation/teams-v2/FoundationTeamsDetailPanel.tsx");
const CSS = quelle("app/globals.css");
const METER = quelle("components/foundation/velo-ui/VeloSplitMeter.tsx");
const KATALOG = quelle("components/foundation/velo-ui/index.ts");

/** Der Abschnitt zwischen Karte und schließendem Tag — sonst prüft man die halbe Datei mit. */
const KARTE = PANEL.slice(
  PANEL.indexOf('className="teams-dissolution-card"'),
  PANEL.indexOf('<section className="panel team-focus-panel teams-primary-roster-panel"'),
);

describe("Vertragsauflösung trägt die Hülle der übrigen Ansicht", () => {
  it("ist eine NlCard mit Eyebrow und Titel statt eines panel-Blocks", () => {
    expect(KARTE).toContain('eyebrow="Kader · Saisonende"');
    expect(KARTE).not.toContain('className="panel team-focus-panel"');
    expect(KARTE).not.toContain("<h3>Vertragsauflösung");
  });

  it("nennt die Zahl der Anfragen im Titel", () => {
    expect(KARTE).toContain("teams-dissolution-count");
  });
});

describe("Der Verzicht wird gezeigt, nicht nur beziffert", () => {
  it("rendert den geteilten Balken je Angebot mit offenem Buyout", () => {
    expect(KARTE).toContain("<VeloSplitMeter");
    expect(KARTE).toContain("share={offer.waiverShare ?? 0}");
  });

  it("sagt bei auslaufendem Vertrag ehrlich, dass es nichts zu teilen gibt", () => {
    expect(KARTE).toContain("Vertrag läuft aus — kein offener Buyout.");
  });

  it("stellt den Netto-Betrag voran, nicht den Bruttopreis", () => {
    const netto = KARTE.indexOf("teams-dissolution-net");
    const brutto = KARTE.indexOf("Verkaufspreis");
    expect(netto).toBeGreaterThan(0);
    expect(netto).toBeLessThan(brutto);
  });
});

describe("Die Klassen, auf die das CSS zielt, gibt es auch", () => {
  const klassen = [
    "teams-dissolution-card",
    "teams-dissolution-count",
    "teams-dissolution-intro",
    "teams-dissolution-item",
    "teams-dissolution-portrait",
    "teams-dissolution-chip",
    "teams-dissolution-split",
    "teams-dissolution-net",
    "velo-split-meter",
    "velo-split-meter-track",
    "velo-split-meter-lead",
    "velo-split-meter-legend",
  ];

  it.each(klassen)("%s ist in globals.css definiert", (klasse) => {
    expect(CSS).toMatch(new RegExp(`\\.(is-new-look )?\\.?${klasse}[\\s.,:{]`));
  });

  it("greift nicht mehr nach dem nicht existierenden nl-chip", () => {
    expect(KARTE).not.toContain('"nl-chip');
  });
});

describe("VeloSplitMeter ist eine Katalog-Komponente, kein Einzelfall", () => {
  it("steht im Velo-Katalog mit einer Wann-benutzen-Zeile", () => {
    expect(KATALOG).toContain("VeloSplitMeter");
    expect(KATALOG).toContain("zwei Teile zerlegt");
  });

  it("rundet den Balkenanteil, statt Fließkomma-Reste ins Markup zu schreiben", () => {
    expect(METER).toContain("Math.round(anteil * 10000) / 100");
  });

  it("hält den Anteil in 0…1, auch bei kaputten Eingaben", () => {
    expect(METER).toContain("Math.min(1, Math.max(0, share))");
  });
});
