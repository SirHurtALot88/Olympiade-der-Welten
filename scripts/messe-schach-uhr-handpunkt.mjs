// ===================================================================================
// MISST DISZIPLIN_PROP["speed-schach"].hand (docs/design/speed-schach-fable-recherche-
// 12-09.md, Abschnitt A3) — den Ankerpunkt fuer die Schachuhr an der STAND-Pose, exakt
// die Pose, die zeichneSchach() tatsaechlich zeigt (u.lunge ist bei einem Schachspieler
// die meiste Zeit 0, s. Kommentar bei DISZIPLIN_PROP["speed-schach"] in
// battle-mode.engine.js) — anders als Gewichtheben (immer "shoot" erzwungen) ist das
// hier dieselbe STAND-Pose, die schon HOCKEY_HAND/PUNKTE_STAND
// (scripts/erzeuge-sprite-handpunkte-beweisbild.mjs) vermessen haben, nur mit einer
// eigenen frischen Pixelscan-Runde statt der bestehenden Werte zu uebernehmen (Auftrag:
// "nicht schaetzen").
//
// METHODE: window.__arena.renderProbe(name,"walk",false,dir,0,256) bei eingefrorenem
// t=0 (direkt nach dem Laden, vor jedem Kampfstart) liefert den STAND-Frame. Dieselbe
// Guertel-/Handband-Suche wie messe-heben-handpunkt.mjs (dort y=20..44, Brustband fuer
// die Ueberkopf-"shoot"-Pose) — hier y=40..50 wie HOCKEY_HAND (Guertelhoehe, wo eine
// stehende Figur einen gehaltenen Gegenstand traegt), Extreme (min/max X) im Band. Es
// gilt nur die dem BRETT ZUGEWANDTE Hand (die "vordere"): bei "rechts" (Seite 0, blickt
// zum Brett) ist das die Hand mit dem GROESSEREN X (nach vorne/rechts ausgestreckt), bei
// "links" (Seite 1) die mit dem KLEINEREN X — exakt spiegelbildlich, wie
// zeichneSchach()s eigener Kommentar es beschreibt ("Seite 0 blickt rechts, Seite 1
// links, genau zueinander").
//
// Aufruf: node scripts/messe-schach-uhr-handpunkt.mjs [zielordner]
// ===================================================================================
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HIER = dirname(fileURLToPath(import.meta.url));
const REPO = join(HIER, "..");
const MOCKUP = join(REPO, "public/mockups/battle-mode.html");
const ZIEL = process.argv[2] || join(REPO, "docs/design");

const DIRS = [
  { dir: 0, name: "hinten", vorn: "rechts" },
  { dir: 1, name: "links", vorn: "links" },
  { dir: 2, name: "vorn", vorn: "rechts" },
  { dir: 3, name: "rechts", vorn: "rechts" },
];
const NAME = "__Sondentest";

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const seite = await browser.newPage();
const seitenfehler = [];
seite.on("pageerror", (e) => seitenfehler.push(String(e)));
await seite.goto("file://" + MOCKUP, { waitUntil: "networkidle" });
await seite.waitForFunction(() => window.__arena && window.__arena.renderProbe, null, { timeout: 30000 });

const frameHolen = (dir) =>
  seite.evaluate(([n, d]) => window.__arena.renderProbe(n, "walk", false, d, 0, 256), [NAME, dir]);

const pixelDaten = (dataUrl) =>
  seite.evaluate(async (durl) => {
    const img = new Image();
    await new Promise((res) => { img.onload = res; img.src = durl; });
    const c = document.createElement("canvas"); c.width = 256; c.height = 256;
    const ctx = c.getContext("2d"); ctx.drawImage(img, 0, 0);
    return Array.from(ctx.getImageData(0, 0, 256, 256).data);
  }, dataUrl);

// Guertelband-Extreme. renderProbe() zeichnet den Sprite IMMER bei festen (32,46) auf
// der 256er Leinwand (kein Reskalieren auf die Leinwandgroesse, s. renderProbe-Kommentar
// "der Sprite wird bei y-46*Z angesetzt") — Zellkoordinaten x/y sind deshalb direkte
// Pixelkoordinaten auf der 256-breiten Canvas, keine 4x-Skalierung (wie in
// messe-heben-handpunkt.mjs).
function guertelbandExtreme(px) {
  let minX = 64, minY = 0, maxX = -1, maxY = 0;
  for (let y = 44; y <= 50; y++) for (let x = 0; x < 64; x++) {
    const a = px[(y * 256 + x) * 4 + 3];
    if (a > 40) {
      if (x < minX) { minX = x; minY = y; }
      if (x > maxX) { maxX = x; maxY = y; }
    }
  }
  return { minX, minY, maxX, maxY };
}

const ergebnis = {};
for (const { dir, name } of DIRS) {
  const durl = await frameHolen(dir);
  const px = await pixelDaten(durl);
  const e = guertelbandExtreme(px);
  ergebnis[name] = { durl, e };
}

await browser.close();
if (seitenfehler.length) console.log("Seitenfehler:", seitenfehler.slice(0, 10));

mkdirSync(ZIEL, { recursive: true });
for (const { name } of DIRS) {
  const b64 = ergebnis[name].durl.replace(/^data:image\/png;base64,/, "");
  writeFileSync(join(ZIEL, `_beweis_schachuhr_hand_${name}.png`), Buffer.from(b64, "base64"));
}

console.log("Guertelband-Extreme je Richtung (min/max X,Y), Rohbilder in", ZIEL, ":");
const gewaehlt = {};
for (const { dir, name, vorn } of DIRS) {
  const { e } = ergebnis[name];
  console.log(`  ${name} (dir ${dir}): min(${e.minX},${e.minY}) max(${e.maxX},${e.maxY})`);
  // vordere Hand: "rechts"-Konvention (dem Brett zugewandt, Seite 0) nimmt die groessere
  // X (nach vorn ausgestreckt), "links"-Konvention (Seite 1) die kleinere X.
  gewaehlt[name] = vorn === "rechts" ? { x: e.maxX, y: e.maxY } : { x: e.minX, y: e.minY };
}
console.log("\nGEWAEHLTE ANKERPUNKTE (vordere Hand, Reihenfolge hinten/links/vorn/rechts):");
console.log(JSON.stringify(["hinten", "links", "vorn", "rechts"].map((n) => gewaehlt[n])));
