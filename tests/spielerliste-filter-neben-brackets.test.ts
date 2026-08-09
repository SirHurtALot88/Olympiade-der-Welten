/**
 * GEMELDET VON CHRIS: „kannst du die filter einmal rechts neben die brackets und unter die KPI
 * kacheln legen? das passt da sicher hin und spart platz"
 *
 * Die Filter-Karte „Bedingungen" stand als eigene Karte UNTER dem Bracket-Block und schob die
 * Spielerliste weit nach unten — während rechts neben den Balken Platz frei blieb. Jetzt liegen
 * beide nebeneinander unter den Kennzahl-Kacheln.
 *
 * Zwei Dinge, die dabei leicht kaputtgehen und die diese Datei festhält:
 *
 *  1. Der Filter darf im eingebetteten Fall KEINE eigene `NlCard` mehr rendern — eine Karte in
 *     der Karte sieht aus wie ein Versehen. Dafür gibt es `embedded`; die eigenständige Variante
 *     bleibt erhalten, damit andere Aufrufer nichts verlieren.
 *  2. Das Raster muss auf schmalen Bildschirmen wieder umbrechen, sonst quetschen sich Balken
 *     und Select-Felder gegenseitig unlesbar.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const host = readFileSync(
  join(root, "app/foundation/players-table/FoundationPlayersTableNewLook.tsx"),
  "utf8",
);
const filterBar = readFileSync(
  join(root, "app/foundation/players-table/FoundationPlayersQueryChipsBar.tsx"),
  "utf8",
);
const css = readFileSync(join(root, "app/globals.css"), "utf8");

describe("Spielerliste · Filter neben den Brackets", () => {
  it("legt Brackets und Filter in ein gemeinsames Raster", () => {
    expect(host).toContain('className="nl-players-brackets-row"');
    expect(host).toContain('className="nl-players-brackets-col"');
  });

  it("rendert den Filter eingebettet, nicht mehr als eigene Karte darunter", () => {
    expect(host).toMatch(/<FoundationPlayersQueryChipsBar\s+embedded/);
    // Die alte, eigenständige Platzierung nach dem </NlCard> ist weg.
    expect(host).not.toMatch(/<\/NlCard>\s*\{playersView === "directory" \? \(\s*<FoundationPlayersQueryChipsBar/);
  });

  it("behält die eigenständige Karten-Variante für andere Aufrufer", () => {
    // `embedded` schaltet nur um — ohne das Flag bleibt es bei NlCard.
    expect(filterBar).toContain("const Shell = embedded ? NlQueryChipsShell : NlCard;");
    expect(filterBar).toContain("embedded = false");
  });

  it("gibt der eingebetteten Hülle Kopfzeile ohne Kartenrahmen", () => {
    expect(filterBar).toContain('className="nl-pquery-embedded-eyebrow"');
    expect(filterBar).toContain('className="nl-pquery-embedded-title"');
  });

  it("bricht auf schmalen Bildschirmen wieder auf eine Spalte um", () => {
    const responsive = css.slice(css.indexOf(".is-new-look .nl-players-brackets-row"));
    expect(responsive).toMatch(/@media \(max-width: 1200px\)[\s\S]{0,400}nl-players-brackets-row[\s\S]{0,120}grid-template-columns: minmax\(0, 1fr\)/);
  });

  it("erlaubt beiden Spalten zu schrumpfen", () => {
    // Ohne `minmax(0, …)` erzwingt der Inhalt (breite Selects, lange Preset-Namen) eine
    // Mindestbreite und sprengt das Raster nach rechts aus der Karte heraus.
    expect(css).toMatch(/nl-players-brackets-row \{[\s\S]{0,200}grid-template-columns: minmax\(0, 1\.35fr\) minmax\(0, 1fr\)/);
  });
});
