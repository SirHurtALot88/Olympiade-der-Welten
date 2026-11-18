import { describe, expect, it } from "vitest";
import { buildAiFormCardSeasonPlan, farbAnteileAusKarten, formCardSlotValue } from "@/lib/ai/ai-form-card-season-plan";
import {
  FARBREGEL_PM,
  FARBREGEL_SCHMAL,
  formkartenHinweis,
  formkartenSummeFuerSpieler,
  isFormkartenFarbregelEnabled,
  kartenWertAltRegel,
  kartenWertFuerSpieler,
} from "@/lib/lineups/formkarten-farbregel";
import { erzeugeFormHook } from "../scripts/lib/formkarten-farbregel-hook.mjs";

describe("Formkarten-Farbregel (Prototyp, Standard AUS)", () => {
  it("ist ohne Umgebungsvariable aus", () => {
    expect(isFormkartenFarbregelEnabled({})).toBe(false);
    expect(isFormkartenFarbregelEnabled({ OLY_FORMKARTEN_FARBREGEL: "neu" })).toBe(true);
  });

  it("alt: alle gleich, x2 bei Disziplinfarbe, bis +16", () => {
    expect(kartenWertAltRegel({ wert: 8, farbe: "yellow" }, "yellow")).toBe(16);
    expect(kartenWertAltRegel({ wert: 8, farbe: "red" }, "yellow")).toBe(8);
  });

  it("neu, fremde Disziplinfarbe: alle +0,5 v, Farbträger zusätzlich +0,5 v (max 8)", () => {
    const k = { wert: 8, farbe: "red" };
    expect(kartenWertFuerSpieler({ karte: k, disziplinFarbe: "blue", spielerFarbe: "green" })).toBe(4);
    expect(kartenWertFuerSpieler({ karte: k, disziplinFarbe: "blue", spielerFarbe: "red" })).toBe(8);
  });

  it("neu, passende Disziplinfarbe: alle +1,0 v, Farbträger Doppelprofit bis 12 statt 16", () => {
    const k = { wert: 8, farbe: "yellow" };
    expect(kartenWertFuerSpieler({ karte: k, disziplinFarbe: "yellow", spielerFarbe: "red" })).toBe(8);
    expect(kartenWertFuerSpieler({ karte: k, disziplinFarbe: "yellow", spielerFarbe: "yellow" })).toBe(12);
    expect(kartenWertFuerSpieler({ karte: k, disziplinFarbe: "yellow", spielerFarbe: "yellow", regel: FARBREGEL_SCHMAL })).toBe(10);
  });

  it("Negativkarten spiegelbildlich: Strafe für alle, Zusatzstrafe für Farbträger, kein Form-Hebel", () => {
    const k = { wert: -4, farbe: "red" };
    expect(kartenWertFuerSpieler({ karte: k, disziplinFarbe: "green", spielerFarbe: "blue" })).toBe(-2);
    expect(kartenWertFuerSpieler({ karte: k, disziplinFarbe: "green", spielerFarbe: "red", formStufe: 2 })).toBe(-4);
  });

  it("heiße Farbträger bekommen den Zusatzanteil verstärkt, kalte und Nicht-Träger nicht", () => {
    const k = { wert: 8, farbe: "red" };
    const basis = kartenWertFuerSpieler({ karte: k, disziplinFarbe: "blue", spielerFarbe: "red" });
    const heiss = kartenWertFuerSpieler({ karte: k, disziplinFarbe: "blue", spielerFarbe: "red", formStufe: 2 });
    expect(heiss).toBeGreaterThan(basis);
    expect(kartenWertFuerSpieler({ karte: k, disziplinFarbe: "blue", spielerFarbe: "red", formStufe: -2 })).toBe(basis);
    expect(kartenWertFuerSpieler({ karte: k, disziplinFarbe: "blue", spielerFarbe: "green", formStufe: 2 })).toBe(4);
  });

  it("Zwei Karten summieren sich", () => {
    const karten = [{ wert: 8, farbe: "yellow" }, { wert: 4, farbe: "red" }];
    expect(formkartenSummeFuerSpieler({ karten, disziplinFarbe: "yellow", spielerFarbe: "yellow", regel: FARBREGEL_PM })).toBe(14);
  });

  it("Hinweistext für die Einsatzliste", () => {
    expect(formkartenHinweis({ karte: { wert: 8, farbe: "yellow" }, disziplinFarbe: "yellow", traegerAnzahl: 3 })).toBe(
      "Karte yellow: +8 für alle, +4 zusätzlich für 3 Spieler dieser Farbe",
    );
  });

  it("Messhaken stimmt mit der Bibliotheksregel überein und liefert 'alt' wie der Motor", () => {
    const klassenFarbe = { Hero: "yellow", Tank: "red" };
    const seiten = [[{ n: "A", c: "Hero" }, { n: "B", c: "Tank" }], [{ n: "C", c: "Hero" }]];
    for (let saat = 1; saat < 200; saat += 7) {
      const alt = erzeugeFormHook({ regel: "alt", dFarbe: "yellow", klassenFarbe, hebel: 0.125 })(saat, seiten);
      const neu = erzeugeFormHook({ regel: FARBREGEL_PM, dFarbe: "yellow", klassenFarbe, hebel: 0.125 })(saat, seiten);
      // gleiche Seite -> gleicher Kartenzug: Alt-Wert aller Spieler einer Seite identisch
      expect(alt.get("A").form).toBe(alt.get("B").form);
      expect(alt.get("A").int).toBe(neu.get("A").int);
      // Rückrechnung: ist die Seite ohne Karte (alt 0), ist auch neu 0
      if (alt.get("A").form === 0) expect(neu.get("A").form).toBe(0);
      // Neu liegt nie über der Spitze von 12 je Karte (zwei Karten: 12 + 8)
      expect(Math.abs(neu.get("A").form)).toBeLessThanOrEqual(20);
    }
  });
});

describe("KI-Kartenplan mit Farbregel (Prototyp)", () => {
  const slot = (color: "red" | "green" | "blue" | "yellow" | null, playerCount: number, matchdayIndex = 1) => ({
    matchdayIndex, matchdayId: `m${matchdayIndex}`, disciplineSide: "d1" as const, disciplineId: "x", color, playerCount,
  });

  it("ohne farbregel bleibt formCardSlotValue die alte Rechnung", () => {
    expect(formCardSlotValue({ id: "c", value: 8, color: "red" }, slot("red", 6))).toBe(96);
    expect(formCardSlotValue({ id: "c", value: 8, color: "red" }, slot("blue", 2))).toBe(16);
  });

  it("mit farbregel zaehlt der Traeger-Zusatz nach Farbanteil des Teams", () => {
    const karte = { id: "c", value: 8, color: "red" as const };
    const viele = { ...slot("blue", 4), farbregel: FARBREGEL_PM, farbAnteile: { red: 0.5 } };
    const wenige = { ...slot("blue", 4), farbregel: FARBREGEL_PM, farbAnteile: { red: 0.1 } };
    expect(formCardSlotValue(karte, viele)).toBeCloseTo((4 + 4 * 0.5) * 4, 5);
    expect(formCardSlotValue(karte, wenige)).toBeLessThan(formCardSlotValue(karte, viele));
  });

  it("Farbanteile aus den Karten", () => {
    expect(farbAnteileAusKarten([{ color: "red" }, { color: "red" }, { color: "blue" }, { color: "yellow" }])).toEqual({ red: 0.5, blue: 0.25, yellow: 0.25 });
  });

  it("Plan mit Farbregel setzt die Pluskarte weiter auf den wertvollsten Slot", () => {
    const plan = buildAiFormCardSeasonPlan({ cards: [{ id: "k", value: 8, color: "red" }], slots: [slot("blue", 2, 1), slot("red", 6, 2)], farbregel: FARBREGEL_PM });
    expect(plan.entryByCardId.get("k")?.slot.matchdayIndex).toBe(2);
  });
});
