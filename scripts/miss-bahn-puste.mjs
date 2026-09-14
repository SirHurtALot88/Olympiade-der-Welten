// PUSTE-HAUSHALT DER BAHN-DISZIPLINEN.
//
// Der Kraftvorrat (`u.reserve`, im UI seit 13.09. „Puste") existiert auf der Bahn seit
// langem und traegt den Balken unter den Fuessen — aber bis zur Erholungs-Runde vom 13.09.
// kannte er FUENF Abzuege und keine einzige Gutschrift, und `u.leer` war eine Sperrklinke,
// die nie geloescht wurde. Chris dazu: „manche laufen aus und muessen kurz regenerieren,
// manche schaffen den kompletten Spieltag."
//
// Dieses Skript misst genau das, je Disziplin: Restpuste im Ziel, wie viele einbrechen, wie
// oft sie sich wieder fangen, und ob der Endstand am Spieler haengt (rho zu STEHEN) statt
// am Zufall.
//
//   node scripts/miss-bahn-puste.mjs [rennen] [disziplin ...]
//
// Die RANGTREUE steht bewusst nicht hier — dafuer ist scripts/miss-alle-disziplinen.mjs die
// eine kaderfeste Bank. Dieses Skript ist das Werkzeug fuer die Konstanten
// (`pusteRegen`/`leerSchonung`/`leerRegen`/`pusteFangen` in BAHN_ART).
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEITE = pathToFileURL(path.join(WURZEL, "public/mockups/battle-mode.html")).href;
const RENNEN = Number(process.argv[2] || 24);
const DISZIS = process.argv.slice(3).length
  ? process.argv.slice(3)
  : ["takeshis-castle", "climbing", "spurt", "time-trial", "staffel"];
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
const seite = await browser.newPage();
const seitenfehler = [];
seite.on("pageerror", (e) => seitenfehler.push(String(e)));
await seite.goto(SEITE, { waitUntil: "networkidle" });
await seite.waitForFunction(() => window.__arena && window.__arena.bahnLauf, null, { timeout: 30000 });

const zahl = (v, k = 1) => (Number.isFinite(v) ? v.toFixed(k).replace(".", ",") : "—");
const med = (a) => {
  const b = [...a].sort((x, y) => x - y);
  return b.length ? b[Math.floor(b.length / 2)] : NaN;
};
const summe = (a) => a.reduce((x, y) => x + y, 0);

console.log(`PUSTE AUF DER BAHN — je ${RENNEN} Rennen\n`);
console.log(
  "Disziplin".padEnd(17) +
    "Läufer".padStart(7) +
    "Rest im Ziel".padStart(14) +
    "brechen ein".padStart(13) +
    "fangen sich".padStart(13) +
    "ausgesch.".padStart(11) +
    "Dauer".padStart(9),
);
for (const d of DISZIS) {
  const r = await seite.evaluate(
    ({ d, n }) => {
      const out = [];
      for (let i = 0; i < n; i++) out.push(window.__arena.bahnLauf(d, 1337 + i * 7919));
      return out;
    },
    { d, n: RENNEN },
  );
  const zeilen = [];
  for (const l of r) for (const u of l.laeufer) zeilen.push(u);
  const anteile = zeilen.map((u) => (u.reserveMax ? u.reserve / u.reserveMax : 0));
  const leer = zeilen.filter((u) => u.leer).length;
  const gefangen = summe(zeilen.map((u) => u.gefangen || 0));
  const mitFang = zeilen.filter((u) => (u.gefangen || 0) > 0).length;
  const raus = zeilen.filter((u) => u.raus).length;
  console.log(
    d.padEnd(17) +
      String(zeilen.length).padStart(7) +
      (zahl(100 * med(anteile)) + " %").padStart(14) +
      (zahl((100 * leer) / zeilen.length) + " %").padStart(13) +
      (zahl((100 * mitFang) / zeilen.length) + " %").padStart(13) +
      (zahl((100 * raus) / zeilen.length) + " %").padStart(11) +
      (zahl(med(r.map((x) => x.zeit)), 1) + " s").padStart(9),
  );
  if (gefangen > mitFang) {
    console.log(
      "".padEnd(17) + `  (${gefangen} Erholungen bei ${mitFang} Läufern — manche fangen sich mehrfach)`,
    );
  }
}
console.log(
  "\n„brechen ein\" = am Rennende noch leer · „fangen sich\" = hatten mindestens eine Erholung.\n" +
    "Ohne Puste-Erholung (BAHN_ART ohne `pusteRegen`) steht in der Fang-Spalte 0,0 %.",
);
console.log(`Seitenfehler: ${seitenfehler.length ? seitenfehler.slice(0, 3).join(" | ") : "keine"}`);
await browser.close();
