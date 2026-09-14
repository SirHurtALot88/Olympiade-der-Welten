// ===================================================================================
// BEWEISBILDER DER GEWICHTHEBEN-BUEHNE (Chris' Befund 13.09.). Faehrt ein ECHTES
// Gewichtheben-Duell im Mockup (derselbe "Kampf starten"-Knopf, den ein Mensch drueckt —
// keine nachgebaute Zeichenschleife) und knipst die Leinwand in den zwei Phasen, um die
// es geht: die wartende Stange am Boden und den Ueberkopf-Halt "hoch".
//
// Phasen werden ueber window.__arena.cypherVizProbe() abgefragt — die liest schlicht
// u.vizPhase aller TEILNEHMER und funktioniert deshalb fuer jede Buehne, nicht nur fuer
// Breaking (s. Kommentar an der Sonde). Rein lesend.
//
// Aufruf: node scripts/erzeuge-heben-buehnenbild.mjs <praefix> [zielordner]
//   z.B.  node scripts/erzeuge-heben-buehnenbild.mjs vorher /tmp/bilder
// ===================================================================================
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HIER = dirname(fileURLToPath(import.meta.url));
const REPO = join(HIER, "..");
const MOCKUP = join(REPO, "public/mockups/battle-mode.html");
const PRAEFIX = process.argv[2] || "heben";
const ZIEL = process.argv[3] || join(REPO, "docs/design");
mkdirSync(ZIEL, { recursive: true });

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const seite = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const seitenfehler = [];
seite.on("pageerror", (e) => seitenfehler.push(String(e)));
await seite.goto("file://" + MOCKUP, { waitUntil: "networkidle" });
// Grosszuegiges Zeitlimit: die Engine laedt ~5MB Sprites als Data-URIs, auf einer belasteten
// Maschine reichen 30s dafuer nicht immer.
await seite.waitForFunction(() => window.__arena && window.__arena.setDisc, null, { timeout: 120000 });

// Reiter "Arena" (#t2) sichtbar schalten — das Mockup startet auf "Aufstellung", und
// #p2 (mit der Leinwand #cv) ist bis dahin display:none, also nicht knipsbar.
await seite.click("#t2");
await seite.evaluate(() => window.__arena.setDisc("gewichtheben"));
// Programmatischer Klick statt Playwrights Sicht-Pruefung: reset() blendet nach jedem
// Disziplinwechsel das Einlauf-Overlay ein, das #play verdeckt — der Klick-Handler selbst
// ist es, der es wieder wegnimmt (zeigeEinlauf(false), s. Engine :22541). Es ist derselbe
// Handler, den ein Mensch ausloest, nur ohne die Geste davor.
await seite.evaluate(() => document.getElementById("play").click());

const phasen = () => seite.evaluate(() => window.__arena.cypherVizProbe().map((d) => d.phase));

// Auf eine bestimmte Phase warten und dann die Leinwand knipsen.
async function knipseBei(ziel, datei) {
  for (let i = 0; i < 900; i++) {
    const p = await phasen();
    if (p.includes(ziel)) {
      await seite.locator("#cv").screenshot({ path: join(ZIEL, datei) });
      return p;
    }
    await seite.waitForTimeout(40);
  }
  return null;
}

const a = await knipseBei("hoch", `${PRAEFIX}-heben-hoch.png`);
console.log("hoch:", a ? a.join(",") : "NICHT ERREICHT");
const b = await knipseBei("antritt", `${PRAEFIX}-heben-antritt.png`);
console.log("antritt:", b ? b.join(",") : "NICHT ERREICHT");
// Ein drittes Bild irgendwo im Lauf, fuer den Gesamteindruck der Buehnenaufteilung.
await seite.waitForTimeout(900);
await seite.locator("#cv").screenshot({ path: join(ZIEL, `${PRAEFIX}-heben-uebersicht.png`) });

// VIERTES BILD: das Duell zweier VOLLBILD-Kreaturen (Beispielkader: Duell 2, Lava Golem
// gegen Krag'Zul). Genau dort bekam vor dem 13.09. KEINER der beiden eine Hantel, weil der
// b.vollbild-Zweig in zeichneSprite() vor dem Hantel-Block zurueckkehrt — das ist die
// Gegenprobe zu Chris' "dann hat nur einer eine hantel".
const aktivesDuell = () => seite.evaluate(() =>
  (window.__arena.cypherVizProbe().find((d) => d.phase !== "boden") || {}).n || null);
for (let i = 0; i < 4000; i++) {
  const n = await aktivesDuell();
  if (n === "Lava Golem" || n === "Krag'Zul") {
    await seite.locator("#cv").screenshot({ path: join(ZIEL, `${PRAEFIX}-heben-vollbild.png`) });
    console.log("vollbild-Duell geknipst, aktiv:", n);
    break;
  }
  await seite.waitForTimeout(25);
}

await browser.close();
if (seitenfehler.length) console.log("Seitenfehler:", seitenfehler.slice(0, 10));
console.log("Bilder in", ZIEL);
