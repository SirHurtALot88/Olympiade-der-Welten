import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const REPO_ROOT = process.cwd();
const BODY = readFileSync(join(REPO_ROOT, "app/foundation/FoundationShellRouterBody.tsx"), "utf8");
const ARENA = readFileSync(join(REPO_ROOT, "app/foundation/discipline-stage/DisciplineStageArena.tsx"), "utf8");

/**
 * „Spieltag abschliessen" in der Arena wirkte wie ein Blindgaenger: der Spieltag schaltete
 * nicht sichtbar weiter, und man landete nicht im Saisonstand.
 *
 * Zwei Ursachen, beide hier festgehalten:
 *  1. Der Aufruf war `() => runCockpitMatchdayAdvance?.(true)` — ohne jede Navigation. Der
 *     Spieler blieb in der Arena des GERADE ABGESCHLOSSENEN Spieltags stehen und sah
 *     weder die neue Tabelle noch den neuen Spieltag.
 *  2. Lehnte die API ab (`applied: false`), landete die Antwort nur in einem Feed, den die
 *     Arena gar nicht rendert. Fuer den Spieler passierte schlicht nichts — ohne Grund.
 */
describe("Arena: Spieltag abschliessen", () => {
  it("wartet das Ergebnis ab, statt es wegzuwerfen", () => {
    expect(BODY).toContain("const summary = await runCockpitMatchdayAdvance?.(true);");
    // Der alte Fire-and-forget-Aufruf darf nicht zurueckkommen.
    expect(BODY).not.toContain("? () => runCockpitMatchdayAdvance?.(true)");
  });

  it("springt nach erfolgreichem Wechsel in den Saisonstand", () => {
    expect(BODY).toMatch(/if \(summary\?\.applied\) \{[\s\S]{0,200}setFoundationView\("seasonV2", setActiveView, \{ push: true \}\)/);
  });

  it("nennt bei Ablehnung den Grund, statt still zu bleiben", () => {
    expect(BODY).toContain('title: "Spieltag nicht weitergeschaltet"');
    // Grund aus der Antwort — beide Ablagen der Route (oben und in `summary`).
    expect(BODY).toContain("summary?.blockingReasons?.[0]");
    expect(BODY).toContain("summary?.summary?.blockingReasons?.[0]");
  });

  it("laesst den Knopf weiterhin nur erscheinen, wenn der Wechsel erlaubt ist", () => {
    expect(BODY).toContain("canAdvanceMatchdayFromStep(matchdayAdvanceStep)");
    // Ohne Handler zeigt die Buehne ihren Hinweis statt eines toten Knopfes.
    expect(ARENA).toContain("return onAdvanceMatchday ? (");
    expect(ARENA).toContain('data-testid="arena-finish-matchday"');
  });
});
