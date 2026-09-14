// Breaking-Bildbelege, ANGEHALTEN im richtigen Frame.
//
// Aufruf: node docs/design/breaking-bildbeleg-sonde-13-09.mjs <zielordner> [anzahl]
//
// WARUM ES DIESE SONDE GIBT (Review-Fund 14.09.). Die ersten Bildbelege dieses PRs entstanden
// mit scripts/screenshot-disziplin.mjs, also blind auf eine feste Millisekunde. Das trifft
// die Buehne fast nie im gemeinten Moment, aus zwei unabhaengigen Gruenden:
//
//   1. Der Callout-Banner oben wird NUR bei big (r.punkte>=60) neu gesetzt, der
//      SURVIVOR-Scheinwerfer dagegen bei JEDER Enthuellung (alle 0,625 s). Zwischen beiden
//      liegen deshalb im Normalfall ein bis drei Enthuellungen -- der Banner nennt dann einen
//      anderen Teilnehmer als das ERTRAEGT-Schild, obwohl beide korrekt sind.
//   2. cv.screenshot() selbst braucht unter Last laenger als eine Rundendauer. Wer erst den
//      Bannerwechsel erkennt und dann aus Node heraus ausloest, ist schon eine Enthuellung
//      weiter, wenn das Bild faellt.
//
// Hier laeuft das Erkennen deshalb IM Browser (waitForFunction mit raf-Polling) und haelt die
// Simulation per Klick auf #play an, bevor irgendetwas nach Node zurueckgeht. Erst danach
// faellt der Screenshot -- auf ein stehendes Bild, ohne Zeitdruck. Das Ergebnis zeigt
// garantiert denselben Teilnehmer im Banner wie unter dem SURVIVOR-Scheinwerfer.
//
// Rein diagnostisch: keine Abnahme-Sonde, keine Rangtreue-Messung. Die Rangtreue laeuft
// ueber scripts/miss-alle-disziplinen.mjs und durchlaeuft die Zeichenfunktionen nie.
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SEITE = pathToFileURL(path.join(WURZEL, "public/mockups/battle-mode.html")).href;
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const out = process.argv[2];
const wieViele = Number(process.argv[3] || 20);
mkdirSync(out, { recursive: true });

const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
const seite = await browser.newPage({ viewport: { width: 1300, height: 700 } });
const fehler = [];
seite.on("pageerror", (e) => fehler.push(String(e)));
await seite.goto(SEITE, { waitUntil: "networkidle" });
await seite.waitForFunction(() => window.__arena && window.__arena.setDisc, null, { timeout: 30000 });
await seite.evaluate(() => window.__arena.setDisc("breaking"));
await seite.click("#t2");
await seite.click("#play");

const cv = await seite.$("#cv");
for (let n = 1; n <= wieViele; n++) {
  await seite.evaluate(() => {
    const b = document.getElementById("bbugcallout");
    window.__merk = b && !b.hidden ? b.textContent : "";
  });
  const ok = await seite
    .waitForFunction(
      () => {
        const b = document.getElementById("bbugcallout");
        const t = b && !b.hidden ? b.textContent : "";
        if (t && t !== window.__merk) {
          window.__gefangen = t;
          // 260 ms spaeter anhalten: die Enthuellung hat dann ihre Eintritts-/Throwdown-
          // Phase durchlaufen (0,15+0,25 s, s. stepCypher) und beide Duellanten stehen auf
          // ihren Plaetzen. Immer noch deutlich unter der Rundendauer (0,625 s), also
          // garantiert vor der naechsten Enthuellung. setTimeout laeuft IM Browser, damit
          // keine Roundtrip-Latenz dazwischenfunkt.
          setTimeout(() => document.getElementById("play").click(), 260);
          return true;
        }
        return false;
      },
      null,
      { polling: "raf", timeout: 20000 },
    )
    .then(() => true)
    .catch(() => false);
  if (!ok) break;
  await seite.waitForTimeout(450); // den in-page-Pausenklick abwarten
  const txt = await seite.evaluate(() => window.__gefangen);
  const datei = path.join(out, "p" + String(n).padStart(3, "0") + ".png");
  await cv.screenshot({ path: datei });
  console.log(n + "\t" + txt.replace(/\s+/g, " ").slice(0, 90));
  await seite.click("#play"); // weiterlaufen lassen
}
console.log("Seitenfehler: " + (fehler.length ? fehler.join(" | ") : "keine"));
await browser.close();
