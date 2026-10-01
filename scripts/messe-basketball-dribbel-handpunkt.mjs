// ===================================================================================
// MISST BK_DRIBBEL_HAND: den Handanker fuer den Basketball-Dribbler an DER WALK-POSE,
// ueber alle neun Laufzyklus-Bilder und alle vier Blickrichtungen (36 Punkte) — Weg A
// aus docs/design/basketball-finalisierung-recherche-fable.md Abschnitt 2.3 ("Ball in
// die Hand"), per Pixelscan der Alphakontur, nicht geschaetzt (Auftrag: "nicht
// schaetzen", CLAUDE.md/sprite-handpunkte.md-Prinzip).
//
// METHODE, identisch zu scripts/messe-schach-uhr-handpunkt.mjs (Guertelband-Extreme):
// window.__arena.renderProbe(name,"walk",false,dir,0,256,undefined,undefined,
// {vizAniPhase:f/9}) zwingt EIN bestimmtes der neun Laufbilder (f/9 * n=9 ergibt exakt
// den Frame-Index f in zeichneSprite()s zyklus/f-Rechnung, additiv ueber das schon
// bestehende renderProbe-viz-Argument — KEIN Engine-Eingriff fuer diese Messung noetig).
// Guertelband y=28..54 (deutlich breiter als HOCKEY_HAND/y44..50, weil der schwingende
// Arm beim Gehen nicht auf Gürtelhoehe bleibt: Spalte 3 zeigt bei ALLEN vier Richtungen
// einen Ausschlag bis y=36, ein zunaechst probiertes Band ab y=38 hat genau diesen
// Ausschlag abgeschnitten und mangels Alternative den naechstbesten Punkt darunter
// gewaehlt — nachgemessen, nicht vermutet, s. PR-Beschreibung), Extreme (min/max X) je
// Bildhaelfte.
//
// KONVENTION WIE HOCKEY_HAND (docs/design/sprite-handpunkte.md): "hinten"/"vorn"/
// "rechts" nehmen die GROESSERE X (Bildschirm-rechte Haelfte), "links" die KLEINERE X
// (Bildschirm-linke Haelfte) — dieselbe Regel, mit der HOCKEY_HAND schon gemessen wurde
// (dort: hinten/vorn/rechts alle ~43-44, links 20). Macht den Basketball-Handanker mit
// dem bestehenden Requisiten-Muster konsistent, statt eine zweite Konvention zu erfinden.
//
// Aufruf: node scripts/messe-basketball-dribbel-handpunkt.mjs [zielordner]
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
  { dir: 0, name: "hinten", seite: "max" },
  { dir: 1, name: "links", seite: "min" },
  { dir: 2, name: "vorn", seite: "max" },
  { dir: 3, name: "rechts", seite: "max" },
];
const N = 9; // ANIBILDER.walk
const NAME = "__Sondentest";

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const seite = await browser.newPage();
const seitenfehler = [];
seite.on("pageerror", (e) => seitenfehler.push(String(e)));
await seite.goto("file://" + MOCKUP, { waitUntil: "networkidle" });
await seite.waitForFunction(() => window.__arena && window.__arena.renderProbe, null, { timeout: 30000 });

const frameHolen = (dir, f) =>
  seite.evaluate(
    ([n, d, phase]) =>
      window.__arena.renderProbe(n, "walk", false, d, 0, 256, undefined, undefined, { vizAniPhase: phase }),
    [NAME, dir, f / N]
  );

const pixelDaten = (dataUrl) =>
  seite.evaluate(async (durl) => {
    const img = new Image();
    await new Promise((res) => { img.onload = res; img.src = durl; });
    const c = document.createElement("canvas"); c.width = 256; c.height = 256;
    const ctx = c.getContext("2d"); ctx.drawImage(img, 0, 0);
    return Array.from(ctx.getImageData(0, 0, 256, 256).data);
  }, dataUrl);

// Guertelband-Extreme je Bildhaelfte (x<32 links, x>=32 rechts), dasselbe Prinzip wie
// guertelbandExtreme() in messe-schach-uhr-handpunkt.mjs, nur getrennt nach Haelfte
// statt nur globalem min/max — der schwingende Arm kann je Frame auf beiden Seiten
// liegen, und wir wollen gezielt EINE Seite je Richtung (Konvention oben).
function guertelbandExtremeHaelften(px) {
  let minX = 64, minY = 0, maxX = -1, maxY = 0;
  for (let y = 28; y <= 54; y++) for (let x = 0; x < 64; x++) {
    const a = px[(y * 256 + x) * 4 + 3];
    if (a > 40) {
      if (x < minX) { minX = x; minY = y; }
      if (x > maxX) { maxX = x; maxY = y; }
    }
  }
  return { min: { x: minX, y: minY }, max: { x: maxX, y: maxY } };
}

const ergebnis = {};
for (const { dir, name } of DIRS) {
  ergebnis[name] = [];
  for (let f = 0; f < N; f++) {
    const durl = await frameHolen(dir, f);
    const px = await pixelDaten(durl);
    const e = guertelbandExtremeHaelften(px);
    ergebnis[name].push(e);
    if (f === 0) {
      const b64 = durl.replace(/^data:image\/png;base64,/, "");
      mkdirSync(ZIEL, { recursive: true });
      writeFileSync(join(ZIEL, `_beweis_basketball_dribbel_${name}_f0.png`), Buffer.from(b64, "base64"));
    }
  }
}

await browser.close();
if (seitenfehler.length) console.log("Seitenfehler:", seitenfehler.slice(0, 10));

console.log("Guertelband-Extreme je Richtung x Frame (min/max X,Y):");
const gewaehlt = {};
for (const { dir, name, seite: s } of DIRS) {
  gewaehlt[name] = ergebnis[name].map((e, f) => {
    const p = s === "max" ? e.max : e.min;
    console.log(`  ${name} f${f}: min(${e.min.x},${e.min.y}) max(${e.max.x},${e.max.y}) -> gewaehlt(${p.x},${p.y})`);
    return p;
  });
}
console.log("\nBK_DRIBBEL_HAND (Reihenfolge hinten/links/vorn/rechts, je 9 Frames):");
console.log(JSON.stringify(["hinten", "links", "vorn", "rechts"].map((n) => gewaehlt[n])));
