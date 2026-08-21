/**
 * DIE TESTS, DIE WIRKLICH RENDERN — 15 Sekunden, und sie schliessen eine Lücke, die kein
 * Quelltext-Wächter je schliessen kann.
 *
 * DER ANLASS steht seit #602 als offene Einschränkung in `.github/workflows/ci.yml`: den Absturz
 * aus #586 (die Kaufphasen-Warnung warf beim Rendern der Arena) hätten die Quelltext-Wächter NICHT
 * gefangen. Das ist kein Versäumnis der Auswahl, sondern ihre Bauart — ein Wächter, der prüft, ob
 * eine Zeichenkette in einer Datei steht, kann nicht bemerken, dass dieselbe Datei beim Ausführen
 * wirft. Einen Renderfehler sieht nur, wer rendert.
 *
 * WAS DIESES SKRIPT AUSWÄHLT: jede Testdatei, die eine Komponente tatsächlich zum Laufen bringt —
 * erkennbar an `@testing-library/react`, `renderToStaticMarkup` oder `renderToString`.
 *
 * GEMESSEN: 21 Dateien, 196 Tests, **15 Sekunden**. Kein Browser, kein Build, keine Datenbank —
 * es passt in den bestehenden Pflicht-Job, so wie die Quelltext-Wächter mit ihren 69 Sekunden.
 * Deshalb braucht es dafür kein Häkchen im Branch-Schutz: der Schritt hängt in `test-and-smoke`,
 * und der ist Pflicht.
 *
 * WAS ER HEUTE NOCH NICHT KANN, ehrlich gemessen und nicht behauptet: **kein Test rendert die
 * Arena.** `DisciplineStageArena.tsx` taucht in zehn Testdateien auf, aber alle lesen ihren
 * Quelltext oder prüfen die Logik daneben; gerendert wird sie nirgends. Der Absturz aus #586 wäre
 * also auch von diesem Wächter nicht gefangen worden — nicht weil die Auswahl falsch ist, sondern
 * weil der Test dafür fehlt. Er ist das Gerüst, in das so ein Test gehört.
 *
 * WARUM ERRECHNET UND NICHT AUFGEZÄHLT: dieselbe Lehre wie bei den Quelltext-Wächtern (#602). Eine
 * feste Liste veraltet ab dem ersten neuen Render-Test — und dann fehlt genau er im Tor.
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const TEST_ORDNER = join(process.cwd(), "tests");
const SIGNATUREN = ["@testing-library/react", "renderToStaticMarkup", "renderToString"];

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
  console.error("Keine Render-Waechter gefunden — die Erkennung stimmt nicht mehr.");
  process.exit(1);
}

console.log(`Render-Waechter: ${waechter.length} Dateien`);
execFileSync("npx", ["vitest", "run", ...waechter], { stdio: "inherit" });
