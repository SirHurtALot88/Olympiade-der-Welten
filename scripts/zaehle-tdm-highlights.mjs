// Sichtpruefung fuer den TDM-Highlight-Fix (Opus-Ingame-Review, 27.09.): spielt mehrere TDM-
// Spiele mit verschiedenen Saaten in einem echten Browser durch (Playwright, Server ueber HTTP,
// nicht file://, wie die uebrigen screenshot-*.mjs-Sonden dieses Ordners) und zaehlt am Ende
// jedes Spiels, wie viele Ticker-Zeilen `.big` waren (= grosser Callout/HIGHLIGHTS-Eintrag)
// gegen die Gesamtzahl der Ticker-Zeilen. Kein Teil der rho-/Pp-Abnahme -- nur zum Ansehen,
// analog zu screenshot-broadcast-hud.mjs.
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = path.join(WURZEL, "public");
const OUT_DIR = process.argv[3] || path.join(WURZEL, "tmp-ux-audit");
const SAATEN = (process.argv[2] || "1337,4242,90210").split(",").map(s => s.trim());
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
const ergebnisse = [];
try {
  browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
  for (const saat of SAATEN) {
    const seite = await browser.newPage({ viewport: { width: 1300, height: 760 } });
    const fehler = [];
    seite.on("pageerror", (e) => fehler.push(String(e)));
    seite.on("console", (m) => { if (m.type() === "error") fehler.push("console: " + m.text()); });
    // VOR jedem Laden gesetzt (addInitScript laeuft vor jedem Skript der Seite, auch vor dem
    // top-level await, das window.__olyArenaKader liest) -- macht setDisc("tdm") deterministisch
    // auf DIESER Saat statt immer auf der Ersatzsaat 1337.
    const saatZahl = Number(saat);
    await seite.addInitScript((s) => {
      window.__olyArenaKader = { seedByDisciplineId: { tdm: s } };
    }, Number.isFinite(saatZahl) ? saatZahl : saat);
    await seite.goto(SEITE, { waitUntil: "networkidle" });
    await seite.waitForFunction(() => window.__arena && window.__arena.setDisc, null, { timeout: 30000 });

    await seite.evaluate(() => window.__arena.setDisc("tdm"));
    await seite.click("#t2");
    await seite.click("#play");
    await seite.click("#spd"); // 2x
    await seite.click("#spd"); // 4x

    // TDM endet bei Sim-Zeit t>95s (stepSim). Bei Tempo 4x reicht deutlich unter 60s Wandzeit;
    // grosszuegiger Deckel, falls der Browser gerade langsam ist.
    await seite.waitForFunction(() => {
      const btn = document.getElementById("play");
      return btn && btn.textContent === "Vorbei";
    }, null, { timeout: 90000 });

    const zeilen = await seite.evaluate(() => {
      const feed = document.getElementById("feed");
      const alle = [...feed.querySelectorAll("div")];
      const texte = (sel) => alle.filter(d => d.querySelector(sel)).map(d => d.textContent);
      const big = alle.filter(d => d.querySelector("span.big"));
      return {
        gesamt: alle.length,
        big: big.length,
        bigTexte: big.map(d => d.textContent),
        // ein paar Beispiele fuer NICHT-big Ausschaltungen/Treffer, zur Kontrolle, dass der
        // Ticker sie weiterhin zeigt (nur kleiner, ohne Banner) statt sie zu verschlucken.
        routineFaelltBeispiele: alle
          .filter(d => /faellt|ausgeschieden/.test(d.textContent) && !d.querySelector("span.big"))
          .slice(0, 3).map(d => d.textContent),
        routineTrefferBeispiele: alle
          .filter(d => /·\s*\d+$/.test(d.textContent) && !d.querySelector("span.big"))
          .slice(0, 3).map(d => d.textContent),
      };
    });

    ergebnisse.push({ saat, ...zeilen, fehler });
    await seite.close();
  }
} finally {
  if (browser) await browser.close();
  server.close();
}

for (const r of ergebnisse) {
  console.log(`\n=== Saat ${r.saat} ===`);
  console.log(`Ticker-Zeilen gesamt: ${r.gesamt}, davon big (grosser Callout): ${r.big}`);
  console.log("big-Zeilen:");
  for (const t of r.bigTexte) console.log("  * " + t);
  console.log("Beispiele weiterhin im Ticker, aber NICHT big (Faellt/Ausgeschieden):");
  for (const t of r.routineFaelltBeispiele) console.log("  - " + t);
  console.log("Beispiele weiterhin im Ticker, aber NICHT big (Treffer):");
  for (const t of r.routineTrefferBeispiele) console.log("  - " + t);
  if (r.fehler.length) console.log("FEHLER: " + r.fehler.join(" | "));
}
console.log("\nDurchschnitt big je Spiel: " + (ergebnisse.reduce((s, r) => s + r.big, 0) / ergebnisse.length).toFixed(1));
