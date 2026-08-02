import { describe, expect, it } from "vitest";

import {
  classifySellPricingNoteWeight,
  classifySellReasonCategory,
  classifySellWarningWeight,
} from "@/app/foundation/transfermarkt-v2/transfer-sell-view-labels";

/**
 * Warning-/Reason-Gewichtsklassen fürs Verkaufs-Popup (Zonen D/E,
 * docs/design/verkauf-popup.md Abschnitt 3E). Getrennt von den
 * SSR-Rendertests in foundation-market-sell-shell-host.test.ts, weil die
 * Klassifikation selbst reine Logik ist (kein Rendering nötig).
 */
describe("classifySellWarningWeight — Einstufung nach Gewicht (Zone E)", () => {
  it("stuft die beiden Kader-Untergrenzen-Keys als Blocker ein", () => {
    expect(classifySellWarningWeight("team_would_fall_under_7")).toBe("blocker");
    expect(classifySellWarningWeight("team_would_fall_under_player_min")).toBe("blocker");
  });

  it("stuft die drei Achtung-Keys aus dem Entwurf korrekt ein", () => {
    expect(classifySellWarningWeight("team_would_fall_under_player_opt")).toBe("warn");
    expect(classifySellWarningWeight("team_readiness_would_get_worse")).toBe("warn");
    expect(classifySellWarningWeight("active_player_referenced_in_lineup")).toBe("warn");
  });

  it("stuft Readiness-Kontext-Keys als neutralen Hinweis ein, nicht als Achtung", () => {
    expect(classifySellWarningWeight("matchday_missing_for_readiness_preview")).toBe("info");
    expect(classifySellWarningWeight("readiness_context_unavailable_for_sell_preview")).toBe("info");
    expect(classifySellWarningWeight("readiness_context:some-detail")).toBe("info");
  });

  it("unbekannte Keys fallen defensiv auf Achtung — nie auf Blocker, nie auf Positiv", () => {
    // Genau die Garantie aus dem Entwurf: ein neuer, noch nicht kategorisierter
    // Warning-Key darf den Verkauf nie optisch sperren (Blocker) und nie als
    // gute Nachricht (good) durchgehen — beides wäre irreführend.
    const weight = classifySellWarningWeight("some_future_warning_key_nobody_mapped_yet");
    expect(weight).toBe("warn");
    expect(weight).not.toBe("blocker");
    expect(weight).not.toBe("good");
  });
});

describe("classifySellPricingNoteWeight — pricingPolicyNotes (freier Text, kein Key)", () => {
  it("stuft nur den Team-Fit-Satz als positiv (good) ein — nie als Blocker", () => {
    expect(classifySellPricingNoteWeight("Starker Team-Fit stützt den Verkaufspreis.")).toBe("good");
  });

  it("ein positiver Hinweis darf nie rot/blockierend wirken — alle anderen Notes bleiben neutraler Hinweis", () => {
    expect(classifySellPricingNoteWeight("Verkauf außerhalb des idealen Verkaufsfensters.")).toBe("info");
    expect(classifySellPricingNoteWeight("Schwacher Team-Fit drückt den Verkaufspreis.")).toBe("info");
    expect(classifySellPricingNoteWeight("Liquidations-/Kaderdruck reduziert den erzielbaren Preis.")).toBe("info");
  });
});

describe("classifySellReasonCategory — Kategorie-Tag in der Board-Bilanz (Zone D)", () => {
  it("erkennt Finanz-Gründe", () => {
    expect(classifySellReasonCategory("Cash-Reserve ist zu knapp für sichere Kaderplanung")).toBe("Finanzen");
    expect(classifySellReasonCategory("realisierbarer Netto-Gewinn von 0,1")).toBe("Finanzen");
  });

  it("erkennt Leistungs-Gründe", () => {
    expect(classifySellReasonCategory("Performance blieb unter Erwartung")).toBe("Leistung");
    expect(classifySellReasonCategory("Top-10-Präsenz in 1 Diszi-Einsätzen")).toBe("Leistung");
  });

  it("erkennt Vertrags-Gründe (Vertrag geht vor Finanzen, auch wenn 'Buyout' im Satz steht)", () => {
    expect(
      classifySellReasonCategory(
        "letztes Vertragsjahr — vorzeitiger Marktverkauf lohnt sich (Buyout-Wahrscheinlichkeit 60 %)",
      ),
    ).toBe("Vertrag");
    expect(classifySellReasonCategory("kurze Restvertragslänge")).toBe("Vertrag");
  });

  it("fällt für Strategie-/Teamfit-Gründe auf Strategie zurück", () => {
    expect(classifySellReasonCategory("passt nur schwach zum Teamprofil")).toBe("Strategie");
    expect(classifySellReasonCategory("fällt in ein Team-Hard-No-Go")).toBe("Strategie");
  });
});
