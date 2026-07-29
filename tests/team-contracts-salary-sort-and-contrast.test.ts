import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

const panel = read("app/foundation/teams-v2/FoundationTeamsDetailPanel.tsx");
const css = read("app/globals.css");

/**
 * "Wenn man in der Team-Tabelle nach Gehalt sortiert, soll der Spieler mit dem
 * aktuell hoechsten auch oben auftauchen."
 *
 * In der Gehaltsverlauf-Spalte liefen DREI verschiedene Groessen durcheinander:
 *  - sortiert wurde nach `row.totalSalary` (Summe ueber die ganze Laufzeit),
 *  - angezeigt wurde `lastActiveSalary` (die LETZTE Vertragssaison),
 *  - gemeint war das aktuelle Saisongehalt.
 * Bei front-/back-loaded Vertraegen fallen die drei weit auseinander — der oberste
 * Spieler war weder der heute teuerste noch der mit der groessten sichtbaren Zahl.
 */
describe("Verträge-Tabelle: Gehaltsspalte zeigt und sortiert dasselbe", () => {
  it("leitet das aktuelle Saisongehalt aus der ersten belegten Vertragssaison ab", () => {
    // `yearlySalarySchedule[0]` ist die laufende Saison (siehe resolvePlayerEconomySalary).
    expect(panel).toContain("const currentIndex = values.findIndex((entry) => entry.salary != null);");
    expect(panel).toContain("currentSalary: currentIndex >= 0 ? values[currentIndex].salary : null,");
  });

  it("sortiert die Spalte nach dem aktuellen Gehalt, nicht nach der Laufzeit-Summe", () => {
    expect(panel).toContain('case "salary":\n                                return currentSalaryByRowId.get(row.rowId) ?? null;');
    // Die alte Sortiergroesse ist raus.
    expect(panel).not.toContain('case "salary":\n                                return row.totalSalary;');
  });

  it("baut den Sortierwert einmal je Zeile statt einmal je Vergleich", () => {
    // Ein `buildContractSalarySteps` im Comparator liefe O(n log n) mal.
    expect(panel).toContain("const currentSalaryByRowId = new Map(");
  });

  it("zeigt in der Zelle genau diese Zahl", () => {
    expect(panel).toContain("{staircase.currentSalary != null ? formatDisplayMoney(staircase.currentSalary) : \"—\"}");
    // Die letzte Vertragssaison ist nicht verloren — sie steht im Tooltip.
    expect(panel).toContain("letzte Vertragssaison ${formatDisplayMoney(staircase.lastActiveSalary)}");
  });

  it("erklaert im Spaltenkopf, wonach sortiert wird", () => {
    expect(panel).toContain("Die Zahl daneben ist das AKTUELLE Saisongehalt — danach wird auch sortiert.");
    expect(panel).not.toContain("Sortiert nach Gesamtgehalt über die Vertragslaufzeit.");
  });
});

/**
 * "Schriftfarbe fixen, schwarz auf dunkel kann man kaum lesen."
 *
 * Die `.heat-band-N`-Grundregeln setzen Hintergrund UND eine dunkle Textfarbe —
 * gemacht fuer die HELLEN Heat-Flaechen. Die Restlaufzeiten-Buckets uebernehmen
 * davon nur die Farbe als Rahmen/Verlauf auf dunklem Panel und ueberschrieben
 * bislang ausschliesslich `background` und `border-color`. Die dunkle Schriftfarbe
 * blieb stehen und vererbte sich auf Kopfzeile, Anzahl und Spieler-Chips.
 */
describe("Restlaufzeiten-Buckets: helle Schrift auf dunklem Verlauf", () => {
  const block = css.slice(
    css.indexOf("/* Die `.heat-band-N`-Grundregeln setzen Hintergrund UND eine DUNKLE Textfarbe"),
    css.indexOf(".team-contracts-expiry-bucket-head {"),
  );

  it("setzt die Textfarbe fuer JEDES dort genutzte Heat-Band zurueck", () => {
    expect(block).toContain("color: var(--nl-ink, rgba(233, 241, 255, 0.94));");
    for (const band of [1, 3, 5, 6, 8]) {
      expect(block, `heat-band-${band}`).toContain(`.team-contracts-expiry-bucket.heat-band-${band}`);
    }
  });

  it("entfernt auch den Inset-Schatten der hellen Heat-Flaeche", () => {
    expect(block).toContain("box-shadow: none;");
  });

  it("deckt genau die Baender ab, die der Panel-Code vergibt", () => {
    // `getContractLengthHeatBandClass` vergibt 1/3/5/6/8 — kommt ein Band dazu,
    // faellt es hier auf, statt still wieder schwarz auf dunkel zu rendern.
    const mapping = panel.slice(panel.indexOf("function getContractLengthHeatBandClass"), panel.indexOf("function getContractLengthHeatBandClass") + 400);
    const bands = [...mapping.matchAll(/heat-band-(\d)/g)].map(([, digit]) => Number(digit));
    expect(new Set(bands)).toEqual(new Set([1, 3, 5, 6, 8]));
  });
});
