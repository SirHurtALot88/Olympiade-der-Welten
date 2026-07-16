import { describe, expect, it } from "vitest";
import { classifyArticle } from "./classification";

describe("classifyArticle", () => {
  it("erkennt Ladenhueter (Historie vorhanden, aber 0 Verkaeufe in 365T)", () => {
    const result = classifyArticle({ qty30d: 0, qty90d: 0, qty365d: 0, qtyAllTime: 12, dbIIPercent: 0.2 });
    expect(result.articleClass).toBe("ladenhueter");
  });

  it("erkennt Low-Runner (negative DB II) trotz Verkaeufen", () => {
    const result = classifyArticle({ qty30d: 3, qty90d: 10, qty365d: 25, qtyAllTime: 25, dbIIPercent: -0.47 });
    expect(result.articleClass).toBe("low_runner");
  });

  it("erkennt 'Faellt ab' fuer eingebrochene Bundle-Renner (KONZEPT §2 Beispiel)", () => {
    // "100 Karten Sammlung": frueher ~20 Verkaeufe/Jahr, aktuell (90d-Run-Rate
    // hochgerechnet) nur noch ~4/Jahr -- deutlicher Einbruch, aber 0 im 30d-Fenster.
    const result = classifyArticle({ qty30d: 0, qty90d: 1, qty365d: 20, qtyAllTime: 80, dbIIPercent: 0.3 });
    expect(result.articleClass).toBe("faellt_ab");
  });

  it("erkennt Champion (hohe 30d-Velocity + gute Marge)", () => {
    const result = classifyArticle({ qty30d: 3, qty90d: 9, qty365d: 35, qtyAllTime: 35, dbIIPercent: 0.3 });
    expect(result.articleClass).toBe("champion");
  });

  it("erkennt Solide (regelmaessig, aber kein Champion-Niveau)", () => {
    const result = classifyArticle({ qty30d: 1, qty90d: 2, qty365d: 6, qtyAllTime: 6, dbIIPercent: 0.15 });
    expect(result.articleClass).toBe("solide");
  });

  it("faellt auf Beobachten zurueck bei wenig Daten", () => {
    const result = classifyArticle({ qty30d: 0, qty90d: 0, qty365d: 1, qtyAllTime: 1, dbIIPercent: 0.2 });
    expect(result.articleClass).toBe("beobachten");
  });
});
