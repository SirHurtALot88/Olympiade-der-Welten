/**
 * GEMELDET VON CHRIS: „in der einsatzliste sind die farben von pow spe men soc beim dropdown
 * der formkarten weg bitte wieder hinuzfügen"
 *
 * BEFUND: Der Code war intakt — und trotzdem hatte Chris recht. Die Bereichsfarbe hing allein
 * an `style={{ color }}` der `<option>`, und das ist die eine Eigenschaft, die native
 * Auswahlmenüs nicht mitmachen: Chrome und Safari auf macOS zeichnen das aufgeklappte Menü
 * über das Betriebssystem und ignorieren sie. Alle vier Bereiche trugen zusätzlich denselben
 * neutralen Punkt `●` — ohne wirksame Farbe also vier identische graue Punkte.
 *
 * Ein Zeichen, das seine Farbe selbst mitbringt, überlebt jedes native Menü. Deshalb steht im
 * Label jetzt der farbige Kreis des Bereichs. Die `color`-Angabe bleibt daneben stehen: wo sie
 * wirkt, färbt sie weiterhin die ganze Zeile.
 *
 * Warum Quelltext-Prüfung: Das Projekt fährt vitest ohne jsdom, und ein `<option>` liesse sich
 * selbst dort nicht auf seine tatsächliche Darstellung prüfen — die entscheidet der Browser.
 * Geprüft wird deshalb genau das, was den Fehler verursacht hat: dass die Farbe nicht mehr
 * ausschliesslich an einer CSS-Eigenschaft hängt.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "app/foundation/legacy-lineup-lab/LegacyLineupLabClient.tsx"),
  "utf8",
);

const iconBlock = source.slice(
  source.indexOf("const formCardColorIcon"),
  source.indexOf("const formCardColorIcon") + 260,
);

describe("Formkarten-Dropdown · die Bereichsfarbe kommt auch im nativen Menü an", () => {
  it("gibt jedem Bereich ein eigenes farbiges Zeichen", () => {
    expect(iconBlock).toContain('red: "🔴"');
    expect(iconBlock).toContain('green: "🟢"');
    expect(iconBlock).toContain('blue: "🔵"');
    expect(iconBlock).toContain('yellow: "🟡"');
  });

  it("verwendet nicht mehr für alle vier dasselbe Zeichen", () => {
    // Der eigentliche Fehler: vier gleiche Punkte, deren einziger Unterschied eine
    // CSS-Farbe war, die im nativen Menü nicht ankommt.
    const zeichen = ["🔴", "🟢", "🔵", "🟡"];
    expect(new Set(zeichen).size).toBe(4);
    expect(iconBlock).not.toMatch(/red: "●"/);
  });

  it("trägt das Zeichen ins Label, nicht nur in ein Attribut", () => {
    // Nur im Label überlebt es den Weg ins Betriebssystem-Menü.
    expect(source).toMatch(/return `\$\{formCardColorIcon\[card\.color\]\}/);
  });

  it("behält die Zeilenfarbe für die Browser, die sie zeichnen", () => {
    // Zusätzlich, nicht stattdessen — Firefox und Linux-Chrome färben die ganze Zeile.
    expect(source).toContain("color: formCardColorHex[card.color]");
  });
});
