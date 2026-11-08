import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  EINSATZLISTE_SLOTFARBEN,
  slotFarbe,
  slotKuerzel,
  slotKuerzelFuerListe,
  topNNachEignung,
} from "@/lib/lineups/einsatzliste-anzeige";
import { resolveSlotRolesForDiscipline } from "@/lib/lineups/matchday-slot-roles";
import { officialDisciplineWeightOrder } from "@/lib/player-generator/official-discipline-weights";

/**
 * Einsatzliste-Revamp Paket 1 (docs/design/einsatzliste-revamp-architektur-08-11.md):
 * Kürzel, Positionsfarben und Gold-Rahmen sind reine Anzeige. Geprüft wird, dass sie für alle
 * zwanzig Disziplinen eindeutig/stabil sind und dass die Helfer nichts aus dem Simulationspfad
 * ziehen.
 */
describe("Einsatzliste-Anzeige (Paket 1)", () => {
  it("Kürzel folgen der Arena-Regel", () => {
    expect(slotKuerzel("Hold Line")).toBe("HL");
    expect(slotKuerzel("Vanguard")).toBe("VA");
    expect(slotKuerzel("Kicker/Punter")).toBe("KI");
  });

  it("Kürzel sind in jeder der zwanzig Disziplinen und bei jeder Kadergröße eindeutig", () => {
    for (const disciplineId of officialDisciplineWeightOrder) {
      for (let k = 1; k <= 6; k += 1) {
        const labels = resolveSlotRolesForDiscipline(disciplineId, null, k).map((role) => role.label);
        const kuerzel = slotKuerzelFuerListe(labels);
        expect(new Set(kuerzel).size, `${disciplineId} k=${k}: ${kuerzel.join(",")}`).toBe(labels.length);
        for (const eintrag of kuerzel) expect(eintrag).toMatch(/^[A-ZÄÖÜ0-9]{2}$/u);
      }
    }
  });

  it("Kollisionen werden deterministisch aufgelöst (Staffel CR, Breaking ST)", () => {
    expect(slotKuerzelFuerListe(["Curve Runner", "Chase Runner"])).toEqual(["CR", "CH"]);
    expect(slotKuerzelFuerListe(["Standhalten", "Steingesicht"])).toEqual(["ST", "SE"]);
  });

  it("Positionsfarbe hängt am Slot-Index, sechs feste Töne", () => {
    expect(EINSATZLISTE_SLOTFARBEN).toHaveLength(6);
    expect(new Set(EINSATZLISTE_SLOTFARBEN).size).toBe(6);
    expect(slotFarbe(0)).toBe(EINSATZLISTE_SLOTFARBEN[0]);
    expect(slotFarbe(5)).toBe(EINSATZLISTE_SLOTFARBEN[5]);
    expect(slotFarbe(6)).toBe(EINSATZLISTE_SLOTFARBEN[0]);
    expect(slotFarbe(Number.NaN)).toBe(EINSATZLISTE_SLOTFARBEN[0]);
  });

  it("Gold: Top-N nach Eignung, Gleichstand stabil nach Name, ohne Wert nie Gold", () => {
    const kader = [
      { id: "a", name: "Zora", eignung: 70 },
      { id: "b", name: "Anton", eignung: 70 },
      { id: "c", name: "Bert", eignung: 80 },
      { id: "d", name: "Cleo", eignung: null },
      { id: "e", name: "Dana", eignung: 50 },
    ];
    expect([...topNNachEignung(kader, 2)]).toEqual(["c", "b"]);
    expect(topNNachEignung(kader, 0).size).toBe(0);
    expect(topNNachEignung(kader, 10).has("d")).toBe(false);
    expect(topNNachEignung(kader, 10).size).toBe(4);
  });

  it("Helfer-Modul importiert nichts aus Resolve, Arena oder Matrix (reine Anzeige)", () => {
    const quelle = readFileSync(join(process.cwd(), "lib/lineups/einsatzliste-anzeige.ts"), "utf8");
    expect(quelle).not.toMatch(/^import /m);
  });
});
