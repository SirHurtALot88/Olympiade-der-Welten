import { describe, expect, it } from "vitest";

import { baueDisziplinBedarf, bedarfUrteil, schnittVorkommen } from "@/lib/market/transfermarkt-disziplin-bedarf";
import {
  berechneFreigabeAnzeige,
  erloesFreigabe,
  freigabeKosten,
  freigabeQuoteAusVertrauen,
  freigabeSperre,
} from "@/lib/market/transfermarkt-freigabe";

describe("Vorstand-Freigabe (Datenvertrag)", () => {
  it("ohne Daten gibt es keine Anzeige und keine Sperre", () => {
    expect(berechneFreigabeAnzeige(50, null)).toBeNull();
    expect(freigabeSperre(null, 999)).toBeNull();
  });

  it("zeigt Kontostand, freigegeben, ausgegeben, frei und gesperrt", () => {
    const a = berechneFreigabeAnzeige(100, { quote: 0.7, freigegeben: 70, ausgegeben: 20, grund: "Vertrauen 3,4" })!;
    expect(a.frei).toBe(50);
    expect(a.gesperrt).toBe(50);
    expect(a.kontostand).toBe(100);
  });

  it("Sperre ist hart: Ablöse plus Gehalt über dem freien Betrag sperrt den Abschluss", () => {
    const a = berechneFreigabeAnzeige(100, { quote: 0.7, freigegeben: 70, ausgegeben: 20, grund: null })!;
    expect(freigabeSperre(a, freigabeKosten(40, 9))).toBeNull();
    expect(freigabeSperre(a, freigabeKosten(45, 10))).toContain("Freigabe");
  });

  it("Verkaufserlös wird nur zur Quote frei: bei 70 % von 20 C sind 14 C frei, 6 C gesperrt", () => {
    expect(erloesFreigabe(20, 0.7)).toEqual({ frei: 14, gesperrt: 6 });
  });

  it("Stufen nach Vertrauen", () => {
    expect([6.4, 6, 5, 4, 3.4, 2.5, 2.4, 0].map(freigabeQuoteAusVertrauen)).toEqual([1, 1, 0.85, 0.85, 0.7, 0.7, 0.5, 0.5]);
  });
});

describe("Disziplin-Bedarf aus dem Spielplan", () => {
  const spielplan = [
    [{ disciplineId: "hockey", playerCount: 6 }, { disciplineId: "tennis", playerCount: 2 }],
    [{ disciplineId: "hockey", playerCount: 6 }, { disciplineId: "fechten", playerCount: 1 }],
    [{ disciplineId: "tennis", playerCount: 2 }, null],
  ];
  const bedarf = baueDisziplinBedarf(spielplan);

  it("zählt Vorkommen und Slots", () => {
    expect(bedarf.hockey).toMatchObject({ vorkommen: 2, slots: 6, wichtigkeit: 12 });
    expect(bedarf.fechten).toMatchObject({ vorkommen: 1, slots: 1, wichtigkeit: 1 });
  });

  it("Hinweis: häufig, aber schwach besetzt", () => {
    const schnitt = schnittVorkommen(bedarf);
    expect(bedarfUrteil({ eintrag: bedarf.hockey, schnittVorkommen: schnitt, rang: 12, ligaGroesse: 16 }).art).toBe("luecke");
    expect(bedarfUrteil({ eintrag: bedarf.hockey, schnittVorkommen: schnitt, rang: 2, ligaGroesse: 16 }).art).toBe("stark");
    expect(bedarfUrteil({ eintrag: bedarf.fechten, schnittVorkommen: schnitt, rang: 14, ligaGroesse: 16 }).art).toBe("selten");
    expect(bedarfUrteil({ eintrag: undefined, schnittVorkommen: 1, rang: 1, ligaGroesse: 16 }).art).toBe("offen");
  });
});
