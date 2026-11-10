import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  EINSATZLISTE_SLOTFARBEN,
  slotFarbe,
  slotKuerzel,
  slotKuerzelFuerListe,
  goldPruefung,
  glyphenTon,
  optimaleZuteilung,
  passungsGlyphe,
  rollenGlyphe,
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

  it("Gold = optimale Gesamtzuteilung (Chris 08.11.): ein dominanter Spieler nimmt EINEN Slot, die anderen vergeben ihr Gold weiter", () => {
    // Tidesprinter-Fall: "tide" ist in allen drei Slots der Kader-Beste, kann aber nur einen besetzen.
    const werte = new Map([
      ["tide", [{ slotKey: "a", projectedScore: 90 }, { slotKey: "b", projectedScore: 88 }, { slotKey: "c", projectedScore: 80 }]],
      ["p1", [{ slotKey: "a", projectedScore: 70 }, { slotKey: "b", projectedScore: 60 }, { slotKey: "c", projectedScore: 50 }]],
      ["p2", [{ slotKey: "a", projectedScore: 65 }, { slotKey: "b", projectedScore: 75 }, { slotKey: "c", projectedScore: 55 }]],
      ["p3", [{ slotKey: "a", projectedScore: 40 }, { slotKey: "b", projectedScore: 45 }, { slotKey: "c", projectedScore: 72 }]],
    ]);
    const { zuteilung, kostenVon } = goldPruefung({ slotKeys: ["a", "b", "c"], slotWerteJeSpieler: werte.entries(), nameVon: (id) => id });
    // Optimum: tide auf a (90) + p2 auf b (75) + p3 auf c (72) = 237.
    expect(zuteilung.jeSlot.get("a")?.id).toBe("tide");
    expect(zuteilung.jeSlot.get("b")?.id).toBe("p2");
    expect(zuteilung.jeSlot.get("c")?.id).toBe("p3");
    expect(zuteilung.summe).toBe(237);
    expect(zuteilung.slotVonSpieler.get("tide")).toBe("a");
    // Gold je Slot: genau der Spieler der Zuteilung; tide auf b kostet etwas.
    expect(kostenVon("tide", "a")).toBe(0);
    expect(kostenVon("p2", "b")).toBe(0);
    expect(kostenVon("p3", "c")).toBe(0);
    // tide auf b: 88 + p1 auf a 70 + p3 auf c 72 = 230 -> kostet 7.
    expect(kostenVon("tide", "b")).toBe(7);
    expect(kostenVon("p1", "a")).toBeGreaterThan(0);
  });

  it("Gold kippt nicht an Gleichständen: jede optimale Verteilung ist Gold", () => {
    const werte = new Map([
      ["x", [{ slotKey: "a", projectedScore: 70 }, { slotKey: "b", projectedScore: 70 }]],
      ["y", [{ slotKey: "a", projectedScore: 70 }, { slotKey: "b", projectedScore: 70 }]],
    ]);
    const { kostenVon } = goldPruefung({ slotKeys: ["a", "b"], slotWerteJeSpieler: werte.entries(), nameVon: (id) => id });
    for (const id of ["x", "y"]) for (const slot of ["a", "b"]) expect(kostenVon(id, slot)).toBe(0);
  });

  it("Zuteilung: Spieler ohne Wert oder verletzt zählen nicht, zu wenige Spieler lassen Slots leer", () => {
    const werte = new Map([
      ["p1", [{ slotKey: "a", projectedScore: 60 }, { slotKey: "b", projectedScore: null }]],
      ["verletzt", [{ slotKey: "a", projectedScore: 99 }, { slotKey: "b", projectedScore: 99 }]],
    ]);
    const z = optimaleZuteilung({
      slotKeys: ["a", "b", "c"],
      slotWerteJeSpieler: werte.entries(),
      nameVon: (id) => id,
      ausgeschlossen: new Set(["verletzt"]),
    });
    expect(z.jeSlot.get("a")?.id).toBe("p1");
    expect(z.jeSlot.get("b")).toBeNull();
    expect(z.jeSlot.get("c")).toBeNull();
    expect(z.besetzt).toBe(1);
  });

  it("Zuteilung ist optimal (Abgleich mit Brute Force auf 200 Zufallsinstanzen)", () => {
    let saat = 12345;
    const zufall = () => {
      saat = (saat * 1103515245 + 12345) % 2147483648;
      return saat / 2147483648;
    };
    const permutationsMax = (wert: number[][], slots: number, spieler: number): number => {
      let beste = Number.NEGATIVE_INFINITY;
      const benutzt = new Array<boolean>(spieler).fill(false);
      const rek = (s: number, summe: number) => {
        if (s === slots) {
          beste = Math.max(beste, summe);
          return;
        }
        for (let p = 0; p < spieler; p += 1) {
          if (benutzt[p]) continue;
          benutzt[p] = true;
          rek(s + 1, summe + wert[s]![p]!);
          benutzt[p] = false;
        }
      };
      rek(0, 0);
      return beste;
    };
    for (let runde = 0; runde < 200; runde += 1) {
      const slots = 1 + Math.floor(zufall() * 5);
      const spieler = slots + Math.floor(zufall() * 3);
      const wert = Array.from({ length: slots }, () => Array.from({ length: spieler }, () => Math.round(zufall() * 1000) / 10));
      const eintraege = Array.from({ length: spieler }, (_, p) => [
        `p${p}`,
        Array.from({ length: slots }, (_, s) => ({ slotKey: `s${s}`, projectedScore: wert[s]![p]! })),
      ] as [string, Array<{ slotKey: string; projectedScore: number }>]);
      const z = optimaleZuteilung({
        slotKeys: Array.from({ length: slots }, (_, s) => `s${s}`),
        slotWerteJeSpieler: eintraege,
        nameVon: (id) => id,
      });
      expect(z.summe).toBeCloseTo(permutationsMax(wert, slots, spieler), 6);
      expect(z.besetzt).toBe(slots);
    }
  });

  it("Helfer-Modul importiert nichts aus Resolve, Arena oder Matrix (reine Anzeige)", () => {
    const quelle = readFileSync(join(process.cwd(), "lib/lineups/einsatzliste-anzeige.ts"), "utf8");
    expect(quelle).not.toMatch(/^import /m);
  });
});

describe("±-Schema (Rework 6.1/6.2)", () => {
  it("Rollen-Glyphe: Δ Pp ≥ 3 ++, ≥ 1 +, dazwischen ·, ≤ −1 −, ≤ −3 −−", () => {
    expect([5.4, 3, 2.7, 1, 0.9, 0, -0.9, -1, -2.5, -3, -8.8].map(rollenGlyphe)).toEqual(["++", "++", "+", "+", "·", "·", "·", "−", "−", "−−", "−−"]);
  });

  it("Passungs-Glyphe: dieselben Schwellen wie passung() im Motor (≥ 6 / ≥ 2 / ≥ −2), fünfte Stufe ≤ −6", () => {
    expect([8.5, 6, 5.9, 2, 1.9, -2, -2.1, -5.9, -6, -8.5].map(passungsGlyphe)).toEqual(["++", "++", "+", "+", "·", "·", "−", "−", "−−", "−−"]);
    const engine = readFileSync(join(process.cwd(), "public/mockups/battle-mode.engine.js"), "utf8");
    expect(engine).toContain("if(m>=6)   return {k:\"perfekt\"");
    expect(engine).toContain("if(m>=2)   return {k:\"gut\"");
    expect(engine).toContain("if(m>=-2)  return {k:\"okay\"");
  });

  it("Ton je Glyphe", () => {
    expect(["++", "+", "·", "−", "−−"].map((g) => glyphenTon(g as "++"))).toEqual(["gut", "gut", "neutral", "schlecht", "schlecht"]);
  });
});
