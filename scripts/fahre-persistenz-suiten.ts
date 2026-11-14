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
 *
 * CI-OOM-FUND (14.11., dedizierte Root-Cause-Untersuchung, reproduziert unter kuenstlichem
 * Speicherdruck -- NICHT per Vermutung): dieses Skript rief bislang ALLE gefundenen Dateien in
 * EINEM `npx vitest run`-Aufruf. `vitest.config.ts` setzt kein `pool`/`poolOptions` (Vitest 4:
 * keine Nesting-Optionen mehr, s. Migrationshinweis "pool work rework" -- die relevanten Stellgrößen
 * sind jetzt die Top-Level-Optionen `isolate`/`maxWorkers`), und sein Default-Scheduling teilt
 * mehrere Testdateien auf denselben geforkten Worker-Prozess auf, sobald mehr Dateien als
 * CPU-Kerne vorhanden sind -- GENAU das Muster, das der Job `arena-chromium-tests` fuer echtes
 * Chromium bereits dokumentiert (s. dessen Kommentar in `.github/workflows/ci.yml`) und dort durch
 * FUENF GETRENNTE `npx vitest run`-Aufrufe behebt (ein Aufruf = ein frischer Node-Prozess, der
 * seinen gesamten Speicher beim Beenden garantiert freigibt). Ohne echtes Chromium betrifft dasselbe
 * Muster hier eine andere, kleinere Gruppe von Dateien: die, die ueber `fuehreLigaSetupDraftAus()`
 * einen VOLLEN 32-Team-Liga-Draft aufbauen (mehrstellig MB grosse Spielstaende je Aufbau). Lokal
 * reproduziert: `npx vitest run tests/arena-vorlauf-service.test.ts tests/
 * arena-vorlauf-parity.test.ts tests/battle-mode-arena-ausfall-sichtbar.test.ts tests/
 * battle-mode-auto-run-invarianten.test.ts --execArgv=--max-old-space-size=900` (900 MB simuliert
 * den knapperen Anteil eines CI-Worker-Prozesses) endet zuverlaessig in "JavaScript heap out of
 * memory", mit denselben Worker-Abstuerzen, die in CI auftraten. `SCHWERE_DATEIEN` unten sind
 * GENAU diese Dateien (plus ihre direkten Geschwister, dieselbe `bauFrischenBattleSaveMitVollemFeld()`-
 * Familie) -- jede davon laeuft jetzt in einem EIGENEN `npx vitest run`-Aufruf, komplett getrennt
 * vom Batch der restlichen (leichten) Persistenz-Suiten. Zusaetzlich bekam jede dieser Dateien
 * (ausser `arena-vorlauf-service.test.ts`, das den Fix schon seit 18.10. hat) einen fehlenden
 * `invalidateLocalTransfermarktCachesForSave()`-Aufruf nachgetragen (derselbe Fund wie beim
 * 18.10.-Fix: `localMarketContextCache` haelt sonst pro Testlauf einen weiteren Eintrag fest).
 * BEWUSST eine kurze, benannte Liste statt einer weiteren automatischen Erkennung: anders als die
 * generelle "ist das eine Persistenz-Suite" Frage oben ist "baut diese Datei einen vollen
 * 32-Team-Liga-Draft auf" kein Signatur-Treffer, der sich zuverlaessig an einem einzelnen Import
 * festmachen laesst (`fuehreLigaSetupDraftAus` taucht auch in leichten, synthetischen Tests auf,
 * z. B. `tests/liga-draft-ueberlebt-schreibkonflikt.test.ts`, das mit einer Fake-Ablage ohne echte
 * 32 Teams arbeitet) -- eine falsche automatische Erkennung wuerde entweder leichte Dateien unnoetig
 * isolieren (Laufzeit) oder eine neue schwere Datei NICHT isolieren (genau der Fehler, den sie
 * beheben soll). Wer eine neue `bauFrischenBattleSaveMitVollemFeld()`-Kopie anlegt, trägt sie hier
 * nach UND ruft `invalidateLocalTransfermarktCachesForSave()` darin auf.
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const TEST_ORDNER = join(process.cwd(), "tests");
const SIGNATUREN = ["lib/persistence/", "createPersistenceService", "OLY_APP_SQLITE_PATH"];

// s. CI-OOM-FUND oben -- jede dieser Dateien baut (mehrfach) einen vollen 32-Team-Liga-Draft auf
// und laeuft deshalb in einem EIGENEN Prozess, nicht im gemeinsamen Batch.
const SCHWERE_DATEIEN = [
  "tests/arena-vorlauf-service.test.ts",
  "tests/arena-vorlauf-parity.test.ts",
  "tests/arena-eingabe-instabil.test.ts",
  "tests/arena-eingabe-stabil.test.ts",
];

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

// s. CI-OOM-FUND oben: SCHWERE_DATEIEN laufen getrennt, je ein eigener `npx vitest run`-Aufruf
// (ein eigener Node-Prozess je Datei) -- nicht im gemeinsamen Batch unten. Nicht gefundene Namen
// (z. B. eine umbenannte/entfernte Datei) sind ein Fehler in dieser Liste, keine stille Luecke.
const fehlendeSchwereDateien = SCHWERE_DATEIEN.filter((datei) => !suiten.includes(datei));
if (fehlendeSchwereDateien.length > 0) {
  console.error(
    `SCHWERE_DATEIEN nennt Dateien, die die Persistenz-Erkennung nicht (mehr) findet: ${fehlendeSchwereDateien.join(", ")}. Liste in scripts/fahre-persistenz-suiten.ts pruefen.`,
  );
  process.exit(1);
}
const leichteSuiten = suiten.filter((datei) => !SCHWERE_DATEIEN.includes(datei));

console.log(`Persistenz-Suiten: ${suiten.length} Dateien (${SCHWERE_DATEIEN.length} davon einzeln isoliert, s. CI-OOM-FUND)`);
for (const schwereDatei of SCHWERE_DATEIEN) {
  console.log(`Persistenz-Suiten · isoliert: ${schwereDatei}`);
  execFileSync("npx", ["vitest", "run", schwereDatei], { stdio: "inherit" });
}
console.log(`Persistenz-Suiten · Batch: ${leichteSuiten.length} Dateien`);
execFileSync("npx", ["vitest", "run", ...leichteSuiten], { stdio: "inherit" });
