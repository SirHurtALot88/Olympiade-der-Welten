// HYROX-ARENA-SICHTPROBE (Variante B, 17.11.): fotografiert die Leinwand des Battle-Mode-Motors im
// Spurt-Format HYROX zu mehreren Zeitpunkten in EINEM Lauf (die Arena ist eine feste Totale, der Verlauf
// zeigt sich nur im Rennen).
//
// Aufruf: node scripts/screenshot-hyrox-arena.mjs [ausgabeVerzeichnis] [--zeiten=3,15,40,90] [--tempo=2]
//   --zeiten  Wandsekunden nach dem Anpfiff, zu denen je ein PNG (1240x470, toDataURL) entsteht.
//   --tempo   Klicks auf #spd (1x -> 2x -> 4x), um das Rennen zu beschleunigen.
// Reine Anzeige-Sonde, liest nichts in die Simulation zurueck. HTTP statt file:// (absolute Sprite-Pfade).
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, createReadStream, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { sendungsrahmenAus, warteAufAnpfiff } from "./lib/arena-anpfiff.mjs";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = path.join(WURZEL, "public");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".webp": "image/webp" };

const args = process.argv.slice(2);
const zeiten = (args.find((a) => a.startsWith("--zeiten="))?.split("=")[1] || "3,15,40,90").split(",").map(Number);
const tempo = Number(args.find((a) => a.startsWith("--tempo="))?.split("=")[1] || 1);
const ordner = args.find((a) => !a.startsWith("--")) || path.join(WURZEL, "tmp-ux-audit", "hyrox-arena");
mkdirSync(ordner, { recursive: true });

const server = await new Promise((resolve) => {
  const s = createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    let p = path.join(PUBLIC, decodeURIComponent(url.pathname));
    if (!p.startsWith(PUBLIC)) { res.writeHead(403); res.end(); return; }
    try {
      if (statSync(p).isDirectory()) p = path.join(p, "index.html");
      res.writeHead(200, { "Content-Type": MIME[path.extname(p)] || "application/octet-stream" });
      createReadStream(p).pipe(res);
    } catch { res.writeHead(404); res.end(); }
  });
  s.listen(0, "127.0.0.1", () => resolve(s));
});
let browser;
try {
  const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
  browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
  const seite = await browser.newPage({ viewport: { width: 1300, height: 700 } });
  const fehler = [];
  seite.on("pageerror", (e) => fehler.push(String(e)));
  seite.on("console", (m) => { if (m.type() === "error") fehler.push("console: " + m.text()); });
  await seite.goto(`http://127.0.0.1:${server.address().port}/mockups/battle-mode.html`, { waitUntil: "networkidle" });
  await seite.waitForFunction(() => window.__arena && window.__arena.setDisc, null, { timeout: 30000 });
  await seite.evaluate(() => { const A = window.__arena; A.bahnFlags({ spurtFormat: "hyrox" }); A.setDisc("spurt"); });
  await seite.click("#t2");
  await sendungsrahmenAus(seite, { countdown: true, finale: false, nachlauf: false, figuren: false });
  await seite.click("#play");
  await warteAufAnpfiff(seite);
  for (let i = 0; i < tempo; i++) await seite.click("#spd");
  let vergangen = 0;
  for (const t of zeiten) {
    await seite.waitForTimeout(Math.max(0, (t - vergangen) * 1000));
    vergangen = t;
    const url = await seite.evaluate(() => document.getElementById("cv").toDataURL("image/png"));
    const datei = path.join(ordner, `hyrox-arena-t${String(t).padStart(3, "0")}.png`);
    writeFileSync(datei, Buffer.from(url.split(",")[1], "base64"));
    const probe = await seite.evaluate(() => (window.__arena.hyroxFahrplanProbe ? window.__arena.hyroxFahrplanProbe().rennT : null));
    console.log(`Screenshot: ${datei} (rennT ${probe})`);
  }
  console.log("Seitenfehler: " + (fehler.length ? fehler.join(" | ") : "keine"));
} finally {
  if (browser) await browser.close();
  server.close();
}
