/**
 * NACHWEIS: DIE AUSWERTUNG DER ALT-ZIEL-SCHLUESSEL FUNKTIONIERT WEITER, OBWOHL SIE NICHTS MEHR ERZEUGT.
 *
 * `lib/sponsor/sponsor-special-objectives.ts` hat seit 2026-08 keinen Bonus-/Golden-Ziel-Katalog mehr
 * (Audit-Befund: scripts/sponsor-ziele-audit.ts — 1024 gemessene Angebots-Komponenten, ALLE eine
 * V4-Achse, KEINE ein Katalog-Ziel). 32 bereits UNTERSCHRIEBENE Vertraege in echten Spielstaenden
 * tragen aber weiterhin Alt-Ziel-Schluessel aus genau diesem Katalog. Dieser Test ist der direkte
 * Nachweis, dass `evaluateSpecialComponentStage` (lib/sponsor/sponsor-objective-evaluator.ts) sie ohne
 * Wurf auswertet — kein Zugriff auf einen inzwischen entfernten Picker/Katalog, keine Exception, ein
 * Anteil im gueltigen Bereich [0, 1]. Ergaenzt um einen unbekannten Schluessel, der saubar auf 0 faellt
 * statt zu werfen (Alt-Vertrag mit einem Key, den auch die Auswertung nie kannte).
 */
import { describe, expect, it } from "vitest";

import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import { evaluateSpecialComponentStage } from "@/lib/sponsor/sponsor-objective-evaluator";
import type { GameState, SponsorOfferComponent } from "@/lib/data/olyDataTypes";

/** Baut eine Vertragskomponente mit dem gegebenen Alt-Ziel-Schluessel, ohne einen Katalog zu brauchen. */
function altZielKomponente(specialKey: string, targetValue: SponsorOfferComponent["targetValue"]): SponsorOfferComponent {
  return {
    componentId: `special-${specialKey}`,
    kind: "special",
    label: specialKey,
    targetValue,
    rewardCash: 5,
    specialKey,
  };
}

describe("Alt-Ziel-Schluessel bleiben auswertbar (ohne Erzeugungs-Katalog)", () => {
  const gs: GameState = createSingleplayerGameState();
  const teamId = gs.teams[0]!.teamId;

  // Der Save aus dem Audit traegt diese vier Schluessel am haeufigsten (form_color_cover 5x,
  // axis_rank_top 7x, salary_pressure_max 4x, axis_ascension 4x von 32 Vertragskomponenten) — sie
  // decken zugleich alle drei targetValue-Formen ab (Zahl/String, "achse:rang", freier String).
  const altZiele: Array<{ specialKey: string; targetValue: SponsorOfferComponent["targetValue"] }> = [
    { specialKey: "form_color_cover", targetValue: "5 Klassen" },
    { specialKey: "axis_rank_top", targetValue: "pow:5" },
    { specialKey: "salary_pressure_max", targetValue: 60 },
    { specialKey: "axis_ascension", targetValue: "men:8" },
  ];

  for (const { specialKey, targetValue } of altZiele) {
    it(`wertet "${specialKey}" ohne Wurf mit Anteil in [0, 1] aus`, () => {
      const component = altZielKomponente(specialKey, targetValue);
      let result: ReturnType<typeof evaluateSpecialComponentStage>;
      expect(() => {
        result = evaluateSpecialComponentStage(gs, teamId, component);
      }).not.toThrow();
      expect(result!.fraction).toBeGreaterThanOrEqual(0);
      expect(result!.fraction).toBeLessThanOrEqual(1);
      expect(Number.isNaN(result!.fraction)).toBe(false);
    });
  }

  it('faellt bei einem unbekannten Sonderziel-Schluessel sauber auf 0, statt zu werfen', () => {
    const component = altZielKomponente("dieser_key_hat_nie_existiert", "irgendwas");
    let result: ReturnType<typeof evaluateSpecialComponentStage>;
    expect(() => {
      result = evaluateSpecialComponentStage(gs, teamId, component);
    }).not.toThrow();
    expect(result!.fraction).toBe(0);
  });
});
