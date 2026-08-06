/**
 * GEMELDET AUS DEM SPIEL: "es ist nach MD10 aber Verkaeufe sind immernoch geblockt! sobald alle
 * diszis durch sind und bepunktet sind waere eigentlich end of season dran mit awards usw."
 *
 * Der Kern des Fehlers war nicht das Verkaufs-Gate, sondern eine Sackgasse in der Phasenkette:
 * `preseason_management` und `transfer_sell_phase` — die einzigen Phasen, in denen Verkaufen
 * oeffnet — wurden im normalen Spiel nie gesetzt.
 */
import { describe, expect, it } from "vitest";

import type { GamePhase } from "@/lib/data/olyDataTypes";
import { evaluateGamePhaseAction } from "@/lib/foundation/game-phase-action-policy";
import { getNextStepAfter, getPhaseAfterStep, isStepBehind } from "@/lib/season/season-transition-chain";
import { SEASON_TRANSITION_STEPS } from "@/lib/season/season-transition-steps";

describe("Die Kette fuehrt vom Saisonende bis zur neuen Saison", () => {
  it("laesst keinen Schritt ohne Anschluss — ausser dem letzten", () => {
    for (const step of SEASON_TRANSITION_STEPS) {
      if (step === "next_season_ready") {
        // Ende der Kette: die neue Saison legt der Pre-Season-Workflow an, nicht dieser Weg.
        expect(getPhaseAfterStep(step)).toBeNull();
        expect(getNextStepAfter(step)).toBeNull();
        continue;
      }
      expect(getPhaseAfterStep(step), `Schritt ohne Folgephase: ${step}`).not.toBeNull();
      expect(getNextStepAfter(step), `Schritt ohne Folgeschritt: ${step}`).not.toBeNull();
    }
  });

  /**
   * Der eigentliche Beweis: einmal durch die Kette laufen und pruefen, dass die Verkaufsphase
   * dabei WIRKLICH erreicht wird. Genau das ging vorher nicht.
   */
  it("erreicht die Verkaufsphase — der gemeldete Fehler", () => {
    const besuchte: GamePhase[] = [];
    let step: (typeof SEASON_TRANSITION_STEPS)[number] | null = "season_check";
    while (step) {
      const phase = getPhaseAfterStep(step);
      if (phase) besuchte.push(phase);
      step = getNextStepAfter(step);
    }

    expect(besuchte).toContain("transfer_sell_phase");
    expect(besuchte).toContain("season_rewards"); // die Awards, die nie liefen
    expect(besuchte[besuchte.length - 1]).toBe("next_season_ready");
  });

  it("die erreichten Phasen oeffnen Verkauf und Kauf tatsaechlich", () => {
    // Saisonende nachgestellt: letzter Spieltag gerechnet, Ergebnis liegt vor.
    const mkState = (phase: GamePhase) =>
      ({
        gamePhase: phase,
        season: { id: "s1", currentMatchday: 10, matchdayIds: Array.from({ length: 10 }, (_, i) => `md-${i + 1}`) },
        matchdayState: { matchdayId: "md-10", status: "resolved" },
        seasonState: { matchdayResults: [{ seasonId: "s1", matchdayId: "md-10" }] },
      }) as never;

    expect(evaluateGamePhaseAction(mkState("transfer_sell_phase"), "sell_players").allowed).toBe(true);
    expect(evaluateGamePhaseAction(mkState("preseason_management"), "sell_players").allowed).toBe(true);

    // Die Kette oeffnet das VERKAUFEN — mehr nicht. Gekauft wird erst in der neuen Saison vor
    // ihrem ersten Spieltag, also hinter „Neue Saison starten" und damit ausserhalb dieser Kette.
    // `transfer_buy_phase` ist die Station der KI (`season-transition-service`: „AI-Käufe laufen
    // nach Verkäufen über Buy-Service"), nicht die des Spielers.
    expect(evaluateGamePhaseAction(mkState("transfer_buy_phase"), "buy_players").allowed).toBe(false);
    const neueSaison = {
      gamePhase: "season_active",
      season: { id: "s2", currentMatchday: 1, matchdayIds: Array.from({ length: 10 }, (_, i) => `s2-md-${i + 1}`) },
      matchdayState: { matchdayId: "s2-md-1", status: "open" },
      seasonState: { matchdayResults: [] },
    } as never;
    expect(evaluateGamePhaseAction(neueSaison, "buy_players").allowed).toBe(true);
    expect(evaluateGamePhaseAction(neueSaison, "sell_players").allowed, "im Saisonstart wird nicht verkauft").toBe(false);

    // Gegenprobe: die drei Phasen, auf die das Spiel vorher beschraenkt war, bleiben zu —
    // die Lockerung darf NICHT bedeuten, dass mitten in der Saison verkauft werden kann.
    for (const phase of ["season_active", "season_completed", "season_review"] as GamePhase[]) {
      expect(evaluateGamePhaseAction(mkState(phase), "sell_players").allowed, `${phase} darf zu bleiben`).toBe(false);
    }
  });

  it("erkennt durchlaufene Schritte an der Position, nicht an der Historie", () => {
    // Saves aus dem Admin-Runner oder aus einem Import haben eine gueltige Phase, aber keine
    // `completedSteps` — die Position in der Kette ist der belastbare Massstab.
    expect(isStepBehind("season_review", "transfer_sell_phase")).toBe(true);
    expect(isStepBehind("transfer_buy_phase", "transfer_sell_phase")).toBe(false);
    expect(isStepBehind("transfer_sell_phase", "transfer_sell_phase")).toBe(false);
  });
});
