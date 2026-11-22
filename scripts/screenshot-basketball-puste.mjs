// Aufnahmen fuer die Basketball-Puste (22.11., docs/design/basketball-puste-22-11.md): das Basketballspiel in der
// Motor-Seite (battle-mode.html), vorgespult bis die Puste-Leisten unter den Fuessen unterschiedlich weit gefallen sind
// (Ticker "ist außer Puste").
//
//   node scripts/screenshot-basketball-puste.mjs <ausgabe.png> [--viewport=1920x1080] [--vorspulen=<Sonden-Ticks>] [--saat=<n>] [--alt] [--canvas]
//
// `--alt` schaltet die alte Puste-Regel (window.__arena.basketballPuste("alt")) fuer den Vorher-Vergleich.
// Die Kader kommen aus data/generated/kaderfamilie-live-save.json (erste Paarung). Aufnahmen laufen unter
// `flock /tmp/oly-aufnahme.lock`.
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
  ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".webp": "image/webp" };
const arg = (name, def) => (process.argv.find((a) => a.startsWith(`--${name}=`)) || `--${name}=${def}`).split("=")[1];
const out = process.argv.slice(2).find((a) => !a.startsWith("--"));
if (!out) { console.error("Nutzung: node scripts/screenshot-basketball-puste.mjs <ausgabe.png> [--viewport=1920x1080] [--vorspulen=N] [--saat=N] [--alt] [--canvas]"); process.exit(1); }
const [VIEW_B, VIEW_H] = arg("viewport", "1920x1080").split("x").map(Number);
const VORSPULEN = Number(arg("vorspulen", 0));
const SAAT = Number(arg("saat", 4242));
const ALT = process.argv.includes("--alt");
// --canvas: nur das Spielfeld (Canvas) aufnehmen, in doppelter Pixeldichte -- die Puste-Leiste unter den Fuessen ist klein.
const NUR_CANVAS = process.argv.includes("--canvas");
mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
const v = JSON.parse(readFileSync(path.join(WURZEL, "data/generated/kaderfamilie-live-save.json"), "utf8")).varianten[0];

const server = await new Promise((resolve) => {
  const s = createServer((req, res) => {
    const p = path.join(PUBLIC, decodeURIComponent(new URL(req.url, "http://localhost").pathname));
    if (!p.startsWith(PUBLIC)) { res.writeHead(403); res.end(); return; }
    try { statSync(p); res.writeHead(200, { "Content-Type": MIME[path.extname(p)] || "application/octet-stream" }); createReadStream(p).pipe(res); }
    catch { res.writeHead(404); res.end(); }
  });
  s.listen(0, "127.0.0.1", () => resolve(s));
});
let browser;
try {
  browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
  const seite = await browser.newPage({ viewport: { width: VIEW_B, height: VIEW_H }, deviceScaleFactor: NUR_CANVAS ? 2 : 1 });
  const fehler = [];
  seite.on("pageerror", (e) => fehler.push(String(e)));
  await seite.addInitScript(({ heim, gast }) => { window.__olyArenaKader = { heim, gast }; }, { heim: v.heim, gast: v.gast });
  await seite.goto(`http://127.0.0.1:${server.address().port}/mockups/battle-mode.html`, { waitUntil: "networkidle" });
  await seite.waitForFunction(() => window.__arena && window.__arena.setDisc, null, { timeout: 30000 });
  await seite.evaluate(({ ALT }) => { if (ALT) window.__arena.basketballPuste("alt"); window.__arena.setDisc("basketball"); }, { ALT });
  await seite.click("#t2");
  await sendungsrahmenAus(seite, { countdown: true, finale: false, nachlauf: false });
  await seite.click("#play");
  await warteAufAnpfiff(seite);
  if (VORSPULEN > 0) {
    await seite.click("#play");   // Pause: ab hier laeuft nur noch die Sonden-Uhr
    await seite.evaluate((n) => { window.__arena.sondenLauf(n); }, VORSPULEN);
    await seite.waitForTimeout(600);
  } else {
    await seite.waitForTimeout(4000);
  }
  const stand = await seite.evaluate(() => {
    const t = [...(document.querySelectorAll("#feed div"))].slice(-6).map((d) => d.textContent);
    return { feed: t };
  });
  console.log("Ticker (letzte Zeilen):", JSON.stringify(stand.feed));
  if (NUR_CANVAS) await seite.locator("canvas:visible").first().screenshot({ path: out });
  else await seite.screenshot({ path: out });
  console.log("geschrieben:", out, "Seitenfehler:", fehler.length ? fehler.slice(0, 3) : "keine");
} finally {
  if (browser) await browser.close();
  server.close();
}
