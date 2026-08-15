/**
 * DIE TRAININGS-HISTORIE NENNT DIE HAUPTSAECHLICH TRAINIERTE KLASSE.
 *
 * GEMELDET VON CHRIS: „In der Training History sollte auch drin stehen welche Klasse in der Season
 * mainly trainiert wurde!" — auf Rückfrage präzisiert: „mainly trainiert wäre die mit den meisten SP".
 *
 * DA IST NICHTS ZU RECHNEN, und genau das hält dieser Test fest: der Split ist FEST. Die organische
 * Saison-Progression verteilt **70 %** der Trainings-Setpoints auf die Haupt- und **30 %** auf die
 * Nebenklasse. „Die mit den meisten SP" ist damit per Konstruktion immer die Hauptklasse — eine
 * Auswertung der Einzelwerte wäre Theater um ein feststehendes Ergebnis. Ändert jemand den Split,
 * fällt dieser Test, und die Annahme gehört neu geprüft.
 *
 * WAS VORHER FEHLTE: die Meta-Zeile zeigte entweder den KLASSENWECHSEL des Spielers oder die
 * trainierte Klasse — nie beides. Ausgerechnet in den Saisons mit Klassenwechsel verschwand damit
 * die Information, woran gearbeitet wurde. Beides sind verschiedene Dinge: die eine sagt, was der
 * Spieler IST, die andere, woran er GEARBEITET hat.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PROGRESSION = readFileSync(
  join(process.cwd(), "lib/training/organic-season-progression.ts"),
  "utf8",
);
const DRAWER = readFileSync(join(process.cwd(), "app/foundation/PlayerDetailDrawer.tsx"), "utf8");

describe("Trainings-Historie: hauptsaechlich trainierte Klasse", () => {
  it("der Split ist fest 70/30 — darauf beruht die ganze Aussage", () => {
    expect(PROGRESSION).toContain("const primaryShare = secondaryTrainingClass ? 0.7 : 1;");
    expect(PROGRESSION).toContain("const secondaryShare = secondaryTrainingClass ? 0.3 : 0;");
  });

  it("ohne Nebenklasse traegt die Hauptklasse alles — dann waere „70 %\" irrefuehrend", () => {
    // `primaryShare` ist dann 1, nicht 0,7. Deshalb nennt die Anzeige in diesem Fall keine Prozente.
    expect(PROGRESSION).toContain("? 0.7 : 1");
  });

  it("die Historie fuehrt die Nebenklasse ueberhaupt mit", () => {
    expect(DRAWER).toContain("secondaryTrainingClass: row.secondaryTrainingClass");
  });

  it("die Meta-Zeile nennt die trainierte Klasse mit dem Wort „Trainiert\"", () => {
    expect(DRAWER).toMatch(/Trainiert \$\{meta\.trainingClass\}/);
  });

  it("Klassenwechsel UND trainierte Klasse schliessen sich nicht mehr gegenseitig aus", () => {
    // Der eigentliche Fehler: vorher stand hier ein ternaerer Ausdruck, der genau eines von beiden
    // zeigte. Jetzt sind es zwei unabhaengige Bedingungen.
    expect(DRAWER).not.toContain("classChanged\n        ? `Klasse ${meta.classBefore} → ${meta.classAfter}`");
    expect(DRAWER).toContain("if (classChanged) {");
  });

  it("bei vorhandener Nebenklasse stehen beide Anteile da", () => {
    expect(DRAWER).toContain("(70 %)");
    expect(DRAWER).toContain("(30 %)");
  });
});
