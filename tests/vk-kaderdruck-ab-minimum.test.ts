import { describe, expect, it } from "vitest";

import { buildSellPricingPolicyBreakdown } from "@/lib/market/transfermarkt-sell-pricing-policy";
import type { GameState } from "@/lib/data/olyDataTypes";

/**
 * DER KADERDRUCK BEIM VERKAUF BEGINNT AM MINIMUM, NICHT ERST DARUNTER — Ticket #38.
 *
 * GEMELDET VON CHRIS: „der VK Faktor soll schon ab 8 spielern beginnen, zumindest fuer die top und
 * bottom 2 spieler ungefaehr — selbe logik wie bisher aber auch!"
 *
 * WAS VORHER WAR: der Abschlag griff ausschliesslich UNTER dem Minimum. Bei einem Minimum von 8
 * hiess das — aus einem Neunmannkader verkaufen liess acht zurueck, also voller Preis. Einem Team,
 * das gerade seine letzte Reserve abgibt, sah der Markt keinerlei Not an. Erst der Verkauf aus dem
 * Achtmannkader (sieben zurueck, Kader nicht mehr spielfaehig) wurde bestraft.
 *
 * DIESER TEST PRUEFT WERTE, KEINE ZEICHENKETTEN: er ruft dieselbe Funktion auf, aus der das
 * Verkaufs-Panel und die Ausfuehrung ihren Faktor ziehen, und haelt die drei Stufen fest.
 */

function spielstand(overrides?: { cash?: number; playerMin?: number }): GameState {
  return {
    teams: [{ teamId: "A-A", name: "Alpha", cash: overrides?.cash ?? 25 }],
    teamIdentities: [{ teamId: "A-A", playerMin: overrides?.playerMin ?? 8 }],
    rosters: [],
    // `getTimingMultiplier` liest die Phase und den Transferfenster-Status. Fuer diesen Test ist
    // beides Beiwerk — geprueft wird `liquidationMalus`, der davon unabhaengig ist. Die Felder
    // stehen nur da, damit die Funktion ueberhaupt durchlaeuft.
    gamePhase: "transfer_sell_phase",
    seasonState: { schedule: [], disciplineSchedule: [], teamStrategyProfiles: {} },
    season: { id: "season-1", currentMatchday: 1, matchdayIds: [] },
    matchdayState: { matchdayId: "matchday-1", status: "planning" },
    players: [],
  } as never;
}

const BASIS = { factorSource: "ranked_group" } as never;

function faktor(rosterAfter: number, overrides?: { cash?: number }) {
  return buildSellPricingPolicyBreakdown({
    gameState: spielstand(overrides),
    teamId: "A-A",
    player: null,
    baseBreakdown: BASIS,
    rosterAfter,
  }).liquidationMalus;
}

describe("Verkauf: der Kaderdruck-Faktor", () => {
  it("laesst einen Kader MIT Reserve unberuehrt", () => {
    // Neun bleiben uebrig, das Minimum ist acht — ein Ersatzmann ist noch da.
    expect(faktor(9)).toBe(1);
    expect(faktor(12)).toBe(1);
  });

  it("greift GENAU AM Minimum — das ist der Kern der Meldung", () => {
    // Genau hier war vorher voller Preis: acht bleiben uebrig, das Minimum ist acht.
    expect(faktor(8)).toBeLessThan(1);
    expect(faktor(8)).toBe(0.95);
  });

  it("bleibt UNTER dem Minimum so hart wie bisher — „selbe logik wie bisher“", () => {
    expect(faktor(7)).toBe(0.9);
    // Die Stufe darunter muss haerter sein als die am Minimum, sonst waere die Reihenfolge
    // vertauscht: ein kaputter Kader duerfte nie besser dastehen als ein knapper.
    expect(faktor(7)).toBeLessThan(faktor(8));
  });

  it("multipliziert sich mit dem Minus-Konto, statt es zu ersetzen", () => {
    // Beide Notlagen zugleich sind schlimmer als eine — deshalb ein Produkt und keine Auswahl.
    expect(faktor(8, { cash: -5 })).toBeCloseTo(0.88 * 0.95, 3);
    expect(faktor(7, { cash: -5 })).toBeCloseTo(0.88 * 0.9, 3);
  });

  it("nennt am Minimum einen anderen Grund als darunter", () => {
    // „Kaderdruck" ohne Angabe, WELCHER, ist von einem Rechenfehler nicht zu unterscheiden.
    const amMinimum = buildSellPricingPolicyBreakdown({
      gameState: spielstand(),
      teamId: "A-A",
      player: null,
      baseBreakdown: BASIS,
      rosterAfter: 8,
    });
    const darunter = buildSellPricingPolicyBreakdown({
      gameState: spielstand(),
      teamId: "A-A",
      player: null,
      baseBreakdown: BASIS,
      rosterAfter: 7,
    });
    expect(amMinimum.notes.join(" ")).toMatch(/Minimum/);
    expect(amMinimum.notes.join(" ")).not.toEqual(darunter.notes.join(" "));
  });
});
