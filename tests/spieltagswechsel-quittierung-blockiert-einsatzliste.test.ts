/**
 * GEMELDET VON CHRIS (mit Bild des roten Hauptknopfes): „die funktion ist quatsch man ist ja schon
 * im naechsten spieltag, hier muesste man dann zur einsatzliste kommen" — und nachgeschoben, mit
 * dem entscheidenden Hinweis auf die Schwere: „er will zum naechsten spieltag schalten und dann
 * haengt die einsatzliste wegen dem button".
 *
 * Das brach den Spielverlauf: Der Hauptknopf bot „Zum naechsten Spieltag" an, war aber im frischen
 * Spieltag mangels Ergebnis BLOCKIERT — also nicht drueckbar. Gleichzeitig war der Weg zur
 * Einsatzliste aus dem Ablauf verschwunden. Aus dem normalen Spielverlauf gab es keinen Weg weiter.
 *
 * Die Ursache lag nicht im Knopf, sondern eine Ebene davor: Quittierte Ablauf-Schritte werden aus
 * der Auswahl gefiltert, und die Quittierungen des ALTEN Spieltags galten im ersten Render des
 * neuen noch mit — der Effekt, der sie leert, laeuft erst nach dem Render. „Einsatzliste stellen"
 * war vom Vorspieltag abgehakt, fiel damit heraus, und uebrig blieb der blockierte Weiter-Knopf.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { resolveGameFlowActionStep } from "@/lib/foundation/resolve-game-flow-action-step";
import type { GameFlowStep } from "@/lib/foundation/game-flow-controller";

const hook = readFileSync(
  join(process.cwd(), "lib/foundation/tabs/use-foundation-cross-tab-game-flow.ts"),
  "utf8",
);

const step = (stepId: string, status: GameFlowStep["status"]): GameFlowStep =>
  ({ stepId, status, label: stepId, cta: stepId }) as GameFlowStep;

/** Die Schritte, wie sie im ERSTEN Render eines frischen Spieltags stehen. */
function schritteImFrischenSpieltag(): GameFlowStep[] {
  return [
    step("finalize_transfers", "completed"),
    step("set_lineup", "ready"),
    step("confirm_lineup", "blocked"),
    step("open_arena", "blocked"),
    step("advance_to_next_matchday", "blocked"),
  ];
}

/** Bildet die Filterung des Hooks nach: quittierte, nicht blockierte Schritte fallen heraus. */
function auswahl(steps: GameFlowStep[], quittiert: Set<string>) {
  return steps.filter(
    (entry) => entry.status !== "completed" && !(entry.status !== "blocked" && quittiert.has(entry.stepId)),
  );
}

describe("Spieltagswechsel: die Einsatzliste bleibt erreichbar", () => {
  it("fuehrt im frischen Spieltag zur Einsatzliste", () => {
    const steps = schritteImFrischenSpieltag();
    const gewaehlt = resolveGameFlowActionStep(auswahl(steps, new Set()), steps[1]!, new Set());
    expect(gewaehlt.stepId).toBe("set_lineup");
  });

  it("BELEGT DEN FEHLER: mit den Quittierungen des Vorspieltags gewinnt der blockierte Weiter-Knopf", () => {
    // Genau der Zustand, den Chris gesehen hat. Diese Erwartung beschreibt das kaputte Verhalten —
    // sie ist der Grund, warum die Quittierungen an ihren Zyklus gebunden gehoeren.
    const steps = schritteImFrischenSpieltag();
    const vomVorspieltag = new Set(["set_lineup"]);
    const gewaehlt = resolveGameFlowActionStep(auswahl(steps, vomVorspieltag), steps[1]!, vomVorspieltag);

    expect(gewaehlt.stepId).toBe("advance_to_next_matchday");
    // Und er ist nicht drueckbar — deshalb „haengt" es.
    expect(gewaehlt.status).toBe("blocked");
  });

  it("bindet die Quittierungen im Render an den Zyklus, nicht erst im Effekt", () => {
    // Der Effekt leert sie erst NACH dem Render — genau dieser eine Render war der Fehler.
    expect(hook).toContain("const acknowledgedFlowStepIds = useMemo(");
    expect(hook).toContain("flowCycleKeyState === flowCycleKey ? acknowledgedFlowStepIdsState : new Set<string>()");
  });

  it("laesst den Zyklusschluessel den Spieltag enthalten", () => {
    // Ohne den Spieltag im Schluessel wuerde gar nicht zurueckgesetzt.
    expect(hook).toContain("gameState.matchdayState.matchdayId");
  });
});
