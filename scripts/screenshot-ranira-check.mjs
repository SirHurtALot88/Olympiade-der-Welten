import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = path.join(WURZEL, "public");
const OUT_DIR = process.argv[2] || path.join(WURZEL, "tmp-ux-audit", "ranira-check");
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const MIME = { ".html": "text/html", ".js": "text/javascript", ".png": "image/png", ".json": "application/json", ".css": "text/css", ".otf": "font/otf" };

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
  const seite = await browser.newPage({ viewport: { width: 1300, height: 900 } });
  const fehler = [];
  seite.on("pageerror", (e) => fehler.push(String(e)));
  await seite.goto(SEITE, { waitUntil: "networkidle" });
  await seite.evaluate(() => {
    document.querySelector(".oly-battle-arena")?.setAttribute("data-theme", "dark");
    document.querySelector(".oly-battle-arena")?.classList.add("im-spiel");
  });
  await seite.waitForFunction(() => window.__arena && window.__arena.setDisc, null, { timeout: 30000 });
  // Warte auf Font-Ladung
  await seite.evaluate(async () => { await document.fonts.load("700 italic 20px RaniraSeason"); });

  await seite.evaluate(() => window.__arena.setDisc("wettessen"));
  await seite.click("#t2");
  await seite.click("#play");
  await seite.click("#spd");
  await seite.click("#spd");
  await warteAufAnpfiff(seite); // Sendungsrahmen-Paket 07.10.: Anpfiff-Countdown abwarten, s. scripts/lib/arena-anpfiff.mjs
  await seite.waitForTimeout(4000);
  await seite.screenshot({ path: path.join(OUT_DIR, "wettessen.png") });

  await seite.evaluate(() => window.__arena.setDisc("gewichtheben"));
  await seite.click("#play");
  await warteAufAnpfiff(seite);
  await seite.waitForTimeout(3000);
  await seite.screenshot({ path: path.join(OUT_DIR, "gewichtheben.png") });

  await seite.evaluate(() => window.__arena.setDisc("mini-dm"));
  await seite.click("#play");
  await seite.waitForTimeout(3000);
  await seite.screenshot({ path: path.join(OUT_DIR, "minidm.png") });

  console.log("Fehler:", fehler.length ? fehler.join(" | ") : "keine");
  const fonts = await seite.evaluate(() => Array.from(document.fonts).map(f => `${f.family} ${f.style} ${f.weight} ${f.status}`));
  console.log("Geladene Fonts:", fonts.join(" | "));
} finally {
  await browser?.close();
  server.close();
}
