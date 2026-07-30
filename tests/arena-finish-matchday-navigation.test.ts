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
 * Punkt 2 und 3 liegen in `finishMatchdayAndAdvance` (EIN Ort fuer die Rueckmeldung),
 * Punkt 1 an der Aufrufstelle: welche Ansicht danach dran ist, ist Sache des Shell-Bodys
 * und nicht der Spieltags-Logik.
 */
describe("Arena: Spieltag abschliessen", () => {
  it("wartet das Ergebnis ab, statt es wegzuwerfen", () => {
    expect(BODY).toContain("const summary = await finishMatchdayAndAdvance();");
    // Der alte Fire-and-forget-Aufruf darf nicht zurueckkommen.
    expect(BODY).not.toContain("? () => runCockpitMatchdayAdvance?.(true)");
    // Und der Body ruft die Auswertung nicht an der Rueckmeldung vorbei direkt auf.
    expect(BODY).not.toContain("await runCockpitMatchdayAdvance?.(true)");
    expect(HANDLER).toContain("await matchdayArenaApplyHandlers.runCockpitMatchdayAdvance(true)");
  });

  it("springt nach erfolgreichem Wechsel in den Saisonstand", () => {
    expect(BODY).toMatch(
      /if \(summary\?\.applied\) \{[\s\S]{0,200}setFoundationView\("seasonV2", setActiveView, \{ push: true \}\)/,
    );
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
