// SICHTPRUEFUNG fuer "Ticker entschlacken + Protokoll-Reiter" (F1-Broadcast-Audit Runde 2,
// 30.09., Prio-1-Punkt 8). Kein Teil der Abnahme-Sonden -- nur zum Ansehen/Belegen.
//
// Je Disziplin: Produktionsmodus wie im Host (data-theme="dark" + .im-spiel), Spiel per
// window.__arena.sondenLauf() deterministisch bis zu einer festen Sendezeit gefahren, dann
//   1. Screenshot des Arena-Panels mit dem sichtbaren (gedrosselten) Ticker,
//   2. Klick auf den Reiter "Protokoll", Screenshot desselben Moments mit der vollstaendigen
//      Liste.
// Dazu die Zeilenzahlen beider Listen an diesem Moment.
//
// Aufruf: node scripts/verify-ticker-protokoll-01-10.mjs [disziplin,...] [sekunden] [ausgabeOrdner]
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = path.join(WURZEL, "public");
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".webp": "image/webp",
  ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg",
};
const DISZIPLINEN = (process.argv[2] || "tdm,eiskunstlauf").split(",").map((s) => s.trim());
const SEKUNDEN = Number(process.argv[3] || 45);
const AUSGABE = process.argv[4] || path.join(WURZEL, "tmp-ux-audit", "ticker-protokoll-01-10");
mkdirSync(AUSGABE, { recursive: true });

function starteServer() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, "http://localhost");
      let p = path.join(PUBLIC, decodeURIComponent(url.pathname));
      if (!p.startsWith(PUBLIC)) { res.writeHead(403); res.end(); return; }
      try {
        const st = statSync(p);
        if (st.isDirectory()) p = path.join(p, "index.html");
        res.writeHead(200, { "Content-Type": MIME[path.extname(p)] || "application/octet-stream" });
        createReadStream(p).pipe(res);
      } catch { res.writeHead(404); res.end("not found"); }
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

const server = await starteServer();
const SEITE = `http://127.0.0.1:${server.address().port}/mockups/battle-mode.html`;
let browser;
try {
  browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
  for (const disc of DISZIPLINEN) {
    const seite = await browser.newPage({ viewport: { width: 1300, height: 900 } });
    const fehler = [];
    seite.on("pageerror", (e) => fehler.push(String(e)));
    await seite.goto(SEITE, { waitUntil: "networkidle" });
    await seite.addStyleTag({ content: "body{background:#0B1018}" });
    await seite.evaluate(() => {
      document.documentElement.setAttribute("data-theme", "dark");
      document.querySelector(".oly-battle-arena")?.setAttribute("data-theme", "dark");
      document.querySelector(".oly-battle-arena")?.classList.add("im-spiel");
    });
    await seite.waitForFunction(() => window.__arena && window.__arena.setDisc, null, { timeout: 30000 });
    await seite.evaluate((d) => window.__arena.setDisc(d), disc);
    await seite.click("#t2");
    await seite.evaluate((n) => window.__arena.sondenLauf(n), Math.round(SEKUNDEN * 60));
    // Einlauf-Overlay (falls noch sichtbar) verdeckt nur den Canvas, nicht den Ticker.
    const zaehle = () => seite.evaluate(() => ({
      ticker: document.querySelectorAll("#feed > div").length,
      protokoll: document.querySelectorAll("#protokoll > div").length,
      nurProtokoll: document.querySelectorAll("#protokoll > div.nurprot").length,
      reiter: document.getElementById("ftProtokoll")?.textContent.trim(),
    }));
    const box = await seite.$("#p2 .untenraum");
    const z = await zaehle();
    await box.screenshot({ path: path.join(AUSGABE, `${disc}-ticker.png`) });
    await seite.click("#ftProtokoll");
    await box.screenshot({ path: path.join(AUSGABE, `${disc}-protokoll.png`) });
    const frame = await seite.$("#p2 .frame");
    await frame.screenshot({ path: path.join(AUSGABE, `${disc}-panel-protokoll.png`) });
    const sichtbar = await seite.evaluate(() => ({
      feedHidden: document.getElementById("feed").hidden,
      protHidden: document.getElementById("protokoll").hidden,
    }));
    console.log(`[${disc} @ ${SEKUNDEN}s] Ticker ${z.ticker} Zeilen, Protokoll ${z.protokoll} Zeilen ` +
      `(davon ${z.nurProtokoll} nur dort), Reiter "${z.reiter}", nach Klick: feed.hidden=${sichtbar.feedHidden} ` +
      `protokoll.hidden=${sichtbar.protHidden}` + (fehler.length ? ` FEHLER: ${fehler.join(" | ")}` : ""));
    await seite.close();
  }
} finally {
  if (browser) await browser.close();
  server.close();
}
