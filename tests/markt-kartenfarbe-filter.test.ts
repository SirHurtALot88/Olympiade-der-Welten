/**
 * GEMELDET VON CHRIS (`vzao8d`, Seite „Markt · Transfermarkt"): „Im Transfermarkt fehlt noch ein Feld,
 * wo nach Bereich gesucht werden muss — also welche Kartenfarbe der Spieler mitbringt: POW SPE MEN SOC."
 *
 * Der Befund war nicht „Feature fehlt", sondern „Feature ist bis auf den Knopf fertig":
 * `selectedClassAxes` wurde gesetzt, saniert, in Filter-Presets gespeichert, beim Zurücksetzen
 * geleert UND angewendet (Klassenfarbe → Achse über `CLASS_COLOR_TO_AXIS`). Auch `onToggleClassAxis`
 * kam als Prop in der Ansicht an — dort wurde es nur nie gerendert. Man konnte den Filter also
 * niemals einschalten.
 *
 * Geprüft wird die Kette, weil genau an einem ihrer Glieder der Fehler saß:
 *
 *  1. Der Client reicht Zustand und Handler durch.
 *  2. Die Ansicht rendert ein Bedienelement, das den Handler ruft.
 *  3. Der Filter wird auch angewendet.
 *  4. Er ist NICHT dasselbe wie die Achs-Mindestwerte — zwei verschiedene Fragen.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const CLIENT = readFileSync(join(root, "app/foundation/transfermarkt-v2/TransfermarktV2Client.tsx"), "utf8");
const VIEW = readFileSync(join(root, "app/foundation/transfermarkt-v2/TransfermarktV2NewLook.tsx"), "utf8");

describe("Transfermarkt — Filter nach Kartenfarbe", () => {
  it("der Client reicht Zustand und Handler durch", () => {
    expect(CLIENT).toContain("selectedClassAxes");
    expect(CLIENT).toContain("onToggleClassAxis");
  });

  it("der Filter wird auch angewendet, nicht nur mitgeführt", () => {
    // Ohne diese Stelle waere der Knopf reine Zierde.
    expect(CLIENT).toContain("selectedClassAxes.includes(classAxis)");
    expect(CLIENT).toContain("CLASS_COLOR_TO_AXIS");
  });

  it("die Ansicht rendert ein Bedienelement, das den Handler ruft", () => {
    /**
     * DAS WAR DAS FEHLENDE GLIED. `onToggleClassAxis` wurde destrukturiert und dann nie benutzt —
     * kein Aufruf, kein Chip, kein Weg, den Filter einzuschalten.
     */
    expect(VIEW, "onToggleClassAxis wird nirgends aufgerufen").toContain("onClick={() => onToggleClassAxis(axis)}");
    expect(VIEW, "der aktive Zustand muss sichtbar sein").toContain("selectedClassAxes.includes(axis)");
    expect(VIEW).toContain('aria-label="Kartenfarbe des Spielers"');
  });

  it("alle vier Achsen sind erreichbar", () => {
    // Die Chips kommen aus derselben Liste wie die Mindestwerte — keine zweite, driftende Aufzählung.
    const block = VIEW.slice(VIEW.indexOf('aria-label="Kartenfarbe des Spielers"'));
    expect(block.slice(0, 800)).toContain("NL_MARKET_AXES.map");
  });

  it("Kartenfarbe und Achs-Mindestwert bleiben zwei verschiedene Filter", () => {
    /**
     * Sie stehen nebeneinander und beantworten verschiedene Fragen: „welche Farbe bringt er mit"
     * gegen „mindestens so stark in dieser Achse". Würden sie zusammenfallen, ginge einer der
     * beiden verloren.
     */
    expect(VIEW).toContain('aria-label="Mindestwerte je Achse"');
    expect(VIEW).toContain('aria-label="Kartenfarbe des Spielers"');
    expect(CLIENT).toContain("passesMarketAxisFilters");
  });
});
