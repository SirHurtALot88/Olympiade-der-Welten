/**
 * Durchklick-Test-Befund I-13: Der Preseason-Banner (läuft auf JEDER Seite mit)
 * zeigte unter „Grund anzeigen (5)" die rohen Enum-Codes
 * (`roster_after_market_plan_below_player_min`, `insufficient_cash`, …)
 * wörtlich im Spieler-UI.
 *
 * Diese Datei hält den Vertrag fest (Muster aus PR #457 /
 * formatNegotiationSignalLabel): bekannte Codes werden zu deutschen
 * Klartextsätzen, und ein UNBEKANNTER Code rutscht nie wieder roh durch —
 * er bekommt einen lesbaren Ersatztext.
 */
import { describe, expect, it, vi } from "vitest";

import { formatPreseasonBlockerLabel } from "@/lib/foundation/preseason-blocker-labels";

describe("formatPreseasonBlockerLabel", () => {
  it("übersetzt genau die fünf Codes aus dem Befund-Screenshot in deutsche Sätze", () => {
    const codes = [
      "roster_after_market_plan_below_player_min",
      "cash_after_market_plan_below_reserve",
      "insufficient_cash",
      "buy_preview_blocked",
      "cash_after_market_plan_not_positive",
    ];
    for (const code of codes) {
      const label = formatPreseasonBlockerLabel(code);
      expect(label, code).not.toContain("_");
      expect(label, code).not.toBe(code);
      // Klartext, nicht Feldname: jeder Satz trägt deutsche Wörter.
      expect(label, code).toMatch(/[a-zäöü] [A-Za-zÄÖÜäöü]/);
    }
  });

  it("zieht ein Team-Kürzel aus Suffix-Formen wie cash_strategy_missing:B-B", () => {
    const label = formatPreseasonBlockerLabel("cash_strategy_missing:B-B");
    expect(label).toContain("Team B-B");
    expect(label).not.toContain("cash_strategy_missing");
  });

  it("findet den Code auch in der Drossel-Form „A-A · aktion · code“", () => {
    const label = formatPreseasonBlockerLabel(
      "A-A · set_training_focus · ai_training_change_cadence_throttled",
    );
    expect(label).toContain("Team A-A");
    expect(label).toContain("gedrosselt");
    expect(label).not.toContain("ai_training_change_cadence_throttled");
  });

  it("zeigt für einen UNBEKANNTEN Code nie den rohen Enum-Namen", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const label = formatPreseasonBlockerLabel("some_future_blocker_code_v2");
      expect(label).not.toContain("some_future_blocker_code_v2");
      expect(label).not.toContain("_");
      expect(label.length).toBeGreaterThan(10);
      // … aber der fehlende Eintrag fällt in der Konsole auf.
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("some_future_blocker_code_v2"));
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("lässt die Registry-Sammelzeile „… +N weitere“ unverändert durch", () => {
    expect(formatPreseasonBlockerLabel("… +3 weitere")).toBe("… +3 weitere");
  });
});
