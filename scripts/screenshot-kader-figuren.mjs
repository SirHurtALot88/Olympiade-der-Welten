// Sichtpruefung "hat jeder Spieler eines Kaders eine PixelLab-Figur?" (21.11., D-P-Kader).
// Serviert public/ selbst, oeffnet die Arena bei 1920x1080, reicht einen Kader per
// window.__arena.kaderSetzen() herein und nimmt je Disziplin ein Bild vor dem Start und eines im
// Lauf auf. Dazu die Sonde figurenStand(): wem fehlen Grundpose/Bilder.
//
// Aufruf: node scripts/screenshot-kader-figuren.mjs <kader.json> <ausgabeOrdner> <disziplin> [disziplin ...]
//   <kader.json>: {heim:[...], gast:[...]} in der Form der Arena-Kader (n, c, r, sub, tp, tn, row, d, a, groesse).
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, createReadStream, statSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { sendungsrahmenAus, warteAufAnpfiff } from "./lib/arena-anpfiff.mjs";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = path.join(WURZEL, "public");
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".webp": "image/webp",
  ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg", ".woff2": "font/woff2", ".ttf": "font/ttf" };

const [kaderPfad, ordner, ...disziplinen] = process.argv.slice(2);
if (!kaderPfad || !ordner || !disziplinen.length) {
  console.error("Nutzung: node scripts/screenshot-kader-figuren.mjs <kader.json> <ordner> <disziplin> [...]");
  process.exit(1);
}
const kader = JSON.parse(readFileSync(kaderPfad, "utf8"));
mkdirSync(ordner, { recursive: true });

const server = await new Promise((resolve) => {
  const s = createServer((req, res) => {
    let p = path.join(PUBLIC, decodeURIComponent(new URL(req.url, "http://localhost").pathname));
    if (!p.startsWith(PUBLIC + path.sep)) { res.writeHead(403); res.end(); return; }
    try {
      if (statSync(p).isDirectory()) p = path.join(p, "index.html");
      res.writeHead(200, { "Content-Type": MIME[path.extname(p)] || "application/octet-stream" });
      createReadStream(p).pipe(res);
    } catch { res.writeHead(404); res.end("not found"); }
  });
  s.listen(0, "127.0.0.1", () => resolve(s));
});

let browser;
try {
  browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
  for (const disziplin of disziplinen) {
    const seite = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    const fehler = [];
    seite.on("pageerror", (e) => fehler.push(String(e)));
    await seite.goto(`http://127.0.0.1:${server.address().port}/mockups/battle-mode.html`, { waitUntil: "load" });
    await seite.waitForFunction(() => window.__arena && window.__arena.setDisc, null, { timeout: 30000 });
    await seite.evaluate((k) => window.__arena.kaderSetzen(k), kader);
    await seite.evaluate((d) => window.__arena.setDisc(d), disziplin);
    await seite.click("#t2").catch(() => {});
    await seite.waitForTimeout(2500);
    await seite.screenshot({ path: path.join(ordner, disziplin + "-1-start.png") });
    await sendungsrahmenAus(seite, { countdown: true, finale: true, nachlauf: false });
    await seite.click("#play");
    await warteAufAnpfiff(seite);
    await seite.waitForTimeout(Number(process.env.OLY_LAUF_MS || 4000));
    const stand = await seite.evaluate(() => window.__arena.figurenStand());
    console.log(disziplin, "figurenStand:", JSON.stringify(stand));
    await seite.screenshot({ path: path.join(ordner, disziplin + "-2-lauf.png") });
    const cv = await seite.$("#cv");
    if (cv) await cv.screenshot({ path: path.join(ordner, disziplin + "-3-arena.png") });
    console.log(disziplin, "Seitenfehler:", fehler.length ? fehler.join(" | ") : "keine");
    await seite.close();
  }
} finally {
  if (browser) await browser.close();
  server.close();
}
