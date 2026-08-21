/**
 * EIN FEHLENDER SPIELSTAND IST KEIN SERVERFEHLER.
 *
 * GEMESSEN (Koop-Audit, Abschnitt C): nachdem die Aufbewahrung einen Snapshot weggeraeumt hatte,
 * hielt der Aufrufer noch dessen ID. Der naechste Aufruf kam als
 *
 *   HTTP 500  { error: "Save save-... wurde nicht gefunden." }
 *
 * zurueck. Zwei Dinge stimmen daran nicht, dieselben zwei wie beim Koop-Schreibkonflikt (siehe
 * koop-schreibkonflikt-antwort.ts). Erstens der Status: 500 heisst "der Server ist kaputt", und das
 * ist er nicht — die ID gibt es schlicht nicht mehr, das ist eine 404. Zweitens die Form: die
 * Fehlertabellen der Oberflaeche kennen den CODE `save_not_found` laengst
 * (foundation-format-render-helpers.ts, preseason-blocker-labels.ts) und haetten "Spielstand wurde
 * nicht gefunden." angezeigt — in einem ausformulierten Satz finden sie ihn nicht.
 *
 * Gebaut war beides schon: `requireLocalPersistedSave` wirft den typisierten Fehler samt Status,
 * `mapSaveResolutionErrorToResponse` uebersetzt ihn in eine Antwort. Es fehlte nur der Anschluss —
 * dasselbe Muster wie bei den vier anderen Befunden dieser Runde.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { startAdminSeasonSimulation } from "@/lib/admin/season-simulation-runner";
import { SaveResolutionError } from "@/lib/persistence/resolve-local-save";
import { resetDatabaseForTests } from "@/lib/persistence/sqlite";

beforeEach(() => {
  resetDatabaseForTests();
});

afterEach(() => {
  resetDatabaseForTests();
});

describe("Simulationslauf auf einer ID, hinter der nichts liegt", () => {
  it("wirft den typisierten Fehler mit Code und Status statt eines blanken Error", () => {
    let gefangen: unknown = null;
    try {
      startAdminSeasonSimulation({
        saveId: "save-gibt-es-nicht",
        seasonCount: 1,
        mode: "dry_run",
        fullChurnStress: false,
        injuriesTestMode: false,
      });
    } catch (error) {
      gefangen = error;
    }

    expect(gefangen, "Es wurde ueberhaupt nicht geworfen").toBeInstanceOf(SaveResolutionError);
    const fehler = gefangen as SaveResolutionError;
    expect(fehler.code).toBe("save_not_found");
    expect(fehler.status).toBe(404);
  });

  it("und die Route uebersetzt ihn, statt ihn in den 500er-Sammelfang laufen zu lassen", () => {
    // Vertragstest auf den Quelltext: die Route laeuft in der Next-Laufzeit und laesst sich in
    // dieser Testumgebung (environment "node") nicht laden — `next/server` wirft dort beim Import.
    // Ohne diese Zeile faellt der Anschluss beim naechsten Umbau lautlos wieder um, und der Fehler
    // ist wieder ein 500.
    const route = readFileSync(join(process.cwd(), "app/api/admin/season-simulation/route.ts"), "utf8");
    expect(route, "Die Route kennt den Uebersetzer nicht").toContain("mapSaveResolutionErrorToResponse");

    const fang = route.slice(route.indexOf("} catch (error) {"));
    const vor500 = fang.slice(0, fang.indexOf("status: 500"));
    expect(
      vor500,
      "Der Uebersetzer steht nicht VOR dem 500er-Rueckfall — dann greift er nie",
    ).toContain("mapSaveResolutionErrorToResponse(error)");
  });
});
