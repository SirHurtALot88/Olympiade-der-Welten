import { describe, expect, it } from "vitest";

import {
  baueKaderKennzahlen,
  belastungNachTraining,
  belastungsZone,
  naechsteSortierung,
  risikoProzent,
  sortiereKader,
  stationFuerZeile,
  stationenBelegung,
  wuenscheErfuellen,
  wunschFolge,
  zielGleich,
  zielLabel,
  zonenText,
  type TrainingZeile,
} from "@/lib/training/training-modern-modell";
import { wegeFuerDisziplin } from "@/lib/training/spieltag-training";

function zeile(teil: Partial<TrainingZeile> & { playerId: string; name: string }): TrainingZeile {
  return {
    klasse: "Hero",
    portrait: null,
    row: {} as TrainingZeile["row"],
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
    netto: 1,
    wunsch: null,
    wunschDaten: null,
    ...teil,
  };
}

describe("Entwicklung: Datenaufbereitung", () => {
  it("Station folgt der Achse des Hauptattributs, Verletzte stehen in der Reha", () => {
    const kern = { pow: 10, spe: 90, men: 20, soc: 30 };
    expect(stationFuerZeile({ verletzt: false, profil: [{ attribute: "charisma" }], coreStats: kern })).toBe("soc");
    expect(stationFuerZeile({ verletzt: false, profil: [{ attribute: "speed" }], coreStats: kern })).toBe("spe");
    expect(stationFuerZeile({ verletzt: true, profil: [{ attribute: "speed" }], coreStats: kern })).toBe("reha");
    expect(stationFuerZeile({ verletzt: false, profil: [], coreStats: kern })).toBe("spe");
  });

  it("Belastungszonen und Risiko folgen der echten Kurve (25: 0 %, 50: 3 %, 80: 25 %)", () => {
    expect(risikoProzent(25)).toBe(0);
    expect(risikoProzent(50)).toBe(3);
    expect(risikoProzent(80)).toBe(25);
    expect(belastungsZone(10).name).toBe("kein Risiko");
    expect(zonenText(55)).toBe("überlastet");
    expect(zonenText(85)).toBe("am Limit");
  });

  it("Belastung nach dem Training addiert die Last des Modus und deckelt bei 100", () => {
    expect(belastungNachTraining(10, "leicht")).toBe(16);
    expect(belastungNachTraining(10, "hart")).toBe(32);
    expect(belastungNachTraining(95, "hart")).toBe(100);
  });

  it("sortiert Spalten, zweiter Klick dreht, Gleichstand nach Name", () => {
    const z = [
      zeile({ playerId: "a", name: "Zora", fatigue: 40, netto: 2 }),
      zeile({ playerId: "b", name: "Abe", fatigue: 70, netto: 2 }),
      zeile({ playerId: "c", name: "Kati", fatigue: 10, netto: 5 }),
    ];
    expect(sortiereKader(z, "belastung", "ab").map((x) => x.name)).toEqual(["Abe", "Zora", "Kati"]);
    expect(sortiereKader(z, "belastung", "auf").map((x) => x.name)).toEqual(["Kati", "Zora", "Abe"]);
    expect(sortiereKader(z, "netto", "ab").map((x) => x.name)).toEqual(["Kati", "Abe", "Zora"]);
    expect(sortiereKader(z, "name", "auf").map((x) => x.name)).toEqual(["Abe", "Kati", "Zora"]);
    const erst = naechsteSortierung({ schluessel: "name", richtung: "auf" }, "netto");
    expect(erst).toEqual({ schluessel: "netto", richtung: "ab" });
    expect(naechsteSortierung(erst, "netto")).toEqual({ schluessel: "netto", richtung: "auf" });
  });

  it("Kennzahlen zählen überlastete und verletzte Spieler getrennt", () => {
    const z = [
      zeile({ playerId: "a", name: "A", fatigue: 60, netto: 1.5 }),
      zeile({ playerId: "b", name: "B", fatigue: 20, netto: -0.5, verletzt: true, station: "reha" }),
      zeile({ playerId: "c", name: "C", fatigue: 80, netto: 1, verletzt: true, station: "reha" }),
    ];
    const k = baueKaderKennzahlen(z);
    expect(k).toMatchObject({ anzahl: 3, ueberlastet: 1, verletzt: 2, nettoSumme: 2 });
    expect(k.belastungMittel).toBe(53);
    const belegung = stationenBelegung(z);
    expect(belegung.find((b) => b.id === "reha")?.zeilen).toHaveLength(2);
    expect(belegung.find((b) => b.id === "pow")?.zeilen).toHaveLength(1);
  });

  it("Ziele vergleichen, Namen und Wege kommen aus der Matrix", () => {
    expect(zielGleich({ disziplinId: "football", weg: 1 }, { disziplinId: "football", weg: 1 })).toBe(true);
    expect(zielGleich({ disziplinId: "football", weg: 1 }, { disziplinId: "football", weg: 0 })).toBe(false);
    expect(zielGleich(null, null)).toBe(true);
    expect(zielLabel("eiskunstlauf")).toBe("Eiskunst");
    const wege = wegeFuerDisziplin("football");
    expect(wege[0]?.art).toBe("primaer");
    expect(wege.length).toBeGreaterThan(1);
    expect(wege[1]?.art).toBe("neben");
  });
});

describe("Trainingswunsch", () => {
  const daten = { moraleReward: 4, moralePenalty: -5, spieltag: 1 };

  it("zählt offene Wünsche nur dort, wo Wunsch und Intensität abweichen", () => {
    const zeilen = [
      zeile({ playerId: "a", name: "A", wunsch: "leicht", modus: "mittel" }),
      zeile({ playerId: "b", name: "B", wunsch: "hart", modus: "hart" }),
      zeile({ playerId: "c", name: "C", wunsch: null }),
    ];
    const k = baueKaderKennzahlen(zeilen);
    expect(k.wuenscheGesamt).toBe(2);
    expect(k.wuenscheOffen).toBe(1);
  });

  it("sortiert die Wunsch-Spalte: offen vor erfüllt vor kein Wunsch", () => {
    const zeilen = [
      zeile({ playerId: "a", name: "A", wunsch: null }),
      zeile({ playerId: "b", name: "B", wunsch: "hart", modus: "hart" }),
      zeile({ playerId: "c", name: "C", wunsch: "leicht", modus: "mittel" }),
    ];
    expect(sortiereKader(zeilen, "wunsch", "ab").map((z) => z.playerId)).toEqual(["c", "b", "a"]);
  });

  it("Folge folgt der Engine: erfüllt gibt Belohnung, früh offen keine Folge, später Druck", () => {
    const z = zeile({ playerId: "a", name: "A", wunsch: "leicht", wunschDaten: daten });
    expect(wunschFolge(z, "leicht")).toMatchObject({ delta: 4, ergebnis: "erfuellt" });
    expect(wunschFolge(z, "mittel")).toMatchObject({ delta: 0, ergebnis: "offen" });
    const spaet = zeile({ playerId: "a", name: "A", wunsch: "leicht", wunschDaten: { ...daten, spieltag: 3 } });
    expect(wunschFolge(spaet, "mittel")).toMatchObject({ ergebnis: "druck" });
    expect(wunschFolge(spaet, "mittel")!.delta).toBeLessThan(0);
    expect(wunschFolge(zeile({ playerId: "x", name: "X" }), "leicht")).toBeNull();
  });

  it("Wünsche erfüllen setzt die gewünschte Intensität nur bei offenen, nicht verletzten Spielern", () => {
    const zeilen = [
      zeile({ playerId: "a", name: "A", wunsch: "leicht", modus: "mittel" }),
      zeile({ playerId: "b", name: "B", wunsch: "hart", modus: "hart" }),
      zeile({ playerId: "c", name: "C", wunsch: "hart", modus: "leicht", verletzt: true }),
      zeile({ playerId: "d", name: "D", wunsch: "hart", modus: "leicht" }),
    ];
    expect(wuenscheErfuellen(zeilen, {})).toEqual({ a: "leicht", d: "hart" });
    expect(wuenscheErfuellen(zeilen, { a: { modus: "leicht" } })).toEqual({ d: "hart" });
  });
});
