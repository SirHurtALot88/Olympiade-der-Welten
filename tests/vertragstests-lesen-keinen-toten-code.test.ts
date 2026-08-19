import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * EIN VERTRAGSTEST DARF NICHT AUF TOTEN CODE PRUEFEN — Befund A3 aus
 * `docs/AUDIT-INGAME-2026-08-19.md`.
 *
 * CHRIS: „mach dann mit A3 weiter."
 *
 * `tests/game-inbox-ui-contract.test.ts` klebt gut dreissig Quelldateien zu EINER Zeichenkette
 * zusammen und prueft darauf mit `toContain(...)`. Das ist an sich in Ordnung — solange jede
 * dieser Dateien auch laeuft.
 *
 * Sie tat es nicht. `foundation-global-next-actions.ts` und `foundation-game-flow-navigation.ts`
 * wurden von KEINEM Laufzeitmodul importiert; ihre Logik lag wortgleich (bzw. veraltet) inline im
 * Shell. Eine Zusicherung liess sich damit allein von totem Code erfuellen, waehrend die echte
 * Oberflaeche die Verdrahtung laengst verloren haben konnte.
 *
 * Der Vertragstest beschreibt diese Fehlerklasse sogar in seinem eigenen Kommentar („ein Name,
 * den zuletzt nur noch ein TOTER IMPORT am Leben hielt") — und tappte an der naechsten Stelle
 * wieder hinein. Deshalb dieser Riegel: er prueft nicht EINEN Fall, sondern die Regel.
 *
 * WAS DIESER TEST NICHT KANN: er sieht, dass eine Datei importiert wird — nicht, ob die
 * importierende Stelle selbst je gerendert wird. Diese Grenze ist real (siehe die entsprechende
 * Anmerkung in `tests/season-checklist-jump-targets.test.ts`), aber der billige Teil der Pruefung
 * faengt schon die Faelle, die hier tatsaechlich auftraten.
 */

const root = process.cwd();

/** Alle Vertragstests, die Quelldateien als TEXT einlesen. */
const VERTRAGSTESTS = ["tests/game-inbox-ui-contract.test.ts"] as const;

function sammleLaufzeitQuelltext(): string {
  const teile: string[] = [];
  const walk = (dir: string) => {
    for (const eintrag of readdirSync(dir)) {
      // `tests/` ist ausgeschlossen: ein Import AUS einem Test heraet die Datei nicht am Leben.
      if (["node_modules", ".next", ".git", "tests", "outputs", ".claude"].includes(eintrag)) continue;
      const voll = join(dir, eintrag);
      if (statSync(voll).isDirectory()) {
        walk(voll);
        continue;
      }
      if (/\.(ts|tsx)$/.test(eintrag)) teile.push(readFileSync(voll, "utf8"));
    }
  };
  for (const verzeichnis of ["app", "lib", "components"]) walk(join(root, verzeichnis));
  return teile.join("\n");
}

describe("Vertragstests prüfen nur Dateien, die auch laufen", () => {
  const laufzeit = sammleLaufzeitQuelltext();

  for (const vertrag of VERTRAGSTESTS) {
    it(`${vertrag}: jede eingelesene Datei wird von Laufzeitcode importiert`, () => {
      const quelle = readFileSync(join(root, vertrag), "utf8");
      const gelesen = [...quelle.matchAll(/readFileSync\(\s*join\(root,\s*"([^"]+)"/g)].map((treffer) => treffer[1]!);
      // Absicherung gegen einen leeren Treffersatz — ein Test, der nichts prüft, ist schlimmer
      // als keiner.
      expect(gelesen.length).toBeGreaterThanOrEqual(10);

      const tot = [...new Set(gelesen)].filter((pfad) => {
        const ohneEndung = pfad.replace(/\.(ts|tsx)$/, "");
        const alsAlias = laufzeit.includes(`"@/${ohneEndung}"`) || laufzeit.includes(`'@/${ohneEndung}'`);
        // Einstiegspunkte und Nachbardateien werden relativ importiert — dann zaehlt der Dateiname.
        const basis = ohneEndung.split("/").pop()!;
        const alsRelativ = new RegExp(`from\\s+["'][^"']*/${basis}["']`).test(laufzeit);
        return !alsAlias && !alsRelativ;
      });

      expect(tot).toEqual([]);
    });
  }
});

/**
 * DIE ZWEITE HAELFTE VON A3 — und die, die der Vertragstest selbst nicht kann.
 *
 * NACHGEMESSEN: loest man im Shell die Verdrahtung wieder (Label festverdrahtet statt aus
 * `deriveGlobalNextUi`), bleibt `game-inbox-ui-contract` GRUEN. Er prueft, dass Namen irgendwo im
 * zusammengeklebten Quelltext stehen — nicht, dass sie benutzt werden. Genau so konnte die Kopie
 * ueberhaupt entstehen.
 *
 * Diese Faelle pruefen daher die Benutzung und die Einzigkeit. Sie sind ebenfalls Quelltext-
 * Pruefungen und koennen nicht sehen, ob der Code auch laeuft — aber „ein Text steht an genau
 * einer Stelle" ist eine Aussage, die eine Kopie zuverlaessig aufdeckt.
 */
describe("Die Weiter-Leiste hat genau eine Rechenstelle", () => {
  const shell = readFileSync(join(root, "lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx"), "utf8");

  it("das Shell RUFT die Funktion, statt sie nachzubauen", () => {
    expect(shell).toContain("deriveGlobalNextUi({");
    expect(shell).toContain("createUpdateInboxItemStatus({");
  });

  it("die Beschriftungstexte stehen in genau einer Laufzeitdatei", () => {
    /*
     * Waere die Beschriftung wieder an zwei Stellen getippt, stuende dieser Text zweimal. Vor der
     * Reparatur war genau das der Fall: wortgleich im Shell und in
     * `foundation-global-next-actions.ts`.
     */
    const dateien: string[] = [];
    const walk = (dir: string) => {
      for (const eintrag of readdirSync(dir)) {
        if (["node_modules", ".next", ".git", "tests", "outputs", ".claude"].includes(eintrag)) continue;
        const voll = join(dir, eintrag);
        if (statSync(voll).isDirectory()) {
          walk(voll);
          continue;
        }
        if (/\.(ts|tsx)$/.test(eintrag) && readFileSync(voll, "utf8").includes('"Leertaste: Weiter"')) {
          dateien.push(voll.replace(`${root}/`, ""));
        }
      }
    };
    for (const verzeichnis of ["app", "lib", "components"]) walk(join(root, verzeichnis));
    expect(dateien).toEqual(["lib/foundation/tabs/foundation-global-next-actions.ts"]);
  });
});
