// Sichtpruefung der Takeshi-Komplettumsetzung: Route, Chaos-Ticker, Wertungstabelle.
//
//   node docs/design/takeshi-komplett-screenshots-06-09.mjs <repo>/public <ausgabeordner>
//
// Faehrt EIN Rennen JE KURS (Nordhof / Sumpfpfad / Die Mauern), macht Screenshots der
// Leinwand zu sechs Zeitpunkten, liest den Ticker (#feed) und die Wertungstabelle
// (#wtabL/#wtabR) aus dem DOM und prueft die drei neuen Chaos-Zeilen.
//
// EIGENER HTTP-SERVER auf public/ (Port 0, also frei), Google-Fonts-Requests
// abgebrochen (der Agent-Proxy blockt sie, `waitUntil:"load"` wartete sonst), Server und
// Browser im finally beendet.
//
// SAAT-HAKEN: reset() ruft build() ohne Saat, das Spiel spielt also immer Saat 1337 und
// damit immer denselben Kurs. Statt dafuer einen Haken in die ausgelieferte Engine zu
// bauen, ersetzt dieser Server EINE Zeile beim Ausliefern (`bauSpurt(saat)` ->
// `bauSpurt(saat ?? window.__saat)`). Die Datei im Repo bleibt unberuehrt; die Ersetzung
// steht unten im Klartext und wird bei Nichttreffer laut.
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

const ROOT = process.argv[2], OUT = process.argv[3];
mkdirSync(OUT, { recursive: true });

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".json": "application/json" };
const ALT = "if(istBahn(disc)){bahnDisc=disc; return bauSpurt(saat);}";
const NEU = "if(istBahn(disc)){bahnDisc=disc; return bauSpurt(saat===undefined&&window.__saat!==undefined?window.__saat:saat);}";
let ersetzt = false;

const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p === "/") p = "/mockups/battle-mode.html";
    const fp = join(ROOT, p);
    let d = await readFile(fp);
    if (p.endsWith("battle-mode.engine.js")) {
      let s = d.toString("utf8");
      if (!s.includes(ALT)) throw new Error("Saat-Haken: Ankerzeile nicht gefunden");
      s = s.replace(ALT, NEU); ersetzt = true; d = Buffer.from(s, "utf8");
    }
    res.writeHead(200, { "Content-Type": MIME[extname(fp)] || "application/octet-stream" });
    res.end(d);
  } catch (e) { res.writeHead(404); res.end("nf: " + e.message); }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;

// Dieselbe Mischung wie bauSpurt (FNV-1a ueber die vier Bytes, zweimal, dann ein
// LCG-Schritt, obere 24 Bit) — damit hier steht, WELCHE Saat welchen Kurs zieht, statt
// dass es geraten wird. Nachweis: docs/design/takeshi-kursmischer-nachweis-06-09.mjs.
const KURSE = ["Nordhof", "Sumpfpfad", "Die Mauern"];
function kursVon(saat) {
  let s0 = (saat >>> 0) || 1;
  for (let r = 0; r < 2; r++) {
    let h = 2166136261;
    for (let i = 0; i < 4; i++) { h ^= (s0 >>> (i * 8)) & 255; h = Math.imul(h, 16777619); }
    s0 = (h >>> 0) || 1;
  }
  s0 = (Math.imul(s0, 1664525) + 1013904223) >>> 0;
  return KURSE[Math.floor((s0 >>> 8) / 16777216 * KURSE.length)];
}
// Fuer jeden Kurs die erste Saat aus der Messreihe 1337 + i*7919, die ihn zieht.
const saatFuer = {};
for (let i = 0; i < 60 && Object.keys(saatFuer).length < 3; i++) {
  const s = 1337 + i * 7919, k = kursVon(s);
  if (!saatFuer[k]) saatFuer[k] = s;
}

const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
let browser;
const bericht = [];
try {
  browser = await chromium.launch(existsSync(fest)
    ? { executablePath: fest, args: ["--no-sandbox", "--disable-dev-shm-usage"] } : {});
  for (const kurs of KURSE) {
    const saat = saatFuer[kurs];
    const p = await browser.newPage({ viewport: { width: 1300, height: 700 } });
    const fehler = []; p.on("pageerror", (e) => fehler.push(String(e)));
    const schlecht = []; p.on("response", (r) => { if (r.status() >= 400) schlecht.push(r.status() + " " + r.url()); });
    await p.route("https://fonts.googleapis.com/**", (r) => r.abort());
    await p.route("https://fonts.gstatic.com/**", (r) => r.abort());
    await p.addInitScript((s) => { window.__saat = s; }, saat);
    await p.goto(`http://127.0.0.1:${port}/mockups/battle-mode.html`, { waitUntil: "load" });
    await p.waitForFunction(() => window.__arena && window.__arena.setDisc, null, { timeout: 30000 });
    await p.evaluate(() => window.__arena.setDisc("takeshis-castle"));
    await p.click("#t2"); await p.waitForTimeout(500);
    const cv = await p.$("#cv");
    const kurz = kurs.toLowerCase().replace(/[^a-z]/g, "");
    await cv.screenshot({ path: `${OUT}/${kurz}-00-karte-vor-start.png` });
    await p.click("#play");
    let last = 0;
    for (const [ms, tag] of [[2500, "01-start-pulk"], [7000, "02-holzhof"], [13000, "03-see-steg"],
                             [21000, "04-hang"], [32000, "05-burghof"], [46000, "06-karte-ende"]]) {
      await p.waitForTimeout(ms - last); last = ms;
      await cv.screenshot({ path: `${OUT}/${kurz}-${tag}.png` });
    }
    const ticker = await p.$eval("#feed", (n) => n.innerText);
    const tab = await p.evaluate(() => {
      const kopf = [...document.querySelectorAll("#wtabL thead th, #wtab thead th, table thead th")]
        .map((t) => t.textContent).filter(Boolean);
      const zeilen = [...document.querySelectorAll("table tbody tr")].slice(0, 24)
        .map((tr) => [...tr.children].map((td) => td.textContent).join(" | "));
      return { kopf, zeilen };
    });
    const z = (re) => (ticker.match(re) || []).length;
    bericht.push({
      kurs, saat,
      rammt: z(/rammt .* vor der Falle um\./g),
      insLeere: z(/sieht .* kommen und lässt ihn ins Leere laufen\./g),
      stecktWeg: z(/steckt den Rempler weg\./g),
      gedraenge: z(/Gedränge an Falle \d+ — \d+ Mann an einer Stelle/g),
      fallenZeilen: z(/(reißt die Falle|nimmt die Falle mit Gewalt)/g),
      ausgeschieden: z(/scheidet aus/g),
      tickerZeilen: ticker.split("\n").filter(Boolean).length,
      tabellenkopf: tab.kopf.join(" "),
      tabellenzeile: tab.zeilen[0] || "(leer)",
      fehler: fehler.length ? fehler.join(" | ") : "keine",
      http: schlecht.length ? schlecht.join(" | ") : "keine",
    });
    writeFileSync(`${OUT}/${kurz}-ticker.txt`, ticker);
    await p.close();
  }
} finally { if (browser) await browser.close(); server.close(); }

console.log("Saat-Haken eingesetzt:", ersetzt);
for (const b of bericht) {
  console.log("\n=== Kurs " + b.kurs + " (Saat " + b.saat + ") ===");
  console.log("  rammt…um: " + b.rammt + "   sieht…kommen: " + b.insLeere
    + "   steckt weg: " + b.stecktWeg + "   Gedränge-Zeilen: " + b.gedraenge);
  console.log("  Fallen-Zeilen: " + b.fallenZeilen + "   ausgeschieden: " + b.ausgeschieden
    + "   Ticker gesamt: " + b.tickerZeilen);
  console.log("  Tabellenkopf: " + b.tabellenkopf);
  console.log("  erste Zeile:  " + b.tabellenzeile);
  console.log("  Seitenfehler: " + b.fehler + "   HTTP>=400: " + b.http);
}
