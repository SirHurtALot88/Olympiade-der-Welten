import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");
const body = read("app/foundation/FoundationShellRouterBody.tsx");
const arena = read("app/foundation/discipline-stage/DisciplineStageArena.tsx");
const scope = read("lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx");

/**
 * "Der ganze Bereich da unten ausser Spieltag abschliessen soll doch weg — bitte
 * sauber entfernen und den Button Spieltag abschliessen sauber verdrahten. Der
 * macht aktuell noch nichts. Ich haenge immer noch in MD 7 fest."
 *
 * Nachgestellt: der Knopf setzt den Request tatsaechlich ab und der Server
 * antwortet mit `applied: true` — er war also nie "kaputt". Kaputt war die
 * RUECKMELDUNG: bis zur Antwort passierte sichtbar nichts, und eine Ablehnung
 * (422 mit `blockingReasons`) verschwand vollstaendig — von aussen nicht von
 * "Knopf tut nichts" zu unterscheiden.
 *
 * Die Sektion selbst ist weg (Arena und Saisonstand zeigten dasselbe schon), der
 * Knopf sitzt in der Buehne. Was hier festgehalten wird, ist die Verdrahtung
 * dahinter.
 */
describe("Spieltagsabschluss: Knopf in der Buehne, Sektion darunter entfernt", () => {
  it("hat die Spieltagsergebnis-Sektion samt Kacheln und Navigation entfernt", () => {
    expect(body).not.toContain('data-testid="arena-result-summary"');
    expect(body).not.toContain("matchday-result-hero-grid");
    expect(body).not.toContain("matchday-result-actions");
    expect(body).not.toContain("Saisonstand ansehen");
    // "AKTIVES TEAM" steht weiter im File — aber nur noch in Kommentaren zur
    // Sidebar, nicht mehr als Kachel-Ueberschrift unter der Buehne.
    expect(body).not.toContain("<span>AKTIVES TEAM</span>");
  });

  it("traegt den Anker und die Beschriftung jetzt die Buehne", () => {
    expect(arena).toContain('data-testid="arena-finish-matchday"');
    expect(arena).toContain("Spieltag abschließen");
  });

  it("gatet am Spieltagswechsel-Schritt, nicht am empfohlenen Flow-Schritt", () => {
    // `matchdayAdvanceStep` ist der Schritt SELBST. Der Aktionsschritt
    // (`gameFlowActionStep`) haengt auch an Posteingang und Transfers und
    // schaltete den Knopf dadurch je nach Save weg.
    expect(body).toContain("canAdvanceMatchdayFromStep(matchdayAdvanceStep)");
    const section = body.slice(body.indexOf("onAdvanceMatchday={") - 1400, body.indexOf("onCommitDiscipline={commitArenaDiscipline}"));
    expect(section).not.toContain('gameFlowActionStep.stepId === "advance_to_next_matchday"');
  });

  it("ruft den meldenden Wrapper OHNE Optional-Chaining auf", () => {
    // Mit `?.` sah ein fehlender Handler exakt aus wie "Knopf tut nichts".
    expect(body).toContain("await finishMatchdayAndAdvance();");
    expect(body).not.toContain("finishMatchdayAndAdvance?.()");
    // Und nicht mehr direkt am rohen Handler vorbei — der verschluckte die Ablehnung.
    expect(body).not.toContain("runCockpitMatchdayAdvance?.(true)");
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
