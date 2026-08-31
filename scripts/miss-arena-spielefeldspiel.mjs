// Abnahme fuer window.__arena.spieleFeldspiel(fd, saat) (Battle-Mode-Plan, PR 5 / Abschnitt
// 3.3a): der neue "ein Spiel, ein Ergebnis"-Aufruf fuer Feldspiel-Disziplinen.
//
// Geprueft wird genau das, was der Plan fuer die Abnahme von PR 5 verlangt:
//   1. GLEICHER Seed -> GLEICHES Ergebnis (deterministisch reproduzierbar: seiten UND
//      Boxscore muessen bitgenau uebereinstimmen, nicht nur "aehnlich").
//   2. UNTERSCHIEDLICHER Seed -> UNTERSCHIEDLICHES Ergebnis (kein Seed wird stillschweigend
//      ignoriert / auf einen festen Wert 1337 zurueckgesetzt wie bei namenVon()/
//      feldspielSubskills(), die bewusst diagnostisch sind).
//   3. KEINE REGRESSION an bestehenden window.__arena-Aufrufen: diagPositionen() und
//      boxscoreSerie() muessen nach dem Patch unveraendert weiterlaufen (beide lesen
//      dieselbe fsPunkte-Variable, die spieleFeldspiel() jetzt zusaetzlich nach aussen gibt).
//
// Aufruf (aus dem Repo-Wurzelverzeichnis, sonst findet node "playwright" nicht):
//   node scripts/miss-arena-spielefeldspiel.mjs

import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import { existsSync } from "node:fs";

const hier = dirname(fileURLToPath(import.meta.url));
const seite = resolve(hier, "..", "public", "mockups", "battle-mode.html");
if (!existsSync(seite)) {
  console.error("Mockup nicht gefunden: " + seite);
  process.exit(1);
}

// Der Browser ist im Image vorinstalliert; ohne Pfad sucht Playwright im Home-Verzeichnis
// und laedt nach. PLAYWRIGHT_BROWSERS_PATH deckt den Normalfall, der feste Pfad den Fall,
// dass die Umgebungsvariable fehlt (gleiches Muster wie miss-arena-serie.mjs).
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});

let fehlgeschlagen = false;
const pruefe = (bedingung, text) => {
  if (bedingung) {
    console.log("  OK  " + text);
  } else {
    console.error("  FEHLER  " + text);
    fehlgeschlagen = true;
  }
};

try {
  const seiteImBrowser = await browser.newPage();
  const seitenfehler = [];
  seiteImBrowser.on("pageerror", (e) => seitenfehler.push(String(e)));
  await seiteImBrowser.goto(pathToFileURL(seite).href);
  await seiteImBrowser.waitForFunction(() => Boolean(window.__arena), null, { timeout: 15000 });
  const hatSpieleFeldspiel = await seiteImBrowser.evaluate(
    () => typeof window.__arena.spieleFeldspiel === "function",
  );
  if (!hatSpieleFeldspiel) {
    console.error("window.__arena.spieleFeldspiel ist keine Funktion — Patch nicht geladen?");
    process.exit(1);
  }

  console.log("1) Determinismus: derselbe Seed liefert dasselbe Ergebnis");
  const [einmal, nochmal] = await seiteImBrowser.evaluate(() => [
    window.__arena.spieleFeldspiel("basketball", 424242),
    window.__arena.spieleFeldspiel("basketball", 424242),
  ]);
  pruefe(einmal !== null && nochmal !== null, "beide Laeufe liefern ein Ergebnis (kein null)");
  pruefe(einmal.disziplin === "basketball", 'disziplin === "basketball"');
  pruefe(Array.isArray(einmal.seiten) && einmal.seiten.length === 2, "seiten ist ein Zwei-Elemente-Array (Punktestand je Team-Seite)");
  pruefe(einmal.seiten[0] > 0 || einmal.seiten[1] > 0, "es wurden ueberhaupt Punkte erzielt (kein 0:0-Leerlauf)");
  pruefe(JSON.stringify(einmal.seiten) === JSON.stringify(nochmal.seiten), `Punktestand identisch: ${JSON.stringify(einmal.seiten)} === ${JSON.stringify(nochmal.seiten)}`);
  pruefe(JSON.stringify(einmal.boxscore) === JSON.stringify(nochmal.boxscore), "Boxscore (Name+Wert je Spieler) identisch");

  console.log("\n2) Seed-Sensitivitaet: unterschiedlicher Seed liefert unterschiedliches Ergebnis");
  const anders = await seiteImBrowser.evaluate(() => window.__arena.spieleFeldspiel("basketball", 99));
  const seitenGleich = JSON.stringify(einmal.seiten) === JSON.stringify(anders.seiten);
  const boxscoreGleich = JSON.stringify(einmal.boxscore) === JSON.stringify(anders.boxscore);
  pruefe(!(seitenGleich && boxscoreGleich), `Seed 424242 (${JSON.stringify(einmal.seiten)}) unterscheidet sich von Seed 99 (${JSON.stringify(anders.seiten)}) — Boxscore oder Punktestand weicht ab`);

  console.log("\n3) Sauberkeit: der Motor-Zustand wird nach spieleFeldspiel() zurueckgesetzt");
  const namenVorher = await seiteImBrowser.evaluate(() => window.__arena.namenVon("basketball"));
  await seiteImBrowser.evaluate(() => window.__arena.spieleFeldspiel("basketball", 7));
  const namenNachher = await seiteImBrowser.evaluate(() => window.__arena.namenVon("basketball"));
  pruefe(JSON.stringify(namenVorher) === JSON.stringify(namenNachher), "namenVon() liefert vor/nach spieleFeldspiel() dieselbe Aufstellung (M.zurueck greift)");

  console.log("\n4) Unbekannte Disziplin: sauberes null statt Wurf");
  const unbekannt = await seiteImBrowser.evaluate(() => window.__arena.spieleFeldspiel("keine-disziplin", 1));
  pruefe(unbekannt === null, "unbekannte Feldspiel-Disziplin liefert null");

  console.log("\n5) Keine Regression an bestehenden window.__arena-Aufrufen");
  const diag = await seiteImBrowser.evaluate(() => window.__arena.diagPositionen(1337));
  pruefe(Array.isArray(diag) && diag.length > 0, "diagPositionen(1337) liefert weiterhin Positions-Eimer");
  const serie = await seiteImBrowser.evaluate(() => window.__arena.boxscoreSerie("basketball", 2));
  pruefe(serie && serie.n === 2 && Array.isArray(serie.punkteTeamL) && serie.punkteTeamL.length === 2, "boxscoreSerie(\"basketball\", 2) liefert weiterhin zwei Kaempfe");
  const subskills = await seiteImBrowser.evaluate(() => window.__arena.feldspielSubskills("basketball"));
  pruefe(Array.isArray(subskills) && subskills.length > 0, "feldspielSubskills(\"basketball\") funktioniert weiterhin");

  if (seitenfehler.length) {
    console.error("\nSeitenfehler:\n  " + seitenfehler.join("\n  "));
    fehlgeschlagen = true;
  }
} finally {
  await browser.close();
}

if (fehlgeschlagen) {
  console.error("\nABNAHME FEHLGESCHLAGEN");
  process.exit(1);
}
console.log("\nABNAHME BESTANDEN");
