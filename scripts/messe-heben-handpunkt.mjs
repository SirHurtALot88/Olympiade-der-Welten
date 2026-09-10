// ===================================================================================
// MISST HEBEN_HAND (docs/design/sprite-handpunkte.md, Abschnitt "Gewichtheben") — den
// Griffpunkt fuer die Hantel je Blickrichtung, an der "shoot"-Pose, die zeichneHeben()
// fuer jeden enthuellten Versuch ohnehin erzwingt (s. Kommentar am zeichneSprite()-Aufruf
// in zeichneHeben(), vierter Parameter `true`).
//
// METHODE (wie messe-sprite-handpunkte.py/erzeuge-sprite-handpunkte-beweisbild.mjs, nur
// direkt im Browser statt in Python, weil "shoot" — anders als der Laufzyklus dort — an
// KEINE laufende Kampfzeit haengt und sich per renderProbe(...,lunge,...) direkt ansteuern
// laesst): window.__arena.renderProbe(name,"shoot",true,dir,lunge,256) liefert eine PNG-
// Data-URI; die Alphakontur wird im Brustband (y=20..44 Zellkoordinaten) nach dem am
// weitesten seitlich ausladenden Punkt durchsucht (dieselbe Idee wie armSpanne() im
// Hockey-Beweisbild-Skript), ueber mehrere Frames der 13-Bild-"shoot"-Sequenz, um den
// Moment der groessten Streckung zu finden ("Vollausschlag"-Suche wie bei HOCKEY_HAND).
//
// BEFUND: "shoot" ist keine Ueberkopf-Archer-Pose, sondern ein seitlicher Stossgriff
// (eine Faust nah am Koerper, die andere weit herausgestreckt auf Brusthoehe) — in Front-
// /Ruecken-Ansicht kreuzt der Arm stattdessen vor der Brust. Das ist der tatsaechliche
// Bewegungsablauf des vorhandenen Sprite-Blatts, nicht die anatomisch "richtige" Hebe-
// Pose — HEBEN_HAND verankert die Hantel trotzdem an einem echten, gemessenen Koerper-
// punkt statt an einem freischwebenden Bildpunkt, was der eigentliche Auftrag ist.
//
// Aufruf: node scripts/messe-heben-handpunkt.mjs [zielordner]
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
  { dir: 0, name: "hinten" },
  { dir: 1, name: "links" },
  { dir: 2, name: "vorn" },
  { dir: 3, name: "rechts" },
];
const N_SHOOT = 13; // ANIBILDER.shoot
const NAME = "__Sondentest";
// f=floor((1-lunge/0.2)*13) nach lunge aufgeloest, zur Bucketmitte (vermeidet Rundungsgrenzen).
const lungeFuer = (f) => 0.2 * (1 - (f + 0.5) / N_SHOOT);

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const seite = await browser.newPage();
const seitenfehler = [];
seite.on("pageerror", (e) => seitenfehler.push(String(e)));
await seite.goto("file://" + MOCKUP, { waitUntil: "networkidle" });
await seite.waitForFunction(() => window.__arena && window.__arena.renderProbe, null, { timeout: 30000 });

const frameHolen = (dir, f) =>
  seite.evaluate(([n, d, l]) => window.__arena.renderProbe(n, "shoot", true, d, l, 256), [NAME, dir, lungeFuer(f)]);

const pixelDaten = (dataUrl) =>
  seite.evaluate(async (durl) => {
    const img = new Image();
    await new Promise((res) => { img.onload = res; img.src = durl; });
    const c = document.createElement("canvas"); c.width = 256; c.height = 256;
    const ctx = c.getContext("2d"); ctx.drawImage(img, 0, 0);
    return Array.from(ctx.getImageData(0, 0, 256, 256).data);
  }, dataUrl);

// Weitester seitlicher Alpha-Ausschlag im Brustband (Zellkoordinaten y=20..44). Liefert
// BEIDE Extreme (links UND rechts) — bei einer Stossbewegung ist eines davon die
// ausgestreckte Faust, das andere die angezogene Gegenhand/der Ellbogen.
function brustbandExtreme(px) {
  let minX = 64, minY = 0, maxX = -1, maxY = 0;
  for (let y = 20; y <= 44; y++) for (let x = 0; x < 64; x++) {
    const a = px[(y * 256 + x) * 4 + 3];
    if (a > 40) {
      if (x < minX) { minX = x; minY = y; }
      if (x > maxX) { maxX = x; maxY = y; }
    }
  }
  return { minX, minY, maxX, maxY, spanne: maxX - minX };
}

const ergebnis = {};
for (const { dir, name } of DIRS) {
  let beste = null;
  for (let f = 4; f <= 10; f++) {
    const durl = await frameHolen(dir, f);
    const px = await pixelDaten(durl);
    const e = brustbandExtreme(px);
    if (!beste || e.spanne > beste.e.spanne) beste = { f, e, durl };
  }
  ergebnis[name] = beste;
}

mkdirSync(ZIEL, { recursive: true });
for (const { name } of DIRS) {
  const b64 = ergebnis[name].durl.replace(/^data:image\/png;base64,/, "");
  writeFileSync(join(ZIEL, `_beweis_heben_hand_${name}.png`), Buffer.from(b64, "base64"));
}

await browser.close();
if (seitenfehler.length) console.log("Seitenfehler:", seitenfehler.slice(0, 10));

console.log("Brustband-Extreme je Richtung (Frame/Spanne/min/max), Rohbilder in", ZIEL, ":");
for (const { dir, name } of DIRS) {
  const { f, e } = ergebnis[name];
  console.log(`  ${name} (dir ${dir}): Frame ${f}/${N_SHOOT - 1}, Spanne ${e.spanne} — min(${e.minX},${e.minY}) max(${e.maxX},${e.maxY})`);
}
console.log("\nHEBEN_HAND (verwendet, s. battle-mode.engine.js):");
console.log('  hinten: {x:39,y:38} · links: {x:11,y:32} · vorn: {x:24,y:37} · rechts: {x:52,y:32}');
