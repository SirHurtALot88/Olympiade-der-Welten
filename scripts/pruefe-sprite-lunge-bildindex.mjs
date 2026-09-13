// ===================================================================================
// VERSCHWINDET EINE FIGUR WAEHREND IHRES ANGRIFFS? (13.09.)
//
// Der Bildindex der Angriffsanimation rechnet an drei Stellen in zeichneSprite()
// Math.floor((1 - u.lunge/0.2) * n). Die Formel setzt voraus, dass u.lunge bei 0,2
// STARTET — in der Arena stimmt das, auf der Buehne und im Feldspiel nicht: dort setzen
// stepBuehne() und die Wurf-/Block-/Torwart-Pfade u.lunge auf 0,5. Fuer u.lunge>0,2 wird
// der Ausdruck NEGATIV, und drawImage() mit negativem Quell-x zeichnet gar nichts.
//
// Gemessen an origin/main verlor Krag'Zul dadurch 1603 von 1603 sichtbaren Pixeln (es
// blieben 53px Void-Partikel), Lava Golem 1848 -> 283, Johanna 1553 -> 827. Behoben mit
// Math.max(0,...) an allen drei Stellen; Herleitung in
// docs/design/gewichtheben-hantel-recherche-13-09.md, Abschnitt 3.1.
//
// Diese Sonde zaehlt schlicht die sichtbaren Alpha-Pixel derselben Figur ueber mehrere
// u.lunge-Werte. ERWARTUNG: die Zahl bei lunge 0,21/0,3/0,5 liegt in derselben
// Groessenordnung wie bei 0,19 — bricht sie ein, ist der Bildindex wieder negativ.
//
// Aufruf: node scripts/pruefe-sprite-lunge-bildindex.mjs
// ===================================================================================
import { chromium } from "playwright";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const L = 256;
// Figuren ueber alle drei Zeichenpfade: Vollbild, Baukasten, prozedural.
const FIGUREN = ["Krag'Zul", "Lava Golem", "Johanna", "Draco", "Seraph-11"];
const LUNGEN = [0, 0.1, 0.19, 0.21, 0.3, 0.5];
// Unterhalb dieses Anteils der Referenz (lunge 0,19) gilt die Figur als verschwunden.
const SCHRANKE = 0.6;

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const seite = await browser.newPage();
seite.setDefaultTimeout(180000);
seite.on("pageerror", (e) => console.log("Seitenfehler:", String(e)));
await seite.goto("file://" + join(REPO, "public/mockups/battle-mode.html"),
  { waitUntil: "networkidle", timeout: 180000 });
await seite.waitForFunction(() => window.__arena && window.__arena.renderProbe, null, { timeout: 180000 });
await seite.evaluate(() => window.__arena.setDisc("gewichtheben"));

const sichtbar = (name, lunge) =>
  seite.evaluate(async ([n, l, gr]) => {
    const d = window.__arena.renderProbe(n, "shoot", true, 3, l, gr);
    const img = new Image();
    await new Promise((r) => { img.onload = r; img.src = d; });
    const c = document.createElement("canvas"); c.width = gr; c.height = gr;
    const x = c.getContext("2d"); x.drawImage(img, 0, 0);
    const a = x.getImageData(0, 0, gr, gr).data;
    let k = 0;
    for (let i = 3; i < a.length; i += 4) if (a[i] > 40) k++;
    return k;
  }, [name, lunge, L]);

let schlecht = 0;
for (const name of FIGUREN) {
  const werte = {};
  for (const l of LUNGEN) werte[l] = await sichtbar(name, l);
  const referenz = werte[0.19] || 1;
  const einbruch = LUNGEN.filter((l) => l > 0.2 && werte[l] < referenz * SCHRANKE);
  if (einbruch.length) schlecht++;
  console.log(
    name.padEnd(12) + " " +
    LUNGEN.map((l) => `lunge ${String(l).padEnd(4)}: ${String(werte[l]).padStart(5)}px`).join(" | ") +
    (einbruch.length ? `   <-- EINBRUCH bei lunge ${einbruch.join("/")}` : ""),
  );
}
await browser.close();

if (schlecht) {
  console.log(`\nFEHLER: ${schlecht} von ${FIGUREN.length} Figuren verlieren oberhalb von lunge 0,2 den groessten Teil ihrer sichtbaren Pixel.`);
  process.exitCode = 1;
} else {
  console.log(`\nAlle ${FIGUREN.length} Figuren bleiben ueber den ganzen lunge-Bereich sichtbar.`);
}
