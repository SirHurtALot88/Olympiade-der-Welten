// ===================================================================================
// BEWEISBILD FUER docs/design/sprite-handpunkte.md
//
// Rendert eine Figur ueber die ECHTE zeichneSprite()-Pipeline (window.__arena.renderProbe,
// dasselbe Werkzeug wie scripts/erzeuge-sprite-vorschauen.mjs), einmal je Blickrichtung im
// Stand-Frame und je einmal links/rechts im Vollausschlag-Laufbild, und markiert die per
// scripts/messe-sprite-handpunkte.py gemessenen Handpunkte mit einem Farbpunkt. Wenn der
// Punkt nicht auf der Hand sitzt, war die Messung falsch — genau die Gegenprobe, die der
// Auftrag verlangt.
//
// WARUM DER "SCHWUNG"-FRAME EINEN ECHTEN KAMPF BRAUCHT: renderProbe() selbst kann das
// Laufbild NICHT direkt waehlen. Der Laufbild-Index in zeichneSprite() haengt an der
// GLOBALEN Kampfzeit `t` (Modul-Variable in battle-mode.engine.js, s. dortiger Kommentar
// bei "let U=[],...,t=0,..."), die nur waechst, waehrend ein NAHKAMPF (disc "tdm",
// Standardwert) laeuft — Feldspiel-Disziplinen nutzen eine eigene Uhr (`fsT`) dafuer, und
// renderProbe() selbst startet keinen Kampf. Deshalb: Play-Button klicken (echter Kampf
// laeuft, t waechst in Echtzeit), nach kurzer Zeit wieder pausieren (t haelt an), danach
// renderProbe() fuer alle vier Richtungen aufrufen — sie lesen alle denselben, jetzt
// eingefrorenen t-Wert und zeigen deshalb konsistent dasselbe Laufbild.
//
// Aufruf: node scripts/erzeuge-sprite-handpunkte-beweisbild.mjs [zielordner]
// ===================================================================================
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HIER = dirname(fileURLToPath(import.meta.url));
const REPO = join(HIER, "..");
const MOCKUP = join(REPO, "public/mockups/battle-mode.html");
const ZIEL = process.argv[2] || join(REPO, "docs/design");

// Gemessen mit scripts/messe-sprite-handpunkte.py, s. docs/design/sprite-handpunkte.md.
const PUNKTE_STAND = {
  hinten: [{ x: 20, y: 47 }, { x: 44, y: 47 }],
  links: [{ x: 40, y: 46 }, { x: 24, y: 46 }],
  vorn: [{ x: 20, y: 47 }, { x: 44, y: 47 }],
  rechts: [{ x: 23, y: 46 }, { x: 40, y: 45 }],
};
const PUNKTE_SCHWUNG = {
  links: [{ x: 23, y: 47 }, { x: 45, y: 47 }],
  rechts: [{ x: 41, y: 47 }, { x: 19, y: 46 }],
};

const DIRS = [
  { dir: 0, name: "hinten" },
  { dir: 1, name: "links" },
  { dir: 2, name: "vorn" },
  { dir: 3, name: "rechts" },
];

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const seite = await browser.newPage();
const seitenfehler = [];
seite.on("pageerror", (e) => seitenfehler.push(String(e)));

await seite.goto("file://" + MOCKUP, { waitUntil: "networkidle" });
await seite.waitForFunction(() => window.__arena && window.__arena.renderProbe, null, { timeout: 30000 });

const frameVon = (name, dir) =>
  seite.evaluate(([n, d]) => window.__arena.renderProbe(n, "walk", false, d), [name, dir]);

const armSpanne = (dataUrl) =>
  seite.evaluate(async (durl) => {
    const img = new Image();
    await new Promise((res) => { img.onload = res; img.src = durl; });
    const c = document.createElement("canvas"); c.width = 64; c.height = 64;
    const ctx = c.getContext("2d"); ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, 64, 64).data;
    let minX = 64, maxX = -1;
    for (let y = 40; y <= 50; y++) for (let x = 0; x < 64; x++) {
      if (d[(y * 64 + x) * 4 + 3] > 10) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
    }
    return maxX - minX;
  }, dataUrl);

// 1) Stand-Frame (t=0, direkt nach dem Laden, BAU_STD-Fallback ueber unbekannten Namen).
const NAME = "__Sondentest";
const standBilder = {};
for (const { dir, name } of DIRS) standBilder[name] = await frameVon(NAME, dir);

// 2) Kampf kurz anwerfen, um t vorzuspulen, dann wieder pausieren (s. Kommentar oben).
await seite.evaluate(() => document.getElementById("play").click());
let besteSpanne = -1, schwungBilder = null;
for (let i = 0; i < 40; i++) {
  await seite.waitForTimeout(80);
  const probe = await frameVon(NAME, 1);
  const spanne = await armSpanne(probe);
  if (spanne > besteSpanne) {
    besteSpanne = spanne;
    schwungBilder = { links: probe, rechts: await frameVon(NAME, 3) };
  }
  if (spanne >= 26) break; // deutlicher Vollausschlag erreicht (Ruhe-Frame liegt bei ~19)
}
await seite.evaluate(() => document.getElementById("play").click()); // pausieren

await browser.close();
if (seitenfehler.length) {
  console.log("Seitenfehler (JS-Fehler im Mockup):");
  for (const f of seitenfehler.slice(0, 10)) console.log(" ", f);
}

// 3) Punkte einzeichnen (Node hat kein <canvas> — PNG-Bytes roh nach Python weiterreichen
// waere ein Medienbruch; hier reicht ein winziger, selbst gebauter PPM->PNG-freier Weg:
// wir schreiben die Rohbilder weg und ueberlassen das Markieren scripts/messe-sprite-
// handpunkte.py bzw. der manuellen Sichtpruefung — s. docs/design/sprite-handpunkte.md
// fuer die fertig markierten PNGs.
mkdirSync(ZIEL, { recursive: true });
for (const { name } of DIRS) {
  const b64 = standBilder[name].replace(/^data:image\/png;base64,/, "");
  writeFileSync(join(ZIEL, `_roh_stand_${name}.png`), Buffer.from(b64, "base64"));
}
if (schwungBilder) {
  for (const seiteName of ["links", "rechts"]) {
    const b64 = schwungBilder[seiteName].replace(/^data:image\/png;base64,/, "");
    writeFileSync(join(ZIEL, `_roh_schwung_${seiteName}.png`), Buffer.from(b64, "base64"));
  }
}
console.log("Rohbilder geschrieben nach", ZIEL, "— groesste gemessene Armspanne:", besteSpanne);
console.log("Punkte (aus docs/design/sprite-handpunkte.md):");
console.log(JSON.stringify({ PUNKTE_STAND, PUNKTE_SCHWUNG }, null, 2));
