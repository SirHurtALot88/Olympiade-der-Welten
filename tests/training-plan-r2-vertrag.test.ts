import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { baueKaderKennzahlen, sortiereKader, type TrainingZeile } from "@/lib/training/training-modern-modell";

/**
 * Vertrag der Plan-Ansicht Runde 2 (22.11.): die Seite rechnet nichts ein zweites Mal, die Heatmap hat die geforderten Merkmale,
 * jede Tabelle ist sortierbar. Statische Pruefung der Quelle plus das Zeilenmodell.
 */

const wurzel = process.cwd();
const quelle = fs.readFileSync(path.join(wurzel, "app/foundation/training-modern/PlanR2.tsx"), "utf8");
const css = fs.readFileSync(path.join(wurzel, "app/foundation/training-modern/training-r2.css"), "utf8");
const seite = fs.readFileSync(path.join(wurzel, "app/foundation/training-modern/TrainingModern.tsx"), "utf8");

describe("Plan Runde 2: keine zweite Formel", () => {
  it("die Zahlen kommen aus der Heatmap-Rechnung und der Buchungsfunktion, nicht aus der Seite", () => {
    expect(quelle).toContain("baueZielHeatmap");
    expect(quelle).toContain("spBisSaisonende");
    expect(quelle).toContain("prognostiziereTrainingAbRueckkehr");
    expect(quelle).toContain("baueWirkungVergleich");
    // keine eigene Budget- oder Zuwachsrechnung in der Oberflaeche
    expect(quelle).not.toMatch(/setpoints\s*\*|anteil\s*\*\s*budget|SATZ\[/i);
    expect(quelle).not.toContain("Math.random");
  });

  it("die alte Plan-Ansicht ist raus, die Seite hängt die neue ein", () => {
    expect(seite).toContain('import PlanR2 from "./PlanR2"');
    expect(seite).toContain("<PlanR2");
    expect(seite).not.toContain("function PlanAnsicht");
  });
});

describe("Plan Runde 2: Heatmap und Vorlieben im Aussehen", () => {
  it("vier Bereiche als eigene Tafeln mit Klassen- und Gegenfarbe", () => {
    for (const b of ["pow", "spe", "men", "soc"]) expect(css).toContain(`.tr2 .c-${b}`);
    expect(quelle).toContain("Klassenfarbe");
    expect(quelle).toContain("Gegenfarbe");
    expect(quelle).toContain("training-heat-band-");
  });

  it("beste Zelle gold, gewählte Zelle weißer Doppelrahmen, beides unterscheidbar", () => {
    expect(css).toMatch(/\.tr2 \.hz\.best \{[^}]*var\(--gold\)/);
    expect(css).toMatch(/\.tr2 \.hz\.an \{[^}]*solid #fff/);
    expect(css).toMatch(/\.tr2 \.hz\.an\.best \{[^}]*#fff[^}]*var\(--gold\)/);
    expect(quelle).toContain("★ Beste");
    expect(quelle).toContain("Gewählt");
  });

  it("Vorlieben mit SVG-Symbol (Herz, Daumen), nicht als Emoji", () => {
    expect(quelle).toContain("function Herz");
    expect(quelle).toContain("function Daumen");
    expect(quelle).not.toMatch(/[\u{1F300}-\u{1FAFF}❤\u{1F44E}]/u);
  });

  it("Schrift über die Tokens, keine eigene Familie", () => {
    expect(css).toContain("var(--bc-haus)");
    expect(css).toContain("var(--bc-zahl)");
    expect(css).not.toMatch(/font-family:\s*(Georgia|system-ui)/);
  });

  it("jede Tabelle ist sortierbar (Kaderliste: Spieler, Vorlieben, SP; Fremdes Team: Spieler, Scouting)", () => {
    expect(quelle).toContain("training-plan-sort-");
    expect(quelle).toMatch(/kopf\("name", "Spieler"/);
    expect(quelle).toMatch(/kopf\("vorlieben", "Vorlieben"/);
    expect(quelle).toMatch(/kopf\("sp", "SP"/);
    expect(quelle).toMatch(/kopf\("stufe", "Scouting"\)/);
  });
});

function zeile(partial: Partial<TrainingZeile> & { name: string }): TrainingZeile {
  return {
    playerId: partial.name,
    klasse: "Mage",
    portrait: null,
    modus: "mittel",
    verletzt: false,
    ziel: null,
    zielLabel: null,
    art: null,
    profil: [],
    station: "pow",
    fatigue: 10,
    risiko: 0,
    gesamt: 50,
    potenzial: 60,
    potenzialRest: 10,
    netto: 0,
    transparenz: null,
    wunsch: null,
    wunschDaten: null,
    vorlieben: null,
    vorliebeAktuell: 0,
    sp: 0,
    spBisher: 0,
    moral: null,
    form: null,
    rasse: "Human",
    traits: [],
    ...partial,
  } as unknown as TrainingZeile;
}

describe("Zeilenmodell: Vorlieben und Skillpunkte", () => {
  const zeilen = [
    zeile({ name: "Anna", sp: 1.5, vorliebeAktuell: 0 }),
    zeile({ name: "Bert", sp: 2.5, vorliebeAktuell: 1 }),
    zeile({ name: "Cora", sp: 0.5, vorliebeAktuell: -1 }),
  ];

  it("sortiert nach SP und nach Vorliebe des aktuellen Ziels, Gleichstand nach Name", () => {
    expect(sortiereKader(zeilen, "sp", "ab").map((z) => z.name)).toEqual(["Bert", "Anna", "Cora"]);
    expect(sortiereKader(zeilen, "sp", "auf").map((z) => z.name)).toEqual(["Cora", "Anna", "Bert"]);
    expect(sortiereKader(zeilen, "vorlieben", "ab").map((z) => z.name)).toEqual(["Bert", "Anna", "Cora"]);
  });

  it("Kopf-Kennzahlen: SP des Kaders, Lieblinge und Ungeliebtes (Verletzte zählen nicht)", () => {
    const k = baueKaderKennzahlen([
      ...zeilen.map((z) => ({ ...z, vorlieben: { lieblinge: ["a", "b"] as [string, string], ungeliebt: "c" } })),
      zeile({ name: "Dirk", sp: 9, verletzt: true, vorliebeAktuell: 1, vorlieben: { lieblinge: ["a", "b"], ungeliebt: "c" } }),
    ]);
    expect(k.spSumme).toBe(13.5);
    expect(k.trainierenLiebling).toBe(1);
    expect(k.trainierenUngeliebt).toBe(1);
    expect(k.vorliebenAktiv).toBe(true);
    expect(baueKaderKennzahlen(zeilen).vorliebenAktiv).toBe(false);
  });
});
