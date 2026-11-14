import { describe, expect, it } from "vitest";

import { chromiumVerfuegbar } from "@/tests/helpers/chromium-verfuegbar";
import {
  VALIDIERTE_CHROMIUM_MAJOR_VERSION,
  launcheValidierteChromiumRevision,
  pruefeChromiumMajorVersion,
} from "@/tests/helpers/chromium-validierte-version";

/**
 * GOLDENTEST FUER DIE MATHE-NACHBILDUNG (Opus-PM-Review, Rebase 11.11.) — NICHT zu verwechseln mit
 * `tests/arena-chromium-revision-goldentest.test.ts` (PR #1276, 16.10., Befund F7): jener Test
 * vergleicht zwei ECHTE Chromium-Revisionen ueber die VOLLE Simulation (`runBattleModeArenaMatchday()`)
 * und braucht dafuer BEIDE Revisionen lokal vorhanden -- er prueft, ob Chromium-Versionen selbst
 * untereinander bitgenau sind. DIESER Test prueft eine andere, kleinere Frage: ist die Chromium-
 * Version, die GERADE in dieser Umgebung per `channel: "chromium"` startet, noch dieselbe MAJOR-
 * Version, gegen die `lib/battle/arena-node-chromium-mathe.mjs` (der Node-vs-Chromium-Mathe-
 * Nachbau fuer den Quick-Sim-Node-Runner) bitgleich nachgemessen wurde. Er braucht nur EINE
 * Revision und laeuft deshalb in praktisch jeder Umgebung mit Chromium.
 *
 * WARUM DAS EIN EIGENER TEST IST, nicht nur eine Zeile im Mikro-Benchmark
 * (`tests/arena-node-chromium-mathe.test.ts`): ein Versions-Sprung aeussert sich dort als "299 von
 * 200 000 sin-Werten weichen ab" -- eine Zahl, die leicht als echte Regression in der eigenen
 * Nachbildung gelesen wird. Genau das ist beim Erstellen dieses PR in einer Sandbox passiert, bevor
 * der Grund gefunden war: eine lokal unter einem fest einprogrammierten Pfad installierte, neuere
 * Chromium-Version (153.x) "ueberstimmte" die von Playwright fuer dieses Projekt gepinnte (148.x,
 * Revision 1223) -- s. `tests/helpers/chromium-validierte-version.ts` fuer die volle Herleitung.
 * Dieser Test benennt die eigentliche Ursache in EINER Zeile, bevor der Mikro-Benchmark ueberhaupt
 * dazu kommt, etwas zu verwechseln.
 *
 * NACH EINEM FEHLSCHLAG HIER: `tests/arena-node-chromium-mathe.test.ts` (Mikro-Benchmark) UND
 * `tests/arena-node-runner-paritaet.test.ts` (echte Disziplin-Paritaet des Quick-Sim-Node-Runners)
 * gegen die neue Version laufen lassen. Erst wenn beide bitgleich sind:
 * `VALIDIERTE_CHROMIUM_MAJOR_VERSION` (tests/helpers/chromium-validierte-version.ts) UND den
 * Kopfkommentar in `lib/battle/arena-node-chromium-mathe.mjs` auf die neue Version aktualisieren.
 */
describe("arena-node-chromium-mathe-revision-goldentest", () => {
  it(`die Mathe-Nachbildung ist gegen Chromium Major ${VALIDIERTE_CHROMIUM_MAJOR_VERSION}.x validiert`, () => {
    // Reine Pruefwert-Doku, laeuft ohne Chromium: zeigt beim Lesen sofort, welche Version heute gilt.
    expect(VALIDIERTE_CHROMIUM_MAJOR_VERSION).toBe("148");
  });

  it.skipIf(!chromiumVerfuegbar())(
    "die per channel:'chromium' gestartete Revision stimmt mit der validierten Version ueberein",
    async () => {
      const browser = await launcheValidierteChromiumRevision();
      try {
        const version = browser.version();
        // `pruefeChromiumMajorVersion()` wirft mit einer erklaerenden Meldung statt eines nackten
        // Zahlenvergleichs -- s. tests/helpers/chromium-validierte-version.ts.
        expect(() => pruefeChromiumMajorVersion(version), `Chromium-Version: ${version}`).not.toThrow();
      } finally {
        await browser.close();
      }
    },
    60_000,
  );
});
