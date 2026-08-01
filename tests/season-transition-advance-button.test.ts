/**
 * GEMELDET: „der blocker beim verkaufen am saisonende ist auch immernoch da! ich hänge in MD10,
 * wie komme ich sauber in den nächsten schritt" — und dazu der Changelog-Eintrag zu #298, der
 * genau das als behoben ausweist.
 *
 * BEFUND: #298 baute die Kette vollstaendig — `SEASON_TRANSITION_STEPS`, `getPhaseAfterStep`,
 * `canApply`, die Route-Aktion `advance_step`, den Handler. Am echten Spielstand (Phase
 * `season_completed`, MD10 aufgeloest) meldet der Service `season_check` als `ready` mit
 * `canApply: true`. Der Server konnte also weiterschalten.
 *
 * Nur rief das NIEMAND auf. Die Oberflaeche kannte `advance_step` nicht einmal als Typ:
 *
 *   FoundationCockpitPanel.tsx:188   runSeasonTransition: (action: "preview" | "start_transition")
 *   cockpit-handlers.ts:373          runSeasonTransition: (action: "preview" | "start_transition")
 *
 * „Saison abschließen" macht Station 1 (`season_check` → Phase `season_review`). Danach gab es
 * keinen zweiten Knopf. Verkaufen oeffnet erst in `preseason_management` — drei Klicks weiter
 * (`transfer-window-policy.ts`). Also blieb es zu, obwohl der Fix darunter lief.
 *
 * Ein Motor ohne Anlasser sieht in jedem Service-Test korrekt aus. Diese Datei prueft deshalb
 * die Verdrahtung selbst: dass die Aktion durch alle drei Schichten reicht und ein Knopf sie
 * ausloest.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { SEASON_TRANSITION_STEPS } from "@/lib/season/season-transition-steps";
import { getPhaseAfterStep } from "@/lib/season/season-transition-chain";

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

const panel = () => read("app/foundation/cockpit-v2/FoundationCockpitPanel.tsx");
const handlers = () => read("lib/foundation/tabs/cockpit-handlers.ts");
const route = () => read("app/api/season/transition/route.ts");

describe("Saisonende-Assistent: die Kette ist von der Oberflaeche aus bedienbar", () => {
  it("hat einen Knopf, der advance_step ausloest", () => {
    const text = panel();
    expect(text).toContain('runSeasonTransition("advance_step")');
    expect(text).toContain('data-testid="season-transition-advance"');
  });

  it("laesst die Aktion durch ALLE drei Schichten — dort riss die Kette", () => {
    // Die Signatur war die eigentliche Sperre: sie liess `advance_step` nicht durch, also konnte
    // in der Oberflaeche gar kein Knopf dafuer entstehen. Route und Handler waren schon fertig.
    // Auf die Mitglieder geprueft, nicht auf die Schreibweise der Union — sonst bricht der Test
    // beim naechsten Umbruch, ohne dass an der Verdrahtung etwas fehlt.
    const typDeklaration = handlers().slice(handlers().indexOf("export type CockpitSeasonTransitionAction"));
    expect(typDeklaration.slice(0, 400)).toContain('"advance_step"');
    expect(handlers()).toContain("async function runSeasonTransition(action: CockpitSeasonTransitionAction)");
    expect(route()).toContain('body.action === "advance_step"');
    expect(route()).toContain("advanceSeasonTransitionStep(save, persistence)");

    // Die alte, zu enge Signatur darf nicht zurueckkommen — sie sah harmlos aus und war der Fehler.
    expect(panel()).not.toContain('runSeasonTransition: (action: "preview" | "start_transition") =>');
    expect(handlers()).not.toContain('runSeasonTransition: (action: "preview" | "start_transition") =>');
  });

  it("der Knopf haengt am Saison-Gate, nicht am geladenen Preview", () => {
    // Sonst muesste man erst „Assistent previewen" druecken, um weiterschalten zu koennen — und
    // genau dieser unsichtbare Zwischenschritt war es, an dem der Spielstand haengen blieb.
    // Welche Station kommt, liest der Server ohnehin aus der Phase im Save.
    const text = panel();
    const knopf = text.slice(text.indexOf('data-testid="season-transition-advance"'));
    const disabled = knopf.slice(knopf.indexOf("disabled="), knopf.indexOf("onClick="));
    expect(disabled).toContain("localSeasonTransitionGate.canCompleteSeason");
    expect(disabled).not.toContain("seasonTransitionFeed");
  });

  it("bis zum Verkaufsfenster sind es DREI weitere Klicks — deshalb reicht „Saison abschließen“ nicht", () => {
    // Der Grund, warum der Knopf ueberhaupt gebraucht wird: „Saison abschließen" schaltet auf
    // `season_review` und ist damit fertig. Verkaufen oeffnet erst in `preseason_management`
    // (`transfer-window-policy.ts`) — von dort aus drei Stationen weiter. Ohne zweiten Knopf
    // waren diese drei Klicks nicht ausfuehrbar, und das Verkaufsfenster blieb zu.
    //
    // Faellt die Distanz je auf null, ist der Knopf ueberfluessig; dann soll das hier auffallen
    // statt still gruen zu bleiben.
    const SELL_OPEN_PHASES = new Set(["preseason_management", "transfer_sell_phase"]);
    const ab = SEASON_TRANSITION_STEPS.indexOf("season_review");
    const klicks = SEASON_TRANSITION_STEPS.slice(ab).findIndex((step) =>
      SELL_OPEN_PHASES.has(getPhaseAfterStep(step) ?? ""),
    );
    expect(ab).toBeGreaterThanOrEqual(0);
    expect(klicks + 1).toBe(3);
  });
});
