// Prüfstand der Historie-Seiten: baut das Browser-Bundle (esbuild), serviert es mit public/ und nimmt Bilder auf.
// AUFRUF (Aufnahme-Schlange beachten): flock /tmp/oly-aufnahme.lock node scripts/historie-pruefstand/aufnahme.mjs [ausgabeordner]
import { build } from "esbuild";
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";

const wurzel = process.cwd();
const ausgabe = path.resolve(process.argv[2] ?? "docs/design/historie-bau-18-11");
const arbeit = await fs.mkdtemp(path.join(os.tmpdir(), "historie-pruefstand-"));
let PORT = 0;

await build({
  entryPoints: [path.join(wurzel, "scripts/historie-pruefstand/entry.tsx")],
  outdir: arbeit,
  entryNames: "bundle",
  bundle: true,
  format: "iife",
  jsx: "automatic",
  platform: "browser",
  tsconfig: path.join(wurzel, "tsconfig.json"),
  loader: { ".css": "css", ".json": "json" },
  define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "error",
});

const HTML = `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Prüfstand Historie</title>
<style>
@font-face{font-family:"RaniraSeason";src:url("/fonts/ranira-bold-italic.otf") format("opentype")}
@font-face{font-family:"Barlow Condensed";font-weight:500;src:url("/fonts/barlow-condensed-latin-500-normal.woff2") format("woff2")}
@font-face{font-family:"Barlow Condensed";font-weight:600;src:url("/fonts/barlow-condensed-latin-600-normal.woff2") format("woff2")}
@font-face{font-family:"Barlow Condensed";font-weight:700;src:url("/fonts/barlow-condensed-latin-700-normal.woff2") format("woff2")}
html,body{margin:0;background:#06080c;color:#eef2f8;font-family:"Barlow Condensed",Arial,sans-serif;overflow:hidden}
.pr-band{display:flex;align-items:center;gap:2rem;height:3.4rem;padding:0 1.2rem;background:linear-gradient(180deg,#0b0f16,#070a10);border-bottom:1px solid rgba(244,230,196,.13);box-sizing:border-box}
.pr-ort small{display:block;font-size:.62rem;letter-spacing:.16em;color:#f0c35a;font-weight:700}
.pr-ort b{font:italic 400 1.7rem/1 "RaniraSeason",Georgia,serif;color:#fff}
.pr-reiter{display:flex;gap:1.2rem}
.pr-reiter button{background:none;border:0;border-bottom:2px solid transparent;color:#9aa7ba;font:600 .9rem "Barlow Condensed";letter-spacing:.14em;padding:.3rem 0;cursor:pointer}
.pr-reiter button.an{color:#fff;border-color:#f0c35a}
.pr-hinweis{font-size:.7rem;color:#66738a;letter-spacing:.08em;text-transform:uppercase}
.fb-slot{flex:1;display:flex;justify-content:center;font-size:16px}
.pr-inhalt{margin-left:0}
</style><link rel="stylesheet" href="/bundle.css"></head><body><div id="wurzel"></div><script src="/bundle.js"></script></body></html>`;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://x").pathname;
  try {
    if (url === "/" || url === "/index.html") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(HTML);
      return;
    }
    if (url === "/bundle.js" || url === "/bundle.css") {
      const datei = await fs.readFile(path.join(arbeit, url.slice(1)));
      res.writeHead(200, { "content-type": url.endsWith(".js") ? "text/javascript" : "text/css" }).end(datei);
      return;
    }
    const datei = await fs.readFile(path.join(wurzel, "public", decodeURIComponent(url)));
    const typ = url.endsWith(".jpg") || url.endsWith(".jpeg") ? "image/jpeg" : url.endsWith(".png") ? "image/png" : url.endsWith(".woff2") ? "font/woff2" : url.endsWith(".otf") ? "font/otf" : "application/octet-stream";
    res.writeHead(200, { "content-type": typ }).end(datei);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((ok) => server.listen(0, ok));
PORT = server.address().port;
await fs.mkdir(ausgabe, { recursive: true });

const browser = await chromium.launch();
const GROESSEN = [
  [1920, 1080],
  [2560, 1440],
];
const messungen = [];

async function messe(page, name) {
  const m = await page.evaluate(() => {
    const seite = document.querySelector(".hist");
    const kaputt = [];
    for (const el of document.querySelectorAll(".hist .pan, .hist .pk, .hist .fuss, .hist .tb2, .hist .tz")) {
      if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== "auto" && getComputedStyle(el).overflow !== "auto") {
        kaputt.push(`${el.className}: ${el.scrollWidth}>${el.clientWidth}`);
      }
    }
    return {
      seitenScroll: document.documentElement.scrollHeight > window.innerHeight + 1 || document.documentElement.scrollWidth > window.innerWidth + 1,
      seiteH: seite ? seite.getBoundingClientRect().height : null,
      fensterH: window.innerHeight,
      ueberlauf: kaputt.slice(0, 5),
    };
  });
  messungen.push({ name, ...m });
}

for (const [breite, hoehe] of GROESSEN) {
  const kontext = await browser.newContext({ viewport: { width: breite, height: hoehe }, deviceScaleFactor: 1 });
  const page = await kontext.newPage();
  const fehler = [];
  page.on("pageerror", (e) => fehler.push(String(e)));
  page.on("console", (m) => m.type() === "error" && fehler.push(m.text()));
  const aufnahme = async (name) => {
    await page.waitForTimeout(350);
    await messe(page, `${name}-${breite}x${hoehe}`);
    await page.screenshot({ path: path.join(ausgabe, `${name}-${breite}x${hoehe}.png`) });
  };
  const gehe = async (seite) => {
    await page.goto(`http://localhost:${PORT}/?seite=${seite}`, { waitUntil: "load" });
    await page.waitForSelector(".hist");
    await page.waitForTimeout(500);
  };

  // 1 Archiv, Saison 3 (juengste archivierte), Sport
  await gehe("archiv");
  await aufnahme("01-archiv-saison3");
  // 2 Archiv Saison 2, Geld
  await page.click('[data-testid="historie-saison-2"]');
  await page.click('.hist .pan:nth-of-type(1) .seg button:has-text("Geld")');
  await aufnahme("02-archiv-saison2-geld");
  // 3 Blatt
  await page.click('[data-testid="historie-zeile-V-W"]');
  await aufnahme("03-archiv-blatt-team-verlauf");
  await page.keyboard.press("Escape");
  // 4 Transfers Fenster Saison 3
  await gehe("transfers");
  await page.click('[data-testid="historie-fenster-3"]');
  await aufnahme("04-transfers-fenster-saison3");
  // 5 Kaderaufbau
  await page.click('[data-testid="historie-fenster-1"]');
  await aufnahme("05-transfers-kaderaufbau-saison1");
  // 6 Alle Fenster
  await page.click(".hist .zl .al");
  await aufnahme("06-transfers-alle-fenster");
  // 7 Ewige Tabelle Punkte, 8 Titel
  await gehe("ewig");
  await aufnahme("07-ewige-tabelle-punkte");
  await page.click('.hist .tb2 .seg button:has-text("Titel")');
  await aufnahme("08-ewige-tabelle-titel");
  await page.click('[data-testid^="historie-ewig-zeile-"]');
  await aufnahme("09-ewige-tabelle-blatt");

  if (fehler.length) messungen.push({ name: `fehler-${breite}`, fehler: fehler.slice(0, 5) });
  await kontext.close();
}
await browser.close();
server.close();
await fs.writeFile(path.join(arbeit, "messung.json"), JSON.stringify(messungen, null, 2));
console.log(JSON.stringify(messungen, null, 2));
await fs.rm(arbeit, { recursive: true, force: true });
