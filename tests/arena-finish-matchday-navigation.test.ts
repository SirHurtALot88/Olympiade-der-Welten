import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const REPO_ROOT = process.cwd();
const BODY = readFileSync(join(REPO_ROOT, "app/foundation/FoundationShellRouterBody.tsx"), "utf8");
const ARENA = readFileSync(join(REPO_ROOT, "app/foundation/discipline-stage/DisciplineStageArena.tsx"), "utf8");
const SCOPE = readFileSync(
  join(REPO_ROOT, "lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx"),
  "utf8",
);

const HANDLER = SCOPE.slice(
  SCOPE.indexOf("async function finishMatchdayAndAdvance()"),
  SCOPE.indexOf("async function postAdminSeasonSimulation"),
);

/**
 * „Spieltag abschliessen" in der Arena wirkte wie ein Blindgaenger: der Spieltag schaltete
 * nicht sichtbar weiter, und man landete nicht im Saisonstand.
 *
 * Drei Ursachen, alle hier festgehalten:
 *  1. Der Aufruf war `() => runCockpitMatchdayAdvance?.(true)` — ohne jede Navigation. Der
 *     Spieler blieb in der Arena des GERADE ABGESCHLOSSENEN Spieltags stehen und sah
 *     weder die neue Tabelle noch den neuen Spieltag.
 *  2. Lehnte die API ab (`applied: false`), landete die Antwort nur in einem Feed, den die
 *     Arena gar nicht rendert. Fuer den Spieler passierte schlicht nichts — ohne Grund.
 *  3. Bis zur Antwort passierte sichtbar gar nichts. Der Wechsel dauert unter Last
 *     mehrere Sekunden; in dieser Zeit ist ein stummer Knopf von einem kaputten nicht zu
 *     unterscheiden — genau so ist der Bug gemeldet worden.
 *
 * Alle drei Punkte liegen inzwischen in `finishMatchdayAndAdvance` — EIN Ort.
 *
 * Der Sprung stand urspruenglich an der Aufrufstelle, mit der Begruendung, welche Ansicht danach
 * dran ist sei Sache des Shell-Bodys und nicht der Spieltags-Logik. Die Begruendung stimmt, das Ziel
 * war nur zu eng gefasst: `finishMatchdayAndAdvance` IST der Shell-Body-Scope (die Spieltags-Logik
 * liegt in `cockpit-matchday-handlers.ts`, die auch das Cockpit benutzt). Am Aufrufort war es eine
 * Kopie pro Knopf — und das globale "Weiter" hatte sie nicht. Derselbe Spieltagsabschluss liess
 * einen also je nach geklicktem Knopf woanders stehen. Deshalb pruefen die Tests hier jetzt den
 * Wrapper und zusaetzlich, dass KEINE Aufrufstelle den Sprung noch einmal selbst macht.
 */
describe("Arena: Spieltag abschliessen", () => {
  it("wartet das Ergebnis ab, statt es wegzuwerfen", () => {
    expect(BODY).toContain("finishMatchdayAndAdvance()");
    // Der alte Fire-and-forget-Aufruf darf nicht zurueckkommen.
    expect(BODY).not.toContain("? () => runCockpitMatchdayAdvance?.(true)");
    // Und der Body ruft die Auswertung nicht an der Rueckmeldung vorbei direkt auf.
    expect(BODY).not.toContain("await runCockpitMatchdayAdvance?.(true)");
    expect(HANDLER).toContain("await matchdayArenaApplyHandlers.runCockpitMatchdayAdvance(true)");
  });

  it("springt nach erfolgreichem Wechsel in den Saisonstand", () => {
    expect(HANDLER).toMatch(
      /if \(result\?\.applied\) \{[\s\S]{0,900}setFoundationView\("seasonV2", setActiveView, \{ push: true \}\)/,
    );
  });

  /**
   * Der Sprung darf NICHT im Ablehnungszweig stehen. Eine Ablehnung legt ihre Begruendung als
   * `foundationActionFeedback` in der Ansicht ab, auf der man steht — wer dabei in den Saisonstand
   * geschoben wird, sieht sie nie und haelt den Knopf wieder fuer tot. Genau das war die Meldung.
   */
  it("wechselt NICHT, wenn der Abschluss abgelehnt wurde", () => {
    const rejection = HANDLER.slice(HANDLER.indexOf("const reasons = ["));
    expect(rejection).not.toContain('setFoundationView("seasonV2"');
  });

  /**
   * Zwei Kopien des Sprungs waeren zwei Stellen, an denen er wieder fehlen kann.
   *
   * Bewusst NICHT als Zaehlung ueber die ganze Datei: es gibt legitime andere Wege in den
   * Saisonstand (`onOpenSeason` in der Navigation). Ein Verbot des Aufrufs an sich haette die mit
   * erschlagen. Geprueft werden deshalb genau die beiden Aufrufstellen des Spieltagsabschlusses.
   */
  it("keine Aufrufstelle wiederholt den Sprung", () => {
    const arenaCall = BODY.slice(BODY.indexOf("onAdvanceMatchday={"), BODY.indexOf("onCommitDiscipline="));
    expect(arenaCall).toContain("finishMatchdayAndAdvance()");
    expect(arenaCall).not.toContain('setFoundationView("seasonV2"');

    const globalNext = SCOPE.slice(SCOPE.indexOf("if (canAdvanceMatchdayFromStep(gameFlowActionStep)) {"));
    const globalNextBranch = globalNext.slice(0, globalNext.indexOf("return;"));
    expect(globalNextBranch).toContain("finishMatchdayAndAdvance()");
    expect(globalNextBranch).not.toContain('setFoundationView("seasonV2"');
  });

  /**
   * Das globale "Weiter" schliesst denselben Spieltag ab. Es lief an diesem Wrapper vorbei: rohe
   * Abfrage auf `status === "ready"` (bei gerissenen Saisonzielen steht der Schritt auf "warning" —
   * eine Mitteilung, kein Hindernis), direkter Aufruf ohne Lebenszeichen und Ablehnungsgrund, und
   * kein Sprung. Drei Unterschiede beim selben Vorgang.
   */
  it("das globale Weiter nimmt denselben Weg wie der Arena-Knopf", () => {
    expect(SCOPE).toContain("if (canAdvanceMatchdayFromStep(gameFlowActionStep)) {");
    expect(SCOPE).not.toContain(
      'gameFlowActionStep.stepId === "advance_to_next_matchday" && gameFlowActionStep.status === "ready"',
    );
    expect(SCOPE).not.toContain("await matchdayArenaApplyHandlers?.runCockpitMatchdayAdvance(true)");
  });

  it("nennt bei Ablehnung den Grund, statt still zu bleiben", () => {
    expect(HANDLER).toContain('title: "Spieltag konnte nicht abgeschlossen werden"');
    // Grund aus der Antwort — beide Ablagen der Route (oben und in `summary`), plus
    // Warnungen als Rueckfall. Und NICHT nur der erste Grund: eine Ablehnung kann
    // mehrere haben, und der weggelassene ist regelmaessig der, der weiterhilft.
    expect(HANDLER).toContain("result?.blockingReasons ?? []");
    expect(HANDLER).toContain("result?.summary?.blockingReasons ?? []");
    expect(HANDLER).toContain("result?.warnings ?? []");
    expect(HANDLER).toContain("formatCockpitReason(reason)");
    // Dieselbe Ablehnung steht oft in beiden Ablagen — sie soll einmal dastehen.
    expect(HANDLER).toContain("[...new Set(");
  });

  it("gibt sofort ein Lebenszeichen, bevor die Antwort da ist", () => {
    expect(HANDLER).toContain('title: "Spieltag wird abgeschlossen …"');
    expect(HANDLER).toContain('title: "Spieltag abgeschlossen"');
  });

  it("laesst den Knopf weiterhin nur erscheinen, wenn der Wechsel erlaubt ist", () => {
    expect(BODY).toContain("canAdvanceMatchdayFromStep(matchdayAdvanceStep)");
    // Ohne Handler zeigt die Buehne ihren Hinweis statt eines toten Knopfes.
    expect(ARENA).toContain("return onAdvanceMatchday ? (");
    expect(ARENA).toContain('data-testid="arena-finish-matchday"');
  });
});
