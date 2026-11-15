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
 *
 * CI-TIMEOUT-FUND (15.11., Anschluss an CI-OOM-FUND oben): die vier SCHWERE_DATEIEN liefen bislang
 * STRENG SERIELL (vier `execFileSync`-Aufrufe nacheinander) -- das kostete die Isolation nichts
 * (jede Datei hatte weiterhin ihren eigenen frischen Prozess), aber Zeit. Gemessen auf Commit
 * badcf9f4f (CI-Run 43674126454, Job 132690494164): 727,83s + 123,39s + 225,39s + 126,20s =
 * 1202,81s allein fuer diese Phase, danach noch der Batch der restlichen (damals 198) Dateien --
 * der Job `persistenz-suiten` (`timeout-minutes: 30`) wurde nach 30:13 abgebrochen, bevor der Batch
 * fertig war. Kein Heap-Crash (der OOM-Fix selbst griff), ein echtes Zeitlimit.
 *
 * NICHT auf volle Parallelitaet (alle vier Dateien gleichzeitig) gegangen, GEMESSEN statt vermutet:
 * vier gleichzeitige `npx vitest run <eine Datei>`-Aufrufe spawnen hier zusammen ACHT geforkte
 * Worker-Prozesse (zwei je Aufruf) auf vier Kernen UND treiben die Summe aus RSS aller vier
 * Prozesse nahe an das verfuegbare RAM. Ein lokaler Reproduktionslauf unter dieser Bedingung endete
 * mit einem echten `oom-kill` von `arena-vorlauf-service.test.ts` (dem schwersten der vier,
 * `dmesg`: "Memory cgroup out of memory"). Genau DAS wiederherzustellen waere ein Rueckschritt
 * hinter den Grund, warum diese Dateien ueberhaupt isoliert wurden.
 *
 * STATT DESSEN: KONKURRENZ-GRENZE 2, nicht 4. `arena-vorlauf-service.test.ts` ist mit 727,83s von
 * 1202,81s (61 %) mit Abstand die schwerste Datei -- die uebrigen drei summiert (474,98s) bleiben
 * DARUNTER. Zwei gleichzeitige Prozesse heben deshalb schon fast den gesamten Zeitgewinn einer
 * vollen Viererparallelitaet (die Wall-Clock-Zeit der Phase sinkt auf ungefaehr die Laufzeit der
 * schwersten Datei allein, nicht auf die Summe aller vier), ohne die Spitzenlast auf vier
 * gleichzeitige Prozesse zu treiben. Lokal nachgemessen (derselbe Vierersatz, KONKURRENZ=2):
 * 574,0s Wall-Clock statt der seriellen Summe, alle vier Dateien gruen, kein OOM-Kill.
 */
import { execFileSync, spawn } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// s. CI-TIMEOUT-FUND oben: 2 gleichzeitige `npx vitest run`-Prozesse heben fast den ganzen
// Zeitgewinn einer vollen Viererparallelitaet, ohne deren gemessenes OOM-Risiko einzugehen.
const KONKURRENZGRENZE = 2;

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

// Ein eigener `npx vitest run <datei>`-Aufruf je schwerer Datei (ein frischer Prozess, der seinen
// Speicher beim Beenden freigibt) -- bis zu KONKURRENZGRENZE davon gleichzeitig, s. CI-TIMEOUT-FUND
// oben fuer die Messung, die diese Zahl statt voller Parallelitaet oder strenger Serialitaet
// begruendet. `execFileSync` (synchron, blockierend) kann das nicht ausdruecken; `spawn` plus eine
// kleine Warteschlange schon, ohne die Isolation je zwei Dateien zu nehmen -- sie bleiben weiterhin
// zwei komplett getrennte Prozesse, nur eben nicht mehr strikt nacheinander gestartet.
function fahreIsoliert(datei: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`Persistenz-Suiten · isoliert gestartet: ${datei}`);
    const kind = spawn("npx", ["vitest", "run", datei], { stdio: "inherit" });
    kind.on("error", reject);
    kind.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`npx vitest run ${datei} endete mit Code ${code}${signal ? ` (Signal ${signal})` : ""}`));
      }
    });
  });
}

async function fahreSchwereDateienMitKonkurrenzgrenze(dateien: string[], grenze: number): Promise<void> {
  const warteschlange = [...dateien];
  const fehler: unknown[] = [];

  async function worker(): Promise<void> {
    for (;;) {
      const naechste = warteschlange.shift();
      if (!naechste) return;
      try {
        await fahreIsoliert(naechste);
      } catch (fehlerFall) {
        // Nicht sofort abbrechen: die uebrigen bereits laufenden/wartenden Dateien sollen ihr
        // Ergebnis trotzdem zeigen (dasselbe Verhalten, das ein serieller `execFileSync`-Lauf durch
        // seinen Nicht-Null-Exit ohnehin erst am Ende des GESAMTEN Skripts hatte).
        fehler.push(fehlerFall);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(grenze, dateien.length) }, () => worker()));

  if (fehler.length > 0) {
    for (const einzelFehler of fehler) {
      console.error(einzelFehler);
    }
    throw new Error(`${fehler.length} von ${dateien.length} isolierten Persistenz-Suiten sind fehlgeschlagen.`);
  }
}

async function main(): Promise<void> {
  console.log(
    `Persistenz-Suiten: ${suiten.length} Dateien (${SCHWERE_DATEIEN.length} davon einzeln isoliert, s. CI-OOM-FUND, hoechstens ${KONKURRENZGRENZE} gleichzeitig, s. CI-TIMEOUT-FUND)`,
  );
  await fahreSchwereDateienMitKonkurrenzgrenze(SCHWERE_DATEIEN, KONKURRENZGRENZE);
  console.log(`Persistenz-Suiten · Batch: ${leichteSuiten.length} Dateien`);
  execFileSync("npx", ["vitest", "run", ...leichteSuiten], { stdio: "inherit" });
}

// Kein Top-Level-`await`: `tsx` kompiliert dieses Skript (kein `"type": "module"` in package.json)
// nach CJS, und esbuild lehnt Top-Level-`await` dort ab ("not supported with the cjs output
// format") -- lokal beim ersten echten Lauf dieser Fassung aufgefallen, nicht vermutet. Deshalb
// hier derselbe `main().catch()`-Zuschnitt wie in den uebrigen Skripten dieses Ordners.
main().catch((fehler) => {
  console.error(fehler);
  process.exit(1);
});
