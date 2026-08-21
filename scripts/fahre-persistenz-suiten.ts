/**
 * DIE PERSISTENZ-SUITEN ALS EIGENER, ANHAKBARER CHECK.
 *
 * DER ANLASS: `full-test-suite` ist kein Pflicht-Check. Am 20.08. sind dadurch drei rote Wächter
 * durchgerutscht (#586, #589, #595). Die Quelltext-Wächter aus #602 laufen seither im Pflicht-Job
 * mit; die Rechen- und Persistenz-Tests nicht — die passen dort zeitlich nicht hinein.
 *
 * WAS DIESES SKRIPT AUSWÄHLT: jede Testdatei, die die Persistenzschicht anfasst — erkennbar am
 * Import aus `lib/persistence/`, am `createPersistenceService()` oder am `OLY_APP_SQLITE_PATH`.
 * Das ist die Klasse, deren Fehler den Spielstand kosten, und genau die Klasse, die im heutigen
 * Tor fehlt.
 *
 * GEMESSEN, und die Zahl korrigiert eine frühere Schätzung von mir: **174 Dateien, 1346 Tests,
 * 11m20s lokal — und 16m13s auf dem CI-Runner.** Ich hatte Chris „~5 Minuten" genannt und später
 * „7:27" — beides war zu optimistisch, beides an einer engeren Auswahl gemessen. Es sind gut
 * sechzehn Minuten im Tor, und das gehört gesagt, bevor er das Häkchen setzt.
 *
 * WARUM DAS TROTZDEM NICHTS KOSTET: die CI-Jobs laufen parallel. `test-and-smoke` (der heutige
 * Pflicht-Check) braucht 22–25 Minuten; alles, was kürzer ist, verlängert die Wartezeit auf einen
 * Merge um NULL. Nachgemessen — #607: 24:49, #610: 25:27, und im ersten Lauf dieses Jobs 25:25
 * gegen seine eigenen 16:13.
 *
 * WARUM ERRECHNET UND NICHT AUFGEZÄHLT: dieselbe Lehre wie bei den Quelltext-Wächtern. Eine feste
 * Liste veraltet ab der ersten neuen Persistenz-Suite — und dann fehlt genau sie im Tor.
 *
 * WAS ER NICHT ABDECKT, und das ist die zweite Korrektur: die Klasse aus #586 (die
 * Kaufphasen-Warnung warf beim RENDERN der Arena) fängt er nicht. Ein Renderfehler zeigt sich nur
 * beim Rendern. Dafür gibt es `fahre-render-waechter.ts` daneben — 15 Sekunden, und die laufen
 * direkt im bestehenden Pflicht-Job mit.
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const TEST_ORDNER = join(process.cwd(), "tests");
const SIGNATUREN = ["lib/persistence/", "createPersistenceService", "OLY_APP_SQLITE_PATH"];

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

const suiten = sammleTestdateien(TEST_ORDNER)
  .filter((pfad) => {
    const inhalt = readFileSync(pfad, "utf8");
    return SIGNATUREN.some((signatur) => inhalt.includes(signatur));
  })
  .map((pfad) => pfad.slice(process.cwd().length + 1))
  .sort();

if (suiten.length === 0) {
  // Nicht stillschweigend „grün" melden: eine leere Auswahl heisst, dass die Erkennung kaputt ist,
  // nicht dass es nichts zu prüfen gäbe.
  console.error("Keine Persistenz-Suiten gefunden — die Erkennung stimmt nicht mehr.");
  process.exit(1);
}

console.log(`Persistenz-Suiten: ${suiten.length} Dateien`);
execFileSync("npx", ["vitest", "run", ...suiten], { stdio: "inherit" });
