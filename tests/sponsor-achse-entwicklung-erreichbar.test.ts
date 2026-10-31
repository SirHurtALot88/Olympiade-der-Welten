import { describe, expect, it } from "vitest";

import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import { DEFAULT_ROSTER_MAX, getTeamPlayerMax } from "@/lib/foundation/roster-limits";
import { SPONSOR_V4_AXIS_KEYS, buildSponsorV4AxisTerms, evaluateSponsorV4Axis } from "@/lib/sponsor/sponsor-v4-axes";

/**
 * GEMELDET VON CHRIS (19.08., In-Game): „Als Ziel Entwicklung — 20 Spieler sollen sich entwickeln
 * und 6 MW dazu gewinnen? […] Dazu kommt 20 spieler kann man gar nicht haben???? Bitte das dringend
 * fixen und auf unsere systeme anpassen und messen."
 *
 * EINE ZIELMARKE, DIE UEBER DER SPIELGRENZE LIEGT, IST KEINE ZIELMARKE. `DEFAULT_ROSTER_MAX` ist 14
 * und `getTeamPlayerMax` klammert jedes Team dort hart ab; die Achse „Entwicklung" stand auf 20
 * Spielern. Der Test prueft die Regel, nicht die Zahl: KEINE Achse, die Spieler zaehlt, darf mehr
 * verlangen, als ein Kader ueberhaupt fassen kann.
 */
describe("Sponsor-Achsen: erreichbare Zielmarken", () => {
  const gameState = createSingleplayerGameState();

  it("verlangt von keiner Spieler-Achse mehr Spieler, als ein Kader fassen kann", () => {
    for (const team of gameState.teams) {
      const obergrenze = getTeamPlayerMax(team);
      for (const key of SPONSOR_V4_AXIS_KEYS) {
        const terms = buildSponsorV4AxisTerms(gameState, team.teamId, key);
        const fortschritt = evaluateSponsorV4Axis(gameState, team.teamId, terms);
        if (fortschritt.unit !== "Spieler") continue;
        expect(
          fortschritt.target,
          `Achse ${key} verlangt ${fortschritt.target} Spieler, Kaderobergrenze ist ${obergrenze}`,
        ).toBeLessThanOrEqual(obergrenze);
      }
    }
  });

  it("haelt die Marke fest bei 8, unabhaengig von der Kadergroesse", () => {
    // Stand bis 2026-08-xx: `scaleFor: min(14, max(8, Kadergroesse))` — skalierte die Marke MIT dem
    // Kader und bestrafte damit genau die Teams, die am meisten Spieler haben (s. Kommentar bei
    // `entwicklung` in sponsor-v4-axes.ts). Seitdem ist die Marke bewusst eine feste 8, fuer jeden
    // Kader gleich — dieser Test prueft genau das, nicht mehr die alte kadergroessen-Kopplung.
    for (const team of gameState.teams) {
      const terms = buildSponsorV4AxisTerms(gameState, team.teamId, "entwicklung");
      expect(terms.scale).toBe(8);
      expect(terms.scale).toBeLessThanOrEqual(DEFAULT_ROSTER_MAX);
    }
  });
});
