import { describe, expect, it } from "vitest";

import {
  baueLegende,
  bremseKurz,
  bremsGrundText,
  moralAnlauf,
  moralErklaerung,
  moralTipp,
  moralZustandText,
  potenzialKurz,
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
import { wegeFuerDisziplin, type SpieltagsTransparenz } from "@/lib/training/spieltag-training";
import { MORAL_SKALA_FAKTOR } from "@/lib/morale/morale-konstanten";

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
    transparenz: null,
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


describe("Transparenz: Moral, Potenzial, Maximum", () => {
  const daten = { moraleReward: 5, moralePenalty: -10, spieltag: 6, saisonSpieltage: 20 };
  const z = zeile({ playerId: "a", name: "A", wunsch: "hart", modus: "leicht", wunschDaten: daten });

  it("Moral −10 ist ein Zustand auf der 0..100-Skala: −10 x Skala 1,2 = −12,0", () => {
    const f = wunschFolge(z, "leicht")!;
    expect(f.ergebnis).toBe("verfehlt");
    expect(f.delta).toBe(-10);
    expect(f.punkte).toBe(-12);
    expect(MORAL_SKALA_FAKTOR).toBe(1.2);
    expect(moralZustandText(f)).toBe("−12,0 Moral solange verfehlt");
  });

  it("die Vorschau für eine andere Intensität nimmt die Abweichung dieser Intensität (eine Stufe daneben: −5, nicht −10)", () => {
    const f = wunschFolge(z, "mittel")!;
    expect(f.ergebnis).toBe("druck");
    expect(f.punkte).toBe(-1.6);
  });

  it("Verlauf: folgenlos, ab Spieltag 2 unter Druck, ab 5 verfehlt, aktuelle Stufe markiert", () => {
    const m = moralErklaerung(z, "leicht")!;
    expect(m.stufen.map((s) => [s.ab, s.bis, s.ergebnis, s.punkte])).toEqual([
      [1, 1, "offen", 0],
      [2, 4, "druck", -5.4],
      [5, 20, "verfehlt", -12],
    ]);
    expect(m.stufen.find((s) => s.aktuell)?.ergebnis).toBe("verfehlt");
    expect(m.saisonendePunkte).toBe(-12);
    expect(m.eignungProzent).toBeLessThan(0);
    expect(m.eignungProzent).toBeGreaterThan(-1);
  });

  it("Anlauf: die Moral zieht je Spieltag um 45 % der Restlücke nach", () => {
    expect(moralAnlauf(1)).toBe(0.45);
    expect(moralAnlauf(2)).toBe(0.698);
    expect(moralAnlauf(0)).toBe(0);
    expect(moralTipp(z, "leicht")).toContain("kein Abzug je Spieltag");
  });

  it("erfüllter Wunsch: Zuschlag als Zustand, kein Verlaufs-Abzug", () => {
    const f = wunschFolge(z, "hart")!;
    expect(f).toMatchObject({ ergebnis: "erfuellt", delta: 5, punkte: 6 });
    expect(moralTipp(z, "hart")).toContain("Erfüllt");
  });

  it("Legende nennt die echten Zahlen aus dem Code", () => {
    const l = baueLegende();
    expect(l.map((e) => e.id)).toEqual(["potenzial", "maximum", "moral", "intensitaet"]);
    expect(l[0]!.text).toContain("× 1,00");
    expect(l[0]!.text).toContain("2,60");
    expect(l[1]!.text).toContain("0,45");
    expect(l[1]!.text).toContain("30 %");
    expect(l[2]!.text).toContain("−12,0");
    expect(l[2]!.text).toContain("45 %");
    expect(l[3]!.text).toContain("0,226");
  });

  const attr = (a: Partial<SpieltagsTransparenz["attribute"][number]>) =>
    ({
      attribute: "will",
      anteil: 0.6,
      vorher: 60,
      deckel: 99,
      rest: 39,
      zustand: "open",
      amMaximum: false,
      ungebremst: 0.1,
      gebucht: 0.1,
      verlust: 0,
      faktor: 1,
      grund: null,
      ...a,
    }) as SpieltagsTransparenz["attribute"][number];
  const trans = (attribute: SpieltagsTransparenz["attribute"], rest: Partial<SpieltagsTransparenz> = {}): SpieltagsTransparenz => ({
    beschleuniger: { potenzial: 66.8, aktuell: 47.8, luecke: 19, gapAccel: 1.27, poSteep: 1, faktor: 1.27 },
    attribute,
    ungebremstSumme: 0.4,
    verlustSumme: 0,
    verlustAnteil: 0,
    umgeleitet: 0,
    ...rest,
  });

  it("Potenzial-Text zeigt Faktor und Rest bis Potenzial", () => {
    expect(potenzialKurz(trans([]))).toBe("Zuwachs × 1,27 (Rest 19 bis Potenzial 66,8)");
    expect(potenzialKurz(null)).toBeNull();
    expect(potenzialKurz(trans([], { beschleuniger: { potenzial: null, aktuell: null, luecke: 0, gapAccel: 1, poSteep: 1, faktor: 1 } }))).toBeNull();
  });

  it("Bremse: keine ohne Verlust; sonst Anteil, Reihenfolge nach Verlust, Maximum erkannt", () => {
    expect(bremseKurz(trans([attr({})]))).toBeNull();
    expect(bremseKurz(null)).toBeNull();
    const t = trans(
      [
        attr({ attribute: "will", vorher: 99, amMaximum: true, ungebremst: 0.24, gebucht: 0, verlust: 0.24, faktor: 1, grund: "maximum" }),
        attr({ attribute: "health", ungebremst: 0.1, gebucht: 0.05, verlust: 0.05, faktor: 0.55, grund: "achse" }),
      ],
      { verlustSumme: 0.29, verlustAnteil: 0.725 },
    );
    const b = bremseKurz(t)!;
    expect(b.verlustProzent).toBe(73);
    expect(b.attribute.map((a) => a.attribute)).toEqual(["will", "health"]);
    expect(b.mitMaximum).toBe(true);
    expect(b.text).toContain("am Maximum");
    expect(bremsGrundText(b.attribute[0]!)).toContain("Maximum 99");
    expect(bremsGrundText(b.attribute[1]!)).toContain("× 0,55");
  });
});
