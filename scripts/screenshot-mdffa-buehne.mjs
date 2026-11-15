// MINI-DM-FFA-BUEHNE SICHTPROBE (08.11.): fotografiert die Vier-Ecken-Leinwand (#mdffaCv) der Battle Arena
// zu mehreren Zeitpunkten der Rundenshow (Einlauf, mitten in Runde 1, Endstand).
// Aufruf: node scripts/screenshot-mdffa-buehne.mjs [ausgabe-praefix] [variante|-]
// Reine Anzeige-Sonde. HTTP statt file:// (Figuren/Kulissen brauchen gleiche Herkunft).
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, createReadStream, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = path.join(WURZEL, "public");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".webp": "image/webp" };
const praefix = process.argv[2] || path.join(WURZEL, "tmp-ux-audit", "mdffa-buehne");
const variante = process.argv[3] && process.argv[3] !== "-" ? process.argv[3] : null;
mkdirSync(path.dirname(praefix), { recursive: true });

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
  const seite = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const fehler = [];
  seite.on("pageerror", (e) => fehler.push(String(e)));
  await seite.goto(`http://127.0.0.1:${server.address().port}/mockups/battle-mode.html`, { waitUntil: "networkidle" });
  await seite.waitForFunction(() => window.__arena && window.__arena.setDisc, null, { timeout: 30000 });
  await seite.evaluate((v) => { const A = window.__arena; if (A.kulisseQa) A.kulisseQa(v); A.setDisc("mini-dm"); }, variante);
  await seite.click("#t2");
  await seite.waitForTimeout(1500);
  const foto = async (name) => {
    const url = await seite.evaluate(() => document.getElementById("mdffaCv").toDataURL("image/png"));
    const ziel = `${praefix}-${name}.png`;
    writeFileSync(ziel, Buffer.from(url.split(",")[1], "base64"));
    console.log("Screenshot: " + ziel);
  };
  await foto("einlauf");
  await seite.click("#mdffaStart");
  await seite.waitForTimeout(2600);
  await foto("runde1");
  await seite.waitForTimeout(900);
  await foto("runde1b");
  await seite.click("#mdffaAlles");
  await seite.waitForTimeout(800);
  await foto("endstand");
  console.log("Seitenfehler: " + (fehler.length ? fehler.join(" | ") : "keine"));
} finally {
  if (browser) await browser.close();
  server.close();
}
