/**
 * Das Leih-Overlay: was ein geliehenes Gebäude über dem eigenen Bestand bedeutet.
 *
 * Die drei Eigenschaften, an denen alles haengt: die Leihe ist ein BODEN und keine Decke, eine
 * ruhende Leihe zaehlt gar nicht, und der Zustand ist eine Eigenschaft der Leihgabe — dieselbe
 * Stufe kann neu oder gebraucht kommen.
 */
import { describe, expect, it } from "vitest";

import type { TeamFacilityCollection } from "@/lib/data/olyDataTypes";
import {
  altereLeihgabe,
  berechneLeihWirkung,
  beschreibeLeihgabe,
  legeLeihgabenUeberBestand,
} from "@/lib/sponsor/sponsor-leih-overlay";

function bestand(facilities: Record<string, { level: number; conditionPct?: number }>): TeamFacilityCollection {
  return {
    facilities: Object.fromEntries(
      Object.entries(facilities).map(([id, wert]) => [
        id,
        { level: wert.level, enabled: wert.level > 0, conditionPct: wert.conditionPct ?? 100 },
      ]),
    ),
  };
}

describe("wirksame Stufe", () => {
  it("nimmt die Leihe, wenn sie besser ist als der eigene Bestand", () => {
    const wirkung = berechneLeihWirkung({
      eigen: { level: 1, conditionPct: 100 },
      leihgabe: { facilityId: "training_center", stufe: 4, zustandPct: 100 },
    });
    expect(wirkung.effektiveStufe).toBe(4);
    expect(wirkung.quelle).toBe("geliehen");
  });

  it("ist ein Boden, keine Decke — wer selbst hoeher gebaut hat, verliert nichts", () => {
    const wirkung = berechneLeihWirkung({
      eigen: { level: 4, conditionPct: 90 },
      leihgabe: { facilityId: "training_center", stufe: 2, zustandPct: 100 },
    });
    expect(wirkung.effektiveStufe).toBe(4);
    expect(wirkung.quelle).toBe("eigen");
    expect(wirkung.effektiverZustandPct).toBe(90);
  });

  it("zaehlt eine ruhende Leihe gar nicht — auch wenn der eigene Bestand 0 ist", () => {
    const wirkung = berechneLeihWirkung({
      eigen: { level: 0, conditionPct: 100 },
      leihgabe: { facilityId: "recovery_center", stufe: 3, zustandPct: 100, ruht: true },
    });
    expect(wirkung.effektiveStufe).toBe(0);
    expect(wirkung.effizienzPct).toBe(0);
    expect(wirkung.quelle).toBe("eigen");
  });

  it("traegt den Zustand der Leihgabe, nicht den des eigenen Bestands", () => {
    // Genau das ist die Vertragsvariable: zwei Karten, dieselbe Stufe, verschiedener Wert.
    const neu = berechneLeihWirkung({
      eigen: { level: 0 },
      leihgabe: { facilityId: "recovery_center", stufe: 3, zustandPct: 100 },
    });
    const gebraucht = berechneLeihWirkung({
      eigen: { level: 0 },
      leihgabe: { facilityId: "recovery_center", stufe: 3, zustandPct: 40 },
    });

    expect(neu.effektiveStufe).toBe(gebraucht.effektiveStufe);
    expect(neu.effizienzPct).toBe(100);
    expect(gebraucht.effizienzPct).toBeLessThan(100);
  });
});

describe("Overlay ueber den Bestand", () => {
  it("gibt die Sammlung unveraendert zurueck, wenn nichts geliehen ist", () => {
    const eigen = bestand({ training_center: { level: 2 } });
    expect(legeLeihgabenUeberBestand(eigen, [])).toBe(eigen);
    expect(legeLeihgabenUeberBestand(eigen, [{ facilityId: "recovery_center", stufe: 3, zustandPct: 100, ruht: true }])).toBe(eigen);
  });

  it("hebt nur das geliehene Gebaeude an und laesst die uebrigen in Ruhe", () => {
    const eigen = bestand({ training_center: { level: 1, conditionPct: 60 }, fan_shop: { level: 2 } });
    const ueberlegt = legeLeihgabenUeberBestand(eigen, [
      { facilityId: "training_center", stufe: 4, zustandPct: 85 },
    ]);

    expect(ueberlegt.facilities.training_center?.level).toBe(4);
    expect(ueberlegt.facilities.training_center?.conditionPct).toBe(85);
    expect(ueberlegt.facilities.training_center?.enabled).toBe(true);
    // Unberuehrt.
    expect(ueberlegt.facilities.fan_shop?.level).toBe(2);
    // Und die Quelle bleibt unveraendert — kein Schreiben in den uebergebenen Bestand.
    expect(eigen.facilities.training_center?.level).toBe(1);
  });

  it("laesst den eigenen Bestand stehen, wenn er besser ist", () => {
    const eigen = bestand({ training_center: { level: 5, conditionPct: 95 } });
    const ueberlegt = legeLeihgabenUeberBestand(eigen, [
      { facilityId: "training_center", stufe: 3, zustandPct: 100 },
    ]);
    expect(ueberlegt.facilities.training_center?.level).toBe(5);
    expect(ueberlegt.facilities.training_center?.conditionPct).toBe(95);
  });
});

describe("Alterung und Anzeige", () => {
  it("altert die Leihgabe und faellt nicht unter null", () => {
    const leihgabe = { facilityId: "recovery_center" as const, stufe: 3, zustandPct: 20 };
    expect(altereLeihgabe(leihgabe, 17).zustandPct).toBe(3);
    expect(altereLeihgabe(leihgabe, 90).zustandPct).toBe(0);
  });

  it("beschreibt die Leihgabe so, wie sie auf der Karte stehen soll", () => {
    expect(beschreibeLeihgabe({ facilityId: "fan_shop", stufe: 3, zustandPct: 100 })).toContain("neuwertig");
    expect(beschreibeLeihgabe({ facilityId: "fan_shop", stufe: 3, zustandPct: 76 })).toContain("76 % Zustand");
    expect(beschreibeLeihgabe({ facilityId: "fan_shop", stufe: 3, zustandPct: 76, ruht: true })).toContain("ruht");
  });
});
