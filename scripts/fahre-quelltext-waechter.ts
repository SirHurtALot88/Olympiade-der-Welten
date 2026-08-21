/**
 * DIE QUELLTEXT-WÄCHTER IN DEN PFLICHT-CHECK ZIEHEN.
 *
 * DER ANLASS, und er ist konkret: `full-test-suite` ist kein Pflicht-Check. #586 wurde mit einem
 * Absturz gemergt (die neue Kaufphasen-Warnung warf beim Rendern der Arena), weil nur
 * `test-and-smoke` das Tor bewacht — und dort lief die volle Suite nicht mit. Am 20.08. ist
 * dasselbe zweimal passiert, nur ohne Schaden: einmal zwei Apron-Wächter (#589), einmal ein
 * CSS-Ratchet (#595). In allen drei Fällen war der Test da, er lief nur nicht im Tor.
 *
 * WAS DIESES SKRIPT AUSWÄHLT: jede Testdatei, die den QUELLTEXT liest — erkennbar an
 * `readFileSync(join(process.cwd(), …))`. Das ist die Signatur genau der Sorte Prüfung, die hier
 * zweimal durchgerutscht ist: Zusicherungen über Dateien (Klassennamen, Ratchets, Vertragstexte,
 * „diese Funktion muss aufgerufen werden"). Sie braucht keine Datenbank, keinen Browser und keinen
 * Build — gemessen 120 Dateien, 1830 Tests, **69 Sekunden**. Das passt in den Pflicht-Check,
 * während die volle Suite mit ihren rund 20 Minuten weiter daneben läuft.
 *
 * WARUM ERRECHNET UND NICHT AUFGEZÄHLT: eine feste Liste veraltet ab dem Tag, an dem jemand einen
 * neuen Wächter schreibt — und dann fehlt genau er im Tor. Genau dieser Fehler (eine Auswahl, die
 * nicht mitwächst) ist die Ursache, die hier behoben werden soll; ihn in der Behebung zu
 * wiederholen wäre absurd. Die Auswahl wächst deshalb von selbst mit.
 *
 * KEIN ERSATZ für `full-test-suite`. Was hier NICHT mitläuft, sind die Rechen- und
 * Persistenz-Tests — die brauchen ihre 20 Minuten und bleiben im eigenen Job.
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const TEST_ORDNER = join(process.cwd(), "tests");
const SIGNATUREN = ["readFileSync(join(process.cwd()", "readFileSync(path.join(process.cwd()"];

function sammleTestdateien(ordner: string): string[] {
  const treffer: string[] = [];
  for (const eintrag of readdirSync(ordner)) {
    const pfad = join(ordner, eintrag);
    if (statSync(pfad).isDirectory()) {
      treffer.push(...sammleTestdateien(pfad));
      continue;
    }
    if (eintrag.endsWith(".test.ts") || eintrag.endsWith(".test.tsx")) {
      treffer.push(pfad);
    }
  }
  return treffer;
}

const waechter = sammleTestdateien(TEST_ORDNER)
  .filter((pfad) => {
    const inhalt = readFileSync(pfad, "utf8");
    return SIGNATUREN.some((signatur) => inhalt.includes(signatur));
  })
  .map((pfad) => pfad.slice(process.cwd().length + 1))
  .sort();

if (waechter.length === 0) {
  // Nicht stillschweigend „grün" melden: eine leere Auswahl heisst, dass die Erkennung kaputt ist,
  // nicht dass es nichts zu prüfen gäbe.
  console.error("Keine Quelltext-Waechter gefunden — die Erkennung stimmt nicht mehr.");
  process.exit(1);
}

console.log(`Quelltext-Waechter: ${waechter.length} Dateien`);
execFileSync("npx", ["vitest", "run", ...waechter], { stdio: "inherit" });
