// Prüfstand Mutator-Auflösung: baut das Browser-Bundle (esbuild), serviert es samt public/ und nimmt Bilder auf.
// AUFRUF: flock /tmp/oly-aufnahme.lock node scripts/mutator-aufloesung-pruefstand/aufnahme.mjs [ausgabeordner]
import { build } from "esbuild";
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";

const wurzel = process.cwd();
const ausgabe = path.resolve(process.argv[2] ?? "docs/design/mutator-aufloesung-22-11");
const arbeit = await fs.mkdtemp(path.join(os.tmpdir(), "mutator-pruefstand-"));

await build({
  entryPoints: [path.join(wurzel, "scripts/mutator-aufloesung-pruefstand/entry.tsx")],
  outdir: arbeit,
  entryNames: "bundle",
  bundle: true,
  format: "iife",
  jsx: "automatic",
  platform: "browser",
  tsconfig: path.join(wurzel, "tsconfig.json"),
  loader: { ".css": "css", ".json": "json" },
  external: ["/fonts/*", "/sprites/*", "/mockups/*", "/*.png", "/*.jpg", "/*.svg"],
  define: { "process.env.NODE_ENV": '"production"', global: "globalThis" },
  banner: { js: 'var process={env:{NODE_ENV:"production"},cwd:function(){return "/"},platform:"browser",versions:{}};' },
  logLevel: "error",
});

const HTML = `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Prüfstand Mutator</title>
<style>html,body{margin:0;background:#06080c;color:#eef2f8;overflow:auto}</style><link rel="stylesheet" href="/bundle.css"></head><body><div id="wurzel"></div><script src="/bundle.js"></script></body></html>`;
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://x").pathname;
  try {
    if (url === "/" || url === "/index.html") return void res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(HTML);
    if (url === "/bundle.js" || url === "/bundle.css") {
      const datei = await fs.readFile(path.join(arbeit, url.slice(1)));
      return void res.writeHead(200, { "content-type": url.endsWith(".js") ? "text/javascript" : "text/css" }).end(datei);
    }
    const datei = await fs.readFile(path.join(wurzel, "public", decodeURIComponent(url)));
    const typ = url.endsWith(".png") ? "image/png" : url.endsWith(".woff2") ? "font/woff2" : url.endsWith(".otf") ? "font/otf" : "application/octet-stream";
    res.writeHead(200, { "content-type": typ }).end(datei);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((ok) => server.listen(0, ok));
const PORT = server.address().port;
await fs.mkdir(ausgabe, { recursive: true });

const browser = await chromium.launch();
const fehler = [];
for (const [b, h] of [
  [1920, 1080],
  [2560, 1440],
]) {
  const kontext = await browser.newContext({ viewport: { width: b, height: h }, deviceScaleFactor: 1 });
  const page = await kontext.newPage();
  page.on("pageerror", (e) => fehler.push(String(e)));
  for (const diszi of ["basketball", "zeitfahren"]) {
    for (const ansicht of ["wertung", "ergebnis"]) {
      for (const vorher of [1, 0]) {
        await page.goto(`http://localhost:${PORT}/?ansicht=${ansicht}&diszi=${diszi}&vorher=${vorher}`, { waitUntil: "load" });
        await page.waitForSelector(ansicht === "wertung" ? ".swm" : "[data-oly-result]", { timeout: 15000 });
        await page.waitForTimeout(500);
        const m = await page.evaluate(() => ({
          scrollX: document.documentElement.scrollWidth > innerWidth + 1,
          scrollY: document.documentElement.scrollHeight > innerHeight + 1,
        }));
        console.log(`${diszi} ${ansicht} ${vorher ? "vorher" : "nachher"} ${b}x${h}`, JSON.stringify(m));
        await page.screenshot({ path: path.join(ausgabe, `${ansicht}-${diszi}-${vorher ? "vorher" : "nachher"}-${b}.png`) });
      }
    }
  }
  await kontext.close();
}
await browser.close();
server.close();
await fs.rm(arbeit, { recursive: true, force: true });
if (fehler.length) console.log("FEHLER:", fehler.slice(0, 5));
