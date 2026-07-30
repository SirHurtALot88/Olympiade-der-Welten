import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");
const body = read("app/foundation/FoundationShellRouterBody.tsx");
const scope = read("lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx");

/**
 * "Der ganze Bereich da unten ausser Spieltag abschliessen soll doch weg — bitte
 * sauber entfernen und den Button Spieltag abschliessen sauber verdrahten. Der
 * macht aktuell noch nichts. Ich haenge immer noch in MD 7 fest."
 *
 * Nachgestellt: der Knopf setzt den Request tatsaechlich ab und der Server
 * antwortet mit `applied: true` — er war also nie "kaputt". Kaputt war die
 * RUECKMELDUNG: bis zur Antwort passierte sichtbar nichts, und eine Ablehnung
 * (422 mit `blockingReasons`) verschwand vollstaendig. Dazu hing die
 * Sichtbarkeit am globalen Flow-Schritt, der auch an Posteingang und Transfers
 * haengt — derselbe Spielstand zeigte deshalb mal den Knopf und mal ein
 * generisches "Weiter".
 */
describe("Spieltagsergebnis: nur noch der Abschluss-Knopf", () => {
  it("hat die Kacheln und die Navigations-Knoepfe entfernt", () => {
    const section = body.slice(
      body.indexOf('data-testid="arena-result-summary"'),
      body.indexOf('data-testid="arena-result-summary"') + 2500,
    );
    expect(section).not.toContain("matchday-result-hero-grid");
    expect(section).not.toContain("AKTIVES TEAM");
    expect(section).not.toContain("Zur Arena");
    expect(section).not.toContain("Saisonstand ansehen");
  });

  it("zeigt den Knopf am SPIELTAG fest, nicht am globalen Flow-Schritt", () => {
    expect(body).toContain("{homeNextMatchdayStatus.resultAvailable ? (");
    // Der Flow-Schritt gatet den Knopf nicht mehr — er haengt auch an Posteingang
    // und Transfers und schaltete den Knopf dadurch je nach Save weg.
    const section = body.slice(body.indexOf('data-testid="arena-result-summary"') - 1600, body.indexOf('data-testid="arena-finish-matchday"'));
    expect(section).not.toContain('gameFlowActionStep.stepId === "advance_to_next_matchday"');
  });

  it("ruft den Handler OHNE Optional-Chaining auf", () => {
    // Mit `?.` sah ein fehlender Handler exakt aus wie "Knopf tut nichts".
    expect(body).toContain("onClick={() => void finishMatchdayAndAdvance()}");
    expect(body).not.toContain("finishMatchdayAndAdvance?.()");
  });

  it("meldet Start, Erfolg UND Ablehnung zurueck", () => {
    const handler = scope.slice(
      scope.indexOf("async function finishMatchdayAndAdvance()"),
      scope.indexOf("async function postAdminSeasonSimulation"),
    );
    // Sofortiges Lebenszeichen — der Wechsel kann unter Last mehrere Sekunden dauern.
    expect(handler).toContain('title: "Spieltag wird abgeschlossen …"');
    expect(handler).toContain('title: "Spieltag abgeschlossen"');
    // Und die Ablehnung mit BEGRUENDUNG statt Stille.
    expect(handler).toContain('title: "Spieltag konnte nicht abgeschlossen werden"');
    expect(handler).toContain("result?.blockingReasons ?? []");
    expect(handler).toContain("formatCockpitReason(reason)");
  });

  it("laesst den Server ueber die Zulaessigkeit entscheiden", () => {
    const handler = scope.slice(
      scope.indexOf("async function finishMatchdayAndAdvance()"),
      scope.indexOf("async function postAdminSeasonSimulation"),
    );
    // Kein zweiter, nachgebauter Vorab-Check in der UI — `prepareMatchdayProgress`
    // prueft Ergebnis-/Tabellen-Buchung und Doppel-Wechsel bereits.
    expect(handler).toContain("matchdayArenaApplyHandlers.runCockpitMatchdayAdvance(true)");
    expect(handler).not.toContain("standingsApplyLogs");
    expect(handler).not.toContain("matchdayResults");
  });

  it("reicht den Handler an den Shell-Body durch", () => {
    // Genau hier lag der stille Totalausfall-Kandidat: ein nicht durchgereichter
    // Handler plus `?.` ergibt einen Knopf ohne jede Wirkung.
    expect(scope).toContain("    finishMatchdayAndAdvance,\n");
    expect(body).toContain("  finishMatchdayAndAdvance,\n");
  });
});
