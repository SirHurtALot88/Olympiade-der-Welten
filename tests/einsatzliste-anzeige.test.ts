import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  EINSATZLISTE_SLOTFARBEN,
  slotFarbe,
  slotKuerzel,
  slotKuerzelFuerListe,
  bestbesetzungJeSlot,
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

  it("Gold = Bestbesetzung nach SLOTWERT (Chris 08.11.): je Slot der Kader-Beste, nicht nach Basis-Eignung", () => {
    // p3 ist im Slot d1-0 der Beste, in d1-1 der Schwächste — Gold hängt am Slot, nicht am Spieler.
    const werte = new Map([
      ["p1", [{ slotKey: "d1-0", projectedScore: 60 }, { slotKey: "d1-1", projectedScore: 75 }, { slotKey: "d2-0", projectedScore: 40 }]],
      ["p2", [{ slotKey: "d1-0", projectedScore: 62 }, { slotKey: "d1-1", projectedScore: 70 }, { slotKey: "d2-0", projectedScore: 55 }]],
      ["p3", [{ slotKey: "d1-0", projectedScore: 80 }, { slotKey: "d1-1", projectedScore: 50 }, { slotKey: "d2-0", projectedScore: null }]],
    ]);
    const beste = bestbesetzungJeSlot({
      slotKeys: ["d1-0", "d1-1", "d2-0", "d2-1"],
      slotWerteJeSpieler: werte.entries(),
      nameVon: (id) => id,
    });
    expect(beste.get("d1-0")).toEqual({ id: "p3", name: "p3", wert: 80 });
    expect(beste.get("d1-1")?.id).toBe("p1");
    expect(beste.get("d2-0")?.id).toBe("p2"); // p3 ohne Wert zählt nicht
    expect(beste.get("d2-1")).toBeNull(); // Slot ohne irgendeinen Wert
  });

  it("Bestbesetzung: Gleichstand stabil nach Name", () => {
    const werte = new Map([
      ["z", [{ slotKey: "s", projectedScore: 70 }]],
      ["a", [{ slotKey: "s", projectedScore: 70 }]],
    ]);
    const beste = bestbesetzungJeSlot({
      slotKeys: ["s"],
      slotWerteJeSpieler: werte.entries(),
      nameVon: (id) => (id === "z" ? "Zora" : "Anton"),
    });
    expect(beste.get("s")?.id).toBe("a");
  });

  it("Helfer-Modul importiert nichts aus Resolve, Arena oder Matrix (reine Anzeige)", () => {
    const quelle = readFileSync(join(process.cwd(), "lib/lineups/einsatzliste-anzeige.ts"), "utf8");
    expect(quelle).not.toMatch(/^import /m);
  });
});
