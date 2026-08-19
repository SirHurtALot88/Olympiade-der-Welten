import { describe, expect, it } from "vitest";

import type { GameState, SponsorOfferComponent } from "@/lib/data/olyDataTypes";
import { beschreibeSonderziel } from "@/lib/sponsor/sponsor-objective-evaluator";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import { sponsorV4AxisSpecialKey } from "@/lib/sponsor/sponsor-v4-axes";

/**
 * GEMELDET VON CHRIS: „Ich habe als Saisonziel den Ausbau von 2 Gebäuden meiner Wahl — das habe ich
 * bereits erledigt. Da würde ich erwarten, dass das Ziel schon als abgeschlossen da steht."
 *
 * ZWEI FEHLER IN EINER ZEILE. Der Board-Bauer las den BINAEREN Alt-Bewerter
 * (`evaluateSpecialComponentForObjective`); der kennt die V4-Zielachsen nicht und faellt fuer jede
 * von ihnen bis zum abschliessenden `return "open"` durch — ein Achsen-Ziel konnte NIE erfuellt
 * aussehen. Und er reichte den rohen `targetValue` durch, sodass auf dem Bildschirm woertlich
 * `axisbase:2;axisscale:2;axisoffset:0` stand.
 */
function mitGebaeudestufen(gameState: GameState, teamId: string, stufen: Record<string, number>): GameState {
  const bestand = gameState.seasonState.teamFacilities ?? {};
  const eigene = bestand[teamId] ?? { facilities: {} };
  return {
    ...gameState,
    seasonState: {
      ...gameState.seasonState,
      teamFacilities: {
        ...bestand,
        [teamId]: {
          ...eigene,
          facilities: Object.fromEntries(
            Object.entries(stufen).map(([facilityId, level]) => [
              facilityId,
              { level, enabled: true, conditionPct: 100 },
            ]),
          ),
        },
      },
    },
  };
}

/** Genau Chris' Karte: Ausgangslage 0, Ziel 2 Stufen. */
const ausbauKarte: SponsorOfferComponent = {
  componentId: "axis-target",
  kind: "special",
  specialKey: sponsorV4AxisSpecialKey("ausbau"),
  label: "Zielachse · Ausbau",
  targetValue: "axisbase:0;axisscale:2;axisoffset:0",
  stages: undefined,
  rewardCash: 0,
};

describe("Zielachse als Board-Ziel", () => {
  const start = createSingleplayerGameState();
  const teamId = start.teams[0]!.teamId;

  it("nennt die Zielmarke in Worten statt in Konfigurationstext", () => {
    const stand = beschreibeSonderziel(start, teamId, ausbauKarte);
    expect(stand.zielText).toBe("2 Stufen");
    expect(stand.zielText).not.toContain("axisbase");
    expect(stand.standText).not.toContain("axisbase");
  });

  it("setzt Zahl und Einheit auseinander — nicht „0Stufen“", () => {
    const stand = beschreibeSonderziel(start, teamId, ausbauKarte);
    expect(stand.standText).toBe("Ausbau 0 Stufen von 2 Stufen");
  });

  it("steht auf abgeschlossen, sobald die zwei Stufen stehen", () => {
    const gebaut = mitGebaeudestufen(start, teamId, { fan_shop: 1, recovery_center: 1 });
    const stand = beschreibeSonderziel(gebaut, teamId, ausbauKarte);
    expect(stand.fraction).toBe(1);
    expect(stand.status).toBe("completed");
    expect(stand.standText).toBe("Ausbau 2 Stufen von 2 Stufen");
  });

  it("meldet den Zwischenstand als angefangen, nicht als offen", () => {
    const halb = mitGebaeudestufen(start, teamId, { fan_shop: 1 });
    expect(beschreibeSonderziel(halb, teamId, ausbauKarte).status).toBe("at_risk");
  });
});
