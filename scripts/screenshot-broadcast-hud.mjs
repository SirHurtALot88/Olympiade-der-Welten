// Sichtpruefung fuer die Broadcast-Praesentation (Recherche
// docs/design/broadcast-praesentation-uebergreifend-recherche-06-09.md): HUD-Overlay
// (#bbug) waehrend des laufenden Spiels, ein Highlight-Callout (#bbugcallout) bei einem
// big-Ereignis und der Hoehepunkte-Rueckblick (#ehighlights) im Endstand-Overlay.
// Kein Teil der Abnahme-Sonden -- nur zum Ansehen. Serviert public/ ueber einen echten
// HTTP-Server (nicht file://), damit Sprite-Pfade laden.
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = path.join(WURZEL, "public");
const OUT_DIR = process.argv[2] || path.join(WURZEL, "tmp-ux-audit");
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const MIME = { ".html": "text/html", ".js": "text/javascript", ".png": "image/png", ".json": "application/json", ".css": "text/css" };

function starteServer() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, "http://localhost");
      let p = path.join(PUBLIC, decodeURIComponent(url.pathname));
      if (!p.startsWith(PUBLIC)) { res.writeHead(403); res.end(); return; }
      try {
        const st = statSync(p);
        if (st.isDirectory()) p = path.join(p, "index.html");
        const ext = path.extname(p);
        res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
        createReadStream(p).pipe(res);
      } catch {
        res.writeHead(404); res.end("not found: " + p);
      }
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const server = await starteServer();
const port = server.address().port;
const SEITE = `http://127.0.0.1:${port}/mockups/battle-mode.html`;
let browser;
try {
  browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
  const seite = await browser.newPage({ viewport: { width: 1300, height: 760 } });
  const fehler = [];
  seite.on("pageerror", (e) => fehler.push(String(e)));
  seite.on("console", (m) => { if (m.type() === "error") fehler.push("console: " + m.text()); });
  await seite.goto(SEITE, { waitUntil: "networkidle" });
  await seite.waitForFunction(() => window.__arena && window.__arena.setDisc, null, { timeout: 30000 });

  // ---- 1) Hockey: HUD-Overlay (#bbug) waehrend des laufenden Spiels ----
  await seite.evaluate(() => window.__arena.setDisc("hockey"));
  await seite.click("#t2");
  await seite.click("#play");
  await seite.click("#spd"); // 2x
  await seite.click("#spd"); // 4x
  await seite.waitForTimeout(2500);
  await (await seite.$(".arenaraum")).screenshot({ path: path.join(OUT_DIR, "01-bbug-overlay-live.png") });
  console.log("bbug hidden? " + await seite.$eval("#bbug", (e) => e.hidden));

  // ---- 2) Denselben Lauf weiterlaufen lassen, bis ein big-Ereignis den Callout ausloest ----
  let calloutGefunden = false;
  for (let i = 0; i < 40 && !calloutGefunden; i++) {
    await seite.waitForTimeout(1000);
    const sichtbar = await seite.$eval("#bbugcallout", (e) => !e.hidden && e.textContent.trim().length > 0);
    if (sichtbar) {
      calloutGefunden = true;
      await (await seite.$(".arenaraum")).screenshot({ path: path.join(OUT_DIR, "02-callout-highlight.png") });
      const txt = await seite.$eval("#bbugcallout", (e) => e.textContent);
      console.log("Callout getroffen: " + JSON.stringify(txt));
    }
  }
  if (!calloutGefunden) console.log("KEIN Callout in 40s beobachtet (Zufallslauf ohne Tor?).");

  // ---- 3) TDM (Kampf) bis zum Ende durchlaufen lassen -- Hoehepunkte-Rueckblick im Endstand ----
  await seite.evaluate(() => window.__arena.setDisc("tdm"));
  await seite.click("#t2");
  await seite.click("#play");
  await seite.click("#spd");
  await seite.click("#spd");
  await seite.waitForFunction(() => document.getElementById("endstand") && !document.getElementById("endstand").hidden, null, { timeout: 90000 });
  await seite.waitForTimeout(300);
  const anzahlHighlights = await seite.$$eval("#ehighlights .ehzeile", (els) => els.length);
  console.log("Anzahl Hoehepunkte im Endstand: " + anzahlHighlights);
  await (await seite.$("#endstand")).screenshot({ path: path.join(OUT_DIR, "03-endstand-hoehepunkte.png") });

  console.log("Screenshots in " + OUT_DIR);
  console.log("Seitenfehler: " + (fehler.length ? fehler.join(" | ") : "keine"));
} finally {
  if (browser) await browser.close();
  server.close();
}
