import { describe, expect, it } from "vitest";
import { classifyArticle, type ClassificationInput } from "./classification";

/** Default-Input mit vernuenftigen Fix-1/Fix-3-Neutralwerten, damit bestehende
 * Faelle unveraendert bleiben -- einzelne Tests ueberschreiben gezielt `stock`/`ekMissing`. */
function input(overrides: Partial<ClassificationInput> = {}): ClassificationInput {
  return {
    qty30d: 0,
    qty90d: 0,
    qty365d: 0,
    qtyAllTime: 0,
    dbIIPercent: 0,
    stock: 0,
    ekMissing: false,
    ...overrides,
  };
}

describe("classifyArticle", () => {
  it("erkennt Ladenhueter (Historie vorhanden, aber 0 Verkaeufe in 365T)", () => {
    const result = classifyArticle(input({ qtyAllTime: 12, dbIIPercent: 0.2 }));
    expect(result.articleClass).toBe("ladenhueter");
  });

  it("erkennt Low-Runner (negative DB II) trotz Verkaeufen", () => {
    const result = classifyArticle(
      input({ qty30d: 3, qty90d: 10, qty365d: 25, qtyAllTime: 25, dbIIPercent: -0.47 })
    );
    expect(result.articleClass).toBe("low_runner");
  });

  it("erkennt 'Faellt ab' fuer eingebrochene Bundle-Renner (KONZEPT §2 Beispiel)", () => {
    // "100 Karten Sammlung": frueher ~20 Verkaeufe/Jahr, aktuell (90d-Run-Rate
    // hochgerechnet) nur noch ~4/Jahr -- deutlicher Einbruch, aber 0 im 30d-Fenster.
    const result = classifyArticle(input({ qty90d: 1, qty365d: 20, qtyAllTime: 80, dbIIPercent: 0.3 }));
    expect(result.articleClass).toBe("faellt_ab");
  });

  it("erkennt Champion (hohe 30d-Velocity + gute Marge)", () => {
    const result = classifyArticle(
      input({ qty30d: 3, qty90d: 9, qty365d: 35, qtyAllTime: 35, dbIIPercent: 0.3 })
    );
    expect(result.articleClass).toBe("champion");
  });

  it("erkennt Solide (regelmaessig, aber kein Champion-Niveau)", () => {
    const result = classifyArticle(input({ qty30d: 1, qty90d: 2, qty365d: 6, qtyAllTime: 6, dbIIPercent: 0.15 }));
    expect(result.articleClass).toBe("solide");
  });

  it("faellt auf Beobachten zurueck bei wenig Daten", () => {
    const result = classifyArticle(input({ qty365d: 1, qtyAllTime: 1, dbIIPercent: 0.2 }));
    expect(result.articleClass).toBe("beobachten");
  });

  // --- FIX 1 Regressionstest -----------------------------------------------
  it("REGRESSION FIX 1: klassifiziert NIE als Champion, wenn der EK fehlt (Phantom-Marge)", () => {
    // Ohne den Fix wuerde dbIIPercent=0.3 (Phantom-Marge, weil ek=0 -> dbI=Umsatz)
    // bei qty30d>=2 als "champion" durchgehen und eine Nachkauf-Empfehlung fuer
    // einen Artikel ohne bekannten Einkaufspreis erzeugen.
    const withoutEk = classifyArticle(
      input({ qty30d: 3, qty90d: 9, qty365d: 35, qtyAllTime: 35, dbIIPercent: 0.3, ekMissing: true })
    );
    expect(withoutEk.articleClass).not.toBe("champion");

    // Gegenprobe: identische Kennzahlen, aber EK bekannt -> Champion bleibt erlaubt.
    const withEk = classifyArticle(
      input({ qty30d: 3, qty90d: 9, qty365d: 35, qtyAllTime: 35, dbIIPercent: 0.3, ekMissing: false })
    );
    expect(withEk.articleClass).toBe("champion");
  });

  // --- FIX 3 Regressionstest -----------------------------------------------
  it("REGRESSION FIX 3: Bestand > 0 ohne JEDE Verkaufshistorie ist Ladenhueter, nicht Beobachten", () => {
    // Ohne den Fix (qtyAllTime > 0 als einzige Bedingung) landet ein Artikel, der
    // sich noch nie verkauft hat (qtyAllTime === 0), aber Lagerbestand hat, in
    // "beobachten" -- genau das tote Kapital, das Chris sehen will, faellt raus.
    const neverSoldWithStock = classifyArticle(input({ stock: 5, dbIIPercent: 0 }));
    expect(neverSoldWithStock.articleClass).toBe("ladenhueter");

    // Gegenprobe: kein Bestand UND keine Historie -> bleibt "beobachten" (unveraendert).
    const neverSoldNoStock = classifyArticle(input({ stock: 0, dbIIPercent: 0 }));
    expect(neverSoldNoStock.articleClass).toBe("beobachten");
  });

  it("REGRESSION FIX 3: kollidiert nicht mit 'faellt_ab' (das braucht qty365d > 0)", () => {
    // qty365d >= 4 ist Voraussetzung fuer "faellt_ab" -- ein Ladenhueter (qty365d===0)
    // kann diesen Zweig nie erreichen, unabhaengig vom Bestand.
    const result = classifyArticle(input({ stock: 20, qtyAllTime: 0, dbIIPercent: 0.3 }));
    expect(result.articleClass).toBe("ladenhueter");
  });
});
